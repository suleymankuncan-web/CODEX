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
- Before a manual image/offline proof dispatch, run
  `npm.cmd run check:onprem:dispatch -- prove` on the exact clean committed
  HEAD, then publish only after push with `publish`; use the wrapper's
  dispatch subcommands exclusively. Automatic PR/reusable workflows begin
  with the bounded exact-SHA `github-source-preflight`; GitHub runtime proofs
  remain independent final evidence, never a diagnostic loop.

## Adaptive reasoning routing

The root coordinator is the Medium integration owner and may raise its own
reasoning only as far as High when substantive planning or risk requires it. It
owns scope, Sokrates decisions, cross-slice integration, PR and merge decisions,
and the final report. Routine execution should be delegated to the configured
`luna_max` worker whenever the work contains a concrete bounded subtask that can
be given exclusive file or responsibility ownership.

### Luna-first execution routing

Use `luna_max` with `fork_turns: "none"` as the default cost-efficient execution specialist.
The role is configured as Luna Max with maximum reasoning and the inherited
normal service tier. Do not set a fast service tier override. The root must give
it a self-contained prompt because no conversation history is inherited.

Delegate to Luna by default for:

- scoped repository discovery, inventories, code-path tracing, and evidence
  collection;
- implementation in explicitly owned files or modules;
- targeted tests, fixtures, contract checks, lint/build failure classification,
  and mechanical repairs with a clear expected result;
- docs, scripts, UI slices, backend slices, refactors, and cleanup whose scope,
  behavior contract, and verification are already clear;
- independent next-PR preparation while another PR's checks are monitored by
  native tooling;
- first-pass diff, regression, mobile/responsive, accessibility, and test-gap
  review when the review does not replace a required High-risk review.

Keep work in the Medium root when delegation overhead would exceed the task,
the work cannot be separated from active integration, or the next action is a
root-owned decision. Examples are a one-line answer or edit, resolving a tiny
obvious conflict, combining agent outputs, selecting scope, accepting risk,
and PR/merge closeout.

Luna may implement a bounded slice inside R4/R5 work only after the approved
plan, exact ownership, invariants, stop conditions, and verification are
mechanically clear, and only when the slice does not itself choose or redefine
the sensitive semantics. Auth, permission, security, database, migration,
data-integrity, concurrency, destructive, provider, or production uncertainty
still triggers `problem_solver_high`; substantive planning remains with the
root at High. Luna can support those lines with isolated implementation, tests,
fixtures, or evidence, but does not replace the risk specialist or root.

Luna must not make owner/product decisions, broaden scope, handle unbounded
secrets or live-provider operations, commit, push, open or merge a PR, deploy,
or act as the sole final reviewer for R4/R5. Do not spawn Luna merely to wait
or poll checks. Never give two agents overlapping ownership of the same files
or workflow.

Every Luna prompt must be self-contained and state the workspace, goal, risk
class, required operating-doc or skill reads, exact allowed files or
responsibility, forbidden boundaries, acceptance criteria, targeted commands,
stop conditions, and handoff format. State that other agents and user changes
may exist and must not be reverted. Do not override the role's model,
reasoning, or service tier at spawn time. In particular, never opt Luna into a
fast tier.

The root validates every Luna handoff against the current diff and repository
evidence, runs the required integration-level verification, and remains
accountable for the result. If `luna_max` is unavailable or its configured
model cannot be verified, report that fact and continue under normal
Sokrates routing; never claim Luna was used.

Token-efficiency target: when a task has enough safe delegable work, aim for
roughly 60-75% of model tokens and 75-85% of bounded task executions to run on
Luna, leaving roughly 25-40% of tokens for Sol/root coordination. This is a
directional operating band, not a quota or completion gate. Do not create
artificial subtasks or duplicate repository reading merely to reach it.

Substantive plans, architecture, multi-PR sequencing, and unresolved R3-R5
acceptance or rollback are prepared by the root using High reasoning. No
repository role may request a reasoning level above High.

Delegate a bounded read-only investigation or review to
`problem_solver_high` when any of these is true:

- the same material failure remains after two evidence-based fix attempts;
- a failing check has no clear root cause after the first focused inspection;
- repository evidence conflicts across code, tests, documentation, database,
  runtime, or provider state;
- auth, permission, security, data integrity, migration, concurrency,
  destructive operations, or production safety is involved;
- an R4/R5 diff is ready for its final adversarial review.

After the High report, the Medium root coordinator applies or rejects
the recommendation using repository evidence and `sokrates.md`, then resumes
routine execution. High review agents do not edit files, commit, push, open PRs,
merge, deploy, or make owner decisions.

## Efficiency and concurrency

- Use the smallest sufficient effort: Medium by default and High for substantive
  planning, bounded uncertainty, risk, or final R4/R5 review. Never exceed High.
- Prefer one specialist at a time. Run planner and problem solver concurrently
  only when their scopes are genuinely independent.
- Prefer Luna for bounded execution, but delegate only work that is large
  enough to repay the self-contained prompt, repository reading, and handoff
  overhead. One root action is cheaper than a ceremonial subagent round trip.
- Never assign two agents to edit the same files or workflow.
- Never run two full release suites concurrently.
- Use `npm.cmd run check:release` for a fresh canonical local proof. After a
  concrete late-stage failure, use `npm.cmd run check:release -- --resume` only
  when the runner accepts the exact HEAD/manifest/command/runtime/lock/workspace
  identity; volatile audits still rerun and any uncertainty falls back fresh.
- In GitHub Actions, use native `Re-run failed jobs` after a late failure so
  successful root/backend/frontend/audit sibling proof jobs are preserved.
  Never reduce tests, coverage,
  audits, builds, API checks, Playwright selection, or the two-worker isolation
  policy to improve wall time.
- The stable `required-release-gate` remains fail-closed. Missing, skipped,
  cancelled, timed-out, failed, stale, or identity-mismatched proof cannot be
  reused. Total runner-minutes above 110% of the recorded baseline require an
  owner decision before further orchestration expansion.
- Monitor PR checks with native GitHub and active frontend-provider polling (Cloudflare
  plus Vercel during the cutover rollback window) or an existing background
  shell watcher. Do not spawn a model agent only to wait or poll.
- Use 55-60 second idle polling intervals. Return only state transitions or a
  compact failure tail to the model; never stream complete successful logs.
- Reuse already-read operating context within one active goal. Before a full
  release, preflight required package binaries and dependency links; run the
  targeted proof once and the selected full release once unless a concrete
  failure invalidates that evidence.
- When a check changes state, the Medium root classifies and handles an obvious
  failure; use `problem_solver_high` only when focused inspection cannot explain
  the failure or a High-risk boundary is involved.
- Stop delegating when the specialist question is answered; do not keep High
  active for routine implementation.
- Stop each Luna task when its assigned ownership and verification are complete;
  reuse an idle Luna role with a new bounded prompt instead of leaving it open
  as a general-purpose background worker.
- Luna may make one focused correction when an obvious failure remains inside
  its assigned boundary. The root and Luna share one failure budget; delegation
  does not reset attempt counts. Escalate under the existing High rules after
  two evidence-based attempts or earlier for a sensitive boundary.
- If a configured role is unavailable, do not claim it ran. Report the
  capability failure and apply the normal `sokrates.md` stop/risk rules.
