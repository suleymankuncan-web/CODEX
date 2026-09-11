import { readRankingPersonnelRange } from "./ranking-personnel-range-read";

describe("readRankingPersonnelRange", () => {
  it("attributes personnel stores through active direct Region Manager assignments", async () => {
    const query = jest.fn(async (_sql: unknown) => ({ rows: [] }));

    await readRankingPersonnelRange(
      { query } as never,
      {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
        periodStart: "2026-09-01",
        periodEnd: "2026-09-02",
        metricCodes: ["ATV"],
      },
    );

    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain("FROM ops.user_action_store_assignment manager_store");
    expect(sql).toContain("manager_store.store_id=s.store_id");
    expect(sql).toContain("role.role_code='REGION_MANAGER'");
    expect(sql).not.toContain("ura.region_id=s.region_id");
  });
});
