# Admin UI Modernization V1 PR-2 Route Parity Evidence

Date: 2026-05-31
Branch: `codex/admin-ui-modernization-v1-shell-foundation`
Risk class: `R1 UI-only`

## Scope

PR-2 introduces the admin surface primitive foundation and a route/navigation
parity guard. This evidence proves the shell foundation does not change admin
route graph, route roles, navigation items, or role visibility.

Mobile visual QA also found the legacy admin shell was still reserving desktop
sidebar space on narrow screens. PR-2 therefore keeps the route/access behavior
unchanged while adding responsive shell, surface-grid, and form-grid foundation
rules needed before page-by-page AdminSurface migration begins.

## Sources

Baseline source:

- `docs/plans/admin-ui-modernization-v1-inventory.md`

Current parsed sources:

- `admin-web/src/app/admin-shell.tsx`
- `admin-web/src/app/admin-navigation.ts`

## Parsed Baseline

- Routes: `31`
- Navigation items: `16`
- Visibility roles: `8`
  - `SUPER_ADMIN`
  - `HR_ADMIN`
  - `INTEGRATION_ADMIN`
  - `SNAPSHOT_OPERATOR`
  - `REPORT_VIEWER`
  - `REGION_MANAGER`
  - `AUDITOR`
  - `NO_SPECIAL_ADMIN_ROLE`

## Parity Result

- Route graph diff: `0`
- Route role diff: `0`
- Navigation item diff: `0`
- Navigation role diff: `0`
- Navigation omitted-role semantics diff: `0`
- Route visibility matrix diff: `0`
- Navigation visibility matrix diff: `0`

Detail routes remain route parity inputs. They are not navigation parity
requirements unless the PR-1 inventory marks them `navVisible: true`.

## Command Evidence

```powershell
node --test scripts/admin-route-parity-guard.test.mjs
```

Result:

```text
pass 5
fail 0
```

## Visual QA Evidence

Screenshots were captured with a temporary local Playwright harness after
`npm.cmd --prefix admin-web run build`. The harness was intentionally not
committed because it writes evidence images and should not be part of normal CI.

- `docs/evidence/admin-ui-modernization-v1-pr2-session-desktop.png`
- `docs/evidence/admin-ui-modernization-v1-pr2-session-mobile.png`
- `docs/evidence/admin-ui-modernization-v1-pr2-operations-desktop.png`
- `docs/evidence/admin-ui-modernization-v1-pr2-operations-mobile.png`

Covered surfaces:

- `/admin/session`
- `/admin/operations`, the default first allowed admin route for `SUPER_ADMIN`

Checks:

- Admin shell is visible.
- Main landmark is visible.
- Mobile width has no horizontal document overflow.
- Route and role visibility parity remains unchanged.
- Public navigation items still require omitted `roles` in source; explicit
  `roles: []` is treated as a behavior change by the guard.

## Contract Impact

Contract Impact: intentionally unchanged.

No API response shape, DB schema, auth/permission semantics, scoring, snapshot,
import lifecycle, approval workflow, Store UI behavior, route recovery behavior,
or route visibility behavior is changed by this evidence.
