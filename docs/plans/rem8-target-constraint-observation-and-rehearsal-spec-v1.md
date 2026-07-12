# REM-8 TARGET Constraint Observation And Rehearsal Specification V1

Status: `implementation_merged_evidence_complete_pending_pr`
Shelf: architecture
Author: Codex
Decision owner: Product owner
Approved basis: `D-TARGET-DUPLICATE=reject_app_and_db`, merged REM-7 receipt,
and standing authorization dated 2026-07-12
Last verified: 2026-07-12
Target slice: REM-8A read-only staging observation plus REM-8B disposable
restored-data rehearsal; no staging DDL

## 1. Context

PR #962 merged the strict REM-7 reconciliation runner. PR #963 merged its
exact-SHA staging receipt. That receipt records:

- TARGET-02: V1 continuity `54`, active V2 `0`, `eligible_zero`;
- TARGET-03 ownership: `reject_app_and_db`, with application enforcement
  present on create and edited approval;
- ORG-02, ORG-04, and ASSIGN-01: `blocked` and excluded from this slice.

PR #964 merged the implementation at
`b60776c033528438118322b8b09652f16909f78d`. Its exact-SHA REM-8A receipt proves
PostgreSQL 17, 61 live TARGET rows, zero TARGET compatibility violations, exact
pilot index state, absent candidate artifacts, zero long transactions, and no
conflicting lock pressure. Its exact-SHA REM-8B receipt proves 59 migrations,
5,001 restored synthetic rows, expected `23514`/`55P03`, 20/20 writers,
successful validation, rollback, and cleanup with matching package digests.
The reviewed result is `rem_8c_not_required`; no staging DDL timing is claimed.

TARGET has two storage representations:

1. ordinary target requests store final allocations in
   `ops.target_distribution_request.allocation_json`;
2. pilot-import requests keep an empty allocation array and store approved
   employees in `ops.personnel_target_reference`, whose approved rows already
   have a partial unique index by employee, period, and target type.

The missing database half is therefore narrow: reject repeated `employeeId`
values in ordinary final allocation arrays without rewriting preserved rows or
constraining historical `approval_evidence_json`. A b-tree/GIN index cannot
express uniqueness inside one JSON array, so the candidate is an immutable
input-only SQL function plus a versioned CHECK constraint.

PostgreSQL 17 documents that `ADD CHECK ... NOT VALID` skips the existing-row
scan but enforces new writes, while `VALIDATE CONSTRAINT` scans existing rows
under `SHARE UPDATE EXCLUSIVE`. `ADD CONSTRAINT` otherwise uses
`ACCESS EXCLUSIVE`. PostgreSQL also assumes CHECK predicates are immutable;
the function must therefore depend only on its JSON argument and may never be
silently replaced while the constraint exists.

Primary references:

- https://www.postgresql.org/docs/17/sql-altertable.html
- https://www.postgresql.org/docs/17/sql-createfunction.html
- https://www.postgresql.org/docs/17/functions-json.html
- https://www.postgresql.org/docs/17/ddl-constraints.html

## 2. Functional Requirements

- **FR-01 — Exact semantic:** The candidate function MUST reject only a JSON
  array containing the same string `employeeId` more than once after lowercase
  normalization. It MUST return true for non-array JSON, non-object entries,
  or entries without a string `employeeId`; shape/count policy remains owned by
  existing V1/V2 invariants and application DTOs.
- **FR-02 — Storage split:** Ordinary `allocation_json` MUST use the new CHECK.
  Pilot-import empty arrays MUST remain valid, and the existing approved
  personnel-reference unique index MUST remain present, valid, and unchanged.
  `approval_evidence_json` MUST remain unconstrained historical evidence.
- **FR-03 — Writer inventory:** Static contracts MUST inventory every tracked
  INSERT/UPDATE writer for `ops.target_distribution_request`: target create,
  edited/direct approval, pilot roster import, seeds, and diagnostic fixtures.
  Unclassified runtime writers fail closed.
- **FR-04 — Immutable package:** Candidate function SQL, add-NOT-VALID SQL,
  validate SQL, and rollback SQL MUST be separate versioned files. Every file
  digest MUST be receipt-bound. The package MUST use `CREATE FUNCTION`, never
  `CREATE OR REPLACE FUNCTION`, and MUST refuse pre-existing conflicting
  artifacts.
- **FR-05 — REM-8A snapshot:** The staging observation MUST use one connection
  and one `REPEATABLE READ READ ONLY` transaction. It MUST bind the merged REM-7
  receipt digest and observe only TARGET-owned catalog/workload facts.
- **FR-06 — Capacity facts:** REM-8A MUST report sanitized aggregate table,
  index, and total bytes; estimated/live/dead rows; insert/update/delete counters;
  server major version; partition state; active/long transaction buckets; target
  relation lock counts by allowlisted mode/granted state; and stats age.
- **FR-07 — Compatibility facts:** REM-8A MUST verify active V2 TARGET count,
  repeated ordinary employee IDs, approved pilot-reference duplicates,
  allocation non-array count, required approved-reference index state,
  existing candidate artifact state, and a sanitized non-ANALYZE plan shape.
- **FR-08 — Lock declaration:** Receipts and docs MUST declare
  `ADD CHECK NOT VALID = ACCESS EXCLUSIVE` and
  `VALIDATE CONSTRAINT = SHARE UPDATE EXCLUSIVE`. Observation timing MUST NOT be
  described as executed staging DDL timing.
- **FR-09 — Strict observation receipt:** REM-8A output MUST use typed exact
  allowlists, canonical SHA-256, reject extra fields, bind reviewed SHA/runner/
  queries/target fingerprint, and reuse the existing secret/PII sanitizer.
- **FR-10 — One-shot evidence:** The REM-8A launcher MUST require exact merged
  SHA, clean evidence branch, `origin/main`, verify-full CA, bounded
  Europe/Istanbul window, project fingerprint, owner authorization, atomic
  attempt marker, accepted exit codes, and empty stderr.
- **FR-11 — Disposable restore:** REM-8B MUST build a fresh PostgreSQL 17 source
  through all migrations, seed only synthetic representative TARGET rows, create
  a custom-format logical dump, restore it into a separately named disposable
  database, compare aggregate migration/schema/TARGET counts, and delete both
  databases and the dump in `finally`.
- **FR-12 — Restore boundary:** REM-8B receipt MUST identify its source as
  `synthetic_migrated_fixture`, its representativeness as
  `schema_writer_and_scale_contract_only`, and MUST never promote its timing as
  staging data or provider timing.
- **FR-13 — Failure rehearsal:** With a pre-existing synthetic duplicate row,
  REM-8B MUST add the NOT VALID constraint, prove validation fails with the
  allowlisted CHECK-violation SQLSTATE, prove the artifact remains not validated,
  remove only the candidate constraint, remove the synthetic violation, and
  leave no unexpected artifact.
- **FR-14 — Lock-timeout rehearsal:** While a synthetic writer holds a
  conflicting transaction, ADD NOT VALID MUST fail on the configured lock
  timeout without partial constraint creation. After release, the same exact
  DDL MUST succeed.
- **FR-15 — Concurrent validation:** During successful validation, bounded
  synthetic INSERT/UPDATE writers MUST continue with unique arrays. The receipt
  MUST record writer attempts/successes/failures and validation duration. A
  duplicate new write MUST fail with CHECK violation after ADD NOT VALID.
- **FR-16 — Cleanup and rollback:** REM-8B MUST drop the validated candidate
  constraint, then drop the candidate function, verify both absent, verify a
  normal writer still succeeds, and destroy the disposable restore. Rollback
  SQL and order MUST be digest-bound.
- **FR-17 — Index disposition:** The candidate MUST declare
  `not_applicable_no_index_candidate`. Candidate SQL MUST contain no CREATE
  INDEX. Tests MUST reject introducing an index without a new specification and
  transaction-boundary design.
- **FR-18 — Decision rule:** REM-8C MAY be omitted only when current REM-8A
  staging scale/pressure facts fit within conservative REM-8B scale, required
  artifacts/dependencies are compatible, failure cleanup is deterministic, and
  no unknown provider/lock behavior remains material. Otherwise state exactly
  `rem_8c_required`; never choose optimism by default.
- **FR-19 — Evidence-only PR:** After implementation merges, REM-8A staging
  execution MUST occur on an exact-SHA evidence branch. That PR may contain only
  sanitized receipt/evidence, handoff/plan/index updates, and no implementation
  file. Any query/runner/DDL/test change requires a new implementation PR/SHA.

## 3. Non-Functional Requirements

- **NFR-01 — Privacy:** No URL, host/database identity, CA content/path,
  credential, PID, username, query text, raw UUID, personnel field, row sample,
  manifest, or business payload may enter stdout, stderr, receipts, or Git.
- **NFR-02 — Read-only staging:** REM-8A is the only staging action in this
  slice and MUST be read-only. REM-8B MUST refuse non-local or ambiguously named
  targets. No staging/production DDL is permitted.
- **NFR-03 — Timeouts:** Observation uses connection/idle/query/statement
  `5000/1000/30000/30000` ms. Rehearsal owns explicit connection, lock,
  statement, and writer deadlines and fails closed on timeout.
- **NFR-04 — Determinism:** Exact artifact names, SQL digests, cleanup order,
  synthetic scale, writer count, and expected SQLSTATEs are versioned constants.
- **NFR-05 — Reviewability:** One implementation PR owns spec, read-only query,
  contracts, runner/launcher, candidate/rollback SQL, disposable harness,
  fixtures, package scripts, and handoff. No runtime product or migration file
  changes.
- **NFR-06 — Cost:** Use existing local Docker and the existing staging database
  read-only connection. Enable no paid service, new project, PITR, extension, or
  provider setting.
- **NFR-07 — Bounded load:** Synthetic writers are local, fixed-count, and
  cancellable. REM-8A never generates load or runs `ANALYZE`/DDL.
- **NFR-08 — One shot:** A started REM-8A evidence attempt consumes the merged
  SHA whether it succeeds or fails. No retry on the same SHA.
- **NFR-09 — Honest timing:** Local restore/rehearsal duration and staging
  catalog/workload observation are distinct facts. Neither substitutes for an
  executed staging DDL measurement.

## 4. Acceptance Criteria

- **AC-01 / FR-01..04:** Given case variants of the same employee ID, ordinary
  duplicate arrays are rejected, unique arrays pass, pilot empty arrays pass,
  approval history is untouched, and every writer is classified.
- **AC-02 / FR-05..09:** Given a valid disposable/read-only observation fixture,
  one exact snapshot emits strict sanitized capacity, compatibility, lock, plan,
  artifact, and source-digest facts.
- **AC-03 / FR-05..10, NFR-01..03, NFR-08:** Given merged staging evidence
  inputs, branch/target/window/CA/SHA checks occur before connection; output is
  verify-full/read-only/repeatable-read, stderr-empty, one-shot, and secret-free.
- **AC-04 / FR-11, FR-12, NFR-02, NFR-06:** Given a fresh local source, all
  migrations and synthetic rows dump/restore into a separate disposable DB,
  aggregate counts match, and all temporary artifacts are destroyed.
- **AC-05 / FR-13, FR-16:** Given a restored duplicate row, validation fails on
  the expected SQLSTATE, only the candidate is cleaned, the defect is removed,
  and successful rehearsal may start from a known-clean catalog.
- **AC-06 / FR-14:** Given a held conflicting writer, ADD NOT VALID times out,
  creates no partial constraint, and succeeds after the writer releases.
- **AC-07 / FR-15:** Given the candidate is NOT VALID, duplicate new writes are
  rejected; unique writers continue during validation; validation succeeds and
  records bounded timing/counters.
- **AC-08 / FR-16, FR-17:** Given a validated candidate, exact rollback removes
  constraint then function, proves absence, leaves writer compatibility intact,
  and creates/cleans no index.
- **AC-09 / FR-18, NFR-09:** Given REM-8A and REM-8B receipts, the decision
  function emits exactly `rem_8c_not_required`, `rem_8c_required`, or `blocked`,
  with typed reasons and no executed-staging-DDL claim.
- **AC-10 / FR-19, NFR-05:** Given the evidence branch diff, only evidence,
  handoff, plan, and index classes pass; any implementation path fails closed.

## 5. Edge Cases

- **EC-01:** JSON is non-array, scalar, null-like JSON, or contains non-objects;
  duplicate policy alone returns true and does not steal shape ownership.
- **EC-02:** `employeeId` is missing or non-string; duplicate policy ignores it;
  existing DTO/invariant policy remains authoritative.
- **EC-03:** Same ID differs only by character case; reject as duplicate.
- **EC-04:** Pilot request has empty JSON and approved references; JSON CHECK
  passes while the existing partial unique index remains the pilot DB guard.
- **EC-05:** Candidate function/constraint exists with unknown definition,
  validity, or dependency; block rather than replace/drop it.
- **EC-06:** Required pilot unique index is absent, invalid, or definition-drifted;
  block constraint entry.
- **EC-07:** REM-7 receipt digest/source SHA or TARGET eligibility drifts; block.
- **EC-08:** Staging TARGET count/duplicates become non-zero; return to diagnosis,
  never auto-repair.
- **EC-09:** Table is partitioned or server major differs from reviewed PG17;
  require a new design/rehearsal.
- **EC-10:** Long transaction or conflicting lock pressure exceeds threshold;
  REM-8C or a later operational window is required.
- **EC-11:** ADD NOT VALID lock timeout creates an artifact unexpectedly; safety
  failure until exact cleanup is proven.
- **EC-12:** Validation fails for a row not owned by the synthetic defect;
  stop and preserve only sanitized aggregate evidence.
- **EC-13:** Concurrent writer fails for a reason other than expected duplicate
  CHECK rejection; rehearsal fails.
- **EC-14:** Dump/restore tool version, extension, schema count, migration count,
  or TARGET count differs; restored-data claim is blocked.
- **EC-15:** Cleanup cannot prove candidate constraint/function and dump/source/
  restore targets absent; rehearsal fails and no live gate opens.
- **EC-16:** Receipt contains raw target identity, PID, query text, UUID, email,
  CA, URL, or unexpected field; reject before evidence write.
- **EC-17:** Windows cannot spawn `npm.cmd` directly; use the reviewed
  `cmd.exe /d /s /c` wrapper.
- **EC-18:** Evidence totals drift after an attempt; consume the SHA and require
  a new implementation/evidence cycle rather than retrying.

## 6. API Contracts

No public HTTP, OpenAPI, DTO, authorization, role, UI, mobile, or runtime API
contract changes.

```ts
type Rem8AObservation = {
  querySetVersion: "rem8-target-constraint-observation-v1";
  observedAt: string;
  rem7ReceiptDigest: string;
  server: { major: 17 };
  targetTable: {
    estimatedRows: number;
    liveRows: number;
    deadRows: number;
    tableBytes: number;
    indexBytes: number;
    totalBytes: number;
    partitioned: false;
  };
  writes: {
    inserted: number;
    updated: number;
    deleted: number;
    statsAgeSeconds: number | null;
  };
  transactions: {
    activeCount: number;
    over5sCount: number;
    over30sCount: number;
    maxAgeMs: number;
  };
  locks: Array<{ mode: string; granted: boolean; count: number }>;
  compatibility: {
    activeTargetV2Hits: number;
    ordinaryDuplicateRows: number;
    pilotDuplicateGroups: number;
    nonArrayRows: number;
    pilotUniqueIndex: "present_valid_exact";
  };
  artifacts: {
    functionState: "absent";
    constraintState: "absent";
    indexStrategy: "not_applicable_no_index_candidate";
  };
  plan: { nodeTypes: string[]; totalCost: number; planRows: number };
  candidate: {
    functionDigest: string;
    addConstraintDigest: string;
    validateConstraintDigest: string;
    rollbackDigest: string;
    addLock: "access_exclusive";
    validateLock: "share_update_exclusive";
  };
  state: "eligible_for_disposable_rehearsal" | "blocked";
  reasons: string[];
};

type Rem8BRehearsal = {
  receiptVersion: "1";
  event: "rem8_target_constraint.disposable_rehearsal_completed";
  restoreSourceClass: "synthetic_migrated_fixture";
  representativeness: "schema_writer_and_scale_contract_only";
  migrationCount: number;
  restoredTargetRows: number;
  syntheticScaleRows: number;
  failureValidationSqlState: "23514";
  lockTimeoutSqlState: "55P03";
  writerAttempts: number;
  writerSuccesses: number;
  writerFailures: number;
  addConstraintMs: number;
  validateConstraintMs: number;
  rollbackMs: number;
  constraintValidated: true;
  duplicateWriteRejected: true;
  cleanupVerified: true;
  indexStrategy: "not_applicable_no_index_candidate";
  packageDigests: Record<string, string>;
  receiptDigest: string;
};
```

Safe decision outputs:

```ts
type Rem8Decision = {
  decision: "rem_8c_not_required" | "rem_8c_required" | "blocked";
  reasons: string[];
  stagingDdlExecuted: false;
};
```

## 7. Data Models

No migration or persistent schema change is applied in REM-8A/8B.

| Artifact | Ownership | Rule |
| --- | --- | --- |
| `allocation_json` | final ordinary allocations | new candidate CHECK only |
| `approval_evidence_json` | immutable approval history | never constrained by this package |
| approved personnel references | pilot-import allocations | existing partial unique index unchanged |
| candidate function | versioned package SQL | immutable, input-only, absent before apply |
| candidate CHECK | versioned package SQL | ADD NOT VALID then separate VALIDATE |
| REM-8A receipt | sanitized staging aggregate | read-only, exact SHA, one shot |
| REM-8B receipt | sanitized disposable aggregate | local restored fixture only |
| dump/source/restore | local ephemeral | exact safe names; always removed |

Candidate names:

```text
ops.target_distribution_employee_ids_unique_v1(jsonb)
ck_target_distribution_employee_ids_unique_v1
```

## 8. Out Of Scope

- **OS-01:** staging or production DDL;
- **OS-02:** any production connection or operation;
- **OS-03:** correction DML, manifests, row winners, writer pause, or backup of
  real staging data in the implementation PR;
- **OS-04:** constraints for ORG-02, ORG-04, ASSIGN-01, TARGET count parity,
  JSON shape, approval history, or target values;
- **OS-05:** changing the existing pilot-reference unique index;
- **OS-06:** migration, runtime repository/service, API, auth, UI, mobile,
  scoring, queue, or provider configuration changes;
- **OS-07:** CREATE INDEX, extension, trigger, generated column, or RLS work;
- **OS-08:** claiming local timing equals staging DDL timing;
- **OS-09:** paid services, managed restore project, PITR, broad production, or
  generic constraint framework work.

## 9. Verification And Traceability

Required implementation verification:

- red-green-refactor contract/source/CLI tests;
- static writer inventory and SQL scope guards;
- candidate semantic fixtures for EC-01 through EC-04;
- fresh 59-migration source, logical dump/restore, aggregate count parity;
- validation-failure cleanup, lock-timeout, concurrent writer, duplicate-write,
  successful validation, rollback, and zero-residue rehearsal;
- strict receipt/extra-field/sanitizer/digest tests;
- launcher branch/SHA/window/CA/one-shot/Windows tests;
- evidence-only scope negative test;
- `git diff --check`, secret scan, affected selector, and only canonical checks
  selected by repository policy.

Trace table:

| Requirement | Acceptance |
| --- | --- |
| `FR-01..04` | `AC-01` |
| `FR-05..09` | `AC-02`, `AC-03` |
| `FR-10` | `AC-03` |
| `FR-11..12` | `AC-04` |
| `FR-13` | `AC-05` |
| `FR-14` | `AC-06` |
| `FR-15` | `AC-07` |
| `FR-16..17` | `AC-08` |
| `FR-18` | `AC-09` |
| `FR-19` | `AC-10` |
| `NFR-01..03` | `AC-02..07` |
| `NFR-04` | `AC-01`, `AC-04..08` |
| `NFR-05..06` | `AC-04`, `AC-10` |
| `NFR-07` | `AC-03`, `AC-07` |
| `NFR-08` | `AC-03` |
| `NFR-09` | `AC-09` |

Sokrates stop conditions:

1. Any family other than TARGET enters the package.
2. TARGET active/duplicate evidence becomes non-zero.
3. Candidate artifacts or pilot index drift from reviewed state.
4. A staging step is not read-only.
5. Restore/lock/failure cleanup cannot prove zero unintended residue.
6. REM-8C or DB-C5 is proposed without its own later package/gates.
7. Evidence requires a raw target identity, credential, row, PID, or query text.
