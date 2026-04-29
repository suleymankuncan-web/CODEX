# Master Data Bootstrap Promotion Readiness V1 Design

Date: 29 April 2026

Status: `approved_for_implementation`

## Goal

Define and expose the read-only contract that decides whether staged master-data bootstrap rows are ready for future promotion.

## CODEX Honest View

This is the right step before writing real store/personnel promotion.

Promotion is where a small wrong assumption becomes live master-data damage. We now have staging, validation, review queue, duplicate checks, and identity conflict checks. The next safe move is not "promote"; it is "prove we know what promote is allowed to touch".

## Current State

Already implemented:

- staged store/personnel bootstrap batches
- row validation with issue codes
- review queue and row review endpoints
- duplicate/conflict preflight checks
- no live promotion into `ops.store`, `ops.employee`, or `ops.employee_assignment_history`

Current gap:

- callers can see validation state, but there is no explicit promotion-readiness contract
- future promotion code might duplicate readiness logic in multiple places
- there is no single API that explains why promotion is blocked

## Locked Decisions

- V1 is read-only.
- V1 does not promote rows.
- V1 does not write to `ops.*`.
- V1 does not create a new table.
- V1 adds one endpoint under the existing master-data bootstrap controller.
- V1 uses existing company scope and allowed roles.
- V1 treats `promoted` rows as idempotent/closed, not as ready again.

Allowed roles:

- `HR_ADMIN`
- `SUPER_ADMIN`
- `INTEGRATION_ADMIN`

Endpoint:

```text
GET /api/integrations/master-data-bootstrap/batches/:batchId/promotion-readiness
```

## Row Readiness Contract

Rows are classified with `promotionReadiness`:

```text
needs_validation
needs_review
blocked
waiting_batch
ready
already_promoted
```

Rules:

- `pending` row -> `needs_validation`
- `needs_review` row -> `needs_review`
- `invalid` row -> `blocked`
- `promoted` row or row with `promotedEntityId` -> `already_promoted`
- `valid` row while batch is not `ready_to_promote` -> `waiting_batch`
- `valid` row while batch is `ready_to_promote` -> `ready`

## Batch Readiness Contract

Response summary:

```text
batchId
bootstrapEntity
batchStatus
rowCount
readyCount
waitingBatchCount
needsValidationCount
needsReviewCount
blockedCount
alreadyPromotedCount
canPromote
nextAction
```

`canPromote` is true only when:

- batch status is `ready_to_promote`
- at least one row is `ready`
- no row is `needs_validation`, `needs_review`, or `blocked`

`nextAction` values:

```text
validate_batch
review_rows
promote_ready_rows
already_closed
wait_for_batch_ready
```

## Response Shape

```text
summary
rows.items[]
rows.meta
```

Each row item:

```text
rowId
rowNumber
validationStatus
issueCode
issueMessage
promotionReadiness
blockReason
resolvedStoreId
resolvedEmployeeId
resolvedPositionId
promotedEntityId
```

`blockReason` is a stable machine-readable reason:

- existing `issueCode`, when present
- `validation_pending`
- `batch_not_ready_to_promote`
- `already_promoted`

## Data Flow

```text
HR/Admin opens batch readiness
  -> scoped batch is loaded
  -> staged rows are loaded
  -> rows are classified in memory
  -> summary counters and nextAction are derived
  -> no live table is mutated
```

## Testing Plan

Service tests:

- invalid/needs-review/pending rows block promotion and expose `review_rows` or `validate_batch`
- ready batch with valid rows returns `canPromote: true`
- promoted rows return `already_promoted` and do not count as ready again
- foreign or empty company scope keeps existing fail-closed behavior

Repository tests:

- staged rows expose `promotedEntityId`
- repository reads staging tables only for readiness inputs

Controller tests are not necessary in V1 because the endpoint uses existing decorators and a thin service pass-through, but route order must keep it before `:batchId`.

## Non-Goals

- No store promotion.
- No personnel promotion.
- No promotion audit trail.
- No rollback/cancel behavior.
- No row correction UI.
- No new frontend screen.

## Acceptance Criteria

- HR/Admin can call the readiness endpoint for a scoped batch.
- The response explains exactly why promotion is blocked or allowed.
- Promoted rows are idempotent and not re-promoted.
- No `ops.*` table is inserted or updated.
- Targeted backend tests and root `check:release` pass.
