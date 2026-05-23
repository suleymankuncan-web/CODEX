# Feature Backlog

## Purpose
This document is the controlled intake area for future business features and product expansions.

Use it before implementation so new ideas do not get scattered across chat history, code comments, or unrelated docs.

## Usage Rules
- Add features here before implementation starts.
- Keep entries short until the feature is selected for active work.
- When a feature is selected, create a mini spec using:
  - `docs/plans/new-module-template.md`
- Do not start schema, API, or UI work before the feature has an owner and a scope.

## Status Model
- `captured`: idea recorded, not analyzed yet
- `shaping`: being clarified
- `planned`: spec exists, ready for implementation
- `in_progress`: active work started
- `done`: implemented
- `deferred`: intentionally postponed
- `parked`: intentionally blocked until a named trigger/input exists

## Priority Model
- `P0`: blocking / foundational
- `P1`: high-value next step
- `P2`: important but not immediate
- `P3`: later / optional

## Feature Entry Template

### Feature
- Name:
- Status:
- Priority:

### Why
- Business goal:
- User/operator need:

### Likely Module
- Owning bounded context:
- Related modules:

### Data Impact
- `ops`:
- `stg`:
- `rpt`:
- `audit`:

### Surface Impact
- API:
- Admin UI:
- Reporting UI:

### Risks / Notes
-

## Backlog

### 1. Admin Dashboard Phase 1
- Status: `planned`
- Priority: `P1`
- Business goal: make existing backend capabilities visible and operationally usable from a first admin UI
- User/operator need: integration admins and snapshot operators need queue visibility, summary cards, and action surfaces without manual API inspection
- Owning bounded context: cross-module admin surface
- Related modules: `integration`, `snapshot`, `store-ops reporting`, `auth lookups`
- `ops`: none
- `stg`: none
- `rpt`: read-only consumption only
- `audit`: read-only consumption only
- API: existing admin and reporting endpoints are sufficient for phase 1
- Admin UI: yes
- Reporting UI: light summary use
- Risks / Notes: avoid inventing new backend contracts before validating current surfaces in UI

### 1A. Store Shell Phase 1
- Status: `in_progress`
- Priority: `P1`
- Business goal: define a clean store-user home before future domain modules start landing
- User/operator need: store-scoped users should have a task-first shell instead of being conceptually forced through admin surfaces
- Owning bounded context: store-user shell
- Related modules: `reporting`, future `checklists`, future `approvals`, future `incentives`
- `ops`: none yet
- `stg`: none
- `rpt`: read-oriented consumption later
- `audit`: shared consumption later
- API: not required for phase 1 preview
- Admin UI: no
- Reporting UI: later, in store-facing form
- Risks / Notes: do not let store features quietly accumulate under `/admin`

### 1B. Daily Closure Ranking
- Status: `done`
- Priority: `P1`
- Business goal: turn live KPI/performance data into trustworthy closed daily/monthly ranking
- User/operator need: personnel and store managers need reliable historical rank, KPI mini-ranks, and data coverage such as `25/27 days`
- Owning bounded context: snapshot/reporting read model with store-user surfaces
- Related modules: `snapshot`, `store-ops reporting`, `kpi`, `auth/scope`, future `challenge / league / tournament`
- `ops`: read source state and assignments
- `stg`: no direct first-phase writes
- `rpt`: closed daily/monthly ranking read models
- `audit`: closure/recompute traceability
- API: required for closed daily/monthly ranking reads
- Admin UI: not first audience
- Reporting UI: store shell first, admin/region later
- Risks / Notes: missing data is not zero; official monthly ranking requires at least 3 closed performance days
- Reference: [daily-closure-ranking-strategy.md](./daily-closure-ranking-strategy.md)
- V1 result: daily/monthly closed ranking, store/Turkey rank, KPI mini-ranks, and coverage exist.
- V2 shaping: improve official/preview/no-data explanation and Turkish-first ranking copy.
- V2 reference: [daily-closure-ranking-v2-intake.md](./daily-closure-ranking-v2-intake.md)

### 1C. UI Localization TR/EN
- Status: `captured`
- Priority: `P1`
- Business goal: support a fully Turkish default UI and optional English UI without scattering hard-coded copy
- User/operator need: Turkish users should see correct Turkish labels and characters, while English can be enabled later for broader use
- Owning bounded context: frontend platform / UX foundation
- Related modules: all frontend surfaces, exports, error display, formatting helpers
- `ops`: none expected
- `stg`: none expected
- `rpt`: none expected
- `audit`: no schema impact; audit event codes stay stable and only display labels localize
- Reference: [ui-localization-strategy.md](./ui-localization-strategy.md)

### 1D. Norm Kadro / Staffing Baseline
- Status: `parked`
- Priority: `P1`
- Business goal: compare planned staffing capacity against actual workforce,
  store coverage, and future coaching/action needs without turning every gap
  into an automatic command.
- User/operator need: HR/admin and store operations need to understand whether
  a store is under/over staffed before interpreting KPI, workload, or action
  pressure.
- Owning bounded context: workforce/config boundary to be shaped.
- Related modules: `workforce`, `reporting`, `store action`, `operations`.
- `ops`: possible future staffing baseline state, not approved yet.
- `stg`: possible imported staffing reference, not approved yet.
- `rpt`: read-only comparison outputs after source ownership is clear.
- `audit`: required only if staffing baseline writes/config changes are later
  approved.
- API: none now; first step must be docs/spec plus read-only inventory.
- Admin UI: none now; later only after source of truth and role owner are clear.
- Reporting UI: possible later read-only comparison.
- Risks / Notes: do not add write/config flows, automatic Store Action creation,
  or staffing-rule behavior yet. The first future slice is a spec and read-only
  inventory that names source of truth, owner, cadence, role/scope, and
  verification ladder.

### 2. Incentive / Prim Module
- Status: `shaping`
- Priority: `P1`
- Business goal: manage incentive logic and payout-related workflows
- User/operator need: define, calculate, review, and possibly approve employee/store incentive outcomes
- Owning bounded context: to be decided
- Related modules: likely `kpi`, `reporting`, `auth`, maybe `integration`
- `ops`: likely yes
- `stg`: maybe
- `rpt`: likely yes
- `audit`: yes
- API: required
- Admin UI: required
- Reporting UI: likely required
- Risks / Notes: must decide whether this is rule management, payout calculation, approval workflow, read-only visibility, or a combination before any implementation
- Intake: [incentive-prim-module-intake-v1.md](./incentive-prim-module-intake-v1.md)

### 3. KPI Expansion Pack
- Status: `captured`
- Priority: `P1`
- Business goal: support new KPI definitions, scopes, rules, or derived metrics
- User/operator need: extend measurement model without breaking existing reporting
- Owning bounded context: likely `store-ops reporting` plus KPI-related admin surface
- Related modules: `integration`, `snapshot`, `reporting`
- `ops`: likely yes
- `stg`: maybe
- `rpt`: yes
- `audit`: yes
- API: required
- Admin UI: likely required
- Reporting UI: required
- Risks / Notes: additive KPIs are easy; formula/threshold/weighting changes need stronger versioning decisions
