# GSM Onay KPI And Store Surface Fixes V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three active Store UI regressions and add `GSM_ONAY` as a real store KPI that contributes 5% to store score and appears in Rankings, Store KPIs, and Region Manager KPI views.

**Architecture:** Split the work into a UI bugfix PR, a backend KPI/import/scoring PR, a frontend KPI visibility PR, and a final verification PR. GSM Onay must enter through the KPI catalog, import normalization/materialization, and score profile config; it must not be hard-coded into one page.

**Tech Stack:** React, TypeScript, NestJS, PostgreSQL migrations, `ops.kpi_actual`, KPI score profile config, existing integration import pipeline, OpenAPI generation, Playwright, Jest, HR Axis Store UI discipline.

---

## Reader And Post-Read Action

**Reader:** An internal HR Axis engineer or agentic worker starting from a clean `main` worktree with no memory of the conversation.

**Post-read action:** Execute the PR train safely, in order, without changing unrelated workflows or inventing new data.

## Locked Product Decisions

- `GSM_ONAY` means the monthly store-level GSM approval percentage from the uploaded GSM report.
- The supplied report `Ocak GSM.xlsx` has one sheet named `Export` with columns `Mağaza Kodu`, `Mağaza Adı`, and `Gsm Onay %`.
- `Gsm Onay %` values are stored as decimal ratios in the file, for example `0.9120521172638436` means `%91,21`.
- Store matching must prefer `Mağaza Kodu`; store name matching is only a secondary fallback with an explicit unmatched-row report.
- `GSM_ONAY` contributes `5` points of store score weight.
- Store score weights become:

| Metric | Weight |
| --- | ---: |
| `TARGET_ACHIEVEMENT` | 35 |
| `CR` | 20 |
| `ATV` | 15 |
| `UPT` | 15 |
| `BM_CHECKLIST` | 5 |
| `VM_CHECKLIST` | 5 |
| `GSM_ONAY` | 5 |

- Rankings store list shows `GSM Onayı` instead of the old store action column.
- Rankings store detail drawer/sheet is removed for store rows. Personnel list behavior stays unchanged.
- `/store/workforce` keeps the current detail workflow, but the row/table must not overflow and the action area must fit.
- `/store/incentives` final prim amount input must allow normal typing such as `1500000`, then normalize to `1.500.000,00` on blur/save without corrupting the edit string.

## Non-Goals

- Do not change incentive formulas, close rules, company-store-only rules, or cashier visibility.
- Do not change auth, role, scope, store assignment, or permission semantics.
- Do not change checklist scoring or checklist workflow.
- Do not create fake GSM values for stores without imported GSM rows.
- Do not globally redesign Store pages.
- Do not remove the workforce detail modal; only fix overflow and alignment.
- Do not change personnel rankings detail behavior.

## Current Evidence

Excel sample validation:

```text
sheet=Export
headers=['Mağaza Kodu', 'Mağaza Adı', 'Gsm Onay %']
data_rows=148
numeric_values=145
null_values=3
min=0.011235955056179775
max=0.9715639810426541
avg=0.555613101660301
sample=('SM182', 'Balıkesir 10 Burda AVM', 0.9120521172638436)
```

Code evidence:

- KPI config already has a future-metric rule: new GSM approvals must be added through the KPI catalog and score profile.
- `ops.kpi_actual` already supports store-scoped monthly KPI rows.
- Ranking service reads score profile metric codes dynamically, but ranking DTO/frontend sort allowlists and visible metric lists must be updated.
- Existing Power BI store upload columns are sales-focused; the GSM file shape is different and needs an explicit import path or header-detected branch.
- Store Rankings currently renders a store action column and a store `RankingDetailDrawer`.
- Store Workforce current fixed grid can squeeze the action column out of the visible area.
- Store Incentives currently formats the final amount value on every keypress.

## PR Train

### PR1: UI Regression Fixes Only

**Risk Class:** R1 UI-only.

**Contract Impact:** intentionally unchanged.

**Files:**

- Modify: `admin-web/src/pages/store-workforce-region-view.tsx`
- Modify: `admin-web/src/pages/store-workforce-region-view-model.ts`
- Modify: `admin-web/src/styles/store-workforce-command-list.css`
- Modify: `admin-web/src/styles/store-workforce-command.css`
- Modify: `admin-web/src/styles/store-workforce-command-modal.css`
- Modify: `admin-web/src/pages/store-incentives-region-manager-sheet.tsx`
- Modify: `admin-web/src/pages/store-incentives-region-manager-format.ts`
- Test: `admin-web/e2e/store-incentives-projection.spec.ts`
- Test: `admin-web/e2e/store-surfaces.spec.ts`

#### Task 1.1: Characterize Workforce Overflow

- [ ] Capture the current `/store/workforce` Region Manager table at desktop width and at mobile width.
- [ ] Confirm the row grid has a visible action area and does not place `Detay` outside the viewport.
- [ ] Record the expected row anatomy in a short implementation note inside the PR body:

```text
Workforce row columns: Mağaza, Aktif personel, Norm/Fiili, Durum, Eksik gün, Turnover, Aksiyon.
Detail workflow remains available through the existing Detay control.
The row must fit in the Store shell without horizontal page overflow.
```

#### Task 1.2: Fix Workforce Row Layout

- [ ] Update the row/header grid in `store-workforce-command-list.css` so the action column has a stable minimum width and the row can shrink without pushing the action control out of the shell.
- [ ] Keep the column header and row values aligned by using one shared grid template for `.swc-ledger-head` and `.swc-store-row`.
- [ ] Keep metric icon boxes centered with:

```css
display: inline-flex;
align-items: center;
justify-content: center;
```

- [ ] Preserve selected row and detail modal behavior.
- [ ] Do not remove the `Detay` action from workforce.

#### Task 1.3: Fix Incentive Final Amount Editing

- [ ] Change the Region Manager incentive sheet so the input keeps a raw editing string while focused.
- [ ] Normalize and format only on blur, reset, save, and sheet/person switch.
- [ ] Keep validation based on the normalized value from `normalizeMoneyInput`.
- [ ] The input behavior must pass this edit sequence:

```text
focus empty field
type 1
type 5
type 0
type 0
type 0
type 0
type 0
blur
visible value becomes 150.000,00
normalized submitted value becomes 150000.00
```

- [ ] The input behavior must also pass this edit sequence:

```text
focus existing 31.268,04
select all
type 1500000
blur
visible value becomes 1.500.000,00
normalized submitted value becomes 1500000.00
```

#### Task 1.4: Add Frontend Regression Coverage

- [ ] Add or update a Playwright test that fills the final prim amount with `1500000` and asserts the field does not become `1.500000`.
- [ ] Add or update a Playwright assertion that workforce Region Manager rows do not overflow the main viewport.
- [ ] Keep tests mocked to existing API shapes.

#### Task 1.5: Verify PR1

- [ ] Run `npm.cmd --prefix admin-web run lint`.
- [ ] Run `npm.cmd --prefix admin-web run build`.
- [ ] Run the targeted incentives e2e spec.
- [ ] Run the targeted store surfaces e2e coverage for workforce.
- [ ] Run `git diff --check`.
- [ ] PR body must state `Contract Impact: intentionally unchanged`.

### PR2: GSM Onay KPI Catalog, Import, And Score Profile

**Risk Class:** R5 DB/import/scoring.

**Contract Impact:** changed intentionally: new store KPI code `GSM_ONAY`, new upload handling for GSM approval report, and store score profile weights.

**Files:**

- Modify: `db/migrations/015_operational_kpi_definitions.sql`
- Modify: `db/seeds/001_reference_seed.sql`
- Modify: `db/schema.sql`
- Modify: `db/migrations/011_kpi_score_profile_config.sql`
- Modify: `backend/nestjs/src/modules/store-ops/application/kpi-config.contract.ts`
- Modify: `backend/nestjs/src/modules/integration/application/kpi-import-normalization.service.ts`
- Modify: `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.ts`
- Modify: `backend/nestjs/src/modules/integration/application/integration-payload-template.helpers.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/dto/get-ranking.query.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/performance-score-evaluator.service.ts`
- Test: `backend/nestjs/src/modules/integration/application/kpi-import-normalization.service.spec.ts`
- Test: `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.spec.ts`
- Test: `backend/nestjs/src/modules/store-ops/application/performance-score-evaluator.service.spec.ts`
- Test: `backend/nestjs/src/modules/store-ops/application/ranking.service.spec.ts`
- Test: `backend/nestjs/src/modules/store-ops/application/kpi-config.contract.spec.ts`
- Test: `backend/nestjs/test/integration/import-batch.e2e-spec.ts`
- Generate: `docs/api/openapi.json`
- Generate: `admin-web/src/generated/openapi-types.ts`

#### Task 2.1: Add KPI Definition

- [ ] Add `GSM_ONAY` to the KPI catalog with these values:

```text
code=GSM_ONAY
name=GSM Onay
category=percentage
unit=ratio
aggregation=avg
scope=store
formula=null
direction=higher_is_better
active=true
```

- [ ] Use a deterministic UUID consistent with the existing seeded KPI UUID pattern.
- [ ] Update seed/schema snapshots so fresh local database smoke can see the metric.

#### Task 2.2: Update Store Score Profile

- [ ] Update the store score profile config so store metric weights exactly match:

```json
[
  { "code": "TARGET_ACHIEVEMENT", "weight": 35 },
  { "code": "CR", "weight": 20 },
  { "code": "ATV", "weight": 15 },
  { "code": "UPT", "weight": 15 },
  { "code": "BM_CHECKLIST", "weight": 5 },
  { "code": "VM_CHECKLIST", "weight": 5 },
  { "code": "GSM_ONAY", "weight": 5 }
]
```

- [ ] Keep personnel score profile unchanged.
- [ ] Update contract tests that currently assert `TARGET_ACHIEVEMENT` weight `40`.
- [ ] Add a negative test that total store score weight must stay `100`.

#### Task 2.3: Add GSM Upload Recognition

- [ ] Add aliases for the GSM file headers:

```text
Mağaza Kodu -> sourceStoreId
Mağaza Adı -> storeName
Gsm Onay % -> GSM_ONAY
```

- [ ] Recognize `GSM_ONAY` as a store-scoped ratio metric.
- [ ] Treat incoming numeric values between `0` and `1` as ratios.
- [ ] Treat incoming numeric values above `1` and up to `100` as percentages and convert to ratio for `achievement_rate`.
- [ ] Reject negative values and values above `100` with row-level errors.
- [ ] Preserve null GSM rows as unmatched/empty row feedback; do not synthesize zero.

#### Task 2.4: Materialize GSM Rows Into `ops.kpi_actual`

- [ ] Ensure a successfully normalized GSM row creates or updates a monthly store `ops.kpi_actual` row for `GSM_ONAY`.
- [ ] Store `actual_value` as display percentage points when the existing KPI materialization pattern expects percentage value.
- [ ] Store `achievement_rate` as the decimal ratio used by score evaluation.
- [ ] Use `period_type='monthly'`, the selected month start, and month end.
- [ ] Match stores by `Mağaza Kodu` before store name.
- [ ] Return unmatched store codes/names in the existing import result error detail.

#### Task 2.5: Update Ranking API Sort Allowlist

- [ ] Add `GSM_ONAY` to the ranking sort-key DTO allowlist for store rankings.
- [ ] Do not add `GSM_ONAY` to personnel ranking metric allowlists.
- [ ] Add an API test proving `sortKey=GSM_ONAY` is accepted for store rankings.

#### Task 2.6: Backend Tests

- [ ] Add a normalization test using this row:

```text
Mağaza Kodu=SM182
Mağaza Adı=Balıkesir 10 Burda AVM
Gsm Onay %=0.9120521172638436
```

- [ ] Assert the normalized KPI code is `GSM_ONAY`.
- [ ] Assert the normalized display percentage is approximately `91.2052`.
- [ ] Assert the normalized achievement ratio is approximately `0.912052`.
- [ ] Add an import test with one valid row, one null GSM row, and one unmatched store code.
- [ ] Add a score evaluator test proving a store with full values receives the new 5-point GSM contribution.
- [ ] Add a score evaluator test proving missing `GSM_ONAY` appears in missing metric codes and does not invent a score.

#### Task 2.7: Generate API Artifacts

- [ ] Run `npm.cmd --prefix backend/nestjs run openapi:generate`.
- [ ] Run `npm.cmd --prefix admin-web run api:generate`.
- [ ] Run `npm.cmd --prefix admin-web run api:check`.
- [ ] Confirm generated diffs only reflect the new accepted sort key or upload surface contract.

#### Task 2.8: Verify PR2

- [ ] Run targeted backend tests for import normalization, Power BI upload, scoring, ranking, and KPI config contract.
- [ ] Run `npm.cmd --prefix backend/nestjs run build`.
- [ ] Run `npm.cmd run test:scripts`.
- [ ] Run `git diff --check`.
- [ ] PR body must include a `Contract Impact: changed` section naming `GSM_ONAY`, import handling, score profile weights, and generated API artifacts.

### PR3: GSM Onay Frontend Visibility

**Risk Class:** R2 frontend data binding.

**Contract Impact:** intentionally unchanged after PR2.

**Files:**

- Modify: `admin-web/src/pages/store-rankings-page-model.ts`
- Modify: `admin-web/src/pages/store-rankings-table.tsx`
- Modify: `admin-web/src/pages/StoreRankingsPage.tsx`
- Modify: `admin-web/src/pages/store-rankings-detail-panel.tsx`
- Modify: `admin-web/src/styles/store-rankings-premium-table.css`
- Modify: `admin-web/src/features/localization/messages/store-rankings.ts`
- Modify: `admin-web/src/pages/StoreKpisPage.tsx`
- Modify: `admin-web/src/pages/store-kpis-region-manager-view.tsx`
- Modify: `admin-web/src/pages/store-kpis-page-model.ts`
- Modify: `admin-web/e2e/store-surfaces.spec.ts`
- Modify: `admin-web/e2e/pilot-smoke.spec.ts`

#### Task 3.1: Store Rankings Column Model

- [ ] Replace the store action column with `GSM Onayı`.
- [ ] Add `GSM_ONAY` to `storeMetricCodes`.
- [ ] Keep personnel metric codes unchanged.
- [ ] Format `GSM_ONAY` as a percentage with Turkish decimal formatting.
- [ ] Keep `BM Checklist` and `VM Checklist` visible as separate metrics.

#### Task 3.2: Remove Store Detail Drawer Flow

- [ ] Remove store row `Detay aç` button.
- [ ] Remove `onOpenStoreDetail` for store list rows.
- [ ] Remove store detail drawer render path from `StoreRankingsPage`.
- [ ] Keep personnel profile/detail path unchanged.
- [ ] Remove or simplify CSS that only existed for the store action column.

#### Task 3.3: Restore Store Name Width

- [ ] Increase the store name column width freed by action-column removal.
- [ ] Ensure long store names show enough text and do not collapse to a few characters.
- [ ] Keep the table inside the shell without horizontal overflow at desktop widths.
- [ ] At mobile widths, preserve the existing responsive behavior without adding a new drawer.

#### Task 3.4: Store KPI And Region Manager KPI Visibility

- [ ] Add `GSM Onayı` to store KPI surfaces where store metric cards or breakdown rows already render configured store metrics.
- [ ] In Region Manager KPI store data, show `GSM Onayı` beside existing store KPI values.
- [ ] Use existing real API data from PR2; if a store has no GSM import, display the existing missing-data treatment.
- [ ] Do not add any fake or motivational text for missing GSM data.

#### Task 3.5: Frontend Tests

- [ ] Update store rankings fixtures so one store has `GSM_ONAY` and one store does not.
- [ ] Assert the store table header contains `GSM Onayı`.
- [ ] Assert the store table does not contain a store `Aksiyon` header.
- [ ] Assert store rows do not show `Detay aç`.
- [ ] Assert personnel list still shows its existing detail behavior.
- [ ] Assert Store KPIs and Region Manager KPI fixtures render `GSM Onayı` when present.

#### Task 3.6: Verify PR3

- [ ] Run `npm.cmd --prefix admin-web run lint`.
- [ ] Run `npm.cmd --prefix admin-web run build`.
- [ ] Run targeted store rankings/KPI e2e specs.
- [ ] Run `git diff --check`.
- [ ] PR body must include `Contract Impact: intentionally unchanged`.

### PR4: Import-To-UI Smoke And Closeout Evidence

**Risk Class:** R3 backend read/API plus R2 frontend verification.

**Contract Impact:** none.

**Files:**

- Create: `docs/evidence/gsm-onay-kpi-store-surface-fixes-v1-closeout-2026-06-21.md`
- Modify: `docs/README.md` only if the evidence shelf requires an index entry.

#### Task 4.1: Local Import Smoke

- [ ] Use the sample GSM file shape to prove a valid row can normalize, materialize, and appear in the ranking read model.
- [ ] Use a sanitized fixture or temporary test file inside test code; do not commit `C:\Users\suley\Downloads\Ocak GSM.xlsx`.
- [ ] Confirm unmatched rows are reported but do not block successful matched rows.
- [ ] Confirm missing GSM values do not generate zero KPI actuals.

#### Task 4.2: UI Smoke

- [ ] Open `/store/rankings` with a store fixture containing `GSM_ONAY`.
- [ ] Confirm store names are readable and no store `Aksiyon` column exists.
- [ ] Open `/store/kpis` for a store with `GSM_ONAY`.
- [ ] Confirm Region Manager KPI store data includes `GSM Onayı`.
- [ ] Open `/store/workforce` and confirm action column does not overflow.
- [ ] Open `/store/incentives` and confirm final prim edit string remains usable while typing.

#### Task 4.3: Closeout Evidence

- [ ] Record the Excel contract, score weight change, import behavior, UI surfaces touched, and verification commands.
- [ ] Record known residual risk:

```text
Historical GSM values only exist for periods that have imported GSM files.
Stores without matched store code/name show the existing missing-data state.
Future Nebim direct integration may replace the batch upload path.
```

#### Task 4.4: Verify PR4

- [ ] Run `npm.cmd run check:release`.
- [ ] Run `git diff --check`.
- [ ] PR body must include the closeout evidence path.

## Implementation Order Rules

- Start every PR from fresh `main`.
- Use branch prefix `codex/`.
- Keep each PR focused on the risk class listed above.
- Do not merge PR2 until PR1 is merged or explicitly rebased, because PR1 removes distracting UI regressions before KPI behavior changes.
- Do not start PR3 before PR2's API/types are generated and committed.
- Do not run staging mutation/upload smoke without explicit user approval for that environment.
- Do not commit the user's downloaded Excel file.
- Do not touch unrelated dirty files in another worktree.

## Rollback Plan

- PR1 rollback restores previous UI behavior only; no data loss risk.
- PR2 rollback removes the `GSM_ONAY` KPI definition/profile/import path before user-facing surfaces depend on it.
- PR3 rollback removes visibility of `GSM_ONAY` from frontend surfaces while leaving backend data intact.
- PR4 rollback removes evidence/docs only.

## Verification Matrix

| Area | Required Proof |
| --- | --- |
| Workforce overflow | Desktop and mobile table fit; targeted e2e or screenshot evidence |
| Incentive amount input | Typing `1500000` remains editable and saves as `1500000.00` |
| GSM import | Normalization and materialization tests for valid, null, and unmatched rows |
| Store scoring | Score profile totals `100`; `GSM_ONAY` contributes weight `5` |
| Rankings UI | Store `GSM Onayı` column exists; store action/detail removed; personnel details preserved |
| Store KPI UI | Store and Region Manager KPI surfaces show imported GSM metric |
| API contract | OpenAPI/types regenerated and checked when sort/upload contract changes |
| Release | `check:release` in final verification PR |

## Expected PR Body Template

```markdown
## Summary
- Fixes the scoped surface or contract named by this PR.
- Lists the exact pages, endpoints, migrations, or generated artifacts changed.

## Contract Impact
- Use `Contract Impact: intentionally unchanged` for PR1 and PR3.
- Use `Contract Impact: changed` for PR2 and name `GSM_ONAY`, import handling, score profile weights, and generated API artifacts.
- Use `Contract Impact: none` for PR4.

## Verification
- Include every command run from the PR task verification list.
- Include any targeted browser/screenshot check when the PR changes visible layout.

## Residual Risk
- Name unmatched GSM store rows, missing GSM periods, or staging-upload limits only when they apply to that PR.
```

## Five-Pass Self-Review Log

### Pass 1: Spec Coverage

Result: PASS. The plan covers all user-reported issues: workforce overflow, incentive final amount typing, ranking store action removal, GSM Onay import, store score weight `5`, `/store/rankings`, `/store/kpis`, and Region Manager KPI visibility.

### Pass 2: Data Contract

Result: PASS. The plan records the supplied Excel structure, ratio semantics, store-code-first matching, null-row behavior, and the exact score-weight distribution.

### Pass 3: Scope And Workflow Boundaries

Result: PASS. The plan explicitly keeps incentive formulas, role/scope, checklist workflow, personnel ranking detail, and workforce detail workflow unchanged.

### Pass 4: Verification Strength

Result: PASS. Each PR has targeted tests and commands. PR2 includes OpenAPI/type generation because ranking sort/upload contract changes. PR4 includes release verification and closeout evidence.

### Pass 5: Placeholder And Ambiguity Scan

Result: PASS. The plan avoids open placeholders and gives exact metric codes, weights, file areas, commands, and expected behavior for the risky parts.
