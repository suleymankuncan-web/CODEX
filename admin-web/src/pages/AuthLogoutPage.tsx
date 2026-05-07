import { useCallback, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ScreenState } from '../components/dashboard-primitives'
import { getAuthBootstrap } from '../features/auth/api'
import { buildProviderLogoutUrl } from '../features/auth/auth-flow'
import { isClerkSessionProviderAvailable } from '../features/auth/clerk-config'
import { ClerkLogoutEffect } from '../features/auth/clerk-session'
import { useLocalization } from '../features/localization/useLocalization'
import { readClientProviderIdToken } from '../features/session/session-storage'
import { useSession } from '../features/session/session-context-value'

export function AuthLogoutPage() {
  const { t } = useLocalization()
  const { clearToBearerMode } = useSession()
  const handledRef = useRef(false)
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
    const providerIdToken = readClientProviderIdToken()
    const providerLogoutUrl = buildProviderLogoutUrl({
      bootstrap: bootstrapQuery.data,
      idToken: providerIdToken,
    })
    clearToBearerMode()

    if (providerLogoutUrl) {
      window.location.replace(providerLogoutUrl)
      return
    }

    window.location.replace('/auth/login')
  }, [bootstrapQuery.data, bootstrapQuery.isPending, clearToBearerMode, clerkReady])

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
        title={t('authFlow.logoutTitle')}
        copy={t('authFlow.logoutCopy')}
      />
    </section>
  )
}
