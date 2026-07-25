import {
  ClerkProvider,
  UserButton,
  useAuth,
} from '@clerk/react'
import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { ScreenState, StatusPill } from '../../components/dashboard-primitives'
import { registerBearerTokenRefreshHandler } from '../../lib/api'
import { readStoredAppLocale } from '../../lib/i18n'
import { translate } from '../localization/dictionary'
import { useLocalization } from '../localization/useLocalization'
import { useSession } from '../session/session-context-value'
import { isSessionReady } from '../session/session-storage'
import { isClerkAuthEnabled, resolveClerkPublishableKey } from './clerk-config'
import { ClerkSignInForm } from './clerk-sign-in-form'

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

export function ClerkLoginActions() {
  const { t } = useLocalization()
  const { isLoaded: authLoaded, isSignedIn } = useAuth()

  if (!authLoaded) {
    return (
      <button className="auth-login-primary" type="button" disabled>
        {t('authFlow.loadingClerk')}
      </button>
    )
  }

  if (isSignedIn) {
    return (
      <div className="auth-login-session-card">
        <div>
          <StatusPill tone="calm">{t('authFlow.clerkSignedIn')}</StatusPill>
          <p>{t('authFlow.clerkSyncingUser')}</p>
        </div>
        <UserButton />
      </div>
    )
  }

  return (
    <div className="auth-login-clerk">
      <ClerkSignInForm />
      <noscript>
        <button className="auth-login-primary" type="button" disabled>
          {t('authFlow.signInWithClerk')}
        </button>
      </noscript>
    </div>
  )
}

export function ClerkLogoutEffect(input: { onFallback: () => void }) {
  const { isLoaded, signOut } = useAuth()
  const { clearProviderSession } = useSession()
  const { onFallback } = input
  const handledRef = useRef(false)

  useEffect(() => {
    if (!isLoaded || handledRef.current) {
      return
    }

    handledRef.current = true
    clearProviderSession()
      .then(() => signOut({ redirectUrl: '/auth/login' }))
      .catch(() => onFallback())
  }, [clearProviderSession, isLoaded, onFallback, signOut])

  return null
}
function ClerkSessionBridge() {
  const {
    clearProviderSession,
    session,
    startProviderSession,
    setProviderSessionHydrating,
  } = useSession()
  const { getToken, isLoaded, isSignedIn, sessionId, userId } = useAuth()
  const lastTokenRef = useRef<string | null>(null)
  const lastProviderSessionRef = useRef<string | null>(null)
  const template = (import.meta.env.VITE_CLERK_JWT_TEMPLATE ?? '').trim() || undefined
  const providerSessionKey = isSignedIn ? `${userId ?? 'unknown-user'}:${sessionId ?? 'unknown-session'}` : null
  const appSessionReady = isSessionReady(session)
  const getClerkToken = useCallback((input?: { skipCache?: boolean }) => {
    const options: { template?: string; skipCache?: boolean } = {}
    if (template) {
      options.template = template
    }
    if (input?.skipCache) {
      options.skipCache = true
    }

    return getToken(Object.keys(options).length > 0 ? options : undefined)
  }, [getToken, template])
  const resolveProviderSessionStartOptions = useCallback(() => {
    const intent: 'replace' | 'renew' = providerSessionKey && lastProviderSessionRef.current === providerSessionKey
      ? 'renew'
      : 'replace'

    lastProviderSessionRef.current = providerSessionKey
    return { intent }
  }, [providerSessionKey])

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
      lastProviderSessionRef.current = null
      void clearProviderSession()
      setProviderSessionHydrating(false)
    }
  }, [clearProviderSession, isLoaded, isSignedIn, setProviderSessionHydrating])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return
    }

    return registerBearerTokenRefreshHandler(async (input) => {
      const token = await getClerkToken(input?.skipCache ? { skipCache: true } : undefined)
      if (!token) {
        return null
      }

      lastTokenRef.current = token
      await startProviderSession(token, null, resolveProviderSessionStartOptions())
      return { refreshed: true, bearerToken: token }
    })
  }, [
    getToken,
    getClerkToken,
    isLoaded,
    isSignedIn,
    resolveProviderSessionStartOptions,
    startProviderSession,
  ])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return
    }

    let cancelled = false
    setProviderSessionHydrating(true)

    const syncToken = async () => {
      try {
        const token = await getClerkToken()

        if (cancelled || !token || (token === lastTokenRef.current && appSessionReady)) {
          return
        }

        lastTokenRef.current = token
        await startProviderSession(token, null, resolveProviderSessionStartOptions())
      } catch {
        if (!cancelled) {
          lastTokenRef.current = null
          lastProviderSessionRef.current = null
          void clearProviderSession()
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
    clearProviderSession,
    appSessionReady,
    getClerkToken,
    isLoaded,
    isSignedIn,
    resolveProviderSessionStartOptions,
    setProviderSessionHydrating,
    startProviderSession,
  ])

  return null
}
