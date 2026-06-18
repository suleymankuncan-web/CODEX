import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

const companyId = "00000000-0000-4000-8000-000000000001";
const regionId = "00000000-0000-4000-8000-000000000101";
const storeId = "00000000-0000-4000-8000-000000000201";
const otherStoreId = "00000000-0000-4000-8000-000000000202";
const employeeId = "00000000-0000-4000-8000-000000000501";
const otherEmployeeId = "00000000-0000-4000-8000-000000000502";
const managerEmployeeId = "00000000-0000-4000-8000-000000000401";

type QueryCall = {
  sql: string;
  params: unknown[];
};

function hasPrimaryScope(params: unknown[]) {
  return params.some(
    (param) =>
      Array.isArray(param) &&
      (param.includes(storeId) || param.includes(companyId)),
  );
}

function createIncentiveDatabaseMock() {
  const incentiveQueries: QueryCall[] = [];
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes("manager_position_code")) {
      incentiveQueries.push({ sql, params });

      if (!hasPrimaryScope(params)) {
        return { rowCount: 0, rows: [] };
      }

      return {
        rowCount: 1,
        rows: [
          {
            company_id: companyId,
            region_id: regionId,
            store_id: storeId,
            store_name: "Marmara Park",
            store_type: "company",
            store_target_request_id: "target-request-1",
            store_target_amount: "1000000.0000",
            store_net_sales_amount: "1150000.0000",
            store_net_sales_source_batch_id: "batch-store-1",
            store_net_sales_source_payload_hash: "hash-store-1",
            store_net_sales_last_synced_at: "2026-05-31T21:00:00.000Z",
            manager_employee_id: managerEmployeeId,
            manager_first_name: "Ada",
            manager_last_name: "Yilmaz",
            manager_position_code: "STORE_MANAGER",
          },
        ],
      };
    }

    if (sql.includes("personnel_positive_sales_amount")) {
      incentiveQueries.push({ sql, params });

      if (!hasPrimaryScope(params)) {
        return { rowCount: 0, rows: [] };
      }

      return {
        rowCount: 2,
        rows: [
          {
            company_id: companyId,
            region_id: regionId,
            store_id: storeId,
            store_name: "Marmara Park",
            store_type: "company",
            store_target_request_id: "target-request-1",
            store_target_amount: "1000000.0000",
            store_net_sales_amount: "1150000.0000",
            store_net_sales_source_batch_id: "batch-store-1",
            personnel_target_reference_id: "target-ref-1",
            personnel_target_amount: "200000.0000",
            personnel_positive_sales_amount: "240000.0000",
            personnel_sales_source_batch_id: "batch-personnel-1",
            personnel_sales_source_payload_hash: "hash-personnel-1",
            personnel_sales_last_synced_at: "2026-05-31T21:00:00.000Z",
            employee_id: employeeId,
            first_name: "Ali",
            last_name: "Can",
            external_employee_ref: "EMP501",
            position_code: "SALES_ASSOCIATE",
          },
          {
            company_id: companyId,
            region_id: regionId,
            store_id: storeId,
            store_name: "Marmara Park",
            store_type: "company",
            store_target_request_id: "target-request-1",
            store_target_amount: "1000000.0000",
            store_net_sales_amount: "1150000.0000",
            store_net_sales_source_batch_id: "batch-store-1",
            personnel_target_reference_id: "target-ref-2",
            personnel_target_amount: "200000.0000",
            personnel_positive_sales_amount: "210000.0000",
            personnel_sales_source_batch_id: "batch-personnel-2",
            personnel_sales_source_payload_hash: "hash-personnel-2",
            personnel_sales_last_synced_at: "2026-05-31T21:00:00.000Z",
            employee_id: otherEmployeeId,
            first_name: "Ece",
            last_name: "Demir",
            external_employee_ref: "EMP502",
            position_code: "ASSISTANT_MANAGER",
          },
        ],
      };
    }

    return { rowCount: 0, rows: [] };
  });

  return {
    databaseService: { query },
    incentiveQueries,
  };
}

describe("Sales target incentive read API integration", () => {
  it("returns only the current personnel row from Store Me", async () => {
    const { databaseService } = createIncentiveDatabaseMock();
    const app = await createIntegrationApp({ databaseService });

    const response = await request(app.getHttpServer())
      .get("/api/store/me/incentives")
      .query({ period: "2026-05" })
      .set("x-user-id", "personnel-user")
      .set("x-employee-id", employeeId)
      .set("x-role-codes", "STORE_PERSONNEL")
      .set("x-read-company-ids", companyId)
      .set("x-read-store-ids", storeId);

    expect(response.status).toBe(200);
    expect(response.body.data.roleScope).toBe("own");
    expect(response.body.data.projections).toHaveLength(1);
    expect(response.body.data.projections[0].rows).toEqual([
      expect.objectContaining({
        employeeId,
        participantType: "personnel",
        payableAmount: "3960.00",
      }),
    ]);

    await app.close();
  });

  it("uses assigned store ids for store manager reads instead of broader read scope", async () => {
    const { databaseService, incentiveQueries } = createIncentiveDatabaseMock();
    const app = await createIntegrationApp({ databaseService });

    const response = await request(app.getHttpServer())
      .get("/api/store/incentives")
      .query({ period: "2026-05" })
      .set("x-user-id", "manager-user")
      .set("x-employee-id", managerEmployeeId)
      .set("x-role-codes", "STORE_MANAGER")
      .set("x-read-company-ids", companyId)
      .set("x-read-store-ids", otherStoreId)
      .set("x-assigned-store-ids", storeId);

    expect(response.status).toBe(200);
    expect(response.body.data.roleScope).toBe("store");
    expect(response.body.data.projections).toEqual([
      expect.objectContaining({
        storeId,
        rows: expect.arrayContaining([
          expect.objectContaining({ employeeId: managerEmployeeId }),
          expect.objectContaining({ employeeId }),
        ]),
      }),
    ]);
    expect(incentiveQueries).toHaveLength(2);
    expect(incentiveQueries.every((call) => call.params.some(
      (param) => Array.isArray(param) && param.includes(storeId),
    ))).toBe(true);
    expect(JSON.stringify(incentiveQueries.map((call) => call.params))).not.toContain(
      otherStoreId,
    );

    await app.close();
  });

  it("does not widen region manager reads from assigned stores to broad region scope", async () => {
    const { databaseService } = createIncentiveDatabaseMock();
    const app = await createIntegrationApp({ databaseService });

    const response = await request(app.getHttpServer())
      .get("/api/store/incentives")
      .query({ period: "2026-05" })
      .set("x-user-id", "region-user")
      .set("x-role-codes", "REGION_MANAGER")
      .set("x-read-company-ids", companyId)
      .set("x-read-region-ids", regionId);

    expect(response.status).toBe(200);
    expect(response.body.data.roleScope).toBe("region");
    expect(response.body.data.projections).toEqual([]);

    await app.close();
  });

  it("keeps admin reads on the admin-only endpoint", async () => {
    const { databaseService } = createIncentiveDatabaseMock();
    const app = await createIntegrationApp({ databaseService });

    const storeResponse = await request(app.getHttpServer())
      .get("/api/store/incentives")
      .query({ period: "2026-05" })
      .set("x-user-id", "personnel-user")
      .set("x-employee-id", employeeId)
      .set("x-role-codes", "STORE_PERSONNEL")
      .set("x-read-store-ids", storeId);
    const adminResponse = await request(app.getHttpServer())
      .get("/api/admin/incentives")
      .query({ period: "2026-05" })
      .set("x-user-id", "admin-user")
      .set("x-role-codes", "SUPER_ADMIN")
      .set("x-read-company-ids", companyId);

    expect(storeResponse.status).toBe(403);
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body.data.roleScope).toBe("admin");
    expect(adminResponse.body.data.projections).toHaveLength(1);

    await app.close();
  });
});
