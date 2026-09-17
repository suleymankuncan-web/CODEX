import { readRankingStoreRange } from "./ranking-range-read";

describe("readRankingStoreRange", () => {
  it("pairs daily physical facts with full monthly targets and prefers recorded net sales", async () => {
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
    expect(sql).toContain("WHEN 'TARGET_ACHIEVEMENT' THEN facts.achievement");
    expect(sql).toContain("THEN monthly_target.value");
    expect(sql).toContain("request.request_status = 'approved'");
    expect(sql).toContain("kt.period_type = 'monthly'");
    expect(sql).toContain("SUM(sales) FILTER (WHERE tickets IS NOT NULL)");
    expect(sql).toContain("SUM(tickets) FILTER (WHERE sales IS NOT NULL)");
    expect(sql).toContain("SUM(tickets) AS cr_numerator");
    expect(sql).toContain("SUM(footfall) AS cr_denominator");
    expect(sql).not.toContain("SUM(tickets) FILTER (WHERE footfall IS NOT NULL)");
    expect(sql).toContain("MAX(ka.actual_value) FILTER (WHERE kd.kpi_code = 'TARGET_ACHIEVEMENT')");
    expect(sql).not.toContain("COUNT(DISTINCT day) = $2::date - $1::date + 1");
    expect(sql).toContain("SUM(kt.target_value * g.total_customer_count)");
    expect(sql).toContain("FROM ops.user_action_store_assignment manager_store");
    expect(sql).toContain("manager_store.store_id = s.store_id");
    expect(sql).not.toContain("ura.region_id = s.region_id");
  });
});
