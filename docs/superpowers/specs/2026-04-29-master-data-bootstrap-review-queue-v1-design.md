# Master Data Bootstrap Review Queue V1 Design

Date: 29 April 2026

Status: `approved_for_planning`

## Goal

Give HR/Admin a controlled review queue for staged store/personnel master-data bootstrap batches while live promotion remains closed.

The current system can stage a batch, validate its rows, and inspect one batch. The missing surface is an operator queue that answers:

```text
Which bootstrap batches exist?
Which ones still need validation?
Which ones have invalid or needs-review rows?
Which ones are ready for later promotion?
Where should HR/Admin look first?
```

## CODEX DURUST YORUM

This is the right next step while the real master data file is being prepared.

Store/personnel promotion should not be built until the real baseline list is available. A review queue, however, is safe and useful now because it improves control without mutating `ops.store`, `ops.employee`, or `ops.employee_assignment_history`.

This keeps the project moving without guessing external data.

## Current State

Implemented foundations:

- `stg.master_data_bootstrap_batch`
- `stg.master_data_bootstrap_row`
- `POST /api/integrations/master-data-bootstrap/batches`
- `POST /api/integrations/master-data-bootstrap/batches/:batchId/validate`
- `GET /api/integrations/master-data-bootstrap/batches/:batchId`
- row-level validation statuses:
  - `pending`
  - `valid`
  - `needs_review`
  - `invalid`
  - `promoted`
- batch statuses:
  - `uploaded`
  - `validated`
  - `ready_to_promote`
  - `promoted`
  - `rejected`

Current gap:

- There is no list/read-model for all staged bootstrap batches.
- HR/Admin cannot quickly filter by entity, status, readiness, or issue intensity.
- Existing batch detail can return rows, but large row review should be paginated before real master-data files arrive.

## Locked Decisions

- V1 is read/review only.
- V1 does not promote staged rows into live `ops.*` tables.
- V1 does not edit row payloads.
- V1 does not create stores, employees, positions, or assignments.
- V1 does not parse Excel files.
- V1 uses existing company scope and role boundaries.
- V1 keeps duplicate row hash behavior in the DB unique index.
- V1 must be safe to run without a real master-data file.

Allowed roles:

- `HR_ADMIN`
- `SUPER_ADMIN`
- `INTEGRATION_ADMIN`

Scope:

- company-scoped only
- empty company scope fails closed
- users must not see batches outside their scoped company ids

## Recommended V1 Shape

Add two read endpoints around the existing validation/detail endpoints.

### Queue Endpoint

```text
GET /api/integrations/master-data-bootstrap/batches
```

Supported filters:

```text
bootstrapEntity=store|personnel
batchStatus=uploaded|validated|ready_to_promote|promoted|rejected
readiness=needs_validation|needs_review|ready_to_promote|closed
q=<source label or file reference search>
limit=<1..100>
offset=<0..n>
```

Sort order:

```text
created_at DESC, master_data_bootstrap_batch_id DESC
```

Response item shape:

```text
batchId
companyId
bootstrapEntity
sourceLabel
fileReference
uploadedByUserId
batchStatus
readiness
rowCount
validCount
needsReviewCount
invalidCount
promotedCount
pendingCount
createdAt
validatedAt
promotedAt
nextAction
```

Derived readiness:

```text
needs_validation:
  batchStatus = uploaded OR pendingCount > 0

needs_review:
  invalidCount > 0 OR needsReviewCount > 0

ready_to_promote:
  batchStatus = ready_to_promote

closed:
  batchStatus IN (promoted, rejected)
```

Derived next action:

```text
validate_batch
review_invalid_rows
review_needs_review_rows
wait_for_promotion_decision
closed
```

### Row Review Endpoint

```text
GET /api/integrations/master-data-bootstrap/batches/:batchId/rows
```

Supported filters:

```text
validationStatus=pending|valid|needs_review|invalid|promoted
issueCode=<issue code>
q=<store code or employee code search>
limit=<1..100>
offset=<0..n>
```

Sort order:

```text
validation_status priority, row_number ASC
```

Recommended priority:

```text
invalid
needs_review
pending
valid
promoted
```

Response item shape:

```text
rowId
batchId
rowNumber
sourceStoreCode
sourceEmployeeCode
validationStatus
issueCode
issueMessage
resolvedCompanyId
resolvedRegionId
resolvedStoreId
resolvedEmployeeId
resolvedPositionId
rawPayload
normalizedPayload
updatedAt
```

The existing `GET /api/integrations/master-data-bootstrap/batches/:batchId` may remain as summary + compact detail, but real row review should use the paginated row endpoint.

## Data Flow

```text
HR/Admin uploads batch
  -> rows are stored in stg.master_data_bootstrap_row

HR/Admin validates batch
  -> row validation statuses and issue codes are updated
  -> batch counters are refreshed

HR/Admin opens review queue
  -> list endpoint reads scoped stg batches
  -> readiness and nextAction are derived

HR/Admin opens row review
  -> row endpoint reads scoped stg rows
  -> filters highlight invalid/needs-review rows first
```

No path in V1 writes to live operational tables.

## Error Handling

- Unknown batch id returns `404`.
- Empty company scope returns `403`.
- Invalid filters return the standard global validation error response.
- Limit must be capped at `100`.
- Offset defaults to `0`.
- Empty result sets return an empty list with normal pagination metadata.

## Testing Plan

Backend service tests:

- list queue filters by scoped company ids
- queue derives `needs_validation`
- queue derives `needs_review`
- queue derives `ready_to_promote`
- queue derives `closed`
- row review returns invalid and needs-review rows first
- unknown batch id for row review returns `404`

Repository tests:

- list query reads only `stg.master_data_bootstrap_batch`
- row query reads only `stg.master_data_bootstrap_row`
- SQL does not insert or update `ops.store`
- SQL does not insert or update `ops.employee`
- pagination parameters are passed safely

Controller/DTO tests:

- allowed roles can access queue endpoints
- disallowed roles are rejected by existing decorators
- query validation caps or rejects invalid limit/offset values

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

- No store promotion.
- No personnel promotion.
- No row correction UI.
- No Excel parser.
- No master-data merge logic.
- No audit expansion unless a later slice explicitly adds it.
- No frontend redesign.

## Implementation Impact

Expected backend files:

- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts`
- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`
- `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.ts`
- `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts`
- `backend/nestjs/src/modules/integration/web/integration.controller.ts`
- new query DTOs under `backend/nestjs/src/modules/integration/web/dto/`

Expected docs:

- update this spec status after approval
- update `docs/superpowers/plans/2026-04-29-personnel-master-data-bootstrap-v1.md`
- update `docs/plans/project-debt-ledger.md` only after implementation, verification, and commit

## Acceptance Criteria

- HR/Admin can list staged bootstrap batches without opening each batch.
- HR/Admin can filter by entity, batch status, readiness, and source/file search.
- Queue response tells the next action for each batch.
- HR/Admin can list problematic rows with pagination.
- Invalid and needs-review rows appear before valid rows in row review.
- Empty company scope and foreign company batches fail closed.
- No live `ops.*` tables are mutated.
- Targeted tests and root `check:release` pass before this is counted as closed debt.

## Open Implementation Decision

Whether to add an admin-web pilot screen in the same slice should be decided after the backend queue is implemented.

Recommendation: backend first. Add the UI only if the API is stable and the user wants to inspect staged batches before the real master-data file is ready.
