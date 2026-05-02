import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("Competition API", () => {
  const actorUserId = "11111111-1111-4111-8111-111111111111";
  const companyId = "00000000-0000-0000-0000-000000000001";
  const competitionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const stageId = "22222222-2222-4222-8222-222222222222";

  it("allows HR_ADMIN to create a draft competition", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("INSERT INTO ops.competition")) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_id: competitionId,
              competition_code: "MAY_REGION_CHALLENGE",
              competition_name: "May Region Challenge",
              description: null,
              competition_type: "region_challenge",
              lifecycle_state: "draft",
              starts_on: "2026-05-01",
              ends_on: "2026-05-31",
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO audit.event_log")) {
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    });
    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) =>
          work({ query }),
      },
    });

    const response = await request(app.getHttpServer())
      .post("/api/competitions")
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "HR_ADMIN")
      .set("x-read-company-ids", companyId)
      .send({
        competitionCode: "MAY_REGION_CHALLENGE",
        competitionName: "May Region Challenge",
        competitionType: "region_challenge",
        startsOn: "2026-05-01",
        endsOn: "2026-05-31",
      });

    expect(response.status).toBe(201);
    expect(response.body.command).toEqual({
      status: "created",
      message: "Competition draft created",
    });
    expect(response.body.data.competition).toEqual({
      competitionId,
      competitionCode: "MAY_REGION_CHALLENGE",
      competitionName: "May Region Challenge",
      description: null,
      competitionType: "region_challenge",
      lifecycleState: "draft",
      startsOn: "2026-05-01",
      endsOn: "2026-05-31",
    });

    await app.close();
  });

  it("rejects finalization with warnings when override justification is missing", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM rpt.competition_stage_warning")) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_stage_warning_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              competition_stage_id: stageId,
              competition_team_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              store_id: "00000000-0000-0000-0000-000000000101",
              warning_code: "missing_bm_checklist",
              warning_level: "warning",
              period_start: "2026-04-01",
              period_end: "2026-04-30",
              message: "BM checklist missing",
              resolved_at: null,
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
      .patch(`/api/competitions/stages/${stageId}/finalize`)
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "HR_ADMIN")
      .set("x-read-company-ids", companyId)
      .send({ allowOverride: false });

    expect(response.status).toBe(400);

    await app.close();
  });

  it("blocks REPORT_VIEWER from competition write actions", async () => {
    const query = jest.fn(async () => ({ rowCount: 0, rows: [] }));
    const app = await createIntegrationApp({
      databaseService: { query },
    });

    const response = await request(app.getHttpServer())
      .post("/api/competitions")
      .set("x-user-id", actorUserId)
      .set("x-role-codes", "REPORT_VIEWER")
      .set("x-read-company-ids", companyId)
      .send({
        competitionCode: "REPORT_VIEWER_BLOCKED",
        competitionName: "Blocked",
        competitionType: "region_challenge",
        startsOn: "2026-05-01",
        endsOn: "2026-05-31",
      });

    expect(response.status).toBe(403);

    await app.close();
  });
});
