import { RankingFactsCache } from "./ranking-facts-cache";
import { parseRankingFacts, rankingFactsNumericFields } from "./ranking-facts-cache-sql";

const redis = {
  status: "ready", on: jest.fn(), disconnect: jest.fn(), connect: jest.fn(),
  get: jest.fn(), set: jest.fn(), del: jest.fn(), eval: jest.fn(),
};
jest.mock("ioredis", () => ({ __esModule: true, default: jest.fn(() => redis) }));
const input = { companyIds: ["00000000-0000-4000-8000-000000000001"], periodStart: "2026-09-01", periodEnd: "2026-09-30" };
const revision = { database_name: "fixture", database_user: "api", server_started_at: "2026-09-16", revision: "1:1:" };
const row = { store_id: input.companyIds[0], ...Object.fromEntries(rankingFactsNumericFields.map(field => [field, "1.234567890123456789"])) };
function fixture(enabled = true) {
  const database = { query: jest.fn().mockImplementation(async (sql: string) => ({
    rows: sql.includes("pg_current_snapshot") ? [revision] : [row],
  })) };
  const cache = new RankingFactsCache(database as never, { rankingFactsCacheEnabled: enabled, redisUrl: "redis://localhost", databaseUrl: "postgres://localhost/fixture" } as never);
  return { database, cache };
}
beforeEach(() => {
  jest.clearAllMocks();
  redis.get.mockReset().mockResolvedValue(null);
  redis.set.mockReset().mockResolvedValue("OK");
  redis.eval.mockReset().mockResolvedValue(1);
});

it("default-off and short ranges retain the original path without any cache I/O", async () => {
  const disabled = fixture(false);
  expect(await disabled.cache.get("store", input)).toBeUndefined();
  expect(disabled.database.query).not.toHaveBeenCalled();
  const short = fixture();
  expect(await short.cache.get("store", { ...input, periodEnd: "2026-09-02" })).toBeUndefined();
  expect(short.database.query).not.toHaveBeenCalled();
});

it("reuses physical NUMERIC strings without caching a final role-scoped response", async () => {
  const { cache, database } = fixture();
  redis.get.mockResolvedValue(JSON.stringify({ snapshot: revision.revision, rows: [row] }));
  expect(await cache.get("store", input)).toBe(JSON.stringify({ snapshot: revision.revision, rows: [row] }));
  expect(database.query).toHaveBeenCalledTimes(1);
  expect(cache.metrics().hit).toBe(1);
});

it("separates companies, inclusive ranges and entity kinds; canonicalizes company order", async () => {
  const { cache } = fixture();
  const employee = { ...row, employee_id: input.companyIds[0] };
  redis.get.mockResolvedValue(JSON.stringify({ snapshot: revision.revision, rows: [employee] }));
  await cache.get("store", input);
  await cache.get("employee", input);
  await cache.get("store", { ...input, periodStart: "2026-09-02" });
  await cache.get("store", { ...input, companyIds: ["00000000-0000-4000-8000-000000000002"] });
  expect(new Set(redis.get.mock.calls.map(call => call[0])).size).toBe(4);
  await cache.get("store", { ...input, companyIds: ["00000000-0000-4000-8000-000000000002", ...input.companyIds] });
  await cache.get("store", { ...input, companyIds: [...input.companyIds, "00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000002"] });
  expect(redis.get.mock.calls[4][0]).toBe(redis.get.mock.calls[5][0]);
});

it("does not publish data if a committed source change occurred during the fill", async () => {
  const { cache, database } = fixture();
  database.query.mockResolvedValueOnce({ rows: [revision] })
    .mockResolvedValueOnce({ rows: [row] })
    .mockResolvedValueOnce({ rows: [{ ...revision, revision: "2:2:" }] });
  expect(await cache.get("store", input)).toBeUndefined();
  expect(redis.eval.mock.calls.some(call => call[0].includes("ZADD"))).toBe(false);
});

it("isolates database identities, database roles and server restarts on shared Redis", async () => {
  const { cache, database } = fixture();
  redis.get.mockResolvedValue(JSON.stringify({ snapshot: revision.revision, rows: [row] }));
  for (const identity of [revision, { ...revision, database_name: "another" },
    { ...revision, database_user: "restricted" }, { ...revision, server_started_at: "2026-09-17" }]) {
    database.query.mockResolvedValueOnce({ rows: [identity] });
    await cache.get("store", input);
  }
  expect(new Set(redis.get.mock.calls.map(call => call[0])).size).toBe(4);
});

it("recomputes malformed payloads and coalesces a concurrent cold fill", async () => {
  const { cache, database } = fixture();
  redis.get.mockResolvedValue("{invalid");
  const values = await Promise.all(Array.from({ length: 16 }, () => cache.get("store", input)));
  expect(values.every(value => value === JSON.stringify({ snapshot: revision.revision, rows: [row] }))).toBe(true);
  expect(database.query.mock.calls.filter(call => !call[0].includes("pg_current_snapshot"))).toHaveLength(1);
  expect(redis.del).toHaveBeenCalled();
  expect(cache.metrics().coalesced).toBe(15);
});

it("fails open and backs off for unavailable Redis or an unavailable revision read", async () => {
  const { cache, database } = fixture();
  redis.get.mockRejectedValue(new Error("connection refused"));
  expect(await cache.get("store", input)).toBeUndefined();
  expect(await cache.get("store", input)).toBeUndefined();
  expect(database.query).toHaveBeenCalledTimes(1);
  const missing = fixture();
  missing.database.query.mockRejectedValue(new Error("database unavailable"));
  expect(await missing.cache.get("store", input)).toBeUndefined();
});

it("rejects malformed identifiers, missing components and non-numeric cache fields", () => {
  expect(parseRankingFacts(JSON.stringify([row]), "store")).toEqual([row]);
  for (const bad of [{ ...row, store_id: "not-an-id" }, { ...row, sales: "NaN" }, { ...row, sales: undefined }]) {
    expect(() => parseRankingFacts(JSON.stringify([bad]), "store")).toThrow();
  }
  expect(() => parseRankingFacts(JSON.stringify([row]), "employee")).toThrow();
});


