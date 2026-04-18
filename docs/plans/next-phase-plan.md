# Next Phase Plan

## Used Skills
- `project-context`
- `product-architect`
- `backend-architecture`
- `database-designer`
- `security-compliance`
- `performance-engineering`
- `testing-qa`
- `coding-standards`

## Goal
Turn the current database-first architecture pack into a runnable backend with protected APIs, async workers, and validated reporting.

## Phase 1: Runtime Foundation
- Keep `NestJS` as the primary runtime
- Wire PostgreSQL connection and migration runner
- Add structured logging, config validation, and request correlation IDs

## Phase 2: Auth and RBAC
- Implement authentication provider integration
- Implement scoped authorization middleware/guards
- Enforce company/region/store visibility in every query path

## Phase 3: Core Modules
- Organization query APIs
- Workforce planning and active headcount APIs
- Checklist template and instance APIs
- KPI target and actual ingestion APIs

## Phase 4: Async Processing
- Implement import batch command endpoint
- Add worker queue for staging materialization
- Add snapshot generation worker and scheduler

## Phase 5: Reporting
- Add read-only snapshot APIs
- Add turnover, headcount gap, and compliance summary endpoints
- Prepare dashboard-friendly response contracts

## Phase 6: Quality Gate
- Unit tests for validation and authorization
- Integration tests for imports and snapshots
- Performance tests for large batch ingestion and snapshot generation
- Security review for audit completeness and data isolation

## Recommendation
- For 1000 personnel / 1000 users, keep a modular monolith.
- Use `NestJS` as primary runtime, PostgreSQL as primary store, and async workers for imports/snapshots.
- Keep `.NET` skeleton as parity reference only unless corporate standards require a stack switch.
