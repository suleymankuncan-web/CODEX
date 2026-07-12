# HR Axis Agent Execution Contract

This file is the Codex entry point for repository-local execution. The detailed
policy remains in `discipline.md`; decision and stop rules remain in
`sokrates.md`.

## Required operating truth

- Read `CONTRIBUTING.md` and `current-state.md` before changes.
- Read `sokrates.md` for ambiguity, architecture, auth, API, database,
  provider, data-integrity, or medium/high-risk work.
- Read the relevant `discipline.md` sections before implementation,
  verification, PR, merge, UI/refactor, or workspace-hygiene work.
- Fresh repository and runtime evidence outrank stale descriptions.

## Adaptive reasoning routing

The root coordinator is the Medium implementation owner. It owns scope,
edits, tests, integration, PR decisions, and the final report.

Delegate a read-only planning task to `planner_xhigh` before editing when any
of these is true:

- the user explicitly requests a plan, specification, architecture, or
  multi-PR execution line;
- the work is R3, R4, or R5 under `discipline.md` and no approved executable
  plan already fixes scope, acceptance, rollback, and verification;
- the expected change crosses frontend/backend/database/auth/provider
  boundaries or has three or more coupled slices;
- acceptance criteria, rollback, sequencing, or owner decisions are not yet
  mechanically clear.

Do not invoke XHigh planning for R0 docs corrections, one-line mechanical
fixes, routine check monitoring, already-approved step-by-step execution, or
other work whose scope and verification are already explicit.

Delegate a bounded read-only investigation or review to
`problem_solver_high` when any of these is true:

- the same material failure remains after two evidence-based fix attempts;
- a failing check has no clear root cause after the first focused inspection;
- repository evidence conflicts across code, tests, documentation, database,
  runtime, or provider state;
- auth, permission, security, data integrity, migration, concurrency,
  destructive operations, or production safety is involved;
- an R4/R5 diff is ready for its final adversarial review.

After the High or XHigh report, the Medium root coordinator applies or rejects
the recommendation using repository evidence and `sokrates.md`, then resumes
routine execution. High/XHigh agents do not edit files, commit, push, open PRs,
merge, deploy, or make owner decisions.

## Efficiency and concurrency

- Use the smallest sufficient effort: Medium by default, High for bounded
  uncertainty/risk, XHigh for substantive planning and decision structure.
- Prefer one specialist at a time. Run planner and problem solver concurrently
  only when their scopes are genuinely independent.
- Never assign two agents to edit the same files or workflow.
- Never run two full release suites concurrently.
- Stop delegating when the specialist question is answered; do not keep High
  or XHigh active for routine implementation.
- If a configured role is unavailable, do not claim it ran. Report the
  capability failure and apply the normal `sokrates.md` stop/risk rules.
