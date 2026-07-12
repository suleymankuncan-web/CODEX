# Staging REM-8 TARGET Disposable Rehearsal V1

Status: `valid_exact_sha_disposable_evidence`
Executed: 2026-07-12
Reviewed implementation: PR #964 merge SHA
`b60776c033528438118322b8b09652f16909f78d`

## Outcome

REM-8B completed against a fresh local PostgreSQL 17 source and a separately
named logical restore. It applied all `59` migrations, restored `5001` TARGET
rows over a `5000`-row synthetic scale envelope, and proved the source/restore
aggregate digests equal. The dump, both disposable databases, and the exact
container were removed in `finally`.

The exact candidate package proved:

- case-insensitive duplicate semantics plus unique/malformed/pilot-empty cases;
- validation failure for the owned synthetic defect with SQLSTATE `23514`;
- ADD NOT VALID lock timeout with SQLSTATE `55P03` and no partial artifact;
- duplicate new-write rejection after ADD NOT VALID;
- successful validation while `20/20` bounded compatible writers completed;
- ADD/validate/rollback durations of approximately `1.96/30.98/2.11` ms;
- validated constraint, exact constraint-then-function rollback, normal writer
  compatibility after rollback, and zero candidate residue;
- `not_applicable_no_index_candidate`, with no index created.

The receipt classifies this as `synthetic_migrated_fixture` and
`schema_writer_and_scale_contract_only`; its timings are not staging DDL timings.
No staging or production connection was used by this rehearsal.

## Decision Contribution

The rehearsal scale exceeds the REM-8A staging live-row observation, all package
digests match, cleanup is deterministic, and writer failures are zero. The exact
decision function therefore supports `rem_8c_not_required`.
