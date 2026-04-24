# Schema Expansion Guidelines

## Purpose
This document defines when the current schema model is sufficient and when a new schema should be introduced.

The goal is to avoid two opposite mistakes:
- adding schemas too early and creating artificial complexity
- keeping everything in existing schemas until boundaries become muddy

## Current Core Model
The current default data-layer model is:
- `ops`
- `stg`
- `rpt`
- `audit`

## Default Rule
Assume the current four-schema model is enough unless there is a clear reason to expand it.

Do **not** add a new schema just because:
- a feature is new
- a module sounds important
- a table count is growing
- it “might be useful later”

New schemas should be added only when they create a real boundary that improves ownership, clarity, or operational safety.

## What Each Existing Schema Owns

### `ops`
Use for:
- live operational state
- transactional business entities
- active rule-bearing records
- user-facing write models

Examples:
- users
- role assignments
- checklist instances
- source definitions
- active domain entities

### `stg`
Use for:
- inbound raw or semi-processed external data
- import staging rows
- temporary data awaiting validation/materialization

Examples:
- imported employee rows
- imported KPI rows
- staging validation results

### `rpt`
Use for:
- snapshot-based reporting models
- read-optimized denormalized views
- reporting outputs derived from operational truth

Examples:
- workforce snapshot rows
- KPI snapshot rows
- checklist snapshot rows
- turnover snapshot rows

### `audit`
Use for:
- immutable event trace
- who changed what
- correlation and source tracking
- action history needed for investigation

Examples:
- auth mutation audit
- import retry audit
- snapshot rerun audit

## When A New Schema Is Justified
Add a new schema only if at least one of these becomes true in a meaningful way.

### 1. Ownership Boundary Is No Longer Clear
If a family of tables has its own lifecycle, operational behavior, and stewardship, and does not fit cleanly into `ops`, `stg`, `rpt`, or `audit`, a new schema may be justified.

### 2. Operational Characteristics Are Different Enough
If a data family needs clearly different:
- retention behavior
- growth expectations
- cleanup policy
- write/read pattern
- access policy

then separating it may be worth it.

### 3. The Existing Schema Meaning Starts To Blur
If keeping a table in an existing schema would weaken the meaning of that schema, a new schema may be the cleaner choice.

Example:
- if a table is not operational truth, not staging, not reporting, and not audit, forcing it into one of those may create long-term confusion.

### 4. Cross-Module Rules Become Configuration-Heavy
If the project gains many:
- policy tables
- scoring rules
- thresholds
- approval routing rules
- incentive rules

then a dedicated config/rules schema may become justified.

## Likely Future Candidate Schemas

### `cfg`
Possible use:
- configuration and business rule ownership

Introduce only if:
- rule tables begin to grow into a real subsystem
- many modules depend on shared configurable policies
- incentive / KPI / approval logic becomes heavily parameterized

Do not introduce just for:
- a few lookup tables
- a handful of settings
- small reference lists

### `wrk` or `job`
Possible use:
- worker runtime and orchestration history

Introduce only if:
- queue/job state becomes a first-class operational domain
- retry orchestration requires dedicated long-lived records
- worker visibility starts to deserve its own stewardship

Do not introduce just for:
- a few queue helper tables
- temporary implementation convenience

### `ref`
Possible use:
- stable shared reference/master data

Introduce only if:
- reference data becomes large, shared, and independently managed
- many modules depend on it but none should own it operationally

Do not introduce just for:
- normal app lookups that comfortably live in `ops`

## Decision Rules
Before adding a schema, answer:
- why can this not live clearly in `ops`, `stg`, `rpt`, or `audit`?
- what boundary does the new schema create?
- who owns it?
- what retention/read/write pattern makes it different?
- what future confusion does it prevent?

If those answers are weak, do not add the schema.

## Strong “Do Not Expand Yet” Signals
Stay within the current model if:
- the feature is still early
- only a few tables are involved
- ownership is still obvious
- the new data is clearly operational, staging, reporting, or audit data
- the push for a new schema is mostly aesthetic

## Strong “Expand Now” Signals
Consider expansion if:
- multiple modules are fighting over ownership
- one schema is accumulating mixed-purpose tables
- cleanup/retention rules are clearly different
- new rule/config tables are becoming a subsystem of their own
- worker/runtime history is growing into an operational product surface

## Current Recommendation
For the current project state:
- keep `ops / stg / rpt / audit` as the active default
- do not add a new schema yet
- watch most closely for future emergence of:
  - `cfg`
  - `wrk`

## Relationship To Other Planning Docs
Use this together with:
- [request-intake-and-decision-policy.md](./request-intake-and-decision-policy.md)
- [cross-module-integration-principles.md](./cross-module-integration-principles.md)
- [new-module-template.md](./new-module-template.md)

## Practical Outcome
This guideline should keep the system:
- readable
- modular
- slower to rot
- easier to expand without unnecessary fragmentation
