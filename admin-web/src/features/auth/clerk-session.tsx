import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
} from '@clerk/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { ScreenState, StatusPill } from '../../components/dashboard-primitives'
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
    return (
      <section className="auth-flow-shell">
        <ScreenState
          title="Clerk publishable key is missing"
          copy="VITE_AUTH_PROVIDER is set to clerk, but VITE_CLERK_PUBLISHABLE_KEY is not configured for this frontend build."
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
  const { isLoaded, isSignedIn, userId } = useAuth()
  const safeReturnTo = sanitizeAuthReturnPath(input.returnTo) ?? '/'

  if (!isLoaded) {
    return (
      <button className="control-button auth-flow-link" type="button" disabled>
        Loading Clerk
      </button>
    )
  }

  if (isSignedIn) {
    return (
      <div className="clerk-session-card">
        <div>
          <StatusPill tone="calm">Clerk signed in</StatusPill>
          <p className="panel-copy">
            The frontend is syncing Clerk user <code>{userId}</code> into the backend bearer
            session.
          </p>
        </div>
        <UserButton />
      </div>
    )
  }

  return (
    <>
      <SignInButton mode="modal" fallbackRedirectUrl={safeReturnTo}>
        <button className="control-button auth-flow-link" type="button">
          Sign in with Clerk
        </button>
      </SignInButton>
      <SignUpButton mode="modal" fallbackRedirectUrl={safeReturnTo}>
        <button className="control-button auth-flow-link" type="button">
          Create Clerk user
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
      return
    }

    if (!isSignedIn) {
      lastTokenRef.current = null
      clearToBearerMode()
      setProviderSessionHydrating(false)
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
