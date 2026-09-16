# Turkey ranking cache: local before/after evidence

Date: 2026-09-16. Synthetic local query-path evidence, not staging, HTTP or browser
latency. The owner requested measurement before adding the cache. The unmodified
`121df0e8` read functions were measured first (12 sequential monthly requests:
p50 110.17 ms; eight-concurrent cohort p50 360.27 ms). The larger paired run below
uses identical data/indexes, the original query path and the final cached path.

Fixture: real PostgreSQL 16 and Redis 7 containers on the same workstation;
100 stores, 800 personnel, 15 loaded days, 54,000 daily physical records.
Four real ranking queries per operation: stores, personnel and their Turkey
benchmarks. Both paths run against the same database, eight-connection pool,
filters and source data. Every returned row/value is compared. Percentiles use
nearest rank; 30 samples per sequential cohort, 80 at concurrency eight.

| Scenario | Original p50 / p95 (ms) | Cache p50 / p95 (ms) |
| --- | --- | --- |
| Monthly | 101.86 / 130.40 | 45.22 / 58.52 |
| Seven-day range | 59.94 / 78.72 | 37.81 / 54.29 |
| Monthly, eight concurrent | 345.46 / 374.69 | 185.19 / 247.42 |
| Two-day range (cache bypassed) | 39.75 / 53.21 | 39.38 / 84.05 |
| Monthly, unrelated write every ten reads | 99.83 / 113.14 | 43.36 / 110.96 |

Monthly median decreased 56%; the concurrent median decreased 46%. The first
monthly cache fill was 126.37 ms versus 109.31 ms for the original first read;
reuse supplies the gain. Two-day requests keep the identical original SQL path;
their median is unchanged and no tail-latency gain is claimed. Early-month data
with only a few loaded days may also benefit less. A busy write workload causes
conservative invalidation and narrows the benefit (see the mixed-workload p95).

SQL statement count rises from four to eight on a warm operation: four cheap
snapshot reads replace repeated aggregate work. Do not equate fewer statements
with less load. EXPLAIN ANALYZE verifies zero kpi_actual scan loops on a valid
warm cache and execution of the original scan after a post-lookup source commit.
The JSON's physicalScans counter counts direct original/fill query paths;
guarded in-statement race fallbacks are separately verified with EXPLAIN.

Checks passed: complete value parity; committed changes; uncommitted/rollback
and truncate rollback; out-of-order commits; fresh personnel names/approved
targets/manager-role expiry; company separation; exactly one fill across two
cache instances and 16 concurrent reads; malformed/expired entries; a 64-entry
bound; unrelated Redis-key preservation, including a corrupt cache index.
A TCP peer that accepts but does not answer triggers the 300 ms connection
deadline; the original database result was returned in 336.47 ms in the measured
run. Unit coverage also verifies database/user/server-start namespace isolation
and unavailable-revision fallback.

Reproduce using explicitly provided loopback URLs for disposable PostgreSQL and
Redis services (no live endpoints). From `backend/nestjs`, set
`RANKING_CACHE_LOCAL_PROOF=true`, `RANKING_CACHE_POSTGRES_URL` and
`RANKING_CACHE_REDIS_URL`, then run:

```sh
node -r ./node_modules/ts-node/register scripts/ranking-cache-benchmark.ts
```

`--proof-only` skips timing cohorts for focused correctness verification. The
script creates and drops its own uniquely named database and only removes its
own Redis keys. It never uses application seed data or a live auth session.
Raw paired results: [JSON](2026-09-16-rankings-cache.json).

Self-review corrected two issues before closeout: a shared write-counter design
was removed to avoid introducing write-lock contention; stalled Redis readiness
now has an explicit deadline. A consuming-statement MVCC guard closes the race
between cache lookup and current company/store metadata reads. The final change
has no migration, business-write hook or HG/scoring change.

Activation: default-off `RANKING_FACTS_CACHE_ENABLED=true` enables only the ranking
module. Existing Redis must allow the private `hr-axis:ranking-facts:v1:*`
namespace and GET/SET/DEL/EXPIRE plus EVAL/ZADD/ZCARD/ZRANGE/ZREM/ZREMRANGEBYSCORE.
Keep queue eviction settings unchanged. Cache payloads are bounded near 32 MiB
per database namespace plus Redis overhead. Minute-spaced `ranking.facts-cache`
logs expose aggregate hit/fill/coalesced/bypass/unavailable counters without user
data. Turning the flag off is the immediate rollback. Hosted activation and
end-to-end gains are not claimed by this local evidence.

Review follow-up (17 September): oversized results now publish a tiny bypass
marker, bounded and expired with the normal cache index. The targeted regression
reduced three oversized requests from six aggregate scans to four (one initial
size discovery plus three original reads), including reuse by another instance.
An additional real PostgreSQL/Redis fixture with 2,200 stores confirmed the same
four-scan result, exact output parity and a 27-byte expiring marker.
Snapshot changes and marker expiry permit a fresh size check. Local fixture URL
tests reject plain, encoded and duplicate host overrides before any connection.
These boundary fixes do not replace the paired timing measurements above.
