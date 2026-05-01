import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ArrowRight, KeyRound, LogIn, ShieldCheck } from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { MetricAccent, MetricCard, StatusPill } from '../components/dashboard-primitives'
import { getAuthBootstrap } from '../features/auth/api'
import { buildProviderLoginUrl, hasProviderLoginConfig } from '../features/auth/auth-flow'
import { isClerkSessionProviderAvailable } from '../features/auth/clerk-config'
import { ClerkLoginActions } from '../features/auth/clerk-session'

export function AuthLoginPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [providerLoginUrl, setProviderLoginUrl] = useState<string | null>(null)
  const [providerLoginError, setProviderLoginError] = useState<string | null>(null)
  const bootstrapQuery = useQuery({
    queryKey: ['auth-bootstrap'],
    queryFn: getAuthBootstrap,
    retry: false,
  })
  const returnTo = searchParams.get('returnTo') ?? location.state?.returnTo ?? '/store'
  const clerkReady = isClerkSessionProviderAvailable()
  const providerReady = clerkReady || hasProviderLoginConfig(bootstrapQuery.data)

  useEffect(() => {
    let cancelled = false

    buildProviderLoginUrl({ returnTo, bootstrap: bootstrapQuery.data })
      .then((url) => {
        if (!cancelled) {
          setProviderLoginUrl(url)
          setProviderLoginError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setProviderLoginUrl(null)
          setProviderLoginError(error instanceof Error ? error.message : String(error))
        }
      })

    return () => {
      cancelled = true
    }
  }, [bootstrapQuery.data, returnTo])

  return (
    <section className="auth-flow-shell">
      <section className="hero-panel auth-hero-panel">
        <div>
          <div className="eyebrow">Auth Entry</div>
          <h2 className="hero-title">Real login will enter here before the app opens admin or store shells.</h2>
          <p className="hero-copy">
            This route is the Phase 7 entry point for real authentication. Clerk can now create
            the browser session, while the backend still decides the real HR Axis roles and scope.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Route" value="/auth/login" />
          <MetricAccent label="Provider flow" value={providerReady ? 'Configured' : 'Needs env'} />
          <MetricAccent label="Return to" value={returnTo} />
        </div>
      </section>

      <section className="metric-grid auth-metric-grid">
        <MetricCard
          title="Real auth path"
          value={1}
          note="This route now starts authorization code + PKCE when provider config is available."
          icon={<LogIn size={18} />}
          tone="accent"
        />
        <MetricCard
          title="Shared contract"
          value={1}
          note="Admin and store shells will still share one bearer-token contract."
          icon={<ShieldCheck size={18} />}
          tone="calm"
        />
        <MetricCard
          title="Manual fallback"
          value={1}
          note="Session setup remains available while the provider flow is being introduced."
          icon={<KeyRound size={18} />}
          tone="warning"
        />
      </section>

      <section className="two-up-grid">
        <article className="panel">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">Current State</div>
                <h3>What this route can do now</h3>
              </div>
            <StatusPill tone={providerReady ? 'calm' : 'warning'}>
              {providerReady ? 'Provider-ready' : 'Scaffolded'}
            </StatusPill>
          </div>
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Provider redirect</strong>
              </div>
              <p>
                {providerReady
                  ? clerkReady
                    ? 'Clerk is configured, so this route can open the hosted Clerk sign-in flow and sync the resulting session token into the backend bearer contract.'
                    : 'OIDC-style provider settings are present, so this route can hand the user off to the configured authorization endpoint.'
                  : 'The provider contract is wired, but it still needs Clerk publishable key or OIDC env-backed authorization settings before this route can redirect for real.'}
              </p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Return path awareness</strong>
              </div>
              <p>The login entry can preserve a target shell path so the callback can send the user back into the correct surface after verification.</p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Available Actions</div>
              <h3>Use the transition path that fits today</h3>
            </div>
          </div>
          <div className="action-cluster">
            {clerkReady ? (
              <ClerkLoginActions returnTo={returnTo} />
            ) : providerLoginUrl ? (
              <a className="control-button auth-flow-link" href={providerLoginUrl}>
                Start provider login
              </a>
            ) : null}
            <Link
              className="control-button auth-flow-link"
              to={`/auth/callback#access_token=demo-placeholder-token&state=${encodeURIComponent(returnTo)}`}
            >
              Simulate callback route
            </Link>
            <Link className="control-button auth-flow-link" to="/admin/session">
              Manual session setup
            </Link>
          </div>
          <p className="panel-copy">
            {providerLoginError
              ? `Provider login is not ready: ${providerLoginError}`
              : clerkReady
                ? 'Clerk signs the user in, the frontend stores the Clerk session token as the current bearer token, and /api/auth/session resolves the actual DB role and scope.'
                : providerReady
                ? 'Provider login will return through /auth/callback, exchange the code with PKCE, and let the verified session decide whether /admin or /store is the right landing shell.'
              : 'Add backend auth bootstrap config or the OIDC env values before using this page as the primary login handoff.'}
          </p>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Contract Shape</div>
            <h3>Frontend auth bootstrap expectations</h3>
          </div>
        </div>
        <div className="stacked-table">
          <div className="stacked-row">
            <div className="stacked-row-head">
              <strong>Login handoff</strong>
              <ArrowRight size={16} />
            </div>
            <p>Build an authorization URL from env config, redirect the browser, then receive the provider code at `/auth/callback` and exchange it with PKCE.</p>
          </div>
          <div className="stacked-row">
            <div className="stacked-row-head">
              <strong>Verification gate</strong>
              <ArrowRight size={16} />
            </div>
            <p>The callback only stores a bearer token after code exchange. Shell choice still happens after `/api/auth/session` confirms the real role and scope context.</p>
          </div>
        </div>
      </section>
    </section>
  )
}
