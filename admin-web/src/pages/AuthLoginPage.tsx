import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ArrowRight, KeyRound, LogIn, ShieldCheck } from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { preloadRouteModule } from '../app/route-preloaders'
import { MetricAccent, MetricCard, StatusPill } from '../components/dashboard-primitives'
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
    <section className="auth-flow-shell">
      <section className="hero-panel auth-hero-panel">
        <div>
          <div className="eyebrow">{t('authFlow.loginHeroEyebrow')}</div>
          <h2 className="hero-title">{t('authFlow.loginHeroTitle')}</h2>
          <p className="hero-copy">{t('authFlow.loginHeroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('authFlow.route')} value="/auth/login" />
          <MetricAccent label={t('authFlow.providerFlow')} value={providerReady ? t('authFlow.configured') : t('authFlow.needsEnv')} />
          <MetricAccent label={t('authFlow.returnTo')} value={returnTo} />
        </div>
      </section>

      <section className="metric-grid auth-metric-grid">
        <MetricCard
          title={t('authFlow.realAuthPath')}
          value={1}
          note={t('authFlow.realAuthPathNote')}
          icon={<LogIn size={18} />}
          tone="accent"
        />
        <MetricCard
          title={t('authFlow.sharedContract')}
          value={1}
          note={t('authFlow.sharedContractNote')}
          icon={<ShieldCheck size={18} />}
          tone="calm"
        />
        <MetricCard
          title={t('authFlow.manualFallback')}
          value={1}
          note={t('authFlow.manualFallbackNote')}
          icon={<KeyRound size={18} />}
          tone="warning"
        />
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('authFlow.currentState')}</div>
              <h3>{t('authFlow.currentStateTitle')}</h3>
            </div>
            <StatusPill tone={providerReady ? 'calm' : 'warning'}>
              {providerReady ? t('authFlow.providerReady') : t('authFlow.scaffolded')}
            </StatusPill>
          </div>
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('authFlow.providerRedirect')}</strong>
              </div>
              <p>
                {providerReady
                  ? clerkReady
                    ? t('authFlow.providerRedirectClerk')
                    : t('authFlow.providerRedirectOidc')
                  : t('authFlow.providerRedirectNeedsEnv')}
              </p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('authFlow.returnPathAwareness')}</strong>
              </div>
              <p>{t('authFlow.returnPathAwarenessCopy')}</p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('authFlow.availableActions')}</div>
              <h3>{t('authFlow.availableActionsTitle')}</h3>
            </div>
          </div>
          <div className="action-cluster">
            {clerkReady ? (
              <ClerkLoginActions returnTo={returnTo} />
            ) : providerLogin.url ? (
              <a className="control-button auth-flow-link" href={providerLogin.url}>
                {t('authFlow.startProviderLogin')}
              </a>
            ) : null}
            <Link
              className="control-button auth-flow-link"
              to={`/auth/callback#access_token=demo-placeholder-token&state=${encodeURIComponent(returnTo)}`}
            >
              {t('authFlow.simulateCallbackRoute')}
            </Link>
            <Link className="control-button auth-flow-link" to="/admin/session">
              {t('authFlow.manualSessionSetup')}
            </Link>
          </div>
          <p className="panel-copy">
            {providerLogin.error
              ? t('authFlow.providerLoginNotReady', { error: providerLogin.error })
              : clerkReady
                ? t('authFlow.clerkReadyCopy')
                : providerReady
                ? t('authFlow.providerReadyCopy')
              : t('authFlow.providerNeedsEnvCopy')}
          </p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('authFlow.contractShape')}</div>
            <h3>{t('authFlow.contractShapeTitle')}</h3>
          </div>
        </div>
        <div className="stacked-table">
          <div className="stacked-row">
            <div className="stacked-row-head">
              <strong>{t('authFlow.loginHandoff')}</strong>
              <ArrowRight size={16} />
            </div>
            <p>{t('authFlow.loginHandoffCopy')}</p>
          </div>
          <div className="stacked-row">
            <div className="stacked-row-head">
              <strong>{t('authFlow.verificationGate')}</strong>
              <ArrowRight size={16} />
            </div>
            <p>{t('authFlow.verificationGateCopy')}</p>
          </div>
        </div>
      </section>
    </section>
  )
}
