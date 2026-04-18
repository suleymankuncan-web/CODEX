# Growth-Ready Execution Plan

## Used Skills
- `project-context`
- `product-architect`
- `backend-architecture`
- `database-designer`
- `integration-architecture`
- `security-compliance`
- `performance-engineering`
- `testing-qa`
- `coding-standards`

## Goal
Evolve the current system from a solid first-phase backend into a growth-ready platform that starts well at 1000 users but does not block future scale.

## Guiding Principle
Build a modular monolith that is extraction-ready.

This means:
- clear module boundaries
- async jobs behind a queue abstraction
- idempotent write flows
- reporting isolated from operational reads
- authorization enforced at every scope boundary

## Phase 1: Runtime Hardening
Status: Current focus

Deliverables:
- PostgreSQL-backed backend runtime
- JWT-capable auth mode
- scoped RBAC guards
- DTO validation
- real import batch persistence
- real snapshot run persistence
- checklist execution flow

Exit criteria:
- app boots
- migrations run
- core endpoints respond with database-backed behavior

## Phase 2: Durable Async Infrastructure
Status: Next

Deliverables:
- BullMQ/Redis enabled as active queue backend
- dedicated workers for:
  - import materialization
  - snapshot generation
- retry, dead-letter, and job observability model

Exit criteria:
- imports and snapshots no longer depend on in-memory execution
- failed jobs can be retried safely

## Phase 3: Data Quality and Materialization Rules
Status: Next

Deliverables:
- stronger validation for incoming staging rows
- structured error classification
- assignment history import logic
- position/store/region mapping guards
- reconciliation reporting for import batches

Exit criteria:
- staging-to-ops flow is predictable, traceable, and safe against dirty source data

## Phase 4: Reporting API Surface
Status: Planned

Deliverables:
- read-only reporting endpoints for:
  - workforce gap
  - turnover
  - checklist compliance
  - KPI summary
- pagination and filtering
- scope-aware reporting access

Exit criteria:
- dashboard consumers can read `rpt.*` without touching operational tables

## Phase 5: Test and Operational Readiness
Status: Planned

Deliverables:
- integration tests for:
  - auth scope
  - import flow
  - snapshot flow
  - checklist flow
- health checks for DB and queue
- structured logs and request correlation IDs
- deployment-ready environment config

Exit criteria:
- backend is verifiable, observable, and supportable in production

## Recommendation
Immediate next build step:
1. Turn BullMQ on as the real queue backend
2. Add worker processes
3. Add first integration tests
4. Strengthen materialization rules for employee assignment history

This is the highest-value path because it closes the biggest gap between “good architecture” and “reliable production behavior”.
