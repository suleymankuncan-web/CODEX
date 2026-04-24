# Daily Closure Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build closed daily and month-to-date personnel ranking for `STORE_PERSONNEL` and `STORE_MANAGER`, with store/Turkey ranks, KPI mini-ranks, and data coverage.

**Architecture:** Reuse the existing `rpt.employee_performance_snapshot` and `rpt.employee_kpi_snapshot` daily closed snapshot tables as the source of truth. Add read-side query contracts and repository/service methods for daily and monthly ranking; do not create mutable ranking state. Keep region league/tournament logic out of this pass.

**Tech Stack:** NestJS, PostgreSQL, Jest/Supertest, React + Vite + TanStack Query.

---

## Source Documents

- `docs/plans/daily-closure-ranking-strategy.md`
- `docs/plans/project-gap-analysis-and-roadmap.md`
- `docs/plans/request-intake-and-decision-policy.md`

## Implementation Rules

- Closed ranking reads from `rpt.*`, not live `ops.kpi_actual`, except where existing snapshot generation writes into `rpt`.
- Missing performance data is not zero.
- Monthly ranking uses only completed daily snapshots in the selected month.
- Monthly official ranking requires `daysWithPerformance >= 3`.
- Preserve `snapshotDate` query as a backward-compatible alias for daily mode.
- Use `assignedStoreIds` for store-manager store access where available; do not rely only on wide read scope for store action-style visibility.
- Region leagues and tournaments stay out of this implementation.

## File Map

Create:
- `backend/nestjs/src/modules/store-ops/application/closed-ranking.contract.ts` - shared backend response and row shapes.
- `backend/nestjs/src/modules/store-ops/application/closed-ranking.service.ts` - daily/monthly ranking assembly, score ordering, eligibility, metric mini-ranks.
- `backend/nestjs/src/modules/store-ops/application/closed-ranking.service.spec.ts` - service-level ranking and eligibility tests.
- `db/migrations/021_closed_ranking_read_indexes.sql` - read-side indexes for closed ranking queries.

Modify:
- `backend/nestjs/src/modules/store-ops/web/dto/get-closed-leaderboard.query.ts` - add `periodType`, `periodStart`, `storeId`.
- `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts` - pass `roleCodes` and `actionScope.assignedStoreIds`.
- `backend/nestjs/src/modules/store-ops/application/reporting.service.ts` - delegate closed leaderboard to `ClosedRankingService`.
- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts` - add closed daily/monthly read methods.
- `backend/nestjs/src/modules/store-ops/store-ops.module.ts` - register `ClosedRankingService`.
- `backend/nestjs/test/integration/reporting.e2e-spec.ts` - API contract regression tests.
- `db/schema.sql` - mirror migration indexes/comments.
- `admin-web/src/features/reports/api.ts` - update closed leaderboard query and response types.
- `admin-web/src/pages/StoreRankingsPage.tsx` - add daily/monthly controls, coverage, mini-ranks, empty states.
- `current-state.md` - record completion and verification after implementation.

---

### Task 1: Query Contract And Failing API Tests

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/web/dto/get-closed-leaderboard.query.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts`
- Modify: `backend/nestjs/test/integration/reporting.e2e-spec.ts`

- [ ] **Step 1: Extend the DTO contract**

Replace `GetClosedLeaderboardQueryDto` with:

```ts
import { IsDateString, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class GetClosedLeaderboardQueryDto {
  @IsOptional()
  @IsIn(["daily", "monthly"])
  periodType?: "daily" | "monthly";

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  snapshotDate?: string;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
```

- [ ] **Step 2: Pass role and action scope from the controller**

In `ReportingController.getClosedLeaderboard`, expand the request user shape and service call:

```ts
roleCodes: string[];
actionScope?: {
  assignedStoreIds: string[];
};
```

Pass these values:

```ts
roleCodes: request.user.roleCodes,
assignedStoreIds: request.user.actionScope?.assignedStoreIds ?? [],
periodType: query.periodType,
periodStart: query.periodStart,
snapshotDate: query.snapshotDate,
storeId: query.storeId,
```

- [ ] **Step 3: Add failing daily API regression test**

Append this test to `backend/nestjs/test/integration/reporting.e2e-spec.ts`:

```ts
it("returns daily closed ranking with coverage and KPI mini ranks", async () => {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes("FROM rpt.snapshot_run") && sql.includes("period_start = $2::date")) {
      return {
        rowCount: 1,
        rows: [{
          snapshot_run_id: "11111111-1111-4111-8111-111111111111",
          snapshot_date: "2026-04-23",
          snapshot_type: "daily",
          period_start: "2026-04-23",
          period_end: "2026-04-23",
          run_status: "completed",
          generated_at: "2026-04-24T00:10:00.000Z",
          generated_by: "system",
        }],
      };
    }

    if (sql.includes("closed_personnel_daily_rank_rows")) {
      return {
        rowCount: 2,
        rows: [
          {
            employee_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            first_name: "Ayse",
            last_name: "Yilmaz",
            store_id: "22222222-2222-4222-8222-222222222222",
            store_name: "Kadikoy",
            score_value: "91.2500",
            turkey_rank: 4,
            turkey_population: 100,
            store_rank: 1,
            store_population: 8,
          },
          {
            employee_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            first_name: "Mehmet",
            last_name: "Demir",
            store_id: "22222222-2222-4222-8222-222222222222",
            store_name: "Kadikoy",
            score_value: "83.0000",
            turkey_rank: 18,
            turkey_population: 100,
            store_rank: 2,
            store_population: 8,
          },
        ],
      };
    }

    if (sql.includes("closed_metric_daily_rank_rows")) {
      return {
        rowCount: 2,
        rows: [
          {
            employee_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            kpi_code: "UPT",
            kpi_name: "UPT",
            actual_value: "2.4000",
            store_rank: 1,
            store_population: 8,
            turkey_rank: 9,
            turkey_population: 100,
          },
          {
            employee_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            kpi_code: "ATV",
            kpi_name: "ATV",
            actual_value: "850.0000",
            store_rank: 3,
            store_population: 8,
            turkey_rank: 41,
            turkey_population: 100,
          },
        ],
      };
    }

    return { rowCount: 0, rows: [] };
  });

  const app = await createIntegrationApp({
    databaseService: { query },
  });

  const response = await request(app.getHttpServer())
    .get("/api/reports/leaderboards/closed?periodType=daily&periodStart=2026-04-23&limit=10")
    .set("x-user-id", "user-1")
    .set("x-employee-id", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
    .set("x-role-codes", "STORE_PERSONNEL")
    .set("x-store-ids", "22222222-2222-4222-8222-222222222222");

  expect(response.status).toBe(200);
  expect(response.body.source).toEqual(expect.objectContaining({
    mode: "closed",
    periodType: "daily",
    state: "closed",
    periodStart: "2026-04-23",
    periodEnd: "2026-04-23",
  }));
  expect(response.body.currentEmployee.rankings).toEqual({
    turkeyRank: 4,
    turkeyPopulation: 100,
    storeRank: 1,
    storePopulation: 8,
  });
  expect(response.body.currentEmployee.coverage).toEqual({
    closedDaysInPeriod: 1,
    daysWithPerformance: 1,
    minimumRequiredDays: 1,
    isEligibleForRanking: true,
  });
  expect(response.body.currentEmployee.metricRanks).toEqual([
    expect.objectContaining({ code: "UPT", turkeyRank: 9, storeRank: 1 }),
    expect.objectContaining({ code: "ATV", turkeyRank: 41, storeRank: 3 }),
  ]);

  await app.close();
});
```

- [ ] **Step 4: Run failing targeted test**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- test/integration/reporting.e2e-spec.ts --runInBand
```

Expected: FAIL because the response contract does not yet include `source.mode`, `source.periodType`, `coverage`, and `metricRanks`.

- [ ] **Step 5: Commit the failing contract test**

```powershell
git add backend/nestjs/src/modules/store-ops/web/dto/get-closed-leaderboard.query.ts backend/nestjs/src/modules/store-ops/web/reporting.controller.ts backend/nestjs/test/integration/reporting.e2e-spec.ts
git commit -m "test: define closed ranking contract"
```

---

### Task 2: Closed Ranking Service Contract And Daily Read Path

**Files:**
- Create: `backend/nestjs/src/modules/store-ops/application/closed-ranking.contract.ts`
- Create: `backend/nestjs/src/modules/store-ops/application/closed-ranking.service.ts`
- Create: `backend/nestjs/src/modules/store-ops/application/closed-ranking.service.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/store-ops.module.ts`

- [ ] **Step 1: Add response contract types**

Create `closed-ranking.contract.ts`:

```ts
export type ClosedRankingPeriodType = "daily" | "monthly";
export type ClosedRankingState = "closed" | "not_closed" | "no_data";

export type ClosedRankingMetricRank = {
  code: string;
  label: string;
  actualValue: number | null;
  storeRank: number | null;
  storePopulation: number;
  turkeyRank: number | null;
  turkeyPopulation: number;
};

export type ClosedRankingCoverage = {
  closedDaysInPeriod: number;
  daysWithPerformance: number;
  minimumRequiredDays: number;
  isEligibleForRanking: boolean;
};

export type ClosedRankingEmployee = {
  employeeId: string;
  displayName: string;
  storeId: string | null;
  storeName: string | null;
  scoreValue: number;
  rankings: {
    turkeyRank: number | null;
    turkeyPopulation: number;
    storeRank: number | null;
    storePopulation: number;
  };
  coverage: ClosedRankingCoverage;
  metricRanks: ClosedRankingMetricRank[];
};

export type ClosedRankingSummary = {
  source: {
    mode: "closed";
    periodType: ClosedRankingPeriodType;
    state: ClosedRankingState;
    snapshotRunId: string | null;
    snapshotDate: string | null;
    periodStart: string | null;
    periodEnd: string | null;
  };
  currentEmployee: ClosedRankingEmployee | null;
  personnelTop: ClosedRankingEmployee[];
};
```

- [ ] **Step 2: Register the new service**

Add `ClosedRankingService` to `StoreOpsModule.providers`.

- [ ] **Step 3: Delegate from `ReportingService.getClosedLeaderboard`**

Inject `ClosedRankingService` in `ReportingService` and replace the current closed leaderboard body with:

```ts
return this.closedRankingService.getClosedLeaderboard(input);
```

Preserve the public method signature but add:

```ts
roleCodes: string[];
assignedStoreIds: string[];
periodType?: "daily" | "monthly";
periodStart?: string;
storeId?: string;
```

- [ ] **Step 4: Add daily repository methods**

Add methods to `ReportingRepository`:

```ts
async getCompletedDailySnapshotByDate(input: { periodStart: string }) { /* SQL below */ }
async listClosedDailyPersonnelRankRows(input: { snapshotRunId: string; companyId?: string; storeId?: string; limit: number }) { /* SQL below */ }
async listClosedDailyMetricRankRows(input: { snapshotRunId: string; employeeIds: string[]; storeId?: string }) { /* SQL below */ }
```

Use SQL markers in comments so tests can mock deterministically:

```sql
/* closed_personnel_daily_rank_rows */
SELECT
  eps.employee_id,
  e.first_name,
  e.last_name,
  eps.store_id,
  store.store_name,
  eps.score_value::text AS score_value,
  eps.turkey_rank,
  eps.turkey_population,
  eps.store_rank,
  eps.store_population
FROM rpt.employee_performance_snapshot eps
INNER JOIN ops.employee e ON e.employee_id = eps.employee_id
LEFT JOIN ops.store store ON store.store_id = eps.store_id
WHERE eps.snapshot_run_id = $1::uuid
ORDER BY eps.turkey_rank ASC NULLS LAST, eps.score_value DESC, eps.employee_id ASC
LIMIT $2
```

For metric rows, use window functions over `rpt.employee_kpi_snapshot`:

```sql
/* closed_metric_daily_rank_rows */
WITH metric_rows AS (
  SELECT
    eks.employee_id,
    eks.store_id,
    kd.kpi_code,
    kd.kpi_name,
    eks.actual_value,
    RANK() OVER (PARTITION BY kd.kpi_code ORDER BY eks.actual_value DESC, eks.employee_id ASC) AS turkey_rank,
    COUNT(*) OVER (PARTITION BY kd.kpi_code) AS turkey_population,
    RANK() OVER (PARTITION BY kd.kpi_code, eks.store_id ORDER BY eks.actual_value DESC, eks.employee_id ASC) AS store_rank,
    COUNT(*) OVER (PARTITION BY kd.kpi_code, eks.store_id) AS store_population
  FROM rpt.employee_kpi_snapshot eks
  INNER JOIN ops.kpi_definition kd ON kd.kpi_id = eks.kpi_id
  WHERE eks.snapshot_run_id = $1::uuid
)
SELECT *
FROM metric_rows
WHERE employee_id = ANY($2::uuid[])
ORDER BY employee_id ASC, kpi_code ASC
```

- [ ] **Step 5: Implement `ClosedRankingService.getClosedLeaderboard` for daily mode**

Rules:

```ts
const periodType = input.periodType ?? "daily";
const periodStart = input.periodStart ?? input.snapshotDate;
const minimumRequiredDays = periodType === "monthly" ? 3 : 1;
```

Daily no-closure response:

```ts
{
  source: {
    mode: "closed",
    periodType: "daily",
    state: "not_closed",
    snapshotRunId: null,
    snapshotDate: periodStart ?? null,
    periodStart: periodStart ?? null,
    periodEnd: periodStart ?? null,
  },
  currentEmployee: null,
  personnelTop: [],
}
```

Daily coverage:

```ts
{
  closedDaysInPeriod: 1,
  daysWithPerformance: 1,
  minimumRequiredDays: 1,
  isEligibleForRanking: true,
}
```

- [ ] **Step 6: Add service unit tests**

Create `closed-ranking.service.spec.ts` with tests:

```ts
it("returns not_closed when no completed daily snapshot exists", async () => {
  // repository.getCompletedDailySnapshotByDate returns null
  // expect source.state to be "not_closed"
});

it("maps daily current employee metric mini ranks", async () => {
  // repository returns one current employee row and UPT/ATV metric rows
  // expect metricRanks to include store and Turkey rank values
});
```

Use mocked repository methods, no database.

- [ ] **Step 7: Run targeted tests**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/closed-ranking.service.spec.ts test/integration/reporting.e2e-spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 8: Commit daily path**

```powershell
git add backend/nestjs/src/modules/store-ops/application/closed-ranking.contract.ts backend/nestjs/src/modules/store-ops/application/closed-ranking.service.ts backend/nestjs/src/modules/store-ops/application/closed-ranking.service.spec.ts backend/nestjs/src/modules/store-ops/application/reporting.service.ts backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts backend/nestjs/src/modules/store-ops/store-ops.module.ts backend/nestjs/test/integration/reporting.e2e-spec.ts
git commit -m "feat: add daily closed ranking read path"
```

---

### Task 3: Monthly Month-To-Date Aggregation And Eligibility

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/application/closed-ranking.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/closed-ranking.service.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`
- Modify: `backend/nestjs/test/integration/reporting.e2e-spec.ts`

- [ ] **Step 1: Add monthly failing service tests**

Add tests:

```ts
it("uses only completed daily snapshots in the selected month", async () => {
  // repository.listCompletedDailySnapshotsInMonth returns 3 daily runs
  // repository.listClosedMonthlyPersonnelAggregateRows returns one eligible employee
  // expect source.periodType to be "monthly"
  // expect coverage.closedDaysInPeriod to be 3
});

it("marks 1-2 day monthly rows as preview-only", async () => {
  // aggregate row days_with_performance = "2"
  // expect coverage.isEligibleForRanking to be false
  // expect rankings.turkeyRank to be null for official monthly rank
});
```

- [ ] **Step 2: Add monthly repository methods**

Add:

```ts
async listCompletedDailySnapshotsInMonth(input: { monthStart: string }) { /* SQL below */ }
async listClosedMonthlyPersonnelAggregateRows(input: { snapshotRunIds: string[]; companyId?: string; storeId?: string; limit: number }) { /* SQL below */ }
async listClosedMonthlyMetricRankRows(input: { snapshotRunIds: string[]; employeeIds: string[]; storeId?: string }) { /* SQL below */ }
```

Monthly snapshot SQL:

```sql
SELECT snapshot_run_id, snapshot_date, period_start, period_end
FROM rpt.snapshot_run
WHERE snapshot_type = 'daily'
  AND run_status = 'completed'
  AND period_start >= $1::date
  AND period_start < ($1::date + INTERVAL '1 month')
ORDER BY period_start ASC
```

Monthly personnel aggregation SQL marker:

```sql
/* closed_personnel_monthly_rank_rows */
WITH daily_rows AS (
  SELECT
    eps.employee_id,
    eps.store_id,
    AVG(eps.score_value)::numeric(18,4) AS score_value,
    COUNT(*)::int AS days_with_performance
  FROM rpt.employee_performance_snapshot eps
  WHERE eps.snapshot_run_id = ANY($1::uuid[])
  GROUP BY eps.employee_id, eps.store_id
),
ranked AS (
  SELECT
    daily_rows.*,
    CASE WHEN days_with_performance >= 3
      THEN RANK() OVER (ORDER BY score_value DESC, employee_id ASC)
      ELSE NULL
    END AS turkey_rank,
    COUNT(*) FILTER (WHERE days_with_performance >= 3) OVER () AS turkey_population
  FROM daily_rows
)
SELECT ...
```

Important: official ranks are assigned only to rows with `days_with_performance >= 3`.

- [ ] **Step 3: Implement monthly service branch**

Rules:

```ts
const monthStart = input.periodStart; // expected first day of month
const closedDaysInPeriod = completedRuns.length;
const minimumRequiredDays = 3;
```

If no completed daily runs:

```ts
source.state = "not_closed";
personnelTop = [];
currentEmployee = null;
```

For rows with fewer than 3 days:

```ts
coverage.isEligibleForRanking = false;
rankings.turkeyRank = null;
rankings.storeRank = null;
```

- [ ] **Step 4: Add monthly API regression test**

Add a Supertest case:

```ts
GET /api/reports/leaderboards/closed?periodType=monthly&periodStart=2026-04-01
```

Expected:

```ts
expect(response.body.source).toEqual(expect.objectContaining({
  periodType: "monthly",
  state: "closed",
  periodStart: "2026-04-01",
  periodEnd: "2026-04-30",
}));
expect(response.body.currentEmployee.coverage).toEqual({
  closedDaysInPeriod: 27,
  daysWithPerformance: 25,
  minimumRequiredDays: 3,
  isEligibleForRanking: true,
});
```

- [ ] **Step 5: Run monthly targeted tests**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/closed-ranking.service.spec.ts test/integration/reporting.e2e-spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit monthly aggregation**

```powershell
git add backend/nestjs/src/modules/store-ops/application/closed-ranking.service.ts backend/nestjs/src/modules/store-ops/application/closed-ranking.service.spec.ts backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts backend/nestjs/test/integration/reporting.e2e-spec.ts
git commit -m "feat: add monthly closed ranking aggregation"
```

---

### Task 4: Read-Side Indexes And Schema Sync

**Files:**
- Create: `db/migrations/021_closed_ranking_read_indexes.sql`
- Modify: `db/schema.sql`

- [ ] **Step 1: Add migration**

Create `021_closed_ranking_read_indexes.sql`:

```sql
CREATE INDEX IF NOT EXISTS snapshot_run_closed_daily_period_idx
    ON rpt.snapshot_run (period_start, period_end, generated_at DESC)
    WHERE snapshot_type = 'daily' AND run_status = 'completed';

CREATE INDEX IF NOT EXISTS employee_performance_snapshot_run_score_idx
    ON rpt.employee_performance_snapshot (snapshot_run_id, score_value DESC, employee_id);

CREATE INDEX IF NOT EXISTS employee_performance_snapshot_run_store_score_idx
    ON rpt.employee_performance_snapshot (snapshot_run_id, store_id, score_value DESC, employee_id);

CREATE INDEX IF NOT EXISTS employee_kpi_snapshot_run_metric_value_idx
    ON rpt.employee_kpi_snapshot (snapshot_run_id, kpi_id, actual_value DESC, employee_id);

CREATE INDEX IF NOT EXISTS employee_kpi_snapshot_run_store_metric_value_idx
    ON rpt.employee_kpi_snapshot (snapshot_run_id, store_id, kpi_id, actual_value DESC, employee_id);
```

- [ ] **Step 2: Mirror indexes in `db/schema.sql`**

Add the same `CREATE INDEX IF NOT EXISTS` statements near the relevant `rpt.employee_*_snapshot` definitions.

- [ ] **Step 3: Run SQL static check**

Run:

```powershell
git diff --check db/migrations/021_closed_ranking_read_indexes.sql db/schema.sql
```

Expected: no output.

- [ ] **Step 4: Commit indexes**

```powershell
git add db/migrations/021_closed_ranking_read_indexes.sql db/schema.sql
git commit -m "chore: add closed ranking read indexes"
```

---

### Task 5: Frontend Contract And Store Rankings UX

**Files:**
- Modify: `admin-web/src/features/reports/api.ts`
- Modify: `admin-web/src/pages/StoreRankingsPage.tsx`

- [ ] **Step 1: Update frontend API types**

Replace `ClosedLeaderboardSummary` with a shape matching backend:

```ts
export type ClosedRankingMetricRank = {
  code: string
  label: string
  actualValue: number | null
  storeRank: number | null
  storePopulation: number
  turkeyRank: number | null
  turkeyPopulation: number
}

export type ClosedRankingCoverage = {
  closedDaysInPeriod: number
  daysWithPerformance: number
  minimumRequiredDays: number
  isEligibleForRanking: boolean
}

export type ClosedRankingEmployee = {
  employeeId: string
  displayName: string
  storeId: string | null
  storeName: string | null
  scoreValue: number
  rankings: {
    turkeyRank: number | null
    turkeyPopulation: number
    storeRank: number | null
    storePopulation: number
  }
  coverage: ClosedRankingCoverage
  metricRanks: ClosedRankingMetricRank[]
}

export type ClosedLeaderboardSummary = {
  source: {
    mode: 'closed'
    periodType: 'daily' | 'monthly'
    state: 'closed' | 'not_closed' | 'no_data'
    snapshotRunId: string | null
    snapshotDate: string | null
    periodStart: string | null
    periodEnd: string | null
  }
  currentEmployee: ClosedRankingEmployee | null
  personnelTop: ClosedRankingEmployee[]
}
```

Update `getClosedLeaderboard`:

```ts
export async function getClosedLeaderboard(input?: {
  periodType?: 'daily' | 'monthly'
  periodStart?: string
  snapshotDate?: string
  storeId?: string
  limit?: number
}) {
  const params = new URLSearchParams()
  if (input?.periodType) params.set('periodType', input.periodType)
  if (input?.periodStart) params.set('periodStart', input.periodStart)
  if (input?.snapshotDate) params.set('snapshotDate', input.snapshotDate)
  if (input?.storeId) params.set('storeId', input.storeId)
  if (input?.limit) params.set('limit', String(input.limit))
  const query = params.toString()
  return fetchJson<ClosedLeaderboardSummary>(
    `/reports/leaderboards/closed${query ? `?${query}` : ''}`,
  )
}
```

- [ ] **Step 2: Replace daily-only UI with daily/monthly controls**

In `StoreRankingsPage.tsx`, use:

```ts
const [periodType, setPeriodType] = useState<'daily' | 'monthly'>('daily')
const [periodStart, setPeriodStart] = useState('')
```

Query key:

```ts
queryKey: ['closed-leaderboard', periodType, periodStart || 'latest']
```

Query:

```ts
getClosedLeaderboard({
  periodType,
  periodStart: periodStart || undefined,
  limit: 10,
})
```

- [ ] **Step 3: Add coverage and eligibility display**

Show on current employee card:

```tsx
<KeyValue
  label="Data coverage"
  value={
    leaderboard.currentEmployee
      ? `${leaderboard.currentEmployee.coverage.daysWithPerformance}/${leaderboard.currentEmployee.coverage.closedDaysInPeriod} days`
      : 'No data'
  }
/>
```

If monthly and not eligible:

```tsx
<StatusPill tone="warning">
  {`${leaderboard.currentEmployee.coverage.daysWithPerformance}/${leaderboard.currentEmployee.coverage.minimumRequiredDays} days for official ranking`}
</StatusPill>
```

- [ ] **Step 4: Add KPI mini-rank section**

Render:

```tsx
{leaderboard.currentEmployee?.metricRanks.map((metric) => (
  <article className="stacked-row" key={metric.code}>
    <div className="stacked-row-head">
      <strong>{metric.label}</strong>
      <StatusPill tone="neutral">{metric.code}</StatusPill>
    </div>
    <div className="key-grid">
      <KeyValue label="Value" value={metric.actualValue !== null ? metric.actualValue.toFixed(2) : 'No data'} />
      <KeyValue label="Store rank" value={metric.storeRank !== null ? `${metric.storeRank}/${metric.storePopulation}` : 'No rank'} />
      <KeyValue label="Turkey rank" value={metric.turkeyRank !== null ? `${metric.turkeyRank}/${metric.turkeyPopulation}` : 'No rank'} />
    </div>
  </article>
))}
```

- [ ] **Step 5: Add empty state copy**

Use clear states:

- `not_closed`: "This period is not closed yet."
- `no_data`: "No closed performance data exists for this period."
- monthly ineligible: "Official monthly ranking starts after 3 closed performance days."

- [ ] **Step 6: Run frontend verification**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run check:release
```

Expected: lint, build, audit pass.

- [ ] **Step 7: Commit frontend UX**

```powershell
git add admin-web/src/features/reports/api.ts admin-web/src/pages/StoreRankingsPage.tsx
git commit -m "feat: show closed daily and monthly rankings"
```

---

### Task 6: End-To-End Verification And Handoff

**Files:**
- Modify: `current-state.md`
- Optional Modify: `docs/plans/daily-closure-ranking-strategy.md` only if implementation discovers a necessary correction.

- [ ] **Step 1: Run backend release check**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run check:release
```

Expected:

- lint passes
- Jest passes
- build passes
- `npm audit --omit=dev` reports 0 vulnerabilities

- [ ] **Step 2: Run frontend release check**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run check:release
```

Expected:

- lint passes
- build passes
- `npm audit --omit=dev` reports 0 vulnerabilities

- [ ] **Step 3: Update `current-state.md`**

Add a section:

```md
## Son Daily Closure Ranking Uygulamasi

24 Nisan 2026 itibariyla daily/monthly closed ranking uygulamasi tamamlandi.

- `STORE_PERSONNEL` ve `STORE_MANAGER` icin kapali gun/ay ranking read path eklendi.
- Gunluk ranking completed daily snapshot'tan okunur.
- Aylik ranking ay icindeki completed daily snapshot'lardan month-to-date hesaplanir.
- Magaza ici + Turkiye geneli rank desteklenir.
- KPI mini-rank detaylari desteklenir.
- `daysWithPerformance / closedDaysInPeriod` data coverage dondurulur.
- Eksik gun `0` puan sayilmaz.
- Resmi aylik ranking icin minimum 3 kapali performans gunu gerekir.
- Backend release check gecti.
- Frontend release check gecti.
```

- [ ] **Step 4: Run final git checks**

```powershell
git status --short --untracked-files=all
git diff --check
```

Expected:

- only intended files are modified before commit
- `git diff --check` prints no whitespace errors

- [ ] **Step 5: Final commit**

```powershell
git add current-state.md
git commit -m "docs: record closed ranking implementation"
```

---

## Self-Review

Spec coverage:
- Daily mode: Tasks 1 and 2.
- Monthly mode: Task 3.
- Store + Turkey rank: Tasks 2 and 3.
- KPI mini-ranks: Tasks 2, 3, and 5.
- Minimum 3 days: Task 3.
- Missing data is not zero: Tasks 2 and 3.
- Coverage label: Tasks 3 and 5.
- Store personnel/store manager scope: Tasks 1, 2, and 5.
- Region leagues/tournaments excluded: documented in the source strategy; no implementation task adds region league logic.

Placeholder scan:
- No task uses forbidden placeholder markers.
- Every test command has an expected result.
- Every file path is explicit.

Residual risk:
- The monthly SQL should be reviewed carefully during implementation because ranking only eligible rows with window functions can be easy to get subtly wrong.
- If current test auth headers do not expose `roleCodes` or `actionScope.assignedStoreIds` exactly as expected, adapt the test setup to the existing mock auth provider without weakening the production access rule.
