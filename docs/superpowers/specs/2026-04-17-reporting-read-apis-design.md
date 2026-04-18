# Reporting Read APIs Design

## Scope

Add the first immutable reporting read APIs on top of `rpt.*` snapshot tables.

## Endpoints

### `GET /reports/snapshot-runs`
- Lists recent snapshot runs.
- Optional filters:
  - `runStatus`
  - `snapshotType`

### `GET /reports/workforce`
- Reads `rpt.store_workforce_snapshot`.
- Requires `snapshotRunId`.
- Optional filter:
  - `storeId`

### `GET /reports/kpis`
- Reads `rpt.store_kpi_snapshot`.
- Requires `snapshotRunId`.
- Optional filters:
  - `storeId`
  - `kpiId`

## Design choices

### Recommended approach: reporting slice inside current NestJS module

- Add `ReportingController`, `ReportingService`, and `ReportingRepository`.
- Keep the first read APIs inside the existing `store-ops` module to avoid premature module sprawl.
- Use joins back to `ops.store` so request scope can still limit store-visible reporting rows.

Why this is the best fit:
- Small, testable slice.
- Reuses current auth model without inventing a second reporting auth path.
- Preserves the operational/reporting separation at the SQL boundary.

### Rejected alternatives

- A single dashboard summary endpoint first:
  - Too compressed, weak contract, harder to extend safely.
- Full reporting surface in one pass:
  - Too wide for the first immutable read slice.

## Error handling and access model

- All endpoints require authenticated user context.
- Store visibility is constrained by request scope.
- Query validation uses DTOs.
- APIs are strictly read-only and touch only `rpt.*` plus reference joins.

## Testing

- Add HTTP integration tests for:
  - snapshot run listing
  - workforce snapshot query
  - KPI snapshot query
