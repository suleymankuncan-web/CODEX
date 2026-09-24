import type { SalesTargetIncentiveProjectionStore } from "../application/sales-target-incentive-read-model.service";
import { SalesTargetIncentiveCloseRepository } from "./sales-target-incentive-close.repository";

const companyId = "00000000-0000-4000-8000-000000000001";
const regionId = "00000000-0000-4000-8000-000000000101";
const storeId = "00000000-0000-4000-8000-000000000201";
const managerEmployeeId = "00000000-0000-4000-8000-000000000401";
const personnelEmployeeId = "00000000-0000-4000-8000-000000000501";
const actorUserId = "00000000-0000-4000-8000-000000000901";
const ruleVersionId = "00000000-0000-4000-8000-000000000701";
const closeRunId = "00000000-0000-4000-8000-000000000801";
const finalSnapshotId = "00000000-0000-4000-8000-000000000802";
const managerAssignmentSnapshotId = "00000000-0000-4000-8000-000000000803";
const personnelAssignmentSnapshotId = "00000000-0000-4000-8000-000000000804";
const storeSourceBatchId = "power-bi-export:store:2026-05";
const personnelSourceBatchId = "power-bi-export:personnel:2026-05";
const storeImportBatchId = "00000000-0000-4000-8000-000000000601";
const personnelImportBatchId = "00000000-0000-4000-8000-000000000602";

const storeProjection: SalesTargetIncentiveProjectionStore = {
  companyId,
  regionId,
  storeId,
  storeName: "Marmara Park",
  storeType: "company",
  storeTargetRequestId: "00000000-0000-4000-8000-000000000301",
  storeTargetAmount: "1000000.0000",
  storeNetSalesAmount: "1150000.0000",
  storeNetSalesSourceBatchId: storeSourceBatchId,
  storeNetSalesImportBatchId: storeImportBatchId,
  storeNetSalesLastSyncedAt: "2026-05-31T21:00:00.000Z",
  manager: {
    participantType: "store_manager",
    employeeId: managerEmployeeId,
    userId: "00000000-0000-4000-8000-000000000901",
    assignmentId: "00000000-0000-4000-8000-000000000411",
    assignmentStartedOn: "2026-05-01",
    assignmentEndedOn: null,
    positionId: "00000000-0000-4000-8000-000000000421",
    displayName: "Ada Yilmaz",
    positionCode: "STORE_MANAGER",
    normalizedFromPositionCode: null,
    targetReferenceId: null,
    targetAmount: "1000000.0000",
    actualAmount: "1150000.0000",
    source: {
      storeTargetRequestId: "00000000-0000-4000-8000-000000000301",
      storeNetSalesSourceBatchId: storeSourceBatchId,
      storeNetSalesImportBatchId: storeImportBatchId,
      personnelSalesSourceBatchId: null,
      personnelSalesImportBatchId: null,
    },
    calculation: {
      status: "projected",
      blockedReason: null,
      excludedReason: null,
      ruleVersionCode: "sales-target-incentive-v1.0.0",
      rateTableVersion: "manager-sales-target-v1.0.0",
      positionCode: "STORE_MANAGER",
      normalizedFromPositionCode: null,
      storeAchievementPct: null,
      storeGatePassed: null,
      achievementPct: "115.0000",
      personalRateBeforeGate: null,
      rate: "0.0100",
      rawEarnedAmount: "11500.000000",
      payableAmount: "11500.00",
    },
  },
  personnel: [
    {
      participantType: "personnel",
      employeeId: personnelEmployeeId,
      userId: "00000000-0000-4000-8000-000000000902",
      assignmentId: "00000000-0000-4000-8000-000000000511",
      assignmentStartedOn: "2026-05-01",
      assignmentEndedOn: null,
      positionId: "00000000-0000-4000-8000-000000000521",
      displayName: "Ali Can",
      positionCode: "SALES_ASSOCIATE",
      normalizedFromPositionCode: null,
      targetReferenceId: "00000000-0000-4000-8000-000000000302",
      targetAmount: "200000.0000",
      actualAmount: "240000.0000",
      source: {
        storeTargetRequestId: "00000000-0000-4000-8000-000000000301",
        storeNetSalesSourceBatchId: storeSourceBatchId,
        storeNetSalesImportBatchId: storeImportBatchId,
        personnelSalesSourceBatchId: personnelSourceBatchId,
        personnelSalesImportBatchId: personnelImportBatchId,
      },
      calculation: {
        status: "projected",
        blockedReason: null,
        excludedReason: null,
        ruleVersionCode: "sales-target-incentive-v1.0.0",
        rateTableVersion: "personnel-sales-target-v1.0.0",
        positionCode: "SALES_ASSOCIATE",
        normalizedFromPositionCode: null,
        storeAchievementPct: "115.0000",
        storeGatePassed: true,
        achievementPct: "120.0000",
        personalRateBeforeGate: "0.0165",
        rate: "0.0165",
        rawEarnedAmount: "3960.000000",
        payableAmount: "3960.00",
      },
    },
  ],
};

function createHarness() {
  const query = jest.fn();
  const withTransaction = jest.fn(async (callback) => callback({ query }));
  const databaseService = { query, withTransaction };
  const repository = new SalesTargetIncentiveCloseRepository(databaseService as never);

  return { query, withTransaction, repository };
}

describe("SalesTargetIncentiveCloseRepository", () => {
  it("finds only companies with materialized final-day daily sales and no completed close", async () => {
    const { query, repository } = createHarness();
    query.mockResolvedValueOnce({ rows: [{ company_id: companyId }] });
    await expect(repository.listAutomaticCloseCompanyIds({
      periodKey: "2026-05", finalDay: "2026-05-31",
    })).resolves.toEqual([companyId]);
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("actual.period_type = 'daily'");
    expect(sql).toContain("actual.period_start = $2::date");
    expect(sql).toContain("actual.source_type = 'integration'");
    expect(sql).toContain("store.company_id = ANY(batch.company_ids)");
    expect(sql).toContain("closed.status = 'succeeded'");
    expect(query.mock.calls[0][1]).toEqual(["2026-05", "2026-05-31"]);
  });
  it("lists close run status with final snapshot counts", async () => {
    const { query, repository } = createHarness();
    query.mockResolvedValueOnce({
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
          source_import_batch_ids: [storeImportBatchId],
          final_snapshot_count: 1,
          final_row_count: 2,
        },
      ],
    });

    const result = await repository.listCloseRuns({
      periodKey: "2026-05",
      companyIds: [companyId],
    });

    expect(String(query.mock.calls[0][0])).toContain("FROM ops.sales_target_incentive_close_run run");
    expect(String(query.mock.calls[0][0])).toContain("rpt.sales_target_incentive_final_snapshot");
    expect(query.mock.calls[0][1]).toEqual(["2026-05", [companyId]]);
    expect(result).toEqual([
      expect.objectContaining({
        closeRunId,
        status: "succeeded",
        finalSnapshotCount: 1,
        finalRowCount: 2,
      }),
    ]);
  });

  it("creates a succeeded close run with rule, assignment, store, and final-row snapshots", async () => {
    const { query, repository, withTransaction } = createHarness();
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            rule_version_id: ruleVersionId,
            rule_version_code: "sales-target-incentive-v1.0.0",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            rate_table_version: "manager-sales-target-v1.0.0",
            audience: "store_manager",
            min_achievement_pct: "110.0000",
            max_achievement_pct: null,
            rate: "0.0100",
            sort_order: 1,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ close_run_id: closeRunId }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ final_snapshot_id: finalSnapshotId }] })
      .mockResolvedValueOnce({ rows: [{ assignment_snapshot_id: managerAssignmentSnapshotId }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ assignment_snapshot_id: personnelAssignmentSnapshotId }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
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
            source_import_batch_ids: [storeImportBatchId, personnelImportBatchId],
            final_snapshot_count: 1,
            final_row_count: 2,
          },
        ],
      });

    const result = await repository.createSucceededCloseRun({
      companyId,
      periodKey: "2026-05",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
      actorUserId,
      stores: [storeProjection],
    });

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0][0])).toContain("pg_advisory_xact_lock");
    expect(query.mock.calls[0][1]).toEqual([
      ["sales_target_incentive_close", companyId, "2026-05"].join(":"),
    ]);
    expect(String(query.mock.calls[1][0])).toContain("FROM ops.sales_target_incentive_close_run run");
    expect(query.mock.calls[1][1]).toEqual([companyId, "2026-05", [storeId]]);
    expect(String(query.mock.calls[4][0])).toContain("INSERT INTO ops.sales_target_incentive_close_run");
    expect(query.mock.calls[4][1]).toEqual(
      expect.arrayContaining([
        companyId,
        "2026-05",
        "2026-06-01T02:00:00.000+03:00",
        ruleVersionId,
        actorUserId,
        [storeImportBatchId, personnelImportBatchId],
      ]),
    );
    expect(JSON.parse(String((query.mock.calls[4][1] as unknown[])[9]))).toEqual(
      expect.objectContaining({
        sourceType: "admin_period_close",
        sourceMode: "historical_imported_backfill",
        actorUserId,
        periodKey: "2026-05",
        affectedStoreCount: 1,
        storeIds: [storeId],
      }),
    );
    expect(String(query.mock.calls[5][0])).toContain("INSERT INTO rpt.sales_target_incentive_rule_snapshot");
    expect(String(query.mock.calls[6][0])).toContain("INSERT INTO rpt.sales_target_incentive_final_snapshot");
    expect(query.mock.calls[6][1]).toEqual(
      expect.arrayContaining([
        storeProjection.storeTargetRequestId,
        storeProjection.storeTargetAmount,
        storeProjection.storeNetSalesAmount,
        "115.0000",
        true,
      ]),
    );
    expect(String(query.mock.calls[7][0])).toContain("INSERT INTO rpt.sales_target_incentive_assignment_snapshot");
    expect(query.mock.calls[7][1]).toEqual(
      expect.arrayContaining([
        managerEmployeeId,
        storeProjection.manager?.assignmentId,
        "STORE_MANAGER",
        "2026-05-01",
      ]),
    );
    expect(String(query.mock.calls[8][0])).toContain("INSERT INTO rpt.sales_target_incentive_final_row");
    expect(query.mock.calls[8][1]).toEqual(
      expect.arrayContaining([
        managerAssignmentSnapshotId,
        managerEmployeeId,
        "store_manager",
        "manager-sales-target-v1.0.0",
        "11500.00",
      ]),
    );
    expect(String(query.mock.calls[10][0])).toContain("INSERT INTO rpt.sales_target_incentive_final_row");
    expect(query.mock.calls[10][1]).toEqual(
      expect.arrayContaining([
        personnelAssignmentSnapshotId,
        personnelEmployeeId,
        "personnel",
        "personnel-sales-target-v1.0.0",
        "3960.00",
      ]),
    );
    expect(String(query.mock.calls[11][0])).toContain("SET status = 'succeeded'");
    expect(result).toEqual(
      expect.objectContaining({
        closeRunId,
        status: "succeeded",
        finalSnapshotCount: 1,
        finalRowCount: 2,
      }),
    );
  });

  it("returns an existing succeeded close run for the same period and store set", async () => {
    const { query, repository } = createHarness();
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
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
            source_import_batch_ids: [storeImportBatchId, personnelImportBatchId],
            final_snapshot_count: 1,
            final_row_count: 2,
          },
        ],
      });

    const result = await repository.createSucceededCloseRun({
      companyId,
      periodKey: "2026-05",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
      actorUserId,
      stores: [storeProjection],
    });

    expect(String(query.mock.calls[0][0])).toContain("pg_advisory_xact_lock");
    expect(String(query.mock.calls[1][0])).toContain("FROM ops.sales_target_incentive_close_run run");
    expect(query.mock.calls.some(([sql]) =>
      String(sql).includes("sales_target_incentive_rule_version"),
    )).toBe(false);
    expect(query.mock.calls.some(([sql]) =>
      String(sql).includes("INSERT INTO ops.sales_target_incentive_close_run"),
    )).toBe(false);
    expect(query.mock.calls.some(([sql]) =>
      String(sql).includes("INSERT INTO rpt.sales_target_incentive_final_snapshot"),
    )).toBe(false);
    expect(result).toEqual(
      expect.objectContaining({
        closeRunId,
        status: "succeeded",
        finalSnapshotCount: 1,
        finalRowCount: 2,
      }),
    );
  });

  it("finalizes imported historical personnel without targets as zero-amount rows", async () => {
    const { query, repository } = createHarness();
    const importedTargetStore = {
      ...storeProjection,
      storeTargetRequestId: null,
      manager: storeProjection.manager
        ? {
            ...storeProjection.manager,
            source: {
              ...storeProjection.manager.source,
              storeTargetRequestId: null,
            },
          }
        : null,
      personnel: storeProjection.personnel.map((participant) => ({
        ...participant,
        targetReferenceId: null,
        targetAmount: null,
        source: {
          ...participant.source,
          storeTargetRequestId: null,
        },
        calculation: {
          ...participant.calculation,
          status: "blocked" as const,
          blockedReason: "missing_personnel_target" as const,
          achievementPct: null,
          personalRateBeforeGate: null,
          rate: null,
          rawEarnedAmount: null,
          payableAmount: null,
        },
      })),
    };

    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            rule_version_id: ruleVersionId,
            rule_version_code: "sales-target-incentive-v1.0.0",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            rate_table_version: "manager-sales-target-v1.0.0",
            audience: "store_manager",
            min_achievement_pct: "110.0000",
            max_achievement_pct: null,
            rate: "0.0100",
            sort_order: 1,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ close_run_id: closeRunId }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ final_snapshot_id: finalSnapshotId }] })
      .mockResolvedValueOnce({ rows: [{ assignment_snapshot_id: managerAssignmentSnapshotId }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ assignment_snapshot_id: personnelAssignmentSnapshotId }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
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
            source_import_batch_ids: [storeImportBatchId, personnelImportBatchId],
            final_snapshot_count: 1,
            final_row_count: 2,
          },
        ],
      });

    const result = await repository.createSucceededCloseRun({
      companyId,
      periodKey: "2026-05",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
      actorUserId,
      stores: [importedTargetStore],
    });

    expect(String(query.mock.calls[6][0])).toContain("INSERT INTO rpt.sales_target_incentive_final_snapshot");
    expect(query.mock.calls[6][1]).toEqual(
      expect.arrayContaining([
        null,
        importedTargetStore.storeTargetAmount,
        importedTargetStore.storeNetSalesAmount,
      ]),
    );
    expect(String(query.mock.calls[7][0])).toContain("INSERT INTO rpt.sales_target_incentive_assignment_snapshot");
    expect(String(query.mock.calls[8][0])).toContain("INSERT INTO rpt.sales_target_incentive_final_row");
    expect(String(query.mock.calls[9][0])).toContain("INSERT INTO rpt.sales_target_incentive_assignment_snapshot");
    expect(String(query.mock.calls[10][0])).toContain("INSERT INTO rpt.sales_target_incentive_final_row");
    const personnelFinalRowArgs = query.mock.calls[10][1] as unknown[];
    expect(personnelFinalRowArgs).toEqual(
      expect.arrayContaining([
        personnelAssignmentSnapshotId,
        personnelEmployeeId,
        "personnel",
        "personnel-sales-target-v1.0.0",
        "240000.0000",
        "0.000000",
        "0.00",
      ]),
    );
    expect(personnelFinalRowArgs[8]).toBeNull();
    expect(personnelFinalRowArgs[9]).toBeNull();
    expect(personnelFinalRowArgs[11]).toBeNull();
    expect(personnelFinalRowArgs[12]).toBeNull();
    expect(personnelFinalRowArgs[15]).toBe("0.00");
    expect(JSON.parse(String(personnelFinalRowArgs[17]))).toEqual(
      expect.objectContaining({
        importedHistoricalPersonnelTargetMissing: true,
      }),
    );
    expect(String(query.mock.calls[11][0])).toContain("SET status = 'succeeded'");
    expect(query).toHaveBeenCalledTimes(12);
    expect(result).toEqual(
      expect.objectContaining({
        closeRunId,
        status: "succeeded",
        finalSnapshotCount: 1,
        finalRowCount: 2,
      }),
    );
  });

  it("does not finalize imported historical personnel without sales evidence as placeholders", async () => {
    const { query, repository } = createHarness();
    const importedTargetStore = {
      ...storeProjection,
      storeTargetRequestId: null,
      manager: null,
      personnel: storeProjection.personnel.map((participant) => ({
        ...participant,
        targetReferenceId: null,
        targetAmount: null,
        actualAmount: null,
        source: {
          ...participant.source,
          storeTargetRequestId: null,
          personnelSalesSourceBatchId: null,
          personnelSalesImportBatchId: null,
        },
        calculation: {
          ...participant.calculation,
          status: "blocked" as const,
          blockedReason: "missing_personnel_target" as const,
          achievementPct: null,
          personalRateBeforeGate: null,
          rate: null,
          rawEarnedAmount: null,
          payableAmount: null,
        },
      })),
    };

    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            rule_version_id: ruleVersionId,
            rule_version_code: "sales-target-incentive-v1.0.0",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ close_run_id: closeRunId }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ final_snapshot_id: finalSnapshotId }] })
      .mockResolvedValueOnce({
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
            source_import_batch_ids: [storeImportBatchId],
            final_snapshot_count: 1,
            final_row_count: 0,
          },
        ],
      });

    const result = await repository.createSucceededCloseRun({
      companyId,
      periodKey: "2026-05",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      closeCutoffAt: "2026-06-01T02:00:00.000+03:00",
      actorUserId,
      stores: [importedTargetStore],
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "succeeded",
        finalSnapshotCount: 1,
        finalRowCount: 0,
      }),
    );
    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).not.toContain("INSERT INTO rpt.sales_target_incentive_final_row");
  });
});
