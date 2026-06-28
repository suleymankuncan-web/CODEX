import { ChevronRight, Store as StoreIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ChecklistAcknowledgementItem } from '../features/checklists/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { normalizeDisplayLabel } from '../lib/display-labels'
import { formatNumber } from '../lib/format'
import { getIntlLocale, type AppLocale } from '../lib/i18n'
import type {
  ChecklistSort,
  ChecklistSortKey,
  ChecklistTab,
  ChecklistTone,
} from './store-checklists-model'
import {
  formatChecklistTemplateType,
  formatScoreValue,
  getChecklistResultDigest,
  getLowScoreResponses,
  getStaticCopy,
} from './store-checklists-logic'
import {
  ChecklistBadge,
  ChecklistEmptyBlock,
  SortButton,
} from './store-checklists-atoms'

export function StoreChecklistsAcknowledgementPanels(input: {
  filteredAcknowledgedItems: ChecklistAcknowledgementItem[]
  filteredPendingItems: ChecklistAcknowledgementItem[]
  locale: AppLocale
  pendingItemCount: number
  resultSort: ChecklistSort
  selectedTab: ChecklistTab
  t: TranslateFunction
  onOpenResult: (item: ChecklistAcknowledgementItem) => void
  onToggleResultSort: (key: ChecklistSortKey) => void
}) {
  return (
    <>
      {input.selectedTab === 'inbox' ? (
        <section
          aria-labelledby="store-checklist-tab-inbox"
          className="store-checklists-command-card"
          id="store-checklist-panel-inbox"
          role="tabpanel"
        >
          <div className="store-checklists-section-head">
            <div>
              <div className="store-checklists-eyebrow">{input.t('storeChecklists.inboxEyebrow')}</div>
              <h3>{input.t('storeChecklists.inboxTitle')}</h3>
            </div>
            <ChecklistBadge tone={input.pendingItemCount > 0 ? 'accent' : 'calm'}>
              {input.pendingItemCount > 0
                ? input.t('storeChecklists.needsAcknowledgement')
                : input.t('storeChecklists.clear')}
            </ChecklistBadge>
          </div>

          {input.filteredPendingItems.length === 0 ? (
            <ChecklistEmptyBlock
              copy={input.t('storeChecklists.noPendingCopy')}
              title={input.t('storeChecklists.noPendingTitle')}
            />
          ) : (
            <ChecklistResultList
              items={input.filteredPendingItems}
              locale={input.locale}
              resultSort={input.resultSort}
              t={input.t}
              onOpen={input.onOpenResult}
              onSort={input.onToggleResultSort}
            />
          )}
        </section>
      ) : null}

      {input.selectedTab === 'history' ? (
        <section
          aria-labelledby="store-checklist-tab-history"
          className="store-checklists-command-card"
          id="store-checklist-panel-history"
          role="tabpanel"
        >
          <div className="store-checklists-section-head">
            <div>
              <div className="store-checklists-eyebrow">{input.t('storeChecklists.recentHistoryEyebrow')}</div>
              <h3>{input.t('storeChecklists.recentHistoryTitle')}</h3>
            </div>
          </div>

          {input.filteredAcknowledgedItems.length === 0 ? (
            <ChecklistEmptyBlock
              copy={input.t('storeChecklists.noAcknowledgementsCopy')}
              title={input.t('storeChecklists.noAcknowledgementsTitle')}
            />
          ) : (
            <ChecklistResultList
              items={input.filteredAcknowledgedItems}
              locale={input.locale}
              resultSort={input.resultSort}
              t={input.t}
              onOpen={input.onOpenResult}
              onSort={input.onToggleResultSort}
            />
          )}
        </section>
      ) : null}
    </>
  )
}

function ChecklistResultList(input: {
  items: ChecklistAcknowledgementItem[]
  locale: AppLocale
  resultSort: ChecklistSort
  t: TranslateFunction
  onOpen: (item: ChecklistAcknowledgementItem) => void
  onSort: (key: ChecklistSortKey) => void
}) {
  return (
    <div className="store-checklists-table store-checklists-result-table">
      <div className="store-checklists-table-head">
        <SortButton
          active={input.resultSort.key === 'store'}
          direction={input.resultSort.direction}
          onClick={() => input.onSort('store')}
        >
          {input.t('storeChecklists.store')}
        </SortButton>
        <SortButton
          active={input.resultSort.key === 'score'}
          direction={input.resultSort.direction}
          onClick={() => input.onSort('score')}
        >
          {input.t('storeChecklists.score')}
        </SortButton>
        <SortButton
          active={input.resultSort.key === 'status'}
          direction={input.resultSort.direction}
          onClick={() => input.onSort('status')}
        >
          {input.t('storeChecklists.status')}
        </SortButton>
        <SortButton
          active={input.resultSort.key === 'date'}
          direction={input.resultSort.direction}
          onClick={() => input.onSort('date')}
        >
          {getStaticCopy(input.locale, 'Tamamlanma', 'Completed')}
        </SortButton>
        <span>{getStaticCopy(input.locale, 'Aksiyon', 'Action')}</span>
      </div>
      {input.items.map((item) => (
        <ChecklistResultRow
          item={item}
          key={item.checklistInstanceId}
          locale={input.locale}
          onOpen={() => input.onOpen(item)}
          t={input.t}
        />
      ))}
    </div>
  )
}

function ChecklistResultRow(input: {
  item: ChecklistAcknowledgementItem
  locale: AppLocale
  onOpen: () => void
  t: TranslateFunction
}) {
  const hasAcknowledgement = input.item.acknowledgement !== null
  const scorePercent = input.item.totalScore
    ?? (typeof input.item.complianceRate === 'number' ? Math.round(input.item.complianceRate * 100) : null)
  const digest = getChecklistResultDigest(input.t, input.locale, input.item)
  const rowTone = getResultRowTone(scorePercent, hasAcknowledgement, digest.tone)
  const lowScoreCount = getLowScoreResponses(input.item.responses).length
  const statusLabel = hasAcknowledgement
    ? input.t('storeChecklists.acknowledged')
    : input.t('storeChecklists.needsAcknowledgement')
  const storeLabel = normalizeDisplayLabel(input.item.storeName, input.t('storeChecklists.unknown'))

  return (
    <article className={`store-checklists-history-row store-checklists-result-row store-checklists-visit-row store-checklists-visit-row-${rowTone}`}>
      <div className="store-checklists-store-cell">
        <span className={`store-checklists-store-avatar store-checklists-tone-${rowTone}`} aria-hidden="true">
          <StoreIcon />
        </span>
        <div className="store-checklists-row-main">
          <strong>{storeLabel}</strong>
          <p>{input.item.templateName}</p>
          <span>{formatChecklistTemplateType(input.t, input.item.templateType)}</span>
        </div>
      </div>
      <ChecklistResultScore
        label={input.t('storeChecklists.score')}
        locale={input.locale}
        score={input.item.totalScore}
        scorePercent={scorePercent}
        t={input.t}
      />
      <ChecklistBadge tone={hasAcknowledgement ? 'calm' : 'accent'}>{statusLabel}</ChecklistBadge>
      <ChecklistResultDateCell date={input.item.completedAt} locale={input.locale} />
      <Button className="store-checklists-action-button store-checklists-action-button-muted" type="button" variant="outline" onClick={input.onOpen}>
        {input.t('storeChecklists.viewResultDetail')}
        <ChevronRight data-icon="inline-end" />
      </Button>
      <div className="store-checklists-result-context">
        <span>
          {getStaticCopy(input.locale, 'Sonuç özeti', 'Result summary')}: {digest.title}
        </span>
        {lowScoreCount > 0 ? (
          <b>{input.t('storeChecklists.lowScoreCount', { count: lowScoreCount })}</b>
        ) : null}
        {input.item.acknowledgement?.acknowledgementNote ? (
          <em>{input.item.acknowledgement.acknowledgementNote}</em>
        ) : null}
      </div>
    </article>
  )
}

function ChecklistResultScore(input: {
  label: string
  locale: AppLocale
  score: number | null
  scorePercent: number | null
  t: TranslateFunction
}) {
  const percent = input.scorePercent ?? 0
  const tone: ChecklistTone = input.score === null
    ? 'neutral'
    : percent >= 70
      ? 'calm'
      : 'danger'

  return (
    <div
      className="store-checklists-template-score store-checklists-template-score-result"
      aria-label={`${input.label}: ${formatScoreValue(input.t, input.score)} / 100`}
    >
      <span className="store-checklists-template-score-label">{input.label}</span>
      <b>{input.score === null ? '-' : formatNumber(input.score, input.locale)}</b>
      <em>/100</em>
      <span className={`store-checklists-template-scorebar${input.score === null ? ' store-checklists-scorebar-empty' : ''}`}>
        <i>
          <b
            className={`store-checklists-tone-${tone}`}
            style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
          />
        </i>
      </span>
    </div>
  )
}

function ChecklistResultDateCell(input: { date: string | null | undefined; locale: AppLocale }) {
  if (!input.date) {
    return <span className="store-checklists-date-cell store-checklists-date-cell-empty">-</span>
  }

  const date = new Date(input.date)
  if (Number.isNaN(date.getTime())) {
    return <span className="store-checklists-date-cell store-checklists-date-cell-empty">-</span>
  }

  const intlLocale = getIntlLocale(input.locale)
  const day = new Intl.DateTimeFormat(intlLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
  const time = new Intl.DateTimeFormat(intlLocale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

  return (
    <span className="store-checklists-date-cell">
      <strong>{day}</strong>
      <small>{time}</small>
    </span>
  )
}

function getResultRowTone(scorePercent: number | null, hasAcknowledgement: boolean, fallbackTone: ChecklistTone): ChecklistTone {
  if (scorePercent === null) return hasAcknowledgement ? 'calm' : 'accent'
  if (!hasAcknowledgement) return scorePercent < 70 ? 'danger' : 'accent'
  if (scorePercent < 70) return 'danger'
  return fallbackTone === 'warning' ? 'warning' : 'calm'
}
