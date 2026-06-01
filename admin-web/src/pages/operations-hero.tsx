import { RadioTower } from 'lucide-react'
import type { TranslateFunction } from '../features/localization/dictionary'
import {
  AdminMetricStrip,
  AdminSurfaceHeader,
} from './admin-surface-primitives'
import {
  type OperationsTone,
} from './operations-surface-primitives'
import { toAdminSurfaceTone } from './operations-surface-tones'

export type SignalStatus = {
  copy: string
  label: string
  tone: OperationsTone
}

export function OperationsHero(input: {
  t: TranslateFunction
}) {
  return (
    <AdminSurfaceHeader
      eyebrow={input.t('adminOperations.heroEyebrow')}
      title={input.t('adminOperations.heroTitle')}
      description={input.t('adminOperations.heroCopy')}
      icon={<RadioTower size={18} />}
    />
  )
}

export function OperationsReadinessStrip(input: {
  operationalPressure: number
  providerBlockerCount: number
  readiness: SignalStatus
  t: TranslateFunction
}) {
  return (
    <AdminMetricStrip
      items={[
        {
          id: 'readiness',
          label: input.t('adminOperations.readiness'),
          value: input.readiness.label,
          description: input.readiness.copy,
          tone: toAdminSurfaceTone(input.readiness.tone),
        },
        {
          id: 'operator-pressure',
          label: input.t('adminOperations.operatorPressure'),
          value: input.operationalPressure,
          tone: input.operationalPressure > 0 ? 'warning' : 'success',
        },
        {
          id: 'external-blockers',
          label: input.t('adminOperations.externalBlockers'),
          value: input.providerBlockerCount,
          tone: input.providerBlockerCount > 0 ? 'warning' : 'success',
        },
      ]}
    />
  )
}
