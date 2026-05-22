# Production Evidence Closure Joint Plan V1

## Scope

This plan closes the remaining broad-production evidence gaps without pretending
that local code can prove external provider behavior.

Current hard blockers:

1. Redis / BullMQ durable queue and Redis-backed rate-limit evidence.
2. External alert provider delivery or explicit owner acceptance of log-only
   retention.
3. Supabase restore drill into an approved disposable target.

Already closed for the current controlled pilot:

- Clerk persona/session/action-scope evidence.
- Protected route load smoke for sampled pilot routes.
- Safe authenticated upload smoke with the existing `SUPER_ADMIN` pilot
  session.
- Import batch list/readback live verification after the staging fix.

This plan does not change business logic, API response shape, auth/permission
semantics, database schema, provider settings, CSS, or user-facing workflow
behavior.

## Sokrates Decision

Claim:

- The project is code-ready for the next evidence pass; the missing items are
  operational proof and owner-approved provider inputs.

Repository evidence:

- `AppConfigService` already fails broad production closed unless
  `RATE_LIMIT_BACKEND=redis`, `QUEUE_BACKEND=bullmq`, and `REDIS_URL` are
  configured.
- `HealthService` already pings Redis when Redis rate limiting or BullMQ is
  active and reports queue `status=durable` only when Redis health is `ok`.
- `smoke:alert-routing` already separates backend health signal from provider
  delivery and does not mark provider delivery as passed without metadata.
- `backup-restore-drill-runbook-v1.md` already defines the disposable-target
  restore process and sanitized evidence template.

Fresh preflight evidence from 2026-05-22:

- `smoke:deployed-readiness`: `ok`, 13 passed, 0 failed, 1 skipped because no
  bearer token was provided.
- Backend `/api/health`: `queueBackend=in-memory`,
  queue `status=process-local`, Redis `skipped`.
- `smoke:alert-routing`: `ok`, 4 passed, 0 failed, 1 skipped; provider
  delivery remains `not-configured`.
- Redis/rate-limit/evidence contract tests passed: 18/18.

Counterargument:

- We could add more observability code or new provider integrations now, but
  that would mix infrastructure decisions with application behavior. The next
  safest move is to prove the already-built Redis/health gates with a real
  staging Redis first.

Risk:

- This docs-only plan is LOW risk.
- Provider env/config changes are HIGH risk and must be performed with
  sanitized evidence and a rollback path.

Door:

- The plan is a two-way door.
- Enabling Redis/BullMQ, changing alert providers, or running restore drills are
  near one-way operational actions and need explicit target confirmation.

Stop rules:

- Stop if a secret would be pasted into docs, chat, logs, or PR text.
- Stop if a restore target is not clearly disposable.
- Stop if Redis enablement makes `/api/health` error or deployment checks turn
  red.
- Stop if alert evidence is only metadata but is being described as real
  delivery.

## Recommended Order

### 1. Redis / BullMQ Staging Proof

Why first:

- It is the most direct broad-production gap and the code path already exists.
- A failed Redis switch is easy to detect through `/api/health`.
- It unblocks queue durability and shared rate-limit confidence before wider
  traffic.

Provider decision:

- Recommended staging provider: Render Key Value, because the backend already
  runs on Render and the private/internal URL keeps network shape simple.
- Upstash is acceptable if the team prefers a separate managed Redis provider,
  but BullMQ must use a Redis-compatible TCP connection, not only REST.
- A free Redis tier is acceptable for staging setup proof only. Do not count a
  free/evicting/non-persistent tier as broad-production durability unless the
  owner explicitly accepts its limits.

Operator input required:

- Create or approve a staging Redis/Key Value instance.
- Add the Redis connection URL to the backend service as `REDIS_URL` without
  exposing it in chat or committed files.
- First smoke profile:
  - `QUEUE_BACKEND=bullmq`
  - `RATE_LIMIT_BACKEND=redis`
  - `REDIS_URL=[secret]`
  - Keep `READINESS_PROFILE=controlled-pilot` for the first low-risk staging
    smoke unless the owner intentionally wants broad-production fail-closed
    posture immediately.
- Broad-production posture profile, after the first smoke is green:
  - `READINESS_PROFILE=broad-production`
  - `QUEUE_BACKEND=bullmq`
  - `RATE_LIMIT_BACKEND=redis`
  - `REDIS_URL=[secret]`
  - `UPLOAD_PARSE_MAX_CONCURRENCY` explicitly configured.
  - `UPLOAD_PARSE_TIMEOUT_MS` explicitly configured.

Codex validation:

```powershell
$env:READINESS_ENVIRONMENT="staging"
$env:READINESS_FRONTEND_URL="https://staging.hr-axis.com"
$env:READINESS_BACKEND_URL="https://api-staging.hr-axis.com/api"
$env:READINESS_TIMEOUT_MS="45000"
npm.cmd run smoke:deployed-readiness

curl.exe -sS -H "Accept: application/json" --max-time 45 https://api-staging.hr-axis.com/api/health

$env:BACKEND_LOAD_OUTPUT="json"
$env:BACKEND_LOAD_ENVIRONMENT="staging"
$env:BACKEND_LOAD_API_BASE_URL="https://api-staging.hr-axis.com/api"
$env:BACKEND_LOAD_ITERATIONS="3"
$env:BACKEND_LOAD_CONCURRENCY="2"
$env:BACKEND_LOAD_TIMEOUT_MS="45000"
npm.cmd run smoke:backend-readiness-load
```

Acceptance:

- `/api/health` returns HTTP `200`.
- `checks.redis.status=ok`.
- `queueBackend=bullmq`.
- `queue.status=durable`.
- No raw Redis URL or credentials are recorded.
- Backend readiness smoke remains green or any protected-token skip is
  explicitly labeled as token-missing, not a pass.

2026-05-22 follow-up:

- Redis/BullMQ staging wiring was first proven with
  `READINESS_PROFILE=controlled-pilot`.
- A temporary broad-production profile smoke is recorded in
  `docs/evidence/readiness/2026-05-22-readiness-profile-reset-after-broad-smoke.md`.
- The broad-production smoke proved `queueBackend=bullmq`, queue
  `status=durable`, and Redis `status=ok`, but it correctly reported
  observability `degraded` because no real `ERROR_TRACKING_DSN` is configured.
- The backend was then reset to `READINESS_PROFILE=controlled-pilot` while
  keeping Redis/BullMQ enabled; health, deployed readiness, public backend
  load, and alert routing passed after the reset.
- Do not count the free/staging Redis tier or the temporary broad-production
  profile smoke as final production durability approval.

Rollback:

- Revert backend env to:
  - `QUEUE_BACKEND=in-memory`
  - `RATE_LIMIT_BACKEND=memory`
  - `READINESS_PROFILE=controlled-pilot`
- Redeploy backend.
- Confirm `/api/health` returns process-local queue mode and database `ok`.

### 2. Alert Provider Delivery Proof

Why second:

- Current backend health signal is already visible, but external delivery is
  not proven.
- This can be closed without changing app code if the owner accepts platform
  log/health alerting as the V1 provider.

Decision options:

- Option A, lowest code risk: platform/provider alerting over health/logs
  such as Render alerts, Better Stack, UptimeRobot, or another approved
  external monitor.
- Option B, stronger app-level tracking: add a real error-tracking SDK such as
  Sentry. This is a separate scoped implementation PR and should not be mixed
  into Redis or restore evidence.
- Option C, explicit owner acceptance: keep log-only mode for controlled pilot
  and record that broad production remains No-Go for external alert delivery.

Operator input required:

- Approved provider name.
- Primary destination label, such as an ops email, Slack channel, or provider
  incident route.
- Backup destination label if required by the smoke.
- One delivery proof artifact from the provider console, sanitized so it
  contains no webhook, token, or private payload.

Codex validation:

```powershell
$env:ALERT_SMOKE_ENVIRONMENT="staging"
$env:ALERT_SMOKE_BACKEND_URL="https://api-staging.hr-axis.com/api"
$env:ALERT_PROVIDER_NAME="[provider-label]"
$env:ALERT_PRIMARY_DESTINATION="[destination-label]"
$env:ALERT_BACKUP_DESTINATION="[backup-label]"
$env:ALERT_SMOKE_TIMEOUT_MS="45000"
npm.cmd run smoke:alert-routing
```

Acceptance:

- Alert routing smoke passes.
- Provider metadata check passes.
- Separate sanitized delivery proof exists, or the owner explicitly records
  log-retention acceptance.
- Evidence does not claim app-level Sentry-style delivery unless that code
  exists and is tested.

### 3. Supabase Restore Drill

Why third:

- It is the highest operational blast radius.
- It needs a disposable target and PostgreSQL tooling before any command is
  safe.

2026-05-22 status:

- Supabase staging application-schema logical restore proof is recorded in
  `docs/evidence/readiness/2026-05-22-supabase-staging-logical-restore-drill.md`.
- A PostgreSQL 17 logical dump from staging restored into a disposable local
  PostgreSQL 17 target after excluding the Supabase-managed `vault`
  extension/schema from the restore list.
- Source and restore app schema table counts matched, migration tracking rows
  matched, and an `ops.store` smoke count matched.
- This closes the local logical application-schema restore proof. It does not
  close managed Supabase restore-to-new-project, PITR, Storage/Auth/Realtime/
  Edge settings restore, or final production RPO/RTO acceptance.

Operator input required:

- Confirm the source is staging, not production.
- Provide or approve a disposable restore target:
  - local PostgreSQL,
  - staging PostgreSQL,
  - or a disposable Supabase project.
- Confirm the target can be dropped/recreated.
- Provide the source and restore connection strings through a secure local env
  mechanism, not chat or docs.
- Ensure `pg_dump`, `pg_restore`, `createdb`, `dropdb`, and `psql` are
  available, or approve Supabase CLI dump/restore mode.

Codex validation follows:

- `docs/plans/backup-restore-drill-runbook-v1.md`.

Acceptance:

- Backup command succeeds.
- Restore target is disposable and separate from source.
- Restore command succeeds.
- Schema/table counts for `ops`, `stg`, `rpt`, and `audit` are captured.
- `audit.schema_migration` count is captured.
- Smoke query succeeds.
- Evidence is sanitized and contains no raw URLs, passwords, tokens, or row
  samples containing personal data.

## Final Readiness Decision After The Three Steps

Controlled pilot:

- Remains `Conditional Go` unless a new live regression is found.

Broad production can move from `No-Go` only when:

- Redis/BullMQ durable queue health is proven on the target environment.
- External alert delivery or explicit owner log-retention acceptance is
  recorded.
- Supabase restore drill succeeds against an approved disposable target.

Do not broaden rollout from docs alone.

