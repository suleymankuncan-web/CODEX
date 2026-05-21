import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Bell,
  ClipboardList,
  Home,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Settings,
  Target,
  TrendingUp,
  Trophy,
  UserRound,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import lufianLogoUrl from '../assets/lufian-logo.png'
import type { AuthSessionSummary } from '../features/auth/api'
import { useLocalization } from '../features/localization/useLocalization'
import {
  getStoreNavigation,
  getStorePersonaLabelKey,
  resolveStorePersona,
  type StoreNavIconId,
} from './store-navigation'
import { preloadRouteModule } from './route-preloaders'

const iconById: Record<StoreNavIconId, LucideIcon> = {
  approvals: ReceiptText,
  checklist: ClipboardList,
  feed: Megaphone,
  home: Home,
  kpi: TrendingUp,
  me: UserRound,
  rankings: Trophy,
  reports: BarChart3,
  settings: Settings,
  targets: Target,
  tasks: Bell,
}

function getIdentityInitials(authSummary: AuthSessionSummary | null) {
  const employeeId = authSummary?.user.employeeId?.trim()
  const userId = authSummary?.user.userId?.trim()
  const source = employeeId || userId || 'HR'
  const parts = source
    .replace(/[^A-Za-z0-9ğüşöçıİĞÜŞÖÇ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
  }

  return source.slice(0, 2).toUpperCase()
}

function getIdentityLabel(authSummary: AuthSessionSummary | null) {
  const employeeId = authSummary?.user.employeeId?.trim()
  const userId = authSummary?.user.userId?.trim()
  if (employeeId) return employeeId
  if (userId) return userId
  return null
}

export function StoreSidebar(input: {
  authSummary: AuthSessionSummary | null
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}) {
  const { t } = useLocalization()
  const queryClient = useQueryClient()
  const persona = resolveStorePersona(input.authSummary)
  const navItems = getStoreNavigation(persona)
  const identityLabel = getIdentityLabel(input.authSummary)
  const assignedStoreCount = input.authSummary?.scopeSummary.assignedStoreCount ?? 0
  const scopedStoreCount =
    input.authSummary?.scopeSummary.storeCount ??
    input.authSummary?.user.readScope.storeIds.length ??
    input.authSummary?.user.scope.storeIds.length ??
    0
  const identityMeta =
    assignedStoreCount > 0
      ? t('storeHome.sidebar.assignedStores', { count: assignedStoreCount })
      : t('storeHome.sidebar.scopedStores', { count: scopedStoreCount })
  const ToggleIcon = input.collapsed ? PanelLeftOpen : PanelLeftClose
  const warmStoreRoute = (path: string) => {
    preloadRouteModule(path)
    void import('./route-data-preloaders')
      .then(({ prefetchRouteData }) => {
        prefetchRouteData({
          authSummary: input.authSummary,
          pathname: path,
          queryClient,
        })
      })
      .catch(() => undefined)
  }

  return (
    <aside className="store-command-sidebar" aria-label={t('storeHome.sidebar.aria')}>
      <div className="store-command-brand">
        <div className="store-command-brand-mark store-command-brand-logo" aria-hidden="true">
          <img src={lufianLogoUrl} alt="" />
        </div>
        <div className="store-command-brand-text">
          <strong>LUFIAN</strong>
          <small>{t('storeHome.sidebar.brandArea')}</small>
        </div>
      </div>

      <button
        aria-expanded={!input.collapsed}
        className="store-command-sidebar-toggle"
        type="button"
        onClick={() => input.onCollapsedChange(!input.collapsed)}
      >
        <ToggleIcon aria-hidden="true" size={18} />
        <span>{input.collapsed ? t('storeHome.sidebar.expand') : t('storeHome.sidebar.collapse')}</span>
      </button>

      <nav className="store-command-nav" aria-label={t('storeHome.sidebar.navAria')}>
        {navItems.map((item) => {
          const Icon = iconById[item.icon]

          return (
            <NavLink
              className={({ isActive }) =>
                `store-command-nav-link${isActive ? ' store-command-nav-link-active' : ''}`
              }
              end={item.end}
              key={item.id}
              onFocus={() => warmStoreRoute(item.path)}
              onPointerDown={() => warmStoreRoute(item.path)}
              onPointerEnter={() => warmStoreRoute(item.path)}
              title={t(item.labelKey)}
              to={item.path}
            >
              <span className="store-command-nav-icon" aria-hidden="true">
                <Icon size={20} />
              </span>
              <span className="store-command-nav-label">{t(item.labelKey)}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="store-command-sidebar-footer">
        <NavLink
          className={({ isActive }) =>
            `store-command-identity store-command-identity-link${
              isActive ? ' store-command-identity-link-active' : ''
            }`
          }
          onFocus={() => warmStoreRoute('/store/settings')}
          onPointerDown={() => warmStoreRoute('/store/settings')}
          onPointerEnter={() => warmStoreRoute('/store/settings')}
          title={t('storeHome.nav.settings')}
          to="/store/settings"
        >
          <span className="store-command-avatar" aria-hidden="true">
            {getIdentityInitials(input.authSummary)}
          </span>
          <span className="store-command-identity-text">
            <strong>{identityLabel ?? t('storeHome.sidebar.sessionUser')}</strong>
            <small>
              {t(getStorePersonaLabelKey(persona))} · {identityMeta}
            </small>
          </span>
        </NavLink>

      </div>
    </aside>
  )
}
