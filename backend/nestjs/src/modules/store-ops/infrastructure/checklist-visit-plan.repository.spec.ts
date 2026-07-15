import { ConflictException } from "@nestjs/common";
import { checklistVisitPlanScoreBands } from "../application/checklist-visit-plan.contract";
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
    expect(sql).toContain("WHEN item.planned_date > (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date THEN 'planned'");
    expect(sql).toContain("WHEN item.planned_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul')::date THEN 'waiting'");
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

  it("lists authoritative period risk and preserves every planned store/date in one query", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{
      metrics_json: { totalStores: 1 },
      total_count: 1,
      items_json: [{ storeId: "store", planItems: [
        { plannedDate: "2026-07-14" },
        { plannedDate: "2026-07-16" },
      ] }],
    }] });
    const repository = new ChecklistVisitPlanRepository({ query } as never);
    const result = await repository.listPeriod({
      regionId: "11111111-1111-4111-8111-111111111111",
      period: "2026-07",
      query: null,
      risk: "all",
      reason: "all",
      planStatus: "all",
      sort: "risk_desc",
      limit: 30,
      offset: 0,
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(result.items[0].planItems).toHaveLength(2);
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("AVG(ci.total_score) FILTER (WHERE ct.template_type = 'BM_STORE_VISIT')::numeric(12,2)");
    expect(sql).toContain("score.bm_score < 70");
    expect(sql).toContain("score.bm_score BETWEEN 70 AND 84");
    expect(sql).toContain("COALESCE(fact.bm_score, 85) >= 85");
    expect(sql).toContain("ct.template_type = 'BM_STORE_VISIT'");
    expect(sql).toContain("AT TIME ZONE 'Europe/Istanbul'");
    expect(sql).toContain("jsonb_agg");
    expect(sql).toContain("'totalStores', (SELECT COUNT(*)::int FROM reasoned)");
    expect(sql).toContain("(SELECT COUNT(*)::int FROM filtered) AS total_count");
    expect(sql).toContain("FROM scoped_stores store");
    expect(sql).toContain("LEFT JOIN plan_aggregate plan ON plan.store_id = store.store_id");
  });

  it("locks 69/70/84/85/null score boundaries to the production visit-risk policy", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new ChecklistVisitPlanRepository({ query } as never);
    await repository.listPeriod({
      regionId: "11111111-1111-4111-8111-111111111111",
      period: "2026-07",
      query: null,
      risk: "all",
      reason: "all",
      planStatus: "all",
      sort: "risk_desc",
      limit: 30,
      offset: 0,
    });
    const sql = query.mock.calls[0][0] as string;
    expect(checklistVisitPlanScoreBands).toEqual({
      highBelow: 70,
      mediumFrom: 70,
      mediumThrough: 84,
      strongFrom: 85,
    });
    expect(sql).toContain("score.bm_score < 70");
    expect(sql).toContain("score.bm_score BETWEEN 70 AND 84");
    expect(sql).toContain("COALESCE(fact.bm_score, 85) >= 85");
    expect(sql).toContain("score.bm_score IS NULL");
    expect(sql).toContain("ROUND((response.score_value / item.max_score) * 100) < 70");
    expect(sql).toContain("region.company_id = store.company_id");
  });

  it("escapes period-read wildcard input before the bounded repository call", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new ChecklistVisitPlanRepository({ query } as never);
    await repository.listPeriod({
      regionId: "11111111-1111-4111-8111-111111111111",
      period: "2026-07",
      query: "%_\\",
      risk: "all",
      reason: "all",
      planStatus: "all",
      sort: "store_asc",
      limit: 30,
      offset: 0,
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual(expect.arrayContaining(["\\%\\_\\\\"]));
  });

  it("escapes candidate wildcard input and keeps active stable scoped paging to one query", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ total_count: 0, items_json: [] }] });
    const repository = new ChecklistVisitPlanRepository({ query } as never);
    await repository.listCandidates({
      regionId: "11111111-1111-4111-8111-111111111111",
      query: "%_\\",
      limit: 20,
      offset: 0,
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual(expect.arrayContaining(["\\%\\_\\\\"]));
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("store.status = 'active'");
    expect(sql).toContain("ESCAPE '\\'");
    expect(sql).toContain("ORDER BY store_code ASC, store_id ASC");
  });

  it("lists only active named region options from the supplied role scope in one query", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ total_count: 200, items_json: [
      { regionId: "22222222-2222-4222-8222-222222222222", regionName: "Ege" },
      { regionId: "33333333-3333-4333-8333-333333333333", regionName: "Marmara" },
    ] }] });
    const repository = new ChecklistVisitPlanRepository({ query } as never);
    await expect(repository.listRegionOptions({
      regionIds: ["33333333-3333-4333-8333-333333333333", "22222222-2222-4222-8222-222222222222"],
      query: "%_\\", limit: 2, offset: 2,
    })).resolves.toEqual({ total: 200, items: [
      { regionId: "22222222-2222-4222-8222-222222222222", regionName: "Ege" },
      { regionId: "33333333-3333-4333-8333-333333333333", regionName: "Marmara" },
    ] });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual([
      ["33333333-3333-4333-8333-333333333333", "22222222-2222-4222-8222-222222222222"],
      "\\%\\_\\\\", 2, 2,
    ]);
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("region.region_id = ANY($1::uuid[])");
    expect(sql).toContain("region.status = 'active'");
    expect(sql).toContain("ORDER BY region_name ASC, region_id ASC");
    expect(sql).toContain("LIMIT $3 OFFSET $4");
  });
});
