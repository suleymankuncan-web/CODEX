import * as request from "supertest";
import { createHash } from "node:crypto";
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

describe("Workforce seller code requests", () => {
  const companyId = "00000000-0000-0000-0000-000000000001";
  const otherCompanyId = "00000000-0000-0000-0000-000000000002";
  const regionId = "22222222-2222-4222-8222-222222222222";
  const otherRegionId = "22222222-2222-4222-8222-222222222223";
  const storeId = "33333333-3333-4333-8333-333333333333";
  const otherStoreId = "33333333-3333-4333-8333-333333333334";
  const positionId = "44444444-4444-4444-8444-444444444444";
  const requestId = "55555555-5555-4555-8555-555555555555";
  const actorUserId = "66666666-6666-4666-8666-666666666666";
  const positionCode = "SALES_CONSULTANT";
  const positionName = "Sales Consultant";
  const nationalId = "12345678901";
  const nationalIdHash = createHash("sha256").update(nationalId).digest("hex");
  const phoneNumber = "05551234567";
  const hireDate = "2026-05-01";

  it("returns the latest franchise FM seller code reference", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("seller_code_candidates") && sql.includes("'FM'")) {
        return {
          rowCount: 1,
          rows: [{ seller_code: "FM8375" }],
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
      .get("/api/workforce/seller-code-reference?storeType=franchise")
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "HR_ADMIN");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      storeType: "franchise",
      prefix: "FM",
      lastSellerCode: "FM8375",
      nextSellerCodePreview: "FM8376",
    });

    await app.close();
  });

  it("lets a store manager submit a seller code request with the current FM reference", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.store s") && sql.includes("s.store_type")) {
        expect(params).toEqual([storeId]);
        return {
          rowCount: 1,
          rows: [
            {
              store_id: storeId,
              store_code: "MP001",
              store_name: "Marmara Park",
              store_type: "franchise",
              company_id: companyId,
              region_id: regionId,
            },
          ],
        };
      }

      if (sql.includes("seller_code_candidates") && sql.includes("'FM'")) {
        return {
          rowCount: 1,
          rows: [{ seller_code: "FM8375" }],
        };
      }

      if (sql.includes("INSERT INTO ops.seller_code_request")) {
        expect(params).toContain(nationalIdHash);
        expect(params).toContain("8901");
        expect(params).toContain(phoneNumber);
        expect(params).toContain(hireDate);
        return {
          rowCount: 1,
          rows: [
            {
              seller_code_request_id: requestId,
              company_id: companyId,
              region_id: regionId,
              store_id: storeId,
              store_code: "MP001",
              store_name: "Marmara Park",
              store_type: "franchise",
              request_type: "create_code",
              request_status: "pending_hr_approval",
              first_name: "Ayse",
              last_name: "Yilmaz",
              national_id_hash: nationalIdHash,
              national_id_last4: "8901",
              phone_number: phoneNumber,
              requested_hire_date: hireDate,
              requested_position_id: positionId,
              position_code: positionCode,
              position_name: positionName,
              employment_type: "full_time",
              requested_seller_code: null,
              approved_seller_code: null,
              last_reference_seller_code: "FM8375",
              submitted_by_user_id: actorUserId,
              reviewed_by_user_id: null,
              reviewed_at: null,
              review_note: null,
              created_at: "2026-04-27T12:00:00.000Z",
              updated_at: "2026-04-27T12:00:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO audit.event_log")) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    });

    const withTransaction = jest.fn(
      async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
        work({ query }),
    );

    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction,
      },
    });

    const response = await request(app.getHttpServer())
      .post("/api/workforce/seller-code-requests")
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "STORE_MANAGER")
      .set("x-assigned-store-ids", storeId)
      .set("x-store-ids", storeId)
      .send({
        storeId,
        requestType: "create_code",
        firstName: "Ayse",
        lastName: "Yilmaz",
        nationalId,
        phoneNumber,
        hireDate,
        requestedPositionId: positionId,
        employmentType: "full_time",
        requestReason: "New hire",
      });

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "submitted",
      message: "Seller code request submitted for HR approval",
    });
    expect(response.body.data.request).toMatchObject({
      requestId,
      storeId,
      storeType: "franchise",
      status: "pending_hr_approval",
      firstName: "Ayse",
      lastName: "Yilmaz",
      nationalIdLast4: "8901",
      phoneNumber,
      hireDate,
      positionCode,
      positionName,
      requestedSellerCode: null,
      lastReferenceSellerCode: "FM8375",
    });
    expectAuditEvent(query, "seller_code_request.created", "ops.seller_code_request");

    await app.close();
  });

  it("lets a store manager submit a non-franchise request without entering the seller code", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.store s") && sql.includes("s.store_type")) {
        expect(params).toEqual([storeId]);
        return {
          rowCount: 1,
          rows: [
            {
              store_id: storeId,
              store_code: "CMP001",
              store_name: "Company Store",
              store_type: "company",
              company_id: companyId,
              region_id: regionId,
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO ops.seller_code_request")) {
        expect(params).toContain(nationalIdHash);
        expect(params).toContain("8901");
        expect(params).toContain(phoneNumber);
        expect(params).toContain(hireDate);
        return {
          rowCount: 1,
          rows: [
            {
              seller_code_request_id: requestId,
              company_id: companyId,
              region_id: regionId,
              store_id: storeId,
              store_code: "CMP001",
              store_name: "Company Store",
              store_type: "company",
              request_type: "create_code",
              request_status: "pending_hr_approval",
              first_name: "Mehmet",
              last_name: "Demir",
              national_id_hash: nationalIdHash,
              national_id_last4: "8901",
              phone_number: phoneNumber,
              requested_hire_date: hireDate,
              requested_position_id: positionId,
              position_code: positionCode,
              position_name: positionName,
              employment_type: "full_time",
              requested_seller_code: null,
              approved_seller_code: null,
              last_reference_seller_code: null,
              submitted_by_user_id: actorUserId,
              reviewed_by_user_id: null,
              reviewed_at: null,
              review_note: null,
              created_at: "2026-04-27T12:00:00.000Z",
              updated_at: "2026-04-27T12:00:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO audit.event_log")) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    });

    const withTransaction = jest.fn(
      async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
        work({ query }),
    );

    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction,
      },
    });

    const response = await request(app.getHttpServer())
      .post("/api/workforce/seller-code-requests")
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "STORE_MANAGER")
      .set("x-assigned-store-ids", storeId)
      .set("x-store-ids", storeId)
      .send({
        storeId,
        requestType: "create_code",
        firstName: "Mehmet",
        lastName: "Demir",
        nationalId,
        phoneNumber,
        hireDate,
        requestedPositionId: positionId,
        employmentType: "full_time",
        requestReason: "New hire",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.request).toMatchObject({
      requestId,
      storeId,
      storeType: "company",
      requestedSellerCode: null,
      approvedSellerCode: null,
      nationalIdLast4: "8901",
      phoneNumber,
      hireDate,
      positionCode,
      positionName,
    });
    expect(
      query.mock.calls.some(
        (call) => typeof call[0] === "string" && call[0].includes("seller_code_candidates"),
      ),
    ).toBe(false);

    await app.close();
  });

  it("keeps store manager seller code request lists limited to assigned stores even when company scope is present", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.seller_code_request scr") && sql.includes("ORDER BY scr.created_at DESC")) {
        expect(params).toEqual([[storeId], "pending_hr_approval"]);
        return {
          rowCount: 1,
          rows: [
            {
              seller_code_request_id: requestId,
              company_id: companyId,
              region_id: regionId,
              store_id: storeId,
              store_code: "MP001",
              store_name: "Marmara Park",
              store_type: "franchise",
              request_type: "create_code",
              request_status: "pending_hr_approval",
              first_name: "Ayse",
              last_name: "Yilmaz",
              national_id_hash: nationalIdHash,
              national_id_last4: "8901",
              phone_number: phoneNumber,
              requested_hire_date: hireDate,
              requested_position_id: positionId,
              position_code: positionCode,
              position_name: positionName,
              employment_type: "full_time",
              requested_seller_code: null,
              approved_seller_code: null,
              last_reference_seller_code: "FM8375",
              submitted_by_user_id: actorUserId,
              reviewed_by_user_id: null,
              reviewed_at: null,
              review_note: null,
              employee_id: null,
              created_at: "2026-04-27T12:00:00.000Z",
              updated_at: "2026-04-27T12:00:00.000Z",
            },
          ],
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
      .get("/api/workforce/seller-code-requests?status=pending_hr_approval")
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
      status: "pending_hr_approval",
      nationalIdLast4: "8901",
      phoneNumber,
    });

    await app.close();
  });

  it("lists position options for the selected store company", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.store s") && sql.includes("INNER JOIN ops.position p")) {
        expect(params).toEqual([storeId]);
        return {
          rowCount: 2,
          rows: [
            {
              position_id: positionId,
              position_code: "SALES_CONSULTANT",
              position_name: "Sales Consultant",
              job_family: "store",
              is_managerial: false,
            },
            {
              position_id: "44444444-4444-4444-9444-444444444444",
              position_code: "ASSISTANT_MANAGER",
              position_name: "Assistant Store Manager",
              job_family: "store",
              is_managerial: true,
            },
          ],
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
      .get(`/api/workforce/position-options?storeId=${storeId}`)
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "STORE_MANAGER")
      .set("x-assigned-store-ids", storeId)
      .set("x-store-ids", storeId);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [
        {
          positionId,
          positionCode: "SALES_CONSULTANT",
          positionName: "Sales Consultant",
          jobFamily: "store",
          isManagerial: false,
        },
        {
          positionId: "44444444-4444-4444-9444-444444444444",
          positionCode: "ASSISTANT_MANAGER",
          positionName: "Assistant Store Manager",
          jobFamily: "store",
          isManagerial: true,
        },
      ],
      meta: {
        count: 2,
        total: 2,
        limit: 2,
        offset: 0,
      },
    });

    await app.close();
  });

  it("lets HR approve a request with a manually entered FM seller code", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.seller_code_request scr") && sql.includes("WHERE scr.seller_code_request_id")) {
        expect(params).toEqual([requestId]);
        return {
          rowCount: 1,
          rows: [
            {
              seller_code_request_id: requestId,
              company_id: companyId,
              region_id: regionId,
              store_id: storeId,
              store_code: "MP001",
              store_name: "Marmara Park",
              store_type: "franchise",
              request_type: "create_code",
              request_status: "pending_hr_approval",
              first_name: "Ayse",
              last_name: "Yilmaz",
              national_id_hash: nationalIdHash,
              national_id_last4: "8901",
              phone_number: phoneNumber,
              requested_hire_date: hireDate,
              requested_position_id: positionId,
              position_code: positionCode,
              position_name: positionName,
              employment_type: "full_time",
              requested_seller_code: null,
              approved_seller_code: null,
              last_reference_seller_code: "FM8375",
              submitted_by_user_id: "store-manager-1",
              reviewed_by_user_id: null,
              reviewed_at: null,
              review_note: null,
              created_at: "2026-04-27T12:00:00.000Z",
              updated_at: "2026-04-27T12:00:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("seller_code_duplicate_count")) {
        expect(params).toEqual(["FM8376"]);
        return {
          rowCount: 1,
          rows: [{ seller_code_duplicate_count: "0" }],
        };
      }

      if (sql.includes("INSERT INTO ops.employee_assignment_history")) {
        expect(params).toEqual([
          "77777777-7777-4777-8777-777777777777",
          storeId,
          regionId,
          positionId,
          hireDate,
        ]);
        return { rowCount: 1, rows: [] };
      }

      if (sql.includes("INSERT INTO ops.employee") && sql.includes("external_employee_ref")) {
        expect(params).toEqual([
          companyId,
          "FM8376",
          "Ayse",
          "Yilmaz",
          nationalIdHash,
          hireDate,
          "full_time",
        ]);
        return {
          rowCount: 1,
          rows: [{ employee_id: "77777777-7777-4777-8777-777777777777" }],
        };
      }

      if (sql.includes("UPDATE ops.seller_code_request")) {
        return {
          rowCount: 1,
          rows: [
            {
              seller_code_request_id: requestId,
              company_id: companyId,
              region_id: regionId,
              store_id: storeId,
              store_code: "MP001",
              store_name: "Marmara Park",
              store_type: "franchise",
              request_type: "create_code",
              request_status: "approved",
              first_name: "Ayse",
              last_name: "Yilmaz",
              national_id_hash: nationalIdHash,
              national_id_last4: "8901",
              phone_number: phoneNumber,
              requested_hire_date: hireDate,
              requested_position_id: positionId,
              position_code: positionCode,
              position_name: positionName,
              employment_type: "full_time",
              requested_seller_code: null,
              approved_seller_code: "FM8376",
              last_reference_seller_code: "FM8375",
              submitted_by_user_id: "store-manager-1",
              reviewed_by_user_id: actorUserId,
              reviewed_at: "2026-04-27T12:10:00.000Z",
              review_note: "Kod acildi",
              created_at: "2026-04-27T12:00:00.000Z",
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

    const withTransaction = jest.fn(
      async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
        work({ query }),
    );

    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction,
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/workforce/seller-code-requests/${requestId}/approve`)
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "HR_ADMIN")
      .send({
        sellerCode: "FM8376",
        reviewNote: "Kod acildi",
      });

    expect(response.status).toBe(200);
    expect(response.body.command).toEqual({
      status: "approved",
      message: "Seller code request approved",
    });
    expect(response.body.data.request).toMatchObject({
      requestId,
      status: "approved",
      approvedSellerCode: "FM8376",
      lastReferenceSellerCode: "FM8375",
      nationalIdLast4: "8901",
      phoneNumber,
      hireDate,
      positionCode,
      positionName,
    });
    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(
      query.mock.calls.some(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("INSERT INTO ops.employee") &&
          call[0].includes("external_employee_ref"),
      ),
    ).toBe(true);
    expect(
      query.mock.calls.some(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("INSERT INTO ops.employee_assignment_history"),
      ),
    ).toBe(true);
    expectAuditEvent(query, "seller_code_request.approved", "ops.seller_code_request");

    await app.close();
  });

  it("rejects duplicate seller code approval before employee mutation", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.seller_code_request scr") && sql.includes("WHERE scr.seller_code_request_id")) {
        expect(params).toEqual([requestId]);
        return {
          rowCount: 1,
          rows: [
            {
              seller_code_request_id: requestId,
              company_id: companyId,
              region_id: regionId,
              store_id: storeId,
              store_code: "MP001",
              store_name: "Marmara Park",
              store_type: "franchise",
              request_type: "create_code",
              request_status: "pending_hr_approval",
              first_name: "Ayse",
              last_name: "Yilmaz",
              national_id_hash: nationalIdHash,
              national_id_last4: "8901",
              phone_number: phoneNumber,
              requested_hire_date: hireDate,
              requested_position_id: positionId,
              position_code: positionCode,
              position_name: positionName,
              employment_type: "full_time",
              requested_seller_code: null,
              approved_seller_code: null,
              last_reference_seller_code: "FM8375",
              submitted_by_user_id: "store-manager-1",
              reviewed_by_user_id: null,
              reviewed_at: null,
              review_note: null,
              created_at: "2026-04-27T12:00:00.000Z",
              updated_at: "2026-04-27T12:00:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("seller_code_duplicate_count")) {
        expect(params).toEqual(["FM8376"]);
        return {
          rowCount: 1,
          rows: [{ seller_code_duplicate_count: "1" }],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const withTransaction = jest.fn(
      async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
        work({ query }),
    );

    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction,
      },
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/workforce/seller-code-requests/${requestId}/approve`)
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "HR_ADMIN")
      .send({
        sellerCode: "FM8376",
        reviewNote: "Kod acildi",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Seller code already exists: FM8376");
    expect(withTransaction).not.toHaveBeenCalled();
    expect(
      query.mock.calls.some(
        (call) =>
          typeof call[0] === "string" &&
          (call[0].includes("INSERT INTO ops.employee") ||
            call[0].includes("UPDATE ops.seller_code_request") ||
            call[0].includes("INSERT INTO audit.event_log")),
      ),
    ).toBe(false);

    await app.close();
  });

  it("lets HR reject a pending seller code request without creating an employee", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.seller_code_request scr") && sql.includes("WHERE scr.seller_code_request_id")) {
        expect(params).toEqual([requestId]);
        return {
          rowCount: 1,
          rows: [
            {
              seller_code_request_id: requestId,
              company_id: companyId,
              region_id: regionId,
              store_id: storeId,
              store_code: "MP001",
              store_name: "Marmara Park",
              store_type: "franchise",
              request_type: "create_code",
              request_status: "pending_hr_approval",
              first_name: "Ayse",
              last_name: "Yilmaz",
              national_id_hash: nationalIdHash,
              national_id_last4: "8901",
              phone_number: phoneNumber,
              requested_hire_date: hireDate,
              requested_position_id: positionId,
              position_code: positionCode,
              position_name: positionName,
              employment_type: "full_time",
              requested_seller_code: null,
              approved_seller_code: null,
              last_reference_seller_code: "FM8375",
              submitted_by_user_id: "store-manager-1",
              reviewed_by_user_id: null,
              reviewed_at: null,
              review_note: null,
              employee_id: null,
              created_at: "2026-04-27T12:00:00.000Z",
              updated_at: "2026-04-27T12:00:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("UPDATE ops.seller_code_request")) {
        expect(params).toEqual([
          requestId,
          "rejected",
          actorUserId,
          "TC numarasi tekrar kontrol edilmeli",
        ]);
        return {
          rowCount: 1,
          rows: [
            {
              seller_code_request_id: requestId,
              company_id: companyId,
              region_id: regionId,
              store_id: storeId,
              store_code: "MP001",
              store_name: "Marmara Park",
              store_type: "franchise",
              request_type: "create_code",
              request_status: "rejected",
              first_name: "Ayse",
              last_name: "Yilmaz",
              national_id_hash: nationalIdHash,
              national_id_last4: "8901",
              phone_number: phoneNumber,
              requested_hire_date: hireDate,
              requested_position_id: positionId,
              position_code: positionCode,
              position_name: positionName,
              employment_type: "full_time",
              requested_seller_code: null,
              approved_seller_code: null,
              last_reference_seller_code: "FM8375",
              submitted_by_user_id: "store-manager-1",
              reviewed_by_user_id: actorUserId,
              reviewed_at: "2026-04-27T12:10:00.000Z",
              review_note: "TC numarasi tekrar kontrol edilmeli",
              employee_id: null,
              created_at: "2026-04-27T12:00:00.000Z",
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
      .patch(`/api/workforce/seller-code-requests/${requestId}/reject`)
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "HR_ADMIN")
      .send({
        reviewNote: "TC numarasi tekrar kontrol edilmeli",
      });

    expect(response.status).toBe(200);
    expect(response.body.command).toEqual({
      status: "rejected",
      message: "Seller code request returned to store",
    });
    expect(response.body.data.request).toMatchObject({
      requestId,
      status: "rejected",
      reviewedByUserId: actorUserId,
      reviewNote: "TC numarasi tekrar kontrol edilmeli",
      employeeId: null,
    });
    expect(
      query.mock.calls.some(
        (call) => typeof call[0] === "string" && call[0].includes("INSERT INTO ops.employee"),
      ),
    ).toBe(false);
    expectAuditEvent(query, "seller_code_request.rejected", "ops.seller_code_request");

    await app.close();
  });

  it("rejects HR approval for seller code requests outside actor company scope", async () => {
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.seller_code_request scr") && sql.includes("WHERE scr.seller_code_request_id")) {
        expect(params).toEqual([requestId]);
        return {
          rowCount: 1,
          rows: [
            {
              seller_code_request_id: requestId,
              company_id: otherCompanyId,
              region_id: otherRegionId,
              store_id: otherStoreId,
              store_code: "ANK001",
              store_name: "Other Store",
              store_type: "franchise",
              request_type: "create_code",
              request_status: "pending_hr_approval",
              first_name: "Ayse",
              last_name: "Yilmaz",
              national_id_hash: nationalIdHash,
              national_id_last4: "8901",
              phone_number: phoneNumber,
              requested_hire_date: hireDate,
              requested_position_id: positionId,
              position_code: positionCode,
              position_name: positionName,
              employment_type: "full_time",
              requested_seller_code: null,
              approved_seller_code: null,
              last_reference_seller_code: "FM8375",
              submitted_by_user_id: "store-manager-2",
              reviewed_by_user_id: null,
              reviewed_at: null,
              review_note: null,
              employee_id: null,
              created_at: "2026-04-27T12:00:00.000Z",
              updated_at: "2026-04-27T12:00:00.000Z",
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
      .patch(`/api/workforce/seller-code-requests/${requestId}/approve`)
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "HR_ADMIN")
      .set("x-company-ids", companyId)
      .send({
        sellerCode: "FM8376",
        reviewNote: "Kod acildi",
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Workforce request is outside actor review scope");
    expect(
      query.mock.calls.some(
        (call) => typeof call[0] === "string" && call[0].includes("UPDATE ops.seller_code_request"),
      ),
    ).toBe(false);

    await app.close();
  });

  it("lets a store manager edit a rejected seller code request and resubmit the same request", async () => {
    const correctedNationalId = "12345678902";
    const correctedNationalIdHash = createHash("sha256").update(correctedNationalId).digest("hex");

    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM ops.seller_code_request scr") && sql.includes("WHERE scr.seller_code_request_id")) {
        expect(params).toEqual([requestId]);
        return {
          rowCount: 1,
          rows: [
            {
              seller_code_request_id: requestId,
              company_id: companyId,
              region_id: regionId,
              store_id: storeId,
              store_code: "MP001",
              store_name: "Marmara Park",
              store_type: "franchise",
              request_type: "create_code",
              request_status: "rejected",
              first_name: "Ayse",
              last_name: "Yilmaz",
              national_id_hash: nationalIdHash,
              national_id_last4: "8901",
              phone_number: phoneNumber,
              requested_hire_date: hireDate,
              requested_position_id: positionId,
              position_code: positionCode,
              position_name: positionName,
              employment_type: "full_time",
              requested_seller_code: null,
              approved_seller_code: null,
              last_reference_seller_code: "FM8375",
              submitted_by_user_id: "store-manager-1",
              reviewed_by_user_id: actorUserId,
              reviewed_at: "2026-04-27T12:10:00.000Z",
              review_note: "TC numarasi tekrar kontrol edilmeli",
              employee_id: null,
              created_at: "2026-04-27T12:00:00.000Z",
              updated_at: "2026-04-27T12:10:00.000Z",
            },
          ],
        };
      }

      if (sql.includes("seller_code_candidates") && sql.includes("'FM'")) {
        return {
          rowCount: 1,
          rows: [{ seller_code: "FM8376" }],
        };
      }

      if (sql.includes("UPDATE ops.seller_code_request")) {
        expect(params).toEqual([
          requestId,
          "pending_hr_approval",
          "Ayse",
          "Yilmaz",
          correctedNationalIdHash,
          "8902",
          phoneNumber,
          "2026-05-02",
          positionId,
          "full_time",
          "TC guncellendi",
          "FM8376",
          actorUserId,
        ]);
        return {
          rowCount: 1,
          rows: [
            {
              seller_code_request_id: requestId,
              company_id: companyId,
              region_id: regionId,
              store_id: storeId,
              store_code: "MP001",
              store_name: "Marmara Park",
              store_type: "franchise",
              request_type: "create_code",
              request_status: "pending_hr_approval",
              first_name: "Ayse",
              last_name: "Yilmaz",
              national_id_hash: correctedNationalIdHash,
              national_id_last4: "8902",
              phone_number: phoneNumber,
              requested_hire_date: "2026-05-02",
              requested_position_id: positionId,
              position_code: positionCode,
              position_name: positionName,
              employment_type: "full_time",
              requested_seller_code: null,
              approved_seller_code: null,
              last_reference_seller_code: "FM8376",
              submitted_by_user_id: actorUserId,
              reviewed_by_user_id: null,
              reviewed_at: null,
              review_note: null,
              employee_id: null,
              created_at: "2026-04-27T12:00:00.000Z",
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
      .patch(`/api/workforce/seller-code-requests/${requestId}/resubmit`)
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "STORE_MANAGER")
      .set("x-assigned-store-ids", storeId)
      .set("x-store-ids", storeId)
      .send({
        firstName: "Ayse",
        lastName: "Yilmaz",
        nationalId: correctedNationalId,
        phoneNumber,
        hireDate: "2026-05-02",
        requestedPositionId: positionId,
        employmentType: "full_time",
        requestReason: "TC guncellendi",
      });

    expect(response.status).toBe(200);
    expect(response.body.command).toEqual({
      status: "resubmitted",
      message: "Seller code request resubmitted for HR approval",
    });
    expect(response.body.data.request).toMatchObject({
      requestId,
      status: "pending_hr_approval",
      nationalIdLast4: "8902",
      hireDate: "2026-05-02",
      reviewNote: null,
      lastReferenceSellerCode: "FM8376",
    });
    expect(
      query.mock.calls.some(
        (call) => typeof call[0] === "string" && call[0].includes("INSERT INTO ops.employee"),
      ),
    ).toBe(false);
    expectAuditEvent(query, "seller_code_request.resubmitted", "ops.seller_code_request");

    await app.close();
  });
});
