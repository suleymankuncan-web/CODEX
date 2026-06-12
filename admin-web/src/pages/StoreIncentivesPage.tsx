import type { ReactNode } from 'react'
import { ArrowRight, Coins, Eye, ShieldCheck, SlidersHorizontal, Wallet } from 'lucide-react'
import {
  StoreEmptyState,
  StoreInfoGrid,
  StoreMetricCard,
  StoreMetricGrid,
  StoreSectionCard,
  StoreStackedList,
  StoreStackedRow,
  StoreStatusBadge,
  StoreSurfaceActionButton,
  StoreSurfaceHeader,
  StoreSurfacePage,
  type StoreSurfaceTone,
} from './store-surface-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import { canListTargetDistributionRequests } from '../features/auth/authorization'
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
  const showApprovalsLink = canListTargetDistributionRequests(input.authSummary)

  return (
    <StoreSurfacePage
      ariaLabel={t('storeIncentives.title')}
      className="tw:mx-auto tw:w-full tw:max-w-7xl"
    >
      <StoreSurfaceHeader
        eyebrow={t('storeIncentives.heroEyebrow')}
        title={t('storeIncentives.title')}
        description={t('storeIncentives.heroCopy')}
        badges={[
          {
            label: `${t('storeIncentives.storeScope')}: ${primaryStoreId ?? t('storeIncentives.noStoreScope')}`,
            tone: primaryStoreId ? 'calm' : 'warning',
          },
          {
            label: `${t('storeIncentives.state')}: ${t('storeIncentives.foundation')}`,
            tone: 'neutral',
          },
        ]}
      />

      <StoreMetricGrid>
        <StoreMetricCard
          title={t('storeIncentives.visibilityShape')}
          value={1}
          note={t('storeIncentives.visibilityShapeNote')}
          icon={<Eye size={18} />}
          tone="accent"
        />
        <StoreMetricCard
          title={t('storeIncentives.storeIntent')}
          value={storeIntent ? 1 : 0}
          note={t('storeIncentives.storeIntentNote')}
          icon={<ShieldCheck size={18} />}
          tone={storeIntent ? 'calm' : 'warning'}
        />
        <StoreMetricCard
          title={t('storeIncentives.livePayouts')}
          value={0}
          note={t('storeIncentives.livePayoutsNote')}
          icon={<Wallet size={18} />}
          tone="warning"
        />
      </StoreMetricGrid>

      <section className="tw:grid tw:gap-4 tw:lg:grid-cols-2">
        <StoreSectionCard
          title={t('storeIncentives.belongsTitle')}
          description={t('storeIncentives.futureStoreView')}
          badge={{ label: t('storeIncentives.preview'), tone: 'accent' }}
        >
          <StoreStackedList>
            <IncentiveReadinessRow
              title={t('storeIncentives.storeLevelSnapshot')}
              copy={t('storeIncentives.storeLevelSnapshotCopy')}
              badge={t('storeIncentives.readable')}
              tone="calm"
            />
            <IncentiveReadinessRow
              title={t('storeIncentives.explanationContext')}
              copy={t('storeIncentives.explanationContextCopy')}
              badge={t('storeIncentives.important')}
              tone="warning"
            />
            <IncentiveReadinessRow
              title={t('storeIncentives.actionHandoff')}
              copy={t('storeIncentives.actionHandoffCopy')}
              badge={t('storeIncentives.later')}
              tone="accent"
            />
          </StoreStackedList>
        </StoreSectionCard>

        <StoreSectionCard
          title={t('storeIncentives.shellFitTitle')}
          description={t('storeIncentives.resolvedSession')}
        >
          <StoreInfoGrid
            items={[
              {
                label: t('storeIncentives.userId'),
                value: user?.userId ?? t('storeIncentives.sessionNotResolved'),
              },
              {
                label: t('storeIncentives.roles'),
                value: formatRoles(t, user?.roleCodes),
              },
              {
                label: t('storeIncentives.storeIds'),
                value: user?.scope.storeIds.join(', ') || t('storeIncentives.none'),
              },
              {
                label: t('storeIncentives.incentiveRouteFit'),
                value: storeIntent
                  ? t('storeIncentives.storeShellFit')
                  : t('storeIncentives.boundaryReady'),
                tone: storeIntent ? 'calm' : 'warning',
              },
            ]}
          />

          <div className="tw:mt-4 tw:flex tw:flex-wrap tw:gap-2">
            <StoreSurfaceActionButton
              action={{
                label: t('storeIncentives.storeTasks'),
                to: '/store/tasks',
                variant: 'outline',
              }}
            />
            <StoreSurfaceActionButton
              action={{
                label: t('storeIncentives.storeKpis'),
                to: '/store/kpis',
                variant: 'outline',
              }}
            />
          </div>
        </StoreSectionCard>
      </section>

      <StoreSectionCard
        title={t('storeIncentives.notPretendTitle')}
        description={t('storeIncentives.notImplemented')}
      >
        <StoreEmptyState
          title={t('storeIncentives.emptyTitle')}
          description={t('storeIncentives.emptyCopy')}
        />
      </StoreSectionCard>

      <section className="tw:grid tw:gap-4 tw:lg:grid-cols-2">
        <StoreSectionCard
          title={t('storeIncentives.nextTitle')}
          description={t('storeIncentives.nextEvolution')}
        >
          <StoreStackedList>
            <IncentiveIconRow
              title={t('storeIncentives.summaryCards')}
              copy={t('storeIncentives.summaryCardsCopy')}
              icon={<ArrowRight size={16} />}
            />
            <IncentiveIconRow
              title={t('storeIncentives.explanationDetail')}
              copy={t('storeIncentives.explanationDetailCopy')}
              icon={<ArrowRight size={16} />}
            />
          </StoreStackedList>
        </StoreSectionCard>

        <StoreSectionCard
          title={t('storeIncentives.boundaryTitle')}
          description={t('storeIncentives.boundaryRule')}
        >
          <StoreStackedList>
            <IncentiveIconRow
              title={t('storeIncentives.ruleGovernance')}
              copy={t('storeIncentives.ruleGovernanceCopy')}
              icon={<SlidersHorizontal size={16} />}
            />
            <IncentiveIconRow
              title={t('storeIncentives.storeConsumption')}
              copy={t('storeIncentives.storeConsumptionCopy')}
              icon={<Coins size={16} />}
            />
          </StoreStackedList>
        </StoreSectionCard>
      </section>

      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <StoreSurfaceActionButton
          action={{
            label: t('storeIncentives.backHome'),
            to: '/store',
            variant: 'outline',
          }}
        />
        {showApprovalsLink ? (
          <StoreSurfaceActionButton
            action={{
              label: t('storeIncentives.storeApprovals'),
              to: '/store/approvals',
              variant: 'outline',
            }}
          />
        ) : null}
      </div>
    </StoreSurfacePage>
  )
}

function IncentiveReadinessRow(input: {
  title: string
  copy: string
  badge: string
  tone: StoreSurfaceTone
}) {
  return (
    <StoreStackedRow tone={input.tone} className="tw:flex tw:flex-col tw:gap-2">
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
        <strong className="tw:text-sm tw:font-semibold tw:text-foreground">{input.title}</strong>
        <StoreStatusBadge tone={input.tone}>{input.badge}</StoreStatusBadge>
      </div>
      <p className="tw:text-sm tw:leading-6 tw:text-muted-foreground">{input.copy}</p>
    </StoreStackedRow>
  )
}

function IncentiveIconRow(input: {
  title: string
  copy: string
  icon: ReactNode
}) {
  return (
    <StoreStackedRow className="tw:flex tw:flex-col tw:gap-2">
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
        <strong className="tw:text-sm tw:font-semibold tw:text-foreground">{input.title}</strong>
        <span className="tw:text-primary">{input.icon}</span>
      </div>
      <p className="tw:text-sm tw:leading-6 tw:text-muted-foreground">{input.copy}</p>
    </StoreStackedRow>
  )
}
