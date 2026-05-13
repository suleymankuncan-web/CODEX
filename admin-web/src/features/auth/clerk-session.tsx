import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
} from '@clerk/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { ScreenState, StatusPill } from '../../components/dashboard-primitives'
import { registerBearerTokenRefreshHandler } from '../../lib/api'
import { readStoredAppLocale } from '../../lib/i18n'
import { translate } from '../localization/dictionary'
import { useLocalization } from '../localization/useLocalization'
import { useSession } from '../session/session-context-value'
import { isClerkAuthEnabled, resolveClerkPublishableKey } from './clerk-config'
import { sanitizeAuthReturnPath } from './return-path'

const CLERK_TOKEN_REFRESH_MS = 45_000

export function ClerkSessionProvider(input: { children: ReactNode }) {
  if (!isClerkAuthEnabled()) {
    return <>{input.children}</>
  }

  const publishableKey = resolveClerkPublishableKey()

  if (!publishableKey) {
    const locale = readStoredAppLocale()

    return (
      <section className="auth-flow-shell">
        <ScreenState
          title={translate(locale, 'authFlow.clerkPublishableKeyMissingTitle')}
          copy={translate(locale, 'authFlow.clerkPublishableKeyMissingCopy')}
          tone="error"
        />
      </section>
    )
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      afterSignOutUrl="/auth/login"
      signInFallbackRedirectUrl="/auth/login"
      signUpFallbackRedirectUrl="/auth/login"
    >
      <ClerkSessionBridge />
      {input.children}
    </ClerkProvider>
  )
}

export function ClerkLoginActions(input: { returnTo: string }) {
  const { t } = useLocalization()
  const { isLoaded, isSignedIn, userId } = useAuth()
  const safeReturnTo = sanitizeAuthReturnPath(input.returnTo) ?? '/'

  if (!isLoaded) {
    return (
      <button className="control-button auth-flow-link" type="button" disabled>
        {t('authFlow.loadingClerk')}
      </button>
    )
  }

  if (isSignedIn) {
    return (
      <div className="clerk-session-card">
        <div>
          <StatusPill tone="calm">{t('authFlow.clerkSignedIn')}</StatusPill>
          <p className="panel-copy">{t('authFlow.clerkSyncingUser', { userId: userId ?? 'unknown' })}</p>
        </div>
        <UserButton />
      </div>
    )
  }

  return (
    <>
      <SignInButton mode="modal" fallbackRedirectUrl={safeReturnTo}>
        <button className="control-button auth-flow-link" type="button">
          {t('authFlow.signInWithClerk')}
        </button>
      </SignInButton>
      <SignUpButton mode="modal" fallbackRedirectUrl={safeReturnTo}>
        <button className="control-button auth-flow-link" type="button">
          {t('authFlow.createClerkUser')}
        </button>
      </SignUpButton>
    </>
  )
}

export function ClerkLogoutEffect(input: { onFallback: () => void }) {
  const { isLoaded, signOut } = useAuth()
  const { onFallback } = input
  const handledRef = useRef(false)

  useEffect(() => {
    if (!isLoaded || handledRef.current) {
      return
    }

    handledRef.current = true
    signOut({ redirectUrl: '/auth/login' }).catch(() => onFallback())
  }, [isLoaded, onFallback, signOut])

  return null
}
function ClerkSessionBridge() {
  const { clearToBearerMode, startBearerSession, setProviderSessionHydrating } = useSession()
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const lastTokenRef = useRef<string | null>(null)
  const template = (import.meta.env.VITE_CLERK_JWT_TEMPLATE ?? '').trim() || undefined

  useEffect(() => {
    if (!isLoaded) {
      setProviderSessionHydrating(true)
    }
  }, [isLoaded, setProviderSessionHydrating])

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    if (!isSignedIn) {
      lastTokenRef.current = null
      clearToBearerMode()
      setProviderSessionHydrating(false)
    }
  }, [clearToBearerMode, isLoaded, isSignedIn, setProviderSessionHydrating])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return
    }

    return registerBearerTokenRefreshHandler(async () => {
      const token = await getToken(template ? { template } : undefined)
      if (!token) {
        return null
      }

      lastTokenRef.current = token
      startBearerSession(token)
      return token
    })
  }, [getToken, isLoaded, isSignedIn, startBearerSession, template])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return
    }

    let cancelled = false
    setProviderSessionHydrating(true)

    const syncToken = async () => {
      try {
        const token = await getToken(template ? { template } : undefined)

        if (cancelled || !token || token === lastTokenRef.current) {
          return
        }

        lastTokenRef.current = token
        startBearerSession(token)
      } catch {
        if (!cancelled) {
          lastTokenRef.current = null
          clearToBearerMode()
        }
      } finally {
        if (!cancelled) {
          setProviderSessionHydrating(false)
        }
      }
    }

    void syncToken()
    const intervalId = window.setInterval(() => {
      void syncToken()
    }, CLERK_TOKEN_REFRESH_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [
    clearToBearerMode,
    getToken,
    isLoaded,
    isSignedIn,
    setProviderSessionHydrating,
    startBearerSession,
    template,
  ])

  return null
}
