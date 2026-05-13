# Admin Shell Command UI V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy admin outer shell with the same production-grade command UI model now used by the store side, without redesigning admin page internals.

**Architecture:** Keep existing admin routes, guards, lazy loaders, and page components intact. Introduce a focused admin sidebar component and admin command shell CSS that wraps current admin pages with a fixed collapsible left rail, LUFIAN branding, bottom identity/settings actions, and shared route transition/recovery behavior.

**Tech Stack:** Vite, React, React Router, TypeScript, lucide-react, Playwright, existing localization dictionary.

---

## Scope Boundary

This plan changes only admin chrome and navigation behavior:

- Fixed/collapsible admin sidebar.
- Admin shell page frame, background, spacing, and responsive behavior.
- Route transition/loading/recovery copy and tests.
- Admin shell localization strings.
- E2E coverage proving old admin chrome is gone.

This plan does not redesign admin page contents:

- `/admin/inbox` inner request cards stay as-is.
- `/admin/targets` inner approval queue stays as-is.
- `/admin/kpi-config`, `/admin/reports`, `/admin/master-data`, `/admin/integrations` page internals stay as-is.
- Backend, DB, migrations, API contracts stay untouched.

## File Structure

- Create `admin-web/src/app/admin-sidebar.tsx`
  - Admin-specific version of `StoreSidebar`.
  - Uses `adminNavDefinitions` and `allowedAdminNav`.
  - Handles collapse button, LUFIAN brand, route preloading, utility links, profile/settings footer.

- Modify `admin-web/src/app/admin-shell.tsx`
  - Replace legacy `.app-shell`, `.sidebar`, `.main-panel`, `.topbar`, `.shell-context-panel` chrome.
  - Keep route definitions exactly where possible.
  - Keep `AdminRouteGuard`, `SessionGate`, `RouteTransitionFrame`, and `RouteRecoveryBoundary`.

- Modify `admin-web/src/app/admin-navigation.ts`
  - Add stable `id` and `utility` metadata if needed for sidebar grouping.
  - Preserve role filtering behavior.

- Modify `admin-web/src/features/localization/messages/admin-shell.ts`
  - Replace old marketing/admin shell copy with concise shell labels.
  - Keep route loading/error keys because shared route components consume them.

- Modify `admin-web/src/index.css`
  - Add `.admin-command-*` shell classes.
  - Reuse the store command palette direction, but keep admin distinct enough for control-center use.
  - Do not remove old `.app-shell` styles in this slice unless no test depends on them elsewhere.

- Modify `admin-web/e2e/admin-routing.spec.ts`
  - Update shell chrome tests to assert the new admin sidebar and absence of old shell copy.
  - Add collapse/expand behavior coverage.
  - Add route transition/recovery smoke where stable.

- Optionally modify `admin-web/e2e/admin-inbox.spec.ts`
  - Only if admin shell copy assertions break because the outer shell changed.

## Visual Contract

Admin shell should feel related to the store shell, not identical:

- Brand: LUFIAN logo in the upper-left rail.
- Sidebar: fixed left rail, collapsible, icon-first, low text noise.
- Main: full working surface with subtle grid/light command background.
- Top contextual admin chips should become compact shell meta, not a large explanation block.
- Bottom profile: user/session identity. Settings/session access lives here, not as a loud top panel.
- Utility links: `Store Preview` and `Real Login` should be visually secondary, either footer utilities or profile menu actions.
- Route transitions: same fast transition frame, no stuck "surface could not open" state when changing away.

## Task 1: Add Admin Sidebar Component

**Files:**
- Create: `admin-web/src/app/admin-sidebar.tsx`
- Modify: `admin-web/src/app/admin-navigation.ts`
- Test: `admin-web/e2e/admin-routing.spec.ts`

- [ ] **Step 1: Extend admin navigation metadata**

Modify `admin-web/src/app/admin-navigation.ts` so each nav item has a stable `id`.

```ts
export type AdminNavIconId =
  | 'audit'
  | 'auth'
  | 'checklists'
  | 'competitions'
  | 'feed'
  | 'inbox'
  | 'integrations'
  | 'kpiConfig'
  | 'masterData'
  | 'reports'
  | 'session'
  | 'snapshots'
  | 'targets'

export type NavDefinition = {
  id: AdminNavIconId
  to: string
  icon: LucideIcon
  labelKey: TranslationKey
  roles?: string[]
}
```

Then add `id` to every item, for example:

```ts
{
  id: 'integrations',
  to: '/admin/integrations',
  icon: DatabaseZap,
  labelKey: 'adminShell.nav.integrations',
  roles: ['SUPER_ADMIN', 'INTEGRATION_ADMIN'],
}
```

- [ ] **Step 2: Create admin sidebar**

Create `admin-web/src/app/admin-sidebar.tsx`:

```tsx
import { KeyRound, LogIn, PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import lufianLogoUrl from '../assets/lufian-logo.png'
import type { AuthSessionSummary } from '../features/auth/api'
import { formatDisplayRoles } from '../features/auth/display'
import { useLocalization } from '../features/localization/useLocalization'
import { preloadRouteModule } from './route-preloaders'
import type { NavDefinition } from './admin-navigation'

function getAdminInitials(authSummary: AuthSessionSummary | null) {
  const userId = authSummary?.user.userId?.trim() || 'ADMIN'
  return userId
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function AdminSidebar(input: {
  allowedAdminNav: NavDefinition[]
  authSummary: AuthSessionSummary | null
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}) {
  const { t } = useLocalization()
  const ToggleIcon = input.collapsed ? PanelLeftOpen : PanelLeftClose
  const roleSummary = formatDisplayRoles(input.authSummary?.user.roleCodes, t('adminShell.noResolvedRoles'))

  return (
    <aside className="admin-command-sidebar" aria-label={t('adminShell.primaryNavigation')}>
      <div className="admin-command-brand">
        <span className="admin-command-brand-logo" aria-hidden="true">
          <img src={lufianLogoUrl} alt="" />
        </span>
        <span className="admin-command-brand-text">
          <strong>LUFIAN</strong>
          <small>{t('adminShell.adminWorkspace')}</small>
        </span>
      </div>

      <button
        aria-expanded={!input.collapsed}
        className="admin-command-sidebar-toggle"
        type="button"
        onClick={() => input.onCollapsedChange(!input.collapsed)}
      >
        <ToggleIcon aria-hidden="true" size={18} />
        <span>{input.collapsed ? t('adminShell.sidebar.expand') : t('adminShell.sidebar.collapse')}</span>
      </button>

      <nav className="admin-command-nav" aria-label={t('adminShell.primaryNavigation')}>
        {input.allowedAdminNav.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              className={({ isActive }) =>
                `admin-command-nav-link${isActive ? ' admin-command-nav-link-active' : ''}`
              }
              key={item.to}
              onFocus={() => preloadRouteModule(item.to)}
              onPointerDown={() => preloadRouteModule(item.to)}
              onPointerEnter={() => preloadRouteModule(item.to)}
              title={t(item.labelKey)}
              to={item.to}
            >
              <span className="admin-command-nav-icon" aria-hidden="true">
                <Icon size={19} />
              </span>
              <span className="admin-command-nav-label">{t(item.labelKey)}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="admin-command-sidebar-footer">
        <div className="admin-command-identity">
          <span className="admin-command-avatar" aria-hidden="true">
            {getAdminInitials(input.authSummary)}
          </span>
          <span className="admin-command-identity-text">
            <strong>{input.authSummary?.user.userId ?? t('adminShell.sessionUser')}</strong>
            <small>{roleSummary}</small>
          </span>
        </div>
        <div className="admin-command-utility-links">
          <NavLink
            className="admin-command-utility-link"
            onFocus={() => preloadRouteModule('/admin/session')}
            onPointerDown={() => preloadRouteModule('/admin/session')}
            onPointerEnter={() => preloadRouteModule('/admin/session')}
            title={t('adminShell.nav.session')}
            to="/admin/session"
          >
            <Settings aria-hidden="true" size={17} />
            <span>{t('adminShell.nav.session')}</span>
          </NavLink>
          <NavLink className="admin-command-utility-link" title={t('adminShell.nav.storePreview')} to="/store">
            <KeyRound aria-hidden="true" size={17} />
            <span>{t('adminShell.nav.storePreview')}</span>
          </NavLink>
          <NavLink className="admin-command-utility-link" title={t('adminShell.nav.realLogin')} to="/auth/login">
            <LogIn aria-hidden="true" size={17} />
            <span>{t('adminShell.nav.realLogin')}</span>
          </NavLink>
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Write failing sidebar shell test**

In `admin-web/e2e/admin-routing.spec.ts`, add or update a test:

```ts
test('admin shell uses LUFIAN command sidebar and hides legacy explainer chrome', async ({ page }) => {
  await page.goto('/admin/audit')

  await expect(page.locator('.admin-command-sidebar')).toBeVisible()
  await expect(page.locator('.admin-command-brand').getByText('LUFIAN')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Birincil' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Denetim' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Oturum' })).toBeVisible()
  await expect(page.getByText('Kapsamlı operatörler')).toHaveCount(0)
  await expect(page.getByText('Kabuk kullanıcıyı neden buraya yönlendiriyor')).toHaveCount(0)
  await expect(page.locator('.shell-context-panel')).toHaveCount(0)
})
```

Expected before implementation: fails because `.admin-command-sidebar` does not exist.

- [ ] **Step 4: Run the focused test**

Run:

```powershell
npm.cmd --prefix admin-web run test:e2e -- admin-routing.spec.ts --grep "admin shell uses LUFIAN command sidebar"
```

Expected: FAIL before `AdminShell` uses the new component; PASS after Task 2.

## Task 2: Replace Legacy Admin Shell Frame

**Files:**
- Modify: `admin-web/src/app/admin-shell.tsx`
- Modify: `admin-web/src/features/localization/messages/admin-shell.ts`
- Test: `admin-web/e2e/admin-routing.spec.ts`

- [ ] **Step 1: Add local collapsed state**

In `admin-web/src/app/admin-shell.tsx`, change the React import:

```ts
import { Suspense, useState, type ReactNode } from 'react'
```

Import the new sidebar:

```ts
import { AdminSidebar } from './admin-sidebar'
```

Inside `AdminShell`, add:

```ts
const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
```

- [ ] **Step 2: Replace outer JSX**

Replace the legacy top-level wrapper:

```tsx
return (
  <div className={`admin-command-app${isSidebarCollapsed ? ' admin-command-app-collapsed' : ''}`}>
    <AdminSidebar
      allowedAdminNav={input.allowedAdminNav}
      authSummary={input.authSummary}
      collapsed={isSidebarCollapsed}
      onCollapsedChange={setIsSidebarCollapsed}
    />

    <main className="admin-command-main" aria-label={t('adminShell.adminWorkspaceAria')}>
      <RouteTransitionFrame>
        <RouteRecoveryBoundary firstAllowedPath={input.firstAllowedPath}>
          <Suspense fallback={<RouteLoadingState />}>
            <Routes>
              {/* keep existing Route list unchanged */}
            </Routes>
          </Suspense>
        </RouteRecoveryBoundary>
      </RouteTransitionFrame>
    </main>
  </div>
)
```

Delete the old admin-only outer chrome in the same file:

- `.brand-block`
- `.sidebar-note`
- `.topbar`
- `.topbar-cluster`
- `.shell-context-panel`
- `KeyValue` usage
- `StatusPill` usage
- `formatAdminShellAuthState` usage
- `formatAdminShellSessionMode` usage
- `formatAdminShellState` usage
- `scopeSummary` and `roleSummary` local variables if no longer used by `AdminShell`

Keep route guard behavior unchanged.

- [ ] **Step 3: Add concise localization keys**

In `admin-web/src/features/localization/messages/admin-shell.ts`, add Turkish keys:

```ts
'adminShell.adminWorkspace': 'Admin',
'adminShell.adminWorkspaceAria': 'Admin çalışma alanı',
'adminShell.sessionUser': 'Admin kullanıcı',
'adminShell.sidebar.expand': 'Menüyü genişlet',
'adminShell.sidebar.collapse': 'Menüyü daralt',
```

Add English equivalents:

```ts
'adminShell.adminWorkspace': 'Admin',
'adminShell.adminWorkspaceAria': 'Admin workspace',
'adminShell.sessionUser': 'Admin user',
'adminShell.sidebar.expand': 'Expand menu',
'adminShell.sidebar.collapse': 'Collapse menu',
```

- [ ] **Step 4: Keep route state copy but stop asserting old shell copy**

Update admin shell localization tests so they assert navigation and language switching, not old explanatory topbar text.

Use this pattern:

```ts
await expect(page.locator('.admin-command-brand').getByText('LUFIAN')).toBeVisible()
await expect(page.getByRole('link', { name: 'Entegrasyonlar' })).toBeVisible()
await expect(page.getByRole('link', { name: 'Ana Veri' })).toBeVisible()
await expect(page.getByRole('link', { name: 'Denetim' })).toBeVisible()
await expect(page.getByText('Üretim UX ve gerçek kimlik')).toHaveCount(0)
```

- [ ] **Step 5: Run shell routing tests**

Run:

```powershell
npm.cmd --prefix admin-web run test:e2e -- admin-routing.spec.ts
```

Expected: PASS.

## Task 3: Add Admin Command Shell Styling

**Files:**
- Modify: `admin-web/src/index.css`
- Test: `admin-web/e2e/admin-routing.spec.ts`

- [ ] **Step 1: Add admin shell CSS variables and layout**

Append near the store command shell styles in `admin-web/src/index.css`:

```css
.admin-command-app {
  --admin-command-sidebar: 224px;
  --admin-command-sidebar-collapsed: 74px;
  --admin-command-bg: #f8f5fb;
  --admin-command-bg-2: #edf7f6;
  --admin-command-ink: #171421;
  --admin-command-muted: #6c6478;
  --admin-command-line: rgba(36, 28, 50, 0.1);
  --admin-command-line-strong: rgba(36, 28, 50, 0.18);
  --admin-command-surface: rgba(255, 255, 255, 0.84);
  --admin-command-plum: #734ce8;
  --admin-command-cyan: #10a9b7;
  --admin-command-shadow: 0 24px 80px rgba(32, 24, 48, 0.12);
  min-height: 100vh;
  padding-left: var(--admin-command-sidebar);
  color: var(--admin-command-ink);
  background:
    linear-gradient(rgba(54, 44, 76, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(54, 44, 76, 0.045) 1px, transparent 1px),
    radial-gradient(circle at 14% 12%, rgba(115, 76, 232, 0.13), transparent 34%),
    radial-gradient(circle at 88% 8%, rgba(16, 169, 183, 0.13), transparent 32%),
    linear-gradient(135deg, var(--admin-command-bg) 0%, #fbfcff 48%, var(--admin-command-bg-2) 100%);
  background-size: 28px 28px, 28px 28px, auto, auto, auto;
}

.admin-command-app-collapsed {
  padding-left: var(--admin-command-sidebar-collapsed);
}

.admin-command-main {
  width: min(1220px, calc(100vw - var(--admin-command-sidebar) - 44px));
  min-height: 100vh;
  margin: 0 auto;
  padding: 28px 22px 42px;
}

.admin-command-app-collapsed .admin-command-main {
  width: min(1260px, calc(100vw - var(--admin-command-sidebar-collapsed) - 44px));
}
```

- [ ] **Step 2: Add sidebar styling**

Add:

```css
.admin-command-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 40;
  display: flex;
  width: var(--admin-command-sidebar);
  flex-direction: column;
  gap: 14px;
  border-right: 1px solid var(--admin-command-line);
  background: rgba(255, 255, 255, 0.78);
  padding: 18px 14px;
  box-shadow: 14px 0 50px rgba(30, 24, 46, 0.08);
  backdrop-filter: blur(22px);
  transition: width 180ms ease;
}

.admin-command-app-collapsed .admin-command-sidebar {
  width: var(--admin-command-sidebar-collapsed);
}

.admin-command-brand,
.admin-command-sidebar-toggle,
.admin-command-nav-link,
.admin-command-utility-link,
.admin-command-identity {
  display: flex;
  align-items: center;
  gap: 10px;
}

.admin-command-brand-logo {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  place-items: center;
  overflow: hidden;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 14px 30px rgba(32, 24, 48, 0.12);
}

.admin-command-brand-logo img {
  width: 34px;
  height: 34px;
  object-fit: contain;
}

.admin-command-brand-text,
.admin-command-nav-label,
.admin-command-identity-text,
.admin-command-utility-link span,
.admin-command-sidebar-toggle span {
  min-width: 0;
  transition: opacity 150ms ease, width 150ms ease;
}

.admin-command-brand-text strong,
.admin-command-identity-text strong {
  display: block;
  font-size: 0.78rem;
  letter-spacing: 0;
}

.admin-command-brand-text small,
.admin-command-identity-text small {
  display: block;
  overflow: hidden;
  color: var(--admin-command-muted);
  font-size: 0.68rem;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-command-sidebar-toggle,
.admin-command-nav-link,
.admin-command-utility-link {
  min-height: 42px;
  border: 1px solid transparent;
  border-radius: 14px;
  background: transparent;
  color: var(--admin-command-muted);
  font: inherit;
  text-decoration: none;
}

.admin-command-sidebar-toggle {
  cursor: pointer;
  justify-content: center;
}

.admin-command-nav {
  display: grid;
  gap: 5px;
  overflow: auto;
  padding: 2px 0;
}

.admin-command-nav-link {
  padding: 0 11px;
}

.admin-command-nav-link:hover,
.admin-command-nav-link:focus-visible,
.admin-command-utility-link:hover,
.admin-command-utility-link:focus-visible,
.admin-command-sidebar-toggle:hover,
.admin-command-sidebar-toggle:focus-visible {
  border-color: var(--admin-command-line-strong);
  color: var(--admin-command-ink);
  outline: none;
}

.admin-command-nav-link-active {
  border-color: transparent;
  background: linear-gradient(135deg, var(--admin-command-plum), #3765ea 60%, var(--admin-command-cyan));
  color: #fff;
  box-shadow: 0 14px 30px rgba(77, 70, 229, 0.22);
}

.admin-command-nav-icon {
  display: grid;
  width: 24px;
  flex: 0 0 24px;
  place-items: center;
}

.admin-command-sidebar-footer {
  display: grid;
  gap: 9px;
  margin-top: auto;
}

.admin-command-identity {
  min-height: 54px;
  border: 1px solid var(--admin-command-line);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.78);
  padding: 8px;
}

.admin-command-avatar {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  place-items: center;
  border-radius: 12px;
  background: linear-gradient(135deg, #1b1531, var(--admin-command-plum));
  color: #fff;
  font-size: 0.74rem;
  font-weight: 900;
}

.admin-command-utility-links {
  display: grid;
  gap: 5px;
}

.admin-command-utility-link {
  padding: 0 10px;
}

.admin-command-app-collapsed .admin-command-brand-text,
.admin-command-app-collapsed .admin-command-nav-label,
.admin-command-app-collapsed .admin-command-identity-text,
.admin-command-app-collapsed .admin-command-utility-link span,
.admin-command-app-collapsed .admin-command-sidebar-toggle span {
  width: 0;
  opacity: 0;
  overflow: hidden;
}

.admin-command-app-collapsed .admin-command-brand,
.admin-command-app-collapsed .admin-command-nav-link,
.admin-command-app-collapsed .admin-command-utility-link,
.admin-command-app-collapsed .admin-command-identity {
  justify-content: center;
}
```

- [ ] **Step 3: Add responsive behavior**

Add:

```css
@media (max-width: 760px) {
  .admin-command-app,
  .admin-command-app.admin-command-app-collapsed {
    padding-left: 0;
    padding-top: 74px;
  }

  .admin-command-sidebar {
    inset: 0 0 auto 0;
    width: 100%;
    min-height: 74px;
    flex-direction: row;
    align-items: center;
    overflow-x: auto;
    padding: 10px 12px;
  }

  .admin-command-brand,
  .admin-command-sidebar-toggle,
  .admin-command-sidebar-footer {
    display: none;
  }

  .admin-command-nav {
    display: flex;
    min-width: max-content;
    gap: 8px;
    overflow: visible;
  }

  .admin-command-nav-link {
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--admin-command-line);
    background: rgba(255, 255, 255, 0.72);
  }

  .admin-command-main,
  .admin-command-app-collapsed .admin-command-main {
    width: min(100%, 1180px);
    padding: 18px 12px 32px;
  }
}
```

- [ ] **Step 4: Add collapse test**

In `admin-web/e2e/admin-routing.spec.ts`:

```ts
test('admin sidebar collapses without losing navigation targets', async ({ page }) => {
  await page.goto('/admin/audit')

  await page.getByRole('button', { name: 'Menüyü daralt' }).click()

  await expect(page.locator('.admin-command-app')).toHaveClass(/admin-command-app-collapsed/)
  await expect(page.getByRole('link', { name: 'Denetim' })).toBeVisible()
  await page.getByRole('link', { name: 'Raporlar' }).click()
  await expect(page).toHaveURL(/\/admin\/reports$/)
})
```

Run:

```powershell
npm.cmd --prefix admin-web run test:e2e -- admin-routing.spec.ts --grep "admin sidebar collapses"
```

Expected: PASS.

## Task 4: Preserve Fast Route Transitions And Recovery

**Files:**
- Modify: `admin-web/src/app/route-transition-frame.tsx` only if needed.
- Modify: `admin-web/src/app/route-recovery-boundary.tsx` only if needed.
- Test: `admin-web/e2e/admin-routing.spec.ts`

- [ ] **Step 1: Keep shared route frame**

No code should be required if `AdminShell` still wraps routes with:

```tsx
<RouteTransitionFrame>
  <RouteRecoveryBoundary firstAllowedPath={input.firstAllowedPath}>
    <Suspense fallback={<RouteLoadingState />}>
      <Routes>{/* routes */}</Routes>
    </Suspense>
  </RouteRecoveryBoundary>
</RouteTransitionFrame>
```

- [ ] **Step 2: Add route transition smoke**

Add a Playwright test that checks navigation stays recoverable:

```ts
test('admin command shell keeps navigation responsive across lazy routes', async ({ page }) => {
  await page.goto('/admin/audit')

  await page.getByRole('link', { name: 'Raporlar' }).click()
  await expect(page).toHaveURL(/\/admin\/reports$/)
  await expect(page.getByRole('main')).toBeVisible()

  await page.getByRole('link', { name: 'Gelen Kutusu' }).click()
  await expect(page).toHaveURL(/\/admin\/inbox$/)
  await expect(page.getByRole('main')).toBeVisible()

  await expect(page.getByText('Sayfa geçişi tamamlanamadı')).toHaveCount(0)
})
```

- [ ] **Step 3: Run route smoke**

Run:

```powershell
npm.cmd --prefix admin-web run test:e2e -- admin-routing.spec.ts --grep "admin command shell keeps navigation"
```

Expected: PASS.

## Task 5: Verification And Merge Prep

**Files:**
- No new source files beyond prior tasks.
- Test: full relevant frontend checks.

- [ ] **Step 1: Run lint**

Run:

```powershell
npm.cmd --prefix admin-web run lint
```

Expected: PASS.

- [ ] **Step 2: Run focused admin e2e**

Run:

```powershell
npm.cmd --prefix admin-web run test:e2e -- admin-routing.spec.ts admin-inbox.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Run admin-web release check**

Run:

```powershell
npm.cmd --prefix admin-web run check:release
```

Expected: PASS.

- [ ] **Step 4: Run root release check if changes touch shared shell or localization dictionary**

Run:

```powershell
npm.cmd run check:release
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add admin-web/src/app/admin-sidebar.tsx admin-web/src/app/admin-shell.tsx admin-web/src/app/admin-navigation.ts admin-web/src/features/localization/messages/admin-shell.ts admin-web/src/index.css admin-web/e2e/admin-routing.spec.ts admin-web/e2e/admin-inbox.spec.ts
git commit -m "feat: modernize admin command shell"
```

Expected: one focused frontend commit.

## Acceptance Checklist

- [ ] Admin routes still honor role-based navigation.
- [ ] Admin page internals are not redesigned in this slice.
- [ ] Old admin explainer chrome no longer appears.
- [ ] LUFIAN brand appears in admin sidebar.
- [ ] Sidebar is fixed, collapsible, and responsive.
- [ ] Session/settings, store preview, and real login are secondary utilities.
- [ ] Route preloading remains wired on focus, pointer down, and hover.
- [ ] Route transition/recovery behavior still wraps all admin routes.
- [ ] Turkish and English shell labels remain localized.
- [ ] No backend, migration, Render deploy, or DB work is required.

## Rollout Notes

This is frontend-only. After merge:

- Vercel production deploy is required/expected via automatic `main` deployment.
- Render deploy is not required.
- No migration is required.
- No new runtime environment variable is required.

## Self-Review

Spec coverage:

- Store-style shell parity: covered in Tasks 1-3.
- Page internals excluded: explicitly scoped out and route components preserved.
- Page transition details: covered in Task 4.
- Testing and release checks: covered in Task 5.

Placeholder scan:

- No `TBD`, `TODO`, or unspecified test instructions remain.

Type consistency:

- `NavDefinition.id` and `AdminNavIconId` are introduced together.
- `AdminSidebar` props match `AdminShell` input fields already available.
- Localization keys used by `AdminSidebar` are added in the same plan.
