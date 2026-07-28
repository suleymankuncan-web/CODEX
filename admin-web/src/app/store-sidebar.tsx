import { useQueryClient } from '@tanstack/react-query'
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
  Target,
  TrendingUp,
  Trophy,
  UserRound,
  UsersRound,
  Images,
} from 'lucide-react'
import { NavLink } from 'react-router'
import lufianLogoUrl from '../assets/lufian-logo.png'
import type { AuthSessionSummary } from '../features/auth/api'
import { StoreAccountMenu } from '../features/account/store-account-controls'
import '../features/account/store-account.css'
import { useLocalization } from '../features/localization/useLocalization'
import { resolveUserDisplayLabel } from '../lib/display-labels'
import {
  getRoleAwareStoreNavigation,
  getStorePersonaLabelKey,
  resolveStorePersona,
  type StoreNavIconId,
} from './store-navigation'
import { preloadRoute } from './route-preloaders'

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
  visualCampaigns: Images,
}

function getIdentityLabel(authSummary: AuthSessionSummary | null, fallback: string) {
  return resolveUserDisplayLabel(authSummary?.user, fallback)
}

export function StoreSidebar(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { t } = useLocalization()
  const queryClient = useQueryClient()
  const persona = resolveStorePersona(input.authSummary)
  const personaLabel = t(getStorePersonaLabelKey(persona))
  const navItems = getRoleAwareStoreNavigation(input.authSummary)
  const identityLabel = getIdentityLabel(input.authSummary, personaLabel)
  const warmStoreRoute = (path: string) => {
    preloadRoute({
      authSummary: input.authSummary,
      pathname: path,
      queryClient,
    })
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
        <StoreAccountMenu
          authSummary={input.authSummary}
          compact
          identity={{
            displayName: identityLabel,
            detail: personaLabel,
            email: input.authSummary?.user.email ?? null,
          }}
        />
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
              onMouseEnter={() => warmStoreRoute(item.path)}
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
        <StoreAccountMenu
          authSummary={input.authSummary}
          identity={{
            displayName: identityLabel,
            detail: personaLabel,
            email: input.authSummary?.user.email ?? null,
          }}
        />
      </div>
    </aside>
  )
}
