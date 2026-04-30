# Integration Source Repository Split V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract integration source governance persistence from `IntegrationRepository` into a focused `IntegrationSourceRepository` without changing import behavior, API responses, SQL semantics, or authorization.

**Architecture:** Keep `IntegrationRepository` responsible for import batch creation, raw staging writes, import evidence, retry/action queue, external mapping audit writes, and KPI import store scope. Create `IntegrationSourceRepository` for source list/create/update/schedule/audit/read operations. Update `IntegrationService` and `IntegrationSchedulerService` to inject the new repository only for source-governance calls.

**Tech Stack:** NestJS, TypeScript, PostgreSQL via existing `DatabaseService`, Jest e2e/unit tests, root script guards.

---

## Scope

This is a mechanical boundary split.

Allowed:

- create a new repository file,
- move source-governance SQL methods from `IntegrationRepository`,
- update constructor injection in `IntegrationService`,
- update constructor injection in `IntegrationSchedulerService`,
- register/export the new provider in `IntegrationModule`,
- run targeted tests and root release gate.

Not allowed:

- no SQL behavior changes,
- no new indexes,
- no schema/migration changes,
- no import raw staging behavior changes,
- no retry/action queue changes,
- no materialization/scoring/master-data changes,
- no DTO/controller/auth changes unless compilation proves a direct import is required.

## Files

Create:

- `backend/nestjs/src/modules/integration/infrastructure/integration-source.repository.ts`

Modify:

- `backend/nestjs/src/modules/integration/infrastructure/integration.repository.ts`
- `backend/nestjs/src/modules/integration/application/integration.service.ts`
- `backend/nestjs/src/modules/integration/application/integration-scheduler.service.ts`
- `backend/nestjs/src/modules/integration/integration.module.ts`
- `current-state.md`

Do not modify:

- `db/schema.sql`
- `db/migrations/*`
- `backend/nestjs/test/integration/import-batch*.ts`
- `backend/nestjs/test/integration/integration-sources.e2e-spec.ts`
- `backend/nestjs/src/modules/integration/application/materialization.service.ts`

## Methods To Move

Move these methods from `IntegrationRepository` to `IntegrationSourceRepository` with the same names and return shapes:

- `listIntegrationSources`
- `listActiveIntegrationSources`
- `getIntegrationSourceByCodeAndEntity`
- `getIntegrationSourceById`
- `createIntegrationSource`
- `updateIntegrationSourceActiveState`
- `updateIntegrationSourceSchedule`
- `listScheduledIntegrationSources`
- `getIntegrationSourceAudit`
- `countActiveImportBatchesForSource`

Also copy the private audit helper into the new repository:

- `resolveAuditActorUserId`

Keep these methods in `IntegrationRepository`:

- `createImportBatch`
- `listExternalIdMapCandidates`
- `listKpiImportStoreExternalRefs`
- `listKpiImportStoreScope`
- `listStoreMasterRegions`
- `updateKpiImportStoreScope`
- all import batch list/detail/evidence/retry/audit methods
- `recordExternalIdMappingApproved`

## Task 1: Create IntegrationSourceRepository

**Files:**

- Create: `backend/nestjs/src/modules/integration/infrastructure/integration-source.repository.ts`
- Modify: `backend/nestjs/src/modules/integration/infrastructure/integration.repository.ts`

- [ ] **Step 1: Create the new repository shell**

Create `integration-source.repository.ts` with:

```ts
import { Injectable } from "@nestjs/common";
import { PoolClient } from "pg";
import { RequestContextStore } from "../../../shared/request-context";
import { DatabaseService } from "../../../shared/database/database.service";

@Injectable()
export class IntegrationSourceRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private async resolveAuditActorUserId(
    actorUserId: string | null | undefined,
    client?: PoolClient,
  ) {
    if (!actorUserId) {
      return null;
    }

    const sql = `
      SELECT user_id
      FROM ops.user_account
      WHERE user_id = $1::uuid
      LIMIT 1
    `;
    const result = client
      ? await client.query<{ user_id: string }>(sql, [actorUserId])
      : await this.databaseService.query<{ user_id: string }>(sql, [actorUserId]);

    return result.rows[0]?.user_id ?? null;
  }
}
```

- [ ] **Step 2: Move source-governance methods**

Move the exact method bodies listed in "Methods To Move" into `IntegrationSourceRepository`.

Keep SQL strings, return values, exception behavior, event names, and metadata fields identical.

- [ ] **Step 3: Remove moved methods from IntegrationRepository**

Remove the moved methods from `IntegrationRepository`.

Keep `resolveAuditActorUserId` inside `IntegrationRepository` because import batch, store-scope, retry, and mapping audit writes still use it.

- [ ] **Step 4: Run TypeScript compile check**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run build
```

Expected:

- build fails at this point until dependent services are updated, or passes if no references remain.
- If it fails, only missing method/provider errors are acceptable.

## Task 2: Update Dependency Injection And Call Sites

**Files:**

- Modify: `backend/nestjs/src/modules/integration/application/integration.service.ts`
- Modify: `backend/nestjs/src/modules/integration/application/integration-scheduler.service.ts`
- Modify: `backend/nestjs/src/modules/integration/integration.module.ts`

- [ ] **Step 1: Inject IntegrationSourceRepository into IntegrationService**

Update imports:

```ts
import { IntegrationRepository } from "../infrastructure/integration.repository";
import { IntegrationSourceRepository } from "../infrastructure/integration-source.repository";
```

Update constructor:

```ts
  constructor(
    private readonly integrationRepository: IntegrationRepository,
    private readonly integrationSourceRepository: IntegrationSourceRepository,
    private readonly materializationService: MaterializationService,
    private readonly kpiImportNormalizationService: KpiImportNormalizationService,
    private readonly integrationSchedulerService: IntegrationSchedulerService,
    private readonly externalIdMappingService: ExternalIdMappingService,
    @Inject(JOB_DISPATCHER)
    private readonly jobDispatcher: JobDispatcher,
  ) {}
```

- [ ] **Step 2: Move source-governance calls in IntegrationService**

Replace these call sites:

```ts
this.integrationRepository.getIntegrationSourceByCodeAndEntity(...)
this.integrationRepository.listIntegrationSources(...)
this.integrationRepository.countActiveImportBatchesForSource(...)
this.integrationRepository.updateIntegrationSourceActiveState(...)
this.integrationRepository.updateIntegrationSourceSchedule(...)
this.integrationRepository.listActiveIntegrationSources()
this.integrationRepository.getIntegrationSourceById(...)
this.integrationRepository.getIntegrationSourceAudit(...)
```

with:

```ts
this.integrationSourceRepository.getIntegrationSourceByCodeAndEntity(...)
this.integrationSourceRepository.listIntegrationSources(...)
this.integrationSourceRepository.countActiveImportBatchesForSource(...)
this.integrationSourceRepository.updateIntegrationSourceActiveState(...)
this.integrationSourceRepository.updateIntegrationSourceSchedule(...)
this.integrationSourceRepository.listActiveIntegrationSources()
this.integrationSourceRepository.getIntegrationSourceById(...)
this.integrationSourceRepository.getIntegrationSourceAudit(...)
```

Do not change calls that are still import/evidence responsibilities:

```ts
this.integrationRepository.createImportBatch(...)
this.integrationRepository.listImportBatches(...)
this.integrationRepository.getImportBatch(...)
this.integrationRepository.listExternalIdMapCandidates(...)
this.integrationRepository.recordExternalIdMappingApproved(...)
```

- [ ] **Step 3: Inject IntegrationSourceRepository into IntegrationSchedulerService**

Update imports:

```ts
import { IntegrationSourceRepository } from "../infrastructure/integration-source.repository";
```

Update constructor:

```ts
  constructor(private readonly integrationSourceRepository: IntegrationSourceRepository) {}
```

Update source read:

```ts
const sources = await this.integrationSourceRepository.listScheduledIntegrationSources();
```

- [ ] **Step 4: Register provider in IntegrationModule**

Update imports:

```ts
import { IntegrationSourceRepository } from "./infrastructure/integration-source.repository";
```

Add `IntegrationSourceRepository` to `providers` and `exports` beside `IntegrationRepository`.

- [ ] **Step 5: Run build**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run build
```

Expected:

- PASS.

## Task 3: Targeted Verification

**Files:**

- No planned production changes.

- [ ] **Step 1: Run scheduler unit tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- --runInBand src/modules/integration/application/integration-scheduler.service.spec.ts
```

Expected:

- PASS.

- [ ] **Step 2: Run integration source and import batch e2e tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- --runInBand test/integration/integration-sources.e2e-spec.ts test/integration/import-batch.e2e-spec.ts test/integration/import-batch-evidence.e2e-spec.ts
```

Expected:

- PASS.
- Import batch create/staging behavior still works.
- Integration source list/create/deactivate/reactivate/audit behavior still works.
- External mapping, store import scope, retry, lineage, and reconciliation evidence still works.

- [ ] **Step 3: Run script guard tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
node --test scripts\*.test.mjs
```

Expected:

- PASS.

- [ ] **Step 4: Run root release gate**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run check:release
```

Expected:

- PASS.

## Task 4: Documentation And Handoff

**Files:**

- Modify: `current-state.md`
- Optional modify: `docs/plans/integration-repository-risk-review-2026-04-30.md`

- [ ] **Step 1: Update current-state**

Add a short section:

```md
## Son IntegrationSourceRepository Split V1 Plan

30 Nisan 2026 itibariyla `IntegrationRepository` icinden yalniz source-governance persistence boundary'sini cikarmak icin plan yazildi.

Referans:

- `docs/superpowers/plans/2026-04-30-integration-source-repository-split-v1.md`

Sinir:

- Raw staging write, import batch evidence, retry/action queue, external mapping audit, KPI import store scope ve materialization davranisi degismeyecek.
- Yeni repository yalniz integration source list/create/update/schedule/audit/read sorumlulugunu alacak.
```

- [ ] **Step 2: Commit**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git status --short
git add -- backend/nestjs/src/modules/integration/infrastructure/integration-source.repository.ts backend/nestjs/src/modules/integration/infrastructure/integration.repository.ts backend/nestjs/src/modules/integration/application/integration.service.ts backend/nestjs/src/modules/integration/application/integration-scheduler.service.ts backend/nestjs/src/modules/integration/integration.module.ts current-state.md
git commit -m "refactor: split integration source repository"
```

Expected:

- Commit succeeds.
- `outputs/` remains untracked and uncommitted.

## Acceptance Criteria

- `IntegrationRepository` no longer owns integration source list/create/update/schedule/audit/read methods.
- `IntegrationSourceRepository` owns only integration source governance persistence.
- Import batch creation and raw staging behavior stays in `IntegrationRepository`.
- No database schema, migration, DTO, controller, auth, materialization, scoring, or master-data behavior changes.
- Targeted integration source/import tests pass.
- Root `check:release` passes.

## CODEX DURUST YORUM

This split is worth doing only as a small mechanical investment.

The reason to do it now is not that the project is broken. The reason is that source governance is a clean boundary and moving it out reduces future review pressure without touching the dangerous raw import path.

The hard stop: if the implementation starts pulling raw staging, retry, mapping, or materialization code into the same pass, stop and revert that extra scope. That would turn a safe maintenance slice into a risky refactor.
