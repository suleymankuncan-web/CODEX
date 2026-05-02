# Daily Closure Ranking V2 Explainability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit ranking explainability to the existing closed ranking read model and Turkish-first `/store/rankings` copy without changing score math or opening a second ranking engine.

**Architecture:** Existing `GET /api/reports/leaderboards/closed` remains the source of truth. Backend derives display-safe `rankingStatus`, `eligibilityReason`, and `neededPerformanceDays` from existing period coverage; frontend renders Turkish-first trust copy from those fields. No new database schema is introduced.

**Tech Stack:** NestJS, PostgreSQL `rpt` read models, React, TypeScript, TanStack Query, Playwright, Jest.

---

## Implementation Result

Status: completed on 26 April 2026.

Implemented without changing score math, DB schema, endpoint ownership, or creating a second ranking engine.

Verification evidence:

- Backend RED observed: `closed-ranking.service.spec.ts` failed because explainability fields were missing.
- Frontend RED observed: monthly preview-only Playwright test failed because `On izleme` was not rendered.
- Backend GREEN: `npm.cmd test -- src/modules/store-ops/application/closed-ranking.service.spec.ts --runInBand` -> 4 tests passed.
- Frontend GREEN: `npm.cmd run build`; `npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "store rankings"` -> 2 tests passed.
- Official root release gate: `npm.cmd run check:release` -> root script tests, backend release check, frontend release check, 32 backend suites / 248 tests, 22 Playwright smoke tests, and production audits passed.

## File Structure

- Modify: `backend/nestjs/src/modules/store-ops/application/closed-ranking.contract.ts`
  - Owns the backend closed-ranking response contract.
- Modify: `backend/nestjs/src/modules/store-ops/application/closed-ranking.service.ts`
  - Derives ranking explainability fields from existing coverage and eligibility logic.
- Modify: `backend/nestjs/src/modules/store-ops/application/closed-ranking.service.spec.ts`
  - Guards official daily/monthly and preview-only monthly behavior.
- Modify: `admin-web/src/features/reports/api.ts`
  - Mirrors the backend response contract for the frontend.
- Modify: `admin-web/src/pages/StoreRankingsPage.tsx`
  - Renders Turkish-first labels and ranking explanations.
- Modify: `admin-web/e2e/store-surfaces.spec.ts`
  - Guards visible store-ranking trust copy.
- Modify: `docs/plans/active-next-actions.md`
  - Records completion and next logical step.
- Modify: `current-state.md`
  - Keeps the canonical handoff current.

## Scope Rules

- Do not change score math.
- Do not create a new ranking engine.
- Do not create a new DB table or migration.
- Do not add region leagues, challenge rankings, rewards, or attendance/worked-day truth.
- Keep metric mini-ranks as read-only supporting detail.

## Ranking Status Rules

Backend derives employee-level fields:

```ts
export type ClosedRankingStatus = "official" | "preview_only";
export type ClosedRankingEligibilityReason = "eligible" | "needs_more_closed_days";

export type ClosedRankingEmployee = {
  rankingStatus: ClosedRankingStatus;
  eligibilityReason: ClosedRankingEligibilityReason;
  neededPerformanceDays: number;
};
```

Derivation:

- daily rows have `minimumRequiredDays = 1`, so an existing daily row is `official` / `eligible`
- monthly rows with `daysWithPerformance >= 3` are `official` / `eligible`
- monthly rows with `daysWithPerformance < 3` are `preview_only` / `needs_more_closed_days`
- `neededPerformanceDays = max(minimumRequiredDays - daysWithPerformance, 0)`
- empty states remain source-level states: `not_closed` and `no_data`

## Task 1: Backend Contract And RED Tests

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/application/closed-ranking.service.spec.ts`
- Modify after RED: `backend/nestjs/src/modules/store-ops/application/closed-ranking.contract.ts`

- [ ] **Step 1: Extend the daily ranking test expectation before implementation**

Add this assertion inside `maps daily current employee metric mini ranks` after the existing `coverage` assertion:

```ts
expect(result.currentEmployee).toEqual(
  expect.objectContaining({
    rankingStatus: "official",
    eligibilityReason: "eligible",
    neededPerformanceDays: 0,
  }),
);
```

- [ ] **Step 2: Extend the monthly preview-only test expectation before implementation**

Add this assertion inside `marks 1-2 day monthly rows as preview-only` after the existing `rankings` assertion:

```ts
expect(result.currentEmployee).toEqual(
  expect.objectContaining({
    rankingStatus: "preview_only",
    eligibilityReason: "needs_more_closed_days",
    neededPerformanceDays: 1,
  }),
);
```

- [ ] **Step 3: Run backend RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/closed-ranking.service.spec.ts --runInBand
```

Expected: FAIL because `rankingStatus`, `eligibilityReason`, and `neededPerformanceDays` are missing.

- [ ] **Step 4: Add backend contract fields**

Add these types to `closed-ranking.contract.ts`:

```ts
export type ClosedRankingStatus = "official" | "preview_only";
export type ClosedRankingEligibilityReason = "eligible" | "needs_more_closed_days";
```

Add these fields to `ClosedRankingEmployee`:

```ts
rankingStatus: ClosedRankingStatus;
eligibilityReason: ClosedRankingEligibilityReason;
neededPerformanceDays: number;
```

## Task 2: Backend Implementation

**Files:**

- Modify: `backend/nestjs/src/modules/store-ops/application/closed-ranking.service.ts`

- [ ] **Step 1: Derive explainability inside `mapEmployeeRow`**

Add this after `isEligibleForRanking`:

```ts
const neededPerformanceDays = Math.max(
  input.minimumRequiredDays - daysWithPerformance,
  0,
);
const rankingStatus = isEligibleForRanking ? "official" : "preview_only";
const eligibilityReason = isEligibleForRanking
  ? "eligible"
  : "needs_more_closed_days";
```

Return these fields in the employee object:

```ts
rankingStatus,
eligibilityReason,
neededPerformanceDays,
```

- [ ] **Step 2: Run backend GREEN**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/closed-ranking.service.spec.ts --runInBand
```

Expected: PASS.

## Task 3: Frontend Types And RED E2E

**Files:**

- Modify: `admin-web/src/features/reports/api.ts`
- Modify: `admin-web/e2e/store-surfaces.spec.ts`

- [ ] **Step 1: Add frontend type fields**

Add these types near the existing closed ranking types:

```ts
export type ClosedRankingStatus = 'official' | 'preview_only'
export type ClosedRankingEligibilityReason = 'eligible' | 'needs_more_closed_days'
```

Add these fields to `ClosedRankingEmployee`:

```ts
rankingStatus: ClosedRankingStatus
eligibilityReason: ClosedRankingEligibilityReason
neededPerformanceDays: number
```

- [ ] **Step 2: Add monthly preview fixture in Playwright**

Add a `closedLeaderboardMonthlyPreviewFixture` by copying `closedLeaderboardFixture` and changing:

```ts
source: {
  mode: 'closed',
  periodType: 'monthly',
  state: 'closed',
  snapshotRunId: null,
  snapshotDate: '2026-04-02',
  periodStart: '2026-04-01',
  periodEnd: '2026-04-30',
},
currentEmployee: {
  ...closedLeaderboardFixture.currentEmployee,
  rankings: {
    turkeyRank: null,
    turkeyPopulation: 4,
    storeRank: null,
    storePopulation: 3,
  },
  coverage: {
    closedDaysInPeriod: 2,
    daysWithPerformance: 2,
    minimumRequiredDays: 3,
    isEligibleForRanking: false,
  },
  rankingStatus: 'preview_only',
  eligibilityReason: 'needs_more_closed_days',
  neededPerformanceDays: 1,
}
```

- [ ] **Step 3: Route monthly leaderboard requests to the preview fixture**

Change the leaderboard route handler:

```ts
await page.route('**/api/reports/leaderboards/closed**', async (route) => {
  const requestUrl = new URL(route.request().url())
  await route.fulfill({
    json:
      requestUrl.searchParams.get('periodType') === 'monthly'
        ? closedLeaderboardMonthlyPreviewFixture
        : closedLeaderboardFixture,
  })
})
```

- [ ] **Step 4: Add Playwright RED test**

Add:

```ts
test('store rankings page explains monthly preview-only ranking', async ({ page }) => {
  await page.goto('/store/rankings')
  await page.getByRole('button', { name: 'Aylık' }).click()

  await expect(page.getByText('Ön izleme')).toBeVisible()
  await expect(page.getByText('1 kapalı performans günü daha gerekiyor')).toBeVisible()
  await expect(page.getByText('Sıralama yok')).toBeVisible()
  await expect(page.getByText('2/2 kapalı gün')).toBeVisible()
})
```

- [ ] **Step 5: Run frontend RED**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run build
npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "monthly preview-only"
```

Expected: FAIL because the UI does not render `Ön izleme` and the new explanation yet.

## Task 4: Frontend Implementation

**Files:**

- Modify: `admin-web/src/pages/StoreRankingsPage.tsx`

- [ ] **Step 1: Replace ranking copy helpers**

Use helpers shaped like this:

```ts
function formatRank(rank: number | null, population: number) {
  return rank !== null ? `${rank}/${population}` : 'Sıralama yok'
}

function formatCoverage(input?: {
  daysWithPerformance: number
  closedDaysInPeriod: number
}) {
  if (!input || input.closedDaysInPeriod === 0) {
    return 'Veri yok'
  }

  return `${input.daysWithPerformance}/${input.closedDaysInPeriod} kapalı gün`
}
```

- [ ] **Step 2: Add ranking explanation helper**

Use a helper shaped like this:

```ts
function resolveRankingExplanation(employee?: ClosedRankingEmployee | null) {
  if (!employee) {
    return null
  }

  if (employee.rankingStatus === 'preview_only') {
    return {
      label: 'Ön izleme',
      copy: `${employee.neededPerformanceDays} kapalı performans günü daha gerekiyor`,
      tone: 'warning' as const,
    }
  }

  return {
    label: 'Resmi sıralama',
    copy: 'Bu sonuç kapanmış performans verisiyle resmi sıralamaya dahildir.',
    tone: 'calm' as const,
  }
}
```

- [ ] **Step 3: Render explanation in current position**

Render the status pill and explanation copy inside the current-position panel when `currentEmployee` exists:

```tsx
{rankingExplanation ? (
  <div className="surface-note">
    <StatusPill tone={rankingExplanation.tone}>{rankingExplanation.label}</StatusPill>
    <span>{rankingExplanation.copy}</span>
  </div>
) : null}
```

- [ ] **Step 4: Replace obvious English labels on `/store/rankings`**

Use Turkish-first labels for:

- `Current rank` -> `Mevcut sıralama`
- `Personnel top` -> `Personel ilk 10`
- `Coverage` -> `Kapsam`
- `Snapshot context` -> `Kapanış bağlamı`
- `Current position` -> `Mevcut konum`
- `Turkey rank` -> `Türkiye sırası`
- `Store rank` -> `Mağaza sırası`
- `No rank` -> `Sıralama yok`
- `Official monthly ranking starts after 3 closed performance days.` -> derived preview explanation

- [ ] **Step 5: Run frontend GREEN**

Run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run build
npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "store rankings"
```

Expected: PASS.

## Task 5: Docs And Release Verification

**Files:**

- Modify: `docs/plans/active-next-actions.md`
- Modify: `current-state.md`

- [ ] **Step 1: Update docs**

Record:

- Daily Closure Ranking V2 Explainability completed
- backend contract fields added
- frontend trust copy added
- no score math/schema/new ranking engine change
- next logical step is score meaning / grade interpretation

- [ ] **Step 2: Run backend targeted test**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/closed-ranking.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run frontend targeted verification**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run build
npm.cmd run test:e2e -- e2e/store-surfaces.spec.ts -g "store rankings"
```

Expected: PASS.

- [ ] **Step 4: Run official release gate**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run check:release
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git add backend/nestjs/src/modules/store-ops/application/closed-ranking.contract.ts `
  backend/nestjs/src/modules/store-ops/application/closed-ranking.service.ts `
  backend/nestjs/src/modules/store-ops/application/closed-ranking.service.spec.ts `
  admin-web/src/features/reports/api.ts `
  admin-web/src/pages/StoreRankingsPage.tsx `
  admin-web/e2e/store-surfaces.spec.ts `
  docs/plans/active-next-actions.md `
  docs/plans/project-forward-preview-2026-04-26.md `
  docs/superpowers/plans/2026-04-26-daily-closure-ranking-v2-explainability.md `
  current-state.md
git commit -m "feat: explain closed ranking eligibility"
```

## Self Review

- Spec coverage: covered official daily, official monthly, monthly preview-only, and empty source states.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation tasks remain.
- Type consistency: backend and frontend use the same `rankingStatus`, `eligibilityReason`, and `neededPerformanceDays` field names.
- Boundary check: no DB schema, score math, region league, challenge ranking, or new ranking engine is introduced.
