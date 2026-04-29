# Target Reference Control Surface V1 Design

Date: 29 April 2026

Status: `approved_for_planning`

## Goal

Define how store and personnel targets become trusted scoring references for `TARGET_ACHIEVEMENT`.

The KPI scoring engine is already able to mark missing target references as `missing_reference`. This design defines the control surface that prevents those missing references from becoming invisible operational debt.

## Current State

Existing foundations:

- Store KPI import can carry store target and `TARGET_ACHIEVEMENT`-related facts from the PowerBI/Excel store export.
- Personnel performance intentionally does not let the employee edit their own target.
- Store managers can create target distribution requests for assigned stores.
- Region managers can approve store-submitted target distribution requests.
- `ops.target_distribution_request` records the submitted target request, total target, allocation count, allocation JSON, status, submitter, approver, and approval evidence.
- `/store/approvals` and `/admin/targets` already expose the first target distribution workflow surfaces.
- KPI scoring treats missing/unapproved target references as `missing_reference` rather than fabricating score.

Current gap:

- The target request itself is not yet a clean scoring reference contract.
- Personnel allocations are currently request payload evidence, not a first-class approved monthly personnel target reference.
- HR_ADMIN needs a way to see missing, draft, unapproved, and unusable target references before score trust is damaged.

## Locked Product Decisions

- Store target achievement uses the store target for the same period.
- Personnel target achievement uses approved personnel target for the same period.
- Store manager enters personnel target distribution for their assigned store.
- Region manager approves personnel target distribution for stores in their action scope.
- HR_ADMIN can see missing, draft, unapproved, and stale target states.
- Employees cannot edit target references.
- Missing target references remain `missing_reference`; no fallback, average, or guessed target is allowed.
- Closed snapshots must keep the target reference/version used at the time they were produced.

## Recommended V1 Shape

Use a two-layer model:

1. Workflow layer: target request and approval.
2. Scoring reference layer: approved target references.

The existing `ops.target_distribution_request` should remain the workflow/audit object.

After approval, the system should promote the approved request into explicit target reference rows that the reporting/scoring layer can read without parsing request JSON.

## Store Target Reference

V1 store target source:

- imported store target from the store KPI source file
- period-scoped
- store-scoped
- lineage-backed through import batch/source row evidence

Store target status examples:

```text
available
missing
imported_but_zero
out_of_scope_store
source_conflict
```

Store target scoring rule:

```text
store target achievement = store net sales / store target
```

If store target is missing, zero, or out of scope, the store target achievement metric must be `missing_reference`.

## Personnel Target Reference

Personnel target source:

- store manager submits monthly target distribution
- region manager approves
- approved allocation rows become the scoring source

The scoring layer should not depend on `assigneeLabel` alone.

Future implementation should require each personnel allocation to resolve to a real `employeeId` before it can become an approved scoring reference.

Minimum approved personnel target reference fields:

```text
targetReferenceId
sourceRequestId
companyId
regionId
storeId
employeeId
periodStart
periodEnd
targetValue
targetType
status
approvedByUserId
approvedAt
createdAt
supersedesTargetReferenceId
```

Suggested V1 `targetType`:

```text
monthly_sales_target
```

Suggested V1 statuses:

```text
approved
superseded
voided_future
```

`voided_future` is reserved for later correction/cancel-with-reason work. V1 should avoid destructive deletes.

## Approval And Correction Policy

Approval:

- Region manager approval promotes request allocations into approved target references.
- The request remains the audit/workflow record.
- The promoted reference rows become the scoring input.

Correction:

- Approved references should not be silently edited.
- A correction should create a new request/version that supersedes the previous reference for open/live periods.
- Already closed snapshots should remain anchored to the old reference unless an explicit rerun is requested.

This protects historical score trust.

## HR_ADMIN Visibility

HR_ADMIN needs an operational coverage view, not direct hidden mutation.

V1 HR_ADMIN view should show:

- period
- store
- store target status
- personnel count
- approved personnel target count
- missing personnel target count
- pending region approval count
- draft/submitted request status
- stale reference warnings
- unresolved `missing_reference` metric count

Recommended statuses:

```text
complete
missing_store_target
missing_personnel_targets
pending_region_approval
draft_not_submitted
stale_assignment
source_conflict
```

HR_ADMIN can use this view to chase missing data and supervise readiness.

V1 does not need HR_ADMIN to override region approval. If override is required later, it should be explicit, audited, and separate from normal approval.

## Scoring Read Behavior

For live reporting:

- Use the latest approved target reference for the period.
- If none exists, return `missing_reference`.
- Expose `missingReason`:
  - `store_target_missing`
  - `store_target_zero`
  - `personnel_target_missing`
  - `personnel_target_pending_approval`
  - `personnel_target_unmapped_employee`

For closed snapshots:

- Store the target reference id/version used by the snapshot.
- Do not recalculate automatically when a later correction arrives.
- Rerun must be explicit and auditable.

## Scope And Authorization

Store manager:

- can create/submit target distribution requests only for assigned action stores
- can see requests for assigned stores
- cannot approve their own request

Region manager:

- can approve requests only for assigned action stores
- can see pending/approved target references for their region/action stores

HR_ADMIN:

- can see target coverage and missing-reference readiness across their allowed company/scope
- can inspect request history and score impact
- does not silently override target references in V1

SUPER_ADMIN:

- may have future override powers, but V1 should keep the normal path clean first

STORE_PERSONNEL:

- can see whether their target is present/approved
- cannot edit or submit target references

## Error Handling

Do not score target achievement when:

- store target is missing
- store target is zero
- personnel target is missing
- personnel target request is pending approval
- allocation cannot be mapped to `employeeId`
- target period does not match KPI period

In all cases:

- return `missing_reference`
- expose a stable `missingReason`
- show score coverage/confidence as partial

## Non-Goals

V1 does not implement:

- HR override workflow
- target simulation
- bulk Excel target upload
- target recommendations
- mid-month proration for hiring/offboarding
- retroactive automatic snapshot mutation
- daily target distribution from monthly target
- compensation/prim payout rules

These may be designed later after the monthly target reference path is trusted.

## Acceptance Criteria For Future Implementation

- Approved personnel target references are queryable without parsing request JSON.
- Personnel target scoring requires `employeeId`, period, and approved status.
- Store target scoring requires same-period store target from imported target facts.
- HR_ADMIN can see missing/pending/stale target coverage by period and store.
- Live reporting returns stable `missingReason` values for missing target references.
- Closed snapshots anchor target reference id/version.
- Corrections create new versions or explicit reruns; they do not silently mutate historical scores.

## CODEX Durust Yorum

The current target request flow is a good beginning, but it should not be treated as the final scoring contract. Request JSON is useful for workflow evidence; scoring needs clean, queryable, approved references.

The most important V1 move is not adding a flashy target screen. It is separating "someone asked for/approved a target" from "this is the exact target reference used to score this person/store for this period." That separation keeps the project from getting messy later.
