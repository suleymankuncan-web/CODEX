# Mobile Checklist Today V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first mobile checklist workflow where HR owns versioned templates, region managers score store visits, and store managers acknowledge completed results.

**Architecture:** Backend-first implementation over the existing `ops.checklist_*` tables. Add only the schema needed for template versioning, instance lifecycle, completed locking, and mobile read composition; keep score calculation in NestJS application services and keep existing acknowledgement behavior compatible.

**Tech Stack:** NestJS, TypeScript, PostgreSQL SQL migrations, Jest, Supertest, React/Vite/Playwright for the pilot web surface.

---

## Locked Product Rules

- HR-managed weights must total `100`.
- Region manager scores each item from `0` to `10`.
- Completed checklist instances are locked after completion.
- Store manager acknowledgement does not delay score inclusion.
- Do not enforce one checklist per store/template/month.
- `monthlySummaries` must expose completed visit count and average score for the selected month.

## File Structure

Backend schema:

- Create: `db/migrations/037_mobile_checklist_today_v1.sql`
- Modify: `db/schema.sql`
- Create: `backend/nestjs/src/modules/store-ops/checklist-mobile-workflow-schema-contract.spec.ts`

Backend application:

- Create: `backend/nestjs/src/modules/store-ops/application/checklist.contract.ts`
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.ts`
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/checklist.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/checklist.service.spec.ts` if it exists; otherwise create it.
- Modify: `backend/nestjs/src/modules/store-ops/store-ops.module.ts`

Backend web/API:

- Create: `backend/nestjs/src/modules/store-ops/web/mobile-checklist.controller.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/admin-checklist-template.controller.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/create-checklist-template.dto.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/update-checklist-template.dto.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/publish-checklist-template.dto.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/start-mobile-checklist-instance.dto.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/save-mobile-checklist-response.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/checklist.controller.ts` only if legacy endpoints need to call the same service guards.

Backend tests:

- Create: `backend/nestjs/test/integration/mobile-checklist-today.e2e-spec.ts`
- Extend: `backend/nestjs/test/integration/checklist-flow.e2e-spec.ts` only for legacy compatibility.

Frontend pilot:

- Modify: `admin-web/src/features/checklists/api.ts`
- Create: `admin-web/src/pages/AdminChecklistTemplatesPage.tsx`
- Modify: `admin-web/src/pages/StoreChecklistsPage.tsx`
- Modify: `admin-web/src/App.tsx`
- Create: `admin-web/e2e/checklist-today-surfaces.spec.ts`

Docs and guards:

- Modify: `current-state.md`
- Modify: `docs/plans/active-next-actions.md`
- Modify: `docs/plans/project-debt-ledger.md`
- Create or extend root script guard if this plan changes.

## Task 1: Schema Contract And Migration

**Files:**

- Create: `backend/nestjs/src/modules/store-ops/checklist-mobile-workflow-schema-contract.spec.ts`
- Create: `db/migrations/037_mobile_checklist_today_v1.sql`
- Modify: `db/schema.sql`

- [ ] **Step 1: Write the failing schema contract**

Create `backend/nestjs/src/modules/store-ops/checklist-mobile-workflow-schema-contract.spec.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(process.cwd(), "..", "..");
const schemaSql = readFileSync(join(projectRoot, "db", "schema.sql"), "utf8");
const migrationPath = join(
  projectRoot,
  "db",
  "migrations",
  "037_mobile_checklist_today_v1.sql",
);
const migrationSql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

describe("mobile checklist workflow schema contract", () => {
  it("keeps template versioning and visit lifecycle fields in canonical schema and migration", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain("template_type TEXT NOT NULL DEFAULT 'BM_STORE_VISIT'");
      expect(sql).toContain("UNIQUE (template_code, version_no)");
      expect(sql).toContain("completed_by_user_id TEXT");
      expect(sql).toContain("locked_at TIMESTAMPTZ");
      expect(sql).toContain("CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled'))");
      expect(sql).toContain("idx_checklist_instance_mobile_today");
      expect(sql).toContain("idx_checklist_instance_monthly_completed");
    }
  });
});
```

- [ ] **Step 2: Run the schema contract and verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/checklist-mobile-workflow-schema-contract.spec.ts --runInBand
```

Expected: FAIL because `037_mobile_checklist_today_v1.sql` does not exist and `db/schema.sql` does not yet include the new lifecycle/versioning fields.

- [ ] **Step 3: Add additive migration**

Create `db/migrations/037_mobile_checklist_today_v1.sql`:

```sql
ALTER TABLE ops.checklist_template
    ADD COLUMN IF NOT EXISTS template_type TEXT NOT NULL DEFAULT 'BM_STORE_VISIT';

ALTER TABLE ops.checklist_template
    DROP CONSTRAINT IF EXISTS checklist_template_template_code_key;

ALTER TABLE ops.checklist_template
    ADD CONSTRAINT checklist_template_code_version_unique UNIQUE (template_code, version_no);

ALTER TABLE ops.checklist_instance
    ADD COLUMN IF NOT EXISTS started_by_user_id TEXT,
    ADD COLUMN IF NOT EXISTS completed_by_user_id TEXT,
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

ALTER TABLE ops.checklist_instance
    DROP CONSTRAINT IF EXISTS checklist_instance_status_check;

ALTER TABLE ops.checklist_instance
    ADD CONSTRAINT checklist_instance_status_check
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_checklist_instance_mobile_today
    ON ops.checklist_instance (store_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checklist_instance_monthly_completed
    ON ops.checklist_instance (store_id, checklist_template_id, completed_at DESC)
    WHERE status = 'completed';

COMMENT ON COLUMN ops.checklist_template.template_type IS 'Checklist template type such as BM_STORE_VISIT. One checklist engine supports multiple future types.';
COMMENT ON COLUMN ops.checklist_instance.locked_at IS 'Set when a checklist instance is completed and no longer accepts response changes.';
```

- [ ] **Step 4: Mirror the migration in canonical schema**

Modify `db/schema.sql`:

```sql
CREATE TABLE ops.checklist_template (
    checklist_template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    template_code TEXT NOT NULL,
    template_type TEXT NOT NULL DEFAULT 'BM_STORE_VISIT',
    template_name TEXT NOT NULL,
    category TEXT NOT NULL,
    version_no INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_by UUID NOT NULL REFERENCES ops.user_account(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (template_code, version_no),
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
```

Update `ops.checklist_instance` in `db/schema.sql`:

```sql
CREATE TABLE ops.checklist_instance (
    checklist_instance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_template_id UUID NOT NULL REFERENCES ops.checklist_template(checklist_template_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    assigned_employee_id UUID REFERENCES ops.employee(employee_id),
    auditor_employee_id UUID REFERENCES ops.employee(employee_id),
    started_by_user_id TEXT,
    completed_by_user_id TEXT,
    planned_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    locked_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'planned',
    total_score NUMERIC(12,2),
    compliance_rate NUMERIC(7,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled'))
);
```

Add indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_checklist_instance_mobile_today
    ON ops.checklist_instance (store_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checklist_instance_monthly_completed
    ON ops.checklist_instance (store_id, checklist_template_id, completed_at DESC)
    WHERE status = 'completed';
```

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/checklist-mobile-workflow-schema-contract.spec.ts --runInBand
```

Expected: PASS.

## Task 2: Checklist Contracts And Repository

**Files:**

- Create: `backend/nestjs/src/modules/store-ops/application/checklist.contract.ts`
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.ts`
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/store-ops.module.ts`

- [ ] **Step 1: Write repository tests**

Create `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.spec.ts`:

```ts
import { ChecklistRepository } from "./checklist.repository";

describe("ChecklistRepository", () => {
  it("returns no mobile today rows when actor has no assigned stores", async () => {
    const query = jest.fn();
    const repository = new ChecklistRepository({ query } as never);

    const result = await repository.getMobileChecklistToday({
      actorUserId: "region-user-1",
      assignedStoreIds: [],
      readStoreIds: [],
    });

    expect(result).toEqual({
      stores: [],
      templates: [],
      activeInstances: [],
      completedThisMonth: [],
      pendingAcknowledgements: [],
      monthlySummaries: [],
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("uses assigned stores for mobile checklist today read model", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ store_id: "store-1", store_name: "Marmara Park" }] })
      .mockResolvedValueOnce({ rows: [{ checklist_template_id: "template-1", template_name: "BM Visit" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const repository = new ChecklistRepository({ query } as never);

    await repository.getMobileChecklistToday({
      actorUserId: "region-user-1",
      assignedStoreIds: ["store-1"],
      readStoreIds: ["store-1"],
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining("s.store_id = ANY($1::uuid[])"), [["store-1"]]);
  });
});
```

- [ ] **Step 2: Run repository tests and verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/infrastructure/checklist.repository.spec.ts --runInBand
```

Expected: FAIL because `ChecklistRepository` does not exist.

- [ ] **Step 3: Add checklist contracts**

Create `backend/nestjs/src/modules/store-ops/application/checklist.contract.ts`:

```ts
export type ChecklistInstanceStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type ChecklistTemplateStatus = "draft" | "published" | "archived";
export type ChecklistTemplateType = "BM_STORE_VISIT" | "VM_STORE_VISIT" | string;

export type MobileChecklistToday = {
  stores: Array<{ storeId: string; storeName: string }>;
  templates: Array<{
    checklistTemplateId: string;
    templateCode: string;
    templateType: ChecklistTemplateType;
    templateName: string;
    versionNo: number;
  }>;
  activeInstances: Array<{
    checklistInstanceId: string;
    checklistTemplateId: string;
    storeId: string;
    status: ChecklistInstanceStatus;
    startedAt: string | null;
    updatedAt: string | null;
  }>;
  completedThisMonth: Array<{
    checklistInstanceId: string;
    checklistTemplateId: string;
    storeId: string;
    completedAt: string;
    totalScore: number;
    acknowledgedAt: string | null;
  }>;
  pendingAcknowledgements: Array<{
    checklistInstanceId: string;
    checklistTemplateId: string;
    storeId: string;
    completedAt: string;
    totalScore: number;
  }>;
  monthlySummaries: Array<{
    storeId: string;
    checklistTemplateId: string;
    monthStart: string;
    completedCount: number;
    averageScore: number | null;
  }>;
};
```

- [ ] **Step 4: Add repository implementation**

Create `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.ts` with methods:

```ts
import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import { MobileChecklistToday } from "../application/checklist.contract";

@Injectable()
export class ChecklistRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getMobileChecklistToday(input: {
    actorUserId: string;
    assignedStoreIds: string[];
    readStoreIds: string[];
  }): Promise<MobileChecklistToday> {
    const storeIds = input.assignedStoreIds.length > 0 ? input.assignedStoreIds : input.readStoreIds;

    if (storeIds.length === 0) {
      return {
        stores: [],
        templates: [],
        activeInstances: [],
        completedThisMonth: [],
        pendingAcknowledgements: [],
        monthlySummaries: [],
      };
    }

    const stores = await this.databaseService.query<{ store_id: string; store_name: string }>(
      `
        SELECT s.store_id, s.store_name
        FROM ops.store s
        WHERE s.store_id = ANY($1::uuid[])
        ORDER BY s.store_name ASC
      `,
      [storeIds],
    );

    const templates = await this.databaseService.query<{
      checklist_template_id: string;
      template_code: string;
      template_type: string;
      template_name: string;
      version_no: number;
    }>(
      `
        SELECT checklist_template_id, template_code, template_type, template_name, version_no
        FROM ops.checklist_template
        WHERE status = 'published'
          AND effective_from <= CURRENT_DATE
          AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
        ORDER BY template_type ASC, template_name ASC, version_no DESC
      `,
    );

    const activeInstances = await this.databaseService.query<{
      checklist_instance_id: string;
      checklist_template_id: string;
      store_id: string;
      status: "planned" | "in_progress";
      started_at: string | null;
      updated_at: string | null;
    }>(
      `
        SELECT checklist_instance_id, checklist_template_id, store_id, status, started_at, created_at AS updated_at
        FROM ops.checklist_instance
        WHERE store_id = ANY($1::uuid[])
          AND status IN ('planned', 'in_progress')
        ORDER BY created_at DESC
      `,
      [storeIds],
    );

    const completedThisMonth = await this.databaseService.query<{
      checklist_instance_id: string;
      checklist_template_id: string;
      store_id: string;
      completed_at: string;
      total_score: string;
      acknowledged_at: string | null;
    }>(
      `
        SELECT ci.checklist_instance_id, ci.checklist_template_id, ci.store_id, ci.completed_at, ci.total_score, ca.acknowledged_at
        FROM ops.checklist_instance ci
        LEFT JOIN ops.checklist_acknowledgement ca
          ON ca.checklist_instance_id = ci.checklist_instance_id
        WHERE ci.store_id = ANY($1::uuid[])
          AND ci.status = 'completed'
          AND ci.completed_at >= date_trunc('month', CURRENT_DATE)
          AND ci.completed_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
        ORDER BY ci.completed_at DESC
      `,
      [storeIds],
    );

    const monthlySummaries = await this.databaseService.query<{
      store_id: string;
      checklist_template_id: string;
      month_start: string;
      completed_count: string;
      average_score: string | null;
    }>(
      `
        SELECT
          ci.store_id,
          ci.checklist_template_id,
          date_trunc('month', ci.completed_at)::date AS month_start,
          COUNT(*)::text AS completed_count,
          AVG(ci.total_score)::numeric(12,2)::text AS average_score
        FROM ops.checklist_instance ci
        WHERE ci.store_id = ANY($1::uuid[])
          AND ci.status = 'completed'
          AND ci.completed_at >= date_trunc('month', CURRENT_DATE)
          AND ci.completed_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
        GROUP BY ci.store_id, ci.checklist_template_id, date_trunc('month', ci.completed_at)::date
      `,
      [storeIds],
    );

    return {
      stores: stores.rows.map((row) => ({ storeId: row.store_id, storeName: row.store_name })),
      templates: templates.rows.map((row) => ({
        checklistTemplateId: row.checklist_template_id,
        templateCode: row.template_code,
        templateType: row.template_type,
        templateName: row.template_name,
        versionNo: Number(row.version_no),
      })),
      activeInstances: activeInstances.rows.map((row) => ({
        checklistInstanceId: row.checklist_instance_id,
        checklistTemplateId: row.checklist_template_id,
        storeId: row.store_id,
        status: row.status,
        startedAt: row.started_at,
        updatedAt: row.updated_at,
      })),
      completedThisMonth: completedThisMonth.rows.map((row) => ({
        checklistInstanceId: row.checklist_instance_id,
        checklistTemplateId: row.checklist_template_id,
        storeId: row.store_id,
        completedAt: row.completed_at,
        totalScore: Number(row.total_score),
        acknowledgedAt: row.acknowledged_at,
      })),
      pendingAcknowledgements: completedThisMonth.rows
        .filter((row) => row.acknowledged_at === null)
        .map((row) => ({
          checklistInstanceId: row.checklist_instance_id,
          checklistTemplateId: row.checklist_template_id,
          storeId: row.store_id,
          completedAt: row.completed_at,
          totalScore: Number(row.total_score),
        })),
      monthlySummaries: monthlySummaries.rows.map((row) => ({
        storeId: row.store_id,
        checklistTemplateId: row.checklist_template_id,
        monthStart: row.month_start,
        completedCount: Number(row.completed_count),
        averageScore: row.average_score === null ? null : Number(row.average_score),
      })),
    };
  }
}
```

- [ ] **Step 5: Register repository**

Modify `backend/nestjs/src/modules/store-ops/store-ops.module.ts`:

```ts
import { ChecklistRepository } from "./infrastructure/checklist.repository";
```

Add `ChecklistRepository` to `providers` and `exports`.

- [ ] **Step 6: Verify repository tests GREEN**

Run:

```powershell
npm.cmd test -- src/modules/store-ops/infrastructure/checklist.repository.spec.ts --runInBand
```

Expected: PASS.

## Task 3: HR Template Draft And Publish Backend

**Files:**

- Create: `backend/nestjs/src/modules/store-ops/web/admin-checklist-template.controller.ts`
- Create DTOs listed in File Structure.
- Modify: `backend/nestjs/src/modules/store-ops/application/checklist.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.ts`
- Create or extend: `backend/nestjs/src/modules/store-ops/application/checklist.service.spec.ts`

- [ ] **Step 1: Write service tests for weight validation**

Create `backend/nestjs/src/modules/store-ops/application/checklist.service.spec.ts`:

```ts
import { BadRequestException } from "@nestjs/common";
import { ChecklistService } from "./checklist.service";

function createService(repositoryOverride: Record<string, jest.Mock>) {
  return new ChecklistService(
    {} as never,
    {} as never,
    repositoryOverride as never,
  );
}

describe("ChecklistService template publishing", () => {
  it("rejects publishing when item weights do not total 100", async () => {
    const service = createService({
      getDraftTemplateItems: jest.fn().mockResolvedValue([
        { templateItemId: "item-1", weight: 40 },
        { templateItemId: "item-2", weight: 40 },
      ]),
      publishTemplate: jest.fn(),
    });

    await expect(
      service.publishChecklistTemplate({
        checklistTemplateId: "template-1",
        actorUserId: "hr-user-1",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("publishes when item weights total 100", async () => {
    const publishTemplate = jest.fn().mockResolvedValue({
      checklistTemplateId: "template-1",
      status: "published",
    });
    const service = createService({
      getDraftTemplateItems: jest.fn().mockResolvedValue([
        { templateItemId: "item-1", weight: 60 },
        { templateItemId: "item-2", weight: 40 },
      ]),
      publishTemplate,
    });

    const result = await service.publishChecklistTemplate({
      checklistTemplateId: "template-1",
      actorUserId: "hr-user-1",
    });

    expect(result.command.status).toBe("published");
    expect(publishTemplate).toHaveBeenCalledWith({
      checklistTemplateId: "template-1",
      actorUserId: "hr-user-1",
    });
  });
});
```

- [ ] **Step 2: Run service tests and verify RED**

Run:

```powershell
npm.cmd test -- src/modules/store-ops/application/checklist.service.spec.ts --runInBand
```

Expected: FAIL because `publishChecklistTemplate` and constructor wiring do not yet match.

- [ ] **Step 3: Add DTOs**

Create `backend/nestjs/src/modules/store-ops/web/dto/create-checklist-template.dto.ts`:

```ts
import { Type } from "class-transformer";
import { IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

class ChecklistTemplateItemDto {
  @IsString()
  sectionName!: string;

  @IsInt()
  @Min(1)
  itemNo!: number;

  @IsString()
  itemText!: string;

  @IsIn(["score", "yes_no", "partial", "text"])
  responseType!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  weight!: number;

  @IsNumber()
  @Min(1)
  maxScore!: number;

  @IsOptional()
  @IsString()
  expectedValue?: string;
}

export class CreateChecklistTemplateDto {
  @IsPostgresUuid()
  companyId!: string;

  @IsString()
  templateCode!: string;

  @IsString()
  templateName!: string;

  @IsString()
  templateType!: string;

  @IsString()
  category!: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistTemplateItemDto)
  items!: ChecklistTemplateItemDto[];
}
```

Create `update-checklist-template.dto.ts` by reusing the same shape without `companyId/templateCode/versionNo` changes. Create `publish-checklist-template.dto.ts` with optional `effectiveFrom` and `effectiveTo`.

- [ ] **Step 4: Add repository methods**

Add to `ChecklistRepository`:

```ts
async getDraftTemplateItems(checklistTemplateId: string) {
  const result = await this.databaseService.query<{ template_item_id: string; weight: string }>(
    `
      SELECT template_item_id, weight
      FROM ops.checklist_template_item
      WHERE checklist_template_id = $1::uuid
      ORDER BY item_no ASC
    `,
    [checklistTemplateId],
  );

  return result.rows.map((row) => ({
    templateItemId: row.template_item_id,
    weight: Number(row.weight),
  }));
}

async publishTemplate(input: { checklistTemplateId: string; actorUserId: string }) {
  const result = await this.databaseService.query<{
    checklist_template_id: string;
    status: string;
  }>(
    `
      UPDATE ops.checklist_template
      SET status = 'published'
      WHERE checklist_template_id = $1::uuid
        AND status = 'draft'
      RETURNING checklist_template_id, status
    `,
    [input.checklistTemplateId],
  );

  return {
    checklistTemplateId: result.rows[0].checklist_template_id,
    status: result.rows[0].status,
  };
}
```

- [ ] **Step 5: Add service methods**

Extend `ChecklistService` constructor with `ChecklistRepository`, then add:

```ts
async publishChecklistTemplate(input: { checklistTemplateId: string; actorUserId: string }) {
  const items = await this.checklistRepository.getDraftTemplateItems(input.checklistTemplateId);
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);

  if (Math.round(totalWeight * 100) !== 10_000) {
    throw new BadRequestException("Checklist item weights must total 100");
  }

  return buildCommandResponse({
    status: "published",
    message: "Checklist template published",
    data: {
      checklistTemplate: await this.checklistRepository.publishTemplate(input),
    },
  });
}
```

- [ ] **Step 6: Add HR admin controller**

Create `backend/nestjs/src/modules/store-ops/web/admin-checklist-template.controller.ts`:

```ts
import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { ChecklistService } from "../application/checklist.service";
import { CreateChecklistTemplateDto } from "./dto/create-checklist-template.dto";

@Controller("admin/checklist-templates")
@RequireScope("authenticated")
@RequireRoles("HR_ADMIN", "SUPER_ADMIN")
export class AdminChecklistTemplateController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Post()
  async createTemplate(@Req() request: { user: { userId: string } }, @Body() body: CreateChecklistTemplateDto) {
    return this.checklistService.createChecklistTemplate({
      ...body,
      actorUserId: request.user.userId,
    });
  }

  @Post(":checklistTemplateId/publish")
  async publishTemplate(
    @Req() request: { user: { userId: string } },
    @Param("checklistTemplateId") checklistTemplateId: string,
  ) {
    return this.checklistService.publishChecklistTemplate({
      checklistTemplateId,
      actorUserId: request.user.userId,
    });
  }
}
```

Register the controller in `StoreOpsModule`.

- [ ] **Step 7: Verify HR template tests**

Run:

```powershell
npm.cmd test -- src/modules/store-ops/application/checklist.service.spec.ts --runInBand
```

Expected: PASS.

## Task 4: Region Manager Draft/Resume/Response Flow

**Files:**

- Create: `backend/nestjs/src/modules/store-ops/web/mobile-checklist.controller.ts`
- Create DTOs: `start-mobile-checklist-instance.dto.ts`, `save-mobile-checklist-response.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/checklist.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.ts`
- Create: `backend/nestjs/test/integration/mobile-checklist-today.e2e-spec.ts`

- [ ] **Step 1: Write e2e test for assigned-store start**

Create `backend/nestjs/test/integration/mobile-checklist-today.e2e-spec.ts`:

```ts
import * as request from "supertest";
import { createIntegrationApp } from "./test-app";

describe("Mobile checklist today flow", () => {
  const storeId = "11111111-1111-4111-8111-111111111111";
  const otherStoreId = "99999999-9999-4999-8999-999999999999";
  const templateId = "22222222-2222-4222-8222-222222222222";

  it("lets region managers start a checklist only for assigned stores", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("INSERT INTO ops.checklist_instance")) {
        return { rows: [{ checklist_instance_id: "instance-1", status: "planned", created_at: "2026-04-28T10:00:00.000Z" }] };
      }

      return { rows: [] };
    });
    const app = await createIntegrationApp({
      databaseService: {
        query,
        withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) => work({ query }),
      },
    });

    const allowed = await request(app.getHttpServer())
      .post("/api/mobile/checklists/instances")
      .set("x-user-id", "region-user-1")
      .set("x-role-codes", "REGION_MANAGER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({ checklistTemplateId: templateId, storeId });

    expect(allowed.status).toBe(201);

    const forbidden = await request(app.getHttpServer())
      .post("/api/mobile/checklists/instances")
      .set("x-user-id", "region-user-1")
      .set("x-role-codes", "REGION_MANAGER")
      .set("x-store-ids", storeId)
      .set("x-assigned-store-ids", storeId)
      .send({ checklistTemplateId: templateId, storeId: otherStoreId });

    expect(forbidden.status).toBe(403);

    await app.close();
  });
});
```

- [ ] **Step 2: Run e2e and verify RED**

Run:

```powershell
npm.cmd test -- test/integration/mobile-checklist-today.e2e-spec.ts --runInBand
```

Expected: FAIL because `/api/mobile/checklists/instances` does not exist.

- [ ] **Step 3: Add start DTO**

Create `backend/nestjs/src/modules/store-ops/web/dto/start-mobile-checklist-instance.dto.ts`:

```ts
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class StartMobileChecklistInstanceDto {
  @IsPostgresUuid()
  checklistTemplateId!: string;

  @IsPostgresUuid()
  storeId!: string;
}
```

- [ ] **Step 4: Add mobile controller start endpoint**

Create `backend/nestjs/src/modules/store-ops/web/mobile-checklist.controller.ts`:

```ts
import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireActionScope, RequireScope } from "../../auth/decorators/scope.decorator";
import { ChecklistService } from "../application/checklist.service";
import { StartMobileChecklistInstanceDto } from "./dto/start-mobile-checklist-instance.dto";

@Controller("mobile/checklists")
export class MobileChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Get("today")
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER", "STORE_MANAGER", "SUPER_ADMIN")
  async getToday(@Req() request: { user: { userId: string; scope: { storeIds: string[] }; actionScope: { assignedStoreIds: string[] } } }) {
    return this.checklistService.getMobileChecklistToday({
      actorUserId: request.user.userId,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
    });
  }

  @Post("instances")
  @RequireScope("store")
  @RequireActionScope("store")
  @RequireRoles("REGION_MANAGER", "SUPER_ADMIN")
  async startInstance(
    @Req() request: { user: { userId: string; actionScope: { assignedStoreIds: string[] } } },
    @Body() body: StartMobileChecklistInstanceDto,
  ) {
    return this.checklistService.startMobileChecklistInstance({
      checklistTemplateId: body.checklistTemplateId,
      storeId: body.storeId,
      actorUserId: request.user.userId,
      actorActionScope: request.user.actionScope,
    });
  }
}
```

Register the controller in `StoreOpsModule`.

- [ ] **Step 5: Add service start method**

Add to `ChecklistService`:

```ts
async startMobileChecklistInstance(input: {
  checklistTemplateId: string;
  storeId: string;
  actorUserId: string;
  actorActionScope?: { assignedStoreIds: string[] };
}) {
  this.assertCanActOnStore(
    input.actorActionScope,
    input.storeId,
    "Requested store is outside assigned action stores",
  );

  return buildCommandResponse({
    status: "created",
    message: "Checklist visit started",
    data: {
      checklistInstance: await this.checklistRepository.startMobileChecklistInstance(input),
    },
  });
}
```

- [ ] **Step 6: Add repository start method**

Add to `ChecklistRepository`:

```ts
async startMobileChecklistInstance(input: {
  checklistTemplateId: string;
  storeId: string;
  actorUserId: string;
}) {
  const result = await this.databaseService.query<{
    checklist_instance_id: string;
    status: string;
    created_at: string;
  }>(
    `
      INSERT INTO ops.checklist_instance (
        checklist_template_id,
        store_id,
        started_by_user_id,
        started_at,
        status
      )
      VALUES ($1::uuid, $2::uuid, $3, NOW(), 'planned')
      RETURNING checklist_instance_id, status, created_at
    `,
    [input.checklistTemplateId, input.storeId, input.actorUserId],
  );

  return result.rows[0];
}
```

- [ ] **Step 7: Verify assigned-store start**

Run:

```powershell
npm.cmd test -- test/integration/mobile-checklist-today.e2e-spec.ts --runInBand
```

Expected: PASS for the assigned-store start test.

## Task 5: Response Save, In-Progress Status, Completion, And Locking

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/web/mobile-checklist.controller.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/dto/save-mobile-checklist-response.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/checklist.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.ts`
- Extend: `backend/nestjs/test/integration/mobile-checklist-today.e2e-spec.ts`

- [ ] **Step 1: Add e2e tests for save/complete/lock**

Append to `mobile-checklist-today.e2e-spec.ts`:

```ts
it("saves responses, completes with weighted score, and locks completed instances", async () => {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes("SELECT checklist_instance_id, store_id, status")) {
      return { rows: [{ checklist_instance_id: "instance-1", store_id: storeId, status: "in_progress" }] };
    }

    if (sql.includes("INSERT INTO ops.checklist_response")) {
      return { rows: [{ response_id: "response-1", responded_at: "2026-04-28T10:05:00.000Z" }] };
    }

    if (sql.includes("UPDATE ops.checklist_instance") && sql.includes("status = 'in_progress'")) {
      return { rows: [{ checklist_instance_id: "instance-1", status: "in_progress" }] };
    }

    if (sql.includes("SUM((cr.score_value / cti.max_score) * cti.weight)")) {
      return { rows: [{ total_score: "86.00", compliance_rate: "1.0000", missing_mandatory_count: "0" }] };
    }

    if (sql.includes("locked_at = NOW()")) {
      return { rows: [{ checklist_instance_id: "instance-1", status: "completed", total_score: "86.00", compliance_rate: "1.0000" }] };
    }

    return { rows: [] };
  });
  const app = await createIntegrationApp({
    databaseService: {
      query,
      withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) => work({ query }),
    },
  });

  const save = await request(app.getHttpServer())
    .patch("/api/mobile/checklists/instances/33333333-3333-4333-8333-333333333333/responses")
    .set("x-user-id", "region-user-1")
    .set("x-role-codes", "REGION_MANAGER")
    .set("x-store-ids", storeId)
    .set("x-assigned-store-ids", storeId)
    .send({ templateItemId: "55555555-5555-4555-8555-555555555555", scoreValue: 8, commentText: "Good" });

  expect(save.status).toBe(200);

  const complete = await request(app.getHttpServer())
    .post("/api/mobile/checklists/instances/33333333-3333-4333-8333-333333333333/complete")
    .set("x-user-id", "region-user-1")
    .set("x-role-codes", "REGION_MANAGER")
    .set("x-store-ids", storeId)
    .set("x-assigned-store-ids", storeId)
    .send({});

  expect(complete.status).toBe(201);
  expect(complete.body.data.checklistInstance.total_score).toBe("86.00");

  await app.close();
});
```

- [ ] **Step 2: Run e2e and verify RED**

Run:

```powershell
npm.cmd test -- test/integration/mobile-checklist-today.e2e-spec.ts --runInBand
```

Expected: FAIL because save/complete mobile endpoints do not exist.

- [ ] **Step 3: Add response DTO**

Create `backend/nestjs/src/modules/store-ops/web/dto/save-mobile-checklist-response.dto.ts`:

```ts
import { IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class SaveMobileChecklistResponseDto {
  @IsPostgresUuid()
  templateItemId!: string;

  @IsNumber()
  @Min(0)
  @Max(10)
  scoreValue!: number;

  @IsOptional()
  @IsString()
  commentText?: string;
}
```

- [ ] **Step 4: Add controller endpoints**

Add to `MobileChecklistController`:

```ts
@Patch("instances/:checklistInstanceId/responses")
@RequireScope("authenticated")
@RequireActionScope("store")
@RequireRoles("REGION_MANAGER", "SUPER_ADMIN")
async saveResponse(
  @Req() request: { user: { userId: string; actionScope: { assignedStoreIds: string[] } }; params: { checklistInstanceId: string } },
  @Body() body: SaveMobileChecklistResponseDto,
) {
  return this.checklistService.saveMobileChecklistResponse({
    checklistInstanceId: request.params.checklistInstanceId,
    templateItemId: body.templateItemId,
    scoreValue: body.scoreValue,
    commentText: body.commentText,
    actorUserId: request.user.userId,
    actorActionScope: request.user.actionScope,
  });
}

@Post("instances/:checklistInstanceId/complete")
@RequireScope("authenticated")
@RequireActionScope("store")
@RequireRoles("REGION_MANAGER", "SUPER_ADMIN")
async completeInstance(
  @Req() request: { user: { userId: string; actionScope: { assignedStoreIds: string[] } }; params: { checklistInstanceId: string } },
) {
  return this.checklistService.completeMobileChecklistInstance({
    checklistInstanceId: request.params.checklistInstanceId,
    actorUserId: request.user.userId,
    actorActionScope: request.user.actionScope,
  });
}
```

- [ ] **Step 5: Implement service guards**

Add service methods that:

- load instance scope/status
- reject if status is `completed`
- reject if store is outside action scope
- save response and move `planned` to `in_progress`
- validate missing mandatory responses before completion
- calculate weighted score
- set `completed_at`, `completed_by_user_id`, `locked_at`, `status = 'completed'`

Use this status guard:

```ts
private assertNotCompleted(status: string) {
  if (status === "completed") {
    throw new BadRequestException("Completed checklist instances are locked");
  }
}
```

- [ ] **Step 6: Implement repository methods**

Add SQL for completion aggregate:

```sql
SELECT
  COALESCE(SUM((COALESCE(cr.score_value, 0) / NULLIF(cti.max_score, 0)) * cti.weight), 0)::numeric(12,2) AS total_score,
  COALESCE(AVG(CASE WHEN COALESCE(cr.score_value, 0) > 0 THEN 1 ELSE 0 END), 0)::numeric(7,4) AS compliance_rate,
  COUNT(*) FILTER (WHERE cti.is_mandatory = TRUE AND cr.response_id IS NULL)::text AS missing_mandatory_count
FROM ops.checklist_template_item cti
LEFT JOIN ops.checklist_response cr
  ON cr.template_item_id = cti.template_item_id
 AND cr.checklist_instance_id = $1::uuid
INNER JOIN ops.checklist_instance ci
  ON ci.checklist_template_id = cti.checklist_template_id
WHERE ci.checklist_instance_id = $1::uuid
```

Add SQL for lock:

```sql
UPDATE ops.checklist_instance
SET
  completed_by_user_id = $2,
  completed_at = NOW(),
  locked_at = NOW(),
  status = 'completed',
  total_score = $3::numeric,
  compliance_rate = $4::numeric
WHERE checklist_instance_id = $1::uuid
  AND status IN ('planned', 'in_progress')
RETURNING checklist_instance_id, status, total_score, compliance_rate, completed_at, locked_at
```

- [ ] **Step 7: Verify e2e GREEN**

Run:

```powershell
npm.cmd test -- test/integration/mobile-checklist-today.e2e-spec.ts --runInBand
```

Expected: PASS.

## Task 6: Mobile Today Read Model And Monthly Average

**Files:**

- Extend: `backend/nestjs/test/integration/mobile-checklist-today.e2e-spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/checklist.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/checklist.repository.ts`

- [ ] **Step 1: Add e2e for today payload**

Add a test that calls:

```http
GET /api/mobile/checklists/today
```

Expected response shape:

```ts
expect(response.body.data).toEqual({
  stores: expect.any(Array),
  templates: expect.any(Array),
  activeInstances: expect.any(Array),
  completedThisMonth: expect.any(Array),
  pendingAcknowledgements: expect.any(Array),
  monthlySummaries: [
    expect.objectContaining({
      completedCount: 2,
      averageScore: 86,
    }),
  ],
});
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
npm.cmd test -- test/integration/mobile-checklist-today.e2e-spec.ts --runInBand
```

Expected: FAIL until service wraps repository output in `data`.

- [ ] **Step 3: Add service method**

Add:

```ts
async getMobileChecklistToday(input: {
  actorUserId: string;
  actorScope: { storeIds: string[] };
  actorActionScope?: { assignedStoreIds: string[] };
}) {
  return {
    data: await this.checklistRepository.getMobileChecklistToday({
      actorUserId: input.actorUserId,
      assignedStoreIds: input.actorActionScope?.assignedStoreIds ?? [],
      readStoreIds: input.actorScope.storeIds,
    }),
  };
}
```

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
npm.cmd test -- test/integration/mobile-checklist-today.e2e-spec.ts --runInBand
```

Expected: PASS.

## Task 7: Store Manager Mobile Acknowledgement

**Files:**

- Extend: `backend/nestjs/test/integration/mobile-checklist-today.e2e-spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/mobile-checklist.controller.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/checklist.service.ts`

- [ ] **Step 1: Add acknowledgement e2e**

Add a test proving:

- `STORE_MANAGER` with assigned store can acknowledge
- acknowledgement returns `acknowledged`
- acknowledgement does not update score
- unassigned store returns `403`

Use existing `ChecklistAcknowledgementRepository.acknowledgeChecklist` behavior through `ChecklistService.acknowledgeChecklist`.

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
npm.cmd test -- test/integration/mobile-checklist-today.e2e-spec.ts --runInBand
```

Expected: FAIL because mobile acknowledgement endpoint does not exist.

- [ ] **Step 3: Add mobile acknowledge endpoint**

Add to `MobileChecklistController`:

```ts
@Post("instances/:checklistInstanceId/acknowledge")
@RequireScope("authenticated")
@RequireActionScope("store")
@RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
async acknowledge(
  @Req() request: { user: { userId: string; actionScope: { assignedStoreIds: string[] } }; params: { checklistInstanceId: string } },
  @Body() body: AcknowledgeChecklistInstanceDto,
) {
  return this.checklistService.acknowledgeChecklist({
    checklistInstanceId: request.params.checklistInstanceId,
    actorUserId: request.user.userId,
    actorActionScope: request.user.actionScope,
    acknowledgementNote: body.acknowledgementNote,
  });
}
```

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
npm.cmd test -- test/integration/mobile-checklist-today.e2e-spec.ts --runInBand
```

Expected: PASS.

## Task 8: Frontend Pilot Surfaces

**Files:**

- Modify: `admin-web/src/features/checklists/api.ts`
- Create: `admin-web/src/pages/AdminChecklistTemplatesPage.tsx`
- Modify: `admin-web/src/pages/StoreChecklistsPage.tsx`
- Modify: `admin-web/src/App.tsx`
- Create: `admin-web/e2e/checklist-today-surfaces.spec.ts`

- [ ] **Step 1: Add Playwright test first**

Create `admin-web/e2e/checklist-today-surfaces.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('region manager checklist surface shows assigned store visit workflow', async ({ page }) => {
  await page.goto('/store/checklists')
  await expect(page.getByText('Checklist yap')).toBeVisible()
  await expect(page.getByText('Taslak')).toBeVisible()
  await expect(page.getByText('Tamamla')).toBeVisible()
})

test('store manager checklist surface keeps acknowledgement language', async ({ page }) => {
  await page.goto('/store/checklists')
  await expect(page.getByText('Kabul ettim')).toBeVisible()
})
```

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- e2e/checklist-today-surfaces.spec.ts
```

Expected: FAIL because the region-manager visit workflow is not rendered yet.

- [ ] **Step 3: Extend frontend checklist API**

Modify `admin-web/src/features/checklists/api.ts`:

```ts
export async function getMobileChecklistToday() {
  return fetchJson<{ data: MobileChecklistToday }>('/mobile/checklists/today')
}

export async function startMobileChecklistInstance(input: {
  checklistTemplateId: string
  storeId: string
}) {
  return sendJson<CommandResponse<{ checklistInstance: MobileChecklistInstance }>>(
    '/mobile/checklists/instances',
    { method: 'POST', body: input },
  )
}
```

- [ ] **Step 4: Update store checklist page**

Modify `StoreChecklistsPage`:

- if role includes `REGION_MANAGER`, show assigned stores, active templates, active drafts, and completion action
- if role includes `STORE_MANAGER`, keep existing acknowledgement queue
- keep existing acknowledgement labels
- avoid nested cards and keep current dashboard primitive style

- [ ] **Step 5: Add HR admin template route**

Modify `App.tsx`:

```tsx
const AdminChecklistTemplatesPage = lazy(() => import('./pages/AdminChecklistTemplatesPage').then((module) => ({ default: module.AdminChecklistTemplatesPage })))
```

Add admin nav item:

```tsx
{
  to: '/admin/checklists',
  icon: <ClipboardList size={18} />,
  label: 'Checklistler',
  roles: ['SUPER_ADMIN', 'HR_ADMIN'],
}
```

Add route:

```tsx
<Route
  path="/admin/checklists"
  element={guardRoute(shellState, authSummary, ['SUPER_ADMIN', 'HR_ADMIN'], <AdminChecklistTemplatesPage />)}
/>
```

- [ ] **Step 6: Verify frontend**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run build
npm.cmd run test:e2e -- e2e/checklist-today-surfaces.spec.ts
```

Expected: build PASS and new Playwright tests PASS.

## Task 9: Release Verification

**Files:** none beyond previous tasks.

- [ ] **Step 1: Run backend targeted tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/checklist-mobile-workflow-schema-contract.spec.ts src/modules/store-ops/infrastructure/checklist.repository.spec.ts src/modules/store-ops/application/checklist.service.spec.ts test/integration/mobile-checklist-today.e2e-spec.ts --runInBand
```

Expected: all targeted tests PASS.

- [ ] **Step 2: Run backend release gate**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run check:release
```

Expected: lint, tests, build, and audit PASS.

- [ ] **Step 3: Run frontend release gate**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run check:release
```

Expected: lint, script tests, build, e2e, and audit PASS.

- [ ] **Step 4: Run root release gate**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run check:release
```

Expected: root script tests, backend release, frontend release PASS.

## Task 10: Handoff, Debt Ledger, And Commit

**Files:**

- Modify: `current-state.md`
- Modify: `docs/plans/active-next-actions.md`
- Modify: `docs/plans/project-debt-ledger.md`

- [ ] **Step 1: Update current-state**

Add a section:

```md
## Son Mobile Checklist Today V1 Implementation

Mobile Checklist Today V1 implemented:

- HR-owned versioned templates and weight publish guard.
- Region manager assigned-store checklist start/save/resume/complete.
- Weighted score calculation with completed-lock.
- Store manager acknowledgement remains informational.
- Multiple completed visits per store/month average into monthly summary.

Verification:

- backend targeted checklist tests passed
- backend check:release passed
- frontend check:release passed
- root check:release passed

Siradaki mantikli adim: checklist skorunun store KPI/config tarafina hangi agirlikla girecegini ayri karar olarak netlestirmek.
```

- [ ] **Step 2: Update debt ledger**

Increment closed active debts only after implementation and release gates pass.

Add:

```md
Mobile Checklist Today V1 is counted as paid because HR template versioning, region-manager visit scoring, store-manager acknowledgement, monthly multi-visit averaging, and completed-lock behavior are implemented and guarded by backend/frontend/root release checks.
```

- [ ] **Step 3: Commit**

Run:

```powershell
git status --short
git add db/schema.sql db/migrations/037_mobile_checklist_today_v1.sql backend/nestjs/src/modules/store-ops backend/nestjs/test/integration/mobile-checklist-today.e2e-spec.ts admin-web/src admin-web/e2e/checklist-today-surfaces.spec.ts current-state.md docs/plans/active-next-actions.md docs/plans/project-debt-ledger.md
git commit -m "feat: add mobile checklist today workflow"
```

Expected: commit succeeds with only intended files staged.

## Self-Review Notes

- The plan starts backend-first and uses TDD for schema, service, repository, e2e, and frontend smoke.
- The plan keeps completed checklist edits out of V1.
- The plan keeps store-manager acknowledgement informational.
- The plan allows multiple completed visits per store/month and averages them.
- The plan does not introduce push notifications, offline sync, attachments, or VM checklist implementation.
- The plan avoids a second checklist module; template type controls future BM/VM expansion.
