import * as request from "supertest";
import { buildAuthenticatedUser } from "../../src/modules/auth/auth-context.service";
import { createIntegrationApp } from "./test-app";

// Traceability: INC-FR-001/002/009, NFR-005/006, AC-INC-005/007, EC-017/022.

const companyId = "00000000-0000-4000-8000-000000000001";
const otherCompanyId = "00000000-0000-4000-8000-000000000002";
const regionId = "00000000-0000-4000-8000-000000000101";
const storeId = "00000000-0000-4000-8000-000000000201";
const managerEmployeeId = "00000000-0000-4000-8000-000000000401";

function authContext() {
  return {
    resolveUser: jest.fn(async (incoming: { headers: Record<string, string | undefined> }) => {
      const mixed = incoming.headers["x-test-persona"] === "mixed";
      return buildAuthenticatedUser({
        userId: "00000000-0000-4000-8000-000000000901",
        roleCodes: mixed ? ["REPORT_VIEWER", "REGION_MANAGER"] : ["REPORT_VIEWER"],
        readScope: {
          companyIds: [companyId, otherCompanyId],
          regionIds: mixed ? [regionId] : [],
          storeIds: mixed ? [storeId] : [],
        },
        assignedStoreIds: mixed ? [storeId] : [],
        roleScopes: {
          REPORT_VIEWER: { companyIds: [companyId], regionIds: [], storeIds: [] },
          ...(mixed ? { REGION_MANAGER: { companyIds: [], regionIds: [regionId], storeIds: [storeId] } } : {}),
        },
      });
    }),
  };
}

function databaseHarness() {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes("manager_position_code")) {
      return {
        rowCount: 1,
        rows: [{
          company_id: companyId, region_id: regionId, store_id: storeId,
          store_name: "Marmara Park", store_type: "company",
          store_target_request_id: "00000000-0000-4000-8000-000000000301",
          store_target_amount: "1000000.0000", store_net_sales_amount: "1150000.0000",
          store_net_sales_source_batch_id: "store-source", store_net_sales_import_batch_id: "00000000-0000-4000-8000-000000000601",
          store_net_sales_source_payload_hash: "hash", store_net_sales_last_synced_at: "2026-05-31T21:00:00.000Z",
          manager_employee_id: managerEmployeeId, manager_user_id: "00000000-0000-4000-8000-000000000902",
          manager_assignment_id: "00000000-0000-4000-8000-000000000411", manager_assignment_started_on: "2026-05-01",
          manager_assignment_ended_on: null, manager_position_id: "00000000-0000-4000-8000-000000000421",
          manager_first_name: "Ada", manager_last_name: "Yilmaz", manager_position_code: "STORE_MANAGER",
        }],
      };
    }
    if (sql.includes("personnel_positive_sales_amount")) return { rowCount: 0, rows: [] };
    if (sql.includes("region_manager.display_name AS region_manager_name")) {
      return { rowCount: 1, rows: [{ company_id: companyId, region_id: regionId, region_name: "Marmara", region_manager_name: "Eda Kaya", store_id: storeId, store_code: "MP" }] };
    }
    if (sql.includes("rpt.sales_target_incentive_rule_snapshot")) {
      return { rowCount: 1, rows: [{
        store_id: storeId, final_snapshot_id: "00000000-0000-4000-8000-000000000801",
        rule_version_code: "sales-target-incentive-v1.0.0", period_timezone: "Europe/Istanbul",
        rate_table_versions: ["manager-sales-target-v1.0.0", "personnel-sales-target-v1.0.0"],
        rate_brackets_json: [
          { rate_table_version: "manager-sales-target-v1.0.0", audience: "manager", min_achievement_pct: null, max_achievement_pct: "80.0000", rate: "0.0000", sort_order: 10 },
          { rate_table_version: "manager-sales-target-v1.0.0", audience: "manager", min_achievement_pct: "80.0000", max_achievement_pct: null, rate: "0.0100", sort_order: 20 },
          { rate_table_version: "personnel-sales-target-v1.0.0", audience: "personnel", min_achievement_pct: null, max_achievement_pct: "80.0000", rate: "0.0000", sort_order: 10 },
          { rate_table_version: "personnel-sales-target-v1.0.0", audience: "personnel", min_achievement_pct: "80.0000", max_achievement_pct: null, rate: "0.0100", sort_order: 20 },
        ],
      }] };
    }
    return { rowCount: 0, rows: [] };
  });
  return { databaseService: { query, withTransaction: jest.fn() }, calls };
}

describe("Sales Target Incentive workspace HTTP authorization", () => {
  it("uses only the Report Viewer company role scope and cannot be widened by aggregate or query scope", async () => {
    const { databaseService, calls } = databaseHarness();
    const app = await createIntegrationApp({ databaseService, authContextService: authContext() });
    try {
      const response = await request(app.getHttpServer())
        .get("/api/store/incentives/workspace")
        .query({ period: "2026-05" });
      expect(response.status).toBe(200);
      expect(response.body.data.view).toBe("report_viewer");
      expect(response.body.data.regions[0].stores[0].storeId).toBe(storeId);
      expect(JSON.stringify(calls.map((call) => call.params))).not.toContain(otherCompanyId);

      for (const override of [
        { companyId: otherCompanyId },
        { regionId },
        { storeId },
      ]) {
        await request(app.getHttpServer())
          .get("/api/store/incentives/workspace")
          .query({ period: "2026-05", ...override })
          .expect(400);
      }
    } finally {
      await app.close();
    }
  });

  it("keeps a mixed Report Viewer and Region Manager session completely read-only", async () => {
    const { databaseService } = databaseHarness();
    const app = await createIntegrationApp({ databaseService, authContextService: authContext() });
    try {
      const response = await request(app.getHttpServer())
        .get("/api/store/incentives/workspace")
        .query({ period: "2026-05" })
        .set("x-test-persona", "mixed");
      expect(response.status).toBe(200);
      expect(response.body.data.view).toBe("report_viewer");
      expect(Object.values(response.body.data.capabilities).every((value) => value === false)).toBe(true);
      expect(response.body.data.regions[0].capabilities.canSubmitPackage).toBe(false);
      expect(Object.values(response.body.data.regions[0].stores[0].capabilities).every((value) => value === false)).toBe(true);
    } finally {
      await app.close();
    }
  });

  it("rejects a pure Report Viewer on every existing Incentives mutation route", async () => {
    const { databaseService } = databaseHarness();
    const app = await createIntegrationApp({ databaseService, authContextService: authContext() });
    try {
      const cases = [
        ["/api/store/incentives/store-reviews", { period: "2026-05", storeId, reviewStatus: "reviewed" }],
        ["/api/store/incentives/corrections", { period: "2026-05", storeId, employeeId: managerEmployeeId, participantType: "store_manager", finalAmount: "1.00", reasonNote: "test" }],
        ["/api/store/incentives/corrections/void", { period: "2026-05", correctionId: "00000000-0000-4000-8000-000000000951" }],
        ["/api/store/incentives/submissions", { period: "2026-05", regionId }],
      ] as const;
      for (const [path, body] of cases) {
        await request(app.getHttpServer()).post(path).send(body).expect(403);
      }
    } finally {
      await app.close();
    }
  });
});
