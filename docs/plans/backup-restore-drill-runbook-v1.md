# Backup Restore Drill Runbook V1

## Goal

Prove that the project can recover a PostgreSQL database backup into a disposable local or staging restore target before pilot expansion.

This runbook is a readiness drill. It is not production backup automation.

## Boundary

Run this drill only in local or staging.

Do not run restore commands against production.

Do not automate production backup or restore from this V1 runbook.

No destructive command is approved unless the restore target is explicitly confirmed as disposable.

Do not capture raw secrets, raw tokens, raw `DATABASE_URL`, or personnel/customer personal data in evidence.

## Prerequisites

- PostgreSQL client tools are installed and available on `PATH`:
  - `pg_dump`
  - `pg_restore`
  - `createdb`
  - `dropdb`
  - `psql`
- The source database is local or staging.
- The restore database is separate from the source database.
- The restore target name is clearly disposable, for example `store_ops_restore_drill`.
- The operator has confirmed the restore target can be dropped and recreated.

## Environment Variables

Use environment variables in the terminal session. Do not paste secrets into committed docs or evidence.

```powershell
$env:DATABASE_URL="postgres://USER:PASSWORD@HOST:PORT/store_ops"
$env:RESTORE_DATABASE_URL="postgres://USER:PASSWORD@HOST:PORT/store_ops_restore_drill"
$env:BACKUP_FILE="C:\temp\store_ops_backup_drill.dump"
```

Evidence must show only sanitized forms:

```text
DATABASE_URL=[redacted-url]
RESTORE_DATABASE_URL=[redacted-url]
BACKUP_FILE=C:\temp\store_ops_backup_drill.dump
```

## Drill Steps

### 1. Confirm Target

Checklist:

- Source is local or staging.
- Restore target is not production.
- Restore target database is named `store_ops_restore_drill` or another clearly disposable name.
- Operator explicitly confirms the target can be dropped.

No-Go if any item is false.

### 2. Create Backup

Run:

```powershell
pg_dump --format=custom --no-owner --no-privileges --file "$env:BACKUP_FILE" "$env:DATABASE_URL"
```

Expected:

- command exits successfully,
- backup file exists,
- backup file size is greater than zero.

Sanitized Evidence:

```text
backup_command=pg_dump --format=custom --no-owner --no-privileges --file [BACKUP_FILE] [redacted-url]
backup_file=[path only]
backup_file_size_bytes=[number]
backup_result=success|failed
```

### 3. Recreate Disposable Restore Target

Only run this against the confirmed disposable restore database.

Run:

```powershell
dropdb --if-exists "$env:RESTORE_DATABASE_URL"
createdb "$env:RESTORE_DATABASE_URL"
```

Expected:

- target database is empty and ready,
- no source database is dropped.

No-Go:

- restore target URL points at production,
- restore target URL equals the source `DATABASE_URL`,
- restore target name is not clearly disposable.

### 4. Restore Backup

Run:

```powershell
pg_restore --no-owner --no-privileges --dbname "$env:RESTORE_DATABASE_URL" "$env:BACKUP_FILE"
```

Expected:

- command exits successfully,
- schema and data restore into the disposable target.

Sanitized Evidence:

```text
restore_command=pg_restore --no-owner --no-privileges --dbname [redacted-url] [BACKUP_FILE]
restore_result=success|failed
```

### 5. Restore Proof

Run read-only checks against the restore target:

```powershell
psql "$env:RESTORE_DATABASE_URL" -c "select schemaname, count(*) as table_count from pg_tables where schemaname in ('ops','stg','rpt','audit') group by schemaname order by schemaname;"
psql "$env:RESTORE_DATABASE_URL" -c "select count(*) as migration_rows from audit.schema_migration;"
```

Restore proof should include:

- schemas present,
- table counts by schema,
- migration tracking rows present,
- no raw row samples containing personal data.

Sanitized Evidence:

```text
restore_proof_schemas=ops:[count], stg:[count], rpt:[count], audit:[count]
restore_proof_migration_rows=[count]
personal_data_samples_captured=no
```

## Go / Conditional Go / No-Go

Go:

- backup command succeeds,
- restore target is disposable,
- restore command succeeds,
- restore proof shows expected schemas and migration tracking,
- evidence is sanitized.

Conditional Go:

- backup succeeds,
- restore succeeds,
- restore proof is incomplete but explainable,
- no production or secret exposure occurred.

No-Go:

- source or restore target cannot be confirmed,
- restore target may be production,
- restore target equals the source database,
- backup file is missing or empty,
- restore fails,
- evidence contains raw `DATABASE_URL`, passwords, tokens, or personal data samples.

## Evidence Template

```text
date=YYYY-MM-DD
operator=[name or role]
environment=local|staging
source_database=[redacted-url]
restore_database=[redacted-url]
restore_target_disposable=yes|no
backup_file=[path only]
backup_file_size_bytes=[number]
backup_result=success|failed
restore_result=success|failed
restore_proof_schemas=ops:[count], stg:[count], rpt:[count], audit:[count]
restore_proof_migration_rows=[count]
personal_data_samples_captured=no
decision=Go|Conditional Go|No-Go
notes=[sanitized notes only]
```

## Sanitized Evidence Rules

No raw DATABASE_URL.

No passwords.

No tokens.

No customer or personnel personal data samples.

No screenshots that reveal secrets or personal data.

No production hostnames unless the production owner explicitly approved sharing sanitized host labels.

## CODEX DURUST YORUM

This is worth doing before pilot expansion.

The project already has migration tracking and release checks, but recovery confidence is a separate production skill. A backup that has never been restored is only a hope. This drill turns it into evidence without touching production.

The safe V1 is intentionally boring: local or staging only, disposable restore target only, sanitized evidence only.

## Next Logical Step

When a real local or staging database is available, run this drill manually and store sanitized evidence outside committed secrets. Do not automate production backup/restore until hosting, retention, encryption, and access ownership are known.
