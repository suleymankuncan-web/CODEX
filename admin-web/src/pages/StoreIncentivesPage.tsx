import { ArrowRight, Coins, Eye, ShieldCheck, SlidersHorizontal, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  StatusPill,
} from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import { getDisplayRoleCodes } from '../features/auth/display'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'

const roleLabelKeys: Record<string, TranslationKey> = {
  STORE_MANAGER: 'storeIncentives.role.STORE_MANAGER',
  STORE_PERSONNEL: 'storeIncentives.role.STORE_PERSONNEL',
  SUPER_ADMIN: 'storeIncentives.role.SUPER_ADMIN',
  REPORT_VIEWER: 'storeIncentives.role.REPORT_VIEWER',
  REGION_MANAGER: 'storeIncentives.role.REGION_MANAGER',
  HR_ADMIN: 'storeIncentives.role.HR_ADMIN',
  VISUAL_MERCHANDISER: 'storeIncentives.role.VISUAL_MERCHANDISER',
}

function hasStoreShellIntent(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('STORE_MANAGER') || Boolean(authSummary?.user.scope.storeIds.length)
}

function formatRole(t: TranslateFunction, roleCode: string) {
  const key = roleLabelKeys[roleCode]
  return key ? t(key) : roleCode
}

function formatRoles(
  t: TranslateFunction,
  roleCodes: readonly string[] | null | undefined,
) {
  const displayRoles = getDisplayRoleCodes(roleCodes)
  return displayRoles.length > 0
    ? displayRoles.map((roleCode) => formatRole(t, roleCode)).join(', ')
    : t('storeIncentives.noResolvedRoles')
}

export function StoreIncentivesPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { t } = useLocalization()
  const user = input.authSummary?.user
  const primaryStoreId = user?.scope.storeIds[0] ?? null
  const storeIntent = hasStoreShellIntent(input.authSummary)

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">{t('storeIncentives.heroEyebrow')}</div>
          <h2 className="hero-title">{t('storeIncentives.title')}</h2>
          <p className="hero-copy">{t('storeIncentives.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('storeIncentives.route')} value="/store/incentives" />
          <MetricAccent
            label={t('storeIncentives.storeScope')}
            value={primaryStoreId ?? t('storeIncentives.noStoreScope')}
          />
          <MetricAccent
            label={t('storeIncentives.state')}
            value={t('storeIncentives.foundation')}
          />
        </div>
      </section>

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title={t('storeIncentives.visibilityShape')}
          value={1}
          note={t('storeIncentives.visibilityShapeNote')}
          icon={<Eye size={18} />}
          tone="accent"
        />
        <MetricCard
          title={t('storeIncentives.storeIntent')}
          value={storeIntent ? 1 : 0}
          note={t('storeIncentives.storeIntentNote')}
          icon={<ShieldCheck size={18} />}
          tone={storeIntent ? 'calm' : 'warning'}
        />
        <MetricCard
          title={t('storeIncentives.livePayouts')}
          value={0}
          note={t('storeIncentives.livePayoutsNote')}
          icon={<Wallet size={18} />}
          tone="warning"
        />
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeIncentives.futureStoreView')}</div>
              <h3>{t('storeIncentives.belongsTitle')}</h3>
            </div>
            <StatusPill tone="accent">{t('storeIncentives.preview')}</StatusPill>
          </div>
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('storeIncentives.storeLevelSnapshot')}</strong>
                <StatusPill tone="calm">{t('storeIncentives.readable')}</StatusPill>
              </div>
              <p>{t('storeIncentives.storeLevelSnapshotCopy')}</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('storeIncentives.explanationContext')}</strong>
                <StatusPill tone="warning">{t('storeIncentives.important')}</StatusPill>
              </div>
              <p>{t('storeIncentives.explanationContextCopy')}</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('storeIncentives.actionHandoff')}</strong>
                <StatusPill tone="accent">{t('storeIncentives.later')}</StatusPill>
              </div>
              <p>{t('storeIncentives.actionHandoffCopy')}</p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeIncentives.resolvedSession')}</div>
              <h3>{t('storeIncentives.shellFitTitle')}</h3>
            </div>
          </div>
          <div className="key-grid">
            <KeyValue
              label={t('storeIncentives.userId')}
              value={user?.userId ?? t('storeIncentives.sessionNotResolved')}
            />
            <KeyValue
              label={t('storeIncentives.roles')}
              value={formatRoles(t, user?.roleCodes)}
            />
            <KeyValue
              label={t('storeIncentives.storeIds')}
              value={user?.scope.storeIds.join(', ') || t('storeIncentives.none')}
            />
            <KeyValue
              label={t('storeIncentives.incentiveRouteFit')}
              value={
                storeIntent
                  ? t('storeIncentives.storeShellFit')
                  : t('storeIncentives.boundaryReady')
              }
            />
          </div>

          <div className="action-cluster">
            <Link className="control-button store-shell-link" to="/store/tasks">
              {t('storeIncentives.storeTasks')}
            </Link>
            <Link className="control-button store-shell-link" to="/store/kpis">
              {t('storeIncentives.storeKpis')}
            </Link>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('storeIncentives.notImplemented')}</div>
            <h3>{t('storeIncentives.notPretendTitle')}</h3>
          </div>
        </div>
        <EmptyState
          title={t('storeIncentives.emptyTitle')}
          copy={t('storeIncentives.emptyCopy')}
        />
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeIncentives.nextEvolution')}</div>
              <h3>{t('storeIncentives.nextTitle')}</h3>
            </div>
          </div>
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('storeIncentives.summaryCards')}</strong>
                <ArrowRight size={16} />
              </div>
              <p>{t('storeIncentives.summaryCardsCopy')}</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('storeIncentives.explanationDetail')}</strong>
                <ArrowRight size={16} />
              </div>
              <p>{t('storeIncentives.explanationDetailCopy')}</p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeIncentives.boundaryRule')}</div>
              <h3>{t('storeIncentives.boundaryTitle')}</h3>
            </div>
          </div>
          <div className="stacked-table">
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('storeIncentives.ruleGovernance')}</strong>
                <SlidersHorizontal size={16} />
              </div>
              <p>{t('storeIncentives.ruleGovernanceCopy')}</p>
            </div>
            <div className="stacked-row">
              <div className="stacked-row-head">
                <strong>{t('storeIncentives.storeConsumption')}</strong>
                <Coins size={16} />
              </div>
              <p>{t('storeIncentives.storeConsumptionCopy')}</p>
            </div>
          </div>
        </article>
      </section>

      <div className="action-cluster">
        <Link className="control-button store-shell-link" to="/store">
          {t('storeIncentives.backHome')}
        </Link>
        <Link className="control-button store-shell-link" to="/store/approvals">
          {t('storeIncentives.storeApprovals')}
        </Link>
      </div>
    </section>
  )
}
