# Store Workforce And Approvals Split V1 - PR-4 Region Manager View

Date: 2026-06-05

## Scope

PR-4 implements the `/store/workforce` Region Manager surface after the route
foundation and Store Manager workforce view are live.

Changed runtime scope:

- `StoreWorkforcePage` now delegates the Region Manager mode to
  `store-workforce-region-view.tsx`.
- Region Manager rows are derived only from `authSummary.user.readScope.storeIds`.
- `Detay ac` opens an in-page shadcn dialog that behaves as a bottom/full-height
  sheet on mobile.
- No `Magazaya git` navigation is rendered.

## Contract Impact

Contract Impact: intentionally unchanged.

No API shape, DB schema, auth/permission semantics, seller-code lifecycle,
offboarding lifecycle, target distribution lifecycle, or scoring behavior was
changed.

## Data Honesty

The current backend/frontend Store workforce contract does not provide a
region-scoped aggregate/detail read model for:

- total personnel across scoped stores,
- average tenure across scoped stores,
- position distribution across scoped stores,
- store personnel rows readable by Region Manager,
- seller-code/offboarding movement rows readable by Region Manager detail.

The UI therefore shows `Veri kaynagi gerekli` for those values instead of
deriving fake aggregate data or fetching store employee rows unbounded from the
browser.

Store row identity is displayed from read-scope store ids. Store display names
are not invented because the current auth session contract does not include
store names.

## Locked Prototype Contract

The production Region Manager workforce surface must be compared against:

- `docs/prototypes/store-workforce-prototype-v1.html`
- SHA-256:
  `93390D1705B9DFEC74E3ACF084320FC91B1F31580E45C6FE8A26B479EDCD031F`

This prototype is a visual contract, not loose inspiration. Layout, palette,
density, row rhythm, status tones, modal/drawer behavior, labels, and main
interaction flow must match unless a real production constraint requires a
documented deviation. Missing Region Manager aggregate/detail data must appear
inside the prototype structure as honest unavailable state; it must not be used
as a reason to ship a different foundation-style layout.

## Scope Safety

Added targeted E2E coverage proves:

- Region Manager sees only read-scope store rows.
- Out-of-scope store ids are absent.
- Opening detail does not navigate away from `/store/workforce`.
- Region detail does not call Store Manager workforce detail endpoints:
  `store-employees`, `position-options`, `seller-code-requests`, or
  `offboarding-requests`.

## Visual QA

Captured against the production preview build on `http://127.0.0.1:4174`.

The locked prototype above is the acceptance source for PR-4 visual QA. The
screenshots below were recaptured after the prototype-parity pass.

Intentional production deviations from the prototype:

- the production Store shell/sidebar remains instead of the prototype role
  switcher,
- demo-only role switching is removed,
- missing Region Manager aggregate/detail data is rendered as honest unavailable
  state inside the prototype structure,
- store names are not invented; read-scope store ids are visually truncated in
  rows and preserved in detail/evidence text.

Screenshots:

- `docs/evidence/store-workforce-and-approvals-split-pr4-region-manager-visual-qa-2026-06-05/store-workforce-prototype-region-desktop-2026-06-05.png`
- `docs/evidence/store-workforce-and-approvals-split-pr4-region-manager-visual-qa-2026-06-05/store-workforce-region-pr4-desktop-2026-06-05.png`
- `docs/evidence/store-workforce-and-approvals-split-pr4-region-manager-visual-qa-2026-06-05/store-workforce-region-pr4-desktop-modal-2026-06-05.png`
- `docs/evidence/store-workforce-and-approvals-split-pr4-region-manager-visual-qa-2026-06-05/store-workforce-region-pr4-mobile-page-2026-06-05.png`
- `docs/evidence/store-workforce-and-approvals-split-pr4-region-manager-visual-qa-2026-06-05/store-workforce-region-pr4-mobile-drawer-2026-06-05.png`

Visual checks:

- desktop horizontal overflow: false,
- mobile horizontal overflow: false,
- desktop detail URL remained `/store/workforce`,
- mobile detail URL remained `/store/workforce`,
- workforce detail endpoint calls during visual QA: `0`.

## Verification

Passed:

- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store workforce"`: 12/12
- `npm.cmd run test:scripts`: 406/406

## Rollback

Revert this PR to return the Region Manager mode to the previous foundation
state while keeping `/store/workforce`, Store Manager workforce, and approvals
behavior intact.
