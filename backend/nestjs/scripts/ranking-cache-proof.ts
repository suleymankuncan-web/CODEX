import * as assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import { ConfigService } from "@nestjs/config";
import type { Pool } from "pg";
import type IORedis from "ioredis";
import { AppConfigService } from "../src/shared/app-config.service";
import type { DatabaseService } from "../src/shared/database/database.service";
import { RankingFactsCache } from "../src/modules/store-ops/infrastructure/ranking-facts-cache";
import { readRankingFactsRevision } from "../src/modules/store-ops/infrastructure/ranking-facts-cache-revision";
import { cachedRankingFactsSql, rankingFactsCacheVersion } from "../src/modules/store-ops/infrastructure/ranking-facts-cache-sql";
import { readRankingStoreRange, type RankingRangeInput } from "../src/modules/store-ops/infrastructure/ranking-range-read";
import { readRankingPersonnelRange } from "../src/modules/store-ops/infrastructure/ranking-personnel-range-read";

export async function proveRankingCache(context: {
  pool: Pool; database: DatabaseService; cache: RankingFactsCache; redis: IORedis;
  config: AppConfigService; input: RankingRangeInput;
}) {
  const { pool, database, cache, redis, config, input } = context;
  const revision = () => readRankingFactsRevision(database, config.databaseUrl);
  const namespace = (await revision())!.namespace;
  const index = `hr-axis:ranking-facts:v${rankingFactsCacheVersion}:{${namespace}}:index`;
  // Mixed old/new daily codes must remain additive even on a warm monthly cache.
  await pool.query(`UPDATE ops.kpi_actual SET kpi_id=8 WHERE scope_type='store' AND kpi_id=1 AND period_start='2026-09-01';
    INSERT INTO ops.kpi_actual SELECT 8,store_id,NULL,company_id,scope_type,period_type,period_start,period_end,9999999,source_type
    FROM ops.kpi_actual WHERE scope_type='store' AND kpi_id=1 AND period_start='2026-09-02'`);
  const original = await readRankingStoreRange(database, input, cache);
  assert.equal(Number(original.find(row => row.store_name === 'Store 1' && row.kpi_code === 'TARGET_ACHIEVEMENT')?.actual_value), 10010 * 8 * 15);
  assert.deepEqual(await readRankingStoreRange(database, input, cache), await readRankingStoreRange(database, input));
  await pool.query("UPDATE ops.kpi_actual SET actual_value=actual_value+100 WHERE scope_type='store' AND kpi_id=8 AND period_start='2026-09-01'");
  const changed = await readRankingStoreRange(database, input, cache);
  assert.notDeepEqual(changed, original);
  assert.deepEqual(changed, await readRankingStoreRange(database, input));

  // Force a source commit after GET but before the downstream SQL statement.
  const captured = await cache.get("store", input);
  assert(captured);
  await pool.query("UPDATE ops.kpi_actual SET actual_value=actual_value+1 WHERE scope_type='store' AND kpi_id=1 AND period_start='2026-09-02'");
  const staleCache = new RankingFactsCache(database, config);
  staleCache.get = async () => captured;
  assert.deepEqual(await readRankingStoreRange(database, input, staleCache), await readRankingStoreRange(database, input));
  const current = await cache.get("store", input);
  assert(current);
  const explain = (payload: string) => pool.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${cachedRankingFactsSql("store", 4)} SELECT * FROM facts`,
    [input.periodStart, input.periodEnd, input.companyIds, payload]);
  type Plan = { "Relation Name"?: string; "Actual Loops"?: number; Plans?: Plan[] };
  const scanLoops = (node: Plan): number =>
    (node["Relation Name"] === "kpi_actual" ? node["Actual Loops"] ?? 0 : 0) +
    (node.Plans ?? []).reduce((sum, plan) => sum + scanLoops(plan), 0);
  assert.equal(scanLoops((await explain(current)).rows[0]["QUERY PLAN"][0].Plan), 0);
  assert(scanLoops((await explain(captured)).rows[0]["QUERY PLAN"][0].Plan) > 0);

  for (const table of ["kpi_actual", "kpi_target", "kpi_definition", "store"]) {
    const before = await readRankingStoreRange(database, input);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const column = table === "store" ? "store_name" : table === "kpi_definition" ? "kpi_name" : table === "kpi_target" ? "target_value" : "actual_value";
      await client.query(`UPDATE ops.${table} SET ${column}=${column} WHERE ctid=(SELECT ctid FROM ops.${table} LIMIT 1)`);
      assert.deepEqual(await readRankingStoreRange(database, input, cache), before, "uncommitted writes must be invisible");
      await client.query("ROLLBACK");
    } finally { client.release(); }
    assert.deepEqual(await readRankingStoreRange(database, input, cache), before);
  }
  const client = await pool.connect();
  const beforeTruncate = await readRankingStoreRange(database, input);
  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE ops.kpi_actual");
    await client.query("ROLLBACK");
  } finally { client.release(); }
  assert.deepEqual(await readRankingStoreRange(database, input, cache), beforeTruncate);

  const beforeMetadata = await revision();
  await pool.query("UPDATE ops.personnel_target_reference SET target_value=target_value+1000; UPDATE ops.employee SET first_name='Fresh name' WHERE employee_id=md5('employee-1')::uuid");
  const personnel = await readRankingPersonnelRange(database, input, cache);
  assert.notDeepEqual(await revision(), beforeMetadata, "unrelated committed writes conservatively invalidate");
  assert(personnel.some(row => row.first_name === "Fresh name"));
  assert(personnel.filter(row => row.kpi_code === "TARGET_ACHIEVEMENT").every(row => Number(row.target_value) === 401000));
  assert.deepEqual(personnel, await readRankingPersonnelRange(database, input));
  const beforeStoreApproval = await readRankingStoreRange(database, input, cache);
  await pool.query(`INSERT INTO ops.target_distribution_request(company_id,store_id,request_month,total_target_value,request_status,approved_at)
    SELECT company_id,store_id,'2026-09-01',4200000,'approved',NOW() FROM ops.store`);
  const afterStoreApproval = await readRankingStoreRange(database, input, cache);
  assert.notDeepEqual(afterStoreApproval, beforeStoreApproval);
  assert(afterStoreApproval.filter(row => row.kpi_code === "TARGET_ACHIEVEMENT").every(row => Number(row.target_value) === 4200000));
  assert.deepEqual(afterStoreApproval, await readRankingStoreRange(database, input));
  await pool.query(`INSERT INTO ops.role VALUES (1,'REGION_MANAGER');
    INSERT INTO ops.user_account VALUES (md5('manager')::uuid,NULL,'Manager one',NULL,true);
    INSERT INTO ops.user_role_assignment VALUES (md5('manager')::uuid,1,NOW()-interval '1 day',NULL);
    INSERT INTO ops.user_action_store_assignment VALUES (md5('store-1')::uuid,md5('manager')::uuid,NOW()-interval '1 day',NULL)`);
  assert((await readRankingStoreRange(database, input, cache)).some(row => row.region_manager_name === "Manager one"));
  await pool.query("UPDATE ops.user_role_assignment SET end_at=NOW()-interval '1 second'");
  assert(!(await readRankingStoreRange(database, input, cache)).some(row => row.region_manager_name === "Manager one"));
  assert.deepEqual(await readRankingStoreRange(database, { ...input, companyIds: ["00000000-0000-4000-8000-000000000099"] }, cache), []);

  // Distinct cache instances exercise the Redis fill lock, not just the local map.
  const second = new RankingFactsCache(database, config);
  try {
    await second.get("store", input); // establish its connection before the cold burst
    await pool.query("UPDATE ops.kpi_target SET target_value=target_value WHERE ctid=(SELECT ctid FROM ops.kpi_target LIMIT 1)");
    const fillsBefore = cache.metrics().fill + second.metrics().fill;
    const values = await Promise.all(Array.from({ length: 16 }, (_, i) => (i % 2 ? cache : second).get("store", input)));
    assert(values.every(value => value !== undefined && value === values[0]));
    assert.equal(cache.metrics().fill + second.metrics().fill - fillsBefore, 1);
  } finally { second.onModuleDestroy(); }

  // xmax alone is insufficient: a lower-ID transaction can commit last.
  const firstWriter = await pool.connect();
  const secondWriter = await pool.connect();
  try {
    await firstWriter.query("BEGIN");
    await firstWriter.query("UPDATE ops.kpi_actual SET actual_value=actual_value+10 WHERE scope_type='store' AND kpi_id=8 AND store_id=md5('store-1')::uuid AND period_start='2026-09-01'");
    await secondWriter.query("BEGIN");
    await secondWriter.query("UPDATE ops.kpi_actual SET actual_value=actual_value+20 WHERE scope_type='store' AND kpi_id=8 AND store_id=md5('store-2')::uuid AND period_start='2026-09-01'");
    await readRankingStoreRange(database, input, cache);
    await secondWriter.query("COMMIT");
    assert.deepEqual(await readRankingStoreRange(database, input, cache), await readRankingStoreRange(database, input));
    await firstWriter.query("COMMIT");
    assert.deepEqual(await readRankingStoreRange(database, input, cache), await readRankingStoreRange(database, input));
  } finally {
    await firstWriter.query("ROLLBACK"); await secondWriter.query("ROLLBACK");
    firstWriter.release(); secondWriter.release();
  }

  // Corruption and expiration reconstruct from the database without changing output.
  const expected = await readRankingStoreRange(database, input);
  for (const key of await redis.zrange(index, 0, -1)) await redis.set(key, "malformed", "EX", 60);
  assert.deepEqual(await readRankingStoreRange(database, input, cache), expected);
  for (const key of await redis.zrange(index, 0, -1)) await redis.pexpire(key, 1);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(await readRankingStoreRange(database, input, cache), expected);

  // Only our bounded index is evicted; queue/other Redis keys are untouched.
  const sentinel = `ranking-proof-other:${namespace}`;
  await redis.set(sentinel, "retained", "EX", 60);
  await redis.zadd(index, Date.now() - 1000, sentinel); // malformed index cannot delete unrelated keys
  for (let i = 0; i < 70; i++) {
    const start = new Date(Date.UTC(2020, 0, i + 1)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(2020, 0, i + 8)).toISOString().slice(0, 10);
    assert.deepEqual(JSON.parse((await cache.get("store", { ...input, periodStart: start, periodEnd: end }))!).rows, []);
  }
  assert(await redis.zcard(index) <= 64);
  assert.equal(await redis.get(sentinel), "retained");
  await redis.del(sentinel);
  assert.deepEqual(await readRankingStoreRange(database, input, cache), expected);
  // A TCP peer that accepts but never answers tests the real connection deadline.
  const sockets = new Set<Socket>();
  const stalled = createServer(socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  await new Promise<void>(resolve => stalled.listen(0, "127.0.0.1", resolve));
  const address = stalled.address();
  assert(address && typeof address === "object");
  const unavailable = new RankingFactsCache(database, new AppConfigService(new ConfigService({
    NODE_ENV: "test", DATABASE_URL: config.databaseUrl, RANKING_FACTS_CACHE_ENABLED: "true",
    REDIS_URL: `redis://127.0.0.1:${address.port}`,
  })));
  const failedAt = performance.now();
  let unavailableMs: number;
  try {
    assert.deepEqual(await readRankingStoreRange(database, input, unavailable), expected);
    unavailableMs = performance.now() - failedAt;
    assert(unavailableMs < 2000, "Redis timeout must remain bounded");
    assert.equal(unavailable.metrics().unavailable, 1);
  } finally {
    unavailable.onModuleDestroy();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => stalled.close(() => resolve()));
  }
  return { committedUpdate: true, uncommittedAndRollback: true, truncateRollback: true,
    mixedDailySalesAliases: true, freshStoreMonthlyTarget: true, freshPersonnelTargetAndName: true, freshManagerRoleExpiry: true, companyIsolation: true,
    crossInstanceColdFillCount: 1, postLookupCommitFallback: true, outOfOrderCommits: true, warmFactScanLoops: 0,
    corruptionAndExpiryRecovery: true, boundedEntries: 64, unrelatedRedisKeysPreserved: true,
    stalledRedisFallbackMs: Number(unavailableMs.toFixed(2)) };
}
