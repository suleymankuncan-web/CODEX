# Pilot Scenario Pack V1

## Reader And Action

Reader:

- a product owner, engineer, QA operator, or future agent preparing a controlled
  Store Ops pilot.

After reading, they should be able to:

- explain what each pilot role does during a normal operating day,
- tell whether a route is store-scoped, region-scoped, or company-scoped,
- identify the source of truth behind each visible signal,
- know which evidence exists and which evidence must be refreshed before a
  wider pilot or broad production.

## Decision

Use this scenario pack as the product-facing pilot map for HR Axis / Store Ops.

This is not a new module, UI redesign, API contract, auth change, database
change, or provider configuration. It is the human-readable operating map that
keeps future feature work connected to real pilot behavior.

## Sokrates Decision

Claim:

- The next useful growth step is to make the current pilot roles, surfaces,
  source-of-truth boundaries, and freshness expectations readable in one place.

Assumptions:

- The app remains in controlled internal pilot posture.
- Broad production remains No-Go.
- The project should not invent a new role, workflow, or data source while
  writing this pack.
- `REGION_MANAGER` is an active product role and must be included in pilot
  scenario planning.

Evidence:

- Route-role coverage already includes `REGION_MANAGER` on target,
  competition, feed, ranking, approval, and checklist-facing surfaces.
- Fresh protected evidence exists for `SUPER_ADMIN`, `HR_ADMIN`,
  `STORE_MANAGER`, `STORE_PERSONNEL`, and `REPORT_VIEWER`.
- Fresh protected addendum evidence exists for `REGION_MANAGER` in
  `docs/evidence/system-flow/clerk-region-manager-live-evidence-2026-05-23.md`.
- External evidence is closed enough for controlled pilot and explicitly parked
  for broad production.
- Store Action V1B already gives store managers and super admins a narrow
  persisted action-plan loop.

Counterargument:

- Documentation does not improve the product by itself. It only helps if future
  pilot work and feature intake use it as a gate.

Risk:

- LOW for docs-only.
- MEDIUM if this document is treated as proof that every listed role has fresh
  live staging evidence.

Door:

- Two-way-door. The pack can be revised after real pilot sessions or role
  changes.

Stop rule:

- Do not claim live evidence for a role unless a sanitized real session exists.
- Do not add behavior, routes, roles, scopes, or data sources from this
  document.

## Active Pilot Roles

| Role | Scope Level | Primary Job In Pilot | Evidence Note |
| --- | --- | --- | --- |
| `SUPER_ADMIN` | company | Owns system health, auth/admin control, imports, operations, and exception handling. | Fresh live evidence exists. |
| `HR_ADMIN` | company | Owns HR/personnel-facing admin operations, master-data readiness, competitions, and governance surfaces. | Fresh live evidence exists. |
| `REGION_MANAGER` | region | Owns regional performance review, target/approval follow-up, region-visible ranking, and escalation. | Fresh live evidence exists through the 2026-05-23 region-manager addendum. |
| `STORE_MANAGER` | store | Owns store daily execution, checklist follow-up, KPI/ranking review, approvals, and Store Action plan work. | Fresh live evidence exists. |
| `STORE_PERSONNEL` | person/store | Sees personal/store-facing work such as own performance and checklist/task surfaces. | Fresh live evidence exists. |
| `REPORT_VIEWER` | company/read-only | Reads reports, rankings, and selected workflow/task visibility without mutating operational state. | Fresh live evidence exists. |

## Support And Special Roles

| Role | Current Use | Pilot Rule |
| --- | --- | --- |
| `INTEGRATION_ADMIN` | Import/integration separation-of-duties role. | Do not create a new persona just to satisfy old evidence wording; current pilot upload proof is accepted through `SUPER_ADMIN`. |
| `AUDITOR` | Audit center visibility. | Treat as a support role unless an audit-specific pilot session is scoped. |
| `SNAPSHOT_OPERATOR` | Snapshot operations. | Treat as a support role unless snapshot operations are part of the pilot script. |
| `VISUAL_MERCHANDISER` | Checklist/task specialization. | Treat as a specialized store-facing role, not a default store pilot persona. |

## Pilot Day Scenario

### Before The Day Starts

- `SUPER_ADMIN` checks operations health, external evidence posture, import
  freshness, queue health, and known blockers.
- `HR_ADMIN` checks whether master data, personnel, competitions, and checklist
  templates are ready for the pilot day.
- `REGION_MANAGER` checks regional target/ranking/approval surfaces if that
  persona is part of the day.
- `STORE_MANAGER` checks store tasks, Store Action plans, checklists, KPI
  highlights, rankings, and approvals.
- `STORE_PERSONNEL` checks own/store-visible work only.
- `REPORT_VIEWER` checks reports and read-only operational visibility.

### During The Day

- Store-facing users work from store surfaces.
- Admin users work from admin governance and operations surfaces.
- Store Action plans remain the narrow operational loop for turning existing
  KPI follow-up candidates into tracked store work.
- Region-level review should not bypass store/action scope. A region manager
  may see regional context, but commands still need explicit read/action-scope
  proof.

### End Of Day

- `STORE_MANAGER` closes or cancels action plans with reasons where applicable.
- `REGION_MANAGER` reviews region-level progress and flags unresolved store
  blockers if the role is active in the pilot.
- `SUPER_ADMIN` and `HR_ADMIN` review operational blockers, failed imports,
  stale snapshots, and pilot feedback.
- `REPORT_VIEWER` remains read-only and should not be used to prove command
  behavior.

## Role / Surface / Action Matrix

| Surface | Scope | `SUPER_ADMIN` | `HR_ADMIN` | `REGION_MANAGER` | `STORE_MANAGER` | `STORE_PERSONNEL` | `REPORT_VIEWER` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Admin integrations | company | read/write | no default pilot action | no default pilot action | no | no | no |
| Admin master data | company | read/write | read/govern | no default pilot action | no | no | no |
| Admin snapshots | company | read/operate when scoped | no default pilot action | no default pilot action | no | no | read only if separately scoped |
| Admin inbox | company/queue | read/triage | read/triage | needs explicit product decision | no | no | read |
| Admin feed | company/region | read/write | read/write | read/write when scoped | no | no | no default pilot action |
| Admin checklists | company | read/write | read/write | no default pilot action | no | no | no |
| Admin competitions | company/region | read/write | read/write | read/region visibility | no | no | read |
| Admin reports | company | read | no default pilot action | no default pilot action | no | no | read |
| Admin targets | region/company | read/write | no default pilot action | read/follow up | no | no | read |
| Admin KPI config | company | read/write | no default pilot action | no default pilot action | no | no | no default pilot action |
| Auth/admin/audit | company | read/write | no | no | no | no | audit read only when role-scoped |
| Store home | store | support read | no | no default pilot action | read | read | no default pilot action |
| Store personal performance | person/store | support read | no | no default pilot action | read own/store context | read own context | no default pilot action |
| Store rankings | store/region/company | privileged read | no | region/full-context read | store-context read | store-context read | read |
| Store approvals | store/region/company | read/action when scoped | no default pilot action | region follow-up/read when scoped | store read/action when scoped | no current pilot access | read |
| Store checklists | store | support read | no default pilot action | region/checklist visibility when scoped | read/action | read/action when assigned | no default pilot action |
| Store tasks / Store Action | store | read/action | no default pilot action | future escalation candidate; not current command owner | read/create/status/close/cancel when scoped | limited task visibility | read-only workflow visibility |
| Store KPI highlights | store | support read | no | region summary only if explicitly scoped | read | read | read only if scoped |
| Store feed / competitions / incentives | store/region | support read | no default pilot action | region visibility when scoped | read/participate as scoped | read/participate as scoped | read-only if scoped |

Legend:

- `read/write`: normal pilot command surface for that role.
- `read/action`: role can view and perform scoped operational actions.
- `read`: view-only.
- `no default pilot action`: role may exist in the app, but this pack does not
  claim an active pilot workflow for that surface.
- `no`: should not be used as a pilot path without a new decision.

## Scope Model

| Scope Type | Meaning | Typical Roles | Feature Design Rule |
| --- | --- | --- | --- |
| person | One employee's own performance or task context. | `STORE_PERSONNEL`, sometimes `STORE_MANAGER`. | Never expose another person's sensitive data without explicit role/scope evidence. |
| store | One assigned store or action-store boundary. | `STORE_MANAGER`, `STORE_PERSONNEL`, `SUPER_ADMIN`. | Commands need positive and foreign-store negative tests. |
| region | Multiple stores grouped by region. | `REGION_MANAGER`, `SUPER_ADMIN`. | Reads and actions must state whether region scope is read-only or action-capable. |
| company | Cross-company or global admin context. | `SUPER_ADMIN`, `HR_ADMIN`, `REPORT_VIEWER`. | Use sparingly; commands need stronger audit and rollback. |
| support | Diagnostics, audit, snapshot, integration, or ops support. | Support/special roles. | Keep support roles out of default pilot flow unless explicitly scoped. |

## Domain Source-Of-Truth Map

| Domain | Source Of Truth | Read Model / Consumer | Write Boundary | Second-Source Risk |
| --- | --- | --- | --- | --- |
| Auth / role / scope | Application authorization records and provider session identity. | Route guards, backend guards, persona evidence, role/scope tests. | Auth admin assignment commands. | High if frontend-only role checks become the real authority. |
| Company / region / store master data | Operational master-data records. | Admin master-data, store shell, reporting filters. | Admin/master-data workflows. | High if imports silently create alternate store identity. |
| Workforce / personnel | Operational employee and assignment records. | Store/personnel surfaces, workforce approval queues, reports. | HR/admin-approved mutations and workforce requests. | High if request rows become live personnel truth. |
| Imports / mappings | Integration import batches and raw/source evidence. | Integration dashboard, Operations, data-quality signals. | Import/upload and mapping review flows. | High if reporting consumes unreviewed raw rows as final truth. |
| KPI / performance | Approved imported KPI rows plus reporting snapshots/read models. | Store KPI, rankings, reports, Store Action candidates. | Import/review/snapshot generation; KPI config where scoped. | High if Store Action or UI recalculates scores independently. |
| Checklist | Checklist templates, visits, receipts, acknowledgements, and task records. | Store checklists, checklist today, reports. | Checklist governance and store task completion flows. | Medium if acknowledgements are reclassified as approvals without a decision. |
| Targets / approvals | Target request and approval ledger. | Admin targets, store approvals, workflow inbox. | Scoped target request/approval commands. | High if region/store UI mutates target state outside approval rules. |
| Competitions | Competition setup, stages, teams, packages, and results. | Admin competitions, store competitions, rankings/reporting where applicable. | Competition admin commands. | Medium if reporting invents competition state not owned by competition domain. |
| Store Action | Persisted action plans linked to existing operational signals. | Store tasks and workflow inbox. | Store Action plan create/status/close/cancel commands. | High if action plans become a second KPI/checklist/approval source. |
| Reporting / snapshots | Immutable or controlled reporting read models. | Reports, rankings, dashboards, operations summaries. | Snapshot/materialization jobs and reporting repository boundaries. | High if operational UI writes directly into report truth. |
| Operations | Read-only health, freshness, blocker, and next-action signals. | Operations Control Tower. | Source domains own fixes; Operations summarizes. | High if Operations becomes a command center without explicit write design. |

## Data Freshness And Quality Expectations

| Signal | V1 Freshness Expectation | Risk Signal | Current Handling |
| --- | --- | --- | --- |
| Backend health | Public health must report app, DB, Redis/queue, and readiness state. | health not `ok`, Redis skipped unexpectedly, queue not durable when expected. | External monitor and readiness smokes cover controlled pilot. |
| Import batches | Latest import status and failed/error rows must be visible before relying on KPI/reporting outputs. | failed import, unresolved mapping, stale last successful import, unknown source. | Integration dashboard and Operations data-quality signal. |
| Snapshot/reporting | Users should know whether reporting is current enough for the decision being made. | missing latest period, failed materialization, stale snapshot, demo/source leakage. | Snapshot and reporting readiness signals; exact stale thresholds require owner decision. |
| KPI source trust | KPI-derived action should point back to accepted KPI source and period. | action candidate without source period, score, store/person context, or import lineage. | Store Action candidates derive from existing KPI signals. |
| Workflow/inbox | Queue items should preserve source type, owner, urgency, deep link, and status. | generic "approval" label for non-approval work, missing owner role, broken deep link. | Feature Integration Spine inbox rule. |
| Store Action plans | Store managers should see active plans, status controls, close/cancel reasons, and empty states. | plan without source, action outside assigned store, read-only role gets command controls. | Store Action V1B coverage and visibility evidence. |
| Auth/scope | Role and scope evidence must match the intended pilot persona. | frontend-visible route without backend authorization, stale role evidence after deploy/config change. | Fresh evidence exists for the six active pilot roles; rerun after auth, route, role, or deploy changes. |
| External providers | Provider state must be named as real, local, blocked, historical, or accepted risk. | treating tokenless smoke or free/non-persistent provider as broad-production proof. | External evidence closure decision keeps broad production No-Go. |

Numeric freshness thresholds are intentionally not invented here. When a feature
needs a numeric stale window, the owner must define the decision impact, source
cadence, user-facing copy, and verification path first.

## Pilot Stop Rules

Stop or split the pilot plan when:

- a role is used without current role/scope evidence,
- a region-scoped read is treated as store-scoped command authority,
- a command lacks a forbidden/foreign-scope negative case,
- a stale or failed source is presented as current truth,
- a support role becomes a default pilot actor without product alignment,
- broad-production provider decisions are treated as closed by controlled-pilot
  evidence.

## Next Use

Before adding Norm Kadro, Coaching, new reports, new workflows, or another
business module, pair this scenario pack with the Feature Growth Checklist V1.
The scenario pack answers "who does what in the pilot?" The checklist answers
"how does new work enter safely?"
