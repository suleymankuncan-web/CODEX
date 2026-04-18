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
});
