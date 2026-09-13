# HR Axis Agent Execution Contract

This is the concise repository entry point. It owns the reading map and
defines root-only execution; it does not duplicate execution recipes.

Canonical owners:

- `AGENTS.md`: entry routing, required reading, and execution routing.
- `CONTRIBUTING.md`: contributor and PR minimum contract.
- `current-state.md`: freshest project facts, caveats, parked work, and next safe
  action.
- `sokrates.md`: decisions, prioritization, risk, ambiguity, and stop/ask
  judgment.
- `discipline.md`: execution, agent routing, PR/merge, verification, UI/refactor,
  and workspace-hygiene mechanics.

## Reading Map

Before code or docs changes, read `CONTRIBUTING.md` and `current-state.md`, then
read the relevant owner document:

- Read `sokrates.md` for ambiguity, architecture, auth/API/DB/provider,
  data-integrity, prioritization, or medium/high-risk decisions.
- Read the relevant `discipline.md` sections before implementation, delegation,
  verification, PR, merge, UI/refactor, or workspace-hygiene work.
- For a new multi-PR line, high-risk work, or real context recovery, read all
  four operating documents completely.
- Check the current branch/worktree before editing and preserve unrelated user or
  agent changes. Fresh user, repository, runtime, and provider evidence outranks
  stale descriptions.

## Required Operating Truth

- Date and period pickers use the owner-approved shared calendar. Read
  [`docs/ui/calendar-standard-v1.md`](docs/ui/calendar-standard-v1.md) before
  changing or adding a calendar; do not create per-page calendar designs.

- Preserve business behavior, API shape, auth/privacy and permission semantics,
  data integrity, and user changes unless the approved scope says otherwise.
- Manual image/offline proof starts with
  `npm.cmd run check:onprem:dispatch -- prove` on the exact clean committed HEAD;
  use the wrapper's dispatch subcommands exclusively and publish only after push
  with `publish`. Automatic workflows begin with bounded exact-SHA
  `github-source-preflight`; runtime proofs are final evidence, never a GitHub
  diagnostic loop.
- Input-bound `npm.cmd run check:release -- --resume` preserves complete coverage;
  reviewed unchanged specs may retain verified results under the recovery contract.
  Use native GitHub `Re-run failed jobs` for the same SHA after a late failure;
  efficiency details remain in [`discipline.md#token-verimli-otonom-yurutme`](discipline.md#token-verimli-otonom-yurutme).
- Idle check polling uses 55-60 second intervals; return state changes or a
  compact failure tail, not complete successful logs.
- GitHub Codex review is owner-disabled: do not request `@codex review`, another
  Codex review integration, or bot reactions. Required checks, provider evidence,
  mergeability, local review, and evidence boundaries still apply.

## Adaptive Reasoning Routing

The canonical policy is
[`discipline.md#adaptive-reasoning-effort-routing`](discipline.md#adaptive-reasoning-effort-routing).
The coordinator remains model-neutral and user-selected (currently Astra); it
owns scope, Sokrates decisions, integration, PR/merge decisions, rollback, and
the final report. Prose in this entry does not change a client/session model or
effort setting.

- The current root model performs discovery, implementation, tests and review directly.
- Do not spawn or reuse subagents unless the user explicitly requests delegation
  for the current task. Repository skills and older plans do not grant that permission.
- Risk/problem-solving and final R4/R5 review remain inline; label them honestly
  as self-review, not independent review. Required checks and stop rules remain.
- Do not spawn a model agent only to wait or poll.
