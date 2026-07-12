# Staging Remediation Row Authority Classifier Specification V1

Status: `approved`
Shelf: architecture
Author: Codex
Owner/reviewer: Product owner
Approval basis: standing owner authorization recorded 2026-07-12
Approved: 2026-07-12
Target slice: `REM-2C`
Evidence prerequisite: merged V2 receipt at
`docs/evidence/readiness/2026-07-12-staging-remediation-invariant-v2.json`

## 1. Context

The validated V2 staging receipt reports `7149` invariant `check_hits`:
`ORG-04=7142`, `ORG-02=3`, `ASSIGN-01=4`, and `TARGET-02=0`. The V2 result is
safe evidence, but it is not a correction manifest. In particular, one missing
or ambiguous region-manager authority unit can affect many KPI period rows.
Treating the aggregate as 7149 independent defects would create a broad and
potentially destructive repair.

The repository has effective-dated `ops.user_role_assignment` and
`ops.user_action_store_assignment` records for region-manager read/action
scope. It does not have a dedicated approved employee/store rotation or
assignment-lifecycle request/event contract. `audit.entity_change_log` has no
repository writer, and generic timestamps or current store state are not an
approved rotation source. The classifier must therefore explain RBAC/portfolio
coverage while refusing to infer ORG-02 or ASSIGN-01 row winners.

This slice is an implementation-only, read-only diagnostic. It runs against
local/disposable fixtures before merge. A later evidence-only branch may run
the exact merged SHA once against staging under the existing standing
authorization and target/TLS/one-shot gates.

## 2. Functional Requirements

- **FR-01 — Version boundary:** the implementation MUST add a new query set,
  runner, typed contract, tests, and one-shot launcher. It MUST NOT edit the
  immutable V1 or V2 SQL, receipts, or invariant meanings.
- **FR-02 — Shared snapshot:** the runner MUST execute the merged V2 query and
  the authority classifier inside one explicit `REPEATABLE READ READ ONLY`
  transaction. It MUST roll back before releasing sanitized stdout.
- **FR-03 — Exact reconciliation:** every non-zero V2 `ORG-04`, `ORG-02`, and
  `ASSIGN-01` check hit MUST map to exactly one allowed authority bucket.
  Bucket check-hit totals MUST equal the same-snapshot V2 family totals.
  `TARGET-02=0` MUST remain visible in the V2 totals but MUST NOT create a
  classifier bucket.
- **FR-04 — Authority-unit semantics:** the classifier MUST separately report
  `checkHitCount` and `authorityUnitCount`. ORG-04 manager-authority units MUST
  be unique `(source class, store, authority date)` tuples; generic ORG-04
  hierarchy units MUST be source records. ORG-02 units MUST be assignment rows;
  ASSIGN-01 units MUST be affected employee authority cases, deduplicating the
  overlap and multiple-open-primary hits for the same employee. No
  distinct-person count MAY be claimed.
- **FR-05 — ORG-04 root causes:** each ORG-04 hit MUST use the first matching
  reason in this deterministic priority:
  1. `org04.scope_hierarchy_mismatch`;
  2. `org04.role_assignment_never_configured`;
  3. `org04.role_assignment_not_effective`;
  4. `org04.region_portfolio_not_effective`;
  5. `org04.duplicate_rows_same_manager`;
  6. `org04.mixed_scope_multiple_managers`;
  7. `org04.multiple_distinct_managers`;
  8. `org04.unique_manager_region_mismatch`.
  A V2 hit that matches none MUST fail the complete receipt.
- **FR-06 — Candidate identity:** ambiguity MUST distinguish candidate role
  rows from distinct candidate users. Multiple overlapping rows for one user
  MUST be `duplicate_rows_same_manager`; more than one user MUST be a multiple
  manager reason. A direct-store plus region-portfolio collision MUST be the
  mixed-scope reason.
- **FR-07 — Historical coverage:** zero-candidate ORG-04 findings MUST
  distinguish no relevant role assignment ever, relevant assignments that are
  not effective on the authority date, and effective region roles whose store
  portfolio is not effective on that date.
- **FR-08 — ORG-02 source contract:** all ORG-02 V2 hits MUST be classified as
  `org02.rotation_authority_source_absent` until a separately approved,
  effective-dated store/assignment rotation source exists. Current store
  region, `created_at`, `updated_at`, generic import/audit timestamps, and
  unowned `audit.entity_change_log` rows MUST NOT select an effective date or
  correction winner.
- **FR-09 — ASSIGN-01 source contract:** all ASSIGN-01 V2 hits MUST be
  classified as `assign01.rotation_authority_source_absent` until the same
  approved lifecycle source exists. Latest-row, earliest-row, created-time,
  current-store, or arbitrary primary preference MUST NOT select a winner.
- **FR-10 — Structural drift:** if a repository-approved rotation authority
  contract appears, this V1 classifier MUST fail closed with
  `source_contract_version_change_required`; enabling it requires a new query
  version, fixtures, decision trace, and evidence PR.
- **FR-11 — Bounded output:** output MUST contain only typed reason/source
  codes, integer counts, explicit units, observation time, exact query
  versions/digests, and at most five 12-character lowercase hexadecimal sample
  authority references per bucket.
- **FR-12 — Receipt provenance:** the canonical receipt MUST bind the reviewed
  commit, V2 query digest, classifier query digest, runner digest, target
  fingerprint/class, TLS/certificate state, timeout profile, transaction proof,
  complete V2 totals, classifier totals, and receipt digest.
- **FR-13 — One-shot evidence launcher:** the root launcher MUST reuse the
  reviewed CA-PEM, authenticated project-ref fingerprint, exact host/database,
  `+03:00` maximum-one-hour window, branch/HEAD/`origin/main`, clean-worktree,
  atomic attempt-marker, Windows `cmd.exe` npm wrapper, stderr rejection, and
  sanitized receipt guards already proven for V2 evidence.
- **FR-14 — Evidence separation:** the implementation PR MUST NOT connect to
  staging. A later evidence PR MUST contain receipts/docs only. Any query,
  runner, contract, allowlist, launcher, package, or test change requires a new
  implementation PR and reviewed SHA.

## 3. Non-Functional Requirements

- **NFR-01 — No mutation:** SQL and runner paths MUST contain no DML, DDL,
  migration, lock mutation, service pause, or production operation.
- **NFR-02 — Privacy:** database URLs, target identity, credentials, CA/private
  key content, raw UUIDs, usernames, emails, personnel data, role/store names,
  business values, and unbounded records MUST never reach stdout, stderr, Git,
  or a PR body.
- **NFR-03 — Fail closed:** unknown fields, codes, sources, units, dishonest
  totals, duplicate buckets, malformed samples, digest drift, stderr content,
  target/SHA drift, or incomplete classification MUST reject the receipt.
- **NFR-04 — Bounded execution:** connection timeout MUST be 5000 ms, idle
  transaction timeout 1000 ms, and query/statement timeouts 30000 ms.
- **NFR-05 — Determinism:** canonical JSON, reason priority, bucket ordering,
  authority-unit hashing, and digest computation MUST be stable across runs
  over the same snapshot.
- **NFR-06 — Testability:** every FR and edge case MUST trace to at least one
  contract, CLI, SQL-static, disposable-database, or launcher test.
- **NFR-07 — Cost/scope:** implementation MUST use repository and existing
  staging resources only. Paid services and production remain excluded.

## 4. Acceptance Criteria

- **AC-01 / FR-01, FR-02, NFR-01:** Given a disposable database with V2 and
  classifier fixtures, when the runner executes, then both queries share one
  proven repeatable-read/read-only transaction, rollback occurs, and no
  mutation statement is present.
- **AC-02 / FR-03, FR-04, NFR-03:** Given overlapping check hits and shared
  authority units, when the contract validates, then every non-zero ORG/ASSIGN
  hit is classified once, family totals reconcile exactly, check-hit and
  authority-unit counts remain distinct, and TARGET-02 produces no bucket.
- **AC-03 / FR-05, FR-06, FR-07:** Given ORG-04 fixtures for hierarchy drift,
  no role ever, out-of-window role, missing portfolio, same-user duplicate,
  mixed scope, multiple users, and unique-region mismatch, when SQL executes,
  then each fixture lands in only its priority reason and totals reconcile.
- **AC-04 / FR-08, FR-09, FR-10:** Given ORG-02/ASSIGN hits and no approved
  rotation contract, when classification executes, then they are
  `source_absent`; given a synthetic approved-contract presence signal, the
  runner fails with `source_contract_version_change_required` and selects no
  winner.
- **AC-05 / FR-11, FR-12, NFR-02, NFR-03, NFR-05:** Given a valid result, when
  the receipt is serialized, then only allowlisted bounded fields appear and
  canonical digest validation passes; any raw UUID, secret-shaped text, extra
  field, malformed sample, or digest edit is rejected.
- **AC-06 / FR-13, FR-14, NFR-03:** Given a reviewed merged SHA, when launcher
  inputs are validated locally, then target/project/CA/window/repository guards
  pass without printing their values; a repeat attempt, dirty tree, wrong SHA,
  wrong branch, stderr, or runner/query change fails closed.
- **AC-07 / NFR-04:** Given a runner receipt, when validated, then the timeout
  profile equals 5000/1000/30000/30000 ms exactly.
- **AC-08 / NFR-06, NFR-07:** Given the completed implementation diff, when the
  repository test and affected-scope selectors run, then all requirement and
  edge-case tests pass, no staging connection occurs, and no paid/production
  resource is referenced.

## 5. Edge Cases

- **EC-01:** one manager has two overlapping effective role rows; classify
  same-manager duplicate, not multiple managers.
- **EC-02:** two users are effective through the same scope; classify multiple
  managers.
- **EC-03:** one direct-store and one region-portfolio user overlap; classify
  mixed-scope multiple managers before generic multiple managers.
- **EC-04:** region role exists but begins after or ends before authority date;
  classify role not effective.
- **EC-05:** effective region role exists but action-store mapping is missing,
  expired, or future; classify portfolio not effective.
- **EC-06:** store-scope role is unique but carries a different region; classify
  unique manager region mismatch.
- **EC-07:** multiple KPI rows share the same store/month authority unit;
  check-hit count may exceed authority-unit count without implying drift.
- **EC-08:** one affected employee case produces overlap and
  multiple-open-primary hits; it contributes two check hits but one authority
  unit.
- **EC-09:** V2 family totals change between snapshots; impossible because the
  runner owns one snapshot, otherwise validation fails.
- **EC-10:** an unknown role scope, reason, source, unit, or result field appears;
  reject the complete receipt.
- **EC-11:** the classifier sees a unique valid manager for a row still reported
  as a V2 hit; reject as unclassified semantic drift.
- **EC-12:** an audit row contains apparent before/after region values; V1 does
  not treat it as approved rotation authority.
- **EC-13:** receipt or stderr contains a URL, certificate, UUID, email, name,
  or credential pattern; reject before evidence persistence.
- **EC-14:** Windows cannot launch `npm.cmd` directly; use the reviewed
  `cmd.exe /d /s /c` wrapper and test exact argument ownership.

## 6. API Contracts

No public HTTP/API contract changes. The internal sanitized contract is:

```ts
type AuthorityFamily = "ASSIGN-01" | "ORG-02" | "ORG-04";

type AuthorityReason =
  | "assign01.rotation_authority_source_absent"
  | "org02.rotation_authority_source_absent"
  | "org04.scope_hierarchy_mismatch"
  | "org04.role_assignment_never_configured"
  | "org04.role_assignment_not_effective"
  | "org04.region_portfolio_not_effective"
  | "org04.duplicate_rows_same_manager"
  | "org04.mixed_scope_multiple_managers"
  | "org04.multiple_distinct_managers"
  | "org04.unique_manager_region_mismatch";

type AuthoritySource =
  | "authority.assignment_lifecycle_contract"
  | "authority.rbac_role_assignment"
  | "authority.action_store_portfolio"
  | "authority.scope_hierarchy";

type AuthorityBucket = {
  authorityUnitCount: number;
  checkHitCount: number;
  family: AuthorityFamily;
  reason: AuthorityReason;
  sampleAuthorityRefs: string[];
  source: AuthoritySource;
  units: { authority: "authority_units"; findings: "check_hits" };
};

type AuthorityClassifierResult = {
  buckets: AuthorityBucket[];
  familyTotals: Array<{
    authorityUnitCount: number;
    checkHitCount: number;
    family: AuthorityFamily;
  }>;
  observedAt: string;
  overall: { authorityUnitCount: number; checkHitCount: number };
  querySetVersion: "staging-remediation-row-authority-classifier-v1";
  sourceContracts: [{
    code: "assignment_rotation_lifecycle";
    state: "absent";
  }];
  v2FamilyTotals: Array<{ family: "ASSIGN-01" | "ORG-02" | "ORG-04" | "TARGET-02"; hitCount: number }>;
};
```

The receipt adds exact digests, reviewed commit, target/TLS/transaction/timeout
proof, certificate state, and canonical `receiptDigest`. Extra fields fail.

## 7. Data Models

No database table, column, index, constraint, migration, seed, or application
entity is added or changed.

| Model | Field | Type | Constraint |
| --- | --- | --- | --- |
| Authority bucket | `family` | enum | Exactly ORG-04, ORG-02, or ASSIGN-01 |
| Authority bucket | `reason` | enum | Must belong to family |
| Authority bucket | `source` | enum | Must belong to reason |
| Authority bucket | `checkHitCount` | integer | `>= 1`; sums to same-snapshot V2 family total |
| Authority bucket | `authorityUnitCount` | integer | `>= 1` and `<= checkHitCount` |
| Authority bucket | `sampleAuthorityRefs` | string array | Unique, sorted, max five, `^[a-f0-9]{12}$` |
| Source contract | `assignment_rotation_lifecycle` | enum state | Exactly `absent` in V1 |
| Receipt | digests | SHA-256 hex | Canonical and exact |

Authority-unit keys are used only inside SQL and are converted to bounded
hashes before output. Raw keys never leave the database transaction.

## 8. Out Of Scope

- DML, DDL, migrations, constraints, data repair, replay, reseed, or deletion.
- Selecting a region manager, assignment winner, effective rotation date, or
  correction row.
- Creating a rotation/lifecycle module, table, request workflow, or backfill.
- Writing or committing a raw manifest, UUID, person/store identity, CA, URL,
  credential, or business payload.
- Updating KPI or Norm Kadro rows because authority resolution failed.
- Staging execution inside the implementation PR.
- Production, paid services, broad runtime/API/auth/UI changes, or DG1-C work.

## 9. Sokrates Decision And Stop Rules

- **Decision:** implement REM-2C as a versioned read-only classifier, then run
  its exact merged SHA once in a separate evidence branch.
- **Evidence:** V2 receipt is valid, TARGET-02 is zero, ORG-04 aggregates share
  authority roots, RBAC/portfolio tables are effective-dated, and the repository
  has no owned approved rotation/lifecycle source.
- **Counterargument:** the current store region or newest assignment could be
  used as a practical winner. That would invent history, contradict the locked
  effective-date rule, and hide the missing source contract.
- **Risk / door:** repository-only/read-only work is reversible. Any inferred
  winner or correction is high risk and remains prohibited.
- **Change-my-mind triggers:** an existing owned rotation source is discovered;
  V2/query semantics drift; exhaustive reconciliation cannot be proven; output
  cannot remain sanitized; or implementation requires schema/runtime/auth
  behavior. Those conditions require a new decision/version, not a guess.

Stop without staging execution or merge when any requirement lacks a failing
then passing test, V1/V2 immutable hashes change, classifier totals do not
reconcile, a source/winner is inferred, output may expose identity, checks fail,
mergeability is not clean, or the diff crosses the stated boundary.

## 10. Implementation And Verification Contract

The repository-only implementation owns:

- `db/preflight/staging-remediation-row-authority-classifier-v1.sql`;
- the typed allowlist, contract, runner and CLI/contract tests under
  `backend/nestjs/scripts` and `backend/nestjs/test`;
- the rollback-only disposable root-cause fixture;
- `diagnose:staging:remediation:authority:v1` as the merged runner; and
- `evidence:staging:remediation:authority:v1` as the one-shot evidence entry.

The completed red-green cycles prove 13 typed contract cases, five CLI
pre-connection failures, twelve root/launcher contracts, and a fresh-migration
disposable run containing all ten reason codes. The disposable fixture
reconciles `13 check_hits` to `12 authority_units`, rolls back, and leaves zero
fixture-company residue. This is implementation evidence only; it is not a
staging classification receipt or correction authority.
