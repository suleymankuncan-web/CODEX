import { ClipboardList, Clock3, Store, UsersRound } from 'lucide-react'
import type { AuthSessionSummary } from '../features/auth/api'
import { useLocalization } from '../features/localization/useLocalization'
import {
  StoreEmptyState,
  StoreInfoGrid,
  StoreSectionCard,
  StoreStackedList,
  StoreStackedRow,
  StoreStatusBadge,
  StoreSurfaceHeader,
  StoreSurfacePage,
} from './store-surface-primitives'

type WorkforceMode = 'region' | 'store'

function resolveWorkforceMode(authSummary: AuthSessionSummary | null): WorkforceMode {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('REGION_MANAGER') ? 'region' : 'store'
}

export function StoreWorkforcePage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { t } = useLocalization()
  const mode = resolveWorkforceMode(input.authSummary)
  const isRegion = mode === 'region'

  const overviewItems = [
    {
      label: t('storeWorkforce.personnelScope'),
      value: t('storeWorkforce.valuePending'),
      tone: 'warning' as const,
    },
    {
      label: t('storeWorkforce.averageTenure'),
      value: t('storeWorkforce.valuePending'),
      tone: 'warning' as const,
    },
    {
      label: t('storeWorkforce.normActual'),
      value: t('storeWorkforce.valueNotConfigured'),
      tone: 'neutral' as const,
    },
    {
      label: t('storeWorkforce.openMovements'),
      value: t('storeWorkforce.valueCurrentFlow'),
      tone: 'calm' as const,
    },
  ]

  const foundationRows = [
    {
      icon: <UsersRound size={18} />,
      title: isRegion ? t('storeWorkforce.regionPersonnelTitle') : t('storeWorkforce.storePersonnelTitle'),
      copy: isRegion ? t('storeWorkforce.regionPersonnelCopy') : t('storeWorkforce.storePersonnelCopy'),
    },
    {
      icon: <Clock3 size={18} />,
      title: t('storeWorkforce.tenureTitle'),
      copy: t('storeWorkforce.tenureCopy'),
    },
    {
      icon: <ClipboardList size={18} />,
      title: t('storeWorkforce.requestTitle'),
      copy: t('storeWorkforce.requestCopy'),
    },
  ]

  return (
    <StoreSurfacePage
      ariaLabel={t('storeWorkforce.title')}
      className="tw:mx-auto tw:w-full tw:max-w-7xl"
      testId="store-workforce-page"
    >
      <StoreSurfaceHeader
        eyebrow={t('storeWorkforce.eyebrow')}
        title={t('storeWorkforce.title')}
        description={isRegion ? t('storeWorkforce.regionDescription') : t('storeWorkforce.storeDescription')}
        badges={[
          {
            label: isRegion ? t('storeWorkforce.regionBadge') : t('storeWorkforce.storeBadge'),
            tone: 'accent',
          },
          {
            label: t('storeWorkforce.foundationBadge'),
            tone: 'warning',
          },
        ]}
        action={{
          label: t('storeWorkforce.openApprovals'),
          to: '/store/approvals',
          variant: 'outline',
          icon: <ClipboardList size={16} />,
        }}
      />

      <StoreInfoGrid items={overviewItems} />

      <StoreSectionCard
        title={t('storeWorkforce.foundationTitle')}
        description={t('storeWorkforce.foundationCopy')}
        badge={{
          label: t('storeWorkforce.foundationStatus'),
          tone: 'warning',
        }}
      >
        <StoreStackedList>
          {foundationRows.map((row) => (
            <StoreStackedRow
              key={row.title}
              className="tw:flex tw:items-start tw:gap-3"
            >
              <span className="tw:flex tw:size-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:bg-secondary tw:text-primary">
                {row.icon}
              </span>
              <span className="tw:flex tw:min-w-0 tw:flex-col tw:gap-1">
                <strong className="tw:text-sm tw:font-medium tw:text-foreground">{row.title}</strong>
                <span className="tw:text-sm tw:leading-6 tw:text-muted-foreground">{row.copy}</span>
              </span>
            </StoreStackedRow>
          ))}
        </StoreStackedList>
      </StoreSectionCard>

      <StoreSectionCard
        title={isRegion ? t('storeWorkforce.regionDetailTitle') : t('storeWorkforce.storeNextTitle')}
        badge={{
          label: isRegion ? t('storeWorkforce.detailAction') : t('storeWorkforce.safeFlow'),
          tone: isRegion ? 'neutral' : 'calm',
        }}
      >
        <StoreEmptyState
          title={isRegion ? t('storeWorkforce.regionDetailEmptyTitle') : t('storeWorkforce.storeEmptyTitle')}
          titleAsHeading
          description={isRegion ? t('storeWorkforce.regionDetailEmptyCopy') : t('storeWorkforce.storeEmptyCopy')}
          action={{
            label: t('storeWorkforce.openApprovals'),
            to: '/store/approvals',
            variant: 'secondary',
            icon: <Store size={16} />,
          }}
        />
        <div className="tw:mt-3 tw:flex tw:flex-wrap tw:gap-2" aria-label={t('storeWorkforce.safeStatesAria')}>
          <StoreStatusBadge tone="calm">{t('storeWorkforce.realRecordsPending')}</StoreStatusBadge>
          <StoreStatusBadge tone="neutral">{t('storeWorkforce.requestFlowPreserved')}</StoreStatusBadge>
          <StoreStatusBadge tone="warning">{t('storeWorkforce.currentFlowKept')}</StoreStatusBadge>
        </div>
      </StoreSectionCard>
    </StoreSurfacePage>
  )
}
