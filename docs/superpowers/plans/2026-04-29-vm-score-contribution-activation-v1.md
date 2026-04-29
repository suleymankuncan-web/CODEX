# VM Score Contribution Activation V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate `VM_STORE_VISIT` as a monthly store score component with KPI `90%`, BM checklist `5%`, VM checklist `5%`, while returning missing checklist weight to KPI.

**Architecture:** Keep score math backend-owned in `StoreScoreBlendService`, keep checklist aggregation in the existing reporting snapshot path, and make the frontend render backend-provided configured/effective weights. This phase does not change checklist permissions, auth/session behavior, migrations, or daily score surfaces.

**Tech Stack:** NestJS, TypeScript, PostgreSQL reporting snapshots, Jest, React/Vite, TanStack Query, Playwright.

---

## Scope Boundary

In scope:

- VM checklist contribution becomes active for monthly store score breakdown.
- Full configured blend is KPI `90`, BM `5`, VM `5`.
- Missing BM checklist returns BM weight to KPI.
- Missing VM checklist returns VM weight to KPI.
- Missing checklist is never treated as zero.
- Completed low checklist scores affect the monthly score with their configured small weight.
- Backend returns `missingWeightPolicy`, `configuredWeights`, and `effectiveWeights`.
- Store-facing KPI page shows BM and VM checklist status, contribution, and why a component is not included.

Out of scope:

- Daily score contribution.
- New database tables or migrations.
- Changing checklist completion or acknowledgement workflow.
- Changing VM permissions.
- Changing Keycloak, mobile auth, or session behavior.
- Retroactive mutation of finalized historical snapshots.
- Region, store type, or store specific checklist weights.
- Photo attachment impact.

## Existing Code Map

Backend:

- Modify: `backend/nestjs/src/modules/store-ops/application/store-score-blend.contract.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/store-score-blend.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/store-score-blend.service.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/reporting.service.store-score-blend.spec.ts`

Repository:

- Reuse: `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`
- No planned change unless a test exposes a strict typing issue. `getStoreChecklistSnapshotForScore` already accepts `templateType`.

Frontend:

- Modify: `admin-web/src/features/reports/api.ts`
- Modify: `admin-web/src/pages/StoreKpiHighlightsPage.tsx`
- Modify: `admin-web/e2e/kpi-benchmark-explainability.spec.ts`

Docs:

- Modify: `current-state.md`

No migration is expected.

## Task 1: Store Score Blend Contract And Unit Tests

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/application/store-score-blend.contract.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/store-score-blend.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/store-score-blend.service.spec.ts`

- [ ] **Step 1: Write failing blend tests**

Replace `backend/nestjs/src/modules/store-ops/application/store-score-blend.service.spec.ts` with scenario coverage for the locked cases.

```ts
import { StoreScoreBlendService } from "./store-score-blend.service";

describe("StoreScoreBlendService", () => {
  const service = new StoreScoreBlendService();
  const activeConfig = {
    kpiPerformanceWeight: 90,
    bmChecklistWeight: 5,
    vmChecklistWeight: 5,
    missingWeightPolicy: "return_missing_weight_to_kpi" as const,
  };

  it("blends KPI, BM, and VM at 90/5/5 when both checklists are completed", () => {
    const result = service.calculateMonthlyStoreScore({
      monthlyKpiScore: 100,
      bmChecklist: { score: 80, visitCount: 1 },
      vmChecklist: { score: 100, visitCount: 1 },
      config: activeConfig,
    });

    expect(result.totalScore).toBe(99);
    expect(result.configuredWeights).toEqual({
      kpiPerformanceWeight: 90,
      bmChecklistWeight: 5,
      vmChecklistWeight: 5,
    });
    expect(result.effectiveWeights).toEqual({
      kpiPerformanceWeight: 90,
      bmChecklistWeight: 5,
      vmChecklistWeight: 5,
    });
    expect(result.components.kpi.contribution).toBe(90);
    expect(result.components.bmChecklist.contribution).toBe(4);
    expect(result.components.vmChecklist.contribution).toBe(5);
  });

  it("returns missing VM weight to KPI when BM is completed and VM is missing", () => {
    const result = service.calculateMonthlyStoreScore({
      monthlyKpiScore: 100,
      bmChecklist: { score: 80, visitCount: 1 },
      vmChecklist: null,
      config: activeConfig,
    });

    expect(result.totalScore).toBe(99);
    expect(result.effectiveWeights).toEqual({
      kpiPerformanceWeight: 95,
      bmChecklistWeight: 5,
      vmChecklistWeight: 0,
    });
    expect(result.components.vmChecklist).toEqual({
      included: false,
      score: null,
      weight: 0,
      contribution: null,
      visitCount: 0,
      status: "not_included",
      missingReason: "vm_checklist_not_completed_for_period",
    });
  });

  it("returns missing BM weight to KPI when VM is completed and BM is missing", () => {
    const result = service.calculateMonthlyStoreScore({
      monthlyKpiScore: 100,
      bmChecklist: null,
      vmChecklist: { score: 90, visitCount: 1 },
      config: activeConfig,
    });

    expect(result.totalScore).toBe(99.5);
    expect(result.effectiveWeights).toEqual({
      kpiPerformanceWeight: 95,
      bmChecklistWeight: 0,
      vmChecklistWeight: 5,
    });
    expect(result.components.bmChecklist.missingReason).toBe(
      "bm_checklist_not_completed_for_period",
    );
  });

  it("uses KPI at 100 percent when both checklist components are missing", () => {
    const result = service.calculateMonthlyStoreScore({
      monthlyKpiScore: 100,
      bmChecklist: null,
      vmChecklist: null,
      config: activeConfig,
    });

    expect(result.totalScore).toBe(100);
    expect(result.effectiveWeights).toEqual({
      kpiPerformanceWeight: 100,
      bmChecklistWeight: 0,
      vmChecklistWeight: 0,
    });
  });

  it("keeps total score null when monthly KPI score is missing", () => {
    const result = service.calculateMonthlyStoreScore({
      monthlyKpiScore: null,
      bmChecklist: { score: 80, visitCount: 1 },
      vmChecklist: { score: 90, visitCount: 1 },
      config: activeConfig,
    });

    expect(result.totalScore).toBeNull();
    expect(result.components.kpi.status).toBe("missing_reference");
    expect(result.components.kpi.missingReason).toBe("monthly_kpi_score_missing");
    expect(result.components.bmChecklist.status).toBe("included");
    expect(result.components.vmChecklist.status).toBe("included");
    expect(result.components.bmChecklist.contribution).toBeNull();
    expect(result.components.vmChecklist.contribution).toBeNull();
  });
});
```

- [ ] **Step 2: Verify RED**

Run from the repo root:

```powershell
Set-Location .\backend\nestjs
npm.cmd test -- src/modules/store-ops/application/store-score-blend.service.spec.ts --runInBand
```

Expected: FAIL because `StoreScoreBlendInput` has no `vmChecklist`, result has no `configuredWeights` or `effectiveWeights`, and VM is still `future_inactive`.

- [ ] **Step 3: Extend the blend contract**

Modify `backend/nestjs/src/modules/store-ops/application/store-score-blend.contract.ts`.

```ts
export type MissingWeightPolicy = "return_missing_weight_to_kpi";

export type StoreScoreBlendConfig = {
  kpiPerformanceWeight: number;
  bmChecklistWeight: number;
  vmChecklistWeight: number;
  missingWeightPolicy?: MissingWeightPolicy;
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

export type StoreScoreWeights = {
  kpiPerformanceWeight: number;
  bmChecklistWeight: number;
  vmChecklistWeight: number;
};

export type StoreScoreComponent = {
  included: boolean;
  score: number | null;
  weight: number;
  contribution: number | null;
  status: StoreScoreComponentStatus;
  missingReason?: string;
};

export type StoreChecklistScoreComponent = StoreScoreComponent & {
  visitCount: number;
};

export type StoreScoreBlendInput = {
  monthlyKpiScore: number | null;
  bmChecklist: StoreChecklistScoreInput | null;
  vmChecklist: StoreChecklistScoreInput | null;
  config: StoreScoreBlendConfig;
};

export type StoreScoreBlendResult = {
  totalScore: number | null;
  missingWeightPolicy: MissingWeightPolicy;
  configuredWeights: StoreScoreWeights;
  effectiveWeights: StoreScoreWeights;
  components: {
    kpi: StoreScoreComponent;
    bmChecklist: StoreChecklistScoreComponent;
    vmChecklist: StoreChecklistScoreComponent;
  };
};
```

- [ ] **Step 4: Implement effective weight calculation**

Modify `backend/nestjs/src/modules/store-ops/application/store-score-blend.service.ts`.

Use helpers with these exact behaviors:

```ts
private hasChecklist(input: StoreChecklistScoreInput | null) {
  return (
    input !== null &&
    Number.isFinite(input.score) &&
    input.visitCount > 0
  );
}

private configuredWeights(config: StoreScoreBlendConfig) {
  return {
    kpiPerformanceWeight: config.kpiPerformanceWeight,
    bmChecklistWeight: config.bmChecklistWeight,
    vmChecklistWeight: config.vmChecklistWeight,
  };
}

private effectiveWeights(input: {
  config: StoreScoreBlendConfig;
  hasBmChecklist: boolean;
  hasVmChecklist: boolean;
}) {
  const weights = this.configuredWeights(input.config);

  if (!input.hasBmChecklist) {
    weights.kpiPerformanceWeight += weights.bmChecklistWeight;
    weights.bmChecklistWeight = 0;
  }

  if (!input.hasVmChecklist) {
    weights.kpiPerformanceWeight += weights.vmChecklistWeight;
    weights.vmChecklistWeight = 0;
  }

  return weights;
}
```

In `calculateMonthlyStoreScore`:

```ts
const hasKpiScore =
  typeof monthlyKpiScore === "number" && Number.isFinite(monthlyKpiScore);
const hasBmChecklist = this.hasChecklist(input.bmChecklist);
const hasVmChecklist = this.hasChecklist(input.vmChecklist);
const configuredWeights = this.configuredWeights(input.config);
const effectiveWeights = this.effectiveWeights({
  config: input.config,
  hasBmChecklist,
  hasVmChecklist,
});
```

When KPI is missing:

- `totalScore` is `null`.
- `kpi.weight` is `0`.
- included checklist components keep their configured weight and score evidence.
- included checklist contributions are `null`.
- missing checklist components remain `not_included`.

When KPI exists:

- KPI contribution uses `effectiveWeights.kpiPerformanceWeight`.
- BM contribution uses `effectiveWeights.bmChecklistWeight`.
- VM contribution uses `effectiveWeights.vmChecklistWeight`.
- Total is the rounded sum of non-null contributions.

Use this missing component mapper:

```ts
private checklistComponent(input: {
  checklist: StoreChecklistScoreInput | null;
  configuredWeight: number;
  effectiveWeight: number;
  hasKpiScore: boolean;
  missingReason: string;
}) {
  const hasChecklist = this.hasChecklist(input.checklist);

  if (!hasChecklist) {
    return {
      included: false,
      score: null,
      weight: 0,
      contribution: null,
      visitCount: 0,
      status: "not_included" as const,
      missingReason: input.missingReason,
    };
  }

  const contribution = input.hasKpiScore
    ? this.round(input.checklist!.score * (input.effectiveWeight / 100))
    : null;

  return {
    included: true,
    score: input.checklist!.score,
    weight: input.hasKpiScore ? input.effectiveWeight : input.configuredWeight,
    contribution,
    visitCount: input.checklist!.visitCount,
    status: "included" as const,
  };
}
```

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
Set-Location .\backend\nestjs
npm.cmd test -- src/modules/store-ops/application/store-score-blend.service.spec.ts --runInBand
```

Expected: PASS.

## Task 2: Reporting Service Reads BM And VM Checklist Snapshots

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/reporting.service.store-score-blend.spec.ts`

- [ ] **Step 1: Write failing reporting tests**

Replace `backend/nestjs/src/modules/store-ops/application/reporting.service.store-score-blend.spec.ts` with these cases:

```ts
import { ReportingService } from "./reporting.service";

describe("ReportingService store monthly score breakdown", () => {
  const createService = (reportingRepository: Record<string, jest.Mock>) =>
    new ReportingService(
      reportingRepository as never,
      {
        getKpiConfigRows: jest.fn(async () => []),
        getLatestPublishedKpiConfigVersion: jest.fn(async () => null),
      } as never,
      {} as never,
    );

  it("returns KPI plus BM and VM checklist contribution for a monthly snapshot", async () => {
    const reportingRepository = {
      getStoreKpiSnapshotRowsForScore: jest.fn(async () => [
        { kpi_code: "TARGET_ACHIEVEMENT", achievement_rate: "1.00" },
        { kpi_code: "CR", achievement_rate: "1.00" },
      ]),
      getStoreChecklistSnapshotForScore: jest
        .fn()
        .mockImplementation(async (input: { templateType: string }) => {
          if (input.templateType === "BM_STORE_VISIT") {
            return {
              checklist_template_id: "bm-template-1",
              audit_count: 1,
              avg_score: "80",
            };
          }

          if (input.templateType === "VM_STORE_VISIT") {
            return {
              checklist_template_id: "vm-template-1",
              audit_count: 1,
              avg_score: "100",
            };
          }

          return null;
        }),
    };
    const service = createService(reportingRepository);

    const result = await service.getStoreMonthlyScoreBreakdown({
      snapshotRunId: "snapshot-1",
      storeId: "store-1",
      storeIds: ["store-1"],
    });

    expect(reportingRepository.getStoreChecklistSnapshotForScore).toHaveBeenCalledWith({
      snapshotRunId: "snapshot-1",
      storeId: "store-1",
      templateType: "BM_STORE_VISIT",
    });
    expect(reportingRepository.getStoreChecklistSnapshotForScore).toHaveBeenCalledWith({
      snapshotRunId: "snapshot-1",
      storeId: "store-1",
      templateType: "VM_STORE_VISIT",
    });
    expect(result.configuredWeights).toEqual({
      kpiPerformanceWeight: 90,
      bmChecklistWeight: 5,
      vmChecklistWeight: 5,
    });
    expect(result.effectiveWeights).toEqual({
      kpiPerformanceWeight: 90,
      bmChecklistWeight: 5,
      vmChecklistWeight: 5,
    });
    expect(result.components.bmChecklist.status).toBe("included");
    expect(result.components.vmChecklist.status).toBe("included");
  });

  it("returns VM missing weight to KPI when no VM checklist snapshot exists", async () => {
    const reportingRepository = {
      getStoreKpiSnapshotRowsForScore: jest.fn(async () => [
        { kpi_code: "TARGET_ACHIEVEMENT", achievement_rate: "1.00" },
        { kpi_code: "CR", achievement_rate: "1.00" },
      ]),
      getStoreChecklistSnapshotForScore: jest
        .fn()
        .mockImplementation(async (input: { templateType: string }) =>
          input.templateType === "BM_STORE_VISIT"
            ? {
                checklist_template_id: "bm-template-1",
                audit_count: 1,
                avg_score: "80",
              }
            : null,
        ),
    };
    const service = createService(reportingRepository);

    const result = await service.getStoreMonthlyScoreBreakdown({
      snapshotRunId: "snapshot-1",
      storeId: "store-1",
      storeIds: ["store-1"],
    });

    expect(result.effectiveWeights).toEqual({
      kpiPerformanceWeight: 95,
      bmChecklistWeight: 5,
      vmChecklistWeight: 0,
    });
    expect(result.components.vmChecklist.status).toBe("not_included");
    expect(result.components.vmChecklist.missingReason).toBe(
      "vm_checklist_not_completed_for_period",
    );
  });

  it("rejects store score breakdown outside store scope", async () => {
    const service = createService({});

    await expect(
      service.getStoreMonthlyScoreBreakdown({
        snapshotRunId: "snapshot-1",
        storeId: "store-2",
        storeIds: ["store-1"],
      }),
    ).rejects.toThrow("Store score breakdown is outside current store scope.");
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
Set-Location .\backend\nestjs
npm.cmd test -- src/modules/store-ops/application/reporting.service.store-score-blend.spec.ts --runInBand
```

Expected: FAIL because reporting currently fetches only BM and uses config `95/5/0`.

- [ ] **Step 3: Fetch VM checklist snapshot beside BM**

Modify `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`.

Change the `Promise.all` in `getStoreMonthlyScoreBreakdown`:

```ts
const [config, kpiRows, bmChecklist, vmChecklist] = await Promise.all([
  this.getKpiConfig(),
  this.reportingRepository.getStoreKpiSnapshotRowsForScore({
    snapshotRunId: input.snapshotRunId,
    storeId: input.storeId,
  }),
  this.reportingRepository.getStoreChecklistSnapshotForScore({
    snapshotRunId: input.snapshotRunId,
    storeId: input.storeId,
    templateType: "BM_STORE_VISIT",
  }),
  this.reportingRepository.getStoreChecklistSnapshotForScore({
    snapshotRunId: input.snapshotRunId,
    storeId: input.storeId,
    templateType: "VM_STORE_VISIT",
  }),
]);
```

- [ ] **Step 4: Add checklist snapshot mapper**

In the same method, before calling the blend service:

```ts
const mapChecklistSnapshot = (
  checklist: { avg_score: string | null; audit_count: number } | null,
) =>
  checklist?.avg_score !== null && checklist?.avg_score !== undefined
    ? {
        score: Number(checklist.avg_score),
        visitCount: Number(checklist.audit_count),
      }
    : null;
```

- [ ] **Step 5: Switch reporting blend config to VM-active weights**

Update the blend call:

```ts
...blendService.calculateMonthlyStoreScore({
  monthlyKpiScore:
    kpiScore !== null && Number.isFinite(kpiScore)
      ? Number(kpiScore.toFixed(2))
      : null,
  bmChecklist: mapChecklistSnapshot(bmChecklist),
  vmChecklist: mapChecklistSnapshot(vmChecklist),
  config: {
    kpiPerformanceWeight: 90,
    bmChecklistWeight: 5,
    vmChecklistWeight: 5,
    missingWeightPolicy: "return_missing_weight_to_kpi",
  },
}),
```

- [ ] **Step 6: Verify reporting GREEN**

Run:

```powershell
Set-Location .\backend\nestjs
npm.cmd test -- src/modules/store-ops/application/reporting.service.store-score-blend.spec.ts --runInBand
```

Expected: PASS.

## Task 3: Frontend Type And Store KPI Breakdown Copy

**Files:**

- Modify: `admin-web/src/features/reports/api.ts`
- Modify: `admin-web/src/pages/StoreKpiHighlightsPage.tsx`
- Modify: `admin-web/e2e/kpi-benchmark-explainability.spec.ts`

- [ ] **Step 1: Add failing Playwright coverage for VM score breakdown copy**

Modify `admin-web/e2e/kpi-benchmark-explainability.spec.ts`.

Add routes in `routeBenchmarkExplainabilityApi`:

```ts
await page.route('**/api/reports/snapshot-runs**', async (route) => {
  await route.fulfill({ json: snapshotRunsFixture })
});

await page.route('**/api/reports/kpis**', async (route) => {
  await route.fulfill({ json: kpiRowsFixture })
});

await page.route('**/api/reports/store-score-breakdown**', async (route) => {
  await route.fulfill({ json: storeScoreBreakdownFixture })
});
```

Add the test:

```ts
test('store KPI closed view explains effective BM and VM checklist weights', async ({ page }) => {
  await page.goto('/store/kpis');

  await page.getByRole('button', { name: 'Kapanmis gun' }).click();

  await expect(page.getByText('VM checklist: bu donem skora dahil edilmedi')).toBeVisible();
  await expect(page.getByText('VM payi KPI tarafinda kaldi')).toBeVisible();
  await expect(page.getByText('BM checklist katkisi')).toBeVisible();
  await expect(page.getByText('Configured 90/5/5')).toBeVisible();
  await expect(page.getByText('Effective 95/5/0')).toBeVisible();
});
```

Add fixtures:

```ts
const snapshotRunsFixture = {
  items: [
    {
      snapshotRunId: 'snapshot-1',
      snapshotDate: '2026-03-31',
      snapshotType: 'daily',
      periodStart: '2026-03-31',
      periodEnd: '2026-03-31',
      runStatus: 'completed',
      generatedAt: '2026-04-01T00:00:00.000Z',
      generatedBy: 'system',
    },
  ],
  meta: { count: 1, total: 1, limit: 1, offset: 0 },
};

const kpiRowsFixture = {
  items: [
    {
      snapshotRunId: 'snapshot-1',
      storeId: demoStoreId,
      kpiId: 'kpi-1',
      kpiCode: 'TARGET_ACHIEVEMENT',
      kpiName: 'Target Achievement',
      periodStart: '2026-03-31',
      periodEnd: '2026-03-31',
      targetValue: '100',
      actualValue: '100',
      achievementRate: '1',
      statusBand: 'on_track',
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
};

const storeScoreBreakdownFixture = {
  snapshotRunId: 'snapshot-1',
  storeId: demoStoreId,
  scoreStatus: 'final',
  totalScore: 99,
  missingWeightPolicy: 'return_missing_weight_to_kpi',
  configuredWeights: {
    kpiPerformanceWeight: 90,
    bmChecklistWeight: 5,
    vmChecklistWeight: 5,
  },
  effectiveWeights: {
    kpiPerformanceWeight: 95,
    bmChecklistWeight: 5,
    vmChecklistWeight: 0,
  },
  components: {
    kpi: {
      included: true,
      score: 100,
      weight: 95,
      contribution: 95,
      status: 'included',
    },
    bmChecklist: {
      included: true,
      score: 80,
      weight: 5,
      contribution: 4,
      visitCount: 1,
      status: 'included',
    },
    vmChecklist: {
      included: false,
      score: null,
      weight: 0,
      contribution: null,
      visitCount: 0,
      status: 'not_included',
      missingReason: 'vm_checklist_not_completed_for_period',
    },
  },
};
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
Set-Location .\admin-web
npm.cmd run test:e2e -- e2e/kpi-benchmark-explainability.spec.ts
```

Expected: FAIL because the page still hardcodes VM as future phase and API types do not expose configured/effective weights.

- [ ] **Step 3: Extend frontend report API types**

Modify `admin-web/src/features/reports/api.ts`.

Add:

```ts
export type StoreScoreWeights = {
  kpiPerformanceWeight: number
  bmChecklistWeight: number
  vmChecklistWeight: number
}
```

Extend `StoreMonthlyScoreBreakdown`:

```ts
export type StoreMonthlyScoreBreakdown = {
  snapshotRunId: string
  storeId: string
  scoreStatus: 'preview' | 'final'
  totalScore: number | null
  missingWeightPolicy: 'return_missing_weight_to_kpi'
  configuredWeights: StoreScoreWeights
  effectiveWeights: StoreScoreWeights
  components: {
    kpi: StoreScoreBreakdownComponent
    bmChecklist: StoreScoreBreakdownComponent & {
      visitCount: number
    }
    vmChecklist: StoreScoreBreakdownComponent & {
      visitCount: number
    }
  }
}
```

- [ ] **Step 4: Add checklist display helpers**

Modify `admin-web/src/pages/StoreKpiHighlightsPage.tsx`.

Add helpers near the formatting helpers:

```ts
function formatChecklistStatus(input: {
  label: 'BM' | 'VM'
  included: boolean
  visitCount: number
}) {
  if (input.included) {
    return input.visitCount === 1
      ? `1 ${input.label} checklist yapildi`
      : `${input.visitCount} ${input.label} checklist yapildi`
  }

  return `${input.label} checklist: bu donem skora dahil edilmedi`
}

function formatChecklistContribution(input: {
  label: 'BM' | 'VM'
  contribution: number | null
  included: boolean
}) {
  if (input.contribution !== null && input.contribution !== undefined) {
    return `${input.label} checklist katkisi ${formatMetric(input.contribution)}`
  }

  return 'Katki yok'
}

function formatChecklistMissingNote(input: {
  label: 'BM' | 'VM'
  included: boolean
}) {
  return input.included ? null : `${input.label} payi KPI tarafinda kaldi`
}
```

- [ ] **Step 5: Replace hardcoded VM future copy**

Replace the current BM-only labels with BM and VM labels:

```ts
const bmChecklist = closedScoreBreakdown?.components.bmChecklist ?? null
const vmChecklist = closedScoreBreakdown?.components.vmChecklist ?? null

const bmChecklistStatusLabel = bmChecklist
  ? formatChecklistStatus({
      label: 'BM',
      included: bmChecklist.included,
      visitCount: bmChecklist.visitCount,
    })
  : 'Bu donem skora dahil edilmedi'

const vmChecklistStatusLabel = vmChecklist
  ? formatChecklistStatus({
      label: 'VM',
      included: vmChecklist.included,
      visitCount: vmChecklist.visitCount,
    })
  : 'VM checklist: bu donem skora dahil edilmedi'

const bmChecklistContributionLabel = bmChecklist
  ? formatChecklistContribution({
      label: 'BM',
      included: bmChecklist.included,
      contribution: bmChecklist.contribution,
    })
  : 'Katki yok'

const vmChecklistContributionLabel = vmChecklist
  ? formatChecklistContribution({
      label: 'VM',
      included: vmChecklist.included,
      contribution: vmChecklist.contribution,
    })
  : 'Katki yok'
```

In the checklist panel, replace the hardcoded VM row:

```tsx
<KeyValue label="BM checklist" value={bmChecklistStatusLabel} />
<KeyValue label="BM katkisi" value={bmChecklistContributionLabel} />
<KeyValue label="VM checklist" value={vmChecklistStatusLabel} />
<KeyValue label="VM katkisi" value={vmChecklistContributionLabel} />
<KeyValue
  label="Configured blend"
  value={
    closedScoreBreakdown
      ? `Configured ${closedScoreBreakdown.configuredWeights.kpiPerformanceWeight}/${closedScoreBreakdown.configuredWeights.bmChecklistWeight}/${closedScoreBreakdown.configuredWeights.vmChecklistWeight}`
      : 'Configured 90/5/5'
  }
/>
<KeyValue
  label="Effective blend"
  value={
    closedScoreBreakdown
      ? `Effective ${closedScoreBreakdown.effectiveWeights.kpiPerformanceWeight}/${closedScoreBreakdown.effectiveWeights.bmChecklistWeight}/${closedScoreBreakdown.effectiveWeights.vmChecklistWeight}`
      : 'Canli on izleme'
  }
/>
```

Replace helper paragraph:

```tsx
<p className="helper-text">
  BM ve VM checklist tamamlanan aylik ziyaret varsa kucuk agirlikla skora katilir.
  Ziyaret yoksa magaza ceza yemez; eksik checklist payi KPI tarafinda kalir.
</p>
{formatChecklistMissingNote({
  label: 'BM',
  included: bmChecklist?.included ?? false,
}) ? (
  <p className="helper-text">
    {formatChecklistMissingNote({
      label: 'BM',
      included: bmChecklist?.included ?? false,
    })}
  </p>
) : null}
{formatChecklistMissingNote({
  label: 'VM',
  included: vmChecklist?.included ?? false,
}) ? (
  <p className="helper-text">
    {formatChecklistMissingNote({
      label: 'VM',
      included: vmChecklist?.included ?? false,
    })}
  </p>
) : null}
```

- [ ] **Step 6: Verify frontend GREEN**

Run:

```powershell
Set-Location .\admin-web
npm.cmd run test:e2e -- e2e/kpi-benchmark-explainability.spec.ts
```

Expected: PASS.

## Task 4: Targeted Backend And Frontend Regression

**Files:**

- No source modifications expected in this task.

- [ ] **Step 1: Run backend targeted score tests**

Run:

```powershell
Set-Location .\backend\nestjs
npm.cmd test -- src/modules/store-ops/application/store-score-blend.service.spec.ts src/modules/store-ops/application/reporting.service.store-score-blend.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run backend build**

Run:

```powershell
Set-Location .\backend\nestjs
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 3: Run frontend targeted test**

Run:

```powershell
Set-Location .\admin-web
npm.cmd run test:e2e -- e2e/kpi-benchmark-explainability.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Run frontend build**

Run:

```powershell
Set-Location .\admin-web
npm.cmd run build
```

Expected: PASS. Existing Vite chunk-size warning may appear and does not fail the build.

- [ ] **Step 5: Run root release gate**

Run:

```powershell
Set-Location ..
npm.cmd run check:release
```

Expected: PASS.

## Task 5: Handoff And Commit

**Files:**

- Modify: `current-state.md`

- [ ] **Step 1: Update current-state**

Append this section before `## Devam Komutu`:

```markdown
## Son VM Score Contribution Activation V1 Implementation

29 Nisan 2026 itibariyla VM checklist skoru aylik store score breakdown icine aktif baglandi.

Eklenenler:

- Aylik store score configured blend KPI `%90`, BM `%5`, VM `%5` oldu.
- Eksik BM veya VM checklist sifir sayilmiyor.
- Eksik checklist agirligi KPI tarafina geri donuyor.
- BM ve VM checklist snapshotlari template type ile ayri okunuyor.
- Backend score breakdown configured/effective weights ve missing reason donuyor.
- Store KPI kapali snapshot yuzeyi BM/VM katkisini ve eksik payin KPI tarafinda kaldigini acikliyor.

Dogrulama:

- Backend store score blend targeted tests passed.
- Backend reporting store score blend targeted tests passed.
- Backend build passed.
- Frontend KPI explainability targeted test passed.
- Frontend build passed.
- Root `check:release` passed.

CODEX durust yorum:

- Bu adim checklisti cezaya cevirmeden skora anlamli sekilde bagladi.
- En kritik kazanc, magaza kullanicisinin configured ve effective agirligi ayni ekranda gorebilmesi.
- Bundan sonra asil risk matematik degil, UI dilinin kullanicida yanlis ceza algisi yaratmasidir; bu yuzden copy sade tutuldu.

Siradaki mantikli adim: pilot veride BM/VM checklist olan ve olmayan magazalarla tarayici smoke yapmak; skor kiriliminin kullanici tarafinda anlasilir olup olmadigini gozle kontrol etmek.
```

- [ ] **Step 2: Commit implementation**

Run from repo root:

```powershell
git status --short
git add -- backend/nestjs/src/modules/store-ops/application/store-score-blend.contract.ts backend/nestjs/src/modules/store-ops/application/store-score-blend.service.ts backend/nestjs/src/modules/store-ops/application/store-score-blend.service.spec.ts backend/nestjs/src/modules/store-ops/application/reporting.service.ts backend/nestjs/src/modules/store-ops/application/reporting.service.store-score-blend.spec.ts admin-web/src/features/reports/api.ts admin-web/src/pages/StoreKpiHighlightsPage.tsx admin-web/e2e/kpi-benchmark-explainability.spec.ts current-state.md
git diff --cached --check
git commit -m "feat: activate vm score contribution"
```

Expected: commit succeeds and `outputs/` remains untracked.

## Self-Review Checklist

- Design AC-1 maps to Task 1 BM and VM included test.
- Design AC-2 maps to Task 1 missing VM test and Task 2 reporting missing VM test.
- Design AC-3 maps to Task 1 missing BM test.
- Design AC-4 maps to Task 1 both missing test.
- Design AC-5 stays covered by reporting snapshot behavior because only completed checklist snapshots are read.
- Design AC-6 stays covered because score inclusion reads completed snapshot, not acknowledgement status.
- Design AC-7 maps to Task 1 KPI missing test.
- Frontend does not calculate score independently; it renders backend `components`, `configuredWeights`, and `effectiveWeights`.
- No migration, auth, checklist permission, or daily score surface is changed in this plan.
