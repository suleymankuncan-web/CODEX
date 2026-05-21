import { KeyRound, LogIn, PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { NavLink } from 'react-router-dom'
import lufianLogoUrl from '../assets/lufian-logo.png'
import type { AuthSessionSummary } from '../features/auth/api'
import { formatDisplayRoles } from '../features/auth/display'
import { useLocalization } from '../features/localization/useLocalization'
import type { NavDefinition } from './admin-navigation'
import { preloadRouteModule } from './route-preloaders'

const adminRouteWarmDedupeMs = 2_000

function getAdminInitials(authSummary: AuthSessionSummary | null) {
  const userId = authSummary?.user.userId?.trim() || 'ADMIN'
  const parts = userId
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
  }

  return userId.slice(0, 2).toUpperCase()
}

export function AdminSidebar(input: {
  allowedAdminNav: NavDefinition[]
  authSummary: AuthSessionSummary | null
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}) {
  const { t } = useLocalization()
  const queryClient = useQueryClient()
  const warmingRouteDedupeRef = useRef<Set<string>>(new Set())
  const ToggleIcon = input.collapsed ? PanelLeftOpen : PanelLeftClose
  const roleSummary = formatDisplayRoles(input.authSummary?.user.roleCodes, t('adminShell.noResolvedRoles'))
  const primaryNavItems = input.allowedAdminNav.filter((item) => item.id !== 'session')
  const warmAdminRoute = (path: string) => {
    preloadRouteModule(path)
    if (warmingRouteDedupeRef.current.has(path)) {
      return
    }
    warmingRouteDedupeRef.current.add(path)
    window.setTimeout(() => {
      warmingRouteDedupeRef.current.delete(path)
    }, adminRouteWarmDedupeMs)

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
        {primaryNavItems.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              className={({ isActive }) =>
                `admin-command-nav-link${isActive ? ' admin-command-nav-link-active' : ''}`
              }
              key={item.to}
              onFocus={() => warmAdminRoute(item.to)}
              onPointerDown={() => warmAdminRoute(item.to)}
              onPointerEnter={() => warmAdminRoute(item.to)}
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
            onFocus={() => warmAdminRoute('/admin/session')}
            onPointerDown={() => warmAdminRoute('/admin/session')}
            onPointerEnter={() => warmAdminRoute('/admin/session')}
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
