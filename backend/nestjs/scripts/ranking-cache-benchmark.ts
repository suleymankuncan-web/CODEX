import "reflect-metadata";
import * as assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { ConfigService } from "@nestjs/config";
import { Pool, type QueryResultRow } from "pg";
import IORedis from "ioredis";
import { AppConfigService } from "../src/shared/app-config.service";
import { DatabaseService } from "../src/shared/database/database.service";
import { RankingFactsCache } from "../src/modules/store-ops/infrastructure/ranking-facts-cache";
import { readRankingFactsRevision } from "../src/modules/store-ops/infrastructure/ranking-facts-cache-revision";
import { readRankingStoreRange, readRankingRangeBenchmarks } from "../src/modules/store-ops/infrastructure/ranking-range-read";
import { readRankingPersonnelRange } from "../src/modules/store-ops/infrastructure/ranking-personnel-range-read";
import { readEmployeeTurkeyBenchmarks } from "../src/modules/store-ops/infrastructure/personnel-benchmark-read";
import { fixtureCompany, seedRankingCacheFixture } from "./ranking-cache-local-fixture";
import { proveRankingCache } from "./ranking-cache-proof";
import { localRankingCacheUrl } from "./ranking-cache-local-url";

class MeasuredDatabase extends DatabaseService {
  queries = 0;
  physicalScans = 0;
  override async query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
    this.queries++;
    if (sql.includes("WITH daily AS")) this.physicalScans++;
    return super.query<T>(sql, params);
  }
}

async function main() {
  assert(process.env.RANKING_CACHE_LOCAL_PROOF === "true" && process.env.NODE_ENV !== "production", "Explicit local fixture opt-in required");
  const pgUrl = localRankingCacheUrl("RANKING_CACHE_POSTGRES_URL", process.env.RANKING_CACHE_POSTGRES_URL, ["postgres:", "postgresql:"]);
  const redisUrl = localRankingCacheUrl("RANKING_CACHE_REDIS_URL", process.env.RANKING_CACHE_REDIS_URL, ["redis:"]);
  pgUrl.pathname = "/postgres";
  const admin = new Pool({ connectionString: pgUrl.toString(), max: 1 });
  const name = `ranking_cache_fixture_${randomUUID().replace(/-/g, "")}`;
  await admin.query(`CREATE DATABASE "${name}"`);
  pgUrl.pathname = `/${name}`;
  const pool = new Pool({ connectionString: pgUrl.toString(), max: 8 });
  const database = new MeasuredDatabase(pool);
  const config = new AppConfigService(new ConfigService({ NODE_ENV: "test", DATABASE_URL: pgUrl.toString(), RANKING_FACTS_CACHE_ENABLED: "true", REDIS_URL: redisUrl.toString() }));
  const cache = new RankingFactsCache(database, config);
  const redis = new IORedis(redisUrl.toString(), { maxRetriesPerRequest: 0 });
  redis.on("error", () => undefined);
  const input = { companyIds: [fixtureCompany], periodStart: "2026-09-01", periodEnd: "2026-09-30", metricCodes: ["TARGET_ACHIEVEMENT", "ATV", "UPT", "CR", "gsm_approval"] };
  const read = (end: string, useCache: boolean) => {
    const i = { ...input, periodEnd: end };
    const c = useCache ? cache : undefined;
    return Promise.all([
      readRankingStoreRange(database, i, c), readRankingPersonnelRange(database, i, c),
      readRankingRangeBenchmarks(database, { ...i, companyId: fixtureCompany }, c),
      readEmployeeTurkeyBenchmarks(database, { ...i, companyId: fixtureCompany, isRange: true }, c),
    ]);
  };
  const results: object[] = [];
  let namespace: string | undefined;
  try {
    await seedRankingCacheFixture(pool);
    namespace = (await readRankingFactsRevision(database, config.databaseUrl))?.namespace;
    const normalize = (groups: unknown[][]) => groups.map(rows => rows.map(row => JSON.stringify(row)).sort());
    for (const [label, end, concurrency, count] of [
      ["month", "2026-09-30", 1, 30], ["two-days", "2026-09-02", 1, 30],
      ["week", "2026-09-07", 1, 30], ["month-burst", "2026-09-30", 8, 80],
      ["month-write-every-ten-reads", "2026-09-30", 1, 30],
    ] as const) {
      if (process.argv.includes("--proof-only")) break;
      const expected = normalize(await read(end, false));
      for (const enabled of [false, true]) {
        const coldStart = performance.now();
        assert.deepEqual(normalize(await read(end, enabled)), expected);
        const firstReadMs = performance.now() - coldStart;
        database.queries = 0; database.physicalScans = 0;
        let next = 0;
        const samples: number[] = [];
        const start = performance.now();
        await Promise.all(Array.from({ length: concurrency }, async () => {
          while (next++ < count) {
            const t = performance.now();
            const actual = await read(end, enabled);
            samples.push(performance.now() - t);
            assert.deepEqual(normalize(actual), expected);
            if (label === "month-write-every-ten-reads" && samples.length % 10 === 0) {
              await pool.query("UPDATE ops.employee SET first_name=first_name WHERE employee_id=md5('employee-1')::uuid");
            }
          }
        }));
        samples.sort((a, b) => a - b);
        const rounded = (n: number) => Number(n.toFixed(2));
        results.push({ label, cache: enabled, concurrency, samples: count,
          firstReadMs: rounded(firstReadMs), p50Ms: rounded(samples[Math.ceil(count * .5) - 1]),
          p95Ms: rounded(samples[Math.ceil(count * .95) - 1]), wallMs: rounded(performance.now() - start),
          queries: database.queries, physicalScans: database.physicalScans });
      }
    }
    const proof = await proveRankingCache({ pool, database, cache, redis, config, input });
    console.log(JSON.stringify({ kind: "synthetic-local-read-path-not-http-or-browser", measuredAt: new Date().toISOString(),
      stores: 100, personnel: 800, days: 15, physicalRows: 54000, percentile: "nearest-rank", parity: "all responses matched",
      results, metrics: cache.metrics(), proof }, null, 2));
  } finally {
    if (namespace) {
      const index = `hr-axis:ranking-facts:v1:{${namespace}}:index`;
      const keys = await redis.zrange(index, 0, -1).catch(() => []);
      // Only entries owned by this freshly generated disposable database.
      for (const key of keys) { assert(key.startsWith(`hr-axis:ranking-facts:v1:{${namespace}}:`)); await redis.del(key); }
      await redis.del(index).catch(() => undefined);
    }
    cache.onModuleDestroy(); redis.disconnect(false);
    await pool.end();
    assert(/^ranking_cache_fixture_[a-f0-9]{32}$/.test(name));
    await admin.query(`DROP DATABASE "${name}"`);
    await admin.end();
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message.replace(/(?:postgres(?:ql)?|redis):\/\/[^\s]+/g, "[redacted-url]") : "Local proof failed"); process.exitCode = 1; });
