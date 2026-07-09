# Project Analysis Implementation Plan V1

Status: guarded
Shelf: architecture
Spec status: Draft - implementation requires explicit owner approval
Author: Codex
Reviewer: repository owner
Use when: converting the 9 July 2026 full-project analysis into ordered, reviewable work
Do not use when: inventing runtime work without pilot evidence or widening broad-production scope
Last verified: 2026-07-10
Source of truth: `current-state.md` plus live git, GitHub, staging, and provider evidence

## 1. Context

The repository is technically mature enough for the current controlled pilot,
but its implementation and verification surface is no longer small:

- 2,088 tracked files;
- 191 HTTP endpoints;
- 81 database tables and 59 migrations;
- 113 frontend pages;
- 371 Playwright E2E tests;
- 177 backend suites with 1,108 tests;
- 501 root script/contract tests;
- 628 Markdown files under `docs/`.

The project analysis did not prove a current P0 runtime defect. It did prove
four structural risks:

1. GitHub requires only `release-rehearsal`; the official root and frontend
   release workflows can still be running when a PR merges.
2. The frontend test pyramid is E2E-heavy and the same release work is repeated
   across root, frontend, pull-request, and post-merge workflows.
3. Several source boundaries and initial frontend chunks are large, but there
   is not yet runtime evidence that a broad refactor or bundle rewrite is the
   correct next product investment.
4. Active documentation is healthier after PR #914/#915, but role-catalog
   wording and historical-archive contract dependencies still contain drift.

The patron demo or a controlled pilot session remains the authoritative source
for the next product/runtime need. Process hardening may proceed before that
session because it does not change product behavior.

## 2. Objective And Success Definition

Objective:

> Make the merge gate truthful and cheaper, collect real pilot evidence, and
> open runtime work only for a proven finding while preserving the current
> modular-monolith, auth, data, scoring, and workflow boundaries.

Success means:

- a failing applicable release gate cannot be bypassed by ordinary PR merge;
- the same frontend release suite is not needlessly executed twice for one PR
  decision;
- no existing test or protected behavior is silently removed to gain speed;
- pilot/demo findings are factual, classified, and traceable;
- runtime work starts only from an approved P0/P1 finding-specific spec;
- broad production, mobile implementation, new modules, and generic refactors
  remain parked unless their explicit reopen gates are satisfied.

## 3. Functional Requirements

- **FR-1:** Every pull request **MUST** receive one always-present aggregate
  status named `required-release-gate`.
- **FR-2:** The active main-branch ruleset **MUST** require
  `required-release-gate` before merge.
- **FR-3:** The aggregate gate **MUST** fail or remain non-successful if an
  applicable child check fails, is cancelled, times out, or never starts.
- **FR-4:** Docs/process-only changes **MUST** run `git diff --check` and the
  root script/contract tests. A path filter **MUST NOT** make the required
  status disappear.
- **FR-5:** Backend, database, infrastructure, root-script, API-contract, and
  frontend changes **MUST** select the verification ladder defined by the
  existing affected-verification policy without weakening the official root
  release gate.
- **FR-6:** One canonical workflow **MUST** own the full frontend release run
  for a PR decision. A second workflow **MUST NOT** repeat the same 371-test
  suite for the same decision unless it proves a separately documented risk.
- **FR-7:** CI optimization **MUST NOT** delete, skip, rename away, or narrow an
  existing behavior/security/scope test merely to improve duration.
- **FR-8:** A controlled pilot/demo evidence pass **MUST** cover the five
  critical flows in Section 10 and record persona, route, period, expected,
  actual, evidence reference, and severity.
- **FR-9:** Every finding **MUST** be classified as `P0 stop`, `P1 pilot
  blocker`, `P2 pilot friction`, or `P3 backlog` before implementation work.
- **FR-10:** A runtime change **MUST NOT** start until its P0/P1 finding has a
  separate approved spec with requirement IDs, acceptance criteria, negative
  authorization coverage when applicable, and a rollback story.
- **FR-11:** If the pilot produces no P0/P1 finding, the project **MUST** keep
  the runtime train parked and **MAY** continue with approved test/CI efficiency
  work.
- **FR-12:** Frontend unit/component test tooling **MAY** be introduced only as
  a small proof against named high-churn pure logic; existing E2E coverage must
  remain until equivalent behavior coverage is demonstrated.
- **FR-13:** Bundle optimization **MUST** begin with a reproducible staging
  measurement. Large chunks alone **MUST NOT** authorize a rewrite.
- **FR-14:** Active role documentation **MUST** reconcile
  `VISUAL_MERCHANDISER` with the backend role catalog and frontend route
  registry without changing role semantics.
- **FR-15:** Historical handoff references **SHOULD** be removed from executable
  guards incrementally when each guard is touched; the archive **MUST NOT** be
  bulk-rewritten or used as current direction.
- **FR-16:** Broad-production work **MUST** remain blocked until the owner
  explicitly makes broad rollout the goal and the external gates in Section 12
  have real or explicitly accepted evidence.
- **FR-17:** This plan **MUST NOT** authorize deletion, movement, application,
  dropping, reset, or rewrite of inventory branches, worktrees, remote refs, or
  stashes.

## 4. Non-Functional Requirements

- **NFR-1 Security:** No token, cookie, provider secret, database URL, Redis
  URL, private payload, or unredacted personal data may enter logs, evidence,
  docs, test output, or PR text.
- **NFR-2 Reliability:** `required-release-gate` must be deterministic for
  success, failure, cancellation, timeout, and path-selection states.
- **NFR-3 CI performance:** After CI optimization stabilizes, the last ten
  successful root release PR runs should have p95 duration at or below 12
  minutes, with no reduction in selected test coverage. If this target cannot
  be achieved safely, record the measured reason instead of weakening gates.
- **NFR-4 Compatibility:** Process and test-efficiency PRs must not change API,
  database, auth/permission, scoring, queue/import, provider, or user workflow
  behavior.
- **NFR-5 Reviewability:** Every PR must have one review story, one rollback
  story, and a scope that can be explained in one paragraph.
- **NFR-6 Handoff:** `current-state.md` must remain between 150 and 250 lines and
  contain only current facts, caveats, and next action.
- **NFR-7 Evidence:** Performance, production, and pilot claims must use live or
  reproducible evidence; local tests may support but not replace external proof.

## 5. Acceptance Criteria

- **AC-1 (FR-1, FR-2):** Given any pull request, when GitHub evaluates merge
  eligibility, then `required-release-gate` is present and is listed in the
  active main ruleset's required status contexts.
- **AC-2 (FR-3):** Given an applicable child job that fails, is cancelled,
  times out, or is skipped unexpectedly, when the aggregate job evaluates,
  then it does not report success and ordinary merge remains blocked.
- **AC-3 (FR-4):** Given a docs-only change, when CI runs, then diff check and
  root contract tests execute and the required aggregate status completes.
- **AC-4 (FR-5):** Given a frontend, backend, DB, infra, API-contract, or root
  script change, when CI selects checks, then the existing affected-verification
  contract selects the appropriate full/targeted ladder and the aggregate waits
  for it.
- **AC-5 (FR-6, FR-7):** Given a frontend-affecting PR, when its merge-decision
  workflows finish, then the full Playwright suite has one canonical execution,
  every previously listed test remains discoverable, and root release semantics
  are preserved.
- **AC-6 (NFR-3):** Given ten completed root release PR runs after stabilization,
  when durations are calculated, then p95 is at most 12 minutes or a dated
  exception documents the measured blocker without reducing coverage.
- **AC-7 (FR-8, FR-9):** Given a controlled pilot/demo session, when it closes,
  then all five critical flows have factual evidence and every issue has exactly
  one severity classification.
- **AC-8 (FR-10):** Given a P0/P1 finding, when a runtime PR is proposed, then an
  approved finding-specific spec, tests, rollback, affected roles/routes, and
  evidence link exist before implementation begins.
- **AC-9 (FR-11):** Given no P0/P1 finding, when the pilot evidence is reviewed,
  then no runtime PR is opened solely from historical backlog or line count.
- **AC-10 (FR-12):** Given a frontend unit-test seed PR, when it closes, then at
  least two named pure-logic behaviors have fast unit coverage, no E2E test was
  removed without proven equivalence, and the new runner is included in CI.
- **AC-11 (FR-13):** Given a bundle/performance proposal, when it is approved,
  then it cites a reproducible critical-route measurement and names the exact
  chunk, interaction, device/network profile, expected gain, and rollback.
- **AC-12 (FR-14):** Given the active role registry, backend catalog, and route
  registry, when compared, then active/pilot/parked distinctions are explicit
  and `VISUAL_MERCHANDISER` is not omitted from current active behavior.
- **AC-13 (FR-15):** Given a historical-archive-dependent guard is modified,
  when the PR closes, then it reads the narrowest canonical domain/evidence
  source where practical and does not add a new archive dependency.
- **AC-14 (FR-16):** Given broad-production inputs are incomplete, when the plan
  is reviewed, then broad production remains `No-Go` and no provider claim is
  upgraded by local-only evidence.
- **AC-15 (FR-17):** Given the workspace hygiene inventory, when any plan PR
  closes, then branch/worktree/remote-ref/stash counts may be re-read but no
  inventory item has been mutated without a separate explicit owner approval.

## 6. Edge Cases And Failure Modes

- **EC-1:** A path-filtered workflow does not start, leaving a required status
  permanently expected. The aggregate workflow must always start and resolve
  scope internally.
- **EC-2:** A child workflow is cancelled by concurrency after a new push. The
  aggregate must bind to the latest head SHA and must not accept the cancelled
  result from an older SHA.
- **EC-3:** A job marked `continue-on-error` fails. The aggregate must inspect
  the real child result instead of treating the workflow as clean.
- **EC-4:** A docs change edits a contract-guarded phrase. Root script tests must
  still run even though no runtime directory changed.
- **EC-5:** Sharding changes test ordering or shared preview-server state. Each
  shard must be isolated or the plan must retain single-worker execution.
- **EC-6:** CI becomes faster only because tests disappear. Test-list and named
  contract baselines must detect coverage loss.
- **EC-7:** Pilot evidence is unavailable. Record `blocked_external`; do not
  invent a finding and do not open a runtime train.
- **EC-8:** A pilot issue cannot be reproduced. Keep it as P2/P3 or
  `needs_evidence`; do not guess a root cause.
- **EC-9:** A P0/P1 fix would change auth, API, DB, scoring, or queue semantics.
  Stop and obtain explicit approval for the separate spec.
- **EC-10:** Bundle numbers are high but the measured pilot route is healthy.
  Keep optimization parked.
- **EC-11:** Production provider evidence conflicts with committed docs. Live
  sanitized evidence wins and the readiness decision must be updated before
  rollout.
- **EC-12:** Ruleset API or repository permissions prevent required-check
  configuration. Mark PR-A1 blocked; do not claim the merge gate is closed.

## 7. API Contracts

N/A - this plan does not authorize a new or changed application API.

Any conditional runtime finding that changes an endpoint must define its own
request, success, error, authorization, idempotency, and compatibility contract
in the finding-specific approved spec.

## 8. Data Models

No application database model change is authorized.

The pilot evidence record is a document contract with these required fields:

| Field | Type | Constraint |
| --- | --- | --- |
| `findingId` | string | Stable, unique, dated ID |
| `sessionAt` | ISO timestamp | Europe/Istanbul interpretation recorded |
| `persona` | enum/string | Canonical role/persona |
| `route` | string | Exact route or workflow |
| `period` | string/null | Business period when applicable |
| `expected` | string | Factual expected behavior |
| `actual` | string | Factual observed behavior |
| `severity` | enum | P0, P1, P2, P3, or needs_evidence |
| `evidenceRef` | string | Sanitized screenshot/trace/readback reference |
| `decision` | string | stop, fix, park, or no_change |

## 9. Out Of Scope

- New product modules or microservices.
- Separate mobile-app implementation.
- Broad UI redesign or design-system rewrite.
- Speculative repository/service splitting based only on line count.
- JSON/Nebim/provider adapters without a real source contract.
- KPI, ranking, checklist, target, payout, or scoring semantic changes.
- API, auth, DB, queue, import, or workflow behavior changes without a separate
  finding-specific approved spec.
- Broad-production rollout or provider procurement.
- Automated workspace cleanup.
- Bulk rewriting historical documentation or all archive-dependent guards.

## 10. Pilot/Demo Critical Flow Matrix

| Flow | Minimum personas | Required evidence | Stop condition |
| --- | --- | --- | --- |
| Login, refresh, logout, session recovery | Admin, Region Manager, Store Manager, Store Personnel | Landing, role/scope summary, refresh/logout result | Loop, wrong landing, stale/foreign session |
| Store Home to Tasks/Action | Region Manager, Store Manager | Visible queue, assigned-store boundary, action result | Foreign-store access or blocked core command |
| Checklist visit and acknowledgement | Region Manager/VM, Store Manager | BM/VM selection, completion, acknowledgement | Wrong template/scope or lost completion |
| Rankings to personnel profile | Store Manager, Store Personnel, Region Manager | Visible rows, open-profile permission, direct-route denial | Cross-personnel/scope leak |
| Reports and incentive readback | Region Manager and applicable admin | Period, roster, target, KPI, export/readback totals | Material data mismatch or unusable close/edit state |

## 11. Ordered Execution Plan

### PR-0 - This plan

Story: establish the approved execution contract; no implementation.

Exit gate:

- owner approves or amends the sequence;
- implementation approval changes from pending to approved;
- no runtime code changes are included.

### PR-A1 - Required Release Gate Alignment

Priority: P1 process blocker; required before the next runtime PR.

Scope:

- add one always-running `required-release-gate` workflow/job;
- make child-check selection explicit and fail closed;
- update workflow contract tests;
- change the GitHub main ruleset to require the aggregate context;
- keep current `release-rehearsal` behavior until replacement proof is green.

Verification:

- workflow syntax/contract tests;
- docs-only, frontend, backend, and cancelled-child scenario matrix;
- live GitHub ruleset readback;
- one proof PR showing the status on the latest head SHA.

Rollback: restore the previous ruleset context and workflow revision together.

### PR-A2 - Remove Duplicate Full Frontend Execution

Depends on: PR-A1.

Scope:

- choose root release as the canonical full release owner;
- make the standalone frontend workflow targeted or reusable instead of a
  second identical full-suite run;
- retain a post-merge verification decision explicitly rather than accidentally;
- record before/after run count and duration.

Verification:

- Playwright test list remains 371 or increases for intentional new tests;
- frontend release behavior remains included in the root release gate;
- one frontend-affecting proof PR has no duplicate merge-decision full run;
- npm audits remain clean.

Rollback: restore the standalone workflow trigger without changing tests.

### PR-A3 - E2E Timing And Safe Sharding

Depends on: PR-A2. Conditional on measured CI duration remaining above NFR-3.

Scope:

- measure per-file duration and shared-state assumptions;
- split only independent specs into stable shards or raise worker count safely;
- keep serial specs serial;
- preserve screenshots/traces on failure.

Stop if:

- tests depend on shared mutable preview state;
- flake rate rises;
- coverage equivalence cannot be demonstrated.

### Pilot-B1 - Controlled Pilot/Demo Evidence Pass

May run in parallel with PR-A1 because it changes no runtime behavior.

Scope:

- execute the five flows in Section 10;
- use real or approved assisted pilot personas/data;
- record sanitized evidence and finding classifications;
- close with a `runtime_fix`, `process_only`, or `no_runtime_change` decision.

Exit gate:

- every flow has evidence or is explicitly `blocked_external`;
- no finding lacks a severity and decision;
- P0 pauses the pilot; P1 creates one finding-specific spec; P2/P3 remain parked
  unless separately approved.

### PR-Cx - Finding-Specific Runtime Fix

Depends on: PR-A1 plus an approved P0/P1 finding from Pilot-B1.

Each finding gets its own spec and normally its own PR. Batch only findings with
the same surface, risk, verification, and rollback story.

Mandatory verification:

- reproduction test first;
- positive and negative role/scope coverage;
- affected frontend/backend/API checks;
- full required release gate;
- sanitized pilot readback after deploy when external evidence is needed.

### PR-D1 - Frontend Unit-Test Seed

Conditional: no active P0/P1 blocker, or a finding exposes repeated pure-logic
E2E cost.

Scope:

- select a runner compatible with the current Vite/TypeScript stack;
- cover two named pure-logic modules with fast tests;
- add the runner to CI;
- do not migrate the whole suite.

Candidate selection should favor high-churn pure logic such as Store My
Performance modeling or money/date normalization, not React rendering chosen
only for convenience.

### Measure-D2 - Critical Route Performance Baseline

Conditional: after Pilot-B1 or when a pilot device reports route-load friction.

Scope:

- record critical-route JS/CSS transfer, load timing, device/network profile,
  and interaction timing;
- compare localization, Clerk/session, Store My Performance, and global CSS
  chunks with observed user impact;
- open an optimization PR only when the measurement identifies a bottleneck.

No optimization PR is authorized by this measurement step alone.

### PR-E1 - Operating Documentation Drift Cleanup

Priority: P2 docs/process; independent of runtime work.

Scope:

- reconcile the active role list with `VISUAL_MERCHANDISER` behavior;
- inventory archive-dependent executable guards and name their canonical
  replacement source;
- migrate only the smallest safe first group;
- prohibit new historical archive dependencies.

### Gate-F1 - Broad Production Reopen Decision

Status: blocked external; no implementation PR is active.

Reopen only when the owner explicitly makes broad production the goal and can
provide or accept evidence for:

- persistent production Redis-compatible posture;
- incident policy and app-level error tracking;
- Supabase managed recovery/PITR/RPO/RTO;
- final protected persona and load proof after production config changes.

## 12. Dependency And Decision Graph

```text
PR-0 approved
  |-- PR-A1 required gate ----> PR-A2 dedupe ----> PR-A3 sharding (conditional)
  |                                  |
  |                                  +----> PR-D1 unit-test seed (conditional)
  |
  +-- Pilot-B1 evidence ---- P0/P1? ---- yes ----> PR-Cx finding spec/fix
  |                               |
  |                               no -----> keep runtime parked
  |
  +-- PR-E1 docs drift cleanup
  |
  +-- Measure-D2 only with observed performance question

Gate-F1 broad production remains blocked until explicit owner reopen.
```

## 13. Verification Ladder

Every plan PR:

```powershell
git diff --check
npm.cmd run test:scripts
npm.cmd run check:affected-verification
```

Then run every command selected by affected verification. CI/workflow changes
also require:

- YAML/workflow contract tests;
- live PR status readback;
- GitHub ruleset readback;
- latest-head SHA verification;
- cancellation/failure reasoning before merge.

Runtime finding PRs additionally require the finding-specific test matrix and
the root release gate. External claims require staging/provider evidence.

## 14. Risk Register

| Risk | Likelihood | Impact | Control |
| --- | --- | --- | --- |
| Required aggregate reports false success | Medium | High | Fail-closed child result evaluation and proof PR |
| CI speed work silently reduces coverage | Medium | High | Test-list baselines and no-removal rule |
| E2E sharding introduces flakes | Medium | Medium | Per-spec timing/state audit and rollback threshold |
| Pilot session cannot obtain real inputs | Medium | Medium | `blocked_external`; no invented evidence |
| Pilot finding expands into broad refactor | Medium | High | Finding-specific spec and one-story PR |
| Bundle work optimizes an unmeasured problem | High | Medium | Measurement-first gate |
| Production work starts from local evidence | Medium | High | Explicit owner reopen plus provider proof |
| Docs/process plan restarts code train indirectly | Medium | High | Runtime remains parked until Pilot-B1 P0/P1 |

## 15. Stop And Escalation Rules

Stop and request an owner decision when:

- the main ruleset must be changed but repository authority is missing;
- a runtime fix changes auth, API, DB, scoring, queue, import, provider, or
  workflow semantics beyond the finding-specific spec;
- the pilot cannot provide real/approved inputs;
- CI duration can be improved only by reducing behavior coverage;
- a performance threshold cannot be measured reproducibly;
- broad production, mobile implementation, a new module, or generic
  architecture work is proposed;
- workspace cleanup is mixed into any plan PR.

Recommended escalation format:

```text
Blocked on: requirement/PR ID
Decision needed: one concrete question
Option A / Option B: trade-offs
Recommendation: preferred option and reason
Impact: work that remains blocked
```

## 16. Definition Of Plan Completion

This plan is fully executed only when:

- PR-A1 is merged and live ruleset readback proves the truthful required gate;
- PR-A2 removes duplicate full frontend execution without coverage loss;
- PR-A3 either meets NFR-3 or records a justified no-change decision;
- Pilot-B1 covers every critical flow or records honest external blockers;
- every P0/P1 has a closed finding-specific spec/fix/evidence chain;
- no unapproved runtime train was opened;
- PR-E1 closes the active role drift and prevents new archive dependencies;
- broad production is either still explicitly No-Go or has a separate approved
  provider-backed reopen decision;
- `current-state.md` and control registries name the real next action.

Plan completion does not require building a mobile app, a new module, a broad
redesign, a provider adapter, or broad production.
