# Excel KPI Import V1

## Purpose

This document locks the first Excel KPI import rules for the March store and personnel files.

The goal is to import real KPI snapshots without double-counting, without creating temporary stores or employees, and without calculating period ratios incorrectly.

## Source Files

Inspected files:

- `C:\Users\suley\Downloads\MAĞAZA TABLO.xlsx`
- `C:\Users\suley\Downloads\PERSONEL TABLO.xlsx`

Decision:

- These files are KPI snapshot inputs.
- They are not official store/personnel master-data baseline files.
- They do not contain store codes, seller codes, region, store type, position, hire date, or employment status.

## Period Selection

The upload flow must require the operator to choose the period represented by the file.

Supported V1 period types:

- `daily`: one business day
- `custom`: a selected date range
- `monthly`: one full calendar month snapshot

Required period fields:

- `periodType`
- `periodStart`
- `periodEnd`

Rules:

- For a 1-day upload, `periodStart` and `periodEnd` are the same day.
- For a 4-day upload, `periodStart` is the first day and `periodEnd` is the fourth day.
- A custom range upload must not be exploded into daily records unless the file itself contains daily row-level dates.
- Daily ranking and daily closure should use daily uploads only.
- Custom or monthly uploads can be used for period reporting/reconciliation, but overlapping daily/custom windows must be guarded against double counting.

## Idempotency And Re-Upload

Re-uploading the same source, period, scope, and metric must update/replace the prior value, not add a second value.

Idempotency key should include:

- source code
- file type
- period type
- period start
- period end
- store identity
- employee/personnel identity when available
- metric code
- row hash or source row reference

Example:

```text
1 March store sales loaded as 100000
1 March store sales loaded again as 105000
official value = 105000, not 205000
```

## Additive Metrics

These metrics are additive across days or rows:

- store net sales / ciro
- personnel gross positive sales
- sales quantity / satis adedi
- invoice count / fatura sayisi
- FF / footfall
- target value when the source represents the same period granularity

Period value:

```text
period additive metric = sum(included rows)
```

## Ratio Metrics: Locked Rule

Do not calculate period ATV, UPT, or CR by averaging daily ratio values.

The official period ratio must be recomputed from summed base metrics.

### ATV

Business formula:

```text
ATV = total sales amount / total invoice count
```

For store period reporting:

```text
store ATV = sum(store net sales) / sum(invoice count)
```

For personnel period reporting:

```text
personnel ATV = sum(personnel positive gross sales) / sum(personnel invoice count)
```

### UPT

Business formula:

```text
UPT = total sales quantity / total invoice count
```

For store period reporting:

```text
store UPT = sum(sales quantity) / sum(invoice count)
```

For personnel period reporting:

```text
personnel UPT = sum(positive personnel sales quantity) / sum(personnel invoice count)
```

### CR

Business display formula:

```text
CR% = invoice count / FF * 100
```

Internal numeric storage may use a decimal ratio if existing KPI conventions require it:

```text
CR ratio = invoice count / FF
```

But the business meaning is locked:

```text
display CR percent = invoice count / FF * 100
```

For period reporting:

```text
period CR% = sum(invoice count) / sum(FF) * 100
```

## Current System Evidence

The user's current company system was checked with a two-day example:

1 March:

- ATV: 4397.61
- UPT: 3.11
- sales quantity: 59
- sales amount: 83554.58

2 March:

- ATV: 4579.98
- UPT: 2.33
- sales quantity: 7
- sales amount: 13739.93

Two-day filter:

- ATV: 4422.48
- UPT: 3.00
- sales quantity: 66
- sales amount: 97294.51

Derived invoice counts:

```text
1 March invoice count = 83554.58 / 4397.61 = 19
2 March invoice count = 13739.93 / 4579.98 = 3
period invoice count = 22
```

Period formulas:

```text
ATV = 97294.51 / 22 = 4422.48
UPT = 66 / 22 = 3.00
```

This proves the source business system recomputes period ATV and UPT from base totals instead of averaging daily ratios.

## Store Excel Mapping

`MAĞAZA TABLO.xlsx` is the authoritative store KPI source for V1.

Columns:

- `Mağaza Adı`
- `Hedef`
- `Ciro`
- `Gerçekleşen %`
- `Satış Adedi`
- `FF`
- `CR`
- `ATV`
- `Fatura Sayısı`
- `UPT`
- `OSF`
- `Geçen Yıl Ciro`
- `Ciro Artış`

V1 mapping:

- store name -> external store name candidate
- `Hedef` -> store target value
- `Ciro` -> store net sales
- `Satış Adedi` -> store sales quantity
- `FF` -> store footfall
- `Fatura Sayısı` -> store invoice count
- `ATV`, `UPT`, `CR` -> reported source ratios for daily/source evidence

Period recomputation:

- official period ATV recomputed from `Ciro` and `Fatura Sayısı`
- official period UPT recomputed from `Satış Adedi` and `Fatura Sayısı`
- official period CR recomputed from `Fatura Sayısı` and `FF`
- imported reported ratios remain lineage/evidence and can be compared against recomputed values

## Personnel Excel Mapping

`PERSONEL TABLO.xlsx` is the personnel KPI input for V1, but only positive sales rows create employee KPI facts.

Columns:

- `Adı`
- `Mağaza Adı`
- `P. Satış Adeti`
- `Satış Tutarı`
- `Ciro Payı`
- `Mağaza Cirosu`
- `P.ATV`
- `P.UPT`

Rules:

- `Satış Tutarı > 0` creates personnel KPI contribution.
- `Satış Tutarı < 0` does not reduce employee KPI.
- `Satış Tutarı < 0` stays as reconciliation evidence.
- `Satış Tutarı = 0` does not create a positive personnel sales contribution.
- Employee identity must not be created from `Adı`.
- If seller code is unavailable, row becomes identity review evidence rather than official employee score.

Personnel invoice count:

- V1 should prefer an explicit personnel invoice count if future files include it.
- Current file does not include one.
- Current file can derive a candidate invoice count from:

```text
Satış Tutarı / P.ATV
```

or:

```text
P. Satış Adeti / P.UPT
```

Derivation rule:

- accept derived invoice count only when both available formulas agree within tolerance and resolve to a sensible invoice count
- otherwise classify the row as a quality/reconciliation issue for ratio aggregation

## Store Net vs Personnel Gross Rule

Locked business rule:

- store performance uses net store ciro from `MAĞAZA TABLO.xlsx`
- personnel performance uses positive gross personnel sales from `PERSONEL TABLO.xlsx`
- negative personnel rows explain returns/exchanges/netting
- negative personnel rows must not be subtracted from employee performance
- negative personnel rows must not be subtracted from store performance a second time

Marmara Park acceptance case:

```text
personnel positive sales + personnel negative movements = store net ciro
```

## Unknown Identity Handling

No automatic temporary records.

Unknown or unresolved identities must become review evidence:

- unknown store -> `unmapped_store`
- unknown employee/personnel -> `unmapped_employee`
- missing invoice denominator -> `missing_invoice_count`
- conflicting ratio denominator -> `ratio_denominator_conflict`
- overlapping period upload -> `overlapping_period_conflict`

## Reporting Semantics

Daily view:

- show the reported/imported daily values for that business day
- if recomputed values differ from reported values beyond tolerance, flag a data quality issue

Period view:

- additive metrics are summed
- ATV, UPT, and CR are recomputed from summed base metrics
- daily ratio averages may be shown only if explicitly labeled as "daily average", not as official period KPI

## CODEX DURUST YORUM

This rule is important enough to lock before implementation.

Averaging daily UPT/ATV/CR would look intuitive but produce wrong period values when daily volume differs. The user's company system confirms the correct behavior: period ratios are recomputed from total sales, total quantity, total invoice count, and total FF.

This decision reduces future reporting disputes. It also makes `Fatura Sayısı` and `FF` first-class import fields, not optional decoration.

Recommendation: implement Excel KPI Import V1 with base-metric aggregation first. Do not ship a period ranking or monthly score that averages daily ratios unless it is clearly labeled as a separate daily-average view.

## Implementation Plan

Created: 28 April 2026

Reference:

- `docs/superpowers/plans/2026-04-28-excel-kpi-import-v1.md`

Plan coverage:

- upload period selection
- store Excel parser/mapping
- personnel Excel parser/mapping
- `FF` base metric persistence
- recomputed ratio output
- identity review queues
- idempotent re-upload behavior
- backend/frontend/root release verification

## Implementation Result

Implemented: 28 April 2026

Result:

- Store Excel rows are scoped to stores enabled in local master data.
- `FF` is now a first-class imported KPI base metric.
- Store `NET_SALES`, `ITEM_COUNT`, `TICKET_COUNT`, `FF`, `ATV`, `UPT`, `CR`, and `TARGET_ACHIEVEMENT` canonical rows are produced from the Excel adapter.
- Store `ATV`, `UPT`, and `CR` are recomputed from base totals instead of trusting or averaging reported ratio columns.
- Personnel KPI rows use only positive gross personnel sales.
- Personnel negative rows do not reduce employee performance.
- Personnel negative rows stay in reconciliation evidence.
- Personnel `TICKET_COUNT`, `ATV`, and `UPT` are produced only when `P.ATV` and `P.UPT` denominator derivation is consistent.
- Marmara Park acceptance case is covered by test: personnel positive sales + personnel negative movements = store net ciro.
- Re-upload uses deterministic exact-payload `sourceBatchId` and `idempotencyKey`; corrected same-period files create a different payload hash while live KPI upsert prevents double counting.
- Admin Excel upload UI supports monthly, daily, and custom period selection.

Verification:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/integration/application/power-bi-export-upload.service.spec.ts src/modules/integration/application/kpi-import-normalization.service.spec.ts test/integration/import-batch.e2e-spec.ts --runInBand
```

Result: 3 suites / 43 tests passed.

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run build
npm.cmd run test:e2e -- e2e/integration-surfaces.spec.ts
```

Result: build passed, 3 Playwright tests passed.

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run check:release
```

Result: root release gate passed; backend 43 suites / 309 tests, frontend 34 Playwright tests, build and `npm audit --omit=dev` passed.

## Next Logical Step

Operator runbook is now available at `docs/plans/excel-kpi-import-operator-runbook.md`.

Use the implemented import path with the real March files after local store mapping/scope is ready. The next nearby product step is the first controlled March import pilot: upload the files, inspect summary/reconciliation, resolve or document unmapped identities, decide retry/materialization, and record evidence through the runbook template.
