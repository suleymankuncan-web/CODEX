import {
  SalesTargetIncentiveClosedPeriodTargetError,
  SalesTargetIncentiveCorrectionRepository,
} from "./sales-target-incentive-correction.repository";

const companyId = "00000000-0000-4000-8000-000000000001";
const regionId = "00000000-0000-4000-8000-000000000101";
const storeId = "00000000-0000-4000-8000-000000000201";
const employeeId = "00000000-0000-4000-8000-000000000501";
const actorUserId = "00000000-0000-4000-8000-000000000901";
const ruleVersionId = "00000000-0000-4000-8000-000000000701";
const finalRuleVersionId = "00000000-0000-4000-8000-000000000702";
const finalCompanyId = "00000000-0000-4000-8000-000000000002";
const finalRegionId = "00000000-0000-4000-8000-000000000102";
const projectionId = "00000000-0000-4000-8000-000000000711";
const projectionRowId = "00000000-0000-4000-8000-000000000712";
const adjustmentId = "00000000-0000-4000-8000-000000000713";

const store = {
  companyId,
  regionId,
  storeId,
  storeName: "Marmara Park",
  storeType: "company" as const,
  storeTargetRequestId: "00000000-0000-4000-8000-000000000301",
  storeTargetAmount: "1000000.0000",
  storeNetSalesAmount: "1150000.0000",
  storeNetSalesSourceBatchId: "00000000-0000-4000-8000-000000000401",
  storeNetSalesLastSyncedAt: "2026-05-31T21:00:00.000Z",
  manager: null,
  personnel: [],
};

const participant = {
  participantType: "personnel" as const,
  employeeId,
  displayName: "Ali Can",
  positionCode: "SALES_ASSOCIATE" as const,
  normalizedFromPositionCode: null,
  targetReferenceId: "00000000-0000-4000-8000-000000000302",
  targetAmount: "200000.0000",
  actualAmount: "240000.0000",
  source: {
    storeTargetRequestId: "00000000-0000-4000-8000-000000000301",
    storeNetSalesSourceBatchId: "00000000-0000-4000-8000-000000000401",
    personnelSalesSourceBatchId: "00000000-0000-4000-8000-000000000402",
  },
  calculation: {
    status: "projected" as const,
    blockedReason: null,
    excludedReason: null,
    ruleVersionCode: "sales-target-incentive-v1.0.0" as const,
    rateTableVersion: "personnel-sales-target-v1.0.0" as const,
    positionCode: "SALES_ASSOCIATE" as const,
    normalizedFromPositionCode: null,
    storeAchievementPct: "115.0000",
    storeGatePassed: true,
    achievementPct: "120.0000",
    personalRateBeforeGate: "0.0165",
    rate: "0.0165",
    rawEarnedAmount: "3960.000000",
    payableAmount: "3960.00",
  },
};

function createHarness() {
  const query = jest.fn();
  const withTransaction = jest.fn(async (callback) => callback({ query }));
  const databaseService = { query, withTransaction };
  const repository = new SalesTargetIncentiveCorrectionRepository(databaseService as never);

  return { query, withTransaction, repository };
}

describe("SalesTargetIncentiveCorrectionRepository", () => {
  it("creates an approved pre-close correction with audit in one transaction", async () => {
    const { query, repository, withTransaction } = createHarness();
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ rule_version_id: ruleVersionId }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ projection_id: projectionId }] })
      .mockResolvedValueOnce({ rows: [{ projection_row_id: projectionRowId }] })
      .mockResolvedValueOnce({ rows: [{ current_amount: "3960.00" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            adjustment_id: adjustmentId,
            before_amount: "3960.00",
            adjustment_amount: "125.25",
            after_amount: "4085.25",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await repository.applyAdminCorrection({
      periodKey: "2026-05",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      store,
      participant,
      adjustmentAmount: "125.25",
      reasonCode: "manual_review",
      reasonNote: "Admin onayli duzeltme",
      actorUserId,
    });

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[1][0])).toContain("rpt.sales_target_incentive_final_snapshot");
    expect(String(query.mock.calls[2][0])).toContain("ops.sales_target_incentive_rule_version");
    expect(String(query.mock.calls[3][0])).toContain("pg_advisory_xact_lock");
    expect(String(query.mock.calls[4][0])).toContain("INSERT INTO ops.sales_target_incentive_projection");
    expect(String(query.mock.calls[5][0])).toContain("INSERT INTO ops.sales_target_incentive_projection_row");
    expect(query.mock.calls[4][1][20]).toEqual([]);
    expect(query.mock.calls[5][1][15]).toEqual([]);
    expect(String(query.mock.calls[6][0])).toContain("FROM ops.sales_target_incentive_adjustment adjustment");
    expect(String(query.mock.calls[7][0])).toContain("INSERT INTO ops.sales_target_incentive_adjustment");
    expect(query.mock.calls[7][1]).toEqual(
      expect.arrayContaining([
        "projection",
        "correction",
        "125.25",
        "3960.00",
        "manual_review",
        "Admin onayli duzeltme",
        actorUserId,
      ]),
    );
    expect(String(query.mock.calls[8][0])).toContain("INSERT INTO audit.event_log");
    expect(query.mock.calls[8][1][1]).toBe(adjustmentId);
    expect(JSON.parse(query.mock.calls[8][1][5] as string)).toMatchObject({
      actorUserId,
      periodKey: "2026-05",
      phase: "pre_close",
      participantType: "personnel",
      reasonCode: "manual_review",
    });
    expect(result).toMatchObject({
      adjustmentId,
      phase: "pre_close",
      adjustmentScope: "projection",
      adjustmentType: "correction",
      beforeAmount: "3960.00",
      adjustmentAmount: "125.25",
      afterAmount: "4085.25",
      status: "approved",
    });
  });

  it("rejects projection corrections when the store period is closed without a matching final row", async () => {
    const { query, repository } = createHarness();
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ closed_period_exists: 1 }] });

    await expect(
      repository.applyAdminCorrection({
        periodKey: "2026-05",
        periodStart: "2026-05-01",
        periodEnd: "2026-05-31",
        store,
        participant,
        adjustmentAmount: "125.25",
        reasonCode: "manual_review",
        reasonNote: "Admin onayli duzeltme",
        actorUserId,
      }),
    ).rejects.toThrow(SalesTargetIncentiveClosedPeriodTargetError);

    const sql = query.mock.calls.map((call) => String(call[0])).join("\n");
    expect(sql).toContain("rpt.sales_target_incentive_final_snapshot");
    expect(sql).not.toContain("INSERT INTO ops.sales_target_incentive_projection");
    expect(sql).not.toContain("INSERT INTO ops.sales_target_incentive_adjustment");
  });

  it("writes post-close corrections as final snapshot adjustments", async () => {
    const { query, repository } = createHarness();
    const finalRowId = "00000000-0000-4000-8000-000000000714";
    query
      .mockResolvedValueOnce({
        rows: [
          {
            final_row_id: finalRowId,
            company_id: finalCompanyId,
            region_id: finalRegionId,
            store_id: storeId,
            rule_version_id: finalRuleVersionId,
            final_amount: "4100.00",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ current_amount: "4100.00" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            adjustment_id: adjustmentId,
            before_amount: "4100.00",
            adjustment_amount: "-50.00",
            after_amount: "4050.00",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await repository.applyAdminCorrection({
      periodKey: "2026-05",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      store,
      participant,
      adjustmentAmount: "-50.00",
      reasonCode: "post_close_review",
      reasonNote: "Kapanis sonrasi duzeltme",
      actorUserId,
    });

    expect(String(query.mock.calls[1][0])).toContain("pg_advisory_xact_lock");
    expect(String(query.mock.calls[3][0])).toContain("INSERT INTO ops.sales_target_incentive_adjustment");
    expect(String(query.mock.calls[3][0])).not.toContain("INSERT INTO ops.sales_target_incentive_projection_row");
    expect(query.mock.calls[3][1].slice(0, 8)).toEqual([
      finalCompanyId,
      finalRegionId,
      storeId,
      employeeId,
      null,
      finalRowId,
      finalRuleVersionId,
      "2026-05",
    ]);
    expect(query.mock.calls[3][1]).toEqual(
      expect.arrayContaining(["final_snapshot", "manual_adjustment", "-50.00", "4100.00"]),
    );
    expect(query.mock.calls[4][1].slice(2, 5)).toEqual([finalCompanyId, finalRegionId, storeId]);
    expect(result).toMatchObject({
      phase: "post_close",
      adjustmentScope: "final_snapshot",
      adjustmentType: "manual_adjustment",
      beforeAmount: "4100.00",
      afterAmount: "4050.00",
    });
  });

  it("applies post-close corrections from scoped final rows without current projection payability", async () => {
    const { query, repository, withTransaction } = createHarness();
    const finalRowId = "00000000-0000-4000-8000-000000000714";
    query
      .mockResolvedValueOnce({
        rows: [
          {
            final_row_id: finalRowId,
            company_id: companyId,
            region_id: regionId,
            store_id: storeId,
            rule_version_id: ruleVersionId,
            final_amount: "4085.25",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ current_amount: "4085.25" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            adjustment_id: adjustmentId,
            before_amount: "4085.25",
            adjustment_amount: "-50.00",
            after_amount: "4035.25",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await repository.applyAdminFinalRowCorrection({
      periodKey: "2026-05",
      storeId,
      employeeId,
      participantType: "personnel",
      adjustmentAmount: "-50.00",
      reasonCode: "post_close_review",
      reasonNote: "Kapanis sonrasi duzeltme",
      actorUserId,
      readScope: {
        companyIds: [companyId],
        regionIds: [],
        storeIds: [],
        allowGlobalScope: false,
      },
    });

    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(String(query.mock.calls[0][0])).toContain("rpt.sales_target_incentive_final_row");
    expect(query.mock.calls[0][1]).toEqual([
      "2026-05",
      storeId,
      employeeId,
      "personnel",
      false,
      [companyId],
      [],
      [],
    ]);
    expect(String(query.mock.calls[1][0])).toContain("pg_advisory_xact_lock");
    expect(String(query.mock.calls[3][0])).toContain("INSERT INTO ops.sales_target_incentive_adjustment");
    expect(query.mock.calls[3][1]).toEqual(
      expect.arrayContaining(["final_snapshot", "manual_adjustment", "-50.00", "4085.25"]),
    );
    expect(String(query.mock.calls[4][0])).toContain("INSERT INTO audit.event_log");
    expect(result).toMatchObject({
      phase: "post_close",
      adjustmentScope: "final_snapshot",
      beforeAmount: "4085.25",
      afterAmount: "4035.25",
    });
  });

  it("records cumulative before and after amounts for repeat pre-close corrections", async () => {
    const { query, repository } = createHarness();
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ rule_version_id: ruleVersionId }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ projection_id: projectionId }] })
      .mockResolvedValueOnce({ rows: [{ projection_row_id: projectionRowId }] })
      .mockResolvedValueOnce({ rows: [{ current_amount: "4085.25" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            adjustment_id: adjustmentId,
            before_amount: "4085.25",
            adjustment_amount: "-35.00",
            after_amount: "4050.25",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await repository.applyAdminCorrection({
      periodKey: "2026-05",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      store,
      participant,
      adjustmentAmount: "-35.00",
      reasonCode: "repeat_review",
      reasonNote: "Ikinci duzeltme",
      actorUserId,
    });

    expect(query.mock.calls[6][1]).toEqual([
      "2026-05",
      storeId,
      employeeId,
      "personnel",
      "3960.00",
      "projection",
      "correction",
    ]);
    expect(query.mock.calls[7][1]).toEqual(
      expect.arrayContaining(["projection", "correction", "-35.00", "4085.25"]),
    );
    expect(result).toMatchObject({
      beforeAmount: "4085.25",
      adjustmentAmount: "-35.00",
      afterAmount: "4050.25",
    });
  });

  it("does not mutate raw sales import evidence when corrections are written", async () => {
    const { query, repository } = createHarness();
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ rule_version_id: ruleVersionId }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ projection_id: projectionId }] })
      .mockResolvedValueOnce({ rows: [{ projection_row_id: projectionRowId }] })
      .mockResolvedValueOnce({ rows: [{ current_amount: "3960.00" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            adjustment_id: adjustmentId,
            before_amount: "3960.00",
            adjustment_amount: "125.25",
            after_amount: "4085.25",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    await repository.applyAdminCorrection({
      periodKey: "2026-05",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
      store,
      participant,
      adjustmentAmount: "125.25",
      reasonCode: "manual_review",
      reasonNote: "Admin onayli duzeltme",
      actorUserId,
    });

    const sql = query.mock.calls.map((call) => String(call[0])).join("\n");
    expect(sql).not.toMatch(/UPDATE\s+stg\./i);
    expect(sql).not.toMatch(/DELETE\s+FROM\s+stg\./i);
    expect(sql).not.toMatch(/UPDATE\s+ops\.kpi_actual/i);
    expect(sql).toContain("INSERT INTO ops.sales_target_incentive_adjustment");
  });

  it("can include unadjusted final rows in admin adjustment summaries", async () => {
    const { query, repository } = createHarness();
    query.mockResolvedValueOnce({ rows: [] });

    await repository.listApprovedAdjustmentSummaries({
      periodKey: "2026-05",
      storeIds: [storeId],
      includeFinalRows: true,
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("adjustment_summary AS");
    expect(sql).toContain("latest_final_snapshot AS");
    expect(sql).toContain("DISTINCT ON (snapshot.period_key, snapshot.store_id)");
    expect(sql).toContain("LEFT JOIN adjustment_summary");
    expect(sql).toContain("UNION ALL");
    expect(sql).toContain("FROM rpt.sales_target_incentive_final_row final_row");
    expect(sql).toContain("NOT EXISTS");
  });
});
