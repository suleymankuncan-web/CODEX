import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { formatNumber } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import type { ChecklistTone } from './store-checklists-model'
import { formatMonthKey, formatOptionalDate, getStaticCopy } from './store-checklists-logic'
import type { VisitPlanRow, VisitRiskLevel } from './store-visit-plan-model'
import { ChecklistBadge, ChecklistEmptyBlock, ChecklistMetric } from './store-checklists-atoms'

export function StoreChecklistsVisitPlan(input: {
  assignedVisitStoreCount: number
  evaluationMonth: string
  locale: AppLocale
  rows: VisitPlanRow[]
  selectedMonth: string
  t: TranslateFunction
  visibleTemplateCount: number
  onOpenVisits: () => void
}) {
  const highRiskCount = input.rows.filter((row) => row.riskLevel === 'high').length
  const mediumRiskCount = input.rows.filter((row) => row.riskLevel === 'medium').length
  const lowRiskCount = input.rows.filter((row) => row.riskLevel === 'low').length
  const periodLabel =
    input.selectedMonth === 'all'
      ? input.t('storeChecklists.visitPlan.currentMonthEvaluation')
      : formatMonthKey(input.evaluationMonth, input.locale)

  return (
    <section
      aria-labelledby="store-checklist-tab-plan"
      className="store-checklists-command-card"
      id="store-checklist-panel-plan"
      role="tabpanel"
    >
      <div className="store-checklists-section-head">
        <div>
          <div className="store-checklists-eyebrow">
            {input.t('storeChecklists.visitPlanEyebrow')}
          </div>
          <h3>{input.t('storeChecklists.visitPlanTitle')}</h3>
          <p>{input.t('storeChecklists.visitPlanCopy', { period: periodLabel })}</p>
        </div>
        <ChecklistBadge tone={highRiskCount > 0 ? 'danger' : 'calm'}>
          {highRiskCount > 0
            ? input.t('storeChecklists.visitPlan.highRiskCount', { count: highRiskCount })
            : input.t('storeChecklists.visitPlan.ready')}
        </ChecklistBadge>
      </div>

      <div className="store-checklists-plan-summary" aria-label={input.t('storeChecklists.visitPlanSummaryAria')}>
        <ChecklistMetric
          label={input.t('storeChecklists.visitPlanSummary.high')}
          tone={highRiskCount > 0 ? 'danger' : 'neutral'}
          value={formatNumber(highRiskCount, input.locale)}
        />
        <ChecklistMetric
          label={input.t('storeChecklists.visitPlanSummary.medium')}
          tone={mediumRiskCount > 0 ? 'warning' : 'neutral'}
          value={formatNumber(mediumRiskCount, input.locale)}
        />
        <ChecklistMetric
          label={input.t('storeChecklists.visitPlanSummary.low')}
          tone={lowRiskCount > 0 ? 'calm' : 'neutral'}
          value={formatNumber(lowRiskCount, input.locale)}
        />
      </div>

      {input.assignedVisitStoreCount === 0 ? (
        <ChecklistEmptyBlock
          title={input.t('storeChecklists.visitPlan.emptyStoresTitle')}
          copy={input.t('storeChecklists.visitPlan.emptyStoresCopy')}
        />
      ) : input.visibleTemplateCount === 0 ? (
        <ChecklistEmptyBlock
          title={input.t('storeChecklists.visitPlan.emptyTemplatesTitle')}
          copy={input.t('storeChecklists.visitPlan.emptyTemplatesCopy')}
        />
      ) : input.rows.length === 0 ? (
        <ChecklistEmptyBlock
          title={input.t('storeChecklists.visitPlan.emptyFilteredTitle')}
          copy={input.t('storeChecklists.visitPlan.emptyFilteredCopy')}
        />
      ) : (
        <div className="store-checklists-plan-list">
          {input.rows.map((row) => (
            <VisitPlanRowCard
              key={row.storeId}
              locale={input.locale}
              row={row}
              t={input.t}
              onOpenVisits={input.onOpenVisits}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function VisitPlanRowCard(input: {
  locale: AppLocale
  row: VisitPlanRow
  t: TranslateFunction
  onOpenVisits: () => void
}) {
  const tone = getVisitPlanTone(input.row.riskLevel)

  return (
    <article className={`store-checklists-plan-row store-checklists-plan-row-${input.row.riskLevel}`}>
      <div className="store-checklists-plan-store">
        <strong>{input.row.storeName}</strong>
        <ChecklistBadge tone={tone}>{getVisitPlanRiskLabel(input.t, input.row.riskLevel)}</ChecklistBadge>
      </div>

      <div className="store-checklists-plan-scores" aria-label={input.t('storeChecklists.visitPlanScoresAria')}>
        {input.row.bmScore !== null ? (
          <VisitPlanScoreChip label={getStaticCopy(input.locale, 'BM', 'BM')} score={input.row.bmScore} locale={input.locale} />
        ) : null}
        {input.row.vmScore !== null ? (
          <VisitPlanScoreChip label={getStaticCopy(input.locale, 'VM', 'VM')} score={input.row.vmScore} locale={input.locale} />
        ) : null}
        <span className="store-checklists-plan-date">
          <small>{input.t('storeChecklists.visitPlan.lastVisit')}</small>
          <b>{formatOptionalDate(input.row.lastVisitAt, input.locale)}</b>
        </span>
      </div>

      <div className="store-checklists-plan-reasons" aria-label={input.t('storeChecklists.visitPlanReasonsAria')}>
        {input.row.reasons.map((reason) => (
          <span
            className={`store-checklists-plan-reason store-checklists-plan-reason-${reason.severity}`}
            key={reason.code}
          >
            {input.t(`storeChecklists.visitPlanReason.${reason.code}` as TranslationKey)}
          </span>
        ))}
      </div>

      <Button
        className="store-checklists-plan-action store-checklists-action-button store-checklists-action-button-muted"
        type="button"
        variant="outline"
        onClick={input.onOpenVisits}
      >
        {input.t('storeChecklists.visitPlan.action')}
        <ChevronRight data-icon="inline-end" />
      </Button>
    </article>
  )
}

function VisitPlanScoreChip(input: { label: string; locale: AppLocale; score: number | null }) {
  return (
    <span className="store-checklists-plan-score">
      <small>{input.label}</small>
      <b>{input.score === null ? '-' : formatNumber(input.score, input.locale)}</b>
      <em>/100</em>
    </span>
  )
}

function getVisitPlanTone(riskLevel: VisitRiskLevel): ChecklistTone {
  if (riskLevel === 'high') return 'danger'
  if (riskLevel === 'medium') return 'warning'
  return 'calm'
}

function getVisitPlanRiskLabel(t: TranslateFunction, riskLevel: VisitRiskLevel) {
  if (riskLevel === 'high') return t('storeChecklists.visitPlanRisk.high')
  if (riskLevel === 'medium') return t('storeChecklists.visitPlanRisk.medium')
  return t('storeChecklists.visitPlanRisk.low')
}
