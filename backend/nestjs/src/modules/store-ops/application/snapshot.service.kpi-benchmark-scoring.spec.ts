import { SnapshotService } from "./snapshot.service";

describe("SnapshotService KPI benchmark scoring", () => {
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
    const databaseService = {
      query,
      withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
        work({ query }),
    };
    const snapshotOperationsRepository = {
      findSnapshotRunById: jest.fn(async () => ({
        snapshot_run_id: "00000000-0000-4000-8000-000000000001",
        snapshot_type: "daily",
        period_start: "2026-03-01",
        period_end: "2026-03-01",
        run_status: "queued",
        kpi_config_version_id: "00000000-0000-4000-8000-000000000401",
      })),
      markSnapshotRunStarted: jest.fn(async () => undefined),
      markSnapshotRunCompleted: jest.fn(async () => undefined),
      markSnapshotRunFailed: jest.fn(async () => undefined),
    };
    const kpiConfigRepository = {
      getKpiConfigVersionById: jest.fn(async () => ({
        config_payload: {
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
        },
      })),
      getKpiConfigRows: jest.fn(async () => []),
    };
    const service = new SnapshotService(
      databaseService as never,
      { dispatch: jest.fn() } as never,
      snapshotOperationsRepository as never,
      kpiConfigRepository as never,
    );

    await service.executeSnapshotRun(
      "00000000-0000-4000-8000-000000000001",
      "2026-03-01",
      "2026-03-01",
    );

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
    const databaseService = {
      query,
      withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
        work({ query }),
    };
    const snapshotOperationsRepository = {
      findSnapshotRunById: jest.fn(async () => ({
        snapshot_run_id: "00000000-0000-4000-8000-000000000001",
        snapshot_type: "daily",
        period_start: "2026-03-01",
        period_end: "2026-03-01",
        run_status: "queued",
        kpi_config_version_id: "00000000-0000-4000-8000-000000000401",
      })),
      markSnapshotRunStarted: jest.fn(async () => undefined),
      markSnapshotRunCompleted: jest.fn(async () => undefined),
      markSnapshotRunFailed: jest.fn(async () => undefined),
    };
    const kpiConfigRepository = {
      getKpiConfigVersionById: jest.fn(async () => ({
        config_payload: {
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
                scoreBehavior: "score",
                direction: "HIGHER_IS_BETTER",
                benchmarkSource: "TARGET",
                capRatio: 1.2,
              },
            ],
          },
        },
      })),
      getKpiConfigRows: jest.fn(async () => []),
    };
    const service = new SnapshotService(
      databaseService as never,
      { dispatch: jest.fn() } as never,
      snapshotOperationsRepository as never,
      kpiConfigRepository as never,
    );

    await service.executeSnapshotRun(
      "00000000-0000-4000-8000-000000000001",
      "2026-03-01",
      "2026-03-01",
    );

    expect(kpiInserts).toHaveLength(1);
    expect(kpiInserts[0]).toContain("00000000-0000-4000-8000-000000000901");
    expect(performanceInserts).toHaveLength(1);
    expect(performanceInserts[0][5]).toBe(44);
    expect(performanceInserts[0][6]).toBe(1);
  });
});
