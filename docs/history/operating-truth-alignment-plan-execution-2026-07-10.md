# Operating-Truth Alignment And Plan Execution Record - 2026-07-10

Status: historical
Shelf: historical
Use when: reconstructing the 10 July 2026 process/CI/documentation execution line
Do not use when: choosing current work, current merge state, or current provider posture
Last verified: 2026-07-10
Superseded by: `current-state.md`

## Reader And Action

Reader:

- an owner, engineer, or future agent who needs the reasoning and proof trail
  behind the operating-truth transition after the former long handoff.

After reading, they should be able to identify what each process PR changed,
which evidence is still external, and why this record does not authorize a new
runtime or broad-production train.

## Boundary

This is a dated reconstruction record. Statements about PR state and live
checks are historical snapshots from this execution line. Use `current-state.md`
plus live GitHub, current worktree, and runtime/provider evidence for present
decisions. Earlier long-form history remains in
`docs/history/current-state-through-pr-913-2026-07-09.md`.

## Starting Point

PR #914 closed the original operating-truth alignment: it shortened the active
handoff, preserved the former long handoff as history, and recorded the
no-delete branch/worktree/stash inventory. The owner then approved autonomous
execution of the project-analysis implementation plan while retaining its
runtime-evidence and broad-production gates.

The plan execution did not open a product feature, API, DB, auth, provider, or
workflow change. Its purpose was to make CI truth, documentation ownership, and
pilot-evidence posture match the actual project state.

## Process PR Record

| PR | Slice | Historical result |
| --- | --- | --- |
| #917 | A1 required release gate | Merged 2026-07-09 23:49Z. Added an always-running, fail-closed `required-release-gate` aggregate and aligned main protection to require that context. Docs-only selection, failure behavior, and live ruleset readback were proved. |
| #918 | A2 frontend release deduplication | Merged 2026-07-10 00:27Z. Kept root release as the canonical full release owner; converted frontend release work to a reusable targeted child so no second full Playwright suite decides the same PR. |
| #919 | A3 bounded E2E concurrency | Merged 2026-07-10 01:33Z. Preserved all 371 Playwright tests, used two CI-only workers with serial files, and uploaded `test-results` only when a release fails. Two live proofs were green; neither was treated as the required ten-run p95 result. |
| #920 | B1 controlled-pilot evidence | Merged 2026-07-10 01:40Z. Recorded every one of the five requested flows as `blocked_external`, named the safe inputs required to run them, and made the explicit `no_runtime_change` decision. |
| #921 | E1 documentation drift cleanup | Merged 2026-07-10 02:02Z. Reconciled Visual Merchandiser-only Store route behavior, locked the actual guard in a contract, migrated five safe historical-handoff guard reads, and inventoried the remaining archive readers without bulk rewrite. |

No GitHub Codex review was requested for this line under the owner-disabled
policy. Each merged PR had local adversarial review, scope-appropriate local
verification, GitHub required checks, deployment checks where applicable, clean
mergeability, and a 30-second stability reread.

## A1 Truthful Gate Proof

The main ruleset was read back after the A1 merge and required only the
`required-release-gate` aggregate for normal PR merges. The aggregate remains
always present and fails closed over applicable child work. It is not a path
filter that can disappear for docs-only changes.

The historical proof also confirmed that GitHub Codex review is not part of
this gate. Owner direction disables request, trigger, and wait behavior for
that review channel until explicitly re-enabled.

## A2 And A3 Release Evidence

Before A3, the latest ten successful root PR releases had a nearest-rank p95 of
14 minutes and 1 second; Playwright accounted for most of the root job. A2
removed duplicated full-suite work without removing a test. A3's local
repetitions and first live PR proof showed the suite still discovers and passes
371 tests with two workers.

The initial PR #919 proof recorded a 10-minute-27-second root release and an
8.1-minute Playwright run. The final documented-head proof recorded a
10-minute-54-second root release and `371 passed (8.4m)`. Both had green
aggregate/targeted/rehearsal/Vercel checks and a correctly skipped
failure-only artifact on success. The evidence source is
`docs/evidence/performance/2026-07-10-e2e-worker-concurrency-a3.md`.

The next ten successful root-release PR runs remain required before declaring
the p95 target achieved. A missed target must result in a dated measured
no-change/insufficient-improvement decision, never coverage reduction or retry
hiding.

## B1 External-Evidence Boundary

B1 did not execute a login/session flow, Store Action flow, checklist flow,
rankings/profile flow, or reports/incentive flow. It did not find a defect and
did not prove absence of a defect.

The blocker record asks for current approved sessions, scoped store/data
context, action and rollback authority where mutation is involved, and an
approved profile subject or reporting package where needed. It forbids raw
tokens, cookies, secrets, or unapproved live mutation.

## E1 Archive Ownership Boundary

The E1 register began from 46 executable readers of the historical handoff.
Five safe readers moved to active narrow sources. The remaining 41 were
classified as 35 safe on-touch migrations, two primary-source assertion
rewrites, three triage decisions, and one deliberate provenance exception.

This was not a mandate to migrate the remaining readers immediately. The rule
is to use the narrow active owner when a relevant guard is already touched,
retain named historical provenance only where justified, and never use the
archive as current direction.

## Continuing Boundary

- The active next product signal remains a real or approved assisted pilot/demo
  session.
- A factual P0/P1 finding gets one scoped finding-specific specification and
  normal verification; without it, runtime remains parked.
- Separate mobile implementation, new modules, broad redesign, provider/JSON
  integration, generic architecture work, and broad production remain parked.
- No branch, worktree, stash, or remote-ref cleanup was authorized or performed
  by this execution line.
