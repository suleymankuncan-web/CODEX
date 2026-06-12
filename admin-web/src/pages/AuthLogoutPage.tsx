import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ScreenState } from '../components/dashboard-primitives'
import { getAuthBootstrap } from '../features/auth/api'
import { buildProviderLogoutUrl } from '../features/auth/auth-flow'
import { isClerkSessionProviderAvailable } from '../features/auth/clerk-config'
import { ClerkLogoutEffect } from '../features/auth/clerk-session'
import { useLocalization } from '../features/localization/useLocalization'
import { isCookieBrowserSession, readClientProviderIdToken } from '../features/session/session-storage'
import { useSession } from '../features/session/session-context-value'

export function AuthLogoutPage() {
  const { t } = useLocalization()
  const { clearProviderSession, session } = useSession()
  const handledRef = useRef(false)
  const [logoutFailed, setLogoutFailed] = useState(false)
  const clerkReady = isClerkSessionProviderAvailable()
  const bootstrapQuery = useQuery({
    queryKey: ['auth-bootstrap'],
    queryFn: getAuthBootstrap,
    retry: false,
    enabled: !clerkReady,
  })

  const finishLocalLogout = useCallback(() => {
    if (handledRef.current || (!clerkReady && bootstrapQuery.isPending && !bootstrapQuery.data)) {
      return
    }

    handledRef.current = true
    setLogoutFailed(false)
    const providerIdToken = isCookieBrowserSession(session) ? '' : readClientProviderIdToken()
    const providerLogoutUrl = buildProviderLogoutUrl({
      ...(bootstrapQuery.data === undefined ? {} : { bootstrap: bootstrapQuery.data }),
      idToken: providerIdToken,
    })
    clearProviderSession()
      .then(() => {
        if (providerLogoutUrl) {
          window.location.replace(providerLogoutUrl)
          return
        }

        window.location.replace('/auth/login')
      })
      .catch(() => {
        handledRef.current = false
        setLogoutFailed(true)
      })
  }, [bootstrapQuery.data, bootstrapQuery.isPending, clearProviderSession, clerkReady, session])

  useEffect(() => {
    if (clerkReady) {
      return
    }

    finishLocalLogout()
  }, [clerkReady, finishLocalLogout])

  return (
    <section className="auth-flow-shell">
      {clerkReady ? <ClerkLogoutEffect onFallback={finishLocalLogout} /> : null}
      <ScreenState
        title={logoutFailed ? t('authFlow.logoutFailedTitle') : t('authFlow.logoutTitle')}
        copy={logoutFailed ? t('authFlow.logoutFailedCopy') : t('authFlow.logoutCopy')}
        {...(logoutFailed ? { tone: 'error' as const } : {})}
      />
    </section>
  )
}
