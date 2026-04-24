import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, KeyRound, ShieldEllipsis, TestTubeDiagonal } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
import { getAuthSession } from '../features/auth/api'
import { useSession } from '../features/session/session-context-value'
import { describeSessionMode } from '../features/session/session-storage'

export function SessionReadinessPage() {
  const { session, isReady, saveSession, resetSession } = useSession()
  const [draft, setDraft] = useState(session)
  const [verificationRequested, setVerificationRequested] = useState(false)
  const mode = draft.mode
  const sessionQuery = useQuery({
    queryKey: ['auth-session', session.mode, session.mockUserId, session.mockRoleCodes, session.mockCompanyIds, session.bearerToken],
    queryFn: getAuthSession,
    enabled: verificationRequested && isReady,
    retry: false,
  })

  const requestPreview = useMemo(() => {
    if (mode === 'bearer') {
      return draft.bearerToken
        ? [{ label: 'Authorization', value: `Bearer ${truncateToken(draft.bearerToken)}` }]
        : [{ label: 'Authorization', value: 'No token set yet' }]
    }

    return [
      { label: 'x-user-id', value: draft.mockUserId },
      { label: 'x-role-codes', value: draft.mockRoleCodes },
      { label: 'x-company-ids', value: draft.mockCompanyIds },
    ]
  }, [draft, mode])

  return (
    <section className="page-stack">
      <Link className="back-link" to="/admin/auth">
        <ArrowLeft size={16} />
        Back to auth operations
      </Link>

      <section className="hero-panel">
        <div>
          <div className="eyebrow">Session Readiness</div>
          <h2 className="hero-title">Prepare the shell for real auth without losing local speed.</h2>
          <p className="hero-copy">
            The backend already supports mock-header auth for development and JWT verification for a
            production path. This screen keeps both modes explicit and swappable without leaving
            bearer tokens in long-lived browser storage.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Mode" value={describeSessionMode(session.mode)} />
          <MetricAccent label="Ready" value={isReady ? 'Yes' : 'Needs setup'} />
          <MetricAccent label="Backend path" value="Mock + JWT" />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard
          title="Development mode"
          value={session.mode === 'mock' ? 1 : 0}
          note="Fast local work through explicit mock headers"
          icon={<TestTubeDiagonal size={18} />}
          tone="accent"
        />
        <MetricCard
          title="Production path"
          value={session.mode === 'bearer' ? 1 : 0}
          note="Bearer token wiring is now available in the client"
          icon={<KeyRound size={18} />}
          tone="neutral"
        />
        <MetricCard
          title="Operator risk"
          value={isReady ? 0 : 1}
          note="App state is visible before requests fail unexpectedly"
          icon={<ShieldEllipsis size={18} />}
          tone={isReady ? 'calm' : 'warning'}
        />
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Session mode</div>
              <h3>Choose how requests authenticate</h3>
            </div>
            <StatusPill tone={isReady ? 'calm' : 'warning'}>
              {isReady ? 'Ready' : 'Needs setup'}
            </StatusPill>
          </div>

          <div className="toolbar-cluster">
            <button
              className={`segmented-button${mode === 'mock' ? ' segmented-button-active' : ''}`}
              type="button"
              onClick={() => setDraft((current) => ({ ...current, mode: 'mock' }))}
            >
              Mock headers
            </button>
            <button
              className={`segmented-button${mode === 'bearer' ? ' segmented-button-active' : ''}`}
              type="button"
              onClick={() => setDraft((current) => ({ ...current, mode: 'bearer' }))}
            >
              Bearer token
            </button>
          </div>

          {mode === 'mock' ? (
            <div className="form-grid">
              <label className="field-block">
                <span>User id</span>
                <input
                  value={draft.mockUserId}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, mockUserId: event.target.value }))
                  }
                />
              </label>
              <label className="field-block">
                <span>Company ids</span>
                <input
                  value={draft.mockCompanyIds}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, mockCompanyIds: event.target.value }))
                  }
                />
              </label>
              <label className="field-block field-block-full">
                <span>Role codes</span>
                <input
                  value={draft.mockRoleCodes}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, mockRoleCodes: event.target.value }))
                  }
                />
              </label>
            </div>
          ) : (
            <label className="field-block">
              <span>Bearer token</span>
              <textarea
                className="field-textarea"
                value={draft.bearerToken}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, bearerToken: event.target.value }))
                }
                placeholder="Paste a JWT access token for a real auth flow"
              />
            </label>
          )}

          <div className="action-cluster">
            <button
              className="control-button"
              type="button"
              onClick={() => {
                saveSession(draft)
                setVerificationRequested(false)
              }}
            >
              Save session
            </button>
            <button
              className="control-button"
              type="button"
              onClick={() => {
                saveSession(draft)
                setVerificationRequested(true)
                void sessionQuery.refetch()
              }}
              disabled={!isReady}
            >
              Verify current session
            </button>
            <button
              className="control-button"
              type="button"
              onClick={() => {
                resetSession()
                setDraft({
                  mode: 'mock',
                  mockUserId: import.meta.env.VITE_USER_ID ?? '80000000-0000-0000-0000-000000000001',
                  mockRoleCodes:
                    import.meta.env.VITE_ROLE_CODES ??
                    'SUPER_ADMIN,INTEGRATION_ADMIN,SNAPSHOT_OPERATOR,REPORT_VIEWER,AUDITOR',
                  mockCompanyIds:
                    import.meta.env.VITE_COMPANY_IDS ?? '00000000-0000-0000-0000-000000000001',
                  bearerToken: import.meta.env.VITE_BEARER_TOKEN ?? '',
                })
                setVerificationRequested(false)
              }}
            >
              Reset to defaults
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Request preview</div>
              <h3>What the client will send</h3>
            </div>
          </div>

          <div className="key-grid">
            {requestPreview.map((item) => (
              <KeyValue key={item.label} label={item.label} value={item.value} />
            ))}
          </div>

          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Mock mode</strong>
                <StatusPill tone={session.mode === 'mock' ? 'accent' : 'neutral'}>Dev</StatusPill>
              </div>
              <p>Uses `x-user-id`, `x-role-codes`, and `x-company-ids` headers. Best for local admin iteration.</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Bearer mode</strong>
                <StatusPill tone={session.mode === 'bearer' ? 'accent' : 'neutral'}>Prod path</StatusPill>
              </div>
              <p>
                Sends `Authorization: Bearer ...`. The NestJS backend already has JWT verification
                support, so the remaining work later is IdP wiring, token acquisition, and role claims mapping.
                Tokens are now kept in session storage so they clear when the browser session ends.
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Session verification</div>
            <h3>Protected backend handshake</h3>
          </div>
          {verificationRequested ? (
            <StatusPill tone={sessionQuery.isSuccess ? 'calm' : sessionQuery.isError ? 'danger' : 'warning'}>
              {sessionQuery.isSuccess ? 'Verified' : sessionQuery.isError ? 'Rejected' : 'Checking'}
            </StatusPill>
          ) : (
            <StatusPill tone="neutral">Idle</StatusPill>
          )}
        </div>

        {!verificationRequested ? (
          <EmptyState copy="Save the session and run verification to confirm the current auth mode can reach a protected backend route." />
        ) : sessionQuery.isLoading ? (
          <ScreenState title="Verifying session" copy="Calling /api/auth/session with the currently saved auth mode." />
        ) : sessionQuery.isError ? (
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Verification failed</strong>
                <StatusPill tone="danger">Rejected</StatusPill>
              </div>
              <p>{sessionQuery.error instanceof Error ? sessionQuery.error.message : 'Unexpected auth verification error'}</p>
            </div>
          </div>
        ) : sessionQuery.data ? (
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Backend accepted the session</strong>
                <StatusPill tone="calm">{sessionQuery.data.authMode}</StatusPill>
              </div>
              <p>
                User <code>{sessionQuery.data.user.userId}</code> is authenticated with roles{' '}
                {sessionQuery.data.user.roleCodes.join(', ') || 'none'}.
              </p>
            </div>

            <div className="key-grid">
              <KeyValue label="Employee id" value={sessionQuery.data.user.employeeId ?? 'n/a'} />
              <KeyValue label="Company scopes" value={String(sessionQuery.data.scopeSummary.companyCount)} />
              <KeyValue label="Region scopes" value={String(sessionQuery.data.scopeSummary.regionCount)} />
              <KeyValue label="Store scopes" value={String(sessionQuery.data.scopeSummary.storeCount)} />
            </div>

            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>Resolved scope</strong>
                <StatusPill tone="accent">Claims + assignments</StatusPill>
              </div>
              <p>
                company ids: {sessionQuery.data.user.scope.companyIds.join(', ') || 'none'}
              </p>
              <p>
                region ids: {sessionQuery.data.user.scope.regionIds.join(', ') || 'none'}
              </p>
              <p>
                store ids: {sessionQuery.data.user.scope.storeIds.join(', ') || 'none'}
              </p>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  )
}

function truncateToken(token: string) {
  if (token.length < 18) {
    return token
  }

  return `${token.slice(0, 10)}...${token.slice(-6)}`
}
