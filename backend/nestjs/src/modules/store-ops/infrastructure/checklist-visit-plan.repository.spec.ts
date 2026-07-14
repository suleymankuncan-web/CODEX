import { ConflictException } from "@nestjs/common";
import { ChecklistVisitPlanRepository } from "./checklist-visit-plan.repository";

describe("ChecklistVisitPlanRepository", () => {
  it("derives completion only from a completed BM visit on the Istanbul local planned date", async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [{
      plan_id: "plan", region_id: "region", region_name: "North", week_start_date: "2026-07-13",
      revision_no: 1, created_at: "2026-07-12T10:00:00Z", items_json: [],
    }] });
    const repository = new ChecklistVisitPlanRepository({ query } as never);
    await repository.getWeeklyPlan({
      regionId: "11111111-1111-4111-8111-111111111111", weekStart: "2026-07-13",
      companyIds: [], regionIds: ["11111111-1111-4111-8111-111111111111"], storeIds: [],
    });
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("ct.template_type = 'BM_STORE_VISIT'");
    expect(sql).toContain("ci.status = 'completed'");
    expect(sql).toContain("AT TIME ZONE 'Europe/Istanbul'");
    expect(sql).toContain("WHEN completed.checklist_instance_id IS NOT NULL THEN 'completed'");
    expect(sql).toContain("THEN 'waiting'");
    expect(sql).toContain("ELSE 'missed'");
  });

  it("returns an idempotent replay only when the canonical digest matches", async () => {
    const client = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ plan_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }] })
      .mockResolvedValueOnce({ rows: [{ revision_id: "rev", revision_no: 2, request_sha256: "a".repeat(64) }] })
      .mockResolvedValueOnce({ rows: [{ plan_id: "plan", region_id: "region", region_name: "North", week_start_date: "2026-07-13", revision_no: 2, created_at: "now", items_json: [] }] }),
    };
    const database = { withTransaction: jest.fn(async (work) => work(client)) };
    const repository = new ChecklistVisitPlanRepository(database as never);
    await repository.saveWeeklyPlan({
      regionId: "11111111-1111-4111-8111-111111111111", weekStart: "2026-07-13", actorUserId: "22222222-2222-4222-8222-222222222222",
      expectedRevision: 2, idempotencyKey: "33333333-3333-4333-8333-333333333333", requestSha256: "a".repeat(64), items: [],
    });
    expect(client.query).toHaveBeenCalledTimes(4);

    client.query.mockReset()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ plan_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }] })
      .mockResolvedValueOnce({ rows: [{ revision_id: "rev", revision_no: 2, request_sha256: "b".repeat(64) }] });
    await expect(repository.saveWeeklyPlan({
      regionId: "11111111-1111-4111-8111-111111111111", weekStart: "2026-07-13", actorUserId: "22222222-2222-4222-8222-222222222222",
      expectedRevision: 2, idempotencyKey: "33333333-3333-4333-8333-333333333333", requestSha256: "a".repeat(64), items: [],
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it("locks the header, enforces expected revision, appends a snapshot and writes sanitized audit metadata", async () => {
    const client = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ plan_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ revision_no: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ revision_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", revision_no: 2 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ plan_id: "plan", region_id: "region", region_name: "North", week_start_date: "2026-07-13", revision_no: 2, created_at: "now", items_json: [] }] }),
    };
    const database = { withTransaction: jest.fn(async (work) => work(client)) };
    const repository = new ChecklistVisitPlanRepository(database as never);
    await repository.saveWeeklyPlan({
      regionId: "11111111-1111-4111-8111-111111111111", weekStart: "2026-07-13", actorUserId: "22222222-2222-4222-8222-222222222222",
      expectedRevision: 1, idempotencyKey: "33333333-3333-4333-8333-333333333333", requestSha256: "a".repeat(64),
      items: [{ storeId: "44444444-4444-4444-8444-444444444444", plannedDate: "2026-07-14", displayOrder: 0 }],
    });
    const sql = client.query.mock.calls.map((call) => call[0]).join("\n");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("SET is_current = FALSE");
    expect(sql).toContain("INSERT INTO ops.region_weekly_visit_plan_revision");
    expect(sql).toContain("jsonb_to_recordset");
    expect(sql).toContain("INSERT INTO audit.event_log");
    const auditCall = client.query.mock.calls.find((call) => String(call[0]).includes("audit.event_log"));
    expect(auditCall?.[1]?.[4]).toEqual(expect.stringContaining('"itemCount":1'));
    expect(auditCall?.[1]?.[4]).not.toContain("storeId");
  });
});
