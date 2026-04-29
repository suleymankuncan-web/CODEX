# Personnel Master Data Bootstrap V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a controlled store/personnel master-data bootstrap path that stages rows for review before any live `ops.*` promotion.

**Architecture:** Keep master-data bootstrap separate from daily KPI imports. Store raw and normalized rows in dedicated `stg.master_data_bootstrap_*` tables, expose HR/Admin staging commands, then add validation and promotion in later slices. No direct Excel-to-live-table mutation is allowed.

**Tech Stack:** NestJS, PostgreSQL, Jest, class-validator, existing RBAC decorators, root `check:release`.

---

## File Structure

- `db/migrations/040_master_data_bootstrap_foundation.sql`: creates bootstrap batch/row staging tables.
- `db/schema.sql`: canonical schema alignment for empty DB setup.
- `backend/nestjs/src/modules/integration/master-data-bootstrap-schema-contract.spec.ts`: schema and migration contract guard.
- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts`: creates staged bootstrap batches and normalizes row identifiers.
- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`: service behavior tests.
- `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.ts`: inserts bootstrap batch/row data into staging tables only.
- `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts`: repository SQL boundary tests.
- `backend/nestjs/src/modules/integration/web/dto/create-master-data-bootstrap-batch.dto.ts`: request DTO.
- `backend/nestjs/src/modules/integration/web/integration.controller.ts`: HR/Admin bootstrap staging endpoint.
- `backend/nestjs/src/modules/integration/integration.module.ts`: provider registration.

## Completed Slice: V1-A Staging Foundation

- [x] **Step 1: Write schema contract red test**

Run:

```powershell
cd C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs
npm.cmd test -- src/modules/integration/master-data-bootstrap-schema-contract.spec.ts --runInBand
```

Expected first result: fail because `stg.master_data_bootstrap_batch` and `stg.master_data_bootstrap_row` do not exist.

- [x] **Step 2: Add migration and canonical schema**

Add dedicated staging tables with:

- batch status: `uploaded`, `validated`, `ready_to_promote`, `promoted`, `rejected`
- row status: `pending`, `valid`, `needs_review`, `invalid`, `promoted`
- raw payload, normalized payload, row hash, source store/employee codes
- resolved company/region/store/employee/position references
- indexes for batch status, review rows, and per-batch row hash uniqueness

- [x] **Step 3: Verify schema contract green**

Run:

```powershell
npm.cmd test -- src/modules/integration/master-data-bootstrap-schema-contract.spec.ts --runInBand
```

Expected result: 1 suite / 1 test passing.

## Completed Slice: V1-B Batch Staging API

- [x] **Step 1: Write service and repository red tests**

Run:

```powershell
npm.cmd test -- src/modules/integration/application/master-data-bootstrap.service.spec.ts src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts --runInBand
```

Expected first result: fail because `MasterDataBootstrapService` and `MasterDataBootstrapRepository` do not exist.

- [x] **Step 2: Implement minimal staging behavior**

Implementation behavior:

- require company scope
- accept `store` or `personnel` bootstrap rows
- preserve raw row payload
- normalize store code by trimming, removing spaces/hyphens, and uppercasing
- normalize seller code by trimming whitespace and uppercasing
- hash each row with stable SHA-256
- insert only into `stg.master_data_bootstrap_batch` and `stg.master_data_bootstrap_row`

- [x] **Step 3: Expose HR/Admin endpoint**

Endpoint:

```text
POST /api/integrations/master-data-bootstrap/batches
```

Allowed roles:

- `HR_ADMIN`
- `SUPER_ADMIN`
- `INTEGRATION_ADMIN`

The endpoint stages data only. It does not promote rows into `ops.store`, `ops.employee`, or `ops.employee_assignment_history`.

- [x] **Step 4: Verify targeted tests green**

Run:

```powershell
npm.cmd test -- src/modules/integration/application/master-data-bootstrap.service.spec.ts src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts --runInBand
```

Expected result: 2 suites / 2 tests passing.

## Completed Slice: V1-C Validation Read Model

- [x] **Step 1: Write validation service tests**

Add tests for:

- missing store code -> `invalid` with `missing_store_code`
- duplicate row hash in a batch -> blocked by unique index or marked conflict before insert
- unknown store type -> `needs_review`
- unknown position code in personnel row -> `needs_review`
- known store/personnel references resolve to `resolved_*_id`

- [x] **Step 2: Implement validation update path**

Create a validation method that reads pending rows, fills `normalized_payload_json`, sets `validation_status`, `issue_code`, `issue_message`, and batch counters.

- [x] **Step 3: Expose review endpoint**

Add:

```text
GET /api/integrations/master-data-bootstrap/batches/:batchId
```

Return batch summary, row status counts, and review rows.

Also added:

```text
POST /api/integrations/master-data-bootstrap/batches/:batchId/validate
```

This validates staged rows only. It does not promote data into `ops.store`, `ops.employee`, or `ops.employee_assignment_history`.

## Completed Slice: V1-C2 Review Queue Read Model

- [x] **Step 1: Add scoped batch queue**

Added `GET /api/integrations/master-data-bootstrap/batches` for HR/Admin review of staged bootstrap batches.

- [x] **Step 2: Add paginated row review**

Added `GET /api/integrations/master-data-bootstrap/batches/:batchId/rows` for filtered review of invalid, needs-review, pending, valid, and promoted rows.

- [x] **Step 3: Keep promotion closed**

The queue is read-only and does not write to `ops.store`, `ops.employee`, or `ops.employee_assignment_history`.

## Completed Slice: V1-C3 Duplicate/Conflict Preflight

- [x] **Step 1: Add national id comparison evidence**

Personnel bootstrap staging now stores `normalizedNationalIdHash` when a raw national id or national id hash alias is present.

- [x] **Step 2: Add batch duplicate preflight**

Validation now marks normalized duplicate store codes, duplicate personnel seller codes, and duplicate national id hashes as `needs_review` rows.

- [x] **Step 3: Add existing employee identity conflict guard**

Personnel validation now marks seller-code/national-id mismatches against existing employees as `employee_identity_conflict`.

- [x] **Step 4: Keep promotion closed**

The preflight only updates staged row review state and does not write to `ops.store`, `ops.employee`, or `ops.employee_assignment_history`.

## Completed Slice: V1-C4 Promotion Readiness Contract

- [x] **Step 1: Add read-only readiness endpoint**

Added `GET /api/integrations/master-data-bootstrap/batches/:batchId/promotion-readiness` for HR/Admin review of future promotion readiness.

- [x] **Step 2: Add row readiness classifications**

Rows are now classified as `needs_validation`, `needs_review`, `blocked`, `waiting_batch`, `ready`, or `already_promoted`.

- [x] **Step 3: Add batch readiness summary**

The readiness response exposes counts, `canPromote`, and `nextAction` so future promotion code has one contract to follow.

- [x] **Step 4: Keep promotion closed**

The readiness contract is read-only and does not write to `ops.store`, `ops.employee`, or `ops.employee_assignment_history`.

## Completed Slice: V1-D Store Promotion

- [x] **Step 1: Write store promotion tests**

Acceptance:

- readiness-approved store rows promote to `ops.store`
- `Sirket` maps to `company`
- `Franchise` maps to `franchise`
- `Isletme` maps to `operator`
- already-promoted rows are skipped
- rows with `needs_review`, `invalid`, or a non-ready batch cannot promote
- personnel batches cannot use the store promotion command

- [x] **Step 2: Implement store promotion**

Promotion writes `ops.store` only after review-ready validation, keeps `promoted_entity_id` on staged rows, refreshes batch counters, and exposes:

```text
POST /api/integrations/master-data-bootstrap/batches/:batchId/promote-stores
```

Personnel promotion remains closed until V1-E.

## Next Slice: V1-E Personnel Promotion

- [ ] **Step 1: Write personnel promotion tests**

Acceptance:

- valid personnel row promotes to `ops.employee`
- valid active assignment promotes to `ops.employee_assignment_history`
- duplicate seller code blocks promotion
- unknown store or position blocks promotion
- re-promoting same row does not duplicate employees or assignments

- [ ] **Step 2: Implement personnel promotion**

Promotion must create/update employee identity and one active primary assignment, but only from `valid` rows.

## Verification Gate

Before counting the full feature as closed:

```powershell
cd C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI
npm.cmd run check:release
```

Expected result:

- root script tests pass
- backend lint/test/build/audit pass
- frontend lint/script/build/e2e/audit pass
