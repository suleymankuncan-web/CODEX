# Controlled Pilot Round 2 Stabilization Evidence

Date: 2026-05-22

Environment:

- Frontend staging: `https://staging.hr-axis.com`
- Backend staging API: `https://api-staging.hr-axis.com/api`
- Local verification workspace: `D:\store-ops-workspace`

## Purpose

Record the next controlled-pilot operating drill after the PR #409 through
PR #412 evidence and handoff updates.

This note proves local pilot gate stability and public staging/deploy health.
It does not claim a fresh real-token persona rerun in this turn because no
role-specific bearer token environment variables were available.

## Sokrates Decision

Decision: continue the same controlled staging/internal pilot scope.

Why:

- the local pilot release gate remains green,
- the staging public deploy and backend health checks are reachable,
- backend public health load stayed within the existing smoke budget,
- no new route/API blocker appeared in this drill.

Counterargument:

- this drill did not rerun real protected route load groups with role-specific
  bearer tokens,
- this drill did not prove external alert provider delivery,
- this drill did not prove Redis/BullMQ or Supabase restore posture.

Risk: `LOW` for current controlled-pilot continuation, `HIGH` if someone tries
to use this note as broad-production approval.

Door: two-way for continuing the same pilot scope; near one-way for widening
roles, stores, imports, production infrastructure, or provider configuration.

## Verification Commands

```powershell
npm.cmd run check:pilot-stabilization

$env:READINESS_FRONTEND_URL='https://staging.hr-axis.com'
$env:READINESS_BACKEND_URL='https://api-staging.hr-axis.com/api'
$env:READINESS_ENVIRONMENT='staging'
$env:READINESS_TIMEOUT_MS='45000'
npm.cmd run smoke:deployed-readiness

$env:BACKEND_LOAD_API_BASE_URL='https://api-staging.hr-axis.com/api'
$env:BACKEND_LOAD_ENVIRONMENT='staging'
$env:BACKEND_LOAD_ITERATIONS='3'
$env:BACKEND_LOAD_CONCURRENCY='2'
$env:BACKEND_LOAD_TIMEOUT_MS='45000'
npm.cmd run smoke:backend-readiness-load

$env:ALERT_SMOKE_BACKEND_URL='https://api-staging.hr-axis.com/api'
$env:ALERT_SMOKE_ENVIRONMENT='staging'
npm.cmd run smoke:alert-routing
```

## Results

### Local Pilot Stabilization

Command:

```powershell
npm.cmd run check:pilot-stabilization
```

Result:

- contract tests: `14/14` passed,
- admin production build: passed,
- pilot Playwright smoke: `7/7` passed,
- covered specs:
  - `pilot-smoke.spec.ts`,
  - `pilot-api-contracts.spec.ts`.

This proves the checked admin/store pilot routes still open in the local pilot
smoke harness without unavailable states and the known optional API contract
fallbacks remain covered.

### Deployed Readiness

Command:

```powershell
npm.cmd run smoke:deployed-readiness
```

Result:

- status: `ok`,
- total checks: `14`,
- passed: `13`,
- failed: `0`,
- skipped: `1`,
- skipped check: `backend auth session`, because `READINESS_BEARER_TOKEN` was
  not provided,
- backend health live: HTTP `200`,
- backend health dependencies: HTTP `200`,
- database health: `ok`,
- queue backend: `in-memory`,
- queue status: `process-local`,
- Redis health: `skipped`,
- observability mode: `log-only`,
- frontend root, SPA fallback, static assets, security headers, rate-limit
  headers, and correlation headers passed.

### Backend Readiness Load

Command:

```powershell
npm.cmd run smoke:backend-readiness-load
```

Result:

- status: `blocked`,
- public API health group: passed,
- public API health availability: `100%`,
- public API health p50: `128.89ms`,
- public API health p95: `222.99ms`,
- public API health 5xx count: `0`,
- authenticated session group: skipped,
- store read routes group: skipped,
- competition read routes group: skipped,
- import read routes group: skipped.

The skipped protected groups are correct for this drill because no
role-specific bearer tokens were present. They must not be counted as pass.

### Alert Routing

Command:

```powershell
npm.cmd run smoke:alert-routing
```

Result:

- status: `ok`,
- total checks: `5`,
- passed: `4`,
- failed: `0`,
- skipped: `1`,
- backend health alert signal: passed with HTTP `200`,
- backend health status: `ok`,
- database status: `ok`,
- observability status: `ok`,
- skipped check: external alert provider metadata/delivery, because no approved
  provider destination was configured for this drill.

## Decision

Controlled pilot round 2 technical stabilization: `Continue`.

This supports continuing the same controlled staging/internal pilot scope for
the already scoped pilot users and routes.

Broad production rollout remains `No-Go`.

## What This Does Not Prove

- It does not prove a fresh real Clerk persona login in this turn.
- It does not prove protected route load budgets for role-specific staging
  sessions.
- It does not prove external alert provider delivery.
- It does not prove Supabase restore into an approved disposable target.
- It does not prove Redis/BullMQ broad-production durability.
- It does not approve new roles, new pilot users, wider store scope, or
  production rollout.

## Next Operating Action

Use this as a round-2 technical stabilization checkpoint.

Next work should be one of:

- collect the next real pilot user feedback session in the feedback log,
- run role-specific protected backend load when fresh bearer tokens are
  intentionally provided,
- keep the 2026-05-22 `PILOT-005` route/link cleanup monitored during store
  personnel feedback,
- keep broad-production evidence parked until Supabase restore, Redis/BullMQ,
  and alert provider inputs exist.

## Evidence Safety

No raw bearer tokens, Clerk cookies, passwords, authorization codes, PKCE
verifiers, provider secrets, database URLs, Redis URLs, webhook secrets, or
private user data are recorded in this note.
