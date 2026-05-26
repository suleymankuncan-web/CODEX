import { Button } from '@/components/ui/button'
import type { ChecklistAcknowledgementItem } from '../features/checklists/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { AppLocale } from '../lib/i18n'
import type {
  ChecklistSort,
  ChecklistSortKey,
  ChecklistTab,
} from './store-checklists-model'
import {
  formatChecklistTemplateType,
  formatCompletedSentence,
  formatScoreValue,
  getChecklistResultDigest,
  getLowScoreResponses,
  getStaticCopy,
} from './store-checklists-logic'
import {
  ChecklistBadge,
  ChecklistEmptyBlock,
  ChecklistFact,
  ChecklistScoreBar,
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
            <ChecklistBadge tone={input.pendingItemCount > 0 ? 'warning' : 'calm'}>
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
  const lowScoreCount = getLowScoreResponses(input.item.responses).length
  const scorePercent = input.item.totalScore ?? Math.round((input.item.complianceRate ?? 0) * 100)
  const digest = getChecklistResultDigest(input.t, input.locale, input.item)

  return (
    <article className="store-checklists-history-row">
      <div className="store-checklists-row-main">
        <ChecklistBadge tone={input.item.templateType === 'VM_STORE_VISIT' ? 'accent' : 'neutral'}>
          {formatChecklistTemplateType(input.t, input.item.templateType)}
        </ChecklistBadge>
        <strong>{input.item.templateName}</strong>
        <p>{formatCompletedSentence(input.t, input.locale, input.item)}</p>
        <p className="store-checklist-result-digest">
          <span>{getStaticCopy(input.locale, 'Sonuç özeti', 'Result summary')}</span>
          {digest.title}
        </p>
      </div>
      <ChecklistScoreBar
        label={input.t('storeChecklists.score')}
        percent={scorePercent}
        tone={scorePercent >= 70 ? 'calm' : 'warning'}
        value={formatScoreValue(input.t, input.item.totalScore)}
      />
      <ChecklistBadge tone={hasAcknowledgement ? 'calm' : 'warning'}>
        {hasAcknowledgement ? input.t('storeChecklists.acknowledged') : input.t('storeChecklists.needsAcknowledgement')}
      </ChecklistBadge>
      <ChecklistFact
        label={input.t('storeChecklists.resultLowScore')}
        value={input.t('storeChecklists.lowScoreCount', { count: lowScoreCount })}
      />
      <Button className="store-checklists-action-button" type="button" onClick={input.onOpen}>
        {input.t('storeChecklists.viewResultDetail')}
      </Button>
      {input.item.acknowledgement?.acknowledgementNote ? (
        <p className="store-checklists-row-note">{input.item.acknowledgement.acknowledgementNote}</p>
      ) : null}
    </article>
  )
}
