# Backup Restore Drill Local Evidence - 2026-04-30

## Boundary

Environment: local Docker PostgreSQL only.

Production database was not used.

No raw `DATABASE_URL`, password, token, customer sample, or personnel personal data sample is recorded here.

## Disposable Databases

Source database:

```text
store_ops_drill_source
```

Restore database:

```text
store_ops_restore_drill
```

Existing local database left as unrelated local state:

```text
store_ops_live
```

## Migration Preflight

First migration attempt against an existing local DB exposed a local migration idempotency issue:

```text
037_mobile_checklist_today_v1.sql failed because checklist_template_code_version_unique already existed in the current schema baseline.
```

Fix applied:

```text
037_mobile_checklist_today_v1.sql now drops checklist_template_code_version_unique if it already exists before adding the same unique constraint.
```

Fresh disposable source result:

```text
applied=42
failed=0
skipped=0
```

## Backup Evidence

Backup file:

```text
/tmp/store_ops_backup_drill.dump
```

Backup file size:

```text
218864 bytes
```

Backup command result:

```text
success
```

## Restore Evidence

Restore target:

```text
store_ops_restore_drill
```

Restore command result:

```text
success
```

## Restore Proof

Source schema/table counts:

```text
audit=3
ops=39
rpt=10
stg=12
```

Restore schema/table counts:

```text
audit=3
ops=39
rpt=10
stg=12
```

Source migration tracking:

```text
migration_rows=42
succeeded=42
failed=0
```

Restore migration tracking:

```text
migration_rows=42
succeeded=42
failed=0
```

Constraint proof on restore target:

```text
checklist_template_code_version_unique exists as UNIQUE on ops.checklist_template
```

## Decision

Decision: Go for local backup/restore mechanics.

Reason:

- clean disposable source DB migrated from empty state,
- backup file was produced,
- restore into a separate disposable target succeeded,
- source and restore schema/table counts matched,
- source and restore migration tracking counts matched,
- no production DB was touched,
- no personal data samples were captured.

## Remaining Boundary

This evidence proves local backup/restore mechanics.

It does not prove production hosting backup policy, retention, encryption, access ownership, or managed database restore behavior.
