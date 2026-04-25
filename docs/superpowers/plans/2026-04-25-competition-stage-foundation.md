# Competition Stage Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first durable Competition + Stage foundation for IK/Admin controlled region challenges, using closed store score facts, warning visibility, finalization override audit, and an admin read/write surface.

**Architecture:** Add a new competition bounded context inside Store Ops instead of extending closed personnel ranking. `ops.*` tables hold competition lifecycle, stages, teams, templates, and store membership; `rpt.*` tables hold derived stage/store/team score snapshots and warnings generated from closed store KPI snapshots. Backend exposes a focused competition API, frontend adds an admin competition dashboard, and release checks cover backend and frontend.

**Tech Stack:** PostgreSQL, NestJS, Jest/Supertest, React + Vite + TanStack Query + Playwright.

---

## Source Documents

- `docs/superpowers/specs/2026-04-25-competition-stage-design.md`
- `docs/plans/daily-closure-ranking-strategy.md`
- `docs/plans/request-intake-and-decision-policy.md`
- `current-state.md`

## Implementation Rules

- Competition teams are separate from operational regions and region manager scopes.
- V1 score is store-based, not personnel-based.
- Team score is the average of valid daily store scores in the stage.
- Every closed day has equal weight.
- Daily metrics are `TARGET_ACHIEVEMENT`, `CR`, `ATV`, and `UPT`.
- Monthly quality metrics are `BM_CHECKLIST` and `VM_CHECKLIST`.
- Checklist data belongs to the month in which it was performed.
- Missing daily store data and missing checklist data are warnings, not zero-score rows.
- Checklist weight is not redistributed when checklist data is missing.
- IK/Admin finalization requires a written override justification when unresolved warnings exist.
- Audit must record creation, stage creation, recalculation, finalization, and override.
- `HR_ADMIN` is introduced as the IK/Admin system role and shares competition management with `SUPER_ADMIN`.
- Read paths obey existing read scope. Region managers only see scoped store details.

## File Map

Create:
- `db/migrations/022_competition_stage_foundation.sql` - competition schema, read indexes, `HR_ADMIN`, competition permissions.
- `backend/nestjs/src/modules/store-ops/application/competition.contract.ts` - backend request/response contracts.
- `backend/nestjs/src/modules/store-ops/application/competition.service.ts` - lifecycle, scope, recalc, and finalization orchestration.
- `backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts` - service-level scoring/finalization tests.
- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts` - SQL access and audit writes.
- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts` - repository SQL contract tests.
- `backend/nestjs/src/modules/store-ops/web/competition.controller.ts` - API controller.
- `backend/nestjs/src/modules/store-ops/web/dto/create-competition.dto.ts` - create competition DTO.
- `backend/nestjs/src/modules/store-ops/web/dto/create-competition-stage.dto.ts` - create stage DTO.
- `backend/nestjs/src/modules/store-ops/web/dto/finalize-competition-stage.dto.ts` - finalization DTO.
- `backend/nestjs/src/modules/store-ops/web/dto/list-competitions.query.ts` - list query DTO.
- `backend/nestjs/test/integration/competition.e2e-spec.ts` - HTTP contract tests.
- `admin-web/src/features/competitions/api.ts` - frontend competition API client and types.
- `admin-web/src/pages/CompetitionDashboardPage.tsx` - admin competition dashboard.
- `admin-web/e2e/competition-surfaces.spec.ts` - frontend smoke coverage.

Modify:
- `db/schema.sql` - mirror migration tables, indexes, comments.
- `db/seeds/001_reference_seed.sql` - seed `HR_ADMIN`, competition permissions, demo team templates, and demo closed store KPI facts.
- `backend/nestjs/src/modules/auth/role-catalog-contract.spec.ts` - protect `HR_ADMIN` and competition permission drift.
- `backend/nestjs/src/modules/store-ops/store-ops.module.ts` - register controller/service/repository.
- `admin-web/src/App.tsx` - add lazy route and admin navigation item.
- `current-state.md` - record the completed implementation and verification.

---

### Task 1: Schema, Role, Permission, And Seed Contract

**Files:**
- Create: `db/migrations/022_competition_stage_foundation.sql`
- Modify: `db/schema.sql`
- Modify: `db/seeds/001_reference_seed.sql`
- Modify: `backend/nestjs/src/modules/auth/role-catalog-contract.spec.ts`

- [ ] **Step 1: Add the competition migration**

Create `db/migrations/022_competition_stage_foundation.sql` with this schema:

```sql
INSERT INTO ops.role (role_id, role_code, role_name, role_scope_type, description, is_system_role)
VALUES
    ('60000000-0000-0000-0000-000000000009', 'HR_ADMIN', 'HR Admin', 'company', 'Manages HR owned competitions and score review workflows', TRUE)
ON CONFLICT (role_code) DO UPDATE
SET
    role_name = EXCLUDED.role_name,
    role_scope_type = EXCLUDED.role_scope_type,
    description = EXCLUDED.description,
    is_system_role = EXCLUDED.is_system_role;

INSERT INTO ops.permission (permission_id, permission_code, resource_name, action_name, description)
VALUES
    ('70000000-0000-0000-0000-000000000013', 'competition.read', 'competition', 'read', 'Read competition standings and stage results'),
    ('70000000-0000-0000-0000-000000000014', 'competition.manage', 'competition', 'manage', 'Create, recalculate, and finalize competitions')
ON CONFLICT (permission_code) DO UPDATE
SET
    resource_name = EXCLUDED.resource_name,
    action_name = EXCLUDED.action_name,
    description = EXCLUDED.description;

WITH grants(role_code, permission_code) AS (
    VALUES
        ('SUPER_ADMIN', 'competition.read'),
        ('SUPER_ADMIN', 'competition.manage'),
        ('HR_ADMIN', 'competition.read'),
        ('HR_ADMIN', 'competition.manage'),
        ('REPORT_VIEWER', 'competition.read'),
        ('REGION_MANAGER', 'competition.read'),
        ('STORE_MANAGER', 'competition.read'),
        ('STORE_PERSONNEL', 'competition.read')
)
INSERT INTO ops.role_permission (role_id, permission_id)
SELECT role.role_id, permission.permission_id
FROM grants
INNER JOIN ops.role role
    ON role.role_code = grants.role_code
INNER JOIN ops.permission permission
    ON permission.permission_code = grants.permission_code
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS ops.competition (
    competition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_code TEXT NOT NULL UNIQUE,
    competition_name TEXT NOT NULL,
    description TEXT,
    competition_type TEXT NOT NULL,
    lifecycle_state TEXT NOT NULL DEFAULT 'draft',
    owner_user_id TEXT NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (competition_type IN ('region_challenge', 'region_league', 'campaign')),
    CHECK (lifecycle_state IN ('draft', 'published', 'active', 'completed', 'cancelled')),
    CHECK (ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS ops.competition_stage (
    competition_stage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL REFERENCES ops.competition(competition_id) ON DELETE CASCADE,
    stage_code TEXT NOT NULL,
    stage_name TEXT NOT NULL,
    stage_order INTEGER NOT NULL,
    stage_type TEXT NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    lifecycle_state TEXT NOT NULL DEFAULT 'draft',
    score_rule TEXT NOT NULL DEFAULT 'average_daily_store_score',
    advancement_rule_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    finalized_by_user_id TEXT,
    finalized_at TIMESTAMPTZ,
    finalization_state TEXT,
    finalization_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (competition_id, stage_code),
    UNIQUE (competition_id, stage_order),
    CHECK (stage_type IN ('qualifier', 'league', 'quarter_final', 'semi_final', 'final', 'custom')),
    CHECK (lifecycle_state IN ('draft', 'scheduled', 'active', 'awaiting_review', 'finalized', 'cancelled')),
    CHECK (score_rule = 'average_daily_store_score'),
    CHECK (finalization_state IS NULL OR finalization_state IN ('clean', 'warnings_present', 'overridden')),
    CHECK (ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS ops.competition_team_template (
    competition_team_template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code TEXT NOT NULL UNIQUE,
    template_name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops.competition_team_template_store (
    competition_team_template_id UUID NOT NULL REFERENCES ops.competition_team_template(competition_team_template_id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (competition_team_template_id, store_id)
);

CREATE TABLE IF NOT EXISTS ops.competition_team (
    competition_team_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_stage_id UUID NOT NULL REFERENCES ops.competition_stage(competition_stage_id) ON DELETE CASCADE,
    source_template_id UUID REFERENCES ops.competition_team_template(competition_team_template_id),
    team_code TEXT NOT NULL,
    team_name TEXT NOT NULL,
    team_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (competition_stage_id, team_code)
);

CREATE TABLE IF NOT EXISTS ops.competition_team_store (
    competition_team_id UUID NOT NULL REFERENCES ops.competition_team(competition_team_id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    added_manually BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (competition_team_id, store_id)
);

CREATE TABLE IF NOT EXISTS rpt.competition_stage_store_score_snapshot (
    competition_stage_id UUID NOT NULL REFERENCES ops.competition_stage(competition_stage_id) ON DELETE CASCADE,
    competition_team_id UUID NOT NULL REFERENCES ops.competition_team(competition_team_id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    snapshot_date DATE NOT NULL,
    score_value NUMERIC(18,4),
    reported_weight_percent NUMERIC(8,4) NOT NULL DEFAULT 0,
    expected_weight_percent NUMERIC(8,4) NOT NULL DEFAULT 100,
    has_daily_data BOOLEAN NOT NULL DEFAULT FALSE,
    missing_kpi_codes TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (competition_stage_id, competition_team_id, store_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS rpt.competition_stage_score_snapshot (
    competition_stage_id UUID NOT NULL REFERENCES ops.competition_stage(competition_stage_id) ON DELETE CASCADE,
    competition_team_id UUID NOT NULL REFERENCES ops.competition_team(competition_team_id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    score_value NUMERIC(18,4),
    valid_store_count INTEGER NOT NULL DEFAULT 0,
    total_store_count INTEGER NOT NULL DEFAULT 0,
    coverage_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
    rank_position INTEGER,
    ranking_population INTEGER NOT NULL DEFAULT 0,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (competition_stage_id, competition_team_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS rpt.competition_stage_warning (
    competition_stage_warning_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_stage_id UUID NOT NULL REFERENCES ops.competition_stage(competition_stage_id) ON DELETE CASCADE,
    competition_team_id UUID REFERENCES ops.competition_team(competition_team_id) ON DELETE CASCADE,
    store_id UUID REFERENCES ops.store(store_id),
    warning_code TEXT NOT NULL,
    warning_level TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    message TEXT NOT NULL,
    resolved_at TIMESTAMPTZ,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (warning_code IN ('missing_daily_store_data', 'missing_bm_checklist', 'missing_vm_checklist')),
    CHECK (warning_level IN ('info', 'warning', 'blocker')),
    CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS competition_stage_competition_state_idx
    ON ops.competition_stage (competition_id, lifecycle_state, starts_on, ends_on);

CREATE INDEX IF NOT EXISTS competition_team_stage_idx
    ON ops.competition_team (competition_stage_id, team_order);

CREATE INDEX IF NOT EXISTS competition_team_store_store_idx
    ON ops.competition_team_store (store_id, competition_team_id);

CREATE INDEX IF NOT EXISTS competition_stage_store_score_date_idx
    ON rpt.competition_stage_store_score_snapshot (competition_stage_id, snapshot_date, score_value DESC);

CREATE INDEX IF NOT EXISTS competition_stage_score_rank_idx
    ON rpt.competition_stage_score_snapshot (competition_stage_id, snapshot_date, rank_position);

CREATE INDEX IF NOT EXISTS competition_stage_warning_open_idx
    ON rpt.competition_stage_warning (competition_stage_id, warning_code, warning_level)
    WHERE resolved_at IS NULL;
```

- [ ] **Step 2: Mirror the schema**

Add the same `ops.competition*` and `rpt.competition*` table definitions plus indexes to `db/schema.sql`. Keep the order after `ops.user_action_store_assignment` for `ops.*` tables and after `rpt.employee_performance_snapshot` for `rpt.*` tables.

- [ ] **Step 3: Extend the reference seed**

Add `HR_ADMIN`, `competition.read`, `competition.manage`, role grants, active team templates, demo store memberships, and demo store KPI snapshot facts to `db/seeds/001_reference_seed.sql`.

Use this seed block after existing role/permission grants and after KPI definitions exist:

```sql
INSERT INTO ops.competition_team_template (
    competition_team_template_id,
    template_code,
    template_name,
    description,
    is_active
)
VALUES
    ('90000000-0000-0000-0000-000000000001', 'MARMARA_DEMO', 'Marmara Demo', 'Demo challenge team for Istanbul stores', TRUE),
    ('90000000-0000-0000-0000-000000000002', 'KARADENIZ_DEMO', 'Karadeniz Demo', 'Demo challenge team for comparison stores', TRUE)
ON CONFLICT (template_code) DO UPDATE
SET
    template_name = EXCLUDED.template_name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

INSERT INTO ops.competition_team_template_store (competition_team_template_id, store_id)
VALUES
    ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000100'),
    ('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101')
ON CONFLICT DO NOTHING;

WITH demo_store_kpi_values (snapshot_run_id, closure_date, store_id, kpi_code, period_start, period_end, actual_value, achievement_rate) AS (
    VALUES
        ('00000000-0000-0000-0000-00000000f322'::uuid, DATE '2026-04-22', '00000000-0000-0000-0000-000000000100'::uuid, 'TARGET_ACHIEVEMENT', DATE '2026-04-22', DATE '2026-04-22', 96.0000, 0.9600),
        ('00000000-0000-0000-0000-00000000f322'::uuid, DATE '2026-04-22', '00000000-0000-0000-0000-000000000100'::uuid, 'CR', DATE '2026-04-22', DATE '2026-04-22', 88.0000, 0.8800),
        ('00000000-0000-0000-0000-00000000f322'::uuid, DATE '2026-04-22', '00000000-0000-0000-0000-000000000100'::uuid, 'ATV', DATE '2026-04-22', DATE '2026-04-22', 92.0000, 0.9200),
        ('00000000-0000-0000-0000-00000000f322'::uuid, DATE '2026-04-22', '00000000-0000-0000-0000-000000000100'::uuid, 'UPT', DATE '2026-04-22', DATE '2026-04-22', 91.0000, 0.9100),
        ('00000000-0000-0000-0000-00000000f322'::uuid, DATE '2026-04-22', '00000000-0000-0000-0000-000000000100'::uuid, 'BM_CHECKLIST', DATE '2026-04-01', DATE '2026-04-30', 95.0000, 0.9500),
        ('00000000-0000-0000-0000-00000000f322'::uuid, DATE '2026-04-22', '00000000-0000-0000-0000-000000000100'::uuid, 'VM_CHECKLIST', DATE '2026-04-01', DATE '2026-04-30', 93.0000, 0.9300),
        ('00000000-0000-0000-0000-00000000f322'::uuid, DATE '2026-04-22', '00000000-0000-0000-0000-000000000101'::uuid, 'TARGET_ACHIEVEMENT', DATE '2026-04-22', DATE '2026-04-22', 94.0000, 0.9400),
        ('00000000-0000-0000-0000-00000000f322'::uuid, DATE '2026-04-22', '00000000-0000-0000-0000-000000000101'::uuid, 'CR', DATE '2026-04-22', DATE '2026-04-22', 84.0000, 0.8400),
        ('00000000-0000-0000-0000-00000000f322'::uuid, DATE '2026-04-22', '00000000-0000-0000-0000-000000000101'::uuid, 'ATV', DATE '2026-04-22', DATE '2026-04-22', 90.0000, 0.9000),
        ('00000000-0000-0000-0000-00000000f322'::uuid, DATE '2026-04-22', '00000000-0000-0000-0000-000000000101'::uuid, 'UPT', DATE '2026-04-22', DATE '2026-04-22', 89.0000, 0.8900),
        ('00000000-0000-0000-0000-00000000f322'::uuid, DATE '2026-04-22', '00000000-0000-0000-0000-000000000101'::uuid, 'VM_CHECKLIST', DATE '2026-04-01', DATE '2026-04-30', 90.0000, 0.9000)
)
INSERT INTO rpt.store_kpi_snapshot (
    snapshot_run_id,
    store_id,
    kpi_id,
    period_start,
    period_end,
    target_value,
    actual_value,
    achievement_rate,
    status_band
)
SELECT
    value.snapshot_run_id,
    value.store_id,
    definition.kpi_id,
    value.period_start,
    value.period_end,
    100.0000,
    value.actual_value,
    value.achievement_rate,
    CASE
        WHEN value.achievement_rate >= 0.95 THEN 'green'
        WHEN value.achievement_rate >= 0.85 THEN 'yellow'
        ELSE 'red'
    END
FROM demo_store_kpi_values value
INNER JOIN ops.kpi_definition definition
    ON definition.kpi_code = value.kpi_code
ON CONFLICT DO NOTHING;
```

- [ ] **Step 4: Protect role and permission catalog drift**

Update `backend/nestjs/src/modules/auth/role-catalog-contract.spec.ts` expected role/permission lists with:

```ts
expect(roleCodes).toContain("HR_ADMIN");
expect(permissionCodes).toEqual(expect.arrayContaining([
  "competition.read",
  "competition.manage",
]));
```

Also assert `HR_ADMIN` is company scoped:

```ts
expect(roleScopeByCode.get("HR_ADMIN")).toBe("company");
```

- [ ] **Step 5: Run the contract test**

Run:

```powershell
cd backend/nestjs
npm.cmd test -- src/modules/auth/role-catalog-contract.spec.ts --runInBand
```

Expected: FAIL before the test changes are backed by schema/seed; PASS after the migration/seed contract is aligned.

- [ ] **Step 6: Commit the schema foundation**

Run:

```powershell
git add db/migrations/022_competition_stage_foundation.sql db/schema.sql db/seeds/001_reference_seed.sql backend/nestjs/src/modules/auth/role-catalog-contract.spec.ts
git commit -m "feat: add competition stage schema"
```

---

### Task 2: Backend Competition Contracts And Service Tests

**Files:**
- Create: `backend/nestjs/src/modules/store-ops/application/competition.contract.ts`
- Create: `backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts`

- [ ] **Step 1: Add shared contracts**

Create `competition.contract.ts` with:

```ts
export type CompetitionLifecycleState = "draft" | "published" | "active" | "completed" | "cancelled";
export type CompetitionStageLifecycleState = "draft" | "scheduled" | "active" | "awaiting_review" | "finalized" | "cancelled";
export type CompetitionStageFinalizationState = "clean" | "warnings_present" | "overridden";
export type CompetitionWarningCode = "missing_daily_store_data" | "missing_bm_checklist" | "missing_vm_checklist";

export type CompetitionScope = {
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
};

export type Competition = {
  competitionId: string;
  competitionCode: string;
  competitionName: string;
  description: string | null;
  competitionType: "region_challenge" | "region_league" | "campaign";
  lifecycleState: CompetitionLifecycleState;
  startsOn: string;
  endsOn: string;
};

export type CompetitionStage = {
  competitionStageId: string;
  competitionId: string;
  stageCode: string;
  stageName: string;
  stageOrder: number;
  stageType: "qualifier" | "league" | "quarter_final" | "semi_final" | "final" | "custom";
  startsOn: string;
  endsOn: string;
  lifecycleState: CompetitionStageLifecycleState;
  finalizationState: CompetitionStageFinalizationState | null;
};

export type CompetitionTeam = {
  competitionTeamId: string;
  teamCode: string;
  teamName: string;
  teamOrder: number;
  stores: Array<{
    storeId: string;
    storeCode: string;
    storeName: string;
    regionId: string;
  }>;
};

export type CompetitionWarning = {
  warningId: string;
  stageId: string;
  teamId: string | null;
  storeId: string | null;
  warningCode: CompetitionWarningCode;
  warningLevel: "info" | "warning" | "blocker";
  periodStart: string;
  periodEnd: string;
  message: string;
  resolvedAt: string | null;
};

export type CompetitionTeamScore = {
  stageId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  snapshotDate: string;
  scoreValue: number | null;
  validStoreCount: number;
  totalStoreCount: number;
  coverageRate: number;
  rankPosition: number | null;
  rankingPopulation: number;
};

export type CompetitionDetail = {
  competition: Competition;
  stages: CompetitionStage[];
  teams: CompetitionTeam[];
  latestScores: CompetitionTeamScore[];
  warnings: CompetitionWarning[];
};

export type CreateCompetitionInput = {
  actorUserId: string;
  competitionCode: string;
  competitionName: string;
  description?: string;
  competitionType: "region_challenge" | "region_league" | "campaign";
  startsOn: string;
  endsOn: string;
};

export type CreateCompetitionStageInput = {
  actorUserId: string;
  competitionId: string;
  stageCode: string;
  stageName: string;
  stageOrder: number;
  stageType: "qualifier" | "league" | "quarter_final" | "semi_final" | "final" | "custom";
  startsOn: string;
  endsOn: string;
  teams: Array<{
    teamCode: string;
    teamName: string;
    sourceTemplateId?: string;
    storeIds: string[];
  }>;
};

export type RecalculateCompetitionStageInput = {
  actorUserId: string;
  stageId: string;
};

export type FinalizeCompetitionStageInput = {
  actorUserId: string;
  stageId: string;
  allowOverride: boolean;
  overrideJustification?: string;
};
```

- [ ] **Step 2: Add service tests for lifecycle and finalization**

Create `competition.service.spec.ts` with mocked repository methods:

```ts
import { ForbiddenException, BadRequestException } from "@nestjs/common";
import { CompetitionService } from "./competition.service";

const repository = () => ({
  listCompetitions: jest.fn(),
  getCompetitionDetail: jest.fn(),
  createCompetition: jest.fn(),
  createStageWithTeams: jest.fn(),
  recalculateStage: jest.fn(),
  listOpenWarnings: jest.fn(),
  finalizeStage: jest.fn(),
});

describe("CompetitionService", () => {
  it("creates a draft competition through the repository", async () => {
    const repo = repository();
    repo.createCompetition.mockResolvedValue({
      competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      competitionCode: "MAY_REGION_CHALLENGE",
      competitionName: "May Region Challenge",
      description: null,
      competitionType: "region_challenge",
      lifecycleState: "draft",
      startsOn: "2026-05-01",
      endsOn: "2026-05-31",
    });
    const service = new CompetitionService(repo as never);

    const result = await service.createCompetition({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      competitionCode: "MAY_REGION_CHALLENGE",
      competitionName: "May Region Challenge",
      competitionType: "region_challenge",
      startsOn: "2026-05-01",
      endsOn: "2026-05-31",
    });

    expect(result.data.competition.competitionCode).toBe("MAY_REGION_CHALLENGE");
    expect(repo.createCompetition).toHaveBeenCalledWith(expect.objectContaining({
      competitionCode: "MAY_REGION_CHALLENGE",
      ownerUserId: "11111111-1111-4111-8111-111111111111",
    }));
  });

  it("rejects finalization with open warnings unless override justification is written", async () => {
    const repo = repository();
    repo.listOpenWarnings.mockResolvedValue([
      {
        warningId: "w1",
        stageId: "stage-1",
        teamId: "team-1",
        storeId: "store-1",
        warningCode: "missing_bm_checklist",
        warningLevel: "warning",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        message: "BM checklist missing",
        resolvedAt: null,
      },
    ]);
    const service = new CompetitionService(repo as never);

    await expect(service.finalizeStage({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      stageId: "22222222-2222-4222-8222-222222222222",
      allowOverride: false,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("finalizes with overridden state when warnings exist and justification is present", async () => {
    const repo = repository();
    repo.listOpenWarnings.mockResolvedValue([
      {
        warningId: "w1",
        stageId: "stage-1",
        teamId: "team-1",
        storeId: "store-1",
        warningCode: "missing_vm_checklist",
        warningLevel: "warning",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        message: "VM checklist missing",
        resolvedAt: null,
      },
    ]);
    repo.finalizeStage.mockResolvedValue({
      competitionStageId: "22222222-2222-4222-8222-222222222222",
      finalizationState: "overridden",
    });
    const service = new CompetitionService(repo as never);

    const result = await service.finalizeStage({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      stageId: "22222222-2222-4222-8222-222222222222",
      allowOverride: true,
      overrideJustification: "April BM record was verified outside the source export.",
    });

    expect(result.status).toBe("finalized");
    expect(repo.finalizeStage).toHaveBeenCalledWith(expect.objectContaining({
      finalizationState: "overridden",
      finalizationNote: "April BM record was verified outside the source export.",
      unresolvedWarningCount: 1,
    }));
  });

  it("blocks region manager store detail reads outside read scope", async () => {
    const repo = repository();
    repo.getCompetitionDetail.mockResolvedValue({
      competition: {
        competitionId: "competition-1",
        competitionCode: "APRIL",
        competitionName: "April",
        description: null,
        competitionType: "region_challenge",
        lifecycleState: "active",
        startsOn: "2026-04-01",
        endsOn: "2026-04-30",
      },
      stages: [],
      teams: [
        {
          competitionTeamId: "team-1",
          teamCode: "MARMARA",
          teamName: "Marmara",
          teamOrder: 1,
          stores: [{
            storeId: "outside-store",
            storeCode: "IST-999",
            storeName: "Outside",
            regionId: "outside-region",
          }],
        },
      ],
      latestScores: [],
      warnings: [],
    });
    const service = new CompetitionService(repo as never);

    await expect(service.getCompetitionDetail({
      competitionId: "competition-1",
      actorScope: { companyIds: [], regionIds: [], storeIds: ["inside-store"] },
      includeStoreDetails: true,
    })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
```

- [ ] **Step 3: Run service tests and confirm they fail**

Run:

```powershell
cd backend/nestjs
npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts --runInBand
```

Expected: FAIL because `CompetitionService` does not exist.

---

### Task 3: Backend Service And Repository

**Files:**
- Create: `backend/nestjs/src/modules/store-ops/application/competition.service.ts`
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts`
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts`

- [ ] **Step 1: Implement service orchestration**

Create `competition.service.ts` with these public methods:

```ts
import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { buildCommandResponse, buildListResponse } from "../../../shared/http/response-builders";
import { CompetitionRepository } from "../infrastructure/competition.repository";
import {
  CompetitionScope,
  CreateCompetitionInput,
  CreateCompetitionStageInput,
  FinalizeCompetitionStageInput,
  RecalculateCompetitionStageInput,
} from "./competition.contract";

@Injectable()
export class CompetitionService {
  constructor(private readonly competitionRepository: CompetitionRepository) {}

  async listCompetitions(input: { actorScope: CompetitionScope; limit?: number; offset?: number }) {
    const items = await this.competitionRepository.listCompetitions({
      companyIds: input.actorScope.companyIds,
      regionIds: input.actorScope.regionIds,
      storeIds: input.actorScope.storeIds,
      limit: input.limit ?? 50,
      offset: input.offset ?? 0,
    });
    return buildListResponse(items, {
      total: items.length,
      limit: input.limit ?? 50,
      offset: input.offset ?? 0,
    });
  }

  async getCompetitionDetail(input: {
    competitionId: string;
    actorScope: CompetitionScope;
    includeStoreDetails?: boolean;
  }) {
    const detail = await this.competitionRepository.getCompetitionDetail({
      competitionId: input.competitionId,
      companyIds: input.actorScope.companyIds,
      regionIds: input.actorScope.regionIds,
      storeIds: input.actorScope.storeIds,
    });

    if (!detail) {
      throw new BadRequestException("Competition not found or outside read scope");
    }

    if (input.includeStoreDetails) {
      const visibleStoreIds = new Set(input.actorScope.storeIds);
      const visibleRegionIds = new Set(input.actorScope.regionIds);
      const canSeeAllStores = input.actorScope.companyIds.length > 0;
      const hasOutsideStore = detail.teams.some((team) =>
        team.stores.some((store) =>
          !canSeeAllStores &&
          !visibleStoreIds.has(store.storeId) &&
          !visibleRegionIds.has(store.regionId),
        ),
      );

      if (hasOutsideStore) {
        throw new ForbiddenException("Competition contains store details outside read scope");
      }
    }

    return detail;
  }

  async createCompetition(input: CreateCompetitionInput) {
    if (input.endsOn < input.startsOn) {
      throw new BadRequestException("Competition end date must be on or after start date");
    }

    const competition = await this.competitionRepository.createCompetition({
      ...input,
      ownerUserId: input.actorUserId,
    });

    return buildCommandResponse({
      status: "created",
      message: "Competition draft created",
      data: { competition },
    });
  }

  async createStage(input: CreateCompetitionStageInput) {
    if (input.endsOn < input.startsOn) {
      throw new BadRequestException("Stage end date must be on or after start date");
    }

    if (input.teams.length < 2) {
      throw new BadRequestException("At least two teams are required for a competition stage");
    }

    for (const team of input.teams) {
      if (team.storeIds.length === 0) {
        throw new BadRequestException(`Team ${team.teamCode} must include at least one store`);
      }
    }

    const stage = await this.competitionRepository.createStageWithTeams(input);
    return buildCommandResponse({
      status: "created",
      message: "Competition stage created",
      data: { stage },
    });
  }

  async recalculateStage(input: RecalculateCompetitionStageInput) {
    const result = await this.competitionRepository.recalculateStage(input);
    return buildCommandResponse({
      status: "recalculated",
      message: "Competition stage scores recalculated from closed store facts",
      data: result,
    });
  }

  async finalizeStage(input: FinalizeCompetitionStageInput) {
    const warnings = await this.competitionRepository.listOpenWarnings(input.stageId);
    const hasWarnings = warnings.length > 0;
    const trimmedJustification = input.overrideJustification?.trim() ?? "";

    if (hasWarnings && (!input.allowOverride || trimmedJustification.length < 12)) {
      throw new BadRequestException("Finalization with open warnings requires a written override justification");
    }

    const finalizationState = hasWarnings ? "overridden" : "clean";
    const stage = await this.competitionRepository.finalizeStage({
      stageId: input.stageId,
      actorUserId: input.actorUserId,
      finalizationState,
      finalizationNote: hasWarnings ? trimmedJustification : null,
      unresolvedWarningCount: warnings.length,
    });

    return buildCommandResponse({
      status: "finalized",
      message: hasWarnings
        ? "Competition stage finalized with audited override"
        : "Competition stage finalized cleanly",
      data: { stage, unresolvedWarnings: warnings },
    });
  }
}
```

- [ ] **Step 2: Implement repository row mapping and create/list methods**

Create `competition.repository.ts` with:

```ts
import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import { RequestContextStore } from "../../../shared/request-context";
import {
  Competition,
  CompetitionDetail,
  CompetitionStage,
  CompetitionTeam,
  CompetitionTeamScore,
  CompetitionWarning,
  CreateCompetitionStageInput,
  RecalculateCompetitionStageInput,
} from "../application/competition.contract";

@Injectable()
export class CompetitionRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listCompetitions(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    limit: number;
    offset: number;
  }): Promise<Competition[]> {
    const result = await this.databaseService.query<CompetitionRow>(
      `
        SELECT DISTINCT
          competition.competition_id,
          competition.competition_code,
          competition.competition_name,
          competition.description,
          competition.competition_type,
          competition.lifecycle_state,
          competition.starts_on,
          competition.ends_on
        FROM ops.competition competition
        LEFT JOIN ops.competition_stage stage
          ON stage.competition_id = competition.competition_id
        LEFT JOIN ops.competition_team team
          ON team.competition_stage_id = stage.competition_stage_id
        LEFT JOIN ops.competition_team_store team_store
          ON team_store.competition_team_id = team.competition_team_id
        LEFT JOIN ops.store store
          ON store.store_id = team_store.store_id
        WHERE
          cardinality($1::uuid[]) > 0
          OR store.region_id = ANY($2::uuid[])
          OR store.store_id = ANY($3::uuid[])
          OR team_store.store_id IS NULL
        ORDER BY competition.starts_on DESC, competition.competition_code ASC
        LIMIT $4::int
        OFFSET $5::int
      `,
      [input.companyIds, input.regionIds, input.storeIds, input.limit, input.offset],
    );

    return result.rows.map(mapCompetition);
  }

  async createCompetition(input: {
    actorUserId: string;
    ownerUserId: string;
    competitionCode: string;
    competitionName: string;
    description?: string;
    competitionType: "region_challenge" | "region_league" | "campaign";
    startsOn: string;
    endsOn: string;
  }): Promise<Competition> {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<CompetitionRow>(
        `
          INSERT INTO ops.competition (
            competition_code,
            competition_name,
            description,
            competition_type,
            lifecycle_state,
            owner_user_id,
            starts_on,
            ends_on
          )
          VALUES ($1, $2, $3, $4, 'draft', $5, $6::date, $7::date)
          RETURNING
            competition_id,
            competition_code,
            competition_name,
            description,
            competition_type,
            lifecycle_state,
            starts_on,
            ends_on
        `,
        [
          input.competitionCode,
          input.competitionName,
          input.description ?? null,
          input.competitionType,
          input.ownerUserId,
          input.startsOn,
          input.endsOn,
        ],
      );

      const row = result.rows[0];
      await writeCompetitionAudit(client, {
        actorUserId: input.actorUserId,
        eventType: "competition.created",
        entityName: "ops.competition",
        entityId: row.competition_id,
        metadata: {
          competitionCode: input.competitionCode,
          competitionType: input.competitionType,
          startsOn: input.startsOn,
          endsOn: input.endsOn,
        },
      });

      return mapCompetition(row);
    });
  }
}
```

Add `mapCompetition`, `mapStage`, `mapTeam`, `mapScore`, and `mapWarning` helpers in the same file. Each helper must convert snake case DB rows to the camel case contract and convert numeric strings with `Number(...)`.

- [ ] **Step 3: Implement stage creation with team store membership**

Add `createStageWithTeams` to the repository:

```ts
async createStageWithTeams(input: CreateCompetitionStageInput): Promise<CompetitionStage> {
  return this.databaseService.withTransaction(async (client) => {
    const stageResult = await client.query<CompetitionStageRow>(
      `
        INSERT INTO ops.competition_stage (
          competition_id,
          stage_code,
          stage_name,
          stage_order,
          stage_type,
          starts_on,
          ends_on,
          lifecycle_state,
          advancement_rule_json
        )
        VALUES ($1::uuid, $2, $3, $4::int, $5, $6::date, $7::date, 'active', $8::jsonb)
        RETURNING
          competition_stage_id,
          competition_id,
          stage_code,
          stage_name,
          stage_order,
          stage_type,
          starts_on,
          ends_on,
          lifecycle_state,
          finalization_state
      `,
      [
        input.competitionId,
        input.stageCode,
        input.stageName,
        input.stageOrder,
        input.stageType,
        input.startsOn,
        input.endsOn,
        JSON.stringify({ type: "top_n", count: 1 }),
      ],
    );

    const stage = stageResult.rows[0];

    for (let index = 0; index < input.teams.length; index += 1) {
      const team = input.teams[index];
      const teamResult = await client.query<{ competition_team_id: string }>(
        `
          INSERT INTO ops.competition_team (
            competition_stage_id,
            source_template_id,
            team_code,
            team_name,
            team_order
          )
          VALUES ($1::uuid, $2::uuid, $3, $4, $5::int)
          RETURNING competition_team_id
        `,
        [
          stage.competition_stage_id,
          team.sourceTemplateId ?? null,
          team.teamCode,
          team.teamName,
          index + 1,
        ],
      );

      await client.query(
        `
          INSERT INTO ops.competition_team_store (
            competition_team_id,
            store_id,
            added_manually
          )
          SELECT $1::uuid, unnest($2::uuid[]), TRUE
          ON CONFLICT DO NOTHING
        `,
        [teamResult.rows[0].competition_team_id, team.storeIds],
      );
    }

    await writeCompetitionAudit(client, {
      actorUserId: input.actorUserId,
      eventType: "competition_stage.created",
      entityName: "ops.competition_stage",
      entityId: stage.competition_stage_id,
      metadata: {
        competitionId: input.competitionId,
        stageCode: input.stageCode,
        teamCount: input.teams.length,
        storeCount: input.teams.reduce((sum, team) => sum + team.storeIds.length, 0),
      },
    });

    return mapStage(stage);
  });
}
```

- [ ] **Step 4: Implement score recalculation from closed store facts**

Add `recalculateStage` to the repository. It must:

1. Delete existing snapshots and warnings for the stage.
2. Read active stage teams and stores.
3. Use completed daily `rpt.snapshot_run` rows where `period_start = period_end`.
4. Score each store/day using store score weights:
   - `TARGET_ACHIEVEMENT` weight `40`
   - `CR` weight `20`
   - `ATV` weight `15`
   - `UPT` weight `15`
   - `BM_CHECKLIST` weight `5`
   - `VM_CHECKLIST` weight `5`
5. Use `achievement_rate * 100` when achievement rate exists, otherwise use `actual_value`.
6. Generate warning rows for missing daily data, missing BM checklist, and missing VM checklist.
7. Insert store score snapshots and team score snapshots.
8. Rank teams by score for each snapshot date.

Use this SQL shape inside a transaction:

```sql
WITH stage_scope AS (
    SELECT
        stage.competition_stage_id,
        stage.starts_on,
        stage.ends_on
    FROM ops.competition_stage stage
    WHERE stage.competition_stage_id = $1::uuid
),
closed_days AS (
    SELECT
        run.snapshot_run_id,
        run.period_start AS snapshot_date
    FROM rpt.snapshot_run run
    INNER JOIN stage_scope stage
        ON run.period_start BETWEEN stage.starts_on AND stage.ends_on
    WHERE run.snapshot_type = 'daily'
      AND run.run_status = 'completed'
      AND run.period_start = run.period_end
),
team_stores AS (
    SELECT
        team.competition_team_id,
        team.team_code,
        team.team_name,
        team_store.store_id
    FROM ops.competition_team team
    INNER JOIN ops.competition_team_store team_store
        ON team_store.competition_team_id = team.competition_team_id
    WHERE team.competition_stage_id = $1::uuid
),
metric_weights AS (
    SELECT *
    FROM (VALUES
        ('TARGET_ACHIEVEMENT', 40::numeric),
        ('CR', 20::numeric),
        ('ATV', 15::numeric),
        ('UPT', 15::numeric),
        ('BM_CHECKLIST', 5::numeric),
        ('VM_CHECKLIST', 5::numeric)
    ) AS weights(kpi_code, weight_percent)
),
store_day_matrix AS (
    SELECT
        team_stores.competition_team_id,
        team_stores.store_id,
        closed_days.snapshot_run_id,
        closed_days.snapshot_date
    FROM team_stores
    CROSS JOIN closed_days
),
metric_values AS (
    SELECT
        matrix.competition_team_id,
        matrix.store_id,
        matrix.snapshot_date,
        weights.kpi_code,
        weights.weight_percent,
        snapshot.actual_value,
        snapshot.achievement_rate
    FROM store_day_matrix matrix
    CROSS JOIN metric_weights weights
    LEFT JOIN ops.kpi_definition definition
        ON definition.kpi_code = weights.kpi_code
    LEFT JOIN rpt.store_kpi_snapshot snapshot
        ON snapshot.store_id = matrix.store_id
       AND snapshot.kpi_id = definition.kpi_id
       AND (
            (weights.kpi_code IN ('TARGET_ACHIEVEMENT', 'CR', 'ATV', 'UPT')
             AND snapshot.snapshot_run_id = matrix.snapshot_run_id
             AND snapshot.period_start = matrix.snapshot_date
             AND snapshot.period_end = matrix.snapshot_date)
            OR
            (weights.kpi_code IN ('BM_CHECKLIST', 'VM_CHECKLIST')
             AND snapshot.period_start <= matrix.snapshot_date
             AND snapshot.period_end >= matrix.snapshot_date)
       )
),
store_scores AS (
    SELECT
        competition_team_id,
        store_id,
        snapshot_date,
        SUM(
            CASE
                WHEN actual_value IS NULL AND achievement_rate IS NULL THEN 0
                WHEN achievement_rate IS NOT NULL THEN achievement_rate * 100 * weight_percent / 100
                ELSE actual_value * weight_percent / 100
            END
        ) AS score_value,
        SUM(CASE WHEN actual_value IS NULL AND achievement_rate IS NULL THEN 0 ELSE weight_percent END) AS reported_weight_percent,
        ARRAY_AGG(kpi_code ORDER BY kpi_code) FILTER (
            WHERE actual_value IS NULL AND achievement_rate IS NULL
        ) AS missing_kpi_codes,
        COUNT(*) FILTER (
            WHERE kpi_code IN ('TARGET_ACHIEVEMENT', 'CR', 'ATV', 'UPT')
              AND (actual_value IS NOT NULL OR achievement_rate IS NOT NULL)
        ) > 0 AS has_daily_data
    FROM metric_values
    GROUP BY competition_team_id, store_id, snapshot_date
)
INSERT INTO rpt.competition_stage_store_score_snapshot (
    competition_stage_id,
    competition_team_id,
    store_id,
    snapshot_date,
    score_value,
    reported_weight_percent,
    expected_weight_percent,
    has_daily_data,
    missing_kpi_codes
)
SELECT
    $1::uuid,
    competition_team_id,
    store_id,
    snapshot_date,
    CASE WHEN has_daily_data THEN score_value ELSE NULL END,
    reported_weight_percent,
    100,
    has_daily_data,
    COALESCE(missing_kpi_codes, ARRAY[]::text[])
FROM store_scores;
```

Then insert warnings from `rpt.competition_stage_store_score_snapshot` and aggregate team snapshots:

```sql
INSERT INTO rpt.competition_stage_warning (
    competition_stage_id,
    competition_team_id,
    store_id,
    warning_code,
    warning_level,
    period_start,
    period_end,
    message
)
SELECT
    store_score.competition_stage_id,
    store_score.competition_team_id,
    store_score.store_id,
    warning_code,
    CASE WHEN warning_code = 'missing_daily_store_data' THEN 'blocker' ELSE 'warning' END,
    store_score.snapshot_date,
    store_score.snapshot_date,
    warning_code || ' for store ' || store.store_code || ' on ' || store_score.snapshot_date::text
FROM rpt.competition_stage_store_score_snapshot store_score
INNER JOIN ops.store store
    ON store.store_id = store_score.store_id
CROSS JOIN LATERAL unnest(
    ARRAY[
        CASE WHEN store_score.has_daily_data = FALSE THEN 'missing_daily_store_data' END,
        CASE WHEN 'BM_CHECKLIST' = ANY(store_score.missing_kpi_codes) THEN 'missing_bm_checklist' END,
        CASE WHEN 'VM_CHECKLIST' = ANY(store_score.missing_kpi_codes) THEN 'missing_vm_checklist' END
    ]::text[]
) AS warning_code
WHERE store_score.competition_stage_id = $1::uuid
  AND warning_code IS NOT NULL;

WITH team_scores AS (
    SELECT
        competition_stage_id,
        competition_team_id,
        snapshot_date,
        AVG(score_value) FILTER (WHERE score_value IS NOT NULL) AS score_value,
        COUNT(*) FILTER (WHERE score_value IS NOT NULL) AS valid_store_count,
        COUNT(*) AS total_store_count
    FROM rpt.competition_stage_store_score_snapshot
    WHERE competition_stage_id = $1::uuid
    GROUP BY competition_stage_id, competition_team_id, snapshot_date
),
ranked AS (
    SELECT
        *,
        CASE
            WHEN score_value IS NULL THEN NULL
            ELSE DENSE_RANK() OVER (PARTITION BY competition_stage_id, snapshot_date ORDER BY score_value DESC)
        END AS rank_position,
        COUNT(*) OVER (PARTITION BY competition_stage_id, snapshot_date) AS ranking_population
    FROM team_scores
)
INSERT INTO rpt.competition_stage_score_snapshot (
    competition_stage_id,
    competition_team_id,
    snapshot_date,
    score_value,
    valid_store_count,
    total_store_count,
    coverage_rate,
    rank_position,
    ranking_population
)
SELECT
    competition_stage_id,
    competition_team_id,
    snapshot_date,
    score_value,
    valid_store_count,
    total_store_count,
    CASE WHEN total_store_count = 0 THEN 0 ELSE valid_store_count::numeric / total_store_count::numeric END,
    rank_position,
    ranking_population
FROM ranked;
```

- [ ] **Step 5: Add repository SQL contract tests**

Create `competition.repository.spec.ts` with mocked `DatabaseService` calls that assert:

```ts
expect(sql).toContain("FROM rpt.snapshot_run run");
expect(sql).toContain("run.period_start = run.period_end");
expect(sql).toContain("'BM_CHECKLIST'");
expect(sql).toContain("'VM_CHECKLIST'");
expect(sql).toContain("competition_stage_store_score_snapshot");
expect(sql).toContain("competition_stage_warning");
```

Also assert finalization audit SQL contains:

```ts
expect(sql).toContain("'competition_stage.finalized'");
expect(JSON.stringify(params)).toContain("unresolvedWarningCount");
```

- [ ] **Step 6: Run backend targeted tests**

Run:

```powershell
cd backend/nestjs
npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit backend core**

Run:

```powershell
git add backend/nestjs/src/modules/store-ops/application/competition.contract.ts backend/nestjs/src/modules/store-ops/application/competition.service.ts backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts
git commit -m "feat: add competition stage backend core"
```

---

### Task 4: Backend API Controller And Integration Tests

**Files:**
- Create: `backend/nestjs/src/modules/store-ops/web/competition.controller.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/create-competition.dto.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/create-competition-stage.dto.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/finalize-competition-stage.dto.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/list-competitions.query.ts`
- Create: `backend/nestjs/test/integration/competition.e2e-spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/store-ops.module.ts`

- [ ] **Step 1: Add DTOs**

Create `create-competition.dto.ts`:

```ts
import { IsDateString, IsIn, IsOptional, IsString, Length, Matches } from "class-validator";

export class CreateCompetitionDto {
  @IsString()
  @Length(3, 80)
  @Matches(/^[A-Z0-9_]+$/)
  competitionCode!: string;

  @IsString()
  @Length(3, 160)
  competitionName!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @IsIn(["region_challenge", "region_league", "campaign"])
  competitionType!: "region_challenge" | "region_league" | "campaign";

  @IsDateString()
  startsOn!: string;

  @IsDateString()
  endsOn!: string;
}
```

Create `create-competition-stage.dto.ts`:

```ts
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Min, ValidateNested } from "class-validator";

class CreateCompetitionTeamDto {
  @IsString()
  @Length(2, 80)
  @Matches(/^[A-Z0-9_]+$/)
  teamCode!: string;

  @IsString()
  @Length(2, 160)
  teamName!: string;

  @IsOptional()
  @IsUUID()
  sourceTemplateId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  storeIds!: string[];
}

export class CreateCompetitionStageDto {
  @IsString()
  @Length(2, 80)
  @Matches(/^[A-Z0-9_]+$/)
  stageCode!: string;

  @IsString()
  @Length(2, 160)
  stageName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  stageOrder!: number;

  @IsIn(["qualifier", "league", "quarter_final", "semi_final", "final", "custom"])
  stageType!: "qualifier" | "league" | "quarter_final" | "semi_final" | "final" | "custom";

  @IsDateString()
  startsOn!: string;

  @IsDateString()
  endsOn!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateCompetitionTeamDto)
  teams!: CreateCompetitionTeamDto[];
}
```

Create `finalize-competition-stage.dto.ts`:

```ts
import { IsBoolean, IsOptional, IsString, Length } from "class-validator";

export class FinalizeCompetitionStageDto {
  @IsBoolean()
  allowOverride!: boolean;

  @IsOptional()
  @IsString()
  @Length(12, 1000)
  overrideJustification?: string;
}
```

Create `list-competitions.query.ts`:

```ts
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class ListCompetitionsQueryDto {
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
}
```

- [ ] **Step 2: Add controller**

Create `competition.controller.ts`:

```ts
import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { CompetitionService } from "../application/competition.service";
import { CreateCompetitionDto } from "./dto/create-competition.dto";
import { CreateCompetitionStageDto } from "./dto/create-competition-stage.dto";
import { FinalizeCompetitionStageDto } from "./dto/finalize-competition-stage.dto";
import { ListCompetitionsQueryDto } from "./dto/list-competitions.query";

type CompetitionRequest = {
  user: {
    userId: string;
    scope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
  };
};

@Controller("competitions")
export class CompetitionController {
  constructor(private readonly competitionService: CompetitionService) {}

  @Get()
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN", "REPORT_VIEWER", "REGION_MANAGER", "STORE_MANAGER", "STORE_PERSONNEL")
  async listCompetitions(@Req() request: CompetitionRequest, @Query() query: ListCompetitionsQueryDto) {
    return this.competitionService.listCompetitions({
      actorScope: request.user.scope,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get(":competitionId")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN", "REPORT_VIEWER", "REGION_MANAGER", "STORE_MANAGER", "STORE_PERSONNEL")
  async getCompetition(@Req() request: CompetitionRequest, @Param("competitionId") competitionId: string) {
    return this.competitionService.getCompetitionDetail({
      competitionId,
      actorScope: request.user.scope,
      includeStoreDetails: true,
    });
  }

  @Post()
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async createCompetition(@Req() request: CompetitionRequest, @Body() body: CreateCompetitionDto) {
    return this.competitionService.createCompetition({
      actorUserId: request.user.userId,
      ...body,
    });
  }

  @Post(":competitionId/stages")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async createStage(
    @Req() request: CompetitionRequest,
    @Param("competitionId") competitionId: string,
    @Body() body: CreateCompetitionStageDto,
  ) {
    return this.competitionService.createStage({
      actorUserId: request.user.userId,
      competitionId,
      ...body,
    });
  }

  @Post("stages/:stageId/recalculate")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async recalculateStage(@Req() request: CompetitionRequest, @Param("stageId") stageId: string) {
    return this.competitionService.recalculateStage({
      actorUserId: request.user.userId,
      stageId,
    });
  }

  @Patch("stages/:stageId/finalize")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async finalizeStage(
    @Req() request: CompetitionRequest,
    @Param("stageId") stageId: string,
    @Body() body: FinalizeCompetitionStageDto,
  ) {
    return this.competitionService.finalizeStage({
      actorUserId: request.user.userId,
      stageId,
      allowOverride: body.allowOverride,
      overrideJustification: body.overrideJustification,
    });
  }
}
```

- [ ] **Step 3: Register controller and providers**

Modify `store-ops.module.ts` imports and arrays:

```ts
import { CompetitionController } from "./web/competition.controller";
import { CompetitionService } from "./application/competition.service";
import { CompetitionRepository } from "./infrastructure/competition.repository";
```

Add to module arrays:

```ts
controllers: [
  CompetitionController,
],
providers: [
  CompetitionService,
  CompetitionRepository,
],
exports: [
  CompetitionService,
  CompetitionRepository,
],
```

- [ ] **Step 4: Add HTTP contract tests**

Create `backend/nestjs/test/integration/competition.e2e-spec.ts` with tests that cover:

```ts
it("allows HR_ADMIN to create a draft competition", async () => {
  await request(app.getHttpServer())
    .post("/competitions")
    .set("x-user-id", "11111111-1111-4111-8111-111111111111")
    .set("x-role-codes", "HR_ADMIN")
    .set("x-read-company-ids", "00000000-0000-0000-0000-000000000001")
    .send({
      competitionCode: "MAY_REGION_CHALLENGE",
      competitionName: "May Region Challenge",
      competitionType: "region_challenge",
      startsOn: "2026-05-01",
      endsOn: "2026-05-31",
    })
    .expect(201)
    .expect(({ body }) => {
      expect(body.status).toBe("created");
      expect(body.data.competition.competitionCode).toBe("MAY_REGION_CHALLENGE");
    });
});

it("rejects finalization with warnings when override justification is missing", async () => {
  await request(app.getHttpServer())
    .patch("/competitions/stages/22222222-2222-4222-8222-222222222222/finalize")
    .set("x-user-id", "11111111-1111-4111-8111-111111111111")
    .set("x-role-codes", "HR_ADMIN")
    .set("x-read-company-ids", "00000000-0000-0000-0000-000000000001")
    .send({ allowOverride: false })
    .expect(400);
});

it("blocks REPORT_VIEWER from competition write actions", async () => {
  await request(app.getHttpServer())
    .post("/competitions")
    .set("x-user-id", "11111111-1111-4111-8111-111111111111")
    .set("x-role-codes", "REPORT_VIEWER")
    .set("x-read-company-ids", "00000000-0000-0000-0000-000000000001")
    .send({
      competitionCode: "REPORT_VIEWER_BLOCKED",
      competitionName: "Blocked",
      competitionType: "region_challenge",
      startsOn: "2026-05-01",
      endsOn: "2026-05-31",
    })
    .expect(403);
});
```

- [ ] **Step 5: Run backend API tests**

Run:

```powershell
cd backend/nestjs
npm.cmd test -- test/integration/competition.e2e-spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit API surface**

Run:

```powershell
git add backend/nestjs/src/modules/store-ops/web/competition.controller.ts backend/nestjs/src/modules/store-ops/web/dto/create-competition.dto.ts backend/nestjs/src/modules/store-ops/web/dto/create-competition-stage.dto.ts backend/nestjs/src/modules/store-ops/web/dto/finalize-competition-stage.dto.ts backend/nestjs/src/modules/store-ops/web/dto/list-competitions.query.ts backend/nestjs/src/modules/store-ops/store-ops.module.ts backend/nestjs/test/integration/competition.e2e-spec.ts
git commit -m "feat: expose competition stage api"
```

---

### Task 5: Frontend Admin Competition Surface

**Files:**
- Create: `admin-web/src/features/competitions/api.ts`
- Create: `admin-web/src/pages/CompetitionDashboardPage.tsx`
- Modify: `admin-web/src/App.tsx`

- [ ] **Step 1: Add frontend API client**

Create `admin-web/src/features/competitions/api.ts`:

```ts
import { fetchJson, sendJson } from '../../lib/api'

type ListResponse<T> = {
  items: T[]
  meta: {
    count: number
    total: number
    limit: number
    offset: number
  }
}

export type CompetitionSummary = {
  competitionId: string
  competitionCode: string
  competitionName: string
  description: string | null
  competitionType: 'region_challenge' | 'region_league' | 'campaign'
  lifecycleState: 'draft' | 'published' | 'active' | 'completed' | 'cancelled'
  startsOn: string
  endsOn: string
}

export type CompetitionStageSummary = {
  competitionStageId: string
  competitionId: string
  stageCode: string
  stageName: string
  stageOrder: number
  stageType: 'qualifier' | 'league' | 'quarter_final' | 'semi_final' | 'final' | 'custom'
  startsOn: string
  endsOn: string
  lifecycleState: 'draft' | 'scheduled' | 'active' | 'awaiting_review' | 'finalized' | 'cancelled'
  finalizationState: 'clean' | 'warnings_present' | 'overridden' | null
}

export type CompetitionTeamScore = {
  stageId: string
  teamId: string
  teamCode: string
  teamName: string
  snapshotDate: string
  scoreValue: number | null
  validStoreCount: number
  totalStoreCount: number
  coverageRate: number
  rankPosition: number | null
  rankingPopulation: number
}

export type CompetitionWarning = {
  warningId: string
  stageId: string
  teamId: string | null
  storeId: string | null
  warningCode: 'missing_daily_store_data' | 'missing_bm_checklist' | 'missing_vm_checklist'
  warningLevel: 'info' | 'warning' | 'blocker'
  periodStart: string
  periodEnd: string
  message: string
  resolvedAt: string | null
}

export type CompetitionDetail = {
  competition: CompetitionSummary
  stages: CompetitionStageSummary[]
  teams: Array<{
    competitionTeamId: string
    teamCode: string
    teamName: string
    teamOrder: number
    stores: Array<{
      storeId: string
      storeCode: string
      storeName: string
      regionId: string
    }>
  }>
  latestScores: CompetitionTeamScore[]
  warnings: CompetitionWarning[]
}

export async function listCompetitions() {
  return fetchJson<ListResponse<CompetitionSummary>>('/api/competitions')
}

export async function getCompetition(competitionId: string) {
  return fetchJson<CompetitionDetail>(`/api/competitions/${competitionId}`)
}

export async function createCompetition(payload: {
  competitionCode: string
  competitionName: string
  description?: string
  competitionType: CompetitionSummary['competitionType']
  startsOn: string
  endsOn: string
}) {
  return sendJson('/api/competitions', payload)
}

export async function recalculateStage(stageId: string) {
  return sendJson(`/api/competitions/stages/${stageId}/recalculate`, {})
}

export async function finalizeStage(stageId: string, payload: {
  allowOverride: boolean
  overrideJustification?: string
}) {
  return sendJson(`/api/competitions/stages/${stageId}/finalize`, payload, 'PATCH')
}
```

- [ ] **Step 2: Add dashboard page**

Create `CompetitionDashboardPage.tsx` with:

```tsx
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trophy, RefreshCw, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { KeyValue, ScreenState, StatusPill } from '../components/dashboard-primitives'
import {
  createCompetition,
  finalizeStage,
  getCompetition,
  listCompetitions,
  recalculateStage,
  type CompetitionSummary,
} from '../features/competitions/api'

export function CompetitionDashboardPage() {
  const queryClient = useQueryClient()
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string | null>(null)
  const [overrideJustification, setOverrideJustification] = useState('')

  const competitionsQuery = useQuery({
    queryKey: ['competitions'],
    queryFn: listCompetitions,
    staleTime: 30_000,
  })

  const selectedCompetition = useMemo(
    () => competitionsQuery.data?.items.find((item) => item.competitionId === selectedCompetitionId)
      ?? competitionsQuery.data?.items[0]
      ?? null,
    [competitionsQuery.data?.items, selectedCompetitionId],
  )

  const detailQuery = useQuery({
    queryKey: ['competition-detail', selectedCompetition?.competitionId],
    queryFn: () => getCompetition(selectedCompetition!.competitionId),
    enabled: Boolean(selectedCompetition),
    staleTime: 15_000,
  })

  const createMutation = useMutation({
    mutationFn: () => createCompetition({
      competitionCode: `REGION_CHALLENGE_${new Date().toISOString().slice(0, 10).replaceAll('-', '_')}`,
      competitionName: 'Region Challenge Draft',
      competitionType: 'region_challenge',
      startsOn: new Date().toISOString().slice(0, 10),
      endsOn: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['competitions'] }),
  })

  const recalcMutation = useMutation({
    mutationFn: (stageId: string) => recalculateStage(stageId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['competition-detail'] }),
  })

  const finalizeMutation = useMutation({
    mutationFn: (stageId: string) => finalizeStage(stageId, {
      allowOverride: overrideJustification.trim().length >= 12,
      overrideJustification: overrideJustification.trim() || undefined,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['competition-detail'] }),
  })

  if (competitionsQuery.isLoading) {
    return <ScreenState title="Competitions are loading" description="The admin competition surface is checking current stages." />
  }

  if (competitionsQuery.isError) {
    return <ScreenState title="Competition surface could not load" description="Check the backend competition API and session roles." />
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Competition Control</div>
            <h2>Region challenge stages</h2>
          </div>
          <button className="primary-button" type="button" onClick={() => createMutation.mutate()}>
            <Trophy size={16} />
            New draft
          </button>
        </div>

        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Competition</th>
                <th>Type</th>
                <th>State</th>
                <th>Period</th>
              </tr>
            </thead>
            <tbody>
              {(competitionsQuery.data?.items ?? []).map((competition: CompetitionSummary) => (
                <tr key={competition.competitionId} onClick={() => setSelectedCompetitionId(competition.competitionId)}>
                  <td>{competition.competitionName}</td>
                  <td>{competition.competitionType}</td>
                  <td><StatusPill tone="neutral">{competition.lifecycleState}</StatusPill></td>
                  <td>{competition.startsOn} / {competition.endsOn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {detailQuery.data ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Live Standing</div>
              <h3>{detailQuery.data.competition.competitionName}</h3>
            </div>
            <StatusPill tone={detailQuery.data.warnings.length > 0 ? 'warning' : 'calm'}>
              {detailQuery.data.warnings.length > 0 ? `${detailQuery.data.warnings.length} warnings` : 'Clean'}
            </StatusPill>
          </div>

          <div className="metric-grid">
            {detailQuery.data.latestScores.map((score) => (
              <div className="metric-card" key={`${score.teamId}-${score.snapshotDate}`}>
                <div className="metric-card-icon"><Trophy size={18} /></div>
                <KeyValue label={score.teamName} value={score.scoreValue === null ? 'Partial' : score.scoreValue.toFixed(2)} />
                <p>Rank {score.rankPosition ?? '-'} / {score.rankingPopulation}</p>
                <p>Coverage {score.validStoreCount}/{score.totalStoreCount}</p>
              </div>
            ))}
          </div>

          <div className="action-row">
            {detailQuery.data.stages.map((stage) => (
              <button className="secondary-button" key={stage.competitionStageId} type="button" onClick={() => recalcMutation.mutate(stage.competitionStageId)}>
                <RefreshCw size={16} />
                Recalculate {stage.stageCode}
              </button>
            ))}
          </div>

          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Warning</th>
                  <th>Level</th>
                  <th>Period</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {detailQuery.data.warnings.map((warning) => (
                  <tr key={warning.warningId}>
                    <td><ShieldAlert size={16} /> {warning.warningCode}</td>
                    <td>{warning.warningLevel}</td>
                    <td>{warning.periodStart} / {warning.periodEnd}</td>
                    <td>{warning.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="form-grid">
            <label>
              Override justification
              <textarea value={overrideJustification} onChange={(event) => setOverrideJustification(event.target.value)} />
            </label>
            {detailQuery.data.stages.map((stage) => (
              <button className="primary-button" key={stage.competitionStageId} type="button" onClick={() => finalizeMutation.mutate(stage.competitionStageId)}>
                <CheckCircle2 size={16} />
                Finalize {stage.stageCode}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 3: Add route and navigation**

Modify `App.tsx`:

```tsx
import { BarChart3, Bell, DatabaseZap, Fingerprint, KeyRound, Layers3, ShieldCheck, SlidersHorizontal, Target, Trophy } from 'lucide-react'
```

Add lazy route:

```tsx
const CompetitionDashboardPage = lazy(() => import('./pages/CompetitionDashboardPage').then((module) => ({ default: module.CompetitionDashboardPage })))
```

Add admin nav item after Inbox:

```tsx
{
  to: '/admin/competitions',
  icon: <Trophy size={18} />,
  label: 'Competitions',
  roles: ['SUPER_ADMIN', 'HR_ADMIN', 'REPORT_VIEWER', 'REGION_MANAGER'],
},
```

Add route:

```tsx
<Route path="/admin/competitions" element={<CompetitionDashboardPage />} />
```

- [ ] **Step 4: Run frontend lint/build**

Run:

```powershell
cd admin-web
npm.cmd run lint
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 5: Commit frontend surface**

Run:

```powershell
git add admin-web/src/features/competitions/api.ts admin-web/src/pages/CompetitionDashboardPage.tsx admin-web/src/App.tsx
git commit -m "feat: add competition admin surface"
```

---

### Task 6: Frontend Smoke And Release Gates

**Files:**
- Create: `admin-web/e2e/competition-surfaces.spec.ts`

- [ ] **Step 1: Add Playwright smoke test**

Create `competition-surfaces.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('admin competitions surface shows live scores and warnings', async ({ page }) => {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      json: {
        user: {
          userId: '11111111-1111-4111-8111-111111111111',
          username: 'hr.admin',
          email: 'hr.admin@example.com',
          roleCodes: ['HR_ADMIN'],
        },
        scopeSummary: { companyCount: 1, regionCount: 0, storeCount: 0 },
        readScope: {
          companyIds: ['00000000-0000-0000-0000-000000000001'],
          regionIds: [],
          storeIds: [],
        },
        actionScope: { assignedStoreIds: [] },
      },
    })
  })

  await page.route('**/api/competitions', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: {
          items: [{
            competitionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            competitionCode: 'APRIL_REGION_CHALLENGE',
            competitionName: 'April Region Challenge',
            description: null,
            competitionType: 'region_challenge',
            lifecycleState: 'active',
            startsOn: '2026-04-22',
            endsOn: '2026-04-24',
          }],
          meta: { count: 1, total: 1, limit: 50, offset: 0 },
        },
      })
      return
    }

    await route.fulfill({ json: { status: 'created', data: {} } })
  })

  await page.route('**/api/competitions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', async (route) => {
    await route.fulfill({
      json: {
        competition: {
          competitionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          competitionCode: 'APRIL_REGION_CHALLENGE',
          competitionName: 'April Region Challenge',
          description: null,
          competitionType: 'region_challenge',
          lifecycleState: 'active',
          startsOn: '2026-04-22',
          endsOn: '2026-04-24',
        },
        stages: [{
          competitionStageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          competitionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          stageCode: 'QUALIFIER',
          stageName: 'Qualifier',
          stageOrder: 1,
          stageType: 'qualifier',
          startsOn: '2026-04-22',
          endsOn: '2026-04-24',
          lifecycleState: 'active',
          finalizationState: null,
        }],
        teams: [],
        latestScores: [{
          stageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          teamId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          teamCode: 'MARMARA_DEMO',
          teamName: 'Marmara Demo',
          snapshotDate: '2026-04-22',
          scoreValue: 92.45,
          validStoreCount: 1,
          totalStoreCount: 1,
          coverageRate: 1,
          rankPosition: 1,
          rankingPopulation: 2,
        }],
        warnings: [{
          warningId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          stageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          teamId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          storeId: '00000000-0000-0000-0000-000000000101',
          warningCode: 'missing_bm_checklist',
          warningLevel: 'warning',
          periodStart: '2026-04-22',
          periodEnd: '2026-04-22',
          message: 'missing_bm_checklist for store DEMO-101 on 2026-04-22',
          resolvedAt: null,
        }],
      },
    })
  })

  await page.goto('/admin/competitions')

  await expect(page.getByText('April Region Challenge')).toBeVisible()
  await expect(page.getByText('Marmara Demo')).toBeVisible()
  await expect(page.getByText('92.45')).toBeVisible()
  await expect(page.getByText('missing_bm_checklist')).toBeVisible()
  await expect(page.getByRole('button', { name: /Recalculate QUALIFIER/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Finalize QUALIFIER/ })).toBeVisible()
})
```

- [ ] **Step 2: Run frontend release check**

Run:

```powershell
cd admin-web
npm.cmd run check:release
```

Expected: PASS.

- [ ] **Step 3: Commit smoke coverage**

Run:

```powershell
git add admin-web/e2e/competition-surfaces.spec.ts
git commit -m "test: cover competition admin surface"
```

---

### Task 7: Full Verification, Handoff, And Browser Check

**Files:**
- Modify: `current-state.md`

- [ ] **Step 1: Run backend release check**

Run:

```powershell
cd backend/nestjs
npm.cmd run check:release
```

Expected: lint PASS, Jest PASS, build PASS, runtime audit reports `found 0 vulnerabilities`.

- [ ] **Step 2: Run frontend release check**

Run:

```powershell
cd admin-web
npm.cmd run check:release
```

Expected: lint PASS, build PASS, Playwright smoke PASS, runtime audit reports `found 0 vulnerabilities`.

- [ ] **Step 3: Browser smoke**

Start or reuse local services:

```powershell
cd backend/nestjs
npm.cmd run start:dev
```

```powershell
cd admin-web
npm.cmd run dev
```

Open:

```text
http://localhost:5173/admin/competitions
```

Expected visible evidence:

- Admin navigation includes `Competitions`.
- HR/Admin session can see the competitions list.
- Live standing cards show team score, rank, and coverage.
- Warning table shows missing checklist warnings.
- Recalculate button returns success.
- Finalize without a 12+ character justification fails when warnings exist.
- Finalize with a justification succeeds and leaves audit metadata.

- [ ] **Step 4: Update current-state**

Append a section to `current-state.md`:

```md
## Son Competition + Stage Foundation

25 Nisan 2026 itibariyla Competition + Stage modeli uygulandi.

- `HR_ADMIN` rolu ve competition read/manage permissionlari eklendi.
- Competition, stage, team template, team membership, store score snapshot, team score snapshot ve warning tablolari eklendi.
- V1 skor modeli kapali store KPI snapshot kaynaklarindan hesaplanir.
- Takim skoru stage icindeki valid store-day skorlarinin ortalamasidir.
- Eksik gunluk magaza verisi ve eksik BM/VM checklist verisi uyaridir; sifir puan yazilmaz.
- Checklist agirligi baska metriklere dagitilmaz.
- IK/Admin finalization warning varken yazili override gerekceresi ister ve audit yazar.
- Admin frontend `/admin/competitions` yuzeyi eklendi.
- Backend release check ve frontend release check gecti.

Siradaki mantikli adim: store ve region manager competition read yuzeylerini scoped contribution detaylariyla acmak.
```

- [ ] **Step 5: Commit handoff**

Run:

```powershell
git add current-state.md
git commit -m "docs: record competition stage foundation"
```

- [ ] **Step 6: Final git sanity check**

Run:

```powershell
git status --short
```

Expected: either clean tree or only intentional local runtime files ignored by `.gitignore`.

## Self-Review Checklist

- Spec coverage:
  - Competition + Stage model: Task 1, Task 3, Task 4.
  - IK/Admin ownership: Task 1, Task 4, Task 5.
  - Team templates and manual store membership: Task 1, Task 3, Task 4.
  - V1 average daily store score: Task 3.
  - Daily metrics and monthly checklist metrics: Task 1 seed, Task 3 query.
  - Missing data warnings without zero scoring: Task 3 query, Task 6 smoke.
  - Finalization override and audit: Task 2, Task 3, Task 4.
  - Scoped read protection: Task 2, Task 4.
  - Release checks and browser verification: Task 6, Task 7.
- Type consistency:
  - Backend contracts use `competitionId`, `competitionStageId`, `teamId`, `stageId`, and `warningCode`.
  - Frontend API mirrors backend response names.
  - Database uses snake case only inside repository mapping.
- Scope:
  - Rewards, badges, bracket generation, automatic fixtures, and personnel contribution scoring are not part of this V1 foundation.
