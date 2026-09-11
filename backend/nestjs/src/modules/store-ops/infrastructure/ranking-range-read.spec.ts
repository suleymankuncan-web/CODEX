import { readRankingStoreRange } from "./ranking-range-read";

describe("readRankingStoreRange", () => {
  it("prefers complete direct target-achievement facts and falls back to net sales", async () => {
    const statements: unknown[] = [];
    const query = jest.fn(async (sql: unknown) => {
      statements.push(sql);
      return { rows: [] };
    });

    await readRankingStoreRange(
      { query } as never,
      {
        companyIds: [],
        periodStart: "2026-09-01",
        periodEnd: "2026-09-02",
        metricCodes: ["TARGET_ACHIEVEMENT"],
      },
    );

    const sql = String(statements[0]);
    expect(sql).toContain("COALESCE(achievement.value, sales.value)");
    expect(sql).toContain("COALESCE(achievement.target, sales.target)");
    expect(sql).toContain(
      "candidate.kpi_code IN ('TARGET_ACHIEVEMENT', 'STORE_SALES', 'SALES_TARGET_ACHIEVEMENT')",
    );
    expect(sql).toContain("LIMIT 1");
    expect(sql).toContain(
      "COUNT(DISTINCT day) = $2::date - $1::date + 1",
    );
  });
});
