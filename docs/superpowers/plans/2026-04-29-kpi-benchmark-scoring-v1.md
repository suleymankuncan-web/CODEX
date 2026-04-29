# KPI Benchmark Scoring V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make store and personnel KPI scores explainable by scoring each metric against the correct same-period Turkey benchmark or approved target, preserving actual ratio while capping score contribution at 120%.

**Architecture:** Add a pure scoring engine first, then wire it into reporting services and snapshot materialization. Keep import factual, keep score formulas in backend services, and expose metric-level benchmark/cap/missing-reference fields to UI without duplicating formulas in frontend.

**Tech Stack:** NestJS, TypeScript, PostgreSQL read queries, Jest, React/Vite, Playwright.

---

## Source Specs

- `docs/superpowers/specs/2026-04-29-kpi-benchmark-scoring-v1-design.md`
- `docs/superpowers/specs/2026-04-29-checklist-store-score-integration-v1-design.md`
- `docs/superpowers/specs/2026-04-26-kpi-config-versioning-v1-design.md`

## Implementation Order

This plan starts only after `Checklist Store Score Integration V1` passes release checks.

1. Add benchmark scoring contracts and pure calculator.
2. Extend KPI config contract with optional benchmark settings.
3. Add repository benchmark queries for same-period Turkey averages.
4. Wire live store and personnel surfaces to benchmark scoring.
5. Wire snapshot employee performance materialization to benchmark scoring.
6. Add UI explanations for actual ratio, cap, and missing references.

## File Map

Create:

- `backend/nestjs/src/modules/store-ops/application/kpi-benchmark-scoring.contract.ts`
- `backend/nestjs/src/modules/store-ops/application/kpi-benchmark-scoring.service.ts`
- `backend/nestjs/src/modules/store-ops/application/kpi-benchmark-scoring.service.spec.ts`
- `backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts`
- `backend/nestjs/src/modules/store-ops/application/snapshot.service.kpi-benchmark-scoring.spec.ts`
- `admin-web/e2e/kpi-benchmark-explainability.spec.ts`

Modify:

- `backend/nestjs/src/modules/store-ops/application/kpi-config.contract.ts`
- `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`
- `backend/nestjs/src/modules/store-ops/application/snapshot.service.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts`
- `admin-web/src/features/kpi/grading.ts`
- `admin-web/src/pages/StoreKpiHighlightsPage.tsx`
- `admin-web/src/pages/StoreMyPerformancePage.tsx`
- `current-state.md`
- `docs/plans/active-next-actions.md`
- `docs/plans/project-debt-ledger.md`

---

## Task 1: Add Pure KPI Benchmark Scoring Engine

**Files:**

- Create: `backend/nestjs/src/modules/store-ops/application/kpi-benchmark-scoring.contract.ts`
- Create: `backend/nestjs/src/modules/store-ops/application/kpi-benchmark-scoring.service.ts`
- Create: `backend/nestjs/src/modules/store-ops/application/kpi-benchmark-scoring.service.spec.ts`

- [ ] **Step 1: Write failing calculator tests**

Create `backend/nestjs/src/modules/store-ops/application/kpi-benchmark-scoring.service.spec.ts`:

```ts
import { KpiBenchmarkScoringService } from "./kpi-benchmark-scoring.service";

describe("KpiBenchmarkScoringService", () => {
  const service = new KpiBenchmarkScoringService();

  it("scores higher-is-better metric against Turkey benchmark", () => {
    const result = service.scoreMetric({
      metricCode: "UPT",
      actualValue: 3.3,
      benchmarkValue: 3,
      targetValue: null,
      weightPercent: 15,
      direction: "HIGHER_IS_BETTER",
      benchmarkSource: "TURKEY_AVERAGE",
      capRatio: 1.2,
    });

    expect(result.actualRatio).toBe(1.1);
    expect(result.scoredRatio).toBe(1.1);
    expect(result.isCapped).toBe(false);
    expect(result.scoreContribution).toBe(16.5);
    expect(result.scoreStatus).toBe("scored");
  });

  it("keeps actual ratio visible but caps score contribution", () => {
    const result = service.scoreMetric({
      metricCode: "UPT",
      actualValue: 4.44,
      benchmarkValue: 3,
      targetValue: null,
      weightPercent: 15,
      direction: "HIGHER_IS_BETTER",
      benchmarkSource: "TURKEY_AVERAGE",
      capRatio: 1.2,
    });

    expect(result.actualRatio).toBe(1.48);
    expect(result.scoredRatio).toBe(1.2);
    expect(result.isCapped).toBe(true);
    expect(result.scoreContribution).toBe(18);
  });

  it("uses approved target for target achievement", () => {
    const result = service.scoreMetric({
      metricCode: "TARGET_ACHIEVEMENT",
      actualValue: 110000,
      benchmarkValue: null,
      targetValue: 100000,
      weightPercent: 40,
      direction: "HIGHER_IS_BETTER",
      benchmarkSource: "TARGET",
      capRatio: 1.2,
    });

    expect(result.actualRatio).toBe(1.1);
    expect(result.scoreContribution).toBe(44);
  });

  it("does not fabricate score when benchmark is missing", () => {
    const result = service.scoreMetric({
      metricCode: "ATV",
      actualValue: 4500,
      benchmarkValue: null,
      targetValue: null,
      weightPercent: 30,
      direction: "HIGHER_IS_BETTER",
      benchmarkSource: "TURKEY_AVERAGE",
      capRatio: 1.2,
    });

    expect(result.scoreStatus).toBe("missing_reference");
    expect(result.scoreContribution).toBeNull();
    expect(result.missingReason).toBe("benchmark_missing");
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/kpi-benchmark-scoring.service.spec.ts --runInBand
```

Expected: FAIL because the scoring service does not exist.

- [ ] **Step 3: Add scoring contracts**

Create `backend/nestjs/src/modules/store-ops/application/kpi-benchmark-scoring.contract.ts`:

```ts
export type KpiMetricDirection = "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | "TARGET_BAND";
export type KpiBenchmarkSource = "TARGET" | "TURKEY_AVERAGE" | "CHECKLIST_SCORE";
export type KpiMetricScoreStatus = "scored" | "missing_reference" | "missing_actual";

export type KpiBenchmarkMetricInput = {
  metricCode: string;
  actualValue: number | null;
  benchmarkValue: number | null;
  targetValue: number | null;
  weightPercent: number;
  direction: KpiMetricDirection;
  benchmarkSource: KpiBenchmarkSource;
  capRatio: number;
};

export type KpiBenchmarkMetricResult = {
  metricCode: string;
  actualValue: number | null;
  benchmarkValue: number | null;
  targetValue: number | null;
  actualRatio: number | null;
  scoredRatio: number | null;
  capRatio: number;
  isCapped: boolean;
  weightPercent: number;
  scoreContribution: number | null;
  scoreStatus: KpiMetricScoreStatus;
  missingReason?: string;
};
```

- [ ] **Step 4: Add minimal scoring implementation**

Create `backend/nestjs/src/modules/store-ops/application/kpi-benchmark-scoring.service.ts`:

```ts
import {
  KpiBenchmarkMetricInput,
  KpiBenchmarkMetricResult,
} from "./kpi-benchmark-scoring.contract";

export class KpiBenchmarkScoringService {
  scoreMetric(input: KpiBenchmarkMetricInput): KpiBenchmarkMetricResult {
    if (input.actualValue === null || !Number.isFinite(input.actualValue)) {
      return this.missing(input, "missing_actual", "actual_missing");
    }

    const referenceValue =
      input.benchmarkSource === "TARGET" ? input.targetValue : input.benchmarkValue;

    if (referenceValue === null || !Number.isFinite(referenceValue)) {
      return this.missing(input, "missing_reference", "benchmark_missing");
    }

    if (referenceValue === 0) {
      return this.missing(input, "missing_reference", "benchmark_denominator_zero");
    }

    if (input.direction !== "HIGHER_IS_BETTER") {
      return this.missing(input, "missing_reference", "unsupported_direction");
    }

    const actualRatio = input.actualValue / referenceValue;
    const scoredRatio = Math.min(actualRatio, input.capRatio);
    const isCapped = actualRatio > input.capRatio;

    return {
      metricCode: input.metricCode,
      actualValue: input.actualValue,
      benchmarkValue: input.benchmarkValue,
      targetValue: input.targetValue,
      actualRatio: this.round(actualRatio),
      scoredRatio: this.round(scoredRatio),
      capRatio: input.capRatio,
      isCapped,
      weightPercent: input.weightPercent,
      scoreContribution: this.round(scoredRatio * input.weightPercent),
      scoreStatus: "scored",
    };
  }

  private missing(
    input: KpiBenchmarkMetricInput,
    scoreStatus: "missing_reference" | "missing_actual",
    missingReason: string,
  ): KpiBenchmarkMetricResult {
    return {
      metricCode: input.metricCode,
      actualValue: input.actualValue,
      benchmarkValue: input.benchmarkValue,
      targetValue: input.targetValue,
      actualRatio: null,
      scoredRatio: null,
      capRatio: input.capRatio,
      isCapped: false,
      weightPercent: input.weightPercent,
      scoreContribution: null,
      scoreStatus,
      missingReason,
    };
  }

  private round(value: number) {
    return Number(value.toFixed(4));
  }
}
```

- [ ] **Step 5: Run tests and verify GREEN**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/kpi-benchmark-scoring.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add backend/nestjs/src/modules/store-ops/application/kpi-benchmark-scoring.contract.ts backend/nestjs/src/modules/store-ops/application/kpi-benchmark-scoring.service.ts backend/nestjs/src/modules/store-ops/application/kpi-benchmark-scoring.service.spec.ts
git commit -m "feat: add kpi benchmark scoring engine"
```

---

## Task 2: Extend KPI Config Contract With Benchmark Settings

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/application/kpi-config.contract.ts`

- [ ] **Step 1: Add config fields to metric contract**

Modify `KpiScoreProfileMetric`:

```ts
import {
  KpiBenchmarkSource,
  KpiMetricDirection,
} from "./kpi-benchmark-scoring.contract";

export type KpiScoreProfileMetric = {
  code: string;
  label: string;
  weightPercent: number;
  ownerRole: KpiOwnerRole;
  scoreBehavior: KpiScoreBehavior;
  direction?: KpiMetricDirection;
  benchmarkSource?: KpiBenchmarkSource;
  capRatio?: number;
  aliases?: string[];
  notes?: string;
};
```

- [ ] **Step 2: Add default metric settings**

For store defaults:

```ts
{
  code: "TARGET_ACHIEVEMENT",
  direction: "HIGHER_IS_BETTER",
  benchmarkSource: "TARGET",
  capRatio: 1.2,
}
```

For store `CR`, `ATV`, `UPT`:

```ts
direction: "HIGHER_IS_BETTER",
benchmarkSource: "TURKEY_AVERAGE",
capRatio: 1.2,
```

For personnel `TARGET_ACHIEVEMENT`:

```ts
direction: "HIGHER_IS_BETTER",
benchmarkSource: "TARGET",
capRatio: 1.2,
```

For personnel `ATV`, `UPT`:

```ts
direction: "HIGHER_IS_BETTER",
benchmarkSource: "TURKEY_AVERAGE",
capRatio: 1.2,
```

- [ ] **Step 3: Run config-related tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/reporting.service.kpi-config-versioning.spec.ts --runInBand
```

Expected: PASS. Existing config version tests must keep working with backward-compatible optional fields.

- [ ] **Step 4: Commit Task 2**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add backend/nestjs/src/modules/store-ops/application/kpi-config.contract.ts
git commit -m "feat: add benchmark settings to kpi config"
```

---

## Task 3: Add Same-Period Turkey Benchmark Repository Queries

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts`

- [ ] **Step 1: Add failing repository tests**

Extend `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts`:

```ts
describe("ReportingRepository benchmark queries", () => {
  function createRepository() {
    const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({ rowCount: 0, rows: [] }));
    const repository = new ReportingRepository({ query } as never);
    return { query, repository };
  }

  it("calculates store ATV UPT CR benchmarks from weighted totals", async () => {
    const { query, repository } = createRepository();

    await repository.getStoreTurkeyBenchmarkValues({
      periodType: "daily",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-01",
      companyId: "00000000-0000-4000-8000-000000000001",
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("SUM(net_sales.actual_value) / NULLIF(SUM(ticket_count.actual_value), 0)");
    expect(sql).toContain("SUM(item_count.actual_value) / NULLIF(SUM(ticket_count.actual_value), 0)");
    expect(sql).toContain("(SUM(ticket_count.actual_value) / NULLIF(SUM(ff.actual_value), 0)) * 100");
  });

  it("calculates personnel ATV UPT benchmarks for the same period", async () => {
    const { query, repository } = createRepository();

    await repository.getEmployeeTurkeyBenchmarkValues({
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
      companyId: "00000000-0000-4000-8000-000000000001",
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("scope_type = 'employee'");
    expect(sql).toContain("SUM(net_sales.actual_value) / NULLIF(SUM(ticket_count.actual_value), 0)");
  });
});
```

- [ ] **Step 2: Run repository tests and verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/infrastructure/reporting.repository.spec.ts --runInBand
```

Expected: FAIL because benchmark query methods do not exist.

- [ ] **Step 3: Add benchmark query methods**

Add methods to `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`:

```ts
async getStoreTurkeyBenchmarkValues(input: {
  periodType: string;
  periodStart: string;
  periodEnd: string;
  companyId?: string;
}) {
  const params: unknown[] = [input.periodType, input.periodStart, input.periodEnd];
  const companyClause = input.companyId
    ? (() => {
        params.push(input.companyId);
        return `AND store.company_id = $${params.length}::uuid`;
      })()
    : "";

  const result = await this.databaseService.query<{ kpi_code: string; benchmark_value: string }>(
    `
      WITH scoped_actual AS (
        SELECT ka.store_id, kd.kpi_code, SUM(ka.actual_value) AS actual_value
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd ON kd.kpi_id = ka.kpi_id
        INNER JOIN ops.store store ON store.store_id = ka.store_id
        WHERE ka.scope_type = 'store'
          AND ka.period_type = $1
          AND ka.period_start >= $2::date
          AND ka.period_end <= $3::date
          ${companyClause}
        GROUP BY ka.store_id, kd.kpi_code
      )
      SELECT 'ATV' AS kpi_code,
             (SUM(net_sales.actual_value) / NULLIF(SUM(ticket_count.actual_value), 0))::text AS benchmark_value
      FROM scoped_actual net_sales
      INNER JOIN scoped_actual ticket_count
        ON ticket_count.store_id = net_sales.store_id AND ticket_count.kpi_code = 'TICKET_COUNT'
      WHERE net_sales.kpi_code = 'NET_SALES'
      UNION ALL
      SELECT 'UPT' AS kpi_code,
             (SUM(item_count.actual_value) / NULLIF(SUM(ticket_count.actual_value), 0))::text AS benchmark_value
      FROM scoped_actual item_count
      INNER JOIN scoped_actual ticket_count
        ON ticket_count.store_id = item_count.store_id AND ticket_count.kpi_code = 'TICKET_COUNT'
      WHERE item_count.kpi_code = 'ITEM_COUNT'
      UNION ALL
      SELECT 'CR' AS kpi_code,
             ((SUM(ticket_count.actual_value) / NULLIF(SUM(ff.actual_value), 0)) * 100)::text AS benchmark_value
      FROM scoped_actual ticket_count
      INNER JOIN scoped_actual ff
        ON ff.store_id = ticket_count.store_id AND ff.kpi_code = 'FF'
      WHERE ticket_count.kpi_code = 'TICKET_COUNT'
    `,
    params,
  );

  return result.rows;
}
```

Add `getEmployeeTurkeyBenchmarkValues` with the same structure but `scope_type = 'employee'` and employee joins where needed. If employee `TICKET_COUNT` is not available for a period, the method returns no benchmark row and the scoring engine marks the metric as `missing_reference`.

- [ ] **Step 4: Run repository tests and verify GREEN**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/infrastructure/reporting.repository.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts
git commit -m "feat: calculate turkey kpi benchmarks"
```

---

## Task 4: Wire Live Store And Personnel Reporting

**Files:**

- Create: `backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`

- [ ] **Step 1: Add failing reporting service tests**

Create `backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts`:

```ts
import { ReportingService } from "./reporting.service";

describe("ReportingService KPI benchmark scoring", () => {
  it("returns capped benchmark metadata for store live KPI highlights", async () => {
    const reportingRepository = {
      getStoreNameById: jest.fn(async () => "Marmara Park"),
      listStoreKpiPeriods: jest.fn(async () => [{ period_type: "daily", period_start: "2026-03-01", period_end: "2026-03-01" }]),
      getLatestStoreKpiPeriod: jest.fn(async () => ({ period_type: "daily", period_start: "2026-03-01", period_end: "2026-03-01" })),
      getStorePerformanceRows: jest.fn(async () => [
        { kpi_code: "UPT", kpi_name: "UPT", actual_value: "4.44", target_value: null, store_name: "Marmara Park" },
      ]),
      getStoreTurkeyBenchmarkValues: jest.fn(async () => [
        { kpi_code: "UPT", benchmark_value: "3" },
      ]),
    };
    const service = new ReportingService(reportingRepository as never, { getKpiConfigRows: jest.fn(async () => []) } as never);

    const result = await service.getStoreKpiHighlights({
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1"],
      periodType: "daily",
    });

    const upt = result.metrics.find((metric) => metric.code === "UPT");
    expect(upt?.actualRatio).toBe(1.48);
    expect(upt?.scoredRatio).toBe(1.2);
    expect(upt?.isCapped).toBe(true);
  });
});
```

- [ ] **Step 2: Run service test and verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts --runInBand
```

Expected: FAIL because live store metrics do not expose cap fields.

- [ ] **Step 3: Use scoring service in store highlights**

In `reporting.service.ts`, replace simple average normalization in `getStoreKpiHighlights` with:

```ts
const benchmarkRows = await this.reportingRepository.getStoreTurkeyBenchmarkValues({
  companyId: input.companyIds[0] ?? undefined,
  periodType: latestPeriod.period_type,
  periodStart: latestPeriod.period_start,
  periodEnd: latestPeriod.period_end,
});
const benchmarkLookup = new Map(
  benchmarkRows.map((row) => [row.kpi_code, Number(row.benchmark_value)]),
);
```

Then score each metric with `KpiBenchmarkScoringService.scoreMetric`, using:

```ts
direction: metric.direction ?? "HIGHER_IS_BETTER",
benchmarkSource: metric.benchmarkSource ?? (targetValue !== null ? "TARGET" : "TURKEY_AVERAGE"),
capRatio: metric.capRatio ?? 1.2,
benchmarkValue: benchmarkLookup.get(row.kpi_code) ?? null,
targetValue,
```

Return metric fields:

```ts
actualRatio
scoredRatio
capRatio
isCapped
scoreContribution
missingReason
```

- [ ] **Step 4: Repeat for live personnel performance**

In `getLiveMyPerformance`, use `getEmployeeTurkeyBenchmarkValues` and the same scoring service for personnel `TARGET_ACHIEVEMENT`, `ATV`, and `UPT`.

Personnel target achievement must use only approved personnel targets when that target flow exists. Until target approval storage is implemented, missing target must return `missing_reference` instead of fabricating score.

- [ ] **Step 5: Run targeted service tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add backend/nestjs/src/modules/store-ops/application/reporting.service.ts backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts
git commit -m "feat: explain live kpi benchmark scoring"
```

---

## Task 5: Wire Snapshot Employee Performance Materialization

**Files:**

- Create: `backend/nestjs/src/modules/store-ops/application/snapshot.service.kpi-benchmark-scoring.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/snapshot.service.ts`

- [ ] **Step 1: Add failing snapshot test**

Create `backend/nestjs/src/modules/store-ops/application/snapshot.service.kpi-benchmark-scoring.spec.ts`:

```ts
import { SnapshotService } from "./snapshot.service";

describe("SnapshotService KPI benchmark scoring", () => {
  it("uses capped benchmark ratios instead of raw actual values for employee performance snapshots", async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.kpi_actual ka") && sql.includes("ka.scope_type = 'employee'")) {
        return {
          rows: [
            { employee_id: "employee-1", store_id: "store-1", kpi_id: "kpi-upt", kpi_code: "UPT", actual_value: "4.44" },
          ],
        };
      }
      return { rows: [] };
    });
    const databaseService = {
      query,
      withTransaction: async <T>(work: (client: { query: typeof query }) => Promise<T>) => work({ query }),
    };
    const repository = {
      findSnapshotRunById: jest.fn(async () => ({
        snapshot_run_id: "snapshot-1",
        snapshot_type: "daily",
        period_start: "2026-03-01",
        period_end: "2026-03-01",
        run_status: "queued",
        kpi_config_version_id: null,
      })),
      markSnapshotRunStarted: jest.fn(async () => undefined),
      markSnapshotRunCompleted: jest.fn(async () => undefined),
      markSnapshotRunFailed: jest.fn(async () => undefined),
    };
    const service = new SnapshotService(
      databaseService as never,
      { dispatch: jest.fn() } as never,
      repository as never,
      { getKpiConfigRows: jest.fn(async () => []) } as never,
    );

    await service.executeSnapshotRun("snapshot-1", "2026-03-01", "2026-03-01");

    expect(query.mock.calls.some(([sql]) => String(sql).includes("employee_performance_snapshot"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run snapshot test and verify RED or incomplete behavior**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/snapshot.service.kpi-benchmark-scoring.spec.ts --runInBand
```

Expected: FAIL until the snapshot scoring code is adjusted for benchmark ratios and the test is completed against exact inserted score values.

- [ ] **Step 3: Update snapshot employee score calculation**

In `snapshot.service.ts`, update `materializeEmployeePerformanceSnapshot` so score calculation:

- reads same-period Turkey benchmark rows for personnel metrics
- uses `KpiBenchmarkScoringService`
- stores `score_value` as sum of `scoreContribution`
- stores `matched_metrics` as count of `scoreStatus === "scored"`
- does not score metrics with missing target/benchmark

Do not change import behavior in this task.

- [ ] **Step 4: Run snapshot tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/snapshot.service.spec.ts src/modules/store-ops/application/snapshot.service.kpi-benchmark-scoring.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add backend/nestjs/src/modules/store-ops/application/snapshot.service.ts backend/nestjs/src/modules/store-ops/application/snapshot.service.kpi-benchmark-scoring.spec.ts
git commit -m "feat: score employee snapshots by benchmarks"
```

---

## Task 6: Add UI Explainability For Cap And Missing References

**Files:**

- Modify: `admin-web/src/features/kpi/grading.ts`
- Modify: `admin-web/src/pages/StoreKpiHighlightsPage.tsx`
- Modify: `admin-web/src/pages/StoreMyPerformancePage.tsx`
- Create: `admin-web/e2e/kpi-benchmark-explainability.spec.ts`

- [ ] **Step 1: Add failing Playwright smoke**

Create `admin-web/e2e/kpi-benchmark-explainability.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("kpi metrics explain capped benchmark performance", async ({ page }) => {
  await page.goto("/store/kpi-highlights");
  await expect(page.getByText(/skor limiti|score limit|120/i)).toBeVisible();
});

test("my performance explains missing benchmark or target", async ({ page }) => {
  await page.goto("/store/me");
  await expect(page.getByText(/eksik referans|missing reference|hedef/i)).toBeVisible();
});
```

- [ ] **Step 2: Run smoke and verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- e2e/kpi-benchmark-explainability.spec.ts
```

Expected: FAIL because cap/missing-reference copy is not rendered yet.

- [ ] **Step 3: Add display helpers**

In `admin-web/src/features/kpi/grading.ts`, add:

```ts
export function formatBenchmarkRatio(ratio: number | null | undefined) {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "-";
  return `%${Math.round(ratio * 100)}`;
}

export function describeBenchmarkCap(input: {
  actualRatio?: number | null;
  scoredRatio?: number | null;
  isCapped?: boolean;
}) {
  if (!input.isCapped || !input.actualRatio || !input.scoredRatio) return null;
  return `Gercek oran %${Math.round(input.actualRatio * 100)}. Skor katkisi %${Math.round(
    input.scoredRatio * 100,
  )}+ limitiyle hesaplandi.`;
}
```

- [ ] **Step 4: Render cap and missing-reference copy**

In `StoreKpiHighlightsPage.tsx` and `StoreMyPerformancePage.tsx`, render:

```tsx
{metric.isCapped ? (
  <span>Skor limiti {Math.round(metric.scoredRatio * 100)}%+</span>
) : null}
{metric.scoreStatus === "missing_reference" ? (
  <span>Eksik referans: {metric.missingReason}</span>
) : null}
```

Use existing card/list structure and avoid broad UI redesign.

- [ ] **Step 5: Run frontend smoke**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- e2e/kpi-benchmark-explainability.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 6**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add admin-web/src/features/kpi/grading.ts admin-web/src/pages/StoreKpiHighlightsPage.tsx admin-web/src/pages/StoreMyPerformancePage.tsx admin-web/e2e/kpi-benchmark-explainability.spec.ts
git commit -m "feat: show kpi benchmark explainability"
```

---

## Task 7: Release Checks And Handoff

**Files:**

- Modify: `current-state.md`
- Modify: `docs/plans/active-next-actions.md`
- Modify: `docs/plans/project-debt-ledger.md`

- [ ] **Step 1: Run backend targeted tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/kpi-benchmark-scoring.service.spec.ts src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts src/modules/store-ops/application/snapshot.service.kpi-benchmark-scoring.spec.ts src/modules/store-ops/infrastructure/reporting.repository.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run backend build**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 3: Run frontend smoke**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- e2e/kpi-benchmark-explainability.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Run root release check**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run check:release
```

Expected: PASS.

- [ ] **Step 5: Update handoff docs**

Update `current-state.md` with:

```md
## Son KPI Benchmark Scoring V1 Implementation

- KPI metrics score against target or same-period Turkey benchmark.
- Actual ratio is preserved.
- Score contribution is capped at 120%.
- Cap state is visible in API/UI.
- Missing target/benchmark does not fabricate score.
- Store and personnel live surfaces expose score breakdown metadata.
```

- [ ] **Step 6: Commit final handoff**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add current-state.md docs/plans/active-next-actions.md docs/plans/project-debt-ledger.md
git commit -m "docs: close kpi benchmark scoring handoff"
```

## Self-Review Checklist

- [ ] Store target achievement uses store target.
- [ ] Store `CR`, `ATV`, `UPT` use same-period Turkey benchmark.
- [ ] Personnel target achievement uses approved personnel target or remains `missing_reference`.
- [ ] Personnel `ATV`, `UPT` use same-period Turkey benchmark.
- [ ] `ATV`, `UPT`, `CR` benchmarks use weighted totals.
- [ ] Actual ratio remains visible.
- [ ] Scored ratio is capped at `1.20`.
- [ ] Cap state is visible to users as `120%+` style copy.
- [ ] Missing reference is visible and not scored as zero.
- [ ] Release check passes.
