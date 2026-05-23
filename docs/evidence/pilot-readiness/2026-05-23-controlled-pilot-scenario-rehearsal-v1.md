# Controlled Pilot Scenario Rehearsal Evidence - 2026-05-23

## Reader And Action

Reader:

- the pilot moderator, support engineer, QA operator, product owner, or future
  agent deciding whether the controlled pilot can move from planning into a
  coordinated rehearsal session.

After reading, they should be able to:

- see which rehearsal gates were actually run,
- distinguish fresh proof from skipped protected proof,
- decide the next safe step for a real persona-led rehearsal.

## Scope

This evidence converts Controlled Pilot Scenario Rehearsal V1 from a runbook
into the first rehearsal evidence pass.

Mode:

- `read-only rehearsal`

Environment:

- frontend staging: `https://staging.hr-axis.com`
- backend staging API: `https://api-staging.hr-axis.com/api`
- repo head at run start: `2a3083db`

This pass does not approve broad production, add a module, add a role, change
UI, change API responses, change auth behavior, change DB schema, change
provider configuration, mutate staging data, or claim fresh protected persona
proof where no secure token/session input was available.

## Sokrates Decision

Claim:

- The runbook can be turned into useful evidence by running the local/public
  rehearsal gates now, while recording protected persona steps as blocked when
  this shell has no safe role-specific tokens.

Assumptions:

- The existing six-persona protected evidence from the same day remains useful
  context, but this evidence file must not pretend it was rerun unless a secure
  token/session actually exists in this pass.
- A docs-only evidence slice should not retry command-mode Store Action writes
  against staging without a named record and rollback note.

Evidence:

- Public staging readiness, alert routing, and public backend load were run.
- Local pilot stabilization, Store Action Playwright, backend Store Action and
  workflow tests, admin lint, and generated API check were run.
- No role-specific bearer token variables were present in this shell.

Counterargument:

- Without a fresh protected browser/session run, this is not a complete live
  persona rehearsal. That is true; the decision below keeps the protected
  persona phase blocked for this pass.

Risk:

- LOW for local/docs/public-read evidence.
- MEDIUM for future protected persona browser runs.
- HIGH for command-mode rehearsal or staging data mutation without a rollback
  note.

Door:

- Two-way-door. This evidence can be refreshed when role-specific tokens or a
  live moderated session are available.

Stop rule:

- Do not record raw tokens, Clerk cookies, passwords, auth codes, full JWTs,
  provider subjects, private IDs, database URLs, Redis URLs, webhook URLs, or
  private personal data.

## Decision

Controlled pilot rehearsal readiness: `Conditional Go / Continue`.

Broad production: `No-Go`.

Reasoning:

- Local and public gates support a read-only rehearsal.
- Store Action local lifecycle and backend contract coverage remain green.
- Staging health, database, Redis, BullMQ durable queue, frontend shell, static
  assets, and alert-routing health signal are reachable.
- Protected persona phases were not freshly rerun in this pass because no
  secure token/session input was present. A real moderated persona rehearsal
  should run next when those inputs are available.

## Preflight Results

### Public Staging Readiness

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
- evidence time: `2026-05-23T13:18:31.773Z`
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
- frontend root, security headers, SPA fallback, and sampled static assets:
  passed
- backend release reported by health observability: `63e0292e`

### Alert Routing

First attempt note:

- An initial tokenless run used the wrong backend URL environment variable and
  skipped backend health alert signal. It was not counted as final evidence.

Final command:

```powershell
$env:ALERT_SMOKE_BACKEND_URL='https://api-staging.hr-axis.com/api'
$env:ALERT_SMOKE_ENVIRONMENT='staging'
$env:ALERT_ROUTING_TIMEOUT_MS='45000'
npm.cmd run smoke:alert-routing
```

Result:

- status: `ok`
- evidence time: `2026-05-23T13:19:00.403Z`
- total checks: `5`
- passed: `4`
- failed: `0`
- skipped: `1`
- backend health alert signal: `200`, health `ok`, database `ok`,
  observability `ok`
- provider metadata/delivery: skipped, not re-proven by this command

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
- public API health group: passed
- public availability: `100%`
- public p50: `65.08ms`
- public p95: `210.02ms`
- public 5xx count: `0`
- authenticated session, store read, competition read, and import read groups:
  skipped because no role-specific bearer tokens were present
- mutation routes remained excluded

## Local Gate Results

### Pilot Stabilization

Command:

```powershell
npm.cmd run check:pilot-stabilization
```

Result:

- script contract checks: `14/14` passed
- admin pilot smoke build: passed
- pilot Playwright checks: `7/7` passed

Methodology note:

- A first attempt was run in parallel with another Playwright command and failed
  with local preview server `ERR_CONNECTION_REFUSED`. The gate was rerun by
  itself and passed. The first attempt is treated as a local orchestration
  false-negative, not product evidence.

### Store Action Frontend Coverage

Command:

```powershell
npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts
```

Result:

- `13/13` passed
- covered persisted action plan rendering, status update, close, cancel,
  candidate create, pagination, unsafe source-link hiding, and empty-page
  recovery

### Store Action Backend And Workflow Coverage

Command:

```powershell
npm.cmd --prefix backend\nestjs test -- store-action-plan workflow-inbox.service --runInBand
```

Result:

- `7` suites passed
- `39` tests passed
- covered Store Action service, controller, repository, contract, schema,
  OpenAPI contract, and workflow inbox service

### Admin Lint

Command:

```powershell
npm.cmd --prefix admin-web run lint
```

Result:

- passed

### Generated API Check

Command:

```powershell
npm.cmd --prefix admin-web run api:check
```

Result:

- passed
- generated OpenAPI types are current

## Persona Rehearsal Results

This pass did not have secure role-specific token/session input:

- `READINESS_BEARER_TOKEN`: absent
- `BACKEND_LOAD_SESSION_TOKEN`: absent
- `BACKEND_LOAD_STORE_TOKEN`: absent
- `BACKEND_LOAD_COMPETITION_TOKEN`: absent
- `BACKEND_LOAD_HR_ADMIN_TOKEN`: absent
- `BACKEND_LOAD_IMPORT_TOKEN`: absent
- Clerk persona email/password env inputs: absent

Therefore the role-by-role browser/session rehearsal below is not counted as
fresh protected proof in this pass.

| Persona | Positive Flow | Negative Flow | Result | Notes |
| --- | --- | --- | --- | --- |
| `SUPER_ADMIN` | planned integrations/auth/support visibility | planned Store Action scope no-bypass check | blocked | Requires secure live session/token. Same-day prior protected evidence remains context only. |
| `HR_ADMIN` | planned competitions/master-data/checklists governance | planned auth/admin forbidden proof | blocked | Requires secure live session/token. |
| `REGION_MANAGER` | planned targets/competitions/rankings visibility | planned auth/master-data/integrations forbidden proof | blocked | Requires secure live session/token. |
| `STORE_MANAGER` | planned store/tasks/approvals/KPI/rankings and assigned Store Action visibility | planned unassigned-store forbidden proof | blocked | Requires secure live session/token. Local Store Action coverage passed. |
| `STORE_PERSONNEL` | planned own/store-facing surfaces | planned admin/manager command absence proof | blocked | Requires secure live session/token. |
| `REPORT_VIEWER` | planned reports/targets/inbox/read-only Store Tasks visibility | planned command-control absence and auth/admin forbidden proof | blocked | Requires secure live session/token. |

Reference context:

- Controlled Pilot Dry Run V1 already records sanitized six-persona protected
  staging evidence from the same day. This rehearsal evidence does not duplicate
  that result as a fresh rerun.

## Cross-Domain Signals

| Signal | Result | Notes |
| --- | --- | --- |
| Backend health | passed | Live and dependency health returned `ok`. |
| Database | passed | Health dependency check reported database `ok`. |
| Redis / queue | passed | Health reported Redis `ok`, BullMQ backend, durable queue, and `redisRequired=true`. |
| Frontend shell | passed | Root and SPA fallback returned HTML; sampled static assets returned JavaScript. |
| Alert routing | partial pass | App alert-routing docs and backend health signal passed; provider metadata/delivery was skipped. |
| Protected read latency | blocked | Requires role-specific tokens. |
| Store Action local loop | passed | Frontend and backend targeted coverage passed. |
| API contract drift | passed | Generated API types are current. |

## Issues And Follow-Ups

| Severity | Area | Observation | Decision Impact | Owner |
| --- | --- | --- | --- | --- |
| Medium | Protected persona rehearsal | No secure role-specific tokens/session inputs were available in this shell, so live persona phases were blocked. | Controlled pilot can continue from same-day protected evidence, but a moderated persona rehearsal still needs secure sessions. | pilot moderator / support owner |
| Low | Test orchestration | Running two Playwright gates in parallel caused a local preview-server false-negative. Sequential rerun passed. | Do not run Playwright web-server gates in parallel for rehearsal evidence. | support engineer |
| Low | Alert routing command usage | First alert-routing attempt used the wrong backend URL env variable and skipped backend health signal. Corrected rerun passed app/backend signal. | Use `ALERT_SMOKE_BACKEND_URL` for future evidence. | support engineer |
| Medium | Provider delivery | Alert provider metadata/delivery was not re-proven by this command. | Controlled pilot alert evidence remains based on prior provider proof; broad production still needs explicit provider/error-tracking posture. | decision owner |

## Final Rehearsal Decision

Controlled pilot:

- `Conditional Go / Continue`

Allowed next step:

- Run a real moderated read-only persona rehearsal using the six active pilot
  accounts when secure browser/session input is available.

Do not do next:

- Do not widen pilot users or roles.
- Do not run command-mode staging mutations without a named record, expected
  result, and rollback note.
- Do not treat tokenless public smokes as protected persona proof.
- Do not treat this as broad-production approval.

## Verification Commands

```powershell
npm.cmd run smoke:deployed-readiness
npm.cmd run smoke:alert-routing
npm.cmd run smoke:backend-readiness-load
npm.cmd run check:pilot-stabilization
npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts
npm.cmd --prefix backend\nestjs test -- store-action-plan workflow-inbox.service --runInBand
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run api:check
```

Final docs-only branch verification:

- `git diff --check`: passed.
- `npm.cmd run test:scripts`: passed, `309/309`.

## Sanitization

- Raw bearer tokens included: no.
- Clerk cookies included: no.
- Passwords/auth codes included: no.
- Full provider subjects included: no.
- Full JWT payloads included: no.
- Private user, employee, provider, store, database, Redis, webhook, or
  screenshot secrets included: no.
