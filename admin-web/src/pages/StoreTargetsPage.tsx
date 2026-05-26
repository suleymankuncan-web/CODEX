import { Target, UsersRound } from 'lucide-react'
import { useLocalization } from '../features/localization/useLocalization'
import {
  StoreInfoGrid,
  StoreSectionCard,
  StoreSurfaceHeader,
  StoreSurfacePage,
} from './store-surface-primitives'

export function StoreTargetsPage() {
  const { t } = useLocalization()

  return (
    <StoreSurfacePage ariaLabel={t('storeHome.targets.aria')}>
      <StoreSurfaceHeader
        eyebrow={t('storeHome.targets.eyebrow')}
        title={t('storeHome.targets.surfaceTitle')}
        description={t('storeHome.targets.surfaceCopy')}
        action={{
          icon: <Target data-icon="inline-start" />,
          label: t('storeHome.targets.openAdminTargets'),
          to: '/admin/targets',
        }}
      />

      <StoreSectionCard
        title={t('storeHome.targets.surfaceWorkflowTitle')}
        description={t('storeHome.targets.surfaceWorkflowCopy')}
        badge={{ label: t('storeHome.utility.statusPreference'), tone: 'accent' }}
      >
        <StoreInfoGrid
          items={[
            {
              label: t('storeHome.utility.primaryAction'),
              value: t('storeHome.targets.surfacePrimaryActionValue'),
              tone: 'accent',
            },
            {
              label: t('storeHome.targets.storeScopeLabel'),
              value: t('storeHome.targets.storeScopeValue'),
            },
            {
              label: t('storeHome.targets.teamImpactLabel'),
              value: t('storeHome.targets.teamImpactValue'),
              tone: 'calm',
            },
            {
              label: t('storeHome.targets.reviewLabel'),
              value: t('storeHome.targets.reviewValue'),
            },
          ]}
        />
      </StoreSectionCard>

      <StoreSectionCard
        title={t('storeHome.targets.usageTitle')}
        description={t('storeHome.targets.usageCopy')}
        action={{
          icon: <UsersRound data-icon="inline-start" />,
          label: t('storeHome.targets.openAdminTargets'),
          to: '/admin/targets',
          variant: 'outline',
        }}
      >
        <StoreInfoGrid
          items={[
            {
              label: t('storeHome.targets.requestLabel'),
              value: t('storeHome.targets.requestValue'),
            },
            {
              label: t('storeHome.targets.approvalLabel'),
              value: t('storeHome.targets.approvalValue'),
            },
            {
              label: t('storeHome.targets.visibilityLabel'),
              value: t('storeHome.targets.visibilityValue'),
            },
          ]}
          className="tw:xl:grid-cols-3"
        />
      </StoreSectionCard>
    </StoreSurfacePage>
  )
}
