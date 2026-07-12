# Staging Remediation Reconciliation Specification V1

Status: `approved_for_repository_only_implementation`
Shelf: architecture
Author: Codex
Decision owner: Product owner
Approved basis: locked REM-2 decisions and standing authorization dated 2026-07-12
Last verified: 2026-07-12
Target slice: REM-7 implementation followed by a separate exact-SHA evidence PR

## 1. Context

The immutable V1 preflight reported 70 check hits. The approved V2 semantics
later reported `TARGET-02=0`, `ORG-02=3`, `ASSIGN-01=4`, and `ORG-04=7142`.
REM-2C then deduplicated the non-target findings into 832 authority units and
proved that the approved employee rotation/lifecycle source is absent.

The target rows are preserved under the approved dual-source V2 semantics. The
application half of `D-TARGET-DUPLICATE=reject_app_and_db` rejects duplicate
employees on new requests and edited approvals. Database enforcement is not yet
authorized. ORG-02, ORG-04, and ASSIGN-01 have no row-level correction authority
and therefore cannot enter a correction package.

REM-7 must convert those facts into one versioned terminal-state receipt. It is
not a repair runner and must not manufacture global zero. The repository-only
implementation merges before one separately guarded staging evidence run.

## 2. Functional Requirements

- **FR-01:** The implementation MUST consume the existing V1 SQL, V2 SQL, and
  row-authority classifier V1 byte-for-byte and MUST bind each source digest in
  its receipt.
- **FR-02:** V1, V2, and classifier reads MUST execute on one connection inside
  one `REPEATABLE READ READ ONLY` transaction with verified isolation and
  read-only state.
- **FR-03:** The V1 adapter MUST require exactly the reviewed eleven check IDs,
  one non-negative count per ID, and no duplicate or unknown ID.
- **FR-04:** The V2 adapter MUST reuse the merged strict V2 validator and MUST
  reconcile its four family totals with the V1-to-V2 bridge.
- **FR-05:** The authority adapter MUST reuse the merged strict classifier
  validator and MUST reconcile ORG-02, ORG-04, and ASSIGN-01 check-hit totals
  with V2 plus their authority-unit totals with the classifier overall.
- **FR-06:** The terminal-state vocabulary MUST be exactly `eligible_zero`,
  `preserved_excluded`, `blocked`, and `not_applicable`.
- **FR-07:** `TARGET-02` MUST be `eligible_zero` only when active V2 reports zero,
  the locked preserve/revised-semantics decision refs are bound, TARGET-03 is
  zero in the same V1 snapshot, and target duplicate application enforcement is
  present in the reviewed runner SHA.
- **FR-08:** ORG-02, ORG-04, and ASSIGN-01 MUST be `blocked` while their active
  totals are non-zero or their exact authoritative manager/rotation facts are
  absent. The runner MUST NOT infer a winner from current, created, updated,
  audit, or nearby timestamps.
- **FR-09:** Each family state MUST declare active query version, V1 continuity
  count, active count, authority-unit count when applicable, decision refs,
  constraint eligibility, reason code, and next gate.
- **FR-10:** The receipt MUST declare that `eligible_zero` authorizes only REM-8
  preparation; it MUST NOT authorize DML, DDL, backup, writer pause, correction,
  production, or paid services.
- **FR-11:** The receipt MUST be strict, canonical SHA-256 digest-bound, reject
  extra fields, and pass the existing pre-parse secret/PII safety vocabulary.
- **FR-12:** The merged launcher MUST bind reviewed commit, clean evidence
  branch, `origin/main`, target/project fingerprint, CA PEM, Europe/Istanbul
  window, one atomic attempt marker, and empty stderr.
- **FR-13:** Implementation tests MUST include a migrated disposable database
  fixture that proves TARGET eligible-zero and the other three families blocked,
  then rolls back and leaves zero residue.
- **FR-14:** The evidence PR MUST contain only the sanitized receipt, adjacent
  evidence document, handoff/plan updates, and documentation index changes. A
  query, runner, contract, allowlist, launcher, script, or test change requires a
  new implementation PR and new reviewed SHA.

## 3. Non-Functional Requirements

- **NFR-01 — Privacy:** Output MUST contain zero URL, host/database identity, CA
  content/path, credential, raw UUID, name, email, personnel field, manifest, or
  business payload. Samples, if any, are at most five 12-character hashes per
  bucket.
- **NFR-02 — Consistency:** One repeatable-read snapshot MUST own every source
  count and family state; later receipts never combine earlier evidence files as
  if they were a live snapshot.
- **NFR-03 — Timeouts:** Connection, idle, query, and statement timeouts MUST
  remain `5000/1000/30000/30000` milliseconds.
- **NFR-04 — Safety:** Implementation SQL MUST be read-only and static guards
  MUST reject DML, DDL, grants, function creation, migration, or provider calls.
- **NFR-05 — Reviewability:** The implementation PR owns only REM-7 contracts,
  fixtures, runner/launcher, package scripts, spec, and handoff. Runtime product,
  API, authorization, migration, and UI files MUST NOT change.
- **NFR-06 — Cost:** No paid service or provider setting is required or enabled.
- **NFR-07 — One shot:** A failed or completed staging attempt consumes its SHA;
  the same reviewed SHA MUST NOT be retried.

## 4. Acceptance Criteria

- **AC-01 / FR-01..09, NFR-02:** Given the disposable fixture with V1/V2 and
  classifier findings, when REM-7 runs, then TARGET is `eligible_zero`, the
  other three families are `blocked`, every count reconciles, and all source
  digests are present.
- **AC-02 / FR-01, FR-03..05, NFR-04:** Given any byte change to V1, V2, or the
  classifier, when source digests or strict adapters run, then the contract
  fails rather than reinterpreting old evidence.
- **AC-03 / FR-03..09, FR-11:** Given a missing/duplicate/unknown family, check,
  reason, source, unit, decision ref, state, next gate, or extra receipt field,
  when validated, then validation fails closed.
- **AC-04 / FR-07, FR-10, NFR-05:** Given TARGET active count is non-zero,
  TARGET-03 is non-zero, or application enforcement proof is absent, when
  terminal state is built, then TARGET is not `eligible_zero` and no constraint
  preparation authority is emitted.
- **AC-05 / FR-08..10:** Given ORG/assignment authority remains absent or
  ambiguous, when reconciliation runs, then those families stay `blocked` and
  no correction direction, row winner, manifest, or DML gate is emitted.
- **AC-06 / FR-02, FR-11, NFR-01..04:** Given a valid run, when the receipt is
  serialized, then read-only/isolation/timeout proof and canonical digests pass,
  stderr is empty, unsafe text is absent, and the transaction is rolled back.
- **AC-07 / FR-12, NFR-07:** Given a reviewed merged SHA, when the evidence
  launcher runs, then branch/HEAD/origin-main/target/window/CA/attempt checks all
  pass before connection and a second attempt for the SHA is refused.
- **AC-08 / FR-13, NFR-04:** Given a fresh disposable database, when migrations
  and the adversarial fixture run, then expected terminal states are emitted,
  rollback completes, and fixture residue is zero.
- **AC-09 / FR-14, NFR-05, NFR-06:** Given the evidence branch diff, when scope guards
  run, then only the five evidence/handoff/index classes are present and all
  implementation files are unchanged from the merged SHA.

## 5. Edge Cases

- **EC-01:** V1 contains an unknown check ID or omits TARGET-03; fail closed.
- **EC-02:** V2 bridge totals do not reconcile with V1; fail closed.
- **EC-03:** Classifier check-hit totals do not reconcile with V2; fail closed.
- **EC-04:** Classifier authority units exceed check hits or omit a required
  blocked family; fail closed.
- **EC-05:** TARGET-02 is zero but TARGET-03 becomes non-zero in the same
  snapshot; TARGET is blocked from REM-8.
- **EC-06:** TARGET application enforcement source/hash is absent from the
  reviewed SHA; TARGET is blocked from REM-8.
- **EC-07:** A future approved rotation source appears; V1 reconciliation MUST
  fail with `source_contract_version_change_required` until a new classifier is
  reviewed.
- **EC-08:** A family active count is zero but its decision refs are missing;
  zero alone does not make it eligible.
- **EC-09:** A receipt contains a raw UUID, URL, certificate, email, name, or
  unbounded sample; reject before evidence write.
- **EC-10:** Windows cannot spawn `npm.cmd` directly; use the reviewed
  `cmd.exe /d /s /c` wrapper.
- **EC-11:** SQLSTATE, timeout, TLS, target, isolation, or read-only proof fails;
  roll back and emit only an allowlisted safe error.
- **EC-12:** Evidence totals drift from prior receipts. Record a new observed
  snapshot only after all current strict contracts pass; never patch old
  evidence or retry the consumed SHA.

## 6. API Contracts

No public HTTP or OpenAPI contract changes.

```ts
type TerminalState =
  | "eligible_zero"
  | "preserved_excluded"
  | "blocked"
  | "not_applicable";

type ReconciliationFamily = "TARGET-02" | "ORG-02" | "ORG-04" | "ASSIGN-01";

type FamilyReconciliation = {
  family: ReconciliationFamily;
  state: TerminalState;
  v1ContinuityCount: number;
  activeCount: number;
  authorityUnitCount?: number;
  activeQuerySetVersion: string;
  decisionRefs: string[];
  constraintEligibility: "eligible_after_rem8" | "excluded" | "blocked";
  reason: string;
  nextGate: "rem_8" | "authoritative_row_evidence" | "none";
};

type ReconciliationResult = {
  querySetVersion: "staging-remediation-reconciliation-v1";
  observedAt: string;
  sourceDigests: {
    invariantV1: string;
    invariantV2: string;
    authorityClassifierV1: string;
  };
  applicationContracts: Array<{
    code: "target_duplicate_employee_rejected";
    state: "present";
    sourceDigest: string;
  }>;
  families: FamilyReconciliation[];
  overallState: "target_eligible_other_families_blocked" | "blocked";
};

type ReconciliationReceipt = {
  receiptVersion: "1";
  event: "staging_remediation_reconciliation.completed";
  reviewedCommit: string;
  runnerDigest: string;
  targetFingerprint: string;
  targetClass: "disposable" | "staging";
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
  queryResult: ReconciliationResult;
  receiptDigest: string;
};
```

Errors are strict allowlisted codes such as `approval_missing`,
`target_identity_mismatch`, `source_digest_mismatch`,
`v1_v2_reconciliation_mismatch`, `authority_reconciliation_mismatch`,
`terminal_state_prerequisite_missing`, `source_contract_version_change_required`,
and `sanitization_failed`. Free-form database errors are not emitted.

## 7. Data Models

No table, column, index, trigger, function, RLS policy, grant, migration, or
business row is added or changed.

| Artifact | Type | Ownership/constraint |
| --- | --- | --- |
| V1 invariant query | Immutable SQL file | Continuity only; byte digest bound |
| V2 invariant query | Immutable SQL file | Active approved family semantics |
| Authority classifier V1 | Immutable SQL/typed result | ORG/assignment authority units; no winners |
| Target duplicate application contract | Reviewed source/test digest | Create and edited approval reject repeated employee IDs |
| Reconciliation result | In-memory typed object | Exact four families and terminal vocabulary |
| Reconciliation receipt | Sanitized JSON | Canonical SHA-256, strict fields, no raw data |
| Attempt marker | Local temporary JSON | One reviewed SHA; never committed |

## 8. Out Of Scope

- **OS-01:** staging execution in the implementation PR;
- **OS-02:** any production connection or operation;
- **OS-03:** correction manifest, backup, restore, writer pause, DML, or rollback
  rehearsal;
- **OS-04:** DDL, migration, index, constraint, function, trigger, RLS, or grant;
- **OS-05:** inferred manager, region, primary assignment, or rotation winner;
- **OS-06:** edits to V1, V2, classifier V1, or their historical evidence;
- **OS-07:** public API, auth, permission, UI, mobile, provider, queue, or scoring
  behavior;
- **OS-08:** REM-8 implementation or a claim that TARGET is already safe for
  staging DDL;
- **OS-09:** paid services or broad-production readiness.

## 9. Verification And Traceability

- Every FR and NFR is referenced by AC-01 through AC-09.
- EC-01 through EC-12 receive contract, launcher, or disposable fixture tests.
- Static guards prove read-only SQL and immutable V1/V2/classifier hashes.
- Targeted contract/CLI tests, backend lint/build, disposable migration smoke,
  root scripts, diff/secret checks, and the affected selector run before PR.
- Only the canonical release gate selected by repository policy is executed;
  two full release suites never run concurrently.
- The evidence operation occurs only after the implementation PR merges and a
  fresh branch is pinned to its exact merge SHA.

| Requirement | Acceptance evidence |
| --- | --- |
| `FR-01` | `AC-01`, `AC-02` |
| `FR-02` | `AC-01`, `AC-06` |
| `FR-03` | `AC-01`, `AC-02`, `AC-03` |
| `FR-04` | `AC-01`, `AC-02`, `AC-03` |
| `FR-05` | `AC-01`, `AC-02`, `AC-03` |
| `FR-06` | `AC-01`, `AC-03` |
| `FR-07` | `AC-01`, `AC-04` |
| `FR-08` | `AC-01`, `AC-05` |
| `FR-09` | `AC-01`, `AC-03`, `AC-05` |
| `FR-10` | `AC-04`, `AC-05` |
| `FR-11` | `AC-03`, `AC-06` |
| `FR-12` | `AC-07` |
| `FR-13` | `AC-08` |
| `FR-14` | `AC-09` |
| `NFR-01` | `AC-06` |
| `NFR-02` | `AC-01`, `AC-06` |
| `NFR-03` | `AC-06` |
| `NFR-04` | `AC-02`, `AC-06`, `AC-08` |
| `NFR-05` | `AC-04`, `AC-09` |
| `NFR-06` | `AC-09` |
| `NFR-07` | `AC-07` |
