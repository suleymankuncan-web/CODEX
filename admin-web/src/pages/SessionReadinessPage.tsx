import { useState } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { ArrowLeft, KeyRound, ShieldEllipsis, TestTubeDiagonal } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '../components/ui/button'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
import { getAuthSession, type AuthSessionSummary } from '../features/auth/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { normalizeDisplayLabel, resolveUserDisplayLabel } from '../lib/display-labels'
import { useSession } from '../features/session/session-context-value'
import {
  defaultSession,
  getBearerSessionCacheKey,
  isCookieBrowserSession,
} from '../features/session/session-storage'
import { SessionReadinessDevelopmentEditor } from './session-readiness-development-editor'
import {
  resolveSafeSessionStatus,
  resolveSessionReadinessDisplayPolicy,
  type SafeSessionStatus,
} from './session-readiness-display-policy'

const displayPolicy = resolveSessionReadinessDisplayPolicy(import.meta.env.DEV)

export function SessionReadinessPage() {
  const { t } = useLocalization()
  const { session, isReady, saveSession, resetSession } = useSession()
  const [draft, setDraft] = useState(session)
  const [verificationRequested, setVerificationRequested] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const safeStatus = resolveSafeSessionStatus(session)
  const authSessionKey = isCookieBrowserSession(session)
    ? session.browserSessionKey.trim() || 'cookie-session-missing'
    : getBearerSessionCacheKey(session.bearerToken)
  const sessionQuery = useQuery({
    queryKey:
      session.mode === 'bearer'
        ? ['auth-session', session.mode, session.browserSessionTransport, authSessionKey]
        : [
            'auth-session',
            session.mode,
            session.mockUserId,
            session.mockRoleCodes,
            session.mockCompanyIds,
            session.mockStoreIds,
            session.mockReadStoreIds,
            session.mockAssignedStoreIds,
            session.mockRegionIds,
            session.mockReadRegionIds,
          ],
    queryFn: getAuthSession,
    enabled: false,
    retry: false,
  })

  const verifyCurrentSession = () => {
    setVerificationRequested(true)
    void sessionQuery.refetch()
  }

  return (
    <section className="page-stack">
      <Link className="back-link" to="/admin/auth">
        <ArrowLeft size={16} />
        {t('sessionReadiness.backToAuth')}
      </Link>

      <section className="hero-panel">
        <div>
          <div className="eyebrow">
            {t(
              displayPolicy.canEditSession
                ? 'sessionReadiness.eyebrow'
                : 'sessionReadiness.readOnlyEyebrow',
            )}
          </div>
          <h2 className="hero-title">
            {t(
              displayPolicy.canEditSession
                ? 'sessionReadiness.heroTitle'
                : 'sessionReadiness.readOnlyHeroTitle',
            )}
          </h2>
          <p className="hero-copy">
            {t(
              displayPolicy.canEditSession
                ? 'sessionReadiness.heroCopy'
                : 'sessionReadiness.readOnlyHeroCopy',
            )}
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent
            label={t('sessionReadiness.mode')}
            value={formatSafeMode(safeStatus.mode, t)}
          />
          <MetricAccent
            label={t('sessionReadiness.ready')}
            value={isReady ? t('sessionReadiness.yes') : t('sessionReadiness.needsSetup')}
          />
          <MetricAccent
            label={t('sessionReadiness.transport')}
            value={formatSafeTransport(safeStatus.transport, t)}
          />
        </div>
      </section>

      {displayPolicy.canEditSession ? (
        <DevelopmentMetrics isReady={isReady} mode={session.mode} />
      ) : null}

      {displayPolicy.canEditSession ? (
        <section className="two-up-grid">
          <SessionReadinessDevelopmentEditor
            draft={draft}
            isReady={isReady}
            session={session}
            setDraft={setDraft}
            onSave={async () => {
              setSaveError(false)
              try {
                await saveSession(draft)
                setVerificationRequested(false)
              } catch {
                setSaveError(true)
              }
            }}
            onVerify={async () => {
              setSaveError(false)
              try {
                await saveSession(draft)
                setVerificationRequested(true)
                void sessionQuery.refetch()
              } catch {
                setSaveError(true)
              }
            }}
            onReset={async () => {
              setSaveError(false)
              try {
                await resetSession()
                setDraft(defaultSession)
                setVerificationRequested(false)
              } catch {
                setSaveError(true)
              }
            }}
          />
        </section>
      ) : (
        <SessionReadOnlyPanel
          isReady={isReady}
          safeStatus={safeStatus}
          onVerify={verifyCurrentSession}
        />
      )}

      {saveError ? (
        <ScreenState
          title={t('sessionReadiness.saveFailedTitle')}
          copy={t('sessionReadiness.saveFailedCopy')}
          tone="error"
        />
      ) : null}

      <SessionVerificationPanel
        sessionQuery={sessionQuery}
        verificationRequested={verificationRequested}
        showDevelopmentDiagnostics={displayPolicy.canEditSession}
      />
    </section>
  )
}

function DevelopmentMetrics(input: { isReady: boolean; mode: 'mock' | 'bearer' }) {
  const { t } = useLocalization()

  return (
    <section className="metric-grid">
      <MetricCard
        title={t('sessionReadiness.developmentMode')}
        value={input.mode === 'mock' ? 1 : 0}
        note={t('sessionReadiness.developmentModeNote')}
        icon={<TestTubeDiagonal size={18} />}
        tone="accent"
      />
      <MetricCard
        title={t('sessionReadiness.productionPath')}
        value={input.mode === 'bearer' ? 1 : 0}
        note={t('sessionReadiness.productionPathNote')}
        icon={<KeyRound size={18} />}
        tone="neutral"
      />
      <MetricCard
        title={t('sessionReadiness.operatorRisk')}
        value={input.isReady ? 0 : 1}
        note={t('sessionReadiness.operatorRiskNote')}
        icon={<ShieldEllipsis size={18} />}
        tone={input.isReady ? 'calm' : 'warning'}
      />
    </section>
  )
}

function SessionReadOnlyPanel(input: {
  isReady: boolean
  safeStatus: SafeSessionStatus
  onVerify: () => void
}) {
  const { t } = useLocalization()

  return (
    <section className="panel" data-testid="session-readonly-panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{t('sessionReadiness.readOnlyEyebrow')}</div>
          <h3>{t('sessionReadiness.readOnlyStatusTitle')}</h3>
        </div>
        <StatusPill tone={input.isReady ? 'calm' : 'warning'}>
          {input.isReady ? t('sessionReadiness.ready') : t('sessionReadiness.needsSetup')}
        </StatusPill>
      </div>
      <p>{t('sessionReadiness.readOnlyStatusCopy')}</p>
      <div className="key-grid">
        <KeyValue
          label={t('sessionReadiness.mode')}
          value={formatSafeMode(input.safeStatus.mode, t)}
        />
        <KeyValue
          label={t('sessionReadiness.transport')}
          value={formatSafeTransport(input.safeStatus.transport, t)}
        />
      </div>
      <div className="action-cluster">
        <Button type="button" onClick={input.onVerify} disabled={!input.isReady}>
          {t('sessionReadiness.verifyCurrentSession')}
        </Button>
      </div>
    </section>
  )
}

function SessionVerificationPanel(input: {
  sessionQuery: UseQueryResult<AuthSessionSummary, Error>
  verificationRequested: boolean
  showDevelopmentDiagnostics: boolean
}) {
  const { t } = useLocalization()
  const { sessionQuery, verificationRequested, showDevelopmentDiagnostics } = input

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{t('sessionReadiness.sessionVerification')}</div>
          <h3>{t('sessionReadiness.sessionVerificationTitle')}</h3>
        </div>
        <StatusPill
          tone={
            !verificationRequested
              ? 'neutral'
              : sessionQuery.isSuccess
                ? 'calm'
                : sessionQuery.isError
                  ? 'danger'
                  : 'warning'
          }
        >
          {!verificationRequested
            ? t('sessionReadiness.idle')
            : sessionQuery.isSuccess
              ? t('sessionReadiness.verified')
              : sessionQuery.isError
                ? t('sessionReadiness.rejected')
                : t('sessionReadiness.checking')}
        </StatusPill>
      </div>

      {!verificationRequested ? (
        <EmptyState
          copy={t(
            showDevelopmentDiagnostics
              ? 'sessionReadiness.verificationEmpty'
              : 'sessionReadiness.verificationReadOnlyEmpty',
          )}
        />
      ) : sessionQuery.isFetching ? (
        <ScreenState
          title={t('sessionReadiness.verifyingTitle')}
          copy={t(
            showDevelopmentDiagnostics
              ? 'sessionReadiness.verifyingCopy'
              : 'sessionReadiness.verificationReadOnlyCopy',
          )}
        />
      ) : sessionQuery.isError ? (
        <div className="stacked-table">
          <div className="stacked-row">
            <div className="stacked-row-head">
              <strong>{t('sessionReadiness.verificationFailed')}</strong>
              <StatusPill tone="danger">{t('sessionReadiness.rejected')}</StatusPill>
            </div>
            <p>
              {showDevelopmentDiagnostics && sessionQuery.error instanceof Error
                ? sessionQuery.error.message
                : t('sessionReadiness.unexpectedVerificationError')}
            </p>
          </div>
        </div>
      ) : sessionQuery.data ? (
        <VerificationSuccess
          data={sessionQuery.data}
          showDevelopmentDiagnostics={showDevelopmentDiagnostics}
        />
      ) : null}
    </section>
  )
}

function VerificationSuccess(input: {
  data: AuthSessionSummary
  showDevelopmentDiagnostics: boolean
}) {
  const { t } = useLocalization()
  const userLabel = resolveUserDisplayLabel(input.data.user, t('sessionReadiness.notAvailable'))
  const employeeLabel = normalizeDisplayLabel(
    input.data.user.employeeId,
    t('sessionReadiness.notAvailable'),
  )

  return (
    <div className="stacked-table">
      <div className="stacked-row">
        <div className="stacked-row-head">
          <strong>{t('sessionReadiness.backendAccepted')}</strong>
          <StatusPill tone="calm">{t('sessionReadiness.verified')}</StatusPill>
        </div>
        <p>
          {input.showDevelopmentDiagnostics
            ? t('sessionReadiness.backendAcceptedCopy', {
                userId: userLabel,
                roles: input.data.user.roleCodes.join(', ') || t('sessionReadiness.none'),
              })
            : t('sessionReadiness.verificationReadOnlyAcceptedCopy')}
        </p>
      </div>
      <div className="key-grid">
        {input.showDevelopmentDiagnostics ? (
          <KeyValue label={t('sessionReadiness.employeeId')} value={employeeLabel} />
        ) : null}
        <KeyValue
          label={t('sessionReadiness.companyScopes')}
          value={String(input.data.scopeSummary.companyCount)}
        />
        <KeyValue
          label={t('sessionReadiness.regionScopes')}
          value={String(input.data.scopeSummary.regionCount)}
        />
        <KeyValue
          label={t('sessionReadiness.storeScopes')}
          value={String(input.data.scopeSummary.storeCount)}
        />
      </div>
    </div>
  )
}

function formatSafeMode(mode: SafeSessionStatus['mode'], t: TranslateFunction) {
  return mode === 'provider'
    ? t('sessionReadiness.readOnlyModeProvider')
    : t('sessionReadiness.readOnlyModeLocal')
}

function formatSafeTransport(
  transport: SafeSessionStatus['transport'],
  t: TranslateFunction,
) {
  if (transport === 'browser_cookie') {
    return t('sessionReadiness.readOnlyTransportCookie')
  }

  return transport === 'provider_bearer'
    ? t('sessionReadiness.readOnlyTransportBearer')
    : t('sessionReadiness.readOnlyTransportLocal')
}
