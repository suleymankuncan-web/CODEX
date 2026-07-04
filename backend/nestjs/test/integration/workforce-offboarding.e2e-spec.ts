import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

function expectAuditEvent(
  query: jest.Mock,
  eventType: string,
  entityName: string,
) {
  expect(
    query.mock.calls.some(([sql, params]) =>
      typeof sql === "string" &&
      sql.includes("INSERT INTO audit.event_log") &&
      Array.isArray(params) &&
      params.includes(eventType) &&
      params.includes(entityName),
    ),
  ).toBe(true);
}

describe("Workforce offboarding requests", () => {
  const companyId = "00000000-0000-0000-0000-000000000001";
  const otherCompanyId = "00000000-0000-0000-0000-000000000002";
  const regionId = "22222222-2222-4222-8222-222222222222";
  const otherRegionId = "22222222-2222-4222-8222-222222222223";
  const storeId = "33333333-3333-4333-8333-333333333333";
  const otherStoreId = "33333333-3333-4333-8333-333333333334";
  const employeeId = "77777777-7777-4777-8777-777777777777";
  const positionId = "44444444-4444-4444-8444-444444444444";
  const assignmentId = "88888888-8888-4888-8888-888888888888";
  const requestId = "55555555-5555-4555-8555-555555555555";
  const actorUserId = "66666666-6666-4666-8666-666666666666";
  const linkedUserId = "99999999-9999-4999-8999-999999999999";
  const terminationDate = "2026-05-10";

  const activeEmployeeRow = {
    employee_id: employeeId,
    company_id: companyId,
    region_id: regionId,
    store_id: storeId,
    assignment_id: assignmentId,
    external_employee_ref: "FM8376",
    first_name: "Ayse",
    last_name: "Yilmaz",
    position_id: positionId,
    position_code: "SALES_CONSULTANT",
    position_name: "Sales Consultant",
    assignment_start_date: "2026-05-01",
    employment_status: "active",
  };

  const pendingRequestRow = {
    offboarding_request_id: requestId,
    company_id: companyId,
    region_id: regionId,
    store_id: storeId,
    store_code: "MP001",
    store_name: "Marmara Park",
    employee_id: employeeId,
    external_employee_ref: "FM8376",
    first_name: "Ayse",
    last_name: "Yilmaz",
    position_code: "SALES_CONSULTANT",
    position_name: "Sales Consultant",
    request_status: "pending_hr_approval",
    requested_termination_date: terminationDate,
    termination_reason: "resignation",
    request_reason: "Personel istifa etti",
    submitted_by_user_id: "store-manager-1",
    reviewed_by_user_id: null,
    reviewed_at: null,
    review_note: null,
    created_at: "2026-04-27T12:00:00.000Z",
    updated_at: "2026-04-27T12:00:00.000Z",
  };

  it("lists active employees for an assigned store", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.employee_assignment_history eah") && sql.includes("e.employment_status = 'active'")) {
        expect(params).toEqual([storeId]);
        return {
          rowCount: 1,
          rows: [activeEmployeeRow],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: {
        query,
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/workforce/store-employees?storeId=${storeId}`)
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "STORE_MANAGER")
      .set("x-assigned-store-ids", storeId)
      .set("x-store-ids", storeId);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [
        {
          employeeId,
          displayName: "Ayse Yilmaz",
          externalEmployeeRef: "FM8376",
          storeId,
          positionId,
          positionCode: "SALES_CONSULTANT",
          positionName: "Sales Consultant",
          assignmentStartDate: "2026-05-01",
          employmentStatus: "active",
        },
      ],
      meta: {
        count: 1,
        total: 1,
        limit: 1,
        offset: 0,
      },
    });

    await app.close();
  });

  it("lets a store manager submit an offboarding request for an active store employee", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (
        sql.includes("FROM ops.employee_assignment_history eah") &&
        sql.includes("eah.employee_id = $2::uuid")
      ) {
        expect(params).toEqual([storeId, employeeId]);
        return {
          rowCount: 1,
          rows: [activeEmployeeRow],
        };
      }

      if (sql.includes("INSERT INTO ops.employee_offboarding_request")) {
        expect(params).toEqual([
          companyId,
          regionId,
          storeId,
          employeeId,
          terminationDate,
          "resignation",
          "Personel istifa etti",
          actorUserId,
        ]);
        return {
          rowCount: 1,
          rows: [pendingRequestRow],
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
      .post("/api/workforce/offboarding-requests")
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "STORE_MANAGER")
      .set("x-assigned-store-ids", storeId)
      .set("x-store-ids", storeId)
      .send({
        storeId,
        employeeId,
        terminationDate,
        terminationReason: "resignation",
        requestReason: "Personel istifa etti",
      });

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "submitted",
      message: "Offboarding request submitted for HR approval",
    });
    expect(response.body.data.request).toMatchObject({
      requestId,
      storeId,
      employeeId,
      displayName: "Ayse Yilmaz",
      externalEmployeeRef: "FM8376",
      positionName: "Sales Consultant",
      status: "pending_hr_approval",
      terminationDate,
      terminationReason: "resignation",
    });
    expectAuditEvent(
      query,
      "employee_offboarding_request.created",
      "ops.employee_offboarding_request",
    );

    await app.close();
  });

  it("keeps store manager offboarding request lists limited to assigned stores even when company scope is present", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (
        sql.includes("FROM ops.employee_offboarding_request eor") &&
        sql.includes("ORDER BY eor.created_at DESC")
      ) {
        expect(params).toEqual([[storeId], "pending_hr_approval", 50, 0]);
        return {
          rowCount: 1,
          rows: [pendingRequestRow],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: {
        query,
      },
    });

    const response = await request(app.getHttpServer())
      .get("/api/workforce/offboarding-requests?status=pending_hr_approval")
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "STORE_MANAGER")
      .set("x-company-ids", companyId)
      .set("x-region-ids", regionId)
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      requestId,
      storeId,
      employeeId,
      status: "pending_hr_approval",
    });

    await app.close();
  });

  it("lets HR approve an offboarding request and closes employee assignment", async () => {
    const lifecycleQueries: string[] = [];
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (
        sql.includes("FROM ops.employee_offboarding_request eor") &&
        sql.includes("WHERE eor.offboarding_request_id")
      ) {
        expect(params).toEqual([requestId]);
        return {
          rowCount: 1,
          rows: [pendingRequestRow],
        };
      }

      if (sql.includes("UPDATE ops.employee\n") && !sql.includes("employee_offboarding_request")) {
        expect(params).toEqual([employeeId, terminationDate]);
        return { rowCount: 1, rows: [] };
      }

      if (sql.includes("UPDATE ops.employee_assignment_history")) {
        expect(params).toEqual([employeeId, storeId, terminationDate]);
        return {
          rowCount: 1,
          rows: [{ assignment_id: assignmentId }],
        };
      }

      if (sql.includes("INSERT INTO ops.turnover_event")) {
        expect(params).toEqual([
          employeeId,
          storeId,
          regionId,
          companyId,
          terminationDate,
          "resignation",
          assignmentId,
        ]);
        return { rowCount: 1, rows: [] };
      }

      if (sql.includes("/* offboarding_linked_user_account */")) {
        expect(params).toEqual([employeeId]);
        return {
          rowCount: 1,
          rows: [
            {
              user_id: linkedUserId,
              employee_id: employeeId,
              username: "ayse.yilmaz",
              email: "ayse.yilmaz@example.com",
              auth_provider: "clerk",
              provider_subject: "user_31employee",
              is_active: true,
              last_login_at: null,
              created_at: "2026-04-27T10:00:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("/* access_lifecycle_lock_user */")) {
        lifecycleQueries.push("lock-user");
        expect(params).toEqual([linkedUserId]);
        return {
          rowCount: 1,
          rows: [
            {
              user_id: linkedUserId,
              employee_id: employeeId,
              username: "ayse.yilmaz",
              email: "ayse.yilmaz@example.com",
              auth_provider: "clerk",
              provider_subject: "user_31employee",
              is_active: true,
              last_login_at: null,
              created_at: "2026-04-27T10:00:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("/* access_lifecycle_deactivate_user */")) {
        lifecycleQueries.push("deactivate-user");
        expect(params).toEqual([linkedUserId, actorUserId, "employee_offboarding"]);
        return {
          rowCount: 1,
          rows: [
            {
              user_id: linkedUserId,
              employee_id: employeeId,
              username: "ayse.yilmaz",
              email: "ayse.yilmaz@example.com",
              auth_provider: "clerk",
              provider_subject: "user_31employee",
              is_active: false,
              last_login_at: null,
              created_at: "2026-04-27T10:00:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("/* access_lifecycle_close_role_assignments */")) {
        lifecycleQueries.push("close-roles");
        expect(params).toEqual([linkedUserId]);
        return {
          rowCount: 2,
          rows: [
            { user_role_assignment_id: "11111111-1111-4111-8111-111111111111" },
            { user_role_assignment_id: "22222222-2222-4222-8222-222222222222" },
          ],
        };
      }

      if (sql.includes("/* access_lifecycle_close_action_store_assignments */")) {
        lifecycleQueries.push("close-action-stores");
        expect(params).toEqual([linkedUserId]);
        return {
          rowCount: 1,
          rows: [{ user_action_store_assignment_id: "33333333-3333-4333-8333-333333333333" }],
        };
      }

      if (sql.includes("/* access_lifecycle_revoke_mobile_sessions */")) {
        lifecycleQueries.push("revoke-mobile-sessions");
        expect(params).toEqual([linkedUserId, actorUserId, "employee_offboarding"]);
        return {
          rowCount: 1,
          rows: [{ mobile_device_session_id: "44444444-4444-4444-8444-444444444444" }],
        };
      }

      if (sql.includes("UPDATE ops.employee_offboarding_request")) {
        return {
          rowCount: 1,
          rows: [
            {
              ...pendingRequestRow,
              request_status: "approved",
              reviewed_by_user_id: actorUserId,
              reviewed_at: "2026-04-27T12:10:00.000Z",
              review_note: "Cikis onaylandi",
              updated_at: "2026-04-27T12:10:00.000Z",
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
      .patch(`/api/workforce/offboarding-requests/${requestId}/approve`)
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "HR_ADMIN")
      .send({
        reviewNote: "Cikis onaylandi",
      });

    expect(response.status).toBe(200);
    expect(response.body.command).toEqual({
      status: "approved",
      message: "Offboarding request approved",
    });
    expect(response.body.data.request).toMatchObject({
      requestId,
      status: "approved",
      employeeId,
      terminationDate,
      reviewedByUserId: actorUserId,
      reviewNote: "Cikis onaylandi",
    });
    expect(response.body.data.accessClosure).toEqual({
      userAccessClosed: true,
      closedUserId: linkedUserId,
      closedRoleAssignments: 2,
      closedActionStoreAssignments: 1,
      revokedMobileSessions: 1,
    });
    expect(lifecycleQueries).toEqual([
      "lock-user",
      "deactivate-user",
      "close-roles",
      "close-action-stores",
      "revoke-mobile-sessions",
    ]);
    expectAuditEvent(
      query,
      "employee_offboarding_request.approved",
      "ops.employee_offboarding_request",
    );

    await app.close();
  });

  it("lets HR reject an offboarding request without mutating employee records", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (
        sql.includes("FROM ops.employee_offboarding_request eor") &&
        sql.includes("WHERE eor.offboarding_request_id")
      ) {
        expect(params).toEqual([requestId]);
        return {
          rowCount: 1,
          rows: [pendingRequestRow],
        };
      }

      if (sql.includes("UPDATE ops.employee_offboarding_request")) {
        expect(params).toEqual([
          requestId,
          "rejected",
          actorUserId,
          "Cikis tarihi tekrar kontrol edilmeli",
        ]);
        return {
          rowCount: 1,
          rows: [
            {
              ...pendingRequestRow,
              request_status: "rejected",
              reviewed_by_user_id: actorUserId,
              reviewed_at: "2026-04-27T12:10:00.000Z",
              review_note: "Cikis tarihi tekrar kontrol edilmeli",
              updated_at: "2026-04-27T12:10:00.000Z",
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
      .patch(`/api/workforce/offboarding-requests/${requestId}/reject`)
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "HR_ADMIN")
      .send({
        reviewNote: "Cikis tarihi tekrar kontrol edilmeli",
      });

    expect(response.status).toBe(200);
    expect(response.body.command).toEqual({
      status: "rejected",
      message: "Offboarding request returned to store",
    });
    expect(response.body.data.request).toMatchObject({
      requestId,
      status: "rejected",
      employeeId,
      reviewedByUserId: actorUserId,
      reviewNote: "Cikis tarihi tekrar kontrol edilmeli",
    });
    expect(
      query.mock.calls.some(
        (call) =>
          typeof call[0] === "string" &&
          (call[0].includes("UPDATE ops.employee\n") || call[0].includes("INSERT INTO ops.turnover_event")),
      ),
    ).toBe(false);
    expectAuditEvent(
      query,
      "employee_offboarding_request.rejected",
      "ops.employee_offboarding_request",
    );

    await app.close();
  });

  it("rejects HR approval for offboarding requests outside actor company scope", async () => {
    const outOfScopeRequestRow = {
      ...pendingRequestRow,
      company_id: otherCompanyId,
      region_id: otherRegionId,
      store_id: otherStoreId,
      store_code: "ANK001",
      store_name: "Other Store",
      submitted_by_user_id: "store-manager-2",
    };
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (
        sql.includes("FROM ops.employee_offboarding_request eor") &&
        sql.includes("WHERE eor.offboarding_request_id")
      ) {
        expect(params).toEqual([requestId]);
        return {
          rowCount: 1,
          rows: [outOfScopeRequestRow],
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
      .patch(`/api/workforce/offboarding-requests/${requestId}/approve`)
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "HR_ADMIN")
      .set("x-company-ids", companyId)
      .send({
        reviewNote: "Cikis onaylandi",
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Workforce request is outside actor review scope");
    expect(
      query.mock.calls.some(
        (call) =>
          typeof call[0] === "string" &&
          (call[0].includes("UPDATE ops.employee\n") ||
            call[0].includes("UPDATE ops.employee_offboarding_request")),
      ),
    ).toBe(false);

    await app.close();
  });

  it("lets a store manager edit a rejected offboarding request and resubmit the same request", async () => {
    const correctedTerminationDate = "2026-05-12";

    const rejectedRequestRow = {
      ...pendingRequestRow,
      request_status: "rejected",
      reviewed_by_user_id: actorUserId,
      reviewed_at: "2026-04-27T12:10:00.000Z",
      review_note: "Cikis tarihi tekrar kontrol edilmeli",
      updated_at: "2026-04-27T12:10:00.000Z",
    };

    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (
        sql.includes("FROM ops.employee_offboarding_request eor") &&
        sql.includes("WHERE eor.offboarding_request_id")
      ) {
        expect(params).toEqual([requestId]);
        return {
          rowCount: 1,
          rows: [rejectedRequestRow],
        };
      }

      if (
        sql.includes("FROM ops.employee_assignment_history eah") &&
        sql.includes("eah.employee_id = $2::uuid")
      ) {
        expect(params).toEqual([storeId, employeeId]);
        return {
          rowCount: 1,
          rows: [activeEmployeeRow],
        };
      }

      if (sql.includes("UPDATE ops.employee_offboarding_request")) {
        expect(params).toEqual([
          requestId,
          "pending_hr_approval",
          companyId,
          regionId,
          storeId,
          employeeId,
          correctedTerminationDate,
          "transfer",
          "Tarih ve sebep guncellendi",
          actorUserId,
        ]);
        return {
          rowCount: 1,
          rows: [
            {
              ...pendingRequestRow,
              request_status: "pending_hr_approval",
              requested_termination_date: correctedTerminationDate,
              termination_reason: "transfer",
              request_reason: "Tarih ve sebep guncellendi",
              submitted_by_user_id: actorUserId,
              reviewed_by_user_id: null,
              reviewed_at: null,
              review_note: null,
              updated_at: "2026-04-27T12:20:00.000Z",
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
      .patch(`/api/workforce/offboarding-requests/${requestId}/resubmit`)
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "STORE_MANAGER")
      .set("x-assigned-store-ids", storeId)
      .set("x-store-ids", storeId)
      .send({
        employeeId,
        terminationDate: correctedTerminationDate,
        terminationReason: "transfer",
        requestReason: "Tarih ve sebep guncellendi",
      });

    expect(response.status).toBe(200);
    expect(response.body.command).toEqual({
      status: "resubmitted",
      message: "Offboarding request resubmitted for HR approval",
    });
    expect(response.body.data.request).toMatchObject({
      requestId,
      status: "pending_hr_approval",
      employeeId,
      terminationDate: correctedTerminationDate,
      terminationReason: "transfer",
      reviewNote: null,
    });
    expect(
      query.mock.calls.some(
        (call) =>
          typeof call[0] === "string" &&
          (call[0].includes("UPDATE ops.employee\n") || call[0].includes("INSERT INTO ops.turnover_event")),
      ),
    ).toBe(false);
    expectAuditEvent(
      query,
      "employee_offboarding_request.resubmitted",
      "ops.employee_offboarding_request",
    );

    await app.close();
  });
});
