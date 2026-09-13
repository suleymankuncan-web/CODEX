import { KeyRound, LogIn, Menu, PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router'
import lufianLogoUrl from '../assets/lufian-logo.png'
import { Button } from '../components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet'
import type { AuthSessionSummary } from '../features/auth/api'
import { formatDisplayRoles } from '../features/auth/display'
import { useLocalization } from '../features/localization/useLocalization'
import { resolveUserDisplayLabel } from '../lib/display-labels'
import type { NavDefinition } from './admin-navigation'
import { preloadRouteModule } from './route-preloaders'

const adminRouteWarmDedupeMs = 2_000

function getAdminInitials(label: string) {
  const parts = label
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
  }

  return label.slice(0, 2).toUpperCase()
}

export function AdminSidebar(input: {
  allowedAdminNav: NavDefinition[]
  authSummary: AuthSessionSummary | null
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}) {
  const { t } = useLocalization()
  const queryClient = useQueryClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 761px)')
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileOpen(false)
    }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])
  const warmingRouteDedupeRef = useRef<Set<string>>(new Set())
  const ToggleIcon = input.collapsed ? PanelLeftOpen : PanelLeftClose
  const roleSummary = formatDisplayRoles(input.authSummary?.user.roleCodes, t('adminShell.noResolvedRoles'))
  const identityLabel = resolveUserDisplayLabel(input.authSummary?.user, t('adminShell.sessionUser'))
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

  const brand = (
      <div className="admin-command-brand">
        <span className="admin-command-brand-logo" aria-hidden="true">
          <img src={lufianLogoUrl} alt="" />
        </span>
        <span className="admin-command-brand-text">
          <strong>LUFIAN</strong>
          <small>{t('adminShell.adminWorkspace')}</small>
        </span>
      </div>
  )
  const navigation = (
      <nav className="admin-command-nav" aria-label={t('adminShell.primaryNavigation')}>
        {primaryNavItems.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              className={({ isActive }) =>
                `admin-command-nav-link${isActive ? ' admin-command-nav-link-active' : ''}`
              }
              key={item.to}
              onClick={() => setMobileOpen(false)}
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
  )
  const footer = (
      <div className="admin-command-sidebar-footer">
        <div className="admin-command-identity">
          <span className="admin-command-avatar" aria-hidden="true">
            {getAdminInitials(identityLabel)}
          </span>
          <span className="admin-command-identity-text">
            <strong>{identityLabel}</strong>
            <small>{roleSummary}</small>
          </span>
        </div>

        <div className="admin-command-utility-links">
          <NavLink
            className="admin-command-utility-link"
            onClick={() => setMobileOpen(false)}
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
  )

  return (
    <>
    <aside className="admin-command-sidebar" aria-label={t('adminShell.primaryNavigation')}>
      <div className="admin-command-sidebar-heading">
        {brand}
        <Button
          aria-expanded={!input.collapsed}
          aria-label={input.collapsed ? t('adminShell.sidebar.expand') : t('adminShell.sidebar.collapse')}
          className="admin-command-sidebar-toggle"
          size="icon-sm"
          type="button"
          variant="ghost"
          onClick={() => input.onCollapsedChange(!input.collapsed)}
        >
          <ToggleIcon aria-hidden="true" />
        </Button>
      </div>
      {navigation}
      {footer}
    </aside>
    <div className="admin-command-mobile-toolbar">
      {brand}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button aria-label={t('adminShell.primaryNavigation')} size="icon" variant="outline">
            <Menu aria-hidden="true" />
          </Button>
        </SheetTrigger>
        <SheetContent className="admin-command-mobile-drawer" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>{t('adminShell.adminWorkspace')}</SheetTitle>
          </SheetHeader>
          {navigation}
          {footer}
        </SheetContent>
      </Sheet>
    </div>
    </>
  )
}
