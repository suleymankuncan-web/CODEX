# Ranking daily-facts cache experiment

Status: implementation
Date: 2026-09-16
Risk: R5 (Redis read caching; no database or write-path changes)
Contract Impact: intentionally unchanged API, authorization, KPI/HG formulas,
ranking eligibility/order, daily/monthly selection and source records.

The owner requested a measured before/after experiment for the frequently used
Turkey rankings page. Cache only the shared daily physical aggregate CTE, not
authenticated responses. Current monthly selection uses those daily facts.
Names, current roles/assignments, approved personnel targets, checklists and score
configuration continue through their existing fresh reads. Closed snapshots and
legacy monthly-only reads remain unchanged. The separately discussed monthly HG
denominator standardization is not part of this performance experiment.

Keys include a format version, database endpoint/name/server-start identity,
PostgreSQL MVCC snapshot, scope (store/employee), canonical company IDs and exact
inclusive dates. `pg_current_snapshot()` fingerprints transaction visibility
without allocating a write transaction or changing the database. Changed
snapshots invalidate old aggregates, including direct SQL/import replacements,
deletes and commits that finish out of transaction-ID order. This is intentionally
conservative: unrelated writes, aborted transactions and other cluster activity
can also cause misses. Frequent writes may limit the benefit; measure hit/fill
counts before widening deployment. This is not a universal table-change feed.
Reference: https://www.postgresql.org/docs/17/functions-info.html#FUNCTIONS-PG-SNAPSHOT

Cache fills verify the revision again before publishing. Redis operations have
short deadlines, bounded payloads and entry counts, TTL, local single-flight and
an expiring cross-process fill lock. Unavailable revision reads, unavailable/malformed
Redis or oversize results fall back to the original SQL. Only numeric physical
aggregates and internal entity IDs are cached; no names, tokens or role decisions.
The cache is default-off and enabled only with RANKING_FACTS_CACHE_ENABLED=true.
Turning it off restores the original read path; no business data repair is needed.
Existing queue Redis eviction settings must not be changed for this experiment.
The consuming SQL statement checks the cached snapshot again: a post-lookup
commit selects the original aggregate within that same statement snapshot.
EXPLAIN ANALYZE must prove that a matching snapshot skips the physical fact scan
and a changed snapshot executes it. This prevents mixing old company facts with
new store metadata during a concurrent reassignment.
Payloads are limited to 512 KiB and 64 entries per database namespace (~32 MiB
payload ceiling plus Redis overhead). Periods shorter than seven days bypass the
cache: initial two-day measurement showed no meaningful gain.

Acceptance: original/cached query results match for month and custom range;
source updates and rollback are correct; current assignments and personnel target
changes are visible; company/range/scope isolation; simultaneous cold requests
coalesce; timeout/corruption/eviction have correct fallbacks; memory is bounded.

Evidence: repeatable synthetic local PostgreSQL + Redis fixture, 100 stores,
800 personnel, 15 loaded days (54,000 physical records), sequential month/range
and eight-concurrent-request cohorts. Baseline is captured before runtime edits.
Report cold and warm timings, percentile definition, SQL count and exact output
parity. These are database/read-path timings, not hosted API or browser latency.
Record full backend and canonical release checks; perform inline
self-review. No live load test, provider activation or data mutation is implied.
