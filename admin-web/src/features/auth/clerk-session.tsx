import {
  ClerkProvider,
  UserButton,
  useAuth,
  useSignIn,
} from '@clerk/react'
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
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
  const { isLoaded: authLoaded, isSignedIn, userId } = useAuth()
  const signInSignal = useSignIn()
  const signIn = signInSignal.signIn
  const safeReturnTo = sanitizeAuthReturnPath(input.returnTo) ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!authLoaded || !signIn) {
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
          <p>{t('authFlow.clerkSyncingUser', { userId: userId ?? 'unknown' })}</p>
        </div>
        <UserButton />
      </div>
    )
  }

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError(t('authFlow.emailPasswordRequired'))
      return
    }

    setSubmitting(true)

    try {
      const result = await signIn.password({
        identifier: email.trim(),
        password,
      })

      if (result.error) {
        setError(t('authFlow.emailPasswordFailed'))
        return
      }

      if (signIn.status === 'complete') {
        const finalizeResult = await signIn.finalize({
          navigate: ({ decorateUrl }) => {
            window.location.assign(String(decorateUrl(safeReturnTo)))
          },
        })

        if (finalizeResult.error) {
          setError(t('authFlow.emailPasswordFailed'))
        }

        return
      }

      setError(t('authFlow.additionalVerificationRequired'))
    } catch {
      setError(t('authFlow.emailPasswordFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="auth-login-form" onSubmit={(event) => void submitLogin(event)}>
      <div className="auth-login-field">
        <label htmlFor="auth-email">{t('authFlow.emailLabel')}</label>
        <input
          id="auth-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t('authFlow.emailPlaceholder')}
        />
      </div>

      <div className="auth-login-field">
        <label htmlFor="auth-password">{t('authFlow.passwordLabel')}</label>
        <input
          id="auth-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={t('authFlow.passwordPlaceholder')}
        />
      </div>

      {error ? (
        <p className="auth-login-form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="auth-login-primary" type="submit" disabled={submitting || signInSignal.fetchStatus === 'fetching'}>
        {submitting ? t('authFlow.loginSubmitting') : t('authFlow.signInWithClerk')}
      </button>
    </form>
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

    return registerBearerTokenRefreshHandler(async (input) => {
      const token = await getClerkToken(input?.skipCache ? { skipCache: true } : undefined)
      if (!token) {
        return null
      }

      lastTokenRef.current = token
      startBearerSession(token)
      return token
    })
  }, [getToken, getClerkToken, isLoaded, isSignedIn, startBearerSession])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return
    }

    let cancelled = false
    setProviderSessionHydrating(true)

    const syncToken = async () => {
      try {
        const token = await getClerkToken()

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
    getClerkToken,
    isLoaded,
    isSignedIn,
    setProviderSessionHydrating,
    startBearerSession,
  ])

  return null
}
