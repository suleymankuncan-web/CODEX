# Store Utility Handoff V1

## Scope

This slice improves the store shell utility/handoff routes:

- `/store/settings`
- `/store/targets`
- `/store/reports`

The change keeps route access, links, API calls, auth/permission behavior, DB
state, and business logic unchanged.

## Sokrates Decision

Claim:

- These pages had a small V1 gap: they existed and linked correctly, but they
  did not clearly explain the current route purpose, primary action, and data
  boundary.

Assumptions:

- Existing dashboard primitives and localization copy can close the gap without
  a new design system or backend/API work.
- `/store/targets` and `/store/reports` should stay handoff pages until a
  separate product contract exists for native store-side target/report flows.

Evidence:

- The UI/UX V1 route inventory scored these routes as the first safe
  implementation slice.
- Existing `store-surfaces.spec.ts` covered route reachability but not the
  handoff boundary copy.
- Browser review caught the mobile bottom navigation overlapping the final
  boundary card; the fix was kept scoped to `.store-command-utility-page`.

Counterargument:

- A fuller product implementation for store-native targets/reports would create
  more user value, but that would require explicit API/product scope. This slice
  intentionally avoids pretending those contracts exist.

Risk:

- LOW-MEDIUM. The pages are small and isolated, but the slice is visible and
  touches localized copy plus one store-shell CSS selector.

Door:

- Two-way door. Copy, panels, and the scoped mobile spacing can be adjusted or
  removed without data migration or backend changes.

Stop rule used:

- Stop if the page needed route permission, backend/API, auth, or admin flow
  behavior changes. It did not.

## Verification

Local gates:

- `npm.cmd --prefix admin-web run lint` - passed.
- `npm.cmd --prefix admin-web run build` - passed.
- `npx.cmd playwright test store-surfaces.spec.ts -g "store utility pages|store sidebar transitions" --workers=1` - passed, 2/2.

Browser check:

- Local preview at `http://127.0.0.1:4178`.
- `/store/reports` mobile viewport `390x900`:
  - heading rendered.
  - horizontal overflow was false.
  - final boundary card cleared the fixed bottom nav after scrolling to the
    page bottom.
  - console errors were empty.

## Files Touched

- `admin-web/src/pages/StoreSettingsPage.tsx`
- `admin-web/src/pages/StoreTargetsPage.tsx`
- `admin-web/src/pages/StoreReportsPage.tsx`
- `admin-web/src/features/localization/messages/store-home.ts`
- `admin-web/src/styles/store-command-shell.css`
- `admin-web/e2e/store-surfaces.spec.ts`

## Next Candidate

The next UI/UX V1 candidate remains admin reports route coverage and minor
clarity, starting with `/admin/reports` and `/admin/reports/snapshot-runs`,
only if the slice can stay read-only and fixture-backed.
