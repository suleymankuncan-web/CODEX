import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

const companyId = "00000000-0000-4000-8000-000000000001";
const regionId = "00000000-0000-4000-8000-000000000101";
const storeId = "00000000-0000-4000-8000-000000000201";
const otherStoreId = "00000000-0000-4000-8000-000000000202";
const employeeId = "00000000-0000-4000-8000-000000000501";
const otherEmployeeId = "00000000-0000-4000-8000-000000000502";
const managerEmployeeId = "00000000-0000-4000-8000-000000000401";
const storeTargetRequestId = "00000000-0000-4000-8000-000000000301";
const employeeTargetReferenceId = "00000000-0000-4000-8000-000000000302";
const otherEmployeeTargetReferenceId = "00000000-0000-4000-8000-000000000303";
const storeSourceBatchId = "power-bi-export:store:2026-05";
const employeeSourceBatchId = "power-bi-export:employee:2026-05:501";
const otherEmployeeSourceBatchId = "power-bi-export:employee:2026-05:502";
const storeImportBatchId = "00000000-0000-4000-8000-000000000601";
const employeeImportBatchId = "00000000-0000-4000-8000-000000000602";
const otherEmployeeImportBatchId = "00000000-0000-4000-8000-000000000603";
const ruleVersionId = "00000000-0000-4000-8000-000000000701";
const closeRunId = "00000000-0000-4000-8000-000000000801";
const finalSnapshotId = "00000000-0000-4000-8000-000000000802";

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
  let assignmentSnapshotSequence = 0;
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
            store_target_request_id: storeTargetRequestId,
            store_target_amount: "1000000.0000",
            store_net_sales_amount: "1150000.0000",
            store_net_sales_source_batch_id: storeSourceBatchId,
            store_net_sales_import_batch_id: storeImportBatchId,
            store_net_sales_source_payload_hash: "hash-store-1",
            store_net_sales_last_synced_at: "2026-05-31T21:00:00.000Z",
            manager_employee_id: managerEmployeeId,
            manager_user_id: "00000000-0000-4000-8000-000000000901",
            manager_assignment_id: "00000000-0000-4000-8000-000000000411",
            manager_assignment_started_on: "2026-05-01",
            manager_assignment_ended_on: null,
            manager_position_id: "00000000-0000-4000-8000-000000000421",
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
            store_target_request_id: storeTargetRequestId,
            store_target_amount: "1000000.0000",
            store_net_sales_amount: "1150000.0000",
            store_net_sales_source_batch_id: storeSourceBatchId,
            store_net_sales_import_batch_id: storeImportBatchId,
            personnel_target_reference_id: employeeTargetReferenceId,
            personnel_target_amount: "200000.0000",
            personnel_positive_sales_amount: "240000.0000",
            personnel_sales_source_batch_id: employeeSourceBatchId,
            personnel_sales_import_batch_id: employeeImportBatchId,
            personnel_sales_source_payload_hash: "hash-personnel-1",
            personnel_sales_last_synced_at: "2026-05-31T21:00:00.000Z",
            employee_id: employeeId,
            user_id: "00000000-0000-4000-8000-000000000902",
            assignment_id: "00000000-0000-4000-8000-000000000511",
            assignment_started_on: "2026-05-01",
            assignment_ended_on: null,
            position_id: "00000000-0000-4000-8000-000000000521",
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
            store_target_request_id: storeTargetRequestId,
            store_target_amount: "1000000.0000",
            store_net_sales_amount: "1150000.0000",
            store_net_sales_source_batch_id: storeSourceBatchId,
            store_net_sales_import_batch_id: storeImportBatchId,
            personnel_target_reference_id: otherEmployeeTargetReferenceId,
            personnel_target_amount: "200000.0000",
            personnel_positive_sales_amount: "210000.0000",
            personnel_sales_source_batch_id: otherEmployeeSourceBatchId,
            personnel_sales_import_batch_id: otherEmployeeImportBatchId,
            personnel_sales_source_payload_hash: "hash-personnel-2",
            personnel_sales_last_synced_at: "2026-05-31T21:00:00.000Z",
            employee_id: otherEmployeeId,
            user_id: "00000000-0000-4000-8000-000000000903",
            assignment_id: "00000000-0000-4000-8000-000000000512",
            assignment_started_on: "2026-05-01",
            assignment_ended_on: null,
            position_id: "00000000-0000-4000-8000-000000000522",
            first_name: "Ece",
            last_name: "Demir",
            external_employee_ref: "EMP502",
            position_code: "ASSISTANT_MANAGER",
          },
        ],
      };
    }

    if (sql.includes("FROM stg.import_batch ib")) {
      return { rowCount: 0, rows: [] };
    }

    if (sql.includes("FROM ops.target_distribution_request tdr")) {
      return { rowCount: 0, rows: [] };
    }

    if (sql.includes("FROM ops.sales_target_incentive_rule_version")) {
      return {
        rowCount: 1,
        rows: [
          {
            rule_version_id: ruleVersionId,
            rule_version_code: "sales-target-incentive-v1.0.0",
          },
        ],
      };
    }

    if (sql.includes("FROM ops.sales_target_incentive_rate_bracket")) {
      return {
        rowCount: 1,
        rows: [
          {
            rate_table_version: "personnel-sales-target-v1.0.0",
            audience: "personnel",
            min_achievement_pct: "110.0000",
            max_achievement_pct: null,
            rate: "0.0165",
            sort_order: 1,
          },
        ],
      };
    }

    if (sql.includes("pg_advisory_xact_lock")) {
      return { rowCount: 0, rows: [] };
    }

    if (
      sql.includes("FROM rpt.sales_target_incentive_final_row final_row") &&
      sql.includes("current_amount")
    ) {
      return {
        rowCount: 1,
        rows: [
          {
            final_row_id: "00000000-0000-4000-8000-000000000803",
            company_id: companyId,
            region_id: regionId,
            store_id: storeId,
            store_name: "Marmara Park",
            employee_id: employeeId,
            user_id: "00000000-0000-4000-8000-000000000902",
            participant_type: "personnel",
            position_code: "SALES_ASSOCIATE",
            target_amount: "200000.0000",
            actual_sales_amount: "240000.0000",
            achievement_pct: "120.0000",
            applied_rate: "0.0165",
            payable_amount: "3960.00",
            final_amount: "3960.00",
            approved_adjustment_amount: "0.00",
            current_amount: "3960.00",
          },
        ],
      };
    }

    if (sql.includes("FROM ops.sales_target_incentive_region_package")) {
      return { rowCount: 0, rows: [] };
    }

    if (sql.includes("INSERT INTO ops.sales_target_incentive_store_review")) {
      return {
        rowCount: 1,
        rows: [
          {
            sales_target_incentive_store_review_id: "00000000-0000-4000-8000-000000000804",
            company_id: companyId,
            region_id: regionId,
            store_id: storeId,
            final_snapshot_id: finalSnapshotId,
            period_key: "2026-05",
            review_status: "reviewed",
            reviewed_by_user_id: actorUserId(),
            reviewed_at: "2026-06-01T08:00:00.000Z",
            updated_at: "2026-06-01T08:00:00.000Z",
          },
        ],
      };
    }

    if (sql.includes("INSERT INTO ops.sales_target_incentive_close_run")) {
      return { rowCount: 1, rows: [{ close_run_id: closeRunId }] };
    }

    if (sql.includes("INSERT INTO rpt.sales_target_incentive_rule_snapshot")) {
      return { rowCount: 1, rows: [] };
    }

    if (sql.includes("INSERT INTO rpt.sales_target_incentive_final_snapshot")) {
      return { rowCount: 1, rows: [{ final_snapshot_id: finalSnapshotId }] };
    }

    if (sql.includes("INSERT INTO rpt.sales_target_incentive_assignment_snapshot")) {
      assignmentSnapshotSequence += 1;
      return {
        rowCount: 1,
        rows: [
          {
            assignment_snapshot_id: `00000000-0000-4000-8000-0000000008${String(assignmentSnapshotSequence).padStart(2, "0")}`,
          },
        ],
      };
    }

    if (sql.includes("INSERT INTO rpt.sales_target_incentive_final_row")) {
      return { rowCount: 1, rows: [] };
    }

    if (sql.includes("UPDATE ops.sales_target_incentive_close_run")) {
      return {
        rowCount: 1,
        rows: [
          {
            close_run_id: closeRunId,
            company_id: companyId,
            period_key: "2026-05",
            period_start: "2026-05-01",
            period_end: "2026-05-31",
            close_cutoff_at: "2026-06-01T02:00:00.000+03:00",
            status: "succeeded",
            started_at: "2026-06-01T02:00:00.000+03:00",
            completed_at: "2026-06-01T02:00:01.000+03:00",
            failed_reason: null,
            source_import_batch_ids: [
              storeImportBatchId,
              employeeImportBatchId,
              otherEmployeeImportBatchId,
            ],
            final_snapshot_count: 1,
            final_row_count: 3,
          },
        ],
      };
    }

    return { rowCount: 0, rows: [] };
  });
  const withTransaction = jest.fn(async (callback) => callback({ query }));

  return {
    databaseService: { query, withTransaction },
    incentiveQueries,
    withTransaction,
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

  it("runs an admin close through the period close endpoint and writes final snapshots", async () => {
    const { databaseService, incentiveQueries, withTransaction } = createIncentiveDatabaseMock();
    const app = await createIntegrationApp({ databaseService });

    const response = await request(app.getHttpServer())
      .post("/api/admin/incentives/close-runs")
      .send({
        period: "2026-05",
        closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
      })
      .set("x-user-id", actorUserId())
      .set("x-role-codes", "SUPER_ADMIN")
      .set("x-read-company-ids", companyId);

    expect(response.status).toBe(201);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        period: "2026-05",
        closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
        finalSnapshotCount: 1,
        finalRowCount: 3,
      }),
    );
    expect(response.body.data.closeRuns).toEqual([
      expect.objectContaining({
        closeRunId,
        status: "succeeded",
      }),
    ]);
    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(incentiveQueries).toHaveLength(4);
    expect(incentiveQueries.every((call) =>
      call.sql.includes("COALESCE(ib.finished_at, ib.started_at) <="),
    )).toBe(true);

    await app.close();
  });

  it("lets Region Managers mark assigned company stores reviewed after close", async () => {
    const { databaseService } = createIncentiveDatabaseMock();
    const app = await createIntegrationApp({ databaseService });

    const response = await request(app.getHttpServer())
      .post("/api/store/incentives/store-reviews")
      .send({
        period: "2026-05",
        storeId,
        reviewStatus: "reviewed",
      })
      .set("x-user-id", actorUserId())
      .set("x-role-codes", "REGION_MANAGER")
      .set("x-assigned-store-ids", storeId);

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      period: "2026-05",
      storeId,
      reviewStatus: "reviewed",
      reviewedByUserId: actorUserId(),
    });

    await app.close();
  });
});

function actorUserId() {
  return "00000000-0000-4000-8000-000000000901";
}
