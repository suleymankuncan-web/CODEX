# Incentive / Prim Module Intake V1

## Status

- State: `shaping`
- Implementation: not approved
- Decision: do not add schema, API, UI, or calculation code until the open
  business questions below are answered.

## Business Goal

Define whether the product needs an incentive rule-management module, a payout
calculation module, an approval workflow, or a read-only reporting surface over
externally calculated incentives.

Primary users:

- HR/admin operators who define or review incentive rules.
- Store and region managers who need transparent incentive outcomes.
- Finance or payroll owners if payout approval becomes in scope.
- Auditors who need traceability for rule changes and payout decisions.

## Sokrates Decision

Claim:

- Incentives are high-value, but starting implementation now would be premature.

Assumptions:

- The current product already has KPI/reporting/snapshot foundations that an
  incentive module would likely consume.
- Incentive logic can become financially sensitive, so formulas, effective
  dates, payout ownership, approval rules, and audit requirements must be
  decided before code.

Evidence:

- `docs/plans/feature-backlog.md` already captures Incentive / Prim Module as a
  P1 future feature.
- Existing reporting and snapshot surfaces can provide read inputs, but no
  committed incentive business rules exist yet.
- Current working principles forbid new product expansion code before intake,
  owner, data impact, API impact, UI impact, and verification are defined.

Counterargument:

- A quick UI prototype could clarify needs. That may be useful later, but only
  after the module boundary and data ownership are decided. Otherwise the UI can
  accidentally freeze the wrong payout model.

Risk:

- HIGH for implementation without business rules because this area can affect
  pay, trust, audit, and retroactive reporting.
- LOW for this intake document.

Door:

- This intake is a two-way door.
- Live payout calculation, approval, and retroactive recalculation are
  near-one-way-door decisions and need stronger evidence.

Decision:

- Keep this module in shaping.
- Do not implement it in the current progress cycle.
- Use this intake as the checklist before a real module spec or implementation
  PR.

## Scope Options

### Option A: Read-Only Incentive Visibility

Use when incentives are calculated outside this system and operators only need
visibility.

- API: read summaries, detail rows, audit/source evidence.
- Data: likely `stg` imports and `rpt` read models; limited `ops` writes.
- Risk: lowest.

### Option B: Rule Management And Simulation

Use when HR/admin defines incentive rules here, but payout approval happens
elsewhere.

- API: rule versions, simulation runs, validation, audit.
- Data: `ops` rule versions, possible `rpt` simulation outputs.
- Risk: medium-to-high because rule versioning and effective dates matter.

### Option C: Payout Workflow

Use when this system owns incentive approval and payout readiness.

- API: calculate, review, approve, return, cancel, export, audit.
- Data: `ops` payout runs and approval states, `audit` event log, possibly
  immutable `rpt` snapshots.
- Risk: highest because finance/payroll governance is involved.

## Open Questions

- Who is the business owner for incentive definitions?
- Are incentives calculated in this product or imported from another system?
- Which roles can create rules, approve results, return results, export payout
  files, and only view outcomes?
- Are formulas monthly, daily, campaign-based, or store/personnel scoped?
- Which KPI inputs are official: live KPI, closed snapshot, or manually
  adjusted values?
- Are rules versioned by effective date?
- Can historical payouts be recalculated, or are they immutable after approval?
- What audit evidence is required for formula changes and payout decisions?
- Is payroll export in scope, and if yes what file/API format is required?
- Which Turkish/English business terms are canonical: `prim`, `teşvik`,
  `ödeme`, `hakediş`, or another term?

## Boundary Proposal

Owning bounded context:

- To be decided. Likely a new `incentives` module if this product owns rules or
  payouts.

Neighbor modules:

- `store-ops reporting`: read official KPI/snapshot inputs.
- `auth`: enforce role and scope.
- `integration`: import external incentive inputs if Option A is selected.
- `audit`: record rule, calculation, approval, and export events.

Ownership rule:

- One module must own incentive writes. Reporting can read; it should not own
  incentive mutations.

## Data Impact Draft

- `ops`: likely needed for rule versions, calculation runs, approval states, or
  payout batches if this product owns incentives.
- `stg`: needed if incentive source files are imported.
- `rpt`: needed for immutable incentive summaries or dashboard read models.
- `audit`: required for rule changes, calculation runs, approval/return/cancel,
  and export events.

## API Impact Draft

Potential reads:

- list incentive periods/runs
- get run detail
- get employee/store incentive rows
- get rule version detail
- get audit trail

Potential commands:

- create/update rule draft
- publish rule version
- start simulation or calculation
- approve/return/cancel payout run
- export payout evidence

No endpoint should be implemented until the chosen option and ownership are
confirmed.

## UI Impact Draft

Admin UI candidates:

- Incentive overview
- Rule version list/detail
- Simulation or calculation run detail
- Payout review queue
- Audit/evidence panel

Store/manager UI candidates:

- Read-only incentive outcome card
- Period detail and explanation

UX safety:

- Show formula version and source period.
- Show official vs preview status.
- Require confirmation for publish, approve, cancel, export, and recalculation.
- Never hide blocked rows or missing KPI inputs.

## Verification Plan Draft

Before implementation:

- Confirm chosen scope option.
- Confirm owner and roles.
- Confirm source of truth for KPI inputs.
- Confirm data retention and audit requirements.
- Confirm whether payouts are immutable after approval.

Future implementation gates:

- Unit tests for rule/calculation logic.
- Integration tests for state transitions and authorization.
- Audit event tests for every sensitive command.
- Snapshot/reporting tests if incentives appear in reports.
- Playwright tests for admin review and read-only outcome surfaces.

## Not Ready Checklist

- [ ] Business owner named.
- [ ] Scope option selected.
- [ ] Official KPI input source selected.
- [ ] Rule versioning and effective-date policy defined.
- [ ] Approval and payout ownership defined.
- [ ] Audit requirements accepted.
- [ ] Data placement approved.
- [ ] API surface approved.
- [ ] UI surfaces approved.
- [ ] Verification gate approved.
