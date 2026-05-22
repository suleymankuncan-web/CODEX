# Feature Integration Spine V1

## Reader And Action

Reader:

- a future engineer or agent deciding how to add a new product feature,
  workflow, integration, KPI family, operational action, mobile surface, or
  business module to Store Ops.

After reading, they should be able to:

- choose the right operating mode before work starts,
- identify the owning domain and source of truth,
- keep auth, workflow, audit, API, operations, route, and localization pressure
  from collecting in the same few files,
- decide which gates are mandatory and which are conditional,
- start the next feature without building a generic framework first.

## Decision

Create a lightweight feature-entry spine for all future features.

This is not a new framework, rules engine, workflow engine, API Gateway, event
bus, or generic plugin layer. It is a standing decision record and checklist
that keeps new work from entering the project through whichever file happens to
be nearby.

The first feature to use this spine is Store Action / Coaching Loop V1, but the
spine is intentionally broader than that feature.

## Sokrates Decision

Claim:

- The project can keep accepting new features, but every new feature will put
  pressure on the same shared junctions unless entry rules are explicit.

Assumptions:

- Current architecture is recoverable and does not need a rewrite.
- Most future features will touch at least one shared junction: auth/scope,
  workflow inbox, audit, OpenAPI, operations telemetry, route/nav, localization,
  reporting, or data placement.
- A small decision spine prevents more debt than a large generic platform would
  at this stage.

Repo evidence:

- The domain blueprint already separates identity, people lifecycle,
  checklists, targets, approvals, acknowledgements, tasks/inbox, performance,
  incentives/rewards, challenges/social, and config/rules.
- The workflow language already distinguishes approval, acknowledgement, task,
  and notification.
- The rules/config decision explicitly rejects a generic rules engine for now.
- The Operations Control Tower is already a read-only summary surface and
  should not become the default dumping ground for every future feature.
- The current workflow inbox already normalizes target approvals, checklist
  receipts, and KPI exceptions; a new action-plan source would increase pressure
  if the source mapping is not kept modular.
- The OpenAPI generator and generated clients are healthy enough to continue
  using, but every new API adds contract pressure that should be owned by a
  feature boundary.

Counterargument:

- A new spine can become process theater. That would be worse than no spine if
  it slows down small safe changes without catching real risk.

Risk:

- LOW for this docs-only decision.
- MEDIUM if future teams treat the spine as optional and continue to add
  feature logic directly to shared junctions.
- HIGH if this document is misread as approval to build generic engines before
  a concrete feature proves the need.

Door:

- This decision is a two-way door. It can be simplified if it adds ceremony.
- Generic engines, shared DB schemas, workflow engines, provider changes, and
  API response shape changes remain near one-way-door work.

Stop rule:

- Stop if a future feature cannot identify an owner, source of truth, data
  placement, auth/scope boundary, verification ladder, and rollback shape.
- Stop if a feature PR unexpectedly touches three or more central junctions
  without a documented blast-radius decision.

Decision quality score:

- 4/5. The current docs and code show the pressure points clearly. The remaining
  natural limit is that real future features will calibrate which gates are too
  heavy or too light.

## Operating Mode Gate

Choose one mode before changing files:

| Mode | Use When | Minimum Gate |
| --- | --- | --- |
| `bugfix` | A known broken behavior must be corrected. | Repro, smallest fix, targeted regression test. |
| `docs-only` | The work is decision, inventory, intake, or runbook only. | `git diff --check` and reader-test. |
| `refactor` | Behavior stays the same and a concrete reviewability/risk boundary improves. | Existing behavior tests. |
| `read-only feature` | New user value reads existing state without new commands. | Source of truth, auth read scope, API/generated types if needed, targeted UI/backend tests. |
| `write feature` | New command or persisted operational state. | Auth read/action scope, audit, validation, negative tests, rollback. |
| `workflow feature` | The feature creates approvals, acknowledgements, tasks, notifications, or action plans. | Workflow type, inbox mapping, owner role, status model, failure states. |
| `external integration` | Provider, upload, source adapter, token, queue, or live evidence is involved. | Real input proof or explicit parked blocker. |

Do not force the full feature checklist onto trivial bugfixes or typo-level
docs edits. Do not downgrade write, auth, DB, provider, or workflow work into a
lighter mode just to move faster.

## Mandatory Gates For Meaningful Features

Every meaningful feature needs these answers before implementation:

1. **Owner and lifecycle**
   - Who owns it?
   - Is it `intake`, `planned`, `active`, `parked`, `deprecated`, or `retired`?
   - What makes it complete enough to stop expanding?

2. **Bounded context**
   - Which domain owns writes and policy?
   - Which neighboring domains may read it?
   - Which domains must not mutate it?

3. **Source of truth**
   - Which existing system or table is authoritative?
   - What may the feature read but never reinterpret?
   - What must not become a second source of truth?

4. **Data placement**
   - `ops`: operational state and workflow truth.
   - `stg`: imported/raw/source evidence.
   - `rpt`: immutable reporting and snapshot outputs.
   - `audit`: who changed or decided what, when, and why.

5. **Blast radius budget**
   - Count central junctions touched.
   - If the feature touches three or more central junctions, split or write a
     short blast-radius decision.

6. **Verification ladder**
   - Name the cheapest useful gate.
   - Climb only when the blast radius requires it.

## Conditional Gates

Use these only when the feature actually touches the area.

| Gate | Trigger | Required Answer |
| --- | --- | --- |
| Auth / scope | Any protected read or command. | Role guard, read scope, action scope, and at least one forbidden/foreign-scope case for commands. |
| API / OpenAPI | Any new or changed endpoint/body/response. | Schema owner, generated client update, API check, response-shape compatibility. |
| Workflow / inbox | Any queue item, action plan, approval, acknowledgement, task, or notification. | Workflow type, source adapter, deep link, owner role, status mapping, empty/error behavior. |
| Audit | Any command or sensitive state transition. | Event name, target entity, actor, before/after or reason metadata, test or evidence path. |
| Operations / telemetry | Any health, queue, blocker, or readiness signal. | Is it a local source, live signal, planned topic, or external-input blocker? |
| UI / route / nav | Any user-facing surface. | Shell placement, route ownership, navigation entry, loading/empty/error states, mobile impact. |
| Localization / copy | Any user-facing text. | Canonical term, Turkish/English copy, no duplicate naming for workflow concepts. |
| DB / migration | Any schema or data migration. | Rollback, migration smoke, data repair path, release ordering. |
| External provider | Any token, provider, upload, alert, queue, restore, or source adapter. | Real input exists or the work is parked as blocked evidence. |

## Central Junction Pressure Map

These junctions should stay small, boring, and explicit.

| Junction | Why It Gets Pressure | V1 Rule |
| --- | --- | --- |
| Workflow inbox | Every operational feature wants to appear in one queue. | Source modules map their own items into the shared inbox shape; inbox does not own source workflow policy. |
| Auth / scope | Every feature wants visibility and action rules. | Read scope and action scope are separate. New roles are last resort. |
| Audit catalog | Every write feature needs traceability. | Commands name audit event and target entity before implementation. |
| OpenAPI generator | Every API feature adds schema pressure. | Keep schema ownership near the feature decision; split generator only when API growth proves the need. |
| Operations Control Tower | Every signal wants visibility. | Control tower gets summary/link/status only; source workflows keep details. |
| Route and navigation shells | Every feature wants a page and nav item. | Shells route users to owned surfaces; they should not accumulate business rules. |
| Localization dictionaries | Every feature adds user-facing copy. | Canonical terms for workflow and status language must stay consistent. |
| Reporting/KPI | Many features consume performance signals. | Reporting provides signals; it does not own operational actions. |

## Workflow Inbox Extension Rule

When a feature creates inbox work:

- The source feature owns its lifecycle and internal status.
- The shared inbox owns only normalization into common queue language.
- The source adapter must provide:
  - `itemType`,
  - `sourceType`,
  - `sourceId`,
  - title and summary,
  - owner/actor role,
  - store/region/company context,
  - source workflow status,
  - inbox status,
  - urgency,
  - primary action label,
  - deep link,
  - history preview when useful.
- The inbox must not silently turn every source into approval.
- KPI signals enter as `task`, not approval.
- Checklist receipt stays acknowledgement unless a separate approval decision is
  explicitly designed.
- Action plans should enter as `task` unless a later approval step is added by
  a separate decision.

Do not add a source type by scattering switch statements across unrelated UI and
backend files. If a new source creates repeated mapping pressure, introduce a
small source registry/adapter in the owning layer before adding more sources.

## Auth, Scope, And Audit Guard

For read-only features:

- Define who can read.
- Define whether the read is company, region, store, or person scoped.
- Prove scoped filtering when the data could leak stores, employees, or
  sensitive operational state.

For command features:

- Define who can submit.
- Define who can approve, acknowledge, close, cancel, return, or retry.
- Separate read permission from action permission.
- Include a forbidden or foreign-scope negative case.
- Write an audit event for state-changing commands.

Do not rely on a frontend route guard as the only permission boundary.

## OpenAPI Growth Guard

The API contract line is healthy enough to continue.

V1 rule:

- New APIs should use OpenAPI/generated client coverage.
- Response shapes should be additive unless a contract change is explicitly
  approved.
- Read and write endpoints should not be batched together unless one review
  story and one rollback story remain clear.
- The generator should not be broadly split before a concrete API-growth
  pressure point appears.
- When a feature adds several schemas, record the intended schema owner and the
  future split trigger.

Split trigger:

- repeated merge conflicts in the generator,
- one feature adding hard-to-review schema blocks,
- accidental contract drift despite generated checks,
- a new API family large enough to deserve its own schema file.

## Operations Tower Boundary

The Operations Control Tower is not the home for every feature.

It may show:

- status,
- count,
- freshness,
- blocked/failed/stale state,
- link to the owning surface,
- external-input blocker state.

It should not own:

- source workflow details,
- write commands,
- approval logic,
- action plan logic,
- data repair workflow,
- KPI scoring,
- provider configuration.

If a feature needs a full operator workflow, build or reuse the owning surface
and expose only a summary in the control tower.

## Route, Navigation, And Localization Boundary

Route and shell changes are user-facing product decisions.

Before adding a route or nav entry, answer:

- Which shell owns this: admin, store, auth, or mobile?
- Is it a real data surface, read-only handoff, or honest placeholder?
- Which roles see it?
- Does it need preloading or should it wait for user action?
- Is the route mobile-safe?
- What loading, empty, error, unauthorized, and recovery states exist?

Localization is required when the change is user-facing. Prefer the existing
dictionary pattern and reuse canonical workflow/status terms.

## Lifecycle And Retirement Gate

Every meaningful feature should be easy to stop expanding.

Status model:

- `intake`: captured but not designed.
- `shaping`: business/domain decisions are being clarified.
- `planned`: mini spec exists and first implementation slice is clear.
- `active`: implementation is in progress.
- `parked`: waiting for external input, business rule, or a safer trigger.
- `deprecated`: still present but no longer a recommended path.
- `retired`: removed or fully replaced.

Do not leave indefinite placeholder modules without a parked reason and an
unpark trigger.

## Verification Ladder

Docs-only:

- `git diff --check`.
- Reader-test against the named post-read action.

Read-only feature:

- targeted unit/service test when a backend read model changes,
- frontend lint/build and targeted Playwright when a surface changes,
- OpenAPI generate/check if an API is touched.

Write or workflow feature:

- command validation tests,
- auth read/action-scope positive and negative tests,
- audit event test or evidence,
- generated API/client checks,
- targeted frontend/backend tests,
- broader gate when several central junctions are touched.

External/live evidence:

- run only with real inputs,
- record blockers honestly when inputs do not exist.

## First Use: Store Action / Coaching Loop

Store Action / Coaching Loop V1 should use this spine before implementation.

Expected first pass:

- define owner, source of truth, and lifecycle,
- keep KPI, checklist, target, and workforce source behavior unchanged,
- start with read-only action candidates if possible,
- add persisted action plans only after auth, audit, and data placement are
  clear,
- surface work in the inbox as `task`, not approval,
- show at most a summary/link in Operations Control Tower.

## What Not To Build From This Decision

Do not use this spine as justification for:

- a generic workflow engine,
- a generic rules engine,
- an event bus,
- an API Gateway,
- a DB-backed runtime config editor,
- broad OpenAPI generator refactor without a concrete pressure trigger,
- moving feature logic into Operations Control Tower,
- changing auth, DB, API response shape, KPI scoring, target approval,
  checklist scoring, or user workflow semantics.

## Reader-Test

A future engineer should be able to take a feature idea and answer:

1. What mode is this work?
2. Which domain owns it?
3. What is its source of truth?
4. Which central junctions does it touch?
5. Which gates are mandatory and which are conditional?
6. What is the smallest first slice?
7. What would make us stop or split?

If those answers are unclear, the feature is not ready for implementation.
