import type { AuthSessionSummary } from '../features/auth/api'
import type { MobileChecklistToday } from '../features/checklists/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
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
  formatOptionalDate,
  getActionableStoreVisitRow,
  getCoverageRowKeyFromRow,
  getStaticCopy,
  getStoreVisitDate,
  getStoreVisitRiskLabel,
  getStoreVisitRiskTone,
  getStoreVisitRowKey,
  getStoreVisitSummary,
} from './store-checklists-logic'
import {
  ChecklistBadge,
  ChecklistEmptyBlock,
  ChecklistTemplateScore,
  SortButton,
} from './store-checklists-atoms'

export function StoreChecklistsVisitPanel(input: {
  activeVisitCount: number
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

  return (
    <section
      aria-label={input.t('storeChecklists.visitPanelAria')}
      aria-labelledby="store-checklist-tab-visits"
      className="store-checklists-command-card"
      id="store-checklist-panel-visits"
      role="tabpanel"
    >
      <div className="store-checklists-section-head">
        <div>
          <div className="store-checklists-eyebrow">{input.t('storeChecklists.visitEyebrow')}</div>
          <h3>{input.t('storeChecklists.visitTitle')}</h3>
          <p>
            {input.display.vmOnlyVisitScope
              ? getStaticCopy(
                  input.locale,
                  'Her satır tek mağaza; yalnızca VM checklist durumu ve skoru gösterilir.',
                  'Each row is one store; only VM checklist status and score are shown.',
                )
              : getStaticCopy(
                  input.locale,
                  'Her satır tek mağaza; BM ve VM checklist skorları birbirine karışmadan okunur.',
                  'Each row is one store; BM and VM checklist scores stay separate.',
                )}
          </p>
        </div>
        <ChecklistBadge tone={input.activeVisitCount > 0 ? 'warning' : 'accent'}>
          {input.activeVisitCount > 0
            ? input.t('storeChecklists.visitStatus.inProgress')
            : input.t('storeChecklists.visitStatus.ready')}
        </ChecklistBadge>
      </div>

      {input.visitStoreRows.length === 0 ? (
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
          hydrateActiveResponseDrafts={input.hydrateActiveResponseDrafts}
          locale={input.locale}
          requiresCombinedVisitTemplates={input.display.requiresCombinedVisitTemplates}
          showBmVisitScore={input.display.showBmVisitScore}
          showVmVisitScore={input.display.showVmVisitScore}
          startVisitIsPending={input.startVisitIsPending}
          startVisitVariables={input.startVisitVariables}
          t={input.t}
          visitSort={input.visitSort}
          visitStoreRows={input.visitStoreRows}
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
            {getStaticCopy(input.locale, 'BM skor', 'BM score')}
          </SortButton>
        ) : null}
        {input.showVmVisitScore ? (
          <SortButton
            active={input.visitSort.key === 'score'}
            direction={input.visitSort.direction}
            onClick={() => input.onToggleVisitSort('score')}
          >
            {getStaticCopy(input.locale, 'VM skor', 'VM score')}
          </SortButton>
        ) : null}
        <SortButton
          active={input.visitSort.key === 'date'}
          direction={input.visitSort.direction}
          onClick={() => input.onToggleVisitSort('date')}
        >
          {getStaticCopy(input.locale, 'Son ziyaret', 'Last visit')}
        </SortButton>
        <SortButton
          active={input.visitSort.key === 'priority'}
          direction={input.visitSort.direction}
          onClick={() => input.onToggleVisitSort('priority')}
        >
          {getStaticCopy(input.locale, 'Düşük alan', 'Low area')}
        </SortButton>
        <span>{getStaticCopy(input.locale, 'Aksiyon', 'Action')}</span>
      </div>

      {input.visitStoreRows.map((storeRow) => (
        <StoreChecklistsVisitRow
          assignedStoreIds={input.assignedStoreIds}
          authSummary={input.authSummary}
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
    </div>
  )
}

function StoreChecklistsVisitRow(input: {
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
  const actionableRow = getActionableStoreVisitRow(input.storeRow, input.authSummary)
  const row = actionableRow ?? input.storeRow.primary
  const active = row.active
  const canStart =
    Boolean(actionableRow) &&
    (Boolean(active) || input.assignedStoreIds.includes(input.storeRow.store.storeId))
  const rowKey = getCoverageRowKeyFromRow(row)
  const isStartingRow =
    input.startVisitIsPending &&
    input.startVisitVariables?.storeId === input.storeRow.store.storeId &&
    input.startVisitVariables?.checklistTemplateId === row.template.checklistTemplateId

  return (
    <article className="store-checklists-visit-row">
      <div className="store-checklists-row-main">
        <strong>{input.storeRow.store.storeName}</strong>
        <p>
          {getStoreVisitSummary(
            input.t,
            input.locale,
            input.storeRow,
            input.requiresCombinedVisitTemplates,
          )}
        </p>
      </div>
      {input.showBmVisitScore ? (
        <ChecklistTemplateScore
          label={getStaticCopy(input.locale, 'BM', 'BM')}
          locale={input.locale}
          row={input.storeRow.bm}
          t={input.t}
        />
      ) : null}
      {input.showVmVisitScore ? (
        <ChecklistTemplateScore
          label={getStaticCopy(input.locale, 'VM', 'VM')}
          locale={input.locale}
          row={input.storeRow.vm}
          t={input.t}
        />
      ) : null}
      <ChecklistBadge tone={getStoreVisitDate(input.storeRow) ? 'accent' : 'danger'}>
        {formatOptionalDate(getStoreVisitDate(input.storeRow), input.locale)}
      </ChecklistBadge>
      <ChecklistBadge
        tone={getStoreVisitRiskTone(input.storeRow, input.requiresCombinedVisitTemplates)}
      >
        {getStoreVisitRiskLabel(
          input.t,
          input.locale,
          input.storeRow,
          input.requiresCombinedVisitTemplates,
        )}
      </ChecklistBadge>
      <button
        className="store-checklists-action-button"
        disabled={!canStart || (!active && input.startVisitIsPending)}
        type="button"
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
      </button>
    </article>
  )
}
