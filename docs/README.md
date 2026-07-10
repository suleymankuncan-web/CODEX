# HR Axis / Store Ops Documentation Library

Status: active
Shelf: operating
Last verified: 2026-07-10

## Reader And Action

Reader:

- a new engineer, future agent, support operator, pilot moderator, or product
  owner who needs to find the right project document without reading the whole
  repository history.

After reading, they should be able to:

- choose the right starting document for the current job,
- tell active operating documents apart from historical evidence,
- avoid reopening parked work by accident,
- know which docs are source-of-truth shelves and which are supporting proof.

## Library Rule

Use this directory like an operating library, not a diary.

- Start with the active operating shelf.
- Move to the domain shelf only when you know the area.
- Use evidence files to prove a claim, not to choose direction by themselves.
- Treat old plans as historical unless an active operating document points to
  them.
- Do not use docs-only evidence to claim runtime, provider, auth, DB, or
  production readiness.

## Start Here

| Need | Start With | Why |
| --- | --- | --- |
| Continue work from a cold session | `current-state.md` | Short active handoff and latest safe direction. |
| Know how Codex should work here | `sokrates.md` and `discipline.md` | Decision quality, PR rhythm, verification, and stop rules. |
| See the current control board | `docs/plans/project-control-board-v1.md` | Current project mode, go/no-go board, and what is parked. |
| Execute the project-analysis findings | `docs/plans/project-analysis-implementation-plan-v1.md` | Owner-approved, evidence-gated sequence: CI truth is implemented; A3 p95 observation and B1 external pilot inputs remain pending. |
| Remediate the page, authorization, codebase, and database audit | `docs/plans/project-wide-audit-remediation-plan-v1.md` | Detailed spec-first PR train for route-role truth, session cache isolation, bounded target queues, UI correctness, data integrity, and production-gated resilience. |
| Correct transitive system-flow evidence | `docs/plans/system-flow-transitive-precision-spec-v1.md` | PR-8 contract for called exported wrappers, cycle/duplicate safety, preload exclusion, and honest target-cast deferral. |
| Preflight database invariants without mutation | `docs/plans/database-invariant-preflight-spec-v1.md` | PR-9 contract for read-only hierarchy, role scope, assignment overlap, target allocation, redaction, and safe-target evidence. |
| Implement session-scoped query cache isolation | `docs/plans/session-scoped-query-cache-isolation-spec-v1.md` | Approved PR-3 contract for effective-authorization fingerprinting, the public query allowlist, no-flash cache removal, renewal, logout, expiry, and same-context persona switching. |
| Bound target request queues | `docs/plans/bounded-target-request-queues-spec-v1.md` | Approved PR-4 contract for paged Admin Targets, a scoped Store request-center read model, bounded route prefetch, exact totals, and mutation non-change. |
| Align frontend business dates to Istanbul | `docs/plans/europe-istanbul-business-date-contract-spec-v1.md` | Approved PR-5 contract for date-only/month-only defaults, calendar arithmetic, midnight refresh behavior, and preservation of UTC timestamp instants. |
| Close active localization gaps | `docs/plans/active-surface-localization-closure-spec-v1.md` | Approved PR-6 contract for typed TR/EN ownership on Store Feed, Store Reports, and Admin Incentives while preserving source and technical values. |
| Establish keyboard and accessibility foundations | `docs/plans/keyboard-accessibility-foundation-spec-v1.md` | Approved PR-7 contract for native Master Data selection, protected-shell skip links, main focus targets, and a bounded axe seed. |
| Reconcile role-route or archive-guard drift | `docs/architecture/authorization-operating-truth-v1.json`, `docs/architecture/pilot-route-role-matrix.md`, and `docs/plans/archive-guard-migration-register-v1.md` | Source-derived complete route/preview drift, current human route policy, and the incremental rule for removing historical handoff guard dependencies. |
| Find an active decision | `docs/plans/decision-registry-v1.md` | Decision status, source document, and change trigger. |
| Choose an operating checklist | `docs/plans/runbook-registry-v1.md` | Repeatable runbooks, required input, output, and stop condition. |
| Execute the next growth tracks | `docs/plans/project-growth-execution-roadmap-v1.md` | Ordered plan for feedback, data quality, operations, coaching, auth preview, rules, workforce planning, and production ops. |
| Pick the next practical task | `docs/plans/active-next-actions.md` | Current working list and pilot-vs-production split. |
| Check whether a debt is open | `docs/plans/project-debt-ledger.md` | Closed debts, blocked dependencies, and strategic backlog. |
| Inspect workspace cleanup candidates | `docs/plans/workspace-hygiene-inventory-2026-07-09.md` | No-delete branch, worktree, remote-ref, and stash classification. |
| Reconstruct historical handoff/PR context | `docs/history/current-state-through-pr-913-2026-07-09.md` and `docs/history/operating-truth-alignment-plan-execution-2026-07-10.md` | Historical context that must not steer current work. |
| Run the controlled pilot loop | `docs/plans/controlled-pilot-execution-roadmap-v1.md` | Real session, feedback, blocker, and fix workflow. |
| Execute the pilot feedback PR train | `docs/plans/controlled-pilot-feedback-loop-pr-train-v1.md` | Feedback intake, P0/P1/P2/P3 triage, PR sequence, autonomy limits, and closeout criteria. |
| Check launch browser-session evidence | `docs/evidence/readiness/2026-06-12-browser-session-staging-evidence.md` and `docs/evidence/readiness/2026-06-12-security-launch-blocker-pr-train-closeout.md` | Local implementation is guarded and real Region Manager staging cookie-session proof passed; rerun with `npm.cmd --prefix admin-web run smoke:auth:staging:cookie-session`; broad production remains `No-Go`. |
| Prepare a pilot session | `docs/plans/controlled-pilot-preflight-checklist-v1.md` | Pre-pilot gate for parked items, personas, deploys, data/imports, Store/Admin surfaces, and Go/Conditional Go/No-Go. |
| Add a future feature safely | `docs/plans/feature-integration-spine-v1.md` and `docs/plans/new-module-template.md` | Source-of-truth, auth, API, DB, workflow, operations, and rollback gates. |
| Plan the separate mobile app | `docs/plans/mobile-app-discovery-v1.md` | Mobile V1 discovery for separate app scope, persona order, offline checklist posture, and prototype sequence. |
| Review Sales Target Incentive V1 | `docs/superpowers/plans/2026-06-17-sales-target-incentive-v1.md`, `docs/superpowers/plans/2026-06-19-incentive-region-manager-approval-flow-v1.md`, `docs/implementation/sales-target-incentive-v1-fixtures.md`, and `docs/evidence/sales-target-incentive-region-approval-flow-v1-closeout-2026-06-19.md` | Closed prim formula/snapshot line plus Region Manager approval-flow plan/closeout, locked money/period/rule fixtures, and visibility contract skeleton. |
| Modernize Store/Admin UI | `docs/process/product-experience-principles.md`, `docs/process/ui-surface-standard-v1.md`, `docs/process/ui-surface-recipes-v1.md`, and `docs/process/store-admin-surface-standardization-v1.md` | Product-quality standard plus concrete component, token, icon, copy, page-anatomy, reusable page recipe, and approved operational surface rhythm. |
| Split Store workforce from approvals | `docs/plans/store-workforce-and-approvals-split-v1-plan.md` | Active plan for `/store/workforce`, Norm Kadro ownership, and approvals becoming a request center. |
| Inspect the system map | `docs/flows/README.md` | Generated frontend route, API, controller, and OpenAPI flow map. |
| Continue UI pilot prototypes | `docs/prototypes/README.md` | Prototype shelf, Plum Glacier token set, login pilot references, and visual boundary rules. |

## Shelves

### Operating Shelf

Use for daily direction and working discipline.

- `current-state.md`
- `sokrates.md`
- `discipline.md`
- `docs/plans/project-control-board-v1.md`
- `docs/plans/decision-registry-v1.md`
- `docs/plans/runbook-registry-v1.md`
- `docs/plans/evidence-automation-index-v1.md`
- `docs/process/product-experience-principles.md`
- `docs/process/ui-surface-standard-v1.md`
- `docs/process/ui-surface-recipes-v1.md`
- `docs/process/store-admin-surface-standardization-v1.md`
- `docs/plans/project-growth-execution-roadmap-v1.md`
- `docs/plans/active-next-actions.md`
- `docs/plans/project-debt-ledger.md`
- `docs/plans/workspace-hygiene-inventory-2026-07-09.md`
- `docs/plans/project-progress-plan-v1.md`
- `docs/plans/store-workforce-and-approvals-split-v1-plan.md`
- `docs/plans/mobile-app-discovery-v1.md`
- `docs/contracts/store-page-qa-contract-v1.md`

### Pilot Shelf

Use for controlled staging/internal pilot work.

- `docs/plans/controlled-pilot-execution-roadmap-v1.md`
- `docs/plans/controlled-pilot-feedback-loop-pr-train-v1.md`
- `docs/plans/controlled-pilot-preflight-checklist-v1.md`
- `docs/plans/controlled-pilot-operating-checklist-v1.md`
- `docs/runbooks/pilot-daily-ops-runbook-v1.md`
- `docs/plans/pilot-access-matrix-v1.md`
- `docs/plans/clerk-persona-staging-evidence-runbook-v1.md`
- `docs/plans/pilot-persona-evidence-runbook-v1.md`
- `docs/evidence/pilot-readiness/2026-05-05-controlled-pilot-feedback-log.md`
- `docs/evidence/pilot-readiness/2026-05-23-store-action-command-live-proof-v1.md`

### Readiness And Operations Shelf

Use for release posture, broad-production No-Go/Go decisions, provider
evidence, incident posture, and recovery.

- `docs/evidence/readiness/2026-05-18-production-readiness-decision.md`
- `docs/evidence/readiness/2026-05-23-external-evidence-closure-decision-v1.md`
- `docs/evidence/readiness/2026-05-23-redis-production-posture-v1.md`
- `docs/evidence/readiness/2026-05-23-supabase-recovery-posture-v1.md`
- `docs/evidence/readiness/2026-05-23-alert-email-policy-decision-v1.md`
- `docs/evidence/readiness/2026-05-23-better-stack-email-alert-proof-v1.md`
- `docs/evidence/readiness/2026-06-12-browser-session-staging-evidence.md`
- `docs/evidence/readiness/2026-06-12-browser-session-staging-evidence-blocked.md`
- `docs/evidence/readiness/2026-06-12-security-launch-blocker-pr-train-closeout.md`
- `docs/plans/security-launch-blocker-pr-train-v1.md`
- `docs/plans/production-evidence-closure-joint-plan-v1.md`
- `docs/plans/production-staging-incident-response-skeleton.md`
- `docs/plans/operational-observability-review.md`
- `docs/plans/p0-trust-operations-execution-v1.md`
- `docs/plans/p1-operator-support-execution-v1.md`
- `docs/plans/p2-product-intelligence-execution-v1.md`
- `docs/plans/internal-change-visibility-operating-model-v1.md`
- `docs/plans/store-performance-replay-event-source-inventory-v1.md`
- `docs/plans/store-performance-replay-readonly-surface-spec-v1.md`
- `docs/plans/usage-performance-correlation-policy-v1.md`
- `docs/plans/p3-operating-triggers-v1.md`
- `docs/plans/performance-budget-v1.md`

### Architecture Shelf

Use for project shape, growth rules, API contracts, and system boundaries.

- `docs/plans/docs-library-metadata-standard-v1.md`
- `docs/plans/project-wide-audit-remediation-plan-v1.md`
- `docs/plans/session-scoped-query-cache-isolation-spec-v1.md`
- `docs/plans/bounded-target-request-queues-spec-v1.md`
- `docs/plans/europe-istanbul-business-date-contract-spec-v1.md`
- `docs/plans/active-surface-localization-closure-spec-v1.md`
- `docs/plans/keyboard-accessibility-foundation-spec-v1.md`
- `docs/plans/feature-integration-spine-v1.md`
- `docs/plans/new-module-template.md`
- `docs/plans/technical-debt-resolution-roadmap-v1.md`
- `docs/plans/refactor-completion-inventory-v1.md`
- `docs/architecture/authorization-operating-truth-v1.json`
- `docs/architecture/pilot-route-role-matrix.md`
- `docs/plans/archive-guard-migration-register-v1.md`
- `docs/superpowers/plans/2026-06-17-sales-target-incentive-v1.md`
- `docs/implementation/sales-target-incentive-v1-fixtures.md`
- `docs/plans/api-contract-drift-plan.md`
- `docs/plans/rules-config-boundary-decision-v1.md`
- `docs/flows/README.md`
- `docs/flows/store-ops-system-flow.html`
- `docs/flows/store-ops-system-flow.json`

### Prototype Shelf

Use for visual exploration artifacts and UI pilot references that are not
production source by themselves.

- `docs/prototypes/README.md`
- `docs/prototypes/plum-glacier-token-set-v1.md`
- `docs/prototypes/login-pilot-v3.html`
- `docs/prototypes/assets/hr-axis-06-assets.md`

### Domain Shelf

Use after choosing a product/domain area. This shelf is intentionally a map, not
a second source of truth.

| Domain | Current Source Documents |
| --- | --- |
| Auth and authorization | `docs/domains/auth.md` |
| Store Action | `docs/domains/store-action.md` |
| Import and master data | `docs/domains/import-master-data.md` |
| Reporting and KPI | `docs/domains/reporting-kpi.md` |
| Workforce | `docs/domains/workforce.md` |
| Readiness and operations | `docs/domains/readiness-ops.md` |
| Competition | `docs/plans/competition-repository-boundary-inventory-v1.md`, `docs/plans/stage-builder-form-risk-review-2026-04-30.md` |

### Evidence Shelf

Use to verify claims. Evidence files are not automatically active direction.

- Start with `docs/evidence/README.md`.
- `docs/evidence/store-page-qa-contract-v1/` for Store Page QA Contract
  mocked/live/deferred coverage mode and PR preflight evidence.
- `docs/evidence/pilot-readiness/` for pilot sessions, route checks, and pilot
  decisions.
- `docs/evidence/readiness/` for release, provider, alert, Redis, restore, and
  production-posture evidence.
- `docs/evidence/system-flow/` for route/API/system-flow evidence.
- `docs/evidence/product-progress/` for product-readiness and UX evidence.
- `docs/evidence/performance/` for performance snapshots and budgets.

### Historical Planning Shelf

Use only when an active document points there or when reconstructing why a
decision exists.

- `docs/superpowers/plans/`
- `docs/superpowers/specs/`
- older `docs/plans/phase-*` docs
- superseded readiness and preflight notes
- `docs/history/current-state-through-pr-913-2026-07-09.md`
- `docs/history/operating-truth-alignment-plan-execution-2026-07-10.md`

## Status Vocabulary

Use these labels when adding or updating important docs:

- `active`: current source for decisions or execution.
- `guarded`: active and protected by tests or release checks.
- `closed`: completed, useful as reference, not the next task.
- `parked`: intentionally not active until a trigger appears.
- `blocked_external`: needs real provider, token, data, or owner input.
- `superseded`: replaced by a newer decision.
- `historical`: kept for reconstruction, not for direction.

## How To Add A New Document

1. Decide which shelf owns it.
2. Name the reader and action at the top.
3. State whether it is active, closed, parked, blocked, superseded, or
   historical.
4. Link it from this library only if a future reader should start from it.
5. Link it from `current-state.md` only if it changes active handoff context.
6. Link it from `docs/plans/active-next-actions.md` only if it changes the next
   practical work.
7. Add a script guard only when drift would create real confusion, not for every
   note.

Metadata details live in `docs/plans/docs-library-metadata-standard-v1.md`.

## Current Direction

The active sequence is:

- preserve A1/A2's truthful single-owner release gate behavior,
- observe A3's next ten successful root-release runs before declaring its p95
  outcome,
- obtain safe B1 inputs before executing any fresh pilot flow,
- use a factual pilot/demo P0/P1 finding first if one arrives,
- keep broad production, separate mobile implementation, broad redesign, new
  modules, provider/source integrations, and generic architecture work parked
  until evidence plus an explicit owner decision reopen them.

Broad production remains separate from the controlled pilot and is still a
No-Go until the remaining provider, recovery, Redis, and incident posture
decisions are accepted or proven.

When no real or assisted pilot feedback is available, do not reopen the local
Security Launch Blocker PR Train V1. That implementation and guard train is
closed in
`docs/evidence/readiness/2026-06-12-security-launch-blocker-pr-train-closeout.md`.
Real Region Manager staging cookie-session evidence passed in
`docs/evidence/readiness/2026-06-12-browser-session-staging-evidence.md`;
the earlier blocked attempt remains historical context in
`docs/evidence/readiness/2026-06-12-browser-session-staging-evidence-blocked.md`.
Do not claim broad production readiness from this auth proof.
