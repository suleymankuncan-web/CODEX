# Project Health Uplift PR-4 Store Persona Regression Pack

Date: 2026-06-08

## Scope

This is a test/evidence-only regression pack. It does not change Store UI,
backend behavior, API shape, auth semantics, scoring, ranking, workforce,
target, checklist, or action workflow behavior.

The purpose is to make the recent Store persona bug classes visible as a
repeatable targeted verification set before future Store scope or KPI work.

## Protected Bug Classes

| Bug class | Protected behavior | Evidence |
| --- | --- | --- |
| Region Manager assigned-store KPI visibility | A selected Store KPI page can be read through the DB-backed `canRegionManagerReadStore` check without trusting aggregate region scope. | `backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts` -> `reads selected store KPI highlights when the store is inside active region-manager scope` |
| Region Manager selected-store KPI denial | Dual-role or broad-looking scope cannot open an unassigned selected store when the DB assignment check fails. | `backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts` -> `does not trust aggregate region scope for dual-role selected store KPI highlights` |
| Store Manager own-store KPI visibility | Selected Store KPI highlights are readable only for a store inside the store scope. | `backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts` -> `allows selected store KPI highlights inside assigned store scope` |
| Missing personnel target fallback | Personnel target achievement is not scored without an approved target, preventing synthetic HG percentages. | `backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts` -> `does not score personnel target achievement without an approved target` |
| Ranking profile action visibility | Personnel profile navigation is computed from active assignment scope, not stale ranking period region data. | `backend/nestjs/src/modules/store-ops/application/ranking.service.spec.ts` -> `marks personnel profile navigation from active assignment scope, not ranking period region` |
| Store Manager ranking details | Store managers see detailed Turkey Top 100 rankings while own-store personnel details remain available to the backend contract. | `backend/nestjs/src/modules/store-ops/application/ranking.service.spec.ts` -> `keeps store manager global rankings detailed Top 100 while exposing own-store personnel details` |
| Store personnel Top 100 cap | Store personnel cannot page beyond the capped detailed list but still see their own current position. | `backend/nestjs/src/modules/store-ops/application/ranking.service.spec.ts` -> `caps store personnel to Turkey Top 100 detailed rows and includes own position outside the top list` |
| Workforce assigned-store rows | Workforce request list reads use assigned/action store ids before legacy store scope. | `backend/nestjs/src/modules/store-ops/application/workforce.service.headcount-gap.spec.ts` -> `keeps workforce request lists limited to assigned stores even when read scope is broader` |
| Workforce tenure/start date | Workforce rows use assignment start date with employee hire date fallback. | `backend/nestjs/src/modules/store-ops/infrastructure/workforce-lookup-read.repository.spec.ts` -> `uses employee hire date as the store workforce start-date fallback` |
| Workforce norm/actual access | Region manager headcount gap reads are allowed in-region and blocked outside region. | `backend/nestjs/src/modules/store-ops/application/workforce.service.headcount-gap.spec.ts` -> `allows a region manager to read headcount gap for a store in their region`, `blocks a region manager from reading headcount gap outside their region` |

## Targeted Verification Set

Run these before Store persona/scope/KPI/workforce PRs are considered safe:

```powershell
npm.cmd --prefix backend/nestjs test -- --runTestsByPath src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts src/modules/store-ops/application/ranking.service.spec.ts src/modules/store-ops/application/workforce.service.headcount-gap.spec.ts src/modules/store-ops/infrastructure/workforce-lookup-read.repository.spec.ts
npm.cmd run test:scripts
```

Add frontend Playwright coverage when the PR changes Store route rendering,
links, filters, mobile layout, or profile/action button visibility.

## Stop Conditions

- If any protected behavior above must change, open a separate product/API or
  auth/scope decision before changing runtime code.
- If a future PR touches Store KPI/ranking/workforce UI but does not run the
  targeted verification set or equivalent route-level Playwright evidence,
  the PR is under-verified.
- If a test listed here is renamed or removed, update this evidence and its
  contract guard in the same PR.
