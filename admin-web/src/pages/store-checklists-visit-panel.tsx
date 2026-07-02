import { useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Store as StoreIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AuthSessionSummary } from '../features/auth/api'
import type { MobileChecklistToday } from '../features/checklists/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { getErrorMessage } from '../lib/format'
import { getIntlLocale, type AppLocale } from '../lib/i18n'
import type {
  ChecklistActiveInstance,
  ChecklistDraftHydration,
  ChecklistSort,
  ChecklistSortKey,
  ChecklistStoreVisitRow,
  ChecklistTab,
  ChecklistVisitStartVariables,
} from './store-checklists-model'
import {
  getActionableStoreVisitRow,
  getCoverageRowKeyFromRow,
  getStaticCopy,
  getStoreVisitDate,
  getStoreVisitRiskTone,
  getStoreVisitRowKey,
} from './store-checklists-logic'
import {
  ChecklistBadge,
  ChecklistEmptyBlock,
  ChecklistTemplateScore,
  SortButton,
} from './store-checklists-atoms'

const visitPageSize = 10

export function StoreChecklistsVisitPanel(input: {
  activeVisitCount: number
  actionVisitRowsByStoreId: Map<string, ChecklistStoreVisitRow>
  assignedStoreIds: string[]
  assignedVisitStoreCount: number
  authSummary: AuthSessionSummary | null
  display: {
    requiresCombinedVisitTemplates: boolean
    showBmVisitScore: boolean
    showVmVisitScore: boolean
    vmOnlyVisitScope: boolean
  }
  errors: {
    complete: unknown | null
    save: unknown | null
    start: unknown | null
  }
  hydrateActiveResponseDrafts: (
    active: ChecklistActiveInstance | undefined,
  ) => ChecklistDraftHydration
  locale: AppLocale
  mobileToday: MobileChecklistToday | undefined
  selectedTab: ChecklistTab
  startVisitIsPending: boolean
  startVisitVariables: ChecklistVisitStartVariables | undefined
  t: TranslateFunction
  visitSort: ChecklistSort
  visitStoreRows: ChecklistStoreVisitRow[]
  onOpenSession: (rowKey: string, drafts: ChecklistDraftHydration) => void
  onResetSessionDrafts: () => void
  onStartVisit: (variables: ChecklistVisitStartVariables) => void
  onToggleVisitSort: (key: ChecklistSortKey) => void
}) {
  if (input.selectedTab !== 'visits') return null

  const hasMissingTemplate =
    input.assignedVisitStoreCount > 0 && (input.mobileToday?.templates.length ?? 0) === 0
  const panelRows = input.visitStoreRows

  return (
    <section
      aria-label={input.t('storeChecklists.visitPanelAria')}
      aria-labelledby={`store-checklist-tab-${input.selectedTab}`}
      className="store-checklists-command-card"
      id={`store-checklist-panel-${input.selectedTab}`}
      role="tabpanel"
    >
      <div className="store-checklists-section-head">
        <div>
          <div className="store-checklists-eyebrow">
            {input.t('storeChecklists.visitEyebrow')}
          </div>
          <h3>{input.t('storeChecklists.visitTitle')}</h3>
          <p>
            {input.display.vmOnlyVisitScope
              ? getStaticCopy(
                  input.locale,
                  'VM ziyaret durumu ve skor takibi.',
                  'VM visit status and score follow-up.',
                )
              : getStaticCopy(
                  input.locale,
                  'BM ve VM checklistleri aynı satırda ayrı okunur.',
                  'BM and VM checklists stay separate on each row.',
                )}
          </p>
        </div>
        <ChecklistBadge
          tone={input.activeVisitCount > 0 ? 'warning' : 'accent'}
        >
          {input.activeVisitCount > 0
            ? input.t('storeChecklists.visitStatus.inProgress')
            : input.t('storeChecklists.visitStatus.ready')}
        </ChecklistBadge>
      </div>

      {panelRows.length === 0 ? (
        <ChecklistEmptyBlock
          copy={
            hasMissingTemplate
              ? getStaticCopy(
                  input.locale,
                  'Atanmış mağazan var; ancak bu rol için yayınlanmış VM checklist şablonu henüz yok.',
                  'You have assigned stores, but there is no published VM checklist template for this role yet.',
                )
              : input.t('storeChecklists.noActiveChecklistCopy')
          }
          title={
            hasMissingTemplate
              ? getStaticCopy(input.locale, 'VM şablonu yayında değil', 'VM template is not published')
              : input.t('storeChecklists.noActiveChecklistTitle')
          }
        />
      ) : (
        <StoreChecklistsVisitTable
          assignedStoreIds={input.assignedStoreIds}
          authSummary={input.authSummary}
          actionVisitRowsByStoreId={input.actionVisitRowsByStoreId}
          hydrateActiveResponseDrafts={input.hydrateActiveResponseDrafts}
          locale={input.locale}
          requiresCombinedVisitTemplates={input.display.requiresCombinedVisitTemplates}
          showBmVisitScore={input.display.showBmVisitScore}
          showVmVisitScore={input.display.showVmVisitScore}
          startVisitIsPending={input.startVisitIsPending}
          startVisitVariables={input.startVisitVariables}
          t={input.t}
          visitSort={input.visitSort}
          visitStoreRows={panelRows}
          onOpenSession={input.onOpenSession}
          onResetSessionDrafts={input.onResetSessionDrafts}
          onStartVisit={input.onStartVisit}
          onToggleVisitSort={input.onToggleVisitSort}
        />
      )}

      {input.errors.start ? (
        <p className="store-checklists-inline-notice">{getErrorMessage(input.errors.start)}</p>
      ) : null}
      {input.errors.save ? (
        <p className="store-checklists-inline-notice">{getErrorMessage(input.errors.save)}</p>
      ) : null}
      {input.errors.complete ? (
        <p className="store-checklists-inline-notice">{getErrorMessage(input.errors.complete)}</p>
      ) : null}
    </section>
  )
}

function StoreChecklistsVisitTable(input: {
  actionVisitRowsByStoreId: Map<string, ChecklistStoreVisitRow>
  assignedStoreIds: string[]
  authSummary: AuthSessionSummary | null
  hydrateActiveResponseDrafts: (
    active: ChecklistActiveInstance | undefined,
  ) => ChecklistDraftHydration
  locale: AppLocale
  requiresCombinedVisitTemplates: boolean
  showBmVisitScore: boolean
  showVmVisitScore: boolean
  startVisitIsPending: boolean
  startVisitVariables: ChecklistVisitStartVariables | undefined
  t: TranslateFunction
  visitSort: ChecklistSort
  visitStoreRows: ChecklistStoreVisitRow[]
  onOpenSession: (rowKey: string, drafts: ChecklistDraftHydration) => void
  onResetSessionDrafts: () => void
  onStartVisit: (variables: ChecklistVisitStartVariables) => void
  onToggleVisitSort: (key: ChecklistSortKey) => void
}) {
  const [page, setPage] = useState(1)
  const pageCount = Math.max(Math.ceil(input.visitStoreRows.length / visitPageSize), 1)
  const safePage = Math.min(page, pageCount)
  const pageStart = (safePage - 1) * visitPageSize
  const visibleRows = useMemo(
    () => input.visitStoreRows.slice(pageStart, pageStart + visitPageSize),
    [input.visitStoreRows, pageStart],
  )

  return (
    <div
      className={`store-checklists-table store-checklists-visit-table${
        input.requiresCombinedVisitTemplates ? '' : ' store-checklists-visit-table-single-score'
      }`}
    >
      <div className="store-checklists-table-head">
        <SortButton
          active={input.visitSort.key === 'store'}
          direction={input.visitSort.direction}
          onClick={() => input.onToggleVisitSort('store')}
        >
          {input.t('storeChecklists.store')}
        </SortButton>
        {input.showBmVisitScore ? (
          <SortButton
            active={input.visitSort.key === 'score'}
            direction={input.visitSort.direction}
            onClick={() => input.onToggleVisitSort('score')}
          >
            {getStaticCopy(input.locale, 'BM Checklist', 'BM Checklist')}
          </SortButton>
        ) : null}
        {input.showVmVisitScore ? (
          <SortButton
            active={input.visitSort.key === 'score'}
            direction={input.visitSort.direction}
            onClick={() => input.onToggleVisitSort('score')}
          >
            {getStaticCopy(input.locale, 'VM Checklist', 'VM Checklist')}
          </SortButton>
        ) : null}
        <SortButton
          active={input.visitSort.key === 'date'}
          direction={input.visitSort.direction}
          onClick={() => input.onToggleVisitSort('date')}
        >
          {getStaticCopy(input.locale, 'Son ziyaret', 'Last visit')}
        </SortButton>
        <span>{getStaticCopy(input.locale, 'Aksiyon', 'Action')}</span>
      </div>

      {visibleRows.map((storeRow) => (
        <StoreChecklistsVisitRow
          assignedStoreIds={input.assignedStoreIds}
          authSummary={input.authSummary}
          actionStoreRow={input.actionVisitRowsByStoreId.get(storeRow.store.storeId)}
          hydrateActiveResponseDrafts={input.hydrateActiveResponseDrafts}
          key={getStoreVisitRowKey(storeRow)}
          locale={input.locale}
          requiresCombinedVisitTemplates={input.requiresCombinedVisitTemplates}
          showBmVisitScore={input.showBmVisitScore}
          showVmVisitScore={input.showVmVisitScore}
          startVisitIsPending={input.startVisitIsPending}
          startVisitVariables={input.startVisitVariables}
          storeRow={storeRow}
          t={input.t}
          onOpenSession={input.onOpenSession}
          onResetSessionDrafts={input.onResetSessionDrafts}
          onStartVisit={input.onStartVisit}
        />
      ))}

      {input.visitStoreRows.length > visitPageSize ? (
        <div className="store-checklists-pagination">
          <span>
            {pageStart + 1}-{Math.min(pageStart + visitPageSize, input.visitStoreRows.length)} /{' '}
            {input.visitStoreRows.length}{' '}
            {getStaticCopy(input.locale, 'mağaza gösteriliyor', 'stores shown')}
          </span>
          <div>
            <Button
              disabled={safePage <= 1}
              size="icon-sm"
              type="button"
              variant="outline"
              onClick={() => setPage(Math.max(safePage - 1, 1))}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <span>{safePage}</span>
            <Button
              disabled={safePage >= pageCount}
              size="icon-sm"
              type="button"
              variant="outline"
              onClick={() => setPage(Math.min(safePage + 1, pageCount))}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function StoreChecklistsVisitRow(input: {
  actionStoreRow: ChecklistStoreVisitRow | undefined
  assignedStoreIds: string[]
  authSummary: AuthSessionSummary | null
  hydrateActiveResponseDrafts: (
    active: ChecklistActiveInstance | undefined,
  ) => ChecklistDraftHydration
  locale: AppLocale
  requiresCombinedVisitTemplates: boolean
  showBmVisitScore: boolean
  showVmVisitScore: boolean
  startVisitIsPending: boolean
  startVisitVariables: ChecklistVisitStartVariables | undefined
  storeRow: ChecklistStoreVisitRow
  t: TranslateFunction
  onOpenSession: (rowKey: string, drafts: ChecklistDraftHydration) => void
  onResetSessionDrafts: () => void
  onStartVisit: (variables: ChecklistVisitStartVariables) => void
}) {
  const actionStoreRow = input.actionStoreRow ?? input.storeRow
  const actionableRow = getActionableStoreVisitRow(actionStoreRow, input.authSummary)
  const row = actionableRow ?? input.storeRow.primary
  const active = row.active
  const canStart =
    Boolean(actionableRow) &&
    (Boolean(active) || input.assignedStoreIds.includes(input.storeRow.store.storeId))
  const rowKey = getCoverageRowKeyFromRow(row)
  const riskTone = getStoreVisitRiskTone(input.storeRow, input.requiresCombinedVisitTemplates)
  const actionIsPrimary = Boolean(active) || riskTone === 'danger'
  const visitDate = getStoreVisitDate(input.storeRow)
  const isStartingRow =
    input.startVisitIsPending &&
    input.startVisitVariables?.storeId === input.storeRow.store.storeId &&
    input.startVisitVariables?.checklistTemplateId === row.template.checklistTemplateId

  return (
    <article className={`store-checklists-visit-row store-checklists-visit-row-${riskTone}`}>
      <div className="store-checklists-store-cell">
        <span className={`store-checklists-store-avatar store-checklists-tone-${riskTone}`} aria-hidden="true">
          <StoreIcon />
        </span>
        <div className="store-checklists-row-main">
          <strong>{input.storeRow.store.storeName}</strong>
        </div>
      </div>
      {input.showBmVisitScore ? (
        <ChecklistTemplateScore
          label={getStaticCopy(input.locale, 'BM Checklist', 'BM Checklist')}
          locale={input.locale}
          row={input.storeRow.bm}
          t={input.t}
        />
      ) : null}
      {input.showVmVisitScore ? (
        <ChecklistTemplateScore
          label={getStaticCopy(input.locale, 'VM Checklist', 'VM Checklist')}
          locale={input.locale}
          row={input.storeRow.vm}
          t={input.t}
        />
      ) : null}
      <ChecklistVisitDateCell date={visitDate} locale={input.locale} />
      <Button
        className={`store-checklists-action-button${
          actionIsPrimary ? ' store-checklists-action-button-primary' : ' store-checklists-action-button-muted'
        }`}
        disabled={!canStart || (!active && input.startVisitIsPending)}
        type="button"
        variant={actionIsPrimary ? 'default' : 'outline'}
        onClick={() => {
          if (active) {
            input.onOpenSession(rowKey, input.hydrateActiveResponseDrafts(active))
            return
          }

          if (!actionableRow) return

          input.hydrateActiveResponseDrafts(undefined)
          input.onResetSessionDrafts()
          input.onStartVisit({
            storeId: input.storeRow.store.storeId,
            checklistTemplateId: row.template.checklistTemplateId,
          })
        }}
      >
        {active
          ? input.t('storeChecklists.continueChecklist')
          : isStartingRow
            ? input.t('storeChecklists.startPending')
            : actionableRow
              ? input.t('storeChecklists.startChecklist')
              : getStaticCopy(input.locale, 'Sadece oku', 'Read only')}
        <ChevronRight data-icon="inline-end" />
      </Button>
    </article>
  )
}

function ChecklistVisitDateCell(input: { date: string | null | undefined; locale: AppLocale }) {
  if (!input.date) {
    return (
      <span className="store-checklists-date-cell store-checklists-date-cell-empty">
        {getStaticCopy(input.locale, 'Yok', 'None')}
      </span>
    )
  }

  const date = new Date(input.date)
  if (Number.isNaN(date.getTime())) {
    return (
      <span className="store-checklists-date-cell store-checklists-date-cell-empty">
        {getStaticCopy(input.locale, 'Yok', 'None')}
      </span>
    )
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
