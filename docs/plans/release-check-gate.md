# Release Check Gate

## Purpose

This is the official local and CI quality gate for release confidence.

The gate keeps backend and frontend checks in one visible command without replacing their module-owned scripts.

## Official Command

Run from the workspace root:

```powershell
npm.cmd run check:release
```

The root gate runs:

1. Root script contract tests
2. Migration change warning helper
3. Backend `npm run check:release`
4. Frontend `npm run check:release`

Backend currently owns:

- lint
- Jest tests
- build
- `npm audit --omit=dev`

Frontend currently owns:

- lint
- Node script contract tests
- production build
- Playwright smoke tests
- `npm audit --omit=dev`

## CI Contract

The GitHub Actions workflow `.github/workflows/release-check.yml` installs backend and frontend dependencies, installs Playwright Chromium, and delegates to the same root command:

```powershell
npm run check:release
```

CI uses Node.js 24 to match the current local runtime family used by the project scripts.

## Fresh DB Migration Smoke Policy

Docker-dependent fresh DB smoke is intentionally not part of the mandatory root `check:release` gate.

Reason:

- the smoke needs local Docker PostgreSQL,
- CI and lightweight review environments may not have Docker/PostgreSQL available,
- release readiness should not fail just because that optional local service is unavailable.

The smoke command remains available:

```powershell
npm.cmd run smoke:migration:fresh-db
```

Run this smoke as a manual release preflight when DB schema or migration files changed, especially when touching:

- `db/schema.sql`
- `db/migrations/*.sql`
- migration runner code
- database bootstrap or migration tracking behavior

The required evidence is sanitized command output showing:

- migration file count,
- `audit.schema_migration` row count,
- succeeded migration count,
- failed migration count,
- core schema table counts for `audit`, `ops`, `rpt`, and `stg`.

If Docker/local PostgreSQL is unavailable, record a written Conditional Go with owner/date instead of pretending the smoke ran.

## Migration Change Warning

The root release gate runs `scripts/migration-change-warning.mjs` before backend
and frontend checks. The helper is non-blocking: it does not make the
Docker-dependent fresh DB smoke mandatory in CI.

When the changed-file set includes migration-sensitive files, the helper prints
a visible warning and requires the PR/release notes to make one of these
decisions explicit:

- run `npm.cmd run smoke:migration:fresh-db` and record sanitized evidence, or
- record a Conditional Go with owner, date, reason, and the follow-up point for
  fresh DB smoke evidence.

Migration-sensitive files include:

- `db/schema.sql`
- `db/migrations/*.sql`
- `backend/nestjs/scripts/run-migrations.ts`
- backend migration service/controller files under
  `backend/nestjs/src/shared/database/`
- `scripts/migration-fresh-db-smoke.mjs`

## Rule

Do not claim release readiness unless the official root gate passes, or a narrower targeted check is explicitly documented as a non-release verification.
