# REM-8 TARGET Duplicate Constraint Package V1

Status: `candidate_not_applied`

This package implements the locked `D-TARGET-DUPLICATE=reject_app_and_db`
database half for ordinary `allocation_json` arrays. It is not a migration and
must not be applied from this implementation branch.

Execution order:

1. `001_create_function.sql`
2. `002_add_constraint_not_valid.sql`
3. `003_validate_constraint.sql`

Rollback order is fixed in `rollback.sql`: drop the CHECK constraint, then the
immutable input-only function. The package intentionally creates no index,
trigger, extension, generated column, or runtime writer.

Pilot-import requests retain empty allocation arrays and remain protected by
the existing approved personnel-reference partial unique index. Historical
`approval_evidence_json` is outside this candidate.
