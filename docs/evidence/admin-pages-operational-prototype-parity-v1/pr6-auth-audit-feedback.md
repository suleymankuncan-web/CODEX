# PR6 - Auth, Audit, Pilot Feedback

Date: 2026-06-30

## Scope

Routes covered:

- `/admin/auth`
- `/admin/auth/catalog`
- `/admin/auth/users/:userId/audit`
- `/admin/auth/role-assignments/:assignmentId/audit`
- `/admin/auth/action-store-assignments/:assignmentId/audit`
- `/admin/audit`
- `/admin/audit/users/:userId/audit`
- `/admin/audit/role-assignments/:assignmentId/audit`
- `/admin/audit/action-store-assignments/:assignmentId/audit`
- `/admin/pilot-feedback`

Prototype contract:

- `admin-web/src/prototypes/admin/auth-audit-feedback-v1.tsx`

## Behavior Frozen

- Auth user creation, role assignment, action-store assignment, deactivate/reactivate actions, lookup searches, and existing mutation payloads stay unchanged.
- Audit route params, audit detail fetches, and back-link resolution stay unchanged.
- Pilot feedback listing, pagination, classification payload, and query invalidation stay unchanged.
- Security role visibility and permission semantics stay unchanged.

## Component Map

- Header: `AdminOperationalHeader`
- Metrics: `AdminOperationalMetrics`
- Sections: `AdminOperationalSection`
- Empty/loading/error states: `AdminOperationalState` and `AdminOperationalEmpty`
- Read rows: existing auth row primitives inside the operational page rhythm
- Pilot feedback filters and classification control: shadcn `Select`

## UI Implementation

- Auth dashboard, audit center, audit detail pages, and pilot feedback now use the shared admin operational page rhythm.
- Pilot feedback native dropdowns were replaced with shadcn `Select` while preserving enum values and request bodies.
- The existing auth-specific forms remain in their owning feature component to avoid broad mutation and validation drift.
- Audit detail pages still expose event ids and correlation ids as evidence values, while list rows keep human-readable names where the backend already provides them.

## Verification

Commands run locally before PR:

```text
git diff --check                                                                 # PASS
npm.cmd --prefix admin-web run lint                                              # PASS
npm.cmd --prefix admin-web run build                                             # PASS
npm.cmd --prefix admin-web run test:e2e -- pilot-feedback.spec.ts                # PASS, 3 tests
npm.cmd --prefix admin-web run test:e2e -- auth-admin-surfaces.spec.ts audit-surfaces.spec.ts pilot-feedback.spec.ts pilot-smoke.spec.ts admin-routing.spec.ts  # PASS, 36 tests
npm.cmd --prefix admin-web run test:e2e -- admin-surfaces.spec.ts pilot-feedback.spec.ts auth-admin-surfaces.spec.ts audit-surfaces.spec.ts pilot-smoke.spec.ts admin-routing.spec.ts  # PASS, 37 tests
npm.cmd --prefix admin-web run test:scripts                                      # PASS, 63 tests
npm.cmd run test:scripts                                                         # PASS, 488 tests
```

One first targeted e2e run hit a shell-load timing failure in `admin-routing.spec.ts`. The isolated test passed on rerun, and the full targeted set passed on the next full run.

## Residual Risk

- Auth dashboard remains a dense security workbench. This PR intentionally avoids moving form ownership into a new abstraction because that would create role and payload risk.
- Some audit evidence values are intentionally technical ids because they are the audited object identifiers, not display labels.
