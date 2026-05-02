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
2. Backend `npm run check:release`
3. Frontend `npm run check:release`

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

## Rule

Do not claim release readiness unless the official root gate passes, or a narrower targeted check is explicitly documented as a non-release verification.
