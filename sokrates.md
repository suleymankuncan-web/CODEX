# Sokrates Working Principle

Status: active
Shelf: operating
Last verified: 2026-09-18

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

Read [the applicable decision rule](docs/process/decision-risk-reference.md#operating-modes).

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

Read [the applicable decision rule](docs/process/decision-risk-reference.md#socratic-question-loop).

## Definition Of Ready

Read [the applicable decision rule](docs/process/decision-risk-reference.md#definition-of-ready).

## Decision Record Format

Read [the applicable decision rule](docs/process/decision-risk-reference.md#decision-record-format).

## Decision Quality Score

Read [the applicable decision rule](docs/process/decision-risk-reference.md#decision-quality-score).

## Sokrates Quality Bar

Read [the applicable decision rule](docs/process/decision-risk-reference.md#sokrates-quality-bar).

## Self-Audit

Read [the applicable decision rule](docs/process/decision-risk-reference.md#self-audit).

## Prioritization Matrix

Read [the applicable decision rule](docs/process/decision-risk-reference.md#prioritization-matrix).

## Next Best Step Heuristic

Read [the applicable decision rule](docs/process/decision-risk-reference.md#next-best-step-heuristic).

## Scope Brake And Blast Radius

Read [the applicable decision rule](docs/process/decision-risk-reference.md#scope-brake-and-blast-radius).

## Domain Risk Rules

Read [the applicable decision rule](docs/process/decision-risk-reference.md#domain-risk-rules).

## Evidence Labels And Freshness

Use these labels: **repo evidence** (files/diff/config/history), **test evidence**
(specific command), **runtime evidence** (staging/production/provider/browser),
**user preference**, **inference**, and **assumption**. Never present inference or
assumption as proof. Current repo state beats memory; current `origin/main` beats
old local history; runtime/provider facts expire; a documented blocker remains
blocked until its required input exists.

## Counterargument And Bias Checks

Read [the applicable decision rule](docs/process/decision-risk-reference.md#counterargument-and-bias-checks).

## Change-My-Mind Triggers

Read [the applicable decision rule](docs/process/decision-risk-reference.md#change-my-mind-triggers).

## Canonical Execution Boundary

Execution, PR/merge, verification, UI/refactor, agent routing, and on-prem proof
recipes belong to [`discipline.md`](discipline.md). Input-bound
`npm.cmd run check:release -- --resume` cannot reduce complete test coverage;
the September 2026 owner-approved recovery contract may retain reviewed isolated
spec results with identical inputs and provenance. Unknown dependencies require
full execution;
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

Read [the applicable decision rule](docs/process/decision-risk-reference.md#rollback-and-recovery).

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
