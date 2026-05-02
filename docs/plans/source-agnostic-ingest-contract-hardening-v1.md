# Source-Agnostic Ingest Contract Hardening V1

Date: 26 April 2026

Status: `implemented`

## Purpose

Strengthen the local KPI ingest boundary without pretending that the real Nebim/source contract is known.

This step keeps source-specific connector work blocked until a real sample payload, official field list, or source access model exists. The local platform now has a clearer canonical KPI row contract for any future adapter.

## What Changed

- KPI normalization now adds deterministic `rowHash` metadata to canonical KPI rows.
- KPI normalization now adds readable `rawRowReference` metadata to canonical KPI rows.
- Nebim/Power BI shaped metric-column normalization now recognizes:
  - `NET_SALES`
  - `TICKET_COUNT`
  - `ITEM_COUNT`
  - `UPT`
  - `ATV`
  - `CR`
- `GET /api/integrations/import-payload-templates` now returns `canonicalContract` metadata.
- The contract separates:
  - import batch envelope fields
  - canonical KPI row fields
  - imported metric codes
  - derived metric codes
  - checklist metric codes
  - adapter/scoring boundary rules

## Why It Matters

When the real source arrives, the adapter should only translate external fields into canonical rows. It should not calculate score, invent ranking behavior, or hide source assumptions inside business logic.

`rowHash` and `rawRowReference` make each accepted KPI row easier to trace during reconciliation, retry review, and future source evidence work.

## Boundaries

- No Nebim-specific connector was added.
- No fake API client was added.
- No source cadence was assumed.
- No score formula changed.
- No DB schema changed.
- No snapshot or ranking behavior changed.

## Verification

- Red test observed: KPI normalization did not emit `rowHash` and `rawRowReference`.
- Red test observed: payload template endpoint did not expose `canonicalContract`.
- Targeted backend tests passed:

```powershell
npm.cmd test -- src/modules/integration/application/kpi-import-normalization.service.spec.ts src/modules/integration/application/materialization.service.spec.ts src/modules/integration/application/power-bi-export-upload.service.spec.ts test/integration/import-batch.e2e-spec.ts --runInBand
```

- Backend build passed:

```powershell
npm.cmd run build
```

- Official root release gate passed:

```powershell
npm.cmd run check:release
```

## CODEX DÜRÜST YORUM

This is the right kind of backend/data investment for the current uncertainty. It improves traceability and future adapter safety without guessing what Nebim will send.

The remaining real risk is still external: source access method, payload fields, identity keys, cadence, and return/refund semantics are unknown. Do not mark the real source integration as complete until one real source sample is mapped through this contract.

## Next Logical Step

If real source details arrive, write a source mapping spec against this canonical contract.

If source details still do not exist, continue with local backend/data hardening that does not require external assumptions.
