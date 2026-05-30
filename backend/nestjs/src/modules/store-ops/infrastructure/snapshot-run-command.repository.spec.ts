import { SnapshotRunCommandRepository } from "./snapshot-run-command.repository";

function createRepository(input?: {
  query?: jest.Mock;
  createSnapshotRun?: jest.Mock;
  recordSnapshotAuditEvent?: jest.Mock;
  getLatestPublishedKpiConfigVersion?: jest.Mock;
}) {
  const query = input?.query ?? jest.fn(async () => ({ rowCount: 0, rows: [] }));
  const client = { query };
  const databaseService = {
    withTransaction: jest.fn(async (work: (transactionClient: typeof client) => Promise<unknown>) =>
      work(client),
    ),
  };
  const snapshotOperationsRepository = {
    createSnapshotRun:
      input?.createSnapshotRun ??
      jest.fn(async () => ({
        snapshot_run_id: "snapshot-new",
        snapshot_date: "2026-04-26",
        generated_at: "2026-04-26T00:00:00.000Z",
        run_status: "queued",
        started_at: null,
        finished_at: null,
        failure_reason: null,
        rerun_of_snapshot_run_id: null,
      })),
    recordSnapshotAuditEvent:
      input?.recordSnapshotAuditEvent ?? jest.fn(async () => undefined),
  };
  const kpiConfigRepository = {
    getLatestPublishedKpiConfigVersion:
      input?.getLatestPublishedKpiConfigVersion ??
      jest.fn(async () => ({
        kpi_config_version_id: "11111111-1111-4111-8111-111111111111",
        version_no: 7,
      })),
  };

  return {
    client,
    databaseService,
    snapshotOperationsRepository,
    kpiConfigRepository,
    repository: new SnapshotRunCommandRepository(
      databaseService as never,
      snapshotOperationsRepository as never,
      kpiConfigRepository as never,
    ),
  };
}

describe("SnapshotRunCommandRepository", () => {
  it("reuses an existing snapshot run for the same idempotency key and company scope", async () => {
    const existingRun = {
      snapshot_run_id: "snapshot-existing",
      company_ids: ["company-1"],
      snapshot_date: "2026-04-26",
      generated_at: "2026-04-26T00:00:00.000Z",
      run_status: "queued",
    };
    const { repository, snapshotOperationsRepository, kpiConfigRepository } =
      createRepository({
        query: jest.fn(async () => ({ rowCount: 1, rows: [existingRun] })),
      });

    const result = await repository.createOrReuseSnapshotRun({
      snapshotType: "daily",
      periodStart: "2026-04-26",
      periodEnd: "2026-04-26",
      actorUserId: "user-1",
      idempotencyKey: "daily:2026-04-26:2026-04-26",
      actorCompanyIds: ["company-1"],
    });

    expect(result).toEqual({ ...existingRun, reused: true });
    expect(snapshotOperationsRepository.createSnapshotRun).not.toHaveBeenCalled();
    expect(snapshotOperationsRepository.recordSnapshotAuditEvent).not.toHaveBeenCalled();
    expect(kpiConfigRepository.getLatestPublishedKpiConfigVersion).not.toHaveBeenCalled();
  });

  it("creates a new snapshot run with the latest KPI config version and audit event", async () => {
    const {
      client,
      repository,
      snapshotOperationsRepository,
      kpiConfigRepository,
    } = createRepository({
      query: jest.fn(async () => ({ rowCount: 0, rows: [] })),
    });

    const result = await repository.createOrReuseSnapshotRun({
      snapshotType: "daily",
      periodStart: "2026-04-26",
      periodEnd: "2026-04-26",
      actorUserId: "user-1",
      idempotencyKey: "daily:2026-04-26:2026-04-26",
      actorCompanyIds: ["company-1"],
    });

    expect(result.snapshot_run_id).toBe("snapshot-new");
    expect(kpiConfigRepository.getLatestPublishedKpiConfigVersion).toHaveBeenCalledWith(
      client,
    );
    expect(snapshotOperationsRepository.createSnapshotRun).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotType: "daily",
        periodStart: "2026-04-26",
        periodEnd: "2026-04-26",
        actorUserId: "user-1",
        idempotencyKey: "daily:2026-04-26:2026-04-26",
        actorCompanyIds: ["company-1"],
        kpiConfigVersionId: "11111111-1111-4111-8111-111111111111",
      }),
      client,
    );
    expect(snapshotOperationsRepository.recordSnapshotAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user-1",
        eventType: "snapshot_run.created",
        snapshotRunId: "snapshot-new",
        metadata: expect.objectContaining({
          snapshotType: "daily",
          kpiConfigVersionId: "11111111-1111-4111-8111-111111111111",
          versionNo: 7,
          companyIds: ["company-1"],
        }),
      }),
      client,
    );
  });

  it("creates reruns using the parent KPI config version without refreshing config", async () => {
    const { client, repository, snapshotOperationsRepository, kpiConfigRepository } =
      createRepository({
        createSnapshotRun: jest.fn(async () => ({
          snapshot_run_id: "snapshot-rerun",
          snapshot_date: "2026-04-26",
          generated_at: "2026-04-26T00:02:00.000Z",
          run_status: "queued",
          started_at: null,
          finished_at: null,
          failure_reason: null,
          rerun_of_snapshot_run_id: "snapshot-parent",
          kpi_config_version_id: "22222222-2222-4222-8222-222222222222",
          kpi_config_version_no: 8,
        })),
      });

    const result = await repository.createRerunSnapshotRun({
      snapshotRunId: "snapshot-parent",
      actorUserId: "user-2",
      actorCompanyIds: ["company-1"],
      existing: {
        snapshot_type: "daily",
        period_start: "2026-04-26",
        period_end: "2026-04-26",
        kpi_config_version_id: "22222222-2222-4222-8222-222222222222",
        kpi_config_version_no: 8,
      },
    });

    expect(result.snapshot_run_id).toBe("snapshot-rerun");
    expect(kpiConfigRepository.getLatestPublishedKpiConfigVersion).not.toHaveBeenCalled();
    expect(snapshotOperationsRepository.createSnapshotRun).toHaveBeenCalledWith(
      expect.objectContaining({
        rerunOfSnapshotRunId: "snapshot-parent",
        kpiConfigVersionId: "22222222-2222-4222-8222-222222222222",
        idempotencyKey: expect.stringContaining("snapshot-parent:rerun:"),
      }),
      client,
    );
    expect(snapshotOperationsRepository.recordSnapshotAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "snapshot_run.rerun_requested",
        snapshotRunId: "snapshot-parent",
        metadata: expect.objectContaining({
          newSnapshotRunId: "snapshot-rerun",
          kpiConfigVersionId: "22222222-2222-4222-8222-222222222222",
          versionNo: 8,
        }),
      }),
      client,
    );
  });

  it("runs base snapshot generators in one transaction", async () => {
    const query = jest.fn(async () => ({ rowCount: 1, rows: [] }));
    const { repository, databaseService } = createRepository({ query });

    await repository.executeSnapshotRun({
      snapshotRunId: "snapshot-1",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
      personnelProfile: null,
    });

    expect(databaseService.withTransaction).toHaveBeenCalledTimes(1);
    const calledSql = (
      query.mock.calls as unknown as Array<[string, unknown[]?]>
    ).map(([sql]) => String(sql));
    expect(calledSql).toEqual([
      "SELECT rpt.generate_store_workforce_snapshot($1::uuid, $2::date, $3::date)",
      "SELECT rpt.generate_store_kpi_snapshot($1::uuid, $2::date, $3::date)",
      "SELECT rpt.generate_store_checklist_snapshot($1::uuid, $2::date, $3::date)",
      "SELECT rpt.generate_turnover_snapshot($1::uuid, $2::date, $3::date)",
    ]);
  });

  it("uses capped benchmark ratios for employee performance snapshots", async () => {
    const performanceInserts: unknown[][] = [];
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("SELECT rpt.generate_")) {
        return { rowCount: 1, rows: [] };
      }

      if (sql.includes("WITH scoped_actual")) {
        return {
          rowCount: 1,
          rows: [{ kpi_code: "UPT", benchmark_value: "3" }],
        };
      }

      if (
        sql.includes("FROM ops.kpi_actual ka") &&
        sql.includes("ka.scope_type = 'employee'") &&
        sql.includes("SUM(ka.actual_value)::text AS actual_value")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              employee_id: "00000000-0000-4000-8000-000000000101",
              store_id: "00000000-0000-4000-8000-000000000201",
              kpi_id: "00000000-0000-4000-8000-000000000301",
              kpi_code: "UPT",
              actual_value: "4.44",
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO rpt.employee_performance_snapshot")) {
        performanceInserts.push(params ?? []);
      }

      return { rowCount: 1, rows: [] };
    });
    const { repository } = createRepository({ query });

    await repository.executeSnapshotRun({
      snapshotRunId: "00000000-0000-4000-8000-000000000001",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-01",
      personnelProfile: {
        profileCode: "personnel",
        title: "Personnel score profile",
        summary: "Test profile",
        futureMetricRule: "Test",
        metrics: [
          {
            code: "UPT",
            label: "UPT",
            weightPercent: 30,
            ownerRole: "STORE_PERSONNEL",
            scoreBehavior: "warning_first",
            direction: "HIGHER_IS_BETTER",
            benchmarkSource: "TURKEY_AVERAGE",
            capRatio: 1.2,
          },
        ],
      },
    });

    expect(performanceInserts).toHaveLength(1);
    expect(performanceInserts[0][5]).toBe(36);
    expect(performanceInserts[0][6]).toBe(1);
  });

  it("scores employee target achievement from approved target references in snapshots", async () => {
    const kpiInserts: unknown[][] = [];
    const performanceInserts: unknown[][] = [];
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("SELECT rpt.generate_")) {
        return { rowCount: 1, rows: [] };
      }

      if (sql.includes("WITH scoped_actual")) {
        return { rowCount: 0, rows: [] };
      }

      if (
        sql.includes("FROM ops.kpi_actual ka") &&
        sql.includes("ka.scope_type = 'employee'") &&
        sql.includes("SUM(ka.actual_value)::text AS actual_value")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              employee_id: "00000000-0000-4000-8000-000000000101",
              store_id: "00000000-0000-4000-8000-000000000201",
              kpi_id: "00000000-0000-4000-8000-000000000301",
              kpi_code: "TARGET_ACHIEVEMENT",
              actual_value: "110000",
              target_value: "100000",
              personnel_target_reference_id: "00000000-0000-4000-8000-000000000901",
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO rpt.employee_kpi_snapshot")) {
        kpiInserts.push(params ?? []);
      }

      if (sql.includes("INSERT INTO rpt.employee_performance_snapshot")) {
        performanceInserts.push(params ?? []);
      }

      return { rowCount: 1, rows: [] };
    });
    const { repository } = createRepository({ query });

    await repository.executeSnapshotRun({
      snapshotRunId: "00000000-0000-4000-8000-000000000001",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-01",
      personnelProfile: {
        profileCode: "personnel",
        title: "Personnel score profile",
        summary: "Test profile",
        futureMetricRule: "Test",
        metrics: [
          {
            code: "TARGET_ACHIEVEMENT",
            label: "Target Achievement",
            weightPercent: 40,
            ownerRole: "STORE_PERSONNEL",
            scoreBehavior: "score_only",
            direction: "HIGHER_IS_BETTER",
            benchmarkSource: "TARGET",
            capRatio: 1.2,
          },
        ],
      },
    });

    expect(kpiInserts).toHaveLength(1);
    expect(kpiInserts[0]).toContain("00000000-0000-4000-8000-000000000901");
    expect(performanceInserts).toHaveLength(1);
    expect(performanceInserts[0][5]).toBe(44);
    expect(performanceInserts[0][6]).toBe(1);
  });
});
