# DB-C5 TARGET Duplicate Enforcement Specification V1

Status: `completed_staging_verified_production_excluded`
Shelf: architecture
Author: Codex
Decision owner: Product owner
Approved basis: `D-TARGET-DUPLICATE=reject_app_and_db`, standing authorization
dated 2026-07-12, merged PRs #964/#965, and exact-SHA REM-8A/8B receipts
Last verified: 2026-07-12
Target slice: persistent staging database enforcement for duplicate employees
inside one ordinary target request; production excluded

## 1. Context And Decision

REM-7 made TARGET the only `eligible_zero` family. PR #964 merged the immutable
candidate package and PR #965 merged exact-SHA evidence:

- PostgreSQL 17 and 61 live TARGET rows;
- zero active V2 TARGET hits, ordinary duplicates, pilot duplicate groups, and
  non-array allocations;
- exact approved personnel-reference index and absent candidate artifacts;
- zero long transactions and no conflicting lock pressure;
- a PostgreSQL 17 disposable envelope of 5,000 synthetic rows, 20/20 compatible
  writers, expected `23514` validation rejection, expected `55P03` ADD timeout,
  successful validation, exact rollback, and zero residue.

The reviewed decision function returns `rem_8c_not_required`. The remaining
database half is DB-C5: persist the exact candidate through migration `060` and
prove its staging state from an exact merged SHA.

`D-CONSTRAINT-WINDOW` is now locked as
`bounded_5s_add_30s_validate_no_pause_fail_closed`, approved 2026-07-12. ADD NOT
VALID receives a 5-second lock timeout; the transaction receives a 30-second
statement timeout. Normal writers are not paused because REM-8B proved they are
compatible with validation and staging has no pressure. Any timeout, semantic
drift, pending migration, checksum mismatch, or validation failure aborts the
transaction. This does not authorize production.

The existing approval-reference history gap remains explicit: later target
versions currently update the active reference rather than create a linked
superseding reference. DB-C5 neither changes nor claims that behavior. It is a
separate application-history slice and does not alter the meaning of the
same-request duplicate CHECK.

PR #966 merged the repository implementation at
`d76d56f741b832b5d39eede8364f333e12a0e341`. Its exact-merged-SHA one-shot
staging run completed on 2026-07-12. The strict receipt proves the fresh
read-only preflight, sole migration 060 apply, exact checksum, validated CHECK,
immutable function, zero active TARGET hits, no index, read-only postflight,
verify-full, and the locked timeout profile. Production remains excluded. See
`docs/evidence/readiness/2026-07-12-staging-dbc5-target-constraint-v1.md`.

## 2. Functional Requirements

- **FR-01 — Exact prerequisites:** The runner MUST validate the merged REM-8A
  and REM-8B receipts, their reviewed SHA, canonical digests, matching candidate
  digests, `rem_8c_not_required`, and `stagingDdlExecuted=false` before DDL.
- **FR-02 — Exact migration:** `060_target_distribution_duplicate_employee_constraint_v1.sql`
  MUST contain 5s/30s local timeouts followed by LF-normalized byte-exact copies
  of the reviewed create-function, ADD NOT VALID, and VALIDATE statements. The
  runner MUST bind both Git LF digests and the REM-8 Windows-CRLF evidence
  digests rather than pretending line endings are one byte identity. It MUST introduce no
  index, trigger, extension, generated column, grant, RLS, DML, or unrelated DDL.
- **FR-03 — Canonical migration service:** Live application MUST use the merged
  `MigrationService`, preserve checksums, require migrations 001..059 succeeded,
  require only 060 pending, and require the result `applied=[060]`, 59 skipped,
  zero failed. The migration DDL executes in one transaction; the service's
  existing success-tracking update follows that transaction and postflight MUST
  prove it before completion is claimed.
- **FR-04 — Fresh preflight:** Immediately before migration, one
  `REPEATABLE READ READ ONLY` snapshot MUST re-evaluate active V2 TARGET hits,
  duplicate/non-array/pilot-index facts, candidate absence, server 17,
  transaction pressure, locks, and migration status. The runner MUST verify
  `SHOW transaction_isolation` and `SHOW transaction_read_only`; drift blocks
  without DDL.
- **FR-05 — Persistent semantic:** After migration, duplicate string
  `employeeId` values in one allocation array, including case variants, MUST
  fail. Unique arrays, pilot empty arrays, malformed entries owned by existing
  shape policy, and successive separate requests MUST remain compatible.
- **FR-06 — Catalog postflight:** A read-only postflight MUST prove migration
  060 succeeded with the reviewed checksum, the function is immutable/input
  only with the expected signature/search path, the CHECK is validated with the
  expected expression, active V2 TARGET hits remain zero, and no index appeared.
- **FR-07 — Strict apply receipt:** The runner MUST emit one exact sanitized,
  canonical SHA-256 receipt binding preflight, migration/candidate/runner/query
  digests, reviewed SHA, target fingerprint, verify-full, timeouts, migration
  result, catalog proof, repeatable-read/read-only proof, and
  `stagingDdlExecuted=true`. A failure after migration starts MUST report its
  DDL state as unverified rather than falsely claiming no DDL occurred.
- **FR-08 — One-shot launcher:** The root launcher MUST require the exact merged
  SHA, clean dedicated evidence branch at `origin/main`, project fingerprint,
  independently confirmed target, external CA, Europe/Istanbul window, standing
  owner authorization, atomic attempt marker, Windows npm wrapper, empty stderr,
  and exact receipt validation.
- **FR-09 — Rollback:** The reviewed rollback remains constraint first, function
  second. If application fails inside migration, transaction rollback is the
  primary recovery. If post-commit verification reveals an unsafe state, stop;
  the exact rollback package plus migration-status reconciliation requires the
  same staging-only target gate and must never run automatically on success.
- **FR-10 — Evidence PR:** Live execution occurs only after implementation
  merges. The fresh evidence PR may contain the sanitized apply receipt,
  handoff/plan/index updates, and no migration, runner, query, contract, or test
  change. A runner change consumes the SHA and returns to implementation.
- **FR-11 — Domain isolation:** DB-C5 MUST constrain only ordinary
  `allocation_json` duplicate membership. It MUST not constrain historical
  `approval_evidence_json`, change the pilot-reference index, repair rows,
  change reference version history, or include ORG/ASSIGN families.

## 3. Non-Functional Requirements

- **NFR-01 — Privacy:** No URL, host/database identity, CA path/content,
  credential, PID, username, query text, UUID, personnel field, row sample, or
  business payload may enter stdout, stderr, Git, PR text, or receipts.
- **NFR-02 — Staging only:** The apply runner MUST refuse production-like
  targets and `NODE_ENV=production`. Production is always out of scope.
- **NFR-03 — Bounded availability:** Connection/idle/query/statement remain
  5/1/30/30 seconds; migration ADD lock timeout is 5 seconds. One attempt only.
- **NFR-04 — Determinism:** Exact names, order, SQLSTATEs, timeouts, migration
  checksum, candidate digests, rollback order, and receipt fields are versioned.
- **NFR-05 — Atomicity:** Function, NOT VALID CHECK, validation, and migration
  DDL commit atomically through the canonical migration service. The separately
  persisted success row is an explicit postflight gate; failure to record or
  prove it blocks completion rather than inventing atomicity.
- **NFR-06 — Reviewability:** One implementation PR owns spec, migration,
  runner/launcher, contracts, fixtures, scripts, and handoff; the evidence PR is
  docs-only.
- **NFR-07 — Cost:** Existing local Docker and staging are sufficient. No paid
  service, new project, extension, PITR, or provider setting is introduced.
- **NFR-08 — Honest scope:** Passing DB-C5 does not make ORG/ASSIGN eligible,
  make reference history versioned, or authorize broad production.

## 4. Acceptance Criteria

- **AC-01 / FR-01..04:** Given valid merged receipts and a clean exact-SHA
  target, all preflight facts close; any digest, migration, data, lock, server,
  or artifact drift stops before DDL.
- **AC-02 / FR-02, FR-05:** A fresh PostgreSQL 17 database applies all 60
  migrations; duplicate arrays fail while unique/pilot/separate-request cases
  pass and no index is created.
- **AC-03 / FR-03, FR-06, NFR-05:** MigrationService applies exactly 060 DDL in
  one transaction; its existing follow-up status write succeeds, and postflight
  proves the exact migration row plus validated catalog state.
- **AC-04 / FR-07, FR-08:** One guarded staging run emits a strict
  verify-full receipt, empty stderr, exact SHA/digests, and no secrets.
- **AC-05 / FR-09:** Failure before commit leaves no function/constraint and no
  succeeded 060 row; the reviewed rollback order remains executable and proven
  on disposable PostgreSQL 17.
- **AC-06 / FR-10:** Evidence scope accepts only receipt/handoff documents and
  rejects every implementation path.
- **AC-07 / FR-11, NFR-08:** Pilot reference ownership, approval history,
  reference supersession, ORG/ASSIGN, API/auth/UI, and production are unchanged.

## 5. Edge Cases

- **EC-01:** REM-8 receipt/candidate digest mismatch: block.
- **EC-02:** Migration 060 already exists, is failed/running, or another pending
  migration exists: block rather than replay or skip.
- **EC-03:** Candidate function/constraint appears before apply: block.
- **EC-04:** A duplicate arrives after preflight: ADD NOT VALID rejects later
  writes and VALIDATE aborts/rolls back if the row preceded ADD.
- **EC-05:** ACCESS EXCLUSIVE cannot be acquired in 5 seconds: SQLSTATE `55P03`,
  transaction rollback, no partial artifact.
- **EC-06:** Validation sees a violation: SQLSTATE `23514`, transaction rollback,
  no partial artifact.
- **EC-07:** Postflight cannot prove exact catalog/migration state: stop and do
  not describe DB-C5 as complete.
- **EC-08:** Launcher starts but runner fails: SHA remains consumed; inspect
  sanitized state and use a new implementation SHA if code changes.
- **EC-09:** Receipt contains an extra field or unsafe text: reject before Git.
- **EC-10:** Render auto-deploy is off; merge alone MUST NOT be described as live
  application. Only the exact-SHA staging runner creates the live receipt.

## 6. Artifacts And Commands

Exact migration:

```text
db/migrations/060_target_distribution_duplicate_employee_constraint_v1.sql
```

Candidate names remain:

```text
ops.target_distribution_employee_ids_unique_v1(jsonb)
ck_target_distribution_employee_ids_unique_v1
```

Required implementation verification:

```powershell
npm.cmd --prefix backend/nestjs test -- dbc5-target-constraint --runInBand
npm.cmd run smoke:migration:fresh-db
npm.cmd run smoke:dbc5:target:constraint
npm.cmd run smoke:rem8:target:constraint
npm.cmd run test:scripts
npm.cmd run check:affected-verification
npm.cmd run check:release
```

Run only one canonical full release suite. The post-merge evidence PR is docs
only and does not rerun frontend release when the selector says no.

## 7. Stop Conditions

Stop when any of these is true:

1. TARGET evidence becomes non-zero or candidate artifacts drift.
2. Migration 001..059 status/checksum is not exact or 060 is not the sole pending
   migration.
3. PostgreSQL is not major 17 or the target is not independently verified
   staging with verify-full.
4. Lock/statement timeout, validation, catalog, receipt, or cleanup proof fails.
5. A proposal includes production, row repair, reference-history behavior,
   ORG/ASSIGN constraints, new index/trigger/extension, or paid service.
6. An evidence PR changes implementation.
