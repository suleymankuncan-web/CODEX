import { SnapshotOperationsRepository } from "./snapshot-operations.repository";

describe("SnapshotOperationsRepository audit reads", () => {
  const snapshotRunId = "00000000-0000-4000-8000-000000000001";
  const events = [
    {
      event_log_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      occurred_at: "2026-04-17T20:00:00.000Z",
      actor_user_id: null,
      event_type: "snapshot_run.started",
      metadata_json: {},
    },
    {
      event_log_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      occurred_at: "2026-04-17T20:00:00.000Z",
      actor_user_id: null,
      event_type: "snapshot_run.completed",
      metadata_json: {},
    },
  ];

  it("returns a page and truthful total from one bounded query", async () => {
    const query = jest.fn().mockResolvedValue({
      rowCount: events.length,
      rows: events.map((event) => ({ ...event, total_count: "3" })),
    });
    const repository = new SnapshotOperationsRepository({ query } as never);

    const result = await repository.getSnapshotRunAudit({
      snapshotRunId,
      limit: 2,
      offset: 1,
    });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("WITH filtered AS");
    expect(sql).toContain("COUNT(*)::text AS total_count");
    expect(sql).toContain("UNION ALL");
    expect(sql).toContain("ORDER BY occurred_at ASC, event_log_id ASC");
    expect(sql).toContain("LIMIT $2 OFFSET $3");
    expect(params).toEqual([snapshotRunId, 2, 1]);
    expect(result).toEqual({ rows: events, total: 3 });
  });

  it("keeps the legacy string call bounded at the default page", async () => {
    const query = jest.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const repository = new SnapshotOperationsRepository({ query } as never);

    await repository.getSnapshotRunAudit(snapshotRunId);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("LIMIT $2 OFFSET $3"),
      [snapshotRunId, 50, 0],
    );
  });

  it("keeps a nonzero total when the requested page is empty", async () => {
    const query = jest.fn().mockResolvedValue({
      rowCount: 1,
      rows: [
        {
          row_kind: "meta",
          event_log_id: null,
          occurred_at: null,
          actor_user_id: null,
          event_type: null,
          metadata_json: null,
          total_count: "3",
        },
      ],
    });
    const repository = new SnapshotOperationsRepository({ query } as never);

    const result = await repository.getSnapshotRunAudit({
      snapshotRunId,
      limit: 1,
      offset: 3,
    });

    expect(result).toEqual({ rows: [], total: 3 });
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe("SnapshotOperationsRepository snapshot needs-action reads", () => {
  const snapshotRunId = "00000000-0000-4000-8000-000000000001";
  const rerunSnapshotRunId = "00000000-0000-4000-8000-000000000002";
  const actorCompanyId = "00000000-0000-4000-8000-000000000099";
  const stuckBefore = "2026-04-17T19:00:00.000Z";
  const revision = "a".repeat(64);

  const item = {
    row_kind: "item" as const,
    snapshot_run_id: snapshotRunId,
    company_ids: [actorCompanyId],
    snapshot_date: "2026-04-17",
    snapshot_type: "monthly",
    period_start: "2026-04-01",
    period_end: "2026-04-30",
    run_status: "failed",
    generated_at: "2026-04-17T20:00:00.000Z",
    generated_by: "user-1",
    started_at: "2026-04-17T20:00:01.000Z",
    finished_at: "2026-04-17T20:01:00.000Z",
    failure_reason: "db timeout",
    rerun_of_snapshot_run_id: null,
    kpi_config_version_id: null,
    kpi_config_version_no: null,
    health_state: "retry_ready",
    action_reason: "Snapshot run failed and can be rerun",
    recommended_action: "Trigger a rerun after verifying the failure cause",
    can_rerun: true,
    rerun_count: "2",
    latest_rerun_snapshot_run_id: rerunSnapshotRunId,
    is_stuck: false,
    total_count: "3",
    revision,
  };

  it("returns a page and truthful total/revision from one scoped query", async () => {
    const query = jest.fn().mockResolvedValue({ rowCount: 1, rows: [item] });
    const repository = new SnapshotOperationsRepository({ query } as never);

    const result = await repository.listSnapshotRunsNeedingAction({
      runStatus: "failed",
      actorCompanyIds: [actorCompanyId],
      limit: 1,
      offset: 1,
      stuckBefore,
    });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("WITH scoped_base_parents AS MATERIALIZED");
    expect(sql).toContain("action_parents AS MATERIALIZED");
    expect(sql).toContain("rerun_aggregates AS MATERIALIZED");
    expect(sql).toContain("filtered_action_queue AS MATERIALIZED");
    expect(sql).not.toContain("LEFT JOIN LATERAL");
    expect(sql).toContain("rpt.snapshot_run.company_ids &&");
    expect(sql).toContain("child.company_ids &&");
    expect(sql).toContain("WHERE run_status = 'failed'");
    expect(sql).toContain("child.rerun_of_snapshot_run_id IN (");
    expect(sql).toContain("FROM action_parents action_parent");
    expect(sql).toContain("GROUP BY child.rerun_of_snapshot_run_id");
    expect(sql).toContain(
      "ORDER BY child.generated_at DESC, child.snapshot_run_id DESC",
    );
    expect(sql).toContain("ORDER BY generated_at DESC, snapshot_run_id DESC");
    expect(sql).toContain("jsonb_build_array");
    expect(sql).toContain("snapshot-needs-action:v1");
    expect(sql).toContain("to_char(");
    expect(sql).toContain("AT TIME ZONE 'UTC'");
    expect(sql).toContain("SS.US");
    expect(sql).toContain("convert_to");
    expect(sql).toContain("'UTF8'");
    expect(sql).toContain("revision_rows AS MATERIALIZED");
    expect(sql).toContain("revision_digest AS MATERIALIZED");
    expect(sql).toContain("total_count::bigint <= 10000");
    expect(sql.indexOf("WHERE run_status = 'failed'")).toBeLessThan(
      sql.indexOf("rerun_aggregates AS MATERIALIZED"),
    );
    expect(params).toEqual([
      "failed",
      [actorCompanyId],
      stuckBefore,
      [actorCompanyId],
      1,
      1,
    ]);
    expect(result).toEqual({
      rows: [
        {
          snapshot_run_id: snapshotRunId,
          company_ids: [actorCompanyId],
          snapshot_date: "2026-04-17",
          snapshot_type: "monthly",
          period_start: "2026-04-01",
          period_end: "2026-04-30",
          run_status: "failed",
          generated_at: "2026-04-17T20:00:00.000Z",
          generated_by: "user-1",
          started_at: "2026-04-17T20:00:01.000Z",
          finished_at: "2026-04-17T20:01:00.000Z",
          failure_reason: "db timeout",
          rerun_of_snapshot_run_id: null,
          kpi_config_version_id: null,
          kpi_config_version_no: null,
          health_state: "retry_ready",
          action_reason: "Snapshot run failed and can be rerun",
          recommended_action:
            "Trigger a rerun after verifying the failure cause",
          can_rerun: true,
          rerun_count: "2",
          latest_rerun_snapshot_run_id: rerunSnapshotRunId,
          is_stuck: false,
        },
      ],
      total: 3,
      revision,
    });
  });

  it("keeps a nonzero total/revision when the requested page is empty", async () => {
    const query = jest.fn().mockResolvedValue({
      rowCount: 1,
      rows: [
        {
          row_kind: "meta",
          snapshot_run_id: null,
          company_ids: null,
          snapshot_date: null,
          snapshot_type: null,
          period_start: null,
          period_end: null,
          run_status: null,
          generated_at: null,
          generated_by: null,
          started_at: null,
          finished_at: null,
          failure_reason: null,
          rerun_of_snapshot_run_id: null,
          kpi_config_version_id: null,
          kpi_config_version_no: null,
          health_state: null,
          action_reason: null,
          recommended_action: null,
          can_rerun: null,
          rerun_count: null,
          latest_rerun_snapshot_run_id: null,
          is_stuck: null,
          total_count: "3",
          revision,
        },
      ],
    });
    const repository = new SnapshotOperationsRepository({ query } as never);

    await expect(
      repository.listSnapshotRunsNeedingAction({
        limit: 1,
        offset: 3,
        stuckBefore,
      }),
    ).resolves.toEqual({ rows: [], total: 3, revision });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("does not expose a revision when the filtered total is over the hash cap", async () => {
    const query = jest.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ ...item, total_count: "10001", revision: null }],
    });
    const repository = new SnapshotOperationsRepository({ query } as never);

    await expect(
      repository.listSnapshotRunsNeedingAction({ stuckBefore }),
    ).resolves.toMatchObject({
      total: 10001,
      revision: null,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
