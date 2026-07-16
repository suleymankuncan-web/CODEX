# Contributing

Status: active
Shelf: operating
Last verified: 2026-07-12

This repository is operated through small, reversible PRs. The project is not
debt-free, and broad rewrites are not allowed as a substitute for scoped
architecture hardening.

## Required Reading

Before code or docs changes, always read these files from the current branch:

- `CONTRIBUTING.md`
- `current-state.md`

Then use layered reading:

- Read `sokrates.md` for medium/high-risk decisions, ambiguity,
  prioritization, architecture, auth/API/DB/provider work, or `what next`.
- Read the relevant `discipline.md` sections before implementation, PR,
  verification, merge, UI/refactor, or workspace-hygiene work.
- Read all four completely for a new multi-PR line, high-risk work, or real
  context recovery when the narrower path is insufficient.

A narrow read-only question may use only the files needed to answer it. Do not
turn the four-file operating set into mandatory ceremony for every small task.

Codex sessions also load root `AGENTS.md`. It is the concise execution entry
point for the adaptive Medium/High/XHigh routing defined in `discipline.md`;
it does not replace the four operating documents or their ownership rules.

## Operating Document Roles

These files work together; none of them replaces the others.

- `CONTRIBUTING.md` is the short entry contract for repo work.
- `current-state.md` is the live handoff and freshest project-state record.
- `sokrates.md` is the decision-quality and risk-reasoning system.
- `discipline.md` is the day-to-day execution, PR, merge, verification, UI, and
  refactor operating system.

If they overlap, use this order:

- Fresh facts, latest merged state, parked work, and active caveats:
  `current-state.md`.
- Decision method, risk reasoning, prioritization, and stop/ask judgment:
  `sokrates.md`.
- Execution mechanics, PR rhythm, merge gates, verification ladder, UI/refactor
  rules, and done definition: `discipline.md`.
- Contributor-facing summary and minimum repo contract: this file.

Use the current worktree and external state as authoritative. If local docs,
git history, and runtime evidence disagree, use the freshest verifiable source
and record the conflict in the PR.

## Branch And PR Rhythm

- Start from fresh `origin/main`.
- Use a `codex/` branch prefix for agent-authored work.
- Keep each PR to one review story and one rollback story.
- Do not batch unrelated domains because the changes are small.
- Before opening a PR, run the local pre-PR review pass described below.
- Merge only after local verification, required GitHub checks, Vercel checks
  when applicable, and mergeability are clean.
- Use squash merge for controlled PRs so exact-tree post-merge proof can be
  reused; a documented merge-commit/rebase exception accepts the fallback full
  release cost.
- GitHub Codex review is disabled by explicit owner direction. Do not trigger
  `@codex review`, request Codex review, or wait for a Codex reaction/comment.
  It becomes a merge gate again only if the owner explicitly re-enables it.
  Required checks, mergeability, local diff review, and verification remain
  mandatory.
- After a PR opens, keep its checks, deployment state, mergeability, and
  actionable feedback monitored in the background while independent next-PR
  work proceeds in a separate branch/worktree. Do not mix review stories,
  hide dependencies, or run two full release suites concurrently on one
  machine. A failure or conflict on the open PR takes priority.
- Refresh the next branch from merged `origin/main` before opening its PR, and
  refresh the predecessor's complete status immediately before merge. See
  `PR Check Beklerken Paralel Ilerleme` in `discipline.md` for the full rule.
- After merge, verify `origin/main`, update `current-state.md` when the handoff
  state changed, then refresh and finalize the already prepared next PR.

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

Local adversarial review is the active review backstop. Before opening a PR and
before every new push, run this pass without triggering GitHub Codex review:

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
- Store/Admin UI prototype, redesign, refactor, or workflow-surface work must
  also read `docs/process/product-experience-principles.md`. That document is
  the product-quality standard for clean but premium, operationally honest
  screens; it is not part of the default four-file read-first set for unrelated
  backend or docs-only work.
- Store/Admin UI prototype, redesign, or refactor work must run a
  `design-taste-frontend` / taste-skill quality pass before it is considered
  ready for implementation. Use it as an anti-slop design review on top of the
  existing shadcn/Tailwind/lucide/AdminSurface/Store primitive rules, not as a
  replacement for real data, role scope, or workflow correctness.
- Refactored Store surfaces must not keep old hero-card shells, legacy panel
  classes, debug/handoff copy, fake readiness language, or role-out-of-scope
  navigation links.
- Toolbar/sidebar items must be role-aware and match backend route permissions.
- Loading, empty, error, access, mobile, and repeated-use states are part of the
  feature, not optional polish.
- A redesigned page is not done until visible modules serve a real user decision
  or action.
- Taste-skill output must be adapted to operational product UI: no marketing
  hero defaults, decorative-only premium elements, fake business copy, or
  workflow-changing visual ideas.

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

The root command is fresh by default. If a concrete late-stage failure was
fixed without changing HEAD, manifest, commands, runtime, lockfiles, or any
tracked/non-ignored workspace input, use:

```powershell
npm.cmd run check:release -- --resume
```

The runner reuses only exact, atomic successful stage receipts. Dependency
audits are volatile and rerun. Any identity uncertainty runs fresh. In GitHub
Actions, use native `Re-run failed jobs` after a late failure; successful
root/backend/frontend/audit sibling jobs stay valid while
`required-release-gate` remains fail-closed.
Never shorten release time by reducing coverage, test selection, audits,
builds, API checks, Playwright tests, or the two-worker isolation policy.
Do not run two local canonical gates concurrently. Idle PR polling remains
55-60 seconds and does not require a model agent.

## Migration Change Decision

The root release gate prints a migration-change warning when the changed files
touch `db/schema.sql`, `db/migrations/*.sql`, migration runner code, backend
database module/migration tracking code, or `scripts/migration-fresh-db-smoke.mjs`.

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
- Required checks, mergeability, and final local adversarial review are
  recorded. GitHub Codex review is not requested while the owner-disabled
  policy remains active.
- Follow-up risk is documented when it remains.
- `current-state.md` is updated when the project handoff, architecture posture,
  merged PR line, external evidence, or next-action state changed.
