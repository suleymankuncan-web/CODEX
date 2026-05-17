# Store My Performance Model V1 Plan

**Goal:** Finish the `/store/me` Doctor follow-up from the component-boundary PR by moving period/model derivation out of `StoreMyPerformancePage.tsx` while preserving UI, API shape, query keys, CSS classes, translations, and E2E behavior.

**Why this is worth doing:** React Doctor is the signal, not the reason. After the section extraction, `StoreMyPerformancePage` still owned query orchestration, period selection, fallback rules, KPI formatting, trend derivation, and the final render wiring. Moving the pure model work behind a focused module makes the page easier to review and safer to change when KPI semantics evolve.

**Architecture:** Keep `StoreMyPerformancePage.tsx` as the container for auth, TanStack Query, reducer effects, loading/error branches, and wiring. Add `store-my-performance-model.ts` for reducer state, period helpers, period selection handlers, and the view model builder. Add a private page experience component so the main page component is no longer a Doctor giant component.

## Scope

- Modify: `admin-web/src/pages/StoreMyPerformancePage.tsx`
- Add: `admin-web/src/pages/store-my-performance-model.ts`
- Do not modify backend APIs, routes, translations, CSS, or other pages.
- Do not chase the remaining Doctor warnings in this PR.

## Completed Work

- [x] Extracted Store My Performance reducer/state factory into `store-my-performance-model.ts`.
- [x] Extracted live period availability, fallback, month/day/year scoping, and monthly detail period derivation.
- [x] Extracted period selection handlers behind `createStoreMyPerformancePeriodHandlers`.
- [x] Extracted KPI labels, rank labels, trend rows, metric cards, partial-data labels, and filter option models behind `buildStoreMyPerformanceViewModel`.
- [x] Split the final page render into a private `StoreMyPerformancePageExperience` component.
- [x] Removed accidental public exports from internal period helpers.

## Verification

- [x] `npm.cmd --prefix admin-web run lint`
- [x] `npm.cmd --prefix admin-web run build`
- [x] `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store self-performance"`
- [x] `npm.cmd --prefix admin-web run test:e2e -- kpi-benchmark-explainability.spec.ts -g "my performance"`
- [x] `npm.cmd --prefix admin-web run test:e2e -- pilot-api-contracts.spec.ts -g "store my performance"`
- [x] `npx.cmd --yes react-doctor@latest admin-web --full --offline --fail-on none`

## React Doctor Result

Before this slice, React Doctor reported 10 giant-component issues across 9 files and `StoreMyPerformancePage` was still listed at 384 lines after the first model extraction. After the final render split, Doctor reports 9 issues across 8 files and `StoreMyPerformancePage` is no longer in the giant-component list. Score remains 99/100.

## Release Gate

Run before PR:

```powershell
npm.cmd --prefix admin-web run check:release
npm.cmd run check:release
```

## Render Note

Frontend-only refactor; no manual Render deploy is required beyond the normal merge pipeline.

## PR Summary Sentence

Store self-performance now keeps KPI period/model derivation in a focused model module and leaves the page component as a smaller query-and-render container without behavior changes.
