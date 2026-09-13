import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("Auth pilot user bindings", () => {
  const assignmentId = "11111111-1111-4111-8111-111111111111";
  const secondAssignmentId = "22222222-2222-4222-8222-222222222222";
  const actionStoreAssignmentId = "33333333-3333-4333-8333-333333333333";
  const adminUserId = "90000000-0000-4000-8000-000000000001";
  const reportUserId = "90000000-0000-4000-8000-000000000002";
  const snapshotUserId = "90000000-0000-4000-8000-000000000003";
  const createdUserId = "90000000-0000-4000-8000-000000000004";
  const pilotUserId = "90000000-0000-4000-8000-000000000101";
  const pilotEmployeeId = "70000000-0000-4000-8000-000000000101";
  const pilotProviderSubject = "2f7b9d1e-8a41-4c7e-9d63-0d6b3c9a5f22";
  const pilotRoleAssignmentId = "11111111-2222-4333-8444-555555555555";
  const pilotActionStoreAssignmentId = "22222222-3333-4444-8555-666666666666";
  const companyId = "10000000-0000-4000-8000-000000000001";
  const otherCompanyId = "20000000-0000-4000-8000-000000000001";
  const regionId = "10000000-0000-4000-8000-000000000011";
  const otherRegionId = "20000000-0000-4000-8000-000000000011";
  const storeId = "10000000-0000-4000-8000-000000000021";
  const otherStoreId = "20000000-0000-4000-8000-000000000021";

  it("creates a pilot user binding with HR admin access", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_action_store_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("WHERE ua.auth_provider = $1") && sql.includes("ua.provider_subject = $2")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("active_employee_access_context")) {
        return {
          rowCount: 1,
          rows: [
            {
              employee_id: pilotEmployeeId,
              external_employee_ref: "FM8375",
              first_name: "Ayse",
              last_name: "Demir",
              store_id: storeId,
              store_code: "IST-021",
              store_name: "Istanbul Field Store",
              company_id: companyId,
              region_id: regionId,
            },
          ],
        };
      }

      if (sql.includes("FROM ops.role r") && sql.includes("WHERE r.role_code = $1")) {
        return {
          rowCount: 1,
          rows: [
            {
              role_id: "60000000-0000-0000-0000-000000000003",
              role_code: "STORE_MANAGER",
              role_scope_type: "store",
              role_name: "Store Manager",
            },
          ],
        };
      }

      if (sql.includes("FROM ops.store s") && sql.includes("WHERE s.store_id = ANY")) {
        return {
          rowCount: 1,
          rows: [
            {
              store_id: storeId,
              store_code: "IST-021",
              store_name: "Istanbul Field Store",
              company_id: companyId,
              region_id: regionId,
              region_name: "Marmara",
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO ops.user_account")) {
        return {
          rowCount: 1,
          rows: [
            {
              user_id: pilotUserId,
              employee_id: pilotEmployeeId,
              username: "ayse.demir",
              email: "ayse.demir@example.com",
              auth_provider: "oidc",
              provider_subject: pilotProviderSubject,
              is_active: true,
              last_login_at: null,
              created_at: "2026-04-29T18:30:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO ops.user_role_assignment")) {
        return {
          rowCount: 1,
          rows: [
            {
              user_role_assignment_id: pilotRoleAssignmentId,
              user_id: pilotUserId,
              role_code: "STORE_MANAGER",
              scope_type: "store",
              company_id: companyId,
              region_id: regionId,
              store_id: storeId,
              start_at: "2026-04-29T18:30:00.000Z",
              end_at: null,
              created_at: "2026-04-29T18:30:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO ops.user_action_store_assignment")) {
        return {
          rowCount: 1,
          rows: [
            {
              user_action_store_assignment_id: pilotActionStoreAssignmentId,
              user_id: pilotUserId,
              username: "ayse.demir",
              email: "ayse.demir@example.com",
              store_id: storeId,
              store_code: "IST-021",
              store_name: "Istanbul Field Store",
              company_id: companyId,
              region_id: regionId,
              region_name: "Marmara",
              start_at: "2026-04-29T18:30:00.000Z",
              end_at: null,
              created_at: "2026-04-29T18:30:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO audit.event_log")) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .post("/api/auth/pilot-user-bindings")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "HR_ADMIN")
      .set("x-company-ids", companyId)
      .send({
        employeeId: pilotEmployeeId,
        authProvider: "oidc",
        providerSubject: pilotProviderSubject,
        username: "ayse.demir",
        email: "ayse.demir@example.com",
        roleCode: "STORE_MANAGER",
        storeIds: [storeId],
      });

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "created",
      message: "Pilot user binding created",
    });
    expect(response.body.data.binding.user).toMatchObject({
      userId: pilotUserId,
      employeeId: pilotEmployeeId,
      username: "ayse.demir",
      email: "ayse.demir@example.com",
      authProvider: "oidc",
      providerSubject: pilotProviderSubject,
      isActive: true,
    });
    expect(response.body.data.binding.roleAssignments).toEqual([
      {
        assignmentId: pilotRoleAssignmentId,
        userId: pilotUserId,
        roleCode: "STORE_MANAGER",
        scopeType: "store",
        companyId,
        regionId,
        storeId,
        effectiveFrom: "2026-04-29T18:30:00.000Z",
        effectiveTo: null,
        createdAt: "2026-04-29T18:30:00.000Z",
        incentiveApproval: false,
        active: true,
      },
    ]);
    expect(response.body.data.binding.actionStoreAssignments).toEqual([
      {
        assignmentId: pilotActionStoreAssignmentId,
        userId: pilotUserId,
        username: "ayse.demir",
        email: "ayse.demir@example.com",
        storeId,
        storeCode: "IST-021",
        storeName: "Istanbul Field Store",
        companyId,
        regionId,
        regionName: "Marmara",
        effectiveFrom: "2026-04-29T18:30:00.000Z",
        effectiveTo: null,
        createdAt: "2026-04-29T18:30:00.000Z",
        active: true,
      },
    ]);

    await app.close();
  });

  it("rejects HR admin pilot user bindings outside the actor company scope", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_action_store_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("WHERE ua.auth_provider = $1") && sql.includes("ua.provider_subject = $2")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("active_employee_access_context")) {
        return {
          rowCount: 1,
          rows: [
            {
              employee_id: pilotEmployeeId,
              external_employee_ref: "FM8375",
              first_name: "Ayse",
              last_name: "Demir",
              store_id: otherStoreId,
              store_code: "ANK-021",
              store_name: "Other Company Store",
              company_id: otherCompanyId,
              region_id: otherRegionId,
            },
          ],
        };
      }

      if (sql.includes("FROM ops.role r") && sql.includes("WHERE r.role_code = $1")) {
        return {
          rowCount: 1,
          rows: [
            {
              role_id: "60000000-0000-0000-0000-000000000003",
              role_code: "STORE_MANAGER",
              role_scope_type: "store",
              role_name: "Store Manager",
            },
          ],
        };
      }

      if (sql.includes("FROM ops.store s") && sql.includes("WHERE s.store_id = ANY")) {
        return {
          rowCount: 1,
          rows: [
            {
              store_id: otherStoreId,
              store_code: "ANK-021",
              store_name: "Other Company Store",
              company_id: otherCompanyId,
              region_id: otherRegionId,
              region_name: "Other Region",
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .post("/api/auth/pilot-user-bindings")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "HR_ADMIN")
      .set("x-company-ids", companyId)
      .send({
        employeeId: pilotEmployeeId,
        authProvider: "oidc",
        providerSubject: pilotProviderSubject,
        username: "ayse.demir",
        email: "ayse.demir@example.com",
        roleCode: "STORE_MANAGER",
        storeIds: [otherStoreId],
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Pilot user binding is outside actor company scope");
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO ops.user_account"), expect.anything());

    await app.close();
  });

  it("rejects pilot user binding when provider subject is already linked", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_role_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM ops.user_account ua") && sql.includes("INNER JOIN ops.user_action_store_assignment")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("WHERE ua.auth_provider = $1") && sql.includes("ua.provider_subject = $2")) {
        return {
          rowCount: 1,
          rows: [
            {
              user_id: pilotUserId,
              employee_id: pilotEmployeeId,
              username: "ayse.demir",
              email: "ayse.demir@example.com",
              is_active: true,
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer())
      .post("/api/auth/pilot-user-bindings")
      .set("x-user-id", adminUserId)
      .set("x-role-codes", "HR_ADMIN")
      .set("x-company-ids", companyId)
      .send({
        employeeId: pilotEmployeeId,
        authProvider: "oidc",
        providerSubject: pilotProviderSubject,
        username: "ayse.demir",
        email: "ayse.demir@example.com",
        roleCode: "STORE_MANAGER",
        storeIds: [storeId],
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("Provider subject is already linked to a user account");

    await app.close();
  });
});
