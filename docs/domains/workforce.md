# Workforce Shelf

Status: active shelf index

## Reader And Action

Reader:

- an engineer or future agent changing seller-code requests, offboarding,
  personnel lifecycle, store scope queues, workforce repository boundaries, or
  workforce reporting.

After reading, they should know what workforce behavior is already split and
which command boundaries remain parked.

## Source Documents

Use these first:

- `docs/plans/workforce-request-repository-boundary-inventory-v1.md`
- `docs/plans/store-workforce-and-approvals-split-v1-plan.md`
- `docs/evidence/store-workforce-and-approvals-split-pr1-contract-matrix-2026-06-05.md`
- `docs/plans/store-ops-repository-risk-review-2026-04-30.md`
- `docs/plans/personnel-management-v1.md`
- `docs/plans/scope-auth-regression-matrix-v1.md`
- `docs/plans/technical-debt-resolution-roadmap-v1.md`

## Active Rules

- Seller-code and offboarding lifecycles are their own workforce request
  boundary.
- Store-facing seller-code and offboarding creation should move to the
  `/store/workforce` Norm Kadro surface before `/store/approvals` is reduced to
  a request/status ledger.
- Store scope, target personnel reads, headcount gap, and legacy checklist
  writes remain outside that request boundary.
- Personnel lifecycle writes must preserve audit and assignment-history
  evidence.
- Region queue indexes and broad performance work wait for measured volume.

## Parked Or High-Risk

- New workforce command state machines.
- Queue/index changes without measured pressure.
- Cross-domain audit feed work.
- Auth/scope widening for workforce queues.

Open those only with a real workflow need, targeted tests, and clear rollback.
