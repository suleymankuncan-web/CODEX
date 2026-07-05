# Pilot Roster Reconciliation Apply Evidence - 2026-07-05

## Scope

PR2 adds the guarded application boundary for the PR1 roster dry-run.

It does not automatically write the local Excel files into production tables. The new
application service builds an apply plan and separates:

- active June roster candidates,
- personnel target reference candidates,
- sales/KPI-backed turnover candidates,
- target rows excluded by role,
- rows requiring review or explicit approval.

## Guardrails

- Store managers stay active in workforce views but are excluded from personnel target references.
- Cashiers stay active in workforce views but are excluded from personnel target references.
- Target rows with a different active store assignment are blocked.
- Target-only historical rows do not create turnover events.
- Turnover candidates require a `sales_kpi` source row absent from the June active roster.
- Applying a plan with review items requires the explicit token
  `APPROVE_SAFE_ROWS_WITH_REVIEW_ITEMS`.

## Repository Boundary

`PilotRosterReconciliationRepository.applyResolvedPlan(...)` accepts only rows that
already have product-table IDs resolved by an operator-controlled step.

The repository writes inside a single transaction and uses duplicate guards for:

- `ops.employee_assignment_history`,
- `ops.target_distribution_request`,
- `ops.personnel_target_reference`,
- `ops.turnover_event`.

## Verification

- `npm.cmd --prefix backend/nestjs test -- pilot-roster-reconciliation --runInBand`
  - 3 suites passed.
  - 10 tests passed.

## Remaining Review Work

The PR1 dry-run still reports high review volume. Those rows must not be applied
silently. PR2 intentionally keeps unresolved store/personnel matching outside the
automatic writer.
