import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { preloadRouteModule } from '../app/route-preloaders'
import hrAxisMarkUrl from '../assets/hr-axis-06-mark-transparent.png'
import { getAuthBootstrap } from '../features/auth/api'
import { buildProviderLoginUrl, hasProviderLoginConfig } from '../features/auth/auth-flow'
import { isClerkSessionProviderAvailable } from '../features/auth/clerk-config'
import { ClerkLoginActions } from '../features/auth/clerk-session'
import { sanitizeAuthReturnPath } from '../features/auth/return-path'
import { useLocalization } from '../features/localization/useLocalization'

export function AuthLoginPage() {
  const { t } = useLocalization()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [providerLogin, setProviderLogin] = useState<{
    url: string | null
    error: string | null
  }>({ url: null, error: null })
  const returnTo = searchParams.get('returnTo') ?? location.state?.returnTo ?? '/store'
  const clerkReady = isClerkSessionProviderAvailable()
  const bootstrapQuery = useQuery({
    queryKey: ['auth-bootstrap'],
    queryFn: getAuthBootstrap,
    retry: false,
    enabled: !clerkReady,
  })
  const providerReady = clerkReady || hasProviderLoginConfig(bootstrapQuery.data)
  const providerLoading = !clerkReady && bootstrapQuery.isLoading

  useEffect(() => {
    const safeReturnTo = sanitizeAuthReturnPath(returnTo)
    if (safeReturnTo) {
      preloadRouteModule(safeReturnTo)
    }
  }, [returnTo])

  useEffect(() => {
    if (clerkReady) {
      return
    }

    let cancelled = false

    buildProviderLoginUrl({
      returnTo,
      ...(bootstrapQuery.data === undefined ? {} : { bootstrap: bootstrapQuery.data }),
    })
      .then((url) => {
        if (!cancelled) {
          setProviderLogin({ url, error: null })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setProviderLogin({ url: null, error: error instanceof Error ? error.message : String(error) })
        }
      })

    return () => {
      cancelled = true
    }
  }, [bootstrapQuery.data, clerkReady, returnTo])

  return (
    <section className="auth-login-page" aria-labelledby="auth-login-title">
      <section className="auth-login-shell">
        <header className="auth-login-brand">
          <strong>LUFIAN</strong>
          <span>{t('authFlow.tenantProductTitle')}</span>
        </header>

        <section className="auth-login-panel">
          <header className="auth-login-panel-head">
            <h1 id="auth-login-title">{t('authFlow.loginTitle')}</h1>
          </header>

          <div className="auth-login-actions">
            {clerkReady ? (
              <ClerkLoginActions returnTo={returnTo} />
            ) : providerLogin.url ? (
              <a className="auth-login-primary" href={providerLogin.url}>
                {t('authFlow.loginTitle')}
              </a>
            ) : (
              <button className="auth-login-primary" type="button" disabled>
                {providerLoading ? t('authFlow.loginPreparing') : t('authFlow.loginUnavailableButton')}
              </button>
            )}
          </div>

          {providerLogin.error || !providerReady ? (
            <p className="auth-login-message" role={providerLogin.error ? 'alert' : undefined}>
              {t('authFlow.loginTemporarilyUnavailable')}
            </p>
          ) : null}
        </section>

        <p className="auth-login-help">{t('authFlow.loginHelpCopy')}</p>
      </section>
      <img className="auth-login-mark" src={hrAxisMarkUrl} alt="" aria-hidden="true" />
    </section>
  )
}
