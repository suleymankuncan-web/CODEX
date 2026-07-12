# Staging DB-C5 TARGET Constraint Evidence V1

Status: `valid_exact_sha_staging_ddl_evidence`
Applied: 2026-07-12
Reviewed implementation: PR #966 merge SHA
`d76d56f741b832b5d39eede8364f333e12a0e341`

## Outcome

The one-shot DB-C5 launcher completed with `exitCode=0` against the independently
verified staging target. TLS used `verify-full` and a verified external CA. The
fresh preflight ran as `REPEATABLE READ READ ONLY`, found 61 live TARGET rows,
zero active V2 TARGET hits, no over-30-second transaction, and only the
observation lock bucket. Migration 060 was the sole pending migration.

The canonical migration service applied exactly migration 060 and skipped the
59 already-succeeded migrations. The bounded profile was 5 seconds for
connection and lock acquisition, 1 second idle, and 30 seconds for query,
statement, and validation. There were zero failed migrations.

The dedicated read-only postflight proved:

- migration 060 is `succeeded_exact` with the reviewed checksum;
- the function is `present_immutable_exact`;
- the CHECK is `present_valid_exact`;
- active TARGET V2 hits remain zero;
- no index was introduced; and
- `transaction_read_only=true`.

The strict receipt binds the reviewed merge SHA, runner and candidate digests,
the merged REM-8 observation/rehearsal receipt digests, migration checksum,
target fingerprint, timeout profile, and catalog state. It contains no database
URL, host/database identity, CA path/content, credential, UUID, personnel data,
row sample, business payload, or query text. Production was not accessed.

## Sokrates Decision

DB-C5 is `completed_staging_verified_production_excluded`. The approved
`D-TARGET-DUPLICATE=reject_app_and_db` rule now has both application-boundary
and persistent staging-database enforcement. ORG-02, ORG-04, and ASSIGN-01 stay
explicitly blocked/excluded because authoritative effective-dated history is
still absent; no winner is inferred and no correction or DDL is authorized for
them. The post-DG2 database plan closes as
`completed_with_excluded_or_blocked_families`.
