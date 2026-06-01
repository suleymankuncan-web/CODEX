# Admin Operational UX V2 PR-8 Evidence - Auth, Audit, And Pilot Feedback

Date: 2026-06-01

## Scope

- `/admin/auth`
- `/admin/auth/catalog`
- `/admin/auth/users/:userId/audit`
- `/admin/auth/role-assignments/:assignmentId/audit`
- `/admin/auth/action-store-assignments/:assignmentId/audit`
- `/admin/audit`
- `/admin/pilot-feedback`

## Changes

- Made shared auth/audit rows visually quieter and denser by reducing row weight while keeping the same links, buttons, and forms.
- Added explicit correlation id and trace target evidence to the audit center recent trace list from existing audit/link data.
- Added pilot feedback metric icons and a visible queue context strip using the current status filter, class filter, visible item count, and total count.
- Added targeted E2E assertions for audit trace evidence, pilot feedback filter evidence, and mobile horizontal-overflow checks across auth, audit, and pilot feedback surfaces.

## Contract Impact

Unchanged.

- Auth commands, role assignment command shape, action-store assignment command shape, permission semantics, deactivation/reactivation behavior, and audit navigation are unchanged.
- Audit queries, correlation ids, import/snapshot links, pagination, and trace source data are unchanged.
- Pilot feedback status, classification values, classification payload, note preservation behavior, filters, pagination, and mutation behavior are unchanged.
- No API, DB, auth, permission, route, role, snapshot, import, queue, scoring, or workflow behavior changed.

## Verification

- `npm.cmd --prefix admin-web run lint`: pass
- `npm.cmd --prefix admin-web run build`: pass
- `npm.cmd --prefix admin-web run test:e2e -- auth-admin-surfaces.spec.ts audit-surfaces.spec.ts pilot-feedback.spec.ts`: pass, 11/11
- `npm.cmd --prefix admin-web run smoke:pilot`: pass, 7/7
- `npm.cmd run test:scripts`: pass, 399/399
- `git diff --check`: pass

## Visual QA

- `/admin/auth` mobile viewport `390x844` reports no page-level horizontal overflow and keeps the role/permission preview reachable.
- `/admin/audit` mobile viewport `390x844` reports no page-level horizontal overflow and keeps trace target evidence readable.
- `/admin/pilot-feedback` mobile viewport `390x844` reports no page-level horizontal overflow and keeps the triage queue context readable.
- Desktop targeted checks confirm audit links, correlation evidence, pilot feedback classification, and existing auth mutation payloads remain visible and functional.

## Rollback

Revert this PR. Rollback is frontend-only plus targeted E2E/evidence updates; no migration, data repair, queue drain, or workflow rollback is required.
