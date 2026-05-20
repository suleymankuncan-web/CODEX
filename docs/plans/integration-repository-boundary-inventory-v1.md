# Integration Repository Boundary Inventory V1

## Decision

Decision: prepare the `IntegrationRepository` refactor with an inventory/test-map
PR before moving production code.

Why now:

- `ReportingRepository` has been reduced to a small identity/personnel-live read
  remainder, so the technical-debt roadmap's next backend hotspot is
  `IntegrationRepository`.
- `IntegrationRepository` is still a 2030-line class and mixes several import,
  mapping, master-data, retry, and evidence responsibilities.
- The highest-risk parts are import status transitions and idempotent retry
  behavior. Those should not be moved before the read/write boundaries and test
  coverage are explicit.

Risk: LOW for this inventory because it is docs-only. Future code movement is
MEDIUM by default, and HIGH when it touches retry/status/idempotency or external
ID mapping writes.

Door: two-way for this inventory. Future extraction PRs should stay two-way by
preserving provider wiring, method signatures, SQL output shape, and normal
squash-revert rollback.

Decision quality score: 4/5. Repo evidence, caller map, test map, stop rules,
and verification ladder are known. Runtime scale evidence is not present, so no
index or query-shape work is proposed here.

## Current Shape

Primary file:

- `backend/nestjs/src/modules/integration/infrastructure/integration.repository.ts`
  - 2030 physical lines on `origin/main` after PR #343.

Existing adjacent boundaries:

- `backend/nestjs/src/modules/integration/infrastructure/import-batch-raw-writer.repository.ts`
- `backend/nestjs/src/modules/integration/infrastructure/integration-source.repository.ts`
- `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.ts`

Primary consumers:

- `backend/nestjs/src/modules/integration/application/integration.service.ts`
- `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.ts`

Provider wiring:

- `backend/nestjs/src/modules/integration/integration.module.ts`

## Method Families

### Import Batch Creation And Raw Staging

Methods:

- `createImportBatch`
- `getImportRawUnionSql`
- `getRawTableMetadata`
- `getMissingDependencyPredicate`
- `resolveAuditActorUserId`

Observed risk:

- This path writes raw import rows and dispatches downstream materialization.
- It is status/idempotency-sensitive and already has a partial raw-writer
  boundary. Do not start the refactor line here unless a concrete raw writer
  bug or evidence gap appears.

Likely future boundary:

- `ImportBatchCreationRepository` or a smaller continuation of the existing
  `ImportBatchRawWriterRepository`, but only after read/evidence boundaries are
  stable.

### Import Batch Listing, Overview, And Evidence Reads

Methods:

- `buildImportBatchFilters`
- `listImportBatches`
- `getImportBatchSummary`
- `getLatestImportBatchIdByStatus`
- `getImportBatchActionCounts`
- `getLatestStuckImportBatchId`
- `listImportBatchesNeedingAction`
- `getImportBatch`
- `getImportBatchRowStatusSummary`
- `getImportBatchLineageSummary`
- `getImportBatchQualityIssueRows`
- `getImportBatchErrors`
- `getImportBatchDependencySummary`
- `getImportBatchAudit`

Observed risk:

- Mostly read/query behavior, but scoped by actor company and used in operator
  evidence screens.
- Lower risk than writes, but output shape and scope filters must remain exact.

Recommended first code boundary:

- Extract a read/evidence repository first, for example
  `ImportBatchEvidenceReadRepository`.
- Keep `IntegrationService` behavior and response mapping unchanged.
- If the diff becomes too large, split into:
  - list/overview/needs-action reads,
  - detail/evidence/error/audit reads.

### External ID Mapping Evidence And Approval

Methods:

- `listExternalIdMapCandidates`
- `getScopedExternalIdMappingTarget`
- `recordExternalIdMappingApproved`

Observed risk:

- Mixed read and write behavior.
- Approval is sensitive because it controls identity resolution and must not
  accept client-supplied table names or out-of-scope mappings.

Recommended order:

1. Extract read candidates/target lookup if it can stay read-only.
2. Extract approval write separately only with targeted negative tests.

### KPI Import Store Scope And Store Master Controls

Methods:

- `listKpiImportStoreExternalRefs`
- `listKpiImportStoreScope`
- `listStoreMasterRegions`
- `updateKpiImportStoreScope`

Observed risk:

- This controls which stores are import-enabled and is exercised by upload and
  import-detail operator flows.
- Read and write methods should not be mixed into the first extraction unless
  the PR remains small and the same tests cover the full story.

Recommended order:

1. Store-scope read/lookups.
2. Store-scope update.

### Personnel Master Controls

Methods:

- `listPersonnelMaster`
- `listPersonnelMasterLookups`
- `updatePersonnelMaster`

Observed risk:

- Medium risk because edits can affect live personnel master data.
- Keep separate from import-batch evidence reads.

Recommended order:

1. Personnel read/lookups.
2. Personnel update.

### Retry And Action Queue Writes

Methods:

- `markImportBatchPending`
- `recordImportBatchRetried`

Observed risk:

- HIGH relative to normal repository cleanup because these methods touch retry
  state, audit, and idempotency.

Recommended order:

- Do not include in first extraction.
- Move only after import-batch evidence reads are isolated and the retry tests
  are identified as hard gates.

## Test Map

Primary E2E gates:

```powershell
npm.cmd --prefix backend/nestjs test -- import-batch.e2e-spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- import-batch-evidence.e2e-spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- integration-sources.e2e-spec.ts --runInBand
```

Use `integration-sources.e2e-spec.ts` only when the extraction touches source
governance or module wiring that could affect source routes.

Relevant unit/spec support:

- `backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.spec.ts`
- `backend/nestjs/src/modules/integration/application/materialization.service.spec.ts`
- `backend/nestjs/src/modules/integration/application/external-id-mapping.service.spec.ts`
- `backend/nestjs/src/modules/integration/application/kpi-import-normalization.service.spec.ts`
- `backend/nestjs/src/modules/integration/application/integration-scheduler.service.spec.ts`
- `backend/nestjs/src/modules/integration/application/import-data-quality.spec.ts`
- `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts`
- `backend/nestjs/src/modules/integration/source-agnostic-ingest-schema-contract.spec.ts`

Build gate:

```powershell
npm.cmd --prefix backend/nestjs run build
```

Full backend gate:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand
```

Use the full backend gate when a query family is moved or provider wiring
changes. It is not required for this docs-only inventory.

## Recommended Extraction Order

1. Import batch list/overview/detail/evidence read boundary.
2. External ID mapping read boundary.
3. Store import scope read/lookups, then update boundary.
4. Personnel master read/lookups, then update boundary.
5. Retry/action queue write boundary.
6. Import batch creation/raw staging boundary.

Why not start with raw staging:

- It is the largest write path.
- It is status/idempotency-sensitive.
- The existing `ImportBatchRawWriterRepository` already reduced some raw-write
  pressure, so read/evidence extraction offers a cleaner first rollback story.

## Stop Rules

Stop and re-plan if a future code PR:

- changes import status transitions,
- changes retry/idempotency behavior,
- changes external ID mapping scope or accepted target semantics,
- changes API response shape or status codes,
- changes auth/permission checks,
- requires a DB migration or index without measured query evidence,
- mixes import evidence reads with store/personnel master writes,
- cannot be explained in one paragraph,
- fails targeted import E2E tests for a reason that is not fully understood.

## Next Safe Slice

Recommended next code PR:

- Extract import batch read/evidence methods into a dedicated repository.
- Start with list/overview/detail/evidence reads only.
- Keep `IntegrationService` public behavior and controller responses unchanged.
- Wire the new provider through `IntegrationModule`.
- Gate with `import-batch.e2e-spec.ts`, `import-batch-evidence.e2e-spec.ts`,
  backend build, and full backend tests if provider wiring changes.

Parked:

- Retry/status writes.
- Raw import creation/staging.
- Store/personnel master updates.
- Source governance.
- Any performance/index work without measured evidence.
