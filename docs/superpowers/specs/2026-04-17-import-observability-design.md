# Import Observability Design

## Scope

Improve import batch visibility so operators can tell whether a failure is caused by bad data, missing upstream mappings, or write-layer failures.

## Approach

Keep the existing import batch endpoints and extend their response contracts:

- `GET /api/integrations/import-batches/:batchId`
  - add `dependencySummary`
- `GET /api/integrations/import-batches/:batchId/errors`
  - add `errorCategory` per item

This keeps the API surface stable while making import troubleshooting much faster.

## Error categories

- `validation`
  - row failed because payload shape or required fields were invalid
- `missing_dependency`
  - row failed because a dependent reference could not be resolved
- `write_failure`
  - row failed due to database or infrastructure write problems

## Dependency summary

The batch detail response should report counts for unresolved dependency classes inferred from row errors:

- `employee`
- `store`
- `position`
- `region`
- `company`
- `manager`

For entity types that do not use some dependencies, counts remain zero.
