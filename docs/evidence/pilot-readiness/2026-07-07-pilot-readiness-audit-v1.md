# Pilot Readiness Audit V1 Evidence - 2026-07-07

Status: in_progress  
Scope: controlled pilot / patron demo readiness  
Branch: `codex/pilot-readiness-audit-v1`  
Evidence mode: audit-first, fix-after-evidence  
Secrets policy: no passwords, OTPs, cookies, bearer tokens, database URLs, private credentials, or raw connection strings recorded.

## Scope Decision

| Decision | Value |
| --- | --- |
| New module | no |
| Broad UI redesign | no |
| Nebim/provider integration | no |
| Business formula changes | no |
| Auth/scope semantic changes | no |
| Snapshot manual patching | no |
| Pilot blocker audit and targeted fixes | yes |

## Read Sources

| Source | Status | Notes |
| --- | --- | --- |
| `CONTRIBUTING.md` | read | PR rhythm, verification ladder, data honesty. |
| `current-state.md` | read | Latest handoff is stale relative to current July PR line; still useful for operating history. |
| `sokrates.md` | read | Decision/risk method for audit-first execution. |
| `discipline.md` | read | PR gates, Store UI rules, subagent orchestration discipline. |
| `docs/README.md` | read | Documentation library entry point. |
| `docs/plans/project-control-board-v1.md` | read | Project control/go-no-go reference. |
| `docs/superpowers/plans/2026-07-07-pilot-readiness-audit-v1.md` | read | Active plan. |
| `docs/contracts/store-page-qa-contract-v1.md` | read | Store page QA contract and required checks. |
| `docs/contracts/pilot-personnel-roster-reconciliation-contract-v1.md` | read | Jan-Jun roster/target/snapshot reconciliation rules. |
| `docs/plans/personnel-ranking-eligibility-and-store-me-rank-alignment-v1.md` | missing | Referenced by user, not present in current tree. |
| `docs/plans/store-me-and-rankings-visual-polish-notes-2026-07-05.md` | missing | Referenced by user, not present in current tree. |

## Summary

| Area | Status | Notes |
| --- | --- | --- |
| Workspace hygiene | pass_pr1 | Branch exists; only PR1 plan/evidence files are untracked before commit. |
| Persona access | partial evidence | Route registry and e2e contracts exist; live persona readback still needed. |
| Data completeness | runtime_readback_needed | Contract exists; Jan-Jun DB readback not yet recorded in this PR. |
| Store surfaces | partial evidence | Existing e2e coverage covers several known issues; user-reported visual/data issues remain finding candidates. |
| Admin surfaces | runtime_readback_needed | Admin auth/master-data previously touched; current live behavior not read back here. |
| Reports/export | partial evidence | Backend workbook unit test exists; staging/live Excel content issue still needs readback. |
| Session stability | partial evidence | `store-return-to.spec.ts` covers return-state; user-reported login bounce needs runtime/root-cause pass. |

## Persona Route Matrix

| Persona | Route | Expected | Current repo evidence | Status |
| --- | --- | --- | --- | --- |
| Admin | `/admin/auth` | access | Admin auth e2e specs exist; current live limit/readback not checked in PR1. | runtime_readback_needed |
| Admin | `/admin/master-data` | access | Admin routing/master-data fixture coverage exists; current jank/perf not measured. | runtime_readback_needed |
| Admin | `/admin/integrations` | access | Integration upload/spec coverage exists. | partial |
| Admin | `/admin/incentives` | access | Admin incentives export spec exists. | partial |
| Bolge Muduru | `/store` | access | Store route registry allows authenticated Store home. | partial |
| Bolge Muduru | `/store/rankings` | access | `rankingRoles` includes `REGION_MANAGER`; e2e has region-manager scoped profile action coverage. | partial |
| Bolge Muduru | `/store/kpis` | access | `storeKpiRoles` includes `REGION_MANAGER`; KPI contracts exist. | partial |
| Bolge Muduru | `/store/checklists` | access | Route requires non-personnel and `canOpenStoreChecklists`. Count/filter live behavior not checked. | runtime_readback_needed |
| Bolge Muduru | `/store/targets` | access | Target route requires role plus `canListTargetDistributionRequests`. | partial |
| Bolge Muduru | `/store/incentives` | access for company-store scope | Route access is `REGION_MANAGER` only. Load/edit/closed-period behavior not read back. | runtime_readback_needed |
| Bolge Muduru | `/store/workforce` | access | Route delegates to `canOpenStoreWorkforce`; workforce specs exist. | partial |
| Bolge Muduru | `/store/reports` | access | Reporting roles include `REGION_MANAGER`; export integrity still needs live/file readback. | runtime_readback_needed |
| Magaza Muduru | `/store/incentives` | hidden or forbidden | `canOpenStoreIncentives` returns true only for `REGION_MANAGER`; route registry excludes SM nav. | pass_repo |
| Magaza Muduru | `/store/rankings` | visible, but cannot open other personnel profiles | Registry allows rankings; non-privileged e2e asserts no `Profile Git` when `canOpenProfile=false`. | partial |
| Personel | `/store/me` | own profile access | Registry allows `STORE_PERSONNEL` and `STORE_MANAGER`. | partial |
| Personel | `/store/rankings` | visible, but cannot open other personnel profiles | Non-privileged ranking e2e asserts summary-only rows and no profile requests when backend denies. | partial |

## Repo Evidence Notes

| Area | Evidence | Meaning |
| --- | --- | --- |
| Store route registry | `admin-web/src/app/store-route-registry.ts` | Store navigation and route access are centralized; `/store/personnel/:employeeId` is route-allowed for several roles, so backend/row-level `canOpenProfile` remains the real safety gate. |
| Ranking scope | `admin-web/src/pages/store-rankings-scope.ts` | Profile opening is allowed only for own employee ID or backend `row.canOpenProfile === true`. |
| Ranking non-privileged e2e | `admin-web/e2e/store-surfaces.spec.ts` | Non-privileged personnel rows are summary-only and do not request personnel detail when backend returns `canOpenProfile: false`. |
| Personnel direct denial e2e | `admin-web/e2e/store-surfaces.spec.ts` | Forbidden personnel profile does not leak employee ID or backend denial detail. |
| Return to rankings e2e | `admin-web/e2e/store-surfaces.spec.ts` | Region manager profile navigation returns to original rankings tab/query context. |
| Ranking eligibility contract | `backend/nestjs/src/modules/store-ops/application/personnel-ranking-eligibility.contract.ts` | Current code excludes `STORE_MANAGER`, requires at least 50,000 TL net sales, and requires at least 2% store sales share. |
| KPI GSM contract | `admin-web/e2e/store-kpis-contracts.spec.ts` | Store KPI contract checks GSM Onayi and checklist contributors render without raw metric IDs; live screenshot still showed missing reference in one state. |
| Reports workbook test | `backend/nestjs/src/modules/store-ops/application/store-monthly-report-package.service.spec.ts` | Workbook opens in unit test, expected headers/rows/styles are asserted; staging/live data correctness still needs readback. |
| Session return-state e2e | `admin-web/e2e/store-return-to.spec.ts` | Several login/return-to scenarios are covered; user-reported occasional login bounce still needs runtime investigation. |

## Findings

| ID | Severity | Persona | Route/Area | Evidence | Root Cause Guess | Action |
| --- | --- | --- | --- | --- | --- | --- |
| PRA-20260707-01 | P1 | SM/Personel | Rankings -> personnel profile | User requires all ranking rows visible but no navigation to other profiles. Repo evidence shows row-level `canOpenProfile` gate and negative e2e, but route access itself includes SM/personnel. | Runtime/API row may return `canOpenProfile=true` too broadly or direct route may rely only on backend 403. | PR3 live/persona smoke plus backend/API readback; fix only if scope leak is proven. |
| PRA-20260707-02 | P1 | BM/Admin | Reports Excel | User reported downloaded Excel had wrong data. Unit test proves workbook shape, not staging data correctness. | Repository query/mapping or region-manager scope may return stale/wrong rows even though workbook generation is valid. | PR4 export readback: open generated file, compare period/store/BM/KPI/norm/visit columns. |
| PRA-20260707-03 | P1 | BM | Incentives | User reported June says month-close waiting and correction drawer cannot edit. | Close-readiness/import/target fallback or UI disabled state may not align with demo-period business expectation. | PR3/PR5 targeted readback and fix if allowed-period edit is blocked incorrectly. |
| PRA-20260707-04 | P2 | BM/SM | Store KPIs | User screenshot: GSM Onayi actual exists but score reference/source shows `Veri yok`. E2E has GSM contributor coverage with complete fixture. | Missing-reference path for live data may not use Turkey average or score-source mapping for GSM. | PR5 if same KPI surface batch; add fixture for missing-reference edge if root-caused. |
| PRA-20260707-05 | P2 | BM | Checklists | User requested filter alignment and `Ziyaretten Gecen Sure` column; BM+VM vs BM-only counts need explanation. | UI currently lacks elapsed-days column or filter alignment; count may be template/scope-derived but not clear. | PR5 checklist surface fix only after count model is explained. |
| PRA-20260707-06 | P2 | Personel/SM | Store Me | User screenshots: KPI card typography, target box alignment, trend labels, and date popover friction. | Store Me prototype/product drift and dense metric card layout. | PR5 Store Me surface polish if batched with same UI risk and tests. |
| PRA-20260707-07 | P2 | BM/Admin | Rankings | User screenshots: region-manager filter overflow, clear-filter button overflow, sidebar label should be `Turkiye Siralamasi`, reference/filter order. | Filter popover grid/wrapping and reference strip layout. | PR5 Rankings visual polish with existing rankings e2e/mobile checks. |
| PRA-20260707-08 | P1 | All pilot personas | Jan-Jun roster/targets/sales/KPI | Roster reconciliation contract exists; user says current data still feels stale if June active roster/targets not fully reconciled. | Active roster, historical leavers, targets, and snapshots may not use one consistent person universe. | PR2 data reconciliation dry-run/readback before any mutation. |
| PRA-20260707-09 | P2 | BM | Incentives load performance | User reported first open waits several seconds. | Query fan-out, blocking all-data load, missing placeholder/cache, or slow backend. | PR3/PR5 measure request waterfall; fix only if root cause is frontend/code-level and scoped. |
| PRA-20260707-10 | P1 | All | Login/session bounce | User reported navigating can drop to login and stay until refresh. Existing return-to tests cover some cases but not live bounce. | Session refresh race, stale auth cache, token expiry handling, or browser storage edge. | PR3 read-only runtime investigation first; fix only with root cause and negative test. |
| PRA-20260707-11 | P2 | BM | Store KPIs region header | User requested lucide icon and compact header matching date controls. | Header panel too large relative to control chips. | PR5 if grouped with KPI visual fixes. |
| PRA-20260707-12 | P2 | BM | Incentives row separators/header | User screenshot: row white separator noise, top section too large, missing metric icons, extra section title. | Prototype/product drift in incentives surface. | PR5 if incentives UI batch remains single-surface. |
| PRA-20260707-13 | P2 | BM/SM | Checklist fill modal | User reported checklist action sometimes opens read-only content. | Action may route to result/summary state instead of fillable session for draft/new checklist. | PR3 if workflow-critical; verify against current checklist status data first. |

## Resolution Log

| Finding ID | Status | Evidence | Notes |
| --- | --- | --- | --- |
| PRA-20260707-03 | fixed_data_readback | `docs/evidence/pilot-readiness/2026-07-07-incentive-june-close-readback.md` | Haziran close lock root cause was missing store-level targets for two company stores. Source targets were inserted into `ops.kpi_target`; existing close flow rebuilt June with 33 store snapshots and 127 final rows. |
| PRA-20260707-02 | fixed_code_readback | `docs/evidence/pilot-readiness/2026-07-07-reports-ranking-score-readback.md` | Store report export now maps scores from the central ranking score service and strips `Bolgesi` fallback manager names. Remaining turnover anomaly is recorded as data-hygiene risk. |
| PRA-20260707-05 / PRA-20260707-13 | current_readback_not_reproduced | `npm.cmd --prefix admin-web run test:e2e -- checklist-session-modal-policy.spec.ts store-checklists-contracts.spec.ts checklist-month-filter.spec.ts` | Current DB/code readback shows Onur Kaytan-style BM action scope has 30 assigned stores and both BM/VM published templates cover all 30 stores. Targeted checklist e2e passed, including BM-only filter retaining assigned store population and fill modal policy. No code fix applied without runtime reproduction. |
| PRA-20260707-10 | current_e2e_pass | `npm.cmd --prefix admin-web run test:e2e -- store-return-to.spec.ts`; `npm.cmd --prefix admin-web run test:e2e -- auth-cookie-session.spec.ts integration-upload-csrf.spec.ts` | Return-to, cookie session creation/rotation, and stale CSRF recovery tests pass after rerun. User-side public/private access change should be rechecked live; if login bounce repeats, capture browser console/network trace before code change. |
| PRA-20260707-08 | verified_current_readback | `docs/evidence/pilot-readiness/2026-07-07-data-reconciliation-readback.md` | Public DB connection rerun completed on 2026-07-07. Jan-Jun monthly snapshot runs, store KPI snapshot coverage, personnel target reference coverage, monthly net sales actual coverage, ranking eligibility split, active assignment position split, and norm kadro demo readback were rechecked without DB mutation. |

## Data Readback Matrix

This PR records the readback requirements. It does not mutate DB data.

| Domain | Required readback | Status |
| --- | --- | --- |
| Store count Jan-Jun | ranking stores, company stores, region assigned stores, KPI actual stores, target stores | verified_PR2 |
| Personnel target/sales Jan-Jun | active personnel, personnel with sales, personnel with target, store target | verified_PR2 |
| Ranking eligibility | excluded store managers, excluded under 50,000 TL, excluded under 2% share, visible ranked personnel | verified_PR2 |
| Norm kadro | active/norm/status/missing days/turnover for demo stores | verified_PR2 |
| Reports Excel | file opens, period, rows, BM names, KPI columns, target/incentive/norm/visit columns | pending_PR4 |
| Persona smoke | Admin, BM, SM, Personel route allow/deny and visible names | pending_PR3 |

## PR Split Decision

| PR | Can start now? | Dependency |
| --- | --- | --- |
| PR1 Audit Evidence | yes | This file and mandatory docs verification. |
| PR2 Data Reconciliation | after PR1 | Must reference PRA-20260707-08 and produce dry-run/readback counts before mutation. |
| PR3 Persona/Critical Flow | after PR1 | Must reference P1 findings PRA-20260707-01, 03, 10, 13 as applicable. |
| PR4 Reports Export Integrity | after PR1 | Must reference PRA-20260707-02. |
| PR5 Store Surface Pilot Polish | after PR1 and after P1 work is not blocked | Must batch only same-surface/same-risk P2 findings. |
| PR6 Closeout/Runbook | after PR2-PR5 or explicit parked-risk decision | Must update `current-state.md` and active next action. |

## Verification Plan For PR1

Required before PR:

```powershell
npm.cmd run test:scripts
git diff --check
```

No frontend/backend runtime code is changed in PR1.

Result:

| Command | Result | Notes |
| --- | --- | --- |
| `npm.cmd run test:scripts` | pass | 498 tests passed, 0 failed. |
| `git diff --check` | pass | No whitespace errors. |
| Secret scan on PR1 docs | pass | Matches were policy text only; no secret values recorded. |
