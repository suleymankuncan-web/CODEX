# Sales Target Incentive Region Approval Flow V1 Closeout

Date: 2026-06-19

## Scope

The PR train makes the Region Manager post-close incentive approval workflow live without changing incentive formula, sales import, month close, auth scope, company-store-only filtering, or cashier exclusion.

Closed flow:

- Region Manager reviews closed-period store incentive rows.
- Region Manager creates draft/final-snapshot corrections in the separate region correction workflow.
- Region Manager submits a period package with a submitted store-set snapshot.
- Admin sees submitted and missing packages by region.
- Admin can approve or return a submitted package.
- Only admin approval promotes submitted Region Manager corrections into the approved adjustment ledger.

## PR Train Result

- PR1: schema and repository foundation.
- PR2: Store API for store review, correction draft/void, and package submit.
- PR3: Admin API visibility and package approve/return.
- PR4: `/store/incentives` Region Manager command UI from the locked prototype.
- PR5: Admin incentives package review surface and closeout evidence.

## PR5 Verification

Commands run locally:

```text
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- admin-incentives.spec.ts
npm.cmd --prefix backend/nestjs test -- src/modules/store-ops/application/sales-target-incentive-api.service.spec.ts --runInBand
npm.cmd --prefix backend/nestjs run openapi:generate
npm.cmd --prefix admin-web run api:generate
npm.cmd --prefix admin-web run api:check
npm.cmd --prefix admin-web run test:scripts
```

Observed result:

- Admin incentive e2e: 4 passed.
- Backend incentive API service: 25 passed.
- Frontend script tests: 48 passed.
- OpenAPI frontend selected types are current.

## Prototype Parity

The locked `/store/incentives` Region Manager prototype is represented in production by PR4. PR5 keeps admin review separate: admin sees region packages, submitted correction detail, approve/return state, and revision note handling without adding timers, polling, or full-page refresh behavior.

## Remaining Risk

- Live payroll export handoff remains dependent on admin-approved adjustment ledger data quality.
- Historical packages depend on submitted package store snapshots; assignment changes after submit must continue to be verified in integration/staging data.
- Admin visual review should still be smoke-tested on staging after deploy with one submitted Region Manager package and one not-submitted region.
