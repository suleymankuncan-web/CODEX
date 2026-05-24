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
| Add a future feature safely | `docs/plans/feature-integration-spine-v1.md` and `docs/plans/new-module-template.md` | Source-of-truth, auth, API, DB, workflow, operations, and rollback gates. |
| Inspect the system map | `docs/flows/README.md` | Generated frontend route, API, controller, and OpenAPI flow map. |

## Shelves

### Operating Shelf

Use for daily direction and working discipline.

- `current-state.md`
- `sokrates.md`
- `discipline.md`
- `docs/plans/project-control-board-v1.md`
- `docs/plans/decision-registry-v1.md`
- `docs/plans/runbook-registry-v1.md`
- `docs/plans/project-growth-execution-roadmap-v1.md`
- `docs/plans/active-next-actions.md`
- `docs/plans/project-debt-ledger.md`
- `docs/plans/project-progress-plan-v1.md`

### Pilot Shelf

Use for controlled staging/internal pilot work.

- `docs/plans/controlled-pilot-execution-roadmap-v1.md`
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
- `docs/plans/production-evidence-closure-joint-plan-v1.md`
- `docs/plans/production-staging-incident-response-skeleton.md`
- `docs/plans/p0-trust-operations-execution-v1.md`
- `docs/plans/p1-operator-support-execution-v1.md`
- `docs/plans/p2-product-intelligence-execution-v1.md`
- `docs/plans/performance-budget-v1.md`

### Architecture Shelf

Use for project shape, growth rules, API contracts, and system boundaries.

- `docs/plans/docs-library-metadata-standard-v1.md`
- `docs/plans/feature-integration-spine-v1.md`
- `docs/plans/new-module-template.md`
- `docs/plans/technical-debt-resolution-roadmap-v1.md`
- `docs/plans/refactor-completion-inventory-v1.md`
- `docs/plans/api-contract-drift-plan.md`
- `docs/plans/rules-config-boundary-decision-v1.md`
- `docs/flows/README.md`
- `docs/flows/store-ops-system-flow.html`
- `docs/flows/store-ops-system-flow.json`

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
