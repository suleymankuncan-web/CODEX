# Migration Fresh DB Smoke V1

## Goal

Prove that the current migration set can build a PostgreSQL database from an empty disposable local database.

This closes the exact class of risk found during the local backup/restore drill: a migration can pass in an already-shaped database but fail when applied from zero.

## Boundary

Production database is never a valid target.

This smoke is local-only. It uses the Docker PostgreSQL service from:

```text
infra/docker-compose.live-e2e.yml
```

Default disposable database:

```text
store_ops_fresh_migration_smoke
```

The script refuses `NODE_ENV=production`, refuses non-local hosts, and only accepts database names matching:

```text
store_ops_fresh_migration_smoke
store_ops_fresh_migration_smoke_<suffix>
```

## Command

Run from the workspace root:

```powershell
npm run smoke:migration:fresh-db
```

The command:

- starts local Docker PostgreSQL if needed,
- waits for `store-ops-live-postgres` to become healthy,
- drops only the disposable smoke database,
- recreates the disposable smoke database,
- runs backend `npm run db:migrate` against that database,
- verifies `audit.schema_migration`,
- verifies table presence in `audit`, `ops`, `rpt`, and `stg`,
- prints sanitized JSON evidence.

## Expected Sanitized Evidence

```json
{
  "event": "migration_fresh_db_smoke.completed",
  "databaseName": "store_ops_fresh_migration_smoke",
  "migrationFileCount": 42,
  "migrationRows": 42,
  "succeededRows": 42,
  "failedRows": 0,
  "schemaTableCounts": {
    "audit": 3,
    "ops": 39,
    "rpt": 10,
    "stg": 12
  }
}
```

Counts may grow when new migrations add tables, but the rule stays fixed:

- `migrationRows` must equal migration file count,
- `succeededRows` must equal migration file count,
- `failedRows` must be `0`,
- each core schema must have tables.

## Go / Conditional Go / No-Go

Go:

- smoke command exits successfully,
- all migrations are tracked as succeeded,
- `failedRows=0`,
- core schemas have table evidence.

Conditional Go:

- Docker/local tooling is unavailable,
- no production target was used,
- release gate still passes,
- the missing local tooling is recorded as an environment limitation.

No-Go:

- script targets a production or non-local host,
- script targets a non-disposable database name,
- migration command fails,
- `audit.schema_migration` is missing,
- any migration is failed,
- core schema table evidence is missing.

## CODEX DURUST YORUM

This is one of the highest-value boring checks for the backend.

The project already has migration tracking and backup/restore evidence. This smoke adds the missing guarantee: a new environment can be built from zero without relying on accidental state left in an older local database.

It should stay intentionally narrow. It is not a production migration runner, not backup automation, and not a replacement for managed database restore testing.

## Local Evidence - 2026-04-30

Command:

```powershell
npm.cmd run smoke:migration:fresh-db
```

Sanitized result:

```json
{
  "event": "migration_fresh_db_smoke.completed",
  "databaseName": "store_ops_fresh_migration_smoke",
  "migrationFileCount": 42,
  "migrationRows": 42,
  "succeededRows": 42,
  "failedRows": 0,
  "schemaTableCounts": {
    "audit": 3,
    "ops": 39,
    "rpt": 10,
    "stg": 12
  }
}
```

## Next Logical Step

Keep this smoke as the first local database confidence check before larger backend/data changes. Real staging evidence remains a separate step when real staging credentials and seeded data exist.
