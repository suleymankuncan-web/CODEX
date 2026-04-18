# Store Operations API Contracts

## Assumptions
- All endpoints require authenticated user context.
- Authorization is scope-aware RBAC.
- Command endpoints use the shared command envelope.
- List and audit endpoints use the shared list envelope.

## Response Standards

### Command envelope
```json
{
  "command": {
    "status": "queued",
    "message": "Human-readable status message"
  },
  "data": {},
  "job": {
    "jobType": "snapshot-run",
    "backend": "bullmq",
    "jobId": "123",
    "queueName": "store-ops-snapshot"
  }
}
```

### List envelope
```json
{
  "items": [],
  "meta": {
    "count": 0,
    "total": 0,
    "limit": 50,
    "offset": 0
  }
}
```

### Error status model
- `401`: missing or invalid authentication token
- `403`: authenticated but missing required role or scope
- `404`: referenced resource does not exist
- `409`: valid request but current resource state conflicts with the action
- `422`: semantically invalid request for the selected policy or scope model

## Auth Admin API

### `GET /auth/lookups`
- Purpose: Return lightweight auth lookup data for users, roles, permissions, scope types, and auth providers
- Notes:
  - retains top-level arrays for backward compatibility
  - also returns `optionGroups` and `meta` for UI form construction

### `POST /auth/role-assignments`
- Purpose: Create scoped role assignment for a user
- Required role: `SUPER_ADMIN`
- Error model:
  - `409` duplicate active assignment for the same scoped role
  - `422` invalid role/scope combination or incomplete scope hierarchy

### `GET /auth/role-assignments`
- Purpose: List role assignments
- Filters:
  - `userId?`
  - `roleCode?`
  - `scopeType?`
  - `active?`

### `GET /auth/role-assignments/:assignmentId/audit`
- Purpose: Read audit history for a role assignment

### `PATCH /auth/role-assignments/:assignmentId/deactivate`
- Purpose: Deactivate an active role assignment

### `POST /auth/users`
- Purpose: Create user account
- Required role: `SUPER_ADMIN`

### `GET /auth/users`
- Purpose: List user accounts
- Filters:
  - `authProvider?`
  - `isActive?`

### `GET /auth/users/:userId/audit`
- Purpose: Read user account audit history

### `PATCH /auth/users/:userId/deactivate`
- Purpose: Deactivate user account

### `PATCH /auth/users/:userId/reactivate`
- Purpose: Reactivate user account

### `GET /auth/roles`
- Purpose: List roles with attached permissions

### `GET /auth/permissions`
- Purpose: List permission catalog

### `POST /auth/roles/:roleId/permissions`
- Purpose: Grant permission to role

### `DELETE /auth/roles/:roleId/permissions/:permissionCode`
- Purpose: Revoke permission from role

## Integration Admin API

### `GET /integrations/lookups`
- Purpose: Return lightweight integration lookup data for supported entity types, active sources, grouped source options, and source stats
- Notes:
  - returns both domain-shaped lookup data and UI-friendly `optionGroups`

### `GET /integrations/sources`
- Purpose: List integration sources

### `POST /integrations/sources`
- Purpose: Create integration source with composite uniqueness on `sourceCode + entityType`

### `PATCH /integrations/sources/:sourceId/deactivate`
- Purpose: Deactivate integration source unless active import batches still exist

### `PATCH /integrations/sources/:sourceId/reactivate`
- Purpose: Reactivate integration source

### `GET /integrations/sources/:sourceId/audit`
- Purpose: Read integration source audit history

### `POST /integrations/import-batches`
- Purpose: Register import batch and enqueue async materialization
- Required role: `INTEGRATION_ADMIN`
- Governance:
  - fails clearly if source is missing
  - fails clearly if source exists but is inactive

### `GET /integrations/import-batches`
- Purpose: List import batches
- Filters:
  - `status?`
  - `entityType?`
  - `sourceCode?`
  - `startedFrom?`
  - `startedTo?`

### `GET /integrations/import-batches/summary`
- Purpose: Return import batch totals and derived health totals

### `GET /integrations/import-batches/overview`
- Purpose: Return import admin overview with totals, health totals, action totals, and latest actionable pointers

### `GET /integrations/import-batches/needs-action`
- Purpose: Return actionable import queue items such as `blocked`, `retry_ready`, `needs_action`, and `stuck`

### `GET /integrations/import-batches/:batchId`
- Purpose: Return import batch detail, row status summary, dependency summary, retry readiness

### `GET /integrations/import-batches/:batchId/errors`
- Purpose: Return import batch row-level errors

### `GET /integrations/import-batches/:batchId/audit`
- Purpose: Return import batch audit history
- Legacy alias retained: `GET /integrations/import-batch-audit/:batchId`

### `POST /integrations/import-batches/:batchId/retry`
- Purpose: Requeue a retryable import batch

## Snapshot Admin API

### `GET /snapshots/lookups`
- Purpose: Return lightweight snapshot lookup data for snapshot types, rerunnable failed runs, and rerun governance summary
- Notes:
  - includes `optionGroups` and `meta` for admin UI forms

### `POST /snapshots/runs`
- Purpose: Enqueue immutable snapshot generation
- Required role: `SNAPSHOT_OPERATOR`

### `GET /snapshots/runs`
- Purpose: List snapshot runs
- Filters:
  - `runStatus?`
  - `snapshotType?`

### `GET /snapshots/runs/summary`
- Purpose: Return snapshot run totals and derived health totals

### `GET /snapshots/runs/overview`
- Purpose: Return snapshot admin overview with totals, health totals, action totals, and latest actionable pointers

### `GET /snapshots/runs/needs-action`
- Purpose: Return actionable snapshot queue items such as `retry_ready` and `stuck`

### `GET /snapshots/runs/:snapshotRunId`
- Purpose: Return snapshot run detail, health state, cards, rerun state, and rerun governance

### `GET /snapshots/runs/:snapshotRunId/dependencies`
- Purpose: Return rerun dependency checks and governance visibility for a snapshot run

### `GET /snapshots/runs/:snapshotRunId/lineage`
- Purpose: Return immutable rerun lineage for a snapshot run

### `GET /snapshots/runs/:snapshotRunId/audit`
- Purpose: Return snapshot run audit history

### `POST /snapshots/runs/:snapshotRunId/rerun`
- Purpose: Create a new rerun snapshot record and enqueue execution

## Reporting API

### `GET /reports/summary`
- Purpose: Return latest completed snapshot summary cards
- Required roles: `REPORT_VIEWER` or `AUDITOR`

### `GET /reports/snapshot-runs`
- Purpose: List immutable snapshot runs for reporting selection

### `GET /reports/workforce`
- Purpose: Read workforce snapshot rows
- Query:
  - `snapshotRunId`
  - `limit?`
  - `offset?`

### `GET /reports/kpis`
- Purpose: Read KPI snapshot rows

### `GET /reports/checklists`
- Purpose: Read checklist snapshot rows

### `GET /reports/turnover`
- Purpose: Read turnover snapshot rows

## Operational API

### `GET /org/stores`
- Purpose: List stores limited by authorized scope

### `POST /checklists/instances`
- Purpose: Create checklist execution instance

## Security Notes
- `403` on missing role or out-of-scope access
- `401` on missing or invalid JWT in `AUTH_MODE=jwt`
- `409` on state conflicts such as duplicate grants, active reruns, or forbidden deactivation during active work
- `422` on semantic admin policy violations such as invalid scope hierarchy for role assignment
- Critical command and admin surfaces write audit events
