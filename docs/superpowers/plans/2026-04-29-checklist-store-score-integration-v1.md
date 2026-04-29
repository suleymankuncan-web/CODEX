# Checklist Store Score Integration V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect completed BM checklist monthly results to store monthly score as a transparent 5% component without penalizing stores that were not visited.

**Architecture:** Backend-first, test-first slice. Keep checklist workflow untouched, fix reporting aggregation to use completed checklist instances, add a pure store-score blend calculator, expose a score breakdown DTO, then add minimal frontend read copy. Do not build VM checklist scoring in this slice.

**Tech Stack:** NestJS, TypeScript, PostgreSQL SQL functions/migrations, Jest, React/Vite, Playwright.

---

## Source Specs

- `docs/superpowers/specs/2026-04-28-mobile-checklist-today-v1-design.md`
- `docs/superpowers/specs/2026-04-29-checklist-store-score-integration-v1-design.md`
- `docs/superpowers/specs/2026-04-29-kpi-benchmark-scoring-v1-design.md`

## Implementation Order

1. Make checklist snapshot aggregation faithful to the checklist lifecycle.
2. Add a pure monthly score blend calculator.
3. Add repository read-model support.
4. Add backend API/DTO output.
5. Add frontend display copy.
6. Run targeted tests and release checks.

## File Map

Create:

- `db/migrations/038_checklist_store_score_integration_v1.sql`
- `backend/nestjs/src/modules/store-ops/checklist-store-score-integration-schema-contract.spec.ts`
- `backend/nestjs/src/modules/store-ops/application/store-score-blend.contract.ts`
- `backend/nestjs/src/modules/store-ops/application/store-score-blend.service.ts`
- `backend/nestjs/src/modules/store-ops/application/store-score-blend.service.spec.ts`
- `backend/nestjs/src/modules/store-ops/application/reporting.service.store-score-blend.spec.ts`
- `admin-web/e2e/store-score-breakdown.spec.ts`

Modify:

- `db/jobs/generate_snapshots.sql`
- `db/schema.sql`
- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts`
- `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`
- `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts`
- `admin-web/src/features/checklists/api.ts`
- `admin-web/src/pages/ReportsKpisPage.tsx`
- `admin-web/src/pages/StoreKpiHighlightsPage.tsx`
- `current-state.md`
- `docs/plans/active-next-actions.md`
- `docs/plans/project-debt-ledger.md`

---

## Task 1: Fix Completed Checklist Snapshot Aggregation

**Files:**

- Create: `backend/nestjs/src/modules/store-ops/checklist-store-score-integration-schema-contract.spec.ts`
- Create: `db/migrations/038_checklist_store_score_integration_v1.sql`
- Modify: `db/jobs/generate_snapshots.sql`
- Modify: `db/schema.sql`

- [ ] **Step 1: Write the failing schema/function contract**

Create `backend/nestjs/src/modules/store-ops/checklist-store-score-integration-schema-contract.spec.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(process.cwd(), "..", "..");
const jobsSql = readFileSync(join(projectRoot, "db", "jobs", "generate_snapshots.sql"), "utf8");
const schemaSql = readFileSync(join(projectRoot, "db", "schema.sql"), "utf8");
const migrationPath = join(
  projectRoot,
  "db",
  "migrations",
  "038_checklist_store_score_integration_v1.sql",
);
const migrationSql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

describe("checklist store score integration SQL contract", () => {
  it("generates checklist snapshots only from completed instances by completed_at", () => {
    for (const sql of [jobsSql, migrationSql]) {
      expect(sql).toContain("CREATE OR REPLACE FUNCTION rpt.generate_store_checklist_snapshot");
      expect(sql).toContain("ci.status = 'completed'");
      expect(sql).toContain("ci.completed_at::date BETWEEN p_period_start AND p_period_end");
      expect(sql).not.toContain("ci.created_at::date BETWEEN p_period_start AND p_period_end");
    }
  });

  it("keeps checklist snapshot rows able to report visit counts and average score", () => {
    expect(schemaSql).toContain("CREATE TABLE rpt.store_checklist_snapshot");
    expect(schemaSql).toContain("audit_count INTEGER NOT NULL");
    expect(schemaSql).toContain("avg_score NUMERIC(12,2)");
  });
});
```

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/checklist-store-score-integration-schema-contract.spec.ts --runInBand
```

Expected: FAIL because `rpt.generate_store_checklist_snapshot` still uses `created_at` and does not require `status = 'completed'`.

- [ ] **Step 3: Add migration to replace the checklist snapshot function**

Create `db/migrations/038_checklist_store_score_integration_v1.sql` with the complete replacement function:

```sql
CREATE OR REPLACE FUNCTION rpt.generate_store_checklist_snapshot(
    p_snapshot_run_id UUID,
    p_period_start DATE,
    p_period_end DATE
)
RETURNS VOID
LANGUAGE SQL
AS $$
INSERT INTO rpt.store_checklist_snapshot (
    snapshot_run_id,
    store_id,
    checklist_template_id,
    audit_count,
    avg_score,
    compliance_rate,
    critical_issue_count
)
SELECT
    p_snapshot_run_id,
    ci.store_id,
    ci.checklist_template_id,
    COUNT(DISTINCT ci.checklist_instance_id)::INTEGER AS audit_count,
    AVG(ci.total_score)::NUMERIC(12,2) AS avg_score,
    AVG(ci.compliance_rate)::NUMERIC(7,4) AS compliance_rate,
    COALESCE(COUNT(cr.response_id) FILTER (WHERE cr.is_non_compliant = TRUE), 0)::INTEGER AS critical_issue_count
FROM ops.checklist_instance ci
LEFT JOIN ops.checklist_response cr
  ON cr.checklist_instance_id = ci.checklist_instance_id
WHERE ci.status = 'completed'
  AND ci.completed_at IS NOT NULL
  AND ci.completed_at::date BETWEEN p_period_start AND p_period_end
GROUP BY ci.store_id, ci.checklist_template_id;
$$;
```

- [ ] **Step 4: Mirror the function in `db/jobs/generate_snapshots.sql`**

Replace the existing `rpt.generate_store_checklist_snapshot` function with the exact function body from the migration.

- [ ] **Step 5: Run the contract test and verify GREEN**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/checklist-store-score-integration-schema-contract.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add db/migrations/038_checklist_store_score_integration_v1.sql db/jobs/generate_snapshots.sql db/schema.sql backend/nestjs/src/modules/store-ops/checklist-store-score-integration-schema-contract.spec.ts
git commit -m "fix: snapshot only completed checklist visits"
```

---

## Task 2: Add Store Score Blend Calculator

**Files:**

- Create: `backend/nestjs/src/modules/store-ops/application/store-score-blend.contract.ts`
- Create: `backend/nestjs/src/modules/store-ops/application/store-score-blend.service.ts`
- Create: `backend/nestjs/src/modules/store-ops/application/store-score-blend.service.spec.ts`

- [ ] **Step 1: Write failing calculator tests**

Create `backend/nestjs/src/modules/store-ops/application/store-score-blend.service.spec.ts`:

```ts
import { StoreScoreBlendService } from "./store-score-blend.service";

describe("StoreScoreBlendService", () => {
  const service = new StoreScoreBlendService();

  it("blends monthly KPI score with completed BM checklist at 95/5", () => {
    const result = service.calculateMonthlyStoreScore({
      monthlyKpiScore: 108,
      bmChecklist: { score: 80, visitCount: 2 },
      config: { kpiPerformanceWeight: 95, bmChecklistWeight: 5, vmChecklistWeight: 0 },
    });

    expect(result.totalScore).toBe(106.6);
    expect(result.components.kpi.contribution).toBe(102.6);
    expect(result.components.bmChecklist.contribution).toBe(4);
    expect(result.components.bmChecklist.status).toBe("included");
  });

  it("does not penalize missing BM checklist", () => {
    const result = service.calculateMonthlyStoreScore({
      monthlyKpiScore: 108,
      bmChecklist: null,
      config: { kpiPerformanceWeight: 95, bmChecklistWeight: 5, vmChecklistWeight: 0 },
    });

    expect(result.totalScore).toBe(108);
    expect(result.components.kpi.weight).toBe(100);
    expect(result.components.kpi.contribution).toBe(108);
    expect(result.components.bmChecklist.included).toBe(false);
    expect(result.components.bmChecklist.status).toBe("not_included");
  });

  it("keeps inactive VM checklist from reducing the score", () => {
    const result = service.calculateMonthlyStoreScore({
      monthlyKpiScore: 100,
      bmChecklist: { score: 100, visitCount: 1 },
      config: { kpiPerformanceWeight: 95, bmChecklistWeight: 5, vmChecklistWeight: 0 },
    });

    expect(result.totalScore).toBe(100);
    expect(result.components.vmChecklist.status).toBe("future_inactive");
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/store-score-blend.service.spec.ts --runInBand
```

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Add contracts**

Create `backend/nestjs/src/modules/store-ops/application/store-score-blend.contract.ts`:

```ts
export type StoreScoreBlendConfig = {
  kpiPerformanceWeight: number;
  bmChecklistWeight: number;
  vmChecklistWeight: number;
};

export type StoreChecklistScoreInput = {
  score: number;
  visitCount: number;
};

export type StoreScoreComponentStatus =
  | "included"
  | "not_included"
  | "missing_reference"
  | "future_inactive";

export type StoreScoreBlendInput = {
  monthlyKpiScore: number | null;
  bmChecklist: StoreChecklistScoreInput | null;
  config: StoreScoreBlendConfig;
};

export type StoreScoreBlendResult = {
  totalScore: number | null;
  components: {
    kpi: {
      included: boolean;
      score: number | null;
      weight: number;
      contribution: number | null;
      status: StoreScoreComponentStatus;
      missingReason?: string;
    };
    bmChecklist: {
      included: boolean;
      score: number | null;
      weight: number;
      contribution: number | null;
      visitCount: number;
      status: StoreScoreComponentStatus;
      missingReason?: string;
    };
    vmChecklist: {
      included: false;
      score: null;
      weight: number;
      contribution: null;
      visitCount: 0;
      status: "future_inactive";
    };
  };
};
```

- [ ] **Step 4: Add minimal implementation**

Create `backend/nestjs/src/modules/store-ops/application/store-score-blend.service.ts`:

```ts
import {
  StoreScoreBlendInput,
  StoreScoreBlendResult,
} from "./store-score-blend.contract";

export class StoreScoreBlendService {
  calculateMonthlyStoreScore(input: StoreScoreBlendInput): StoreScoreBlendResult {
    const monthlyKpiScore = input.monthlyKpiScore;
    const hasKpiScore = typeof monthlyKpiScore === "number" && Number.isFinite(monthlyKpiScore);
    const hasBmChecklist =
      input.bmChecklist !== null &&
      Number.isFinite(input.bmChecklist.score) &&
      input.bmChecklist.visitCount > 0;

    if (!hasKpiScore) {
      return {
        totalScore: null,
        components: {
          kpi: {
            included: false,
            score: null,
            weight: 0,
            contribution: null,
            status: "missing_reference",
            missingReason: "monthly_kpi_score_missing",
          },
          bmChecklist: {
            included: hasBmChecklist,
            score: hasBmChecklist ? input.bmChecklist!.score : null,
            weight: hasBmChecklist ? input.config.bmChecklistWeight : 0,
            contribution: hasBmChecklist ? 0 : null,
            visitCount: hasBmChecklist ? input.bmChecklist!.visitCount : 0,
            status: hasBmChecklist ? "included" : "not_included",
          },
          vmChecklist: this.futureInactiveVm(input.config.vmChecklistWeight),
        },
      };
    }

    if (!hasBmChecklist) {
      return {
        totalScore: this.round(monthlyKpiScore),
        components: {
          kpi: {
            included: true,
            score: monthlyKpiScore,
            weight: 100,
            contribution: this.round(monthlyKpiScore),
            status: "included",
          },
          bmChecklist: {
            included: false,
            score: null,
            weight: 0,
            contribution: null,
            visitCount: 0,
            status: "not_included",
            missingReason: "bm_checklist_not_completed_for_period",
          },
          vmChecklist: this.futureInactiveVm(input.config.vmChecklistWeight),
        },
      };
    }

    const kpiContribution = monthlyKpiScore * (input.config.kpiPerformanceWeight / 100);
    const bmContribution = input.bmChecklist!.score * (input.config.bmChecklistWeight / 100);

    return {
      totalScore: this.round(kpiContribution + bmContribution),
      components: {
        kpi: {
          included: true,
          score: monthlyKpiScore,
          weight: input.config.kpiPerformanceWeight,
          contribution: this.round(kpiContribution),
          status: "included",
        },
        bmChecklist: {
          included: true,
          score: input.bmChecklist!.score,
          weight: input.config.bmChecklistWeight,
          contribution: this.round(bmContribution),
          visitCount: input.bmChecklist!.visitCount,
          status: "included",
        },
        vmChecklist: this.futureInactiveVm(input.config.vmChecklistWeight),
      },
    };
  }

  private futureInactiveVm(weight: number): StoreScoreBlendResult["components"]["vmChecklist"] {
    return {
      included: false,
      score: null,
      weight,
      contribution: null,
      visitCount: 0,
      status: "future_inactive",
    };
  }

  private round(value: number) {
    return Number(value.toFixed(2));
  }
}
```

- [ ] **Step 5: Run tests and verify GREEN**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/store-score-blend.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add backend/nestjs/src/modules/store-ops/application/store-score-blend.contract.ts backend/nestjs/src/modules/store-ops/application/store-score-blend.service.ts backend/nestjs/src/modules/store-ops/application/store-score-blend.service.spec.ts
git commit -m "feat: add store score blend calculator"
```

---

## Task 3: Add Reporting Repository Read Model

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts`

- [ ] **Step 1: Add failing repository tests**

Extend `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.spec.ts`:

```ts
describe("ReportingRepository store monthly score breakdown queries", () => {
  function createRepository() {
    const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({ rowCount: 0, rows: [] }));
    const repository = new ReportingRepository({ query } as never);
    return { query, repository };
  }

  it("queries monthly KPI snapshot rows for a store and snapshot run", async () => {
    const { query, repository } = createRepository();

    await repository.getStoreKpiSnapshotRowsForScore({
      snapshotRunId: "00000000-0000-4000-8000-000000000001",
      storeId: "00000000-0000-4000-8000-000000000002",
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("FROM rpt.store_kpi_snapshot sks"),
      ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"],
    );
  });

  it("queries completed BM checklist snapshot rows by template type", async () => {
    const { query, repository } = createRepository();

    await repository.getStoreChecklistSnapshotForScore({
      snapshotRunId: "00000000-0000-4000-8000-000000000001",
      storeId: "00000000-0000-4000-8000-000000000002",
      templateType: "BM_STORE_VISIT",
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("ct.template_type = $3"),
      [
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
        "BM_STORE_VISIT",
      ],
    );
  });
});
```

- [ ] **Step 2: Run repository tests and verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/infrastructure/reporting.repository.spec.ts --runInBand
```

Expected: FAIL because the repository methods do not exist.

- [ ] **Step 3: Add repository methods**

Add to `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`:

```ts
async getStoreKpiSnapshotRowsForScore(input: { snapshotRunId: string; storeId: string }) {
  const result = await this.databaseService.query<{
    kpi_code: string;
    actual_value: string | null;
    target_value: string | null;
    achievement_rate: string | null;
  }>(
    `
      SELECT
        kd.kpi_code,
        sks.actual_value::text AS actual_value,
        sks.target_value::text AS target_value,
        sks.achievement_rate::text AS achievement_rate
      FROM rpt.store_kpi_snapshot sks
      INNER JOIN ops.kpi_definition kd
        ON kd.kpi_id = sks.kpi_id
      WHERE sks.snapshot_run_id = $1::uuid
        AND sks.store_id = $2::uuid
      ORDER BY kd.kpi_code ASC
    `,
    [input.snapshotRunId, input.storeId],
  );

  return result.rows;
}

async getStoreChecklistSnapshotForScore(input: {
  snapshotRunId: string;
  storeId: string;
  templateType: string;
}) {
  const result = await this.databaseService.query<{
    checklist_template_id: string;
    audit_count: number;
    avg_score: string | null;
  }>(
    `
      SELECT
        scs.checklist_template_id,
        scs.audit_count,
        scs.avg_score::text AS avg_score
      FROM rpt.store_checklist_snapshot scs
      INNER JOIN ops.checklist_template ct
        ON ct.checklist_template_id = scs.checklist_template_id
      WHERE scs.snapshot_run_id = $1::uuid
        AND scs.store_id = $2::uuid
        AND ct.template_type = $3
      ORDER BY scs.audit_count DESC, scs.checklist_template_id ASC
      LIMIT 1
    `,
    [input.snapshotRunId, input.storeId, input.templateType],
  );

  return result.rows[0] ?? null;
}
```

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
git commit -m "feat: read store checklist score snapshot"
```

---

## Task 4: Add Backend Score Breakdown Service/API

**Files:**

- Create: `backend/nestjs/src/modules/store-ops/application/reporting.service.store-score-blend.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts`

- [ ] **Step 1: Add failing service test**

Create `backend/nestjs/src/modules/store-ops/application/reporting.service.store-score-blend.spec.ts`:

```ts
import { ReportingService } from "./reporting.service";

describe("ReportingService store monthly score breakdown", () => {
  it("returns KPI plus BM checklist contribution for a monthly snapshot", async () => {
    const reportingRepository = {
      getStoreKpiSnapshotRowsForScore: jest.fn(async () => [
        { kpi_code: "TARGET_ACHIEVEMENT", achievement_rate: "1.10" },
        { kpi_code: "CR", achievement_rate: "1.00" },
      ]),
      getStoreChecklistSnapshotForScore: jest.fn(async () => ({
        checklist_template_id: "checklist-template-1",
        audit_count: 2,
        avg_score: "80",
      })),
    };
    const service = new ReportingService(
      reportingRepository as never,
      {
        getKpiConfigRows: jest.fn(async () => []),
        getLatestPublishedKpiConfigVersion: jest.fn(async () => null),
      } as never,
    );

    const result = await service.getStoreMonthlyScoreBreakdown({
      snapshotRunId: "snapshot-1",
      storeId: "store-1",
    });

    expect(result.components.bmChecklist.status).toBe("included");
    expect(result.components.bmChecklist.visitCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run service test and verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/reporting.service.store-score-blend.spec.ts --runInBand
```

Expected: FAIL because `getStoreMonthlyScoreBreakdown` does not exist.

- [ ] **Step 3: Add service method**

Add to `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`:

```ts
async getStoreMonthlyScoreBreakdown(input: { snapshotRunId: string; storeId: string }) {
  const config = await this.getKpiConfig();
  const kpiRows = await this.reportingRepository.getStoreKpiSnapshotRowsForScore(input);
  const bmChecklist = await this.reportingRepository.getStoreChecklistSnapshotForScore({
    ...input,
    templateType: "BM_STORE_VISIT",
  });

  const storeMetricWeights = config.storeProfile.metrics.filter(
    (metric) => !["BM_CHECKLIST", "VM_CHECKLIST"].includes(metric.code),
  );
  const kpiWeightTotal = storeMetricWeights.reduce(
    (sum, metric) => sum + metric.weightPercent,
    0,
  );
  const kpiScore = storeMetricWeights.reduce((sum, metric) => {
    const row = kpiRows.find((item) => item.kpi_code === metric.code);
    const rate = row?.achievement_rate !== null && row?.achievement_rate !== undefined
      ? Number(row.achievement_rate)
      : null;
    if (rate === null || !Number.isFinite(rate) || kpiWeightTotal === 0) {
      return sum;
    }
    return sum + rate * (metric.weightPercent / kpiWeightTotal) * 100;
  }, 0);

  const blendService = new StoreScoreBlendService();
  return {
    snapshotRunId: input.snapshotRunId,
    storeId: input.storeId,
    scoreStatus: "final" as const,
    ...blendService.calculateMonthlyStoreScore({
      monthlyKpiScore: Number(kpiScore.toFixed(2)),
      bmChecklist: bmChecklist?.avg_score
        ? { score: Number(bmChecklist.avg_score), visitCount: Number(bmChecklist.audit_count) }
        : null,
      config: {
        kpiPerformanceWeight: 95,
        bmChecklistWeight: 5,
        vmChecklistWeight: 0,
      },
    }),
  };
}
```

Add import:

```ts
import { StoreScoreBlendService } from "./store-score-blend.service";
```

- [ ] **Step 4: Add controller route**

Add to `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts`:

```ts
@Get("store-score-breakdown")
async getStoreScoreBreakdown(
  @Query("snapshotRunId") snapshotRunId: string,
  @Query("storeId") storeId: string,
) {
  return this.reportingService.getStoreMonthlyScoreBreakdown({ snapshotRunId, storeId });
}
```

If this controller already applies scope guards for report routes, use the existing guard pattern and pass scoped store ids before returning data.

- [ ] **Step 5: Run targeted service test**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/reporting.service.store-score-blend.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add backend/nestjs/src/modules/store-ops/application/reporting.service.ts backend/nestjs/src/modules/store-ops/application/reporting.service.store-score-blend.spec.ts backend/nestjs/src/modules/store-ops/web/reporting.controller.ts
git commit -m "feat: expose store score breakdown"
```

---

## Task 5: Add Frontend Breakdown Display

**Files:**

- Modify: `admin-web/src/features/checklists/api.ts`
- Modify: `admin-web/src/pages/ReportsKpisPage.tsx`
- Modify: `admin-web/src/pages/StoreKpiHighlightsPage.tsx`
- Create: `admin-web/e2e/store-score-breakdown.spec.ts`

- [ ] **Step 1: Add failing Playwright smoke**

Create `admin-web/e2e/store-score-breakdown.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("store score breakdown explains missing BM checklist", async ({ page }) => {
  await page.goto("/store/kpi-highlights");
  await expect(page.getByText(/BM checklist/i)).toBeVisible();
  await expect(page.getByText(/skora dahil edilmedi|not included/i)).toBeVisible();
});
```

- [ ] **Step 2: Run smoke and verify RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- e2e/store-score-breakdown.spec.ts
```

Expected: FAIL because the UI does not yet render the breakdown copy.

- [ ] **Step 3: Add API helper type and fetcher**

In `admin-web/src/features/checklists/api.ts`, add:

```ts
export type StoreMonthlyScoreBreakdown = {
  snapshotRunId: string;
  storeId: string;
  scoreStatus: "preview" | "final";
  totalScore: number | null;
  components: {
    kpi: {
      included: boolean;
      score: number | null;
      weight: number;
      contribution: number | null;
      status: string;
      missingReason?: string;
    };
    bmChecklist: {
      included: boolean;
      score: number | null;
      weight: number;
      contribution: number | null;
      visitCount: number;
      status: string;
      missingReason?: string;
    };
    vmChecklist: {
      included: false;
      score: null;
      weight: number;
      contribution: null;
      visitCount: 0;
      status: "future_inactive";
    };
  };
};
```

- [ ] **Step 4: Render score breakdown copy**

In `admin-web/src/pages/StoreKpiHighlightsPage.tsx`, add a compact section near the score summary:

```tsx
<section className="section-block">
  <h2>Skor kırılımı</h2>
  <p>KPI katkısı mağaza performansından, BM checklist katkısı aylık tamamlanan ziyaretlerden gelir.</p>
  <div>
    <strong>BM checklist</strong>
    <span>
      {breakdown?.components.bmChecklist.included
        ? `${breakdown.components.bmChecklist.visitCount} checklist yapıldı`
        : "Bu dönem skora dahil edilmedi"}
    </span>
  </div>
</section>
```

Use existing page styles and data-loading patterns. Do not create a new visual system.

- [ ] **Step 5: Run frontend smoke**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- e2e/store-score-breakdown.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add admin-web/src/features/checklists/api.ts admin-web/src/pages/StoreKpiHighlightsPage.tsx admin-web/e2e/store-score-breakdown.spec.ts
git commit -m "feat: show store score checklist breakdown"
```

---

## Task 6: Release Checks And Handoff

**Files:**

- Modify: `current-state.md`
- Modify: `docs/plans/active-next-actions.md`
- Modify: `docs/plans/project-debt-ledger.md`

- [ ] **Step 1: Run backend targeted tests**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/checklist-store-score-integration-schema-contract.spec.ts src/modules/store-ops/application/store-score-blend.service.spec.ts src/modules/store-ops/application/reporting.service.store-score-blend.spec.ts src/modules/store-ops/infrastructure/reporting.repository.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run backend build**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 3: Run frontend targeted smoke**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run test:e2e -- e2e/store-score-breakdown.spec.ts
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
## Son Checklist Store Score Integration V1 Implementation

- BM checklist monthly score is included as 5% when completed visits exist.
- Missing BM checklist does not penalize the store.
- Checklist snapshot generation uses completed_at and completed status.
- Store score breakdown exposes KPI and BM checklist contribution.
- VM checklist remains future inactive.
```

Update `docs/plans/active-next-actions.md` so the next item becomes KPI Benchmark Scoring V1.

- [ ] **Step 6: Commit final handoff**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add current-state.md docs/plans/active-next-actions.md docs/plans/project-debt-ledger.md
git commit -m "docs: close checklist score integration handoff"
```

## Self-Review Checklist

- [ ] Completed checklist snapshot uses `completed_at`, not `created_at`.
- [ ] Draft and in-progress checklists cannot affect score.
- [ ] Missing BM checklist is excluded, not scored as zero.
- [ ] VM checklist is explicitly future inactive.
- [ ] Store manager acknowledgement does not gate score inclusion.
- [ ] Score breakdown is returned by backend and rendered by frontend.
- [ ] Release check passes before moving to KPI benchmark scoring.

## Next Plan To Execute

After this plan is implemented and verified, execute:

- `docs/superpowers/plans/2026-04-29-kpi-benchmark-scoring-v1.md`
