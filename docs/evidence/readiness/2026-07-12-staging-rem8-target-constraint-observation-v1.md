# Staging REM-8 TARGET Constraint Observation V1

Status: `valid_exact_sha_read_only_evidence`
Observed: 2026-07-12
Reviewed implementation: PR #964 merge SHA
`b60776c033528438118322b8b09652f16909f78d`

## Outcome

The one-shot REM-8A observation completed with `exitCode=0`. It used
verify-full, a verified external CA, one `REPEATABLE READ READ ONLY`
transaction, the reviewed 5/1/30/30 second timeout profile, and empty stderr.
No DML, DDL, migration, writer pause, provider change, or production operation
occurred.

Two local input-preparation commands stopped before the launcher, attempt marker,
or database connection (PowerShell quoting, then ambiguous history selection).
The project-fingerprint-bound preparation then passed validation and invoked the
merged launcher once. Only that invocation consumed the SHA and produced the
receipt.

TARGET is `eligible_for_disposable_rehearsal`:

- PostgreSQL major version: `17`;
- active V2 TARGET hits: `0`;
- ordinary duplicate allocation rows: `0`;
- pilot duplicate groups: `0`;
- non-array allocation rows: `0`;
- pilot approved-reference index: `present_valid_exact`;
- candidate function and constraint: both absent;
- partitioned table: false;
- live-row estimate: `61`, total relation bytes: `155648`;
- active/over-5s/over-30s transactions: `0/0/0`;
- relation locks: one granted `AccessShareLock`, the observation's read lock;
- plan nodes: aggregate, sequential scan, sort, and function scan.

The receipt is strict, sanitized, canonical-digest validated, binds the REM-7
receipt plus all candidate/query/runner digests, and contains no target identity,
credential, CA, PID, row sample, personnel field, or query text.

## Sokrates Decision

Together with the exact-SHA REM-8B receipt, the reviewed decision function emits
`rem_8c_not_required`: staging scale and pressure fit the conservative disposable
envelope. `stagingDdlExecuted=false`. REM-8C is omitted; only the separately
gated TARGET DB-C5 enforcement slice may proceed after this evidence PR merges.
