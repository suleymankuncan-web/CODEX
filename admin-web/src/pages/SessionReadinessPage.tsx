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
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { useSession } from '../features/session/session-context-value'
import { getBearerSessionCacheKey, type SessionMode } from '../features/session/session-storage'

export function SessionReadinessPage() {
  const { t } = useLocalization()
  const { session, isReady, saveSession, resetSession } = useSession()
  const [draft, setDraft] = useState(session)
  const [verificationRequested, setVerificationRequested] = useState(false)
  const mode = draft.mode
  const sessionModeLabel = formatSessionMode(session.mode, t)
  const readinessLabel = isReady ? t('sessionReadiness.yes') : t('sessionReadiness.needsSetup')
  const bearerSessionKey = getBearerSessionCacheKey(session.bearerToken)
  const sessionQuery = useQuery({
    queryKey:
      session.mode === 'bearer'
        ? ['auth-session', session.mode, bearerSessionKey]
        : ['auth-session', session.mode, session.mockUserId, session.mockRoleCodes, session.mockCompanyIds],
    queryFn: getAuthSession,
    enabled: verificationRequested && isReady,
    retry: false,
  })

  const requestPreview = useMemo(() => {
    if (mode === 'bearer') {
      return draft.bearerToken
        ? [{ label: 'Authorization', value: `Bearer ${truncateToken(draft.bearerToken)}` }]
        : [{ label: 'Authorization', value: t('sessionReadiness.noTokenSetYet') }]
    }

    return [
      { label: 'x-user-id', value: draft.mockUserId },
      { label: 'x-role-codes', value: draft.mockRoleCodes },
      { label: 'x-company-ids', value: draft.mockCompanyIds },
    ]
  }, [draft, mode, t])

  return (
    <section className="page-stack">
      <Link className="back-link" to="/admin/auth">
        <ArrowLeft size={16} />
        {t('sessionReadiness.backToAuth')}
      </Link>

      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('sessionReadiness.eyebrow')}</div>
          <h2 className="hero-title">{t('sessionReadiness.heroTitle')}</h2>
          <p className="hero-copy">{t('sessionReadiness.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('sessionReadiness.mode')} value={sessionModeLabel} />
          <MetricAccent label={t('sessionReadiness.ready')} value={readinessLabel} />
          <MetricAccent label={t('sessionReadiness.backendPath')} value="Mock + JWT" />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard
          title={t('sessionReadiness.developmentMode')}
          value={session.mode === 'mock' ? 1 : 0}
          note={t('sessionReadiness.developmentModeNote')}
          icon={<TestTubeDiagonal size={18} />}
          tone="accent"
        />
        <MetricCard
          title={t('sessionReadiness.productionPath')}
          value={session.mode === 'bearer' ? 1 : 0}
          note={t('sessionReadiness.productionPathNote')}
          icon={<KeyRound size={18} />}
          tone="neutral"
        />
        <MetricCard
          title={t('sessionReadiness.operatorRisk')}
          value={isReady ? 0 : 1}
          note={t('sessionReadiness.operatorRiskNote')}
          icon={<ShieldEllipsis size={18} />}
          tone={isReady ? 'calm' : 'warning'}
        />
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('sessionReadiness.sessionMode')}</div>
              <h3>{t('sessionReadiness.sessionModeTitle')}</h3>
            </div>
            <StatusPill tone={isReady ? 'calm' : 'warning'}>
              {isReady ? t('sessionReadiness.ready') : t('sessionReadiness.needsSetup')}
            </StatusPill>
          </div>

          <div className="toolbar-cluster">
            <button
              className={`segmented-button${mode === 'mock' ? ' segmented-button-active' : ''}`}
              type="button"
              onClick={() => setDraft((current) => ({ ...current, mode: 'mock' }))}
            >
              {t('sessionReadiness.mockHeaders')}
            </button>
            <button
              className={`segmented-button${mode === 'bearer' ? ' segmented-button-active' : ''}`}
              type="button"
              onClick={() => setDraft((current) => ({ ...current, mode: 'bearer' }))}
            >
              {t('sessionReadiness.bearerToken')}
            </button>
          </div>

          {mode === 'mock' ? (
            <div className="form-grid">
              <label className="field-block">
                <span>{t('sessionReadiness.userId')}</span>
                <input
                  value={draft.mockUserId}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, mockUserId: event.target.value }))
                  }
                />
              </label>
              <label className="field-block">
                <span>{t('sessionReadiness.companyIds')}</span>
                <input
                  value={draft.mockCompanyIds}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, mockCompanyIds: event.target.value }))
                  }
                />
              </label>
              <label className="field-block field-block-full">
                <span>{t('sessionReadiness.roleCodes')}</span>
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
              <span>{t('sessionReadiness.bearerToken')}</span>
              <textarea
                className="field-textarea"
                value={draft.bearerToken}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, bearerToken: event.target.value }))
                }
                placeholder={t('sessionReadiness.bearerPlaceholder')}
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
              {t('sessionReadiness.saveSession')}
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
              {t('sessionReadiness.verifyCurrentSession')}
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
              {t('sessionReadiness.resetToDefaults')}
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('sessionReadiness.requestPreview')}</div>
              <h3>{t('sessionReadiness.requestPreviewTitle')}</h3>
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
                <strong>{t('sessionReadiness.mockMode')}</strong>
                <StatusPill tone={session.mode === 'mock' ? 'accent' : 'neutral'}>
                  {t('sessionReadiness.dev')}
                </StatusPill>
              </div>
              <p>{t('sessionReadiness.mockModeCopy')}</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('sessionReadiness.bearerMode')}</strong>
                <StatusPill tone={session.mode === 'bearer' ? 'accent' : 'neutral'}>
                  {t('sessionReadiness.prodPath')}
                </StatusPill>
              </div>
              <p>{t('sessionReadiness.bearerModeCopy')}</p>
            </div>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('sessionReadiness.sessionVerification')}</div>
            <h3>{t('sessionReadiness.sessionVerificationTitle')}</h3>
          </div>
          {verificationRequested ? (
            <StatusPill tone={sessionQuery.isSuccess ? 'calm' : sessionQuery.isError ? 'danger' : 'warning'}>
              {sessionQuery.isSuccess
                ? t('sessionReadiness.verified')
                : sessionQuery.isError
                  ? t('sessionReadiness.rejected')
                  : t('sessionReadiness.checking')}
            </StatusPill>
          ) : (
            <StatusPill tone="neutral">{t('sessionReadiness.idle')}</StatusPill>
          )}
        </div>

        {!verificationRequested ? (
          <EmptyState copy={t('sessionReadiness.verificationEmpty')} />
        ) : sessionQuery.isLoading ? (
          <ScreenState
            title={t('sessionReadiness.verifyingTitle')}
            copy={t('sessionReadiness.verifyingCopy')}
          />
        ) : sessionQuery.isError ? (
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('sessionReadiness.verificationFailed')}</strong>
                <StatusPill tone="danger">{t('sessionReadiness.rejected')}</StatusPill>
              </div>
              <p>
                {sessionQuery.error instanceof Error
                  ? sessionQuery.error.message
                  : t('sessionReadiness.unexpectedVerificationError')}
              </p>
            </div>
          </div>
        ) : sessionQuery.data ? (
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('sessionReadiness.backendAccepted')}</strong>
                <StatusPill tone="calm">{sessionQuery.data.authMode}</StatusPill>
              </div>
              <p>
                {t('sessionReadiness.backendAcceptedCopy', {
                  userId: sessionQuery.data.user.userId,
                  roles: sessionQuery.data.user.roleCodes.join(', ') || t('sessionReadiness.none'),
                })}
              </p>
            </div>

            <div className="key-grid">
              <KeyValue
                label={t('sessionReadiness.employeeId')}
                value={sessionQuery.data.user.employeeId ?? t('sessionReadiness.notAvailable')}
              />
              <KeyValue
                label={t('sessionReadiness.companyScopes')}
                value={String(sessionQuery.data.scopeSummary.companyCount)}
              />
              <KeyValue
                label={t('sessionReadiness.regionScopes')}
                value={String(sessionQuery.data.scopeSummary.regionCount)}
              />
              <KeyValue
                label={t('sessionReadiness.storeScopes')}
                value={String(sessionQuery.data.scopeSummary.storeCount)}
              />
            </div>

            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('sessionReadiness.resolvedScope')}</strong>
                <StatusPill tone="accent">{t('sessionReadiness.claimsAssignments')}</StatusPill>
              </div>
              <p>
                {t('sessionReadiness.companyIdsLabel')}{' '}
                {sessionQuery.data.user.scope.companyIds.join(', ') || t('sessionReadiness.none')}
              </p>
              <p>
                {t('sessionReadiness.regionIdsLabel')}{' '}
                {sessionQuery.data.user.scope.regionIds.join(', ') || t('sessionReadiness.none')}
              </p>
              <p>
                {t('sessionReadiness.storeIdsLabel')}{' '}
                {sessionQuery.data.user.scope.storeIds.join(', ') || t('sessionReadiness.none')}
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

function formatSessionMode(mode: SessionMode, t: TranslateFunction) {
  return mode === 'bearer' ? t('sessionReadiness.bearerToken') : t('sessionReadiness.mockHeaders')
}
