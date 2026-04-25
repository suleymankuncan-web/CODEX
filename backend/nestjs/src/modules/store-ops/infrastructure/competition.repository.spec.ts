import { CompetitionRepository } from "./competition.repository";

function createRepositoryHarness() {
  const executedSql: string[] = [];
  const executedParams: unknown[][] = [];
  const client = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      executedSql.push(sql);
      executedParams.push(params);

      if (sql.includes("UPDATE ops.competition_stage")) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_stage_id: "22222222-2222-4222-8222-222222222222",
              competition_id: "11111111-1111-4111-8111-111111111111",
              stage_code: "QUALIFIER",
              stage_name: "Qualifier",
              stage_order: 1,
              stage_type: "qualifier",
              starts_on: "2026-04-01",
              ends_on: "2026-04-15",
              lifecycle_state: "finalized",
              finalization_state: "overridden",
            },
          ],
        };
      }

      return { rowCount: 2, rows: [] };
    }),
  };
  const databaseService = {
    withTransaction: jest.fn(async (work: (transactionClient: typeof client) => Promise<unknown>) =>
      work(client),
    ),
    query: jest.fn(),
  };

  return {
    repository: new CompetitionRepository(databaseService as never),
    client,
    executedSql,
    executedParams,
  };
}

describe("CompetitionRepository", () => {
  it("recalculates stage scores from completed one-day store snapshots and checklist facts", async () => {
    const { repository, executedSql } = createRepositoryHarness();

    await repository.recalculateStage({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      stageId: "22222222-2222-4222-8222-222222222222",
    });

    const sql = executedSql.join("\n");
    expect(sql).toContain("FROM rpt.snapshot_run run");
    expect(sql).toContain("run.period_start = run.period_end");
    expect(sql).toContain("'BM_CHECKLIST'");
    expect(sql).toContain("'VM_CHECKLIST'");
    expect(sql).toContain("competition_stage_store_score_snapshot");
    expect(sql).toContain("competition_stage_warning");
    expect(sql).toContain("DENSE_RANK()");
  });

  it("writes finalization audit metadata with unresolved warning count", async () => {
    const { repository, executedSql, executedParams } = createRepositoryHarness();

    await repository.finalizeStage({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      stageId: "22222222-2222-4222-8222-222222222222",
      finalizationState: "overridden",
      finalizationNote: "Checklist source was verified manually.",
      unresolvedWarningCount: 2,
    });

    expect(executedSql.join("\n")).toContain("INSERT INTO audit.event_log");
    expect(JSON.stringify(executedParams)).toContain("competition_stage.finalized");
    expect(JSON.stringify(executedParams)).toContain("unresolvedWarningCount");
    expect(JSON.stringify(executedParams)).toContain("Checklist source was verified manually.");
  });
});
