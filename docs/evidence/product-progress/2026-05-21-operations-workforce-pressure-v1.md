# Operations Workforce Pressure V1

## Scope

This slice promotes workforce request pressure from a planned control-tower
topic to a live read-only signal on `/admin/operations`.

It reads existing generated frontend clients only:

- `GET /api/workforce/seller-code-requests?status=pending_hr_approval`
- `GET /api/workforce/offboarding-requests?status=pending_hr_approval`

## Sokrates Decision

Claim:

- Workforce request queues are one of the places operational load can pile up,
  so the control tower should show pending HR approval pressure.

Assumptions:

- Existing workforce read endpoints are sufficient for V1.
- `SUPER_ADMIN` can read the same HR approval queues that Admin Inbox already
  uses.
- A count and short preview are enough; approval/reject actions stay in Admin
  Inbox and Store Approvals.

Repo evidence:

- `backend/nestjs/src/modules/store-ops/web/workforce.controller.ts` allows
  `SUPER_ADMIN` on seller-code and offboarding request list endpoints.
- `admin-web/src/features/workforce/api.ts` already exposes generated
  OpenAPI-backed read functions for both queues.
- `admin-web/src/pages/AdminInboxPage.tsx` already uses the same pending HR
  approval queues as the operational source surface.

Counterargument:

- Adding more live queries to the control tower increases page fan-out. The
  slice keeps the scope to two existing read endpoints and a small preview.

Risk:

- MEDIUM. It adds user-facing read-only composition and two API reads, but it
  does not alter backend behavior, auth, DB, API response shape, or workflow
  semantics.

Door:

- Two-way door. The panel and queries can be reverted without data migration or
  runtime/provider changes.

Stop rule used:

- Stop if this needed a new backend aggregation endpoint, write endpoint, auth
  broadening, DB schema, workforce command behavior, access lifecycle behavior,
  or approval/reject workflow change. It did not.

## What Changed

- `/admin/operations` now reads pending seller-code and offboarding requests.
- The summary metrics include a Workforce card.
- The operator action list includes a Workforce queue action when pending
  requests exist.
- A dedicated workforce pressure panel shows seller-code/offboarding counts and
  a short pending request preview.
- The metric coverage map now marks Workforce Requests as live instead of
  planned.
- The new component/model live in:
  - `admin-web/src/pages/operations-workforce-signal-panel.tsx`
  - `admin-web/src/pages/operations-workforce-signal-model.ts`
- Operator action assembly is split into
  `admin-web/src/pages/operations-operator-action-model.ts` and
  `admin-web/src/pages/operations-operator-action-list.tsx`, keeping
  `OperationsControlTowerPage.tsx` around 890 lines after the slice.

## What It Intentionally Does Not Do

- No backend endpoint or aggregation.
- No API response shape change.
- No auth, role, permission, route access, or action-scope behavior change.
- No DB migration.
- No seller-code approval/reject/resubmit behavior.
- No offboarding approval/reject/resubmit or access lifecycle behavior.
- No workflow inbox semantics.

## Verification

- `git diff --check` - passed, with only Windows CRLF warnings.
- `npm.cmd --prefix admin-web run lint` - passed.
- `npm.cmd --prefix admin-web run build` - passed.
- `npm.cmd --prefix admin-web run test:e2e -- operations-control-tower.spec.ts --workers=1` - passed, 5/5.

## Residual Risk

- This is a count/preview signal, not a workforce SLA or aging metric.
- Queue age, overdue states, and escalation thresholds remain parked until a
  separate rules/threshold decision exists.
