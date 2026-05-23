# Feature Growth Checklist V1

## Reader And Action

Reader:

- a product owner, engineer, QA operator, or future agent shaping a new HR Axis
  / Store Ops feature.

After reading, they should be able to:

- decide whether a feature is ready for code,
- identify the source of truth and scope boundary,
- prevent new work from overloading auth, workflow, reporting, operations, or
  shared route shells,
- choose the smallest safe implementation slice and verification ladder.

## Decision

Every meaningful new feature must pass this checklist before implementation.

This checklist extends the feature integration spine and new module template
with pilot-specific growth gates. It does not approve new code, schema,
provider changes, auth changes, UI redesign, or business behavior changes by
itself.

## Sokrates Decision

Claim:

- The project is now stable enough to grow, but growth will create bottlenecks
  unless every feature names its owner, source of truth, scope, blast radius,
  and evidence path before code.

Assumptions:

- The current architecture remains the foundation.
- The safest next product work will be small, testable, and evidence-led.
- New features can be store-scoped, region-scoped, company-scoped,
  person-scoped, provider-backed, or system-level.

Counterargument:

- A checklist can become ceremony. It should block only meaningful feature
  work, not typo fixes, small copy changes, or already-scoped bug fixes.

Risk:

- LOW for docs-only.
- MEDIUM if the checklist is ignored after writing.

Door:

- Two-way-door. The checklist can be trimmed if it becomes too heavy.

Stop rule:

- Stop before code if the feature cannot identify its source of truth,
  role/scope boundary, write boundary, and verification ladder.

## Use This Checklist For

- new modules,
- new workflow sources,
- new Store Action / Coaching / Norm Kadro phases,
- new reports or KPI families,
- new integration-fed domains,
- new write commands,
- new role/scope behavior,
- new Operations signals,
- new provider-backed features.

Do not use the full checklist for trivial docs, copy, lint, or small
behavior-preserving refactor work.

## 1. Feature Identity

Answer before code:

- Feature name:
- Operating mode:
  - `docs-only`
  - `read-only feature`
  - `write feature`
  - `workflow feature`
  - `external integration`
  - `refactor`
  - `bugfix`
- Business problem:
- Primary user role:
- Secondary user roles:
- Support/special roles:
- Current lifecycle:
  - `intake`
  - `shaping`
  - `planned`
  - `active`
  - `parked`
  - `retired`
- Completion boundary:
- Explicit non-goals:

Stop if the feature cannot say what user decision or operation becomes easier
after it exists.

## 2. Scope Gate

Choose the smallest scope that matches the problem.

| Scope | Meaning | Typical Roles | Required Proof |
| --- | --- | --- | --- |
| person | One employee's own data or task context. | `STORE_PERSONNEL`, `STORE_MANAGER`. | Own-person positive case and foreign-person/no-leak negative case when sensitive. |
| store | One assigned store or action-store. | `STORE_MANAGER`, `STORE_PERSONNEL`, `SUPER_ADMIN`. | Assigned-store positive case and unassigned-store forbidden case for commands. |
| region | Multiple stores under a region. | `REGION_MANAGER`, `SUPER_ADMIN`. | Region read/action boundary, plus cross-region negative case if commands exist. |
| company | Company-wide admin or read model. | `SUPER_ADMIN`, `HR_ADMIN`, `REPORT_VIEWER`. | Clear reason company scope is needed; stronger audit for commands. |
| support | Audit, snapshot, integration, or operations support. | `AUDITOR`, `SNAPSHOT_OPERATOR`, `INTEGRATION_ADMIN`. | Role-specific evidence only if the role is part of the active pilot path. |
| provider/system | External service or runtime behavior. | Operators/admins. | Real provider input or explicit blocked evidence record. |

Required question:

- Is this feature person-scoped, store-scoped, region-scoped, company-scoped,
  support-scoped, provider-backed, or system-level?

Stop if region-level read visibility is being used to justify store-level
commands without a separate action-scope decision.

## 3. Source Of Truth Gate

Required answers:

- Which domain owns the source of truth?
- Which records are operational truth?
- Which records are imported evidence?
- Which records are reporting/snapshot outputs?
- Which records are audit history?
- Which neighboring domains may read but never reinterpret this data?
- What must not become a second source of truth?

Default placements:

| Data Kind | Home | Rule |
| --- | --- | --- |
| Operational state | `ops` domain | Mutable business workflow truth and command state. |
| Imported/source evidence | `stg` domain | Raw or staged external data; do not treat as final truth without review/materialization. |
| Reporting outputs | `rpt` domain | Read models and snapshots; avoid direct operational writes. |
| Audit/history | `audit` domain | Actor, target, reason, before/after, and decision trace. |

Stop if the feature would calculate KPI, checklist, target, workforce, or
reporting truth independently from the owning domain.

## 4. Read / Write Boundary Gate

For reads:

- Who can read?
- What scope filters are required?
- What empty, loading, error, unauthorized, and stale states exist?
- What negative case proves data does not leak across scope?

For writes:

- Who can create?
- Who can update?
- Who can approve, return, close, cancel, retry, or delete?
- What validation blocks invalid state?
- What audit event is written?
- What rollback or correction path exists?
- What forbidden/foreign-scope case proves the command is narrow?

Stop if the first slice mixes broad read expansion and write behavior unless
both belong to one review story and one rollback story.

## 5. Shared Junction Blast-Radius Gate

Mark every shared junction touched:

- [ ] auth / read scope / action scope
- [ ] API / OpenAPI / generated client
- [ ] workflow inbox
- [ ] audit catalog
- [ ] DB schema or migration
- [ ] import / external provider / upload
- [ ] reporting / KPI / snapshot interpretation
- [ ] Operations / telemetry / freshness signal
- [ ] route shell / navigation
- [ ] localization / user-facing copy
- [ ] frontend E2E / mobile coverage

Rules:

- 0-2 junctions: normal small PR is acceptable.
- 3-4 junctions: write a short blast-radius note and consider splitting.
- 5+ junctions: split or stop unless the user explicitly approves a larger
  roadmap.

## 6. API And OpenAPI Gate

Required if API changes:

- Is this a read endpoint, command endpoint, or both?
- Is the response shape additive?
- Which generated client/type will consume it?
- Which contract check proves generated files are current?
- What existing response must not change?
- What is the rollback path if the endpoint is wrong?

Stop if a feature changes API response shape just to make frontend work easier.

## 7. Workflow / Inbox / Store Action Gate

Required if the feature creates work:

- Workflow type:
  - `approval`
  - `acknowledgement`
  - `task`
  - `notification`
  - `action-plan`
  - none
- Source owner:
- Source status:
- Inbox status:
- Owner role:
- Scope:
- Urgency:
- Deep link:
- Primary action:
- Empty/error state:

Store Action rule:

- Store Action may track and coach against existing source signals.
- Store Action must not become a second KPI, checklist, target, approval, or
  workforce source of truth.
- New Store Action sources require a source decision before code.

Stop if every new item is being forced into "approval" language.

## 8. Operations / Freshness / Quality Gate

Required answers:

- Does the feature create a health, freshness, quality, queue, blocker, or
  readiness signal?
- Should Operations show only summary/link/status, or does this need its own
  source surface?
- What makes the data stale?
- What makes the data untrusted?
- What should the user do when the signal is bad?
- Is the signal local, live, planned, historical, blocked, or accepted risk?

Do not invent numeric thresholds without:

- owner,
- source cadence,
- business impact,
- user-facing copy,
- verification path.

Stop if Operations is becoming the source workflow owner instead of a read-only
control tower.

## 9. UI / UX / Localization Gate

Required if user-facing:

- Which shell owns the route?
- Is navigation global, role-based, contextual, or hidden?
- What is the primary action?
- What is the read-only mode?
- What loading, empty, error, unauthorized, stale, and success states exist?
- Does mobile overflow need a targeted check?
- Which Turkish/English terms must stay canonical?
- Does this work overlap with a future broad UI redesign?

Stop if the slice becomes broad redesign or changes workflow meaning through
copy alone.

## 10. DB / Migration Gate

Required if schema/data changes:

- What new table or column is needed?
- Why can't an existing source own it?
- Is the change additive?
- What is the migration order?
- What is the rollback/forward-fix path?
- Does it need seed/reference data?
- Does it need fresh database smoke?
- Does it affect backup/restore expectations?

Stop if the feature needs a migration but the source-of-truth decision is not
settled.

## 11. External Provider / Live Evidence Gate

Required if the feature uses provider state:

- Which provider?
- What real input is needed?
- Can it be proven without writing secrets?
- What can be tested locally?
- What remains blocked until the user provides provider access or input?
- What is controlled-pilot evidence versus broad-production evidence?

Stop if a mock, tokenless smoke, provider dashboard guess, or local fixture is
being treated as real protected/provider evidence.

## 12. Test And Verification Ladder

Choose the cheapest ladder that matches blast radius.

| Work Type | Minimum Verification |
| --- | --- |
| docs-only | `git diff --check`; reader-test. |
| route/UI read-only | frontend lint/build and targeted Playwright. |
| API/generated client | OpenAPI generate/check and targeted frontend/backend tests. |
| backend read model | targeted backend tests; full gate if shared query logic changes. |
| command/write | positive, validation, forbidden, foreign-scope, and audit tests. |
| workflow/inbox | source mapping, empty/error state, owner role, status mapping tests. |
| DB/migration | migration smoke, targeted backend tests, rollback/forward-fix note. |
| provider/live evidence | sanitized real evidence or explicit blocker; no fake proof. |

## 13. Rollback And Stop Rules

Before implementation, write:

- Revert shape:
- Data repair path, if any:
- Feature flag or config path, if any:
- What would make us stop?
- What would split the PR?
- What would require user approval?

Default stop rules:

- source of truth unclear,
- role/scope ambiguous,
- second source of truth risk,
- DB migration without source decision,
- API response shape drift,
- auth behavior hidden in frontend-only code,
- provider secret/input unavailable,
- broad redesign/refactor pressure,
- review story no longer fits one paragraph.

## 14. Minimal Intake Template

Use this compact block before opening a feature branch:

```text
Feature:
Operating mode:
Primary role:
Scope type:
Source of truth:
Read boundary:
Write boundary:
Shared junctions touched:
Operations/freshness impact:
OpenAPI/API impact:
DB impact:
Workflow/inbox impact:
Primary verification:
Rollback:
Stop rule:
```

## Final Rule

If a feature cannot pass the compact intake template, it is not ready for code.
Shape it as a docs/spec slice first.
