import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("Reporting read APIs", () => {
  it("lists snapshot runs", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("COUNT(*)::text AS total_count") && sql.includes("FROM rpt.snapshot_run")) {
        return {
          rowCount: 1,
          rows: [{ total_count: "7" }],
        };
      }

      if (sql.includes("FROM rpt.snapshot_run")) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "11111111-1111-4111-8111-111111111111",
              snapshot_date: "2026-04-17",
              snapshot_type: "monthly",
              period_start: "2026-04-01",
              period_end: "2026-04-30",
              run_status: "completed",
              generated_at: "2026-04-17T10:00:00.000Z",
              generated_by: "user-1",
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

    const response = await request(app.getHttpServer()).get("/api/reports/snapshot-runs");

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      {
        snapshotRunId: "11111111-1111-4111-8111-111111111111",
        snapshotDate: "2026-04-17",
        snapshotType: "monthly",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        runStatus: "completed",
        generatedAt: "2026-04-17T10:00:00.000Z",
        generatedBy: "user-1",
      },
    ]);
    expect(response.body.meta).toEqual({
      count: 1,
      total: 7,
      limit: 50,
      offset: 0,
    });

    await app.close();
  });

  it("returns workforce snapshot rows for a snapshot run", async () => {
    const query = jest.fn(async (sql: string) => {
      if (
        sql.includes("COUNT(*)::text AS total_count") &&
        sql.includes("FROM rpt.store_workforce_snapshot")
      ) {
        return {
          rowCount: 1,
          rows: [{ total_count: "12" }],
        };
      }

      if (sql.includes("FROM rpt.store_workforce_snapshot")) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "11111111-1111-4111-8111-111111111111",
              store_id: "22222222-2222-4222-8222-222222222222",
              position_id: "33333333-3333-4333-8333-333333333333",
              active_headcount: "10.00",
              active_fte: "9.50",
              planned_headcount: "12.00",
              planned_fte: "11.00",
              gap_headcount: "2.00",
              gap_fte: "1.50",
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

    const response = await request(app.getHttpServer()).get(
      "/api/reports/workforce?snapshotRunId=11111111-1111-4111-8111-111111111111",
    );

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      {
        snapshotRunId: "11111111-1111-4111-8111-111111111111",
        storeId: "22222222-2222-4222-8222-222222222222",
        positionId: "33333333-3333-4333-8333-333333333333",
        activeHeadcount: "10.00",
        activeFte: "9.50",
        plannedHeadcount: "12.00",
        plannedFte: "11.00",
        gapHeadcount: "2.00",
        gapFte: "1.50",
      },
    ]);
    expect(response.body.meta).toEqual({
      count: 1,
      total: 12,
      limit: 50,
      offset: 0,
    });

    await app.close();
  });

  it("returns KPI snapshot rows for a snapshot run", async () => {
    const query = jest.fn(async (sql: string) => {
      if (
        sql.includes("COUNT(*)::text AS total_count") &&
        sql.includes("FROM rpt.store_kpi_snapshot")
      ) {
        return {
          rowCount: 1,
          rows: [{ total_count: "9" }],
        };
      }

      if (sql.includes("FROM rpt.store_kpi_snapshot")) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "11111111-1111-4111-8111-111111111111",
              store_id: "22222222-2222-4222-8222-222222222222",
              kpi_id: "44444444-4444-4444-8444-444444444444",
              period_start: "2026-04-01",
              period_end: "2026-04-30",
              target_value: "100.0000",
              actual_value: "95.0000",
              achievement_rate: "0.9500",
              status_band: "on_track",
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

    const response = await request(app.getHttpServer()).get(
      "/api/reports/kpis?snapshotRunId=11111111-1111-4111-8111-111111111111",
    );

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      {
        snapshotRunId: "11111111-1111-4111-8111-111111111111",
        storeId: "22222222-2222-4222-8222-222222222222",
        kpiId: "44444444-4444-4444-8444-444444444444",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        targetValue: "100.0000",
        actualValue: "95.0000",
        achievementRate: "0.9500",
        statusBand: "on_track",
      },
    ]);
    expect(response.body.meta).toEqual({
      count: 1,
      total: 9,
      limit: 50,
      offset: 0,
    });

    await app.close();
  });

  it("keeps store manager KPI report rows limited to assigned stores even when company scope is present", async () => {
    const snapshotRunId = "11111111-1111-4111-8111-111111111111";
    const companyId = "00000000-0000-0000-0000-000000000001";
    const regionId = "33333333-3333-4333-8333-333333333333";
    const assignedStoreId = "22222222-2222-4222-8222-222222222222";
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (
        sql.includes("COUNT(*)::text AS total_count") &&
        sql.includes("FROM rpt.store_kpi_snapshot")
      ) {
        expect(params).toEqual([snapshotRunId, [assignedStoreId]]);
        return {
          rowCount: 1,
          rows: [{ total_count: "1" }],
        };
      }

      if (sql.includes("FROM rpt.store_kpi_snapshot")) {
        expect(params).toEqual([snapshotRunId, [assignedStoreId], 50, 0]);
        expect(sql).toContain("s.store_id = ANY($2::uuid[])");
        expect(sql).not.toContain("s.company_id = ANY($2::uuid[])");
        expect(sql).not.toContain("s.region_id = ANY($2::uuid[])");
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: snapshotRunId,
              store_id: assignedStoreId,
              kpi_id: "44444444-4444-4444-8444-444444444444",
              kpi_code: "UPT",
              kpi_name: "UPT",
              period_start: "2026-04-01",
              period_end: "2026-04-30",
              target_value: "3.2000",
              actual_value: "2.9000",
              achievement_rate: "0.9063",
              status_band: "at_risk",
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
      .get(`/api/reports/kpis?snapshotRunId=${snapshotRunId}`)
      .set("x-role-codes", "STORE_MANAGER")
      .set("x-company-ids", companyId)
      .set("x-region-ids", regionId)
      .set("x-assigned-store-ids", assignedStoreId);

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      {
        snapshotRunId,
        storeId: assignedStoreId,
        kpiId: "44444444-4444-4444-8444-444444444444",
        kpiCode: "UPT",
        kpiName: "UPT",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        targetValue: "3.2000",
        actualValue: "2.9000",
        achievementRate: "0.9063",
        statusBand: "at_risk",
      },
    ]);

    await app.close();
  });

  it("returns checklist snapshot rows for a snapshot run", async () => {
    const query = jest.fn(async (sql: string) => {
      if (
        sql.includes("COUNT(*)::text AS total_count") &&
        sql.includes("FROM rpt.store_checklist_snapshot")
      ) {
        return {
          rowCount: 1,
          rows: [{ total_count: "6" }],
        };
      }

      if (sql.includes("FROM rpt.store_checklist_snapshot")) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "11111111-1111-4111-8111-111111111111",
              store_id: "22222222-2222-4222-8222-222222222222",
              checklist_template_id: "55555555-5555-4555-8555-555555555555",
              audit_count: 4,
              avg_score: "88.50",
              compliance_rate: "0.9200",
              critical_issue_count: 1,
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

    const response = await request(app.getHttpServer()).get(
      "/api/reports/checklists?snapshotRunId=11111111-1111-4111-8111-111111111111&limit=25&offset=0",
    );

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      {
        snapshotRunId: "11111111-1111-4111-8111-111111111111",
        storeId: "22222222-2222-4222-8222-222222222222",
        checklistTemplateId: "55555555-5555-4555-8555-555555555555",
        auditCount: 4,
        avgScore: "88.50",
        complianceRate: "0.9200",
        criticalIssueCount: 1,
      },
    ]);
    expect(response.body.meta).toEqual({
      count: 1,
      total: 6,
      limit: 25,
      offset: 0,
    });

    await app.close();
  });

  it("returns turnover snapshot rows for a snapshot run", async () => {
    const query = jest.fn(async (sql: string) => {
      if (
        sql.includes("COUNT(*)::text AS total_count") &&
        sql.includes("FROM rpt.turnover_snapshot")
      ) {
        return {
          rowCount: 1,
          rows: [{ total_count: "4" }],
        };
      }

      if (sql.includes("FROM rpt.turnover_snapshot")) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "11111111-1111-4111-8111-111111111111",
              scope_type: "store",
              company_id: "66666666-6666-4666-8666-666666666666",
              region_id: "77777777-7777-4777-8777-777777777777",
              store_id: "22222222-2222-4222-8222-222222222222",
              period_start: "2026-04-01",
              period_end: "2026-04-30",
              opening_headcount: "20.00",
              closing_headcount: "19.00",
              avg_headcount: "19.50",
              leaver_count: 2,
              turnover_rate: "0.1026",
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

    const response = await request(app.getHttpServer()).get(
      "/api/reports/turnover?snapshotRunId=11111111-1111-4111-8111-111111111111&limit=10&offset=0",
    );

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([
      {
        snapshotRunId: "11111111-1111-4111-8111-111111111111",
        scopeType: "store",
        companyId: "66666666-6666-4666-8666-666666666666",
        regionId: "77777777-7777-4777-8777-777777777777",
        storeId: "22222222-2222-4222-8222-222222222222",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        openingHeadcount: "20.00",
        closingHeadcount: "19.00",
        avgHeadcount: "19.50",
        leaverCount: 2,
        turnoverRate: "0.1026",
      },
    ]);
    expect(response.body.meta).toEqual({
      count: 1,
      total: 4,
      limit: 10,
      offset: 0,
    });

    await app.close();
  });

  it("returns reporting summary for the latest completed snapshot run", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM rpt.snapshot_run") && sql.includes("run_status = 'completed'")) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "11111111-1111-4111-8111-111111111111",
              snapshot_date: "2026-04-17",
              snapshot_type: "monthly",
              period_start: "2026-04-01",
              period_end: "2026-04-30",
              run_status: "completed",
              generated_at: "2026-04-17T10:00:00.000Z",
              generated_by: "user-1",
            },
          ],
        };
      }

      if (sql.includes("FROM rpt.store_workforce_snapshot")) {
        return { rowCount: 1, rows: [{ total_count: "12" }] };
      }

      if (sql.includes("FROM rpt.store_kpi_snapshot")) {
        return { rowCount: 1, rows: [{ total_count: "8" }] };
      }

      if (sql.includes("FROM rpt.store_checklist_snapshot")) {
        return { rowCount: 1, rows: [{ total_count: "5" }] };
      }

      if (sql.includes("FROM rpt.turnover_snapshot")) {
        return { rowCount: 1, rows: [{ total_count: "3" }] };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: {
        query,
      },
    });

    const response = await request(app.getHttpServer()).get("/api/reports/summary");

    expect(response.status).toBe(200);
    expect(response.body.latestCompletedSnapshotRun).toEqual({
      snapshotRunId: "11111111-1111-4111-8111-111111111111",
      snapshotDate: "2026-04-17",
      snapshotType: "monthly",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
      runStatus: "completed",
      generatedAt: "2026-04-17T10:00:00.000Z",
      generatedBy: "user-1",
    });
    expect(response.body.cards).toEqual({
      workforceRows: 12,
      kpiRows: 8,
      checklistRows: 5,
      turnoverRows: 3,
    });

    await app.close();
  });

  it("returns daily closed ranking with coverage and KPI mini ranks", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM rpt.snapshot_run") && sql.includes("period_start = $2::date")) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "11111111-1111-4111-8111-111111111111",
              snapshot_date: "2026-04-23",
              snapshot_type: "daily",
              period_start: "2026-04-23",
              period_end: "2026-04-23",
              run_status: "completed",
              generated_at: "2026-04-24T00:10:00.000Z",
              generated_by: "system",
            },
          ],
        };
      }

      if (sql.includes("closed_personnel_daily_rank_rows")) {
        return {
          rowCount: 2,
          rows: [
            {
              employee_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              first_name: "Ayse",
              last_name: "Yilmaz",
              store_id: "22222222-2222-4222-8222-222222222222",
              store_name: "Kadikoy",
              score_value: "91.2500",
              turkey_rank: 4,
              turkey_population: 100,
              store_rank: 1,
              store_population: 8,
            },
            {
              employee_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              first_name: "Mehmet",
              last_name: "Demir",
              store_id: "22222222-2222-4222-8222-222222222222",
              store_name: "Kadikoy",
              score_value: "83.0000",
              turkey_rank: 18,
              turkey_population: 100,
              store_rank: 2,
              store_population: 8,
            },
          ],
        };
      }

      if (sql.includes("closed_metric_daily_rank_rows")) {
        return {
          rowCount: 2,
          rows: [
            {
              employee_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              kpi_code: "UPT",
              kpi_name: "UPT",
              actual_value: "2.4000",
              store_rank: 1,
              store_population: 8,
              turkey_rank: 9,
              turkey_population: 100,
            },
            {
              employee_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              kpi_code: "ATV",
              kpi_name: "ATV",
              actual_value: "850.0000",
              store_rank: 3,
              store_population: 8,
              turkey_rank: 41,
              turkey_population: 100,
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer())
      .get("/api/reports/leaderboards/closed?periodType=daily&periodStart=2026-04-23&limit=10")
      .set("x-user-id", "user-1")
      .set("x-employee-id", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
      .set("x-role-codes", "STORE_PERSONNEL")
      .set("x-store-ids", "22222222-2222-4222-8222-222222222222");

    expect(response.status).toBe(200);
    expect(response.body.source).toEqual(
      expect.objectContaining({
        mode: "closed",
        periodType: "daily",
        state: "closed",
        periodStart: "2026-04-23",
        periodEnd: "2026-04-23",
      }),
    );
    expect(response.body.currentEmployee.rankings).toEqual({
      turkeyRank: 4,
      turkeyPopulation: 100,
      regionRank: null,
      regionPopulation: 0,
      storeRank: 1,
      storePopulation: 8,
    });
    expect(response.body.currentEmployee.coverage).toEqual({
      closedDaysInPeriod: 1,
      daysWithPerformance: 1,
      minimumRequiredDays: 1,
      isEligibleForRanking: true,
    });
    expect(response.body.currentEmployee.metricRanks).toEqual([
      expect.objectContaining({ code: "UPT", turkeyRank: 9, storeRank: 1 }),
      expect.objectContaining({ code: "ATV", turkeyRank: 41, storeRank: 3 }),
    ]);

    await app.close();
  });

  it("resolves external employee claims before loading current daily closed ranking row", async () => {
    const resolvedEmployeeId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("FROM ops.employee") && sql.includes("external_employee_ref")) {
        return {
          rowCount: 1,
          rows: [{ employee_id: resolvedEmployeeId }],
        };
      }

      if (sql.includes("FROM rpt.snapshot_run") && sql.includes("period_start = $2::date")) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "11111111-1111-4111-8111-111111111111",
              snapshot_date: "2026-04-23",
              snapshot_type: "daily",
              period_start: "2026-04-23",
              period_end: "2026-04-23",
              run_status: "completed",
              generated_at: "2026-04-23T22:00:00.000Z",
              generated_by: "system",
            },
          ],
        };
      }

      if (sql.includes("closed_personnel_daily_rank_rows")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM rpt.employee_performance_snapshot")) {
        if (params[1] !== resolvedEmployeeId) {
          throw new Error(`expected resolved employee UUID, got ${String(params[1])}`);
        }

        return {
          rowCount: 1,
          rows: [
            {
              employee_id: resolvedEmployeeId,
              first_name: "Store",
              last_name: "Personnel",
              store_id: "22222222-2222-4222-8222-222222222222",
              store_name: "Kadikoy",
              period_start: "2026-04-23",
              period_end: "2026-04-23",
              score_value: "72.5000",
              matched_metrics: 2,
              total_metrics: 2,
              turkey_rank: 18,
              turkey_population: 100,
              store_rank: 2,
              store_population: 8,
            },
          ],
        };
      }

      if (sql.includes("closed_metric_daily_rank_rows")) {
        return { rowCount: 0, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer())
      .get("/api/reports/leaderboards/closed?periodType=daily&periodStart=2026-04-23&limit=10")
      .set("x-user-id", "user-1")
      .set("x-employee-id", "EMP-200")
      .set("x-role-codes", "STORE_PERSONNEL")
      .set("x-company-ids", "00000000-0000-0000-0000-000000000001")
      .set("x-store-ids", "22222222-2222-4222-8222-222222222222");

    expect(response.status).toBe(200);
    expect(response.body.currentEmployee).toEqual(
      expect.objectContaining({
        employeeId: resolvedEmployeeId,
        displayName: "Store Personnel",
      }),
    );

    await app.close();
  });

  it("resolves external employee claims before loading closed personal performance", async () => {
    const resolvedEmployeeId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("FROM ops.employee") && sql.includes("external_employee_ref")) {
        return {
          rowCount: 1,
          rows: [{ employee_id: resolvedEmployeeId }],
        };
      }

      if (sql.includes("FROM rpt.snapshot_run") && sql.includes("period_end = $3::date")) {
        return {
          rowCount: 1,
          rows: [
            {
              snapshot_run_id: "11111111-1111-4111-8111-111111111111",
              snapshot_date: "2026-04-23",
              snapshot_type: "daily",
              period_start: "2026-04-23",
              period_end: "2026-04-23",
              run_status: "completed",
              generated_at: "2026-04-23T22:00:00.000Z",
              generated_by: "system",
            },
          ],
        };
      }

      if (sql.includes("FROM rpt.employee_performance_snapshot")) {
        if (params[1] !== resolvedEmployeeId) {
          throw new Error(`expected resolved employee UUID, got ${String(params[1])}`);
        }

        return {
          rowCount: 1,
          rows: [
            {
              employee_id: resolvedEmployeeId,
              first_name: "Store",
              last_name: "Personnel",
              store_id: "22222222-2222-4222-8222-222222222222",
              store_name: "Kadikoy",
              period_start: "2026-04-23",
              period_end: "2026-04-23",
              score_value: "72.5000",
              matched_metrics: 2,
              total_metrics: 2,
              turkey_rank: 18,
              turkey_population: 100,
              store_rank: 2,
              store_population: 8,
            },
          ],
        };
      }

      if (sql.includes("closed_metric_daily_rank_rows")) {
        if (!Array.isArray(params[1]) || params[1][0] !== resolvedEmployeeId) {
          throw new Error(`expected resolved employee UUID list, got ${String(params[1])}`);
        }

        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM rpt.employee_kpi_snapshot")) {
        if (params[1] !== resolvedEmployeeId) {
          throw new Error(`expected resolved employee UUID, got ${String(params[1])}`);
        }

        return { rowCount: 0, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer())
      .get("/api/reports/my-performance?mode=closed&snapshotDate=2026-04-23")
      .set("x-user-id", "user-1")
      .set("x-employee-id", "EMP-200")
      .set("x-role-codes", "STORE_PERSONNEL")
      .set("x-company-ids", "00000000-0000-0000-0000-000000000001")
      .set("x-store-ids", "22222222-2222-4222-8222-222222222222");

    expect(response.status).toBe(200);
    expect(response.body.employee).toEqual(
      expect.objectContaining({
        employeeId: resolvedEmployeeId,
        displayName: "Store Personnel",
      }),
    );

    await app.close();
  });

  it("returns monthly closed ranking from completed daily snapshots", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM rpt.snapshot_run") && sql.includes("period_start >= $1::date")) {
        return {
          rowCount: 27,
          rows: Array.from({ length: 27 }, (_, index) => {
            const day = String(index + 1).padStart(2, "0");
            return {
              snapshot_run_id: `${day}${day}${day}${day}-${day}${day}${day}-${day}${day}${day}-${day}${day}${day}-${day}${day}${day}${day}${day}${day}${day}${day}${day}${day}${day}${day}`,
              snapshot_date: `2026-04-${day}`,
              snapshot_type: "daily",
              period_start: `2026-04-${day}`,
              period_end: `2026-04-${day}`,
              run_status: "completed",
              generated_at: `2026-04-${day}T08:00:00.000Z`,
              generated_by: "ranking-closure-job",
            };
          }),
        };
      }

      if (sql.includes("closed_personnel_monthly_rank_rows")) {
        return {
          rowCount: 1,
          rows: [
            {
              employee_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              first_name: "Ayse",
              last_name: "Yilmaz",
              store_id: "22222222-2222-4222-8222-222222222222",
              store_name: "Kadikoy",
              score_value: "88.7500",
              days_with_performance: "25",
              turkey_rank: 7,
              turkey_population: 96,
              store_rank: 1,
              store_population: 8,
            },
          ],
        };
      }

      if (sql.includes("monthly_metric_rows")) {
        return { rowCount: 0, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    });

    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer())
      .get("/api/reports/leaderboards/closed?periodType=monthly&periodStart=2026-04-01&limit=10")
      .set("x-user-id", "user-1")
      .set("x-employee-id", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
      .set("x-role-codes", "STORE_PERSONNEL")
      .set("x-store-ids", "22222222-2222-4222-8222-222222222222");

    expect(response.status).toBe(200);
    expect(response.body.source).toEqual(
      expect.objectContaining({
        mode: "closed",
        periodType: "monthly",
        state: "closed",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
      }),
    );
    expect(response.body.currentEmployee.coverage).toEqual({
      closedDaysInPeriod: 27,
      daysWithPerformance: 25,
      minimumRequiredDays: 3,
      isEligibleForRanking: true,
    });
    expect(response.body.currentEmployee.rankings).toEqual({
      turkeyRank: 7,
      turkeyPopulation: 96,
      regionRank: null,
      regionPopulation: 0,
      storeRank: 1,
      storePopulation: 8,
    });
    expect(response.body.includedSnapshotRuns).toHaveLength(27);
    expect(response.body.includedSnapshotRuns[0]).toEqual({
      snapshotRunId: expect.any(String),
      snapshotDate: "2026-04-01",
      snapshotType: "daily",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-01",
      runStatus: "completed",
      generatedAt: "2026-04-01T08:00:00.000Z",
      generatedBy: "ranking-closure-job",
    });
    expect(response.body.includedSnapshotRuns[26]).toEqual(
      expect.objectContaining({
        snapshotDate: "2026-04-27",
        periodStart: "2026-04-27",
        periodEnd: "2026-04-27",
      }),
    );

    await app.close();
  });
});
