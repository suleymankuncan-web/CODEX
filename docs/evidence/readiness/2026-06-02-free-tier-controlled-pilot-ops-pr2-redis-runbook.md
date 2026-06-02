# Free-Tier Controlled Pilot Ops PR-2 Redis Runbook - 2026-06-02

## Scope

This note records PR-2 of
`docs/plans/free-tier-controlled-pilot-ops-posture-v1.md`.

The PR adds a repeatable Redis / BullMQ controlled-pilot troubleshooting
runbook and links it from the runbook registry and parent plan.

No product code, API response shape, auth/permission semantics, database
schema, provider tier, queue behavior, worker boot behavior, import lifecycle,
snapshot interpretation, scoring, approval workflow, or UI behavior changed.

No secrets, provider URLs, raw tokens, webhooks, database URLs, Redis URLs, or
private payloads are recorded.

## Decision

Controlled pilot:

- Free-tier Redis / BullMQ remains accepted only for the controlled pilot.
- Pending or stuck import/snapshot symptoms now have an ordered operator path:
  backend health, Render worker service, worker logs, Redis/BullMQ health,
  application batch/snapshot state, then source-data validation.
- Source-data validation failures remain data-quality work, not queue
  infrastructure work.

Broad production:

- Remains `No-Go` on non-persistent Free-tier Redis.
- Persistent Redis-compatible tier or explicit written risk acceptance remains
  parked production work.

## Files Changed

- `docs/plans/redis-bullmq-controlled-pilot-runbook-v1.md`
- `docs/plans/free-tier-controlled-pilot-ops-posture-v1.md`
- `docs/plans/runbook-registry-v1.md`
- `docs/evidence/readiness/2026-06-02-free-tier-controlled-pilot-ops-pr2-redis-runbook.md`

## Risk Reduced

- Operators and future agents have one deterministic order for queue symptoms.
- The runbook prevents changing API/import code before checking worker and
  Redis/BullMQ runtime evidence.
- The project keeps the controlled-pilot Free-tier acceptance separate from
  broad-production durable queue readiness.

## Rollback

Revert the docs-only changes. No migration, data repair, queue drain, provider
rollback, runtime rollback, or worker restart is required.

## Verification

Run locally for this PR:

```powershell
git diff --check # pass
npm.cmd run test:scripts # pass, 405/405
```

Public staging checks:

```powershell
curl.exe -sS -H "Accept: application/json" --max-time 45 https://api-staging.hr-axis.com/api/health # pass
npm.cmd run smoke:deployed-readiness # pass, 13/14 passed, 1 auth-session check skipped because no bearer token was provided
```

Sanitized health result:

- Evidence time: `2026-06-02T09:20:43.629Z`.
- `/api/health`: status `ok`.
- service: `hr-axis-staging-api`.
- queue backend: `bullmq`.
- queue durable: `true`.
- queue status: `durable`.
- Redis check: `ok`.
- readiness profile: `controlled-pilot`.

Sanitized deployed readiness result:

- Evidence time: `2026-06-02T09:21:11.581Z`.
- environment: `staging`.
- status: `ok`.
- total checks: `14`.
- passed: `13`.
- failed: `0`.
- skipped: `1`.
- skipped check: backend auth session because no `READINESS_BEARER_TOKEN` was
  provided.
- Backend dependency health inside the smoke also reported
  `queueBackend=bullmq`, queue `status=durable`, and Redis `status=ok`.

## Stop Rules Preserved

- Do not buy or require paid infrastructure.
- Do not change provider tier or production config.
- Do not run production restore.
- Do not request or record secrets.
- Do not change API, DB, auth, queue, worker boot, import, scoring, snapshot,
  workflow, or UI behavior.
- Do not claim broad-production readiness.
