# Excel KPI Import V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first real Excel KPI import path where personnel performance uses positive gross sales, store performance uses net store sales, period ratios are recomputed from base totals, and re-upload does not double-count.

**Architecture:** Keep `PowerBiExportUploadService` as the Power BI/Excel adapter and keep `IntegrationService` as the source-agnostic canonical import boundary. The adapter reads the two Excel exports, filters to enabled local stores, emits canonical KPI rows, and lets the existing staging/materialization path resolve mappings, lineage, quality issues, and live `ops.kpi_actual` upserts. Store ratio metrics are calculated from additive base metrics (`NET_SALES`, `ITEM_COUNT`, `TICKET_COUNT`, `FF`) instead of averaging reported ratio columns.

**Tech Stack:** TypeScript, NestJS, PostgreSQL, `@e965/xlsx`, Jest, React/Vite, Playwright, Node release scripts.

---

## Product Rules Locked By This Plan

- Store KPI source of truth is `MAGAZA TABLO.xlsx`.
- Store sales value is net ciro from the store file.
- Personnel KPI source is `PERSONEL TABLO.xlsx`.
- Personnel sales value is only positive `Satis Tutari`; negative rows do not reduce employee performance.
- Personnel negative rows stay as reconciliation evidence.
- Store file net ciro already includes returns/exchanges; personnel negative rows must not be subtracted from store a second time.
- Store and personnel identities are not auto-created from Excel names.
- Unknown store rows surface as `unmapped_store`.
- Unknown employee rows surface as `unmapped_employee`.
- `ATV = total sales amount / total invoice count`.
- `UPT = total sales quantity / total invoice count`.
- `CR = invoice count / FF` internally; display can multiply by 100.
- Official period ratio values are recomputed from summed base metrics.
- Daily ratio averages can exist only as a separately labelled view, not as the official period KPI.

## File Map

### Backend

- Modify `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.spec.ts`
  - Add red tests for store base metrics, recomputed ratios, positive personnel gross sales, negative-row handling, scoped store filtering, reconciliation, and deterministic re-upload keys.
- Modify `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.ts`
  - Aggregate store rows by scoped store.
  - Emit `NET_SALES`, `ITEM_COUNT`, `TICKET_COUNT`, `FF`, `ATV`, `UPT`, `CR`, and `TARGET_ACHIEVEMENT`.
  - Derive personnel ticket count only when `P.ATV` and `P.UPT` agree with sales/quantity.
  - Preserve identity review through `employeeExternalRef` candidates without creating employees.
  - Build deterministic exact-payload `sourceBatchId`/`idempotencyKey`.
  - Return reconciliation summary in upload response.
- Modify `backend/nestjs/src/modules/integration/application/integration.service.ts`
  - Add `FF` to the canonical KPI contract imported metric list.
- Modify `backend/nestjs/src/modules/integration/application/kpi-import-normalization.service.ts`
  - Add `FF` metric candidate aliases for non-adapter canonical payload compatibility.
- Modify `backend/nestjs/src/modules/integration/application/import-data-quality.ts`
  - Add stable quality codes for missing/invalid ratio denominator and overlapping period conflicts if implementation produces failed rows for these conditions.
- Modify `backend/nestjs/test/integration/import-batch.e2e-spec.ts`
  - Assert `FF` appears in the canonical KPI payload contract.
- Create `db/migrations/034_ff_kpi_definition.sql`
  - Add the `FF` KPI definition idempotently.
- Modify `db/schema.sql`
  - Add canonical `FF` KPI definition.
- Modify `db/seeds/001_reference_seed.sql`
  - Add seeded `FF` KPI definition.

### Frontend

- Modify `admin-web/src/features/integrations/api.ts`
  - Extend upload summary types with reconciliation and denominator counts.
- Modify `admin-web/src/pages/IntegrationDashboardPage.tsx`
  - Replace month-only upload with period type + date-range controls.
  - Keep monthly as the easy default.
  - Show reconciliation summary after upload.
- Modify `admin-web/e2e/integration-surfaces.spec.ts`
  - Cover the new upload controls and summary labels.

### Docs

- Modify `docs/plans/excel-kpi-import-v1.md`
  - Add implementation completion notes after code is done.
- Modify `current-state.md`
  - Add the completed implementation and verification evidence after code is done.
- Modify `docs/plans/active-next-actions.md`
  - Move Excel KPI Import V1 from planned to completed after verification.
- Modify `docs/plans/project-debt-ledger.md`
  - Keep it as planned until code and release checks pass.

## Acceptance Data

Use this store math in tests:

```ts
const storePeriodRow = {
  MagazaAdi: "Kadikoy",
  Ciro: 97294.51,
  Hedef: 100000,
  SatisAdedi: 66,
  FaturaSayisi: 22,
  FF: 100,
  CR: 0.1,
  ATV: 1,
  UPT: 1,
};
```

Expected official values:

```text
NET_SALES = 97294.51
ITEM_COUNT = 66
TICKET_COUNT = 22
FF = 100
ATV = 97294.51 / 22 = 4422.4777272727
UPT = 66 / 22 = 3
CR = 22 / 100 = 0.22
TARGET_ACHIEVEMENT actualValue = 97294.51, targetValue = 100000
```

Use this Marmara Park reconciliation case:

```text
storeNetSales = 7765681.31
personnelPositiveSales = 7999351.19
personnelNegativeMovements = -233669.88
personnelPositiveSales + personnelNegativeMovements = 7765681.31
reconciliationDelta = 0
```

## Task 1: Backend Red Tests For Store Base Metrics And Ratio Math

**Files:**

- Modify: `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.spec.ts`

- [ ] **Step 1: Add a failing store ratio recomputation test**

Insert this test after `reads uploaded store xlsx rows and creates canonical KPI import rows`:

```ts
  it("recomputes store ATV UPT and CR from base totals instead of trusting reported ratios", async () => {
    const { integrationService, service } = createService();
    const buffer = createWorkbookBuffer([
      {
        MagazaAdi: "Kadikoy",
        Ciro: 97294.51,
        Hedef: 100000,
        SatisAdedi: 66,
        FaturaSayisi: 22,
        FF: 100,
        CR: 0.1,
        ATV: 1,
        UPT: 1,
      },
    ]);

    const response = await service.upload({
      sourceCode: "POWER_BI",
      periodType: "custom",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-02",
      actorUserId: "user-1",
      storeFile: {
        originalname: "store.xlsx",
        buffer,
      },
    });

    const rows = (integrationService.createImportBatch.mock.calls[0][0].rows ??
      []) as Array<Record<string, unknown>>;

    expect(response.data.summary).toMatchObject({
      periodType: "custom",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-02",
      storeRowsRead: 1,
      canonicalRowCount: 8,
    });
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kpiCode: "NET_SALES",
          actualValue: 97294.51,
          scopeType: "store",
          storeExternalRef: "Kadikoy",
        }),
        expect.objectContaining({
          kpiCode: "ITEM_COUNT",
          actualValue: 66,
          scopeType: "store",
          storeExternalRef: "Kadikoy",
        }),
        expect.objectContaining({
          kpiCode: "TICKET_COUNT",
          actualValue: 22,
          scopeType: "store",
          storeExternalRef: "Kadikoy",
        }),
        expect.objectContaining({
          kpiCode: "FF",
          actualValue: 100,
          scopeType: "store",
          storeExternalRef: "Kadikoy",
        }),
        expect.objectContaining({
          kpiCode: "ATV",
          actualValue: 4422.4777,
          scopeType: "store",
          storeExternalRef: "Kadikoy",
        }),
        expect.objectContaining({
          kpiCode: "UPT",
          actualValue: 3,
          scopeType: "store",
          storeExternalRef: "Kadikoy",
        }),
        expect.objectContaining({
          kpiCode: "CR",
          actualValue: 0.22,
          scopeType: "store",
          storeExternalRef: "Kadikoy",
        }),
        expect.objectContaining({
          kpiCode: "TARGET_ACHIEVEMENT",
          actualValue: 97294.51,
          targetValue: 100000,
          scopeType: "store",
          storeExternalRef: "Kadikoy",
        }),
      ]),
    );
  });
```

- [ ] **Step 2: Run this test and verify it fails**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/integration/application/power-bi-export-upload.service.spec.ts --runInBand
```

Expected before implementation:

```text
FAIL PowerBiExportUploadService
Expected canonicalRowCount: 8
Received canonicalRowCount: 6
```

- [ ] **Step 3: Update the existing first store test expected count**

When implementation emits `TICKET_COUNT` and `FF`, update the first test summary:

```ts
expect(response.data.summary).toMatchObject({
  storeRowsRead: 1,
  personnelRowsRead: 0,
  canonicalRowCount: 8,
  periodMonth: "2026-04",
  mappingMode: "strict_external_id_map",
});
```

- [ ] **Step 4: Commit Task 1 after it is red**

```powershell
git add backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.spec.ts
git commit -m "test: lock excel store kpi base metric math"
```

## Task 2: Add FF As A First-Class KPI Metric

**Files:**

- Create: `db/migrations/034_ff_kpi_definition.sql`
- Modify: `db/schema.sql`
- Modify: `db/seeds/001_reference_seed.sql`
- Modify: `backend/nestjs/src/modules/integration/application/integration.service.ts`
- Modify: `backend/nestjs/src/modules/integration/application/kpi-import-normalization.service.ts`
- Modify: `backend/nestjs/test/integration/import-batch.e2e-spec.ts`

- [ ] **Step 1: Create the FF migration**

Create `db/migrations/034_ff_kpi_definition.sql`:

```sql
INSERT INTO ops.kpi_definition (
    kpi_id,
    kpi_code,
    kpi_name,
    metric_type,
    unit_type,
    aggregation_type,
    scope_type,
    formula_definition,
    target_direction,
    is_active
)
VALUES
    ('b0000000-0000-0000-0000-000000000019', 'FF', 'Footfall', 'count', 'count', 'sum', 'store', NULL, 'higher_is_better', TRUE)
ON CONFLICT (kpi_code) DO NOTHING;
```

- [ ] **Step 2: Add FF to `db/schema.sql` and seed**

In both KPI definition value lists, add:

```sql
('b0000000-0000-0000-0000-000000000019', 'FF', 'Footfall', 'count', 'count', 'sum', 'store', NULL, 'higher_is_better', TRUE)
```

Keep commas valid in the existing `VALUES` list.

- [ ] **Step 3: Add FF to canonical contract**

In `IntegrationService.getCanonicalKpiContract()`, change:

```ts
importedMetricCodes: ["NET_SALES", "TICKET_COUNT", "ITEM_COUNT", "UPT", "ATV", "CR"],
```

to:

```ts
importedMetricCodes: ["NET_SALES", "TICKET_COUNT", "ITEM_COUNT", "FF", "UPT", "ATV", "CR"],
```

- [ ] **Step 4: Add FF to non-adapter normalization**

In `KPI_METRIC_CANDIDATES`, insert this metric after `ITEM_COUNT`:

```ts
  {
    code: "FF",
    aliases: ["ff", "footfall", "visitorCount", "trafficCount", "musteriGiris"],
    defaultScopeType: "store",
  },
```

- [ ] **Step 5: Extend the canonical contract e2e test**

In `backend/nestjs/test/integration/import-batch.e2e-spec.ts`, extend the `importedMetricCodes` expectation:

```ts
importedMetricCodes: expect.arrayContaining([
  "NET_SALES",
  "TICKET_COUNT",
  "ITEM_COUNT",
  "FF",
  "UPT",
  "ATV",
  "CR",
]),
```

- [ ] **Step 6: Run targeted contract tests**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/integration/application/kpi-import-normalization.service.spec.ts test/integration/import-batch.e2e-spec.ts --runInBand
```

Expected after implementation:

```text
PASS src/modules/integration/application/kpi-import-normalization.service.spec.ts
PASS test/integration/import-batch.e2e-spec.ts
```

- [ ] **Step 7: Commit Task 2**

```powershell
git add db/migrations/034_ff_kpi_definition.sql db/schema.sql db/seeds/001_reference_seed.sql backend/nestjs/src/modules/integration/application/integration.service.ts backend/nestjs/src/modules/integration/application/kpi-import-normalization.service.ts backend/nestjs/test/integration/import-batch.e2e-spec.ts
git commit -m "feat: add ff kpi import metric"
```

## Task 3: Implement Store Excel Aggregation And Recomputed Ratios

**Files:**

- Modify: `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.ts`
- Modify: `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.spec.ts`

- [ ] **Step 1: Add focused store aggregate types**

Near `PersonnelAggregate`, add:

```ts
type StoreAggregate = {
  storeName: string;
  rows: ExportRow[];
  netSales: number;
  targetValue: number;
  itemCount: number;
  ticketCount: number;
  footfall: number;
};
```

- [ ] **Step 2: Add numeric helpers**

Near `getNumber`, add:

```ts
  private roundMetric(value: number) {
    return Number(value.toFixed(4));
  }

  private divideMetric(numerator: number, denominator: number) {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return null;
    }

    return this.roundMetric(numerator / denominator);
  }
```

- [ ] **Step 3: Add store field readers**

Replace the current store field aliases with normalized aliases that cover ASCII and Turkish headers:

```ts
  private getStoreNetSales(row: ExportRow) {
    return this.getNumber(row, ["Ciro"]);
  }

  private getStoreTarget(row: ExportRow) {
    return this.getNumber(row, ["Hedef"]);
  }

  private getStoreItemCount(row: ExportRow) {
    return this.getNumber(row, ["SatisAdedi", "Satis Adedi", "Satış Adedi"]);
  }

  private getStoreTicketCount(row: ExportRow) {
    return this.getNumber(row, ["FaturaSayisi", "Fatura Sayisi", "Fatura Sayısı"]);
  }

  private getStoreFootfall(row: ExportRow) {
    return this.getNumber(row, ["FF", "Footfall"]);
  }
```

- [ ] **Step 4: Replace `mapStoreRows` with aggregate-first mapping**

Use this complete method body:

```ts
  private mapStoreRows(
    rows: ExportRow[],
    period: PeriodBounds,
    sourceCapturedAt: string,
    storeScope: KpiImportStoreScope,
  ): CanonicalKpiRow[] {
    const aggregates = new Map<string, StoreAggregate>();

    for (const row of rows) {
      const storeName = this.getStoreName(row);
      if (
        !storeName ||
        this.isSummaryText(storeName) ||
        !this.isStoreInKpiImportScope(storeName, storeScope)
      ) {
        continue;
      }

      const aggregateKey = this.normalizeKey(storeName);
      const aggregate =
        aggregates.get(aggregateKey) ??
        {
          storeName,
          rows: [],
          netSales: 0,
          targetValue: 0,
          itemCount: 0,
          ticketCount: 0,
          footfall: 0,
        };

      aggregate.rows.push(row);
      aggregate.netSales += this.getStoreNetSales(row) ?? 0;
      aggregate.targetValue += this.getStoreTarget(row) ?? 0;
      aggregate.itemCount += this.getStoreItemCount(row) ?? 0;
      aggregate.ticketCount += this.getStoreTicketCount(row) ?? 0;
      aggregate.footfall += this.getStoreFootfall(row) ?? 0;
      aggregates.set(aggregateKey, aggregate);
    }

    return [...aggregates.values()].flatMap((aggregate) => {
      const sourceRow = this.buildStoreSourceRow(aggregate);
      const atv = this.divideMetric(aggregate.netSales, aggregate.ticketCount);
      const upt = this.divideMetric(aggregate.itemCount, aggregate.ticketCount);
      const cr = this.divideMetric(aggregate.ticketCount, aggregate.footfall);

      return [
        this.buildStoreMetricRow(
          "TARGET_ACHIEVEMENT",
          aggregate.netSales > 0 ? this.roundMetric(aggregate.netSales) : null,
          aggregate.targetValue > 0 ? this.roundMetric(aggregate.targetValue) : null,
          aggregate.storeName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildStoreMetricRow(
          "NET_SALES",
          aggregate.netSales > 0 ? this.roundMetric(aggregate.netSales) : null,
          null,
          aggregate.storeName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildStoreMetricRow(
          "ITEM_COUNT",
          aggregate.itemCount > 0 ? this.roundMetric(aggregate.itemCount) : null,
          null,
          aggregate.storeName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildStoreMetricRow(
          "TICKET_COUNT",
          aggregate.ticketCount > 0 ? this.roundMetric(aggregate.ticketCount) : null,
          null,
          aggregate.storeName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildStoreMetricRow(
          "FF",
          aggregate.footfall > 0 ? this.roundMetric(aggregate.footfall) : null,
          null,
          aggregate.storeName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildStoreMetricRow(
          "ATV",
          atv,
          null,
          aggregate.storeName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildStoreMetricRow(
          "UPT",
          upt,
          null,
          aggregate.storeName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildStoreMetricRow(
          "CR",
          cr,
          null,
          aggregate.storeName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
      ].filter((item): item is CanonicalKpiRow => item !== null);
    });
  }
```

- [ ] **Step 5: Add store source row builder**

Near `buildPersonnelSourceRow`, add:

```ts
  private buildStoreSourceRow(aggregate: StoreAggregate): Record<string, unknown> {
    return {
      sourceKind: "store_net_sales",
      storeName: aggregate.storeName,
      sourceRowCount: aggregate.rows.length,
      storeNetSales: this.roundMetric(aggregate.netSales),
      storeTargetValue: this.roundMetric(aggregate.targetValue),
      storeItemCount: this.roundMetric(aggregate.itemCount),
      storeTicketCount: this.roundMetric(aggregate.ticketCount),
      storeFootfall: this.roundMetric(aggregate.footfall),
      recomputedAtv: this.divideMetric(aggregate.netSales, aggregate.ticketCount),
      recomputedUpt: this.divideMetric(aggregate.itemCount, aggregate.ticketCount),
      recomputedCr: this.divideMetric(aggregate.ticketCount, aggregate.footfall),
      recomputedCrDisplayPercent:
        this.divideMetric(aggregate.ticketCount, aggregate.footfall) === null
          ? null
          : this.roundMetric((this.divideMetric(aggregate.ticketCount, aggregate.footfall) ?? 0) * 100),
      sourceRows: aggregate.rows,
    };
  }
```

- [ ] **Step 6: Run store adapter tests**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/integration/application/power-bi-export-upload.service.spec.ts --runInBand
```

Expected after Task 3:

```text
PASS src/modules/integration/application/power-bi-export-upload.service.spec.ts
```

- [ ] **Step 7: Commit Task 3**

```powershell
git add backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.ts backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.spec.ts
git commit -m "feat: recompute excel store kpi ratios"
```

## Task 4: Personnel Gross Sales, Ticket Derivation, And Reconciliation

**Files:**

- Modify: `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.ts`
- Modify: `admin-web/src/features/integrations/api.ts`

- [ ] **Step 1: Add a failing personnel ticket derivation test**

Append this test to `PowerBiExportUploadService`:

```ts
  it("derives personnel ticket count only when PATV and PUPT agree", async () => {
    const { integrationService, service } = createService();
    const buffer = createWorkbookBuffer([
      {
        Adi: "Ali Can",
        MagazaAdi: "Istanbul Marmara Park Avm",
        PSatisAdeti: 10,
        SatisTutari: 10000,
        PATV: 1000,
        PUPT: 1,
      },
    ]);

    await service.upload({
      sourceCode: "POWER_BI",
      periodMonth: "2026-03",
      actorUserId: "user-1",
      personnelFile: {
        originalname: "personnel.xlsx",
        buffer,
      },
    });

    const rows = (integrationService.createImportBatch.mock.calls[0][0].rows ??
      []) as Array<Record<string, unknown>>;

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kpiCode: "TICKET_COUNT",
          actualValue: 10,
          scopeType: "employee",
          employeeExternalRef: "powerbi:Ali Can",
        }),
        expect.objectContaining({
          kpiCode: "ATV",
          actualValue: 1000,
          scopeType: "employee",
          employeeExternalRef: "powerbi:Ali Can",
        }),
        expect.objectContaining({
          kpiCode: "UPT",
          actualValue: 1,
          scopeType: "employee",
          employeeExternalRef: "powerbi:Ali Can",
        }),
      ]),
    );
  });
```

- [ ] **Step 2: Add a failing Marmara Park reconciliation test expectation**

Extend `keeps store net sales as the store KPI source without applying personnel returns twice` with:

```ts
const response = await service.upload({
  sourceCode: "POWER_BI",
  periodMonth: "2026-03",
  actorUserId: "user-1",
  storeFile: {
    originalname: "store.xlsx",
    buffer: storeBuffer,
  },
  personnelFile: {
    originalname: "personnel.xlsx",
    buffer: personnelBuffer,
  },
});

expect(response.data.summary.reconciliation).toMatchObject({
  comparedStoreCount: 1,
  balancedStoreCount: 1,
  warningStoreCount: 0,
  items: [
    expect.objectContaining({
      storeExternalRef: "Istanbul Marmara Park Avm",
      storeNetSales: 7765681.31,
      personnelPositiveSales: 1440513.86,
      personnelNegativeMovements: -15099.9,
    }),
  ],
});
```

For the full Marmara Park acceptance case, use this personnel buffer:

```ts
const personnelBuffer = createWorkbookBuffer([
  {
    Adi: "EMRAH KARADEMIR",
    MagazaAdi: "Istanbul Marmara Park Avm",
    PSatisAdeti: 1346,
    SatisTutari: 1440513.86,
  },
  {
    Adi: "AYSE YILMAZ",
    MagazaAdi: "Istanbul Marmara Park Avm",
    PSatisAdeti: 5020,
    SatisTutari: 6558837.33,
  },
  {
    Adi: "E-Store",
    MagazaAdi: "Istanbul Marmara Park Avm",
    PSatisAdeti: -10,
    SatisTutari: -15099.9,
  },
  {
    Adi: "IADE HAREKETI",
    MagazaAdi: "Istanbul Marmara Park Avm",
    PSatisAdeti: -150,
    SatisTutari: -218569.98,
  },
]);
```

Then expect:

```ts
expect(response.data.summary.reconciliation.items[0]).toMatchObject({
  storeExternalRef: "Istanbul Marmara Park Avm",
  storeNetSales: 7765681.31,
  personnelPositiveSales: 7999351.19,
  personnelNegativeMovements: -233669.88,
  personnelNetMovement: 7765681.31,
  reconciliationDelta: 0,
  status: "balanced",
});
```

- [ ] **Step 3: Add personnel ticket fields to `PersonnelAggregate`**

Change `PersonnelAggregate` to:

```ts
type PersonnelAggregate = {
  personName: string;
  primaryStoreName: string;
  rows: ExportRow[];
  grossSales: number;
  itemCount: number;
  derivedTicketCount: number;
  denominatorConflictCount: number;
};
```

- [ ] **Step 4: Add ticket derivation helper**

Near personnel readers, add:

```ts
  private derivePersonnelTicketCount(row: ExportRow) {
    const salesAmount = this.getPersonnelSalesAmount(row);
    const itemCount = this.getPersonnelItemCount(row);
    const reportedAtv = this.getNumber(row, ["PATV", "P.ATV"]);
    const reportedUpt = this.getNumber(row, ["PUPT", "P.UPT"]);

    const fromAtv =
      salesAmount !== null && reportedAtv !== null && reportedAtv > 0
        ? salesAmount / reportedAtv
        : null;
    const fromUpt =
      itemCount !== null && reportedUpt !== null && reportedUpt > 0
        ? itemCount / reportedUpt
        : null;

    if (fromAtv === null && fromUpt === null) {
      return { ticketCount: null, hasConflict: false };
    }

    if (fromAtv !== null && fromUpt !== null && Math.abs(fromAtv - fromUpt) > 0.05) {
      return { ticketCount: null, hasConflict: true };
    }

    const ticketCount = fromAtv ?? fromUpt;
    return {
      ticketCount: ticketCount === null ? null : this.roundMetric(ticketCount),
      hasConflict: false,
    };
  }
```

- [ ] **Step 5: Update personnel aggregation**

Inside `mapPersonnelRows`, initialize:

```ts
derivedTicketCount: 0,
denominatorConflictCount: 0,
```

After item count aggregation, add:

```ts
      const derivedTicket = this.derivePersonnelTicketCount(row);
      if (derivedTicket.ticketCount !== null) {
        aggregate.derivedTicketCount += derivedTicket.ticketCount;
      }
      if (derivedTicket.hasConflict) {
        aggregate.denominatorConflictCount += 1;
      }
```

- [ ] **Step 6: Emit personnel ticket and recomputed ratio rows**

In the personnel `rows` array, after `ITEM_COUNT`, add:

```ts
        this.buildEmployeeMetricRow(
          "TICKET_COUNT",
          aggregate.derivedTicketCount > 0 ? this.roundMetric(aggregate.derivedTicketCount) : null,
          aggregate.personName,
          aggregate.primaryStoreName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildEmployeeMetricRow(
          "ATV",
          this.divideMetric(aggregate.grossSales, aggregate.derivedTicketCount),
          aggregate.personName,
          aggregate.primaryStoreName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
        this.buildEmployeeMetricRow(
          "UPT",
          this.divideMetric(aggregate.itemCount, aggregate.derivedTicketCount),
          aggregate.personName,
          aggregate.primaryStoreName,
          period,
          sourceCapturedAt,
          sourceRow,
        ),
```

Remove the old `if (aggregate.rows.length === 1)` block that copied `PATV` and `PUPT` directly.

- [ ] **Step 7: Extend personnel source row lineage**

Update `buildPersonnelSourceRow`:

```ts
  private buildPersonnelSourceRow(aggregate: PersonnelAggregate): Record<string, unknown> {
    return {
      sourceKind: "personnel_gross_sales",
      personName: aggregate.personName,
      primaryStoreName: aggregate.primaryStoreName,
      positiveRowCount: aggregate.rows.length,
      personnelGrossSales: this.roundMetric(aggregate.grossSales),
      personnelPositiveItemCount: this.roundMetric(aggregate.itemCount),
      personnelDerivedTicketCount: this.roundMetric(aggregate.derivedTicketCount),
      denominatorConflictCount: aggregate.denominatorConflictCount,
      sourceRows: aggregate.rows,
    };
  }
```

- [ ] **Step 8: Add reconciliation summary type to frontend API**

In `PowerBiExportUploadResponse.data.summary`, add:

```ts
      reconciliation: {
        comparedStoreCount: number
        balancedStoreCount: number
        warningStoreCount: number
        items: Array<{
          storeExternalRef: string
          storeNetSales: number
          personnelPositiveSales: number
          personnelNegativeMovements: number
          personnelNetMovement: number
          reconciliationDelta: number
          status: 'balanced' | 'warning'
        }>
      }
```

- [ ] **Step 9: Run targeted adapter tests**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/integration/application/power-bi-export-upload.service.spec.ts --runInBand
```

Expected after Task 4:

```text
PASS src/modules/integration/application/power-bi-export-upload.service.spec.ts
```

- [ ] **Step 10: Commit Task 4**

```powershell
git add backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.ts backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.spec.ts admin-web/src/features/integrations/api.ts
git commit -m "feat: import personnel gross sales reconciliation"
```

## Task 5: Deterministic Re-Upload And Period Controls

**Files:**

- Modify: `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.ts`
- Modify: `admin-web/src/pages/IntegrationDashboardPage.tsx`
- Modify: `admin-web/e2e/integration-surfaces.spec.ts`

- [ ] **Step 1: Add a failing deterministic batch key test**

Append this test:

```ts
  it("uses a deterministic exact-payload source batch id for duplicate-safe reupload", async () => {
    const { integrationService, service } = createService();
    const buffer = createWorkbookBuffer([
      {
        MagazaAdi: "Kadikoy",
        Ciro: 100000,
        Hedef: 100000,
        SatisAdedi: 50,
        FaturaSayisi: 10,
        FF: 100,
      },
    ]);

    await service.upload({
      sourceCode: "POWER_BI",
      periodType: "daily",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-01",
      actorUserId: "user-1",
      storeFile: {
        originalname: "store.xlsx",
        buffer,
      },
    });

    const firstCall = integrationService.createImportBatch.mock.calls[0][0];
    expect(firstCall.sourceBatchId).toMatch(
      /^power-bi-export:POWER_BI:daily:2026-03-01:2026-03-01:[a-f0-9]{12}$/,
    );
    expect(firstCall.idempotencyKey).toBe(firstCall.sourceBatchId);
  });
```

- [ ] **Step 2: Replace Date-based source batch id**

In `upload`, replace the current `sourceBatchId` construction with:

```ts
      const sourceBatchId = [
        "power-bi-export",
        input.sourceCode,
        periodBounds.periodType,
        periodBounds.periodStart,
        periodBounds.periodEnd,
        payloadHash.slice(0, 12),
      ].join(":");
```

And add `idempotencyKey: sourceBatchId` to `createImportBatch` input:

```ts
        sourceBatchId,
        idempotencyKey: sourceBatchId,
        sourcePayloadHash: payloadHash,
```

This means:

- Same file + same period + same canonical output reuses the batch.
- Corrected file + same period creates a new batch with a different payload hash.
- The existing `ops.kpi_actual` conflict target overwrites same KPI/scope/period values instead of double-counting.

- [ ] **Step 3: Add period state to the admin dashboard**

In `IntegrationDashboardPage`, replace the month-only state with:

```ts
  const [powerBiPeriodType, setPowerBiPeriodType] = useState<'daily' | 'monthly' | 'custom'>('monthly')
  const [powerBiPeriodMonth, setPowerBiPeriodMonth] = useState(new Date().toISOString().slice(0, 7))
  const [powerBiPeriodStart, setPowerBiPeriodStart] = useState(new Date().toISOString().slice(0, 10))
  const [powerBiPeriodEnd, setPowerBiPeriodEnd] = useState(new Date().toISOString().slice(0, 10))
```

Add this derived helper before `return`:

```ts
  const isPowerBiPeriodValid =
    powerBiPeriodType === 'monthly'
      ? Boolean(powerBiPeriodMonth)
      : Boolean(powerBiPeriodStart && powerBiPeriodEnd && powerBiPeriodEnd >= powerBiPeriodStart)
```

- [ ] **Step 4: Replace upload period controls**

Replace the existing `Donem ayi` field with:

```tsx
          <label className="field-block">
            <span>Donem tipi</span>
            <select
              value={powerBiPeriodType}
              onChange={(event) =>
                setPowerBiPeriodType(event.target.value as 'daily' | 'monthly' | 'custom')
              }
            >
              <option value="monthly">Aylik snapshot</option>
              <option value="daily">Gunluk veri</option>
              <option value="custom">Ozel tarih araligi</option>
            </select>
          </label>

          {powerBiPeriodType === 'monthly' ? (
            <label className="field-block">
              <span>Donem ayi</span>
              <input
                type="month"
                value={powerBiPeriodMonth}
                onChange={(event) => setPowerBiPeriodMonth(event.target.value)}
              />
            </label>
          ) : (
            <>
              <label className="field-block">
                <span>Baslangic</span>
                <input
                  type="date"
                  value={powerBiPeriodStart}
                  onChange={(event) => {
                    setPowerBiPeriodStart(event.target.value)
                    if (powerBiPeriodType === 'daily') {
                      setPowerBiPeriodEnd(event.target.value)
                    }
                  }}
                />
              </label>
              <label className="field-block">
                <span>Bitis</span>
                <input
                  type="date"
                  value={powerBiPeriodType === 'daily' ? powerBiPeriodStart : powerBiPeriodEnd}
                  disabled={powerBiPeriodType === 'daily'}
                  onChange={(event) => setPowerBiPeriodEnd(event.target.value)}
                />
              </label>
            </>
          )}
```

- [ ] **Step 5: Send period fields with upload**

Change the upload mutate body to:

```tsx
              uploadPowerBiMutation.mutate({
                sourceCode: resolvedPowerBiSourceCode,
                periodType: powerBiPeriodType,
                periodMonth: powerBiPeriodType === 'monthly' ? powerBiPeriodMonth : undefined,
                periodStart: powerBiPeriodType === 'monthly' ? undefined : powerBiPeriodStart,
                periodEnd:
                  powerBiPeriodType === 'monthly'
                    ? undefined
                    : powerBiPeriodType === 'daily'
                      ? powerBiPeriodStart
                      : powerBiPeriodEnd,
                personnelFile,
                storeFile,
              })
```

Add `!isPowerBiPeriodValid` to the upload button disabled expression.

- [ ] **Step 6: Show reconciliation summary**

After the upload key grid, add:

```tsx
          {uploadPowerBiMutation.data.data.summary.reconciliation.items.length > 0 ? (
            <div className="key-grid" aria-label="Power BI reconciliation summary">
              <div className="key-item">
                <span>Karsilastirilan magaza</span>
                <strong>{uploadPowerBiMutation.data.data.summary.reconciliation.comparedStoreCount}</strong>
              </div>
              <div className="key-item">
                <span>Dengeli magaza</span>
                <strong>{uploadPowerBiMutation.data.data.summary.reconciliation.balancedStoreCount}</strong>
              </div>
              <div className="key-item">
                <span>Uyari veren magaza</span>
                <strong>{uploadPowerBiMutation.data.data.summary.reconciliation.warningStoreCount}</strong>
              </div>
            </div>
          ) : null}
```

- [ ] **Step 7: Extend Playwright upload surface test**

In `admin-web/e2e/integration-surfaces.spec.ts`, add a test that checks the new controls render:

```ts
test('admin dashboard exposes Power BI period controls', async ({ page }) => {
  await page.goto('/admin/integrations')

  await expect(page.getByLabel('Donem tipi')).toBeVisible()
  await page.getByLabel('Donem tipi').selectOption('daily')
  await expect(page.getByLabel('Baslangic')).toBeVisible()
  await expect(page.getByLabel('Bitis')).toBeDisabled()

  await page.getByLabel('Donem tipi').selectOption('custom')
  await expect(page.getByLabel('Bitis')).toBeEnabled()
})
```

- [ ] **Step 8: Run frontend targeted check**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run build
npm.cmd run test:e2e -- e2e/integration-surfaces.spec.ts
```

Expected after Task 5:

```text
vite build succeeds
2 passed
```

- [ ] **Step 9: Commit Task 5**

```powershell
git add backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.ts backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.spec.ts admin-web/src/pages/IntegrationDashboardPage.tsx admin-web/e2e/integration-surfaces.spec.ts
git commit -m "feat: add excel kpi period upload controls"
```

## Task 6: Full Verification And Handoff Update

**Files:**

- Modify: `docs/plans/excel-kpi-import-v1.md`
- Modify: `current-state.md`
- Modify: `docs/plans/active-next-actions.md`
- Modify: `docs/plans/project-debt-ledger.md`

- [ ] **Step 1: Run backend targeted tests**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/integration/application/power-bi-export-upload.service.spec.ts src/modules/integration/application/kpi-import-normalization.service.spec.ts test/integration/import-batch.e2e-spec.ts --runInBand
```

Expected:

```text
PASS src/modules/integration/application/power-bi-export-upload.service.spec.ts
PASS src/modules/integration/application/kpi-import-normalization.service.spec.ts
PASS test/integration/import-batch.e2e-spec.ts
```

- [ ] **Step 2: Run backend release check**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run check:release
```

Expected:

```text
lint passes
jest passes
build passes
npm audit --omit=dev passes
```

- [ ] **Step 3: Run frontend release check**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run check:release
```

Expected:

```text
lint passes
script tests pass
vite build passes
playwright tests pass
npm audit --omit=dev passes
```

- [ ] **Step 4: Run root release check**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run check:release
```

Expected:

```text
root script tests pass
backend release check passes
frontend release check passes
```

- [ ] **Step 5: Run diff hygiene**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git diff --check
```

Expected:

```text
no trailing whitespace errors
```

- [ ] **Step 6: Update handoff docs**

Add a completed section to `docs/plans/excel-kpi-import-v1.md`:

```markdown
## Implementation Result

Excel KPI Import V1 is implemented.

- Store Excel rows are scoped to enabled local stores.
- Store net sales comes from `MAGAZA TABLO.xlsx`.
- Store `ATV`, `UPT`, and `CR` are recomputed from base metrics.
- Personnel KPI rows use only positive gross sales from `PERSONEL TABLO.xlsx`.
- Negative personnel rows remain reconciliation evidence and are not subtracted from personnel.
- Re-upload uses deterministic exact-payload idempotency and live KPI upsert semantics.
- Unknown store/personnel identities flow through external ID mapping review instead of creating temporary records.
```

Update `current-state.md` with verification evidence and the new next logical step.

Update `docs/plans/active-next-actions.md` to mark Excel KPI Import V1 implemented.

Update `docs/plans/project-debt-ledger.md` so Excel KPI Import V1 is no longer only a formula decision.

- [ ] **Step 7: Commit Task 6**

```powershell
git add docs/plans/excel-kpi-import-v1.md current-state.md docs/plans/active-next-actions.md docs/plans/project-debt-ledger.md
git commit -m "docs: record excel kpi import v1 result"
```

## CODEX DURUST YORUM

This is the correct next backend/data move. The project does not need a new scoring engine or a new master-data import module before this. It needs one real-data path that proves the KPI platform can ingest messy operational exports without corrupting scores.

The biggest risk is not Excel parsing. The biggest risk is accidentally turning source names into official identities or averaging ratios that should be recomputed from denominators. This plan avoids both. It keeps names as mapping candidates, keeps store scope explicit through `kpi_import_enabled`, and makes `Fatura Sayisi` plus `FF` first-class base metrics.

The plan is also deliberately V1-sized. It does not solve every future data-source shape. It proves the business math and the staging/materialization path with the files we actually have.

## Out Of V1

- Automatic creation of stores from Excel names.
- Automatic creation of employees from Excel names.
- Daily fact explosion from monthly/custom snapshot files without row-level business dates.
- Production visual redesign of the import surface.
- Full employee master-data bootstrap.
- JSON source connector implementation.
- Push notifications for import completion.

## Final Verification Gate

The implementation is not done until all of these pass:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/integration/application/power-bi-export-upload.service.spec.ts src/modules/integration/application/kpi-import-normalization.service.spec.ts test/integration/import-batch.e2e-spec.ts --runInBand
npm.cmd run check:release
```

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run check:release
```

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run check:release
git diff --check
```
