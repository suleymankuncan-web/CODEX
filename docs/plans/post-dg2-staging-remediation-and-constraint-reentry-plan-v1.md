# Post-DG2 Staging Remediation And Constraint Re-entry Plan V1

Status: `completed_with_excluded_or_blocked_families`
Shelf: architecture
Author: Codex
Reviewers: Product owner (`REM-1A approved 2026-07-12`; `REM-1B continuation approved 2026-07-12`; all REM-2 owner decisions locked 2026-07-12)
Use when: classifying and correcting the DG2-C staging invariant findings, then deciding whether database constraint work may re-enter
Do not use when: changing production, auto-repairing data, treating 70 check hits as 70 people, or mixing DG1-C runtime removal into database work
Source of truth: merged PRs #951 and #952, `docs/evidence/readiness/2026-07-11-dg2-staging-invariant-preflight-v1.md`, and the reviewed repository contracts listed below
Last verified: 2026-07-12
Target executor: an autonomous implementation agent operating under the repository discipline
Implementation authority: standing owner authorization covers the remaining in-scope staging train once every named technical prerequisite is proven; production and paid services remain excluded, and no missing evidence/manifest/restore/rollback/concurrency prerequisite is waived

## 1. Reader And Required Outcome

This plan turns the completed DG2-C No-Go evidence into a controlled remediation
program. It does not reinterpret the evidence as permission to edit staging.

The executor must deliver, in order:

1. a deeper read-only diagnosis that explains each finding without exposing
   personnel data, raw IDs, secrets, or connection details;
2. an owner decision packet that locks the business meaning and correction
   direction for every affected family;
3. separately approved, family-bounded staging corrections with exact before,
   attempted, committed, after, and rollback evidence;
4. a versioned reconciliation that preserves the V1 baseline and proves zero
   only for the families proposed for constraint enforcement;
5. lock, compatibility, validation-cost, and rollback evidence before any
   database constraint is proposed; and
6. a separate DG1-C provider-usage track that never shares a database
   remediation PR.

The desired end state is not merely `70 -> 0`. The desired end state is:

- every corrected row has an approved semantic reason;
- every preserved row has an explicit preserve/supersede/rebuild decision;
- the immutable V1 preflight remains available for continuity, while every
  enforcement-eligible family is zero under its owner-approved active query
  version;
- constraint enforcement is either safely approved family by family or remains
  honestly blocked; and
- production remains untouched.

## 2. Current Baseline

The approved read-only staging run completed on 2026-07-12 against the reviewed
implementation from PR #950. It proved `verify-full`, an external CA,
owner-confirmed staging identity, `BEGIN READ ONLY`, bounded timeouts, one pool
connection, and sanitized output.

The result was 70 **check hits**, not 70 confirmed bad people or 70 unique
records:

| Check | Hits | Current meaning | Current gate |
| --- | ---: | --- | --- |
| `TARGET-02` | 54 | Stored allocation count differs from the allocation JSON array length. | No-Go until lineage and canonical ownership are approved. |
| `ORG-04` | 11 | A scoped operational, reporting, staging, or audit row disagrees with its referenced organization hierarchy. | No-Go; source table and historical semantics are unknown. |
| `ORG-02` | 3 | An assignment disagrees with store/region/employee/position organization scope. | No-Go; correction direction is unknown. |
| `ASSIGN-01` | 2 | Two active primary-assignment pairs overlap under the current inclusive date-range check. | No-Go; temporal semantics are unapproved. |
| All other checks | 0 | No hits in the reviewed staging snapshot. | Zero alone does not approve DDL. |

The four non-zero counts sum to 70, but one business entity may participate in
multiple checks. Future receipts must continue to call these values check hits
unless a reviewed correlation query proves a distinct-record count.

### 2.1 Repository facts already verified

- PR #952 merged REM-1A at merge commit
  `09800d367e5250f5bd08e1412d86323d86f9262f`. The merged implementation owns
  the versioned diagnostic SQL, runner, strict contract/allowlists, and
  adversarial fixtures. Required PR checks and post-merge verification passed.
- `codex/rem-1b-staging-diagnostic-evidence` was created from that exact merge
  commit. It is the only active REM-1B evidence branch and starts with no
  runner/query change.
- PR #953 merged the completed REM-1B receipt at
  `5f972273e4aad8e97049b764fbe7bfee6d374a37`. The active work is now the REM-2
  owner-option packet; the merged evidence branch is no longer an execution
  surface and no second diagnostic is authorized.

- New target-distribution requests write `allocation_count` from
  `input.allocations.length` and write the same allocation collection to
  `allocation_json` in one transaction.
- Adjusted approvals update the count and JSON together from
  `approvedAllocations`; direct approvals retain both existing values.
- Downstream allocation materialization reads `allocation_json`, while request
  list/inbox views also expose `allocation_count`. Neither field may be
  discarded casually.
- `ASSIGN-01` currently uses an inclusive PostgreSQL date range (`[]`) for both
  start and end. A row ending on the same date another starts can therefore be
  reported as overlapping.
- Assignment ingestion derives `region_id` from the selected store, but other
  write paths and older records exist. Ingestion behavior alone does not prove
  which side of an existing mismatch is historically correct.
- The DG2 decision says staging contains real data. The 70 hits must not be
  dismissed as presentation/demo data. The already completed Norm Kadro fake
  percentage removal is a different concern.

## 3. Locked Guardrails

1. The executor MUST NOT run staging DML until the applicable family decision,
   exact correction manifest, restore point, rollback rehearsal, and owner-run
   window are approved.
2. The executor MUST NOT run any production query, DML, DDL, migration, restore,
   or smoke operation under this plan.
3. Read-only diagnosis MUST reuse the verified TLS/target-identity safety
   contract. A raw database URL, CA body, credential, raw UUID, employee field,
   or business payload MUST NOT enter Git, logs, PR text, or evidence.
4. No correction direction may be inferred solely from the side that is easier
   to update.
5. Operational rows, reporting snapshots, staging lineage, and audit records
   MUST NOT be treated as interchangeable. Historical or audit data is never
   rewritten merely to make a constraint pass.
6. A zero count authorizes only the next decision gate. It does not
   automatically authorize a constraint.
7. Each PR MUST tell one risk story and remain independently reviewable and
   reversible.
8. GitHub Codex review MUST NOT be requested or awaited. Local review, relevant
   tests, required GitHub checks, mergeability, and deployment evidence where
   applicable remain mandatory.
9. After a PR opens, checks are monitored in the background while independent
   next-PR preparation continues in a separate worktree. Dependent live data
   work still waits for its predecessor and approval. Two full release suites
   MUST NOT run concurrently.
10. A docs-only PR does not run the full frontend release merely by convention;
    the repository affected-scope selector and canonical required checks decide
    the gate.
11. The V1 query and receipt are immutable evidence. A business decision that
    changes invariant meaning MUST create a separately reviewed query/spec
    version; it MUST NOT edit V1 evidence or silently weaken a check.
12. A family classified as `preserve_excluded` or `blocked` MUST remain outside
    constraint enforcement. Global zero MUST NOT be manufactured by rewriting
    valid history or audit data.
13. A live correction MUST either run in an approved write-quiesced window or
    prove fail-closed concurrency control with deterministic row locks and
    old-value predicates. A time window alone is not concurrency control.

### 3.1 Standing authorization addendum — 2026-07-12

The product owner directed the executor to stop requesting repeated approvals
and granted standing authorization for the remaining in-scope staging steps
through plan completion. In this document, later phrases such as "separate
owner action", "owner approval", or "commit authority" are satisfied by that
standing authorization only after the exact package-specific factual gates are
proven and recorded. The authorization does not:

- identify an unknown row winner or replace authoritative lifecycle evidence;
- approve an unknown or drifting manifest before its exact digest exists;
- waive fresh backup/restore, rollback-only rehearsal, writer-pause,
  deterministic-lock, old-value-predicate, side-effect, or reconciliation
  checks;
- permit a retry of a failed one-shot execution from the same reviewed SHA;
- purchase or enable a paid service; or
- permit any production operation.

The executor proceeds automatically when every required fact is true and stops
only for missing authoritative data, a failed safety check, or an out-of-scope
operation—not for another ceremonial approval prompt.

## 4. Functional Requirements

### 4.1 Scope and evidence

- **FR-SCOPE-01:** The program MUST preserve the PR #951 receipt as the immutable
  baseline and MUST create new dated evidence rather than editing old results.
- **FR-SCOPE-02:** Every report MUST distinguish check hits, distinct source
  records, and distinct people. It MUST NOT claim the latter two without
  reviewed proof.
- **FR-SCOPE-03:** DG1-C usage evidence MUST remain an independent branch, PR,
  decision, and rollback story from all database work.
- **FR-SCOPE-04:** Production MUST remain out of scope even after staging reaches
  zero.

### 4.2 Read-only diagnostic expansion

- **FR-DIAG-01:** A reviewed diagnostic query/runner MUST bucket every non-zero
  check by approved reason code, source class, and count while remaining
  read-only.
- **FR-DIAG-02:** `TARGET-02` MUST be bucketed by request status, coarse creation
  vintage, approval mode/evidence presence, stored-count versus JSON-length
  delta, and attributable write source when evidence exists. Unknown source
  MUST remain `legacy_or_unknown`; it MUST NOT be guessed.
- **FR-DIAG-03:** `ORG-02` MUST separately count assignment-region/store-region,
  region-company/store-company, employee-company/store-company, and
  position-company/store-company mismatches, including a multiple-reason
  bucket.
- **FR-DIAG-04:** `ORG-04` MUST be bucketed by source table and mismatch reason.
  Operational, reporting snapshot, staging lineage, and audit rows MUST be
  distinguishable.
- **FR-DIAG-05:** `ASSIGN-01` MUST distinguish same-day-boundary-only overlap,
  strict multi-day overlap, open-ended overlap, same-scope overlap, and transfer
  across scope. It MUST expose no employee identity.
- **FR-DIAG-06:** The diagnostic MUST report aggregate cross-family/source-row
  co-occurrence so the total is not mistaken for a unique-record count. It MAY
  omit correlation when safe correlation cannot be proven, but must then state
  `distinct_count_unresolved`.
- **FR-DIAG-07:** Each bucket MAY include at most five bounded 12-character
  sample references generated by the reviewed query/reference builder and
  validated by the strict sanitizer. It MUST include no raw identifiers or PII.
- **FR-DIAG-08:** The diagnostic receipt MUST include reviewed commit, target
  class, TLS mode, certificate verification state, read-only proof, timeout
  profile, query-set version, family totals, and an allowlisted receipt digest.
- **FR-DIAG-09:** A pre-parse secret/PII scan and strict output-schema allowlist
  MUST reject unsafe output before evidence is written.
- **FR-DIAG-10:** Diagnosis MUST inventory triggers, generated columns,
  downstream materializations, and write paths that could affect each proposed
  correction. This inventory is metadata/code analysis, not mutation.
- **FR-DIAG-11:** A multi-statement diagnostic MUST run in one explicit
  `REPEATABLE READ READ ONLY` transaction and prove `transaction_isolation` plus
  `transaction_read_only`; alternatively the complete result MUST be one SQL
  statement. Successive default `READ COMMITTED` snapshots are not accepted as
  one diagnostic snapshot.

### 4.3 Owner decision packet

- **FR-DEC-01:** `TARGET-02` MUST receive a source-of-truth decision for each
  diagnostic bucket: preserve, set count from verified JSON, rebuild both from
  an authoritative source, or block. The provisional technical recommendation
  is to treat JSON as canonical only where write/audit evidence proves it; this
  recommendation is not an approval.
- **FR-DEC-02:** `ASSIGN-01` MUST receive an explicit business definition of
  `start_date`, `end_date`, same-day transfers, primary assignment, and active
  status before any row or constraint changes.
- **FR-DEC-03:** `ORG-02` MUST receive an approved hierarchy authority and
  correction direction per bucket. Store/region master data, employee company,
  position company, and assignment history MUST NOT silently overwrite one
  another.
- **FR-DEC-04:** `ORG-04` MUST receive a disposition per source class:
  `correct_operational`, `preserve_historical`, `rebuild_derived`,
  `supersede_lineage`, or `blocked`.
- **FR-DEC-05:** `TARGET-03`, although zero, MUST receive an ownership decision
  on whether duplicate employees inside one allocation request are rejected at
  application validation, database enforcement, both, or neither.
- **FR-DEC-06:** The owner MUST approve the staging mutation window, operator,
  restore method, acceptable recovery-point objective, and rollback authority.
- **FR-DEC-07:** Every decision MUST name its approver role, evidence basis,
  decision date, affected buckets, and expiry/revisit trigger.
- **FR-DEC-08:** Every non-zero bucket MUST receive an invariant interpretation:
  `data_defect_correct`, `valid_under_revised_semantics`, `preserve_excluded`,
  or `blocked`. `valid_under_revised_semantics` requires a versioned query/spec
  PR with adversarial fixtures and an explicit V1-to-new-version count bridge.

### 4.4 Family-bounded correction execution

- **FR-EXEC-01:** Each approved family MUST use a separate correction package.
  `TARGET-02`, `ORG-02`, `ORG-04`, and `ASSIGN-01` MUST NOT share a live
  transaction or correction receipt.
- **FR-EXEC-02:** A correction package MUST contain a reviewed parameterized
  runner/runbook, a secure out-of-Git exact-row manifest, preconditions,
  expected row counts, postconditions, and a compensating rollback artifact.
- **FR-EXEC-03:** The manifest MUST capture old and intended values securely
  outside Git. The Git diff and evidence MUST contain only counts, reason codes,
  and bounded references.
- **FR-EXEC-04:** Before commit authority, the exact package MUST complete a
  rollback-only rehearsal in a single transaction against staging and prove
  that attempted rows equal the approved manifest and unexpected rows equal
  zero.
- **FR-EXEC-05:** Commit authority MUST be a separate explicit owner action
  after the rehearsal receipt is reviewed. A prior approval of this plan is not
  commit authority.
- **FR-EXEC-06:** A committed execution MUST immediately run family-specific
  postconditions and the canonical affected checks. Any mismatch stops the
  train.
- **FR-EXEC-07:** Corrections MUST preserve auditability. Existing audit or
  reporting snapshots may be preserved and superseded rather than rewritten
  when the owner decision requires historical truth.
- **FR-EXEC-08:** The operator MUST record trigger/side-effect counts and prove
  no table outside the approved impact set changed unexpectedly.
- **FR-EXEC-09:** Every live correction MUST declare and prove its transaction
  isolation, `lock_timeout`, `statement_timeout`, and
  `idle_in_transaction_session_timeout` before it reads manifest rows.
- **FR-EXEC-10:** Manifest rows MUST be locked in a documented deterministic
  order and each update MUST include an old-value digest, version, or equivalent
  optimistic predicate. ID-only updates are prohibited.
- **FR-EXEC-11:** The transaction MUST re-read family postconditions and exact
  side-effect counts before commit. A row-count, predicate, or side-effect
  mismatch MUST roll back the entire family transaction.
- **FR-EXEC-12:** SQLSTATE `40001`, `40P01`, lock timeout, predicate mismatch,
  or concurrent row change MUST roll back and invalidate the execution window.
  Live staging MUST NOT retry automatically; a new preflight/manifest approval
  is required.
- **FR-EXEC-13:** Each family decision MUST choose either an approved pause of
  the affected application/import write paths or a tested fail-closed concurrent
  writer strategy. Unaffected application traffic MAY continue.

### 4.5 Constraint re-entry

- **FR-REENTRY-01:** The immutable V1 preflight MUST rerun for continuity after
  all approved corrections. Every family proposed for DDL MUST also report zero
  under its owner-approved active query version. Preserved or blocked families
  MAY remain non-zero in V1 but MUST be excluded from DDL.
- **FR-REENTRY-02:** A read-only staging gate MUST measure table/index sizes,
  existing keys, dependencies, current workload, and current lock pressure. It
  MUST NOT claim to measure the lock duration of DDL that it did not execute.
- **FR-REENTRY-03:** Parent composite candidate keys MUST be evaluated before
  dependent composite foreign keys. Their redundancy, index cost, and purpose
  as referenced keys MUST be documented.
- **FR-REENTRY-04:** `NOT VALID` MUST be used only where PostgreSQL supports it.
  It MUST NOT be claimed for unique constraints; current PostgreSQL 17 permits
  it for foreign-key and check constraints.
- **FR-REENTRY-05:** A concurrent unique-index strategy and later constraint
  attachment MAY be proposed only after staging rehearsal proves provider
  support, transaction boundaries, failure cleanup, and lock behavior.
- **FR-REENTRY-06:** Each constraint family MUST have exact forward DDL,
  compatibility evidence, bounded lock/statement timeouts, validation proof,
  rollback DDL, and a separate owner Go decision.
- **FR-REENTRY-07:** Authorization, organization, assignment, target, and
  candidate-key constraints MUST remain separable. One family failing MUST NOT
  conceal the status of another.
- **FR-REENTRY-08:** Actual DDL behavior MUST first be rehearsed on a disposable
  restored dataset under representative synthetic writes. A staging DDL
  measurement is a separate optional mutation package with exact rollback and
  owner approval; it is never part of a read-only gate.

### 4.6 Independent DG1-C usage track

- **FR-USAGE-01:** Obtain an owner-approved provider observation window for
  `GET /api/store/me/incentives` and `GET /api/store/incentives` using sanitized
  request evidence.
- **FR-USAGE-02:** If the provider cannot expose reliable route usage, classify
  the result as `active_external_or_unknown`, preserve both compatibility
  endpoints, and make no runtime removal.
- **FR-USAGE-03:** A removal PR may open only after the observation window and
  owner sign-off prove the relevant endpoint unused or a compatibility/migration
  path is approved. Region Manager commands and the Super Admin bypass remain
  unchanged.

## 5. Non-Functional Requirements

- **NFR-01 — Safety:** Diagnostic database sessions use one connection,
  certificate verification, exact staging identity, a 5-second connection
  timeout, a 30-second query/statement timeout, and a proven read-only
  transaction.
- **NFR-02 — Privacy:** Committed artifacts contain zero secrets, database
  locations, CA content, raw IDs, names, emails, national identifiers, employee
  payloads, or unbounded samples.
- **NFR-03 — Bounded evidence:** Each diagnostic bucket contains at most five
  12-character sample references; every aggregate has an explicit unit.
- **NFR-04 — Snapshot consistency:** Every diagnostic receipt comes from one
  statement or one proven repeatable-read snapshot. A later run MAY differ only
  when its distinct observation timestamp/snapshot is recorded and the drift is
  reconciled explicitly.
- **NFR-05 — Mutation precision:** For a correction, approved count equals
  manifest count; locked count and attempted count equal approved count;
  optimistic conflicts and unexpected rows are zero; committed count equals
  intended count; postcondition failures are zero.
- **NFR-06 — Reversibility:** Every family package proves transaction rollback
  before commit and retains secure old values for an approved compensating
  rollback after commit.
- **NFR-07 — Availability:** No staging DDL is proposed without current staging
  workload observation, measured disposable DDL behavior, explicit remaining
  uncertainty, and an owner-approved availability window. Default lock and
  statement timeouts are not accepted as evidence.
- **NFR-08 — Reviewability:** One PR owns one risk story, one family or gate, a
  bounded diff, explicit evidence, and an independent rollback.
- **NFR-09 — Compatibility:** Public API response shapes and authorization do
  not change in the database remediation train.
- **NFR-10 — Cost posture:** The plan assumes no new paid service. Read-only
  diagnosis uses existing infrastructure. A paid PITR add-on MUST NOT be enabled
  automatically; if no adequate existing or manual restorable backup can be
  proven, live mutation remains blocked.

## 6. Required Owner Decisions

The owner decisions below were locked on 2026-07-12 as recorded in the REM-2
packet. `D-STAGING-MUTATION` remains unavailable for the blocked ORG/ASSIGN
families. After merged REM-8A/8B evidence, `D-CONSTRAINT-WINDOW` is locked only
for eligible TARGET DB-C5 as
`bounded_5s_add_30s_validate_no_pause_fail_closed`: ADD waits at most five
seconds, the migration transaction at most 30 seconds, normal writers are not
paused, and every drift/timeout fails closed. This family-specific decision
does not authorize production or make another family eligible.

| Decision | Question to lock | Allowed outcomes |
| --- | --- | --- |
| `D-TARGET-COUNT` | For each `TARGET-02` bucket, which artifact is authoritative? | `json_canonical`, `rebuild_both`, `preserve`, `blocked` |
| `D-TARGET-DUPLICATE` | Can one employee appear more than once in a target allocation request? | `reject_app`, `reject_app_and_db`, `allow`, `blocked` |
| `D-INVARIANT-DEFINITION` | Is each non-zero hit a data defect under the approved business meaning? | `data_defect_correct`, `valid_under_revised_semantics`, `preserve_excluded`, `blocked` |
| `D-ASSIGN-DATES` | Is `end_date` the last active day, and is a same-day transfer a real overlap? | Exact inclusive/exclusive and transfer rule |
| `D-ASSIGN-WINNER` | If two primary assignments truly overlap, which record is corrected/superseded? | Per-pair authoritative source decision |
| `D-ORG-AUTHORITY` | Which master source owns company/region/store/employee/position truth? | Per-reason source and correction direction |
| `D-ORG-HISTORY` | Which ORG-04 sources are mutable operational state versus immutable history? | `correct`, `rebuild`, `supersede`, `preserve`, `blocked` |
| `D-STAGING-MUTATION` | Who may run which correction and when? | Named operator/window/package approval |
| `D-CONCURRENCY` | How are concurrent application/import writes controlled for this family? | `approved_write_pause`, `locks_plus_old_value_predicate`, `blocked` |
| `D-RESTORE` | What restorable backup and RPO are accepted? | Existing backup, secured logical backup, or blocked |
| `D-CONSTRAINT-WINDOW` | What lock/availability budget is acceptable? | Measured per-family threshold or blocked |
| `D-DG1C-USAGE` | What provider window is reliable enough for endpoint retirement? | Approved window or compatibility preserve |

## 7. Diagnostic Output Contract

No public HTTP API is added or changed. The following is an internal evidence
shape for the reviewed runner and committed sanitized receipts:

```ts
type RemediationFamily =
  | "TARGET-02"
  | "ORG-02"
  | "ORG-04"
  | "ASSIGN-01";

type DiagnosticReasonCode =
  | "target.count_less_than_json_length"
  | "target.count_greater_than_json_length"
  | "target.write_source_legacy_or_unknown"
  | "org.assignment_region_store_region"
  | "org.region_company_store_company"
  | "org.employee_company_store_company"
  | "org.position_company_store_company"
  | "org.scope_company_region"
  | "org.scope_company_store"
  | "org.scope_region_store"
  | "org.bootstrap_resolved_company_batch_company"
  | "assignment.same_day_boundary"
  | "assignment.strict_multi_day"
  | "assignment.open_ended"
  | "assignment.same_scope"
  | "assignment.cross_scope";

type DiagnosticSourceTable =
  | "ops.seller_code_request"
  | "ops.employee_offboarding_request"
  | "ops.target_distribution_request"
  | "ops.personnel_target_reference"
  | "ops.kpi_target"
  | "ops.kpi_actual"
  | "ops.workforce_norm_plan"
  | "ops.turnover_event"
  | "ops.store_action_plan"
  | "ops.sales_target_incentive_projection"
  | "ops.sales_target_incentive_adjustment"
  | "ops.sales_target_incentive_store_review"
  | "ops.sales_target_incentive_region_package"
  | "ops.sales_target_incentive_region_package_store"
  | "ops.sales_target_incentive_region_correction"
  | "rpt.sales_target_incentive_assignment_snapshot"
  | "rpt.sales_target_incentive_final_snapshot"
  | "rpt.turnover_snapshot"
  | "stg.master_data_bootstrap_row"
  | "audit.event_log";

type InvariantDisposition =
  | "data_defect_correct"
  | "valid_under_revised_semantics"
  | "preserve_excluded"
  | "blocked";

type ConstraintEligibility =
  | "eligible_after_zero"
  | "excluded"
  | "blocked";

type SideEffectCode =
  | "audit_event"
  | "updated_at_touch"
  | "derived_rebuild"
  | "none";

type DiagnosticBucket = {
  family: RemediationFamily;
  querySetVersion: string;
  reasonCodes: DiagnosticReasonCode[];
  sourceClass: "operational" | "reporting" | "staging" | "audit" | "unknown";
  sourceTable?: DiagnosticSourceTable;
  hitCount: number;
  distinctSourceRecordCount?: number;
  sampleRefs: string[];
  unit: "check_hits";
  dimensions:
    | {
        requestStatus: "pending_region_approval" | "approved" | "unknown";
        createdVintage: "before_2025" | "2025" | "2026_h1" | "2026_h2" | "future_or_unknown";
        approvalEvidence: "present" | "absent";
        approvalMode: "direct" | "adjusted" | "unknown";
        countDelta: number;
        writeSource: "pilot_roster_import" | "legacy_or_unknown";
      }
    | { multipleReasons: boolean }
    | {
        overlapKind: "same_day_boundary" | "strict_multi_day";
        openEnded: boolean;
        scopeRelation: "same_scope" | "cross_scope";
      };
};

type DiagnosticQueryResult = {
  querySetVersion: "staging-remediation-diagnostic-v1";
  observedAt: string;
  familyTotals: Array<{
    family: RemediationFamily;
    hitCount: number;
    unit: "check_hits";
  }>;
  overallCheckHits: { count: number; unit: "check_hits" };
  distinctSourceRecords: { count: number; unit: "source_records" };
  distinctPeople: { status: "distinct_count_unresolved" };
  buckets: DiagnosticBucket[];
  cooccurrences: Array<{
    familyA: RemediationFamily;
    familyB: RemediationFamily;
    sourceTable: DiagnosticSourceTable;
    sourceRecordCount: number;
    unit: "source_records";
  }>;
};

type DiagnosticReceipt = {
  receiptVersion: "1";
  receiptDigest: string;
  event: "staging_remediation_diagnostic.completed";
  reviewedCommit: string;
  runnerDigest: string;
  queryDigest: string;
  targetClass: "disposable" | "staging";
  targetFingerprint: string;
  tlsMode: "disable" | "verify-full";
  certificateVerified: boolean;
  transactionReadOnly: true;
  transactionIsolation: "repeatable_read";
  timeoutProfile: {
    connectionMs: 5000;
    idleMs: 1000;
    queryMs: 30000;
    statementMs: 30000;
  };
  queryResult: DiagnosticQueryResult;
  impactInventory: {
    inventoryVersion: "staging-remediation-impact-v1";
    inventoryDigest: string;
    catalog: Array<{
      sourceTable: DiagnosticSourceTable;
      triggerCount: number;
      generatedColumnCount: number;
    }>;
    writePathCodes: string[];
    downstreamCodes: string[];
  };
};

type RemediationDecision = {
  decisionRef: string;
  decisionDigest: string;
  family: RemediationFamily | "TARGET-03";
  bucketRef: string;
  disposition: InvariantDisposition;
  activeQuerySetVersion: string;
  constraintEligibility: ConstraintEligibility;
  authority: string;
  approverRole: string;
  approvedAt: string;
  revisitTrigger: string;
};

type RemediationReceipt = {
  receiptVersion: "1";
  receiptDigest: string;
  reviewedCommit: string;
  runnerDigest: string;
  targetClass: "staging";
  targetFingerprint: string;
  querySetVersion: string;
  observedAt: string;
  certificateVerified: true;
  transactionReadOnly: boolean;
  transactionIsolation: "repeatable_read" | "serializable";
  family: RemediationFamily;
  decisionRef: string;
  decisionDigest: string;
  manifestDigest?: string;
  backupReceiptRef?: string;
  rehearsalReceiptDigest?: string;
  beforeHits: number;
  approvedRows: number;
  lockedRows: number;
  attemptedRows: number;
  optimisticConflicts: number;
  unexpectedRows: number;
  committedRows: number;
  afterHits: number;
  sideEffects: Array<{ code: SideEffectCode; count: number }>;
  rollbackRehearsed: boolean;
  outcome: "read_only" | "rolled_back" | "committed" | "blocked";
};

type RemediationRunFailure = {
  event: "staging_remediation.failed";
  targetClass: "staging" | "unresolved";
  family?: RemediationFamily;
  error:
    | "approval_missing"
    | "target_identity_mismatch"
    | "certificate_verification_failed"
    | "manifest_digest_mismatch"
    | "concurrent_change_detected"
    | "lock_timeout"
    | "serialization_failure"
    | "unexpected_row_count"
    | "postcondition_failed"
    | "sanitization_failed";
};
```

`DiagnosticReceipt` is the REM-1A/REM-1B read-only receipt. The later
`RemediationReceipt` is reserved for owner-approved correction packages and is
not emitted or exercised by REM-1A.

All digest fields MUST be SHA-256 values over canonical serialized content; the
validator rejects a missing, malformed, or mismatched digest. References and
fingerprints are opaque sanitized values, never raw target or record identity.
The receipt MUST reject extra fields and free-form database values.

## 8. Data Model And Ownership Map

This plan authorizes no new table, column, index, trigger, policy, or constraint.
It records the existing surfaces that future packages must handle.

| Entity | Relevant fields and types | Existing/required ownership constraint |
| --- | --- | --- |
| `ops.target_distribution_request` | UUID scope IDs; date month; text status; integer `allocation_count`; JSONB `allocation_json`; JSONB approval evidence; timestamps | Count and JSON are duplicate state today; authority is decided per diagnostic bucket before correction. |
| `ops.personnel_target_reference` | UUID request/company/region/store/employee IDs; date period; numeric target | Derived from approved allocation JSON; existing materialization must be reconciled, not inferred from count alone. |
| `ops.employee_assignment_history` | UUID employee/position/store/region IDs; date start/end; boolean primary; text status | Temporal and hierarchy semantics remain owner-gated; active writers must be included in concurrency control. |
| `ops.region` / `ops.store` | UUID hierarchy IDs | Candidate composite parent keys are absent; no key is authorized until lock and compatibility gates close. |
| `ops.employee` / `ops.position` | UUID company ownership | Existing company values are possible hierarchy authorities, not automatic correction winners. |
| ORG-04 source tables | UUID scope IDs plus source-specific history/status fields | Operational, reporting, staging, and audit mutability are decided separately. |
| Secure correction manifest | Raw row identity; old-value digest; intended-value digest; decision/dataset references | Operator artifact outside Git; encrypted and access-controlled; canonical SHA-256 binds it to receipts. |
| Sanitized receipt | Types from Section 7 | Git-safe allowlisted evidence; contains digests/counts only and rejects extra fields. |

### 8.1 Target distribution

`ops.target_distribution_request` owns request scope, month, status,
`allocation_count`, `allocation_json`, approval evidence, and timestamps.
`ops.personnel_target_reference` is materialized from approved allocation JSON
and refers back to the source request. A correction must account for pending,
approved, rejected/returned, and already-materialized states separately.

### 8.2 Assignment hierarchy

`ops.employee_assignment_history` owns employee, position, store, region,
start/end dates, primary flag, and status. Its organization checks depend on:

- `ops.store.region_id` and `ops.store.company_id`;
- `ops.region.company_id`;
- `ops.employee.company_id`; and
- `ops.position.company_id`.

The assignment table is time-aware operational history and a core source for
headcount, turnover, targets, reporting, and incentives. Corrections require a
downstream impact inventory.

### 8.3 ORG-04 source inventory

The current check spans these source classes:

- operational requests/facts: `ops.seller_code_request`,
  `ops.employee_offboarding_request`, `ops.target_distribution_request`,
  `ops.personnel_target_reference`, `ops.kpi_target`, `ops.kpi_actual`,
  `ops.workforce_norm_plan`, `ops.turnover_event`, `ops.store_action_plan`;
- incentive operational state: `ops.sales_target_incentive_projection`,
  `ops.sales_target_incentive_adjustment`,
  `ops.sales_target_incentive_store_review`,
  `ops.sales_target_incentive_region_package`,
  `ops.sales_target_incentive_region_package_store`, and
  `ops.sales_target_incentive_region_correction`;
- reporting snapshots: `rpt.sales_target_incentive_assignment_snapshot`,
  `rpt.sales_target_incentive_final_snapshot`, and `rpt.turnover_snapshot`;
- staging lineage: `stg.master_data_bootstrap_row` plus its batch company; and
- audit history: `audit.event_log`.

Reporting snapshots, staging lineage, and audit history must not be updated by a
generic organization cleanup. Their correct disposition may be preserve,
supersede, or rebuild.

### 8.4 Versioned impact inventory

REM-1A binds the following reviewed write/downstream codes to every diagnostic
receipt. They are code-analysis evidence, not permission to write:

| Code | Reviewed owner/path |
| --- | --- |
| `target.request_create` | `TargetDistributionRepository.createRequest`; writes count and JSON together. |
| `target.approval` | `TargetDistributionRepository.approveRequest`; direct approval preserves both values and adjusted approval writes both together. Approval evidence alone does not prove where a later mismatch originated. |
| `target.pilot_roster_import` | `PilotRosterReconciliationRepository.upsertTargetReference`; this path creates/reuses the pilot request, materializes personnel references, and recalculates the stored count without rebuilding allocation JSON. |
| `assignment.integration_materialization` | Integration assignment materialization/import repositories. |
| `assignment.master_data_bootstrap` | Master-data bootstrap assignment update/insert paths. |
| `assignment.pilot_roster_import` | Pilot roster reconciliation active/inactive assignment paths. |
| `assignment.workforce_lifecycle` | Seller-code approval and workforce/offboarding assignment lifecycle paths. |
| `target.personnel_target_reference` | Approved allocation JSON and pilot import materialize `ops.personnel_target_reference`; count alone cannot validate it. |
| `assignment.headcount_turnover_targets_reports_incentives` | Assignment history is consumed by headcount, turnover, target, report, and incentive reads. |

The receipt also inventories non-internal trigger and generated-column counts
for every strict `DiagnosticSourceTable`. It emits only the allowlisted table
code and counts, never trigger names, expressions, row values, or catalog
payloads. ORG-04's operational/reporting/staging/audit source-class split stays
explicit; exact correction writers remain a REM-2 owner-decision prerequisite
and cannot be inferred from this read-only inventory.

## 9. Ordered PR And Execution Train

REM-1A and its controlling plan merged through PR #952. The former
`codex/staging-data-remediation-plan` branch is historical implementation
context, not the active evidence branch. REM-1B starts at the exact PR #952
merge commit and must remain evidence-only.

Live evidence never goes into an already merged PR. Every tool that will touch
staging follows `implementation PR -> merge -> fresh evidence branch/PR`.
Evidence PRs contain receipts/docs only and never change the runner they claim
to have executed.

### REM-1A — Sanitized read-only diagnostic implementation

Add the reviewed reason-bucket query, repeatable-read boundary, strict
sanitizer/receipt contract, query fixtures, and runner contract tests. Run only
local/disposable verification, then merge through the normal closeout gate. No
staging connection, DML, DDL, migration, runtime API, or authorization change.

REM-1A implementation owns these versioned artifacts:

- `db/preflight/staging-remediation-diagnostic-v1.sql`;
- `backend/nestjs/scripts/staging-remediation-diagnostic.ts`;
- `backend/nestjs/scripts/staging-remediation-diagnostic-contract.ts` and its
  strict reason/source allowlists;
- focused CLI, sanitizer, digest, malformed-JSON, multi-reason, overlap, and
  disposable rollback fixtures; and
- `npm.cmd --prefix backend/nestjs run diagnose:staging:remediation` as the only
  live entry point for the merged version.

The entry point reuses the DG2 verify-full target gate, additionally requires
`STAGING_REMEDIATION_DIAGNOSTIC_REVIEWED_COMMIT`, executes all query/catalog
reads in one `REPEATABLE READ READ ONLY` transaction, proves isolation and
read-only state, and sanitizes the canonical digest-bound receipt before any
stdout write. Exit code `2` means the complete sanitized read-only result
contains hits; it does not authorize a correction. REM-1A itself executes this
entry point only against the fixed disposable local namespace.

### REM-1B — Post-merge staging diagnostic evidence

Create a fresh branch from main after REM-1A merges. Pin the merged runner SHA,
obtain separate target confirmation, execute one read-only staging diagnostic,
and commit only its sanitized dated receipt. Any runner/query change returns to
a new implementation PR; it must not be mixed into this evidence PR.

REM-1B is now authorized to continue, subject to this fail-closed runtime gate:

1. The branch HEAD, `origin/main`, and reviewed commit MUST all equal
   `09800d367e5250f5bd08e1412d86323d86f9262f` before execution.
2. The owner MUST confirm the exact staging target identity and one bounded
   immediate run window for REM-1B. The earlier DG2-C confirmation is evidence
   of that earlier run and MUST NOT be silently reused as a new confirmation.
3. `DATABASE_URL`, the expected host/database identity, and CA material MUST be
   supplied only through the operator environment. Their values MUST NOT be
   printed, copied into a command transcript, written to the repository, or
   persisted in the evidence branch.
4. The operator preflight MUST prove presence, without printing values, for
   `DATABASE_URL`, `DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST`,
   `DATABASE_INVARIANT_PREFLIGHT_EXPECTED_DATABASE`, and `DB_SSL_CA`; target,
   acknowledgement, approval, TLS mode, and reviewed commit MUST be pinned to
   the merged REM-1A contract.
5. The merged npm entry point is executed exactly once inside the approved
   window. Stdout is captured to an ignored temporary path and is not streamed
   into a general terminal transcript. Exit code `2` is an expected sanitized
   evidence outcome when check hits exist; exit code `1` is a safety failure
   and stops REM-1B without retry.
6. The captured receipt MUST pass the merged strict schema, digest, secret/PII,
   target-class, TLS, read-only, isolation, timeout, and reviewed-SHA checks
   before it can be copied into a dated evidence document.
7. The evidence PR may change only the sanitized dated receipt, this plan,
   `current-state.md`, and documentation indexes needed to make the receipt
   discoverable. A query, runner, allowlist, contract, package script, test, or
   application change returns to a new implementation PR.
8. Family totals that differ from the immutable V1 baseline are recorded as
   time-bounded diagnostic drift, not silently treated as an error or as repair
   authority. Any unexplained safety or schema drift stops the run.

Sokrates decision record for REM-1B:

- **Decision:** run one evidence-only, read-only staging diagnosis after the
  exact target/window and secure-input gate closes.
- **Evidence:** merged PR #952, green required/post-merge checks, immutable PR
  #951 baseline, and the owner's 2026-07-12 continuation approval.
- **Counterargument:** a read-only query can still target the wrong database,
  run outside owner expectations, or leak unsafe output if prior confirmation
  or terminal handling is reused casually.
- **Risk / door:** HIGH external-data operation; data behavior is a two-way
  door because the transaction is read-only, while privacy/target mistakes are
  operationally near-one-way.
- **Guardrails:** exact merged SHA, verify-full, explicit identity, one bounded
  run, no retry, temp capture, strict sanitizer, no raw values, and no mutation.
- **Change-my-mind triggers:** missing/changed target confirmation, missing
  secure input, SHA/digest drift, runner/query diff, certificate or identity
  failure, unsafe output, unexplained totals, or any attempted write.
- **Next action:** close the runtime gate, run once, validate the receipt, then
  prepare the evidence-only PR. REM-2 starts only after that PR merges.

REM-1B execution outcome:

- The runtime gate closed interactively and the merged runner executed once at
  `2026-07-12T05:46:11.064Z`.
- The sanitized receipt is
  `docs/evidence/readiness/2026-07-12-staging-remediation-diagnostic-v1.json`;
  its human-readable evidence record is the adjacent `.md` file.
- `verify-full`, certificate verification, exact reviewed commit,
  `REPEATABLE READ READ ONLY`, strict schema/digests, timeout profile, and empty
  stderr were independently verified after execution.
- Exit code `2` records 70 check hits, 72 source records, nine diagnostic
  buckets, and unresolved distinct-person count. It is a completed-findings
  result, not a runner failure.
- The immutable V1 family totals did not drift. No mutation or repair authority
  was created. A second REM-1B staging run is not authorized.

### REM-2 — Owner decision packet

Scope:

- convert REM-1B evidence into decisions `D-*` from Section 6;
- record the Section 7 invariant disposition and constraint eligibility per
  bucket;
- define exact correction packages and their expected counts;
- lock restore, concurrency, operator, and execution-window decisions.

This is documentation and approval truth. It still performs no mutation.

The cold-reader decision options, non-binding Sokrates recommendations, unset
owner fields, and stop rules are prepared in
`docs/plans/rem-2-owner-decision-packet-v1.md`. The REM-2 PR remains incomplete
until the owner explicitly selects or blocks the applicable decisions; Codex
must not convert a recommendation into approval.

Locked on 2026-07-12: all five pilot-import `TARGET-02` buckets are
`valid_under_revised_semantics` and their current rows are `preserve`. V1 stays
immutable; constraint eligibility is blocked until a separately approved
REM-2B query/spec validates pilot-import counts against approved personnel
references and publishes the exact V1-to-V2 bridge. This owner decision
authorizes no data mutation.

Also locked on 2026-07-12: duplicate employee allocations inside one target
request are `reject_app_and_db`. A later revision or new target for the same
month is a separate, reasoned request/version and may contain the employee once
again. Only one approved reference may be active per employee/month/type;
replacement approval must preserve the previous reference as `superseded`
rather than overwrite its history. Application enforcement precedes database
enforcement. Database enforcement remains behind REM-8 and no DDL is
authorized by this decision.

Application prerequisite state: the request-creation and edited-approval
service boundaries reject a repeated employee before any repository write.
This closes only the application half of `reject_app_and_db`; existing data,
pilot-import behavior, API shape, and database enforcement remain unchanged.
Database enforcement is still conditional on REM-7 eligibility and REM-8
compatibility, disposable DDL, lock, rollback, and concurrency evidence.

For monthly KPI actuals, region means the responsible region manager's
portfolio. The canonical owner is the assignment effective on the last day of
the KPI month: a mid-month change assigns the whole month to the new manager,
while a later-month change does not rewrite closed history. ORG-04 KPI
validation must therefore use effective-dated period-end assignment rather
than the store's current region. The nine existing hits remain unclassified
until that evidence exists; missing or overlapping assignment is fail-closed.
No replay, DML, or DDL is authorized.

For Norm Kadro, closed approved plans preserve their historical scope. Active
or future plans affected by a manager change must be replaced through an
approved version that belongs to the new manager, while the prior version
remains `superseded`. Ownership-only replacement preserves headcount/FTE;
changing plan values requires a separate reasoned revision. The two current
hits remain unclassified pending period-state and effective-manager evidence.
There is no direct-update exception and no rebuild, DML, or DDL authorization.

For employee assignment region, the store master owns an active assignment's
current region-manager portfolio while a closed assignment preserves its
period region. A manager/region change closes the prior active assignment and
creates a successor; it never rewrites the historical row. The three current
ORG-02 hits remain unclassified pending status, date, and source evidence.
Missing dates, overlapping active rows, or missing store authority fail closed.
The current import writer's region-only rotation gap requires a separate
implementation PR; no replay, direct update, DML, or DDL is authorized.

Multiple concurrent employee assignments are allowed for cross-store support,
but exactly one may be open primary. Support assignments must be secondary.
`end_date` is inclusive and a successor primary assignment starts no earlier
than the following day; a same-day primary transfer is invalid. The two
ASSIGN-01 pairs are therefore defects, but their primary winner remains unset
at row level until approved rotation/lifecycle evidence is reviewed per pair.
The authority method is locked; no automatic
latest-row winner, demotion, closure, DML, or DDL is authorized.

Primary winner authority is the approved, effective-dated rotation or
assignment-lifecycle record. The prior store stays primary through the day
before rotation; the new store becomes primary on the rotation effective date.
The prior row is closed, not overwritten, and an approved support row remains
secondary. This locks the method but not the two row-level winners: they remain
blocked until a separately authorized secure evidence review binds each pair
to its rotation record. No staging read or mutation is authorized.

Before any separately authorized correction, create a fresh encrypted staging
logical backup and prove it by restoring into a disposable non-production
database using existing resources. A sanitized digest must bind the backup to
the reviewed manifest and runner SHA; restored schema/table availability,
counts, and approved invariants must reconcile. Any failure is No-Go. Earlier
restore evidence proves only the method, and this decision authorizes no backup
run, staging access, paid PITR, DML, or DDL now.

A future correction window requires an approved pause of every identified API,
import, worker, and operator writer that can touch the affected rows. Exactly
one manifest-bound correction runner may execute. Deterministic row locks and
old-value predicates remain mandatory; any conflict, count drift, lock failure,
or unexpected writer activity aborts and rolls back the transaction. Proven
read-only traffic may continue. This uses existing controls and authorizes no
pause, staging access, correction window, DML, or DDL now.

### REM-2B — Versioned invariant definition, conditional

Open only for `valid_under_revised_semantics`. Preserve V1 SQL/spec/evidence,
add a new query-set version with adversarial fixtures, publish a V1-to-new-count
bridge, and obtain owner approval of the new active version. This PR changes no
business row and cannot be used merely to hide a violation.

Implementation state: the repository-only V2 contract is specified in
`docs/plans/staging-remediation-invariant-spec-v2.md` and uses the separate
`staging-remediation-invariant-v2` SQL/runner/typed receipt path. Its disposable
fixture must prove non-trivial carried-forward, revised-valid, and V2-new bridge
counts before merge. The merged implementation is not staging evidence; the
next evidence-only branch still requires an exact target binding and bounded
Europe/Istanbul run window. Under the owner's 2026-07-12 standing authorization,
those are technical prerequisites rather than recurring approval questions.

PR #955 merged REM-2B at
`b9112aa34b9ef75615caa74588169a571017726c`. The first evidence attempt from
that SHA stopped fail-closed before receipt creation because an untracked local
helper supplied the CA file path instead of PEM content. It produced no V2
query result and performed no mutation. That SHA/attempt is not retried.

PR #956 merged the versioned launcher at
`2e20628bd3f71216acad7c44679b50f0b22607b1`. Its one-shot attempt stopped
before any database connection: Windows returned `EINVAL` when Node tried to
spawn `npm.cmd` directly, with null process status and empty stdout/stderr. No
receipt or V2 query result exists for that SHA, its marker remains consumed,
and it is not retried. The next implementation uses the already reviewed repo
pattern `cmd.exe /d /s /c "npm.cmd ..."` on Windows.

PR #957 merged that Windows invocation fix at
`07c38414948c0af44172a52034dfb7000163bdc3`. A fresh branch from that exact SHA
executed once under the standing authorization and produced the validated V2
receipt at
`docs/evidence/readiness/2026-07-12-staging-remediation-invariant-v2.json`.
The launcher bound target/project, CA PEM, window, branch, HEAD, `origin/main`,
one-shot marker and receipt digests; verify-full, certificate verification,
`REPEATABLE READ READ ONLY`, typed schema and empty stderr passed.

The exact V1-to-V2 bridge records `TARGET-02` as `54 -> 0` with all 54 revised
valid, `ORG-02` as `3 -> 3`, `ASSIGN-01` as `2 -> 4`, and `ORG-04` as
`11 -> 7142`. V2 totals are check hits, not distinct people or automatic
correction rows. `TARGET-02` advances toward REM-7 preservation/reconciliation.
The other families require secure row-authority classification; missing or
ambiguous manager/rotation evidence remains blocked and selects no winner.

### REM-2C — Versioned row-authority classifier

Open because the V2 evidence contains shared manager-authority roots and
aggregate counts cannot select correction rows. The approved contract is
`docs/plans/staging-remediation-row-authority-classifier-spec-v1.md`.

The implementation executes immutable V2 plus the classifier in one
`REPEATABLE READ READ ONLY` snapshot. ORG-04 distinguishes hierarchy, never
configured role, role outside the authority date, missing effective store
portfolio, duplicate rows for one manager, mixed-scope managers, multiple
distinct managers, and unique-manager region mismatch. It reports both
`check_hits` and deduplicated authority units.

Repository inspection found no owned, approved, effective-dated employee/store
rotation or assignment-lifecycle source. REM-2C therefore classifies ORG-02 and
ASSIGN-01 as `rotation_authority_source_absent`; current state, row timestamps,
generic audit/import times, and an unowned change-log table select no winner.
A future approved source requires a new classifier version rather than a V1
reinterpretation.

PR #959 merged the repository/disposable implementation at
`9de5e68cf62cd15eda45f2c3e1d935ff54fb9e25`. Its fresh evidence branch ran that
exact SHA once through the standing-authorization, verify-full, target/project,
window, clean-tree and atomic-marker guards. The sanitized receipt is
`docs/evidence/readiness/2026-07-12-staging-remediation-row-authority-classifier-v1.json`.

The receipt reconciles all `7149` V2 check hits into `832` authority units.
ORG-04 has 739 role-not-effective units, 59 multiple-manager units, 28
portfolio-not-effective units, and one never-configured unit. ORG-02 contributes
three and ASSIGN-01 two units, all with the approved rotation/lifecycle source
contract absent. These are authority gaps, not correction manifests. No nearby,
current, audit, created, or updated timestamp may select a historical winner.

Sokrates decision: accept the exact receipt and preserve the evidence branch as
read-only proof; do not open any family correction package until a sanitized
authority-gap packet receives exact source facts. Any classifier change returns
to a new implementation PR and a new one-shot SHA.

### 9.1 Family correction two-PR protocol

Each REM-3 through REM-6 family uses two physical PRs:

1. **Package PR (`A`)** — parameterized correction/rollback runner, manifest
   contract, disposable fixtures, concurrency-conflict tests, and no live DML.
   Merge it first.
2. **Execution evidence PR (`B`)** — from fresh main, execute the exact merged
   package. First run the rollback-only staging rehearsal and show its sanitized
   local receipt to the owner. Only after separate commit authority, run the
   commit mode once. Then open an evidence-only PR containing both sanitized
   receipts and no runner changes.

If the rehearsal or commit precondition changes, discard the pending evidence
branch, return to diagnosis, and create a new manifest. Do not retry live.

### REM-3A/3B — TARGET-02 correction package and evidence, conditional

Open only when `D-TARGET-COUNT`, restore, exact manifest, and operator approval
are locked. Cover target rows only. Prove downstream personnel-target reference
and approval-evidence behavior. Rehearse rollback first; commit requires a
separate owner action.

### REM-4A/4B — ORG-02 hierarchy package and evidence, conditional

Open only when `D-ORG-AUTHORITY` selects the authoritative side for every
affected reason bucket. Do not combine with temporal overlap corrections.

### REM-5A/5B — ORG-04 scoped-row packages and evidence, conditional

Split by source class when more than one mutability/rollback story exists.
Operational correction, derived rebuild, historical preservation, staging
supersession, and audit preservation must not be hidden in one script.

### REM-6A/6B — ASSIGN-01 temporal package and evidence, conditional

Open only after `D-ASSIGN-DATES` and `D-ASSIGN-WINNER` are locked for both
pairs. Test same-day, strict overlap, open-ended, transfer, closed, inactive,
and multiple-assignment cases.

### REM-7 — Versioned reconciliation and eligibility receipt

Repository-only implementation completed on 2026-07-12 pending PR closeout. It
consumes immutable V1, V2, and classifier V1 in one repeatable-read/read-only
transaction, binds the target duplicate application contract, emits only the
four strict terminal states, and ships a one-shot exact-SHA evidence launcher.
The migrated disposable and adversarial rollback smokes prove TARGET-02 as
`eligible_zero` and the three authority-dependent families as `blocked`. No
staging execution or constraint authority is claimed by the implementation PR.

PR #962 then merged the implementation at
`84fa69311575dcaa1aa01548853c76f0f083e4ce`. Its exact-SHA one-shot staging
receipt is valid: TARGET-02 is `eligible_zero`; ORG-02, ORG-04, and ASSIGN-01
remain `blocked`. The receipt authorizes only TARGET-scoped REM-8 preparation,
not DDL or correction.

Rerun immutable V1 for continuity and each owner-approved active query version.
Reconcile before/after totals and assign one family state:

- `eligible_zero`: active-version count is zero and all semantic gates close;
- `preserved_excluded`: approved history remains and no DDL may target it;
- `blocked`: evidence/decision/correction remains incomplete; or
- `not_applicable`: no enforcement was selected.

Only `eligible_zero` enters constraint preparation. A non-zero eligible-family
result returns that family to diagnosis; it never triggers automatic repair.

### REM-8A — Read-only staging capacity and workload observation

Observe only:

- table/index size and existing key inventory;
- dependency and query-plan compatibility;
- current write volume, long transactions, and lock pressure; and
- candidate DDL's documented PostgreSQL lock modes.

This slice does not execute DDL and does not claim measured DDL lock duration.
Its runner merges before a separate evidence-only staging receipt PR.

PR #964 merged the repository-only V1 implementation on 2026-07-12 at
`b60776c033528438118322b8b09652f16909f78d`. It binds the merged REM-7 receipt and current V2 TARGET count in one
repeatable-read/read-only snapshot; reports only sanitized capacity, write,
transaction, lock, catalog, plan, and compatibility aggregates; and ships an
exact-SHA/clean-branch/verify-full/one-shot evidence launcher. It contains no
staging mutation path.

Its exact-SHA one-shot staging receipt is valid: PostgreSQL 17, 61 live TARGET
rows, zero active TARGET hits/ordinary duplicates/pilot duplicates/non-array
rows, exact pilot unique index, absent candidate artifacts, zero long
transactions, and no conflicting lock pressure. The only relation lock was the
observation's granted `AccessShareLock`. No DDL occurred.

### REM-8B — Disposable restored-data DDL rehearsal

On an isolated disposable restore, execute exact candidate DDL under
representative synthetic writers. Measure ADD/validation/rollback duration,
lock waits, write-path impact, timeout behavior, validation-failure cleanup,
validation order, and rollback. This TARGET candidate has no index; its exact
disposition is `not_applicable_no_index_candidate`, and introducing any index
requires a new specification. No staging or production DDL occurs.

The local V1 rehearsal completed on PostgreSQL 17 with 59 migrations and 5,001
synthetic TARGET rows after custom-format dump/restore. It proved source/restore
aggregate parity, expected `23514` and `55P03` failure paths, duplicate new-write
rejection, 20/20 compatible concurrent writers, successful validation, exact
rollback, and verified removal of the disposable databases, dump, and
container. This does not substitute for REM-8A staging observation.

The post-merge exact-SHA run reproduced the receipt with matching candidate
digests, 5,001 restored rows, expected `23514` and `55P03`, 20/20 compatible
writers, successful validation, exact rollback, and verified cleanup.

### REM-8C — Optional staging DDL measurement package

Use only when REM-8A/8B cannot close a material provider/load uncertainty. This
is not read-only: it requires a separate package PR, owner-approved mutation
window, exact reversible artifact, and post-merge evidence PR. If the remaining
uncertainty can be bounded without it, omit REM-8C.

REM-8A/8B close the uncertainty: staging's 61 live rows and zero pressure fit
inside the 5,000-row/20-writer disposable envelope, package digests match, and
cleanup is deterministic. The reviewed decision is `rem_8c_not_required` with
`stagingDdlExecuted=false`; REM-8C is omitted.

### DB-C1 through DB-C5 — Conditional constraint slices

Exact count depends on REM-7 and REM-8A/8B, plus REM-8C when required. Expected
separation is:

1. parent composite candidate keys;
2. organization/scope foreign keys;
3. authorization scope constraints;
4. assignment temporal enforcement, only if the approved semantics are
   representable safely; and
5. target validation/enforcement, with `TARGET-03` ownership resolved.

Each slice is optional and independently approved. Unsupported or high-lock
enforcement remains blocked instead of being forced into the train.

Current exact disposition: DB-C1 through DB-C4 remain excluded/blocked.
TARGET-owned DB-C5 is the sole selected slice and is specified in
`docs/plans/dbc5-target-duplicate-enforcement-spec-v1.md`. It requires two
physical PRs: one repository implementation with no staging access, followed
by one exact-merged-SHA evidence PR after the one-shot staging apply. Migration
060 constrains only duplicate employee membership inside one ordinary request;
it does not implement or claim target-reference supersession history.

PR #966 merged the implementation at
`d76d56f741b832b5d39eede8364f333e12a0e341`. The exact-merged-SHA one-shot
staging apply then completed successfully: migration 060 applied exactly once,
the CHECK is present and validated, the function is immutable and exact,
active TARGET V2 hits remain zero, and the read-only postflight passed under
verify-full. The sanitized receipt is
`docs/evidence/readiness/2026-07-12-staging-dbc5-target-constraint-v1.json`.
DB-C5 is complete for staging; production remains excluded.

### U-1 and optional U-2 — DG1-C provider usage

This is a linked but non-blocking external track, not part of database-plan
completion or the database PR count:

- U-1 records the sanitized owner-approved provider usage window;
- U-2 exists only if retirement is approved and owns compatibility/runtime
  removal plus its own rollback.

### 9.1 Honest PR count

Work-package labels are not physical PR counts:

- REM-1A, REM-1B, and REM-2 require three physical PRs; REM-2B adds one only
  when invariant meaning changes.
- Each corrected family requires two physical PRs. All four families therefore
  add eight; a preserved/blocked family adds none. ORG-04 may split further.
- REM-7 adds one repository-only implementation PR and one exact-SHA
  evidence-only PR.
- REM-8A implementation/evidence plus REM-8B normally add two PRs when their
  disposable rehearsal ships with the implementation; REM-8C adds two only if
  staging DDL measurement is unavoidable.
- Each selected DB-C family adds one implementation PR plus one exact-SHA
  evidence PR. The theoretical maximum is ten, but current classification
  selected only DB-C5. Its two physical PRs after #965 are now complete: #966
  is the implementation and this exact-SHA evidence PR is the closeout.
- U-1/U-2 are excluded; they remain one evidence and at most one runtime PR in
  their own DG1-C track.

If all four data families require correction, no invariant-definition change
or REM-8C is needed, and two to five constraint families proceed, the expected
database range is **16–19 physical PRs**. A fully blocked/preserved outcome may
close much earlier. Exact count is frozen only after REM-1B and REM-2; claiming
a fixed range before that classification is not supported.

## 10. Acceptance Criteria

### AC-01 — Diagnostic safety (`FR-DIAG-01`, `FR-DIAG-07`, `FR-DIAG-08`, `FR-DIAG-09`, `FR-DIAG-11`, `NFR-01`, `NFR-02`, `NFR-03`, `NFR-04`)

Given the exact owner-confirmed staging identity and external CA,
when the merged REM-1A runner is executed for REM-1B,
then certificate verification and read-only mode are proven,
and one repeatable-read snapshot or one statement owns every emitted count,
and output passes the strict allowlist and secret/PII scan,
and no raw record or connection detail is emitted.

### AC-02 — Honest count semantics (`FR-SCOPE-02`, `FR-DIAG-06`)

Given the baseline reports 70 check hits,
when the expanded receipt is generated,
then every total declares its unit,
and no distinct-person or distinct-record number is claimed without reviewed
correlation proof.

### AC-03 — Target ownership (`FR-DIAG-02`, `FR-DEC-01`)

Given `TARGET-02=54`,
when the target decision packet is approved,
then every diagnostic bucket has exactly one disposition and evidence basis,
and unknown/legacy rows are not silently set from JSON.

### AC-04 — Organization history (`FR-DIAG-03`, `FR-DIAG-04`, `FR-DEC-03`, `FR-DEC-04`, `FR-DEC-08`)

Given organization hits span assignment, operational, snapshot, staging, or
audit sources,
when decisions are locked,
then the authoritative hierarchy and mutability class are explicit,
and no historical/audit row is included in a generic operational update,
and an intentionally preserved row is marked `preserve_excluded` rather than
being rewritten to manufacture a zero count.

### AC-05 — Assignment semantics (`FR-DIAG-05`, `FR-DEC-02`, `FR-DEC-08`)

Given two inclusive-range overlap pairs,
when REM-6 is considered,
then same-day boundary and strict overlap are distinguished,
and no correction opens until the owner has defined date and winner semantics,
and a decision that same-day transfer is valid creates a versioned invariant
definition instead of changing valid assignment history.

### AC-06 — Atomic rollback rehearsal (`FR-EXEC-02`, `FR-EXEC-03`, `FR-EXEC-04`, `FR-EXEC-05`, `FR-EXEC-09`, `FR-EXEC-10`, `FR-EXEC-11`, `FR-EXEC-12`, `FR-EXEC-13`, `NFR-05`, `NFR-06`)

Given an approved family manifest and restorable backup,
when the correction package rehearses,
then approved and attempted counts match,
locked rows match the manifest,
old-value predicates and side-effect assertions report zero conflicts,
unexpected rows are zero,
postconditions pass,
and the transaction is rolled back before separate commit authority is sought.

### AC-07 — Committed family correction (`FR-DIAG-10`, `FR-EXEC-01`, `FR-EXEC-06`, `FR-EXEC-07`, `FR-EXEC-08`, `NFR-08`)

Given separate commit authority,
when a family package commits,
then only approved records and side effects are observed,
the family check reaches its expected count,
and the evidence-only PR binds the merged runner, decision, manifest, rehearsal,
backup reference, side effects, and outcome without sensitive data.

### AC-08 — Constraint re-entry (`FR-REENTRY-01`, `FR-REENTRY-02`, `FR-REENTRY-03`, `FR-REENTRY-04`, `FR-REENTRY-05`, `FR-REENTRY-06`, `FR-REENTRY-07`, `FR-REENTRY-08`, `FR-DEC-05`, `NFR-07`, `NFR-09`)

Given V1 continuity counts and owner-approved active-version counts exist,
when constraint work is proposed,
then only `eligible_zero` families are included,
and read-only observations are not presented as actual DDL lock measurements,
and disposable DDL rehearsal plus exact rollback exist per family,
and unsupported `NOT VALID` or unmeasured unique-key behavior is not claimed.

### AC-09 — DG1-C separation (`FR-SCOPE-03`, `FR-USAGE-01..03`)

Given provider usage is unavailable or unknown,
when U-1 closes,
then compatibility endpoints remain,
no breaking runtime PR opens,
and no database remediation PR contains DG1-C code,
and the database plan may still close in its own terminal state.

### AC-10 — Production boundary (`FR-SCOPE-04`)

Given every database family reaches an eligible, excluded, or blocked terminal
state,
when this plan is closed,
then no production operation has occurred,
and any production proposal requires a new plan and explicit approval.

### AC-11 — Immutable baseline and versioned semantics (`FR-SCOPE-01`, `FR-DEC-08`)

Given an owner decision changes the meaning of an existing V1 hit,
when the new invariant is specified,
then V1 SQL and evidence remain unchanged,
and a separately reviewed query-set version with adversarial fixtures and a
V1-to-new count bridge becomes the active version only after approval.

### AC-12 — Decision and receipt provenance (`FR-DEC-06`, `FR-DEC-07`, `NFR-10`)

Given an approved decision and an out-of-Git manifest,
when a rehearsal or commit receipt is accepted,
then its canonical SHA-256 fields bind the decision, runner, manifest, backup
reference, observation time, isolation level, and preceding rehearsal,
and a missing or mismatched field fails closed without enabling a paid service.

### 10.1 Requirement Traceability

| Acceptance criterion | Remaining covered requirements |
| --- | --- |
| AC-01 | `FR-DIAG-01`, `FR-DIAG-07`, `FR-DIAG-08`, `FR-DIAG-09`, `FR-DIAG-11`; `NFR-01`, `NFR-02`, `NFR-03`, `NFR-04` |
| AC-02 | `FR-SCOPE-02`, `FR-DIAG-06` |
| AC-03 | `FR-DIAG-02`, `FR-DEC-01` |
| AC-04 | `FR-DIAG-03`, `FR-DIAG-04`, `FR-DEC-03`, `FR-DEC-04`, `FR-DEC-08` |
| AC-05 | `FR-DIAG-05`, `FR-DEC-02`, `FR-DEC-08` |
| AC-06 | `FR-EXEC-02`, `FR-EXEC-03`, `FR-EXEC-04`, `FR-EXEC-05`, `FR-EXEC-09`, `FR-EXEC-10`, `FR-EXEC-11`, `FR-EXEC-12`, `FR-EXEC-13`; `NFR-05`, `NFR-06` |
| AC-07 | `FR-DIAG-10`, `FR-EXEC-01`, `FR-EXEC-06`, `FR-EXEC-07`, `FR-EXEC-08`; `NFR-08` |
| AC-08 | `FR-DEC-05`, `FR-REENTRY-01`, `FR-REENTRY-02`, `FR-REENTRY-03`, `FR-REENTRY-04`, `FR-REENTRY-05`, `FR-REENTRY-06`, `FR-REENTRY-07`, `FR-REENTRY-08`; `NFR-07`, `NFR-09` |
| AC-09 | `FR-SCOPE-03`, `FR-USAGE-01`, `FR-USAGE-02`, `FR-USAGE-03` |
| AC-10 | `FR-SCOPE-04` |
| AC-11 | `FR-SCOPE-01`, `FR-DEC-08` |
| AC-12 | `FR-DEC-06`, `FR-DEC-07`; `NFR-10` |

## 11. Edge Cases

- **EC-01:** A target JSON value is an array but contains malformed allocation objects.
  `TARGET-02` count repair must not legitimize invalid content.
- **EC-02:** A request was directly approved with already-mismatched fields; approval
  evidence may preserve the mismatch rather than identify its origin.
- **EC-03:** Personnel target references already exist for an approved request. Changing
  only the request count must not imply those materialized references were
  validated.
- **EC-04:** Multiple ORG mismatch reasons may apply to one assignment or scoped row.
  Bucket totals may exceed distinct rows.
- **EC-05:** The master hierarchy itself may have changed after a historical snapshot.
  Current-scope mismatch does not automatically make the snapshot false.
- **EC-06:** A bootstrap staging row may intentionally preserve a failed resolution
  attempt. Correcting it could destroy import lineage.
- **EC-07:** An audit event may describe the scope observed at event time. Rewriting it to
  current scope is prohibited without an explicit legal/audit decision.
- **EC-08:** Two assignments may overlap only because inclusive end-date semantics count
  the transfer day twice. Another pair may be a genuine concurrent primary
  assignment. They require different decisions.
- **EC-09:** Data may drift between diagnosis, manifest creation, rehearsal, and commit.
  Any changed precondition invalidates the manifest and stops execution.
- **EC-10:** A concurrent application/import writer changes a manifest row after
  diagnosis or while the correction is acquiring locks. The old-value predicate
  or lock conflict must fail closed; live execution is not retried automatically.
- **EC-11:** A trigger may update `updated_at`, emit audit rows, or rebuild derived state.
  Expected side effects must be enumerated; unknown side effects block commit.
- **EC-12:** A concurrent index build may fail and leave an invalid index. Cleanup and
  rerun behavior must be rehearsed before approval.
- **EC-13:** A zero-violation family may still be incompatible with new foreign keys or
  application writes. Data zero is necessary, not sufficient.
- **EC-14:** A disposable restore lacks a provider extension, version, role, or
  representative load characteristic. Its DDL timings cannot be promoted as
  staging proof; the uncertainty remains explicit.
- **EC-15:** The backup exists but restore verification fails or exceeds the
  approved RPO/RTO. Live mutation remains blocked.
- **EC-16:** Provider logs may aggregate, sample, expire, or omit route-level evidence.
  Missing evidence is `unknown`, never proof of no usage.

## 12. Verification Ladder

### Plan and docs

- `git diff --check`
- current-state handoff contract
- affected-scope selector for the exact changed files
- manual presence check for every mandatory section, requirement ID, decision,
  acceptance criterion, stop rule, and rollback path
- secret/PII scan of the diff

### REM-1A local/disposable and REM-1B evidence

- SQL contract tests for each reason code and source class
- runner schema/extra-field rejection tests
- secret/PII adversarial fixtures
- single-statement or repeatable-read snapshot consistency test
- disposable database fixtures for all zero, one-reason, multi-reason, and
  cross-family cases
- proof that transaction isolation/read-only state is emitted and mutation
  statements are absent
- evidence-only diff proves its runner/query SHA already exists on merged main
- optional query-version fixture proves V1 remains unchanged and publishes an
  exact V1-to-active-version count bridge

### Correction package

- decision/manifest hash match
- runner, backup, rehearsal, decision, and receipt digest verification
- precondition and exact-row-count proof
- deterministic lock order and old-value predicate conflict fixtures
- `40001`, `40P01`, lock-timeout, and concurrent-writer fail-closed fixtures
- rollback-only rehearsal
- trigger/side-effect allowlist
- family-specific postconditions
- canonical affected checks
- sanitized receipt contract

### Constraint package

- REM-8A read-only observation receipt makes no executed-DDL timing claim
- REM-8B disposable restored-data DDL timing under synthetic concurrent writes
- REM-8C exact staging mutation/rollback evidence only when separately approved
- fresh database migration smoke
- representative upgraded database smoke
- application write-path compatibility tests
- measured disposable lock/validation behavior plus current staging workload
  observation; measured staging DDL behavior only when REM-8C exists
- invalid-index/failed-validation cleanup rehearsal
- exact rollback rehearsal
- canonical required CI checks

The full frontend release is not automatically required for docs/read-only SQL
work. It becomes required only when the affected-scope contract or a runtime
slice selects it.

## 13. Rollback Model

### Docs and diagnosis

Revert the commit. No database rollback is needed because all diagnostic
operations are read-only. Reverting an active query version never edits V1;
it restores the prior approved active-version pointer and records a new
decision receipt.

### Before a correction commit

The runner must acquire the approved locks in deterministic order, validate
old-value predicates, and end in transaction rollback. A failed precondition,
changed manifest, concurrent writer, serialization/deadlock error, unexpected
row, timeout, or postcondition prevents commit authority and invalidates the
window. Live staging is not retried automatically.

### After a correction commit

Rollback is a reviewed compensating package built from securely captured old
values. It must target the exact committed manifest, repeat preconditions, and
produce its own receipt. Old values and raw IDs remain outside Git. An arbitrary
reverse update is not an acceptable rollback.

The database restore point is disaster recovery, not the first-line method for
a small bounded correction. A full restore may cause downtime and data loss
relative to the restore point; its RPO/RTO must be owner-approved.

### Constraints

Each package owns exact rollback for only the newly added index/constraint.
Failed concurrent builds must clean up only their invalid artifact. A validated
constraint is not dropped casually if newer writes may rely on it; rollback
preconditions must account for post-deploy data.

REM-8A has no database rollback because it is read-only. REM-8B destroys only
its disposable target. REM-8C, when separately approved, owns the exact staging
artifact removal/forward-repair and post-cleanup catalog receipt before it may
be considered closed.

## 14. Stop Rules

Stop immediately and do not invent a workaround when:

- target identity is uncertain, certificate verification is not full, the CA
  is missing, or diagnosis is not proven read-only;
- output contains or may contain a URL, host, database name, credential, CA,
  token, raw ID, employee data, or unbounded payload;
- family totals drift without an explained snapshot/time basis;
- a bucket cannot be mapped to an approved semantic decision;
- a query-set revision edits V1, lacks an approved semantic decision, or has no
  adversarial V1-to-new-version count bridge;
- the exact manifest, old values, restorable backup, operator, or commit window
  is absent;
- a manifest digest/decision/runner/rehearsal binding is missing or mismatched;
- a manifest precondition changes, a concurrent writer is detected, a lock is
  acquired out of order, or an unexpected row would be touched;
- trigger/side-effect behavior is unknown or exceeds the approved impact set;
- rollback rehearsal fails or a compensating package cannot be proven;
- an `eligible_zero` family remains non-zero under its approved active query
  version; preserved/blocked V1 hits remain excluded rather than auto-repaired;
- lock, validation cost, provider support, or application compatibility is
  unmeasured;
- a read-only observation is presented as measured DDL lock duration;
- an evidence PR changes the runner/query or does not pin an already merged
  implementation SHA;
- a constraint family requires unsupported syntax or an unapproved availability
  impact;
- a branch mixes database remediation, DG1-C runtime behavior, unrelated auth,
  UI, mobile, architecture, or production work;
- required checks fail, mergeability is not clean, or actionable review remains;
  or
- any step attempts production under this plan.

## 15. Cost Posture

No paid add-on is required for REM-1A, REM-1B, or REM-2. The plan does not authorize
enabling PITR. Supabase currently documents automatic daily backups for Pro,
Team, and Enterprise and recommends regular CLI logical exports for Free-tier
projects; PITR is a separate paid add-on. The operator must first inspect the
project's existing backup capability without exposing project identity.

The zero-incremental-cost candidate is an encrypted, access-controlled logical
backup created with the supported Supabase CLI/`pg_dump` workflow and a restore
rehearsal to an isolated local/disposable target using already available
resources. Cost-free operation is not assumed until storage and target capacity
are confirmed. If that path cannot satisfy the owner's RPO/RTO, mutation stays
blocked until the owner chooses an adequate backup option. The agent must never
purchase or enable a paid service automatically.

## 16. Out Of Scope

| ID | Excluded item | Reason |
| --- | --- | --- |
| `OS-01` | Any production query or change | Staging evidence cannot authorize production. |
| `OS-02` | Automatic repair, deletion, reseeding, or broad staging cleanup | Every mutation requires an approved family manifest and separate authority. |
| `OS-03` | Classifying the 70 hits as fake data | The owner confirmed staging contains real data. |
| `OS-04` | Restoring removed Norm Kadro demo percentages | The honest presentation cleanup is already complete. |
| `OS-05` | A generic data reconciliation platform | The current need is four bounded families, not a new product/module. |
| `OS-06` | New UI, mobile, modules, redesign, or architecture refactor | They do not close the identified invariants. |
| `OS-07` | Unrelated Report Viewer/auth changes | Authorization behavior is outside this database train. |
| `OS-08` | DG1-C endpoint removal inside the database train | DG1-C is a linked independent external track. |
| `OS-09` | Rewriting immutable audit/history merely to pass a check | Historical truth may be preserved and excluded from DDL. |
| `OS-10` | Broad production launch or production constraint rollout | A new production plan and approval are mandatory. |
| `OS-11` | Purchasing or enabling provider add-ons | Cost-bearing external state requires separate owner authority. |

## 17. Completion Definition

This plan is complete only when:

1. REM-1B evidence safely explains every non-zero bucket;
2. all required `D-*` decisions are approved or honestly blocked;
3. every `valid_under_revised_semantics` decision has an approved versioned
   query/spec while V1 remains immutable;
4. every approved correction has rehearsal, commit, concurrency, postcondition,
   digest-binding, and rollback evidence;
5. REM-7 records V1 continuity plus one terminal state for every family;
6. every family entering DDL is `eligible_zero` under its active query version;
7. REM-8A/8B, plus REM-8C only when required, produce measured constraint
   evidence for every eligible family;
8. each constraint family is independently verified or explicitly excluded/
   blocked; and
9. no production operation occurred.

The plan closes with exactly one overall state:

- `completed_zero_all_families`: every selected family is eligible and zero;
- `completed_with_excluded_or_blocked_families`: eligible families are zero and
  remaining families are explicitly outside DDL; or
- `blocked_before_mutation`: no safe correction/constraint path was approved,
  real data remains unchanged, and the blocker is fully recorded.

If no family is eligible for DDL, REM-8A/8B/8C and DB-C slices are not required for
honest `blocked_before_mutation` completion. DG1-C progress does not affect any
database completion state. A zero count without decision provenance, rollback
evidence, and applicable lock measurement is insufficient.

Recorded outcome on 2026-07-12:
`completed_with_excluded_or_blocked_families`. TARGET DB-C5 is independently
verified in staging. DB-C1 through DB-C4 remain explicitly excluded/blocked on
missing authoritative history; no correction was invented, no production
operation occurred, and DG1-C remains an independent external track.

## 18. References

- `docs/evidence/readiness/2026-07-11-dg2-staging-invariant-preflight-v1.md`
- `docs/plans/dg1-dg2-locked-decisions-implementation-plan-v1.md`
- `docs/plans/database-invariant-preflight-spec-v1.md`
- `db/preflight/database-invariant-preflight-v1.sql`
- `backend/nestjs/scripts/database-invariant-preflight-core.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.ts`
- `backend/nestjs/src/modules/integration/infrastructure/assignment-materialization.repository.ts`
- [Supabase database connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase SSL enforcement guidance](https://supabase.com/docs/guides/platform/ssl-enforcement)
- [Supabase database backup guidance](https://supabase.com/docs/guides/platform/backups)
- [PostgreSQL 17 `ALTER TABLE`](https://www.postgresql.org/docs/17/sql-altertable.html)
- [PostgreSQL 17 `CREATE INDEX`](https://www.postgresql.org/docs/17/sql-createindex.html)
- [PostgreSQL 17 transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html)
