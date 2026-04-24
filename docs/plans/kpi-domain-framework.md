# KPI Domain Framework

## Purpose
Define how KPI data should behave inside the product so metrics do not remain passive dashboard rows.

The guiding rule:
- a KPI can be observed
- a KPI can raise attention
- a KPI can trigger action
- only some KPI situations should escalate into workflow

## KPI Roles In The Product

### 1. Observe
Used by leadership and regional oversight roles.

Typical consumers:
- deputy general manager
- regional manager
- head office functions

Typical behavior:
- read-only
- compare trend
- compare region vs store
- compare store vs employee
- no immediate workflow required

Examples:
- monthly sales trend
- average basket size
- turnover rate overview

### 2. Attention Signal
Used when a KPI is drifting and needs human awareness.

Typical behavior:
- status band such as `at_risk` or `off_track`
- visible in store or manager surfaces
- may enter shared inbox as a `task`
- still not a formal approval by itself

Examples:
- store sales below threshold
- audit compliance dropped below safe band
- headcount gap crossed alert threshold

### 3. Workflow Trigger
Used when KPI deterioration should lead to an operational action.

Typical behavior:
- creates or recommends a workflow
- links KPI detail to an action surface
- should never silently mutate operational data

Examples:
- target revision request
- staffing review request
- performance follow-up task
- challenge or incentive recommendation

## KPI Classes

### Class A. Read-Only Insight KPI
These should remain reporting-first.

Examples:
- executive summary metrics
- historical trend metrics
- broad comparison metrics

Expected behavior:
- charts
- trend tables
- management summaries
- no direct inbox item unless threshold logic is explicitly configured

### Class B. Exception KPI
These should produce a shared inbox `task` when thresholds are crossed.

Examples:
- sales below target band
- compliance below threshold
- turnover risk above tolerance

Expected behavior:
- `at_risk` or `off_track` band
- owner role is clear
- deep link goes to KPI detail
- task remains informational-actionable, not approval-based

### Class C. Trigger KPI
These should recommend or start a workflow.

Examples:
- target miss requiring redistribution or revision
- repeated compliance drop requiring acknowledgement or follow-up checklist
- sustained underperformance that should affect incentive or challenge visibility

Expected behavior:
- task first
- optionally spawn:
  - approval flow
  - acknowledgement flow
  - people/lifecycle follow-up

## What KPI Should Not Do

- should not directly rewrite targets
- should not directly approve or reject anything
- should not create hidden business decisions
- should not mix raw external data with interpreted business scoring without traceability

KPI must remain:
- observable
- explainable
- auditable

## Data Model Direction

KPI should live in three layers.

### 1. Raw Metrics Ingestion
Source:
- Nebim or another external operational system

Purpose:
- preserve incoming facts
- keep import lineage
- avoid business meaning being lost

### 2. Normalized KPI Snapshot
Source:
- internal reporting model

Purpose:
- scope-aware KPI rows by company, region, store, and later employee
- attach target, actual, achievement rate, and status band
- feed dashboards and shared inbox

### 3. Derived Scoring And Rules
Source:
- internal config and rule layer

Purpose:
- determine status band
- determine urgency
- determine whether a KPI becomes:
  - observe-only
  - inbox task
  - workflow trigger

## Shared Inbox Relationship

KPI exceptions should enter shared inbox as:
- `itemType = task`
- `sourceType = kpi_exception`

Not as:
- `approval`
- `acknowledgement`

Reason:
- KPI is a signal, not a decision artifact

Recommended inbox fields:
- title: KPI name + status band
- summary: why this metric needs attention
- urgency: derived from threshold severity
- deep link: KPI detail surface
- history preview: latest achievement or delta summary

## Recommended First KPI Sources

The most practical early KPI tasks are:

1. Store sales
- clear operational meaning
- easy to explain
- naturally tied to targets

2. Audit compliance
- already close to checklist behavior
- useful for store manager follow-up

3. Headcount gap
- naturally tied to people lifecycle and staffing needs

These three are enough to validate the model before wider KPI expansion.

## Threshold Strategy

Use simple bands first:
- `on_track`
- `at_risk`
- `off_track`

Then add optional severity rules later:
- `critical`
- `watch`

Do not start with too many states. Shared inbox quality depends on simple, legible status logic.

## Ownership Model

The same KPI can have different consumers by role.

Examples:
- deputy GM: observe only
- regional manager: observe + intervene
- store manager: act on exception task

This means KPI rendering must be role-sensitive:
- admin shell favors analysis
- store shell favors action

## Incentives And Challenges Relationship

KPI should be able to feed motivation layers, but not be tightly coupled to them.

Recommended rule:
- KPI fact is separate
- challenge points are separate
- reward catalog is separate
- mapping between them is config-driven

This allows:
- changing reward types later
- changing point logic later
- reusing the same KPI for performance and challenge systems

## Product Decision Rules

When a new KPI is introduced, decide it with this checklist:

1. Is it observe-only or action-bearing?
2. Who owns the response when it goes off track?
3. Should it create a `task`, an `approval`, or no workflow at all?
4. Is the target defined externally or inside the product?
5. Does it influence incentive or challenge logic?

If those answers are unclear, the KPI should remain read-only until the rule is defined.

## Immediate Guidance For This Project

Right now KPI should be used as:
- reporting surface in `/store/kpis` and admin reporting
- shared inbox `task` source for clear exceptions
- later trigger input for:
  - target revision
  - staffing review
  - challenge visibility

Right now KPI should not be used as:
- direct approval generator
- automatic business mutation engine
- overloaded all-purpose status system

## Store Manager KPI Ownership Model

The store manager is the operational owner of the current store scorecard.

Current store KPI set:
- target achievement rate
- `CR`
- `ATV`
- `UPT`
- `BM Checklist`
- `VM Checklist`

Important distinction:
- data producer and KPI owner may be different
- the store manager remains the operational owner of the final store score

Example:
- `VM Checklist` data may be produced by visual teams
- but the resulting store score still belongs to the store manager's operational view

## Weighted Store Score

The store score should be a weighted composition, not a flat average.

Initial example weighting:
- target achievement rate: `40%`
- `CR`: `20%`
- `ATV`: `15%`
- `UPT`: `15%`
- `BM Checklist`: `5%`
- `VM Checklist`: `5%`

This should be modeled as:
- KPI definition
- KPI actual or derived value
- KPI weighting rule
- final store performance score

Do not hard-code the score formula directly into the UI or into one-off SQL.

## Why Weighting Must Be Configurable

Weights should be treated as business rules, not code constants.

Reason:
- priorities can change by campaign or season
- one brand period may care more about `CR`
- another period may care more about checklist quality
- future KPI additions should not require rewiring the whole score engine

Recommended direction:
- keep a default store score profile
- allow later override by:
  - company
  - region
  - store
  - effective date range

## KPI Addition Rule

The current KPI set is not final.

Future KPI examples:
- `GSM approvals`
- campaign-specific quality KPIs
- category mix KPIs
- staffing readiness KPIs

This means the model must support:
- adding a new KPI without redesigning the score engine
- deciding whether that KPI is:
  - observe-only
  - inbox task source
  - score contributor
  - workflow trigger

The right mental model is:
- KPI catalog is extensible
- score profiles decide which KPIs matter for a given score
- each KPI can have both:
  - an operational behavior
  - a score contribution behavior

## Recommended KPI Matrix For The Current Store Score

### 1. Target Achievement Rate
- owner: store manager
- score contributor: yes
- inbox task candidate: yes
- likely urgency: high when `off_track`

### 2. CR
- owner: store manager
- score contributor: yes
- inbox task candidate: yes
- likely urgency: medium to high depending on threshold severity

### 3. ATV
- owner: store manager
- score contributor: yes
- inbox task candidate: later
- initial recommendation: warning-first, task later if noise stays manageable

### 4. UPT
- owner: store manager
- score contributor: yes
- inbox task candidate: later
- initial recommendation: warning-first, task later if noise stays manageable

### 5. BM Checklist
- owner: store manager
- score contributor: yes
- inbox task candidate: yes
- should stay close to acknowledgement and compliance behavior

### 6. VM Checklist
- owner: store manager operationally
- data producer: visual or field teams
- score contributor: yes
- inbox task candidate: yes
- should remain visible as a compliance contributor rather than pretending to be a sales metric

## Store Personnel KPI Ownership Model

Store personnel should have an individual scorecard separate from the store manager scorecard.

Current personnel KPI set:
- target achievement rate
- `ATV`
- `UPT`

Important rule:
- personnel score and store score should be related, but not merged into a single metric
- a store can perform well while one person underperforms
- one person can perform well while the store-wide score still has issues

This means the model should support:
- store-level KPI scorecards
- person-level KPI scorecards
- optional roll-up from person results into broader performance interpretation

## Weighted Personnel Score

Personnel score should also be weighted and configurable.

Current known KPI contributors:
- target achievement rate
- `ATV`
- `UPT`

The exact starting weights are still a business decision, so the architecture should not assume them yet.

Recommended initial rule:
- define personnel KPI weights in the same rule system as store KPI weights
- allow them to differ from store-level weights

Reason:
- store score and personnel score answer different business questions
- the same KPI can carry a different importance at each level

Example:
- `ATV` may matter more at personnel level than it does in store-level aggregate reading

## Recommended KPI Matrix For The Current Personnel Score

### 1. Target Achievement Rate
- owner: store personnel for individual outcome
- manager owner: store manager for follow-up and coaching
- score contributor: yes
- inbox task candidate: later, usually for manager-side follow-up rather than employee self-inbox first

### 2. ATV
- owner: store personnel for individual outcome
- manager owner: store manager for coaching
- score contributor: yes
- inbox task candidate: later
- initial recommendation: show in personnel performance view first, then decide if exception tasks are useful

### 3. UPT
- owner: store personnel for individual outcome
- manager owner: store manager for coaching
- score contributor: yes
- inbox task candidate: later
- initial recommendation: show in personnel performance view first, then decide if exception tasks are useful

## Store Versus Personnel KPI Rule

Use one KPI catalog, but allow multiple score profiles.

Recommended structure:
- shared KPI catalog
- store score profile
- personnel score profile
- later optional region score profile

This avoids:
- duplicating KPI definitions
- hard-coding score logic in multiple places
- breaking the system when a new metric such as `GSM approvals` is introduced

## Future KPI Addition Example

If `GSM approvals` is added later, the system should be able to answer separately:
- does it contribute to store score?
- does it contribute to personnel score?
- does it produce an inbox task?
- who owns the exception?

Possible outcomes:
- store score only
- personnel score only
- both
- observe-only at first

This is why KPI addition must remain rule-driven instead of page-driven.

## Design Rule For Future KPIs

When a new KPI such as `GSM approvals` is requested, do not ask:
- where do we cram this into the current page

Ask instead:
1. Is it part of the KPI catalog?
2. Does it contribute to the store score?
3. Does it create exceptions in the inbox?
4. Does it trigger a workflow?
5. What is its weight, if any?
6. From which date does that weight apply?

If the system can answer those questions without new architecture, the KPI model is healthy.

## Next Practical Steps

1. Keep KPI exception items inside shared inbox as `task`
2. Add KPI detail view with clearer recommended next actions
3. Decide which KPI conditions should open:
- target revision
- staffing follow-up
- incentive or challenge nudges
4. Keep threshold logic config-driven where possible
