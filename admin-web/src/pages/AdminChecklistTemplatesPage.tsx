import { ClipboardList } from 'lucide-react'
import {
  EmptyState,
  KeyValue,
  MetricCard,
  StatusPill,
} from '../components/dashboard-primitives'
import { useLocalization } from '../features/localization/useLocalization'

export function AdminChecklistTemplatesPage() {
  const { t } = useLocalization()

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('adminChecklists.heroEyebrow')}</div>
          <h2 className="hero-title">{t('adminChecklists.heroTitle')}</h2>
          <p className="hero-copy">{t('adminChecklists.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <StatusPill tone="warning">{t('adminChecklists.draftPilot')}</StatusPill>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard
          title={t('adminChecklists.templateStatusTitle')}
          value={1}
          note={t('adminChecklists.templateStatusNote')}
          icon={<ClipboardList size={18} />}
          tone="accent"
        />
        <MetricCard
          title={t('adminChecklists.publishRuleTitle')}
          value={100}
          note={t('adminChecklists.publishRuleNote')}
          icon={<ClipboardList size={18} />}
          tone="calm"
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('adminChecklists.templateDraftEyebrow')}</div>
            <h3>{t('adminChecklists.templateManagementTitle')}</h3>
          </div>
          <StatusPill tone="accent">{t('adminChecklists.controlled')}</StatusPill>
        </div>
        <div className="key-grid">
          <KeyValue label={t('adminChecklists.templateType')} value="BM_STORE_VISIT" />
          <KeyValue label={t('adminChecklists.answerType')} value={t('adminChecklists.scoring')} />
          <KeyValue label={t('adminChecklists.publishControl')} value={t('adminChecklists.weightTotal')} />
          <KeyValue label={t('adminChecklists.nextLink')} value={t('adminChecklists.fullFormEditor')} />
        </div>
        <EmptyState
          title={t('adminChecklists.editorNextTitle')}
          copy={t('adminChecklists.editorNextCopy')}
        />
      </section>
    </section>
  )
}
