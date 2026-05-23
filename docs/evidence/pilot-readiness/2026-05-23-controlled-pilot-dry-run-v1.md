# Controlled Pilot Dry Run V1 Evidence - 2026-05-23

## Scope

This evidence records the controlled-pilot rehearsal requested after the active
persona evidence matrix was closed.

It does not approve broad production, add a new product module, redesign the UI,
change auth behavior, change API shapes, change DB schema, change provider
configuration, or mutate staging data.

## Plan Reference

- `docs/plans/controlled-pilot-dry-run-v1.md`

## Sokrates Decision

Claim:

- The current project should prove pilot reliability through staged smokes,
  local gates, and evidence reconciliation before opening new feature depth.

Assumption:

- Existing 2026-05-23 protected persona evidence remains valid for controlled
  pilot unless a later deploy/config change invalidates it.

Evidence:

- Public staging readiness, alert routing, and backend load smokes were
  refreshed on 2026-05-23.
- Local script, frontend, API-contract, Store Action, pilot stabilization, and
  backend targeted gates passed.
- A protected Clerk persona dry run was executed with the active six
  controlled-pilot roles. Raw tokens, cookies, auth codes, provider subjects,
  and private IDs were not recorded here.

Counterargument:

- This pass can only be trusted if skipped token checks are recorded as skipped
  and not counted as protected evidence.

Risk:

- LOW/MEDIUM. This pass is smoke/evidence focused. Secret-bearing checks remain
  blocked unless secure local inputs exist.

Door:

- Two-way-door. Evidence can be refreshed after the next deploy or role/scope
  change.

Stop rule:

- Do not record raw bearer tokens, cookies, passwords, auth codes, provider
  subjects, full JWTs, private IDs, database URLs, Redis URLs, or private
  personal data.

## Execution Results

### Public Staging Smokes

Commands:

```powershell
$env:READINESS_FRONTEND_URL='https://staging.hr-axis.com'
$env:READINESS_BACKEND_URL='https://api-staging.hr-axis.com/api'
$env:READINESS_ENVIRONMENT='staging'
$env:READINESS_TIMEOUT_MS='45000'
npm.cmd run smoke:deployed-readiness

$env:ALERT_ROUTING_API_BASE_URL='https://api-staging.hr-axis.com/api'
$env:ALERT_ROUTING_ENVIRONMENT='staging'
$env:ALERT_ROUTING_TIMEOUT_MS='45000'
npm.cmd run smoke:alert-routing

$env:BACKEND_LOAD_API_BASE_URL='https://api-staging.hr-axis.com/api'
$env:BACKEND_LOAD_ENVIRONMENT='staging'
$env:BACKEND_LOAD_ITERATIONS='3'
$env:BACKEND_LOAD_CONCURRENCY='2'
$env:BACKEND_LOAD_TIMEOUT_MS='45000'
npm.cmd run smoke:backend-readiness-load
```

Results:

| Check | Result | Notes |
| --- | --- | --- |
| Deployed readiness, tokenless | `ok`, `13/14` passed, `0` failed, `1` skipped | Auth/session was skipped because no `READINESS_BEARER_TOKEN` was provided in this tokenless pass. Backend live/dependency health, frontend root, security headers, SPA fallback, static assets, database, Redis, and BullMQ durable queue checks passed. Readiness profile was `controlled-pilot`. |
| Alert routing, tokenless | `ok`, `4/5` passed, `0` failed, `1` skipped | Backend health alert signal, database signal, and observability signal passed. Provider delivery metadata was not configured in this command and was not counted as fresh provider-delivery proof. |
| Backend readiness load, tokenless | `blocked` overall by missing protected tokens | Public health group passed at 100% availability with p50 `78.83ms`, p95 `266.32ms`, and `0` 5xx. Authenticated session, store read, competition read, and import read groups were skipped. |

### Local Pilot Gates

Commands:

```powershell
npm.cmd run test:scripts
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts
npm.cmd run check:pilot-stabilization
npm.cmd --prefix admin-web run api:check
npm.cmd --prefix backend\nestjs test -- store-action-plan workflow-inbox.service --runInBand
```

Results:

| Gate | Result | Notes |
| --- | --- | --- |
| Root script tests | Passed, `309/309` | Contract and repository hygiene scripts remained green. |
| Admin lint | Passed | No new lint issues. |
| Admin build | Passed | Existing large chunk watchlist remains visible; no build failure. |
| Store Action Playwright | Passed, `13/13` | Store Action plan list/create/status/close/cancel coverage remained green. |
| Pilot stabilization | Passed | Contract tests `14/14`; admin pilot smoke Playwright `7/7`. |
| Generated API check | Passed | OpenAPI/generated frontend client state remained current. |
| Backend targeted tests | Passed, `7` suites, `39` tests | Store Action plan and workflow inbox targeted tests remained green. |

### Protected Persona Evidence

A protected staging dry run was executed on 2026-05-23 with real Clerk
test-mode sessions for the active controlled-pilot role set:

- `SUPER_ADMIN`
- `HR_ADMIN`
- `REGION_MANAGER`
- `STORE_MANAGER`
- `STORE_PERSONNEL`
- `REPORT_VIEWER`

The run used the Clerk email-code path and kept tokens/cookies in process memory
only. This document records only sanitized role/scope outcomes.

Route/session summary:

| Role | First route | Backend session | Scope summary | Allowed sample | Denied sample |
| --- | --- | --- | --- | --- | --- |
| `SUPER_ADMIN` | `/admin/integrations` | `200`, role `SUPER_ADMIN` | company `1`, region `0`, store `0`, assigned stores `0` | `/admin/integrations`, `/admin/auth` | Not sampled as denied in this run. |
| `HR_ADMIN` | `/admin/competitions` | `200`, role `HR_ADMIN` | company `1`, region `0`, store `0`, assigned stores `0` | `/admin/competitions`, `/admin/master-data`, `/admin/checklists` | `/admin/auth`, `/admin/integrations`, `/admin/reports` |
| `REGION_MANAGER` | `/store/home` | `200`, role `REGION_MANAGER` | company `1`, region `1`, store `0`, assigned stores `1` | `/admin/targets`, `/admin/competitions`, `/store/rankings` | `/admin/auth`, `/admin/master-data`, `/admin/integrations` |
| `STORE_MANAGER` | `/store/home` | `200`, role `STORE_MANAGER` | company `1`, region `1`, store `1`, assigned stores `1` | `/store`, `/store/me`, `/store/tasks`, `/store/approvals`, `/store/kpis`, `/store/rankings` | `/admin/auth` |
| `STORE_PERSONNEL` | `/store/me` | `200`, role `STORE_PERSONNEL` | company `1`, region `1`, store `1`, assigned stores `1` | `/store/me`, `/store/rankings` | `/admin/auth`, `/admin/targets`, `/store/approvals` |
| `REPORT_VIEWER` | `/admin/reports` | `200`, role `REPORT_VIEWER` | company `1`, region `0`, store `0`, assigned stores `0` | `/admin/reports`, `/admin/targets`, `/admin/inbox`, `/store/tasks` | `/admin/auth`, `/admin/master-data`, `/admin/integrations` |

Auth-admin negative checks:

- `HR_ADMIN`, `REGION_MANAGER`, `STORE_MANAGER`, `STORE_PERSONNEL`, and
  `REPORT_VIEWER` received `403` from the sampled auth-admin read endpoint.
- The same non-super roles received `403` from the sampled auth-admin write
  endpoint.
- `REPORT_VIEWER` `/store/tasks` remained read-only in the browser sample; Store
  Action command controls were absent.

Protected readiness/load checks:

| Check | Result | Notes |
| --- | --- | --- |
| Deployed readiness with a real role token | `ok`, `14/14` passed | Backend auth session check returned authenticated `STORE_MANAGER`. Private IDs from the raw response were intentionally not recorded. |
| Backend protected load | `ok`, `5/5` groups passed | Public health, authenticated session, store read, competition read, and import read groups passed with `0` 5xx. Public health p50/p95: `55.06ms`/`73.15ms`; authenticated session: `212.26ms`/`225.5ms`; store read: `222.88ms`/`553.71ms`; competition read: `218.67ms`/`227.8ms`; import read: `220.54ms`/`226.64ms`. |

Known evidence caveat:

- A multi-context logout storage cleanup check in the combined script was
  inconclusive and is not counted as proof. Use the dedicated auth/session edge
  evidence path for logout cleanup decisions.

### Store Action Dry Run

Store Action remained suitable for controlled-pilot read/write-loop rehearsal:

- Existing local Store Action Playwright coverage passed `13/13`.
- Existing backend targeted Store Action/workflow tests passed.
- `STORE_MANAGER` assigned-store read scope was exercised against
  `GET /target-distributions/store-personnel` and returned `200`.
- The same sampled endpoint returned `403` for an out-of-scope store.
- No staging DB write was required for this evidence note.
- `REPORT_VIEWER` Store Tasks visibility remained read-only with command
  controls absent.

### Data Freshness And Operations Signals

Signals refreshed in this pass:

- Backend live and dependency health passed.
- Database health passed.
- Redis health passed.
- Queue backend reported `bullmq`, durable queue status, and
  `redisRequired=true`.
- Backend protected load covered public health, authenticated session, store
  read, competition read, and import read groups with `0` 5xx.
- Alert-routing smoke passed app-level health signals; provider delivery was
  not re-proven by this command.
- Readiness profile remained `controlled-pilot`.

### Bug Hunt

Project-wide low-risk pilot blocker scan was run across Store Action, Store
Tasks, auth/session, generated client/API-contract usage, workflow inbox,
workforce, reports, imports, operations, navigation, security hygiene, and
mobile-obvious-breakage keywords.

Result:

- No low-risk product bug was found that justified code change in this slice.
- Matches were expected script logs, test fixtures, docs references, or existing
  auth/session implementation points.
- `javascript:alert(1)` appeared only in the Store Action Playwright fixture
  that proves unsafe external links are not surfaced.

## Decision

Controlled internal pilot: `Conditional Go / Continue`.

Broad production: `No-Go`.

Rationale:

- The active role matrix now has fresh protected staging proof in this dry run.
- Local pilot, Store Action, generated API, and backend targeted gates passed.
- Public staging and protected backend load checks passed within the controlled
  pilot profile.
- Remaining broad-production decisions are still external/owner posture items:
  production-grade Redis tier/profile, explicit alert policy beyond the current
  controlled-pilot route, app-level error tracking policy if required, and
  managed restore/PITR posture if the rollout target requires it.

## Verification

Commands run:

```powershell
npm.cmd run smoke:deployed-readiness
npm.cmd run smoke:alert-routing
npm.cmd run smoke:backend-readiness-load
npm.cmd run test:scripts
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts
npm.cmd run check:pilot-stabilization
npm.cmd --prefix admin-web run api:check
npm.cmd --prefix backend\nestjs test -- store-action-plan workflow-inbox.service --runInBand
```

Final docs-only verification for this branch:

- `git diff --check`: passed.
- `npm.cmd run test:scripts`: passed, `309/309`.

## Sanitization

- Raw bearer tokens included: no.
- Clerk cookies included: no.
- Passwords/auth codes included: no.
- Full provider subjects included: no.
- Full JWT payloads included: no.
- Private user, employee, provider, store, database, Redis, or webhook secrets
  included: no.
