import { ChecklistOperationalHistoryRepository } from "./checklist-operational-history.repository";

const storeId = "11111111-1111-4111-8111-111111111111";
const sourceId = "22222222-2222-4222-8222-222222222222";
const eventKey = "7f5d708a4ca2a9367240d65f84f86269";

describe("ChecklistOperationalHistoryRepository", () => {
  it("uses one scoped keyset query and serializes only allowlisted fields", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{
      store_id: storeId,
      store_name: "Pilot Store",
      event_count: "5",
      completed_visit_count: "1",
      assigned_task_count: "1",
      open_task_count: "1",
      event_id: "evt_safe",
      event_kind: "checklist_completed",
      occurred_at: "2026-07-14T10:00:00.000Z",
      event_title: "Denetim tamamlandı",
      event_detail: "Mağaza denetimi tamamlandı.",
      actor_display_name: "Pilot Kullanıcı",
      actor_role_label: "Bölge Müdürü",
      actor_assignment_label: "Pilot Bölge",
      actor_identity_status: "historical_projection",
      details_json: [{ label: "Denetim türü", value: "Bölge Müdürü ziyareti" }],
      event_key: eventKey,
      kind_rank: 5,
    }] });
    const repository = new ChecklistOperationalHistoryRepository({ query } as never);
    const result = await repository.read({
      companyIds: [], regionIds: ["33333333-3333-4333-8333-333333333333"], storeIds: [], storeId,
      range: "12m", kinds: ["checklist_completed"], cursor: null, limit: 21,
    });

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("(store.company_id = ANY($1::uuid[])");
    expect(query.mock.calls[0][0]).toContain("JOIN scoped_checklist_instance AS scoped_instance ON scoped_instance.checklist_instance_id = event.entity_id");
    expect(query.mock.calls[0][0]).toContain("ORDER BY event.occurred_at DESC, event.kind_rank DESC, event.event_key DESC");
    expect(query.mock.calls[0][0]).toContain("(event.occurred_at, event.kind_rank, event.event_key) < ($7::timestamptz, $8::integer, $9::text)");
    expect(query.mock.calls[0][0]).toContain("LIMIT $10");
    expect(query.mock.calls[0][0]).toContain("DISTINCT ON (event.entity_id)");
    expect(query.mock.calls[0][0]).toContain("instance.completed_by_user_id ~*");
    expect(query.mock.calls[0][0]).toContain("task.status = 'closed' AND task.closed_at IS NOT NULL");
    expect(query.mock.calls[0][0]).toContain("JOIN ops.region_weekly_visit_plan_item AS item ON item.revision_id = revision.previous_revision_id");
    expect(query.mock.calls[0][0]).toContain("COUNT(*) FILTER (WHERE kind = 'task_assigned')");
    expect(query.mock.calls[0][0]).toContain("CASE assignment.scope_type WHEN 'store' THEN 1 WHEN 'region' THEN 2 WHEN 'company' THEN 3 ELSE 4 END");
    expect(query.mock.calls[0][0]).toContain("ROW_NUMBER() OVER");
    expect(query.mock.calls[0][0]).not.toContain("LEFT JOIN LATERAL");
    expect(query.mock.calls[0][0]).not.toContain("acknowledgement_note");
    expect(query.mock.calls[0][0]).not.toContain("resolution_note");
    expect(query.mock.calls[0][0]).not.toContain("metadata_json");
    expect(query.mock.calls[0][1]).toHaveLength(10);
    expect(result?.summary).toEqual({ eventCount: 5, completedVisitCount: 1, assignedTaskCount: 1, openTaskCount: 1 });
    expect(JSON.stringify(result)).not.toMatch(/email|username|acknowledgementNote|resolutionNote|metadata|sourceDeepLink|auditorId|personnelId/i);
    expect(result?.items[0]?.cursor).toEqual({ occurredAt: "2026-07-14T10:00:00.000Z", kindRank: 5, eventKey });
    expect(JSON.stringify(result)).not.toContain(sourceId);
  });

  it("returns null without leaking whether an unscoped store exists", async () => {
    const repository = new ChecklistOperationalHistoryRepository({ query: jest.fn().mockResolvedValue({ rows: [] }) } as never);
    await expect(repository.read({ companyIds: [], regionIds: [], storeIds: [storeId], storeId, range: "all", kinds: ["task_assigned"], cursor: null, limit: 21 })).resolves.toBeNull();
  });
});
