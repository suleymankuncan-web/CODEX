# External Source Canonical Data Contract V1

## Goal

Define the provider-agnostic row shapes HR Axis expects after external source extraction and before domain materialization.

This contract is the boundary between source adapters and HR Axis domain modules. The adapter may read Power BI, Excel, JSON, Nebim, or another future source. Domain pages must not read provider-native payloads directly.

## Current Decision

- Power BI/Excel remains the current active source path.
- JSON/Nebim direct pull is parked until provider fields and access method are known.
- Domain pages must not read provider-native payloads directly.
- Adapter output must be canonical, validated, and auditable.
- This document does not assume Nebim field names.
- No source adapter may auto-create store, region, or employee master data.

## Boundary

```text
Provider file/API
  -> source adapter
  -> canonical rows
  -> validation and quarantine
  -> accepted facts
  -> domain materialization
  -> KPI, ranking, target, incentive, checklist, workforce, report surfaces
```

Source adapters own provider parsing. Domain modules own business meaning. A source-specific branch in KPI, ranking, incentive, target, checklist, workforce, or report code is not allowed.

## Canonical Dimensions

Every accepted or quarantined row must keep enough lineage to prove where it came from.

| Field | Type | Required | Rule |
|---|---|---:|---|
| `sourceSystem` | string | yes | Example: `power-bi`, `excel`, future `nebim`; provider label only |
| `sourceBatchId` | string | yes | Stable id for one extraction/import batch |
| `sourceRowId` | string | yes | Stable row id or generated hash from immutable source fields |
| `sourceRowHash` | string | yes | Hash of immutable canonical identity fields plus raw evidence |
| `period` | `YYYY-MM` | yes | Month being reported |
| `businessDate` | `YYYY-MM-DD` | yes when daily data exists | Sales/action date; monthly rows may use last day of month |
| `storeCode` | string | yes | Must map to one active store or go to quarantine |
| `storeNameRaw` | string | no | Evidence only, not a join key by itself |
| `regionCodeRaw` | string | no | Evidence only; region scope comes from HR Axis assignments |
| `employeeCode` | string | no | Required for personnel-level sales/performance |
| `employeeNameRaw` | string | no | Evidence only, not a join key by itself |
| `metricCode` | string | yes | Canonical metric code such as `NET_SALES`, `GSM_ONAY`, `CR` |
| `metricValue` | decimal/string | yes | Parsed by metric-specific adapter; preserve precision |
| `currencyCode` | string | no | Required for money metrics; default `TRY` only if source omits and source is known TRY |
| `quantity` | decimal/string | no | Used for units, transactions, or people counts |
| `transactionType` | string | no | Example: `sale`, `return`, `exchange`, `adjustment` |
| `importedAt` | ISO datetime | yes | System import timestamp |

## Matching Rules

Store matching:

1. Exact external store code mapping wins.
2. Active HR Axis store code fallback may be used only when the source code format is already approved.
3. Store name is evidence only and must not create a match by itself.
4. Ambiguous store matches go to quarantine.

Employee matching:

1. Exact employee/personnel code mapping wins.
2. Name matching is evidence only and must not create a payroll/personnel match by itself.
3. Missing employee code is acceptable only for store-level facts.
4. Personnel-level facts without a resolvable employee go to quarantine.

Region matching:

1. Region manager scope is read from HR Axis assignments.
2. Provider region labels are evidence only.
3. Provider region labels must not override HR Axis region/store assignments.

## Canonical Fact Families

### Sales Fact

Required fields:

- `period`
- `businessDate`
- `storeCode`
- `employeeCode` for personnel-level sales
- `metricCode`
- `metricValue`
- `currencyCode`
- `transactionType`

Rules:

- Store sales can be accepted without employee mapping only when the row is store-level.
- Personnel sales require employee mapping.
- Returns and exchanges follow the operational source event. A return or exchange in another store affects the receiving/processing store when the approved source represents it that way; it must not silently rewrite the original salesperson's accepted sale.
- Money values are preserved as decimal strings until the domain layer decides display formatting.

### Target Fact

Required fields:

- `period`
- `storeCode`
- `metricCode`
- `metricValue`
- `sourceBatchId`
- `sourceRowId`

Rules:

- Store target and personnel target are separate facts.
- Personnel target requires `employeeCode`.
- Imported historical targets may satisfy historical read/calculation when no target request exists, but the source must remain visible in lineage.
- Target request workflow remains the source of new future targets unless product changes that rule.

### KPI Fact

Required fields:

- `period`
- `storeCode`
- `metricCode`
- `metricValue`

Optional fields:

- `employeeCode`
- `businessDate`
- `quantity`

Rules:

- KPI codes must map to the HR Axis KPI catalog before scoring.
- Unknown KPI codes go to quarantine.
- Metric values must not be rounded at import.
- Ranking and score formulas consume accepted canonical KPI facts only.

### GSM Approval Fact

Required fields:

- `period`
- `storeCode`
- `metricCode = GSM_ONAY`
- `metricValue`

Rules:

- GSM approval is store-level unless a future product decision says otherwise.
- The imported value is a percent-like score contribution source, not an approval workflow action.
- Missing GSM rows must show as missing data, not zero, unless a business rule explicitly defines zero.

### Checklist And Action Fact

Required fields:

- `period`
- `storeCode`
- `metricCode`
- `metricValue`

Rules:

- Checklist scores already produced inside HR Axis remain authoritative for checklist workflows.
- External checklist/action rows may be used for reporting reconciliation only unless a future source is approved as authoritative.
- Low-score task generation remains driven by HR Axis checklist rules, not by raw provider rows.

### Workforce And Norm Fact

Required fields:

- `period`
- `storeCode`
- `metricCode`
- `metricValue`

Optional fields:

- `employeeCode`
- `businessDate`
- `positionCodeRaw`

Rules:

- Active personnel count, norm count, missing-day signals, and future turnover/personnel-cost signals must remain separate metrics.
- Personnel identity still comes from HR Axis master data.
- Raw position names are evidence only until mapped to a HR Axis position.

### Report Package Fact

Required fields:

- `period`
- `storeCode`
- `metricCode`
- `metricValue`

Rules:

- Reports must read accepted materialized facts.
- Reports may include quarantine counts and missing-data status.
- Reports must not join directly to raw provider payloads.

## Precision And Formatting

- Money: decimal string, preserve cents.
- Percent: decimal string representing the human percent value, for example `22.35` for `22.35%`.
- Ratio: decimal string only when the metric explicitly defines ratio semantics.
- Count: integer-like decimal string.
- Display formatting belongs to UI/report export, not import parsing.

## Lineage

For every batch:

- Keep `sourceSystem`.
- Keep `sourceBatchId`.
- Keep `sourceRowId`.
- Keep import timestamp.
- Keep accepted row count.
- Keep quarantine row count by reason.
- Keep raw evidence fields allowed by privacy policy.

Lineage must not include OTP, password, cookie, token, or user secret values.

## Forbidden Behaviors

- Domain pages reading provider-native payloads directly.
- Source adapters changing scoring formulas.
- Source adapters creating stores, employees, regions, positions, or roles automatically.
- Quarantined rows contributing to KPI, ranking, incentive, target, checklist, workforce, or report calculations.
- Missing values being converted to zero unless the metric contract says zero is the correct business value.
- Provider region labels overriding HR Axis region assignments.

## Open Decisions

- Final Nebim field names and access method.
- Whether external source will provide daily deltas or monthly snapshots.
- Whether future turnover and personnel-cost percent data arrives as source facts or manual admin inputs.
- Whether source batch retention requires separate object storage after materialization.
