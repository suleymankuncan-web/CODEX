# HR Axis Agent Execution Contract

This entry owns reading and execution routing. Preserve user work and all
business, API, auth/privacy, permission and data-integrity contracts unless the
approved task explicitly changes them. New user instructions and fresh evidence
outrank historical plans. Never invent data, proof or deployment readiness.

## Reading Map

- Answer-only/status tasks: inspect only the evidence needed; no blanket docs read.
- Before changes: read [CONTRIBUTING.md](CONTRIBUTING.md),
  [current-state.md](current-state.md), and the relevant execution sections below.
- Reuse documents already present and read in this task. Reopen only changed or
  missing sections after instruction/file/evidence drift. Always refresh Git and
  applicable runtime facts; document reuse never reuses expired gate evidence.
- Context recovery: recover the goal, protected work, last evidence and next step
  from the short handoff, then follow the task row. Do not reload every manual.

| Task | Required additional reading |
|---|---|
| Docs or bounded implementation | [discipline core](discipline.md#calisma-ritmi), [verification](discipline.md#verification-ladder) |
| UI change | [UI routing](discipline.md#uiux-disiplini), [.agents/skills/hr-axis-ui/SKILL.md](.agents/skills/hr-axis-ui/SKILL.md) |
| PR, push or merge | [release procedure](docs/process/execution-release.md), [.agents/skills/hr-axis-pr-closeout/SKILL.md](.agents/skills/hr-axis-pr-closeout/SKILL.md) |
| Auth/API/DB/provider, data integrity, architecture or other medium/high risk | [sokrates.md](sokrates.md), applicable [domain risk rules](docs/process/decision-risk-reference.md#domain-risk-rules), [hard boundaries](discipline.md#hard-boundaries), [external evidence](discipline.md#external-evidence-disiplini) |
| Refactor, dependency bootstrap or workspace hygiene | [maintenance procedure](docs/process/execution-maintenance.md) and applicable risk rules |
| Multi-PR work | Decision scope and dependencies, then each slice's rows above; all touched risk domains must be covered |

Check branch/worktree before editing; preserve unrelated changes. If scope expands,
load the newly applicable rules before acting. Unknown risk requires investigation,
not an exemption. Historical detail is retrieved only for a concrete dependency.

## Required Operating Truth

- Calendars use [the shared calendar standard](docs/ui/calendar-standard-v1.md).
- Required checks, local self-review, current-head mergeability and applicable
  provider evidence remain mandatory. Missing proof blocks the action it protects.
- Manual image/offline proof: `npm.cmd run check:onprem:dispatch -- prove` on the
  exact clean committed HEAD, then push, wrapper `publish` and dispatch. Automatic
  workflows start with bounded exact-SHA `github-source-preflight`. GitHub runtime
  proofs are final evidence, never a diagnostic loop.
- `npm.cmd run check:release -- --resume` preserves complete coverage under the
  input-bound recovery contract; use native `Re-run failed jobs` for the same SHA.
- Idle polling is 55-60 seconds; return changes or a bounded failure tail.
  Details: [token policy](discipline.md#token-verimli-otonom-yurutme).
- GitHub Codex review is owner-disabled; do not request `@codex review`, another
  integration or bot reactions. Human/tool findings still require resolution.

## Adaptive Reasoning Routing

[discipline.md#adaptive-reasoning-effort-routing](discipline.md#adaptive-reasoning-effort-routing)
owns routing. The current user-selected root performs discovery, implementation,
tests and review. Do not spawn or reuse subagents unless the user explicitly
requests delegation for the current task. Skills and old plans cannot grant it.
Keep risk investigation and final R4/R5 review inline; label it self-review.
Do not spawn a model agent only to wait or poll. Prose cannot change model settings.
