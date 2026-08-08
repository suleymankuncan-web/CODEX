# Target Reference Supersession Specification V1

Status: `approved_spec`
Shelf: decision
Decision slice: `TREF-1`
Last verified: 2026-07-13
Owner approval: 2026-07-13
Author: Codex root coordinator
Read-only planning review: `problem_solver_high` when a High-risk review trigger exists; otherwise Sol/root owns planning at High.

## 1. Objective

Define a testable, append-only lifecycle for monthly personnel target
references before any runtime, migration, or staging work begins. The lifecycle
must preserve approval history, keep closed snapshots anchored, handle manager
and store rotation honestly, and prevent concurrent approvals from overwriting,
forking, or duplicating the active reference.

This document is the approved specification for a later implementation plan.
It is not implementation authority: no runtime, API, migration, DML, or staging
work begins from TREF-1 alone.

## 2. Boundaries

In scope:

- monthly `ops.personnel_target_reference` revisions;
- ordinary target-distribution approval and pilot-roster target writers;
- live reads and snapshot reference identity;
- primary/support store and region-manager responsibility changes;
- transaction, concurrency, failure, audit, and rollback contracts.

Out of scope:

- runtime implementation, migration, DML, staging execution, or backfill;
- automatic correction of existing references;
- target recommendation, proration, compensation, or incentive formula change;
- ORG/ASSIGN winner inference;
- production operations or provider changes.

## 3. Repository Truth

### 3.1 Existing schema capability

`ops.personnel_target_reference` already provides:

- immutable row identity through `personnel_target_reference_id`;
- `approved`, `superseded`, and reserved `voided_future` states;
- a self-reference through `supersedes_target_reference_id`;
- one active `approved` row for the exact
  employee/period/type key through a partial unique index;
- snapshot anchoring through
  `rpt.employee_kpi_snapshot.personnel_target_reference_id`.

This is minimally sufficient for an application-enforced, whole-month,
one-predecessor/one-successor chain. It does not enforce graph integrity or
record a complete revision lifecycle by itself.

### 3.2 Current unsafe lifecycle behavior

| Writer | Current behavior | Gap |
| --- | --- | --- |
| Ordinary region approval | `ON CONFLICT ... DO UPDATE` | Rewrites the active row and loses prior approved values. |
| Pilot roster import | `ON CONFLICT ... DO UPDATE` | Bypasses append-only history through a second writer. |
| Live reporting/scoring | Reads `status = 'approved'` | A replacement changes subsequent live reads for that month. |
| Snapshot materialization | Stores reference ID | Existing snapshot can preserve the earlier version. |

Fixing only the ordinary approval writer is insufficient. Every active writer
must share the lifecycle or be explicitly blocked from replacing a reference.

### 3.3 Missing database guarantees

The current schema has no database constraint for:

- one successor per predecessor;
- same employee/period/type across a supersession link;
- fork or cycle rejection;
- revision reason, revision time, or base-version provenance;
- a formal period-close state;
- partial-month target-effective intervals.

A migration is not required for the selected first implementation contract.
The existing request evidence JSON, audit log, partial unique index, snapshot
foreign key, and transaction locks are sufficient for application-enforced
whole-month supersession. Database-enforced graph/provenance hardening remains
a separate optional R5 decision and is not authorized here.

## 4. Locked Decisions

- **D-TREF-01 — Complete request version:** a later target for the same month is
  a new, reasoned request/version containing the intended complete allocation
  snapshot. Duplicate employees inside one request remain rejected.
- **D-TREF-02 — Single active identity:** at most one `approved` reference may
  exist for employee/month/target type.
- **D-TREF-03 — Append-only replacement:** a new approval never overwrites or
  deletes the earlier approved business fields. The predecessor becomes
  `superseded` and the new row links it atomically.
- **D-TREF-04 — Snapshot immutability:** an existing snapshot retains its
  stored reference ID. A later revision never silently recalculates it.
- **D-TREF-05 — Support is secondary:** a support-store assignment does not
  move target ownership. It remains secondary and does not replace the primary
  reference.
- **D-TREF-06 — Inclusive assignment dates:** an old primary assignment owns
  its final day. A successor primary starts no earlier than the following day;
  same-day predecessor-end/successor-start is invalid.
- **D-TREF-07 — Primary rotation:** an approved rotation may make another store
  primary. An ownership-only replacement preserves target value unless a
  separately reasoned value revision is approved.
- **D-TREF-08 — Manager responsibility:** region ownership means the effective
  region-manager portfolio. The manager effective at month end owns the whole
  month. A later manager change does not rewrite a prior closed month.
- **D-TREF-09 — Historical approver:** `approved_by_user_id` remains the actor
  who approved that reference version. Later manager changes never rewrite it.

## 5. Approved Owner Decisions

The owner approved all six selections on 2026-07-13. On the same date, before
implementation, the owner approved U-07 through U-09 and the additive
`revision-basis` read contract below to resolve fresh writer/API contradictions.

### U-01 — Period close: `completed_snapshot`

A company/period is closed once a `monthly` snapshot with the exact period and
`run_status = 'completed'` exists for that company. A global snapshot whose
`company_ids` is empty closes every company in its exact period; otherwise the
company must be present in `company_ids`. Failed, queued, running, daily, or
different-period runs do not close the period.

### U-02 — Open-month revision: `whole_month_latest_approved`

For an open month, the latest approved reference version becomes the
whole-month live reference. There is no daily split or proration. Snapshots
that already exist retain their stored reference ID.

### U-03 — Closed/past revision: `explicit_rerun_only`

The ordinary create/approve flow MUST reject a revision once U-01 is true. A
closed-period revision requires a separately specified and authorized audited
rerun workflow. That future workflow MUST retain the old snapshot and create a
new rerun linked through `rerun_of_snapshot_run_id`. TREF-1 and its first
implementation do not authorize or implement that workflow.

### U-04 — Explicit removal: `supersede_without_successor`

A complete revision MAY remove a previously targeted employee only when the
request explicitly lists that employee in `removedEmployeeIds` and carries a
non-empty revision reason. The omitted predecessor becomes `superseded`
without a successor, and approval evidence plus the audit event records the
terminal removal. The employee then has no active target reference and live
reads use the existing `missing_reference` behavior. Silent omission or an
extra removal introduced only during adjusted approval MUST fail closed.

### U-05 — Pilot import: `initial_create_only`

Pilot import MAY create a reference only when none is active for the exact
employee/month/type key. An identical replay is an idempotent no-op. A
different value, store, region, source request, or other replacement collision
MUST return a typed conflict and use the ordinary reasoned approval workflow.
Pilot import MUST NOT supersede or update an active reference.

### U-06 — Manager-only change: `responsibility_only`

A manager-only change creates no target-reference version. The new effective
manager owns subsequent requests and approvals through fresh action scope.
Existing target rows and `approved_by_user_id` remain unchanged. Month-end
portfolio ownership is derived from effective-dated manager responsibility,
not by rewriting reference history.

### U-07 — Employee primary eligibility: `approval_business_date`

Employee target ownership MUST be validated inside the approval transaction at
the database business date in `Europe/Istanbul`. Only the effective active
primary assignment for the request store qualifies. A secondary support
assignment never qualifies. A rotation may qualify the new primary only when
the predecessor end date is earlier than the successor start date; same-day
predecessor-end/successor-start remains invalid.

### U-08 — Revision set: `complete_base_plus_eligible_new`

Every employee represented by the locked active base references MUST appear in
the final allocations or explicit removals. Final allocations MAY also contain
a newly eligible primary employee with no active predecessor. That employee is
inserted as a new root reference only after fresh transactional eligibility and
active-key checks. Removed employees MUST belong to the base set and MUST be
disjoint from allocations. Silent omission fails closed.

### U-09 — Typed conflicts: `allowlisted_existing_envelope_code`

The standard error-envelope shape remains unchanged. Its existing `code` field
MAY carry only the six TREF conflict codes defined in Section 9. The shared
filter MUST reject arbitrary exception-provided codes and preserve existing
generic codes for every other domain.

## 6. State And Truth Tables

| Scenario | Required result |
| --- | --- |
| First approval; no active reference | Insert `approved` row with null predecessor. |
| Same request approved twice | Typed `already_approved` conflict; no second row or audit event. |
| Duplicate employee in one request | Reject before repository write; DB-C5 remains backstop. |
| Later approved same-month request; period open | Atomically supersede old and insert linked successor; new version owns the whole-month live read. |
| Two concurrent approvals | Serialize; never overwrite, fork, cycle, or leave two active rows. |
| Secondary support begins | No target-reference change. |
| Primary rotation becomes effective | Old primary ends the prior day; replacement candidate uses new primary, subject to period policy. |
| Manager changes in same region | Preserve old approver and row; new manager owns later commands. |
| Existing snapshot references old row | Snapshot FK remains unchanged. |
| Completed monthly snapshot exists | Ordinary revision is rejected; only a separately authorized rerun workflow may proceed. |
| Revision explicitly removes employee | Supersede predecessor without successor; persist reason/evidence; live read becomes `missing_reference`. |
| Revision silently omits employee | Reject the request or adjusted approval before lifecycle writes. |
| Pilot import replays exact active reference | Idempotent no-op. |
| Pilot import conflicts with active reference | Typed conflict; never `DO UPDATE` business fields. |
| Failure after predecessor status change | Roll back entire transaction; predecessor remains approved. |

## 7. Functional Requirements

- **FR-01:** The service MUST approve a request only from the expected
  `pending_region_approval` state.
- **FR-02:** The service MUST validate total, complete allocations, distinct employees,
  employee identity, store scope, current action authority, and effective primary-store
  eligibility at the approval transaction's Europe/Istanbul business date before writes.
- **FR-03:** The lifecycle MUST preserve exactly one active reference per
  employee/month/target type.
- **FR-04:** An allowed replacement MUST create a linked append-only successor and MUST NOT update
  predecessor business fields in place.
- **FR-05:** The transaction MUST use deterministic locks and old-value predicates for request,
  employee, predecessor, and status transitions.
- **FR-06:** The system MUST preserve snapshot reference identity; rerun is always separate,
  explicit, and auditable.
- **FR-07:** The lifecycle MUST treat support as a no-op and MUST validate next-day primary rotation.
- **FR-08:** The system MUST apply month-end manager responsibility without rewriting the
  historical approver.
- **FR-09:** The implementation MUST inventory every target-reference writer and eliminate or block
  every `ON CONFLICT ... DO UPDATE` replacement path.
- **FR-10:** The transaction MUST emit an audit record that links request, predecessor, successor,
  reason class, actor, and transaction outcome without PII payloads.
- **FR-11:** The service MUST fail with stable typed conflicts for stale request, stale base,
  missing authority, chain mismatch, duplicate active, or period-policy denial.
- **FR-12:** The implementation PR MUST NOT repair existing data or execute staging DML/DDL in the
  implementation PR.
- **FR-13:** A revision request MUST persist its exact base reference IDs,
  explicit removed employee IDs, and non-empty reason in request evidence. The complete
  base set MUST reconcile to retained allocations plus explicit removals, while a freshly
  eligible new primary employee MAY appear only as an allocation with no predecessor.
- **FR-14:** An adjusted approval MUST NOT add an unlisted removal; its final
  allocation plus explicit removals MUST reconcile the complete active set.
- **FR-15:** The ordinary flow MUST reject a company/period with an exact
  completed monthly snapshot.
- **FR-16:** Pilot import MUST be initial-create-only, with exact replay as a
  no-op and any replacement collision as a typed conflict.

## 8. Non-Functional Requirements

- **NFR-01 — Atomicity:** request approval, predecessor transition, successor
  insert, and audit event commit or roll back together.
- **NFR-02 — Concurrency:** deterministic lock order prevents forks and two
  active references; no last-writer-wins behavior.
- **NFR-03 — Compatibility:** no permission, API response shape, scoring
  formula, snapshot identity, or provider contract broadening.
- **NFR-04 — Privacy:** new TREF lineage/audit/log fields contain no person label,
  store label, credential, target amount, raw allocation, or personnel attribute. Existing
  approval evidence intentionally retains its legacy original/final totals and allocations;
  implementation MUST preserve that audit contract without duplicating those values into
  the new TREF lineage or audit metadata.
- **NFR-05 — Bounded work:** one transaction, sorted employee locks, no more
  than one status transition and one insert per allocation/removal, and no
  unbounded retry loop.
- **NFR-06 — Reversibility:** one squash revert removes code behavior; command
  failure rolls back without a repair transaction.
- **NFR-07 — Schema safety:** the first implementation MUST use the existing
  schema. Any later graph-hardening migration is a separate R5 PR with
  disposable rehearsal, lock/timeout plan, and rollback.
- **NFR-08 — Writer completeness:** ordinary approval and import cannot use
  different silent replacement semantics.

## 9. API And Command Contracts

TREF-1 changes no API. A later implementation MAY add the following optional
revision input to the existing `POST /api/target-distributions/requests`
request; ordinary first requests remain backward compatible.

```ts
interface TargetRevisionInputV1 {
  baseReferenceIds: string[];   // exact UUID set shown to the requester
  removedEmployeeIds: string[]; // explicit terminal removals, may be empty
}

interface CreateTargetDistributionRequestV2 {
  storeId: string;
  requestMonth: string;
  targetLabel: string;
  totalTargetValue: number;
  requestReason?: string;
  allocations: Array<{
    employeeId: string;
    assigneeLabel: string;
    targetValue: number;
    note?: string;
  }>;
  revision?: TargetRevisionInputV1;
}
```

When `revision` exists, `requestReason` MUST be non-empty. Every employee
represented by `baseReferenceIds` MUST appear in allocation employee IDs or
`removedEmployeeIds`; allocations MAY additionally contain a freshly eligible
primary employee with no active reference. Removed IDs MUST be base employees,
MUST be disjoint from allocations, and the server resolves every ID without
trusting client-supplied scope or identity labels.

The implementation adds one action-scoped read without changing existing
response shapes:

```ts
GET /api/target-distributions/revision-basis?storeId={uuid}&requestMonth={date}

interface TargetRevisionBasisItemV1 {
  employeeId: string;
  targetReferenceId: string;
  displayName: string;
  targetValue: number;
}

interface TargetRevisionBasisV1 {
  storeId: string;
  requestMonth: string;
  periodClosed: boolean;
  items: TargetRevisionBasisItemV1[];
}
```

The endpoint returns the complete active reference set for the exact
company/store/month, including references whose employee is no longer in the
current store roster and an active predecessor whose employee's single
effective primary assignment has rotated into the requested store. This
rotation lookup never treats support as primary. It requires the existing
store action scope and returns no historical superseded rows.

The existing approval endpoint response shape remains unchanged. Adjusted
approval MAY change values but MUST NOT introduce a removal that is absent from
the stored revision evidence.

Typed failures for the future implementation:

```ts
type TargetRevisionConflictCode =
  | "target_revision_period_closed"
  | "target_revision_stale_base"
  | "target_revision_incomplete"
  | "target_revision_chain_conflict"
  | "target_revision_active_conflict"
  | "target_revision_import_replacement_forbidden";
```

These codes use the repository's existing standard error envelope. TREF-1
does not change HTTP status mappings; the implementation plan must map
validation failures to `400`, stale/conflicting state to `409`, authorization
to existing `401/403`, and unexpected storage failure to fail-closed `5xx`.

## 10. Data Models

No table or column is added by this specification.

| Model/field | Type | Selected constraint |
| --- | --- | --- |
| `personnel_target_reference_id` | UUID | Immutable row identity. |
| `source_request_id` | UUID FK | Owning approved request/version. |
| company/region/store/employee IDs | UUID FK | Successor must match approved request and selected primary ownership. |
| `period_start`, `period_end` | DATE | Exact full calendar month; no partial/prorated interval. |
| `target_value` | NUMERIC(18,4) | Positive; immutable after insert. |
| `target_type` | TEXT | `monthly_sales_target` in V1. |
| `status` | TEXT | One of `approved`, `superseded`, `voided_future`; first implementation uses approved/superseded. |
| `supersedes_target_reference_id` | UUID self-FK | Exact predecessor for replacements; null for roots and explicit terminal removals create no row. |
| snapshot reference ID | UUID FK | Never rewritten by ordinary revision. |

Revision submission evidence MUST be persisted as a `targetRevision` member in
the existing `target_distribution_request.approval_evidence_json`. Existing
legacy approval totals/allocations remain unchanged; the new member contains no
names, labels, target amounts, raw allocations, or personnel attributes:

```ts
interface TargetRevisionEvidenceV1 {
  mode: "initial" | "revision";
  baseReferenceIds: string[];
  removedEmployeeIds: string[];
  reasonPresent: boolean;
  predecessorSuccessorLinks: Array<{
    predecessorId: string;
    successorId: string | null; // null only for explicit removal
  }>;
}
```

The existing audit event stores actor, request, scope, reason class, and the
same predecessor/successor IDs. It MUST NOT store labels, target amounts, raw
allocations, or personnel attributes.

## 11. Transaction Contract

The later implementation MUST:

1. Begin one database transaction.
2. Lock the target request `FOR UPDATE` and require its old status to be
   `pending_region_approval` in both the read and final update predicate.
3. Check for an exact completed monthly snapshot under U-01. If one exists,
   return `target_revision_period_closed` before lifecycle writes.
4. Validate the full request, fresh action authority, stored base IDs, explicit
   removals, reason, totals, and complete-set reconciliation without mutation.
5. Sort the union of allocated and removed employee IDs and lock their stable
   `ops.employee` parent rows
   `FOR UPDATE` in that order. This supplies a common lock even when no active
   target reference exists.
6. Lock every relevant active target reference `FOR UPDATE` in the same sorted
   key order, including explicit removals.
7. Validate that each predecessor belongs to the same employee, company,
   period, and target type; reject self-links, stale bases, forks, and cycles.
8. Update each predecessor with
   `WHERE personnel_target_reference_id = ? AND status = 'approved' RETURNING`.
   Any count other than one is a typed conflict.
9. Insert an allocated employee's successor as `approved`, linking the exact
   predecessor. First approval inserts a null predecessor. For an explicitly
   removed employee, insert no successor and record the terminal link as null.
   Never use `ON CONFLICT DO UPDATE`.
10. Insert sanitized audit/revision evidence and update the request with its
    old-value predicate.
11. Commit only when every allocation, removal, evidence, and audit row
    succeeds. Any error rolls the complete transaction back.

The partial unique index remains a final fail-safe, not the lifecycle engine.
Recognized serialization/deadlock retries are allowed only if a later
implementation plan sets a small explicit budget; otherwise return a typed
conflict.

## 12. Acceptance Criteria

- **AC-01 (FR-01, FR-03, FR-04):** Given a pending first request and no active
  key, when an authorized manager approves it, then exactly one approved root
  reference exists and its predecessor is null.
- **AC-02 (FR-03, FR-04, FR-05, FR-13):** Given an open-period revision whose
  base IDs match the locked active rows, when approval commits, then every
  retained allocation has one linked successor, predecessor business fields
  are unchanged, exactly one active row remains per key, and sanitized audit
  evidence links the request, predecessor, and successor.
- **AC-03 (FR-06, FR-15):** Given an existing snapshot bound to reference A and
  an allowed open-period successor B, when live and snapshot reads execute,
  then live reads resolve B and the old snapshot still resolves A.
- **AC-04 (FR-05, NFR-02):** Given two concurrent approvals for the same key,
  when both transactions complete, then they serialize or one returns a typed
  conflict; no fork, cycle, overwrite, or duplicate active row exists.
- **AC-05 (NFR-01, NFR-06):** Given an injected failure after predecessor
  transition and before successor/audit completion, when the transaction
  aborts, then the exact pre-command request and reference state remains.
- **AC-06 (FR-01, FR-02, FR-11):** Given duplicate allocations or a replayed
  approved request, when validation runs, then it fails before a new reference
  or audit event is written.
- **AC-07 (FR-07):** Given a secondary support assignment, when target
  ownership is evaluated, then no target version or primary-store change is
  created.
- **AC-08 (FR-07):** Given a primary rotation, when the successor begins, then
  the predecessor ends on the prior day and a same-day overlap is rejected.
- **AC-09 (FR-08):** Given a manager-only change in the same region, when later
  reads and commands execute, then the historical approver/reference remains
  unchanged and the new manager owns only subsequent authorized commands.
- **AC-10 (FR-09, FR-16, NFR-08):** Given ordinary approval and pilot-import
  writers, when the writer inventory test scans them, then neither can replace
  an active row through `ON CONFLICT DO UPDATE`; pilot import supports only
  initial create and exact no-op replay.
- **AC-11 (FR-13, FR-14):** Given a revision that omits an active employee,
  when the employee is explicitly listed with a non-empty reason, then the
  predecessor becomes a terminal superseded row with no successor and live
  reads return `missing_reference`; otherwise the request fails closed.
- **AC-12 (FR-15):** Given an exact completed monthly snapshot for the company,
  when ordinary revision is attempted, then it returns
  `target_revision_period_closed` and changes no request, reference, snapshot,
  or audit state.
- **AC-13 (FR-12, NFR-03, NFR-07):** Given the TREF-1 diff, when repository verification
  runs, then it contains no runtime, API, schema, migration, DML, staging, or
  provider change.
- **AC-14 (FR-10, NFR-04, NFR-05):** Given a revision with many allocations,
  when command evidence and query shape are inspected, then locks are sorted,
  statements are bounded per allocation/removal, legacy approval evidence is
  preserved, and new TREF lineage/log/audit fields contain no names, labels,
  target values, raw allocations, or personnel attributes.

## 13. Edge Cases

- **EC-01:** Duplicate employee in request.
- **EC-02:** Same request approval replay.
- **EC-03:** Concurrent different requests for the same employee/month.
- **EC-04:** Predecessor key differs from successor key.
- **EC-05:** Failure after supersede and before insert.
- **EC-06:** Audit insertion failure.
- **EC-07:** Support assignment overlaps primary.
- **EC-08:** Primary rotation uses same-day predecessor end/successor start.
- **EC-09:** Manager-only change within one region.
- **EC-10:** Closed or past-period revision.
- **EC-11:** Complete revision omits an employee.
- **EC-12:** Pilot import collides with ordinary approval.
- **EC-13:** Self-link, fork, or cycle attempt.
- **EC-14:** Request status changes while approval waits for locks.
- **EC-15:** New employee has no predecessor while another request races.

## 14. Conditional Implementation Line

TREF-1 alone authorizes no implementation. The owner separately authorized the
bounded implementation on 2026-07-13 through
`docs/plans/target-reference-supersession-implementation-plan-v1.md`, which must:

1. Confirm the no-migration application-enforced schema verdict against fresh
   repository truth; any contradiction stops and opens a separate R5 plan.
2. Implement the shared lifecycle and ordinary approval with TDD.
3. Make pilot import initial-create-only with exact no-op replay.
4. Add repository, service, integration, concurrency, rollback, snapshot, and
   writer-inventory tests covering every FR/AC/EC identifier.
5. Run targeted DB/auth/scope tests, backend release, affected selector, root
   release, High review, and post-merge verification.
6. Run no staging evidence or mutation without separate explicit authority.

## 15. Rollback And Stop Rules

TREF-1 rollback is reverting its squash commit. A later implementation command
must rely on transaction rollback, not compensating destructive edits. A
mistaken committed business revision is corrected only by another authorized
append-only version under the selected period policy.

Stop and re-plan if:

- any `U-*` decision is unset or contradictory;
- partial-day/prorated semantics are selected;
- a formal close state or new provenance is required;
- a new writer is discovered;
- current schema cannot enforce the selected safety contract;
- implementation would change permissions, scoring formulas, snapshots, API
  shapes, or historical rows beyond this specification.
