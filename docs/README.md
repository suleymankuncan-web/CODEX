# HR Axis / Store Ops Documentation Library

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
| Find an active decision | `docs/plans/decision-registry-v1.md` | Decision status, source document, and change trigger. |
| Choose an operating checklist | `docs/plans/runbook-registry-v1.md` | Repeatable runbooks, required input, output, and stop condition. |
| Execute the next growth tracks | `docs/plans/project-growth-execution-roadmap-v1.md` | Ordered plan for feedback, data quality, operations, coaching, auth preview, rules, workforce planning, and production ops. |
| Pick the next practical task | `docs/plans/active-next-actions.md` | Current working list and pilot-vs-production split. |
| Check whether a debt is open | `docs/plans/project-debt-ledger.md` | Closed debts, blocked dependencies, and strategic backlog. |
| Run the controlled pilot loop | `docs/plans/controlled-pilot-execution-roadmap-v1.md` | Real session, feedback, blocker, and fix workflow. |
| Execute the pilot feedback PR train | `docs/plans/controlled-pilot-feedback-loop-pr-train-v1.md` | Feedback intake, P0/P1/P2/P3 triage, PR sequence, autonomy limits, and closeout criteria. |
| Check launch browser-session evidence | `docs/evidence/readiness/2026-06-12-browser-session-staging-evidence.md` and `docs/evidence/readiness/2026-06-12-security-launch-blocker-pr-train-closeout.md` | Local implementation is guarded and real Region Manager staging cookie-session proof passed; rerun with `npm.cmd --prefix admin-web run smoke:auth:staging:cookie-session`; broad production remains `No-Go`. |
| Add a future feature safely | `docs/plans/feature-integration-spine-v1.md` and `docs/plans/new-module-template.md` | Source-of-truth, auth, API, DB, workflow, operations, and rollback gates. |
| Execute Sales Target Incentive V1 | `docs/superpowers/plans/2026-06-17-sales-target-incentive-v1.md` and `docs/implementation/sales-target-incentive-v1-fixtures.md` | Active prim PR train, locked money/period/rule fixtures, and visibility contract skeleton. |
| Modernize Store/Admin UI | `docs/process/product-experience-principles.md` | Product-quality standard for clean but premium, operationally honest UI work. |
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
- `docs/plans/project-growth-execution-roadmap-v1.md`
- `docs/plans/active-next-actions.md`
- `docs/plans/project-debt-ledger.md`
- `docs/plans/project-progress-plan-v1.md`
- `docs/plans/store-workforce-and-approvals-split-v1-plan.md`

### Pilot Shelf

Use for controlled staging/internal pilot work.

- `docs/plans/controlled-pilot-execution-roadmap-v1.md`
- `docs/plans/controlled-pilot-feedback-loop-pr-train-v1.md`
- `docs/plans/controlled-pilot-operating-checklist-v1.md`
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
- `docs/plans/feature-integration-spine-v1.md`
- `docs/plans/new-module-template.md`
- `docs/plans/technical-debt-resolution-roadmap-v1.md`
- `docs/plans/refactor-completion-inventory-v1.md`
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

The active direction is controlled pilot execution:

- run scoped sessions,
- record feedback,
- classify P0/P1/P2/P3,
- fix concrete blockers,
- keep broad production, broad redesign, and new modules behind explicit
  decisions.

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
