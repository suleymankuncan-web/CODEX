# Controlled Pilot Execution Preflight V1 - 2026-05-23

## Reader And Action

Reader:

- the pilot moderator, support engineer, QA operator, product owner, or future
  agent deciding whether the next controlled pilot rehearsal can move from
  planning into a real persona-led session.

After reading, they should be able to:

- see which autonomous preflight gates were refreshed,
- distinguish public/local proof from protected proof,
- know the next step and the exact remaining blocker.

## Scope

Mode:

- autonomous local/public preflight

Environment:

- frontend staging: `https://staging.hr-axis.com`
- backend staging API: `https://api-staging.hr-axis.com/api`
- repo head at run start: `5eac2853`

This pass does not approve broad production, add a module, add a role, change
UI, change API responses, change auth behavior, change DB schema, change
provider configuration, mutate staging data, or claim fresh protected persona
proof where no secure role-specific token/session input was available.

## Sokrates Decision

Claim:

- The next useful autonomous step after the execution roadmap is to refresh the
  local/public preflight gates and keep the real protected persona rehearsal as
  an explicit assisted step.

Assumptions:

- Controlled pilot remains `Conditional Go / Continue`.
- Broad production remains `No-Go`.
- No scoped Store Action command rehearsal is being claimed in this pass.
- Tokenless public checks can prove reachability and public health, but cannot
  prove protected role/session behavior.

Evidence:

- Local pilot stabilization passed.
- Public deployed readiness passed with backend auth/session skipped.
- Public alert-routing health signal passed with provider metadata skipped.
- Backend readiness load passed the public health group and skipped protected
  groups because no role-specific tokens were provided.

Counterargument:

- This is not a real persona rehearsal. Correct: it is only the autonomous
  preflight that makes the next assisted persona session cleaner.

Risk:

- LOW for local/public preflight and docs-only evidence.
- MEDIUM for the next real browser/session rehearsal.
- HIGH for command-mode staging mutation, direct provider configuration, DB
  restore changes, or raw token handling.

Door:

- two-way-door. This evidence can be rerun after any deploy or before a
  moderated session.

Stop rule:

- Do not record raw tokens, Clerk cookies, passwords, auth codes, full JWTs,
  provider subjects, private IDs, database URLs, Redis URLs, webhook URLs, or
  private personal data.

## Decision

Controlled pilot execution preflight: `Continue to assisted persona rehearsal`.

Broad production: `No-Go`.

Reasoning:

- Local pilot contract/build/browser gates are green.
- Public staging health is reachable.
- Backend health reports database `ok`, Redis `ok`, BullMQ durable queue, and
  readiness profile `controlled-pilot`.
- Alert-routing health signal is reachable.
- Public backend load is inside budget.
- Protected session/load groups were not executed because no secure
  role-specific token/session input was present in this shell.

## Local Gate Results

### Pilot Stabilization

Command:

```powershell
npm.cmd run check:pilot-stabilization
```

Result:

- script contract checks: `14/14` passed
- admin build: passed
- pilot Playwright checks: `7/7` passed

Covered:

- pilot release checklist contract,
- pilot route-role matrix contract,
- ranking demo/live boundary contract,
- pilot stabilization release gate contract,
- admin pilot smoke build and browser checks.

## Public Staging Results

### Deployed Readiness Smoke

Command:

```powershell
$env:READINESS_FRONTEND_URL='https://staging.hr-axis.com'
$env:READINESS_BACKEND_URL='https://api-staging.hr-axis.com/api'
$env:READINESS_ENVIRONMENT='staging'
$env:READINESS_TIMEOUT_MS='45000'
npm.cmd run smoke:deployed-readiness
```

Result:

- status: `ok`
- evidence time: `2026-05-23T13:47:03.891Z`
- total checks: `14`
- passed: `13`
- failed: `0`
- skipped: `1`
- skipped reason: `READINESS_BEARER_TOKEN` was not provided, so backend
  auth/session was not executed in this tokenless pass.
- backend live health: `200`, `ok`
- backend dependency health: `200`, `ok`
- queue backend: `bullmq`
- queue status: `durable`
- Redis required: `true`
- database status: `ok`
- Redis status: `ok`
- readiness profile: `controlled-pilot`
- backend release reported by health observability: `63e0292e`
- frontend root, security headers, SPA fallback, and sampled static assets:
  passed

### Alert Routing Smoke

Command:

```powershell
$env:ALERT_SMOKE_BACKEND_URL='https://api-staging.hr-axis.com/api'
$env:ALERT_SMOKE_ENVIRONMENT='staging'
$env:ALERT_ROUTING_TIMEOUT_MS='45000'
npm.cmd run smoke:alert-routing
```

Result:

- status: `ok`
- evidence time: `2026-05-23T13:47:01.490Z`
- total checks: `5`
- passed: `4`
- failed: `0`
- skipped: `1`
- backend health alert signal: `200`, health `ok`, database `ok`,
  observability `ok`
- alert provider metadata: skipped because no provider metadata was provided
- provider delivery: `not-configured`

### Backend Readiness Load

Command:

```powershell
$env:BACKEND_LOAD_API_BASE_URL='https://api-staging.hr-axis.com/api'
$env:BACKEND_LOAD_ENVIRONMENT='staging'
$env:BACKEND_LOAD_ITERATIONS='3'
$env:BACKEND_LOAD_CONCURRENCY='2'
$env:BACKEND_LOAD_TIMEOUT_MS='45000'
npm.cmd run smoke:backend-readiness-load
```

Result:

- status: `blocked` by missing role-specific protected tokens
- evidence time: `2026-05-23T13:47:01.727Z`
- public API health group: passed
- public availability: `100%`
- public p50: `132.89ms`
- public p95: `184.95ms`
- public 5xx count: `0`
- authenticated session: skipped because no role-specific bearer token was
  provided
- store read routes: skipped because no role-specific bearer token was provided
- competition read routes: skipped because no role-specific bearer token was
  provided
- import read routes: skipped because no role-specific bearer token was provided
- mutation routes remained excluded:
  - `POST /integrations/power-bi-export-upload`
  - `POST /integrations/import-batches`
  - `POST /snapshots/runs`

## Protected Persona Status

Fresh protected persona proof was not rerun in this preflight.

Why:

- this shell had no safe role-specific bearer/session tokens for
  `READINESS_BEARER_TOKEN`, `BACKEND_LOAD_SESSION_TOKEN`,
  `BACKEND_LOAD_STORE_TOKEN`, `BACKEND_LOAD_COMPETITION_TOKEN`,
  `BACKEND_LOAD_HR_ADMIN_TOKEN`, or `BACKEND_LOAD_IMPORT_TOKEN`.

How to close:

- run the moderated persona rehearsal with real Clerk sessions for
  `SUPER_ADMIN`, `HR_ADMIN`, `REGION_MANAGER`, `STORE_MANAGER`,
  `STORE_PERSONNEL`, and `REPORT_VIEWER`;
- record only sanitized role, route, HTTP status, allowed/forbidden result, and
  command-control presence/absence;
- do not record raw tokens, cookies, passwords, auth codes, JWT payloads,
  provider subject IDs, private IDs, or screenshots containing private data.

## Next Action

Proceed to assisted protected persona rehearsal when the user is ready to drive
or provide secure sessions.

Default next mode:

- read-only persona rehearsal.

Command-mode Store Action proof remains out of scope until a named staging
record, expected result, and rollback note are explicitly approved.
