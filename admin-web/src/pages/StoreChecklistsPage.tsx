import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ScreenState } from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  canAcknowledgeChecklist,
  canReadChecklistResults,
  getAssignedStoreIds,
  hasAnyRole,
} from '../features/auth/authorization'
import {
  acknowledgeChecklist,
  completeMobileChecklistInstance,
  getChecklistAcknowledgements,
  getMobileChecklistToday,
  saveMobileChecklistResponse,
  startMobileChecklistInstance,
  type ChecklistAcknowledgementItem,
  type MobileChecklistToday,
} from '../features/checklists/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { formatDateTime, formatNumber, formatState, getErrorMessage } from '../lib/format'
import { getIntlLocale, type AppLocale } from '../lib/i18n'
import { transientQueryRetryOptions } from '../lib/query-retry'

type ChecklistCoverageRow = {
  store: MobileChecklistToday['stores'][number]
  template: MobileChecklistToday['templates'][number]
  active?: MobileChecklistToday['activeInstances'][number]
  summary?: MobileChecklistToday['monthlySummaries'][number]
  completedCount: number
}

type ChecklistSession = ChecklistCoverageRow
type ChecklistTone = 'calm' | 'warning' | 'accent' | 'danger' | 'neutral'
type ChecklistTypeFilter = 'all' | 'BM_STORE_VISIT' | 'VM_STORE_VISIT'
type ChecklistStatusFilter = 'all' | 'missing' | 'draft' | 'completed' | 'pending' | 'acknowledged'
type ChecklistSortKey = 'priority' | 'store' | 'score' | 'date' | 'status'
type ChecklistSortDirection = 'asc' | 'desc'
type ChecklistSort = { key: ChecklistSortKey; direction: ChecklistSortDirection }
type ChecklistResponseDraft = {
  checklistInstanceId: string
  templateItemId: string
  scoreValue: number
  commentText?: string
}

export function StoreChecklistsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { locale, t } = useLocalization()
  const queryClient = useQueryClient()
  const [ackNotes, setAckNotes] = useState<Record<string, string>>({})
  const [ackNotice, setAckNotice] = useState<string | null>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [comments, setComments] = useState<Record<string, string>>({})
  const [selectedSessionKey, setSelectedSessionKey] = useState<string | null>(null)
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [typeFilter, setTypeFilter] = useState<ChecklistTypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<ChecklistStatusFilter>('all')
  const [visitSort, setVisitSort] = useState<ChecklistSort>({ key: 'priority', direction: 'desc' })
  const [resultSort, setResultSort] = useState<ChecklistSort>({ key: 'date', direction: 'desc' })
  const [localActiveInstances, setLocalActiveInstances] = useState<
    Record<string, MobileChecklistToday['activeInstances'][number]>
  >({})
  const [sessionDirty, setSessionDirty] = useState(false)
  const autoSaveTimersRef = useRef<Record<string, number>>({})
  const savedResponseDraftsRef = useRef<Record<string, string>>({})
  const canManageVisits = hasAnyRole(input.authSummary, [
    'REGION_MANAGER',
    'VISUAL_MERCHANDISER',
    'SUPER_ADMIN',
  ])
  const canUseAcknowledgements = canReadChecklistResults(input.authSummary)
  const checklistsQuery = useQuery({
    queryKey: ['checklist-acknowledgements'],
    queryFn: getChecklistAcknowledgements,
    enabled: canUseAcknowledgements,
    ...transientQueryRetryOptions,
  })
  const mobileTodayQuery = useQuery({
    queryKey: ['mobile-checklists-today'],
    queryFn: getMobileChecklistToday,
    enabled: canManageVisits,
    ...transientQueryRetryOptions,
  })
  const acknowledgeMutation = useMutation({
    mutationFn: acknowledgeChecklist,
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['checklist-acknowledgements'] })
      setSelectedResultId(null)
      setAckNotes((current) => {
        const next = { ...current }
        delete next[variables.checklistInstanceId]
        return next
      })
      setAckNotice(result.command.message)
    },
  })
  const startVisitMutation = useMutation({
    mutationFn: startMobileChecklistInstance,
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['mobile-checklists-today'] })
      const instance = result.data.checklistInstance
      setLocalActiveInstances((current) => ({
        ...current,
        [getCoverageRowKey(variables.storeId, variables.checklistTemplateId)]: {
          checklistInstanceId: instance.checklist_instance_id,
          checklistTemplateId: variables.checklistTemplateId,
          storeId: variables.storeId,
          status: instance.status,
          startedAt: instance.created_at,
          updatedAt: instance.created_at,
          responses: [],
        },
      }))
      setAckNotice(result.command.message)
    },
  })
  const saveResponseMutation = useMutation({
    mutationFn: saveMobileChecklistResponse,
    onSuccess: (_result, variables) => {
      savedResponseDraftsRef.current[getChecklistResponseDraftKey(variables)] =
        serializeChecklistResponseDraft(variables)
      void queryClient.invalidateQueries({ queryKey: ['mobile-checklists-today'] })
      setSessionDirty(false)
    },
  })
  const savePendingSessionResponses = async (
    checklistInstanceId: string,
    responseDrafts: ChecklistResponseDraft[],
  ) => {
    for (const [key, timerId] of Object.entries(autoSaveTimersRef.current)) {
      if (key.startsWith(`${checklistInstanceId}:`)) {
        window.clearTimeout(timerId)
        delete autoSaveTimersRef.current[key]
      }
    }

    const changedDrafts = responseDrafts.filter((draft) => {
      const key = getChecklistResponseDraftKey(draft)
      return savedResponseDraftsRef.current[key] !== serializeChecklistResponseDraft(draft)
    })

    await Promise.all(
      changedDrafts.map(async (draft) => {
        await saveMobileChecklistResponse(draft)
        savedResponseDraftsRef.current[getChecklistResponseDraftKey(draft)] =
          serializeChecklistResponseDraft(draft)
      }),
    )
  }
  const completeVisitMutation = useMutation({
    mutationFn: async (variables: {
      checklistInstanceId: string
      responses: ChecklistResponseDraft[]
    }) => {
      await savePendingSessionResponses(variables.checklistInstanceId, variables.responses)
      return completeMobileChecklistInstance({
        checklistInstanceId: variables.checklistInstanceId,
      })
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['mobile-checklists-today'] })
      void queryClient.invalidateQueries({ queryKey: ['checklist-acknowledgements'] })
      setLocalActiveInstances((current) =>
        Object.fromEntries(
          Object.entries(current).filter(
            ([, instance]) => instance.checklistInstanceId !== variables.checklistInstanceId,
          ),
        ),
      )
      setSelectedSessionKey(null)
      setSessionDirty(false)
      setAckNotice(t('storeChecklists.completeSuccess'))
    },
  })
  const queueResponseAutoSave = (draft: ChecklistResponseDraft) => {
    const key = getChecklistResponseDraftKey(draft)
    const serialized = serializeChecklistResponseDraft(draft)
    if (savedResponseDraftsRef.current[key] === serialized) return

    const existingTimer = autoSaveTimersRef.current[key]
    if (existingTimer) window.clearTimeout(existingTimer)
    autoSaveTimersRef.current[key] = window.setTimeout(() => {
      delete autoSaveTimersRef.current[key]
      saveResponseMutation.mutate(draft)
    }, 500)
  }
  const hydrateActiveResponseDrafts = (
    active: MobileChecklistToday['activeInstances'][number] | undefined,
  ) => {
    if (!active?.responses.length) return

    setScores((current) => {
      const next = { ...current }
      for (const response of active.responses) {
        next[response.templateItemId] = response.scoreValue
        const draft = {
          checklistInstanceId: active.checklistInstanceId,
          templateItemId: response.templateItemId,
          scoreValue: response.scoreValue,
          commentText: response.commentText ?? undefined,
        }
        savedResponseDraftsRef.current[getChecklistResponseDraftKey(draft)] =
          serializeChecklistResponseDraft(draft)
      }
      return next
    })
    setComments((current) => {
      const next = { ...current }
      for (const response of active.responses) {
        if (response.commentText) next[response.templateItemId] = response.commentText
      }
      return next
    })
  }

  if (
    (canUseAcknowledgements && checklistsQuery.isLoading) ||
    (canManageVisits && mobileTodayQuery.isLoading)
  ) {
    return (
      <ScreenState
        title={t('storeChecklists.loadingTitle')}
        copy={t('storeChecklists.loadingCopy')}
      />
    )
  }

  if (
    (canUseAcknowledgements && checklistsQuery.isError) ||
    (canManageVisits && mobileTodayQuery.isError)
  ) {
    return (
      <ScreenState
        title={t('storeChecklists.errorTitle')}
        copy={getErrorMessage(checklistsQuery.error ?? mobileTodayQuery.error)}
        tone="error"
      />
    )
  }

  const items = canUseAcknowledgements ? (checklistsQuery.data?.items ?? []) : []
  const mobileToday = mobileTodayQuery.data?.data
  const pendingItems = items.filter((item) => item.acknowledgement === null)
  const acknowledgedItems = items.filter((item) => item.acknowledgement !== null)
  const selectedResult = items.find((item) => item.checklistInstanceId === selectedResultId) ?? null
  const assignedStoreIds = getAssignedStoreIds(input.authSummary)
  const coverageRows: ChecklistCoverageRow[] = (mobileToday?.stores ?? []).flatMap((store) =>
    (mobileToday?.templates ?? []).map((template) => {
      const rowKey = getCoverageRowKey(store.storeId, template.checklistTemplateId)
      const active = mobileToday?.activeInstances.find(
        (item) =>
          item.storeId === store.storeId &&
          item.checklistTemplateId === template.checklistTemplateId,
      ) ?? localActiveInstances[rowKey]
      const summary = mobileToday?.monthlySummaries.find(
        (item) =>
          item.storeId === store.storeId &&
          item.checklistTemplateId === template.checklistTemplateId,
      )

      return {
        store,
        template,
        active,
        summary,
        completedCount: summary?.completedCount ?? 0,
      }
    }),
  )
  const monthOptions = buildMonthOptions(coverageRows, items, locale)
  const filteredCoverageRows = sortCoverageRows(
    coverageRows.filter((row) =>
      doesCoverageRowMatchFilters(row, {
        month: selectedMonth,
        query: searchQuery,
        status: statusFilter,
        type: typeFilter,
      }),
    ),
    visitSort,
    locale,
  )
  const filteredPendingItems = sortChecklistItems(
    pendingItems.filter((item) =>
      doesChecklistItemMatchFilters(item, {
        month: selectedMonth,
        query: searchQuery,
        status: statusFilter,
        type: typeFilter,
      }),
    ),
    resultSort,
    locale,
  )
  const filteredAcknowledgedItems = sortChecklistItems(
    acknowledgedItems.filter((item) =>
      doesChecklistItemMatchFilters(item, {
        month: selectedMonth,
        query: searchQuery,
        status: statusFilter,
        type: typeFilter,
      }),
    ),
    resultSort,
    locale,
  ).slice(0, 5)
  const activeVisitCount = coverageRows.filter((row) => row.active).length
  const completedThisMonthCount = coverageRows.reduce((sum, row) => sum + row.completedCount, 0)
  const storeCount = new Set(coverageRows.map((row) => row.store.storeId)).size
  const selectedSession =
    coverageRows.find((row) => getCoverageRowKeyFromRow(row) === selectedSessionKey) ?? null

  const closeSession = () => {
    const confirmMessage = sessionDirty
      ? t('storeChecklists.sessionCloseConfirm')
      : t('storeChecklists.cancelSessionConfirm')
    if (!window.confirm(confirmMessage)) {
      return
    }

    setSelectedSessionKey(null)
    setSessionDirty(false)
  }

  return (
    <section className="store-checklists-command-page">
      <header className="store-checklists-command-hero">
        <div className="store-checklists-hero-copy">
          <div className="store-checklists-eyebrow">{t('storeChecklists.heroEyebrow')}</div>
          <h2>{t('storeChecklists.title')}</h2>
          <p>{t('storeChecklists.heroCopy')}</p>
        </div>
        <div className="store-checklists-command-metrics" aria-label={t('storeChecklists.summaryAria')}>
          <ChecklistMetric
            label={t('storeChecklists.pendingAcknowledgements')}
            tone={pendingItems.length > 0 ? 'warning' : 'calm'}
            value={formatNumber(pendingItems.length, locale)}
          />
          <ChecklistMetric
            label={t('storeChecklists.summary.activeDrafts')}
            tone={activeVisitCount > 0 ? 'warning' : 'neutral'}
            value={formatNumber(activeVisitCount, locale)}
          />
          <ChecklistMetric
            label={t('storeChecklists.summary.monthlyDone')}
            tone={completedThisMonthCount > 0 ? 'accent' : 'neutral'}
            value={formatNumber(completedThisMonthCount, locale)}
          />
          <ChecklistMetric
            label={t('storeChecklists.store')}
            tone={storeCount > 0 ? 'accent' : 'neutral'}
            value={formatNumber(storeCount, locale)}
          />
        </div>
      </header>

      <ChecklistToolbar
        locale={locale}
        monthOptions={monthOptions}
        searchQuery={searchQuery}
        selectedMonth={selectedMonth}
        statusFilter={statusFilter}
        t={t}
        typeFilter={typeFilter}
        onClear={() => {
          setSearchQuery('')
          setSelectedMonth('all')
          setTypeFilter('all')
          setStatusFilter('all')
        }}
        onMonthChange={setSelectedMonth}
        onSearchChange={setSearchQuery}
        onStatusChange={setStatusFilter}
        onTypeChange={setTypeFilter}
      />

      {canManageVisits ? (
        <section className="store-checklists-command-card" aria-label={t('storeChecklists.visitPanelAria')}>
          <div className="store-checklists-section-head">
            <div>
              <div className="store-checklists-eyebrow">{t('storeChecklists.visitEyebrow')}</div>
              <h3>{t('storeChecklists.visitTitle')}</h3>
            </div>
            <ChecklistBadge tone={activeVisitCount > 0 ? 'warning' : 'accent'}>
              {activeVisitCount > 0
                ? t('storeChecklists.visitStatus.inProgress')
                : t('storeChecklists.visitStatus.ready')}
            </ChecklistBadge>
          </div>

          {filteredCoverageRows.length === 0 ? (
            <ChecklistEmptyBlock
              copy={t('storeChecklists.noActiveChecklistCopy')}
              title={t('storeChecklists.noActiveChecklistTitle')}
            />
          ) : (
            <div className="store-checklists-table store-checklists-visit-table">
              <div className="store-checklists-table-head">
                <SortButton
                  active={visitSort.key === 'store'}
                  direction={visitSort.direction}
                  onClick={() => setVisitSort(toggleSort(visitSort, 'store'))}
                >
                  {t('storeChecklists.store')}
                </SortButton>
                <SortButton
                  active={visitSort.key === 'score'}
                  direction={visitSort.direction}
                  onClick={() => setVisitSort(toggleSort(visitSort, 'score'))}
                >
                  {t('storeChecklists.score')}
                </SortButton>
                <SortButton
                  active={visitSort.key === 'status'}
                  direction={visitSort.direction}
                  onClick={() => setVisitSort(toggleSort(visitSort, 'status'))}
                >
                  {t('storeChecklists.status')}
                </SortButton>
                <SortButton
                  active={visitSort.key === 'date'}
                  direction={visitSort.direction}
                  onClick={() => setVisitSort(toggleSort(visitSort, 'date'))}
                >
                  {getStaticCopy(locale, 'Son ziyaret', 'Last visit')}
                </SortButton>
                <span>{getStaticCopy(locale, 'Aksiyon', 'Action')}</span>
              </div>

              {filteredCoverageRows.map((row) => {
                const active = row.active
                const rowScore = getCoverageScore(row)
                const canStart = active || assignedStoreIds.includes(row.store.storeId)

                return (
                  <article
                    className="store-checklists-visit-row"
                    key={`${row.store.storeId}:${row.template.checklistTemplateId}`}
                  >
                    <div className="store-checklists-row-main">
                      <ChecklistBadge tone={row.template.templateType === 'VM_STORE_VISIT' ? 'accent' : 'neutral'}>
                        {formatChecklistTemplateType(t, row.template.templateType)}
                      </ChecklistBadge>
                      <strong>{row.store.storeName}</strong>
                      <p>{row.template.templateName}</p>
                    </div>
                    <ChecklistScoreBar
                      label={t('storeChecklists.thisMonth')}
                      percent={rowScore ?? 0}
                      tone={rowScore === null ? 'neutral' : rowScore >= 70 ? 'calm' : 'warning'}
                      value={rowScore === null ? t('storeChecklists.noScore') : `${rowScore}`}
                    />
                    <ChecklistBadge tone={getCoverageTone(row)}>
                      {formatChecklistCoverage(t, row)}
                    </ChecklistBadge>
                    <ChecklistFact
                      label={t('storeChecklists.status')}
                      value={active ? formatChecklistStatus(t, active.status) : formatOptionalDate(row.summary?.monthStart, locale)}
                    />
                    <button
                      className="store-checklists-action-button"
                      disabled={!canStart}
                      type="button"
                      onClick={() => {
                        hydrateActiveResponseDrafts(active)
                        setSelectedSessionKey(getCoverageRowKeyFromRow(row))
                        setSessionDirty(false)
                      }}
                    >
                      {active ? t('storeChecklists.continueChecklist') : t('storeChecklists.startChecklist')}
                    </button>
                  </article>
                )
              })}
            </div>
          )}

          {startVisitMutation.isError ? (
            <p className="store-checklists-inline-notice">{getErrorMessage(startVisitMutation.error)}</p>
          ) : null}
          {saveResponseMutation.isError ? (
            <p className="store-checklists-inline-notice">{getErrorMessage(saveResponseMutation.error)}</p>
          ) : null}
          {completeVisitMutation.isError ? (
            <p className="store-checklists-inline-notice">{getErrorMessage(completeVisitMutation.error)}</p>
          ) : null}
        </section>
      ) : null}

      {selectedSession ? (
        <ChecklistVisitModal
          active={selectedSession.active}
          comments={comments}
          isCompleting={completeVisitMutation.isPending}
          isSaving={saveResponseMutation.isPending}
          isStarting={startVisitMutation.isPending}
          locale={locale}
          onClose={closeSession}
          onComplete={(checklistInstanceId) => {
            completeVisitMutation.mutate({
              checklistInstanceId,
              responses: buildChecklistResponseDrafts({
                checklistInstanceId,
                comments,
                scores,
                session: selectedSession,
              }),
            })
          }}
          onScoreChange={(templateItemId, score) => {
            setScores((current) => {
              const next = { ...current }
              if (score === null) {
                delete next[templateItemId]
              } else {
                next[templateItemId] = score
              }
              return next
            })
            if (selectedSession.active && score !== null) {
              queueResponseAutoSave({
                checklistInstanceId: selectedSession.active.checklistInstanceId,
                templateItemId,
                scoreValue: score,
                commentText: comments[templateItemId] || undefined,
              })
            }
            setSessionDirty(true)
          }}
          onCommentChange={(templateItemId, comment) => {
            setComments((current) => ({ ...current, [templateItemId]: comment }))
            const score = scores[templateItemId]
            if (selectedSession.active && Number.isFinite(score)) {
              queueResponseAutoSave({
                checklistInstanceId: selectedSession.active.checklistInstanceId,
                templateItemId,
                scoreValue: score,
                commentText: comment || undefined,
              })
            }
            setSessionDirty(true)
          }}
          onStart={(row) =>
            startVisitMutation.mutate({
              storeId: row.store.storeId,
              checklistTemplateId: row.template.checklistTemplateId,
            })
          }
          scores={scores}
          session={selectedSession}
          t={t}
        />
      ) : null}

      {selectedResult ? (
        <ChecklistResultModal
          acknowledgementNote={ackNotes[selectedResult.checklistInstanceId] ?? ''}
          canAcknowledge={canAcknowledgeChecklist(input.authSummary, selectedResult.storeId)}
          isAcknowledging={
            acknowledgeMutation.isPending &&
            acknowledgeMutation.variables?.checklistInstanceId === selectedResult.checklistInstanceId
          }
          item={selectedResult}
          locale={locale}
          onAcknowledge={() =>
            acknowledgeMutation.mutate({
              checklistInstanceId: selectedResult.checklistInstanceId,
              acknowledgementNote: ackNotes[selectedResult.checklistInstanceId] || undefined,
            })
          }
          onClose={() => setSelectedResultId(null)}
          onNoteChange={(note) =>
            setAckNotes((current) => ({
              ...current,
              [selectedResult.checklistInstanceId]: note,
            }))
          }
          t={t}
        />
      ) : null}

      <section className="store-checklists-command-card">
        <div className="store-checklists-section-head">
          <div>
            <div className="store-checklists-eyebrow">{t('storeChecklists.inboxEyebrow')}</div>
            <h3>{t('storeChecklists.inboxTitle')}</h3>
          </div>
          <ChecklistBadge tone={pendingItems.length > 0 ? 'warning' : 'calm'}>
            {pendingItems.length > 0
              ? t('storeChecklists.needsAcknowledgement')
              : t('storeChecklists.clear')}
          </ChecklistBadge>
        </div>

        {filteredPendingItems.length === 0 ? (
          <ChecklistEmptyBlock
            copy={t('storeChecklists.noPendingCopy')}
            title={t('storeChecklists.noPendingTitle')}
          />
        ) : (
          <ChecklistResultList
            items={filteredPendingItems}
            locale={locale}
            resultSort={resultSort}
            t={t}
            onOpen={(item) => setSelectedResultId(item.checklistInstanceId)}
            onSort={(key) => setResultSort(toggleSort(resultSort, key))}
          />
        )}

        {ackNotice ? <p className="store-checklists-inline-notice">{ackNotice}</p> : null}
      </section>

      <section className="store-checklists-command-card">
        <div className="store-checklists-section-head">
          <div>
            <div className="store-checklists-eyebrow">{t('storeChecklists.recentHistoryEyebrow')}</div>
            <h3>{t('storeChecklists.recentHistoryTitle')}</h3>
          </div>
        </div>

        {filteredAcknowledgedItems.length === 0 ? (
          <ChecklistEmptyBlock
            copy={t('storeChecklists.noAcknowledgementsCopy')}
            title={t('storeChecklists.noAcknowledgementsTitle')}
          />
        ) : (
          <ChecklistResultList
            items={filteredAcknowledgedItems}
            locale={locale}
            resultSort={resultSort}
            t={t}
            onOpen={(item) => setSelectedResultId(item.checklistInstanceId)}
            onSort={(key) => setResultSort(toggleSort(resultSort, key))}
          />
        )}
      </section>
    </section>
  )
}

function ChecklistToolbar(input: {
  locale: AppLocale
  monthOptions: Array<{ label: string; value: string }>
  searchQuery: string
  selectedMonth: string
  statusFilter: ChecklistStatusFilter
  t: TranslateFunction
  typeFilter: ChecklistTypeFilter
  onClear: () => void
  onMonthChange: (value: string) => void
  onSearchChange: (value: string) => void
  onStatusChange: (value: ChecklistStatusFilter) => void
  onTypeChange: (value: ChecklistTypeFilter) => void
}) {
  return (
    <section className="store-checklists-toolbar" aria-label={getStaticCopy(input.locale, 'Checklist filtreleri', 'Checklist filters')}>
      <label className="store-checklists-filter store-checklists-filter-search">
        <span>{getStaticCopy(input.locale, 'Arama', 'Search')}</span>
        <input
          aria-label={getStaticCopy(input.locale, 'Checklist arama', 'Checklist search')}
          placeholder={getStaticCopy(input.locale, 'Mağaza veya checklist ara', 'Search store or checklist')}
          value={input.searchQuery}
          onChange={(event) => input.onSearchChange(event.target.value)}
        />
      </label>
      <label className="store-checklists-filter">
        <span>{getStaticCopy(input.locale, 'Ay', 'Month')}</span>
        <select
          aria-label={getStaticCopy(input.locale, 'Ay filtresi', 'Month filter')}
          value={input.selectedMonth}
          onChange={(event) => input.onMonthChange(event.target.value)}
        >
          {input.monthOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="store-checklists-filter">
        <span>{input.t('storeChecklists.templateType')}</span>
        <select
          aria-label={input.t('storeChecklists.templateType')}
          value={input.typeFilter}
          onChange={(event) => input.onTypeChange(event.target.value as ChecklistTypeFilter)}
        >
          <option value="all">{getStaticCopy(input.locale, 'BM + VM', 'BM + VM')}</option>
          <option value="BM_STORE_VISIT">{input.t('storeChecklists.coverage.bm')}</option>
          <option value="VM_STORE_VISIT">{input.t('storeChecklists.coverage.vm')}</option>
        </select>
      </label>
      <label className="store-checklists-filter">
        <span>{input.t('storeChecklists.status')}</span>
        <select
          aria-label={input.t('storeChecklists.status')}
          value={input.statusFilter}
          onChange={(event) => input.onStatusChange(event.target.value as ChecklistStatusFilter)}
        >
          <option value="all">{getStaticCopy(input.locale, 'Tüm durumlar', 'All statuses')}</option>
          <option value="missing">{input.t('storeChecklists.noVisit')}</option>
          <option value="draft">{input.t('storeChecklists.coverage.draft')}</option>
          <option value="completed">{input.t('storeChecklists.status.completed')}</option>
          <option value="pending">{input.t('storeChecklists.needsAcknowledgement')}</option>
          <option value="acknowledged">{input.t('storeChecklists.acknowledged')}</option>
        </select>
      </label>
      <button className="store-checklists-ghost-button" type="button" onClick={input.onClear}>
        {getStaticCopy(input.locale, 'Filtreleri sıfırla', 'Reset filters')}
      </button>
    </section>
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

  return (
    <article className="store-checklists-history-row">
      <div className="store-checklists-row-main">
        <ChecklistBadge tone={input.item.templateType === 'VM_STORE_VISIT' ? 'accent' : 'neutral'}>
          {formatChecklistTemplateType(input.t, input.item.templateType)}
        </ChecklistBadge>
        <strong>{input.item.templateName}</strong>
        <p>{formatCompletedSentence(input.t, input.locale, input.item)}</p>
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
      <button className="store-checklists-action-button" type="button" onClick={input.onOpen}>
        {input.t('storeChecklists.viewResultDetail')}
      </button>
      {input.item.acknowledgement?.acknowledgementNote ? (
        <p className="store-checklists-row-note">{input.item.acknowledgement.acknowledgementNote}</p>
      ) : null}
    </article>
  )
}

function ChecklistVisitModal(input: {
  active?: MobileChecklistToday['activeInstances'][number]
  comments: Record<string, string>
  isCompleting: boolean
  isSaving: boolean
  isStarting: boolean
  locale: AppLocale
  onClose: () => void
  onCommentChange: (templateItemId: string, comment: string) => void
  onComplete: (checklistInstanceId: string) => void
  onScoreChange: (templateItemId: string, score: number | null) => void
  onStart: (session: ChecklistSession) => void
  scores: Record<string, number>
  session: ChecklistSession
  t: TranslateFunction
}) {
  const sections = groupChecklistTemplateItems(input.session.template.items)
  const hasItems = input.session.template.items.length > 0
  const answeredCount = input.session.template.items.filter(
    (item) => Number.isFinite(input.scores[item.templateItemId]),
  ).length
  const progressPercent = hasItems
    ? Math.round((answeredCount / input.session.template.items.length) * 100)
    : 0
  const scoredRatios = input.session.template.items
    .map((item) => {
      const score = input.scores[item.templateItemId]
      return Number.isFinite(score) && item.maxScore > 0
        ? Math.round((score / item.maxScore) * 100)
        : null
    })
    .filter((ratio): ratio is number => ratio !== null)
  const currentScore =
    scoredRatios.length > 0
      ? Math.round(scoredRatios.reduce((sum, ratio) => sum + ratio, 0) / scoredRatios.length)
      : 0
  const missingResponseCount = Math.max(input.session.template.items.length - answeredCount, 0)
  const canComplete =
    Boolean(input.active) && !input.isCompleting && hasItems && missingResponseCount === 0

  return (
    <div className="store-checklist-modal-backdrop">
      <section
        aria-labelledby="store-checklist-modal-title"
        aria-modal="true"
        className="store-checklist-modal"
        role="dialog"
      >
        <div className="store-checklist-modal-head">
          <div>
            <div className="store-checklists-eyebrow">{input.t('storeChecklists.sessionEyebrow')}</div>
            <h3 id="store-checklist-modal-title">{input.session.template.templateName}</h3>
            <p>
              {input.t('storeChecklists.sessionCopy', {
                store: input.session.store.storeName,
                template: input.session.template.templateCode,
                version: input.session.template.versionNo,
              })}
            </p>
          </div>
          <ChecklistBadge tone={input.active ? 'warning' : 'accent'}>
            {input.active
              ? formatChecklistStatus(input.t, input.active.status)
              : input.t('storeChecklists.newVisit')}
          </ChecklistBadge>
        </div>

        <div className="store-checklist-modal-summary">
          <ChecklistFact label={input.t('storeChecklists.store')} value={input.session.store.storeName} />
          <ChecklistFact label={input.t('storeChecklists.templateCode')} value={input.session.template.templateCode} />
          <ChecklistFact label={input.t('storeChecklists.templateVersion')} value={`v${input.session.template.versionNo}`} />
          <ChecklistScoreBar
            label={getStaticCopy(input.locale, 'İlerleme', 'Progress')}
            percent={progressPercent}
            tone={progressPercent >= 100 ? 'calm' : 'accent'}
            value={`${answeredCount}/${input.session.template.items.length}`}
          />
        </div>

        {!input.active ? (
          <div className="store-checklist-modal-start">
            <div>
              <strong>{input.t('storeChecklists.sessionStartTitle')}</strong>
              <p>{input.t('storeChecklists.sessionStartCopy')}</p>
            </div>
            <button
              className="store-checklists-action-button"
              disabled={input.isStarting || !hasItems}
              type="button"
              onClick={() => input.onStart(input.session)}
            >
              {input.isStarting
                ? input.t('storeChecklists.startPending')
                : input.t('storeChecklists.startChecklist')}
            </button>
          </div>
        ) : null}

        {!hasItems ? (
          <ChecklistEmptyBlock
            copy={input.t('storeChecklists.emptyTemplateCopy')}
            title={input.t('storeChecklists.emptyTemplateTitle')}
          />
        ) : (
          <div className="store-checklist-modal-layout">
            <aside className="store-checklist-modal-live">
              <span>{getStaticCopy(input.locale, 'Canlı skor', 'Live score')}</span>
              <strong>{currentScore}</strong>
              <ChecklistScoreBar
                label={input.t('storeChecklists.score')}
                percent={currentScore}
                tone={currentScore >= 70 ? 'calm' : 'warning'}
                value={`${currentScore}%`}
              />
              <p>
                {getStaticCopy(
                  input.locale,
                  'Maddeleri sırayla doldur; düşük puanlı cevaplarda not bırakmak saha takibini kolaylaştırır.',
                  'Answers are auto-saved as you fill items; notes on low scores make field follow-up easier.',
                )}
              </p>
            </aside>
            <div className="store-checklist-modal-sections">
              {sections.map((section) => (
                <article className="store-checklist-modal-section" key={section.name}>
                  <div className="store-checklist-modal-section-head">
                    <strong>{section.name}</strong>
                    <ChecklistBadge tone="accent">
                      {input.t('storeChecklists.sectionItemCount', { count: section.items.length })}
                    </ChecklistBadge>
                  </div>
                  <div className="store-checklist-modal-items">
                    {section.items.map((item) => (
                      <div className="store-checklist-modal-item" key={item.templateItemId}>
                        <div className="store-checklist-modal-item-copy">
                          <span>{item.itemNo}</span>
                          <div>
                            <strong>{item.itemText}</strong>
                            <p>
                              {input.t('storeChecklists.itemMeta', {
                                maxScore: item.maxScore,
                                weight: item.weight,
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="store-checklist-modal-inputs">
                          <label>
                            <span>{input.t('storeChecklists.scoreInput')}</span>
                            <input
                              disabled={!input.active}
                              max={item.maxScore}
                              min={0}
                              type="number"
                              value={input.scores[item.templateItemId] ?? ''}
                              onChange={(event) =>
                                input.onScoreChange(
                                  item.templateItemId,
                                  parseChecklistScoreInput(event.target.value, item.maxScore),
                                )
                              }
                            />
                          </label>
                          <label>
                            <span>{input.t('storeChecklists.noteInput')}</span>
                            <textarea
                              disabled={!input.active}
                              rows={2}
                              value={input.comments[item.templateItemId] ?? ''}
                              onChange={(event) =>
                                input.onCommentChange(item.templateItemId, event.target.value)
                              }
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="store-checklist-modal-footer">
          {missingResponseCount > 0 ? (
            <p className="store-checklists-inline-notice">
              {input.t('storeChecklists.missingResponsesHint', {
                count: missingResponseCount,
              })}
            </p>
          ) : input.isSaving ? (
            <p className="store-checklists-inline-notice">{input.t('storeChecklists.autosaving')}</p>
          ) : null}
          <button className="store-checklists-ghost-button" type="button" onClick={input.onClose}>
            {input.t('storeChecklists.cancelSession')}
          </button>
          <button
            className="store-checklists-action-button"
            disabled={!canComplete}
            type="button"
            onClick={() => {
              if (!input.active) return
              if (!window.confirm(input.t('storeChecklists.completeSessionConfirm'))) return
              input.onComplete(input.active.checklistInstanceId)
            }}
          >
            {input.isCompleting
              ? input.t('storeChecklists.completing')
              : input.t('storeChecklists.complete')}
          </button>
        </div>
      </section>
    </div>
  )
}

function ChecklistResultModal(input: {
  acknowledgementNote: string
  canAcknowledge: boolean
  isAcknowledging: boolean
  item: ChecklistAcknowledgementItem
  locale: AppLocale
  onAcknowledge: () => void
  onClose: () => void
  onNoteChange: (note: string) => void
  t: TranslateFunction
}) {
  const lowScoreResponses = getLowScoreResponses(input.item.responses)
  const sections = groupChecklistResultResponses(input.item.responses)
  const hasAcknowledgement = input.item.acknowledgement !== null
  const scorePercent = input.item.totalScore ?? Math.round((input.item.complianceRate ?? 0) * 100)

  return (
    <div className="store-checklist-modal-backdrop">
      <section
        aria-labelledby="store-checklist-result-title"
        aria-modal="true"
        className="store-checklist-modal store-checklist-result-modal"
        role="dialog"
      >
        <div className="store-checklist-modal-head">
          <div>
            <div className="store-checklists-eyebrow">{input.t('storeChecklists.resultEyebrow')}</div>
            <h3 id="store-checklist-result-title">{input.item.templateName}</h3>
            <p>{formatCompletedSentence(input.t, input.locale, input.item)}</p>
          </div>
          <button className="store-checklists-ghost-button" type="button" onClick={input.onClose}>
            {input.t('storeChecklists.closeSession')}
          </button>
        </div>

        <div className="store-checklist-modal-summary">
          <ChecklistFact label={input.t('storeChecklists.store')} value={input.item.storeName || input.item.storeId} />
          <ChecklistFact label={input.t('storeChecklists.templateType')} value={formatChecklistTemplateType(input.t, input.item.templateType)} />
          <ChecklistScoreBar
            label={input.t('storeChecklists.score')}
            percent={scorePercent}
            tone={scorePercent >= 70 ? 'calm' : 'warning'}
            value={formatScoreValue(input.t, input.item.totalScore)}
          />
          <ChecklistFact
            label={input.t('storeChecklists.compliance')}
            value={formatComplianceValue(input.t, input.item.complianceRate)}
          />
        </div>

        <div className="store-checklist-result-summary">
          <ChecklistFact
            label={input.t('storeChecklists.resultCompletedBy')}
            value={input.item.completedByUserId ?? input.t('storeChecklists.unknown')}
          />
          <ChecklistFact
            label={input.t('storeChecklists.resultLowScore')}
            value={input.t('storeChecklists.lowScoreCount', { count: lowScoreResponses.length })}
          />
          <ChecklistFact
            label={input.t('storeChecklists.resultStatus')}
            value={
              hasAcknowledgement
                ? input.t('storeChecklists.acknowledged')
                : input.t('storeChecklists.needsAcknowledgement')
            }
          />
        </div>

        {lowScoreResponses.length > 0 ? (
          <div className="store-checklist-result-alert">
            <strong>{input.t('storeChecklists.lowScoreTitle')}</strong>
            <p>
              {lowScoreResponses
                .slice(0, 3)
                .map((response) => response.itemText)
                .join(' / ')}
            </p>
          </div>
        ) : null}

        <div className="store-checklist-result-sections">
          {sections.map((section) => (
            <article className="store-checklist-result-section" key={section.name}>
              <div className="store-checklist-result-section-head">
                <div>
                  <strong>{section.name || input.t('storeChecklists.section')}</strong>
                  <p>
                    {input.t('storeChecklists.sectionResultSummary', {
                      score: section.averageScore,
                      count: section.items.length,
                    })}
                  </p>
                </div>
                <ChecklistScoreBar
                  label={input.t('storeChecklists.score')}
                  percent={section.averageScore}
                  tone={section.averageScore >= 70 ? 'calm' : 'warning'}
                  value={`${section.averageScore}%`}
                />
              </div>
              <div className="store-checklist-result-items">
                {section.items.map((response) => {
                  const ratio = getResponseRatio(response)
                  const isLowScore = ratio !== null && ratio < 70

                  return (
                    <div
                      className={`store-checklist-result-item${isLowScore ? ' store-checklist-result-item-low' : ''}`}
                      key={response.templateItemId}
                    >
                      <div>
                        <strong>{response.itemText}</strong>
                        {response.commentText ? <p>{response.commentText}</p> : null}
                      </div>
                      <ChecklistFact
                        label={input.t('storeChecklists.score')}
                        value={
                          response.scoreValue === null
                            ? input.t('storeChecklists.noScore')
                            : `${response.scoreValue}/${response.maxScore}`
                        }
                      />
                    </div>
                  )
                })}
              </div>
            </article>
          ))}
        </div>

        <div className="store-checklist-result-ack">
          {hasAcknowledgement ? (
            <>
              <div className="store-checklists-eyebrow">{input.t('storeChecklists.acknowledged')}</div>
              <p>
                {input.item.acknowledgement?.acknowledgedAt
                  ? formatDateTime(input.item.acknowledgement.acknowledgedAt, input.locale)
                  : input.t('storeChecklists.unknown')}
              </p>
              {input.item.acknowledgement?.acknowledgementNote ? (
                <p>{input.item.acknowledgement.acknowledgementNote}</p>
              ) : null}
            </>
          ) : input.canAcknowledge ? (
            <>
              <label className="store-checklists-eyebrow" htmlFor={`result-ack-note-${input.item.checklistInstanceId}`}>
                {input.t('storeChecklists.acknowledgementNote')}
              </label>
              <textarea
                id={`result-ack-note-${input.item.checklistInstanceId}`}
                rows={3}
                value={input.acknowledgementNote}
                onChange={(event) => input.onNoteChange(event.target.value)}
                placeholder={input.t('storeChecklists.acknowledgementNotePlaceholder')}
              />
              <div className="store-checklist-modal-footer">
                <button className="store-checklists-ghost-button" type="button" onClick={input.onClose}>
                  {input.t('storeChecklists.cancelSession')}
                </button>
                <button
                  className="store-checklists-action-button"
                  disabled={input.isAcknowledging}
                  type="button"
                  onClick={input.onAcknowledge}
                >
                  {input.isAcknowledging
                    ? input.t('storeChecklists.acknowledging')
                    : input.t('storeChecklists.acknowledge')}
                </button>
              </div>
            </>
          ) : (
            <p className="store-checklists-inline-notice">{input.t('storeChecklists.reviewOnlyCopy')}</p>
          )}
        </div>
      </section>
    </div>
  )
}

function ChecklistMetric(input: { label: string; tone: ChecklistTone; value: string }) {
  return (
    <div className={`store-checklists-metric store-checklists-tone-${input.tone}`}>
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </div>
  )
}

function ChecklistBadge(input: { children: string; tone: ChecklistTone }) {
  return <span className={`store-checklists-badge store-checklists-tone-${input.tone}`}>{input.children}</span>
}

function ChecklistFact(input: { label: string; value: string }) {
  return (
    <div className="store-checklists-fact">
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </div>
  )
}

function ChecklistScoreBar(input: {
  label: string
  percent: number
  tone: ChecklistTone
  value: string
}) {
  const percent = clamp(input.percent, 0, 100)

  return (
    <div className="store-checklists-scorebar">
      <div>
        <span>{input.label}</span>
        <strong>{input.value}</strong>
      </div>
      <i aria-hidden="true">
        <b className={`store-checklists-tone-${input.tone}`} style={{ width: `${percent}%` }} />
      </i>
    </div>
  )
}

function ChecklistEmptyBlock(input: { copy: string; title: string }) {
  return (
    <div className="store-checklists-empty-block">
      <strong>{input.title}</strong>
      <p>{input.copy}</p>
    </div>
  )
}

function SortButton(input: {
  active: boolean
  children: string
  direction: ChecklistSortDirection
  onClick: () => void
}) {
  return (
    <button
      className={`store-checklists-sort-button${input.active ? ' store-checklists-sort-button-active' : ''}`}
      type="button"
      onClick={input.onClick}
    >
      <span>{input.children}</span>
      <small aria-hidden="true">{input.active ? (input.direction === 'asc' ? '↑' : '↓') : '↕'}</small>
    </button>
  )
}

function groupChecklistTemplateItems(items: MobileChecklistToday['templates'][number]['items']) {
  const sections = new Map<
    string,
    { name: string; items: MobileChecklistToday['templates'][number]['items'] }
  >()

  for (const item of items) {
    const section = sections.get(item.sectionName) ?? { name: item.sectionName, items: [] }
    section.items.push(item)
    sections.set(item.sectionName, section)
  }

  return [...sections.values()]
}

function groupChecklistResultResponses(items: ChecklistAcknowledgementItem['responses']) {
  const sections = new Map<
    string,
    { name: string; items: ChecklistAcknowledgementItem['responses']; averageScore: number }
  >()

  for (const item of items) {
    const section = sections.get(item.sectionName) ?? {
      name: item.sectionName,
      items: [],
      averageScore: 0,
    }
    section.items.push(item)
    sections.set(item.sectionName, section)
  }

  return [...sections.values()].map((section) => {
    const ratios = section.items
      .map((item) => getResponseRatio(item))
      .filter((ratio): ratio is number => ratio !== null)
    const averageScore =
      ratios.length > 0
        ? Math.round(ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length)
        : 0

    return {
      ...section,
      averageScore,
    }
  })
}

function getLowScoreResponses(items: ChecklistAcknowledgementItem['responses']) {
  return items.filter((item) => {
    const ratio = getResponseRatio(item)
    return ratio !== null && ratio < 70
  })
}

function getResponseRatio(item: ChecklistAcknowledgementItem['responses'][number]) {
  if (item.scoreValue === null || item.maxScore <= 0) {
    return null
  }

  return Math.round((item.scoreValue / item.maxScore) * 100)
}

function getCoverageRowKey(storeId: string, checklistTemplateId: string) {
  return `${storeId}:${checklistTemplateId}`
}

function getCoverageRowKeyFromRow(row: ChecklistCoverageRow) {
  return getCoverageRowKey(row.store.storeId, row.template.checklistTemplateId)
}

function formatChecklistCoverage(t: TranslateFunction, input: ChecklistCoverageRow) {
  const prefix =
    input.template.templateType === 'VM_STORE_VISIT'
      ? t('storeChecklists.coverage.vm')
      : t('storeChecklists.coverage.bm')

  if (input.active) return t('storeChecklists.coverage.draft')
  if (input.completedCount > 1) {
    return t('storeChecklists.coverage.manyCompleted', {
      count: input.completedCount,
      prefix,
    })
  }
  if (input.completedCount === 1) {
    return t('storeChecklists.coverage.singleCompleted', { prefix })
  }
  return t('storeChecklists.coverage.none', { prefix })
}

function formatChecklistStatus(t: TranslateFunction, status: string) {
  switch (status) {
    case 'in_progress':
      return t('storeChecklists.status.in_progress')
    case 'completed':
      return t('storeChecklists.status.completed')
    case 'draft':
      return t('storeChecklists.status.draft')
    default:
      return formatState(status)
  }
}

function formatChecklistTemplateType(t: TranslateFunction, templateType: string) {
  switch (templateType) {
    case 'BM_STORE_VISIT':
      return t('storeChecklists.coverage.bm')
    case 'VM_STORE_VISIT':
      return t('storeChecklists.coverage.vm')
    default:
      return formatState(templateType)
  }
}

function formatScoreValue(t: TranslateFunction, value: number | null) {
  return value === null ? t('storeChecklists.noScore') : formatNumber(value, 'tr')
}

function formatComplianceValue(t: TranslateFunction, value: number | null) {
  return value === null ? t('storeChecklists.noRate') : `${Math.round(value * 100)}%`
}

function formatCompletedSentence(
  t: TranslateFunction,
  locale: AppLocale,
  item: ChecklistAcknowledgementItem,
) {
  return t('storeChecklists.completedSentence', {
    store: item.storeName || item.storeId,
    category: item.category,
    date: item.completedAt ? formatDateTime(item.completedAt, locale) : t('storeChecklists.recently'),
  })
}

function buildMonthOptions(
  coverageRows: ChecklistCoverageRow[],
  items: ChecklistAcknowledgementItem[],
  locale: AppLocale,
) {
  const monthKeys = new Set<string>()
  for (const row of coverageRows) {
    addMonthKey(monthKeys, row.summary?.monthStart)
    addMonthKey(monthKeys, row.active?.updatedAt)
    addMonthKey(monthKeys, row.active?.startedAt)
  }
  for (const item of items) {
    addMonthKey(monthKeys, item.completedAt)
    addMonthKey(monthKeys, item.acknowledgement?.acknowledgedAt)
  }

  return [
    { value: 'all', label: getStaticCopy(locale, 'Tüm aylar', 'All months') },
    ...[...monthKeys].sort().reverse().map((value) => ({
      value,
      label: formatMonthKey(value, locale),
    })),
  ]
}

function addMonthKey(monthKeys: Set<string>, value?: string | null) {
  const monthKey = getMonthKey(value)
  if (monthKey) monthKeys.add(monthKey)
}

function getMonthKey(value?: string | null) {
  if (!value) return null
  const match = value.match(/^(\d{4})-(\d{2})/)
  if (match) return `${match[1]}-${match[2]}`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthKey(value: string, locale: AppLocale) {
  const [year, month] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1))
}

function doesCoverageRowMatchFilters(
  row: ChecklistCoverageRow,
  filters: {
    month: string
    query: string
    status: ChecklistStatusFilter
    type: ChecklistTypeFilter
  },
) {
  if (filters.type !== 'all' && row.template.templateType !== filters.type) return false
  if (filters.month !== 'all') {
    const rowMonths = [
      getMonthKey(row.summary?.monthStart),
      getMonthKey(row.active?.updatedAt),
      getMonthKey(row.active?.startedAt),
    ]
    if (!rowMonths.includes(filters.month)) return false
  }
  if (!doesStatusMatch(getCoverageStatus(row), filters.status)) return false

  const query = normalizeSearch(filters.query)
  if (!query) return true
  return normalizeSearch(
    `${row.store.storeName} ${row.template.templateName} ${row.template.templateCode} ${row.template.templateType}`,
  ).includes(query)
}

function doesChecklistItemMatchFilters(
  item: ChecklistAcknowledgementItem,
  filters: {
    month: string
    query: string
    status: ChecklistStatusFilter
    type: ChecklistTypeFilter
  },
) {
  if (filters.type !== 'all' && item.templateType !== filters.type) return false
  if (filters.month !== 'all' && getMonthKey(item.completedAt) !== filters.month) return false
  const itemStatus: ChecklistStatusFilter = item.acknowledgement ? 'acknowledged' : 'pending'
  if (!doesStatusMatch(itemStatus, filters.status) && !doesStatusMatch(item.status, filters.status)) {
    return false
  }

  const query = normalizeSearch(filters.query)
  if (!query) return true
  return normalizeSearch(
    `${item.storeName} ${item.templateName} ${item.category} ${item.templateType} ${item.status}`,
  ).includes(query)
}

function doesStatusMatch(itemStatus: string, filterStatus: ChecklistStatusFilter) {
  if (filterStatus === 'all') return true
  if (filterStatus === 'completed') return itemStatus === 'completed'
  return itemStatus === filterStatus
}

function getCoverageStatus(row: ChecklistCoverageRow): ChecklistStatusFilter {
  if (row.active) return 'draft'
  if (row.completedCount > 0) return 'completed'
  return 'missing'
}

function getCoverageTone(row: ChecklistCoverageRow): ChecklistTone {
  if (row.active) return 'warning'
  if (row.completedCount > 0) return 'calm'
  return 'danger'
}

function getCoverageScore(row: ChecklistCoverageRow) {
  return row.summary?.averageScore ?? null
}

function sortCoverageRows(rows: ChecklistCoverageRow[], sort: ChecklistSort, locale: AppLocale) {
  return [...rows].sort((left, right) => {
    const multiplier = sort.direction === 'asc' ? 1 : -1
    const compared = compareCoverageRows(left, right, sort.key, locale)
    return compared * multiplier
  })
}

function compareCoverageRows(
  left: ChecklistCoverageRow,
  right: ChecklistCoverageRow,
  key: ChecklistSortKey,
  locale: AppLocale,
) {
  switch (key) {
    case 'store':
      return compareText(left.store.storeName, right.store.storeName, locale)
    case 'score':
      return compareNumber(getCoverageScore(left) ?? -1, getCoverageScore(right) ?? -1)
    case 'date':
      return compareDate(getCoverageDate(left), getCoverageDate(right))
    case 'status':
      return compareText(getCoverageStatus(left), getCoverageStatus(right), locale)
    case 'priority':
    default:
      return compareNumber(getCoveragePriority(left), getCoveragePriority(right))
  }
}

function sortChecklistItems(
  items: ChecklistAcknowledgementItem[],
  sort: ChecklistSort,
  locale: AppLocale,
) {
  return [...items].sort((left, right) => {
    const multiplier = sort.direction === 'asc' ? 1 : -1
    const compared = compareChecklistItems(left, right, sort.key, locale)
    return compared * multiplier
  })
}

function compareChecklistItems(
  left: ChecklistAcknowledgementItem,
  right: ChecklistAcknowledgementItem,
  key: ChecklistSortKey,
  locale: AppLocale,
) {
  switch (key) {
    case 'store':
      return compareText(left.storeName || left.storeId, right.storeName || right.storeId, locale)
    case 'score':
      return compareNumber(left.totalScore ?? -1, right.totalScore ?? -1)
    case 'status':
      return compareText(left.acknowledgement ? 'acknowledged' : 'pending', right.acknowledgement ? 'acknowledged' : 'pending', locale)
    case 'date':
      return compareDate(left.completedAt, right.completedAt)
    case 'priority':
    default:
      return compareNumber(getLowScoreResponses(left.responses).length, getLowScoreResponses(right.responses).length)
  }
}

function toggleSort(current: ChecklistSort, key: ChecklistSortKey): ChecklistSort {
  if (current.key !== key) {
    return { key, direction: key === 'store' || key === 'status' ? 'asc' : 'desc' }
  }

  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
}

function getCoverageDate(row: ChecklistCoverageRow) {
  return row.active?.updatedAt ?? row.active?.startedAt ?? row.summary?.monthStart ?? null
}

function getCoveragePriority(row: ChecklistCoverageRow) {
  if (row.active) return 4
  if (row.completedCount === 0) return 3
  const score = getCoverageScore(row)
  if (score !== null && score < 70) return 2
  return 1
}

function compareText(left: string, right: string, locale: AppLocale) {
  return left.localeCompare(right, getIntlLocale(locale), { sensitivity: 'base' })
}

function compareNumber(left: number, right: number) {
  return left === right ? 0 : left > right ? 1 : -1
}

function compareDate(left?: string | null, right?: string | null) {
  const leftTime = left ? new Date(left).getTime() : 0
  const rightTime = right ? new Date(right).getTime() : 0
  return compareNumber(
    Number.isNaN(leftTime) ? 0 : leftTime,
    Number.isNaN(rightTime) ? 0 : rightTime,
  )
}

function normalizeSearch(input: string) {
  return input.trim().toLocaleLowerCase('tr-TR')
}

function formatOptionalDate(value: string | null | undefined, locale: AppLocale) {
  return value ? formatDateTime(value, locale) : '-'
}

function buildChecklistResponseDrafts(input: {
  checklistInstanceId: string
  comments: Record<string, string>
  scores: Record<string, number>
  session: ChecklistSession
}): ChecklistResponseDraft[] {
  const drafts: ChecklistResponseDraft[] = []

  for (const item of input.session.template.items) {
    const score = input.scores[item.templateItemId]
    if (!Number.isFinite(score)) continue

    drafts.push({
        checklistInstanceId: input.checklistInstanceId,
        templateItemId: item.templateItemId,
        scoreValue: score,
        commentText: input.comments[item.templateItemId] || undefined,
    })
  }

  return drafts
}

function getChecklistResponseDraftKey(input: {
  checklistInstanceId: string
  templateItemId: string
}) {
  return `${input.checklistInstanceId}:${input.templateItemId}`
}

function serializeChecklistResponseDraft(input: {
  scoreValue: number
  commentText?: string
}) {
  return JSON.stringify({
    commentText: input.commentText ?? '',
    scoreValue: input.scoreValue,
  })
}

function parseChecklistScoreInput(value: string, maxScore: number) {
  if (value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return clamp(parsed, 0, maxScore)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getStaticCopy(locale: AppLocale, tr: string, en: string) {
  return locale === 'en' ? en : tr
}
