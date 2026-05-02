# Master Data Bootstrap Store Promotion V1 Design

Date: 29 April 2026

Status: `approved_for_implementation`

## Goal

Promote reviewed store bootstrap rows into `ops.store` safely, idempotently, and without opening personnel promotion.

## CODEX Honest View

This is the first real live master-data write in the bootstrap flow, so the scope must stay narrow.

Store promotion is safer than personnel promotion because it touches one live table, has fewer identity concerns, and is the prerequisite for personnel assignment work. We should still treat it like production code: only validated and readiness-approved rows write to `ops.store`, every promoted staged row gets trace evidence, and re-running promotion must not duplicate stores.

## Current State

Implemented:

- staged store/personnel bootstrap batches
- validation and issue codes
- duplicate/conflict preflight
- review queue
- promotion readiness endpoint

Missing:

- a controlled command that writes approved store rows to `ops.store`
- staged row `promoted_entity_id` evidence for store promotion
- idempotent re-run behavior for store rows

## Locked Decisions

- V1 promotes store batches only.
- Personnel promotion remains closed.
- V1 exposes one command endpoint:

```text
POST /api/integrations/master-data-bootstrap/batches/:batchId/promote-stores
```

- V1 requires:
  - scoped batch access
  - `bootstrapEntity = store`
  - `batchStatus = ready_to_promote`
  - row readiness = `ready`
  - store code
  - store name
  - store type: `company`, `franchise`, or `operator`
  - resolved region id
- Re-running promotion must not create duplicate stores.
- A promoted staged row becomes `validation_status = promoted` and stores the resulting `store_id` in `promoted_entity_id`.
- No personnel table is written.

## Store Row Inputs

Accepted store name aliases:

```text
storeName
store_name
name
magazaAdi
mağazaAdı
```

Accepted region code aliases:

```text
regionCode
region_code
sourceRegionId
regionExternalRef
region
```

Store status aliases:

```text
status
storeStatus
```

Allowed normalized status:

```text
active
inactive
closed
```

Missing status defaults to `active`.

## Validation Additions

Store validation now also ensures:

- store name exists
- if the store already exists, its existing region can be used
- if the store does not exist, a region code must be provided and must resolve to `ops.region`

Issue codes:

```text
missing_store_name
missing_region_code
unmapped_region
```

These keep unsafe rows out of `ready_to_promote`.

## Promotion Behavior

For each ready store row:

```text
INSERT INTO ops.store (...)
ON CONFLICT (store_code)
DO UPDATE SET
  region_id
  store_name
  store_type
  status
  kpi_import_enabled
RETURNING store_id
```

The stored `store_code` is the normalized code, e.g. `SM-140` becomes `SM140`.

After the upsert:

```text
UPDATE stg.master_data_bootstrap_row
SET validation_status = promoted,
    promoted_entity_id = <store_id>,
    updated_at = NOW()
```

Then batch counters are refreshed. If all rows are promoted, batch status becomes `promoted`; otherwise it remains `ready_to_promote`.

## Error Handling

- Non-store batch -> `400`
- Batch not ready -> `400`
- No ready rows -> `400`
- Empty/foreign company scope -> existing fail-closed behavior
- Cross-company store code conflict -> promotion fails instead of updating another company store

## Testing Plan

Service tests:

- rejects personnel batch promotion
- rejects store batch not `ready_to_promote`
- promotes only ready store rows
- returns promoted count and promoted row evidence

Repository tests:

- upserts `ops.store`
- updates only staged rows to promoted
- refreshes batch counters/status
- does not touch `ops.employee` or `ops.employee_assignment_history`

Release verification:

```powershell
cd C:\Users\suley\OneDrive\Masaustu\WEBSITE CALISMASI\backend\nestjs
npm.cmd test -- master-data-bootstrap --runInBand
npm.cmd run lint
npm.cmd run build

cd C:\Users\suley\OneDrive\Masaustu\WEBSITE CALISMASI
npm.cmd run check:release
```

Use the real workspace path when running locally; the command block above is ASCII-only documentation.

## Non-Goals

- No personnel promotion.
- No employee assignment creation.
- No row edit UI.
- No frontend screen.
- No destructive delete/replace behavior.
- No automatic region creation.

## Acceptance Criteria

- HR/Admin can promote a ready store batch.
- Only ready store rows are written to `ops.store`.
- Re-running the command does not duplicate stores.
- Staged rows get `promoted_entity_id`.
- Batch counters and status reflect promotion.
- Personnel promotion remains unavailable.
- Targeted backend tests and root `check:release` pass.
