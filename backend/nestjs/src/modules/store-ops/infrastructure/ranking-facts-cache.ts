import { createHash, randomUUID } from "node:crypto";
import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import IORedis from "ioredis";
import { AppConfigService } from "../../../shared/app-config.service";
import { DatabaseService } from "../../../shared/database/database.service";
import { readRankingFactsRevision } from "./ranking-facts-cache-revision";
import {
  validateRankingFactsPayload, rankingFactsSelectSql,
  type RankingFactsInput, type RankingFactsScope,
} from "./ranking-facts-cache-sql";

const TTL_SECONDS = 6 * 60 * 60;
const MAX_BYTES = 512 * 1024;
const MAX_ENTRIES = 64;
const UNLOCK = "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0";
// Bound cache memory independently of queue Redis's noeviction policy. Only our keys are touched.
const PUBLISH = `
if redis.call('GET',KEYS[3]) ~= ARGV[1] then return 0 end
redis.call('ZREMRANGEBYSCORE',KEYS[2],'-inf',ARGV[4]-ARGV[3]*1000)
redis.call('SET',KEYS[1],ARGV[2],'EX',ARGV[3])
redis.call('ZADD',KEYS[2],ARGV[4],KEYS[1])
local extra=redis.call('ZCARD',KEYS[2])-tonumber(ARGV[5])
if extra>0 then
  local old=redis.call('ZRANGE',KEYS[2],0,extra-1)
  for _,key in ipairs(old) do
    if string.sub(key,1,string.len(ARGV[6])) == ARGV[6] then redis.call('DEL',key) end
    redis.call('ZREM',KEYS[2],key)
  end
end
redis.call('EXPIRE',KEYS[2],ARGV[3])
return 1`;

@Injectable()
export class RankingFactsCache implements OnModuleDestroy {
  private redis?: IORedis;
  private connecting?: Promise<unknown>;
  private retryAfter = 0;
  private readonly pending = new Map<string, Promise<string | undefined>>();
  private readonly counts = { hit: 0, fill: 0, coalesced: 0, bypass: 0, unavailable: 0 };
  private readonly logger = new Logger(RankingFactsCache.name);
  private lastReportedAt = Date.now();

  constructor(private readonly database: DatabaseService, private readonly config: AppConfigService) {}

  /** Aggregate counters only: no user names, IDs, tokens or Redis URLs. */
  metrics() { return { ...this.counts }; }

  async get(scope: RankingFactsScope, input: RankingFactsInput): Promise<string | undefined> {
    if (!this.config.rankingFactsCacheEnabled || Date.now() < this.retryAfter) return undefined;
    // Local before/after proof shows no benefit for the small two-day query.
    const days = (Date.parse(input.periodEnd) - Date.parse(input.periodStart)) / 86_400_000 + 1;
    if (!Number.isFinite(days) || days < 7) return undefined;
    try {
      const revision = await this.revision();
      if (!revision) return undefined;
      const prefix = `hr-axis:ranking-facts:v1:{${revision.namespace}}`;
      const digest = createHash("sha256").update(JSON.stringify([
        scope, [...new Set(input.companyIds.map(id => id.toLowerCase()))].sort(),
        input.periodStart, input.periodEnd,
      ])).digest("hex");
      const key = `${prefix}:${revision.revision}:${digest}`;
      const existing = this.pending.get(key);
      if (existing) { this.counts.coalesced++; return await existing; }
      if (this.pending.size >= MAX_ENTRIES) { this.counts.bypass++; return undefined; }
      const work = this.readOrFill(key, `${prefix}:index`, scope, input, revision);
      this.pending.set(key, work);
      try { return await work; } finally { this.pending.delete(key); }
    } catch {
      this.counts.unavailable++;
      this.retryAfter = Date.now() + 30_000;
      return undefined;
    } finally {
      if (Date.now() - this.lastReportedAt >= 60_000) {
        this.lastReportedAt = Date.now();
        this.logger.log({ event: "ranking.facts-cache", ...this.counts });
      }
    }
  }

  private revision() {
    return readRankingFactsRevision(this.database, this.config.databaseUrl);
  }

  private client() {
    if (!this.redis) {
      this.redis = new IORedis(this.config.redisUrl, {
        lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 0,
        connectTimeout: 300, commandTimeout: 300, retryStrategy: () => null,
      });
      // Never log the connection error: it can contain credentials.
      this.redis.on("error", () => undefined);
    }
    return this.redis;
  }

  private async connect(redis: IORedis) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        redis.connect(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            redis.disconnect(false);
            reject(new Error("Ranking cache connection deadline exceeded"));
          }, 300);
        }),
      ]);
    } finally { if (timer) clearTimeout(timer); }
  }

  private async readOrFill(
    key: string, index: string, scope: RankingFactsScope, input: RankingFactsInput,
    expected: { namespace: string; revision: string; snapshot: string },
  ): Promise<string | undefined> {
    const redis = this.client();
    if (redis.status !== "ready") {
      this.connecting ??= this.connect(redis).finally(() => { this.connecting = undefined; });
      await this.connecting;
    }
    const read = async () => {
      const value = await redis.get(key);
      if (value === null) return undefined;
      if (Buffer.byteLength(value) > MAX_BYTES) { await redis.del(key); return undefined; }
      try { validateRankingFactsPayload(value, scope); }
      catch { await redis.del(key); return undefined; }
      this.counts.hit++;
      return value;
    };
    const value = await read();
    if (value !== undefined) return value;
    const lock = `${key}:lock`;
    const token = randomUUID();
    if (!(await redis.set(lock, token, "PX", 10_000, "NX"))) {
      const until = Date.now() + 1_500;
      while (Date.now() < until) {
        await new Promise(resolve => setTimeout(resolve, 40));
        const filled = await read();
        if (filled !== undefined) return filled;
      }
      this.counts.bypass++;
      return undefined;
    }
    try {
      // Another process may have completed between GET and lock acquisition.
      const filled = await read();
      if (filled !== undefined) return filled;
      const result = await this.database.query(rankingFactsSelectSql(scope), [
        input.periodStart, input.periodEnd, input.companyIds,
      ]);
      const payload = JSON.stringify({ snapshot: expected.snapshot, rows: result.rows });
      if (Buffer.byteLength(payload) > MAX_BYTES) { this.counts.bypass++; return undefined; }
      validateRankingFactsPayload(payload, scope);
      const current = await this.revision();
      if (current?.namespace !== expected.namespace || current.revision !== expected.revision) {
        this.counts.bypass++;
        return undefined;
      }
      await redis.eval(PUBLISH, 3, key, index, lock, token, payload, TTL_SECONDS, Date.now(), MAX_ENTRIES, index.slice(0, -"index".length));
      this.counts.fill++;
      return payload;
    } finally {
      await redis.eval(UNLOCK, 1, lock, token).catch(() => undefined);
    }
  }

  onModuleDestroy() { this.redis?.disconnect(false); }
}
