# New Module Template

## Purpose
Use this template before adding any new business capability such as:
- prim / incentive management
- new KPI families
- new workforce rules
- approval flows
- new integration-fed domains

This template exists to keep the system easy to extend, easy to change later, and safe for backward-looking analysis.

## Core Rule
No new module or major feature starts with code first.

The minimum order is:
1. operating mode decision
2. mini spec
3. bounded context decision
4. source-of-truth decision
5. data placement decision
6. auth/read-scope/action-scope decision
7. API surface
8. workflow/inbox/audit impact
9. operations/reporting/UI impact
10. verification ladder
11. implementation

Use this template together with
[feature-integration-spine-v1.md](./feature-integration-spine-v1.md). The
spine defines which gates are mandatory for every meaningful feature and which
gates apply only when the feature touches API, auth, workflow, audit,
operations, UI, localization, DB, or external providers.

Do not turn this template into ceremony for trivial fixes. Do use it for any
feature that changes product behavior, routes, workflow, data ownership,
permissions, API contracts, operational state, or future module boundaries.

## Feature Integration Spine Gate

### Operating Mode
- `bugfix`
- `docs-only`
- `refactor`
- `read-only feature`
- `write feature`
- `workflow feature`
- `external integration`

### Owner And Lifecycle
- Owner:
- Status: `intake` / `shaping` / `planned` / `active` / `parked` /
  `deprecated` / `retired`
- Completion boundary:
- Park or retire trigger:

### Blast Radius Budget
Mark each central junction this feature touches:

- [ ] Auth / read scope / action scope
- [ ] API / OpenAPI / generated client
- [ ] Workflow inbox
- [ ] Audit catalog
- [ ] DB schema or migration
- [ ] Reporting / KPI / snapshot interpretation
- [ ] Operations / telemetry
- [ ] Route / navigation shell
- [ ] Localization / user-facing copy
- [ ] External provider / upload / queue / live evidence

If three or more are checked, write a short blast-radius decision before
implementation or split the work.

## Module Header

### Feature Name
- Example: `prim-module`

### Business Goal
- What business problem does this solve?
- Who needs it?
- What decision or operation becomes possible after this feature exists?

### In Scope
- List what this feature must do now.

### Out of Scope
- List what this feature explicitly will not do in this phase.

## Domain Boundary

### Bounded Context
- Which module owns this feature?
- Is it a new module or an extension of an existing one?
- Why does it belong there?

### Source Of Truth
- Which domain, table, external source, or snapshot is authoritative?
- Which neighboring domains may be read but not reinterpreted?
- What must not become a second source of truth?

### Neighbor Modules
- Which existing modules can read from it?
- Which existing modules can command or mutate it?
- What must remain isolated?

### Ownership Rule
- Name the single owning module.
- Avoid splitting write ownership across multiple modules.

## Data Placement

### Operational Data
- Does it need new `ops.*` tables?
- What are the core write models?
- Which records are mutable and which should be versioned?

### Integration Data
- Does it accept external imports?
- If yes, what new `stg.*` tables are needed?
- What is the idempotency key or duplicate protection strategy?

### Reporting Data
- Does it appear in reporting or dashboards?
- If yes, what new `rpt.*` snapshot tables or snapshot fields are needed?
- Can reporting remain immutable?

### Audit Data
- Which actions must write to `audit.event_log` or change history?
- Which fields are sensitive and must always be traceable?

## Change Strategy

### Future Change Expectations
- What is likely to change later?
- rates / thresholds / formulas / approval steps / role rules / scope rules

### Safe Evolution Design
- Which parts should be config-driven?
- Which parts should be versioned instead of overwritten?
- Which records need effective dates or history rows?

### Backward Operations
- Can we answer:
  - who changed it
  - when it changed
  - what the previous value was
  - which snapshot/report was affected
- If not, redesign before implementation.

## Access Model

### Roles
- Which roles can create, update, approve, retry, cancel, or only view?

### Scope
- Is access `company`, `region`, or `store` scoped?
- What is the minimum scope required for each command and read?
- Does the feature need read scope, action scope, or both?
- What foreign-scope or forbidden case proves access stays narrow?

### Sensitive Actions
- Which actions require stronger audit or governance?
- Example: payout approval, KPI rule change, retroactive recalculation

## API Surface

### Commands
- List create/update/delete/approve/retry/recalculate endpoints.

### Reads
- List detail/list/summary/overview/errors/audit endpoints.

### Response Shape
- Should it return:
  - command envelope
  - `items + meta`
  - detail object
  - admin overview card payload

### Validation Rules
- Required fields
- semantic conflicts
- retry rules
- state machine rules

### OpenAPI / Generated Client
- Will this add or change OpenAPI schemas?
- Which generated client/wrapper consumes it?
- Is the response shape additive or intentionally changed?
- What check proves generated types stay current?

## Operational Workflow

### Happy Path
- Describe the normal lifecycle from create/import to final state.

### Failure Path
- What can fail?
- Which failures are validation failures?
- Which failures are retryable?
- Which failures require manual review?

### Reprocessing
- Can the feature be retried or recalculated?
- Is rerun immutable?
- Do we create a new run/version instead of overwriting old output?

## Workflow, Inbox, And Audit

### Workflow Type
- Is this an `approval`, `acknowledgement`, `task`, `notification`, or no
  workflow item?

### Inbox Contract
- Does this feature create inbox items?
- Which source type owns the item?
- What is the primary action and deep link?
- Which source status maps to `needs_attention`, `completed`, or
  `informational`?

### Audit Contract
- Which commands write audit events?
- What is the event name?
- What is the target entity?
- Which fields or reasons must be traceable?

## Reporting And Analytics

### Dashboard Impact
- Does this feature need summary cards, trend charts, queue views, or drill-down tables?

### Operations Impact
- Does it belong in the Operations Control Tower?
- Is the tower showing only summary/link/status, or is this accidentally moving
  source workflow detail into operations?
- Is the signal live, planned, stale, failed, or external-input blocked?

### Snapshot Impact
- Should it be represented in snapshots?
- At what grain:
  - employee
  - store
  - region
  - company
  - period

### Metric Definitions
- Define formulas in plain language before coding.
- Define whether metrics are raw, derived, or adjusted.

## UI Impact

### Admin UI
- Which admin screens are needed?
- create form
- list
- detail
- audit
- needs-action

### Reporting UI
- Which dashboards or read-only screens consume this feature?

### UX Safety
- Which actions are destructive, high-risk, or irreversible?
- What confirmation, warnings, or diff previews are needed?

### Route And Navigation
- Which shell owns the route: admin, store, auth, or mobile?
- Is navigation visible by default or contextual?
- Does the route need loading, empty, error, unauthorized, and recovery states?

### Localization
- Is there user-facing copy?
- Which workflow/status terms must stay canonical in Turkish and English?

## Data Model Checklist
- [ ] `ops/stg/rpt/audit` placement is explicit
- [ ] table ownership is clear
- [ ] foreign keys and uniqueness rules are defined
- [ ] idempotency/duplicate handling is defined
- [ ] versioning/history decision is explicit
- [ ] audit requirements are explicit
- [ ] retry/reprocess behavior is explicit
- [ ] source of truth is explicit
- [ ] second-source-of-truth risk is addressed

## Engineering Checklist
- [ ] module ownership decided
- [ ] DTOs and validation rules defined
- [ ] service boundary defined
- [ ] repository/query ownership defined
- [ ] tests planned
- [ ] docs impact identified
- [ ] migration strategy identified
- [ ] operating mode selected
- [ ] blast radius budget checked
- [ ] OpenAPI/generated client impact planned, if any
- [ ] workflow/inbox adapter impact planned, if any

## Testing Checklist
- [ ] unit tests for rule logic
- [ ] integration tests for happy path
- [ ] integration tests for failures
- [ ] authorization/scope tests
- [ ] audit visibility tests
- [ ] snapshot/reporting tests if applicable
- [ ] negative/foreign-scope tests for commands
- [ ] OpenAPI/client checks if API is touched
- [ ] targeted frontend E2E if a user-facing surface changes

## Rollout Checklist
- [ ] migration order defined
- [ ] seed/reference data impact checked
- [ ] backward compatibility checked
- [ ] observability/logging added
- [ ] admin operations documented
- [ ] release verification scenario added if needed

## Mini Spec Template

### Feature
-

### Operating Mode
-

### Why
-

### Owner Module
-

### Lifecycle
-

### Source Of Truth
-

### Data Placement
- `ops`:
- `stg`:
- `rpt`:
- `audit`:

### Blast Radius
-

### Commands
-

### Reads
-

### Roles, Read Scope, And Action Scope
-

### Workflow / Inbox
-

### Audit
-

### Retry / Rerun / History
-

### Reporting Impact
-

### Operations Impact
-

### UI Impact
-

### Localization Impact
-

### Verification Ladder
-

### Risks
-

### Phase 1 Delivery
-

## Review Gate
Before coding starts, confirm these:
- Is the feature in the correct bounded context?
- Are all writes owned by one module?
- Is the source of truth clear?
- Is operational data separated from reporting data?
- Are read scope and action scope separated when needed?
- Are workflow and inbox semantics explicit?
- Are audit requirements explicit for commands?
- Is the blast radius small enough for one PR?
- Can future changes happen without rewriting unrelated modules?
- Can we trace and explain backward changes later?

If any answer is "no" or "unclear", do not implement yet. Refine the mini spec first.
