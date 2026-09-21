# Contributing

Status: active
Shelf: operating
Last verified: 2026-09-18

## Required Reading

Use [AGENTS.md#reading-map](AGENTS.md#reading-map). `current-state.md` owns current
facts, `sokrates.md` owns decisions/risk, and `discipline.md` owns execution.
Read the applicable task references, not every operating document. Preserve
unrelated user or agent changes; verify the current branch/worktree before edits.

## Branch And PR Rhythm

Start from current `origin/main` on a `codex/` branch. One coherent review and
rollback story per PR. Before every push, perform the
[local adversarial review](docs/process/execution-release.md#pr-oncesi-adversarial-review)
and scope-appropriate verification. Resolve actionable findings; no weakened gates.
GitHub Codex review is owner-disabled: no `@codex review` or bot-review requests.
Merge only with user authority, green required checks, applicable provider proof
and fresh mergeability. Use the [squash closeout](docs/process/execution-release.md#merge-disiplini).

## Risk Separation

Never mix UI polish or docs cleanup with business workflow semantics, API response
shape, auth or permission semantics, DB/migrations, provider configuration,
queue/import behavior or KPI scoring/ranking/checklist weights. Explicitly scoped
changes require the appropriate risk, acceptance and rollback evidence.

## Data Honesty

No fake metrics/data: no fake metric, fake coaching, fake ranking, fake trend,
checklist result, payout or target. Use honest loading/empty/error/access states.
Never record secrets or private user data. Local tests do not prove live provider,
restore, queue, alert or broad-production readiness.

## Frontend Store UI Rules

Use React web, `shadcn/ui`, Tailwind v4 and lucide with existing shared primitives.
The [project UI skill](.agents/skills/hr-axis-ui/SKILL.md) routes the relevant
standards. Preserve real data, role-aware actions, workflow, accessibility and
responsive states. Landing-page skill defaults do not define operational screens.

## Verification Ladder

Follow [discipline.md](discipline.md#verification-ladder) and the affected selector's
reasons. Active docs/guards run `git diff --check` and `npm.cmd run test:scripts`.
Run any broader selected gate; do not classify unknown scripts as docs by assumption.
Input-bound `check:release -- --resume` retains only verified eligible proof;
complete coverage, root contracts and volatile audits remain mandatory.
Use native `Re-run failed jobs` for the same SHA; idle polling is 55-60 seconds.
Do not run two local canonical gates concurrently.

## Merge Closeout

Record the change, verification, residual risk and PR status. After merge, verify
`origin/main`; update `current-state.md` when durable facts, blockers or next actions
change. Keep full logs and completed PR narratives in the evidence/history shelves.
