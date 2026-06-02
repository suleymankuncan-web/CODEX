# Store Action Checklist Remediation Implementation V1

Status: execution-ready plan, runtime implementation pending
Shelf: Store Action

## Purpose

Implement the locked checklist remediation decision without changing checklist
acknowledgement meaning.

The implementation must create persisted Store Action work only from real
checklist findings after acknowledgement. It must not turn
`checklist_receipt` into a remediation task, invent low-score thresholds, or
add region-manager verification behavior.

## Repo Evidence

Current runtime state:

- `ops.store_action_plan.source_type` accepts only `kpi_exception`.
- `StoreActionPlanSourceType` accepts only `kpi_exception`.
- `CreateStoreActionPlanDto.sourceType` accepts only `kpi_exception`.
- OpenAPI generated client exposes Store Action source type as
  `kpi_exception`.
- The active duplicate prevention index is
  `idx_store_action_plan_active_source_unique` on
  `(store_id, source_type, source_id)` for active statuses.
- `checklist_receipt` is already a workflow acknowledgement source.
- `ops.checklist_response.is_non_compliant` is a persisted source fact.
- Store mobile checklist response currently saves score and comment only; it
  does not set `is_non_compliant`.
- Admin/manual checklist response path can persist `is_non_compliant`.
- `lowScoreThreshold` exists in admin UI draft/prototype language, but the
  backend DTO and DB schema do not persist `low_score_threshold`.

Implication:

- V1 generation may use `is_non_compliant = true` as a real finding source.
- V1 must not generate from score thresholds until a separate DB/API/source
  contract stores the threshold that owns "low" semantics.

## Protected Behavior

Do not change:

- checklist completion scoring,
- checklist acknowledgement command meaning,
- checklist receipt workflow inbox behavior,
- Store Action status lifecycle,
- Store Action resolution note requirement,
- assigned-store write scope,
- region-manager read-scope semantics,
- KPI exception Store Action behavior,
- target projection docs-only status.

## Source Shape

Add Store Action source family:

```text
sourceType = checklist_remediation
```

Source ID must be deterministic and duplicate-safe:

```text
checklist:{checklistInstanceId}:item:{templateItemId}
```

If future grouping by section is implemented in a separate PR, the grouped
source ID must still include the checklist instance and stable group key.

V1 source metadata should retain, through existing fields and visible summary
copy:

- checklist instance,
- store,
- template name/type/version when available,
- template item id,
- section name,
- item number,
- item text,
- response score/comment when available,
- source deep link back to the checklist surface.

No dedicated checklist source columns are required for V1. If the
implementation needs dedicated checklist source columns, stop and split into a
separate DB contract PR.

## Due Date Policy

Use a fixed V1 operational due date:

```text
dueOn = acknowledgement date + 7 calendar days
```

This is not SLA scoring. It only makes the existing Store Action lifecycle
usable. If the business later needs template-specific SLA days, add that as a
separate checklist-template contract PR.

## Priority Policy

For V1:

- `is_non_compliant = true` creates `high` priority remediation.
- Score-only low findings remain parked until threshold ownership is persisted.

Do not infer criticality from score percentage, max score, weight, section
name, or frontend labels.

## PR Sequence

### PR-1 Source Contract And Schema

Risk: DB/API contract, behavior-preserving.

Change:

- add `checklist_remediation` to `StoreActionPlanSourceType`,
- add migration/schema contract widening `source_type`,
- update Store Action DTO/OpenAPI/generated client contract,
- update contract tests.

Do not:

- create tasks,
- alter acknowledgement behavior,
- add UI fake rows,
- change existing `kpi_exception` behavior.

Verification:

- Store Action contract tests,
- Store Action schema contract tests,
- OpenAPI contract tests,
- generated client drift check,
- `npm.cmd run test:scripts`,
- `git diff --check`.

Rollback:

- Safe while no `checklist_remediation` rows exist.
- If rows exist later, rollback of source-type narrowing requires a data
  decision and must stop.

Expected score impact: +1 architecture point by making source ownership
explicit instead of UI-only.

### PR-2 Finding Extraction Characterization

Risk: backend pure logic, no writes.

Change:

- add a pure checklist remediation finding extractor,
- input uses completed checklist response/source rows,
- output only includes `isNonCompliant === true`,
- output builds deterministic source IDs and source summaries,
- add characterization tests for no findings, one finding, multiple findings,
  missing optional comment, and score-only low rows.

Do not:

- call Store Action repository,
- generate persisted tasks,
- infer low threshold from score.

Verification:

- extractor unit tests,
- checklist acknowledgement repository tests if source row shape changes,
- `git diff --check`.

Rollback:

- Delete pure extractor and tests. No DB or data repair.

Expected score impact: +1 architecture point by separating source logic from
acknowledgement command flow.

### PR-3 Acknowledgement Generation Orchestrator

Risk: workflow write behavior.

Change:

- after successful checklist acknowledgement, load real findings for that
  checklist instance,
- create one Store Action plan per finding using sourceType
  `checklist_remediation`,
- owner and creator are the acknowledging store manager,
- due date follows V1 due date policy,
- duplicate active task creation relies on deterministic source ID plus
  existing active-source unique constraint,
- duplicate conflict on retry/re-acknowledgement is treated as idempotent, not
  as a user-facing failure.

Do not:

- change acknowledgement response shape unless OpenAPI says it changed,
- require task acceptance,
- add evidence upload,
- add region-manager verification/reopen/reject,
- create tasks for score-only low rows.

Verification:

- acknowledge checklist with no non-compliant findings creates no Store Action,
- acknowledge checklist with non-compliant finding creates Store Action,
- repeated acknowledgement does not duplicate active tasks,
- unassigned store acknowledgement remains forbidden,
- existing checklist receipt inbox tests still pass,
- existing Store Action KPI exception tests still pass.

Rollback:

- Disable/remove generation path.
- Existing generated rows may remain as ordinary Store Action plans. If the PR
  requires deleting generated rows for rollback, stop before merge and split.

Expected score impact: +2 architecture points by closing the checklist action
loop with idempotent, source-owned writes.

### PR-4 Store Tasks And Read Surface Mapping

Risk: frontend/source label and read UX.

Change:

- show `checklist_remediation` as checklist remediation work where source type
  is visible,
- keep `checklist_receipt` acknowledgement language separate,
- ensure Store Tasks does not show fake checklist task rows,
- ensure close action still requires resolution note,
- include honest empty/loading/error states.

Do not:

- redesign Store Tasks outside the remediation mapping,
- change auth/route visibility,
- add photo upload or verification actions.

Verification:

- `npm.cmd --prefix admin-web run lint`,
- `npm.cmd --prefix admin-web run build`,
- targeted Store Tasks/Workflow Inbox tests or Playwright spec,
- mobile/desktop visual QA for Store Tasks.

Rollback:

- UI/source label removal only. Generated plans remain valid Store Action data.

Expected score impact: +1 architecture point by keeping source semantics
visible and avoiding acknowledgement/remediation copy drift.

### PR-5 Region Manager Informational Visibility

Risk: read scope.

Change:

- expose checklist remediation read information to region-manager scope only
  through an existing read surface or a narrowly scoped read addition,
- show reported-resolved language when a store manager closes a remediation,
- do not add approval, rejection, reopen, or verification.

Stop if:

- the implementation requires new write permissions,
- the implementation changes workflow inbox role visibility broadly,
- the implementation cannot prove region scope filtering with tests.

Verification:

- region manager sees own-region remediation read rows,
- region manager does not see other-region rows,
- store manager command scope stays assigned-store only,
- no verification/reopen action is exposed.

Rollback:

- Remove read-surface addition. No data repair.

Expected score impact: +1 architecture point by making the V1 informational
promise testable without expanding workflow semantics.

### PR-6 Closeout

Risk: docs/process.

Change:

- update `current-state.md`,
- add evidence doc with PR list, behavior preserved, verification, and parked
  risks.

Verification:

- `git diff --check`,
- `npm.cmd run test:scripts`.

Expected score impact: +0.5 architecture point by preserving handoff quality.

## Stop Conditions

Stop before runtime generation if any of these are true:

- `is_non_compliant` is not available for the checklist source path being used,
- score-threshold generation is requested before persisted threshold ownership
  exists,
- the implementation needs dedicated checklist source columns,
- the implementation needs region-manager verification/reopen/reject,
- duplicate prevention cannot be proven with deterministic source IDs,
- assigned-store write scope cannot be preserved,
- rollback requires data deletion or data repair,
- target projection implementation is pulled into the same PR train.

## Final Success Definition

The PR train is complete when:

- `checklist_remediation` is a real Store Action source type,
- acknowledgement remains acknowledgement-only,
- non-compliant checklist findings generate idempotent remediation Store
  Action plans after acknowledgement,
- no score-only/fake findings create tasks,
- store managers can close remediation with resolution notes,
- region managers have informational read visibility without verification
  workflow,
- targeted tests prove duplicate, scope, and source semantics,
- `current-state.md` records the shipped state and parked threshold/evidence
  decisions.
