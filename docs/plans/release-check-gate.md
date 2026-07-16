# Release Check Gate

## Purpose

This is the official local and CI quality gate for release confidence.

The gate keeps backend and frontend checks in one visible command without replacing their module-owned scripts.

## Official Command

Run from the workspace root:

```powershell
npm.cmd run check:release
```

The fresh root gate runs the versioned stage manifest:

1. Root script contracts and migration warning preflight
2. Backend release proof, frontend static proof, and volatile dependency audits
   as soon as their dependencies allow
3. Full frontend E2E after frontend static proof

After a concrete late-stage failure, an unchanged exact-input workspace may
resume:

```powershell
npm.cmd run check:release -- --resume
```

Resume binds HEAD, manifest/commands, Node/platform, package locks, tracked and
non-ignored untracked content, and upstream receipt digests. It reuses only
atomic successful receipts. Dependency audits are volatile and always rerun;
unknown or mismatched evidence falls back to fresh execution.

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

The GitHub Actions workflow `.github/workflows/release-check.yml` is the one
full-release workflow. It is reusable and manually dispatchable. Root
contracts, backend release, frontend release, and volatile dependency audit
are native jobs;
frontend static proof precedes its full E2E proof in the same job so the build
and Playwright suite each run once. A fail-closed internal aggregate rejects
every missing, skipped, cancelled, timed-out, or failed proof job. Native
`Re-run failed jobs` therefore preserves successful sibling jobs after a late
failure without transferring PASS receipts or `node_modules` artifacts.

CI uses Node.js 24 to match the current local runtime family used by the project scripts.

For pull requests, `.github/workflows/required-release-gate.yml` selects the
scope. Release-impacting changes call the full release workflow once before
merge. The former frontend-targeted child remains manually reusable but is not
repeated beside the full release. Docs/process-only changes use root script and
contract tests without a full release.

For relevant pushes to `main` or `master`,
`.github/workflows/post-merge-verification.yml` avoids repeating the same full
release when all of these facts agree:

- GitHub associates exactly one merged pull request with the pushed commit;
- the pushed commit has one parent and that parent is the pull request's
  recorded base SHA;
- the latest `required-release-gate` attempt for the pull request head is
  completed successfully and records the same tree as the pushed commit;
- the required run completed before the pull request merged.

When the proof is exact, post-merge verification runs `git diff --check` and
the root script/contract tests. Missing PR association, merge commits, rebase
shapes, stale bases, changed trees, late checks, cancelled checks, failed
checks, API failures, or any other uncertainty select the reusable full release
as a fail-safe fallback.

Controlled PRs use squash merge by default. The resulting single-parent commit
preserves the exact base/tree relationship required for post-merge proof reuse
and avoids a second full release. Merge-commit or rebase merge is allowed only
for a documented exception that accepts the fail-safe post-merge full release;
it is not the normal controlled-PR closeout path.

The main ruleset keeps `required-release-gate` strict/up-to-date. This makes an
exact proof the normal path while the tree and parent checks remain the runtime
backstop. GitHub Codex review is not part of this contract.

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
- `backend/nestjs/src/shared/database/database.module.ts`
- backend migration service/controller files under
  `backend/nestjs/src/shared/database/`
- `scripts/migration-fresh-db-smoke.mjs`

## Rule

Do not claim release readiness unless the official root gate passes, or a narrower targeted check is explicitly documented as a non-release verification.
