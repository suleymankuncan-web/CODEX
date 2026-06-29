# Store Home Command V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the approved `/store/home?prototype=command-v1` visual and workflow into the production `/store/home` route with real role-aware data and no prototype drift.

**Architecture:** Keep the production Store shell, auth/session, role-aware navigation, existing queries, and route guards unchanged. Extract the approved prototype surface into a reusable production view, feed it with a small real-data view model from `StoreHomePage`, and make the dev prototype route render the same view so future parity cannot drift.

**Tech Stack:** React, TypeScript, React Router, TanStack Query, existing Store shell/navigation, existing Store APIs, lucide icons, scoped Store Command CSS, Playwright e2e.

---

## Scope

This is one frontend-only PR.

In scope:

- `/store/home` must visually match the approved Store Home command prototype.
- `/store/home?prototype=command-v1` should keep working in dev, but should reuse the same view component as production.
- Region Manager, Store Manager, Store Personnel, Visual Merchandiser, and admin-like store preview personas must remain role-aware.
- All visible metrics, priorities, announcements, and quick links must come from existing auth/session, navigation, workflow inbox, checklist, visit priority, and route availability data.
- Turkish production copy must be short, product-facing, and free of internal wording.
- Desktop and mobile layouts must not overflow.

Out of scope:

- Backend API changes.
- DB/schema changes.
- New notification, read receipt, task, checklist, target, incentive, or feed workflow.
- New metrics that are not already available through existing queries.
- Changing Store sidebar/header brand language.

## Current Evidence

- Approved prototype route: `/store/home?prototype=command-v1`
- Prototype component: `admin-web/src/prototypes/store-home-command-v1.tsx`
- Prototype shell: `admin-web/src/prototypes/store-prototype-command-shell.tsx`
- Prototype CSS: `admin-web/src/styles/store-home-me-prototypes.css`
- Production route: `admin-web/src/pages/StoreHomePage.tsx`
- Production shell: `admin-web/src/app/store-shell.tsx`
- Production sidebar: `admin-web/src/app/store-sidebar.tsx`
- Product brief: `docs/prototypes/store-home.md`

The current production page still uses the older `StoreSurfacePage`, `StoreSurfaceHeader`, `StoreMetricCard`, `StoreSectionCard`, and stacked dashboard rhythm. The prototype uses `store-home-ops`, `sh-command-bar`, `sh-hero`, `sh-metrics`, priority flow, selected detail, announcements, and quick-link panels. The implementation must replace the visible production surface, not recolor the old structure.

## File Structure

- Modify `admin-web/src/pages/StoreHomePage.tsx`
  - Keep query orchestration and persona/role logic.
  - Remove old `StoreSurface*` rendering for the home page.
  - Build a `StoreHomeCommandModel` and render `StoreHomeCommandView`.

- Create `admin-web/src/pages/store-home-command-model.ts`
  - Own pure mapping from existing query/navigation/auth summaries into view props.
  - No React.
  - No API calls.
  - No fake data.

- Create `admin-web/src/pages/store-home-command-view.tsx`
  - Own the production JSX matching the approved prototype.
  - Uses `Link` for real navigation.
  - Uses `button` only for in-page quick filter/selection controls where no route action is performed.
  - Exposes stable test ids.

- Create `admin-web/src/styles/store-home-command.css`
  - Move the `.store-home-ops` / `.sh-*` production styles here.
  - Convert prototype-only shell selectors to production selectors.
  - Keep existing Store Command variables; do not introduce raw hex palette drift.

- Modify `admin-web/src/styles/store-home-me-prototypes.css`
  - Remove or stop owning the `.store-home-ops` / `.sh-*` block once production CSS owns it.
  - Keep Store Me prototype CSS intact.

- Modify `admin-web/src/index.css`
  - Import `store-home-command.css` near other Store command styles.

- Modify `admin-web/src/app/store-shell.tsx`
  - Add a route class for home, e.g. `store-shell-store-home`, so production main width matches the prototype.

- Modify `admin-web/src/prototypes/store-home-command-v1.tsx`
  - Replace duplicated prototype JSX with the shared `StoreHomeCommandView` and a static prototype model.
  - This keeps the prototype URL available and prevents visual drift.

- Modify `admin-web/src/features/localization/messages/store-home.ts`
  - Add/adjust only the copy actually used by the new production home.
  - Keep old keys if still used by tests or historical routes, but production home should not render old dashboard copy.

- Create `admin-web/e2e/store-home-command.spec.ts`
  - Small focused e2e for the new production surface.
  - Do not grow `store-surfaces.spec.ts`.

## Data Mapping Contract

| Prototype area | Production source |
|---|---|
| Persona pill | `resolveStorePersona(authSummary)` + `getStorePersonaLabelKey` |
| Period pill | Static current month display from client date, formatted as Turkish month/year for display only |
| Authorized stores / portfolio count | `authSummary.scopeSummary.assignedStoreCount`, fallback `scopeSummary.storeCount`, fallback read/scope store ids |
| Acil iş | Count of high priority command items: workflow candidates, pending checklist acknowledgements, visit priority, target request entries when route is available |
| Onay bekleyen | Existing workflow inbox + target/checklist acknowledgement state; no new approval API |
| Takipte mağaza | Existing visit priority summary when available for Region Manager / VM |
| Yeni duyuru | Existing feed route availability only in V1; if no feed summary query is already on Store Home, show `Duyurular` quick link with `Aç` / `Hazır`, not a fabricated count |
| Priority list | Derived from available route + existing query states |
| Selected detail panel | In-page detail for the selected priority row, with CTA linking to the source route |
| Announcements panel | If feed data is already fetched on this page, show pinned/latest. If not, show route entry only, not fake posts |
| Quick links | `getRoleAwareStoreNavigation(authSummary)` filtered to high-value routes |

## Task 1: Add Failing E2E For Production Surface

**Files:**

- Create: `admin-web/e2e/store-home-command.spec.ts`

- [ ] **Step 1: Add focused e2e spec**

Create the file with this starting content:

```ts
import { expect, test, type Page } from './test-fixtures'

const companyId = '00000000-0000-0000-0000-000000000001'
const regionId = '00000000-0000-0000-0000-000000000010'
const storeId = '00000000-0000-0000-0000-000000000100'

type RoleCode = 'REGION_MANAGER' | 'STORE_MANAGER' | 'STORE_PERSONNEL' | 'VISUAL_MERCHANDISER'

function authSession(roleCode: RoleCode) {
  const isRegion = roleCode === 'REGION_MANAGER'
  const isStore = roleCode === 'STORE_MANAGER' || roleCode === 'STORE_PERSONNEL' || roleCode === 'VISUAL_MERCHANDISER'

  return {
    authMode: 'mock',
    authenticated: true,
    user: {
      userId: `${roleCode.toLowerCase()}-home-user`,
      employeeId: roleCode === 'STORE_PERSONNEL' ? 'employee-home-1' : null,
      email: `${roleCode.toLowerCase()}@example.test`,
      username: `${roleCode.toLowerCase()}-home-user`,
      displayName:
        roleCode === 'REGION_MANAGER'
          ? 'Onur Kaytan'
          : roleCode === 'STORE_MANAGER'
            ? 'Mert Alcan'
            : 'Store Kullanıcısı',
      roleCodes: [roleCode],
      scope: {
        companyIds: [companyId],
        regionIds: isRegion ? [regionId] : [],
        storeIds: isStore ? [storeId] : [],
      },
      readScope: {
        companyIds: [companyId],
        regionIds: isRegion ? [regionId] : [],
        storeIds: isStore ? [storeId] : [],
      },
      actionScope: {
        assignedStoreIds: roleCode === 'STORE_MANAGER' ? [storeId] : [],
      },
      assignedStoreIds: roleCode === 'STORE_MANAGER' ? [storeId] : [],
    },
    scopeSummary: {
      companyCount: 1,
      regionCount: isRegion ? 1 : 0,
      storeCount: isRegion ? 30 : 1,
      assignedStoreCount: roleCode === 'STORE_MANAGER' ? 1 : 0,
    },
  }
}

async function routeAuth(page: Page, roleCode: RoleCode) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: authSession(roleCode) })
  })
}

test('store home production route renders the approved command surface for region manager', async ({ page }) => {
  await routeAuth(page, 'REGION_MANAGER')

  await page.goto('/store/home')

  await expect(page.getByTestId('store-home-command')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Günlük Operasyon', exact: true })).toBeVisible()
  await expect(page.locator('.store-home-ops .sh-command-bar')).toBeVisible()
  await expect(page.locator('.store-home-ops .sh-metric')).toHaveCount(4)
  await expect(page.getByRole('heading', { name: 'Öncelik akışı', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Duyurular', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Hızlı geçiş', exact: true })).toBeVisible()
  await expect(page.getByText('Bölge müdürü')).toBeVisible()
})

test('store home keeps manager actions role-aware inside the command surface', async ({ page }) => {
  await routeAuth(page, 'STORE_MANAGER')

  await page.goto('/store/home')

  await expect(page.getByTestId('store-home-command')).toBeVisible()
  await expect(page.getByText('Mağaza müdürü')).toBeVisible()
  await expect(page.getByRole('link', { name: /Görevler|Görevi/i })).toBeVisible()
  await expect(page.getByText('Bölge portföyü')).toHaveCount(0)
})

test('store home keeps personnel away from manager-only command items', async ({ page }) => {
  await routeAuth(page, 'STORE_PERSONNEL')

  await page.goto('/store/home')

  await expect(page.getByTestId('store-home-command')).toBeVisible()
  await expect(page.getByText('Mağaza personeli')).toBeVisible()
  await expect(page.getByText('Hedef kararı')).toHaveCount(0)
  await expect(page.getByText('Prim paketi')).toHaveCount(0)
})
```

- [ ] **Step 2: Run the new test and verify failure**

Run:

```powershell
npm.cmd --prefix admin-web run test:e2e -- store-home-command.spec.ts
```

Expected before implementation: FAIL because `/store/home` does not render `data-testid="store-home-command"` or the prototype command sections.

## Task 2: Create The Production View Model

**Files:**

- Create: `admin-web/src/pages/store-home-command-model.ts`
- Modify: `admin-web/src/pages/StoreHomePage.tsx`

- [ ] **Step 1: Create model types and helpers**

Create `admin-web/src/pages/store-home-command-model.ts`:

```ts
import type { ReactNode } from 'react'
import type { To } from 'react-router-dom'
import type { StorePersona } from '../app/store-navigation'

export type StoreHomeCommandTone = 'plum' | 'cyan' | 'mint' | 'amber' | 'rose'

export type StoreHomeCommandMetric = {
  id: string
  label: string
  value: string
  note: string
  tone: StoreHomeCommandTone
  icon: ReactNode
}

export type StoreHomeCommandPriority = {
  id: string
  source: string
  title: string
  detail: string
  meta: string
  status: string
  cta: string
  href: To
  routeLabel: string
  tone: StoreHomeCommandTone
  icon: ReactNode
  priority: number
}

export type StoreHomeCommandAnnouncement = {
  id: string
  label: string
  copy: string
  time: string
}

export type StoreHomeCommandQuickLink = {
  id: string
  label: string
  value: string
  href: To
  tone: StoreHomeCommandTone
  icon: ReactNode
}

export type StoreHomeCommandModel = {
  persona: StorePersona
  personaLabel: string
  identityLabel: string
  periodLabel: string
  todayTitle: string
  todayNote: string
  metrics: StoreHomeCommandMetric[]
  priorities: StoreHomeCommandPriority[]
  announcements: StoreHomeCommandAnnouncement[]
  quickLinks: StoreHomeCommandQuickLink[]
}

export function countNumeric(value: string | null | undefined) {
  if (!value) return 0
  return /^\d+$/.test(value) ? Number(value) : 0
}

export function formatStoreHomePeriod(date = new Date()) {
  return new Intl.DateTimeFormat('tr-TR', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}
```

- [ ] **Step 2: Run TypeScript check and verify no consumer yet**

Run:

```powershell
npm.cmd --prefix admin-web run build
```

Expected: PASS. This file is isolated and should not affect runtime.

## Task 3: Create The Shared Command View

**Files:**

- Create: `admin-web/src/pages/store-home-command-view.tsx`

- [ ] **Step 1: Add view component matching the prototype structure**

Create `admin-web/src/pages/store-home-command-view.tsx`:

```tsx
import { ArrowRight, CalendarDays, Clock3, RefreshCcw, Store } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { StoreHomeCommandModel } from './store-home-command-model'

export function StoreHomeCommandView(input: { model: StoreHomeCommandModel; onRefresh?: () => void }) {
  const [selectedId, setSelectedId] = useState(input.model.priorities[0]?.id ?? '')
  const selectedPriority = useMemo(
    () =>
      input.model.priorities.find((priority) => priority.id === selectedId) ??
      input.model.priorities[0] ??
      null,
    [input.model.priorities, selectedId],
  )

  return (
    <section
      aria-labelledby="store-home-ops-title"
      className="store-home-ops"
      data-testid="store-home-command"
    >
      <header className="sh-command-bar">
        <div className="sh-kicker-row" aria-label="Sayfa bağlamı">
          <span className="sh-pill sh-pill-primary">
            <Store size={15} />
            Ana Sayfa
          </span>
          <span className="sh-pill">
            <CalendarDays size={15} />
            {input.model.periodLabel}
          </span>
          <span className="sh-pill">{input.model.personaLabel}</span>
        </div>
        <div className="sh-command-actions">
          <button className="sh-button sh-button-soft" type="button" onClick={input.onRefresh}>
            <RefreshCcw size={16} />
            Yenile
          </button>
          {selectedPriority ? (
            <Link className="sh-button sh-button-primary" to={selectedPriority.href}>
              Önceliğe git
              <ArrowRight size={16} />
            </Link>
          ) : null}
        </div>
      </header>

      <section className="sh-hero">
        <div>
          <h1 id="store-home-ops-title">Günlük Operasyon</h1>
        </div>
        <div className="sh-today-card" aria-label="Günün özeti">
          <Clock3 size={18} />
          <span>Bugün</span>
          <strong>{input.model.todayNote}</strong>
        </div>
      </section>

      <section className="sh-metrics" aria-label="Günlük özet">
        {input.model.metrics.map((metric) => (
          <article className={`sh-metric sh-tone-${metric.tone}`} key={metric.id}>
            <span className="sh-icon" aria-hidden="true">
              {metric.icon}
            </span>
            <div>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.note}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="sh-main-grid">
        <div className="sh-panel sh-priority-panel">
          <div className="sh-section-head">
            <div>
              <h2>Öncelik akışı</h2>
              <p>Modül gezmeden önce dikkat isteyen işler.</p>
            </div>
            <span className="sh-count">{input.model.priorities.length} iş</span>
          </div>

          <div className="sh-filter-row" aria-label="Hızlı filtreler">
            <button className="is-active" type="button">Tümü</button>
            <button type="button">Kritik</button>
            <button type="button">Onay</button>
            <button type="button">Duyuru</button>
          </div>

          <div className="sh-priority-list" role="list">
            {input.model.priorities.map((priority) => {
              const isSelected = priority.id === selectedPriority?.id

              return (
                <button
                  className={`sh-priority-row sh-tone-${priority.tone}${isSelected ? ' is-selected' : ''}`}
                  key={priority.id}
                  onClick={() => setSelectedId(priority.id)}
                  type="button"
                >
                  <span className="sh-source-icon" aria-hidden="true">
                    {priority.icon}
                  </span>
                  <span className="sh-priority-copy">
                    <small>{priority.source}</small>
                    <strong>{priority.title}</strong>
                    <em>{priority.meta}</em>
                  </span>
                  <span className="sh-status">{priority.status}</span>
                </button>
              )
            })}
          </div>
        </div>

        <aside className="sh-panel sh-detail-panel" aria-label="Seçili öncelik">
          {selectedPriority ? (
            <>
              <div className={`sh-detail-hero sh-tone-${selectedPriority.tone}`}>
                <span className="sh-icon" aria-hidden="true">
                  {selectedPriority.icon}
                </span>
                <div>
                  <span>{selectedPriority.source}</span>
                  <h2>{selectedPriority.title}</h2>
                </div>
              </div>
              <p>{selectedPriority.detail}</p>
              <div className="sh-evidence-grid">
                <div>
                  <span>Durum</span>
                  <strong>{selectedPriority.status}</strong>
                </div>
                <div>
                  <span>Zaman</span>
                  <strong>{selectedPriority.meta}</strong>
                </div>
                <div>
                  <span>Bağlı sayfa</span>
                  <strong>{selectedPriority.routeLabel}</strong>
                </div>
              </div>
              <Link className="sh-button sh-button-primary sh-detail-action" to={selectedPriority.href}>
                {selectedPriority.cta}
                <ArrowRight size={16} />
              </Link>
            </>
          ) : (
            <p>Bugün bekleyen iş yok.</p>
          )}
        </aside>
      </section>

      <section className="sh-bottom-grid">
        <div className="sh-panel sh-announcement-panel">
          <div className="sh-section-head">
            <div>
              <h2>Duyurular</h2>
              <p>Sabit ve son gönderiler.</p>
            </div>
            <span className="sh-count">{input.model.announcements.length} görünür</span>
          </div>
          <div className="sh-announcement-list">
            {input.model.announcements.map((announcement) => (
              <article className="sh-announcement" key={announcement.id}>
                <span>{announcement.label}</span>
                <p>{announcement.copy}</p>
                <small>{announcement.time}</small>
              </article>
            ))}
          </div>
        </div>

        <div className="sh-panel sh-links-panel">
          <div className="sh-section-head">
            <div>
              <h2>Hızlı geçiş</h2>
              <p>Detay işi kendi sayfasında tamamlanır.</p>
            </div>
          </div>
          <div className="sh-link-list">
            {input.model.quickLinks.map((link) => (
              <Link className={`sh-link-card sh-tone-${link.tone}`} key={link.id} to={link.href}>
                <span className="sh-icon" aria-hidden="true">
                  {link.icon}
                </span>
                <span>
                  <strong>{link.label}</strong>
                  <small>{link.value}</small>
                </span>
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </section>
  )
}
```

- [ ] **Step 2: Build**

Run:

```powershell
npm.cmd --prefix admin-web run build
```

Expected: PASS. The component is still not wired.

## Task 4: Wire Real Data Into The Command Model

**Files:**

- Modify: `admin-web/src/pages/StoreHomePage.tsx`
- Modify: `admin-web/src/pages/store-home-command-model.ts`

- [ ] **Step 1: Add builder input and mapping functions**

Extend `store-home-command-model.ts` with a pure builder. Use existing icons from the caller so this file stays React-light:

```ts
export type StoreHomeCommandBuilderInput = {
  persona: StorePersona
  personaLabel: string
  identityLabel: string
  periodLabel: string
  storeScopeValue: string
  availablePaths: ReadonlySet<string>
  checklistMetricValue: string | null
  checklistCopy: string | null
  checklistTone: 'attention' | 'ready' | null
  pendingWorkValue: string
  pendingRequestsValue: string | null
  visitPriorityValue: string | null
  visitPriorityCopy: string | null
  readyValue: string
  pendingValue: string
  icons: {
    alert: ReactNode
    arrow: ReactNode
    bell: ReactNode
    checklist: ReactNode
    file: ReactNode
    megaphone: ReactNode
    shield: ReactNode
    store: ReactNode
    target: ReactNode
    trending: ReactNode
    users: ReactNode
    wallet: ReactNode
  }
}

export function buildStoreHomeCommandModel(input: StoreHomeCommandBuilderInput): StoreHomeCommandModel {
  const priorities: StoreHomeCommandPriority[] = []

  if (input.persona === 'regionManager' && input.availablePaths.has('/store/targets')) {
    priorities.push({
      id: 'target-approval',
      source: 'Hedefler',
      title: 'Hedef kararları bekliyor',
      detail: 'Mağaza hedefleri ve personel dağılımları hedefler sayfasında kontrol edilir.',
      meta: input.periodLabel,
      status: input.pendingRequestsValue && input.pendingRequestsValue !== '0' ? 'Karar bekliyor' : 'Hazır',
      cta: 'Hedefleri aç',
      href: '/store/targets',
      routeLabel: 'Hedefler',
      tone: input.pendingRequestsValue && input.pendingRequestsValue !== '0' ? 'amber' : 'mint',
      icon: input.icons.target,
      priority: 10,
    })
  }

  if (input.checklistMetricValue !== null && input.availablePaths.has('/store/checklists')) {
    priorities.push({
      id: 'checklist',
      source: 'Checklist',
      title: input.persona === 'storeManager' ? 'Checklist kabulü' : 'Checklist saha akışı',
      detail: input.checklistCopy ?? 'Checklist işleri kendi sayfasında takip edilir.',
      meta: input.checklistMetricValue,
      status: input.checklistTone === 'attention' ? 'Takip gerekiyor' : 'Hazır',
      cta: 'Checklisti aç',
      href: '/store/checklists',
      routeLabel: 'Checklist',
      tone: input.checklistTone === 'attention' ? 'cyan' : 'mint',
      icon: input.icons.checklist,
      priority: 20,
    })
  }

  if (input.availablePaths.has('/store/tasks') && input.persona !== 'personnel') {
    priorities.push({
      id: 'tasks',
      source: 'Görevler',
      title: 'Açık görevler takipte',
      detail: 'Açık aksiyonlar ve tamamlanan süreçler görevler sayfasında izlenir.',
      meta: input.pendingWorkValue,
      status: countNumeric(input.pendingWorkValue) > 0 ? 'Takipte' : 'Hazır',
      cta: 'Görevleri aç',
      href: '/store/tasks',
      routeLabel: 'Görevler',
      tone: countNumeric(input.pendingWorkValue) > 0 ? 'rose' : 'mint',
      icon: input.icons.bell,
      priority: 30,
    })
  }

  if (input.persona === 'regionManager' && input.availablePaths.has('/store/incentives')) {
    priorities.push({
      id: 'incentives',
      source: 'Primler',
      title: 'Prim paketi kontrol ekranı',
      detail: 'Prim hakedişleri ve dönem kontrolü primler sayfasında okunur.',
      meta: formatStoreHomePeriod(),
      status: 'Kontrol',
      cta: 'Primleri aç',
      href: '/store/incentives',
      routeLabel: 'Primler',
      tone: 'plum',
      icon: input.icons.wallet,
      priority: 40,
    })
  }

  if ((input.persona === 'regionManager' || input.persona === 'storeManager') && input.availablePaths.has('/store/workforce')) {
    priorities.push({
      id: 'workforce',
      source: 'Norm Kadro',
      title: 'Norm kadro görünümü',
      detail: 'Aktif personel, norm dengesi ve eksik süreleri norm kadro sayfasında izlenir.',
      meta: input.storeScopeValue,
      status: 'İzle',
      cta: 'Norm kadroyu aç',
      href: '/store/workforce',
      routeLabel: 'Norm Kadro',
      tone: 'amber',
      icon: input.icons.users,
      priority: 50,
    })
  }

  if (input.persona === 'personnel' && input.availablePaths.has('/store/me')) {
    priorities.push({
      id: 'performance',
      source: 'Benim Performansım',
      title: 'Kişisel performansını takip et',
      detail: 'KPI, sıralama ve kişisel performans detayları kendi sayfasında görünür.',
      meta: 'KPI',
      status: 'Hazır',
      cta: 'Performansı aç',
      href: '/store/me',
      routeLabel: 'Benim Performansım',
      tone: 'cyan',
      icon: input.icons.trending,
      priority: 10,
    })
  }

  const sortedPriorities = priorities.toSorted((left, right) => left.priority - right.priority)
  const criticalCount = sortedPriorities.filter((priority) => ['rose', 'amber'].includes(priority.tone)).length
  const checklistCount = input.checklistMetricValue ?? input.pendingValue

  return {
    persona: input.persona,
    personaLabel: input.personaLabel,
    identityLabel: input.identityLabel,
    periodLabel: formatStoreHomePeriod(),
    todayTitle: 'Bugün',
    todayNote: sortedPriorities[0]?.title ?? 'Bugün bekleyen iş yok',
    metrics: [
      {
        id: 'urgent',
        label: 'Acil iş',
        value: String(criticalCount),
        note: 'Bugün karar bekliyor',
        tone: criticalCount > 0 ? 'rose' : 'mint',
        icon: input.icons.alert,
      },
      {
        id: 'pending',
        label: 'Onay bekleyen',
        value: input.pendingRequestsValue ?? '0',
        note: 'Hedef ve checklist',
        tone: countNumeric(input.pendingRequestsValue) > 0 ? 'amber' : 'mint',
        icon: input.icons.shield,
      },
      {
        id: 'stores',
        label: input.persona === 'regionManager' ? 'Takipte mağaza' : 'Yetkili mağaza',
        value: input.persona === 'regionManager' ? (input.visitPriorityValue ?? input.storeScopeValue) : input.storeScopeValue,
        note: input.persona === 'regionManager' ? 'Bölge portföyü' : 'Mağaza kapsamı',
        tone: 'cyan',
        icon: input.icons.store,
      },
      {
        id: 'feed',
        label: 'Duyurular',
        value: input.availablePaths.has('/store/feed') ? 'Hazır' : 'Yok',
        note: 'Sabit ve son gönderiler',
        tone: 'plum',
        icon: input.icons.megaphone,
      },
    ],
    priorities: sortedPriorities,
    announcements: input.availablePaths.has('/store/feed')
      ? [
          {
            id: 'feed-entry',
            label: 'Duyuru',
            copy: 'Duyurular sayfasında sabit ve son gönderiler görünür.',
            time: 'Bugün',
          },
        ]
      : [],
    quickLinks: [
      input.availablePaths.has('/store/kpis')
        ? { id: 'kpis', label: 'KPI özetleri', value: input.readyValue, href: '/store/kpis', icon: input.icons.trending, tone: 'cyan' }
        : null,
      input.availablePaths.has('/store/reports')
        ? { id: 'reports', label: 'Raporlar', value: input.readyValue, href: '/store/reports', icon: input.icons.file, tone: 'mint' }
        : null,
      input.availablePaths.has('/store/feed')
        ? { id: 'feed', label: 'Duyurular', value: 'Aç', href: '/store/feed', icon: input.icons.megaphone, tone: 'plum' }
        : null,
    ].filter((item): item is StoreHomeCommandQuickLink => item !== null),
  }
}
```

- [ ] **Step 2: Wire StoreHomePage to the model**

In `StoreHomePage.tsx`, import:

```ts
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  ClipboardCheck,
  FileText,
  Megaphone,
  ShieldCheck,
  Store,
  Target,
  TrendingUp,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import { StoreHomeCommandView } from './store-home-command-view'
import { buildStoreHomeCommandModel } from './store-home-command-model'
import { resolveUserDisplayLabel } from '../lib/display-labels'
import { getStorePersonaLabelKey } from '../app/store-navigation'
import { useQueryClient } from '@tanstack/react-query'
```

Build the model after existing query/model calculations:

```tsx
const queryClient = useQueryClient()
const personaLabel = t(getStorePersonaLabelKey(persona))
const identityLabel = resolveUserDisplayLabel(input.authSummary?.user, personaLabel)
const commandModel = buildStoreHomeCommandModel({
  persona,
  personaLabel,
  identityLabel,
  periodLabel: new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' }).format(new Date()),
  storeScopeValue,
  availablePaths,
  checklistMetricValue: checklistSummary?.metricValue ?? null,
  checklistCopy: checklistSummary?.copy ?? null,
  checklistTone: checklistSummary?.tone ?? null,
  pendingWorkValue,
  pendingRequestsValue,
  visitPriorityValue: visitPrioritySummary?.value ?? null,
  visitPriorityCopy: visitPrioritySummary?.copy ?? null,
  readyValue,
  pendingValue,
  icons: {
    alert: <AlertTriangle size={20} />,
    arrow: <ArrowRight size={20} />,
    bell: <Bell size={20} />,
    checklist: <ClipboardCheck size={20} />,
    file: <FileText size={20} />,
    megaphone: <Megaphone size={20} />,
    shield: <ShieldCheck size={20} />,
    store: <Store size={20} />,
    target: <Target size={20} />,
    trending: <TrendingUp size={20} />,
    users: <UsersRound size={20} />,
    wallet: <WalletCards size={20} />,
  },
})
const refreshHome = () => {
  void queryClient.invalidateQueries({ queryKey: ['checklist-acknowledgements'] })
  void queryClient.invalidateQueries({ queryKey: ['mobile-checklists-today'] })
  void queryClient.invalidateQueries({ queryKey: ['workflow-inbox'] })
}
```

Replace the old `return (` block with:

```tsx
return <StoreHomeCommandView model={commandModel} onRefresh={refreshHome} />
```

- [ ] **Step 3: Run focused tests**

Run:

```powershell
npm.cmd --prefix admin-web run test:e2e -- store-home-command.spec.ts
```

Expected: The first test should move from missing-surface failure to either PASS or a precise copy/role mismatch.

## Task 5: Productionize CSS And Shell Width

**Files:**

- Create: `admin-web/src/styles/store-home-command.css`
- Modify: `admin-web/src/styles/store-home-me-prototypes.css`
- Modify: `admin-web/src/index.css`
- Modify: `admin-web/src/app/store-shell.tsx`

- [ ] **Step 1: Add home route shell class**

In `store-shell.tsx`, add:

```ts
const storeHomeRoute = activeStoreRoute?.id === 'home'
```

Then include it in the shell class:

```tsx
className={`store-shell store-command-app${
  storeHomeRoute ? ' store-shell-store-home' : ''
}${storeMeRoute || storePersonnelRoute ? ' store-shell-store-me' : ''}${
  checklistOnlyRoute ? ' store-shell-store-checklists' : ''
}${storeIncentivesRoute ? ' store-shell-store-incentives' : ''}${
  storeFeedRoute ? ' store-shell-store-feed' : ''
}`}
```

- [ ] **Step 2: Create production CSS**

Move the `.store-home-ops` and `.sh-*` block from `store-home-me-prototypes.css` into `admin-web/src/styles/store-home-command.css`.

At the top of the new file add:

```css
.store-shell-store-home .store-command-main {
  width: min(1320px, calc(100vw - var(--store-command-sidebar) - 44px));
}

.store-home-ops {
  display: grid;
  gap: 16px;
  color: var(--store-command-ink);
}
```

Use existing Store Command variables for color. Do not add raw hex colors. Convert any prototype `#fff` usage to `rgb(255 255 255)`.

- [ ] **Step 3: Import production CSS**

In `admin-web/src/index.css`, add after `store-command-shell.css`:

```css
@import './styles/store-home-command.css';
```

Keep the prototype CSS import for Store Me until that surface is separately cleaned:

```css
@import './styles/store-home-me-prototypes.css';
```

- [ ] **Step 4: Run CSS and build gates**

Run:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
```

Expected: PASS. No global CSS parse or TypeScript errors.

## Task 6: Make Prototype Route Reuse Production View

**Files:**

- Modify: `admin-web/src/prototypes/store-home-command-v1.tsx`

- [ ] **Step 1: Replace duplicate JSX with shared view**

Keep the `StorePrototypeCommandShell`, but make the child render `StoreHomeCommandView` with a static model.

The prototype file should import:

```ts
import { StoreHomeCommandView } from '../pages/store-home-command-view'
import type { StoreHomeCommandModel } from '../pages/store-home-command-model'
```

Then define:

```tsx
const prototypeModel: StoreHomeCommandModel = {
  persona: 'regionManager',
  personaLabel: 'Bölge müdürü',
  identityLabel: 'Onur Kaytan Bölgesi',
  periodLabel: 'Haziran 2026',
  todayTitle: 'Bugün',
  todayNote: 'Önce hedef kararı',
  metrics: [
    { id: 'urgent', label: 'Acil iş', value: '4', note: 'Bugün karar bekliyor', tone: 'rose', icon: <AlertTriangle size={20} /> },
    { id: 'pending', label: 'Onay bekleyen', value: '6', note: 'Hedef ve checklist', tone: 'amber', icon: <ShieldCheck size={20} /> },
    { id: 'stores', label: 'Takipte mağaza', value: '9', note: 'Bölge portföyü', tone: 'cyan', icon: <Store size={20} /> },
    { id: 'feed', label: 'Duyurular', value: '3', note: '1 sabit gönderi', tone: 'plum', icon: <Megaphone size={20} /> },
  ],
  priorities: [
    {
      id: 'target-approval',
      source: 'Hedefler',
      title: 'Balıkesir 10 Burda AVM hedef kararı bekliyor',
      detail: 'Mağaza hedef dağılımı gönderildi. Personel dağılımı dengeli görünüyor; karar aynı pencerede verilebilir.',
      meta: 'Mayıs 2026 · 4 personel',
      status: 'Karar bekliyor',
      cta: 'Hedefleri aç',
      href: '/store/targets',
      routeLabel: 'Hedefler',
      tone: 'amber',
      icon: <Target size={20} />,
      priority: 10,
    },
  ],
  announcements: [
    { id: 'pinned-weekend', label: 'Sabit', copy: 'Hafta sonu ürün odağı: yeni sezon giriş alanı ve kasa önü aksesuar düzeni.', time: 'Bugün 09:10' },
  ],
  quickLinks: [
    { id: 'kpis', label: 'KPI özetleri', value: '3 sinyal', href: '/store/kpis', icon: <TrendingUp size={20} />, tone: 'cyan' },
    { id: 'reports', label: 'Raporlar', value: 'Hazır', href: '/store/reports?prototype=command-v1', icon: <FileText size={20} />, tone: 'mint' },
    { id: 'feed', label: 'Duyurular', value: '3 yeni', href: '/store/feed', icon: <Megaphone size={20} />, tone: 'plum' },
  ],
}
```

Keep all five approved prototype priority rows in the static prototype model: `target-approval`, `checklist-acceptance`, `task-followup`, `incentive-review`, and `workforce-gap`. Production may show fewer rows only when role-aware navigation removes the corresponding route.

Render:

```tsx
export function StoreHomeCommandV1Prototype() {
  return (
    <StorePrototypeCommandShell
      activePath="/store/home"
      identityLabel="Onur Kaytan Bölgesi"
      personaLabel="Bölge müdürü"
      subtitle="Günlük operasyon"
    >
      <StoreHomeCommandView model={prototypeModel} />
    </StorePrototypeCommandShell>
  )
}
```

- [ ] **Step 2: Check prototype URL**

Run dev server if needed:

```powershell
npm.cmd --prefix admin-web run dev -- --host 127.0.0.1 --port 5190
```

Open:

```text
http://127.0.0.1:5190/store/home?prototype=command-v1
```

Expected: The prototype still renders the same visual surface.

## Task 7: Copy And Role Matrix Cleanup

**Files:**

- Modify: `admin-web/src/features/localization/messages/store-home.ts`
- Modify: `admin-web/src/pages/store-home-command-model.ts`

- [ ] **Step 1: Remove old visible production copy from the new surface**

The production `/store/home` must not show these old dashboard phrases:

```text
Mağaza Yönetim Paneli
Bölge ana ekranı hazır.
Mağaza özet dashboard
Bölge özet dashboard
Rolüne bağlı mağaza sayısı
Gerçek veri
scope
API
DB
```

Do not delete keys unless unused; just make sure the new surface does not render them.

- [ ] **Step 2: Keep role-aware visibility**

Apply these rules in the builder:

```ts
// Region Manager
// Can see portfolio-level priorities for targets, checklist, KPI, reports, workforce, incentives if nav allows.

// Store Manager
// Can see own-store tasks, checklist acknowledgement, approvals, KPI, feed, incentives only if nav allows.

// Store Personnel
// Can see personal performance, ranking, feed. No target approval, incentive package approval, workforce, or manager-only tasks.

// Visual Merchandiser
// Can see checklist and feed only when nav allows. Existing StoreShell VM-only redirect behavior remains unchanged.
```

- [ ] **Step 3: Run role e2e**

Run:

```powershell
npm.cmd --prefix admin-web run test:e2e -- store-home-command.spec.ts
```

Expected: PASS for region manager, store manager, and store personnel checks.

## Task 8: Visual And Regression Verification

**Files:**

- Modify if needed: `admin-web/e2e/store-home-command.spec.ts`
- Do not modify production code unless verification finds a concrete issue.

- [ ] **Step 1: Run existing Store Home focused regression tests**

Run:

```powershell
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store home"
```

Expected: Existing Store Home behavior still passes or failures are updated only when assertions reference intentionally retired old dashboard structure.

- [ ] **Step 2: Run new command spec**

Run:

```powershell
npm.cmd --prefix admin-web run test:e2e -- store-home-command.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Run frontend gates**

Run:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
```

Expected: PASS.

- [ ] **Step 4: Run repo guards**

Run:

```powershell
npm.cmd run test:scripts
git diff --check
```

Expected: PASS. If file-size guard fails, split the affected file instead of raising a baseline for this UI-only work.

- [ ] **Step 5: Browser visual parity check**

Use local dev or preview. Check:

```text
/store/home?prototype=command-v1
/store/home
```

Desktop viewport:

```text
1440 x 900
```

Mobile viewport:

```text
390 x 844
```

Expected:

- Both production and prototype show `Günlük Operasyon`.
- Four metric cards are aligned and have centered icons.
- Priority list + selected detail panel match the prototype rhythm.
- Announcements and quick links sit below with the same density.
- No horizontal overflow.
- Store sidebar/header remains production shell, not the prototype-only static nav.

## Task 9: PR Closeout

**Files:**

- Create if screenshots/evidence are captured: `docs/evidence/store-home-command-v1-production-2026-06-29.md`

- [ ] **Step 1: Record parity evidence**

Create evidence only if screenshots or browser checks were actually run. The evidence must say:

```markdown
# Store Home Command V1 Production Evidence

## Scope

Moved approved `/store/home?prototype=command-v1` into production `/store/home`.

## Verification

- `npm.cmd --prefix admin-web run test:e2e -- store-home-command.spec.ts`
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store home"`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd run test:scripts`
- `git diff --check`

## Prototype Parity

Prototype parity: PASS

Desktop and mobile visual inspection confirmed material parity between the approved prototype and production route.

## Intentional Differences

- Production uses the real Store shell/sidebar and role-aware nav.
- Production values come from current auth/query state and may differ from static prototype numbers.
- Prototype helper route remains dev-only.
```

- [ ] **Step 2: Open PR**

Commit:

```powershell
git add admin-web/src/pages/StoreHomePage.tsx admin-web/src/pages/store-home-command-model.ts admin-web/src/pages/store-home-command-view.tsx admin-web/src/styles/store-home-command.css admin-web/src/styles/store-home-me-prototypes.css admin-web/src/index.css admin-web/src/app/store-shell.tsx admin-web/src/prototypes/store-home-command-v1.tsx admin-web/src/features/localization/messages/store-home.ts admin-web/e2e/store-home-command.spec.ts docs/evidence/store-home-command-v1-production-2026-06-29.md
git commit -m "Implement store home command surface"
git push -u origin codex/store-home-command-v1-production
gh pr create --fill --base main --head codex/store-home-command-v1-production
```

PR description must include:

```markdown
## Summary
- Moved the approved Store Home command prototype into production `/store/home`.
- Kept Store shell/auth/role-aware navigation unchanged.
- Reused the production command view from the dev prototype route to prevent future drift.

## Verification
- [ ] `npm.cmd --prefix admin-web run test:e2e -- store-home-command.spec.ts`
- [ ] `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store home"`
- [ ] `npm.cmd --prefix admin-web run lint`
- [ ] `npm.cmd --prefix admin-web run build`
- [ ] `npm.cmd run test:scripts`
- [ ] `git diff --check`

## Prototype parity
Prototype parity: PASS
```

## Self Review

Spec coverage:

- Approved prototype visible structure is covered by Tasks 3, 5, 6, and 8.
- Existing production data/role behavior is covered by Tasks 2, 4, and 7.
- No backend/API/DB changes are included.
- Old UI replacement is explicit in Task 4.
- Mobile/desktop parity is explicit in Task 8.

Placeholder scan:

- No placeholders or unbounded deferred scope remain.
- The only allowed parked behavior is real feed summary count, because no Store Home feed summary query is currently in the accepted scope. The UI must show route availability instead of fake counts.

Type consistency:

- `StoreHomeCommandModel`, `StoreHomeCommandMetric`, `StoreHomeCommandPriority`, `StoreHomeCommandAnnouncement`, and `StoreHomeCommandQuickLink` are defined before use.
- View consumes only `StoreHomeCommandModel`.
- Builder is pure and does not import route/query code.

Risk notes:

- The largest risk is accidentally keeping the old `StoreSurface*` production markup. Definition of done requires it to be removed from the visible `/store/home` route.
- The second risk is fake counts for announcements or priorities. If a count cannot be derived from existing data, use `Hazır`, `Aç`, or `Bekliyor`, not invented numbers.
- The third risk is prototype drift. The dev prototype route must reuse `StoreHomeCommandView`.
