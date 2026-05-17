# Store KPI Highlights Sections V1 Plan

**Goal:** Reduce maintenance risk in `/store/kpis` by separating the large page component into a query/model hook and focused render sections without changing KPI semantics, API calls, routes, copy keys, or CSS classes.

**Why this is worth doing:** This page is store-facing and explains KPI source semantics, benchmark caps, live checklist contribution, and closed-day score breakdowns. A bug in this page can confuse store teams about official KPI scoring, so the value is reviewability and safer future KPI changes, not React Doctor alone.

**Scope**

- Modify: `admin-web/src/pages/StoreKpiHighlightsPage.tsx`
- Test hardening: `admin-web/e2e/admin-routing.spec.ts`
- Keep query keys and fetch timing unchanged.
- Keep all route, class, aria, and translation keys unchanged.
- Do not redesign the UI.
- Do not chase unrelated Doctor warnings in this PR.

## Completed Work

- [x] Moved page data/query/model orchestration into `useStoreKpiHighlightsPageModel`.
- [x] Split the main render into focused private sections for hero, view mode controls, summary metrics, checklist impact, score sources, scope/top signal, partial data, score meaning, score breakdown, ownership, and priorities.
- [x] Preserved live/closed view behavior and selected-period/snapshot controls.
- [x] Fixed the visible mojibake separator in the store score metric note by using `\u00B7`.
- [x] Scoped the admin shell locale smoke test to sidebar/nav links so audit page content links cannot create strict locator collisions during the release gate.

## Verification

- [x] `npm.cmd --prefix admin-web run lint`
- [x] `npm.cmd --prefix admin-web run build`
- [x] `npm.cmd --prefix admin-web run test:e2e -- kpi-benchmark-explainability.spec.ts`
- [x] `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store KPI"`
- [x] `npm.cmd --prefix admin-web run test:e2e -- admin-routing.spec.ts -g "admin shell switches chrome to English copy and persists locale"`
- [x] `npm.cmd --prefix admin-web run test:e2e -- admin-routing.spec.ts`
- [x] `npm.cmd --prefix admin-web run test:e2e -- pilot-smoke.spec.ts -g "protected route refresh returns to the same route"`
- [x] `npm.cmd --prefix admin-web run test:e2e -- pilot-smoke.spec.ts`
- [x] `npx.cmd --yes react-doctor@latest admin-web --full --offline --fail-on none`

## React Doctor Result

Before this slice, React Doctor reported 9 giant-component issues across 8 files and included `StoreKpiHighlightsPage`. After the split, Doctor reports 8 issues across 7 files and `StoreKpiHighlightsPage` is no longer in the giant-component list. Score remains 99/100.

## Release Gate

Run before PR:

```powershell
npm.cmd --prefix admin-web run check:release
npm.cmd run check:release
```

Status:

- [x] `npm.cmd --prefix admin-web run check:release`
- [x] `npm.cmd run check:release`

## Render Note

Frontend-only refactor; no manual Render deploy is required beyond the normal merge pipeline.

## PR Summary Sentence

Store KPI highlights now keeps scoring/query orchestration in a hook and renders through smaller focused sections without changing KPI behavior.
