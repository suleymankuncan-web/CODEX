# Store Action Visibility Readiness

Date: 2026-05-23

Environment:

- Frontend staging: `https://staging.hr-axis.com`
- Backend staging API: `https://api-staging.hr-axis.com/api`
- Local verification workspace: `D:\store-ops-workspace`

## Purpose

Record the Store Action visibility and readiness status after the V1B Store
Tasks loop was completed.

This note does not claim fresh real Clerk/persona proof because no secure
role-specific session or bearer token was available in the local shell.

## Covered Store Action Behaviors

Local E2E coverage now proves the `/store/tasks` Store Action loop for:

- persisted action-plan list,
- create from existing KPI follow-up candidate,
- active status update,
- close with resolution note,
- cancel with reason,
- workflow inbox action-plan item,
- assigned-store scoped fixtures,
- empty persisted-plan state,
- unsafe source-link hiding,
- stale-page recovery.

Detailed evidence:

- `docs/evidence/store-action-test-hygiene-and-visibility-v1.md`

## Public Staging Smoke

Commands:

```powershell
$env:READINESS_FRONTEND_URL='https://staging.hr-axis.com'
$env:READINESS_BACKEND_URL='https://api-staging.hr-axis.com/api'
$env:READINESS_ENVIRONMENT='staging'
$env:READINESS_TIMEOUT_MS='45000'
npm.cmd run smoke:deployed-readiness

$env:ALERT_SMOKE_BACKEND_URL='https://api-staging.hr-axis.com/api'
$env:ALERT_SMOKE_ENVIRONMENT='staging'
npm.cmd run smoke:alert-routing

$env:BACKEND_LOAD_API_BASE_URL='https://api-staging.hr-axis.com/api'
$env:BACKEND_LOAD_ENVIRONMENT='staging'
$env:BACKEND_LOAD_ITERATIONS='3'
$env:BACKEND_LOAD_CONCURRENCY='2'
$env:BACKEND_LOAD_TIMEOUT_MS='45000'
npm.cmd run smoke:backend-readiness-load
```

Results:

- Deployed readiness: `ok`, `13/14` passed, auth/session skipped because no
  `READINESS_BEARER_TOKEN` was provided.
- Backend live health: HTTP `200`.
- Backend dependency health: HTTP `200`.
- Database health: `ok`.
- Redis health: `ok`.
- Queue backend: `bullmq`, durable.
- Alert routing: `ok`, `4/5` passed, provider delivery skipped because no
  approved provider delivery metadata was configured for this smoke.
- Backend readiness load: `blocked`, not failed. Public health passed with
  `100%` availability, p50 `92.94ms`, p95 `138.3ms`, and `0` 5xx; protected
  groups were skipped because no role-specific token was provided.

## Decision

Controlled pilot readiness for the local Store Action UI loop: `Continue`.

Broad production readiness: unchanged, still not approved by this note.

## Blockers

Fresh live Store Action persona evidence still needs one of:

- a secure signed-in Clerk staging browser session that can mint a token without
  recording secrets, or
- sanitized role-specific bearer tokens passed only through environment
  variables for the smoke commands.

Do not record raw bearer tokens, Clerk cookies, passwords, auth codes, PKCE
verifiers, provider subjects, private user data, database URLs, Redis URLs, or
webhook secrets.
