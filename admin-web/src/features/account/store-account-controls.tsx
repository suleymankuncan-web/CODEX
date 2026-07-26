import { useClerk, useUser } from '@clerk/react'
import {
  ChevronUp,
  Languages,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { AuthSessionSummary } from '../auth/api'
import { isClerkSessionProviderAvailable } from '../auth/clerk-config'
import { useLocalization } from '../localization/useLocalization'

type AccountIdentity = {
  displayName: string
  detail: string
  email: string | null
}

function initialsOf(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0]?.[0] ?? ''}${parts.at(-1)?.[0] ?? ''}` : value.slice(0, 2))
    .toLocaleUpperCase('tr-TR')
}

function FallbackAvatar(input: { displayName: string; compact?: boolean }) {
  return (
    <span
      className={`store-account-avatar${input.compact ? ' store-account-avatar-compact' : ''}`}
      aria-hidden="true"
    >
      {initialsOf(input.displayName)}
    </span>
  )
}

function ClerkAvatar(input: { displayName: string; compact?: boolean }) {
  const { isLoaded, user } = useUser()

  if (!isLoaded || !user?.imageUrl) {
    return <FallbackAvatar {...input} />
  }

  return (
    <span className={`store-account-avatar${input.compact ? ' store-account-avatar-compact' : ''}`}>
      <img src={user.imageUrl} alt="" referrerPolicy="no-referrer" />
    </span>
  )
}

export function StoreAccountAvatar(input: { displayName: string; compact?: boolean }) {
  if (!isClerkSessionProviderAvailable()) {
    return <FallbackAvatar {...input} />
  }

  return <ClerkAvatar {...input} />
}

function ClerkAccountManagementButton(input: { className?: string; children: ReactNode }) {
  const clerk = useClerk()

  return (
    <Button
      className={input.className}
      type="button"
      variant="outline"
      onClick={() => clerk.openUserProfile({
        apiKeysProps: { hide: true },
        appearance: {
          elements: {
            navbarButton__apiKeys: { display: 'none' },
            profileSection__connectedAccounts: { display: 'none' },
          },
        },
      })}
    >
      {input.children}
    </Button>
  )
}

export function StoreAccountManagementButton(input: {
  className?: string
  children: ReactNode
}) {
  const { t } = useLocalization()

  if (!isClerkSessionProviderAvailable()) {
    return (
      <Button className={input.className} type="button" variant="outline" disabled>
        {t('storeHome.settings.providerUnavailable')}
      </Button>
    )
  }

  return <ClerkAccountManagementButton {...input} />
}

export function StoreAccountMenu(input: {
  authSummary: AuthSessionSummary | null
  identity: AccountIdentity
  compact?: boolean
}) {
  const { t } = useLocalization()
  const location = useLocation()
  const settingsActive = location.pathname === '/store/settings'

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`store-account-trigger${input.compact ? ' store-account-trigger-compact' : ''}${
            settingsActive ? ' store-account-trigger-active' : ''
          }`}
          type="button"
          aria-label={t('storeHome.settings.openAccountMenu')}
        >
          <StoreAccountAvatar
            displayName={input.identity.displayName}
            {...(input.compact === undefined ? {} : { compact: input.compact })}
          />
          {input.compact ? null : (
            <span className="store-command-identity-text">
              <strong>{input.identity.displayName}</strong>
              <small>{input.identity.detail}</small>
            </span>
          )}
          <ChevronUp className="store-account-trigger-chevron" size={15} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={input.compact ? 'end' : 'start'}
        side={input.compact ? 'bottom' : 'top'}
        sideOffset={10}
        className="store-account-popover"
      >
        <div className="store-account-popover-profile">
          <StoreAccountAvatar displayName={input.identity.displayName} />
          <span>
            <strong>{input.identity.displayName}</strong>
            <small>{input.identity.email ?? input.identity.detail}</small>
          </span>
        </div>

        <div className="store-account-popover-menu" role="menu">
          <Link to="/store/settings?section=profile" role="menuitem">
            <UserRound size={16} aria-hidden="true" />
            {t('storeHome.settings.profileMenu')}
          </Link>
          <Link to="/store/settings?section=preferences" role="menuitem">
            <Languages size={16} aria-hidden="true" />
            {t('storeHome.settings.preferencesMenu')}
          </Link>
          <Link to="/store/settings?section=security" role="menuitem">
            <ShieldCheck size={16} aria-hidden="true" />
            {t('storeHome.settings.securityMenu')}
          </Link>
          <Link to="/store/settings" role="menuitem">
            <Settings size={16} aria-hidden="true" />
            {t('storeHome.settings.allSettingsMenu')}
          </Link>
        </div>

        <div className="store-account-popover-separator" />
        <Button className="store-account-logout" variant="ghost" asChild>
          <Link to="/auth/logout">
            <LogOut size={16} aria-hidden="true" />
            {t('storeHome.settings.logout')}
          </Link>
        </Button>
      </PopoverContent>
    </Popover>
  )
}
