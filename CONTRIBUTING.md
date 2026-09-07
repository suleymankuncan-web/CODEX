# Contributing

Status: active
Shelf: operating
Last verified: 2026-09-07

This repository is operated through small, reversible PRs. Keep one review story
and one rollback story per PR; broad rewrites are not a substitute for scoped
architecture hardening.

## Required Reading

Follow the [AGENTS reading map](AGENTS.md#reading-map) before code or docs work.
It routes `current-state.md` (fresh facts and caveats), `sokrates.md` (decisions,
risk, ambiguity, and stop/ask judgment), and the relevant `discipline.md` execution,
delegation, PR, merge, verification, UI/refactor, and hygiene rules.
The canonical delegation policy is [discipline.md#adaptive-reasoning-effort-routing](discipline.md#adaptive-reasoning-effort-routing).
Read all four completely for a new multi-PR line, high-risk work, or context
recovery; preserve unrelated user or agent changes.

## Operating Document Roles

The reading map owns entry; `current-state.md` owns facts, `sokrates.md` owns
decisions/risk, `discipline.md` owns execution/gates, and this file owns the
contributor minimum. Prefer the newest user instruction and fresh evidence when
sources disagree.

## Branch And PR Rhythm

- Start from current `origin/main` and use a `codex/` branch prefix.
- Keep the diff limited to the approved files, one coherent review story, and a
  clear rollback; state what intentionally did not change.
- Before a PR and before each push, run the canonical local adversarial review and targeted verification in [discipline.md](discipline.md#pr-oncesi-adversarial-review).
- Required checks, applicable frontend-provider evidence, and clean mergeability remain mandatory. While a PR is checked, independent work uses another branch/worktree and no two full release suites run concurrently.
- GitHub Codex review is owner-disabled: do not request `@codex review`, another
  Codex review integration, or bot reactions/comments. Human or other automated
  actionable findings still require resolution.
- Native GitHub `Re-run failed jobs` may preserve successful siblings after a late
  failure. After merge, verify `origin/main` and refresh the next branch from it.

## Risk Separation

Never mix UI polish or docs cleanup with business workflow semantics, API response
shape, auth or permission semantics, DB schema/migration, provider configuration,
queue/Redis/BullMQ behavior, KPI scoring/ranking/checklist weights, or
import/retry/approval behavior. Use [discipline slice rules](discipline.md#slice-disiplini)
for risk class, acceptance, rollback, and required gates.

## Pre-PR Local Review Pass

Read the final diff for scope creep, behavior drift, fake data, layer leaks, stale
copy, and missing negative cases. Tie tests to acceptance criteria, record
non-goals/protected areas, and never weaken a guard to hide a failure. Use
`sokrates.md` when the cause, scope, or rollback is unclear.

## Backend Boundaries

Canonical backend boundaries, including web/application/infrastructure separation,
import entry, and write decisions, live in [discipline.md#hard-boundaries](discipline.md#hard-boundaries).

## Frontend Store UI Rules

- Store redesign uses `shadcn/ui`, Tailwind v4, and lucide icons; applicable
  product/surface standards and the taste-skill quality pass also apply.
- Role-aware navigation, real data, loading/empty/error/access states, responsive
  behavior, accessibility, and workflow correctness are acceptance criteria.

## Data Honesty

No fake metrics/data: never add fake metric, fake coaching, fake ranking, fake
trend, fake checklist result, fake payout, fake target, or placeholder product
copy. If a real source is missing, show an honest loading, empty, error, access,
or parked state. Never record raw credentials/private user data; local checks do
not close provider, token, restore, queue, alert, or broad-production evidence.

## Verification Ladder

The [canonical verification ladder](discipline.md#verification-ladder) owns
commands and escalation. Docs/process work normally runs `git diff --check` and,
when active docs or guards change, `npm.cmd run test:scripts`; tie broader checks
to acceptance. Exact-input `npm.cmd run check:release -- --resume` may reuse only
matching proof: coverage, test selection, audits, builds, API checks, and
Playwright selection remain unchanged. Do not run two local canonical gates concurrently.
Idle check polling uses 55-60 second intervals; details remain in discipline.

Before manual image/offline proof, run
`npm.cmd run check:onprem:dispatch -- prove` on the exact clean committed HEAD;
use the wrapper's `publish` only after push. GitHub runtime proof is independent
final evidence, not a diagnostic shortcut.

## Migration Change Decision

The migration warning, fresh smoke, and Conditional Go decision are canonical in
[discipline.md#external-evidence-disiplini](discipline.md#external-evidence-disiplini); do not claim readiness without that decision.

## Merge Closeout

The PR records what changed and did not change, verification, required checks,
mergeability, final local review, and remaining risk. After merge, verify
`origin/main` and update `current-state.md` when handoff facts, architecture, external evidence, or next actions changed.
