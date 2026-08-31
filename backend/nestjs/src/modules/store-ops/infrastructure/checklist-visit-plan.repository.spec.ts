import { ConflictException } from "@nestjs/common";
import { checklistVisitPlanScoreBands } from "../application/checklist-visit-plan.contract";
import { ChecklistVisitPlanRepository } from "./checklist-visit-plan.repository";

describe("ChecklistVisitPlanRepository", () => {
  it("reads a Report Viewer plan from active manager store assignments instead of region selection", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{
      plan_id: null,
      region_id: "11111111-1111-4111-8111-111111111111",
      region_name: "Eda Doğanay",
      week_start_date: "2026-07-13",
      revision_no: 3,
      created_at: "2026-07-13T10:00:00.000Z",
      items_json: [],
    }] });
    const repository = new ChecklistVisitPlanRepository({ query } as never);

    await repository.getManagerWeeklyPlan({
      managerUserId: "22222222-2222-4222-8222-222222222222",
      weekStart: "2026-07-13",
      companyIds: ["33333333-3333-4333-8333-333333333333"],
    });

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("ops.user_action_store_assignment manager_store");
    expect(sql).toContain("INNER JOIN ops.region region");
    expect(sql).toContain("region.region_id = store.region_id");
    expect(sql).toContain("region.company_id = store.company_id");
    expect(sql).toContain("region.status = 'active'");
    expect(sql).toContain("role.role_code = 'REGION_MANAGER'");
    expect(sql).toContain("item.store_id = scope.store_id");
    expect(params).toEqual([
      "22222222-2222-4222-8222-222222222222",
      "2026-07-13",
      ["33333333-3333-4333-8333-333333333333"],
    ]);
  });

  it("does not return a manager plan when the assigned store has no active matching region", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new ChecklistVisitPlanRepository({ query } as never);

    await expect(repository.getManagerWeeklyPlan({
      managerUserId: "22222222-2222-4222-8222-222222222222",
      weekStart: "2026-07-13",
      companyIds: ["33333333-3333-4333-8333-333333333333"],
    })).rejects.toThrow("outside the authenticated scope");

    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("INNER JOIN ops.region region");
    expect(sql).toContain("region.region_id = store.region_id");
    expect(sql).toContain("region.company_id = store.company_id");
    expect(sql).toContain("region.status = 'active'");
  });

  it("records attendance against the current scoped plan item and writes sanitized audit metadata", async () => {
    const client = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [{
        plan_item_id: "55555555-5555-4555-8555-555555555555",
        region_id: "11111111-1111-4111-8111-111111111111",
        planned_date: "2026-07-15",
        week_start_date: "2026-07-13",
      }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ completed_at: "2026-07-15T10:00:00.000Z" }] })
      .mockResolvedValueOnce({ rows: [] }),
    };
    const database = { withTransaction: jest.fn(async (work) => work(client)) };
    const repository = new ChecklistVisitPlanRepository(database as never);

    await expect(repository.completeVisit({
      planItemId: "55555555-5555-4555-8555-555555555555",
      actorUserId: "22222222-2222-4222-8222-222222222222",
      storeIds: ["55555555-5555-4555-8555-555555555555"],
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
    })).resolves.toEqual({
      planItemId: "55555555-5555-4555-8555-555555555555",
      completedAt: "2026-07-15T10:00:00.000Z",
    });

    const sql = client.query.mock.calls.map((call) => String(call[0])).join("\n");
    expect(sql).toContain("revision.is_current = TRUE");
    expect(sql).toContain("item.store_id = ANY($3::uuid[])");
    expect(sql).toContain("assignment.user_id = $2::uuid");
    expect(sql).toContain("item.visit_type = 'BM_STORE_VISIT'");
    expect(sql).toContain("INSERT INTO ops.region_weekly_visit_plan_completion");
    expect(sql).toContain("INSERT INTO audit.event_log");
    const auditCall = client.query.mock.calls.find((call) => String(call[0]).includes("audit.event_log"));
    expect(auditCall?.[1]?.[4]).toEqual(JSON.stringify({ plannedDate: "2026-07-15", weekStart: "2026-07-13" }));
    expect(auditCall?.[1]?.[4]).not.toContain("storeId");
  });

  it("returns the existing attendance row without a duplicate audit event", async () => {
    const client = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [{
        plan_item_id: "55555555-5555-4555-8555-555555555555",
        region_id: "11111111-1111-4111-8111-111111111111",
        planned_date: "2026-07-15",
        week_start_date: "2026-07-13",
      }] })
      .mockResolvedValueOnce({ rows: [{ completed_at: "2026-07-15T10:00:00.000Z" }] }),
    };
    const database = { withTransaction: jest.fn(async (work) => work(client)) };
    const repository = new ChecklistVisitPlanRepository(database as never);

    await expect(repository.completeVisit({
      planItemId: "55555555-5555-4555-8555-555555555555",
      actorUserId: "22222222-2222-4222-8222-222222222222",
      storeIds: ["55555555-5555-4555-8555-555555555555"],
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
    })).resolves.toEqual({
      planItemId: "55555555-5555-4555-8555-555555555555",
      completedAt: "2026-07-15T10:00:00.000Z",
    });
    expect(client.query).toHaveBeenCalledTimes(2);
  });

  it("rejects a new attendance record after the planned Istanbul date", async () => {
    const client = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [{
        plan_item_id: "55555555-5555-4555-8555-555555555555",
        region_id: "11111111-1111-4111-8111-111111111111",
        planned_date: "2026-08-25",
        week_start_date: "2026-08-24",
      }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] }),
    };
    const database = { withTransaction: jest.fn(async (work) => work(client)) };
    const repository = new ChecklistVisitPlanRepository(database as never);

    await expect(repository.completeVisit({
      planItemId: "55555555-5555-4555-8555-555555555555",
      actorUserId: "22222222-2222-4222-8222-222222222222",
      storeIds: ["55555555-5555-4555-8555-555555555555"],
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
    })).rejects.toThrow("Visits can only be completed on the planned date");

    const insertCall = client.query.mock.calls[2];
    expect(String(insertCall?.[0])).toContain("CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Istanbul'");
    expect(String(insertCall?.[0])).toContain("WHERE $4::date =");
    expect(client.query).toHaveBeenCalledTimes(3);
  });

  it("denies completion after the direct store assignment has ended", async () => {
    const client = { query: jest.fn().mockResolvedValueOnce({ rows: [] }) };
    const database = { withTransaction: jest.fn(async (work) => work(client)) };
    const repository = new ChecklistVisitPlanRepository(database as never);

    await expect(repository.completeVisit({
      planItemId: "55555555-5555-4555-8555-555555555555",
      actorUserId: "22222222-2222-4222-8222-222222222222",
      storeIds: ["55555555-5555-4555-8555-555555555555"],
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
    })).rejects.toThrow("outside the authenticated scope");
    expect(String(client.query.mock.calls[0][0])).toContain("assignment.end_at IS NULL OR assignment.end_at > CURRENT_TIMESTAMP");
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("derives completion only from a completed BM visit on the Istanbul local planned date", async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [{
      plan_id: "plan", region_id: "region", region_name: "North", week_start_date: "2026-07-13",
      revision_no: 1, created_at: "2026-07-12T10:00:00Z", items_json: [],
    }] });
    const repository = new ChecklistVisitPlanRepository({ query } as never);
    await repository.getWeeklyPlan({
      regionId: "11111111-1111-4111-8111-111111111111", weekStart: "2026-07-13",
      storeIds: ["55555555-5555-4555-8555-555555555555"],
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
      .mockResolvedValueOnce({ rows: [{ store_id: "55555555-5555-4555-8555-555555555555", region_id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ plan_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }] })
      .mockResolvedValueOnce({ rows: [{ revision_id: "rev", revision_no: 2, request_sha256: "a".repeat(64) }] })
      .mockResolvedValueOnce({ rows: [{ plan_id: "plan", region_id: "region", region_name: "North", week_start_date: "2026-07-13", revision_no: 2, created_at: "now", items_json: [] }] }),
    };
    const database = { withTransaction: jest.fn(async (work) => work(client)) };
    const repository = new ChecklistVisitPlanRepository(database as never);
    await repository.saveWeeklyPlan({
      regionId: "11111111-1111-4111-8111-111111111111", weekStart: "2026-07-13", actorUserId: "22222222-2222-4222-8222-222222222222",
      expectedRevision: 2, idempotencyKey: "33333333-3333-4333-8333-333333333333", requestSha256: "a".repeat(64),
      authorizedStoreIds: ["55555555-5555-4555-8555-555555555555"], items: [],
    });
    expect(client.query).toHaveBeenCalledTimes(5);

    client.query.mockReset()
      .mockResolvedValueOnce({ rows: [{ store_id: "55555555-5555-4555-8555-555555555555", region_id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ plan_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }] })
      .mockResolvedValueOnce({ rows: [{ revision_id: "rev", revision_no: 2, request_sha256: "b".repeat(64) }] });
    await expect(repository.saveWeeklyPlan({
      regionId: "11111111-1111-4111-8111-111111111111", weekStart: "2026-07-13", actorUserId: "22222222-2222-4222-8222-222222222222",
      expectedRevision: 2, idempotencyKey: "33333333-3333-4333-8333-333333333333", requestSha256: "a".repeat(64),
      authorizedStoreIds: ["55555555-5555-4555-8555-555555555555"], items: [],
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it("locks the header, enforces expected revision, appends a snapshot and writes sanitized audit metadata", async () => {
    const client = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [{ store_id: "44444444-4444-4444-8444-444444444444", region_id: "11111111-1111-4111-8111-111111111111" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ plan_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ revision_no: 1, store_ids: ["44444444-4444-4444-8444-444444444444"] }] })
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
      authorizedStoreIds: ["44444444-4444-4444-8444-444444444444"],
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

  it("rejects unassigned, forged, and mixed-region snapshot stores before creating a revision", async () => {
    const directStoreId = "44444444-4444-4444-8444-444444444444";
    const otherDirectStoreId = "66666666-6666-4666-8666-666666666666";
    const regionId = "11111111-1111-4111-8111-111111111111";
    const client = { query: jest.fn().mockResolvedValueOnce({ rows: [
      { store_id: directStoreId, region_id: regionId },
      { store_id: otherDirectStoreId, region_id: "22222222-2222-4222-8222-222222222222" },
    ] }) };
    const repository = new ChecklistVisitPlanRepository({
      withTransaction: jest.fn(async (work) => work(client)),
    } as never);

    await expect(repository.saveWeeklyPlan({
      regionId,
      weekStart: "2026-07-13",
      actorUserId: "22222222-2222-4222-8222-222222222222",
      expectedRevision: 0,
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
      requestSha256: "a".repeat(64),
      authorizedStoreIds: [directStoreId, otherDirectStoreId],
      items: [
        { storeId: directStoreId, plannedDate: "2026-07-14", displayOrder: 0 },
        { storeId: "77777777-7777-4777-8777-777777777777", plannedDate: "2026-07-15", displayOrder: 1 },
      ],
    })).rejects.toBeInstanceOf(ConflictException);
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(String(client.query.mock.calls[0][0])).toContain("assignment.start_at <= CURRENT_TIMESTAMP");
    expect(String(client.query.mock.calls[0][0])).toContain("region.company_id = store.company_id");
  });

  it("allows an empty snapshot only when the selected region has an active direct store", async () => {
    const regionId = "11111111-1111-4111-8111-111111111111";
    const directStoreId = "44444444-4444-4444-8444-444444444444";
    const client = { query: jest.fn().mockResolvedValueOnce({ rows: [] }) };
    const repository = new ChecklistVisitPlanRepository({
      withTransaction: jest.fn(async (work) => work(client)),
    } as never);

    await expect(repository.saveWeeklyPlan({
      regionId,
      weekStart: "2026-07-13",
      actorUserId: "22222222-2222-4222-8222-222222222222",
      expectedRevision: 0,
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
      requestSha256: "a".repeat(64),
      authorizedStoreIds: [directStoreId],
      items: [],
    })).rejects.toBeInstanceOf(ConflictException);
    expect(client.query).toHaveBeenCalledTimes(1);
    const validationSql = String(client.query.mock.calls[0][0]);
    expect(validationSql).toContain("store.status = 'active'");
    expect(validationSql).toContain("region.status = 'active'");
    expect(validationSql).toContain("company.status = 'active'");
    expect(validationSql).toContain("region.company_id = store.company_id");
  });

  it("rejects a mixed-region snapshot even when both stores are directly assigned", async () => {
    const regionId = "11111111-1111-4111-8111-111111111111";
    const directStoreId = "44444444-4444-4444-8444-444444444444";
    const otherDirectStoreId = "66666666-6666-4666-8666-666666666666";
    const client = { query: jest.fn().mockResolvedValueOnce({ rows: [
      { store_id: directStoreId, region_id: regionId },
      { store_id: otherDirectStoreId, region_id: "22222222-2222-4222-8222-222222222222" },
    ] }) };
    const repository = new ChecklistVisitPlanRepository({
      withTransaction: jest.fn(async (work) => work(client)),
    } as never);

    await expect(repository.saveWeeklyPlan({
      regionId,
      weekStart: "2026-07-13",
      actorUserId: "22222222-2222-4222-8222-222222222222",
      expectedRevision: 0,
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
      requestSha256: "a".repeat(64),
      authorizedStoreIds: [directStoreId, otherDirectStoreId],
      items: [
        { storeId: directStoreId, plannedDate: "2026-07-14", displayOrder: 0 },
        { storeId: otherDirectStoreId, plannedDate: "2026-07-15", displayOrder: 1 },
      ],
    })).rejects.toBeInstanceOf(ConflictException);
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it("rejects a partial replacement when the current revision contains an outside-portfolio store", async () => {
    const regionId = "11111111-1111-4111-8111-111111111111";
    const directStoreId = "44444444-4444-4444-8444-444444444444";
    const outsideStoreId = "77777777-7777-4777-8777-777777777777";
    const client = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [{ store_id: directStoreId, region_id: regionId }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ plan_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ revision_no: 1, store_ids: [directStoreId, outsideStoreId] }] }),
    };
    const database = { withTransaction: jest.fn(async (work) => work(client)) };
    const repository = new ChecklistVisitPlanRepository(database as never);

    await expect(repository.saveWeeklyPlan({
      regionId,
      weekStart: "2026-07-13",
      actorUserId: "22222222-2222-4222-8222-222222222222",
      expectedRevision: 1,
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
      requestSha256: "a".repeat(64),
      authorizedStoreIds: [directStoreId],
      items: [{ storeId: directStoreId, plannedDate: "2026-07-14", displayOrder: 0 }],
    })).rejects.toBeInstanceOf(ConflictException);

    expect(client.query).toHaveBeenCalledTimes(5);
    const executedSql = client.query.mock.calls.map((call) => String(call[0])).join("\n");
    expect(executedSql).not.toContain("SET is_current = FALSE");
    expect(executedSql).not.toContain("INSERT INTO ops.region_weekly_visit_plan_revision");
    expect(executedSql).not.toContain("INSERT INTO audit.event_log");
  });

  it("rejects an empty replacement when the current revision contains an outside-portfolio store", async () => {
    const regionId = "11111111-1111-4111-8111-111111111111";
    const directStoreId = "44444444-4444-4444-8444-444444444444";
    const outsideStoreId = "77777777-7777-4777-8777-777777777777";
    const client = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [{ store_id: directStoreId, region_id: regionId }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ plan_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ revision_no: 1, store_ids: [directStoreId, outsideStoreId] }] }),
    };
    const database = { withTransaction: jest.fn(async (work) => work(client)) };
    const repository = new ChecklistVisitPlanRepository(database as never);

    await expect(repository.saveWeeklyPlan({
      regionId,
      weekStart: "2026-07-13",
      actorUserId: "22222222-2222-4222-8222-222222222222",
      expectedRevision: 1,
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
      requestSha256: "a".repeat(64),
      authorizedStoreIds: [directStoreId],
      items: [],
    })).rejects.toBeInstanceOf(ConflictException);

    expect(client.query).toHaveBeenCalledTimes(5);
    const executedSql = client.query.mock.calls.map((call) => String(call[0])).join("\n");
    expect(executedSql).not.toContain("SET is_current = FALSE");
    expect(executedSql).not.toContain("INSERT INTO ops.region_weekly_visit_plan_revision");
    expect(executedSql).not.toContain("INSERT INTO audit.event_log");
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
      storeIds: ["55555555-5555-4555-8555-555555555555"],
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
    expect(sql).toContain("store.store_id = ANY($9::uuid[])");
    expect(sql).toContain("LEFT JOIN plan_aggregate plan ON plan.store_id = store.store_id");
  });

  it("locks 69/70/84/85/null score boundaries to the production visit-risk policy", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new ChecklistVisitPlanRepository({ query } as never);
    await repository.listPeriod({
      regionId: "11111111-1111-4111-8111-111111111111",
      storeIds: ["55555555-5555-4555-8555-555555555555"],
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
      storeIds: ["55555555-5555-4555-8555-555555555555"],
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
      storeIds: ["55555555-5555-4555-8555-555555555555"],
      query: "%_\\",
      limit: 20,
      offset: 0,
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual(expect.arrayContaining(["\\%\\_\\\\"]));
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("store.status = 'active'");
    expect(sql).toContain("store.store_id = ANY($5::uuid[])");
    expect(sql).toContain("ESCAPE '\\'");
    expect(sql).toContain("ORDER BY store_code ASC, store_id ASC");
  });

  it("lists only active named region options derived from direct stores in one query", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ total_count: 200, items_json: [
      { regionId: "22222222-2222-4222-8222-222222222222", regionName: "Ege" },
      { regionId: "33333333-3333-4333-8333-333333333333", regionName: "Marmara" },
    ] }] });
    const repository = new ChecklistVisitPlanRepository({ query } as never);
    await expect(repository.listRegionOptions({
      storeIds: ["55555555-5555-4555-8555-555555555555", "66666666-6666-4666-8666-666666666666"],
      query: "%_\\", limit: 2, offset: 2,
    })).resolves.toEqual({ total: 200, items: [
      { regionId: "22222222-2222-4222-8222-222222222222", regionName: "Ege" },
      { regionId: "33333333-3333-4333-8333-333333333333", regionName: "Marmara" },
    ] });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual([
      ["55555555-5555-4555-8555-555555555555", "66666666-6666-4666-8666-666666666666"],
      "\\%\\_\\\\", 2, 2,
    ]);
    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("store.store_id = ANY($1::uuid[])");
    expect(sql).toContain("SELECT DISTINCT region.region_id");
    expect(sql).toContain("region.status = 'active'");
    expect(sql).toContain("ORDER BY region_name ASC, region_id ASC");
    expect(sql).toContain("LIMIT $3 OFFSET $4");
  });
});
