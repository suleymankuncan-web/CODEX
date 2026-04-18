# External ID Mapping And Position Import Design

## Scope

Strengthen the integration identity model by making `stg.external_id_map` the canonical external-to-internal mapping registry and by adding first-class `position` import support.

## Recommended approach

Use three coordinated changes:

- keep `stg.external_id_map` as the single mapping registry
- add a shared resolver/upserter service for mapping lookups and writes
- add `entityType = position` with its own staging table and materialization path into `ops.position`

This is the right design because assignment history depends on stable reference data. `assignment` imports should consume a defined position mapping contract instead of assuming position mappings already exist.

## Mapping rules

- Mapping identity is always `integration_source_id + entity_type + external_id`
- Reference entities own their own import/materialization flow
- Dependent entities resolve references only through direct internal IDs or the shared mapping service
- Mapping rows are upserted after successful writes into operational tables

## Position import contract

- New staging table: `stg.position_raw`
- Required fields:
  - `companyId`
  - one of `positionCode` or `sourcePositionId`
- Optional fields:
  - internal `positionId`
  - `positionName`
  - `jobFamily`
  - `isManagerial`
- Materialization target: `ops.position`
- Mapping writeback:
  - `entity_type = position`
  - `internal_table_name = ops.position`

## Error handling

- Missing required fields -> `validation_failed`
- Missing reference mapping for dependent rows -> `retryable_error`
- Database write failures -> `retryable_error`
- Re-import of the same external ID -> mapping upsert refreshes the internal target

## Expected outcome

- `assignment` imports resolve `position` through an explicit contract
- Future reference entities can reuse the same mapping abstraction
- Import batch observability continues working for the new entity type without changing the API shape
