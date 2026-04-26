# Competition Format Registry V1 Implementation Plan

> Status: Superseded on 26 April 2026 by `docs/superpowers/specs/2026-04-26-operational-feed-v1-design.md`.
>
> Do not execute this implementation plan unless the product direction changes back to a dedicated competition format engine. The current direction is Operational Feed V1: challenge posts announce focus areas and link to existing ranking/profile surfaces.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a controlled competition format registry, keep `league_then_final` executable, and add `best_upt_store` as a selectable and previewable format with live execution disabled.

**Architecture:** Keep the V1 registry code-owned and portable to a future database-backed registry. Reuse the existing `ops.competition_stage_package_plan` storage shape and `package_code` column as the format code, but enforce format capabilities in backend service/repository guards and frontend actions. Do not build scoring, publish, notifications, or participant-facing leaderboards in this plan.

**Tech Stack:** PostgreSQL migrations, NestJS, class-validator DTOs, Jest, React 18, TanStack Query, Vite, Playwright.

---

## File Map

- Create: `db/migrations/025_competition_format_registry_package_codes.sql`
- Modify: `db/schema.sql`
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.contract.ts`
- Create: `backend/nestjs/src/modules/store-ops/application/competition-format.registry.ts`
- Create: `backend/nestjs/src/modules/store-ops/application/competition-format.registry.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/dto/create-competition-stage-package.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/dto/create-competition-stage-package-plan.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/dto/update-competition-stage-package-plan.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/competition.controller.ts`
- Modify: `admin-web/src/features/competitions/api.ts`
- Modify: `admin-web/src/features/competitions/stage-packages.ts`
- Modify: `admin-web/src/features/competitions/StageBuilderForm.tsx`
- Modify: `admin-web/e2e/competition-surfaces.spec.ts`
- Modify: `docs/plans/active-next-actions.md`
- Modify: `current-state.md`

## Key Decisions

- Use `packageCode` as the V1 format code. Do not rename database columns or API fields in this pass.
- `league_then_final` remains executable.
- `best_upt_store` is selectable, saveable, previewable, submittable, and approvable as a planning artifact, but cannot create stages through direct package creation or approved-plan execution.
- `best_upt_store` uses one selected team template as the participant source. The template stores are the future store participants.
- `best_upt_store` stores one draft stage in `stage_drafts_json` with one team/template carrying the selected stores. This keeps V1 schema-free while preserving enough metadata for preview.
- Backend enforcement is mandatory. Frontend disabling is only UX.

## Task 1: Registry Contract And Database Allowlist

**Files:**
- Create: `backend/nestjs/src/modules/store-ops/application/competition-format.registry.ts`
- Create: `backend/nestjs/src/modules/store-ops/application/competition-format.registry.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.contract.ts`
- Create: `db/migrations/025_competition_format_registry_package_codes.sql`
- Modify: `db/schema.sql`

- [ ] **Step 1: Write the failing registry test**

Create `backend/nestjs/src/modules/store-ops/application/competition-format.registry.spec.ts`:

```ts
import {
  getCompetitionFormat,
  listCompetitionFormats,
} from "./competition-format.registry";

describe("competition format registry", () => {
  it("exposes executable league then final and preview-only best UPT store formats", () => {
    const formats = listCompetitionFormats();

    expect(formats.map((format) => format.formatCode)).toEqual([
      "league_then_final",
      "best_upt_store",
    ]);

    expect(getCompetitionFormat("league_then_final")).toEqual(
      expect.objectContaining({
        formatCode: "league_then_final",
        formatName: "League then final",
        executeAllowed: true,
        participantType: "team",
        metricMode: "total_score",
      }),
    );

    expect(getCompetitionFormat("best_upt_store")).toEqual(
      expect.objectContaining({
        formatCode: "best_upt_store",
        formatName: "Best UPT Store",
        executeAllowed: false,
        executeDisabledReason:
          "This format can be planned and previewed, but live execution is not enabled yet.",
        participantType: "store",
        metricMode: "single",
        rankingDirection: "higher_is_better",
      }),
    );
  });

  it("returns null for unknown format codes", () => {
    expect(getCompetitionFormat("unknown_format")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the registry test and verify it fails**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/competition-format.registry.spec.ts --runInBand
```

Expected: FAIL because `competition-format.registry.ts` does not exist.

- [ ] **Step 3: Extend backend contract types**

In `backend/nestjs/src/modules/store-ops/application/competition.contract.ts`, change:

```ts
export type CompetitionStagePackageCode = "league_then_final";
```

to:

```ts
export type CompetitionStagePackageCode = "league_then_final" | "best_upt_store";
```

Add these types near the package code type:

```ts
export type CompetitionParticipantType = "store" | "employee" | "region" | "team";

export type CompetitionMetricMode = "single" | "composite" | "total_score";

export type CompetitionRankingDirection =
  | "higher_is_better"
  | "lower_is_better"
  | "closest_to_target";

export type CompetitionFormatDefinition = {
  formatCode: CompetitionStagePackageCode;
  formatName: string;
  description: string;
  participantType: CompetitionParticipantType;
  metricMode: CompetitionMetricMode;
  metrics: Array<{
    metricCode: string;
    metricName: string;
  }>;
  periodMode: "competition_window" | "stage_dates";
  participantSource: {
    sourceType: "team_template";
    minTemplateCount: number;
    maxTemplateCount: number;
  };
  rankingDirection: CompetitionRankingDirection;
  stageBlueprints: Array<{
    stagePresetCode?: CompetitionStagePresetCode;
    stageCode: string;
    stageName: string;
    stageOrder: number;
    stageType: CreateCompetitionStageInput["stageType"];
    dateRange: "full" | "first_half" | "second_half";
  }>;
  minStageCount: number;
  executeAllowed: boolean;
  executeDisabledReason: string | null;
  previewFields: string[];
  announcementDefaults: {
    title: string;
    body: string;
  };
};
```

- [ ] **Step 4: Add the registry file**

Create `backend/nestjs/src/modules/store-ops/application/competition-format.registry.ts`:

```ts
import type {
  CompetitionFormatDefinition,
  CompetitionStagePackageCode,
} from "./competition.contract";

const competitionFormats: CompetitionFormatDefinition[] = [
  {
    formatCode: "league_then_final",
    formatName: "League then final",
    description: "Creates a league stage followed by a final stage from two team templates.",
    participantType: "team",
    metricMode: "total_score",
    metrics: [{ metricCode: "total_score", metricName: "Total score" }],
    periodMode: "stage_dates",
    participantSource: {
      sourceType: "team_template",
      minTemplateCount: 2,
      maxTemplateCount: 2,
    },
    rankingDirection: "higher_is_better",
    stageBlueprints: [
      {
        stagePresetCode: "region_league",
        stageCode: "REGION_LEAGUE",
        stageName: "Regional League",
        stageOrder: 1,
        stageType: "league",
        dateRange: "full",
      },
      {
        stagePresetCode: "final_showdown",
        stageCode: "FINAL_SHOWDOWN",
        stageName: "Final Showdown",
        stageOrder: 2,
        stageType: "final",
        dateRange: "second_half",
      },
    ],
    minStageCount: 2,
    executeAllowed: true,
    executeDisabledReason: null,
    previewFields: ["date_range", "stage_count", "team_template_count", "store_assignment_count"],
    announcementDefaults: {
      title: "League then final competition",
      body: "A league and final stage package is ready for review.",
    },
  },
  {
    formatCode: "best_upt_store",
    formatName: "Best UPT Store",
    description: "Plans a store-level UPT ranking challenge for the full competition window.",
    participantType: "store",
    metricMode: "single",
    metrics: [{ metricCode: "upt", metricName: "UPT" }],
    periodMode: "competition_window",
    participantSource: {
      sourceType: "team_template",
      minTemplateCount: 1,
      maxTemplateCount: 1,
    },
    rankingDirection: "higher_is_better",
    stageBlueprints: [
      {
        stageCode: "BEST_UPT_STORE",
        stageName: "Best UPT Store Ranking",
        stageOrder: 1,
        stageType: "custom",
        dateRange: "full",
      },
    ],
    minStageCount: 1,
    executeAllowed: false,
    executeDisabledReason:
      "This format can be planned and previewed, but live execution is not enabled yet.",
    previewFields: [
      "format_name",
      "metric",
      "date_range",
      "participant_count",
      "ranking_direction",
      "execution_status",
    ],
    announcementDefaults: {
      title: "Best UPT Store challenge",
      body: "A preview-only UPT store challenge has been prepared.",
    },
  },
];

export function listCompetitionFormats() {
  return competitionFormats;
}

export function getCompetitionFormat(formatCode: string) {
  return (
    competitionFormats.find(
      (format) => format.formatCode === (formatCode as CompetitionStagePackageCode),
    ) ?? null
  );
}
```

- [ ] **Step 5: Update the database package code check**

Create `db/migrations/025_competition_format_registry_package_codes.sql`:

```sql
DO $$
DECLARE
    existing_constraint_name TEXT;
BEGIN
    SELECT constraint.conname
    INTO existing_constraint_name
    FROM pg_constraint constraint
    WHERE constraint.conrelid = 'ops.competition_stage_package_plan'::regclass
      AND constraint.contype = 'c'
      AND pg_get_constraintdef(constraint.oid) LIKE '%package_code%'
    LIMIT 1;

    IF existing_constraint_name IS NOT NULL THEN
        EXECUTE format(
            'ALTER TABLE ops.competition_stage_package_plan DROP CONSTRAINT %I',
            existing_constraint_name
        );
    END IF;
END $$;

ALTER TABLE ops.competition_stage_package_plan
    ADD CONSTRAINT competition_stage_package_plan_package_code_check
    CHECK (package_code IN ('league_then_final', 'best_upt_store'));
```

In `db/schema.sql`, update the existing package code check to:

```sql
CHECK (package_code IN ('league_then_final', 'best_upt_store')),
```

- [ ] **Step 6: Run the registry test and verify it passes**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/competition-format.registry.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```powershell
git add -- db/migrations/025_competition_format_registry_package_codes.sql db/schema.sql backend/nestjs/src/modules/store-ops/application/competition.contract.ts backend/nestjs/src/modules/store-ops/application/competition-format.registry.ts backend/nestjs/src/modules/store-ops/application/competition-format.registry.spec.ts
git commit -m "feat: add competition format registry"
```

## Task 2: Backend Service, DTO, And Controller Surface

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/dto/create-competition-stage-package.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/dto/create-competition-stage-package-plan.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/dto/update-competition-stage-package-plan.dto.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/competition.controller.ts`

- [ ] **Step 1: Write failing service tests**

In `backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts`, add:

```ts
const validBestUptStoreStages = [
  {
    stageCode: "BEST_UPT_STORE",
    stageName: "Best UPT Store Ranking",
    stageOrder: 1,
    stageType: "custom" as const,
    startsOn: "2026-05-01",
    endsOn: "2026-05-31",
    teams: [
      {
        teamCode: "MARMARA_STORES",
        teamName: "Marmara Stores",
        sourceTemplateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        storeIds: [
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        ],
      },
    ],
  },
];
```

Add tests inside `describe("CompetitionService", ...)`:

```ts
it("lists competition format registry definitions", async () => {
  const repo = repository();
  const service = new CompetitionService(repo as never);

  const result = await service.listCompetitionFormats();

  expect(result.items).toEqual([
    expect.objectContaining({ formatCode: "league_then_final", executeAllowed: true }),
    expect.objectContaining({ formatCode: "best_upt_store", executeAllowed: false }),
  ]);
  expect(result.meta.total).toBe(2);
});

it("saves a preview-only best UPT store plan with one stage and one template", async () => {
  const repo = repository();
  repo.createStagePackagePlan.mockResolvedValue({
    planId: "55555555-5555-4555-8555-555555555555",
    competitionId: "99999999-9999-4999-8999-999999999999",
    packageCode: "best_upt_store",
    planName: "May Best UPT Store",
    planStatus: "draft",
    sourcePlan: null,
    stageDrafts: validBestUptStoreStages,
    createdStageIds: [],
    submittedByUserId: null,
    submittedAt: null,
    reviewedByUserId: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    executedAt: null,
  });
  const service = new CompetitionService(repo as never);

  const result = await service.createStagePackagePlan({
    actorUserId: "11111111-1111-4111-8111-111111111111",
    competitionId: "99999999-9999-4999-8999-999999999999",
    packageCode: "best_upt_store",
    planName: "May Best UPT Store",
    stages: validBestUptStoreStages,
  });

  expect(result.command.status).toBe("created");
  expect(result.data.plan.packageCode).toBe("best_upt_store");
  expect(repo.createStagePackagePlan).toHaveBeenCalledWith(
    expect.objectContaining({
      packageCode: "best_upt_store",
      stages: validBestUptStoreStages,
    }),
  );
});

it("rejects direct stage package creation for preview-only formats", async () => {
  const repo = repository();
  const service = new CompetitionService(repo as never);

  await expect(
    service.createStagePackage({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      competitionId: "99999999-9999-4999-8999-999999999999",
      packageCode: "best_upt_store",
      stages: validBestUptStoreStages,
    }),
  ).rejects.toThrow("This format can be planned and previewed, but live execution is not enabled yet.");

  expect(repo.createStagePackage).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the service tests and verify they fail**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts --runInBand
```

Expected: FAIL because `listCompetitionFormats` and format-aware validation are not implemented.

- [ ] **Step 3: Add service format listing and format-aware validation**

In `competition.service.ts`, import the registry:

```ts
import {
  getCompetitionFormat,
  listCompetitionFormats,
} from "./competition-format.registry";
```

Add this service method near other list methods:

```ts
  async listCompetitionFormats() {
    const items = listCompetitionFormats();

    return buildListResponse(items, {
      total: items.length,
      limit: items.length,
      offset: 0,
    });
  }
```

Change `createStagePackage` to block preview-only direct creation:

```ts
  async createStagePackage(input: CreateCompetitionStagePackageInput) {
    const format = assertKnownStagePackageFormat(input.packageCode);
    assertValidStagePackageDraft(input, format);

    if (!format.executeAllowed) {
      throw new BadRequestException(format.executeDisabledReason);
    }

    const stages = await this.competitionRepository.createStagePackage(input);
```

Change `createStagePackagePlan` and `updateStagePackagePlan` to pass the format into validation:

```ts
  async createStagePackagePlan(input: CreateCompetitionStagePackagePlanInput) {
    const format = assertKnownStagePackageFormat(input.packageCode);
    assertValidStagePackageDraft(input, format);
```

```ts
  async updateStagePackagePlan(input: UpdateCompetitionStagePackagePlanInput) {
    const format = assertKnownStagePackageFormat(input.packageCode);
    assertValidStagePackageDraft(input, format);
```

Replace the existing `assertValidStagePackageDraft` signature and body:

```ts
function assertKnownStagePackageFormat(packageCode: string) {
  const format = getCompetitionFormat(packageCode);

  if (!format) {
    throw new BadRequestException("Unknown competition format");
  }

  return format;
}

function assertValidStagePackageDraft(
  input: Pick<CreateCompetitionStagePackageInput, "stages">,
  format: ReturnType<typeof assertKnownStagePackageFormat>,
) {
  if (input.stages.length < format.minStageCount) {
    throw new BadRequestException(
      `Stage package must include at least ${format.minStageCount} stage${format.minStageCount === 1 ? "" : "s"}`,
    );
  }

  const stageCodes = input.stages.map((stage) => stage.stageCode);
  const uniqueStageCodes = new Set(stageCodes);

  if (uniqueStageCodes.size !== stageCodes.length) {
    throw new BadRequestException("Stage package must not include duplicate stage codes");
  }

  for (const stage of input.stages) {
    assertValidStageDraft(stage);

    if (stage.teams.length < format.participantSource.minTemplateCount) {
      throw new BadRequestException(
        `Stage package stage must include at least ${format.participantSource.minTemplateCount} team template${format.participantSource.minTemplateCount === 1 ? "" : "s"}`,
      );
    }

    if (stage.teams.length > format.participantSource.maxTemplateCount) {
      throw new BadRequestException(
        `Stage package stage must include at most ${format.participantSource.maxTemplateCount} team template${format.participantSource.maxTemplateCount === 1 ? "" : "s"}`,
      );
    }
  }
}
```

- [ ] **Step 4: Relax DTO constraints for registry formats**

In all create/update stage package DTOs:

- Change package code allowlist from `["league_then_final"]` to `["league_then_final", "best_upt_store"]`.
- Change stage array minimum from `@ArrayMinSize(2)` to `@ArrayMinSize(1)`.
- Change stage team array minimum from `@ArrayMinSize(2)` to `@ArrayMinSize(1)`.

In `create-competition-stage-package-plan.dto.ts`, the final class field should be:

```ts
  @IsIn(["league_then_final", "best_upt_store"])
  packageCode!: "league_then_final" | "best_upt_store";
```

- [ ] **Step 5: Add controller route for registry metadata**

In `competition.controller.ts`, add above `@Post(":competitionId/stage-packages")`:

```ts
  @Get("stage-package-formats")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async listStagePackageFormats() {
    return this.competitionService.listCompetitionFormats();
  }
```

- [ ] **Step 6: Run targeted backend service tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/competition-format.registry.spec.ts src/modules/store-ops/application/competition.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```powershell
git add -- backend/nestjs/src/modules/store-ops/application/competition.service.ts backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts backend/nestjs/src/modules/store-ops/web/dto/create-competition-stage-package.dto.ts backend/nestjs/src/modules/store-ops/web/dto/create-competition-stage-package-plan.dto.ts backend/nestjs/src/modules/store-ops/web/dto/update-competition-stage-package-plan.dto.ts backend/nestjs/src/modules/store-ops/web/competition.controller.ts
git commit -m "feat: expose competition format planning options"
```

## Task 3: Repository Execute Guard

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts`

- [ ] **Step 1: Write the failing repository test**

In `competition.repository.spec.ts`, add a test near existing `executeStagePackagePlan` tests:

```ts
it("rejects executing a preview-only stage package plan before creating stages", async () => {
  const { repository, client, executedSql } = createRepositoryHarness();

  client.query.mockImplementation(async (sql: string) => {
    executedSql.push(sql);

    if (
      sql.includes("FROM ops.competition_stage_package_plan") &&
      sql.includes("FOR UPDATE")
    ) {
      return {
        rowCount: 1,
        rows: [
          {
            competition_stage_package_plan_id:
              "55555555-5555-4555-8555-555555555555",
            competition_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            package_code: "best_upt_store",
            plan_name: "May Best UPT Store",
            plan_status: "approved",
            stage_drafts_json: [
              {
                stageCode: "BEST_UPT_STORE",
                stageName: "Best UPT Store Ranking",
                stageOrder: 1,
                stageType: "custom",
                startsOn: "2026-05-01",
                endsOn: "2026-05-31",
                teams: [
                  {
                    teamCode: "MARMARA_STORES",
                    teamName: "Marmara Stores",
                    sourceTemplateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                    storeIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
                  },
                ],
              },
            ],
            created_stage_ids: [],
            created_at: "2026-05-01T10:00:00.000Z",
            updated_at: "2026-05-01T10:00:00.000Z",
            executed_at: null,
          },
        ],
      };
    }

    return { rowCount: 1, rows: [] };
  });

  await expect(
    repository.executeStagePackagePlan({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      planId: "55555555-5555-4555-8555-555555555555",
    }),
  ).rejects.toThrow("This format can be planned and previewed, but live execution is not enabled yet.");

  const sql = executedSql.join("\n");
  expect(sql).toContain("FOR UPDATE");
  expect(sql).not.toContain("INSERT INTO ops.competition_stage");
  expect(sql).not.toContain("plan_status = 'executed'");
});
```

- [ ] **Step 2: Run the repository test and verify it fails**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand -t "preview-only"
```

Expected: FAIL because execution is only status-gated.

- [ ] **Step 3: Add registry guard to repository execution**

In `competition.repository.ts`, import:

```ts
import { getCompetitionFormat } from "../application/competition-format.registry";
```

Inside `executeStagePackagePlan`, after the plan row status guard and before creating stages, add:

```ts
      const format = getCompetitionFormat(planRow.package_code);

      if (!format) {
        throw new BadRequestException("Unknown competition format");
      }

      if (!format.executeAllowed) {
        throw new BadRequestException(format.executeDisabledReason);
      }
```

- [ ] **Step 4: Run repository tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```powershell
git add -- backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts
git commit -m "feat: guard preview-only competition execution"
```

## Task 4: Frontend Format Selector, Payload Builder, And Preview

**Files:**
- Modify: `admin-web/src/features/competitions/api.ts`
- Modify: `admin-web/src/features/competitions/stage-packages.ts`
- Modify: `admin-web/src/features/competitions/StageBuilderForm.tsx`

- [ ] **Step 1: Write the failing Playwright test**

In `admin-web/e2e/competition-surfaces.spec.ts`, add this test before the reject-plan test:

```ts
test('admin can save a preview-only best UPT store format plan', async ({ page }) => {
  let savedStagePackagePlanPayload: unknown = null
  await page.unroute('**/api/competitions**')
  await routeCompetitionApi(page, authSessionFixture, competitionDetailFixture, {
    initialTeamTemplates: [activeTemplateFixture, secondActiveTemplateFixture],
    onCreateStagePackagePlan: (payload) => {
      savedStagePackagePlanPayload = payload
    },
  })

  await page.goto('/admin/competitions')

  await page.getByLabel('Stage package').selectOption('best_upt_store')
  await expect(page.getByText('Metric: UPT')).toBeVisible()
  await expect(page.getByText('Highest UPT wins')).toBeVisible()
  await expect(page.getByText('Preview-only in V1')).toBeVisible()
  await page.getByLabel('Package plan name').fill('May Best UPT Store')
  await page.getByLabel('Participant template').selectOption(templateId)
  await expect(page.getByLabel('Package stage 1 code')).toHaveValue('BEST_UPT_STORE')
  await expect(page.getByLabel('Package stage 1 name')).toHaveValue('Best UPT Store Ranking')
  await expect(page.getByLabel('Package stage 1 starts')).toHaveValue('2026-04-22')
  await expect(page.getByLabel('Package stage 1 ends')).toHaveValue('2026-04-24')
  await expect(page.getByRole('button', { name: 'Create stage package' })).toBeDisabled()
  await page.getByRole('button', { name: 'Save package plan' }).click()

  await expect(page.getByText('Competition stage package plan saved')).toBeVisible()
  expect(savedStagePackagePlanPayload).toMatchObject({
    planName: 'May Best UPT Store',
    packageCode: 'best_upt_store',
    stages: [
      {
        stageCode: 'BEST_UPT_STORE',
        stageName: 'Best UPT Store Ranking',
        stageOrder: 1,
        stageType: 'custom',
        startsOn: '2026-04-22',
        endsOn: '2026-04-24',
        teams: [
          {
            sourceTemplateId: templateId,
            teamCode: 'MARMARA_TEMPLATE_A',
            teamName: 'Marmara Template A',
            storeIds: [storeId],
          },
        ],
      },
    ],
  })
})
```

- [ ] **Step 2: Add mocked format registry response to the Playwright route**

Inside `routeCompetitionApi`, before the competition list route, add:

```ts
    if (request.method() === 'GET' && pathname.endsWith('/api/competitions/stage-package-formats')) {
      await route.fulfill({
        json: {
          items: competitionFormatFixtures,
          meta: { count: competitionFormatFixtures.length, total: competitionFormatFixtures.length, limit: 2, offset: 0 },
        },
      })
      return
    }
```

Add this fixture near the other fixtures:

```ts
const competitionFormatFixtures = [
  {
    formatCode: 'league_then_final',
    formatName: 'League then final',
    description: 'Creates a league stage followed by a final stage from two team templates.',
    participantType: 'team',
    metricMode: 'total_score',
    metrics: [{ metricCode: 'total_score', metricName: 'Total score' }],
    periodMode: 'stage_dates',
    participantSource: { sourceType: 'team_template', minTemplateCount: 2, maxTemplateCount: 2 },
    rankingDirection: 'higher_is_better',
    stageBlueprints: [
      {
        stagePresetCode: 'region_league',
        stageCode: 'REGION_LEAGUE',
        stageName: 'Regional League',
        stageOrder: 1,
        stageType: 'league',
        dateRange: 'full',
      },
      {
        stagePresetCode: 'final_showdown',
        stageCode: 'FINAL_SHOWDOWN',
        stageName: 'Final Showdown',
        stageOrder: 2,
        stageType: 'final',
        dateRange: 'second_half',
      },
    ],
    minStageCount: 2,
    executeAllowed: true,
    executeDisabledReason: null,
    previewFields: ['date_range', 'stage_count', 'team_template_count', 'store_assignment_count'],
    announcementDefaults: { title: 'League then final competition', body: 'A league and final stage package is ready for review.' },
  },
  {
    formatCode: 'best_upt_store',
    formatName: 'Best UPT Store',
    description: 'Plans a store-level UPT ranking challenge for the full competition window.',
    participantType: 'store',
    metricMode: 'single',
    metrics: [{ metricCode: 'upt', metricName: 'UPT' }],
    periodMode: 'competition_window',
    participantSource: { sourceType: 'team_template', minTemplateCount: 1, maxTemplateCount: 1 },
    rankingDirection: 'higher_is_better',
    stageBlueprints: [
      {
        stageCode: 'BEST_UPT_STORE',
        stageName: 'Best UPT Store Ranking',
        stageOrder: 1,
        stageType: 'custom',
        dateRange: 'full',
      },
    ],
    minStageCount: 1,
    executeAllowed: false,
    executeDisabledReason: 'This format can be planned and previewed, but live execution is not enabled yet.',
    previewFields: ['format_name', 'metric', 'date_range', 'participant_count', 'ranking_direction', 'execution_status'],
    announcementDefaults: { title: 'Best UPT Store challenge', body: 'A preview-only UPT store challenge has been prepared.' },
  },
]
```

- [ ] **Step 3: Run the Playwright test and verify it fails**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- e2e/competition-surfaces.spec.ts -g "preview-only best UPT"
```

Expected: FAIL because the UI does not load registry formats or support one-template preview-only package drafts.

- [ ] **Step 4: Add frontend API types and fetcher**

In `admin-web/src/features/competitions/api.ts`, change:

```ts
export type CompetitionStagePackageCode = 'league_then_final'
```

to:

```ts
export type CompetitionStagePackageCode = 'league_then_final' | 'best_upt_store'
```

Add:

```ts
export type CompetitionFormatDefinition = {
  formatCode: CompetitionStagePackageCode
  formatName: string
  description: string
  participantType: 'store' | 'employee' | 'region' | 'team'
  metricMode: 'single' | 'composite' | 'total_score'
  metrics: Array<{ metricCode: string; metricName: string }>
  periodMode: 'competition_window' | 'stage_dates'
  participantSource: {
    sourceType: 'team_template'
    minTemplateCount: number
    maxTemplateCount: number
  }
  rankingDirection: 'higher_is_better' | 'lower_is_better' | 'closest_to_target'
  stageBlueprints: Array<{
    stagePresetCode?: StagePresetCode
    stageCode: string
    stageName: string
    stageOrder: number
    stageType: CompetitionStageSummary['stageType']
    dateRange: 'full' | 'first_half' | 'second_half'
  }>
  minStageCount: number
  executeAllowed: boolean
  executeDisabledReason: string | null
  previewFields: string[]
  announcementDefaults: {
    title: string
    body: string
  }
}
```

Add:

```ts
export async function listCompetitionStagePackageFormats() {
  return fetchJson<ListResponse<CompetitionFormatDefinition>>('/competitions/stage-package-formats')
}
```

- [ ] **Step 5: Update stage package helpers**

In `stage-packages.ts`:

- Import `CompetitionFormatDefinition`.
- Replace static `stagePackageOptions` as the source of truth for package drafts with registry format definitions.
- Keep a local fallback array only for first render before the query resolves.
- Change `StagePackageStageDraft.stagePresetCode` to optional because `best_upt_store` has no stage preset.
- Add `createStagePackageStageDraftsFromFormat`.
- Add `buildStagePackagePayload` support for variable template count.

Add this helper:

```ts
export function createStagePackageStageDraftsFromFormat(input: {
  competitionStartsOn: string
  competitionEndsOn: string
  format: CompetitionFormatDefinition
}): StagePackageStageDraft[] {
  return input.format.stageBlueprints.map((blueprint) => {
    if (blueprint.stagePresetCode) {
      const presetDraft = buildStagePresetDraft({
        competitionStartsOn: input.competitionStartsOn,
        competitionEndsOn: input.competitionEndsOn,
        presetCode: blueprint.stagePresetCode,
      })

      if (presetDraft) return presetDraft
    }

    return {
      stagePresetCode: blueprint.stagePresetCode,
      stageCode: blueprint.stageCode,
      stageName: blueprint.stageName,
      stageOrder: String(blueprint.stageOrder),
      stageType: blueprint.stageType,
      startsOn: input.competitionStartsOn,
      endsOn: input.competitionEndsOn,
    }
  })
}
```

Update `buildStagePackagePayload` to accept `format` and use the selected template count:

```ts
export function buildStagePackagePayload(input: {
  format: CompetitionFormatDefinition
  packageCode: CompetitionStagePackageCode
  stageDrafts: StagePackageStageDraft[]
  templates: CompetitionTeamTemplate[]
}): CreateCompetitionStagePackagePayload | null {
  if (
    input.stageDrafts.length < input.format.minStageCount ||
    input.templates.length < input.format.participantSource.minTemplateCount ||
    input.templates.length > input.format.participantSource.maxTemplateCount
  ) {
    return null
  }

  const teams = input.templates.map((template) => ({
    sourceTemplateId: template.templateId,
    teamCode: template.templateCode,
    teamName: template.templateName,
    storeIds: template.stores.map((store) => store.storeId),
  }))

  return {
    packageCode: input.packageCode,
    stages: input.stageDrafts.map((stageDraft) => ({
      ...stageDraft,
      stageCode: stageDraft.stageCode.trim(),
      stageName: stageDraft.stageName.trim(),
      stageOrder: Number(stageDraft.stageOrder),
      teams,
    })),
  }
}
```

- [ ] **Step 6: Update `StageBuilderForm` draft state and UI**

In `StageBuilderForm.tsx`:

- Import `listCompetitionStagePackageFormats` and `CompetitionFormatDefinition`.
- Add a query:

```ts
  const stagePackageFormatsQuery = useQuery({
    queryKey: ['competition-stage-package-formats'],
    queryFn: listCompetitionStagePackageFormats,
    staleTime: 60_000,
  })
```

- Replace `firstTemplateId` and `secondTemplateId` with:

```ts
type StagePackageDraft = {
  packageCode: CompetitionStagePackageCode
  planName: string
  templateIds: string[]
  stageDrafts: StagePackageStageDraft[]
}
```

- Add helpers:

```ts
function getSelectedFormat(
  formats: CompetitionFormatDefinition[],
  packageCode: CompetitionStagePackageCode,
) {
  return formats.find((format) => format.formatCode === packageCode) ?? formats[0]
}

function createEmptyTemplateIds(format: CompetitionFormatDefinition) {
  return Array.from({ length: format.participantSource.minTemplateCount }, () => '')
}
```

- When `packageCode` changes, reset `templateIds` and stage drafts from the selected format.
- Render template selectors from `draft.templateIds`.
- Use label `Participant template` when the selected format requires one template; keep `Package team 1 template` and `Package team 2 template` for two-template formats.
- Render a compact preview panel for the selected format:

```tsx
<div className="key-grid">
  <div className="key-item">
    <span>Format</span>
    <strong>{selectedFormat.formatName}</strong>
  </div>
  <div className="key-item">
    <span>Metric</span>
    <strong>{selectedFormat.metrics.map((metric) => metric.metricName).join(', ')}</strong>
  </div>
  <div className="key-item">
    <span>Ranking</span>
    <strong>{selectedFormat.rankingDirection === 'higher_is_better' ? 'Highest UPT wins' : formatState(selectedFormat.rankingDirection)}</strong>
  </div>
</div>
{selectedFormat.executeAllowed ? null : (
  <p className="validation-copy">Preview-only in V1. {selectedFormat.executeDisabledReason}</p>
)}
```

- Disable direct `Create stage package` when `!selectedFormat.executeAllowed`.
- Keep `Save package plan` enabled when the format-specific validation passes.
- In approved plan rows, replace the execute button with the disabled preview-only status when the plan format is not executable:

```tsx
{plan.planStatus === 'approved' && selectedPlanFormat?.executeAllowed ? (
  <button ...>Execute approved plan {plan.planName}</button>
) : null}
{plan.planStatus === 'approved' && selectedPlanFormat && !selectedPlanFormat.executeAllowed ? (
  <StatusPill tone="warning">Preview-only in V1</StatusPill>
) : null}
```

- Extend `StagePackagePlanDecisionPreview` to show format name, metric, ranking, and execution status when the plan `packageCode` is `best_upt_store`.

- [ ] **Step 7: Run the targeted Playwright test**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- e2e/competition-surfaces.spec.ts -g "preview-only best UPT"
```

Expected: PASS.

- [ ] **Step 8: Commit Task 4**

```powershell
git add -- admin-web/src/features/competitions/api.ts admin-web/src/features/competitions/stage-packages.ts admin-web/src/features/competitions/StageBuilderForm.tsx admin-web/e2e/competition-surfaces.spec.ts
git commit -m "feat: preview best UPT store format plans"
```

## Task 5: Regression Coverage And Release Verification

**Files:**
- Modify: `admin-web/e2e/competition-surfaces.spec.ts`
- Modify: `docs/plans/active-next-actions.md`
- Modify: `current-state.md`

- [ ] **Step 1: Run backend targeted tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/competition-format.registry.spec.ts src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run frontend competition smoke**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- e2e/competition-surfaces.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Run backend release check**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run check:release
```

Expected: PASS.

- [ ] **Step 4: Run frontend release check**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run check:release
```

Expected: PASS. Existing Vite chunk size warning may still appear; it is acceptable only if the command exits with code 0.

- [ ] **Step 5: Update project notes**

In `docs/plans/active-next-actions.md`:

- Move `Competition Format Registry V1` to completed.
- Add result bullets:
  - code-owned registry added
  - `league_then_final` remains executable
  - `best_upt_store` is selectable and preview-only
  - backend rejects live execution for preview-only formats

In `current-state.md`, add a short "Son Competition Format Registry V1" section with the same facts and the verification commands that passed.

- [ ] **Step 6: Commit Task 5**

```powershell
git add -- docs/plans/active-next-actions.md current-state.md
git commit -m "docs: record competition format registry status"
```

## Final Verification Gate

- [ ] Run repository status:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git status --short --branch
```

Expected: clean worktree on the current branch.

- [ ] Summarize:
  - commits created
  - tests run
  - remaining intentional limitation: `best_upt_store` has no live scoring, publish, notification, or participant-facing ranking in V1
  - next logical step: design the live scoring and participant visibility boundary for single-metric formats

## Self Review

- Spec coverage: code-owned registry, `league_then_final`, `best_upt_store`, preview-only execution boundary, future category-data gating, backend enforcement, frontend preview, and tests are covered.
- Placeholder scan: no placeholder sections remain.
- Type consistency: `CompetitionStagePackageCode`, `CompetitionFormatDefinition`, `executeAllowed`, and `executeDisabledReason` are used consistently across backend and frontend.
- Scope check: plan does not build scoring, publish, notifications, category sales import, or employee ranking. Those remain separate specs.
