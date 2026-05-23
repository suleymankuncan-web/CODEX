import { MetricAccent, type Tone } from '../components/dashboard-primitives'
import type { TranslateFunction } from '../features/localization/dictionary'

export type SignalStatus = {
  copy: string
  label: string
  tone: Tone
}

export function OperationsHero(input: {
  operationalPressure: number
  providerBlockerCount: number
  readiness: SignalStatus
  t: TranslateFunction
}) {
  return (
    <section className="hero-panel">
      <div>
        <div className="eyebrow">{input.t('adminOperations.heroEyebrow')}</div>
        <h2 className="hero-title">{input.t('adminOperations.heroTitle')}</h2>
        <p className="hero-copy">{input.t('adminOperations.heroCopy')}</p>
      </div>
      <div className="hero-metrics">
        <MetricAccent label={input.t('adminOperations.readiness')} value={input.readiness.label} />
        <MetricAccent
          label={input.t('adminOperations.operatorPressure')}
          value={String(input.operationalPressure)}
        />
        <MetricAccent
          label={input.t('adminOperations.externalBlockers')}
          value={String(input.providerBlockerCount)}
        />
      </div>
    </section>
  )
}
