# Admin Dashboard Phase 1

## Goal
Create the first admin-facing UI slice that makes the current backend operationally usable without manual API exploration.

This phase is not a full product UI. It is the first visibility and control layer over the existing backend.

## Why This First
- The backend already exposes meaningful admin and reporting surfaces.
- Operators need visibility before we add more business modules.
- A dashboard will show where current contracts are strong and where future modules need expansion.
- Future features such as incentive management and KPI expansion will plug into this admin surface more cleanly if the base layout already exists.

## Phase 1 Scope

### In Scope
- integration overview dashboard
- import batch needs-action queue
- import batch detail view
- snapshot overview dashboard
- snapshot needs-action queue
- reporting summary page
- basic auth/integration/snapshot lookup consumption where useful for filters

### Out Of Scope
- full design system
- public-facing UI
- incentive / prim screens
- KPI rule authoring UI
- advanced charts beyond operational summaries
- create/edit forms for every admin entity

## Primary Users
- `INTEGRATION_ADMIN`
- `SNAPSHOT_OPERATOR`
- `SUPER_ADMIN` for orientation and verification
- secondary read users for reporting visibility

## Core Screens

### 1. Integration Dashboard
Purpose:
- show batch totals, health totals, latest pointers, and needs-action items

Key data:
- `GET /api/integrations/import-batches/overview`
- `GET /api/integrations/import-batches/needs-action`

Key UI blocks:
- summary cards
- health/action cards
- latest batch pointers
- action queue table

### 2. Import Batch Detail
Purpose:
- inspect one batch deeply without leaving the admin UI

Key data:
- `GET /api/integrations/import-batches/:batchId`
- `GET /api/integrations/import-batches/:batchId/reconciliation`
- `GET /api/integrations/import-batches/:batchId/errors`
- `GET /api/integrations/import-batches/:batchId/audit`

Key UI blocks:
- header/status summary
- row status summary
- dependency and retry guidance
- reconciliation totals/rates
- row-level errors table
- audit timeline

### 3. Snapshot Operations Dashboard
Purpose:
- show snapshot health, rerun pressure, and latest run visibility

Key data:
- existing snapshot overview and needs-action endpoints
- snapshot run detail/dependencies/lineage as needed

Key UI blocks:
- summary cards
- in-progress / stuck / failed visibility
- rerun governance visibility
- latest run table

### 4. Reporting Summary
Purpose:
- provide a thin read-only summary over reporting outputs already produced by snapshot data

Key data:
- `GET /api/reports/summary`
- optional drill-down links to workforce, KPI, checklist, turnover reports

Key UI blocks:
- summary cards
- latest completed snapshot context
- quick links to reporting tables

## UX Rules
- prioritize operational clarity over visual complexity
- make states obvious: healthy, in progress, blocked, retry ready, needs action, stuck
- every queue item should show the next likely operator action
- detail screens should answer:
  - what happened
  - what failed
  - can it be retried now
  - what should happen next

## Data And Architecture Rules
- frontend must consume existing contracts first
- avoid inventing new backend endpoints unless the UI proves a contract gap
- no direct coupling between UI and database assumptions
- preserve bounded contexts in navigation and data fetching

## Suggested Information Architecture
- `/admin/integrations`
- `/admin/integrations/:batchId`
- `/admin/snapshots`
- `/admin/snapshots/:snapshotRunId`
- `/admin/reports`

## Acceptance Criteria
- operators can identify blocked, retry-ready, and stuck import work from UI
- operators can open one import batch and understand reconciliation, errors, and retry posture
- operators can see snapshot operational health without querying APIs manually
- operators can see reporting summary and latest snapshot context
- no new backend contract is required for the first pass unless a real UI blocker is discovered

## Risks
- backend contracts may be technically complete but operationally awkward in UI
- if the first dashboard tries to cover too many modules, it will become a generic admin shell instead of a useful tool
- if we skip state modeling in the UI, operational queues will feel noisy and confusing

## Recommended Delivery Order
1. Integration dashboard
2. Import batch detail
3. Snapshot dashboard
4. Reporting summary page

## Next Step After This Phase
Once this first dashboard exists, decide the next build path based on what becomes most valuable:
- incentive / prim module
- KPI expansion pack
- stronger enterprise security and identity integration
- deeper reporting and analytics UI
