# KPI Execution Roadmap

## Purpose
Turn the KPI domain direction into a practical delivery sequence without locking the product into a fixed metric set too early.

Reference:
- Nebim ingest and normalization rules:
  - [nebim-ingestion-and-normalization-plan.md](./nebim-ingestion-and-normalization-plan.md)

## Phase 1. KPI Foundation And Ownership
Goal:
- define who owns which KPI
- separate store score from personnel score
- make score profiles explicit and extensible

Includes:
- KPI ownership matrix
- store score profile baseline
- personnel score profile baseline
- clear distinction between:
  - KPI catalog
  - score profile
  - workflow trigger behavior
- support for future metric additions such as `GSM approvals`
- working reference:
  - [kpi-ownership-matrix.md](./kpi-ownership-matrix.md)

Outcome:
- KPI discussion stops being page-driven and becomes profile-driven

## Phase 2. Store KPI Score Surface
Goal:
- make store manager KPI responsibility visible in the product

Includes:
- weighted store score summary
- KPI contribution breakdown
- exception-ready KPI cards
- ownership-aware store KPI UI
- live score behavior fed from the latest accepted Nebim state
- historical day/week/month score behavior fed from closed snapshots

Outcome:
- store KPI screen becomes a score-and-action surface instead of a loose metric list

## Phase 3. Personnel KPI Scorecards
Goal:
- introduce person-level scorecards without collapsing them into store-level reporting

Includes:
- personnel score profile
- target achievement, `ATV`, `UPT`
- manager coaching context
- later optional personnel exception hooks
- seller-code keyed personnel matching
- live leaderboard behavior based on the latest accepted pull
- deferred ranking eligibility rules kept config-driven

Outcome:
- personnel performance can evolve independently from store performance

## Phase 4. Configurable Weights And KPI Catalog Growth
Goal:
- make KPI weighting and metric expansion rule-driven

Includes:
- configurable score profiles
- date-aware weight changes
- future metric additions such as `GSM approvals`
- company/region/store-level overrides later

Outcome:
- new KPIs can be introduced without redesigning score computation

## Phase 5. KPI To Workflow Triggers
Goal:
- let KPI exceptions recommend or launch operational actions

Includes:
- target revision triggers
- staffing review triggers
- checklist follow-up triggers
- coaching/task nudges
- rules that distinguish live intraday exception signals from closed-period historical score review

Outcome:
- KPI becomes an operational signal, not just a dashboard row

## Phase 6. KPI, Incentives, And Challenges
Goal:
- connect KPI interpretation to motivation systems without coupling them too tightly

Includes:
- challenge points mapping
- reward catalog relationship
- configurable incentive interpretation

Outcome:
- KPI can feed incentives and challenges while remaining auditable and explainable

## Recommended Rule
- do not jump to configurable scoring before score ownership is clear
- do not add new KPIs directly into UI pages before deciding:
  - score contribution
  - owner
  - exception behavior
