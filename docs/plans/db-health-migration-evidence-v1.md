# DB Health And Migration Evidence V1

## Purpose

Strengthen deployment confidence by making database health and migration status observable without changing the migration engine.

This slice does not replace the migration system.

## Boundary

Migration status is read-only evidence.

Migration status must not execute SQL migration files.

The HTTP run endpoint remains separately guarded.

This slice does not add destructive migration behavior, does not change SQL migration files, does not change DB schema, and does not add a new deployment workflow.

## Runtime Surfaces

### `GET /api/health`

Public health remains simple:

- `database`
- `redis`
- dependency status,
- dependency latency,
- service name,
- timestamp,
- queue backend.

Health check output must not expose connection strings, passwords, hosts, or raw database URLs.

Known URL-like dependency error details are redacted as `[redacted-url]`.

### `GET /api/admin/migrations/status`

Authenticated `SUPER_ADMIN` migration status evidence returns:

- `trackingTable`
- `totalFiles`
- `appliedCount`
- `pending`
- `failed`
- `checksumMismatches`

This endpoint reads `audit.schema_migration` and local migration filenames. It does not call `runMigrations`, does not execute SQL migration files, and does not replace `npm.cmd run db:migrate`.

### `POST /api/admin/migrations/run`

The existing run endpoint remains separate and guarded by the existing HTTP migration endpoint flag.

Production-safe migration execution remains the CLI/CI path:

```powershell
npm.cmd run db:migrate
```

## Deploy Evidence Use

Before deploy:

1. Run root release gate.
2. Check migration status.
3. If `failed` is non-empty, stop and inspect failed migration evidence.
4. If `checksumMismatches` is non-empty, stop; do not continue with a changed already-applied migration.
5. Run `npm.cmd run db:migrate` through the approved CLI/CI path.
6. Check health after deploy.

## Go / No-Go

`Go`:

- `GET /api/health` returns dependency status without secret material.
- `GET /api/admin/migrations/status` shows no failed migrations and no checksum mismatches.
- `npm.cmd run db:migrate` completes through the CLI/CI path.

`No-Go`:

- database health fails,
- migration status cannot be read because DB is unavailable,
- failed migration evidence exists,
- checksum mismatch exists,
- health output exposes a connection string, password, host, or raw database URL.

## Verification

Targeted:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- --runInBand src/shared/database/migration.service.spec.ts src/shared/database/migrations.controller.spec.ts test/integration/health.e2e-spec.ts
```

Guard:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
node --test scripts\db-health-migration-evidence-contract.test.mjs
```

Release:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run check:release
```

## CODEX DURUST YORUM

This is a foundation slice, not a product feature.

The important win is operational confidence: a deploy operator can see migration status, pending files, failed evidence, and checksum drift without running migrations from an HTTP endpoint and without exposing sensitive connection details through public health.

This keeps the defter clean because it strengthens the existing database/migration path instead of inventing a second migration workflow.

## Next Logical Step

Continue with `docs/plans/backend-foundation-hardening-plan-v1.md` P0 item 4: operator evidence consistency pass.
