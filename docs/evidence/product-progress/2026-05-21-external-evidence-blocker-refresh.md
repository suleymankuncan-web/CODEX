# External Evidence Blocker Refresh

Date: 2026-05-21

## Purpose

Refresh the external/live evidence blocker list before continuing local growth
foundation work. This is a presence-only check. It does not print secret values,
run provider commands, restore databases, upload files, or call live protected
routes.

## Sokrates Decision

Claim:

- The current workspace still cannot close external/live readiness evidence.

Assumptions:

- A missing environment variable means the workspace does not have the approved
  input needed to run that evidence path safely.
- Local mocks cannot prove live auth/session, provider alerting, restore, queue,
  or upload readiness.

Repo evidence:

- The production readiness decision, project progress plan, and technical debt
  roadmap all classify these items as external/provider-input blockers.

Counterargument:

- Some commands could be run without inputs and would skip protected parts. That
  would be useful as a public smoke, but it would not close the protected/live
  evidence gap.

Risk:

- LOW to record the blocker.
- HIGH to force the evidence without approved inputs.

Door:

- The blocker note is a two-way door.
- Restore, provider config, authenticated upload, and protected action smoke are
  near one-way-door operational actions.

Stop rule:

- Stop before any command that needs a raw token, cookie, JWT, provider secret,
  database credential, Redis URL, upload file, or approved disposable restore
  target.

## Presence-Only Result

| Input | Present | Unlocks |
| --- | --- | --- |
| `READINESS_FRONTEND_URL` | no | Deployed frontend smoke target. |
| `READINESS_BACKEND_URL` | no | Deployed backend smoke target. |
| `READINESS_BEARER_TOKEN` | no | Real `/api/auth/session` and protected route smoke. |
| `ACTION_SMOKE_ASSIGNED_STORE_ID` | no | Positive assigned-store action proof. |
| `ACTION_SMOKE_UNASSIGNED_STORE_ID` | no | Negative unassigned-store action proof. |
| `SUPABASE_RESTORE_TARGET_PROJECT_REF` | no | Managed restore drill target. |
| `SUPABASE_ACCESS_TOKEN` | no | Supabase provider restore/API proof. |
| `ALERT_PROVIDER_DESTINATION` | no | External alert delivery proof. |
| `REDIS_URL` | no | Redis-backed rate-limit or shared Redis health proof. |
| `BULLMQ_REDIS_URL` | no | BullMQ durable queue health proof. |
| `UPLOAD_SMOKE_FILE` | no | Authenticated integration upload smoke. |
| `INTEGRATION_ADMIN_BEARER_TOKEN` | no | Integration-admin upload authorization proof. |

## Decision

- Do not run external/live evidence commands in this PR.
- Keep broad production readiness parked.
- Continue only with local docs-only/inventory/spec work.

## Verification

- Presence-only environment check was run.
- No secret values were printed.
- No provider, DB restore, upload, Redis/BullMQ, alert delivery, or protected
  live auth command was executed.
