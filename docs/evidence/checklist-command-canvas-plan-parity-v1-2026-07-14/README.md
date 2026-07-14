# Checklist Command Canvas Plan Parity Evidence

Date: 2026-07-14
Production branch: `codex/checklist-command-canvas-ui-v1`
Accepted source: `D:\hr-axis-external-lab\prototypes\store-checklists-three-concepts-v1`

## Scope

This evidence covers P3 only: the Region Manager full-period Plan view,
Monday-Saturday weekly planner, planning dialog and production shell geometry.
The screenshots use deterministic route fixtures; production components do not
contain prototype stores, role switching or fabricated metrics.

## Component translation

| Accepted contract | Production mapping |
| --- | --- |
| Command Canvas page frame | `StoreSurfacePage` plus checklist-only compact `StoreShell` rail |
| Month/year control | `ChecklistCommandPeriodPicker` |
| Liquid view control | `canvas-view-switch`, driven by authenticated Region Manager surface state |
| Three decision metrics | server-returned Plan metrics in `ChecklistVisitPlanSurface` |
| Monday-Saturday board | `ChecklistWeeklyVisitPlanner` using the revision GET/PUT contract |
| Weekly planning overlay | Radix Dialog with local draft, focus containment and dirty-close confirmation |
| Plan search and controls | retained React Query data plus server-side risk/status/sort filters |
| Plan rows and replan drawer | server-paged period rows plus Radix drawer |
| Icons | Lucide only |

## Mechanical geometry contract

The prototype was measured live at the four accepted viewports. The Playwright
test fixes the browser clock and asserts every landmark below with a maximum
absolute delta of one CSS pixel.

| Viewport | Content width | Title y / h | Metrics y / h | Week y / h | Plan surface y |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1440x900 | 1064.81 | 42 / 66.09 | 138.09 / 66 | 218.09 / 232 | 464.09 |
| 1024x768 | 878.09 | 18 / 66.09 | 114.09 / 66 | 194.09 / 392 | 600.09 |
| 390x844 | 362 | 24 / 88.5 | 142.5 / 53 | 209.5 / 657 | 880.5 |
| 320x844 | 292 | 24 / 88.5 | 142.5 / 53 | 209.5 / 657 | 880.5 |

`checklist-command-canvas.spec.ts` also stores stable full-page snapshots with
`maxDiffPixelRatio: 0.005`, disables animations and proves document overflow is
at most one CSS pixel.

The stable snapshots are production regression baselines; they are not, by
themselves, evidence of prototype parity. Prototype parity is established for
P3 by the live prototype landmark measurements above plus the explicit manual
pair review below. Global page parity remains open until P5 adds Records and
P7 performs the final cutover audit.

## Side-by-side sources

Each viewport has an explicit pair in this directory:

- `prototype-plan-1440x900.png` / `production-plan-1440x900.png`
- `prototype-plan-1024x768.png` / `production-plan-1024x768.png`
- `prototype-plan-390x844.png` / `production-plan-390x844.png`
- `prototype-plan-320x844.png` / `production-plan-320x844.png`

Manual comparison verdict for the P3 Plan slice: **PASS with the intentional
production dispositions listed below**. The frame, information density,
typography hierarchy, palette, weekly-board placement, Plan toolbar and
desktop/mobile responsive structure match the accepted source. Full-page
pixel identity is neither claimed nor expected because production uses real
shell chrome and deterministic API fixtures rather than prototype-only
controls and data.

## Intentional production dispositions

- The prototype `H` mark is replaced by the real Lufian shell mark.
- Prototype role-preview controls are excluded by product and authorization
  policy.
- Prototype fixture stores, counts and actors are excluded. Test-only route
  fixtures make the visual and interaction evidence deterministic.
- The prototype `Sorumlu` Plan column is excluded by the owner's later locked
  decision: a Region Manager already operates in their own assigned scope.
- `Mağaza kayıtları` remains a named P5 surface, so P3 does not ship a fake or
  empty records view merely to fill the third switch position.
- The existing feedback affordance remains authenticated product shell chrome;
  it is not copied from the prototype.

These are scoped, documented product differences. Typography, palette,
density, landmark geometry, weekly interaction and Plan controls remain bound
to the accepted Command Canvas contract.

## Remaining train gate

Automated 320/390 mobile viewport, keyboard, focus containment, Escape and
horizontal-overflow evidence belongs to P3 and is recorded here. Physical iOS
Safari and Android Chrome verification of the planner, 35+ stores, long audit
history and mobile keyboard remains an explicit P7 closeout gate; it is not
represented as completed by these desktop Playwright runs.

## CI platform baselines

The accepted visual assertion is stored separately for Chromium on Windows
and Linux at all four viewports. The Linux files were taken from required-gate
run `29370153619` after the first CI execution proved that only the platform
baseline was absent: the other 405 Playwright cases passed. All four Linux
actuals were inspected before acceptance; they preserve the same product
content, geometry and responsive state and differ only through platform
rendering. Windows baselines remain unchanged.
