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
1. mini spec
2. bounded context decision
3. data placement decision
4. API surface
5. admin operations
6. reporting impact
7. UI impact
8. implementation

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

## Reporting And Analytics

### Dashboard Impact
- Does this feature need summary cards, trend charts, queue views, or drill-down tables?

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

## Data Model Checklist
- [ ] `ops/stg/rpt/audit` placement is explicit
- [ ] table ownership is clear
- [ ] foreign keys and uniqueness rules are defined
- [ ] idempotency/duplicate handling is defined
- [ ] versioning/history decision is explicit
- [ ] audit requirements are explicit
- [ ] retry/reprocess behavior is explicit

## Engineering Checklist
- [ ] module ownership decided
- [ ] DTOs and validation rules defined
- [ ] service boundary defined
- [ ] repository/query ownership defined
- [ ] tests planned
- [ ] docs impact identified
- [ ] migration strategy identified

## Testing Checklist
- [ ] unit tests for rule logic
- [ ] integration tests for happy path
- [ ] integration tests for failures
- [ ] authorization/scope tests
- [ ] audit visibility tests
- [ ] snapshot/reporting tests if applicable

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

### Why
-

### Owner Module
-

### Data Placement
- `ops`:
- `stg`:
- `rpt`:
- `audit`:

### Commands
-

### Reads
-

### Roles And Scope
-

### Retry / Rerun / History
-

### Reporting Impact
-

### UI Impact
-

### Risks
-

### Phase 1 Delivery
-

## Review Gate
Before coding starts, confirm these:
- Is the feature in the correct bounded context?
- Are all writes owned by one module?
- Is operational data separated from reporting data?
- Can future changes happen without rewriting unrelated modules?
- Can we trace and explain backward changes later?

If any answer is "no" or "unclear", do not implement yet. Refine the mini spec first.
