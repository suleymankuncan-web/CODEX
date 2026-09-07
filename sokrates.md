# Sokrates Working Principle

Status: active
Shelf: operating
Last verified: 2026-09-07

Sokrates is the repository's decision-quality system. Apply it automatically and
proportionally: move quickly when work is safe, become skeptical when risk is
real, and stop when the next step would be dishonest, irreversible, or too broad.

## Relationship To The Operating Docs

Use the operating documents as one system, with one owner for each question:

- [AGENTS reading map](AGENTS.md#reading-map): entry routing and the current
  root-only execution boundary.
- `CONTRIBUTING.md`: contributor-facing minimum contract.
- `current-state.md`: freshest project facts, caveats, and handoff state.
- `sokrates.md`: decisions, prioritization, risk, ambiguity, and stop/ask judgment.
- `discipline.md`: execution, agent, PR/merge, verification, UI/refactor, and
  workspace-hygiene mechanics.

Do not resolve overlap by copying more policy. Use the owner document and prefer
the newest user instruction plus fresh repository, runtime, or provider evidence.

## Core Stance

Before implementing an external prompt, plan, or recommendation, ask what it
assumes, what the repository proves, what could break, and what smallest
reversible step would test it. Preserve existing behavior unless behavior change
is explicit. Keep facts, inferences, assumptions, and user preferences separate.

## Fresh Session Bootstrap

Follow [AGENTS.md#reading-map](AGENTS.md#reading-map): read the required entry
documents, check branch/worktree status, leave unrelated changes untouched, and
identify the active goal, non-goals, caveats, acceptance signal, protected areas,
and next safe step. Do not reconstruct current merge, provider, or runtime state
from memory or stale history.

## Operating Modes

- **Scout:** inspect and inventory without editing.
- **Planner:** turn evidence into a small, reversible slice with risk, rollback,
  acceptance, and verification.
- **Builder:** implement only a ready, bounded slice.
- **Reviewer:** inspect scope, behavior, security, regression, and test gaps.
- **Finisher:** use the canonical discipline closeout when PR/merge work is
  authorized.

If the mode changes mid-turn, say why. A review or plan is evidence, not owner
authorization for a new behavior, provider, permission, or production action.

## Triage Gate

Classify the request before more than a small read-only action:

- Simple answer or status/check: answer or inspect directly.
- Docs/plan: update docs only when it improves future execution.
- Low-risk implementation: proceed with light Sokrates and targeted gates.
- Medium-risk implementation: make the decision record and verification explicit.
- High-risk or one-way-door work: use the full loop or stop for evidence/alignment.
- External/live dependency: verify the input; otherwise park or prepare local-only
  work without claiming external proof.

## Project Invariants

Unless the user explicitly changes them:

- Keep the existing project; do not rewrite by default.
- Preserve business logic, API response shape, auth/permission/session/scope
  semantics, DB/data integrity, queue/import behavior, and user workflows.
- Treat DB migrations, production configuration, provider settings, live data,
  and external evidence as high-risk.
- Keep user-visible flows calm, honest, accessible, and reversible.
- Leave unrelated dirty files, local transcripts, generated artifacts, and
  classified branches/worktrees/stashes/remotes untouched.

## Socratic Question Loop

For strategic, architectural, refactor, or high-risk work:

1. State the claim: what are we being asked to do or believe?
2. Name the assumptions and label each as proven, inferred, or unverified.
3. Inspect repository and applicable runtime/provider evidence.
4. Test the strongest counterexample and likely failure path.
5. Shrink the claim to the smallest safe, reversible slice.
6. Define failure signals, stop conditions, rollback, and acceptance.
7. Choose: proceed, narrow, gather evidence, ask, park, or stop.

Do not turn this loop into ceremony for a tiny mechanical documentation edit.

## Definition Of Ready

A slice is ready only when its problem, why-now, success signal, intended files or
responsibility, non-goals, protected areas, risk, acceptance criteria,
verification path, and two-way/one-way-door classification are clear enough to
review. If not, inventory the state, update a plan, ask one blocking question,
park it with exact missing evidence, or choose a smaller reversible slice.

## Decision Record Format

For medium/high-risk decisions, record concisely:

- **Decision:** what will be done and what will not.
- **Why now:** user/business value, blocker, or risk reduced.
- **Evidence:** repo, test, runtime, user preference, inference, or assumption.
- **Counterargument:** strongest reasonable case against it.
- **Risk and door:** LOW/MEDIUM/HIGH and two-way, one-way, or near-one-way.
- **Scope:** slice, branch, PR, batch, spike, park, or stop.
- **Guardrails:** behavior, auth/privacy, API, data, provider, and user changes
  that are forbidden.
- **Acceptance and verification:** the signals tied to the goal.
- **Change-my-mind trigger and next action:** what stops/splits/reverses the plan.

Keep the record short enough for a cold reader to audit.

## Decision Quality Score

Use this calibration for medium/high-risk choices:

- 0: unclear goal, assumptions, rollback, or verification.
- 1: goal is clear but evidence or verification is weak.
- 2: goal, scope, risk, and tests are clear but counterargument/rollback is thin.
- 3: evidence, counterargument, risk, rollback, and verification are clear.
- 4: those are clear plus blast radius and runtime/handoff confidence.
- 5: the next alternative and cost of delay are also compared and the decision
  survives cold-reader review.

LOW work may proceed at 2; MEDIUM should reach 3; HIGH or one-way-door work should
reach 4 or stop for evidence; strategic, production, auth/DB/API, or batching
decisions should aim for 5.

## Sokrates Quality Bar

Before an important decision, check evidence discipline, priority/value,
proportionality, boundary protection, reviewability, verification, rollback,
freshness, plain communication, and learning from prior misses. Passing tests are
necessary, not sufficient: the diff, user behavior, evidence level, and skipped
gates must also be understood.

## Self-Audit

Before finalizing a plan or decision, ask: Did I identify the real problem? Separate
evidence from inference? Test the strongest counterargument? Name what changes my
mind? Choose the smallest useful reversible step? Protect hard boundaries? Match
report depth to risk? Avoid reckless speed and ceremonial overthinking? If two or
more answers are weak, revise before acting.

## Prioritization Matrix

When valid paths compete, compare in this order: blocker removal; user/business
value; risk reduction; dependency unlock; reviewability; rollback clarity;
verification cost; external-input dependency; and cost of delay. Prefer a smaller
blast radius and clearer proof when choices are close, unless a real user workflow
or urgent gate is being harmed.

## Next Best Step Heuristic

Read `current-state.md`, then compare product-value, risk-reduction, blocker,
cleanup, evidence, and park paths. For each serious candidate state why now, risk,
cost of doing nothing, smallest first slice, and required evidence. Recommend:

- **Now:** the best immediate slice and why.
- **Next:** likely follow-up if it succeeds.
- **Park:** what waits and the exact unpark evidence.
- **Stop:** the first invalidating condition.

Avoid auth, permission, DB, API-shape, provider, production, and broad architecture
work without a concrete bug, blocker, user request, or approved plan.

## Scope Brake And Blast Radius

Describe work in slices, branches, and PRs. Stop and re-plan when one PR becomes a
multi-PR line, a batch loses one review story, verification expands risk class,
external input appears, or the next slice changes the goal. Map frontend, API,
backend/domain, auth/scope, DB/data, queue, provider/production, tests, docs, and
release-gate layers. An unexpected auth, DB, API-shape, provider, or production
layer is a stop-and-replan signal.

## Domain Risk Rules

### Auth And Permissions

Default HIGH. Preserve role, session, scope, action-store, and fail-closed
semantics. Start from existing matrices/tests and include negative cases. Stop if
access could broaden, denial could weaken, or the actor/portfolio could change.

### API Contracts And Generated Clients

Default MEDIUM, HIGH for auth/write/response-shape changes. Check path, params,
body, status, response, errors, generated schema/types, wrappers, and contract
tests. Stop on an unplanned path, status, auth, or response change.

### DB, Migrations, And Data

Default HIGH or one-way-door. Do not add migrations or repair live data without
explicit scope, rollback, disposable/local smoke, and a recovery plan. Stop when
rollback needs unplanned manual repair or production data is being used as a
scratchpad.

### Frontend UX And Product Feel

Default MEDIUM, LOW for isolated copy/layout. Optimize a real operator decision,
preserve data/workflow semantics, and keep role/accessibility/responsive states
honest. Stop when polish changes business, permission, API, or data behavior.

### Refactor

LOW to MEDIUM, HIGH when shared auth/API/DB behavior is touched. Require a real
product or risk reason, preserved behavior, test coverage, and clear rollback;
stop if new product rules are needed to make the refactor correct.

### CI, Release, And Checks

Treat a failing check as signal. Never bypass, delete, weaken, or hide a gate;
understand the cause and record intentional skips. The exact-input release,
coverage, provider, and on-prem mechanics are owned by `discipline.md`.

### External Evidence And Live Providers

Default HIGH. Identify required tokens, targets, approvals, privacy boundaries,
and rollback. Local code cannot prove live provider, restore, alert, queue, or
authenticated user behavior. Park unavailable evidence or prepare clearly labelled
local-only work; never invent a runtime result or expose secrets.

## Evidence Labels And Freshness

Use these labels: **repo evidence** (files/diff/config/history), **test evidence**
(specific command), **runtime evidence** (staging/production/provider/browser),
**user preference**, **inference**, and **assumption**. Never present inference or
assumption as proof. Current repo state beats memory; current `origin/main` beats
old local history; runtime/provider facts expire; a documented blocker remains
blocked until its required input exists.

## Counterargument And Bias Checks

For medium/high-risk work, ask why this might be wrong, what happens if nothing is
done, what narrower step gives the same learning, and whether a split improves
review/rollback/testing. Watch for urgency, novelty, refactor, green-check, batch,
local-optimum, sunk-cost, and user-pleasing bias. Narrow or ask for alignment when
one is present.

## Change-My-Mind Triggers

Before acting, name the diff, failing test, unexpected file/domain, behavior
change, evidence conflict, or review finding that would force a split, stop, or
reversal. Do not force the original plan after such a signal.

## Canonical Execution Boundary

Execution, PR/merge, verification, UI/refactor, agent routing, and on-prem proof
recipes belong to [`discipline.md`](discipline.md). Exact-input
`npm.cmd run check:release -- --resume` cannot reduce coverage or test selection;
the rule is that the fail-closed aggregate remain unchanged. The owner-disabled
GitHub Codex review remains off, while required checks and independent runtime
evidence remain mandatory.

## Definition Of Done

Use [discipline.md](discipline.md#done-definition) for the canonical closeout. At
decision level, done means the final diff matches scope, acceptance and relevant
checks passed, evidence labels and caveats are honest, rollback is understandable,
and remaining risk or external gate is named.

## Hard Boundaries

Do not change business logic, API response shape, auth/permission behavior, DB
schema/migrations, provider configuration, queue/import lifecycle, scoring/ranking,
or user-facing workflow semantics unless explicitly scoped with appropriate proof.
Do not mix UI redesign, backend behavior, auth, DB, or refactor into an
uncontrolled PR. Do not touch unrelated dirty files or destructive workspace
state.

## Stop Rules

Stop and report when the diff has unexpected files or domains; a test fails without
an understood cause; a refactor changes behavior; API/auth/DB/provider semantics
leak into scope; rollback is unclear; evidence is unavailable or invented; a batch
cannot be explained in one paragraph; a required check or mergeability is blocked;
or the needed fix is larger/riskier than the approved slice.

## Risk Labels And Doors

- **LOW:** isolated docs, copy, generated refresh, pure helper, or behavior-neutral
  cleanup with adequate proof.
- **MEDIUM:** component/refactor, read API/client, or user-facing layout/copy.
- **HIGH:** auth, permissions, writes, DB/migrations, production/provider config,
  security, release gates, or cross-domain changes.

A two-way door is localized and easy to revert. A one-way door changes external
contracts, live data, or broad infrastructure. One-way work needs explicit
alignment, stronger evidence, and a recovery plan.

## Rollback And Recovery

Before medium/high-risk work, know whether one revert is sufficient, generated and
source files stay in sync, data repair/provider changes are needed, a failed deploy
could harm users, and what signal triggers rollback. If recovery is unclear, reduce
scope before implementation.

## Report Depth And Overrides

Use light Sokrates for trivial docs, standard for normal product/code, and full for
architecture, refactor lines, auth/API/DB/security, production/provider, or batch
decisions. Sokrates may be overridden by an explicit informed user choice, urgent
incident, triviality, repo-specific test, or live operational fact. State what was
overridden and why; preserve hard safety boundaries and return to normal rhythm.

## Learning And Handoff

After repeated related work, a changed plan, a real gate miss, a priority correction,
or noisy process, record the smallest useful calibration: keep, simplify, add one
guard, or change the next-step heuristic. Update `current-state.md` or the relevant
plan when a decision, caveat, gate, or next-best work changes. Do not turn a handoff
into a history archive.

## Anti-Ceremony Rule

Scale the process to risk: inspect/edit/verify/report for trivial docs; use the
default rhythm for normal work; add evidence, counterargument, change-my-mind
triggers, and stronger verification for medium/high-risk work. If process is
heavier than risk, simplify it; if risk exceeds process, deepen it.
