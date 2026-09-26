import * as request from "supertest";
import { buildAuthenticatedUser } from "../../src/modules/auth/auth-context.service";
import { createIntegrationApp } from "./test-app";

// Traceability: TGT-FR-001..007, NFR-005/006/007, AC-TGT-001/003/006, EC-001..009/017/022.

const companyId = "00000000-0000-4000-8000-000000000001";
const otherCompanyId = "00000000-0000-4000-8000-000000000002";
const regionId = "00000000-0000-4000-8000-000000000011";
const storeId = "00000000-0000-4000-8000-000000000101";
const supportStoreId = "00000000-0000-4000-8000-000000000102";
const employeeId = "00000000-0000-4000-8000-000000000201";
const requestId = "00000000-0000-4000-8000-000000000701";

function authContext() {
  return {
    resolveUser: jest.fn(async (incoming: { headers: Record<string, string | undefined> }) => {
      const persona = incoming.headers["x-test-persona"] ?? "viewer";
      if (persona === "manager") {
        return buildAuthenticatedUser({
          userId: "00000000-0000-4000-8000-000000000902", roleCodes: ["REGION_MANAGER"],
          readScope: { companyIds: [companyId], regionIds: [regionId], storeIds: [storeId, supportStoreId] },
          actionScope: { assignedStoreIds: [storeId] },
          roleScopes: { REGION_MANAGER: { companyIds: [], regionIds: [regionId], storeIds: [storeId] } },
        });
      }
      if (persona === "store-manager") {
        return buildAuthenticatedUser({
          userId: "00000000-0000-4000-8000-000000000903", roleCodes: ["STORE_MANAGER"],
          readScope: { companyIds: [], regionIds: [], storeIds: [storeId, supportStoreId] },
          actionScope: { assignedStoreIds: [storeId, supportStoreId] },
          roleScopes: { STORE_MANAGER: { companyIds: [], regionIds: [], storeIds: [storeId] } },
        });
      }
      const mixed = persona === "mixed";
      return buildAuthenticatedUser({
        userId: "00000000-0000-4000-8000-000000000901",
        roleCodes: mixed ? ["REPORT_VIEWER", "REGION_MANAGER"] : ["REPORT_VIEWER"],
        readScope: { companyIds: [companyId, otherCompanyId], regionIds: mixed ? [regionId] : [], storeIds: mixed ? [storeId] : [] },
        actionScope: { assignedStoreIds: mixed ? [storeId] : [] },
        roleScopes: {
          REPORT_VIEWER: { companyIds: [companyId], regionIds: [], storeIds: [] },
          ...(mixed ? { REGION_MANAGER: { companyIds: [], regionIds: [regionId], storeIds: [] } } : {}),
        },
      });
    }),
  };
}

function databaseHarness() {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes("WITH scoped_store AS") && sql.includes("pending_stores")) {
      return { rowCount: 1, rows: [{
        total_stores: "1", pending_stores: "1", approved_stores: "0",
        adjusted_approved_stores: "0", returned_stores: "0", missing_stores: "0",
        total_target_value: "1000.0000",
      }] };
    }
    if (sql.includes("SELECT COUNT(*)::text AS total_count FROM ops.store store")) {
      return { rowCount: 1, rows: [{ total_count: "1" }] };
    }
    if (sql.includes("manager_assignment_exists") && sql.includes("FROM ops.company company")) {
      return { rowCount: 1, rows: [{
        company_id: companyId, company_name: "HR Axis", region_id: regionId, region_name: "Marmara",
        manager_assignment_exists: true, region_manager_name: "Bölge Müdürü",
      }] };
    }
    if (sql.includes("manager_assignment_exists") && sql.includes("WITH hierarchy_scope AS")) {
      return { rowCount: 1, rows: [{
        company_id: companyId, company_name: "HR Axis", region_id: regionId, region_name: "Marmara",
        manager_assignment_exists: true, region_manager_name: "Bölge Müdürü",
      }] };
    }
    if (sql.includes("latest_request.target_distribution_request_id")) {
      return { rowCount: 1, rows: [{
        company_id: companyId, company_name: "HR Axis", region_id: regionId, region_name: "Marmara",
        region_manager_name: "Bölge Müdürü", store_id: storeId, store_code: "ST-01", store_name: "Mağaza A",
        store_status: "active", request_id: requestId, request_status: "pending_region_approval",
        target_label: "Temmuz hedefi", total_target_value: "1000.0000", allocation_count: 1,
        request_reason: "İlk dağılım", allocation_json: [{ employeeId, assigneeLabel: "Personel A", targetValue: 1000 }],
        approved_at: null, approval_note: null, approval_evidence_json: null,
        created_at: "2026-07-01T08:00:00.000Z", updated_at: "2026-07-01T08:00:00.000Z",
        has_revision_conflict: false, has_stale_reference: false,
      }] };
    }
    if (sql.includes("position.position_name")) {
      return { rowCount: 1, rows: [{
        store_id: storeId, employee_id: employeeId, display_name: "Personel A",
        position_code: "SALES_ASSOCIATE", position_name: "Satış Danışmanı",
      }] };
    }
    if (sql.includes("DISTINCT ON (request.store_id, request.request_month)")) {
      return { rowCount: 1, rows: [{
        store_id: storeId, request_month: "2026-06-01", request_status: "approved",
        approval_evidence_json: null, approved_source_count: 1,
        approved_source_status: "approved", approved_source_evidence_json: null,
      }] };
    }
    return { rowCount: 0, rows: [] };
  });
  return { databaseService: { query, withTransaction: jest.fn() }, calls };
}

describe("Targets workspace HTTP authorization", () => {
  it("uses only the Report Viewer company role scope and rejects query scope overrides", async () => {
    const { databaseService, calls } = databaseHarness();
    const app = await createIntegrationApp({ databaseService, authContextService: authContext() });
    try {
      const response = await request(app.getHttpServer())
        .get("/api/store/targets/workspace").query({ period: "2026-07", historyYear: 2026, limit: 50 });
      expect(response.status).toBe(200);
      expect(response.body.data.view).toBe("report_viewer");
      expect(response.body.data.sections).toEqual({
        hierarchy: { status: "available" }, summary: { status: "available" },
        personnel: { status: "available" }, monthStatuses: { status: "available" },
      });
      expect(response.body.data.warnings).toEqual([]);
      expect(response.body.data.companies[0].regions[0].stores[0].storeId).toBe(storeId);
      expect(response.body.data.companies[0].regions[0].regionManager.identityStatus).toBe("resolved");
      expect(JSON.stringify(calls.map((call) => call.params))).not.toContain(otherCompanyId);
      for (const override of [{ companyId: otherCompanyId }, { regionId }, { storeId: supportStoreId }]) {
        await request(app.getHttpServer()).get("/api/store/targets/workspace")
          .query({ period: "2026-07", ...override }).expect(400);
      }
    } finally { await app.close(); }
  });

  it("keeps a mixed Report Viewer session read-only", async () => {
    const { databaseService } = databaseHarness();
    const app = await createIntegrationApp({ databaseService, authContextService: authContext() });
    try {
      const response = await request(app.getHttpServer()).get("/api/store/targets/workspace")
        .query({ period: "2026-07" }).set("x-test-persona", "mixed");
      expect(response.status).toBe(200);
      expect(response.body.data.view).toBe("report_viewer");
      expect(Object.values(response.body.data.capabilities).every((value) => value === false)).toBe(true);
      expect(Object.values(response.body.data.companies[0].regions[0].stores[0].capabilities).every((value) => value === false)).toBe(true);
    } finally { await app.close(); }
  });

  it("uses assigned stores for Region Manager and own role store for Store Manager", async () => {
    const { databaseService, calls } = databaseHarness();
    const app = await createIntegrationApp({ databaseService, authContextService: authContext() });
    try {
      await request(app.getHttpServer()).get("/api/store/targets/workspace")
        .query({ period: "2026-07" }).set("x-test-persona", "manager").expect(200);
      expect(JSON.stringify(calls.map((call) => call.params))).toContain(storeId);
      expect(JSON.stringify(calls.map((call) => call.params))).not.toContain(supportStoreId);
      calls.length = 0;
      const response = await request(app.getHttpServer()).get("/api/store/targets/workspace")
        .query({ period: "2026-07" }).set("x-test-persona", "store-manager");
      expect(response.status).toBe(200);
      expect(response.body.data.view).toBe("store_manager");
      expect(JSON.stringify(calls.map((call) => call.params))).toContain(storeId);
      expect(JSON.stringify(calls.map((call) => call.params))).not.toContain(supportStoreId);
    } finally { await app.close(); }
  });

  it("rejects Report Viewer on existing Targets mutations", async () => {
    const { databaseService } = databaseHarness();
    const app = await createIntegrationApp({ databaseService, authContextService: authContext() });
    try {
      await request(app.getHttpServer()).post("/api/target-distributions/requests")
        .send({ storeId, requestMonth: "2026-07-01", targetLabel: "x", totalTargetValue: 1, allocations: [] }).expect(403);
      await request(app.getHttpServer()).patch(`/api/target-distributions/requests/${requestId}/approve`)
        .send({ approvalNote: "x" }).expect(403);
    } finally { await app.close(); }
  });
});
