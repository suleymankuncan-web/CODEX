# External Evidence Input Check

## Purpose

Record the Phase 2 input check for Project Progress Plan V1. This note does
not run live provider commands and does not print secret values. It records only
whether the required local environment inputs exist.

## Sokrates Decision

Claim:

- External/live evidence cannot be produced from this workspace right now.

Assumptions:

- Real readiness proof requires real staging/provider inputs, not local mocks.
- It is safer to park this phase than to invent evidence or run destructive
  provider actions against an unknown target.

Evidence:

- The following environment names were checked by presence only and were absent:
  `READINESS_FRONTEND_URL`, `READINESS_BACKEND_URL`,
  `READINESS_BEARER_TOKEN`, `ACTION_SMOKE_ASSIGNED_STORE_ID`,
  `ACTION_SMOKE_UNASSIGNED_STORE_ID`, `SUPABASE_RESTORE_TARGET_PROJECT_REF`,
  `SUPABASE_ACCESS_TOKEN`, `ALERT_PROVIDER_DESTINATION`, `REDIS_URL`,
  `BULLMQ_REDIS_URL`, `UPLOAD_SMOKE_FILE`, and
  `INTEGRATION_ADMIN_BEARER_TOKEN`.
- `docs/plans/project-progress-plan-v1.md` explicitly says to record blockers
  and continue local-only product slices when these inputs are unavailable.

Counterargument:

- Some evidence could be partially simulated locally. That would not satisfy the
  production-readiness claim and would create false confidence.

Risk:

- HIGH if forced without approved inputs because auth/session, restore,
  alerting, queue durability, and upload smoke touch live/provider boundaries.
- LOW to record the blocker.

Door:

- The blocker note is a two-way door.
- The underlying external actions are near one-way-door and require explicit
  approved targets/tokens.

Decision:

- Do not run external/live evidence commands in this slice.
- Continue with local-only admin/operator coherence work until the user provides
  the required staging/provider inputs.

## Blocked Inputs

- Real staging frontend/backend URLs.
- Real staging bearer token for auth/session smoke.
- Assigned and unassigned store identifiers for action-scope smoke.
- Approved disposable Supabase restore target and provider token.
- Alert/error tracking/log-retention provider destination.
- Redis/BullMQ provider configuration for broad-production queue posture.
- Integration-admin bearer token and safe upload sample file.

## Verification

- Presence-only environment check was run without printing secret values.
- No provider command, DB restore, upload smoke, or live auth smoke was executed.
