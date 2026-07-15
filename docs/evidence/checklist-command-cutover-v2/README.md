# Checklist Command Canvas Cutover V2 Closeout

Date: 2026-07-15

Production route: `/store/checklists`

Accepted source: `D:\hr-axis-external-lab\prototypes\store-checklists-three-concepts-v1`

P7 implementation SHA before this owner-override evidence amendment:
`77c00844da33ce09bf2224aeef2a489dbf4bf4cb`

Overall status: `Prototype parity: OWNER-ACCEPTED AND CLOSED - automated
parity is GO; physical-device evidence is an explicitly accepted residual
risk; merge and post-merge verification are complete`

Automated parity status: `GO`

This document closes the repository-side evidence inventory for the approved
Command Canvas cutover. It does not represent Playwright viewport emulation as
real iOS Safari or Android Chrome evidence.

## Delivery lineage

| Slice | Pull request | Merged SHA | Result |
| --- | --- | --- | --- |
| Region Manager visits baseline | #985 | `423d30e9` | merged |
| Weekly plan schema | #986 | `6ba1cf35` | merged |
| Weekly plan API | #987 | `6ae54632` | merged |
| P1A workflow ownership | #988 | `78934799` | merged |
| P2 bounded period reads | #989 | `3a958309` | merged |
| P2B scoped planning regions | #990 | `e6ba7e15` | merged |
| P3 weekly and full-period Plan UI | #991 | `e02d4f0a` | merged |
| P4 operational history API | #992 | `6e2cceea` | merged |
| P1B Command workflow overlays | #994 | `edf068a2` | merged |
| P5 Records and Report Viewer | #995 | `aa6d4529` | merged |
| P6 Store Manager surface | #996 | `8a9b74b9` | merged |
| P7 global cutover and deletion | #997 | `40d2617e` | merged |

## Production component map

| Accepted surface or behavior | Production owner |
| --- | --- |
| Authenticated persona selection | `StoreChecklistsPage` plus backend command-scope capabilities |
| Shared page frame and period | `StoreSurfacePage` and `ChecklistCommandPeriodPicker` |
| Liquid three-view switch | `RegionManagerChecklistCommandPage` |
| Region Manager visit metrics, filters, sort and pagination | `RegionManagerChecklistCommandPage` with generated Command API types |
| Monday-Saturday weekly board and draft dialog | `ChecklistWeeklyVisitPlanner` and Radix Dialog |
| Explicit multi-region planning context | `ChecklistPlanningRegionPicker` |
| Full-period Plan metrics, search, sort and rows | `ChecklistVisitPlanSurface` |
| Store records list | `RegionManagerRecordsSurface` |
| Living Store Record and incremental event detail | `ChecklistOperationalHistoryDrawer` |
| Report Viewer company/region/store readback | `ReportViewerChecklistCommandPage` |
| Store Manager authorized-store surface | `StoreManagerChecklistCommandPage` |
| Visual Merchandiser assigned-store execution | `VisualMerchandiserChecklistCommandPage` |
| Super Admin Command execution surface | `SuperAdminChecklistCommandPage` |
| Checklist start/resume/save/complete/result/acknowledgement | `ChecklistWorkflowCommandOverlay` and `useChecklistWorkflowController` |
| Old-link normalization without legacy DOM | `checklist-workflow-route-state` |
| Deep-link producers | Store Home command model and backend workflow-inbox contracts |

All visible values use generated API contracts or existing authenticated
workflow state. Prototype role switching, fixture stores, fixture metrics and
prototype navigation are absent from production.

## Role contract disposition

| Persona | Read boundary | Mutation boundary | Evidence |
| --- | --- | --- | --- |
| Report Viewer | assigned company, expandable regions and stores | none; plan/history/checklist mutations are unavailable | P5 screenshots, persona E2E and backend negative scope tests |
| Region Manager | assigned regions and stores | weekly plan plus authorized BM checklist workflow | P3/P5 screenshots, planner and workflow suites |
| Store Manager | every explicitly authorized managed store | existing acknowledgement/task capabilities only | P6 screenshots and persona E2E |
| Visual Merchandiser | assigned stores | VM checklist execution only; no BM card or planning | P7 screenshots and VM-only E2E |
| Super Admin | server-authorized Command scope | existing checklist execution; no implicit weekly-plan grant | P7 screenshots and precedence tests |

Mixed-role precedence is fail-closed and resolves
`REPORT_VIEWER > REGION_MANAGER > SUPER_ADMIN > STORE_MANAGER > VISUAL_MERCHANDISER`.

## Side-by-side visual sources

### Visits

Accepted source copies:

- `accepted-prototype/current-region-manager-1440.png`
- `accepted-prototype/current-region-manager-1024.png`
- `accepted-prototype/current-region-manager-mobile-390.png`

Production comparisons:

- `../checklist-command-canvas-visits-parity-v1-2026-07-14/region-manager-command-canvas-desktop.png`
- `../checklist-command-canvas-visits-parity-v1-2026-07-14/region-manager-command-canvas-tablet-1024.png`
- `../checklist-command-canvas-visits-parity-v1-2026-07-14/region-manager-command-canvas-mobile-390.png`
- `../checklist-command-canvas-visits-parity-v1-2026-07-14/region-manager-command-canvas-mobile-320.png`

### Weekly and full-period Plan

The four explicit prototype/production pairs, one-pixel landmark contract and
`maxDiffPixelRatio <= 0.005` disposition are recorded in
`../checklist-command-canvas-plan-parity-v1-2026-07-14/README.md`.

The 2026-07-15 dialog parity repair is captured in:

- `accepted-prototype/weekly-plan-dialog-desktop.png`
- `p7/weekly-plan-dialog-desktop.png`
- `p7/weekly-plan-dialog-mobile-390.png`

The repair moved the Command Canvas semantic tokens onto the Radix portal
content itself. Before that change, the portal sat outside the page token scope
and rendered the active day, borders and disabled save action without the
accepted plum/cyan treatment.

### Records and Living Store Record

Accepted source copies:

- `accepted-prototype/record-desktop.png`
- `accepted-prototype/record-mobile.png`
- `accepted-prototype/record-detail-desktop.png`

Production comparisons:

- `p5/region-manager-records-desktop.png`
- `p5/region-manager-records-1024x768.png`
- `p5/region-manager-records-390x844.png`
- `p5/region-manager-records-320x844.png`
- `p5/living-store-record-mobile-320.png`

### Workflow overlay

Accepted source copies:

- `accepted-prototype/canvas-session-desktop.png`
- `accepted-prototype/canvas-session-mobile.png`

Production behavior and layout are pinned by the 22-case checklist
persona/overlay E2E suite. The overlay uses the canonical Command surface and
does not mount a legacy page.

The 2026-07-15 parity repair replaced the centered workflow popup with the
accepted right-side, full-height Focus Dock geometry. It also routes
`Checklist yap`/`Devam et` to the visit workflow and `Sonucu gör` to the
store-scoped result history instead of showing the visit selector for both
actions. Fresh comparisons:

- `p7/workflow-drawer-desktop.png`
- `p7/workflow-drawer-mobile-390.png`
- `p7/result-drawer-desktop.png`

### Additional personas

- Store Manager: `p6/store-manager-{1440x900,1024x768,390x844,320x844}.png`
- Visual Merchandiser: `p7/visual-merchandiser-{1440x900,1024x768,390x844,320x844}.png`
- Super Admin: `p7/super-admin-{1440x900,1024x768,390x844,320x844}.png`

## Intentional production dispositions

- The prototype role/comparison switcher and fixture data are removed.
- The prototype mark is replaced by the authenticated HR Axis/Lufian shell.
- Report Viewer is a real read-only company hierarchy rather than a simulated
  role mode.
- Store Manager supports every explicitly authorized managed store; it does
  not assume exactly one or exactly 30 stores.
- Visual Merchandiser uses the accepted Command density while exposing only
  its VM execution capability. The BM card and weekly planning are absent.
- Super Admin receives no implicit weekly planning authority.
- Product shell feedback chrome remains because it is an authenticated shared
  application control, not a prototype helper.
- Test-only deterministic route fixtures exist only in Playwright routing and
  do not ship as product data.
- `Tamamlanmış ziyaret yok` now uses the accepted 8px visit-helper rhythm;
  it no longer inherits the 16px browser/container default.
- The Visit Plan period table now preserves the full active Region Manager
  store scope, including low-risk stores with no plan. Risk remains an
  independent priority signal instead of a row-admission rule.
- Visit timing is explicit in the Istanbul business timezone: a future date is
  `Ziyaret Planlandı`, today is `Ziyaret Bekleniyor`, a completed checklist is
  `Ziyaret Tamamlandı`, and an elapsed date without a checklist remains the
  truthful red `Checklist yapılmadı` state. Only a store with no item in the
  selected period is `Plan yapılmadı`.
- Period and weekly navigation now move together, preventing an independently
  selected week from silently presenting its items as part of another month.

No unexplained repository-side visual or interaction deviation is open.

## Requirement audit

| Requirement group | Authoritative evidence | Disposition |
| --- | --- | --- |
| FR-1..FR-5 persona routing and role surfaces | route/persona E2E, backend precedence/scope tests, P5-P7 screenshots | proven automatically |
| FR-6 weekly plan and real completion | merged schema/API tests, P3 plan E2E and parity evidence | proven automatically |
| FR-7 Living Store Record | P4 API contracts, cursor/privacy tests and P5 drawer evidence | proven automatically |
| FR-8 workflow lifecycle | 22-case overlay/persona E2E and controller extraction equivalence | proven automatically |
| FR-9..FR-10 link migration and legacy removal | route-state unit tests, ownership guard, tracked-source and built-bundle residue audits | proven automatically |
| FR-11..FR-13 honest states and retained rows | persona/state E2E, retained-data query behavior and local column-state tests | proven automatically |
| NFR-1..NFR-2 geometry and overflow | four-viewport screenshots, landmark assertions and overflow checks | proven automatically; physical browser pending |
| NFR-3 scale | 1/20/35/200 and pagination/cursor contracts | proven automatically; real-device 35+ pending |
| NFR-4 authorization | backend cross-scope and persona negative tests | proven automatically |
| NFR-5 accessibility | keyboard, focus, Escape, outside-click and reduced-motion tests | proven automatically; physical keyboard pending |
| NFR-6..NFR-7 data truth and query budgets | generated contracts plus backend source/query tests | proven automatically |
| NFR-8 clean cutover | source, selector, import and built-bundle audits return zero legacy runtime residue | proven automatically |
| NFR-9 interaction continuity | delayed-response retained-row E2E and local column updates | proven automatically |
| EC-1..EC-10, EC-12..EC-13 | targeted planner, role, route-state, cache and error-state suites | proven automatically |
| EC-11 mobile software keyboard | real iOS Safari and Android Chrome | pending external evidence |
| AC-1..AC-8, AC-10..AC-13 | merged slice tests, screenshots, audits and P7 canonical release | proven automatically |
| AC-9 real-device portion | physical device matrix below | pending external evidence |

## Automated closeout receipts

- Exact implementation SHA canonical release: PASS, 417/417 in 10 minutes 7
  seconds on `77c00844`.
- Final owner-override amendment SHA root release: PASS in 12 minutes 47
  seconds on `90fdaf06`.
- Script contracts: 623/623.
- Backend release suite: 228 suites / 1393 tests.
- Checklist persona/overlay E2E: 22/22.
- 2026-07-15 dialog, workflow, result and responsive regression set: 50/50.
- 2026-07-15 Visit Plan scope/status regression: 25/25 E2E plus 16/16 backend
  contract/repository tests and 10/10 frontend model tests.
- Route-state unit suite: 9/9.
- Ownership/UI guards: 12/12.
- Focused backend scope/remediation/workflow: 17/17.
- Tracked runtime legacy residue: zero.
- Built bundle legacy residue: zero.
- Required GitHub aggregate, Vercel deployment and mergeability: green on the
  implementation SHA.
- GitHub Codex review: disabled and not requested.

## Merge and deployed closeout

- PR #997 was squash-merged on 2026-07-15 as
  `40d2617eb021bf18bd08d85bdc197d100bf2c8e8`.
- The merge commit is the exact `origin/main` head verified in a clean main
  worktree.
- Post-Merge Verification run `29409363238`: PASS.
- Merge-SHA Release Rehearsal run `29409363055`: PASS, including the bounded
  backend/Docker rehearsal selected for the merged backend scope.
- Vercel deployment for the merge SHA: PASS.
- Controlled staging deployed-readiness smoke at
  `2026-07-15T10:51:35.883Z`: 13 passed, 0 failed, 1 skipped. Frontend root,
  SPA fallback, deployed assets, security headers, backend live/dependency
  health, rate-limit/correlation headers, verified database TLS and durable
  Redis/BullMQ all passed.
- The skipped readiness item was protected `/api/auth/session` because no
  bearer token was supplied. It is not reported as passed. The owner directed
  real-device/auth observation to continue through ordinary controlled-pilot
  use rather than remain a P7 merge gate.

## Physical-device residual risk

The following checks were not completed from the PR preview. Device emulation
is not represented as physical proof.

| Device/browser | Planner and mobile keyboard | 35+ store list | Long history and nested detail | Focus Dock | Result |
| --- | --- | --- | --- | --- | --- |
| Physical iPhone / Safari | pending | pending | pending | pending | pending |
| Physical Android / Chrome | pending | pending | pending | pending | pending |

Record only device/browser family, result and sanitized observation. Do not
record credentials, store names, personnel data or raw identifiers.

On 2026-07-15 the product owner explicitly removed these physical-device rows
as a merge gate and directed P7 to merge after the already-green automated
parity, canonical release and mergeability gates. The first physical attempt
also exposed a Preview-only API-base/CORS/cross-site-cookie configuration gap;
that Preview environment issue is not presented as product-code parity proof.
The owner accepted the remaining real-device risk for observation during
ordinary controlled-pilot use. This override does not claim that iOS Safari or
Android Chrome testing passed and does not weaken production cookie-session,
authorization, privacy or data-integrity controls.

## Closeout disposition

P1-P7, final checks, squash merge, merged-SHA verification and the controlled
post-merge deployed smoke are complete. No checklist-cutover implementation PR
remains. The only residual item is the explicitly owner-accepted physical
mobile/auth observation during normal controlled-pilot use; the pending rows
above remain honest and must not be rewritten as PASS without real evidence.
