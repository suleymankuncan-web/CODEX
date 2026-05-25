# Store Me Shadcn Redesign V1

Date: 2026-05-26

## Scope

This slice redesigns the `/store/me` and `/store/personnel/:id` performance
surface with the local shadcn/ui + Tailwind v4 setup.

It does not change auth, data fetching, reporting API contracts, scoring logic,
period selection logic, or permission behavior.

## Implementation Notes

- Rebuilt `StoreMyPerformancePage` layout with prefixed Tailwind utilities and
  shadcn primitives.
- Replaced the previous `store-me-v2-*` CSS surface with shadcn `Card`, `Badge`,
  `Button`, `Progress`, `Alert`, `Dialog`, `Table`, `Separator`, `ToggleGroup`,
  and `Select` components.
- Removed the non-functional theme and notification controls from the Store Me
  topbar.
- Split Store Me navigation/topbar/dock chrome into a small companion module so
  the main section file stays under the local file-size guard.
- Retired the old Store Me v2 CSS imports/files and removed unused localization
  keys for those controls.
- Updated Store Me e2e selectors to stable `data-testid` hooks and shadcn
  accessibility roles.
- Added `radix-ui` because generated shadcn components import Radix primitives
  from the unified `radix-ui` package.

## Verification

- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd run test:scripts`
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts kpi-benchmark-explainability.spec.ts pilot-api-contracts.spec.ts pilot-smoke.spec.ts`
  - Result: 70/70 Playwright tests passed.

## Risk Notes

- The redesign remains scoped to Store Me surfaces; shared shell/navigation CSS
  remains in place.
- shadcn generated files were reviewed and patched for the existing lint rules
  and localized dialog close labels.
- The Browser MCP plugin was not exposed as a callable tool in this session, so
  visual verification was performed through the existing Playwright Chromium
  coverage instead.
