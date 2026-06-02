# Redis / BullMQ Controlled Pilot Runbook V1

Status: active
Shelf: readiness
Scope: controlled staging/internal pilot only
Broad production: No-Go on non-persistent Free-tier Redis

## Reader And Action

Reader:

- an operator, future agent, engineer, or pilot moderator investigating a stuck
  import, snapshot, worker job, or queue-related pilot symptom.

After reading, they should be able to classify the symptom, check worker and
queue health in the right order, avoid changing application code before the
runtime cause is known, and record sanitized evidence.

## Purpose

Make Redis / BullMQ troubleshooting repeatable for the controlled pilot.

This runbook exists because the project has already seen the key failure mode:
the API was writing jobs into BullMQ, but there was no running Render worker
process consuming them. That was fixed by PR #534 and PR #536, and the
confirming worker log signal was `job.execution.completed`. A later observed
failure was source-data validation, not queue infrastructure:
`employee reference could not be resolved`.

## Non-Goals

- Do not change BullMQ retry behavior.
- Do not change worker boot behavior.
- Do not change import, snapshot, materialization, scoring, or workflow
  lifecycle semantics.
- Do not change Redis provider, provider tier, or provider settings.
- Do not buy or require paid infrastructure.
- Do not record Redis URLs, provider credentials, private payloads, bearer
  tokens, Clerk cookies, database URLs, or webhook secrets.
- Do not claim broad-production durable queue readiness from Free-tier Redis.

## Evidence Baseline

Use these sources before making runtime conclusions:

- `current-state.md`
- `docs/evidence/readiness/2026-05-22-redis-bullmq-staging-proof.md`
- `docs/evidence/readiness/2026-05-23-redis-production-posture-v1.md`
- `docs/evidence/readiness/2026-06-02-free-tier-controlled-pilot-ops-pr1-inventory.md`

Current decision:

- Controlled pilot: Free-tier Redis / BullMQ is accepted with rerunnable-job
  posture and visible operator checks.
- Broad production: No-Go until a persistent Redis-compatible tier or explicit
  written risk acceptance exists.

## Triage Order

Run these checks in order. Do not skip directly to code changes.

### 1. Classify The Symptom

Record the first visible symptom:

- import batch remains pending,
- snapshot or materialization appears stuck,
- worker job is failed,
- API is healthy but no async progress occurs,
- job completes but rows fail validation,
- queue backend unexpectedly appears process-local or skipped.

If the symptom is only "data did not appear", first identify the affected batch,
snapshot, job, or admin evidence surface. Do not assume a queue fault.

### 2. Check Public Backend Health

Use public staging health only; no token is required.

```powershell
curl.exe -sS -H "Accept: application/json" --max-time 45 https://api-staging.hr-axis.com/api/health/live
curl.exe -sS -H "Accept: application/json" --max-time 45 https://api-staging.hr-axis.com/api/health
```

Expected controlled-pilot queue signals:

- `/api/health/live` returns HTTP `200` and status `ok`.
- `/api/health` returns HTTP `200` and status `ok`.
- `queueBackend=bullmq`.
- queue `status=durable`.
- Redis check `status=ok`.
- readiness profile remains controlled-pilot unless a scoped release gate says
  otherwise.

Stop and pause pilot queue work if public health is unavailable or Redis is not
`ok`.

### 3. Check Render Worker Service

In Render, inspect the `hr-axis-worker` Background Worker service.

Expected:

- service exists,
- latest deploy is live,
- service is not crash-looping,
- command shape is still `node dist/src/workers.js`,
- worker logs are advancing during queued job activity.

Do not record private Render service URLs, internal Redis URLs, environment
variables, or provider identifiers.

### 4. Check Worker Logs

Look for sanitized log signals only.

Healthy signal:

- `job.execution.completed`

Infrastructure-risk signals:

- worker boot crash,
- module dependency resolution error,
- BullMQ connection error,
- Redis connection error,
- repeated job lock/stall symptoms without completion logs.

Source-data signals:

- unresolved employee reference,
- unresolved store reference,
- invalid batch row shape,
- source mapping or personnel/master-data mismatch.

If logs show source-data validation failure after a job executes, do not treat
the queue as broken.

### 5. Check Redis / BullMQ Health

Use `/api/health` as the first sanitized queue evidence source.

Controlled pilot can continue when:

- Redis status is `ok`,
- queue backend is `bullmq`,
- queue status is `durable`,
- worker service is running,
- failures are either completed jobs with validation errors or rerunnable pilot
  jobs.

Pause pilot queue work when:

- Redis is degraded or skipped unexpectedly,
- queue backend is in-memory unexpectedly,
- worker is not running,
- the same job remains stuck without worker logs,
- changing provider tier/settings would be required.

### 6. Check Import Batch Or Snapshot State

Only after runtime health and worker logs are checked, inspect the relevant
application evidence:

- admin import batch status,
- snapshot/materialization status,
- data-quality queue,
- source row validation details,
- relevant admin read surface.

If a batch or snapshot reports source-data failure, route the issue to data
source cleanup instead of queue infrastructure.

### 7. Check Source Data Last

Inspect source data only after the worker and queue path are proven healthy.

Examples:

- employee identifier does not match current personnel mapping,
- store code cannot be resolved,
- batch row points to a missing assignment,
- imported row is outside the current source contract.

Do not mutate production-like source data as part of this runbook. Record the
source issue and use the proper data-quality workflow.

## Go / Pause Decision

Continue controlled pilot queue work when:

- public backend health is ok,
- `queueBackend=bullmq`,
- Redis status is ok,
- worker service is running,
- worker logs show execution or a clear source-data failure,
- the affected job can be rerun safely under pilot rules.

Pause controlled pilot queue work when:

- worker service is crash-looping,
- Redis is degraded, skipped, or unreachable,
- queue backend is unexpectedly in-memory,
- jobs stay pending without worker log movement,
- provider tier/settings must change,
- data repair or queue draining would be required.

Broad production remains No-Go on Free-tier Redis regardless of a passing pilot
health sample.

## Rerun And Retry Rules

- Do not rerun a batch blindly before identifying whether the previous attempt
  executed, failed validation, or never reached the worker.
- Do not drain queues as a first response in controlled pilot.
- Do not change retry/backoff behavior in the same PR as a runbook or evidence
  update.
- Treat Free-tier Redis job loss as a controlled-pilot rerun event, not as
  broad-production durable queue proof.
- If rerun requires idempotency, row-hash, source mapping, or snapshot lineage
  confirmation, stop and record that prerequisite first.

## Sanitized Evidence Template

Use this shape when recording proof:

```text
Date/time:
Environment:
Symptom:
Affected entity:
Public health:
Worker service:
Worker log signal:
Redis status:
Queue backend/status:
Import/snapshot status:
Source-data status:
Decision:
Next operator action:
Secrets recorded: none
Behavior changed: no
```

Acceptable values should be summarized. Do not paste raw provider URLs,
private log payloads, user tokens, database connection strings, Redis URLs, or
person-identifying source rows.

## Rollback

This runbook is docs-only.

Rollback is a docs revert. No migration, data repair, queue drain, provider
rollback, import retry change, or runtime rollback is required.

## Verification

For changes to this runbook:

```powershell
git diff --check
npm.cmd run test:scripts
```

Optional public staging check when network access is available:

```powershell
curl.exe -sS -H "Accept: application/json" --max-time 45 https://api-staging.hr-axis.com/api/health
```

Do not require provider dashboard access for a docs-only PR. If provider access
is unavailable, record it as unavailable instead of inventing evidence.
