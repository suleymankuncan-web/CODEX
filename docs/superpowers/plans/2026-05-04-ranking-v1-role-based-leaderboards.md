# Ranking V1 Role-Based Leaderboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a role-aware ranking surface where store personnel and store managers see motivational Top 100 Turkey rankings, while region managers and super admins can page through all Turkey rankings with filters and detail KPI values.

**Architecture:** Add a new Ranking V1 read contract and endpoint instead of continuing to overload `/reports/leaderboards/closed`. The backend owns visibility, masking, Top 100 limits, pagination, and filters; the frontend only renders fields that are returned. Store and personnel rankings share the same monthly live KPI score rules already used by `/reports/my-performance` and `/reports/store-kpi-highlights`.

**Tech Stack:** NestJS, Postgres via `ReportingRepository`, Jest, React, TanStack Query, TypeScript.

---

## Product Rules

1. Default view is Turkey-wide for every allowed role.
2. Store personnel can see:
   - Turkey Top 100 store rankings, summary only.
   - Turkey Top 100 personnel rankings, summary only.
   - Their own personnel position even when outside Top 100.
3. Store managers can see:
   - Turkey Top 100 store rankings, summary only.
   - Turkey Top 100 personnel rankings, summary only.
   - Their own store position even when outside Top 100.
   - All personnel in their own store with detail KPI values.
4. Region managers and super admins can see:
   - All Turkey store rankings, paginated.
   - All Turkey personnel rankings, paginated.
   - Detail KPI values on all rows.
   - Filter bar: region manager, region, store, personnel search, period.
5. Lower roles must not receive hidden detail fields in API payloads. Frontend hiding is not enough.
6. Top 100 applies only to low roles. Privileged roles use pagination, default `limit=100`, max `limit=500`.
7. Score is safe to show in global summary lists for every role. Raw KPI metrics are detail fields and must be masked for lower roles outside their own scope.

## Role Matrix

Use the current role catalog:

- Low roles: `STORE_PERSONNEL`, `STORE_MANAGER`
- Privileged roles: `REGION_MANAGER`, `SUPER_ADMIN`

`REPORT_VIEWER`, `AUDITOR`, and future executive roles are outside Ranking V1 unless product explicitly adds them later.

## File Structure

Create:

- `backend/nestjs/src/modules/store-ops/application/ranking.contract.ts`
  - API response and row types.
- `backend/nestjs/src/modules/store-ops/application/ranking-access.policy.ts`
  - Role-based visibility and pagination rules.
- `backend/nestjs/src/modules/store-ops/application/ranking.service.ts`
  - Ranking orchestration, scoring, masking, own-position rows, own-store personnel details.
- `backend/nestjs/src/modules/store-ops/web/dto/get-ranking.query.ts`
  - Query validation for period, filters, pagination.
- `backend/nestjs/src/modules/store-ops/application/ranking-access.policy.spec.ts`
  - Unit tests for role rules.
- `backend/nestjs/src/modules/store-ops/application/ranking.service.spec.ts`
  - Unit tests for Top 100, masking, privileged full pagination, manager own-store detail.

Modify:

- `backend/nestjs/src/modules/store-ops/store-ops.module.ts`
  - Register `RankingService`.
- `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts`
  - Add `GET /reports/rankings`.
- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`
  - Add raw monthly KPI row readers for store and personnel rankings plus filter lookup helpers.
- `admin-web/src/features/reports/api.ts`
  - Add Ranking V1 API types and `getRankings`.
- `admin-web/src/pages/StoreRankingsPage.tsx`
  - Replace current single-list page with role-aware ranking sections.

Do not remove `/reports/leaderboards/closed` in this plan. Keep it for compatibility until Ranking V1 is verified in staging.

---

## Task 1: Ranking Access Policy

**Files:**
- Create: `backend/nestjs/src/modules/store-ops/application/ranking-access.policy.ts`
- Test: `backend/nestjs/src/modules/store-ops/application/ranking-access.policy.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `ranking-access.policy.spec.ts`:

```ts
import {
  resolveRankingAccess,
  sanitizeRankingPagination,
} from "./ranking-access.policy";

describe("ranking access policy", () => {
  it("caps store personnel to Top 100 summary-only rankings", () => {
    expect(
      resolveRankingAccess({
        roleCodes: ["STORE_PERSONNEL"],
        requestedLimit: 500,
        requestedOffset: 300,
      }),
    ).toEqual({
      isPrivileged: false,
      canSeeGlobalDetails: false,
      globalLimit: 100,
      globalOffset: 0,
      globalMode: "top100",
      canSeeManagedStorePersonnelDetails: false,
    });
  });

  it("allows store managers to see own-store personnel detail but keeps global Top 100 summary-only", () => {
    expect(
      resolveRankingAccess({
        roleCodes: ["STORE_MANAGER"],
        requestedLimit: 300,
        requestedOffset: 200,
      }),
    ).toEqual({
      isPrivileged: false,
      canSeeGlobalDetails: false,
      globalLimit: 100,
      globalOffset: 0,
      globalMode: "top100",
      canSeeManagedStorePersonnelDetails: true,
    });
  });

  it("allows region managers and super admins to page through full rankings with details", () => {
    expect(
      resolveRankingAccess({
        roleCodes: ["REGION_MANAGER"],
        requestedLimit: 700,
        requestedOffset: 200,
      }),
    ).toEqual({
      isPrivileged: true,
      canSeeGlobalDetails: true,
      globalLimit: 500,
      globalOffset: 200,
      globalMode: "full",
      canSeeManagedStorePersonnelDetails: true,
    });

    expect(
      resolveRankingAccess({
        roleCodes: ["SUPER_ADMIN"],
        requestedLimit: 50,
        requestedOffset: 100,
      }).globalMode,
    ).toBe("full");
  });

  it("normalizes pagination defaults", () => {
    expect(sanitizeRankingPagination({ limit: undefined, offset: undefined })).toEqual({
      limit: 100,
      offset: 0,
    });
    expect(sanitizeRankingPagination({ limit: 0, offset: -1 })).toEqual({
      limit: 100,
      offset: 0,
    });
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```powershell
npm.cmd test -- src/modules/store-ops/application/ranking-access.policy.spec.ts --runInBand
```

Expected: FAIL because `ranking-access.policy.ts` does not exist.

- [ ] **Step 3: Implement the policy**

Create `ranking-access.policy.ts`:

```ts
export type RankingGlobalMode = "top100" | "full";

export type RankingAccess = {
  isPrivileged: boolean;
  canSeeGlobalDetails: boolean;
  globalLimit: number;
  globalOffset: number;
  globalMode: RankingGlobalMode;
  canSeeManagedStorePersonnelDetails: boolean;
};

const privilegedRoles = new Set(["REGION_MANAGER", "SUPER_ADMIN"]);

export function sanitizeRankingPagination(input: {
  limit?: number;
  offset?: number;
}) {
  const requestedLimit =
    Number.isInteger(input.limit) && input.limit && input.limit > 0
      ? input.limit
      : 100;
  const requestedOffset =
    Number.isInteger(input.offset) && input.offset && input.offset > 0
      ? input.offset
      : 0;

  return {
    limit: Math.min(requestedLimit, 500),
    offset: requestedOffset,
  };
}

export function resolveRankingAccess(input: {
  roleCodes: string[];
  requestedLimit?: number;
  requestedOffset?: number;
}): RankingAccess {
  const isPrivileged = input.roleCodes.some((role) => privilegedRoles.has(role));
  const hasStoreManagerRole = input.roleCodes.includes("STORE_MANAGER");
  const pagination = sanitizeRankingPagination({
    limit: input.requestedLimit,
    offset: input.requestedOffset,
  });

  if (!isPrivileged) {
    return {
      isPrivileged: false,
      canSeeGlobalDetails: false,
      globalLimit: 100,
      globalOffset: 0,
      globalMode: "top100",
      canSeeManagedStorePersonnelDetails: hasStoreManagerRole,
    };
  }

  return {
    isPrivileged: true,
    canSeeGlobalDetails: true,
    globalLimit: pagination.limit,
    globalOffset: pagination.offset,
    globalMode: "full",
    canSeeManagedStorePersonnelDetails: true,
  };
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run:

```powershell
npm.cmd test -- src/modules/store-ops/application/ranking-access.policy.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/nestjs/src/modules/store-ops/application/ranking-access.policy.ts backend/nestjs/src/modules/store-ops/application/ranking-access.policy.spec.ts
git commit -m "Add ranking access policy"
```

---

## Task 2: Ranking Contract And Query DTO

**Files:**
- Create: `backend/nestjs/src/modules/store-ops/application/ranking.contract.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/get-ranking.query.ts`

- [ ] **Step 1: Create the contract**

Create `ranking.contract.ts`:

```ts
export type RankingSubject = "store" | "personnel";
export type RankingPeriodType = "monthly";
export type RankingVisibility = "summary" | "detail";

export type RankingMetricValue = {
  code: string;
  label: string;
  actualValue: number | null;
  targetValue?: number | null;
  benchmarkValue?: number | null;
  contributionValue?: number | null;
};

export type StoreRankingRow = {
  subject: "store";
  storeId: string;
  storeName: string | null;
  regionId: string | null;
  regionName: string | null;
  regionManagerUserId: string | null;
  regionManagerName: string | null;
  rank: number;
  population: number;
  scoreValue: number;
  visibility: RankingVisibility;
  metrics?: RankingMetricValue[];
};

export type PersonnelRankingRow = {
  subject: "personnel";
  employeeId: string;
  displayName: string;
  storeId: string | null;
  storeName: string | null;
  regionId: string | null;
  regionName: string | null;
  regionManagerUserId: string | null;
  regionManagerName: string | null;
  rank: number;
  population: number;
  storeRank: number | null;
  storePopulation: number;
  scoreValue: number;
  visibility: RankingVisibility;
  metrics?: RankingMetricValue[];
};

export type RankingFilterOption = {
  id: string;
  label: string;
};

export type RankingResponse = {
  source: {
    mode: "live";
    periodType: RankingPeriodType;
    periodStart: string | null;
    periodEnd: string | null;
  };
  access: {
    globalMode: "top100" | "full";
    canSeeGlobalDetails: boolean;
    canSeeManagedStorePersonnelDetails: boolean;
  };
  filters: {
    regionManagers: RankingFilterOption[];
    regions: RankingFilterOption[];
    stores: RankingFilterOption[];
  };
  storeLeaderboard: {
    items: StoreRankingRow[];
    currentStore: StoreRankingRow | null;
    meta: {
      total: number;
      limit: number;
      offset: number;
    };
  };
  personnelLeaderboard: {
    items: PersonnelRankingRow[];
    currentEmployee: PersonnelRankingRow | null;
    managedStorePersonnel: PersonnelRankingRow[];
    meta: {
      total: number;
      limit: number;
      offset: number;
    };
  };
  availablePeriods: Array<{
    periodType: RankingPeriodType;
    periodStart: string;
    periodEnd: string;
  }>;
};
```

- [ ] **Step 2: Create the query DTO**

Create `get-ranking.query.ts`:

```ts
import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { IsPostgresUuid } from "../../../../shared/validation/postgres-uuid";

export class GetRankingQueryDto {
  @IsOptional()
  @IsIn(["monthly"])
  periodType?: "monthly";

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsPostgresUuid()
  regionManagerUserId?: string;

  @IsOptional()
  @IsPostgresUuid()
  regionId?: string;

  @IsOptional()
  @IsPostgresUuid()
  storeId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
```

- [ ] **Step 3: Run typecheck through backend build**

Run:

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add backend/nestjs/src/modules/store-ops/application/ranking.contract.ts backend/nestjs/src/modules/store-ops/web/dto/get-ranking.query.ts
git commit -m "Add ranking v1 contracts"
```

---

## Task 3: Repository Raw Ranking Readers

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`
- Test indirectly through Task 4 service tests.

- [ ] **Step 1: Add repository methods**

Add methods near existing KPI actual readers:

```ts
async getLatestMonthlyRankingPeriod(input: {
  metricCodes: string[];
  periodStart?: string;
}) {
  const params: unknown[] = [input.metricCodes];
  const clauses = [
    `ka.period_type = 'monthly'`,
    `kd.kpi_code = ANY($1::text[])`,
  ];

  if (input.periodStart) {
    params.push(input.periodStart);
    clauses.push(`ka.period_start = $${params.length}::date`);
  }

  const result = await this.databaseService.query<{
    period_start: string;
    period_end: string;
  }>(
    `
      SELECT ka.period_start::text AS period_start,
             ka.period_end::text AS period_end
      FROM ops.kpi_actual ka
      INNER JOIN ops.kpi_definition kd ON kd.kpi_id = ka.kpi_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY ka.period_end DESC, ka.period_start DESC
      LIMIT 1
    `,
    params,
  );

  return result.rows[0] ?? null;
}
```

Then add `listRankingStoreKpiRows` and `listRankingPersonnelKpiRows`. They must return all raw KPI rows for the selected monthly period and include:

- store/personnel id
- display names
- store name
- region id/name where available
- region manager user id/name where available if the assignment model can join it
- kpi code/name
- actual value
- target value where relevant

Use the same `ops.kpi_actual`, `ops.kpi_definition`, `ops.store`, and `ops.employee` joins already used by `getStorePerformanceRows`, `getPeerStorePerformanceRows`, and `getPeerEmployeePerformanceRows`.

- [ ] **Step 2: Add filter option methods**

Add `listRankingFilterOptions()` returning region managers, regions, and stores from current active data. If region-manager ownership is not modeled as a direct table relation yet, populate `regionManagers` from current role/action-scope assignments in the existing auth tables used by `AuthContextService`; otherwise return an empty `regionManagers` array in V1 and keep region/store filters working.

- [ ] **Step 3: Run backend build**

Run:

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts
git commit -m "Add ranking repository readers"
```

---

## Task 4: Ranking Service With Masking And Top 100

**Files:**
- Create: `backend/nestjs/src/modules/store-ops/application/ranking.service.ts`
- Test: `backend/nestjs/src/modules/store-ops/application/ranking.service.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/store-ops.module.ts`

- [ ] **Step 1: Write failing service tests**

Create `ranking.service.spec.ts` with these tests:

1. `STORE_PERSONNEL` receives Top 100 summary-only store/personnel rows and own row outside Top 100.
2. `STORE_MANAGER` receives Top 100 summary-only globals plus all own-store personnel detail rows.
3. `REGION_MANAGER` receives paginated full Turkey rows with `metrics` included.
4. Filter input narrows both store and personnel leaderboards.

Use in-memory repository mocks with 105 personnel rows and 105 store rows. Assert:

```ts
expect(result.personnelLeaderboard.items).toHaveLength(100);
expect(result.personnelLeaderboard.items[0].metrics).toBeUndefined();
expect(result.personnelLeaderboard.currentEmployee?.rank).toBe(105);
expect(result.personnelLeaderboard.currentEmployee?.metrics).toBeUndefined();
```

For manager detail:

```ts
expect(result.personnelLeaderboard.managedStorePersonnel.every((row) => row.visibility === "detail")).toBe(true);
expect(result.personnelLeaderboard.managedStorePersonnel[0].metrics?.length).toBeGreaterThan(0);
```

For privileged:

```ts
expect(result.access.globalMode).toBe("full");
expect(result.personnelLeaderboard.items).toHaveLength(50);
expect(result.personnelLeaderboard.items[0].metrics?.length).toBeGreaterThan(0);
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```powershell
npm.cmd test -- src/modules/store-ops/application/ranking.service.spec.ts --runInBand
```

Expected: FAIL because `RankingService` does not exist.

- [ ] **Step 3: Implement `RankingService`**

Service responsibilities:

- Resolve access with `resolveRankingAccess`.
- Resolve monthly period with `getLatestMonthlyRankingPeriod`.
- Fetch raw store/personnel KPI rows for the selected period.
- Score stores with `storeKpiScoreProfile`.
- Score personnel with `personnelKpiScoreProfile`.
- Rank Turkey-wide before applying pagination or Top 100.
- Apply filters before final ranking for privileged filter views.
- For lower roles:
  - return only first 100 rows in global lists.
  - remove `metrics` from global rows.
  - still return `currentStore` and `currentEmployee` if available outside Top 100.
- For store manager:
  - add `managedStorePersonnel` for `assignedStoreIds[0]`.
  - include metrics on managed store personnel.
- For privileged roles:
  - return paginated items with metrics.
  - include filter option payloads.

Add a small helper in the service:

```ts
private maskRow<T extends { visibility: "summary" | "detail"; metrics?: unknown[] }>(
  row: T,
  visibility: "summary" | "detail",
) {
  if (visibility === "detail") {
    return { ...row, visibility };
  }

  const { metrics: _metrics, ...summaryRow } = row;
  return { ...summaryRow, visibility };
}
```

- [ ] **Step 4: Register `RankingService`**

Modify `store-ops.module.ts` providers to include `RankingService`.

- [ ] **Step 5: Run tests and backend build**

Run:

```powershell
npm.cmd test -- src/modules/store-ops/application/ranking-access.policy.spec.ts --runInBand
npm.cmd test -- src/modules/store-ops/application/ranking.service.spec.ts --runInBand
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add backend/nestjs/src/modules/store-ops/application/ranking.service.ts backend/nestjs/src/modules/store-ops/application/ranking.service.spec.ts backend/nestjs/src/modules/store-ops/store-ops.module.ts
git commit -m "Add ranking v1 service"
```

---

## Task 5: Reporting Controller Endpoint

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/dto/get-ranking.query.ts`

- [ ] **Step 1: Add controller route**

Add import:

```ts
import { GetRankingQueryDto } from "./dto/get-ranking.query";
import { RankingService } from "../application/ranking.service";
```

Inject `RankingService` into `ReportingController`.

Add route:

```ts
@Get("rankings")
@RequireScope("authenticated")
@RequireRoles("STORE_PERSONNEL", "STORE_MANAGER", "REGION_MANAGER", "SUPER_ADMIN")
async getRankings(
  @Req()
  request: {
    user: {
      userId: string;
      employeeId?: string;
      roleCodes: string[];
      scope: {
        companyIds: string[];
        regionIds: string[];
        storeIds: string[];
      };
      actionScope?: {
        assignedStoreIds: string[];
      };
    };
  },
  @Query() query: GetRankingQueryDto,
) {
  return this.rankingService.getRankings({
    userId: request.user.userId,
    employeeId: request.user.employeeId,
    roleCodes: request.user.roleCodes,
    companyIds: request.user.scope.companyIds,
    regionIds: request.user.scope.regionIds,
    storeIds: request.user.scope.storeIds,
    assignedStoreIds: request.user.actionScope?.assignedStoreIds ?? [],
    periodType: query.periodType ?? "monthly",
    periodStart: query.periodStart,
    regionManagerUserId: query.regionManagerUserId,
    regionId: query.regionId,
    storeId: query.storeId,
    search: query.search,
    limit: query.limit,
    offset: query.offset,
  });
}
```

- [ ] **Step 2: Run backend build and targeted tests**

Run:

```powershell
npm.cmd run build
npm.cmd test -- src/modules/auth/role-catalog-contract.spec.ts --runInBand
```

Expected: PASS. The role catalog test confirms route roles exist in current catalog.

- [ ] **Step 3: Commit**

```powershell
git add backend/nestjs/src/modules/store-ops/web/reporting.controller.ts backend/nestjs/src/modules/store-ops/web/dto/get-ranking.query.ts
git commit -m "Expose ranking v1 endpoint"
```

---

## Task 6: Frontend API Types

**Files:**
- Modify: `admin-web/src/features/reports/api.ts`

- [ ] **Step 1: Add API types and function**

Add types matching `RankingResponse`:

```ts
export type RankingVisibility = 'summary' | 'detail'
export type RankingMetricValue = {
  code: string
  label: string
  actualValue: number | null
  targetValue?: number | null
  benchmarkValue?: number | null
  contributionValue?: number | null
}
export type StoreRankingRow = {
  subject: 'store'
  storeId: string
  storeName: string | null
  regionId: string | null
  regionName: string | null
  regionManagerUserId: string | null
  regionManagerName: string | null
  rank: number
  population: number
  scoreValue: number
  visibility: RankingVisibility
  metrics?: RankingMetricValue[]
}
export type PersonnelRankingRow = {
  subject: 'personnel'
  employeeId: string
  displayName: string
  storeId: string | null
  storeName: string | null
  regionId: string | null
  regionName: string | null
  regionManagerUserId: string | null
  regionManagerName: string | null
  rank: number
  population: number
  storeRank: number | null
  storePopulation: number
  scoreValue: number
  visibility: RankingVisibility
  metrics?: RankingMetricValue[]
}
export type RankingResponse = {
  source: {
    mode: 'live'
    periodType: 'monthly'
    periodStart: string | null
    periodEnd: string | null
  }
  access: {
    globalMode: 'top100' | 'full'
    canSeeGlobalDetails: boolean
    canSeeManagedStorePersonnelDetails: boolean
  }
  filters: {
    regionManagers: Array<{ id: string; label: string }>
    regions: Array<{ id: string; label: string }>
    stores: Array<{ id: string; label: string }>
  }
  storeLeaderboard: {
    items: StoreRankingRow[]
    currentStore: StoreRankingRow | null
    meta: { total: number; limit: number; offset: number }
  }
  personnelLeaderboard: {
    items: PersonnelRankingRow[]
    currentEmployee: PersonnelRankingRow | null
    managedStorePersonnel: PersonnelRankingRow[]
    meta: { total: number; limit: number; offset: number }
  }
  availablePeriods: Array<{ periodType: 'monthly'; periodStart: string; periodEnd: string }>
}
```

Add function:

```ts
export async function getRankings(input?: {
  periodStart?: string
  regionManagerUserId?: string
  regionId?: string
  storeId?: string
  search?: string
  limit?: number
  offset?: number
}) {
  const params = new URLSearchParams()
  params.set('periodType', 'monthly')
  if (input?.periodStart) params.set('periodStart', input.periodStart)
  if (input?.regionManagerUserId) params.set('regionManagerUserId', input.regionManagerUserId)
  if (input?.regionId) params.set('regionId', input.regionId)
  if (input?.storeId) params.set('storeId', input.storeId)
  if (input?.search) params.set('search', input.search)
  if (input?.limit) params.set('limit', String(input.limit))
  if (input?.offset) params.set('offset', String(input.offset))

  return fetchJson<RankingResponse>(`/reports/rankings?${params.toString()}`)
}
```

- [ ] **Step 2: Run frontend build**

Run:

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```powershell
git add admin-web/src/features/reports/api.ts
git commit -m "Add ranking v1 frontend API"
```

---

## Task 7: Ranking Page Redesign

**Files:**
- Modify: `admin-web/src/pages/StoreRankingsPage.tsx`

- [ ] **Step 1: Replace data query**

Replace `getClosedLeaderboard` usage with `getRankings`.

State:

```ts
const [periodStart, setPeriodStart] = useState('')
const [regionManagerUserId, setRegionManagerUserId] = useState('')
const [regionId, setRegionId] = useState('')
const [storeId, setStoreId] = useState('')
const [search, setSearch] = useState('')
const [offset, setOffset] = useState(0)
```

Query:

```ts
const rankingsQuery = useQuery({
  queryKey: ['rankings-v1', periodStart, regionManagerUserId, regionId, storeId, search, offset],
  queryFn: () =>
    getRankings({
      periodStart: periodStart || undefined,
      regionManagerUserId: regionManagerUserId || undefined,
      regionId: regionId || undefined,
      storeId: storeId || undefined,
      search: search || undefined,
      limit: 100,
      offset,
    }),
  enabled,
  retry: false,
})
```

- [ ] **Step 2: Render sections**

Render these full-width sections:

1. Hero metrics:
   - period
   - access mode: `Top 100` or `Tum liste`
   - source: `Canli aylik KPI`
2. Filter bar:
   - Show only when `rankings.access.globalMode === 'full'`.
   - Controls: period, region manager, region, store, search.
3. Turkey store leaderboard:
   - row fields: rank, store name, region, score.
   - metrics only if row `visibility === 'detail'`.
4. Turkey personnel leaderboard:
   - row fields: rank, employee name, store name, score.
   - metrics only if row `visibility === 'detail'`.
5. My position cards:
   - current store when present.
   - current employee when present.
6. Managed store personnel:
   - Show only when `managedStorePersonnel.length > 0`.
   - Include KPI values because backend sends detail rows only when allowed.

- [ ] **Step 3: Remove confusing copy**

Remove phrases:

- `Personel ilk 10`
- `Kapanmis Siralamalar`
- `Aylik Kanit` from the default live ranking path

Use:

- `Turkiye Magaza Siralamasi`
- `Turkiye Personel Siralamasi`
- `Magazam Personel Performansi`
- `Top 100` for low roles
- `Tum Turkiye` for privileged roles

- [ ] **Step 4: Add pagination for full mode**

Only show Previous/Next when `rankings.access.globalMode === 'full'`.

```ts
const canGoPrevious = offset > 0
const canGoNext = rankings.storeLeaderboard.meta.offset + rankings.storeLeaderboard.meta.limit < rankings.storeLeaderboard.meta.total
```

Reset `offset` to `0` when any filter changes.

- [ ] **Step 5: Run frontend verification**

Run:

```powershell
npm.cmd run build
npm.cmd run lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add admin-web/src/pages/StoreRankingsPage.tsx
git commit -m "Redesign rankings page for role based leaderboards"
```

---

## Task 8: Staging Smoke Plan

**Files:** None.

- [ ] **Step 1: Deploy backend first**

Render deploy must include:

- new `/reports/rankings` endpoint
- `RankingService`
- repository readers

- [ ] **Step 2: Deploy frontend second**

Vercel deploy must include:

- `getRankings`
- redesigned `/store/rankings`

- [ ] **Step 3: Smoke as store manager**

Expected:

- `/store/rankings` opens with `Top 100` access mode.
- Turkey store/personnel lists are visible.
- Rows show rank, name, store, score.
- Rows do not show raw metric details in global lists.
- Own store/personnel position appears even if outside Top 100.
- `Magazam Personel Performansi` shows the manager's own store personnel with detail KPI values.

- [ ] **Step 4: Smoke as region manager or super admin**

Expected:

- `/store/rankings` opens with `Tum Turkiye` or equivalent full mode.
- Filter bar is visible.
- Global rows include metric details.
- Pagination works.
- Region/store/search filters reduce both store and personnel lists.

- [ ] **Step 5: Smoke as store personnel**

Expected:

- Top 100 global lists visible.
- No raw detail fields for other people/stores.
- Own personnel position visible.
- No managed store personnel section.

---

## Risks And Guardrails

- Do not trust frontend visibility for sensitive fields; backend must omit `metrics` for low-role global rows.
- Keep `/reports/leaderboards/closed` untouched during V1 to avoid breaking the current page until V1 is stable.
- Do not fetch all rows directly in the browser. Backend paginates privileged full lists.
- Score consistency must reuse the current KPI profile and benchmark scoring service.
- If region manager ownership is not cleanly joinable, ship region/store filters first and keep the `regionManagers` filter empty rather than guessing ownership.

## Verification Commands

Run before final commit/push:

```powershell
npm.cmd test -- src/modules/store-ops/application/ranking-access.policy.spec.ts --runInBand
npm.cmd test -- src/modules/store-ops/application/ranking.service.spec.ts --runInBand
npm.cmd test -- src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts --runInBand
npm.cmd run build
```

From `admin-web`:

```powershell
npm.cmd run build
npm.cmd run lint
```

From repo root:

```powershell
git diff --check
```

## Self-Review

- Product rules are mapped to backend access policy, service masking, and frontend sections.
- Lower roles never receive metrics for global rows.
- Store manager own-store personnel detail is explicit.
- Privileged full Turkey access is paginated and filterable.
- Existing closed leaderboard endpoint remains available.
