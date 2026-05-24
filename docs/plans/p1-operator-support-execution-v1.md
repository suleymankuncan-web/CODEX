# P1 Operator Support Execution V1

Status: active
Shelf: readiness and operations
Last verified: 2026-05-24

## Reader And Action

Reader:

- support operator, pilot moderator, engineer, or future agent trying to debug
  a user, data, import, queue, or performance issue without database spelunking
  or unsafe manual edits.

After reading, they should know the first safe support slices for:

- correlation and request trace policy,
- read-only user diagnostics,
- troubleshooting flows,
- cache and stale-data labels,
- background job idempotency,
- data correction,
- import dry-run,
- performance escalation,
- role lifecycle and offboarding,
- metric glossary.

## Sokrates Decision

Decision:

- Implement P1 operator leverage as operating contracts before new UI or write
  behavior.
- Keep every first slice read-only or docs-only until the source-of-truth and
  owner are explicit.
- Do not create hidden support powers, manual overrides, or data mutation paths
  as part of diagnostics.

Evidence:

- `docs/backend/operational-monitoring-contract.md` already defines safe
  correlation ids, request logs, health semantics, and alert interpretation.
- `docs/plans/production-staging-incident-response-skeleton.md` already defines
  incident owner roles and guarded evidence rules.
- Import, snapshot, Store Action, auth, and reporting docs already separate
  source-of-truth and command/read boundaries.
- The ranked readiness backlog identifies P1 support ambiguity as a real future
  slowdown even though broad production is parked.

Counterargument:

- A support diagnostic page could be built immediately. That would be premature
  until the safe fields, freshness labels, scope rules, and escalation behavior
  are fixed.

Risk:

- This document: LOW.
- Read-only diagnostic surface after this contract: LOW/MEDIUM.
- Data correction or manual override without source/audit rules: HIGH.

Door:

- Docs and read-only diagnostics are two-way-door.
- Manual data edits, permission edits, or unguarded reruns are near-one-way in a
  pilot incident because they can hide the original cause.

## Execution Map

### 1. Correlation ID And Request Trace Policy

Current baseline:

- backend responses include `x-correlation-id`;
- safe inbound ids are accepted and unsafe ids are replaced;
- request logs include method, path, status, duration, actor, and correlation id.

First code slice:

- surface correlation id in a read-only support context for failed admin/store
  actions, without storing tokens, cookies, provider subjects, or private
  payloads.

Allowed evidence fields:

- route,
- endpoint,
- status,
- timestamp,
- release,
- environment,
- correlation id,
- safe domain id such as import batch id, snapshot run id, or action plan id.

Stop if tracing stores raw auth material, provider identifiers, request bodies,
or private row payloads.

### 2. User Support Diagnostic Panel

Goal:

- answer "why can this user not see or do this?" without asking support to query
  the database directly.

First safe slice:

- read-only spec and later read-only endpoint/view for:
  - resolved roles,
  - company/region/store scope,
  - assigned action stores,
  - route visibility,
  - last safe auth/session status,
  - current release/environment,
  - recent safe errors by correlation id.

Non-goals:

- no role editing,
- no store assignment editing,
- no permission override,
- no raw Clerk/provider subject display,
- no private data rows.

Stop if the panel becomes an admin editor or exposes private identifiers.

### 3. Support Troubleshooting Playbook

Five-minute flows to define before code:

| Symptom | First checks | Escalate when |
| --- | --- | --- |
| Login fails | frontend route, Clerk session, `/api/auth/session`, deployed readiness | auth smoke cannot verify a real session |
| Forbidden route | role set, route matrix, scope assignment, current release | route matrix and backend guard disagree |
| Missing store/action | store assignment, action-store scope, Store Action source evidence | assigned store has no expected read/action path |
| Stale KPI/ranking | snapshot freshness, import source freshness, official/preview label | official data is older than accepted budget |
| Import issue | batch health, mapping gaps, dominant quality issue, retry safety | rerun/idempotency is unclear |
| Slow page/API | Vite budget, backend latency, queue health, deployed smoke | threshold crosses P1/P0 escalation |

Stop if troubleshooting asks support to inspect secrets or edit production data.

### 4. Cache And Stale-Data Policy

Every operational surface should be classified as one of:

- live: direct current state;
- queued: accepted command awaiting async worker;
- preview: calculated but not official;
- snapshot: frozen output from a known run;
- official: accepted business result;
- stale/unknown: source freshness cannot be proven.

Initial surface map:

| Surface | Trust label | Owner |
| --- | --- | --- |
| KPI/ranking | official or snapshot | reporting owner |
| Store Action | live action plan plus source-linked candidate | store action owner |
| Import batch | queued/live batch state | data owner |
| Snapshot run | queued/snapshot | data owner |
| Workforce | imported/source-owned | workforce owner |
| Workflow inbox | live queue/read model | workflow owner |

Stop if labels change numbers, scoring, approval, or source-of-truth semantics.

### 5. Background Job Idempotency Registry

First registry fields for every async job:

- job family,
- source endpoint,
- idempotency key,
- retry behavior,
- owner,
- safe rerun condition,
- unsafe rerun condition,
- audit/correlation field,
- evidence command.

Initial job families:

- import batch creation,
- import batch retry,
- snapshot run creation,
- snapshot rerun,
- Store Action commands when persisted action plans are involved.

Stop if the registry changes job behavior without tests.

### 6. Data Correction Workflow Policy

Default correction rule:

- fix the source data first, then re-import or rerun materialization;
- use in-app correction only after a domain-specific owner approves source,
  audit, effective date, and rollback behavior.

Domain defaults:

| Domain | Default correction path | In-app correction allowed now |
| --- | --- | --- |
| Import/master data | source file or mapping fix, then import | no |
| KPI/ranking | source/reporting fix, then snapshot/materialization | no |
| Workforce | source file/system fix, then import | no |
| Store Action | command state through approved action endpoints | only existing action commands |
| Auth/scope | approved auth assignment workflow | only existing admin auth surfaces |

Stop if a correction bypasses audit or source-of-truth ownership.

### 7. Import Dry-Run / Preview Contract

Goal:

- show what an import would change before committing writes.

First safe slice:

- docs/spec for a no-write preview result:
  - row counts,
  - entity type counts,
  - mapping gaps,
  - duplicate/conflict candidates,
  - unknown external ids,
  - expected create/update/skip counts,
  - dominant quality issue codes,
  - source file metadata.

Non-goal:

- no DB mutation,
- no lifecycle transition,
- no automatic approval,
- no retry semantics change.

Stop if preview writes, reserves, approves, or changes import lifecycle.

### 8. Performance Budget Escalation

Use existing performance and release evidence before inventing new budgets.

Escalation levels:

| Signal | P2 | P1 | P0 |
| --- | --- | --- | --- |
| frontend bundle/page budget | warning over budget | repeated over budget on pilot route | route unusable |
| backend latency | repeated slow public health/API | protected route crosses accepted smoke budget | critical flow unavailable |
| queue pressure | delayed jobs visible | retries/stuck jobs persist | data/workflow blocked |
| deployed smoke | non-critical warning | protected group fails | health/auth critical fail |

Stop if thresholds are not backed by build, smoke, browser, or runtime evidence.

### 9. Role Lifecycle And Offboarding Guard

Scenarios to prove before broad usage:

- user role removed,
- store assignment removed,
- region/company scope changed,
- employee offboarded,
- Clerk session exists but DB assignment is revoked,
- previous token/session attempts an old action.

First safe slice:

- docs/test matrix tied to route visibility and backend authorization smoke.

Stop if role lifecycle work changes auth semantics without separate approval.

### 10. Metric Glossary And Data Dictionary

Canonical terms to define before product copy grows:

- KPI,
- ranking,
- official,
- preview,
- snapshot,
- target,
- Store Action,
- action plan,
- checklist,
- import batch,
- data quality issue,
- stale data,
- source of truth.

First safe slice:

- short glossary linked from reporting, Store Action, import, and readiness
  docs. Do not change KPI math or scoring labels while writing it.

## First Implementation Order

1. Create this operator support execution map.
2. Add a metric glossary/data dictionary.
3. Add a background job idempotency registry.
4. Add an auth/role lifecycle matrix.
5. Add a no-write import preview spec.
6. Only then build a read-only diagnostic surface if pilot support asks for it.

## Verification Ladder

Docs-only:

```powershell
git diff --check
npm.cmd run test:scripts
```

Future read-only frontend diagnostic:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- [targeted-spec]
```

Future backend read-only diagnostic:

```powershell
npm.cmd --prefix backend/nestjs run test -- [targeted-test]
npm.cmd --prefix backend/nestjs run lint
npm.cmd --prefix backend/nestjs run build
```

## Stop Rules

Stop and split if a support slice:

- edits roles, stores, permissions, or assignments;
- mutates import, snapshot, KPI, ranking, or Store Action state;
- exposes raw provider identifiers, bearer tokens, cookies, payloads, DB URLs,
  Redis URLs, or private row data;
- changes API response shape or auth semantics;
- claims live evidence from docs-only proof.

## Durust Yorum

This is the project's "operator does not get lost" layer. It is less flashy
than a new module, but it prevents future support work from turning into a
maze of screenshots, database guesses, and panic fixes.
