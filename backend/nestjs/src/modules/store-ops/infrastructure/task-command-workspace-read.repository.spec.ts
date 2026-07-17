import { TaskCommandWorkspaceReadRepository } from "./task-command-workspace-read.repository";

const storeId = "11111111-1111-4111-8111-111111111111";
const companyId = "22222222-2222-4222-8222-222222222222";
const actionPlanId = "33333333-3333-4333-8333-333333333333";

describe("TaskCommandWorkspaceReadRepository", () => {
  it("reads one bounded page and one batched audit preview without exposing actor ids", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [{
        store_action_plan_id: actionPlanId, store_id: storeId, store_name: "Pilot Mağaza",
        source_type: "checklist_remediation", source_id: "source-1",
        source_deep_link: "https://unsafe.example/path", title: "Kontrol sonucu",
        summary: null, priority: "high", status: "closed", due_on: "2026-07-17",
        resolution_note: "Tamamlandı", cancel_reason: null,
        closed_at: "2026-07-17T09:00:00.000Z", cancelled_at: null,
        created_at: "2026-07-16T09:00:00.000Z", updated_at: "2026-07-17T09:00:00.000Z",
      }] })
      .mockResolvedValueOnce({ rows: [{
        event_log_id: "event-1", entity_id: actionPlanId,
        event_type: "store_action_plan.closed", occurred_at: "2026-07-17T09:00:00.000Z",
        actor_display_name: "Pilot Kullanıcı", actor_role_label: "Mağaza Müdürü",
        note: "Tamamlandı", event_total: 1,
      }] });
    const repository = new TaskCommandWorkspaceReadRepository({ query } as never);

    const result = await repository.readPage({
      companyIds: [companyId], regionIds: [], storeIds: [],
      statuses: ["closed", "cancelled"], periodStart: "2026-07-01",
      periodEnd: "2026-07-31", limit: 20, offset: 0, eventLimit: 3,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.source.deepLink).toBe("/store/checklists");
    expect(result.items[0]?.events.items[0]).toEqual(expect.objectContaining({
      actorDisplayName: "Pilot Kullanıcı", actorRoleLabel: "Mağaza Müdürü",
    }));
    const pageSql = String(query.mock.calls[1]?.[0]);
    const auditSql = String(query.mock.calls[2]?.[0]);
    expect(pageSql).toContain("p.company_id = ANY($1::uuid[])");
    expect(pageSql).toContain("LIMIT $5");
    expect(auditSql).toContain("ROW_NUMBER() OVER");
    expect(auditSql).toContain("metadata_json ->> 'actorDisplayName'");
    expect(auditSql).toContain("assignment.start_at <= event.occurred_at");
    expect(auditSql).not.toContain("actor_user_id AS");
  });

  it("checks event detail scope before returning a bounded chronological page", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ action_plan_id: actionPlanId }] })
      .mockResolvedValueOnce({ rows: [] });
    const repository = new TaskCommandWorkspaceReadRepository({ query } as never);
    const result = await repository.readEvents({
      actionPlanId, companyIds: [], regionIds: [], storeIds: [storeId], limit: 20, offset: 20,
    });
    expect(result).toEqual({ items: [], total: 0, limit: 20, offset: 20 });
    expect(String(query.mock.calls[0]?.[0])).toContain("p.store_id = ANY($2::uuid[])");
    expect(query.mock.calls[1]?.[1]).toEqual([[actionPlanId], 20, 20]);
  });

  it("fails closed when a scoped plan is absent", async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [] });
    const repository = new TaskCommandWorkspaceReadRepository({ query } as never);
    await expect(repository.readEvents({
      actionPlanId, companyIds: [], regionIds: [], storeIds: [storeId], limit: 20, offset: 0,
    })).resolves.toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
  });
});
