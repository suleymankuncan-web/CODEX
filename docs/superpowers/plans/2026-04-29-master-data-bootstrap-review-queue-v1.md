# Master Data Bootstrap Review Queue V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a scoped HR/Admin review queue for staged master-data bootstrap batches and paginated row review without promoting any data into live `ops.*` tables.

**Architecture:** Extend the existing `MasterDataBootstrapService` and `MasterDataBootstrapRepository` with read-only queue methods. Add small query DTOs and controller endpoints under the existing integration controller. Keep all reads company-scoped and keep all live promotion paths closed.

**Tech Stack:** NestJS, PostgreSQL, Jest, class-validator, class-transformer, existing RBAC decorators, root `check:release`.

---

## File Structure

- `backend/nestjs/src/modules/integration/web/dto/list-master-data-bootstrap-batches.query.ts`: validates queue filters and pagination.
- `backend/nestjs/src/modules/integration/web/dto/list-master-data-bootstrap-rows.query.ts`: validates row review filters and pagination.
- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts`: derives queue readiness and next action, enforces scoped batch access for row review.
- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`: service-level queue/readiness and row review behavior.
- `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.ts`: read-only SQL for batch queue and row review.
- `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts`: guards that queue SQL reads only staging tables and does not mutate `ops.*`.
- `backend/nestjs/src/modules/integration/web/integration.controller.ts`: exposes list and row endpoints with existing role/scope decorators.
- `docs/superpowers/plans/2026-04-29-personnel-master-data-bootstrap-v1.md`: marks review queue slice as complete after implementation.
- `docs/plans/project-debt-ledger.md`: increments debt count only after implementation, tests, and commit pass.

## Task 1: Service Readiness Contract

**Files:**

- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts`

- [ ] **Step 1: Write failing queue service tests**

Add tests to `MasterDataBootstrapService` that call `listBootstrapBatches` and assert derived readiness and next action.

Use this exact test shape inside the existing `describe("MasterDataBootstrapService", () => { ... })` block:

```ts
  it("lists bootstrap batches with derived readiness and next action", async () => {
    const masterDataBootstrapRepository = {
      listBootstrapBatches: jest.fn(async () => ({
        rows: [
          {
            batchId: "batch-uploaded",
            companyId: "00000000-0000-4000-8000-000000000001",
            bootstrapEntity: "store",
            sourceLabel: "Store baseline",
            fileReference: "stores.xlsx",
            uploadedByUserId: "hr-admin-user",
            batchStatus: "uploaded",
            rowCount: 10,
            validCount: 0,
            needsReviewCount: 0,
            invalidCount: 0,
            promotedCount: 0,
            pendingCount: 10,
            createdAt: "2026-04-29T12:00:00.000Z",
            validatedAt: null,
            promotedAt: null,
          },
          {
            batchId: "batch-review",
            companyId: "00000000-0000-4000-8000-000000000001",
            bootstrapEntity: "personnel",
            sourceLabel: "Personnel baseline",
            fileReference: "personnel.xlsx",
            uploadedByUserId: "hr-admin-user",
            batchStatus: "validated",
            rowCount: 10,
            validCount: 7,
            needsReviewCount: 2,
            invalidCount: 1,
            promotedCount: 0,
            pendingCount: 0,
            createdAt: "2026-04-29T12:01:00.000Z",
            validatedAt: "2026-04-29T12:02:00.000Z",
            promotedAt: null,
          },
          {
            batchId: "batch-ready",
            companyId: "00000000-0000-4000-8000-000000000001",
            bootstrapEntity: "store",
            sourceLabel: "Ready store baseline",
            fileReference: "ready-stores.xlsx",
            uploadedByUserId: "hr-admin-user",
            batchStatus: "ready_to_promote",
            rowCount: 3,
            validCount: 3,
            needsReviewCount: 0,
            invalidCount: 0,
            promotedCount: 0,
            pendingCount: 0,
            createdAt: "2026-04-29T12:03:00.000Z",
            validatedAt: "2026-04-29T12:04:00.000Z",
            promotedAt: null,
          },
        ],
        total: 3,
      })),
    };
    const service = new MasterDataBootstrapService(
      masterDataBootstrapRepository as never,
    );

    const result = await service.listBootstrapBatches({
      actorScope: {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
      },
      limit: 25,
      offset: 0,
    });

    expect(masterDataBootstrapRepository.listBootstrapBatches).toHaveBeenCalledWith({
      companyIds: ["00000000-0000-4000-8000-000000000001"],
      bootstrapEntity: undefined,
      batchStatus: undefined,
      readiness: undefined,
      q: undefined,
      limit: 25,
      offset: 0,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        batchId: "batch-uploaded",
        readiness: "needs_validation",
        nextAction: "validate_batch",
      }),
      expect.objectContaining({
        batchId: "batch-review",
        readiness: "needs_review",
        nextAction: "review_invalid_rows",
      }),
      expect.objectContaining({
        batchId: "batch-ready",
        readiness: "ready_to_promote",
        nextAction: "wait_for_promotion_decision",
      }),
    ]);
    expect(result.meta).toEqual({ count: 3, total: 3, limit: 25, offset: 0 });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm.cmd test -- src/modules/integration/application/master-data-bootstrap.service.spec.ts --runInBand
```

Expected result:

```text
Property 'listBootstrapBatches' does not exist on type 'MasterDataBootstrapService'
```

- [ ] **Step 3: Implement minimal service queue method**

In `master-data-bootstrap.service.ts`, add:

```ts
type BootstrapReadiness =
  | "needs_validation"
  | "needs_review"
  | "ready_to_promote"
  | "closed";

type BootstrapNextAction =
  | "validate_batch"
  | "review_invalid_rows"
  | "review_needs_review_rows"
  | "wait_for_promotion_decision"
  | "closed";
```

Add a public method:

```ts
  async listBootstrapBatches(input: {
    actorScope: {
      companyIds: string[];
    };
    bootstrapEntity?: BootstrapEntity;
    batchStatus?: string;
    readiness?: BootstrapReadiness;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    if (input.actorScope.companyIds.length === 0) {
      throw new ForbiddenException("Master data bootstrap requires company scope");
    }

    const result =
      await this.masterDataBootstrapRepository.listBootstrapBatches({
        companyIds: input.actorScope.companyIds,
        bootstrapEntity: input.bootstrapEntity,
        batchStatus: input.batchStatus,
        readiness: input.readiness,
        q: input.q,
        limit: input.limit ?? 50,
        offset: input.offset ?? 0,
      });

    return buildListResponse(
      result.rows.map((batch) => {
        const readiness = deriveBootstrapReadiness(batch);
        return {
          ...batch,
          readiness,
          nextAction: deriveBootstrapNextAction(batch, readiness),
        };
      }),
      {
        total: result.total,
        limit: input.limit ?? 50,
        offset: input.offset ?? 0,
      },
    );
  }
```

Add helpers below `countValidationStatuses`:

```ts
function deriveBootstrapReadiness(input: {
  batchStatus: string;
  pendingCount: number;
  invalidCount: number;
  needsReviewCount: number;
}): BootstrapReadiness {
  if (["promoted", "rejected"].includes(input.batchStatus)) {
    return "closed";
  }

  if (input.batchStatus === "ready_to_promote") {
    return "ready_to_promote";
  }

  if (input.batchStatus === "uploaded" || input.pendingCount > 0) {
    return "needs_validation";
  }

  if (input.invalidCount > 0 || input.needsReviewCount > 0) {
    return "needs_review";
  }

  return "ready_to_promote";
}

function deriveBootstrapNextAction(
  input: {
    invalidCount: number;
    needsReviewCount: number;
  },
  readiness: BootstrapReadiness,
): BootstrapNextAction {
  if (readiness === "needs_validation") {
    return "validate_batch";
  }

  if (readiness === "needs_review" && input.invalidCount > 0) {
    return "review_invalid_rows";
  }

  if (readiness === "needs_review" && input.needsReviewCount > 0) {
    return "review_needs_review_rows";
  }

  if (readiness === "ready_to_promote") {
    return "wait_for_promotion_decision";
  }

  return "closed";
}
```

- [ ] **Step 4: Run service test to verify it passes**

Run:

```powershell
npm.cmd test -- src/modules/integration/application/master-data-bootstrap.service.spec.ts --runInBand
```

Expected result:

```text
PASS src/modules/integration/application/master-data-bootstrap.service.spec.ts
```

## Task 2: Repository Queue And Row Review

**Files:**

- Modify: `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.ts`

- [ ] **Step 1: Write failing repository tests**

Add two tests to `MasterDataBootstrapRepository`:

```ts
  it("lists bootstrap batches from staging tables without mutating live master data", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ total_count: "1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            master_data_bootstrap_batch_id: "batch-1",
            company_id: "00000000-0000-4000-8000-000000000001",
            bootstrap_entity: "store",
            source_label: "Store baseline",
            file_reference: "stores.xlsx",
            uploaded_by_user_id: "hr-admin-user",
            batch_status: "uploaded",
            row_count: 2,
            valid_count: 0,
            needs_review_count: 0,
            invalid_count: 0,
            promoted_count: 0,
            pending_count: 2,
            created_at: "2026-04-29T12:00:00.000Z",
            validated_at: null,
            promoted_at: null,
          },
        ],
      });
    const repository = new MasterDataBootstrapRepository({ query } as never);

    const result = await repository.listBootstrapBatches({
      companyIds: ["00000000-0000-4000-8000-000000000001"],
      readiness: "needs_validation",
      limit: 25,
      offset: 0,
    });

    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("FROM stg.master_data_bootstrap_batch");
    expect(sql).not.toContain("INSERT INTO ops.store");
    expect(sql).not.toContain("UPDATE ops.store");
    expect(sql).not.toContain("INSERT INTO ops.employee");
    expect(sql).not.toContain("UPDATE ops.employee");
    expect(result.total).toBe(1);
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        batchId: "batch-1",
        pendingCount: 2,
      }),
    );
  });

  it("lists bootstrap review rows from staging tables with scoped batch guard", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ total_count: "1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            master_data_bootstrap_row_id: "row-1",
            master_data_bootstrap_batch_id: "batch-1",
            row_number: 7,
            row_hash: "hash-1",
            source_store_code: "SM140",
            source_employee_code: "FM8375",
            raw_payload_json: { storeCode: "SM140" },
            normalized_payload_json: { normalizedStoreCode: "SM140" },
            validation_status: "invalid",
            issue_code: "missing_position_code",
            issue_message: "Position code is required before promotion",
            resolved_company_id: "00000000-0000-4000-8000-000000000001",
            resolved_region_id: null,
            resolved_store_id: null,
            resolved_employee_id: null,
            resolved_position_id: null,
            created_at: "2026-04-29T12:00:00.000Z",
            updated_at: "2026-04-29T12:01:00.000Z",
          },
        ],
      });
    const repository = new MasterDataBootstrapRepository({ query } as never);

    const result = await repository.listBootstrapRowsForReview({
      batchId: "batch-1",
      companyIds: ["00000000-0000-4000-8000-000000000001"],
      validationStatus: "invalid",
      limit: 10,
      offset: 0,
    });

    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("FROM stg.master_data_bootstrap_row");
    expect(sql).toContain("INNER JOIN stg.master_data_bootstrap_batch");
    expect(sql).not.toContain("INSERT INTO ops.store");
    expect(sql).not.toContain("UPDATE ops.employee");
    expect(result.total).toBe(1);
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        rowId: "row-1",
        validationStatus: "invalid",
        issueCode: "missing_position_code",
      }),
    );
  });
```

- [ ] **Step 2: Run repository tests to verify they fail**

Run:

```powershell
npm.cmd test -- src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts --runInBand
```

Expected result:

```text
Property 'listBootstrapBatches' does not exist on type 'MasterDataBootstrapRepository'
Property 'listBootstrapRowsForReview' does not exist on type 'MasterDataBootstrapRepository'
```

- [ ] **Step 3: Implement repository queue types and mapper**

In `master-data-bootstrap.repository.ts`, add:

```ts
type BootstrapBatchQueueRecord = BootstrapBatchRow & {
  pending_count: number;
};

export type BootstrapBatchQueueItem = BootstrapBatch & {
  pendingCount: number;
};

export type BootstrapReadinessFilter =
  | "needs_validation"
  | "needs_review"
  | "ready_to_promote"
  | "closed";
```

Add mapper:

```ts
function mapBootstrapBatchQueueItem(
  row: BootstrapBatchQueueRecord,
): BootstrapBatchQueueItem {
  return {
    ...mapBootstrapBatch(row),
    pendingCount: row.pending_count,
  };
}
```

- [ ] **Step 4: Implement `listBootstrapBatches`**

Add this repository method:

```ts
  async listBootstrapBatches(input: {
    companyIds: string[];
    bootstrapEntity?: BootstrapEntity;
    batchStatus?: string;
    readiness?: BootstrapReadinessFilter;
    q?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: BootstrapBatchQueueItem[]; total: number }> {
    if (input.companyIds.length === 0) {
      return { rows: [], total: 0 };
    }

    const params: unknown[] = [input.companyIds];
    const filters = ["company_id = ANY($1::uuid[])"];

    if (input.bootstrapEntity) {
      params.push(input.bootstrapEntity);
      filters.push(`bootstrap_entity = $${params.length}`);
    }

    if (input.batchStatus) {
      params.push(input.batchStatus);
      filters.push(`batch_status = $${params.length}`);
    }

    if (input.q) {
      params.push(`%${input.q.trim()}%`);
      filters.push(
        `(source_label ILIKE $${params.length} OR file_reference ILIKE $${params.length})`,
      );
    }

    const readinessClause = buildBootstrapReadinessSql(input.readiness);
    if (readinessClause) {
      filters.push(readinessClause);
    }

    const whereClause = `WHERE ${filters.join(" AND ")}`;
    const selectSql = `
      SELECT
        master_data_bootstrap_batch_id,
        company_id,
        bootstrap_entity,
        source_label,
        file_reference,
        uploaded_by_user_id,
        batch_status,
        row_count,
        valid_count,
        needs_review_count,
        invalid_count,
        promoted_count,
        GREATEST(
          row_count - valid_count - needs_review_count - invalid_count - promoted_count,
          0
        )::integer AS pending_count,
        created_at,
        validated_at,
        promoted_at
      FROM stg.master_data_bootstrap_batch
      ${whereClause}
    `;

    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `SELECT COUNT(*)::text AS total_count FROM (${selectSql}) batches`,
      params,
    );

    params.push(input.limit, input.offset);
    const result = await this.databaseService.query<BootstrapBatchQueueRecord>(
      `
        ${selectSql}
        ORDER BY created_at DESC, master_data_bootstrap_batch_id DESC
        LIMIT $${params.length - 1}
        OFFSET $${params.length}
      `,
      params,
    );

    return {
      rows: result.rows.map(mapBootstrapBatchQueueItem),
      total: Number(totalResult.rows[0]?.total_count ?? 0),
    };
  }
```

Add helper:

```ts
function buildBootstrapReadinessSql(readiness?: BootstrapReadinessFilter) {
  if (!readiness) {
    return null;
  }

  const pendingExpression =
    "GREATEST(row_count - valid_count - needs_review_count - invalid_count - promoted_count, 0)";

  if (readiness === "needs_validation") {
    return `(batch_status = 'uploaded' OR ${pendingExpression} > 0)`;
  }

  if (readiness === "needs_review") {
    return `(invalid_count > 0 OR needs_review_count > 0)`;
  }

  if (readiness === "ready_to_promote") {
    return "batch_status = 'ready_to_promote'";
  }

  return "batch_status IN ('promoted', 'rejected')";
}
```

- [ ] **Step 5: Implement `listBootstrapRowsForReview`**

Add this repository method:

```ts
  async listBootstrapRowsForReview(input: {
    batchId: string;
    companyIds: string[];
    validationStatus?: BootstrapValidationStatus;
    issueCode?: string;
    q?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: BootstrapStagedRow[]; total: number }> {
    if (input.companyIds.length === 0) {
      return { rows: [], total: 0 };
    }

    const params: unknown[] = [input.batchId, input.companyIds];
    const filters = [
      "r.master_data_bootstrap_batch_id = $1::uuid",
      "b.company_id = ANY($2::uuid[])",
    ];

    if (input.validationStatus) {
      params.push(input.validationStatus);
      filters.push(`r.validation_status = $${params.length}`);
    }

    if (input.issueCode) {
      params.push(input.issueCode);
      filters.push(`r.issue_code = $${params.length}`);
    }

    if (input.q) {
      params.push(`%${input.q.trim()}%`);
      filters.push(
        `(r.source_store_code ILIKE $${params.length} OR r.source_employee_code ILIKE $${params.length})`,
      );
    }

    const whereClause = `WHERE ${filters.join(" AND ")}`;
    const fromSql = `
      FROM stg.master_data_bootstrap_row r
      INNER JOIN stg.master_data_bootstrap_batch b
        ON b.master_data_bootstrap_batch_id = r.master_data_bootstrap_batch_id
      ${whereClause}
    `;

    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `SELECT COUNT(*)::text AS total_count ${fromSql}`,
      params,
    );

    params.push(input.limit, input.offset);
    const result = await this.databaseService.query<BootstrapStagedRowRecord>(
      `
        SELECT
          r.master_data_bootstrap_row_id,
          r.master_data_bootstrap_batch_id,
          r.row_number,
          r.row_hash,
          r.source_store_code,
          r.source_employee_code,
          r.raw_payload_json,
          r.normalized_payload_json,
          r.validation_status,
          r.issue_code,
          r.issue_message,
          r.resolved_company_id,
          r.resolved_region_id,
          r.resolved_store_id,
          r.resolved_employee_id,
          r.resolved_position_id,
          r.created_at,
          r.updated_at
        ${fromSql}
        ORDER BY
          CASE r.validation_status
            WHEN 'invalid' THEN 1
            WHEN 'needs_review' THEN 2
            WHEN 'pending' THEN 3
            WHEN 'valid' THEN 4
            WHEN 'promoted' THEN 5
            ELSE 6
          END ASC,
          r.row_number ASC,
          r.master_data_bootstrap_row_id ASC
        LIMIT $${params.length - 1}
        OFFSET $${params.length}
      `,
      params,
    );

    return {
      rows: result.rows.map(mapBootstrapStagedRow),
      total: Number(totalResult.rows[0]?.total_count ?? 0),
    };
  }
```

- [ ] **Step 6: Run repository tests**

Run:

```powershell
npm.cmd test -- src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts --runInBand
```

Expected result:

```text
PASS src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts
```

## Task 3: Row Review Service And Controller Endpoints

**Files:**

- Create: `backend/nestjs/src/modules/integration/web/dto/list-master-data-bootstrap-batches.query.ts`
- Create: `backend/nestjs/src/modules/integration/web/dto/list-master-data-bootstrap-rows.query.ts`
- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts`
- Modify: `backend/nestjs/src/modules/integration/web/integration.controller.ts`

- [ ] **Step 1: Write failing service row review test**

Add this test to `master-data-bootstrap.service.spec.ts`:

```ts
  it("lists bootstrap rows for review after checking scoped batch access", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () => ({
        batchId: "batch-1",
        companyId: "00000000-0000-4000-8000-000000000001",
        bootstrapEntity: "personnel",
        sourceLabel: "Personnel baseline",
        fileReference: "personnel.xlsx",
        uploadedByUserId: "hr-admin-user",
        batchStatus: "validated",
        rowCount: 1,
        validCount: 0,
        needsReviewCount: 0,
        invalidCount: 1,
        promotedCount: 0,
        createdAt: "2026-04-29T12:00:00.000Z",
        validatedAt: "2026-04-29T12:01:00.000Z",
        promotedAt: null,
      })),
      listBootstrapRowsForReview: jest.fn(async () => ({
        rows: [
          {
            rowId: "row-1",
            batchId: "batch-1",
            rowNumber: 1,
            rowHash: "hash-1",
            sourceStoreCode: "SM140",
            sourceEmployeeCode: "FM8375",
            rawPayload: { storeCode: "SM140" },
            normalizedPayload: { normalizedStoreCode: "SM140" },
            validationStatus: "invalid",
            issueCode: "missing_position_code",
            issueMessage: "Position code is required before promotion",
            resolvedCompanyId: "00000000-0000-4000-8000-000000000001",
            resolvedRegionId: null,
            resolvedStoreId: null,
            resolvedEmployeeId: null,
            resolvedPositionId: null,
            createdAt: "2026-04-29T12:00:00.000Z",
            updatedAt: "2026-04-29T12:01:00.000Z",
          },
        ],
        total: 1,
      })),
    };
    const service = new MasterDataBootstrapService(
      masterDataBootstrapRepository as never,
    );

    const result = await service.listBootstrapRowsForReview({
      actorScope: {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
      },
      batchId: "batch-1",
      validationStatus: "invalid",
      limit: 10,
      offset: 0,
    });

    expect(masterDataBootstrapRepository.getBootstrapBatchForActor).toHaveBeenCalled();
    expect(masterDataBootstrapRepository.listBootstrapRowsForReview).toHaveBeenCalledWith({
      batchId: "batch-1",
      companyIds: ["00000000-0000-4000-8000-000000000001"],
      validationStatus: "invalid",
      issueCode: undefined,
      q: undefined,
      limit: 10,
      offset: 0,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        rowId: "row-1",
        validationStatus: "invalid",
        issueCode: "missing_position_code",
      }),
    );
    expect(result.meta).toEqual({ count: 1, total: 1, limit: 10, offset: 0 });
  });
```

- [ ] **Step 2: Run service tests to verify row review fails**

Run:

```powershell
npm.cmd test -- src/modules/integration/application/master-data-bootstrap.service.spec.ts --runInBand
```

Expected result:

```text
Property 'listBootstrapRowsForReview' does not exist on type 'MasterDataBootstrapService'
```

- [ ] **Step 3: Add query DTOs**

Create `list-master-data-bootstrap-batches.query.ts`:

```ts
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListMasterDataBootstrapBatchesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsIn(["store", "personnel"])
  bootstrapEntity?: "store" | "personnel";

  @IsOptional()
  @IsIn(["uploaded", "validated", "ready_to_promote", "promoted", "rejected"])
  batchStatus?: string;

  @IsOptional()
  @IsIn(["needs_validation", "needs_review", "ready_to_promote", "closed"])
  readiness?: "needs_validation" | "needs_review" | "ready_to_promote" | "closed";

  @IsOptional()
  @IsString()
  q?: string;
}
```

Create `list-master-data-bootstrap-rows.query.ts`:

```ts
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListMasterDataBootstrapRowsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsIn(["pending", "valid", "needs_review", "invalid", "promoted"])
  validationStatus?: "pending" | "valid" | "needs_review" | "invalid" | "promoted";

  @IsOptional()
  @IsString()
  issueCode?: string;

  @IsOptional()
  @IsString()
  q?: string;
}
```

- [ ] **Step 4: Implement service row review method**

Add this method to `MasterDataBootstrapService`:

```ts
  async listBootstrapRowsForReview(input: {
    actorScope: {
      companyIds: string[];
    };
    batchId: string;
    validationStatus?: BootstrapValidationStatus;
    issueCode?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    await this.getScopedBootstrapBatch({
      batchId: input.batchId,
      companyIds: input.actorScope.companyIds,
    });

    const result =
      await this.masterDataBootstrapRepository.listBootstrapRowsForReview({
        batchId: input.batchId,
        companyIds: input.actorScope.companyIds,
        validationStatus: input.validationStatus,
        issueCode: input.issueCode,
        q: input.q,
        limit: input.limit ?? 50,
        offset: input.offset ?? 0,
      });

    return buildListResponse(
      result.rows.map((row) => ({
        rowId: row.rowId,
        batchId: row.batchId,
        rowNumber: row.rowNumber,
        sourceStoreCode: row.sourceStoreCode,
        sourceEmployeeCode: row.sourceEmployeeCode,
        validationStatus: row.validationStatus,
        issueCode: row.issueCode,
        issueMessage: row.issueMessage,
        resolvedCompanyId: row.resolvedCompanyId,
        resolvedRegionId: row.resolvedRegionId,
        resolvedStoreId: row.resolvedStoreId,
        resolvedEmployeeId: row.resolvedEmployeeId,
        resolvedPositionId: row.resolvedPositionId,
        rawPayload: row.rawPayload,
        normalizedPayload: row.normalizedPayload,
        updatedAt: row.updatedAt,
      })),
      {
        total: result.total,
        limit: input.limit ?? 50,
        offset: input.offset ?? 0,
      },
    );
  }
```

- [ ] **Step 5: Add controller endpoints**

In `integration.controller.ts`, import the DTOs:

```ts
import { ListMasterDataBootstrapBatchesQueryDto } from "./dto/list-master-data-bootstrap-batches.query";
import { ListMasterDataBootstrapRowsQueryDto } from "./dto/list-master-data-bootstrap-rows.query";
```

Add the list endpoint before `@Post("master-data-bootstrap/batches")` or immediately after it:

```ts
  @Get("master-data-bootstrap/batches")
  @RequireScope("company")
  @RequireRoles("HR_ADMIN", "SUPER_ADMIN", "INTEGRATION_ADMIN")
  async listMasterDataBootstrapBatches(
    @Query() query: ListMasterDataBootstrapBatchesQueryDto,
    @Req()
    request: {
      user: {
        scope: {
          companyIds: string[];
        };
      };
    },
  ) {
    return this.masterDataBootstrapService.listBootstrapBatches({
      actorScope: {
        companyIds: request.user.scope.companyIds,
      },
      bootstrapEntity: query.bootstrapEntity,
      batchStatus: query.batchStatus,
      readiness: query.readiness,
      q: query.q,
      limit: query.limit,
      offset: query.offset,
    });
  }
```

Add the rows endpoint before `@Get("master-data-bootstrap/batches/:batchId")`:

```ts
  @Get("master-data-bootstrap/batches/:batchId/rows")
  @RequireScope("company")
  @RequireRoles("HR_ADMIN", "SUPER_ADMIN", "INTEGRATION_ADMIN")
  async listMasterDataBootstrapRows(
    @Param("batchId") batchId: string,
    @Query() query: ListMasterDataBootstrapRowsQueryDto,
    @Req()
    request: {
      user: {
        scope: {
          companyIds: string[];
        };
      };
    },
  ) {
    return this.masterDataBootstrapService.listBootstrapRowsForReview({
      actorScope: {
        companyIds: request.user.scope.companyIds,
      },
      batchId,
      validationStatus: query.validationStatus,
      issueCode: query.issueCode,
      q: query.q,
      limit: query.limit,
      offset: query.offset,
    });
  }
```

- [ ] **Step 6: Run targeted backend tests**

Run:

```powershell
npm.cmd test -- master-data-bootstrap --runInBand
```

Expected result:

```text
PASS src/modules/integration/application/master-data-bootstrap.service.spec.ts
PASS src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts
PASS src/modules/integration/master-data-bootstrap-schema-contract.spec.ts
```

## Task 4: Documentation, Release Gate, And Commit

**Files:**

- Modify: `docs/superpowers/plans/2026-04-29-personnel-master-data-bootstrap-v1.md`
- Modify: `docs/plans/project-debt-ledger.md`
- Modify: `docs/superpowers/plans/2026-04-29-master-data-bootstrap-review-queue-v1.md`

- [ ] **Step 1: Update bootstrap implementation plan**

In `docs/superpowers/plans/2026-04-29-personnel-master-data-bootstrap-v1.md`, add a completed slice after V1-C:

```md
## Completed Slice: V1-C2 Review Queue Read Model

- [x] **Step 1: Add scoped batch queue**

Added `GET /api/integrations/master-data-bootstrap/batches` for HR/Admin review of staged bootstrap batches.

- [x] **Step 2: Add paginated row review**

Added `GET /api/integrations/master-data-bootstrap/batches/:batchId/rows` for filtered review of invalid, needs-review, pending, valid, and promoted rows.

- [x] **Step 3: Keep promotion closed**

The queue is read-only and does not write to `ops.store`, `ops.employee`, or `ops.employee_assignment_history`.
```

- [ ] **Step 2: Update debt ledger only after tests pass**

In `docs/plans/project-debt-ledger.md`:

- Change `Closed active debts: 51` to `Closed active debts: 52`.
- Add list item `52. Master Data Bootstrap Review Queue V1`.
- Add one paragraph:

```md
Master Data Bootstrap Review Queue V1 is counted as paid because HR/Admin can list staged bootstrap batches, derive readiness and next action, and review problematic rows through scoped read-only endpoints while promotion into live `ops.*` tables remains closed.
```

- Add repo hygiene note:

```md
- the 29 April 2026 Master Data Bootstrap Review Queue V1 implementation added scoped batch and row review endpoints so staged baseline data can be inspected without live promotion.
```

- [ ] **Step 3: Run verification**

Run:

```powershell
npm.cmd test -- master-data-bootstrap --runInBand
npm.cmd run lint
npm.cmd run build
```

Expected result:

```text
targeted bootstrap tests pass
backend lint passes
backend build passes
```

Then run from repo root:

```powershell
npm.cmd run check:release
```

Expected result:

```text
root script tests pass
backend release check passes
frontend release check passes
audits report 0 vulnerabilities
```

- [ ] **Step 4: Confirm working tree and stage only related files**

Run:

```powershell
git status --short
```

Expected:

```text
modified bootstrap code/test/doc files
?? outputs/
```

Do not stage `outputs/`.

Stage:

```powershell
git add -- `
  backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts `
  backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts `
  backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts `
  backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.ts `
  backend/nestjs/src/modules/integration/web/integration.controller.ts `
  backend/nestjs/src/modules/integration/web/dto/list-master-data-bootstrap-batches.query.ts `
  backend/nestjs/src/modules/integration/web/dto/list-master-data-bootstrap-rows.query.ts `
  docs/superpowers/plans/2026-04-29-personnel-master-data-bootstrap-v1.md `
  docs/plans/project-debt-ledger.md `
  docs/superpowers/plans/2026-04-29-master-data-bootstrap-review-queue-v1.md
```

- [ ] **Step 5: Commit implementation**

Run:

```powershell
git commit -m "feat: add master data bootstrap review queue"
```

Expected:

```text
[chore/actions-node24-runtime <sha>] feat: add master data bootstrap review queue
```

## Self-Review Notes

Spec coverage:

- Queue endpoint: Task 3.
- Row review endpoint: Task 3.
- Readiness and next action: Task 1.
- Scoped staging-only repository reads: Task 2.
- Pagination and filters: Tasks 2 and 3.
- No live promotion: Tasks 2 and 4.
- Verification and debt ledger: Task 4.

No implementation task in this plan writes to live `ops.store`, `ops.employee`, or `ops.employee_assignment_history`.
