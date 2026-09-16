import { rankingDailyComponentsSql } from "./ranking-daily-components-sql";

export type RankingFactsScope = "store" | "employee";
export type RankingFactsInput = {
  companyIds: string[];
  periodStart: string;
  periodEnd: string;
};
export const rankingFactsNumericFields = [
  "sales", "achievement", "sales_target", "atv_numerator", "atv_denominator",
  "upt_numerator", "upt_denominator", "cr_numerator", "cr_denominator",
] as const;
export type RankingFactsRow = { store_id: string; employee_id?: string } &
  Record<(typeof rankingFactsNumericFields)[number], string | null>;

/** Round-trip PostgreSQL NUMERIC as strings; never round aggregates in JS. */
export function rankingFactsSelectSql(scope: RankingFactsScope) {
  return `${rankingDailyComponentsSql(scope)} SELECT store_id::text,
    ${scope === "employee" ? "employee_id::text," : ""}
    ${rankingFactsNumericFields.map(field => `${field}::text`).join(",")}
    FROM facts ORDER BY store_id${scope === "employee" ? ", employee_id" : ""}`;
}

export function cachedRankingFactsSql(scope: RankingFactsScope, parameter: number) {
  // A commit between cache lookup and this statement must not mix old facts with
  // current store/company metadata. PostgreSQL skips the live scan for a valid
  // snapshot; on a race it evaluates the original aggregate in this same snapshot.
  const live = rankingDailyComponentsSql(scope, "NOT (SELECT valid FROM ranking_cache_snapshot)")
    .replace("WITH daily AS (", `WITH ranking_cache_snapshot AS MATERIALIZED (
      SELECT ($${parameter}::jsonb->>'snapshot') = pg_current_snapshot()::text AS valid
    ), daily AS (`)
    .replace("), facts AS (", "), uncached_facts AS (");
  const columns = `store_id, ${scope === "employee" ? "employee_id," : ""} ${rankingFactsNumericFields.join(",")}`;
  return `${live}, facts AS (SELECT * FROM jsonb_to_recordset($${parameter}::jsonb->'rows') AS f(
    store_id uuid, ${scope === "employee" ? "employee_id uuid," : ""}
    ${rankingFactsNumericFields.map(field => `${field} numeric`).join(",")})
    WHERE (SELECT valid FROM ranking_cache_snapshot)
    UNION ALL SELECT ${columns} FROM uncached_facts)`;
}

export function validateRankingFactsPayload(value: string, scope: RankingFactsScope) {
  const payload = JSON.parse(value);
  if (!payload || typeof payload.snapshot !== "string" || !/^\d+:\d+:(?:\d+(?:,\d+)*)?$/.test(payload.snapshot)) {
    throw new Error("Invalid ranking facts snapshot");
  }
  parseRankingFacts(JSON.stringify(payload.rows), scope);
}

export function parseRankingFacts(value: string, scope: RankingFactsScope): RankingFactsRow[] {
  const rows: unknown = JSON.parse(value);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const numeric = /^-?\d+(?:\.\d+)?$/;
  if (!Array.isArray(rows) || rows.length > 20_000 || rows.some(row =>
    !row || typeof row !== "object" || !uuid.test(row.store_id) ||
    (scope === "employee" && !uuid.test(row.employee_id)) ||
    rankingFactsNumericFields.some(field => row[field] !== null &&
      (typeof row[field] !== "string" || !numeric.test(row[field]))))) {
    throw new Error("Invalid ranking facts cache payload");
  }
  return rows as RankingFactsRow[];
}
