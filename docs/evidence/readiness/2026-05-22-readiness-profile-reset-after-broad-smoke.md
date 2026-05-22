# Readiness Profile Reset After Broad Smoke - 2026-05-22

## Scope

This note records the temporary broad-production profile smoke after Redis /
BullMQ was already proven on staging, and the deliberate reset back to
`controlled-pilot` because the project is not going to the field yet.

It proves that the deployed staging backend can run with Redis-backed BullMQ and
Redis-backed rate limiting, and that the safer controlled-pilot posture is live
again. It does not claim final broad-production readiness.

No business logic, API response shape, auth/permission semantics, database
schema, provider code, CSS, or user-facing workflow behavior was changed in the
repository for this evidence pass.

## Sokrates Decision

Claim:

- Staging should keep Redis/BullMQ enabled, but the environment should not stay
  in broad-production readiness mode before a real production rollout decision.

Assumptions:

- The active staging backend is `https://api-staging.hr-axis.com/api`.
- The operator temporarily enabled the broad-production profile, deployed it,
  observed the result with Codex, then reset `READINESS_PROFILE` to
  `controlled-pilot` and redeployed.
- The Render Key Value connection string is secret and must not be recorded.

Evidence:

- Broad-production profile smoke reached `/api/health` successfully with Redis
  and BullMQ healthy.
- The broad-production profile reported `observability.status=degraded` because
  `ERROR_TRACKING_DSN` was intentionally not configured.
- After the reset, `/api/health` reported `readinessProfile=controlled-pilot`,
  `queueBackend=bullmq`, queue `status=durable`, and Redis `status=ok`.
- Deployed readiness passed after the reset.
- Public backend load passed after the reset.
- Alert routing passed after the reset.

Counterargument:

- We could set a placeholder `ERROR_TRACKING_DSN` only to make the health gate
  green, but that would create fake evidence. The correct production move is a
  real error-tracking provider or an explicit owner-accepted platform-alerting
  policy.

Risk:

- Evidence recording: LOW.
- Keeping broad-production mode without real error-tracking delivery or accepted
  risk: HIGH.

Door:

- This evidence note is a two-way door.
- Provider/env posture changes are operational actions; rollback is to keep
  `READINESS_PROFILE=controlled-pilot` while preserving the proven Redis/BullMQ
  settings.

Stop rule used:

- Stop before recording raw Redis URLs, provider credentials, bearer tokens,
  private payloads, or email addresses.
- Stop before claiming broad-production Go from staging-only evidence.

## Temporary Broad-Production Profile Smoke

Sanitized environment shape:

```text
READINESS_PROFILE=broad-production
QUEUE_BACKEND=bullmq
RATE_LIMIT_BACKEND=redis
REDIS_URL=[secret Render Key Value internal URL]
UPLOAD_PARSE_MAX_CONCURRENCY=1
UPLOAD_PARSE_TIMEOUT_MS=15000
ERROR_TRACKING_ENVIRONMENT=staging
ERROR_TRACKING_RELEASE=63e0292e
```

Result from `/api/health`:

- Evidence time: `2026-05-22T11:47:54.538Z`.
- HTTP status: `200`.
- health status: `ok`.
- queue backend: `bullmq`.
- queue status: `durable`.
- Redis check: `ok`, latency `4ms` in the direct health sample.
- database check: `ok`, latency `3ms` in the direct health sample.
- readiness profile: `broad-production`.
- observability status: `degraded`.
- error tracking DSN configured: `false`.
- external delivery: `not-enabled`.
- release: `63e0292e`.

Decision:

- Redis/BullMQ broad-profile technical posture: proven on staging.
- Broad-production readiness: not approved, because app-level error tracking is
  intentionally absent and the project is not going to the field yet.

## Broad-Production Alert Routing Check

Command:

```powershell
$env:ALERT_SMOKE_ENVIRONMENT="staging"
$env:ALERT_SMOKE_BACKEND_URL="https://api-staging.hr-axis.com/api"
$env:ALERT_PROVIDER_NAME="Render Notifications"
$env:ALERT_PRIMARY_DESTINATION="Slack"
$env:ALERT_BACKUP_DESTINATION="owner-email configured; email delivery not observed"
$env:ALERT_SMOKE_TIMEOUT_MS="45000"
npm.cmd run smoke:alert-routing
```

Result:

- Evidence time: `2026-05-22T11:48:08.293Z`.
- status: `failed`.
- total checks: `5`.
- passed: `4`.
- failed: `1`.
- failed check: backend health alert signal.
- reason: backend observability was `degraded`.
- health status: `ok`.
- database status: `ok`.

Decision:

- The failure is correct. It prevents broad-production Go while
  `ERROR_TRACKING_DSN` is absent.
- Do not bypass this with a fake DSN.

## Controlled-Pilot Reset

Sanitized environment shape after reset:

```text
READINESS_PROFILE=controlled-pilot
QUEUE_BACKEND=bullmq
RATE_LIMIT_BACKEND=redis
REDIS_URL=[secret Render Key Value internal URL]
UPLOAD_PARSE_MAX_CONCURRENCY=1
UPLOAD_PARSE_TIMEOUT_MS=15000
ERROR_TRACKING_ENVIRONMENT=staging
ERROR_TRACKING_RELEASE=63e0292e
```

Result from `/api/health`:

- Evidence time: `2026-05-22T11:58:55.931Z`.
- HTTP status: `200`.
- health status: `ok`.
- service: `hr-axis-staging-api`.
- queue backend: `bullmq`.
- queue durable: `true`.
- queue status: `durable`.
- Redis check: `ok`, latency `3ms`.
- database check: `ok`, latency `4ms`.
- observability status: `ok`.
- readiness profile: `controlled-pilot`.
- error tracking DSN configured: `false`.
- external delivery: `not-enabled`.
- release: `63e0292e`.

Decision:

- Current staging posture: Conditional Go for controlled pilot.
- Redis/BullMQ remains enabled and healthy.
- Broad-production posture remains parked until a real rollout decision.

## Deployed Readiness After Reset

Command:

```powershell
$env:READINESS_ENVIRONMENT="staging"
$env:READINESS_FRONTEND_URL="https://staging.hr-axis.com"
$env:READINESS_BACKEND_URL="https://api-staging.hr-axis.com/api"
$env:READINESS_TIMEOUT_MS="45000"
npm.cmd run smoke:deployed-readiness
```

Result:

- Evidence time: `2026-05-22T11:58:56.547Z`.
- status: `ok`.
- total checks: `14`.
- passed: `13`.
- failed: `0`.
- skipped: `1`.
- skipped check: backend auth session because no `READINESS_BEARER_TOKEN` was
  provided.
- Backend dependency health inside the smoke reported:
  - `queueBackend=bullmq`,
  - queue `status=durable`,
  - Redis `status=ok`,
  - observability `status=ok`,
  - readiness profile `controlled-pilot`.

## Backend Readiness Load After Reset

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

- Evidence time: `2026-05-22T11:58:56.102Z`.
- status: `blocked`.
- total groups: `5`.
- passed groups: `1`.
- failed groups: `0`.
- skipped groups: `4`.
- Public API health group:
  - availability `100%`,
  - p50 `57.56ms`,
  - p95 `199.86ms`,
  - 5xx `0`.
- Protected groups were skipped because no role-specific bearer token was
  provided.

Decision:

- Public backend health/load after the reset: Go.
- Protected route budgets were not rerun in this pass.

## Alert Routing After Reset

Command:

```powershell
$env:ALERT_SMOKE_ENVIRONMENT="staging"
$env:ALERT_SMOKE_BACKEND_URL="https://api-staging.hr-axis.com/api"
$env:ALERT_PROVIDER_NAME="Render Notifications"
$env:ALERT_PRIMARY_DESTINATION="Slack"
$env:ALERT_BACKUP_DESTINATION="owner-email configured; email delivery not observed"
$env:ALERT_SMOKE_TIMEOUT_MS="45000"
npm.cmd run smoke:alert-routing
```

Result:

- Evidence time: `2026-05-22T11:58:55.990Z`.
- status: `ok`.
- total checks: `5`.
- passed: `5`.
- failed: `0`.
- skipped: `0`.
- backend health alert signal: passed with HTTP `200`.
- observability status: `ok`.
- provider delivery: `metadata-only` from the script perspective.

Decision:

- The controlled-pilot reset restored the expected alert-routing gate state.
- Slack delivery remains the previously proven Render Notifications delivery
  path; email delivery is still not counted as proven.

## Current Readiness Decision

Controlled staging/internal pilot:

- Conditional Go.
- Redis/BullMQ staging wiring and controlled-pilot runtime posture are proven.

Broad production:

- Still No-Go.
- The Redis/BullMQ broad-profile technical path is proven on staging, but full
  broad-production readiness remains blocked by real error-tracking/provider
  policy and owner rollout approval.

Remaining broad-production decisions:

- Choose real app-level error tracking or explicitly accept platform alerting
  as the production alert policy.
- Choose a production-grade Redis/Key Value tier before relying on durable queue
  semantics for broad production.
- Accept or prove Supabase managed backup/PITR/RPO/RTO policy beyond the local
  logical application-schema restore proof.

## Safety

- No raw Redis URL, provider credential, bearer token, Clerk cookie, database
  URL, webhook secret, password, private key, email address, or private payload
  is recorded.
- No production database was touched.
- No DB migration, auth configuration, API response, business logic, CSS, or
  user-facing workflow change was made.
