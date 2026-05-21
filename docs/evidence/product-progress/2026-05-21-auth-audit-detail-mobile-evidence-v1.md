# Auth Audit Detail Mobile Evidence V1

## Scope

Add route-level mobile evidence for the auth audit detail trio:

- `/admin/audit/users/:userId/audit`,
- `/admin/audit/role-assignments/:assignmentId/audit`,
- `/admin/audit/action-store-assignments/:assignmentId/audit`.

This is a test/evidence slice only. It does not change UI code or runtime
behavior.

## Sokrates Decision

Claim:

- After fixing the auth dashboard/catalog readability issue, the next safe auth
  follow-up is not more visual polish. It is proving that the audit detail trio
  stays readable and bounded on mobile.

Evidence:

- `docs/evidence/product-progress/2026-05-20-uiux-v1-route-inventory.md` marks
  the auth audit detail trio as readable but covered mostly by routing and
  localization assertions.
- `admin-web/e2e/admin-routing.spec.ts` already owns the audit detail fixtures,
  namespace links, and locale tests.

Counterargument:

- This does not improve the visual design directly. That is intentional: auth
  and audit are security-sensitive, so the next step should be guardrail
  evidence before additional presentation changes.

Risk:

- LOW. The slice adds Playwright assertions only.

Door:

- Two-way door. The test/evidence addition can be reverted without touching
  product behavior.

## Guardrails

- No auth, permission, route access, API, DB, provider, or audit data behavior
  changed.
- No CSS, layout, copy, or design-system change was made.
- The new test reuses existing mocked audit fixtures.

## Verification

- `git diff --check`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- admin-routing.spec.ts --workers=1`
