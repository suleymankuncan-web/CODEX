import * as request from "supertest";
import { buildAuthenticatedUser } from "../../src/modules/auth/auth-context.service";
import { createIntegrationApp } from "./test-app";

const companyId = "00000000-0000-4000-8000-000000000001";
const managerUserId = "00000000-0000-4000-8000-000000000002";
const packageId = "00000000-0000-4000-8000-000000000003";
const submittedAt = "2026-09-01T10:00:00.000Z";
const body = { period: "2026-09", regionPackageId: packageId, submittedAt };

describe("individual final approval HTTP boundary", () => {
  let app: Awaited<ReturnType<typeof createIntegrationApp>>;
  const query = jest.fn(async (sql: string) => {
    if (sql.includes("FOR SHARE OF role_assignment")) return { rows: [{ user_role_assignment_id: packageId }] };
    if (sql.includes("package_status = 'submitted'") && sql.includes("FOR UPDATE")) return { rows: [{ sales_target_incentive_region_package_id: packageId, company_id: companyId, region_id: null, manager_user_id: managerUserId, package_scope: "manager_assignment", submitted_by_user_id: managerUserId, submitted_at: submittedAt }] };
    if (sql.includes("WITH package_stores")) return { rows: [{ stale: false }] };
    if (sql.includes("UPDATE ops.sales_target_incentive_region_package")) return { rows: [{ sales_target_incentive_region_package_id: packageId, company_id: companyId, region_id: null, manager_user_id: managerUserId, package_status: "admin_approved", reviewed_at: submittedAt }] };
    return { rows: [] };
  });
  beforeAll(async () => {
    app = await createIntegrationApp({
      databaseService: { query, withTransaction: async (fn: (client: { query: typeof query }) => Promise<unknown>) => fn({ query }) },
      authContextService: { resolveUser: async (incoming: { headers: Record<string, string> }) => {
        const role = incoming.headers["x-test-role"] ?? "REPORT_VIEWER";
        return buildAuthenticatedUser({ userId: "00000000-0000-4000-8000-000000000004", roleCodes: [role], readScope: { companyIds: [companyId], regionIds: [], storeIds: [] }, roleScopes: { [role]: { companyIds: [companyId], regionIds: [], storeIds: [] } },
          permissionScopes: incoming.headers["x-test-grant"] === "true" ? { INCENTIVE_FINAL_APPROVAL: { companyIds: [companyId], regionIds: [], storeIds: [] } } : {} });
      } },
    });
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => query.mockClear());
  it.each(["REPORT_VIEWER", "REGION_MANAGER", "SUPER_ADMIN"])("protects HR export from %s without the individual grant", async role => {
    expect((await request(app.getHttpServer()).get("/api/store/incentives/hr-handoff?period=2026-09").set("x-test-role", role)).status).toBe(403);
    expect((await request(app.getHttpServer()).post("/api/store/incentives/hr-handoff").set("x-test-role", role).send({ period: "2026-09", version: "a".repeat(64) })).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
  it("validates the HR preview period and digest before any read or send", async () => {
    expect((await request(app.getHttpServer()).get("/api/store/incentives/hr-handoff?period=2026-13").set("x-test-grant", "true")).status).toBe(400);
    expect((await request(app.getHttpServer()).post("/api/store/incentives/hr-handoff").set("x-test-grant", "true").send({ period: "2026-09", version: "bad", recipients: ["attacker@example.test"] })).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
  it.each(["REPORT_VIEWER", "REGION_MANAGER", "SUPER_ADMIN"])("does not allow %s to use the opt-in endpoint without the individual grant", async (role) => {
    expect((await request(app.getHttpServer()).post("/api/store/incentives/final-approval").set("x-test-role", role).send(body)).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
  it("requires valid package identity and timestamp before writing", async () => {
    expect((await request(app.getHttpServer()).post("/api/store/incentives/final-approval").set("x-test-grant", "true").send({ ...body, regionPackageId: "bad", submittedAt: "bad" })).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
  it("allows the granted viewer through the locked existing approval workflow", async () => {
    const response = await request(app.getHttpServer()).post("/api/store/incentives/final-approval").set("x-test-grant", "true").send(body);
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe("admin_approved");
  });
  it("does not allow viewers to grant themselves the permission", async () => {
    expect((await request(app.getHttpServer()).patch(`/api/auth/role-assignments/${packageId}/incentive-approval`).send({ enabled: true })).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
  it("validates the permission checkbox input for admins", async () => {
    expect((await request(app.getHttpServer()).patch(`/api/auth/role-assignments/${packageId}/incentive-approval`).set("x-test-role", "SUPER_ADMIN").send({ enabled: "yes" })).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});
