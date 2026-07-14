import { ChecklistCommandReadRepository } from "./checklist-command-read.repository";

describe("ChecklistCommandReadRepository", () => {
  it("returns one scoped aggregate page and derives last visit only from completed checklists", async () => {
    const query = jest.fn().mockResolvedValueOnce({
      rows: [
        {
          period_key: "2026-07",
          total_count: 1,
          metrics_json: {
            totalStores: 1,
            needsVisit: 0,
            active: 0,
            pending: 0,
            completed: 1,
          },
          items_json: [
            {
              storeId: "store-1",
              storeCode: "ST-001",
              storeName: "Marmara Park",
              regionId: "region-1",
              regionName: "Marmara",
              regionManagers: [{ displayName: "Süleyman Öztürk" }],
              bmScore: 92,
              vmScore: 86,
              bmCompletedAt: "2026-07-10T09:00:00.000Z",
              vmCompletedAt: "2026-07-09T09:00:00.000Z",
              lastCompletedVisitAt: "2026-07-10T09:00:00.000Z",
              elapsedDaysSinceLastVisit: 4,
              activeChecklistCount: 0,
              pendingAcknowledgementCount: 0,
              openActionCount: 0,
              blockedActionCount: 0,
              status: "completed",
              reasonCodes: ["completed_period"],
              lastOperationalAt: "2026-07-10T09:00:00.000Z",
            },
          ],
        },
      ],
    });
    const repository = new ChecklistCommandReadRepository({ query } as never);

    const result = await repository.list({
      companyIds: [],
      regionIds: ["region-1"],
      storeIds: [],
      allowedTemplateTypes: ["BM_STORE_VISIT", "VM_STORE_VISIT"],
      period: "2026-07",
      status: "all",
      sort: "store_asc",
      limit: 30,
      offset: 0,
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("scoped_stores");
    expect(sql).toContain("ci.status = 'completed'");
    expect(sql).toContain("ci.completed_at IS NOT NULL");
    expect(sql).not.toContain("planned_at");
    expect(sql).not.toContain("acknowledgement_note");
    expect(sql).not.toContain("resolution_note");
    expect(query.mock.calls[0][1]).toEqual([
      [],
      ["region-1"],
      [],
      ["BM_STORE_VISIT", "VM_STORE_VISIT"],
      "2026-07",
      null,
      null,
      "all",
      30,
      0,
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.lastCompletedVisitAt).toBe("2026-07-10T09:00:00.000Z");
  });

  it("orders status pages deterministically without changing the read scope", async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [] });
    const repository = new ChecklistCommandReadRepository({ query } as never);

    await repository.list({
      companyIds: [],
      regionIds: ["region-1"],
      storeIds: [],
      allowedTemplateTypes: ["BM_STORE_VISIT", "VM_STORE_VISIT"],
      period: "2026-07",
      status: "all",
      sort: "status_asc",
      limit: 30,
      offset: 0,
    });

    expect(String(query.mock.calls[0][0])).toContain(
      "CASE command_status WHEN 'needs_visit' THEN 1 WHEN 'active' THEN 2 WHEN 'pending' THEN 3 WHEN 'completed' THEN 4 END ASC",
    );
  });
});
