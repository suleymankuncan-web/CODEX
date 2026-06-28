# Store Reports Prototype To Product And Store Surface Hygiene V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the accepted `/store/reports?prototype=command-v1` report hub into production and close the user-reported Store surface visual, interaction, and performance issues in the same release train.

**Architecture:** Treat the reports prototype as the visible contract, but split productization into a backend read/export contract, a frontend parity slice, and a separate Store Surface Hygiene slice for existing page fixes. The Store Reports page renders the prototype structure with production auth, scope, loading/error/access states, period rules, and a real Excel download endpoint; no Store Manager visibility is restored. The hygiene slice must not change business formulas, role access, target approval workflow, incentive calculations, KPI scoring rules, or database schema.

**Tech Stack:** NestJS, Supabase Postgres, `@e965/xlsx`, OpenAPI generated types, React, TanStack Query, HR Axis Store shell, shadcn Popover/Button primitives where they preserve the accepted surface, scoped Store Reports CSS.

---

## Product Contract

The production `/store/reports` page replaces the old handoff/bridge screen.

Visible contract:

- Header: `Raporlar`, subtitle `Dönem rapor paketi, modül özetleri ve detay dışa aktarım.`
- Top-right period picker: month + year only; no day grid.
- Metrics: `Dönem paketi`, `Kapsam`, `Detay çıktı`, selected period readiness.
- Main panel: `${periodLabel} Mağaza İzleyiş Exceli`.
- Main action: `Excel indir`.
- Package sections: KPI kolonları, Onay skorları, Aksiyon durumu, Hedefler, Primler, Norm Kadro, Ziyaret.
- Removed from product: old `/admin/reports` bridge action, lower report list/drawer, top-right duplicate Excel button, refresh button, day calendar, raw/internal copy.

Workflow contract:

- Region Manager, Super Admin, Report Viewer, Auditor can open `/store/reports` if route guard allows them.
- Store Manager does not see `/store/reports` in sidebar and cannot open it directly.
- Period selection is month-based.
- If selected month is current month, export covers month start through today's Europe/Istanbul date.
- If selected month is past, export covers the full month.
- Future months are disabled.
- Excel export is scoped to the current actor's allowed stores.
- Missing module data is exported as `Veri yok`, not invented.

## Store Surface Hygiene Contract

These fixes are included in the same release train and are not optional.

1. `/store/feed` / Duyurular:
   - Page content must be visually centered in the available shell content area.
   - It must not look pinned to the left toolbar.
   - The existing Region Manager compose flow and read-only consumer flow must not change.

2. `/store/workforce` / Norm Kadro:
   - Text weight must be reduced across title, metric cards, table rows, badges, and detail surfaces.
   - Existing columns, active personnel count, norm/fiili, status, missing-day, turnover placeholder, and detail modal behavior must not change.

3. `/store/incentives` / Primler:
   - The top-right `Excel dışa aktar` button must be removed from the page header.
   - First page load must be profiled before changing code.
   - If the delay is caused by duplicated queries, sequential waterfalls, expensive synchronous row shaping, or unnecessary initial modal/detail preparation, fix that cause.
   - Do not hide real loading work with fake skeleton timing.
   - Do not change incentive formulas, close state, correction save flow, or Region Manager approval flow.

4. `/store/targets` / Hedefler:
   - Top-right period control must be a month/year picker with no day grid.
   - The period button must open when the user clicks anywhere inside the button, not only the right edge.
   - The `Mağaza hedefi` table header must align closer to its column content.
   - Table headers must support click-to-sort without opening extra popovers.
   - Sorting must be stable and must not change target approval status or drawer workflow.

5. `/store/kpis` / KPI Özetleri:
   - Region Manager and Store Manager period controls must use a month/year picker with no day grid.
   - Store Manager `GSM onayı` color must be distinct from `Hedef gerçekleştirme`.
   - Existing BM/SM KPI data, role-specific views, rankings, and score profile behavior must not change.

6. `/store/kpis` personnel tab:
   - Personnel list `Katkı` column must display the contribution to total score, not a duplicate of the raw score.
   - If the backend/API does not expose contribution separately, derive it from the visible score profile weights already used by the detail/breakdown UI.
   - Do not invent contribution values; if a metric lacks source data, show the existing missing-data state.

## File Structure

Backend:

- Create `backend/nestjs/src/modules/store-ops/web/dto/get-store-monthly-report-package.query.ts`
  - validates `period` as `YYYY-MM`.
- Create `backend/nestjs/src/modules/store-ops/application/store-monthly-report-package.service.ts`
  - builds package summary and Excel workbook buffer.
- Create `backend/nestjs/src/modules/store-ops/infrastructure/store-monthly-report-package.repository.ts`
  - reads scoped store/month data for package rows.
- Create `backend/nestjs/src/modules/store-ops/infrastructure/store-monthly-report-package.types.ts`
  - owns the row/result types so service and repository stay small.
- Modify `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts`
  - adds JSON package summary endpoint and XLSX export endpoint.
- Modify `backend/nestjs/src/modules/store-ops/store-ops-reporting-read.module.ts`
  - provides the new service/repository.
- Modify `docs/api/openapi.json`
  - generated by OpenAPI tooling after endpoint addition.

Frontend:

- Modify `admin-web/src/lib/api.ts`
  - add authenticated blob GET helper for binary downloads.
- Modify `admin-web/src/lib/openapi-client.ts` only if the JSON endpoint needs typed helper support beyond current generated types.
- Modify `admin-web/src/features/reports/api.ts`
  - add package JSON query and Excel download helper.
- Modify `admin-web/scripts/generate-openapi-types.mjs`
  - include `GET /api/reports/store-monthly-package` in selected operations.
- Replace `admin-web/src/pages/StoreReportsPage.tsx`
  - production page with prototype parity, real query state, and download action.
- Create `admin-web/src/pages/store-reports-period.ts`
  - period label, coverage label, current-month cutoff, future-month helpers.
- Create `admin-web/src/pages/store-reports-model.ts`
  - maps API package summary into visible metrics/sections.
- Create `admin-web/src/styles/store-reports-command.css`
  - scoped production CSS copied from prototype rhythm, cleaned for tokens and Turkish text.
- Modify `admin-web/src/index.css`
  - import production reports CSS, not prototype-only CSS.
- Modify `admin-web/src/app/store-shell.tsx`
  - pass `authSummary` to `StoreReportsPage` for persona label and role-aware evidence hooks.
- Keep/modify `admin-web/src/app/store-route-registry.ts`
  - Store Manager stays excluded from reports route access.
- Modify `admin-web/src/features/auth/role-permission-preview.ts`
  - Store Reports preview stays aligned with route access.

Frontend hygiene:

- Modify `admin-web/src/pages/StoreFeedPage.tsx`
  - center the announcements/feed page content away from the left toolbar.
- Modify `admin-web/src/styles/store-feed-command.css`
  - remove left-leaning page offsets and use the same centered max-width rhythm as Tasks/Reports.
- Modify `admin-web/src/pages/StoreWorkforcePage.tsx`
  - reduce heavy text weights on the Norm Kadro production page.
- Modify `admin-web/src/pages/store-workforce-region-view.tsx`
  - reduce table/card text weights without changing columns or detail behavior.
- Modify `admin-web/src/styles/store-workforce-command.css`
  - lower heading/table/body font weights and keep column alignment intact.
- Modify `admin-web/src/pages/StoreIncentivesPage.tsx`
  - remove the top-right `Excel dışa aktar` button and keep the page action set focused.
- Modify `admin-web/src/pages/store-incentives-region-manager-view.tsx`
  - investigate first-load delay, remove any blocking UI work that is not required for initial paint, and preserve the approved incentives surface.
- Modify `admin-web/src/pages/store-incentives-region-manager-model.ts`
  - memoize or pre-shape derived view data if profiling shows repeated expensive row calculations.
- Modify `admin-web/src/pages/StoreTargetsPage.tsx`
  - wire a month/year period picker and pass sort state into the target command surface.
- Modify `admin-web/src/pages/store-targets-region-command.tsx`
  - fix period button hit target, align `Mağaza hedefi` header, and add clickable sort controls to table headers.
- Create `admin-web/src/pages/store-targets-period-picker.tsx`
  - shared month/year picker for Store Targets, no day grid.
- Modify `admin-web/src/styles/store-targets-command.css`
  - align header cells and reduce click-target drift.
- Modify `admin-web/src/pages/StoreKpiHighlightsPage.tsx`
  - route Store KPI period selection through the month/year picker for both Region Manager and Store Manager views.
- Modify `admin-web/src/pages/store-kpis-command-deck-header.tsx`
  - remove day calendar behavior and expose month/year period controls.
- Modify `admin-web/src/pages/store-kpis-command-deck.tsx`
  - change Store Manager GSM approval tone so it no longer matches target achievement.
- Modify `admin-web/src/pages/store-kpis-region-overview.tsx`
  - apply the same period picker contract to Region Manager KPI view.
- Modify `admin-web/src/pages/store-kpis-region-period-model.ts`
  - keep period state month-based.
- Modify `admin-web/src/features/localization/messages/store-kpis.ts`
  - keep Turkish labels for contribution, GSM approval, and period controls.

Tests:

- Create `backend/nestjs/src/modules/store-ops/application/store-monthly-report-package.service.spec.ts`.
- Create `backend/nestjs/src/modules/store-ops/infrastructure/store-monthly-report-package.repository.spec.ts`.
- Create `admin-web/e2e/store-reports.spec.ts`
  - product page, period picker, download, role matrix, and overflow coverage.
- Modify `admin-web/e2e/store-surfaces.spec.ts`
  - remove old Store Reports handoff assertions and keep only shell-wide nav assertions.

Docs/evidence:

- Modify `docs/prototypes/README.md`
  - promote Store Reports prototype to locked only after visual parity is verified.
- Modify `docs/evidence/system-flow/store-placeholder-route-decision-v1.md`
  - mark `/store/reports` placeholder decision superseded by Store Reports Package V1.
- Create `docs/evidence/store-reports-prototype-to-product-v1-closeout-2026-06-29.md`.

## Data Mapping

The Excel should contain one row per scoped store.

Initial columns:

```text
Bölge Müdürü
Mağaza
Şehir
Dönem
Rapor aralığı
Skor
UPT
ATV
CR
HG%
GSM
BM Checklist
VM Checklist
Aksiyon durumu
Hedef durumu
Prim durumu
Norm / Fiili
Eksik gün
Turnover
Son ziyaret
Ziyaretten geçen gün
Veri notu
```

Source policy:

- KPI columns come from existing KPI actual/ranking/reporting read sources.
- GSM uses imported monthly GSM KPI values when present.
- BM/VM Checklist uses completed checklist result data when present.
- Aksiyon durumu uses Store Action plan state data when present.
- Hedef durumu uses target distribution/reference data when present.
- Prim durumu uses incentive read/close state when present.
- Norm/Fiili and Eksik gün use workforce/norm read data when present.
- Turnover exports `Veri yok` until the real turnover source is available.
- Son ziyaret and Ziyaretten geçen gün use the latest completed checklist visit before or inside the selected report end date.
- Any missing source becomes `Veri yok`; no fake business value is allowed.

## PR Train

### PR1: Backend Report Package Contract

Risk class: `R3 backend read/API`.

**Files:**

- Create: `backend/nestjs/src/modules/store-ops/web/dto/get-store-monthly-report-package.query.ts`
- Create: `backend/nestjs/src/modules/store-ops/application/store-monthly-report-package.service.ts`
- Create: `backend/nestjs/src/modules/store-ops/application/store-monthly-report-package.service.spec.ts`
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/store-monthly-report-package.repository.ts`
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/store-monthly-report-package.repository.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts`
- Modify: `backend/nestjs/src/modules/store-ops/store-ops-reporting-read.module.ts`
- Generate: `docs/api/openapi.json`

- [x] **Step 1: Add period query DTO**

Use this exact validation contract:

```ts
import { Matches } from "class-validator";

export class GetStoreMonthlyReportPackageQueryDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period!: string;
}
```

- [x] **Step 2: Add repository read method**

Repository method signature:

```ts
async getStoreMonthlyReportPackageRows(input: {
  periodStart: string;
  periodEnd: string;
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
  regionManagerUserId?: string;
}): Promise<StoreMonthlyReportPackageRow[]> {
  return this.databaseService.query<StoreMonthlyReportPackageRow>(STORE_MONTHLY_REPORT_PACKAGE_SQL, [
    input.periodStart,
    input.periodEnd,
    input.companyIds,
    input.regionIds,
    input.storeIds,
    input.regionManagerUserId ?? null,
  ]).then((result) => result.rows);
}
```

Guardrails:

- Use parameterized SQL only.
- Scope stores in the first CTE named `scoped_stores`; every later CTE joins through `scoped_stores`.
- `scoped_stores` must allow:
  - `companyIds` through `store.company_id`,
  - `regionIds` through `store.region_id`,
  - `storeIds` through `store.store_id`,
  - `regionManagerUserId` through the existing user/action-store assignment relationship used by Region Manager store scope.
- Do not return stores outside the actor's allowed scope.
- Keep unavailable module columns nullable.

- [x] **Step 3: Add service period helpers**

Service helpers must implement:

```ts
function getIstanbulToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function resolveMonthlyRange(period: string, today = getIstanbulToday()) {
  const [year, month] = period.split("-").map(Number);
  const periodStart = `${period}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const fullPeriodEnd = `${period}-${String(lastDay).padStart(2, "0")}`;
  const currentMonth = today.slice(0, 7) === period;
  const futureMonth = period > today.slice(0, 7);

  if (futureMonth) {
    throw new BadRequestException("Gelecek dönem raporu indirilemez");
  }

  return {
    periodStart,
    periodEnd: currentMonth ? today : fullPeriodEnd,
    isCurrentPeriod: currentMonth,
  };
}
```

- [x] **Step 4: Add JSON package summary**

Service response shape:

```ts
type StoreMonthlyReportPackageSummary = {
  period: string;
  periodLabel: string;
  coverageLabel: string;
  isCurrentPeriod: boolean;
  storeCount: number;
  sections: Array<{ code: string; label: string; value: string; status: "ready" | "partial" }>;
};
```

Use this for the frontend metric cards and package section list.

- [x] **Step 5: Add XLSX workbook builder**

Use existing dependency:

```ts
import * as XLSX from "@e965/xlsx";
```

Workbook requirements:

- One worksheet named `Mağaza İzleyiş`.
- Header labels exactly match the Data Mapping section.
- Filename: `magaza-izleyis-${period}.xlsx`.
- Empty/null cells render `Veri yok`.
- Numeric percentages render as display strings such as `%22,4` unless Excel number formatting is explicitly tested.

- [x] **Step 6: Add controller endpoints**

Add endpoints under the existing reporting controller. Use `@Res({ passthrough: true })` for the XLSX response so the controller can set headers without taking over the whole response lifecycle.

```ts
@Get("store-monthly-package")
@RequireScope("authenticated")
@RequireRoles("REPORT_VIEWER", "AUDITOR", "REGION_MANAGER", "SUPER_ADMIN")
async getStoreMonthlyReportPackage(...) {}

@Get("store-monthly-package.xlsx")
@RequireScope("authenticated")
@RequireRoles("REPORT_VIEWER", "AUDITOR", "REGION_MANAGER", "SUPER_ADMIN")
async downloadStoreMonthlyReportPackage(...) {}
```

The XLSX endpoint must set:

```text
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="magaza-izleyis-YYYY-MM.xlsx"
```

- [x] **Step 7: Backend tests**

Add tests for:

- invalid `period` rejects,
- future month rejects,
- current month resolves to Istanbul today,
- past month resolves to full month,
- region manager sees only assigned/scoped stores,
- missing module data appears as `Veri yok`,
- workbook contains the expected worksheet and headers.

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- src/modules/store-ops/application/store-monthly-report-package.service.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- src/modules/store-ops/infrastructure/store-monthly-report-package.repository.spec.ts --runInBand
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run openapi:generate
```

Expected: all pass; `docs/api/openapi.json` updates only for the new JSON endpoint and related schema.

### PR2: Frontend Product UI And API Binding

Risk class: `R2 frontend data binding`.

**Files:**

- Modify: `admin-web/src/lib/api.ts`
- Modify: `admin-web/src/features/reports/api.ts`
- Modify: `admin-web/scripts/generate-openapi-types.mjs`
- Create: `admin-web/src/pages/store-reports-period.ts`
- Create: `admin-web/src/pages/store-reports-model.ts`
- Replace: `admin-web/src/pages/StoreReportsPage.tsx`
- Create: `admin-web/src/styles/store-reports-command.css`
- Modify: `admin-web/src/index.css`
- Modify: `admin-web/src/app/store-shell.tsx`
- Modify: `admin-web/src/app/store-route-registry.ts` only to confirm Store Manager remains excluded.
- Modify: `admin-web/src/features/auth/role-permission-preview.ts` only to keep preview aligned.

- [ ] **Step 1: Add authenticated blob helper**

Add a helper beside JSON helpers in `admin-web/src/lib/api.ts`. It should mirror `requestJson` behavior, but return `response.blob()` after status validation.

```ts
export async function fetchBlob(path: string): Promise<Blob> {
  return requestBlob(path);
}
```

Do not duplicate auth header logic by reading local storage manually.

- [ ] **Step 2: Add reports API helpers**

In `admin-web/src/features/reports/api.ts`:

```ts
export type StoreMonthlyReportPackage = ApiGetResponse<'/api/reports/store-monthly-package'>;

export async function getStoreMonthlyReportPackage(input: { period: string }) {
  return fetchOpenApiJson('/api/reports/store-monthly-package', {
    query: new URLSearchParams({ period: input.period }),
  });
}

export async function downloadStoreMonthlyReportPackage(input: { period: string }) {
  return fetchBlob(`/reports/store-monthly-package.xlsx?period=${encodeURIComponent(input.period)}`);
}
```

- [ ] **Step 3: Add period helper tests through e2e-visible behavior**

Implement `store-reports-period.ts` with:

```ts
export function formatReportPeriodLabel(period: string): string;
export function formatReportCoverageLabel(input: { period: string; today: Date }): string;
export function isFutureReportPeriod(input: { period: string; today: Date }): boolean;
export function listReportYearOptions(today: Date): number[];
```

The visible result must match:

- `2026-06` -> `Haziran 2026`
- current month -> `1-{todayDay} Haziran`
- past month -> `1-31 Mayıs`

- [ ] **Step 4: Replace StoreReportsPage**

The production page must materially match `StoreReportsCommandV1Prototype`:

- same compact header dimensions,
- same metric rhythm,
- same month/year popover behavior,
- same main package panel,
- same package section list,
- same `Excel indir` primary action,
- same Turkish labels with correct characters,
- no old bridge cards,
- no `/admin/reports` button,
- no drawer,
- no refresh button,
- no day grid.

The page must include:

- loading state while package summary loads,
- error state with retry,
- disabled Excel button while export is pending,
- visible failure copy if download fails,
- access denied handled by existing StoreRouteGuard.

- [ ] **Step 5: Remove prototype-only runtime coupling**

Before PR2 closeout, choose one:

1. Keep `/store/reports?prototype=command-v1` dev route and stage all imported prototype files, or
2. Remove the prototype route imports from `App.tsx` and keep the accepted prototype only as docs/evidence.

Do not leave tracked files importing untracked prototype files.

- [ ] **Step 6: Frontend verification**

Run:

```powershell
npm.cmd --prefix admin-web run api:generate
npm.cmd --prefix admin-web run api:check
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
```

Expected: all pass.

### PR3: E2E, Role Matrix, Visual Parity Evidence

Risk class: `R1/R2 verification`.

**Files:**

- Create: `admin-web/e2e/store-reports.spec.ts`
- Modify: `admin-web/e2e/store-surfaces.spec.ts`
- Modify: `docs/prototypes/README.md`
- Modify: `docs/evidence/system-flow/store-placeholder-route-decision-v1.md`
- Create: `docs/evidence/store-reports-prototype-to-product-v1-closeout-2026-06-29.md`

- [ ] **Step 1: Replace old Store Reports e2e assertions**

Remove expectations for:

- `Raporları aç`,
- `/admin/reports` bridge link,
- `Kapanmış dönem sonuçları`,
- `Aksiyon gerektiren metrikler`.

Add expectations for:

- heading `Raporlar`,
- period picker `Haziran 2026`,
- metric cards,
- `Haziran 2026 Mağaza İzleyiş Exceli`,
- `Excel indir`,
- package sections.

- [ ] **Step 2: Add role visibility assertions**

Assert:

- Store Manager nav has no `/store/reports`.
- Store Manager direct `/store/reports` lands on forbidden/first allowed route.
- Region Manager nav has `/store/reports`.
- Region Manager opens the product page.
- Admin persona without Store report route does not see the nav item unless allowed by route registry.

- [ ] **Step 3: Add period picker e2e**

Assert:

- popover opens from the top-right period button,
- only year/month controls are visible,
- weekdays/day numbers are absent,
- future months are disabled,
- changing May shows `1-31 Mayıs`,
- current month shows `1-{today} {month}`.

- [ ] **Step 4: Add download e2e**

Mock `GET /api/reports/store-monthly-package.xlsx?period=2026-06` and assert:

- clicking `Excel indir` calls the endpoint once,
- button enters pending/disabled state,
- failed download shows product copy, not raw API/debug text.

- [ ] **Step 5: Visual parity and overflow**

Run local browser checks for:

- desktop `1366x900`,
- mobile `390x900`.

Required result:

- no horizontal overflow,
- metric card icons centered,
- month/year popover fits,
- package panel fits,
- visible page materially matches the accepted prototype.

- [ ] **Step 6: Documentation closeout**

Update prototype/evidence docs:

- Store Reports is no longer a placeholder.
- Store Manager is intentionally excluded for now.
- Export source and missing-data behavior are documented.
- Prototype parity result is recorded as `PASS` only after screenshot/browser inspection.

Run:

```powershell
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "reports|Store Reports|store shell" --workers=1
git diff --check
```

### PR4: Store Surface Hygiene Fixes

Risk class: `R2 frontend UI/performance`.

This PR is part of the same release train. Keep it separate from PR1 backend export work so Store page regressions are easy to isolate.

**Files:**

- Modify: `admin-web/src/pages/StoreFeedPage.tsx`
- Modify: `admin-web/src/styles/store-feed-command.css`
- Modify: `admin-web/src/pages/StoreWorkforcePage.tsx`
- Modify: `admin-web/src/pages/store-workforce-region-view.tsx`
- Modify: `admin-web/src/styles/store-workforce-command.css`
- Modify: `admin-web/src/pages/StoreIncentivesPage.tsx`
- Modify: `admin-web/src/pages/store-incentives-region-manager-view.tsx`
- Modify: `admin-web/src/pages/store-incentives-region-manager-model.ts`
- Modify: `admin-web/src/pages/StoreTargetsPage.tsx`
- Modify: `admin-web/src/pages/store-targets-region-command.tsx`
- Create: `admin-web/src/pages/store-targets-period-picker.tsx`
- Modify: `admin-web/src/styles/store-targets-command.css`
- Modify: `admin-web/src/pages/StoreKpiHighlightsPage.tsx`
- Modify: `admin-web/src/pages/store-kpis-command-deck-header.tsx`
- Modify: `admin-web/src/pages/store-kpis-command-deck.tsx`
- Modify: `admin-web/src/pages/store-kpis-region-overview.tsx`
- Modify: `admin-web/src/pages/store-kpis-region-period-model.ts`
- Modify: `admin-web/src/features/localization/messages/store-kpis.ts`
- Modify: `admin-web/e2e/store-surfaces.spec.ts`

- [ ] **Step 1: Baseline the current Store hygiene failures**

Run the app locally and capture screenshots or Playwright screenshots for these URLs with a Region Manager-capable pilot session:

```text
/store/feed
/store/workforce
/store/incentives
/store/targets
/store/kpis
```

Record the before evidence in the PR description:

```text
Duyurular: left-toolbar alignment issue visible.
Norm Kadro: font weight too heavy.
Primler: first visible content timing measured; Excel button visible in header.
Hedefler: period button click target offset; Mağaza hedefi header misaligned; table headers unsortable.
KPI Özetleri: day calendar visible; GSM tone matches target achievement; personnel Katkı duplicates score.
```

- [ ] **Step 2: Center `/store/feed` content**

In `admin-web/src/styles/store-feed-command.css`, use a centered shell wrapper equivalent to:

```css
.store-feed-command {
  width: min(100%, 1280px);
  margin-inline: auto;
}
```

Use the actual page root class from `StoreFeedPage.tsx`. Do not add extra left padding to compensate for the sidebar; the Store shell already owns sidebar spacing.

Acceptance check:

```text
At 1366px desktop width, the Duyurular page content is centered in the remaining content area and does not touch the left toolbar edge.
```

- [ ] **Step 3: Reduce Norm Kadro font weight**

In `admin-web/src/styles/store-workforce-command.css`, lower page-specific weights:

```css
.store-workforce-command :where(h1, h2, h3) {
  font-weight: 650;
}

.store-workforce-command :where(th, .workforce-table-heading, .workforce-cell-strong) {
  font-weight: 600;
}

.store-workforce-command :where(td, .workforce-card-copy, .workforce-detail-copy) {
  font-weight: 450;
}
```

Adapt selectors to the real class names in the file. Do not globally change `body`, `button`, or shared shadcn component weights.

Acceptance check:

```text
Norm Kadro still reads clearly, but row text and badges no longer look extra-bold compared with Tasks/Reports.
```

- [ ] **Step 4: Remove Incentives header Excel action**

In `StoreIncentivesPage.tsx` or `store-incentives-region-manager-view.tsx`, remove only the top-right header action labeled `Excel dışa aktar`.

Keep:

```text
Onaya gönder
period picker
store/personnel rows
correction sheet
```

Acceptance check:

```text
/store/incentives header no longer shows Excel dışa aktar. No export action remains in the header command cluster.
```

- [ ] **Step 5: Profile Incentives first-load delay before patching**

Add temporary local-only measurement while investigating, then remove it before commit:

```ts
performance.mark('store-incentives-render-start');
performance.measure('store-incentives-initial-render', 'store-incentives-render-start');
```

Use browser Network/Performance or React Profiler evidence to classify the delay as exactly one of:

```text
network latency
query waterfall
duplicated query
synchronous row derivation
initial hidden sheet/detail rendering
large bundle/module load
```

Then apply the matching fix:

```text
network latency: keep real loading state; do not fake speed.
query waterfall: start independent queries in parallel through separate useQuery calls.
duplicated query: merge duplicate query keys and reuse the same result.
synchronous row derivation: wrap expensive pure derivation in useMemo keyed by package rows + period + actor id.
initial hidden sheet/detail rendering: render sheet body only after active person/store is selected.
large bundle/module load: keep route lazy import, avoid adding heavy export/chart code to initial bundle.
```

Acceptance check:

```text
The page shows meaningful first content faster or the PR records evidence that delay is backend/network-bound and not caused by frontend blocking work.
```

- [ ] **Step 6: Add Store Targets month/year picker**

Create `admin-web/src/pages/store-targets-period-picker.tsx` with this public contract:

```ts
type StoreTargetsPeriodPickerProps = {
  period: string;
  onPeriodChange: (period: string) => void;
  maxPeriod?: string;
};
```

Behavior:

```text
Displays `Haziran 2026` style label.
Opens from the whole button area.
Allows month and year selection only.
Does not render weekday labels or day numbers.
Does not allow future months beyond maxPeriod/current month.
```

Wire it in `StoreTargetsPage.tsx` and `store-targets-region-command.tsx`.

- [ ] **Step 7: Fix Store Targets header alignment and sorting**

Add sort state near the target table owner:

```ts
type TargetSortKey = 'store' | 'storeTarget' | 'distribution' | 'personnel' | 'status';
type TargetSortDirection = 'asc' | 'desc';
type TargetSortState = { key: TargetSortKey; direction: TargetSortDirection };
```

Sorting behavior:

```text
Clicking a sortable header toggles asc/desc.
No dropdown opens.
Store name sorts alphabetically.
Mağaza hedefi sorts by numeric target amount, with missing values last.
Personel sorts by targeted personnel count.
Durum sorts by pending, returned, approved, no-target order.
Stable tie-breaker is store name ascending.
```

CSS acceptance:

```text
`Mağaza hedefi` header aligns visually with the target amount/value cells and no longer appears pushed too far right.
```

- [ ] **Step 8: Convert Store KPIs period controls to month/year**

In `store-kpis-command-deck-header.tsx`, `store-kpis-region-overview.tsx`, and `store-kpis-region-period-model.ts`, make the period control month/year only.

Required behavior:

```text
Region Manager KPI view uses month/year control.
Store Manager KPI view uses month/year control.
No weekday/day number grid is visible.
Click target is the full button.
Selected label uses Turkish month name.
```

- [ ] **Step 9: Change Store Manager GSM approval tone**

In `store-kpis-command-deck.tsx`, change only `GSM onayı` visual tone so it is distinct from `Hedef gerçekleştirme`.

Use semantic tone mapping:

```ts
const metricToneByCode = {
  TARGET_ACHIEVEMENT: 'mint',
  GSM_ONAY: 'cyan',
};
```

Adapt to the real code path. Do not change score values, metric labels, or KPI weight behavior.

- [ ] **Step 10: Fix personnel `Katkı` value**

Find the personnel ranking/list row mapping in the KPI page. Replace duplicated score display with contribution calculation.

Expected calculation:

```ts
function calculateContributionPoints(input: {
  normalizedScore: number | null;
  weightPercent: number | null;
}): number | null {
  if (input.normalizedScore == null || input.weightPercent == null) return null;
  return (input.normalizedScore * input.weightPercent) / 100;
}
```

Rules:

```text
Use the same score profile/weight data already used by the visible KPI breakdown.
If contribution cannot be calculated, show the existing missing-data label.
Do not display raw total score in the Katkı column.
Do not change overall ranking order in this PR.
```

Acceptance example:

```text
If a personnel row score is 72 and the relevant metric weight is 35%, Katkı displays 25,20 or the existing project number format equivalent, not 72.
```

- [ ] **Step 11: Store hygiene e2e and visual checks**

Update `admin-web/e2e/store-surfaces.spec.ts` with assertions:

```text
Duyurular page root is visible and has no horizontal overflow.
Norm Kadro page table is visible after font-weight changes.
Primler header does not contain Excel dışa aktar.
Hedefler period control opens from the full button and no day grid appears.
Hedefler table header sorting changes row order or sort indicator.
KPI Store Manager period control has no day grid.
KPI Region Manager period control has no day grid.
KPI personnel Katkı column is not equal to Skor for a seeded weighted row.
```

Run:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "feed|workforce|incentives|targets|kpis" --workers=1
git diff --check
```

Expected: all pass.

## Definition Of Done

- `/store/reports` no longer looks or behaves like the old bridge page.
- Store Manager cannot see or open Store Reports.
- Region Manager can see Store Reports and use the new period/export surface.
- The production UI materially matches the accepted Store Reports prototype.
- Month/year picker has no day grid.
- Current-month export covers month-to-date; past-month export covers full month.
- Excel download uses authenticated backend export and scoped store data.
- Missing source data is represented as `Veri yok`, not fake values.
- Turkish characters render correctly.
- No tracked file imports untracked prototype artifacts.
- Frontend lint/build pass.
- Backend targeted tests/build/OpenAPI generation pass.
- Targeted Store Reports e2e pass.
- Duyurular content is centered in the Store shell content area.
- Norm Kadro typography is lighter and still readable.
- Primler header export button is removed; any first-load delay has evidence and a matching fix or documented backend/network cause.
- Hedefler period control is month/year only, opens from the whole button, and table headers sort.
- Store KPI Region Manager and Store Manager views use month/year period controls.
- Store KPI Store Manager `GSM onayı` has a distinct visual tone from `Hedef gerçekleştirme`.
- Store KPI personnel `Katkı` column is not a duplicate of raw score.
- Closeout evidence records prototype parity and any intentional deviations.

## Self-Review

Spec coverage:

- Store Manager hidden: covered by route registry, preview, e2e role assertions.
- UI parity: covered by PR2 page replacement and PR3 visual parity gate.
- Workflow parity: covered by month/year period picker and Excel export workflow.
- Product readiness: covered by backend scoped export, missing-data policy, and docs closeout.
- Store surface hygiene: covered by PR4 and explicit acceptance checks for feed, workforce, incentives, targets, and kpis.

Hidden side effects checked:

- The plan does not broaden Store Manager access.
- The plan does not change KPI scoring, ranking sort, checklist scoring, target approval, incentive calculation, or workforce workflow.
- The plan introduces one read/export contract under reporting, not a write workflow.
- The plan explicitly prevents tracked imports of untracked prototype files.
- The plan removes only the Incentives header export button; it does not remove any future backend report export endpoint.
- The plan fixes KPI `Katkı` display without changing ranking order or score calculation.

Known risk:

- A full 30-store Excel package touches several read domains. If repository queries become too broad for one PR, split PR1 into `PR1A JSON summary` and `PR1B XLSX export`, but keep the visible UI blocked until the real export endpoint exists.
