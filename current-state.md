# Current State - Active Handoff

Status: active
Shelf: operating
Use when: resuming work, checking the current product posture, or choosing the next safe action
Do not use when: reconstructing the full PR history or replacing live git/provider verification
Last verified: 2026-07-09

This is the canonical short handoff for the HR Axis / Store Ops workspace. A
cold reader should be able to recover the current mode, caveats, and next safe
step from this file in under five minutes. Historical PR trains and the former
long handoff live in
`docs/history/current-state-through-pr-913-2026-07-09.md`.

## Authority And Freshness

Use the freshest verifiable source in this order:

1. The user's newest instruction.
2. Live GitHub, provider, runtime, and current worktree evidence.
3. This handoff and the current control documents.
4. Historical plans, evidence, and the archived handoff.

This file intentionally does not claim its own future squash-merge SHA. The
verified base before the operating-truth alignment PR is:

- `main` / `origin/main`: `3991976c` (`docs: refresh current-state handoff`, PR #913).
- Latest runtime baseline: `c7653a22` (`Fix target roster source and approval defaults`, PR #911).
- Latest product-planning baseline: `b36732dd` (`Document mobile app discovery`, PR #912).

After this file changes, verify `git status --short`, the current branch, and
`origin/main` instead of assuming the base SHA above is still the latest merge.

## Active Workspace

Use only:

```text
D:\store-ops-workspace
```

Do not use an old OneDrive or `E:\` copy.

Primary staging/runtime boundaries:

- Frontend: `https://staging.hr-axis.com` on Vercel.
- Backend API: `https://api-staging.hr-axis.com/api` on Render.
- Database: Supabase Postgres.
- Identity/session provider: Clerk.
- Authorization source of truth: application DB role, scope, and action-store assignments.

## Current Product Position

- Controlled staging/internal pilot: `Conditional Go / Continue`.
- Controlled pilot or patron demo rehearsal: the active product direction.
- Broad production rollout: `No-Go`.
- Pilot Readiness Audit V1: closed for recorded findings through PR #910.
- Target roster source and approval defaults: corrected by PR #911.
- Separate mobile app: discovery/planning only; implementation is not active.
- Broad rewrite or generic architecture work: not approved.

The next useful product signal should come from a real or assisted pilot/demo
session. Record a concrete finding before opening a runtime fix. Do not invent
pilot evidence or start work only because an old plan says `next`.

## Recent Verified PR Line

- PR #898 created the pilot readiness audit matrix.
- PR #899 reconciled pilot roster source data.
- PR #900 added persona smoke evidence.
- PR #901 and PR #907 corrected Store report/export data.
- PR #902 through PR #905 handled Store KPI, Store Me, Rankings, and Checklist
  pilot friction.
- PR #906 recorded June incentive close readback.
- PR #908 and PR #909 reran protected/session and Jan-June data evidence.
- PR #910 closed the audit train.
- PR #911 fixed the targetable roster source and approval defaults.
- PR #912 documented separate mobile-app discovery.
- PR #913 refreshed the former handoff before this operating-doc alignment.

Canonical July evidence:

- `docs/evidence/pilot-readiness/2026-07-07-pilot-readiness-audit-v1.md`
- `docs/evidence/pilot-readiness/2026-07-07-data-reconciliation-readback.md`
- `docs/evidence/pilot-readiness/2026-07-07-persona-smoke-matrix.md`
- `docs/evidence/pilot-readiness/2026-07-07-reports-ranking-score-readback.md`
- `docs/evidence/pilot-readiness/2026-07-07-incentive-june-close-readback.md`
- `docs/plans/mobile-app-discovery-v1.md`

## Current Operating Boundaries

- Keep the existing project; do not restart or rewrite it.
- Preserve business logic, API shape, auth/permission semantics, DB schema,
  scoring/ranking/checklist weights, queue/import behavior, and user workflow
  unless one of them is the explicit task.
- Power BI/Excel remains the current operating data path. JSON integration is
  parked until a real provider contract, fields, identity semantics, cadence,
  and reconciliation plan exist.
- Read scope and action scope remain separate. Assigned-store action scope still
  applies when a role can otherwise satisfy an endpoint role requirement.
- Store personnel remains self-scoped; Store Managers remain own/managed-store
  scoped; Region Managers remain assigned-region/store scoped.
- No fake metric, ranking, coaching, checklist, target, payout, trend, or product
  copy may be used to make a surface look complete.
- Real token, provider, restore, queue, alert, or production claims require real
  runtime/provider evidence. Local tests do not close external evidence.

## Operating Document Roles

Use layered reading instead of re-reading the whole operating library for every
small task:

1. Always start with `CONTRIBUTING.md` and this file before edits.
2. Read `sokrates.md` for medium/high-risk decisions, ambiguity, prioritization,
   or a `what next` judgment.
3. Read the relevant `discipline.md` sections before implementation, PR,
   verification, merge, UI/refactor, or workspace-hygiene work.
4. Read all four completely for a new multi-PR line, high-risk work, or real
   context recovery when the narrower path is insufficient.

Ownership:

- Current facts, caveats, and next action: `current-state.md`.
- Decision quality and stop/ask judgment: `sokrates.md`.
- Execution, PR, merge, verification, UI, and refactor mechanics: `discipline.md`.
- Minimum contributor contract: `CONTRIBUTING.md`.

For Store/Admin product-experience work, also read
`docs/process/product-experience-principles.md` and the applicable UI surface
standard before changing the page.

## Review And Merge Policy

- Local adversarial review and scope-appropriate verification are required.
- GitHub required checks, deployment checks when applicable, and mergeability
  are required.
- Codex GitHub review is the default external review path, not a branch-ruleset
  requirement.
- The owner may explicitly waive Codex review for a PR or PR train. The waiver
  must be recorded in the PR body/comment or current handoff and does not waive
  required checks, mergeability, local diff review, or verification.
- When polling is needed, use the canonical 30-second GitHub status loop from
  `discipline.md`; stop polling once the required decision evidence is complete.

The operating-truth alignment work uses the owner-approved Codex-review waiver
recorded in the initiating conversation. Required checks and diff review remain
mandatory.

## Workspace Hygiene Snapshot

Verified before this alignment PR:

- Root workspace: clean on `main` and aligned with `origin/main`.
- Local branches: 95.
- Remote `codex/*` branches: 48.
- Worktrees: 37.
- Stashes: 8.
- Dirty non-root worktrees: 1.

The classified, no-delete inventory is
`docs/plans/workspace-hygiene-inventory-2026-07-09.md`. Do not delete, drop,
apply, move, or rewrite a branch, worktree, or stash from that inventory without
explicit owner approval. Squash merges mean ancestry alone is not safe cleanup
evidence.

## Now, Next, Park, Stop

Now:

- Finish operating-truth alignment, short-handoff migration, and the no-delete
  workspace inventory.
- Keep the change docs/process-only; no runtime behavior change belongs here.

Next:

- After this PR closes, perform a separate full project/code analysis before
  choosing another implementation track.
- If a real pilot/demo finding arrives first, classify it as P0/P1/P2/P3 and
  use it as the input to that analysis.

Park:

- New modules.
- Separate mobile-app implementation.
- Broad production rollout.
- Broad redesign or generic architecture/refactor trains.
- Provider/Nebim/JSON work without a real source contract and owner decision.

Stop:

- A proposed change crosses into runtime code, auth, API, DB, scoring, queue,
  provider, or workflow behavior during this docs/process line.
- Cleanup classification is uncertain or a branch/worktree/stash is dirty.
- Required checks fail or the final diff no longer has one operating-truth story.

## Verification And Key References

Docs/process verification:

```powershell
git diff --check
npm.cmd run test:scripts
npm.cmd run check:affected-verification
```

Current control references:

- `docs/README.md` - Documentation Library entry point.
- `docs/plans/project-control-board-v1.md` - Project mode and go/no-go board.
- `docs/plans/decision-registry-v1.md` - active decision map.
- `docs/plans/runbook-registry-v1.md` - repeatable runbooks.
- `docs/plans/project-debt-ledger.md` - canonical debt counts.
- `docs/plans/workspace-hygiene-inventory-2026-07-09.md` - no-delete workspace snapshot.
- `docs/history/current-state-through-pr-913-2026-07-09.md` - historical handoff archive.
- `scripts/repo-hygiene-contract.test.mjs` - Repo Hygiene Guard V1.

Generated `node_modules`, `dist`, `test-results`, `coverage`, `tmp`, and
`outputs/` remain ignored local artifacts and do not belong in a PR.

Debt ledger snapshot remains canonical in `docs/plans/project-debt-ledger.md`:

- Closed active debts: 95
- Superseded before overbuilding: 1
- Blocked external dependency: 1
- Watchlist decision item: 0
- Strategic investment backlog: 7
- Silent untracked quality debt in the active gate: 0

These counts do not classify local branch/worktree/stash cleanup state; use the
workspace inventory for that separate operational question.

Project Debt Ledger Consistency Guard V1 keeps the counts above aligned with
the canonical ledger.
