# Post-Alignment Execution Phases

## Purpose
Translate the domain blueprint and architecture alignment work into a practical delivery sequence.

Companion review:
- [project-gap-analysis-and-roadmap.md](./project-gap-analysis-and-roadmap.md)

## Phase 1. Target Flow Hardening
Goal:
- turn the first real write flow into a stable baseline

Includes:
- store request form UX cleanup
- stronger client-side validation
- submit success feedback
- approval history visibility
- seed/demo verification

Outcome:
- `targets + approval` becomes the reference implementation for future write flows

## Phase 2. Checklist Acknowledgement
Goal:
- introduce acknowledgement as a first-class workflow type

Includes:
- checklist receipt surface
- seen/accepted action
- acknowledgement history
- store-side inbox presence
- demo seed and migration verification

Outcome:
- approval and acknowledgement are no longer mixed conceptually
- `/store/checklists` becomes the reference acknowledgement queue

## Phase 3. Shared Inbox Shape
Goal:
- unify action surfaces

Includes:
- approval items
- acknowledgement items
- KPI exception hooks
- common urgency and status language
- preflight alignment:
  - [phase-3-shared-inbox-preflight.md](./phase-3-shared-inbox-preflight.md)
- initial execution:
  - backend shared inbox endpoint
  - contract-based store task queue
  - demo pending acknowledgement seed
  - demo `off_track` KPI snapshot seed

Outcome:
- future flows stop inventing custom queue behavior

## Phase 4. Target Detail And Revision
Goal:
- deepen the first workflow after the baseline stabilizes

Includes:
- request detail page
- richer approval notes
- revision request path
- audit-friendly history timeline

## Phase 5. People Lifecycle Foundation
Goal:
- open the next major operational domain

Includes:
- onboarding
- offboarding
- transfer and reassignment shape
- promotion and position change model

## Phase 6. Performance, Incentives, Challenges
Goal:
- connect visibility and motivation layers after workflow foundation is stable

Includes:
- normalized performance views
- incentive visibility
- reward catalog direction
- challenge and points direction
- KPI domain direction:
  - [kpi-domain-framework.md](./kpi-domain-framework.md)
  - KPI execution path:
    - [kpi-execution-roadmap.md](./kpi-execution-roadmap.md)
  - Nebim ingest and normalization path:
    - [nebim-ingestion-and-normalization-plan.md](./nebim-ingestion-and-normalization-plan.md)

## Recommended Rule
- do not start a new large domain before the current phase has a usable baseline
- prefer one stable pattern over three half-finished patterns
### Daily Closure Start
- daily closure status route added:
  - `GET /snapshots/daily-closure`
- daily closure queue command added:
  - `POST /snapshots/daily-closure/run`
- admin snapshot dashboard now shows:
  - yesterday closure date
  - current closure state
  - queue action / existing run link
- current behavior:
  - closes yesterday in `Europe/Istanbul`
  - reuses existing completed/in-progress runs as no-op
  - blocks new queueing when a failed daily run already exists

### Daily Closure Automation
- backend automation backbone added
- config keys:
  - `DAILY_CLOSURE_AUTOMATION_ENABLED`
  - `DAILY_CLOSURE_POLL_MINUTES`
  - `DAILY_CLOSURE_ACTOR_USER_ID`
- automation behavior:
  - polls daily closure status on interval
  - queues only when closure state is `ready`
  - leaves completed/in-progress closures untouched
  - leaves failed closures to rerun flow
