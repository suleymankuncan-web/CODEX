# Rules / Config Boundary Decision V1

## Reader And Action

Reader:

- A future engineer deciding where a new KPI, checklist, target, competition,
  incentive, or workflow rule belongs.

After reading, they should be able to:

- place a rule in the current system without creating a generic rules engine,
- know which rule families are already domain-owned,
- know what evidence would justify a later shared rules/config boundary.

## Decision

Do not implement a generic rules engine now.

Do not create new `dm` or `config` schemas now.

Use domain-owned, typed, tested rules until a rule proves it needs independent
versioning, audit, simulation, approval/publish, rollback, or cross-module
reuse.

## Sokrates Decision

Claim:

- Rule/config drift is a real growth risk, but a generic engine is premature.

Assumptions:

- The project can keep growing safely if each rule family has a named current
  owner and migration trigger.
- The worst near-term failure is not lack of abstraction; it is hidden or
  duplicated rule placement.

Repo evidence:

- Operational truth, staging, reporting, and audit boundaries are already
  separated.
- KPI config has draft/publish and governance-preview work.
- Snapshot and score specs already care about config version anchoring.
- Workflow language already separates approval, acknowledgement, task, and
  notification.
- Competition package-plan approval and stage specs already define local
  decision rules.

Counterargument:

- A central rules engine could reduce duplication later. True, but only after
  rules are stable enough to share and version. Building it early would move
  unclear product policy into a powerful but under-specified layer.

Risk:

- LOW for this boundary decision.
- HIGH if treated as approval to add a rules engine or migrations.

Door:

- This decision is a two-way door.
- A real shared rules engine would be near one-way-door and needs explicit
  product and data governance alignment.

Stop rule:

- Stop if a future rule cannot identify owner, versioning need, audit need,
  rollback shape, and tests before implementation.

## Rule Families

| Rule Family | Current Home | Boundary Rule | Not Now |
| --- | --- | --- | --- |
| KPI thresholds, score profiles, grading bands | KPI config and KPI target ownership in the operational domain; snapshots anchor published interpretation when required. | Keep scoring interpretation typed, tested, and version-aware before business users can change historical meaning. | No generic scoring DSL. No silent retroactive interpretation changes. |
| Checklist weights and item scoring | Checklist template/version ownership. | Keep template weights with the checklist domain until score blending needs cross-module version governance. | No global weight engine. No automatic redistribution rules unless explicitly designed. |
| Target approval | Target distribution workflow and assigned-store action scope. | Approval rules stay with target distribution while the workflow is region/store-action scoped. | No multi-step approval engine until delegated approval chains are real. |
| Competitions | Competition service/repository and package-plan approval lifecycle. | Stage/package/team rules stay competition-owned; snapshots/read models consume results. | No cross-module rule table for stage progression or score recalculation yet. |
| Incentives / prim | Intake/spec only. | Do not implement payout rules until owner, formula, exceptions, audit, and payout lifecycle are defined. | No incentive engine, DB schema, or payout API from assumptions. |
| Workflow inbox routing | Source workflows plus shared workflow language. | Inbox maps source status into shared queue language; source flows keep their own state machines. | No central workflow engine or notification service yet. |
| Runtime/provider configuration | Environment config and backend config service. | Runtime config stays outside business-editable UI. | No DB-backed runtime config editor. |

## Promotion Triggers

Consider a shared rules/config boundary only when at least three are true:

1. The same rule is consumed by multiple modules.
2. A business user edits it.
3. It needs draft/publish or approval lifecycle.
4. It must be simulated before publish.
5. Audit must answer which rule version produced an outcome.
6. Rollback to an older rule version is required.
7. Historical reports must display old and new interpretations side by side.

## First Code Slice Later

The first implementation slice should not be a rules engine.

Recommended first code/product slice when needed:

- add a small read-only governance panel or guard for one existing rule family
  that is already being edited, such as KPI config, and prove it with existing
  admin tests.

Do not combine this with DB schema, auth, API shape, or reporting math changes.
