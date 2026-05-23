# Norm Kadro / Workforce Planning Read-Only V1

Status: active evidence
Shelf: evidence
Last verified: 2026-05-23

## Reader And Action

Reader:

- a future engineer, product owner, or operator deciding whether to turn Norm
  Kadro / staffing baseline into a product slice.

After reading, they should know what already exists, what can be used safely as
read-only planning context, and what must stay parked until a separate owner
decision.

## Sokrates Decision

Decision:

- Do not create a new Norm Kadro module now.
- Treat current Norm Kadro capability as read-only workforce planning context
  sourced from existing workforce norm plan and snapshot/reporting data.
- Use the existing workforce report and headcount-gap reads before adding any
  new route, API, DB schema, config UI, Store Action source, or approval flow.

Evidence:

- `ops.workforce_norm_plan` already exists with planned headcount and FTE by
  company, region, store, position, and period.
- `db/jobs/generate_snapshots.sql` materializes planned versus active workforce
  rows into reporting snapshots.
- `GET /api/reports/workforce` exposes snapshot-backed workforce rows with
  planned headcount, active headcount, headcount gap, planned FTE, active FTE,
  and FTE gap.
- `/admin/reports/workforce/:snapshotRunId` already renders the store-position
  staffing balance and CSV export.
- `GET /api/workforce/headcount-gap` exists for store-scoped point-in-time
  headcount gap reads, but is currently classified as legacy/deprecation
  candidate until a concrete planning surface needs it.
- `/admin/operations` already shows workforce queue pressure from existing
  seller-code/offboarding approval queues.

Counterargument:

- A full staffing baseline module may eventually be useful. It is still too
  early because approval ownership, editing workflow, effective-date policy,
  import ownership, and Store Action source behavior are not settled.

Risk:

- LOW for this docs/guard inventory.
- MEDIUM for future read-only UI changes because staffing interpretation can
  look like an operational recommendation.
- HIGH for write/config, auto action generation, approval, payroll, or labor
  policy behavior.

Door:

- This inventory is a two-way-door docs slice.
- A mutable staffing baseline/config module is closer to one-way-door because
  it changes operational planning truth and audit expectations.

Stop rule:

- Stop before code if the slice cannot name source of truth, owner, role/scope,
  effective period, audit need, rollback, and a targeted verification ladder.

## Current Source Of Truth Map

| Data / Signal | Current Source | Current Reader | Scope / Role Boundary | Safe Use Now | Parked / Not Now |
| --- | --- | --- | --- | --- | --- |
| Planned headcount and planned FTE | `ops.workforce_norm_plan` | Snapshot jobs and headcount-gap query. | Stored by company, region, store, position, period. | Read-only comparison context. | No editing UI, approval workflow, import adapter, or dynamic config. |
| Active headcount and active FTE | `ops.employee_assignment_history` | Snapshot jobs and headcount-gap query. | Store/assignment history scope. | Read-only actual workforce comparison. | No personnel lifecycle mutation from Norm Kadro. |
| Materialized workforce balance | `rpt.store_workforce_snapshot` via snapshot jobs. | `GET /api/reports/workforce`, `/admin/reports/workforce/:snapshotRunId`. | Reporting read roles with backend scope filtering. | Read-only report, drill-down, CSV export. | No automatic command or Store Action creation. |
| Store headcount gap | `GET /api/workforce/headcount-gap` backed by `StoreOpsRepository.getStoreHeadcountGap`. | Currently not used by active frontend planning surfaces. | Store-scoped endpoint. | Future candidate only if a store-level read-only planning card needs it. | Do not promote without route, scope, and deprecation decision. |
| Workforce request pressure | Seller-code and offboarding request queues. | `/admin/operations`, `/admin/inbox`, store approvals flows. | HR/admin/store-manager queue/action boundaries. | Read-only queue pressure and operational load context. | Not a staffing baseline calculation. |

## Read-Only Product Shape

Safe V1 surface, when needed:

- Extend the existing workforce reporting path rather than adding a new Norm
  Kadro module.
- Show planned versus active headcount/FTE by snapshot, store, and position.
- Keep the copy explicit: this is staffing balance context, not assignment,
  payroll, approval, or automatic coaching.
- Link from Operations only as a drill-down when data freshness and snapshot
  context are clear.

Unsafe V1 surface:

- New `/admin/norm-kadro` module with editable targets.
- Automatic Store Action creation from every headcount gap.
- Approval flow for staffing baseline changes.
- Labor-law, payroll, shift planning, scheduling, or budget ownership claims.

## Required Inputs Before Write Or Config Work

Before any mutable staffing baseline work, require:

- owner role and approval authority,
- source of truth for staffing targets,
- effective-date and overlap policy,
- position taxonomy ownership,
- import/manual-entry decision,
- audit event shape,
- rollback and correction path,
- reporting snapshot behavior for historical interpretation,
- role/scope matrix for company, region, and store users,
- tests for foreign-store/foreign-region reads and commands.

## Smallest Safe Next Slice

If product work resumes after this inventory, the smallest safe slice is:

- a read-only evidence note or UI microcopy improvement on
  `/admin/reports/workforce/:snapshotRunId` clarifying that planned versus
  active rows come from `ops.workforce_norm_plan` and snapshot materialization.

Do not start with:

- DB migration,
- baseline editor,
- import adapter,
- Store Action source expansion,
- workflow inbox item,
- notification/escalation,
- payroll or shift planning logic.

## Verification

For this docs/guard inventory:

```powershell
git diff --check
npm.cmd run test:scripts
```

For a future read-only UI slice:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- reports-workforce.spec.ts
```

For backend/reporting changes:

```powershell
npm.cmd --prefix backend/nestjs test -- reporting.e2e-spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- auth-scope.e2e-spec.ts --runInBand
npm.cmd --prefix backend/nestjs run build
```
