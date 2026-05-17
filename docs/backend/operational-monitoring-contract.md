# Operational Monitoring Contract

## Purpose
- Define the minimum operational signals needed to run the backend safely in shared environments.
- Turn existing admin/read APIs into an explicit monitoring contract for support, QA, and release checks.

## Monitoring Layers

### 1. Process liveness
- `GET /api/health/live`
- Current contract:
  - returns `200` when the NestJS HTTP process is booted and reachable
  - does not probe PostgreSQL or Redis
  - intended for hosting-platform health checks
  - body:

```json
{
  "status": "ok",
  "service": "store-ops-backend"
}
```

- Operational meaning:
  - app process is booted
  - Nest HTTP surface is reachable

### 2. Dependency readiness
- `GET /api/health`
- Current contract:
  - returns `200` when app and required dependencies are healthy
  - returns `503` when a required dependency probe fails
  - body:

```json
{
  "status": "ok",
  "service": "store-ops-backend",
  "timestamp": "2026-04-18T08:00:00.000Z",
  "queueBackend": "bullmq",
  "observability": {
    "status": "ok",
    "errorTracking": {
      "dsnConfigured": false,
      "environment": "production",
      "externalDelivery": "not-enabled",
      "mode": "log-only"
    },
    "logLevel": "info",
    "readinessProfile": "controlled-pilot"
  },
  "checks": {
    "database": {
      "status": "ok",
      "latencyMs": 4
    },
    "redis": {
      "status": "ok",
      "latencyMs": 2
    }
  }
}
```

- Operational meaning:
  - app process is booted
  - Nest HTTP surface is reachable
  - PostgreSQL probe passed
  - Redis probe passed when `QUEUE_BACKEND=bullmq`

- Notes:
  - when `QUEUE_BACKEND` is not `bullmq`, Redis check is returned as `skipped`

### 3. Queue-backed command acceptance
- Import and snapshot command endpoints must return command envelopes with `job` metadata.
- Required command surfaces:
  - `POST /api/integrations/import-batches`
  - `POST /api/snapshots/runs`
  - `POST /api/integrations/import-batches/:batchId/retry`
  - `POST /api/snapshots/runs/:snapshotRunId/rerun`

- Required command envelope fields:
  - `command.status`
  - `command.message`
  - `job.jobType`
  - `job.backend`
  - `job.jobId`
  - `job.queueName`

- Operational meaning:
  - request was accepted or reused
  - async backend can be correlated to queue activity

### 4. Import monitoring surface
- Core endpoints:
  - `GET /api/integrations/import-batches/summary`
  - `GET /api/integrations/import-batches/overview`
  - `GET /api/integrations/import-batches/needs-action`
  - `GET /api/integrations/import-batches/:batchId`
  - `GET /api/integrations/import-batches/:batchId/errors`
  - `GET /api/integrations/import-batches/:batchId/audit`

- Expected operator signals:
  - `totals`
  - `healthTotals`
  - `actionTotals`
  - `latest`
  - batch-level `healthState`
  - batch-level `actionReason`
  - batch-level `recommendedAction`
  - batch-level `blockedByEntityTypes`
  - batch-level `recommendedNextEntityType`
  - batch-level `canRetryNow`

- Health semantics:
  - `healthy`
  - `in_progress`
  - `blocked`
  - `retry_ready`
  - `needs_action`
  - `stuck`

### 5. Snapshot monitoring surface
- Core endpoints:
  - `GET /api/snapshots/runs/summary`
  - `GET /api/snapshots/runs/overview`
  - `GET /api/snapshots/runs/needs-action`
  - `GET /api/snapshots/runs/:snapshotRunId`
  - `GET /api/snapshots/runs/:snapshotRunId/dependencies`
  - `GET /api/snapshots/runs/:snapshotRunId/lineage`
  - `GET /api/snapshots/runs/:snapshotRunId/audit`

- Expected operator signals:
  - `totals`
  - `healthTotals`
  - `actionTotals`
  - `latest`
  - snapshot-level `healthState`
  - snapshot-level `failureReason`
  - snapshot-level `rerunAllowed`
  - snapshot-level `rerunBlockedReason`
  - lineage parent/children visibility

- Health semantics:
  - `healthy`
  - `in_progress`
  - `retry_ready`
  - `needs_action`
  - `stuck`

## Alerting Interpretation

## Alert Routing V1

Provider status: metadata-only until an approved alerting provider, alert destination, and secret storage path are configured outside source control.

Smoke command:

```powershell
cd "<workspace-root>"
npm.cmd run smoke:alert-routing
```

Optional deployed signal input:

```powershell
$env:ALERT_SMOKE_ENVIRONMENT="staging"
$env:ALERT_SMOKE_BACKEND_URL="https://api-staging.hr-axis.com/api"
npm.cmd run smoke:alert-routing
```

Owner roles:

- Incident lead
- Release operator
- Backend owner
- Frontend owner
- Data owner
- Business approver

Required alert routes:

| Alert id | Trigger signal | Severity | Owner role | First response | Guarded evidence |
| --- | --- | --- | --- | --- | --- |
| `backend-health-down` | `GET /api/health` fails, returns `503`, or database check is `error`. | P0 | Backend owner + Release operator | Run `npm.cmd run smoke:deployed-readiness`, inspect Render logs by `x-correlation-id`, and decide rollback/forward-fix. | Health JSON, deployed readiness output, Render deploy id, correlation id. |
| `backend-5xx-spike` | Structured `http.exception` or `http.request.completed` events show repeated `5xx` for protected routes. | P0/P1 | Backend owner | Group by `path` and `correlationId`; confirm whether auth, DB, queue, or code path is failing. | Structured logs with redacted error message, path, status code, correlation id. |
| `auth-session-failure-spike` | `/api/auth/session` fails, returns empty role/scope, or auth smoke fails. | P0 | Backend owner + Business approver | Run `npm.cmd run smoke:auth:staging:action` and `npm.cmd run guard:auth:evidence`; do not broaden IdP access while unexplained. | Sanitized auth smoke evidence, assigned/unassigned store action result. |
| `import-failure-spike` | Import batch `healthTotals.stuck`, `blocked`, or persistent `retryReady` becomes non-zero in a real feed. | P1/P0 if data damage risk exists | Data owner | Pause import/materialization jobs; review batch evidence and dominant quality issue before retrying. | Batch id, source id, entity type, failed row count, dominant quality issue code. |
| `snapshot-worker-failure` | Snapshot run `healthTotals.stuck`, repeated retry-ready state, or worker logs show failed snapshot execution. | P1 | Data owner + Backend owner | Pause dependent reporting decisions, review snapshot lineage, and rerun only after dependency cause is known. | Snapshot run id, parent run id, failure reason, queue backend, correlation id. |
| `database-latency-high` | `/api/health` database latency exceeds target for repeated checks or DB check fails. | P1/P0 if app unavailable | Backend owner | Check DB provider health, pool pressure, migrations, and recent query-heavy changes. | Health latency samples, DB provider status, release SHA, migration status. |
| `frontend-unreachable` | Frontend root, SPA fallback, or static asset checks fail. | P0/P1 | Frontend owner + Release operator | Run `npm.cmd run smoke:deployed-readiness`; verify Vercel deployment, rewrites, and asset content types. | Frontend URL, Vercel deployment URL, failed asset URL, deployed smoke output. |
| `observability-degraded` | `/api/health` reports `observability.status=degraded` or broad-production profile lacks `ERROR_TRACKING_DSN`. | P1 before rollout, P0 if broad production is already live | Incident lead + Backend owner | Keep rollout at Conditional Go/No-Go until provider decision or accepted risk is recorded. | Health observability block, env inventory note, approval/Conditional Go record. |

Alert routing smoke must pass before staging or production sign-off unless a written Conditional Go names the owner, missing provider capability, and due date.

### Import alerts
- Page or escalate when:
  - `healthTotals.stuck > 0`
  - `healthTotals.blocked > 0` for production feeds
  - `healthTotals.retryReady > 0` remains non-zero after retry window

### Snapshot alerts
- Page or escalate when:
  - `healthTotals.stuck > 0`
  - `healthTotals.retryReady > 0` after expected snapshot window
  - rerun is blocked while a reporting consumer is waiting on recovery

### Audit and forensics
- Use audit endpoints to answer:
  - who triggered the operation
  - when the operation transitioned
  - which entity was affected
  - what metadata was attached to the action

## Correlation Rules
- Every admin write should continue to emit audit events.
- Every HTTP response should return `x-correlation-id`.
- Inbound `x-correlation-id` is accepted only when it matches the safe request id allowlist:
  - first character: `A-Z`, `a-z`, or `0-9`
  - remaining characters: `A-Z`, `a-z`, `0-9`, `.`, `_`, `:`, or `-`
  - maximum length: 128 characters
- Empty, whitespace-only, overlong, or unsafe inbound correlation ids are replaced with a generated UUID before the value is echoed to the response.
- Client-side operational tooling should persist:
  - endpoint called
  - `x-correlation-id`
  - actor user id
  - `job.jobId`
  - `job.queueName`
  - returned domain id such as `batchId` or `snapshotRunId`

This is the minimum correlation set for incident triage.

## Request Log Contract
- Every completed HTTP request emits one JSON log with:
  - `event: "http.request.completed"`
  - `correlationId`
  - `method`
  - `path`
  - `statusCode`
  - `durationMs`
  - `actorUserId`
- `actorUserId` is captured from request context after auth resolution, so protected admin writes can be tied back to the user who triggered them.
- Audit metadata reads the same request context correlation id, keeping audit events and HTTP completion logs joinable during incident review.

## Runtime Verification Contract
- A deployment is considered operationally ready only if all of the following are true:
  - `npm run check:release` succeeds
  - `GET /api/health/live` returns `200`
  - `GET /api/health` returns `200`
  - `npm run smoke:store-me` succeeds for a scoped `STORE_PERSONNEL` identity
  - live PostgreSQL and Redis are reachable
  - `npm run test:live` succeeds against real infra
  - at least one snapshot run reaches `completed`
  - at least one import batch reaches `completed` or `completed_with_errors`

## Current Gaps
- No external metrics sink or alert transport is wired in this repo yet.
- Some older service logs still use direct `Logger` calls instead of the shared structured log helper.

## Recommended Next Hardening
1. Convert remaining direct service logs to the shared structured log helper when touching those modules.
2. Add an external metrics sink or alert transport for health, import, and snapshot signals.
3. Extend release smoke evidence with captured correlation ids for the key admin write flows.

## Implemented Smoke Command
- A release smoke command now exists:
  - `npm run smoke:release`
- A store personnel self-performance smoke command now exists:
  - `npm run smoke:store-me`
- Default assumptions:
  - base URL: `http://localhost:3000/api`
  - smoke user: seeded admin user `80000000-0000-0000-0000-000000000001`
- Store-me smoke defaults:
  - base URL: `http://localhost:3000/api`
  - mock employee claim: `DEMO-EMP-202`
  - expected internal employee id: `00000000-0000-0000-0000-000000000202`
  - expected store scope: `00000000-0000-0000-0000-000000000100`
- Optional overrides:
  - `SMOKE_BASE_URL`
  - `SMOKE_USER_ID`
  - `STORE_ME_SMOKE_TOKEN` or `SMOKE_AUTH_TOKEN`
  - `REHEARSAL_COMPOSE_PROJECT_NAME`

## Implemented Release Rehearsal Gate
- A release check command now exists:
  - `npm run check:release`
- It runs, in order:
  - lint
  - full Jest test suite with `--runInBand`
  - backend build
  - production dependency audit via `npm audit --omit=dev`
- `npm run rehearse:release` runs this release check before starting the Docker-backed rehearsal, generic release smoke, and store-me smoke flow.
- The rehearsal Docker Compose project defaults to `store-ops-live-rehearsal` so it does not collide with local Keycloak or other infra compose stacks.
- CI binding:
  - `.github/workflows/release-rehearsal.yml` runs `npm run rehearse:release`
  - PRs touching backend, database, infra, or the workflow file run the gate automatically
  - pushes to `main` or `master` touching those paths also run the gate
  - CI sets `REHEARSAL_COMPOSE_PROJECT_NAME=store-ops-ci-release-rehearsal`
