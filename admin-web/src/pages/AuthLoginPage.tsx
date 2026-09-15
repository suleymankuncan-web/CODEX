import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { preloadRouteModule } from '../app/route-preloaders'
import { getAuthBootstrap } from '../features/auth/api'
import { buildProviderLoginUrl, hasProviderLoginConfig, isDirectOidcLoginEnabled } from '../features/auth/auth-flow'
import { AuthLoginTransition } from '../features/auth/auth-login-transition'
import { AuthLoginStudio } from '../features/auth/auth-login-studio'
import { isClerkSessionProviderAvailable } from '../features/auth/clerk-config'
import { ClerkLoginActions, type ClerkLoginShellMode } from '../features/auth/clerk-session'
import { sanitizeAuthReturnPath } from '../features/auth/return-path'
import { useLocalization } from '../features/localization/useLocalization'

export function AuthLoginPage(input: { shellMode: ClerkLoginShellMode }) {
  const { t } = useLocalization()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [providerLogin, setProviderLogin] = useState<{
    url: string | null
    error: string | null
  }>({ url: null, error: null })
  const returnTo = searchParams.get('returnTo') ?? location.state?.returnTo ?? '/store'
  const clerkReady = isClerkSessionProviderAvailable()
  const directOidcLogin = isDirectOidcLoginEnabled()
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

  useEffect(() => {
    // The on-premises Keycloak page contains the complete sign-in form.
    if (directOidcLogin && !clerkReady && providerLogin.url) {
      window.location.replace(providerLogin.url)
    }
  }, [clerkReady, directOidcLogin, providerLogin.url])

  if (directOidcLogin) {
    const failed = Boolean(providerLogin.error) || bootstrapQuery.isError ||
      (!bootstrapQuery.isPending && !providerReady)
    return <AuthLoginTransition failed={failed} />
  }

  if (clerkReady) {
    return (
      <AuthLoginStudio>
        <ClerkLoginActions shellMode={input.shellMode} />
      </AuthLoginStudio>
    )
  }

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
              <ClerkLoginActions shellMode={input.shellMode} />
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
    </section>
  )
}
