import { PilotRosterReconciliationRepository } from "./pilot-roster-reconciliation.repository";

function createHarness() {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params });
    if (sql.includes("target_distribution_request_id")) {
      return {
        rows: [{ target_distribution_request_id: "00000000-0000-4000-8000-000000000901" }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 1 };
  });
  const withTransaction = jest.fn(async (work) => work({ query }));
  const repository = new PilotRosterReconciliationRepository({
    withTransaction,
  } as never);

  return { repository, query, queries, withTransaction };
}

describe("PilotRosterReconciliationRepository", () => {
  it("applies resolved roster, target, and turnover rows in one transaction", async () => {
    const { repository, withTransaction } = createHarness();

    const result = await repository.applyResolvedPlan({
      actorUserId: "pilot-admin",
      activeAssignments: [
        {
          companyId: "00000000-0000-4000-8000-000000000001",
          regionId: "00000000-0000-4000-8000-000000000002",
          storeId: "00000000-0000-4000-8000-000000000003",
          employeeId: "00000000-0000-4000-8000-000000000004",
          positionId: "00000000-0000-4000-8000-000000000005",
          startDate: "2026-06-01",
        },
      ],
      targetReferences: [
        {
          companyId: "00000000-0000-4000-8000-000000000001",
          regionId: "00000000-0000-4000-8000-000000000002",
          storeId: "00000000-0000-4000-8000-000000000003",
          employeeId: "00000000-0000-4000-8000-000000000004",
          periodStart: "2026-06-01",
          targetValue: 100000,
        },
      ],
      turnoverEvents: [
        {
          companyId: "00000000-0000-4000-8000-000000000001",
          regionId: "00000000-0000-4000-8000-000000000002",
          storeId: "00000000-0000-4000-8000-000000000003",
          employeeId: "00000000-0000-4000-8000-000000000099",
          eventDate: "2026-05-31",
        },
      ],
      kpiActuals: [
        {
          companyId: "00000000-0000-4000-8000-000000000001",
          regionId: "00000000-0000-4000-8000-000000000002",
          storeId: "00000000-0000-4000-8000-000000000003",
          employeeId: "00000000-0000-4000-8000-000000000004",
          periodStart: "2026-06-01",
          scopeType: "employee",
          kpiCode: "NET_SALES",
          actualValue: 125000,
          sourceBatchId: "pilot-personnel-sales-kpi-2026-06",
        },
      ],
      snapshotPeriodsToRefresh: ["2026-06", "2026-05", "2026-06"],
    });

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      activeAssignmentsTouched: 1,
      targetReferencesTouched: 1,
      turnoverEventsTouched: 1,
      kpiActualsTouched: 1,
      snapshotPeriodsToRefresh: ["2026-05", "2026-06"],
    });
  });

  it("uses duplicate guards for active assignments, target references, and turnover events", async () => {
    const { repository, queries } = createHarness();

    await repository.applyResolvedPlan({
      actorUserId: "pilot-admin",
      activeAssignments: [
        {
          companyId: "00000000-0000-4000-8000-000000000001",
          regionId: "00000000-0000-4000-8000-000000000002",
          storeId: "00000000-0000-4000-8000-000000000003",
          employeeId: "00000000-0000-4000-8000-000000000004",
          positionId: "00000000-0000-4000-8000-000000000005",
          startDate: "2026-06-01",
        },
      ],
      targetReferences: [
        {
          companyId: "00000000-0000-4000-8000-000000000001",
          regionId: "00000000-0000-4000-8000-000000000002",
          storeId: "00000000-0000-4000-8000-000000000003",
          employeeId: "00000000-0000-4000-8000-000000000004",
          periodStart: "2026-06-01",
          targetValue: 100000,
        },
      ],
      turnoverEvents: [
        {
          companyId: "00000000-0000-4000-8000-000000000001",
          regionId: "00000000-0000-4000-8000-000000000002",
          storeId: "00000000-0000-4000-8000-000000000003",
          employeeId: "00000000-0000-4000-8000-000000000099",
          eventDate: "2026-05-31",
        },
      ],
      snapshotPeriodsToRefresh: [],
    });

    const sql = queries.map((item) => item.sql).join("\n");
    expect(sql).toContain("WHERE NOT EXISTS");
    expect(sql).toContain("ON CONFLICT (employee_id, period_start, period_end, target_type)");
    expect(sql).toContain("UPDATE ops.target_distribution_request request");
    expect(sql).toContain("termination_reason_code = 'pilot_monthly_snapshot_absence'");
    expect(sql).toContain("target_label = 'pilot_imported_personnel_targets'");
  });

  it("writes pilot KPI actuals with an import batch envelope", async () => {
    const { repository, queries } = createHarness();

    await repository.applyResolvedPlan({
      actorUserId: "pilot-admin",
      activeAssignments: [],
      targetReferences: [],
      turnoverEvents: [],
      kpiActuals: [
        {
          companyId: "00000000-0000-4000-8000-000000000001",
          regionId: "00000000-0000-4000-8000-000000000002",
          storeId: "00000000-0000-4000-8000-000000000003",
          periodStart: "2026-06-01",
          scopeType: "store",
          kpiCode: "NET_SALES",
          actualValue: 500000,
          sourceBatchId: "pilot-personnel-sales-kpi-2026-06",
        },
      ],
      snapshotPeriodsToRefresh: [],
    });

    const sql = queries.map((item) => item.sql).join("\n");
    expect(sql).toContain("Pilot roster reconciliation");
    expect(sql).toContain("pilot-personnel-sales-kpi");
    expect(sql).toContain("ON CONFLICT (kpi_id, store_id, period_type, period_start, period_end)");
    expect(sql).toContain("source_type");
    expect(sql).toContain("'integration'");
  });
});
