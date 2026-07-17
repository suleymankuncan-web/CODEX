# Store Operational Surfaces Parity Gap Audit

Date: 2026-07-17
Status: `LOCAL_PARITY_REPAIRED_STAGING_RECERTIFICATION_PENDING`

This audit records the material prototype-to-production differences found
after the first protected staging read. It overrides the earlier visual PASS
assumption. PR #1014 must not become ready or merge until every item below is
fixed and recaptured.

Locked source:

- `D:\hr-axis-external-lab\prototypes\store-operations-command-canvas-v1`
- `docs/evidence/store-operational-surfaces-command-canvas/prototype-digest-manifest-v1.json`

Production evidence under review:

- `docs/evidence/store-command-canvas-parity/kpis/`
- `docs/evidence/store-command-canvas-parity/approvals/`
- `docs/evidence/store-command-canvas-parity/workforce/`
- `docs/evidence/store-command-canvas-parity/tasks/`

## KPI Özetleri — FAIL

Observed production still uses the former Region Performance composition:

- heading is `Bölge Performansı` instead of the locked `KPI Özetleri`;
- three large summary cards replace the compact four-column decision rail;
- the prototype search, score and risk controls are absent from the same
  command position;
- the store directory is visually narrower and less dense than the locked
  table;
- spacing, card height and information rhythm materially differ from the
  accepted desktop and mobile captures.

Required correction:

- use the locked compact page header and period placement;
- render four equal decision-rail cells with stable geometry;
- preserve the locked search, score, risk and column-sort interactions;
- retain real API fields, null semantics, bounded pagination and role scope;
- do not restore Labs chrome, fixtures or role controls.

## Talep Merkezi — FAIL

Observed production still uses the former request-center composition:

- oversized icon/title treatment replaces the compact header;
- four tall standalone cards replace the single compact decision rail;
- filters and the result panel use materially different height, spacing and
  control rhythm;
- table density and section framing do not match the locked prototype.

Required correction:

- use the locked compact header, period placement and four equal rail cells;
- preserve metric filtering without remount or unrelated refetch;
- match the locked search/filter/sort/tab and dense result-table composition;
- retain authoritative request status, waiting duration, next owner, role
  hierarchy, drawer audit and mutation silence.

## Norm Kadro — REVIEW REQUIRED

The production surface is structurally closer to the locked prototype, but the
final capture must still prove:

- compact header and period placement;
- equal, fixed-size four-cell decision rail;
- locked search/status toolbar density;
- dense table rhythm at all four viewports;
- no layout shift when a rail metric, filter or sort changes.

No PASS may be recorded from route availability or overflow checks alone.

## Görevler — FAIL

Owner-observed production behavior:

- decision-rail cells are larger than the locked prototype;
- selecting a metric changes the rail/card geometry.

Required correction:

- four equal cells at desktop with the locked compact height;
- stable `getBoundingClientRect()` width and height before and after every
  metric selection;
- active state may change border, background and indicator only;
- selection must filter the retained scoped dataset without remount, blank
  state, unrelated refetch or horizontal overflow;
- mobile reflow may change column count at the locked breakpoint, but a click
  must never change geometry within the same viewport.

## Verification contract

The repaired closeout requires all of the following:

1. source/DOM contract tests for the locked header, rail, toolbar and data-list
   ownership;
2. computed rail and card rectangles captured before and after every metric
   click, with zero geometry delta at a fixed viewport;
3. desktop captures at 1440x900 and 1024x768;
4. mobile captures at 390x844 and 320x844;
5. deterministic role tests for Report Viewer, Region Manager and Store
   Manager where the route is authorized;
6. protected staging read evidence with zero mutation requests;
7. a human visual comparison against the locked captures;
8. separate `Prototype parity: PASS` decisions only after the corresponding
   route satisfies all preceding evidence.

The earlier route-heading, successful-read and no-overflow smoke remains useful
runtime evidence, but it is not sufficient visual parity evidence.

## Remediation result

The findings above are retained as the reason for the repair. The current
implementation now has one shared geometry contract instead of four
page-specific interpretations:

| Surface | Current local decision | Evidence |
| --- | --- | --- |
| KPI Özetleri | `PASS_LOCAL` | compact header, four-cell rail, search/filter/sort, dense store list, 1440/1024/390/320 proof |
| Talep Merkezi | `PASS_LOCAL` | compact header, four-cell rail, dense filters/table, Report Viewer read-only proof, 1440/1024/390/320 proof |
| Norm Kadro | `PASS_LOCAL` | shared four-cell rail, store/region/viewer hierarchy, personnel history drawer, 1440/1024/390/320 proof |
| Görevler | `PASS_LOCAL` | shared four-cell rail, dense task list, role-safe drawer, 1440/1024/390/320 proof |

Shared decision-rail rule:

- desktop breakpoint is `1025px`;
- desktop has four equal `minmax(0, 1fr)` columns;
- every desktop cell is exactly `84px` high;
- active state may change only paint properties and the bottom indicator;
- every route test records each cell's `getBoundingClientRect()` before
  selection and after selecting all four metrics;
- width and height arrays must remain byte-for-byte equal at the same viewport;
- the page grid uses content-sized rows so the shell cannot stretch compact
  rails, filter bars or result panels into legacy-sized blocks.

The geometry assertions now run in:

- `admin-web/e2e/store-kpis-contracts.spec.ts`;
- `admin-web/e2e/store-approvals-parity-evidence.spec.ts`;
- `admin-web/e2e/store-workforce-parity-evidence.spec.ts`;
- `admin-web/e2e/store-tasks-parity-evidence.spec.ts`.

Local proof completed:

- KPI visual contract: `4/4` passed;
- complete KPI contract, including mobile sorting and bounded paging: `24/24`
  passed;
- Talep Merkezi parity: `5/5` passed;
- Norm Kadro and Görevler parity: `20/20` passed;
- frontend lint: passed;
- frontend production build: passed.

Closeout remains gated until the repaired PR head is pushed, CI is green, and
the protected staging read is repeated against that exact deployed SHA. Only
then may this document move from `PASS_LOCAL` to final prototype parity PASS.
