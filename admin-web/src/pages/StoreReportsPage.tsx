import { BarChart3, FileText } from 'lucide-react'
import { useLocalization } from '../features/localization/useLocalization'
import {
  StoreInfoGrid,
  StoreSectionCard,
  StoreSurfaceHeader,
  StoreSurfacePage,
} from './store-surface-primitives'

export function StoreReportsPage() {
  const { t } = useLocalization()

  return (
    <StoreSurfacePage ariaLabel={t('storeHome.reports.aria')}>
      <StoreSurfaceHeader
        eyebrow={t('storeHome.reports.eyebrow')}
        title={t('storeHome.reports.surfaceTitle')}
        description={t('storeHome.reports.surfaceCopy')}
        badges={[
          { label: t('storeHome.reports.bridgeBadge'), tone: 'accent' },
          { label: t('storeHome.reports.flowBadge'), tone: 'neutral' },
        ]}
        action={{
          icon: <BarChart3 data-icon="inline-start" />,
          label: t('storeHome.reports.openAdminReports'),
          to: '/admin/reports',
        }}
      />

      <StoreSectionCard
        title={t('storeHome.reports.surfaceWorkflowTitle')}
        description={t('storeHome.reports.surfaceWorkflowCopy')}
        badge={{ label: t('storeHome.reports.flowBadge'), tone: 'accent' }}
      >
        <StoreInfoGrid
          items={[
            {
              label: t('storeHome.utility.primaryAction'),
              value: t('storeHome.reports.surfacePrimaryActionValue'),
              tone: 'accent',
            },
            {
              label: t('storeHome.reports.snapshotLabel'),
              value: t('storeHome.reports.snapshotValue'),
            },
            {
              label: t('storeHome.reports.kpiLabel'),
              value: t('storeHome.reports.kpiValue'),
              tone: 'calm',
            },
            {
              label: t('storeHome.reports.peopleLabel'),
              value: t('storeHome.reports.peopleValue'),
            },
          ]}
        />
      </StoreSectionCard>

      <StoreSectionCard
        title={t('storeHome.reports.usageTitle')}
        description={t('storeHome.reports.usageCopy')}
        action={{
          icon: <FileText data-icon="inline-start" />,
          label: t('storeHome.reports.openAdminReports'),
          to: '/admin/reports',
          variant: 'outline',
        }}
      >
        <StoreInfoGrid
          items={[
            {
              label: t('storeHome.reports.compareLabel'),
              value: t('storeHome.reports.compareValue'),
            },
            {
              label: t('storeHome.reports.exportLabel'),
              value: t('storeHome.reports.exportValue'),
            },
            {
              label: t('storeHome.reports.followupLabel'),
              value: t('storeHome.reports.followupValue'),
            },
          ]}
          className="tw:xl:grid-cols-3"
        />
      </StoreSectionCard>
    </StoreSurfacePage>
  )
}
