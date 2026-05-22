# Production Evidence Blockers V2 - 2026-05-22

## Scope

This note updates the production readiness evidence after the live Clerk persona
proof landed in `docs/evidence/system-flow/clerk-persona-live-evidence-2026-05-22.md`.

It addresses the five remaining production-evidence items requested for this
slice:

1. Redis / durable queue posture.
2. Supabase restore drill.
3. Authenticated upload smoke.
4. Alert delivery.
5. Readiness decision update.

It does not change business logic, API response shape, auth behavior, provider
configuration, database schema, CSS, or user-facing workflow semantics.

## Sokrates Decision

Claim:

- The remaining broad-production blocker is not local code structure; it is
  missing live provider evidence and accepted environment posture.

Assumptions:

- `https://staging.hr-axis.com` and `https://api-staging.hr-axis.com/api` are
  the active staging surfaces.
- The existing Clerk pilot persona evidence is valid for controlled pilot auth
  proof. The later live proof pass also closes current pilot upload/readback
  evidence with `SUPER_ADMIN`; dedicated `INTEGRATION_ADMIN` separation is not
  required for this pilot.
- Broad production requires stronger evidence than controlled pilot.

Repo/live evidence:

- Staging public health and deployed readiness are reachable.
- Health reports process-local queue and skipped Redis checks.
- Alert routing smoke passes docs/backend-health checks but skips provider
  delivery because no provider metadata was supplied.
- Backend readiness load passes public API health but skips protected route
  groups because no role-specific load tokens were supplied in this session.
- No Supabase restore target/input, Redis provider input, or alert provider
  input exists in the local environment.
- Authenticated safe upload evidence exists in
  `docs/evidence/readiness/2026-05-22-live-evidence-proof-pass.md`.

Counterargument:

- Redis/BullMQ, alert providers, role-delegation smokes, and restore drills could be
  "implemented" or configured now. That would be theater without the approved
  provider credentials, disposable target, scoped auth decision, and operator
  acceptance required by the readiness checklist.

Risk:

- Docs-only evidence update: LOW.
- Treating process-local queue, log-only observability, missing restore, or
  unverified future role delegation as production-ready: HIGH.

Door:

- This evidence note is a two-way door.
- Provider configuration, Redis/BullMQ enablement, Supabase restore, and upload
  smoke against staging are near one-way operational actions and need real
  inputs plus explicit evidence.

Stop rule used:

- Stop before inventing provider delivery, Redis health, restore proof, upload
  success, or protected route budget evidence.
- Stop before touching production databases or recording raw secrets/tokens.

Verification ladder:

1. Presence-only input check for required live inputs.
2. Public staging health/deployed readiness smoke.
3. Alert routing smoke.
4. Backend readiness load smoke with no tokens, expecting protected groups to
   stay blocked rather than falsely passing.
5. Contract tests and `git diff --check`.

## Input Availability

Checked in the local process environment on 2026-05-22. Only presence was
recorded; no secret values were printed.

| Input family | Required for | Local state | Decision |
| --- | --- | --- | --- |
| `REDIS_URL`, `QUEUE_BACKEND`, `RATE_LIMIT_BACKEND`, `BULLMQ_REDIS_URL` | Redis-backed rate limit and BullMQ queue health proof | absent | Cannot close broad-production Redis/queue evidence. |
| `DATABASE_URL`, `RESTORE_DATABASE_URL`, Supabase access/project/password inputs | Supabase restore drill into a disposable target | absent | Cannot run restore drill. |
| `ALERT_PROVIDER_NAME`, `ALERT_PRIMARY_DESTINATION`, `ALERT_BACKUP_DESTINATION`, alert webhook/provider input | External alert delivery proof | absent | Alert routing stays metadata/log-only. |
| `UPLOAD_SMOKE_FILE`, `UPLOAD_SMOKE_BEARER_TOKEN` or integration-admin bearer token | Authenticated Power BI upload smoke | absent in this shell, later proven with a real `SUPER_ADMIN` Clerk browser session | Upload smoke is closed for the current controlled pilot; dedicated `INTEGRATION_ADMIN` proof is no longer a pilot blocker. |
| `BACKEND_LOAD_STORE_TOKEN`, `BACKEND_LOAD_IMPORT_TOKEN`, `READINESS_BEARER_TOKEN` | Role-specific protected route load smoke | absent in this shell | Protected route load budgets remain blocked in this run. |

## Live Checks Run

### Public Backend Health

Command shape:

```powershell
curl.exe -sS -i -H "Accept: application/json" --max-time 45 https://api-staging.hr-axis.com/api/health
curl.exe -sS -i -H "Accept: application/json" --max-time 45 https://api-staging.hr-axis.com/api/health/live
```

Result:

- `/api/health`: HTTP `200`.
- `/api/health/live`: HTTP `200`.
- `status`: `ok`.
- database: `ok`.
- queue backend: `in-memory`.
- queue status: `process-local`.
- Redis check: `skipped`.
- observability: `ok`, `log-only`, external delivery `not-enabled`.
- rate-limit headers were present.

Decision:

- Go for continued controlled staging hardening.
- No-Go for broad-production durable queue/Redis posture.

### Alert Routing Smoke

Command:

```powershell
$env:ALERT_SMOKE_ENVIRONMENT="staging"
$env:ALERT_SMOKE_BACKEND_URL="https://api-staging.hr-axis.com/api"
$env:ALERT_SMOKE_TIMEOUT_MS="45000"
npm.cmd run smoke:alert-routing
```

Result:

- status: `ok`.
- total checks: `5`.
- passed: `4`.
- failed: `0`.
- skipped: `1`.
- skipped check: alert provider metadata.
- provider delivery: `not-configured`.
- backend health alert signal: passed with HTTP `200`.

Decision:

- Alert matrix, incident path, checklist gate, and live backend health signal:
  Go.
- External alert delivery: No-Go for broad production until provider
  destination/delivery proof exists, or an explicit accepted log-retention
  decision is recorded.

### Backend Readiness Load Smoke

Command:

```powershell
$env:NODE_OPTIONS="--dns-result-order=ipv4first"
$env:BACKEND_LOAD_OUTPUT="json"
$env:BACKEND_LOAD_ENVIRONMENT="staging"
$env:BACKEND_LOAD_API_BASE_URL="https://api-staging.hr-axis.com/api"
$env:BACKEND_LOAD_ITERATIONS="3"
$env:BACKEND_LOAD_CONCURRENCY="2"
$env:BACKEND_LOAD_TIMEOUT_MS="45000"
npm.cmd run smoke:backend-readiness-load
```

Result:

- status: `blocked`.
- public API health: passed.
- public samples: `6`.
- public availability: `100%`.
- public p50: `79.79ms`.
- public p95: `205.59ms`.
- public 5xx count: `0`.
- protected groups skipped: authenticated session, store read routes,
  competition read routes, import read routes.
- reason: no role-specific bearer tokens in this shell.

Decision:

- Public staging API health budget: Go.
- Protected route performance budget: not proven in this run.
- This does not invalidate the Clerk persona/token evidence from 2026-05-22;
  it means the separate role-specific load budget still needs fresh tokens.

### Deployed Readiness Smoke

Command:

```powershell
$env:READINESS_ENVIRONMENT="staging"
$env:READINESS_FRONTEND_URL="https://staging.hr-axis.com"
$env:READINESS_BACKEND_URL="https://api-staging.hr-axis.com/api"
$env:READINESS_TIMEOUT_MS="45000"
npm.cmd run smoke:deployed-readiness
```

Result:

- status: `ok`.
- total checks: `14`.
- passed: `13`.
- failed: `0`.
- skipped: `1`.
- skipped check: backend auth session because `READINESS_BEARER_TOKEN` was not
  supplied in this shell.
- backend health again reported `queueBackend=in-memory`,
  `queue.status=process-local`, Redis `skipped`, and observability `log-only`.

Decision:

- Public deploy surface: Go.
- Auth/session deployed readiness with token is already evidenced by the
  separate live Clerk persona note.
- This run does not close broad-production Redis, alert delivery, restore, or
  upload evidence.

## Five Blocker Decisions

### 1. Redis / Durable Queue Posture

Current evidence:

- Staging is healthy but explicitly process-local:
  `queueBackend=in-memory`, `queue.status=process-local`.
- Redis check is skipped because neither BullMQ queue nor Redis rate limiting is
  enabled in the active staging health response.
- Existing config/contracts fail closed for `READINESS_PROFILE=broad-production`
  unless Redis-backed rate limit and BullMQ queue posture are configured.

Decision:

- Controlled pilot: Conditional Go with written risk acceptance.
- Broad production: No-Go until staging or production-like environment shows
  Redis-backed rate limiting and durable BullMQ queue health, or the owner
  explicitly narrows the rollout so durable background work is not required.

Next exact input:

- Approved Redis provider/config for the target environment.
- `RATE_LIMIT_BACKEND=redis` and `QUEUE_BACKEND=bullmq` when broad-production
  readiness is being claimed.
- `/api/health` evidence showing Redis `ok` and queue `status=durable`.

### 2. Supabase Restore Drill

Current evidence:

- Local disposable PostgreSQL restore mechanics were previously proven.
- Supabase staging restore has not run.
- No disposable Supabase/staging restore target, restore database URL, or
  operator-approved managed restore target exists in this shell.

Decision:

- Controlled pilot: Conditional Go only because local restore mechanics exist
  and no production database is touched.
- Broad production: No-Go until Supabase staging restore evidence exists from
  an approved disposable target.

Next exact input:

- Approved disposable restore target.
- Backup/recovery point timestamp and accepted RPO/RTO.
- Sanitized schema/table count, migration tracking count, and smoke query
  result after restore.

### 3. Authenticated Upload Smoke

Current evidence:

- Upload resource guardrails and backend tests exist.
- This V2 run did not have upload inputs in the shell.
- The follow-up live evidence pass proved a safe staging upload with the
  existing `SUPER_ADMIN` pilot session.
- The product decision in
  `docs/plans/import-upload-authorization-decision-v1.md` says a dedicated
  `INTEGRATION_ADMIN` persona is not required for the current controlled pilot.
- `HR_ADMIN` import/upload delegation is not claimed by this note because the
  current repo guards still require `INTEGRATION_ADMIN` while `SUPER_ADMIN`
  satisfies the guard through the existing role bypass.

Decision:

- Upload guardrails: Go.
- Authenticated staging upload smoke for the current controlled pilot: Go.
- Dedicated `INTEGRATION_ADMIN` persona proof: not a current pilot blocker.
- Any future `HR_ADMIN` delegation: separate scoped auth/permission PR with
  regression tests.

Next exact input:

- No input is needed to continue the current controlled pilot on this point.
- If ownership later shifts away from `SUPER_ADMIN`, define the exact operator
  role and run a new sanitized upload/readback smoke after the auth change.

### 4. Alert Delivery

Current evidence:

- Alert routing docs, incident path, production checklist gate, and backend
  health signal pass.
- Provider delivery is `not-configured` and alert provider metadata was skipped.
- Observability remains `log-only`.

Decision:

- Alert routing/readiness metadata: Go.
- Broad-production alert delivery: No-Go until provider delivery is tested or
  an explicit accepted log-retention decision with owner is recorded.

Next exact input:

- Approved alert provider/destination metadata.
- Delivery proof through the provider console/API or written log-retention
  acceptance with owner/date.
- Sanitized evidence without webhook secrets, provider tokens, bearer tokens, or
  private payloads.

### 5. Readiness Decision Update

Updated decision:

- Local code and release gates: Go.
- Clerk controlled-pilot persona/token/action evidence: Go for the existing
  scoped pilot personas.
- Controlled staging/internal hardening: Conditional Go.
- Controlled pilot expansion: Conditional Go only for already scoped pilot
  users and flows with sanitized evidence; current import/upload evidence is
  accepted through the existing `SUPER_ADMIN` pilot session.
- Broad production rollout: No-Go.

Why broad production is still No-Go:

- Redis/BullMQ health is not proven.
- Supabase staging restore is not proven.
- External alert delivery is not proven.
- Role-specific protected route load budgets were not proven in this run.

## Safety

- No raw bearer token, Clerk cookie, provider subject, database URL, Redis URL,
  Supabase token, webhook secret, password, or private key is recorded here.
- No production database was touched.
- No restore, upload, provider delivery, Redis enablement, DB migration, or auth
  configuration change was attempted.
