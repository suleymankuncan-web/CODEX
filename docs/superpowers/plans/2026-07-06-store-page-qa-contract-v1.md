# Store Page QA Contract V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable QA contract layer that catches store-page role, scope, data, workflow and visual regressions before the user has to find them manually.

**Architecture:** The contract layer has three levels: fast script contracts for route/data ownership, Playwright mocked-page contracts for persona and UI behavior, and page-specific workflow contracts for high-risk store surfaces. Route coverage is derived from `admin-web/src/app/store-route-registry.ts`, not from a second hard-coded page list.

**Tech Stack:** Node test runner (`node --test`), Playwright, Vite preview, React route fixtures, existing HR Axis auth/session mocks, existing `admin-web` script and e2e conventions.

---

## Scope

This plan covers all registered store routes:

- `/store/home`
- `/store/checklists`
- `/store/tasks`
- `/store/kpis`
- `/store/me`
- `/store/personnel/:employeeId`
- `/store/rankings`
- `/store/feed`
- `/store/competitions`
- `/store/approvals`
- `/store/incentives`
- `/store/settings`
- `/store/targets`
- `/store/workforce`
- `/store/reports`

The first implementation target is not to make every page perfect. The target is to create repeatable contracts that fail when a known class of issue returns:

- wrong persona access
- route/nav mismatch
- UUID/internal id visible in UI
- debug/internal copy visible in UI
- Turkish mojibake
- key controls hidden or overflowing
- filters changing base population unexpectedly
- page metrics disagreeing with visible rows
- role/scope leakage
- modal/sheet/drawer not opening or not usable

## PR Train

### PR0: Dependency and Local Test Preflight

**Purpose:** Make the local test environment trustworthy before adding new contracts.

**Files:**
- No committed source changes unless `package-lock.json` is already stale.

**Primary checks:**
- `npm.cmd ci` or the repo-approved install command restores missing local binaries and packages.
- `npm.cmd run test:scripts` no longer fails because `@playwright/test` or ESLint dependencies are missing.
- Any remaining failures are real repo failures and are recorded before PR1 starts.

### PR1: Store QA Contract Foundation

**Purpose:** Add route-driven contract infrastructure and lock basic page health across every store route.

**Files:**
- Create: `admin-web/e2e/store-page-contract-fixtures.ts`
- Create: `admin-web/e2e/store-page-route-matrix.ts`
- Create: `admin-web/e2e/store-page-contracts.spec.ts`
- Modify: `admin-web/package.json`
- Modify: `docs/README.md`
- Create: `docs/contracts/store-page-qa-contract-v1.md`

**Primary checks:**
- every registered route can be visited by at least one allowed persona
- forbidden personas get a forbidden/unavailable state instead of a blank page
- page does not render raw UUID-like strings
- page does not render internal/debug copy: `scope`, `API`, `DB`, `mock`, `contract`, `gerçek veri`, `yetkili mağaza`
- page does not create horizontal overflow on desktop
- page has no uncaught page errors

### PR2: Checklist, Rankings and KPIs Contracts

**Purpose:** Lock the highest-risk data surfaces where filters, ranks and score sources often drift.

**Files:**
- Create: `admin-web/e2e/store-checklists-contracts.spec.ts`
- Create: `admin-web/e2e/store-rankings-contracts.spec.ts`
- Create: `admin-web/e2e/store-kpis-contracts.spec.ts`
- Modify if needed: `admin-web/src/pages/store-checklists-logic.ts`
- Modify if needed: relevant page model files only when a contract exposes a bug

**Primary checks:**
- checklist BM+VM, BM and VM type filters do not unexpectedly shrink assigned store population
- checklist search and status filters are the only controls allowed to reduce visible store count
- checklist action opens the checklist session modal
- rankings store/personnel tabs preserve tab state after profile navigation and return
- personnel ranking excludes store managers
- personnel ranking detail rank matches list rank for same period
- KPI score source includes configured contributors, including GSM approval when available
- KPI period selector opens as a compact month/year picker and does not push the page down

### PR3: Incentives, Targets and Workforce Contracts

**Purpose:** Lock approval/review workflows and summary-row consistency.

**Files:**
- Create: `admin-web/e2e/store-incentives-contracts.spec.ts`
- Create: `admin-web/e2e/store-targets-contracts.spec.ts`
- Create: `admin-web/e2e/store-workforce-contracts.spec.ts`
- Modify page files only if contract failures expose existing bugs

**Primary checks:**
- incentives page does not show the old Excel export button in the header
- incentives review checkbox gives immediate visual feedback
- incentives correction drawer accepts money input and does not lock the input in a disabled/dark state
- incentives store row separators match the approved visual rhythm
- targets month/year picker opens on the full button, not only a narrow click area
- targets approved/pending metrics match mocked visible data
- workforce table expands full width when selected-store side panel is removed
- workforce detail tabs have non-white selected state and footer controls remain visible

### PR4: Tasks, Feed, Reports, Home, Me and Personnel Contracts

**Purpose:** Lock the remaining store workflow and notification surfaces.

**Files:**
- Create: `admin-web/e2e/store-tasks-contracts.spec.ts`
- Create: `admin-web/e2e/store-feed-contracts.spec.ts`
- Create: `admin-web/e2e/store-reports-contracts.spec.ts`
- Create: `admin-web/e2e/store-home-contracts.spec.ts`
- Create: `admin-web/e2e/store-me-contracts.spec.ts`
- Modify page files only if contracts expose existing bugs

**Primary checks:**
- tasks page lists date and elapsed duration columns with aligned cells
- feed region manager can compose a plain post; store manager/personnel can only read
- reports only exposes the agreed compact surface and the Excel download returns a valid `.xlsx`
- home page presents daily operation cards without date-picker clutter
- Store Me period picker matches the Store KPIs month/year pattern
- Store Me profile card button is `Performans Kartı Oluştur`
- personnel profile access is blocked for other personnel and store managers where required

### PR5: Release Gate and Evidence

**Purpose:** Make the contracts easy to run before PRs and record closeout evidence.

**Files:**
- Modify: `admin-web/package.json`
- Modify: `docs/process/store-admin-surface-standardization-v1.md`
- Create or update: `docs/evidence/store-page-qa-contract-v1/README.md`

**Primary checks:**
- add `npm run test:e2e:store-contracts`
- add a documented PR preflight sequence
- record which contracts are mocked, which are live/staging, and which are intentionally deferred

---

## File Responsibilities

### `admin-web/e2e/store-page-contract-fixtures.ts`

Owns reusable mocked session and API fixtures.

It should export:

```ts
import type { Page } from '@playwright/test'

export type StoreContractPersona =
  | 'regionManager'
  | 'storeManager'
  | 'storePersonnel'
  | 'admin'
  | 'visualMerchandiser'

export type StoreContractSession = {
  authMode: 'mock'
  authenticated: true
  user: {
    userId: string
    employeeId?: string
    roleCodes: string[]
    scope: { companyIds: string[]; regionIds: string[]; storeIds: string[] }
    readScope: { companyIds: string[]; regionIds: string[]; storeIds: string[] }
    actionScope: { assignedStoreIds: string[] }
    assignedStoreIds: string[]
  }
  scopeSummary: {
    assignedStoreCount: number
    companyCount: number
    regionCount: number
    storeCount: number
  }
}

export const companyId = '00000000-0000-0000-0000-000000000001'
export const regionId = '00000000-0000-0000-0000-000000000010'
export const storeIds = [
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000103',
] as const
export const employeeIds = [
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000202',
] as const

export function createStoreContractSession(persona: StoreContractPersona): StoreContractSession {
  const base = {
    authMode: 'mock' as const,
    authenticated: true as const,
    user: {
      userId: `${persona}-contract-user`,
      employeeId: persona === 'storePersonnel' ? employeeIds[0] : undefined,
      roleCodes: roleCodesForPersona(persona),
      scope: { companyIds: [companyId], regionIds: [regionId], storeIds: [...storeIds] },
      readScope: { companyIds: [companyId], regionIds: [regionId], storeIds: [...storeIds] },
      actionScope: { assignedStoreIds: [...storeIds] },
      assignedStoreIds: [...storeIds],
    },
    scopeSummary: {
      assignedStoreCount: storeIds.length,
      companyCount: 1,
      regionCount: 1,
      storeCount: storeIds.length,
    },
  }
  return base
}

function roleCodesForPersona(persona: StoreContractPersona) {
  if (persona === 'regionManager') return ['REGION_MANAGER']
  if (persona === 'storeManager') return ['STORE_MANAGER']
  if (persona === 'storePersonnel') return ['STORE_PERSONNEL']
  if (persona === 'visualMerchandiser') return ['VISUAL_MERCHANDISER']
  return ['SUPER_ADMIN', 'REPORT_VIEWER']
}

export async function installStoreContractSession(page: Page, persona: StoreContractPersona) {
  const session = createStoreContractSession(persona)
  await page.addInitScript((input) => {
    window.localStorage.setItem(
      'store-ops-admin-session',
      JSON.stringify({
        mode: 'mock',
        mockUserId: input.user.userId,
        mockRoleCodes: input.user.roleCodes.join(','),
        mockCompanyIds: input.user.scope.companyIds.join(','),
        bearerToken: '',
      }),
    )
  }, session)
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: session })
  })
  return session
}
```

### `admin-web/e2e/store-page-route-matrix.ts`

Owns the route-to-persona matrix and basic expected page anchors. This avoids scattering route lists across multiple e2e specs.

It should export:

```ts
import { employeeIds } from './store-page-contract-fixtures'
import type { StoreContractPersona } from './store-page-contract-fixtures'

export type StoreRouteContractExpectation = {
  path: string
  persona: StoreContractPersona
  visibleText: RegExp | string
}

export const storeRouteContractExpectations: StoreRouteContractExpectation[] = [
  { path: '/store/home', persona: 'regionManager', visibleText: /Ana Sayfa|Günlük Operasyon/i },
  { path: '/store/checklists', persona: 'regionManager', visibleText: /Checklistler/i },
  { path: '/store/tasks', persona: 'regionManager', visibleText: /Görevler/i },
  { path: '/store/kpis', persona: 'regionManager', visibleText: /Bölge Performansı|KPI/i },
  { path: '/store/me', persona: 'storePersonnel', visibleText: /Performans Kartı Oluştur|Performans skoru/i },
  { path: `/store/personnel/${employeeIds[0]}`, persona: 'regionManager', visibleText: /Performans skoru|Türkiye/i },
  { path: '/store/rankings', persona: 'regionManager', visibleText: /Türkiye Sıralaması|Türkiye mağaza sıralaması/i },
  { path: '/store/feed', persona: 'regionManager', visibleText: /Duyurular|Paylaş/i },
  { path: '/store/competitions', persona: 'storeManager', visibleText: /Turnuva|Yarışma|Competition/i },
  { path: '/store/approvals', persona: 'regionManager', visibleText: /Talep Merkezi|Onay/i },
  { path: '/store/incentives', persona: 'regionManager', visibleText: /Prim Kontrol Sayfası|Primler/i },
  { path: '/store/settings', persona: 'storeManager', visibleText: /Ayarlar|Profil/i },
  { path: '/store/targets', persona: 'regionManager', visibleText: /Hedefler/i },
  { path: '/store/workforce', persona: 'regionManager', visibleText: /Norm Kadro/i },
  { path: '/store/reports', persona: 'regionManager', visibleText: /Raporlar/i },
]
```

### `admin-web/e2e/store-page-contracts.spec.ts`

Owns generic route health.

The first version should contain:

```ts
import { expect, test, type Page } from './test-fixtures'
import { installGenericStoreApiFallbacks, installStoreContractSession } from './store-page-contract-fixtures'
import { storeRouteContractExpectations } from './store-page-route-matrix'

for (const item of storeRouteContractExpectations) {
  test(`${item.path} has basic page health for ${item.persona}`, async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await installStoreContractSession(page, item.persona)
    await installGenericStoreApiFallbacks(page)

    await page.goto(item.path)

    await expect(page.getByText(item.visibleText).first()).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await expectNoInternalCopy(page)
    expect(pageErrors).toEqual([])
  })
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }))
  expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 4)
}

async function expectNoInternalCopy(page: Page) {
  const body = await page.locator('body').innerText()
  expect(body).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)
  expect(body).not.toMatch(/\b(API|DB|scope|mock|contract)\b/i)
  expect(body).not.toMatch(/gerçek veri|yetkili mağaza|kayıt temsil eder/i)
  expect(body).not.toMatch(/Ã|Ä|Å|Ë|Ð|Ý|þ|ð/)
}

async function installGenericStoreApiFallbacks(page: Page) {
  await page.route('**/api/workflow/inbox**', async (route) => route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 30, offset: 0 } } }))
  await page.route('**/api/reports/kpi-config**', async (route) => route.fulfill({ json: { metadata: {}, metrics: [] } }))
}
```

### `admin-web/e2e/store-checklists-contracts.spec.ts`

Owns checklist-specific regression contracts.

It should include a direct test for the current class of issue:

```ts
import { expect, test, type Page } from './test-fixtures'
import { installStoreContractSession, storeIds } from './store-page-contract-fixtures'

test('BM and VM checklist type filters keep assigned store population visible', async ({ page }) => {
  await installStoreContractSession(page, 'regionManager')
  await routeChecklistContractApi(page)

  await page.goto('/store/checklists')

  await expect(page.locator('.store-checklists-visit-row')).toHaveCount(3)

  await page.getByRole('combobox', { name: /Şablon tipi|Checklist türü|Template type/i }).click()
  await page.getByRole('option', { name: /BM/i }).click()
  await expect(page.locator('.store-checklists-visit-row')).toHaveCount(3)

  await page.getByRole('combobox', { name: /Şablon tipi|Checklist türü|Template type/i }).click()
  await page.getByRole('option', { name: /VM/i }).click()
  await expect(page.locator('.store-checklists-visit-row')).toHaveCount(3)
})

async function routeChecklistContractApi(page: Page) {
  await page.route('**/api/mobile/checklists/today', async (route) => {
    await route.fulfill({ json: createChecklistTodayFixture() })
  })
  await page.route('**/api/checklists/acknowledgements/list**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 50, offset: 0 } } })
  })
  await page.route('**/api/workflow/inbox**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 30, offset: 0 } } })
  })
}

function createChecklistTodayFixture() {
  return {
    data: {
      stores: storeIds.map((storeId, index) => ({ storeId, storeName: ['Balıkesir 10 Burda AVM', 'Bursa Downtown AVM', 'İstanbul MOI AVM'][index] })),
      templates: [
        {
          checklistTemplateId: '11111111-1111-4111-8111-111111111111',
          templateCode: 'BM_STORE_VISIT_2026',
          templateName: 'BM Mağaza Ziyareti',
          templateType: 'BM_STORE_VISIT',
          versionNo: 1,
          items: [],
        },
        {
          checklistTemplateId: '22222222-2222-4222-8222-222222222222',
          templateCode: 'VM_STORE_VISIT_2026',
          templateName: 'VM Mağaza Ziyareti',
          templateType: 'VM_STORE_VISIT',
          versionNo: 1,
          items: [],
        },
      ],
      activeInstances: [],
      completedThisMonth: [],
      pendingAcknowledgements: [],
      monthlySummaries: [
        {
          storeId: storeIds[0],
          checklistTemplateId: '22222222-2222-4222-8222-222222222222',
          monthStart: '2026-07-01',
          completedCount: 1,
          averageScore: 82,
        },
      ],
    },
  }
}
```

This fixture intentionally gives one store only VM history. The BM filter must still show all stores because the store population is assigned-store based.

### `admin-web/scripts/store-page-contract.test.mjs`

Owns fast static checks where Playwright is not needed.

```js
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const registrySource = await readFile(new URL('../src/app/store-route-registry.ts', import.meta.url), 'utf8')

test('store QA contract covers every registered store route id', () => {
  const ids = [...registrySource.matchAll(/\nid: '([^']+)'/g)].map((match) => match[1]).sort()
  assert.deepEqual(ids, [
    'approvals',
    'checklists',
    'competitions',
    'feed',
    'home',
    'incentives',
    'kpis',
    'me',
    'personnel',
    'rankings',
    'reports',
    'settings',
    'targets',
    'tasks',
    'workforce',
  ])
})

test('store QA route contract scripts are exposed in package json', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(packageJson.scripts['test:e2e:store-contracts'], 'playwright test store-page-contracts.spec.ts store-checklists-contracts.spec.ts store-rankings-contracts.spec.ts store-kpis-contracts.spec.ts store-incentives-contracts.spec.ts store-targets-contracts.spec.ts store-workforce-contracts.spec.ts store-tasks-contracts.spec.ts store-feed-contracts.spec.ts store-reports-contracts.spec.ts store-home-contracts.spec.ts store-me-contracts.spec.ts')
})
```

---

## Tasks

### Task 0: Verify Local Test Dependencies

**Files:**
- No source files unless dependency metadata is stale.

- [ ] **Step 1: Check local dependency completeness**

Run:

```powershell
Test-Path admin-web/node_modules/.bin/eslint
Test-Path admin-web/node_modules/@playwright/test/package.json
Test-Path admin-web/node_modules/@clerk/react/package.json
```

Expected: all three return `True`.

- [ ] **Step 2: Restore dependencies if any check is false**

Run:

```powershell
npm.cmd ci
```

from `D:\store-ops-workspace\admin-web`.

Expected: `node_modules/.bin/eslint`, `node_modules/@playwright/test/package.json`, and `node_modules/@clerk/react/package.json` exist after install.

- [ ] **Step 3: Run baseline scripts before adding contracts**

Run:

```powershell
npm.cmd run test:scripts
```

Expected: PASS. If it fails, capture the exact failing test names and resolve dependency-caused failures before writing new contracts.

### Task 1: Add QA Contract Documentation

**Files:**
- Create: `docs/contracts/store-page-qa-contract-v1.md`
- Modify: `docs/README.md`

- [ ] **Step 1: Create the contract doc**

Write `docs/contracts/store-page-qa-contract-v1.md` with:

```markdown
# Store Page QA Contract V1

## Purpose

Store pages must fail in tests before a user finds repeated route, data, workflow or visual regressions manually.

## Required Contract Classes

1. Route access and navigation match `store-route-registry.ts`.
2. Persona scope is respected.
3. Page metrics agree with visible rows or mocked API totals.
4. No UUID, internal id, debug copy or mojibake is visible.
5. No horizontal overflow on desktop.
6. Primary actions open their modal, drawer or sheet.
7. Period controls use compact month/year behavior where the product has standardized it.

## High-Risk Pages

- Checklistler
- Türkiye Sıralaması
- KPI Özetleri
- Primler
- Hedefler
- Norm Kadro
- Görevler
- Raporlar
- Duyurular
- Store Me

## PR Rule

Before opening a PR that touches a store page, run:

```bash
npm.cmd run test:scripts
npm.cmd run test:e2e:store-contracts
```

If local dependencies are incomplete, record the exact dependency failure in the PR notes and do not claim the contract passed.
```

- [ ] **Step 2: Link the doc from README**

Add one bullet under the docs index:

```markdown
- [Store Page QA Contract V1](contracts/store-page-qa-contract-v1.md)
```

- [ ] **Step 3: Verify markdown paths**

Run:

```powershell
Test-Path docs/contracts/store-page-qa-contract-v1.md
Select-String -Path docs/README.md -Pattern "Store Page QA Contract V1"
```

Expected: both commands return a match / `True`.

### Task 2: Add Generic Fixture Layer

**Files:**
- Create: `admin-web/e2e/store-page-contract-fixtures.ts`
- Create: `admin-web/e2e/store-page-route-matrix.ts`

- [ ] **Step 1: Add persona session helpers**

Use the full fixture structure from the file responsibility section above.

- [ ] **Step 2: Add generic API fallbacks**

Append these exports to `store-page-contract-fixtures.ts`:

```ts
export async function installGenericStoreApiFallbacks(page: Page) {
  await page.route('**/api/workflow/inbox**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 30, offset: 0 } } })
  })
  await page.route('**/api/feed/posts**', async (route) => {
    await route.fulfill({ json: { items: [], meta: { count: 0, total: 0, limit: 20, offset: 0 } } })
  })
  await page.route('**/api/reports/kpi-config**', async (route) => {
    await route.fulfill({ json: { metadata: {}, metrics: [] } })
  })
}
```

- [ ] **Step 3: Run targeted TypeScript parse**

Run:

```powershell
node -e "const ts=require('./admin-web/node_modules/typescript'); const fs=require('fs'); const p='admin-web/e2e/store-page-contract-fixtures.ts'; const s=fs.readFileSync(p,'utf8'); const r=ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true}); const e=(r.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error); if(e.length){console.error(e.map(d=>d.messageText).join('\n')); process.exit(1)} console.log('fixture parse ok')"
```

Expected: `fixture parse ok`.

- [ ] **Step 4: Add and parse the route matrix**

Create `admin-web/e2e/store-page-route-matrix.ts` from the file responsibility section, then run:

```powershell
node -e "const ts=require('./admin-web/node_modules/typescript'); const fs=require('fs'); const p='admin-web/e2e/store-page-route-matrix.ts'; const s=fs.readFileSync(p,'utf8'); const r=ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true}); const e=(r.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error); if(e.length){console.error(e.map(d=>d.messageText).join('\n')); process.exit(1)} console.log('route matrix parse ok')"
```

Expected: `route matrix parse ok`.

### Task 3: Add Generic Store Page Health Spec

**Files:**
- Create: `admin-web/e2e/store-page-contracts.spec.ts`

- [ ] **Step 1: Write the generic spec**

Use the full `store-page-contracts.spec.ts` skeleton from the file responsibility section.

- [ ] **Step 2: Run the spec**

Run:

```powershell
npm.cmd run test:e2e -- store-page-contracts.spec.ts
```

Expected: failures only where a page lacks the needed mocked API fallback. Add explicit fallback routes in `installGenericStoreApiFallbacks` until the generic health spec gets past route loading.

- [ ] **Step 3: Record any real UI failures**

If a route loads but fails because of visible UUID, mojibake, overflow, or internal copy, do not weaken the assertion. Fix the page or open the page-specific task in the same PR.

### Task 4: Add Checklist Contract Spec

**Files:**
- Create: `admin-web/e2e/store-checklists-contracts.spec.ts`
- Modify if needed: `admin-web/src/pages/store-checklists-logic.ts`

- [ ] **Step 1: Write failing checklist population test**

Use the full `store-checklists-contracts.spec.ts` skeleton above.

- [ ] **Step 2: Run the failing test before any fix**

Run:

```powershell
npm.cmd run test:e2e -- store-checklists-contracts.spec.ts
```

Expected before the current bug fix: BM filter count can drop below assigned store count when only VM history exists.

- [ ] **Step 3: Apply or keep the filter fix**

Ensure `doesCoverageRowMatchFilters` includes open coverage rows for selected periods:

```ts
const coverageStatus = getCoverageStatus(row)
const isOpenCoverageRow = coverageStatus === 'missing' || coverageStatus === 'draft'
const isCurrentLocalCompletion =
  filters.month === getCurrentMonthKey() &&
  coverageStatus === 'completed' &&
  row.completedCount > 0
if (!rowMonths.includes(filters.month) && !isOpenCoverageRow && !isCurrentLocalCompletion) return false
```

- [ ] **Step 4: Rerun the checklist contract**

Run:

```powershell
npm.cmd run test:e2e -- store-checklists-contracts.spec.ts
```

Expected: PASS.

### Task 5: Add Rankings and KPI Contracts

**Files:**
- Create: `admin-web/e2e/store-rankings-contracts.spec.ts`
- Create: `admin-web/e2e/store-kpis-contracts.spec.ts`

- [ ] **Step 0: Add stable test selectors only where role/name locators are not enough**

Prefer accessible names. If a row/rank value cannot be selected reliably, add narrowly scoped selectors such as:

```tsx
<tr data-testid="personnel-row">
  <td data-testid="personnel-rank">{rankLabel}</td>
</tr>
```

Do not add broad selectors to layout wrappers just to make tests convenient.

- [ ] **Step 1: Rankings test for no store manager in personnel ranking**

Add a mocked rankings response with:

```ts
const rankingRows = [
  { employeeId: 'manager-1', employeeName: 'Mağaza Müdürü', roleCode: 'STORE_MANAGER', score: 99 },
  { employeeId: 'seller-1', employeeName: 'Satış Danışmanı', roleCode: 'SALES_CONSULTANT', score: 88 },
]
```

Assert:

```ts
await expect(page.getByText('Mağaza Müdürü')).not.toBeVisible()
await expect(page.getByText('Satış Danışmanı')).toBeVisible()
```

- [ ] **Step 2: Rankings test for detail rank consistency**

Click the first visible personnel row and assert the detail page displays the same Turkey rank shown in the list.

```ts
const firstRank = await page.locator('[data-testid="personnel-rank"]').first().innerText()
await page.locator('[data-testid="personnel-row"]').first().click()
await expect(page.getByText(firstRank)).toBeVisible()
```

If these selectors do not exist yet, add the minimal selectors in the same PR and include them in the diff review.

- [ ] **Step 3: KPI score source test**

Mock KPI config with `GSM_ONAY`, `BM_CHECKLIST`, `VM_CHECKLIST` and assert the score source card contains all configured contributors:

```ts
await expect(page.getByText('GSM Onayı')).toBeVisible()
await expect(page.getByText('BM Checklist')).toBeVisible()
await expect(page.getByText('VM Checklist')).toBeVisible()
```

- [ ] **Step 4: Run focused specs**

Run:

```powershell
npm.cmd run test:e2e -- store-rankings-contracts.spec.ts store-kpis-contracts.spec.ts
```

Expected: PASS after any necessary page fixes.

### Task 6: Add Incentives, Targets and Workforce Contracts

**Files:**
- Create: `admin-web/e2e/store-incentives-contracts.spec.ts`
- Create: `admin-web/e2e/store-targets-contracts.spec.ts`
- Create: `admin-web/e2e/store-workforce-contracts.spec.ts`

- [ ] **Step 1: Incentives money input contract**

Open a mocked correction drawer and type `50000`.

Assert:

```ts
await expect(page.getByLabel('Final prim tutarı')).toHaveValue(/50\.000|50000/)
await expect(page.getByText('Geçerli bir tutar girin')).not.toBeVisible()
```

- [ ] **Step 2: Incentives immediate review feedback contract**

Click `Kontrol edildi` and assert visual state changes immediately:

```ts
await page.getByRole('button', { name: /Kontrol edildi|Kontrol et/i }).click()
await expect(page.getByText('Kontrol edildi').first()).toBeVisible()
```

- [ ] **Step 3: Targets period picker contract**

Click the left edge, middle and right edge of the month/year button and assert the popover opens in each case.

- [ ] **Step 4: Workforce no-side-panel layout contract**

Assert the table wrapper uses the full content width and the old `Seçili mağaza` side card is absent:

```ts
await expect(page.getByText('Seçili mağaza')).not.toBeVisible()
await expect(page.locator('[data-testid="workforce-table"]')).toBeVisible()
```

- [ ] **Step 5: Run focused specs**

Run:

```powershell
npm.cmd run test:e2e -- store-incentives-contracts.spec.ts store-targets-contracts.spec.ts store-workforce-contracts.spec.ts
```

Expected: PASS after any necessary page fixes.

### Task 7: Add Remaining Store Surface Contracts

**Files:**
- Create: `admin-web/e2e/store-tasks-contracts.spec.ts`
- Create: `admin-web/e2e/store-feed-contracts.spec.ts`
- Create: `admin-web/e2e/store-reports-contracts.spec.ts`
- Create: `admin-web/e2e/store-home-contracts.spec.ts`
- Create: `admin-web/e2e/store-me-contracts.spec.ts`

- [ ] **Step 1: Tasks contract**

Assert table headers:

```ts
await expect(page.getByRole('columnheader', { name: 'Tarih' })).toBeVisible()
await expect(page.getByRole('columnheader', { name: 'Geçen süre' })).toBeVisible()
```

- [ ] **Step 2: Feed contract**

Region manager sees composer:

```ts
await expect(page.getByPlaceholder(/Ne paylaşmak istersin|Duyuru yaz/i)).toBeVisible()
```

Store manager does not:

```ts
await expect(page.getByPlaceholder(/Ne paylaşmak istersin|Duyuru yaz/i)).not.toBeVisible()
```

- [ ] **Step 3: Reports Excel contract**

Click Excel download and validate response content type or downloaded file extension:

```ts
const downloadPromise = page.waitForEvent('download')
await page.getByRole('button', { name: /Excel indir/i }).click()
const download = await downloadPromise
expect(download.suggestedFilename()).toMatch(/\.xlsx$/)
```

- [ ] **Step 4: Store Me contract**

Assert the top button and compact period picker:

```ts
await expect(page.getByRole('button', { name: 'Performans Kartı Oluştur' })).toBeVisible()
await expect(page.getByRole('button', { name: /Haziran 2026|Mayıs 2026/i })).toBeVisible()
await expect(page.getByText('Dönem veri')).not.toBeVisible()
```

- [ ] **Step 5: Run focused specs**

Run:

```powershell
npm.cmd run test:e2e -- store-tasks-contracts.spec.ts store-feed-contracts.spec.ts store-reports-contracts.spec.ts store-home-contracts.spec.ts store-me-contracts.spec.ts
```

Expected: PASS after any necessary page fixes.

### Task 8: Add Package Scripts and Release Gate

**Files:**
- Modify: `admin-web/package.json`
- Modify: `docs/process/store-admin-surface-standardization-v1.md`

- [ ] **Step 1: Add store contract script**

Add:

```json
"test:e2e:store-contracts": "playwright test store-page-contracts.spec.ts store-checklists-contracts.spec.ts store-rankings-contracts.spec.ts store-kpis-contracts.spec.ts store-incentives-contracts.spec.ts store-targets-contracts.spec.ts store-workforce-contracts.spec.ts store-tasks-contracts.spec.ts store-feed-contracts.spec.ts store-reports-contracts.spec.ts store-home-contracts.spec.ts store-me-contracts.spec.ts"
```

- [ ] **Step 2: Add pre-PR discipline note**

Add to `docs/process/store-admin-surface-standardization-v1.md`:

```markdown
## Store Page QA Contract Gate

Before opening a PR that touches any `/store/*` page:

```bash
npm.cmd run test:scripts
npm.cmd run test:e2e:store-contracts
```

If dependency installation is incomplete, record the exact command output. Do not claim the contract passed.
```

- [ ] **Step 3: Run final focused gate**

Run:

```powershell
npm.cmd run test:scripts
npm.cmd run test:e2e:store-contracts
```

Expected: both pass in a complete dependency environment.

---

## Known Execution Risks

1. `admin-web/node_modules` may be partially installed locally. PR0 must restore dependencies before any new test result is trusted.
2. Some existing tests currently contain mojibake in expected strings. New contracts must use correct Turkish strings and must not copy those broken expectations forward.
3. Generic route tests can become noisy if every API endpoint is mocked inside one file. Keep generic fallbacks minimal and move page-specific data to page-specific specs.
4. Tests that rely on `[data-testid]` require matching, narrow selectors in production TSX. Do not assume the selectors already exist.
5. Do not weaken assertions to make tests pass. If the assertion reflects a real product rule, fix the page.

## Self-Review

- Spec coverage: all store routes from `store-route-registry.ts` are covered by the generic route health contract, and high-risk surfaces receive page-specific contracts.
- Placeholder scan: no task uses deferred-work placeholder wording; every task names files, commands and expected behavior.
- Type consistency: route ids, persona names, paths and scripts match the current registry and package conventions.
