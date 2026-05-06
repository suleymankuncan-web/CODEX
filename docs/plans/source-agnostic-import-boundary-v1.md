# Source-Agnostic Import Boundary V1

Date: 30 April 2026

Status: `implemented_guard`

Current product decision: `JSON suspended`

## Purpose

Lock the import boundary before a real JSON source exists.

Excel KPI Import V1 is the active local source path. JSON is future-only until a real sample payload or official field list exists. JSON source integration is suspended for the current pilot and Power BI/Excel operating path. The project should stay ready for JSON without coding guessed JSON behavior.

## Locked Decision

- Excel KPI Import V1 is the active local source path.
- JSON source integration is suspended for the current pilot and Power BI/Excel operating path.
- Do not plan or staff JSON implementation work while Power BI/Excel outputs remain the chosen operating source.
- JSON is future-only until a real sample payload or official field list exists.
- Do not build a JSON adapter, endpoint, scheduled job, or field map from guessed data.
- When JSON becomes real, it must enter through the same canonical import boundary as Excel.
- No source-specific scoring branch is allowed in V1.

## Boundary Flow

Every source must pass through this same flow:

1. Source adapter
2. Canonical import payload
3. Shared mapping and validation
4. Data quality and lineage
5. Materialization and snapshotting
6. Scoring and reporting

The source adapter owns only source-specific parsing, source field naming, and source payload evidence. It must not decide score math, ranking rules, checklist behavior, or master-data promotion.

## Canonical Import Payload

Every future source adapter should map into canonical evidence before shared services touch the data.

Minimum evidence fields:

- `sourceCode`
- `sourceBatchId`
- `sourceRowReference`
- `rowHash`
- `rawPayload`
- `storeExternalRef`
- `employeeExternalRef`
- `periodStart`
- `periodEnd`
- `periodType`
- `scopeType`
- `metricCode`
- `actualValue`
- `metricUnit`

Source-specific fields can remain inside `rawPayload`, but scoring and materialization must read the canonical fields.

## Mapping And Master-Data Safety

- No source adapter may auto-create store or employee master data.
- Unresolved store references must stay in the data-quality queue as `unmapped_store`.
- Unresolved employee references must stay in the data-quality queue as `unmapped_employee`.
- Exact external-id mapping wins before normalized fallback.
- Ambiguous normalized matches must reject instead of choosing silently.
- Direct internal ids remain exact ids and are not normalized as external codes.

## KPI And Scoring Safety

- Excel, JSON, and future sources must not introduce their own score engine.
- Imported KPI metrics remain source facts.
- Targets, Turkey averages, checklist scores, weighted scores, snapshots, rankings, and explanations remain platform-owned behavior.
- PowerBI-provided Turkey-average rows remain reconciliation evidence, not scoring source.
- Negative/refund/return behavior must be documented per real source before an adapter maps it.

## Non-Goals

This guard deliberately does not add:

- JSON adapter
- JSON endpoint
- JSON upload UI
- source scheduler
- source authentication client
- new migration
- new score formula
- new materialization branch
- automatic master-data promotion

## Trigger To Build JSON Adapter Later

Only start JSON adapter implementation after the product owner reopens the JSON path and these inputs exist:

- one sanitized real JSON sample payload or official field list
- delivery type: pull API, push endpoint, file upload, SFTP, scheduled export, manual import, or intermediary service
- authentication and access model
- cadence and late-correction behavior
- store identity field
- employee/seller identity field
- business date and timezone rule
- return/refund/netting rule
- idempotency key candidate

## Verification

Guarded by:

```powershell
node --test scripts\source-agnostic-import-boundary-contract.test.mjs
```

## CODEX DURUST YORUM

This is intentionally small. It protects the project from the dangerous version of "JSON ready": a connector built from guesses.

The healthy path is to keep Power BI/Excel working today, keep JSON possible tomorrow, and force any future JSON source through the same canonical import boundary. That keeps scoring, mapping, lineage, and quality controls from splitting into two parallel worlds.

## Next Logical Step

If the product owner reopens JSON and a real JSON sample or official field list arrives, write a source mapping spec against this boundary.

While JSON remains suspended, do not build JSON-specific code. Continue only with small guards or operator smoke steps that strengthen existing Power BI/Excel import and master-data behavior.
