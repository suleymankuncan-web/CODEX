import { Activity, ServerCog, ShieldCheck } from 'lucide-react'
import type { TranslateFunction } from '../features/localization/dictionary'
import {
  AdminSurfaceBadge,
  type AdminMetricStripItem,
  AdminMetricStrip,
} from './admin-surface-primitives'
import { AdminAzureHeader } from './admin-azure-header'
import type { SignalStatus } from './operations-hero'
import { toAdminSurfaceTone, type OperationsTone } from './operations-surface-tones'

type BackendMetric = {
  copy: string
  label: string
  tone: OperationsTone
}

export function OperationsCommandHeader(input: {
  backendMetric: BackendMetric
  hasSignalError: boolean
  operationalPressure: number
  providerBlockerCount: number
  readiness: SignalStatus
  t: TranslateFunction
}) {
  const primaryMetrics: AdminMetricStripItem[] = [
    {
      description: input.readiness.copy,
      icon: <ShieldCheck size={18} />,
      id: 'readiness',
      label: input.t('adminOperations.readiness'),
      tone: toAdminSurfaceTone(input.readiness.tone),
      value: input.readiness.label,
    },
    {
      icon: <Activity size={18} />,
      id: 'operator-pressure',
      label: input.t('adminOperations.operatorPressure'),
      tone: input.operationalPressure > 0 ? 'warning' : 'success',
      value: input.operationalPressure,
    },
    {
      icon: <ShieldCheck size={18} />,
      id: 'external-blockers',
      label: input.t('adminOperations.externalBlockers'),
      tone: input.providerBlockerCount > 0 ? 'warning' : 'success',
      value: input.providerBlockerCount,
    },
    {
      description: input.backendMetric.copy,
      icon: <ServerCog size={18} />,
      id: 'backend',
      label: input.t('adminOperations.metric.backend'),
      tone: toAdminSurfaceTone(input.backendMetric.tone),
      value: input.backendMetric.label,
    },
  ]

  return (
    <>
      <AdminAzureHeader
        title={input.t('adminOperations.heroEyebrow')}
        icon={<ServerCog size={18} />}
        actions={
          <>
            <AdminSurfaceBadge tone={input.operationalPressure > 0 ? 'warning' : 'success'}>
              {input.t('adminOperations.operatorPressure')}: {input.operationalPressure}
            </AdminSurfaceBadge>
            <AdminSurfaceBadge tone={input.hasSignalError ? 'warning' : 'success'}>
              {input.hasSignalError ? input.t('adminOperations.unavailable') : input.t('adminOperations.ready')}
            </AdminSurfaceBadge>
          </>
        }
      />
      <AdminMetricStrip className="operations-overview-metrics" items={primaryMetrics} />
    </>
  )
}
