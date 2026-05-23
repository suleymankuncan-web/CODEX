# Store Action Test Hygiene And Visibility V1

Date: 2026-05-23

## Decision

Split Store Action plan lifecycle coverage out of the broad Store Tasks surface
spec and record where Store Action is visible today.

This is a test/evidence slice only. It does not change product code, API
response shape, auth behavior, DB schema, CSS, workflow semantics, KPI scoring,
or user-facing behavior.

## Sokrates Decision

Claim:

- Store Action V1B is implemented, but its E2E coverage was still concentrated
  inside the oversized `store-surfaces.spec.ts` file. Splitting the plan
  lifecycle tests into a dedicated spec improves reviewability without changing
  behavior.

Assumptions:

- The moved tests can keep the same names and assertions.
- Local Playwright coverage is sufficient for this hygiene step.
- Fresh live persona evidence needs a real secure Clerk/staging session or
  bearer token and must not be faked.

Repo evidence:

- `/store/tasks` enables workflow inbox for `STORE_MANAGER`, `SUPER_ADMIN`, and
  `REPORT_VIEWER`.
- `/store/tasks` enables persisted Store Action plans and command controls only
  for `STORE_MANAGER` and `SUPER_ADMIN`.
- `GET /api/workflow/inbox` is protected by `STORE_MANAGER`, `SUPER_ADMIN`, and
  `REPORT_VIEWER`.
- `/api/store-actions/plans` endpoints are protected by `STORE_MANAGER` and
  `SUPER_ADMIN`.
- KPI follow-up create controls are shown only when an existing
  `kpi_exception` workflow inbox item can be mapped to an action candidate.
- Persisted action plans are read from `/api/store-actions/plans`; an empty
  list shows the empty state instead of inventing a plan.

Counterargument:

- A test split does not prove fresh production behavior by itself. It must be
  paired with local E2E and, when secure inputs exist, staging persona evidence.

Risk:

- LOW for the test split and docs.
- HIGH if local mock evidence is presented as real Clerk/persona proof.

Door:

- Two-way door. The spec split can be reverted or reshaped without runtime
  impact.

Stop rule:

- Stop if the split requires product code changes, auth changes, API changes,
  or broad fixture rewrites.
- Stop if live evidence would require printing raw tokens, cookies, passwords,
  auth codes, provider subjects, or private user data.

Verification ladder:

1. Dedicated Store Action Playwright spec.
2. Remaining Store Tasks tests in `store-surfaces.spec.ts`.
3. File-size guard.
4. Public staging readiness smoke that does not require secrets.
5. Protected staging persona evidence only when a secure session/token exists.

## Test Hygiene Result

Moved 13 Store Action plan tests to
`admin-web/e2e/store-action-plans.spec.ts`:

- workflow inbox action-plan rendering,
- persisted action-plan list,
- active status update and local failure,
- close with resolution note and local failure,
- cancel with reason and local failure,
- create from KPI follow-up candidate and local failure,
- pagination,
- unsafe source-link guard,
- stale-page recovery.

Line-count result, measured by Node line splitting:

- `origin/main` `admin-web/e2e/store-surfaces.spec.ts`: `5088` lines.
- Current `admin-web/e2e/store-surfaces.spec.ts`: `4412` lines.
- New `admin-web/e2e/store-action-plans.spec.ts`: `778` lines.
- Broad spec reduction: `676` lines.

## Store Action Visibility Conditions

User-facing route:

- `/store/tasks`.

Visible to:

- `STORE_MANAGER`: workflow inbox, persisted action plans, create/status/close/
  cancel controls within assigned action-store scope.
- `SUPER_ADMIN`: workflow inbox, persisted action plans, create/status/close/
  cancel controls for support/admin scope.
- `REPORT_VIEWER`: workflow inbox read visibility, but no persisted Store
  Action command controls from this page gate.

Data conditions:

- A KPI follow-up candidate appears when `GET /api/workflow/inbox` returns a
  `kpi_exception` item.
- A persisted action plan appears when `GET /api/store-actions/plans` returns
  one or more plans.
- If there are no persisted plans, the Store Action plan panel shows the empty
  state (`No persisted action plans` / Turkish equivalent).

Action buttons:

- `Create action plan` is tied to a KPI follow-up candidate.
- `Update status`, `Close plan`, and `Cancel plan` are tied to an active
  persisted action plan.
- Terminal plans hide terminal actions according to the existing UI behavior.

Why a user may not see Store Action:

- The user is not `STORE_MANAGER` or `SUPER_ADMIN`.
- The user has no assigned store/action scope for the relevant store.
- The workflow inbox has no `kpi_exception` item.
- `/api/store-actions/plans` returns an empty list.
- The user is on another store route; the current V1B day-to-day surface is
  `/store/tasks`.

## Verification Results

Local gates:

```powershell
npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts --grep "store tasks"
node --test scripts/file-size-guard.test.mjs
git diff --check
```

Results:

- Store Action spec: `13/13` passed.
- Remaining Store Tasks tests: `5/5` passed.
- File-size guard: `3/3` passed.
- `git diff --check`: passed with only the existing Windows LF/CRLF warning.

Public staging smoke, no secret token:

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

- Deployed readiness: `ok`, `13/14` passed, `1` skipped.
- Backend health live: HTTP `200`.
- Backend dependency health: HTTP `200`.
- Queue backend: `bullmq`, durable Redis-backed dispatch.
- Database health: `ok`.
- Redis health: `ok`.
- Readiness profile: `controlled-pilot`.
- Alert routing: `ok`, `4/5` passed, `1` skipped.
- Alert provider delivery remains `not-configured`.
- Backend readiness load: `blocked` because protected token groups were
  skipped; public health group passed with `100%` availability, p50 `92.94ms`,
  p95 `138.3ms`, and `0` 5xx.

## Protected Evidence Status

No secure local environment variables for a fresh protected persona run were
present in this shell:

- `READINESS_BEARER_TOKEN`
- `BACKEND_LOAD_*TOKEN`
- `PROTECTED_PERF_*TOKEN`
- `CLERK*`
- `AUTH*`
- `SMOKE*`
- `STAGING*`

Therefore this note does not claim fresh real Clerk/persona proof for
`/store/tasks`. It records local E2E behavior and public staging health only.

## Next Decision

Store Action V1B's basic loop remains complete. Future Store Action work still
requires a separate go/no-go decision for:

- detail route,
- comments,
- attachments,
- notifications,
- escalation,
- non-KPI source families,
- AI coaching copy,
- fresh live persona evidence.
