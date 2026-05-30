# Contributing

This repository is operated through small, reversible PRs. The project is not
debt-free, and broad rewrites are not allowed as a substitute for scoped
architecture hardening.

## Required Reading

Before code or docs changes, read these files from the current branch:

- `current-state.md`
- `sokrates.md`
- `discipline.md`

Use the current worktree and external state as authoritative. If local docs,
git history, and runtime evidence disagree, use the freshest verifiable source
and record the conflict in the PR.

## Branch And PR Rhythm

- Start from fresh `origin/main`.
- Use a `codex/` branch prefix for agent-authored work.
- Keep each PR to one review story and one rollback story.
- Do not batch unrelated domains because the changes are small.
- Before opening a PR, run the local pre-PR review pass described below.
- Merge only after local verification, GitHub checks, Vercel checks when
  applicable, and Codex review are clean.
- After merge, verify `origin/main`, update `current-state.md` when the handoff
  state changed, then start the next PR.

## Risk Separation

Never mix UI polish or docs cleanup with these high-risk changes:

- business workflow semantics,
- API response shape,
- auth or permission semantics,
- DB schema or migration,
- provider configuration,
- queue, Redis, or BullMQ behavior,
- KPI scoring, ranking sort, or checklist weights,
- import lifecycle, retry, mapping, or approval behavior.

If a feature requires one of these changes, make it the only PR objective and
define the verification ladder before editing code.

## Pre-PR Local Review Pass

GitHub Codex review is a remote backstop, not the first place obvious problems
should be found. Before opening a PR, and before every new push that requests
review, run a local adversarial review pass:

- Inspect `git diff --stat` and confirm the diff still has one review story.
- Run `git diff --check`.
- Read the changed files for scope creep, behavior drift, fake data, layer
  leaks, broad casts, oversized additions, and stale copy.
- For backend changes, search for new direct `DatabaseService` imports,
  application-to-web imports, web-to-infrastructure imports, broad
  `as unknown as` repository casts, and allowlist growth.
- For frontend changes, search for fake metrics, role-out-of-scope UI, legacy
  Store UI classes, debug/handoff copy, and mobile/desktop break risk.
- Run the targeted verification commands for the PR slice before writing the
  PR description.
- List the likely P1/P2 comments GitHub Codex would make and fix actionable
  issues before opening the PR.

## Backend Boundaries

- Web/controller files do not import infrastructure repositories directly.
- Application services should orchestrate use cases; direct PostgreSQL,
  Supabase, or `DatabaseService` access belongs in infrastructure repositories
  unless an existing allowlisted transition exception is being removed.
- New application code must not add broad `as unknown as` repository casts.
- New source adapters, including future Nebim work, must enter through the
  canonical import boundary before mapping, validation, materialization,
  snapshotting, scoring, or reporting.
- Store action, norm kadro, prim, and incentive work must start with an explicit
  boundary decision before adding write workflows.

## Frontend Store UI Rules

- Store redesign work uses `shadcn/ui`, Tailwind v4, and lucide icons.
- Refactored Store surfaces must not keep old hero-card shells, legacy panel
  classes, debug/handoff copy, fake readiness language, or role-out-of-scope
  navigation links.
- Toolbar/sidebar items must be role-aware and match backend route permissions.
- Loading, empty, error, access, mobile, and repeated-use states are part of the
  feature, not optional polish.
- A redesigned page is not done until visible modules serve a real user decision
  or action.

## Data Honesty

No fake metrics/data are allowed. Do not add fake metric, fake coaching, fake ranking,
fake trend, fake checklist result, fake payout, fake target, or placeholder product
copy.

If a real API, model, config, or state source is missing, show an empty, loading,
error, access, or parked state. Do not invent data to make a page look complete.

## Verification Ladder

Use the narrowest command set that proves the PR scope, then run the broader
gate when the blast radius requires it.

- Docs/script guard only: `npm.cmd run test:scripts` and `git diff --check`.
- Frontend Store UI: `npm.cmd --prefix admin-web run lint`,
  `npm.cmd --prefix admin-web run build`, and the targeted Playwright spec.
- Backend service/repository: targeted Jest test, backend build, and
  `npm.cmd --prefix backend/nestjs run check:release`.
- Cross-domain or release-impacting changes: root `npm.cmd run check:release`.

## Migration Change Decision

The root release gate prints a migration-change warning when the changed files
touch `db/schema.sql`, `db/migrations/*.sql`, migration runner code, backend
migration tracking code, or `scripts/migration-fresh-db-smoke.mjs`.

That warning is not a CI failure and does not make Docker-dependent fresh DB
smoke mandatory in the root gate. It does make the PR decision explicit:

- Preferred: run `npm.cmd run smoke:migration:fresh-db` and record sanitized
  evidence.
- If Docker/local PostgreSQL is unavailable: record a Conditional Go with owner,
  date, reason, and follow-up point.

Do not claim release readiness for a migration-sensitive PR without one of
those two decisions.

If a verification fails, inspect the failing log and fix the cause. Do not hide
the failure by weakening the guard unless the PR explicitly changes that guard's
contract.

## Merge Closeout

Every merged PR must leave the project easier to continue:

- PR description states what changed and what did not change.
- Verification commands and results are recorded.
- Follow-up risk is documented when it remains.
- `current-state.md` is updated when the project handoff, architecture posture,
  merged PR line, external evidence, or next-action state changed.
