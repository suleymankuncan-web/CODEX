import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Bell,
  ClipboardList,
  CircleDollarSign,
  Home,
  Medal,
  Megaphone,
  ReceiptText,
  Settings,
  Store,
  Target,
  TrendingUp,
  Trophy,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import lufianLogoUrl from '../assets/lufian-logo.png'
import type { AuthSessionSummary } from '../features/auth/api'
import { useLocalization } from '../features/localization/useLocalization'
import {
  getRoleAwareStoreNavigation,
  getStorePersonaLabelKey,
  resolveStorePersona,
  type StoreNavIconId,
} from './store-navigation'
import { preloadRouteModule } from './route-preloaders'

const iconById: Record<StoreNavIconId, LucideIcon> = {
  approvals: ReceiptText,
  checklist: ClipboardList,
  competitions: Medal,
  feed: Megaphone,
  home: Home,
  incentives: CircleDollarSign,
  kpi: TrendingUp,
  me: UserRound,
  rankings: Trophy,
  reports: BarChart3,
  settings: Settings,
  targets: Target,
  tasks: Bell,
  workforce: UsersRound,
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
}) {
  const { t } = useLocalization()
  const queryClient = useQueryClient()
  const persona = resolveStorePersona(input.authSummary)
  const personaLabel = t(getStorePersonaLabelKey(persona))
  const navItems = getRoleAwareStoreNavigation(input.authSummary)
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

      <div className="store-command-persona-chip" aria-hidden="true">
        <span className="store-command-persona-dot" />
        <span>{personaLabel}</span>
      </div>

      <nav className="store-command-nav" aria-label={t('storeHome.sidebar.navAria')}>
        {navItems.map((item) => {
          const Icon = iconById[item.icon]

          return (
            <NavLink
              className={({ isActive }) =>
                `store-command-nav-link${isActive ? ' store-command-nav-link-active' : ''}`
              }
              {...(item.end === undefined ? {} : { end: item.end })}
              key={item.id}
              onFocus={() => warmStoreRoute(item.path)}
              onPointerDown={() => warmStoreRoute(item.path)}
              onPointerEnter={() => warmStoreRoute(item.path)}
              title={t(item.labelKey)}
              to={item.path}
            >
              <span className="store-command-nav-icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <span className="store-command-nav-label">{t(item.labelKey)}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="store-command-sidebar-footer">
        <div className="store-command-identity" aria-label={t('storeHome.sidebar.contextAria')}>
          <span className="store-command-avatar" aria-hidden="true">
            <Store size={18} />
          </span>
          <span className="store-command-identity-text">
            <strong>{identityLabel ?? t('storeHome.sidebar.sessionUser')}</strong>
            <small>{personaLabel} / {identityMeta}</small>
          </span>
        </div>
      </div>
    </aside>
  )
}
