# Redis / BullMQ Staging Proof - 2026-05-22

## Scope

This note records the first real staging Redis / BullMQ proof after the Render
Key Value instance was created and attached to the staging backend.

It proves staging connectivity and durable queue health. It does not claim that
the free Key Value tier is sufficient for broad production durability.

No business logic, API response shape, auth/permission semantics, database
schema, provider code, CSS, or user-facing workflow behavior was changed in the
repository for this evidence pass.

## Sokrates Decision

Claim:

- The project can now run the staging backend in Redis-backed BullMQ queue mode.

Assumptions:

- `https://api-staging.hr-axis.com/api` is the active staging backend.
- The Render Key Value instance was created by the operator and connected to
  the staging backend through environment variables.
- The Redis connection string is secret and must not be recorded.

Evidence:

- Backend `/api/health` returned HTTP `200`.
- Health reported `queueBackend=bullmq`.
- Health reported queue `status=durable`.
- Health reported `checks.redis.status=ok`.
- Deployed readiness passed its public/deploy surface checks.
- Backend read-load smoke kept protected groups skipped because no fresh bearer
  token was provided; it did not falsely mark tokenless protected routes as
  passed.

Counterargument:

- A free Key Value instance has low memory/connection limits and no persistence.
  This is enough to prove staging wiring, but it is not enough to declare broad
  production durable-queue readiness.

Risk:

- Evidence recording: LOW.
- Treating this free-tier staging proof as broad-production durability: HIGH.

Door:

- This evidence document is a two-way door.
- The provider/env change is an operational action; rollback is to restore
  `QUEUE_BACKEND=in-memory`, `RATE_LIMIT_BACKEND=memory`, and
  `READINESS_PROFILE=controlled-pilot`.

Stop rule used:

- Stop before recording raw Redis URLs, provider credentials, bearer tokens, or
  private payloads.
- Stop before upgrading broad-production readiness while alert delivery and
  Supabase restore evidence remain open.

## Operator Change

The operator created a Render Key Value instance and deployed the backend after
setting the staging backend environment to Redis-backed queue/rate-limit mode.

Sanitized environment shape:

```text
REDIS_URL=[secret Render Key Value internal URL]
QUEUE_BACKEND=bullmq
RATE_LIMIT_BACKEND=redis
READINESS_PROFILE=controlled-pilot
```

The raw `REDIS_URL` is not recorded.

## Live Health Proof

Command shape:

```powershell
curl.exe -sS -H "Accept: application/json" --max-time 45 https://api-staging.hr-axis.com/api/health
curl.exe -sS -H "Accept: application/json" --max-time 45 https://api-staging.hr-axis.com/api/health/live
```

Result:

- Evidence time: `2026-05-22T09:59:58Z`.
- `/api/health/live`: HTTP `200`, status `ok`.
- `/api/health`: HTTP `200`, status `ok`.
- service: `hr-axis-staging-api`.
- database: `ok`, latency `67ms` in the direct health sample.
- queue backend: `bullmq`.
- queue durable: `true`.
- queue status: `durable`.
- queue message: `BullMQ queue is using Redis-backed durable dispatch.`
- Redis check: `ok`, latency `6ms` in the direct health sample.
- observability: `ok`, `log-only`, external delivery `not-enabled`.
- readiness profile: `controlled-pilot`.

Decision:

- Staging Redis connectivity: Go.
- Staging BullMQ durable queue health: Go.
- Broad-production durable queue readiness: still Conditional/No-Go until the
  owner accepts a production-grade Redis tier and the full broad-production
  readiness profile is proven.

## Deployed Readiness Smoke

Command:

```powershell
$env:READINESS_ENVIRONMENT="staging"
$env:READINESS_FRONTEND_URL="https://staging.hr-axis.com"
$env:READINESS_BACKEND_URL="https://api-staging.hr-axis.com/api"
$env:READINESS_TIMEOUT_MS="45000"
npm.cmd run smoke:deployed-readiness
```

Result:

- Evidence time: `2026-05-22T10:00:00.640Z`.
- status: `ok`.
- total checks: `14`.
- passed: `13`.
- failed: `0`.
- skipped: `1`.
- skipped check: backend auth session because no `READINESS_BEARER_TOKEN` was
  provided.
- Backend dependency health inside the smoke also reported:
  - `queueBackend=bullmq`,
  - queue `status=durable`,
  - Redis `status=ok`.

Decision:

- Public deployed staging surface after Redis/BullMQ enablement: Go.
- Auth/session deployed readiness was not rerun in this shell because no fresh
  bearer token was supplied; existing Clerk persona evidence remains the current
  auth proof.

## Backend Readiness Load Smoke

Command:

```powershell
$env:BACKEND_LOAD_OUTPUT="json"
$env:BACKEND_LOAD_ENVIRONMENT="staging"
$env:BACKEND_LOAD_API_BASE_URL="https://api-staging.hr-axis.com/api"
$env:BACKEND_LOAD_ITERATIONS="3"
$env:BACKEND_LOAD_CONCURRENCY="2"
$env:BACKEND_LOAD_TIMEOUT_MS="45000"
npm.cmd run smoke:backend-readiness-load
```

Result:

- Evidence time: `2026-05-22T09:59:58.108Z`.
- status: `blocked`.
- total groups: `5`.
- passed groups: `1`.
- failed groups: `0`.
- skipped groups: `4`.
- Public API health group:
  - availability `100%`,
  - p50 `61.98ms`,
  - p95 `145.06ms`,
  - 5xx `0`.
- Protected groups were skipped because no role-specific bearer token was
  provided:
  - authenticated session,
  - store read routes,
  - competition read routes,
  - import read routes.

Decision:

- Public backend health after Redis/BullMQ enablement: Go.
- Protected route load budgets were not rerun here; they need fresh bearer
  tokens if this Redis provider change should be included in a full protected
  performance proof.

## Alert Routing Recheck

Command:

```powershell
$env:ALERT_SMOKE_ENVIRONMENT="staging"
$env:ALERT_SMOKE_BACKEND_URL="https://api-staging.hr-axis.com/api"
$env:ALERT_SMOKE_TIMEOUT_MS="45000"
npm.cmd run smoke:alert-routing
```

Result:

- Evidence time: `2026-05-22T09:59:57.944Z`.
- status: `ok`.
- total checks: `5`.
- passed: `4`.
- failed: `0`.
- skipped: `1`.
- provider delivery: `not-configured`.
- backend health alert signal: passed with HTTP `200`.

Decision:

- Redis/BullMQ enablement did not break backend health alert signal.
- External alert provider delivery remains open.

## Current Readiness Decision

Controlled staging/internal pilot:

- Conditional Go, with Redis/BullMQ staging wiring now proven.

Broad production:

- Still No-Go.

Remaining blockers before broad production:

- Production-grade Redis/Key Value tier decision and broad-production profile
  proof.
- External alert provider delivery or explicit owner log-retention acceptance.
- Supabase restore drill into an approved disposable target.

## Safety

- No raw Redis URL, provider credential, bearer token, Clerk cookie, database
  URL, webhook secret, password, private key, or private payload is recorded.
- No production database was touched.
- No DB migration, auth configuration, API response, business logic, CSS, or
  user-facing workflow change was made.

