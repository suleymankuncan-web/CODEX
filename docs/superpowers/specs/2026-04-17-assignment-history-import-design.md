# Assignment History Import Design

## Scope

Add assignment history import support as a distinct integration entity type instead of embedding assignment rows inside employee imports.

## Recommended approach

Use `entityType = assignment` with its own staging table:

- `stg.assignment_raw`
- materialization path into `ops.employee_assignment_history`
- external ID mapping support for assignment rows

This is the right design because `employee_assignment_history` is its own domain record with time-based semantics and downstream reporting impact. Treating it as part of employee master data would couple two different lifecycles.

## Mapping rules

- Required:
  - employee reference
  - store reference
  - position reference
  - start date
- Optional:
  - source assignment id
  - manager employee reference
  - end date
  - primary flag
  - FTE ratio
  - assignment status

## Resolution order

- Employee:
  - internal UUID from payload if present
  - else external ID map lookup for `employee`
- Store:
  - internal UUID from payload if present
  - else external ID map lookup for `store`
- Position:
  - internal UUID from payload if present
  - else external ID map lookup for `position`
- Region:
  - derive from resolved store record
- Manager:
  - optional direct UUID or external `employee` mapping

## Error handling

- Missing required fields -> `validation_failed`
- Unresolved employee/store/position dependency -> `retryable_error`
- Database write errors -> `retryable_error`
- Batch status continues to use current materialization aggregation semantics
