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

type ChecklistStoreVisitRow = {
  store: MobileChecklistToday['stores'][number]
  bm?: ChecklistCoverageRow
  vm?: ChecklistCoverageRow
  primary: ChecklistCoverageRow
}

type ChecklistSession = ChecklistCoverageRow
type ChecklistTone = 'calm' | 'warning' | 'accent' | 'danger' | 'neutral'
type ChecklistTypeFilter = 'all' | 'BM_STORE_VISIT' | 'VM_STORE_VISIT'
type ChecklistStatusFilter = 'all' | 'missing' | 'draft' | 'completed' | 'pending' | 'acknowledged'
type ChecklistSortKey = 'priority' | 'store' | 'score' | 'date' | 'status'
type ChecklistSortDirection = 'asc' | 'desc'
type ChecklistSort = { key: ChecklistSortKey; direction: ChecklistSortDirection }
type ChecklistTab = 'visits' | 'inbox' | 'history'
type ChecklistTabOption = {
  key: ChecklistTab
  label: string
  count: number
  tone: ChecklistTone
}
type ChecklistResponseDraft = {
  checklistInstanceId: string
  templateItemId: string
  scoreValue: number
  commentText?: string
}

const CHECKLIST_COMMAND_NOTICE_KEY = 'store-checklists-command-notice'

export function StoreChecklistsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { locale, t } = useLocalization()
  const queryClient = useQueryClient()
  const [ackNotes, setAckNotes] = useState<Record<string, string>>({})
  const [ackNotice, setAckNotice] = useState<string | null>(() => takeChecklistCommandNotice())
  const [scores, setScores] = useState<Record<string, number>>({})
  const [comments, setComments] = useState<Record<string, string>>({})
  const [selectedSessionKey, setSelectedSessionKey] = useState<string | null>(null)
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [typeFilter, setTypeFilter] = useState<ChecklistTypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<ChecklistStatusFilter>('all')
  const [activeTab, setActiveTab] = useState<ChecklistTab>('visits')
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
  const showCommandNotice = (message: string) => {
    storeChecklistCommandNotice(message)
    setAckNotice(message)
  }
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
      setActiveTab('history')
      showCommandNotice(result.command.message)
    },
  })
  const startVisitMutation = useMutation({
    mutationFn: startMobileChecklistInstance,
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['mobile-checklists-today'] })
      const instance = result.data.checklistInstance
      const rowKey = getCoverageRowKey(variables.storeId, variables.checklistTemplateId)
      setLocalActiveInstances((current) => ({
        ...current,
        [rowKey]: {
          checklistInstanceId: instance.checklist_instance_id,
          checklistTemplateId: variables.checklistTemplateId,
          storeId: variables.storeId,
          status: instance.status,
          startedAt: instance.created_at,
          updatedAt: instance.created_at,
          responses: [],
        },
      }))
      setScores({})
      setComments({})
      setSelectedSessionKey(rowKey)
      setSessionDirty(false)
      showCommandNotice(result.command.message)
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
      const result = await completeMobileChecklistInstance({
        checklistInstanceId: variables.checklistInstanceId,
      })
      showCommandNotice(getStaticCopy(locale, 'Başarıyla Tamamlandı', 'Completed successfully'))
      return result
    },
    onSuccess: (_result, variables) => {
      showCommandNotice(getStaticCopy(locale, 'Başarıyla Tamamlandı', 'Completed successfully'))
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
    },
    onError: (error) => {
      showCommandNotice(getErrorMessage(error))
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
    const nextScores: Record<string, number> = {}
    const nextComments: Record<string, string> = {}

    if (active?.responses.length) {
      for (const response of active.responses) {
        nextScores[response.templateItemId] = response.scoreValue
        const draft = {
          checklistInstanceId: active.checklistInstanceId,
          templateItemId: response.templateItemId,
          scoreValue: response.scoreValue,
          commentText: response.commentText ?? undefined,
        }
        savedResponseDraftsRef.current[getChecklistResponseDraftKey(draft)] =
          serializeChecklistResponseDraft(draft)
        if (response.commentText) nextComments[response.templateItemId] = response.commentText
      }
    }

    setScores(nextScores)
    setComments(nextComments)
    setSessionDirty(false)
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
  const visitStoreRows = sortStoreVisitRows(
    buildChecklistStoreVisitRows(filteredCoverageRows),
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
  const storeCount = new Set(coverageRows.map((row) => row.store.storeId)).size
  const selectedSession =
    coverageRows.find((row) => getCoverageRowKeyFromRow(row) === selectedSessionKey) ?? null
  const resultStoreCount = new Set(items.map((item) => item.storeId)).size
  const completedVisitStoreCount = visitStoreRows.filter((row) =>
    [row.bm, row.vm].some((item) => (item?.completedCount ?? 0) > 0),
  ).length
  const pendingVisitStoreCount = visitStoreRows.filter(hasOpenStoreVisitWork).length
  const heroScoreValues = (canManageVisits
    ? visitStoreRows.map(getStoreVisitScore)
    : items.map((item) => item.totalScore ?? Math.round((item.complianceRate ?? 0) * 100))
  ).filter((value): value is number => value !== null && Number.isFinite(value))
  const heroAverageScore =
    heroScoreValues.length > 0
      ? Math.round((heroScoreValues.reduce((sum, value) => sum + value, 0) / heroScoreValues.length) * 10) / 10
      : null
  const heroStoreCount = canManageVisits ? storeCount : resultStoreCount
  const heroCompletedCount = canManageVisits ? completedVisitStoreCount : acknowledgedItems.length
  const heroWaitingCount = canManageVisits ? pendingVisitStoreCount : pendingItems.length
  const heroScopeLabel = getChecklistHeroScopeLabel(input.authSummary, locale, canManageVisits)
  const commandNotice = ackNotice ?? (completeVisitMutation.isSuccess ? t('storeChecklists.completeSuccess') : null)
  const checklistTabs: ChecklistTabOption[] = [
    ...(canManageVisits
      ? [
          {
            key: 'visits' as const,
            label: t('storeChecklists.visitEyebrow'),
            count: visitStoreRows.length,
            tone: activeVisitCount > 0 ? 'warning' as const : 'accent' as const,
          },
        ]
      : []),
    ...(canUseAcknowledgements
      ? [
          {
            key: 'inbox' as const,
            label: t('storeChecklists.inboxEyebrow'),
            count: filteredPendingItems.length,
            tone: filteredPendingItems.length > 0 ? 'warning' as const : 'calm' as const,
          },
          {
            key: 'history' as const,
            label: t('storeChecklists.recentHistoryEyebrow'),
            count: filteredAcknowledgedItems.length,
            tone: filteredAcknowledgedItems.length > 0 ? 'accent' as const : 'neutral' as const,
          },
        ]
      : []),
  ]
  const selectedTab = checklistTabs.some((tab) => tab.key === activeTab)
    ? activeTab
    : checklistTabs[0]?.key ?? 'visits'

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
          <div className="store-checklists-hero-pills" aria-label={t('storeChecklists.summaryAria')}>
            <ChecklistBadge tone="accent">{heroScopeLabel}</ChecklistBadge>
            <ChecklistBadge tone={heroWaitingCount > 0 ? 'warning' : 'calm'}>
              {getStaticCopy(
                locale,
                `${formatNumber(heroWaitingCount, locale)} mağaza bekliyor`,
                `${formatNumber(heroWaitingCount, locale)} stores waiting`,
              )}
            </ChecklistBadge>
            <ChecklistBadge tone={heroCompletedCount > 0 ? 'calm' : 'neutral'}>
              {getStaticCopy(
                locale,
                `${formatNumber(heroCompletedCount, locale)} kayıt tamamlandı`,
                `${formatNumber(heroCompletedCount, locale)} records completed`,
              )}
            </ChecklistBadge>
          </div>
          <div className="store-checklists-eyebrow">{t('storeChecklists.heroEyebrow')}</div>
          <h2>
            {canManageVisits
              ? getStaticCopy(
                  locale,
                  'Bugünkü saha turunda öncelik düşük checklist skorlu mağazalarda.',
                  'Today’s field route prioritizes stores with low checklist scores.',
                )
              : getStaticCopy(
                  locale,
                  'Mağazana yapılan kontroller tek ekranda.',
                  'Your store checklist receipts stay in one focused surface.',
                )}
          </h2>
          <p>
            {canManageVisits
              ? getStaticCopy(
                  locale,
                  'Bölge = Bölge müdürü. BM kendisine tanımlı mağazaları görür; BM Checklist ve VM Checklist puanlarını birlikte okuyabilir. VM yalnızca kendi VM Checklist kayıtlarına erişir.',
                  'Region means region manager. BM users see assigned stores and can read BM plus VM checklist scores together. VM users only access their own VM checklist records.',
                )
              : getStaticCopy(
                  locale,
                  'BM ve VM sonuçlarını tarih, skor ve kabul durumuyla takip edip mağaza aksiyonunu hızla kapatabilirsin.',
                  'Track BM and VM results by date, score, and acknowledgement status so store follow-up stays tight.',
                )}
          </p>
        </div>
        <div className="store-checklists-command-metrics" aria-label={t('storeChecklists.summaryAria')}>
          <ChecklistMetric
            label={canManageVisits ? getStaticCopy(locale, 'Atanmış mağaza', 'Assigned stores') : t('storeChecklists.store')}
            note={canManageVisits ? getStaticCopy(locale, 'BM kapsamı', 'Field scope') : getStaticCopy(locale, 'Kabul kapsamı', 'Receipt scope')}
            tone={heroStoreCount > 0 ? 'accent' : 'neutral'}
            value={formatNumber(heroStoreCount, locale)}
          />
          <ChecklistMetric
            label={canManageVisits ? getStaticCopy(locale, 'Checklist yapılan', 'Completed visits') : t('storeChecklists.acknowledged')}
            note={canManageVisits ? getStaticCopy(locale, 'Bu ay', 'This month') : getStaticCopy(locale, 'Yakın geçmiş', 'Recent history')}
            tone={heroCompletedCount > 0 ? 'calm' : 'neutral'}
            value={formatNumber(heroCompletedCount, locale)}
          />
          <ChecklistMetric
            label={getStaticCopy(locale, 'Bekleyen', 'Waiting')}
            note={canManageVisits ? getStaticCopy(locale, 'Öncelik sıralı', 'Prioritized') : t('storeChecklists.needsAcknowledgement')}
            tone={heroWaitingCount > 0 ? 'warning' : 'calm'}
            value={formatNumber(heroWaitingCount, locale)}
          />
          <ChecklistMetric
            label={getStaticCopy(locale, 'Ortalama skor', 'Average score')}
            note={canManageVisits ? getStaticCopy(locale, 'BM + VM', 'BM + VM') : getStaticCopy(locale, 'Son sonuçlar', 'Latest results')}
            tone={heroAverageScore !== null && heroAverageScore >= 70 ? 'calm' : heroAverageScore === null ? 'neutral' : 'warning'}
            value={
              heroAverageScore === null
                ? '-'
                : formatNumber(heroAverageScore, locale, { maximumFractionDigits: 1 })
            }
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

      {checklistTabs.length > 0 ? (
        <ChecklistTabs
          activeTab={selectedTab}
          tabs={checklistTabs}
          onChange={setActiveTab}
        />
      ) : null}

      {commandNotice ? <p className="store-checklists-inline-notice">{commandNotice}</p> : null}

      {canManageVisits && selectedTab === 'visits' ? (
        <section
          aria-label={t('storeChecklists.visitPanelAria')}
          aria-labelledby="store-checklist-tab-visits"
          className="store-checklists-command-card"
          id="store-checklist-panel-visits"
          role="tabpanel"
        >
          <div className="store-checklists-section-head">
            <div>
              <div className="store-checklists-eyebrow">{t('storeChecklists.visitEyebrow')}</div>
              <h3>{t('storeChecklists.visitTitle')}</h3>
              <p>
                {getStaticCopy(
                  locale,
                  'Her satır tek mağaza; BM ve VM checklist skorları birbirine karışmadan okunur.',
                  'Each row is one store; BM and VM checklist scores stay separate.',
                )}
              </p>
            </div>
            <ChecklistBadge tone={activeVisitCount > 0 ? 'warning' : 'accent'}>
              {activeVisitCount > 0
                ? t('storeChecklists.visitStatus.inProgress')
                : t('storeChecklists.visitStatus.ready')}
            </ChecklistBadge>
          </div>

          {visitStoreRows.length === 0 ? (
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
                  {getStaticCopy(locale, 'BM skor', 'BM score')}
                </SortButton>
                <SortButton
                  active={visitSort.key === 'score'}
                  direction={visitSort.direction}
                  onClick={() => setVisitSort(toggleSort(visitSort, 'score'))}
                >
                  {getStaticCopy(locale, 'VM skor', 'VM score')}
                </SortButton>
                <SortButton
                  active={visitSort.key === 'date'}
                  direction={visitSort.direction}
                  onClick={() => setVisitSort(toggleSort(visitSort, 'date'))}
                >
                  {getStaticCopy(locale, 'Son ziyaret', 'Last visit')}
                </SortButton>
                <SortButton
                  active={visitSort.key === 'priority'}
                  direction={visitSort.direction}
                  onClick={() => setVisitSort(toggleSort(visitSort, 'priority'))}
                >
                  {getStaticCopy(locale, 'Düşük alan', 'Low area')}
                </SortButton>
                <span>{getStaticCopy(locale, 'Aksiyon', 'Action')}</span>
              </div>

              {visitStoreRows.map((storeRow) => {
                const actionableRow = getActionableStoreVisitRow(storeRow, input.authSummary)
                const row = actionableRow ?? storeRow.primary
                const active = row.active
                const canStart =
                  Boolean(actionableRow) &&
                  (active || assignedStoreIds.includes(storeRow.store.storeId))
                const rowKey = getCoverageRowKeyFromRow(row)
                const isStartingRow =
                  startVisitMutation.isPending &&
                  startVisitMutation.variables?.storeId === storeRow.store.storeId &&
                  startVisitMutation.variables?.checklistTemplateId === row.template.checklistTemplateId

                return (
                  <article
                    className="store-checklists-visit-row"
                    key={getStoreVisitRowKey(storeRow)}
                  >
                    <div className="store-checklists-row-main">
                      <strong>{storeRow.store.storeName}</strong>
                      <p>{getStoreVisitSummary(t, locale, storeRow)}</p>
                    </div>
                    <ChecklistTemplateScore
                      label={getStaticCopy(locale, 'BM', 'BM')}
                      locale={locale}
                      row={storeRow.bm}
                      t={t}
                    />
                    <ChecklistTemplateScore
                      label={getStaticCopy(locale, 'VM', 'VM')}
                      locale={locale}
                      row={storeRow.vm}
                      t={t}
                    />
                    <ChecklistBadge tone={getStoreVisitDate(storeRow) ? 'accent' : 'danger'}>
                      {formatOptionalDate(getStoreVisitDate(storeRow), locale)}
                    </ChecklistBadge>
                    <ChecklistBadge tone={getStoreVisitRiskTone(storeRow)}>
                      {getStoreVisitRiskLabel(t, locale, storeRow)}
                    </ChecklistBadge>
                    <button
                      className="store-checklists-action-button"
                      disabled={!canStart || (!active && startVisitMutation.isPending)}
                      type="button"
                      onClick={() => {
                        if (active) {
                          hydrateActiveResponseDrafts(active)
                          setSelectedSessionKey(rowKey)
                          return
                        }

                        if (!actionableRow) {
                          return
                        }

                        hydrateActiveResponseDrafts(undefined)
                        setSelectedSessionKey(null)
                        startVisitMutation.mutate({
                          storeId: storeRow.store.storeId,
                          checklistTemplateId: row.template.checklistTemplateId,
                        })
                      }}
                    >
                      {active
                        ? t('storeChecklists.continueChecklist')
                        : isStartingRow
                          ? t('storeChecklists.startPending')
                          : actionableRow
                            ? t('storeChecklists.startChecklist')
                            : getStaticCopy(locale, 'Sadece oku', 'Read only')}
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
            showCommandNotice(getStaticCopy(locale, 'Başarıyla Tamamlandı', 'Completed successfully'))
            setSelectedSessionKey(null)
            setSessionDirty(false)
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

      {canUseAcknowledgements && selectedTab === 'inbox' ? (
        <section
          aria-labelledby="store-checklist-tab-inbox"
          className="store-checklists-command-card"
          id="store-checklist-panel-inbox"
          role="tabpanel"
        >
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

        </section>
      ) : null}

      {canUseAcknowledgements && selectedTab === 'history' ? (
        <section
          aria-labelledby="store-checklist-tab-history"
          className="store-checklists-command-card"
          id="store-checklist-panel-history"
          role="tabpanel"
        >
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
      ) : null}
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

function ChecklistTabs(input: {
  activeTab: ChecklistTab
  tabs: ChecklistTabOption[]
  onChange: (tab: ChecklistTab) => void
}) {
  return (
    <nav className="store-checklists-tabs" role="tablist" aria-label="Checklist bölümleri">
      {input.tabs.map((tab) => (
        <button
          aria-controls={`store-checklist-panel-${tab.key}`}
          aria-selected={input.activeTab === tab.key}
          className={`store-checklists-tab store-checklists-tone-${tab.tone}`}
          id={`store-checklist-tab-${tab.key}`}
          key={tab.key}
          role="tab"
          type="button"
          onClick={() => input.onChange(tab.key)}
        >
          <span>{tab.label}</span>
          <small>{tab.count}</small>
        </button>
      ))}
    </nav>
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
                          <div className="store-checklist-modal-score-control">
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
                            <div className="store-checklist-modal-answer-cluster">
                              {getScoreQuickOptions(input.locale, item.maxScore).map((option) => (
                                <button
                                  className={
                                    input.scores[item.templateItemId] === option.value
                                      ? 'store-checklist-modal-answer-active'
                                      : ''
                                  }
                                  disabled={!input.active}
                                  key={option.label}
                                  type="button"
                                  onClick={() => input.onScoreChange(item.templateItemId, option.value)}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>
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
          {!input.active && input.isStarting ? (
            <p className="store-checklists-inline-notice">{input.t('storeChecklists.startPending')}</p>
          ) : missingResponseCount > 0 ? (
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
  const digest = getChecklistResultDigest(input.t, input.locale, input.item)

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

        <div className={`store-checklist-result-digest-card store-checklist-result-digest-card-${digest.tone}`}>
          <span>{getStaticCopy(input.locale, 'Sonuç özeti', 'Result summary')}</span>
          <strong>{digest.title}</strong>
          <p>{digest.copy}</p>
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

function ChecklistMetric(input: { label: string; note?: string; tone: ChecklistTone; value: string }) {
  return (
    <div className={`store-checklists-metric store-checklists-tone-${input.tone}`}>
      <span>{input.label}</span>
      <strong>{input.value}</strong>
      {input.note ? <small>{input.note}</small> : null}
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
    <div
      className={`store-checklists-scorebar${
        input.tone === 'neutral' ? ' store-checklists-scorebar-empty' : ''
      }`}
    >
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

function ChecklistTemplateScore(input: {
  label: string
  locale: AppLocale
  row?: ChecklistCoverageRow
  t: TranslateFunction
}) {
  const score = input.row ? getCoverageScore(input.row) : null
  const tone = !input.row || score === null ? 'neutral' : score >= 70 ? 'calm' : 'warning'
  const status = input.row
    ? getLocalizedTemplateScoreStatus(input.t, input.locale, input.label, input.row)
    : getStaticCopy(input.locale, `${input.label} yapılmadı`, `${input.label} not done`)

  return (
    <div className="store-checklists-template-score">
      <small>{status}</small>
      <b>
        {score === null ? '-' : formatNumber(score, input.locale)}
        <em>/100</em>
      </b>
      <span className={`store-checklists-template-scorebar${tone === 'neutral' ? ' store-checklists-scorebar-empty' : ''}`}>
        <i>
          <b className={`store-checklists-tone-${tone}`} style={{ width: `${clamp(score ?? 0, 0, 100)}%` }} />
        </i>
      </span>
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

function getStoreVisitRowKey(row: ChecklistStoreVisitRow) {
  return `${row.store.storeId}:${row.bm?.template.checklistTemplateId ?? 'bm'}:${row.vm?.template.checklistTemplateId ?? 'vm'}`
}

function buildChecklistStoreVisitRows(rows: ChecklistCoverageRow[]) {
  const grouped = new Map<string, ChecklistStoreVisitRow>()

  for (const row of rows) {
    const current = grouped.get(row.store.storeId) ?? { store: row.store, primary: row }
    const next = { ...current }

    if (row.template.templateType === 'VM_STORE_VISIT') {
      next.vm = row
    } else {
      next.bm = row
    }

    next.primary = chooseStoreVisitPrimary(next)
    grouped.set(row.store.storeId, next)
  }

  return [...grouped.values()]
}

function chooseStoreVisitPrimary(row: Omit<ChecklistStoreVisitRow, 'primary'> & { primary?: ChecklistCoverageRow }) {
  const primary = row.bm?.active ? row.bm : row.vm?.active ? row.vm : row.bm ?? row.vm ?? row.primary
  if (!primary) {
    throw new Error('Checklist store visit row requires at least one checklist row')
  }
  return primary
}

function getActionableStoreVisitRow(row: ChecklistStoreVisitRow, authSummary: AuthSessionSummary | null) {
  const rows = [row.bm, row.vm].filter((item): item is ChecklistCoverageRow => Boolean(item))
  return rows.find((item) => canMutateChecklistTemplateType(authSummary, item.template.templateType)) ?? null
}

function canMutateChecklistTemplateType(authSummary: AuthSessionSummary | null, templateType: string) {
  if (hasAnyRole(authSummary, ['SUPER_ADMIN'])) return true
  if (templateType === 'BM_STORE_VISIT') return hasAnyRole(authSummary, ['REGION_MANAGER'])
  if (templateType === 'VM_STORE_VISIT') return hasAnyRole(authSummary, ['VISUAL_MERCHANDISER'])
  return false
}

function getLocalizedTemplateScoreStatus(
  t: TranslateFunction,
  locale: AppLocale,
  label: string,
  row: ChecklistCoverageRow,
) {
  if (row.active) return `${label} ${lowercaseChecklistCopy(t('storeChecklists.coverage.draft'), locale)}`
  if (row.completedCount > 0) {
    return `${label} ${lowercaseChecklistCopy(t('storeChecklists.status.completed'), locale)}`
  }
  return `${label} ${lowercaseChecklistCopy(t('storeChecklists.noVisit'), locale)}`
}

function lowercaseChecklistCopy(value: string, locale: AppLocale) {
  return value.toLocaleLowerCase(locale === 'en' ? 'en-US' : 'tr-TR')
}

function getStoreVisitSummary(t: TranslateFunction, locale: AppLocale, row: ChecklistStoreVisitRow) {
  const bm = row.bm ? formatChecklistCoverage(t, row.bm) : getStaticCopy(locale, 'BM yapılmadı', 'BM not done')
  const vm = row.vm ? formatChecklistCoverage(t, row.vm) : getStaticCopy(locale, 'VM yapılmadı', 'VM not done')
  return `${bm} / ${vm}`
}

function getStoreVisitDate(row: ChecklistStoreVisitRow) {
  const dates = [row.bm, row.vm]
    .map((item) => item ? getCoverageDate(item) : null)
    .filter((value): value is string => Boolean(value))
  return dates.sort((left, right) => compareDate(right, left))[0] ?? null
}

function getStoreVisitPriority(row: ChecklistStoreVisitRow) {
  return Math.max(row.bm ? getCoveragePriority(row.bm) : 0, row.vm ? getCoveragePriority(row.vm) : 0)
}

function hasOpenStoreVisitWork(row: ChecklistStoreVisitRow) {
  const rows = [row.bm, row.vm].filter((item): item is ChecklistCoverageRow => Boolean(item))
  if (rows.length === 0) return true
  return rows.some((item) => {
    const score = getCoverageScore(item)
    return item.active || item.completedCount === 0 || (score !== null && score < 70)
  })
}

function getStoreVisitScore(row: ChecklistStoreVisitRow) {
  const scores = [row.bm, row.vm]
    .map((item) => item ? getCoverageScore(item) : null)
    .filter((value): value is number => value !== null)
  if (!scores.length) return null
  return Math.min(...scores)
}

function getStoreVisitRiskTone(row: ChecklistStoreVisitRow): ChecklistTone {
  if (row.bm?.active || row.vm?.active) return 'warning'
  if (!row.bm || !row.vm) return 'danger'
  const score = getStoreVisitScore(row)
  if (score !== null && score < 70) return 'danger'
  return 'calm'
}

function getStoreVisitRiskLabel(t: TranslateFunction, locale: AppLocale, row: ChecklistStoreVisitRow) {
  if (row.bm?.active || row.vm?.active) return t('storeChecklists.coverage.draft')
  if (!row.bm || !row.vm) return getStaticCopy(locale, 'Riskli', 'Risk')
  const score = getStoreVisitScore(row)
  if (score !== null && score < 70) return getStaticCopy(locale, 'Düşük puan', 'Low score')
  return getStaticCopy(locale, 'Temiz', 'Clear')
}

function getChecklistHeroScopeLabel(
  authSummary: AuthSessionSummary | null,
  locale: AppLocale,
  canManageVisits: boolean,
) {
  if (!canManageVisits) {
    return getStaticCopy(locale, 'Mağaza kabulü', 'Store acknowledgement')
  }
  if (hasAnyRole(authSummary, ['REGION_MANAGER'])) {
    return getStaticCopy(locale, 'Bölge Müdürü kapsamı', 'Region manager scope')
  }
  if (hasAnyRole(authSummary, ['VISUAL_MERCHANDISER'])) {
    return getStaticCopy(locale, 'VM kapsamı', 'VM scope')
  }
  return getStaticCopy(locale, 'Operasyon kapsamı', 'Operations scope')
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

function getChecklistResultDigest(
  t: TranslateFunction,
  locale: AppLocale,
  item: ChecklistAcknowledgementItem,
): { copy: string; title: string; tone: ChecklistTone } {
  const lowScoreResponses = getLowScoreResponses(item.responses)
  const templateLabel = formatChecklistTemplateType(t, item.templateType)
  const scorePercent =
    item.totalScore ?? (typeof item.complianceRate === 'number' ? Math.round(item.complianceRate * 100) : null)
  const scoreLabel = item.totalScore === null ? t('storeChecklists.noScore') : formatScoreValue(t, item.totalScore)

  if (lowScoreResponses.length > 0) {
    const firstLowScore = lowScoreResponses[0]?.itemText
    return {
      tone: 'warning',
      title: getStaticCopy(
        locale,
        `${templateLabel} ${scoreLabel}; ${lowScoreResponses.length} düşük madde`,
        `${templateLabel} ${scoreLabel}; ${lowScoreResponses.length} low-score ${
          lowScoreResponses.length === 1 ? 'item' : 'items'
        }`,
      ),
      copy: firstLowScore
        ? getStaticCopy(locale, `Öncelik: ${firstLowScore}`, `Priority: ${firstLowScore}`)
        : getStaticCopy(locale, 'Düşük puanlı maddeler takipte.', 'Low-score items are in follow-up.'),
    }
  }

  if (scorePercent !== null && scorePercent >= 90) {
    return {
      tone: 'calm',
      title: getStaticCopy(locale, `${templateLabel} ${scoreLabel}; güçlü sonuç`, `${templateLabel} ${scoreLabel}; strong result`),
      copy: getStaticCopy(
        locale,
        'Kritik düşük madde görünmüyor; mağaza kabulü sonrası yakın geçmişe alınır.',
        'No critical low item is visible; after store acknowledgement it moves to recent history.',
      ),
    }
  }

  return {
    tone: 'accent',
    title: getStaticCopy(locale, `${templateLabel} ${scoreLabel}; takipte`, `${templateLabel} ${scoreLabel}; in follow-up`),
    copy: getStaticCopy(
      locale,
      'Sonuç mağaza kabul notuyla beraber izlenir.',
      'The result is tracked together with the store acknowledgement note.',
    ),
  }
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

function sortStoreVisitRows(rows: ChecklistStoreVisitRow[], sort: ChecklistSort, locale: AppLocale) {
  return [...rows].sort((left, right) => {
    const multiplier = sort.direction === 'asc' ? 1 : -1
    const compared = compareStoreVisitRows(left, right, sort.key, locale)
    return compared * multiplier
  })
}

function compareStoreVisitRows(
  left: ChecklistStoreVisitRow,
  right: ChecklistStoreVisitRow,
  key: ChecklistSortKey,
  locale: AppLocale,
) {
  switch (key) {
    case 'store':
      return compareText(left.store.storeName, right.store.storeName, locale)
    case 'score':
      return compareNumber(getStoreVisitScore(left) ?? -1, getStoreVisitScore(right) ?? -1)
    case 'date':
      return compareDate(getStoreVisitDate(left), getStoreVisitDate(right))
    case 'status':
      return compareText(getCoverageStatus(left.primary), getCoverageStatus(right.primary), locale)
    case 'priority':
    default:
      return compareNumber(getStoreVisitPriority(left), getStoreVisitPriority(right))
  }
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

function getScoreQuickOptions(locale: AppLocale, maxScore: number) {
  const safeMax = Math.max(0, maxScore)
  return [
    { label: `${getStaticCopy(locale, 'Uygun', 'Good')} ${safeMax}`, value: safeMax },
    {
      label: `${getStaticCopy(locale, 'Takip', 'Watch')} ${Math.round(safeMax * 0.6)}`,
      value: Math.round(safeMax * 0.6),
    },
    {
      label: `${getStaticCopy(locale, 'Kritik', 'Critical')} ${Math.round(safeMax * 0.2)}`,
      value: Math.round(safeMax * 0.2),
    },
  ]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getStaticCopy(locale: AppLocale, tr: string, en: string) {
  return locale === 'en' ? en : tr
}

function takeChecklistCommandNotice() {
  if (typeof window === 'undefined') return null
  const notice = window.sessionStorage.getItem(CHECKLIST_COMMAND_NOTICE_KEY)
  if (notice) {
    window.sessionStorage.removeItem(CHECKLIST_COMMAND_NOTICE_KEY)
  }
  return notice
}

function storeChecklistCommandNotice(message: string) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(CHECKLIST_COMMAND_NOTICE_KEY, message)
}
