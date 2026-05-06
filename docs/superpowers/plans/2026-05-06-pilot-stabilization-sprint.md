# Pilot Stabilization Sprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current HR Axis pilot into a maintainable, smoke-tested baseline without a rewrite or UI redesign.

**Architecture:** Keep the existing Vercel frontend, Render backend, Clerk auth, and current database model. Add documentation contracts and small targeted tests first, then make only scoped hardening changes backed by failing tests.

**Tech Stack:** React, Vite, Playwright, NestJS, Jest, Node test runner, PowerShell-friendly `npm.cmd` commands.

---

## File Structure

- Create `docs/architecture/pilot-route-role-matrix.md`: single source of truth for admin/store routes, roles, landing behavior, refresh expectation, and screen classification.
- Create `docs/plans/pilot-release-smoke-checklist.md`: deploy, promote, cache, Vercel, Render, and smoke order checklist.
- Create `scripts/pilot-route-role-matrix-contract.test.mjs`: Node contract that keeps the route matrix aligned with `admin-web/src/App.tsx`.
- Create `scripts/pilot-release-smoke-checklist-contract.test.mjs`: Node contract that keeps the release checklist complete.
- Create `admin-web/e2e/pilot-smoke.spec.ts`: Playwright smoke coverage for core admin/store routes with mocked API responses.
- Create `admin-web/e2e/pilot-api-contracts.spec.ts`: Playwright contract coverage for missing/null API response fields that previously crashed pages.
- Modify `admin-web/src/App.tsx` only after the matrix is reviewed and a test proves a specific navigation/classification gap.
- Modify `admin-web/src/features/reports/api.ts`, `admin-web/src/features/targets/api.ts`, or page formatters only when a contract test proves a missing/null field can crash or mislead the UI.
- Modify `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts` only if the demo/live source-filter contract proves a ranking query lost `source_type <> demo_seed`.

---

### Task 1: Route And Role Matrix Contract

**Files:**
- Create: `docs/architecture/pilot-route-role-matrix.md`
- Create: `scripts/pilot-route-role-matrix-contract.test.mjs`
- Reference: `admin-web/src/App.tsx`

- [ ] **Step 1: Write the failing contract test**

Create `scripts/pilot-route-role-matrix-contract.test.mjs` with:

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, expected, context) {
  assert.ok(
    text.includes(expected),
    `${context} must include ${expected}`,
  )
}

const matrix = readText('docs/architecture/pilot-route-role-matrix.md')
const app = readText('admin-web/src/App.tsx')

const requiredRoutes = [
  '/admin/integrations',
  '/admin/master-data',
  '/admin/snapshots',
  '/admin/inbox',
  '/admin/feed',
  '/admin/checklists',
  '/admin/competitions',
  '/admin/reports',
  '/admin/targets',
  '/admin/kpi-config',
  '/admin/auth',
  '/admin/audit',
  '/admin/session',
  '/store',
  '/store/me',
  '/store/rankings',
  '/store/approvals',
  '/store/checklists',
  '/store/tasks',
  '/store/kpis',
  '/store/feed',
  '/store/competitions',
  '/store/incentives',
]

test('pilot route matrix documents every active admin and store route', () => {
  for (const route of requiredRoutes) {
    requireText(matrix, `| \`${route}\` |`, 'route matrix')
    requireText(app, route, 'admin-web/src/App.tsx')
  }
})

test('pilot route matrix keeps required governance columns', () => {
  for (const heading of [
    '| Route | Shell | Classification | Roles | Landing Behavior | Refresh/Return Expectation | Data Boundary | Primary Nav |',
    '## Classification Rules',
    '## Landing Order',
    '## Review Notes',
  ]) {
    requireText(matrix, heading, 'route matrix')
  }
})

test('pilot route matrix locks the first stabilization classifications', () => {
  for (const row of [
    '| `/admin/integrations` | admin | core | `SUPER_ADMIN`, `INTEGRATION_ADMIN` | first landing for super admin and integration admin | must return to same route after auth verification | company-scoped import state | yes |',
    '| `/admin/master-data` | admin | core | `SUPER_ADMIN`, `HR_ADMIN`, `INTEGRATION_ADMIN` | direct navigation only | must return to same route after auth verification | company-scoped bootstrap batches | yes |',
    '| `/admin/session` | admin | ops | any authenticated admin shell session | direct navigation only | must stay on `/admin/session` | local/session diagnostics only | yes |',
    '| `/store/me` | store | core | `STORE_MANAGER`, `STORE_PERSONNEL` | direct navigation or store landing link | must return to same route after auth verification | current employee performance only | yes |',
    '| `/store/rankings` | store | core | `STORE_MANAGER`, `STORE_PERSONNEL`, `REGION_MANAGER`, `SUPER_ADMIN` | direct navigation or store landing link | must return to same route after auth verification | top 100 for store roles, full list for privileged roles | yes |',
  ]) {
    requireText(matrix, row, 'route matrix')
  }
})
```

- [ ] **Step 2: Run the contract and verify it fails**

Run:

```powershell
node --test scripts/pilot-route-role-matrix-contract.test.mjs
```

Expected: `FAIL` because `docs/architecture/pilot-route-role-matrix.md` does not exist.

- [ ] **Step 3: Add the route matrix document**

Create `docs/architecture/pilot-route-role-matrix.md` with this exact structure and rows:

```md
# Pilot Route Role Matrix

## Classification Rules

- `core`: needed for the pilot user journey or first production product.
- `ops`: useful for operations, support, diagnostics, or admin maintenance.
- `secondary`: store-facing feature surface that is not part of the current pilot-critical path.
- `legacy/pilot`: temporary, debug, demo, or transitional surface.

## Route Matrix

| Route | Shell | Classification | Roles | Landing Behavior | Refresh/Return Expectation | Data Boundary | Primary Nav |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/admin/integrations` | admin | core | `SUPER_ADMIN`, `INTEGRATION_ADMIN` | first landing for super admin and integration admin | must return to same route after auth verification | company-scoped import state | yes |
| `/admin/master-data` | admin | core | `SUPER_ADMIN`, `HR_ADMIN`, `INTEGRATION_ADMIN` | direct navigation only | must return to same route after auth verification | company-scoped bootstrap batches | yes |
| `/admin/snapshots` | admin | ops | `SUPER_ADMIN`, `SNAPSHOT_OPERATOR` | first landing for snapshot operator | must return to same route after auth verification | company-scoped snapshot state | yes |
| `/admin/inbox` | admin | needs decision | `SUPER_ADMIN`, `REPORT_VIEWER`, `HR_ADMIN` | direct navigation only | must return to same route after auth verification | current admin queue scope | yes |
| `/admin/feed` | admin | needs decision | `SUPER_ADMIN`, `HR_ADMIN`, `REGION_MANAGER` | direct navigation only | must return to same route after auth verification | announcement management scope | yes |
| `/admin/checklists` | admin | needs decision | `SUPER_ADMIN`, `HR_ADMIN` | direct navigation only | must return to same route after auth verification | checklist template governance | yes |
| `/admin/competitions` | admin | needs decision | `SUPER_ADMIN`, `HR_ADMIN`, `REPORT_VIEWER`, `REGION_MANAGER` | first landing for HR admin | must return to same route after auth verification | competition setup and read scope | yes |
| `/admin/reports` | admin | ops | `SUPER_ADMIN`, `REPORT_VIEWER` | first landing for report viewer | must return to same route after auth verification | reporting read models | yes |
| `/admin/targets` | admin | core | `SUPER_ADMIN`, `REPORT_VIEWER`, `REGION_MANAGER` | first landing for region manager | must return to same route after auth verification | target approval queue by scope | yes |
| `/admin/kpi-config` | admin | ops | `SUPER_ADMIN` | direct navigation only | must return to same route after auth verification | global KPI governance | yes |
| `/admin/auth` | admin | core | `SUPER_ADMIN` | direct navigation only | must return to same route after auth verification | auth admin catalog and assignment scope | yes |
| `/admin/audit` | admin | core | `SUPER_ADMIN`, `AUDITOR` | first landing for auditor | must return to same route after auth verification | audit event read scope | yes |
| `/admin/session` | admin | ops | any authenticated admin shell session | direct navigation only | must stay on `/admin/session` | local/session diagnostics only | yes |
| `/store` | store | core | authenticated store shell session | first landing for store roles | must return to same route after auth verification | current store shell overview | yes |
| `/store/me` | store | core | `STORE_MANAGER`, `STORE_PERSONNEL` | direct navigation or store landing link | must return to same route after auth verification | current employee performance only | yes |
| `/store/rankings` | store | core | `STORE_MANAGER`, `STORE_PERSONNEL`, `REGION_MANAGER`, `SUPER_ADMIN` | direct navigation or store landing link | must return to same route after auth verification | top 100 for store roles, full list for privileged roles | yes |
| `/store/approvals` | store | core | `STORE_MANAGER`, `SUPER_ADMIN` with assigned action store | direct navigation or store landing link | must return to same route after auth verification | assigned action store requests | yes |
| `/store/checklists` | store | secondary | `STORE_MANAGER`, `STORE_PERSONNEL`, `VISUAL_MERCHANDISER` | first landing for visual merchandiser-only sessions | must return to same route after auth verification | checklist tasks by store scope | yes |
| `/store/tasks` | store | secondary | authenticated store shell session except visual merchandiser-only | direct navigation only | must return to same route after auth verification | current store tasks | no |
| `/store/kpis` | store | secondary | authenticated store shell session except visual merchandiser-only | direct navigation only | must return to same route after auth verification | current store KPI highlights | no |
| `/store/feed` | store | secondary | authenticated store shell session except visual merchandiser-only | direct navigation only | must return to same route after auth verification | store announcements | yes |
| `/store/competitions` | store | secondary | authenticated store shell session except visual merchandiser-only | direct navigation only | must return to same route after auth verification | store-visible competitions | yes |
| `/store/incentives` | store | secondary | authenticated store shell session except visual merchandiser-only | direct navigation only | must return to same route after auth verification | store incentives preview | no |

## Landing Order

Current landing resolution in `admin-web/src/App.tsx`:

1. unauthenticated or unconfigured session: `/auth/login`
2. `SUPER_ADMIN` or `INTEGRATION_ADMIN`: `/admin/integrations`
3. `SNAPSHOT_OPERATOR`: `/admin/snapshots`
4. `HR_ADMIN`: `/admin/competitions`
5. `REGION_MANAGER`: `/admin/targets`
6. `REPORT_VIEWER`: `/admin/reports`
7. `AUDITOR`: `/admin/audit`
8. `VISUAL_MERCHANDISER`: `/store/checklists`
9. remaining authenticated store sessions: `/store`

## Review Notes

- No route should be removed from navigation until this matrix is reviewed.
- `needs decision` screens stay visible until a product decision moves them to `core`, `ops`, `secondary`, or `legacy/pilot`.
- Store role detail visibility is enforced by page/API access rules, not by hiding the route alone.
```

- [ ] **Step 4: Run the contract and verify it passes**

Run:

```powershell
node --test scripts/pilot-route-role-matrix-contract.test.mjs
```

Expected: `PASS`.

- [ ] **Step 5: Commit**

```powershell
git add docs/architecture/pilot-route-role-matrix.md scripts/pilot-route-role-matrix-contract.test.mjs
git commit -m "Document pilot route role matrix"
```

---

### Task 2: Release Smoke Checklist Contract

**Files:**
- Create: `docs/plans/pilot-release-smoke-checklist.md`
- Create: `scripts/pilot-release-smoke-checklist-contract.test.mjs`

- [ ] **Step 1: Write the failing checklist contract**

Create `scripts/pilot-release-smoke-checklist-contract.test.mjs` with:

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')
const checklist = readFileSync(
  join(workspaceRoot, 'docs/plans/pilot-release-smoke-checklist.md'),
  'utf8',
)

function requireText(expected) {
  assert.ok(checklist.includes(expected), `checklist must include ${expected}`)
}

test('pilot release checklist documents deploy decision rules', () => {
  for (const phrase of [
    '# Pilot Release Smoke Checklist',
    '## Decision Rule',
    'Frontend-only change',
    'Backend/API change',
    'Database migration change',
    'Vercel deployment id',
    'Git commit hash',
    'Render deploy',
  ]) {
    requireText(phrase)
  }
})

test('pilot release checklist covers required smoke URLs', () => {
  for (const route of [
    '/admin/integrations',
    '/admin/master-data',
    '/admin/targets',
    '/store',
    '/store/me',
    '/store/rankings',
    '/store/approvals',
  ]) {
    requireText(route)
  }
})

test('pilot release checklist covers cache and old chunk recovery', () => {
  for (const phrase of [
    'Old chunk symptoms',
    'Close all browser windows',
    'Hard refresh',
    'Verify the Vercel deployment id maps to the expected Git commit hash',
  ]) {
    requireText(phrase)
  }
})
```

- [ ] **Step 2: Run the contract and verify it fails**

Run:

```powershell
node --test scripts/pilot-release-smoke-checklist-contract.test.mjs
```

Expected: `FAIL` because `docs/plans/pilot-release-smoke-checklist.md` does not exist.

- [ ] **Step 3: Add the checklist document**

Create `docs/plans/pilot-release-smoke-checklist.md` with:

```md
# Pilot Release Smoke Checklist

## Decision Rule

- Frontend-only change: run local frontend verification, deploy Vercel preview, verify the Vercel deployment id maps to the expected Git commit hash, promote, run production smoke.
- Backend/API change: run backend targeted tests, deploy Render, verify `/api/auth/session` and `/api/admin/migrations/status`, then run affected frontend smoke.
- Database migration change: run migration tests, deploy Render with predeploy migration, verify migration status has no failed or pending migration, then run admin and store smoke.

## Local Verification Commands

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- pilot-smoke.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand
node --test scripts/pilot-route-role-matrix-contract.test.mjs
node --test scripts/pilot-release-smoke-checklist-contract.test.mjs
git diff --check
```

## Vercel Promote Check

- Record the Git commit hash.
- Record the Vercel deployment id.
- Confirm the Vercel deployment id row shows the expected Git commit hash.
- Promote only that deployment.
- After promote, open production in a fresh browser context.

## Render Deploy Check

- Deploy Render when backend, API contract, environment, migration, or `render.yaml` changes.
- Verify Render build completed.
- Verify migrations ran through `preDeployCommand`.
- Verify `/api/admin/migrations/status` returns zero failed and zero pending migrations.

## Production Smoke Order

1. `/admin/integrations`
2. `/admin/master-data`
3. `/admin/targets`
4. `/store`
5. `/store/me`
6. `/store/rankings`
7. `/store/approvals`
8. Refresh the active page and verify it returns to the same route after auth verification.

## Old Chunk Symptoms

- A page still throws an error fixed by the promoted commit.
- The Vercel deployment id is promoted but the browser renders old JavaScript chunks.
- The app works after closing all browser windows and reopening the site.

## Cache Recovery

1. Hard refresh the route.
2. Close all browser windows for the affected browser.
3. Reopen the browser and navigate directly to the affected route.
4. Verify the Vercel deployment id maps to the expected Git commit hash.
5. Re-run the production smoke order.
```

- [ ] **Step 4: Run the contract and verify it passes**

Run:

```powershell
node --test scripts/pilot-release-smoke-checklist-contract.test.mjs
```

Expected: `PASS`.

- [ ] **Step 5: Commit**

```powershell
git add docs/plans/pilot-release-smoke-checklist.md scripts/pilot-release-smoke-checklist-contract.test.mjs
git commit -m "Document pilot release smoke checklist"
```

---

### Task 3: Core Pilot Smoke E2E

**Files:**
- Create: `admin-web/e2e/pilot-smoke.spec.ts`
- Reference: `admin-web/e2e/admin-routing.spec.ts`
- Reference: `admin-web/e2e/store-return-to.spec.ts`

- [ ] **Step 1: Write the failing Playwright smoke spec**

Create `admin-web/e2e/pilot-smoke.spec.ts` with:

```ts
import { expect, test, type Page } from '@playwright/test'

const storeId = '00000000-0000-0000-0000-000000000100'
const employeeId = '00000000-0000-0000-0000-000000000200'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'pilot-smoke-user',
        mockRoleCodes: 'SUPER_ADMIN,INTEGRATION_ADMIN,REPORT_VIEWER,REGION_MANAGER,STORE_MANAGER',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })

  await routePilotSmokeApi(page)
})

test('core admin routes open without unavailable states', async ({ page }) => {
  for (const route of ['/admin/integrations', '/admin/master-data', '/admin/targets']) {
    await page.goto(route)
    await expect(page).toHaveURL(new RegExp(`${route.replaceAll('/', '\\/')}$`))
    await expect(page.getByText(/unavailable|acilamadi|açılmadı/i)).toHaveCount(0)
  }
})

test('core store routes open without unavailable states', async ({ page }) => {
  for (const route of ['/store', '/store/me', '/store/rankings', '/store/approvals']) {
    await page.goto(route)
    await expect(page).toHaveURL(new RegExp(`${route.replaceAll('/', '\\/')}$`))
    await expect(page.getByText(/unavailable|acilamadi|açılmadı/i)).toHaveCount(0)
  }
})

test('protected route refresh returns to the same route', async ({ page }) => {
  await page.goto('/store/rankings')
  await page.reload()
  await expect(page).toHaveURL(/\/store\/rankings$/)
  await expect(page.getByRole('heading', { name: /Magaza ve personel rankingleri/i })).toBeVisible()
})

async function routePilotSmokeApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSessionFixture })
  })

  await page.route('**/api/integrations/import-batches/needs-action?**', async (route) => {
    await route.fulfill({ json: emptyListFixture })
  })
  await page.route('**/api/integrations/master-data-bootstrap/batches?**', async (route) => {
    await route.fulfill({ json: masterDataFixture })
  })
  await page.route('**/api/target-distributions/requests**', async (route) => {
    await route.fulfill({ json: targetRequestsFixture })
  })
  await page.route('**/api/target-distributions/store-personnel?**', async (route) => {
    await route.fulfill({ json: storePersonnelFixture })
  })
  await page.route('**/api/workforce/position-options?**', async (route) => {
    await route.fulfill({ json: emptyListFixture })
  })
  await page.route('**/api/workforce/store-employees?**', async (route) => {
    await route.fulfill({ json: emptyListFixture })
  })
  await page.route('**/api/workforce/seller-code-requests?**', async (route) => {
    await route.fulfill({ json: emptyListFixture })
  })
  await page.route('**/api/workforce/offboarding-requests?**', async (route) => {
    await route.fulfill({ json: emptyListFixture })
  })
  await page.route('**/api/reports/kpi-config', async (route) => {
    await route.fulfill({ json: kpiConfigFixture })
  })
  await page.route('**/api/reports/my-performance**', async (route) => {
    await route.fulfill({ json: myPerformanceFixture })
  })
  await page.route('**/api/reports/rankings?**', async (route) => {
    await route.fulfill({ json: rankingsFixture })
  })
}

const authSessionFixture = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'pilot-smoke-user',
    employeeId,
    roleCodes: ['SUPER_ADMIN', 'INTEGRATION_ADMIN', 'REPORT_VIEWER', 'REGION_MANAGER', 'STORE_MANAGER'],
    scope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: ['00000000-0000-0000-0000-000000000010'],
      storeIds: [storeId],
    },
    readScope: {
      companyIds: ['00000000-0000-0000-0000-000000000001'],
      regionIds: ['00000000-0000-0000-0000-000000000010'],
      storeIds: [storeId],
    },
    actionScope: {
      assignedStoreIds: [storeId],
    },
    assignedStoreIds: [storeId],
  },
  scopeSummary: {
    companyCount: 1,
    regionCount: 1,
    storeCount: 1,
    assignedStoreCount: 1,
  },
}

const emptyListFixture = {
  items: [],
  meta: { count: 0, total: 0, limit: 50, offset: 0 },
}

const masterDataFixture = {
  items: [
    {
      batchId: '8a1506af-b043-4968-9d75-d10c8d4432d5',
      companyId: '00000000-0000-0000-0000-000000000001',
      bootstrapEntity: 'personnel',
      sourceLabel: 'Accepted personnel baseline',
      fileReference: 'personnel-master-mapping-prep.xlsx#chunk-9',
      uploadedByUserId: 'pilot-smoke-user',
      batchStatus: 'promoted',
      rowCount: 5,
      pendingCount: 0,
      validCount: 0,
      needsReviewCount: 0,
      invalidCount: 0,
      promotedCount: 5,
      createdAt: '2026-05-04T11:51:26.982Z',
      validatedAt: '2026-05-04T11:51:27.289Z',
      promotedAt: '2026-05-04T11:52:42.761Z',
      readiness: 'closed',
      nextAction: 'closed',
    },
  ],
  meta: { count: 1, total: 1, limit: 20, offset: 0 },
}

const targetRequestsFixture = {
  items: [],
  meta: { count: 0, total: 0, limit: 50, offset: 0 },
}

const storePersonnelFixture = {
  items: [
    {
      employeeId,
      displayName: 'Pilot Store Manager',
      externalEmployeeRef: 'SM-1',
      periodStart: '2026-05-01',
      periodEnd: '2026-05-31',
      netSalesValue: 1000,
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}

const kpiConfigFixture = {
  metadata: {
    kpiConfigVersionId: null,
    versionNo: null,
    effectiveFrom: null,
    effectiveTo: null,
    publishedAt: null,
    publishedBy: null,
  },
  storeProfile: { profileCode: 'store', title: 'Store', summary: 'Store score', futureMetricRule: 'No new metrics in pilot smoke.', metrics: [] },
  personnelProfile: { profileCode: 'personnel', title: 'Personnel', summary: 'Personnel score', futureMetricRule: 'No new metrics in pilot smoke.', metrics: [] },
  ownershipMatrix: [],
  gradingBands: [
    { code: 'A', label: 'Strong', emoji: 'A', tone: 'calm', minScore: 80 },
    { code: 'B', label: 'Good', emoji: 'B', tone: 'accent', minScore: 60 },
    { code: 'C', label: 'Focus', emoji: 'C', tone: 'warning', minScore: 0 },
  ],
}

const myPerformanceFixture = {
  source: { mode: 'live', snapshotRunId: null, snapshotDate: null },
  employee: { employeeId, displayName: 'Pilot Store Manager', storeId, storeName: 'Pilot Store' },
  period: { periodStart: '2026-05-01', periodEnd: '2026-05-31' },
  score: { value: 87, matchedMetrics: 1, totalMetrics: 1 },
  rankings: { turkeyRank: 12, turkeyPopulation: 100, storeRank: 1, storePopulation: 4 },
  availablePeriods: [{ periodType: 'monthly', periodStart: '2026-05-01', periodEnd: '2026-05-31' }],
  partial: {
    isPartial: false,
    missingMetricCodes: [],
    missingMetricLabels: [],
    pendingNormalizationCodes: [],
    pendingNormalizationLabels: [],
  },
  supporting: {
    netSalesValue: 1000,
    targetEntryMode: 'manager_assignment',
    targetEditableByCurrentUser: false,
  },
  metrics: [
    {
      code: 'TARGET_ACHIEVEMENT',
      label: 'Target achievement',
      weightPercent: 100,
      actualValue: 0.87,
      targetValue: 1,
      achievementRate: 0.87,
      benchmarkValue: null,
      benchmarkSource: 'TARGET',
      contributionValue: 87,
      dataStatus: 'reported',
      scoreStatus: 'scored',
      status: 'reported',
    },
  ],
}

const rankingStoreRow = {
  subject: 'store',
  storeId,
  storeName: 'Pilot Store',
  regionId: '00000000-0000-0000-0000-000000000010',
  regionName: 'Pilot Region',
  regionManagerUserId: 'region-manager-user',
  regionManagerName: 'Pilot Region Manager',
  rank: 1,
  population: 100,
  scoreValue: 90,
  visibility: 'detail',
  metrics: [{ code: 'TARGET_ACHIEVEMENT', label: 'Target achievement', actualValue: 0.9, targetValue: 1, benchmarkValue: null, contributionValue: 90 }],
}

const rankingPersonnelRow = {
  subject: 'personnel',
  employeeId,
  displayName: 'Pilot Store Manager',
  storeId,
  storeName: 'Pilot Store',
  regionId: '00000000-0000-0000-0000-000000000010',
  regionName: 'Pilot Region',
  regionManagerUserId: 'region-manager-user',
  regionManagerName: 'Pilot Region Manager',
  rank: 1,
  population: 100,
  storeRank: 1,
  storePopulation: 4,
  scoreValue: 87,
  visibility: 'detail',
  metrics: [{ code: 'TARGET_ACHIEVEMENT', label: 'Target achievement', actualValue: 0.87, targetValue: 1, benchmarkValue: null, contributionValue: 87 }],
}

const rankingsFixture = {
  source: { mode: 'live', periodType: 'monthly', periodStart: '2026-05-01', periodEnd: '2026-05-31' },
  access: { globalMode: 'full', canSeeGlobalDetails: true, canSeeManagedStorePersonnelDetails: true },
  filters: {
    regionManagers: [{ id: 'region-manager-user', label: 'Pilot Region Manager' }],
    regions: [{ id: '00000000-0000-0000-0000-000000000010', label: 'Pilot Region' }],
    stores: [{ id: storeId, label: 'Pilot Store' }],
  },
  storeLeaderboard: { items: [rankingStoreRow], currentStore: rankingStoreRow, meta: { total: 1, limit: 100, offset: 0 } },
  personnelLeaderboard: { items: [rankingPersonnelRow], currentEmployee: rankingPersonnelRow, managedStorePersonnel: [rankingPersonnelRow], meta: { total: 1, limit: 100, offset: 0 } },
  availablePeriods: [{ periodType: 'monthly', periodStart: '2026-05-01', periodEnd: '2026-05-31' }],
}
```

- [ ] **Step 2: Run the spec and verify it fails if routes are not fully mocked**

Run:

```powershell
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- pilot-smoke.spec.ts
```

Expected before any missing route mocks are completed: `FAIL` on the first unmocked API request or unavailable state.

- [ ] **Step 3: Complete route mocks until the smoke spec passes**

Use the Network error text from Playwright to add only the missing endpoint mocks to `routePilotSmokeApi`. Keep fixtures minimal and scoped to the page fields actually read by the route.

- [ ] **Step 4: Run the spec and verify it passes**

Run:

```powershell
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- pilot-smoke.spec.ts
```

Expected: `3 passed`.

- [ ] **Step 5: Commit**

```powershell
git add admin-web/e2e/pilot-smoke.spec.ts
git commit -m "Add pilot core smoke coverage"
```

---

### Task 4: Missing And Null API Contract Coverage

**Files:**
- Create: `admin-web/e2e/pilot-api-contracts.spec.ts`
- Modify only if a test fails: `admin-web/src/pages/StoreMyPerformancePage.tsx`
- Modify only if a test fails: `admin-web/src/pages/StoreRankingsPage.tsx`
- Modify only if a test fails: `admin-web/src/pages/StoreApprovalsPage.tsx`
- Modify only if a test fails: `admin-web/src/pages/MasterDataBootstrapPage.tsx`

- [ ] **Step 1: Write the failing contract spec**

Create `admin-web/e2e/pilot-api-contracts.spec.ts` with four tests:

```ts
import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: 'contract-user',
        mockRoleCodes: 'SUPER_ADMIN,INTEGRATION_ADMIN,REGION_MANAGER,STORE_MANAGER',
        mockCompanyIds: '00000000-0000-0000-0000-000000000001',
        bearerToken: '',
      }),
    )
  })
  await page.route('**/api/auth/session', async (route) => route.fulfill({ json: authSession }))
})

test('master data renders promoted batches when updatedAt is absent', async ({ page }) => {
  await page.route('**/api/integrations/master-data-bootstrap/batches?**', async (route) => {
    await route.fulfill({ json: masterDataWithoutUpdatedAt })
  })

  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/admin/master-data')

  await expect(page.getByText('Accepted personnel baseline')).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('store my performance renders fallback data when optional support fields are absent', async ({ page }) => {
  await routeStoreMeMinimalApi(page)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/store/me')

  await expect(page.getByRole('heading', { name: /Store personnel icin/i })).toBeVisible()
  await expect(page.getByText('Pilot Employee')).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('rankings render summary rows without metric detail arrays', async ({ page }) => {
  await page.route('**/api/reports/rankings?**', async (route) => {
    await route.fulfill({ json: rankingsWithoutMetrics })
  })

  await page.goto('/store/rankings')

  await expect(page.getByText('Pilot Store')).toBeVisible()
  await expect(page.getByText('Pilot Employee')).toBeVisible()
})

test('store approvals render pending requests with nullable approval fields', async ({ page }) => {
  await routeStoreApprovalsMinimalApi(page)

  await page.goto('/store/approvals')

  await expect(page.getByText('May target split')).toBeVisible()
  await expect(page.getByText('Pending')).toBeVisible()
})

async function routeStoreMeMinimalApi(page: Page) {
  await page.route('**/api/reports/kpi-config', async (route) => route.fulfill({ json: kpiConfig }))
  await page.route('**/api/reports/my-performance**', async (route) => {
    await route.fulfill({ json: myPerformanceWithoutOptionalSupport })
  })
}

async function routeStoreApprovalsMinimalApi(page: Page) {
  await page.route('**/api/target-distributions/requests**', async (route) => {
    await route.fulfill({ json: pendingTargetRequests })
  })
  await page.route('**/api/target-distributions/store-personnel?**', async (route) => route.fulfill({ json: emptyList }))
  await page.route('**/api/workforce/position-options?**', async (route) => route.fulfill({ json: emptyList }))
  await page.route('**/api/workforce/store-employees?**', async (route) => route.fulfill({ json: emptyList }))
  await page.route('**/api/workforce/seller-code-requests?**', async (route) => route.fulfill({ json: emptyList }))
  await page.route('**/api/workforce/offboarding-requests?**', async (route) => route.fulfill({ json: emptyList }))
}

const storeId = '00000000-0000-0000-0000-000000000100'
const employeeId = '00000000-0000-0000-0000-000000000200'

const authSession = {
  authMode: 'mock',
  authenticated: true,
  user: {
    userId: 'contract-user',
    employeeId,
    roleCodes: ['SUPER_ADMIN', 'INTEGRATION_ADMIN', 'REGION_MANAGER', 'STORE_MANAGER'],
    scope: { companyIds: ['00000000-0000-0000-0000-000000000001'], regionIds: [], storeIds: [storeId] },
    readScope: { companyIds: ['00000000-0000-0000-0000-000000000001'], regionIds: [], storeIds: [storeId] },
    actionScope: { assignedStoreIds: [storeId] },
    assignedStoreIds: [storeId],
  },
  scopeSummary: { companyCount: 1, regionCount: 0, storeCount: 1, assignedStoreCount: 1 },
}

const emptyList = { items: [], meta: { count: 0, total: 0, limit: 50, offset: 0 } }

const masterDataWithoutUpdatedAt = {
  items: [
    {
      batchId: 'batch-1',
      companyId: '00000000-0000-0000-0000-000000000001',
      bootstrapEntity: 'personnel',
      sourceLabel: 'Accepted personnel baseline',
      fileReference: 'personnel.xlsx',
      uploadedByUserId: 'contract-user',
      batchStatus: 'promoted',
      rowCount: 1,
      pendingCount: 0,
      validCount: 0,
      needsReviewCount: 0,
      invalidCount: 0,
      promotedCount: 1,
      createdAt: '2026-05-04T11:51:26.982Z',
      validatedAt: '2026-05-04T11:51:27.289Z',
      promotedAt: '2026-05-04T11:52:42.761Z',
      readiness: 'closed',
      nextAction: 'closed',
    },
  ],
  meta: { count: 1, total: 1, limit: 20, offset: 0 },
}

const kpiConfig = {
  metadata: { kpiConfigVersionId: null, versionNo: null, effectiveFrom: null, effectiveTo: null, publishedAt: null, publishedBy: null },
  storeProfile: { profileCode: 'store', title: 'Store', summary: 'Store score', futureMetricRule: 'No new metrics in contract smoke.', metrics: [] },
  personnelProfile: { profileCode: 'personnel', title: 'Personnel', summary: 'Personnel score', futureMetricRule: 'No new metrics in contract smoke.', metrics: [] },
  ownershipMatrix: [],
  gradingBands: [{ code: 'C', label: 'Focus', emoji: 'C', tone: 'warning', minScore: 0 }],
}

const myPerformanceWithoutOptionalSupport = {
  source: { mode: 'live', snapshotRunId: null, snapshotDate: null },
  employee: { employeeId, displayName: 'Pilot Employee', storeId, storeName: 'Pilot Store' },
  period: null,
  score: { value: 0, matchedMetrics: 0, totalMetrics: 1 },
  rankings: { turkeyRank: null, turkeyPopulation: 0, storeRank: null, storePopulation: 0 },
  availablePeriods: [],
  metrics: [],
}

const rankingsWithoutMetrics = {
  source: { mode: 'live', periodType: 'monthly', periodStart: null, periodEnd: null },
  access: { globalMode: 'top100', canSeeGlobalDetails: false, canSeeManagedStorePersonnelDetails: true },
  filters: { regionManagers: [], regions: [], stores: [] },
  storeLeaderboard: {
    items: [{ subject: 'store', storeId, storeName: 'Pilot Store', regionId: null, regionName: null, regionManagerUserId: null, regionManagerName: null, rank: 1, population: 100, scoreValue: 90, visibility: 'summary' }],
    currentStore: null,
    meta: { total: 100, limit: 100, offset: 0 },
  },
  personnelLeaderboard: {
    items: [{ subject: 'personnel', employeeId, displayName: 'Pilot Employee', storeId, storeName: 'Pilot Store', regionId: null, regionName: null, regionManagerUserId: null, regionManagerName: null, rank: 2, population: 100, storeRank: null, storePopulation: 0, scoreValue: 87, visibility: 'summary' }],
    currentEmployee: null,
    managedStorePersonnel: [],
    meta: { total: 100, limit: 100, offset: 0 },
  },
  availablePeriods: [],
}

const pendingTargetRequests = {
  items: [
    {
      requestId: 'request-1',
      companyId: '00000000-0000-0000-0000-000000000001',
      regionId: '00000000-0000-0000-0000-000000000010',
      storeId,
      storeName: 'Pilot Store',
      requestMonth: '2026-05-01',
      targetLabel: 'May target split',
      totalTargetValue: 1000,
      allocationCount: 1,
      status: 'pending_region_approval',
      requestReason: null,
      allocations: [],
      submittedByUserId: 'contract-user',
      approvedByUserId: null,
      approvedAt: null,
      approvalNote: null,
      createdAt: '2026-05-04T11:51:26.982Z',
      updatedAt: '2026-05-04T11:51:26.982Z',
    },
  ],
  meta: { count: 1, total: 1, limit: 50, offset: 0 },
}
```

- [ ] **Step 2: Run the spec and verify the failing behavior**

Run:

```powershell
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- pilot-api-contracts.spec.ts
```

Expected: tests either pass with current guards or fail on the first page that still assumes a missing optional field is present.

- [ ] **Step 3: Fix only proven contract failures**

If the store performance test fails because `partial` or `supporting` is missing, keep the existing fallback shape in `StoreMyPerformancePage.tsx` and extend it only for the missing field named in the Playwright error.

If rankings fail because metric arrays are absent, ensure `StoreRankingsPage.tsx` uses `row.metrics ?? []` in every metric rendering path.

If approvals fail because an approval field is null, ensure `StoreApprovalsPage.tsx` renders `Pending` or `No note` before calling `formatDateTime`.

If master data fails, ensure `MasterDataBootstrapPage.tsx` uses `updatedAt ?? promotedAt ?? validatedAt ?? createdAt`.

- [ ] **Step 4: Run verification**

Run:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- pilot-api-contracts.spec.ts
```

Expected: lint and build exit `0`, Playwright reports all tests passed.

- [ ] **Step 5: Commit**

```powershell
git add admin-web/e2e/pilot-api-contracts.spec.ts admin-web/src/pages/StoreMyPerformancePage.tsx admin-web/src/pages/StoreRankingsPage.tsx admin-web/src/pages/StoreApprovalsPage.tsx admin-web/src/pages/MasterDataBootstrapPage.tsx
git commit -m "Harden pilot API response contracts"
```

---

### Task 5: Demo And Live Ranking Boundary Contract

**Files:**
- Create: `scripts/ranking-demo-live-boundary-contract.test.mjs`
- Reference: `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`
- Reference: `backend/nestjs/src/modules/store-ops/application/ranking-access.policy.spec.ts`

- [ ] **Step 1: Write the repository source-filter contract**

Create `scripts/ranking-demo-live-boundary-contract.test.mjs` with:

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')
const repository = readFileSync(
  join(workspaceRoot, 'backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts'),
  'utf8',
)

function methodBody(name) {
  const marker = `async ${name}(`
  const start = repository.indexOf(marker)
  assert.notEqual(start, -1, `${name} must exist`)
  const nextMethod = repository.indexOf('\n  async ', start + marker.length)
  return repository.slice(start, nextMethod === -1 ? repository.length : nextMethod)
}

test('monthly ranking period lookup excludes demo seed source rows', () => {
  const body = methodBody('getLatestMonthlyRankingPeriod')
  assert.ok(body.includes("COALESCE(ka.source_type, '') <> 'demo_seed'"))
})

test('ranking available period lookup excludes demo seed source rows', () => {
  const body = methodBody('listRankingAvailablePeriods')
  assert.ok(body.includes("COALESCE(ka.source_type, '') <> 'demo_seed'"))
})

test('store ranking row lookup excludes demo seed source rows', () => {
  const body = methodBody('listRankingStoreKpiRows')
  assert.ok(body.includes("COALESCE(ka.source_type, '') <> 'demo_seed'"))
})

test('personnel ranking row lookup excludes demo seed source rows', () => {
  const body = methodBody('listRankingPersonnelKpiRows')
  assert.ok(body.includes("COALESCE(ka.source_type, '') <> 'demo_seed'"))
})

test('ranking filter options exclude demo seed source rows', () => {
  const body = methodBody('listRankingFilterOptions')
  const filterCount = body.match(/COALESCE\(ka\.source_type, ''\) <> 'demo_seed'/g)?.length ?? 0
  assert.ok(filterCount >= 2, 'region and store filter option queries must both exclude demo seed rows')
})
```

- [ ] **Step 2: Run the contract**

Run:

```powershell
node --test scripts/ranking-demo-live-boundary-contract.test.mjs
```

Expected: `PASS` with the current repository filters. If this fails, the repository query lost the live/demo boundary and must be fixed before continuing.

- [ ] **Step 3: Fix only the missing repository filter when the contract fails**

In `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`, add this clause to the failing ranking query's `clauses` array or SQL `WHERE` block:

```ts
`COALESCE(ka.source_type, '') <> 'demo_seed'`
```

Do not filter by store name, employee name, source label text, ranking score, role, or UI visibility.

- [ ] **Step 4: Run targeted verification**

Run:

```powershell
node --test scripts/ranking-demo-live-boundary-contract.test.mjs
npm.cmd --prefix backend/nestjs test -- ranking-access.policy.spec.ts --runInBand
```

Expected: both commands exit `0`.

- [ ] **Step 5: Commit**

```powershell
git add scripts/ranking-demo-live-boundary-contract.test.mjs backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts
git commit -m "Lock live ranking demo boundary"
```

---

### Task 6: Stabilization Release Gate

**Files:**
- Modify: `package.json`
- Modify: `admin-web/package.json`
- Reference: `backend/nestjs/package.json`

- [ ] **Step 1: Add failing script contract**

Create `scripts/pilot-stabilization-release-gate-contract.test.mjs` with:

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readJson(path) {
  return JSON.parse(readFileSync(join(workspaceRoot, path), 'utf8'))
}

test('root package exposes pilot stabilization check', () => {
  const pkg = readJson('package.json')
  assert.equal(
    pkg.scripts['check:pilot-stabilization'],
    'node --test scripts/pilot-route-role-matrix-contract.test.mjs scripts/pilot-release-smoke-checklist-contract.test.mjs scripts/ranking-demo-live-boundary-contract.test.mjs scripts/pilot-stabilization-release-gate-contract.test.mjs && npm.cmd --prefix admin-web run smoke:pilot',
  )
})

test('admin web package exposes pilot smoke command', () => {
  const pkg = readJson('admin-web/package.json')
  assert.equal(
    pkg.scripts['smoke:pilot'],
    'npm run build && playwright test pilot-smoke.spec.ts pilot-api-contracts.spec.ts',
  )
})
```

- [ ] **Step 2: Run it and verify it fails**

Run:

```powershell
node --test scripts/pilot-stabilization-release-gate-contract.test.mjs
```

Expected: `FAIL` because the scripts are not present.

- [ ] **Step 3: Add scripts**

Modify root `package.json`:

```json
{
  "scripts": {
    "check:release": "npm run test:scripts && node scripts/check-release.mjs",
    "smoke:migration:fresh-db": "node scripts/migration-fresh-db-smoke.mjs",
    "test:scripts": "node --test scripts/*.test.mjs",
    "check:pilot-stabilization": "node --test scripts/pilot-route-role-matrix-contract.test.mjs scripts/pilot-release-smoke-checklist-contract.test.mjs scripts/ranking-demo-live-boundary-contract.test.mjs scripts/pilot-stabilization-release-gate-contract.test.mjs && npm.cmd --prefix admin-web run smoke:pilot"
  }
}
```

Modify `admin-web/package.json` scripts by adding:

```json
"smoke:pilot": "npm run build && playwright test pilot-smoke.spec.ts pilot-api-contracts.spec.ts"
```

Keep every existing script unchanged.

- [ ] **Step 4: Run the stabilization gate**

Run:

```powershell
node --test scripts/pilot-stabilization-release-gate-contract.test.mjs
npm.cmd run check:pilot-stabilization
```

Expected: both commands exit `0`.

- [ ] **Step 5: Commit**

```powershell
git add package.json admin-web/package.json scripts/pilot-stabilization-release-gate-contract.test.mjs
git commit -m "Add pilot stabilization release gate"
```

---

## Final Verification

Run the full stabilization verification after all tasks:

```powershell
node --test scripts/pilot-route-role-matrix-contract.test.mjs
node --test scripts/pilot-release-smoke-checklist-contract.test.mjs
node --test scripts/ranking-demo-live-boundary-contract.test.mjs
node --test scripts/pilot-stabilization-release-gate-contract.test.mjs
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run smoke:pilot
npm.cmd --prefix backend/nestjs test -- ranking-access.policy.spec.ts --runInBand
git diff --check
```

Expected final state:

- all contract tests pass,
- pilot smoke passes,
- no frontend lint/build failure,
- ranking demo/live boundary is proven or already covered,
- deployment checklist exists,
- route matrix exists,
- no UI redesign work is included.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-06-pilot-stabilization-sprint.md`. Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - execute tasks in this session with checkpoints after each task.
