import { ChecklistVisitPlanRepository } from "./checklist-visit-plan.repository";

function fixture() {
  const portfolio = [{ store_id: "store-b", region_id: "region-b" }, { store_id: "store-a", region_id: "region-a" }];
  const revisions = new Map([["region-a", 2], ["region-b", 3]]);
  let replay: { plan_id: string; request_sha256: string }[] = [];
  const query = jest.fn(async (sql: string, params: unknown[]) => {
    if (sql.includes("FROM ops.user_action_store_assignment assignment")) return { rows: portfolio };
    if (sql.includes("SELECT plan_id FROM ops.region_weekly_visit_plan")) return { rows: [{ plan_id: `plan-${params[0]}` }] };
    if (sql.includes("SELECT plan_id, request_sha256")) return { rows: replay };
    if (sql.includes("AS week_start_date")) return { rows: [{
      plan_id: `plan-${params[0]}`, region_id: params[0], region_name: "legacy", week_start_date: params[1],
      revision_no: revisions.get(String(params[0])) ?? 0, created_at: "2026-09-21T00:00:00Z",
      items_json: [{ storeId: params[0] === "region-a" ? "store-a" : "store-b", plannedDate: "2026-09-22", displayOrder: 0 }],
    }] };
    return { rows: [] };
  });
  const client = { query };
  const withTransaction = jest.fn(async (work) => work(client));
  const repository = new ChecklistVisitPlanRepository({ withTransaction } as never);
  const read = { actorUserId: "manager", weekStart: "2026-09-21", storeIds: ["store-a", "store-b"] };
  const write = { actorUserId: read.actorUserId, weekStart: read.weekStart, authorizedStoreIds: read.storeIds,
    expectedRevision: 5, expectedScopeRevision: "", idempotencyKey: "request", requestSha256: "a".repeat(64),
    items: [{ storeId: "store-a", plannedDate: "2026-09-23", displayOrder: 0 }, { storeId: "store-b", plannedDate: "2026-09-23", displayOrder: 1 }] };
  return { repository, client, withTransaction, portfolio, revisions, read, write, setReplay: (value: typeof replay) => { replay = value; } };
}

describe("assigned-store weekly plans", () => {
  it("unifies legacy storage groups without exposing a fake region identity", async () => {
    const f = fixture();
    const plan = await f.repository.getAssignedWeeklyPlan(f.read);
    expect(plan).toMatchObject({ regionId: null, planId: null, revision: 5, scopeRevision: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(plan.items.map((item) => item.storeId)).toEqual(["store-a", "store-b"]);
    const [sql, params] = f.client.query.mock.calls[0];
    expect(sql).toContain("assignment.user_id = $1::uuid");
    expect(sql).toContain("assignment.end_at > CURRENT_TIMESTAMP");
    expect(sql).toContain("INNER JOIN ops.region region");
    expect(sql).toContain("region.company_id = store.company_id");
    expect(sql).toContain("region.status = 'active'");
    expect(sql).not.toContain("FOR SHARE");
    expect(params).toEqual([f.read.actorUserId, f.read.storeIds]);
  });

  it("saves every group on the same transaction client in deterministic order", async () => {
    const f = fixture();
    const plan = await f.repository.getAssignedWeeklyPlan(f.read);
    f.withTransaction.mockClear();
    const save = jest.spyOn(f.repository, "saveWeeklyPlan").mockImplementation(async (input) => {
      f.revisions.set(input.regionId, input.expectedRevision + 1);
      return { ...plan, regionId: input.regionId };
    });
    const saved = await f.repository.saveAssignedWeeklyPlan({ ...f.write, expectedScopeRevision: plan.scopeRevision! });
    expect(f.withTransaction).toHaveBeenCalledTimes(1);
    expect(save.mock.calls.map(([input]) => input.regionId)).toEqual(["region-a", "region-b"]);
    expect(save.mock.calls.map(([input]) => input.items.map((item) => item.storeId))).toEqual([["store-a"], ["store-b"]]);
    for (const [, client] of save.mock.calls) expect(client).toBe(f.client);
    expect(saved.revision).toBe(7);
    expect(saved.scopeRevision).not.toBe(plan.scopeRevision);
  });

  it("rejects scope changes even when the sum of revisions stays the same", async () => {
    const f = fixture();
    const plan = await f.repository.getAssignedWeeklyPlan(f.read);
    f.revisions.set("region-a", 3);
    f.revisions.set("region-b", 2);
    const save = jest.spyOn(f.repository, "saveWeeklyPlan");
    await expect(f.repository.saveAssignedWeeklyPlan({ ...f.write, expectedScopeRevision: plan.scopeRevision! })).rejects.toThrow("revision is stale");
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects revoked assignments before any write", async () => {
    const f = fixture();
    f.portfolio.pop();
    await expect(f.repository.saveAssignedWeeklyPlan(f.write)).rejects.toThrow("outside the direct active portfolio");
    expect(f.client.query).toHaveBeenCalledTimes(1);
  });

  it("does not rewrite an unchanged group's plan items or attendance", async () => {
    const f = fixture();
    const plan = await f.repository.getAssignedWeeklyPlan(f.read);
    const save = jest.spyOn(f.repository, "saveWeeklyPlan").mockResolvedValue(plan);
    await f.repository.saveAssignedWeeklyPlan({ ...f.write, expectedScopeRevision: plan.scopeRevision!,
      items: [{ storeId: "store-a", plannedDate: "2026-09-22", displayOrder: 0 }, f.write.items[1]] });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].regionId).toBe("region-b");
  });

  it("replays atomic requests including skipped unchanged groups and rejects different content", async () => {
    const f = fixture();
    const save = jest.spyOn(f.repository, "saveWeeklyPlan");
    f.setReplay([{ plan_id: "plan-region-a", request_sha256: f.write.requestSha256 }, { plan_id: "plan-region-b", request_sha256: f.write.requestSha256 }]);
    await expect(f.repository.saveAssignedWeeklyPlan(f.write)).resolves.toMatchObject({ revision: 5 });
    expect(save).not.toHaveBeenCalled();
    f.setReplay([{ plan_id: "plan-region-a", request_sha256: f.write.requestSha256 }]);
    await expect(f.repository.saveAssignedWeeklyPlan(f.write)).resolves.toMatchObject({ revision: 5 });
    expect(save).not.toHaveBeenCalled();
    f.setReplay([{ plan_id: "plan-region-a", request_sha256: "other" }, { plan_id: "plan-region-b", request_sha256: f.write.requestSha256 }]);
    await expect(f.repository.saveAssignedWeeklyPlan(f.write)).rejects.toThrow("Idempotency key");
  });
});
