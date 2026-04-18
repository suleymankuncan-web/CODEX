# Operational Monitoring Contract

## Purpose
- Define the minimum operational signals needed to run the backend safely in shared environments.
- Turn existing admin/read APIs into an explicit monitoring contract for support, QA, and release checks.

## Monitoring Layers

### 1. Process liveness
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

### 2. Queue-backed command acceptance
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

### 3. Import monitoring surface
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

### 4. Snapshot monitoring surface
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
- Client-side operational tooling should persist:
  - endpoint called
  - `x-correlation-id`
  - actor user id
  - `job.jobId`
  - `job.queueName`
  - returned domain id such as `batchId` or `snapshotRunId`

This is the minimum correlation set for incident triage.

## Runtime Verification Contract
- A deployment is considered operationally ready only if all of the following are true:
  - `GET /api/health` returns `200`
  - live PostgreSQL and Redis are reachable
  - `npm run test:live` succeeds against real infra
  - at least one snapshot run reaches `completed`
  - at least one import batch reaches `completed` or `completed_with_errors`

## Current Gaps
- `GET /api/health` is still a shallow liveness endpoint rather than a deep dependency health check.
- Structured logs and request correlation ids are not yet formalized as a documented runtime contract.
- No external metrics sink or alert transport is wired in this repo yet.

## Recommended Next Hardening
1. Expand `/api/health` with dependency probes for PostgreSQL and Redis.
2. Add structured log fields for `correlationId`, `actorUserId`, `jobId`, `batchId`, and `snapshotRunId`.
3. Add a lightweight release smoke script that calls `health`, then `summary/overview` surfaces.

## Implemented Smoke Command
- A release smoke command now exists:
  - `npm run smoke:release`
- Default assumptions:
  - base URL: `http://localhost:3000/api`
  - smoke user: seeded admin user `80000000-0000-0000-0000-000000000001`
- Optional overrides:
  - `SMOKE_BASE_URL`
  - `SMOKE_USER_ID`
