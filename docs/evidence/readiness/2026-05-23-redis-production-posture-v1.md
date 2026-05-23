# Redis / BullMQ Production Posture Decision V1 - 2026-05-23

## Scope

This note records the current Redis / BullMQ posture after staging was wired to
Render Key Value and the backend health endpoint proved Redis-backed queue
health.

It is a production-readiness decision, not a provider secret record. It does
not store Redis URLs, passwords, connection strings, provider tokens, or private
payloads.

No product code, API response shape, auth/permission semantics, database
schema, provider code, CSS, or user-facing workflow behavior was changed.

## Sokrates Decision

Claim:

- The current Render Key Value Free instance is acceptable for the current
  controlled-pilot/staging posture, but it is not acceptable as the final
  broad-production durable queue tier.

Assumptions:

- The current deployment is staging/internal pilot, not broad production.
- The backend remains configured with `READINESS_PROFILE=controlled-pilot`.
- Redis/BullMQ health is live and observable through `/api/health`.
- The operator created a Render Key Value Free instance for this environment.
- Render's public documentation says paid Key Value instances include
  disk-backed persistence, while Free Key Value instances do not persist data to
  disk and can lose data when restarted.

Evidence:

- Existing proof:
  `docs/evidence/readiness/2026-05-22-redis-bullmq-staging-proof.md`.
- Existing reset proof:
  `docs/evidence/readiness/2026-05-22-readiness-profile-reset-after-broad-smoke.md`.
- Better Stack email proof rechecked the same public health path on 2026-05-23:
  `docs/evidence/readiness/2026-05-23-better-stack-email-alert-proof-v1.md`.
- Fresh direct health sample on 2026-05-23 returned:
  - `status=ok`
  - `queueBackend=bullmq`
  - queue `durable=true`
  - queue `status=durable`
  - Redis `status=ok`
  - `readinessProfile=controlled-pilot`
- Render Key Value docs:
  - `https://render.com/docs/key-value`
  - `https://render.com/free`

Counterargument:

- BullMQ stores queue state in Redis-compatible storage. If the Free instance
  restarts, queued jobs can be lost because the tier is not persistent.
- A low-traffic pilot can tolerate rerunning imports/snapshots more easily than
  a live customer deployment, but that does not make the tier production-grade.
- Connection and memory limits are not a current blocker, but they become real
  once workers, imports, snapshots, reports, and concurrent operators grow.

Risk:

- Controlled pilot with Free Key Value: MEDIUM operational risk.
- Broad production with Free Key Value: HIGH risk and No-Go.
- Broad production after upgrading to a persistent paid Key Value tier and
  rerunning health/smoke gates: LOW/MEDIUM, depending on job volume and retry
  policy.

Door:

- Controlled-pilot Free tier use is a two-way-door. It can be upgraded or
  replaced without changing application code if environment variables and
  provider wiring are handled carefully.
- Broad production on a non-persistent queue tier is not a good two-way-door,
  because data loss can become user-visible.

Stop rule used:

- Do not record Redis URLs, credentials, provider IDs, private network details,
  bearer tokens, cookies, database URLs, private keys, or private payloads.
- Do not count a Free/non-persistent tier as broad-production durable queue
  readiness.
- Do not switch staging to broad-production posture unless the operator
  explicitly asks for that release gate.

## Decision

Controlled staging/internal pilot:

- Accepted with the current Render Key Value Free instance.
- Keep `READINESS_PROFILE=controlled-pilot`.
- Keep Redis/BullMQ enabled so the code path remains exercised.
- Treat queued import/snapshot/workforce/reporting jobs as rerunnable if the
  provider restarts and loses queue state.
- Continue monitoring public `/api/health` for Redis and queue status.

Broad production:

- No-Go on the Free/non-persistent Key Value tier.
- Before broad production, choose one:
  - upgrade Render Key Value to a paid persistent tier, or
  - choose another production Redis-compatible provider with persistence and
    owner-approved reliability posture, or
  - explicitly accept the risk in writing for a very narrow launch where
    queue loss is not user-visible.

Recommended default:

- Upgrade before broad production.
- Treat the first paid persistent tier as enough for initial launch unless
  health metrics show memory/connection pressure.
- Revisit the tier when workers, import throughput, report materialization, or
  operator concurrency increase.

## Broad-Production Exit Criteria

Before marking Redis/BullMQ broad-production ready:

1. Paid persistent Redis-compatible tier or explicitly approved alternative is
   configured for the target environment.
2. The backend uses private/internal provider connectivity where available.
3. `/api/health` reports:
   - Redis `status=ok`
   - `queueBackend=bullmq`
   - queue `status=durable`
   - expected readiness profile for the release gate
4. `smoke:deployed-readiness` passes against the target environment.
5. `smoke:backend-readiness-load` passes with expected public/protected groups.
6. Queue worker/import/snapshot operations have a rerun or reconciliation path.
7. Provider metrics for memory and active connections are checked without
   recording private details.

## Verification Ladder

Local:

- `git diff --check`
- `npm.cmd run test:scripts`

Public staging:

- `curl.exe -sS -H "Accept: application/json" --max-time 45 https://api-staging.hr-axis.com/api/health`
- `npm.cmd run smoke:deployed-readiness`
- `npm.cmd run smoke:backend-readiness-load`

Provider:

- Confirm the Key Value tier and metrics in the Render dashboard.
- Record only sanitized tier/health decisions, never raw URLs or secrets.

## Final Posture

- Controlled pilot: Conditional Go with accepted Free-tier operational risk.
- Broad production: No-Go until a persistent production Redis-compatible tier
  or explicit written risk acceptance exists.
