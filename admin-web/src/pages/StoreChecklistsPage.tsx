import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, ClipboardList, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  canAcknowledgeChecklist,
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
import {
  mapInboxStatusTone,
  mapWorkflowUrgencyTone,
  toChecklistAcknowledgementInboxItem,
} from '../features/workflow/contracts'
import { formatDateTime, formatState, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'

type ChecklistCoverageRow = {
  store: MobileChecklistToday['stores'][number]
  template: MobileChecklistToday['templates'][number]
  active?: MobileChecklistToday['activeInstances'][number]
  summary?: MobileChecklistToday['monthlySummaries'][number]
  completedCount: number
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
  const canManageVisits = hasAnyRole(input.authSummary, [
    'REGION_MANAGER',
    'VISUAL_MERCHANDISER',
    'SUPER_ADMIN',
  ])
  const canUseAcknowledgements = hasAnyRole(input.authSummary, ['STORE_MANAGER', 'SUPER_ADMIN'])
  const checklistsQuery = useQuery({
    queryKey: ['checklist-acknowledgements'],
    queryFn: getChecklistAcknowledgements,
    enabled: canUseAcknowledgements,
    retry: false,
  })
  const mobileTodayQuery = useQuery({
    queryKey: ['mobile-checklists-today'],
    queryFn: getMobileChecklistToday,
    enabled: canManageVisits,
    retry: false,
  })
  const acknowledgeMutation = useMutation({
    mutationFn: acknowledgeChecklist,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['checklist-acknowledgements'] })
      setAckNotice(result.command.message)
    },
  })
  const startVisitMutation = useMutation({
    mutationFn: startMobileChecklistInstance,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['mobile-checklists-today'] })
      setAckNotice(result.command.message)
    },
  })
  const saveResponseMutation = useMutation({
    mutationFn: saveMobileChecklistResponse,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mobile-checklists-today'] })
      setAckNotice(t('storeChecklists.responseSaved'))
    },
  })
  const completeVisitMutation = useMutation({
    mutationFn: completeMobileChecklistInstance,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['mobile-checklists-today'] })
      setAckNotice(result.command.message)
    },
  })

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
  const inboxItems = items.map((item) => toChecklistAcknowledgementInboxItem(item))
  const pendingItems = items.filter((item) => item.acknowledgement === null)
  const acknowledgedItems = items.filter((item) => item.acknowledgement !== null).slice(0, 5)
  const assignedStoreIds = getAssignedStoreIds(input.authSummary)
  const primaryStoreId = assignedStoreIds[0] ?? t('storeChecklists.noActionStore')
  const coverageRows: ChecklistCoverageRow[] = (mobileToday?.stores ?? []).flatMap((store) =>
    (mobileToday?.templates ?? []).map((template) => {
      const active = mobileToday?.activeInstances.find(
        (item) =>
          item.storeId === store.storeId &&
          item.checklistTemplateId === template.checklistTemplateId,
      )
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
  const activeVisitCount = coverageRows.filter((row) => row.active).length

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">{t('storeChecklists.heroEyebrow')}</div>
          <h2 className="hero-title">{t('storeChecklists.title')}</h2>
          <p className="hero-copy">{t('storeChecklists.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('storeChecklists.route')} value="/store/checklists" />
          <MetricAccent label={t('storeChecklists.storeScope')} value={primaryStoreId} />
          <MetricAccent
            label={t('storeChecklists.mode')}
            value={
              canManageVisits
                ? t('storeChecklists.mode.visit')
                : t('storeChecklists.mode.acknowledgement')
            }
          />
        </div>
      </section>

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title={t('storeChecklists.pendingAcknowledgements')}
          value={inboxItems.filter((item) => item.inboxStatus === 'needs_attention').length}
          note={t('storeChecklists.pendingAcknowledgementsNote')}
          icon={<ClipboardList size={18} />}
          tone={pendingItems.length > 0 ? 'warning' : 'accent'}
        />
        <MetricCard
          title={t('storeChecklists.acknowledged')}
          value={inboxItems.filter((item) => item.inboxStatus === 'completed').length}
          note={t('storeChecklists.acknowledgedNote')}
          icon={<BadgeCheck size={18} />}
          tone="calm"
        />
        <MetricCard
          title={t('storeChecklists.actionModel')}
          value={1}
          note={t('storeChecklists.actionModelNote')}
          icon={<ShieldAlert size={18} />}
          tone="accent"
        />
      </section>

      {canManageVisits ? (
        <section className="panel" aria-label={t('storeChecklists.visitPanelAria')}>
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeChecklists.visitEyebrow')}</div>
              <h3>{t('storeChecklists.visitTitle')}</h3>
            </div>
            <StatusPill tone={activeVisitCount > 0 ? 'warning' : 'accent'}>
              {activeVisitCount > 0
                ? t('storeChecklists.visitStatus.inProgress')
                : t('storeChecklists.visitStatus.ready')}
            </StatusPill>
          </div>

          {coverageRows.length === 0 ? (
            <EmptyState
              title={t('storeChecklists.noActiveChecklistTitle')}
              copy={t('storeChecklists.noActiveChecklistCopy')}
            />
          ) : (
            <div className="stacked-table">
              {coverageRows.map((row) => {
                const active = row.active
                return (
                  <article
                    className="stacked-row"
                    key={`${row.store.storeId}:${row.template.checklistTemplateId}`}
                  >
                    <div className="stacked-row-head">
                      <strong>{row.store.storeName}</strong>
                      <StatusPill
                        tone={active ? 'warning' : row.completedCount > 0 ? 'calm' : 'danger'}
                      >
                        {formatChecklistCoverage(t, row)}
                      </StatusPill>
                    </div>
                    <p>{row.template.templateName}</p>
                    <div className="key-grid">
                      <KeyValue label={t('storeChecklists.templateType')} value={row.template.templateType} />
                      <KeyValue label={t('storeChecklists.thisMonth')} value={formatMonthlySummary(t, row)} />
                      <KeyValue
                        label={t('storeChecklists.status')}
                        value={active ? formatChecklistStatus(t, active.status) : t('storeChecklists.newVisit')}
                      />
                      <KeyValue label={t('storeChecklists.store')} value={row.store.storeId} />
                    </div>

                    {active ? (
                      <div className="stacked-table">
                        {row.template.items.map((item) => (
                          <article className="stacked-row" key={item.templateItemId}>
                            <div className="stacked-row-head">
                              <strong>{item.itemText}</strong>
                              <StatusPill tone="accent">{`${item.weight}%`}</StatusPill>
                            </div>
                            <div className="key-grid">
                              <KeyValue label={t('storeChecklists.section')} value={item.sectionName} />
                              <KeyValue label={t('storeChecklists.maxScore')} value={String(item.maxScore)} />
                            </div>
                            <label className="eyebrow" htmlFor={`score-${item.templateItemId}`}>
                              {t('storeChecklists.scoreInput')}
                            </label>
                            <input
                              id={`score-${item.templateItemId}`}
                              type="number"
                              min={0}
                              max={item.maxScore}
                              value={scores[item.templateItemId] ?? 0}
                              onChange={(event) =>
                                setScores((current) => ({
                                  ...current,
                                  [item.templateItemId]: Number(event.target.value),
                                }))
                              }
                            />
                            <label className="eyebrow" htmlFor={`comment-${item.templateItemId}`}>
                              {t('storeChecklists.noteInput')}
                            </label>
                            <textarea
                              id={`comment-${item.templateItemId}`}
                              rows={2}
                              value={comments[item.templateItemId] ?? ''}
                              onChange={(event) =>
                                setComments((current) => ({
                                  ...current,
                                  [item.templateItemId]: event.target.value,
                                }))
                              }
                            />
                            <div className="action-cluster">
                              <button
                                className="control-button"
                                type="button"
                                disabled={saveResponseMutation.isPending}
                                onClick={() =>
                                  saveResponseMutation.mutate({
                                    checklistInstanceId: active.checklistInstanceId,
                                    templateItemId: item.templateItemId,
                                    scoreValue: scores[item.templateItemId] ?? 0,
                                    commentText: comments[item.templateItemId] || undefined,
                                  })
                                }
                              >
                                {t('storeChecklists.save')}
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : null}

                    <div className="action-cluster">
                      {!active ? (
                        <button
                          className="control-button"
                          type="button"
                          disabled={
                            !assignedStoreIds.includes(row.store.storeId) ||
                            startVisitMutation.isPending
                          }
                          onClick={() =>
                            startVisitMutation.mutate({
                              storeId: row.store.storeId,
                              checklistTemplateId: row.template.checklistTemplateId,
                            })
                          }
                        >
                          {startVisitMutation.isPending
                            ? t('storeChecklists.startPending')
                            : t('storeChecklists.startChecklist')}
                        </button>
                      ) : (
                        <>
                          <button className="control-button" type="button" disabled>
                            {t('storeChecklists.startChecklist')}
                          </button>
                          <button
                            className="control-button"
                            type="button"
                            disabled={completeVisitMutation.isPending}
                            onClick={() =>
                              completeVisitMutation.mutate({
                                checklistInstanceId: active.checklistInstanceId,
                              })
                            }
                          >
                            {t('storeChecklists.complete')}
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {startVisitMutation.isError ? (
            <p className="queue-subtitle">{getErrorMessage(startVisitMutation.error)}</p>
          ) : null}
          {saveResponseMutation.isError ? (
            <p className="queue-subtitle">{getErrorMessage(saveResponseMutation.error)}</p>
          ) : null}
          {completeVisitMutation.isError ? (
            <p className="queue-subtitle">{getErrorMessage(completeVisitMutation.error)}</p>
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('storeChecklists.inboxEyebrow')}</div>
            <h3>{t('storeChecklists.inboxTitle')}</h3>
          </div>
          <StatusPill tone={pendingItems.length > 0 ? 'warning' : 'calm'}>
            {pendingItems.length > 0
              ? t('storeChecklists.needsAcknowledgement')
              : t('storeChecklists.clear')}
          </StatusPill>
        </div>

        {pendingItems.length === 0 ? (
          <EmptyState
            title={t('storeChecklists.noPendingTitle')}
            copy={t('storeChecklists.noPendingCopy')}
          />
        ) : (
          <div className="stacked-table">
            {pendingItems.map((item) => (
              <article className="stacked-row" key={item.checklistInstanceId}>
                <div className="stacked-row-head">
                  <strong>{item.templateName}</strong>
                  <StatusPill tone={mapInboxStatusTone(toChecklistAcknowledgementInboxItem(item).inboxStatus)}>
                    {formatChecklistStatus(t, item.status)}
                  </StatusPill>
                </div>
                <p>{formatCompletedSentence(t, locale, item)}</p>
                <div className="key-grid">
                  <KeyValue label={t('storeChecklists.checklistInstance')} value={item.checklistInstanceId} />
                  <KeyValue
                    label={t('storeChecklists.score')}
                    value={item.totalScore !== null ? String(item.totalScore) : t('storeChecklists.noScore')}
                  />
                  <KeyValue
                    label={t('storeChecklists.compliance')}
                    value={
                      item.complianceRate !== null
                        ? `${Math.round(item.complianceRate * 100)}%`
                        : t('storeChecklists.noRate')
                    }
                  />
                  <KeyValue label={t('storeChecklists.store')} value={item.storeName || item.storeId} />
                </div>
                {canAcknowledgeChecklist(input.authSummary, item.storeId) ? (
                  <>
                    <label className="eyebrow" htmlFor={`ack-note-${item.checklistInstanceId}`}>
                      {t('storeChecklists.acknowledgementNote')}
                    </label>
                    <textarea
                      id={`ack-note-${item.checklistInstanceId}`}
                      rows={3}
                      value={ackNotes[item.checklistInstanceId] ?? ''}
                      onChange={(event) =>
                        setAckNotes((current) => ({
                          ...current,
                          [item.checklistInstanceId]: event.target.value,
                        }))
                      }
                      placeholder={t('storeChecklists.acknowledgementNotePlaceholder')}
                    />
                    <div className="action-cluster">
                      <StatusPill tone={mapWorkflowUrgencyTone(toChecklistAcknowledgementInboxItem(item).urgency)}>
                        {`${t('storeChecklists.urgency')}: ${formatChecklistUrgency(t, toChecklistAcknowledgementInboxItem(item).urgency)}`}
                      </StatusPill>
                      <button
                        className="control-button"
                        type="button"
                        disabled={
                          acknowledgeMutation.isPending &&
                          acknowledgeMutation.variables?.checklistInstanceId === item.checklistInstanceId
                        }
                        onClick={() =>
                          acknowledgeMutation.mutate({
                            checklistInstanceId: item.checklistInstanceId,
                            acknowledgementNote: ackNotes[item.checklistInstanceId] || undefined,
                          })
                        }
                      >
                        {acknowledgeMutation.isPending &&
                        acknowledgeMutation.variables?.checklistInstanceId === item.checklistInstanceId
                          ? t('storeChecklists.acknowledging')
                          : t('storeChecklists.acknowledge')}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="queue-subtitle">{t('storeChecklists.reviewOnlyCopy')}</p>
                )}
              </article>
            ))}
          </div>
        )}

        {ackNotice ? <p className="queue-subtitle">{ackNotice}</p> : null}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('storeChecklists.recentHistoryEyebrow')}</div>
            <h3>{t('storeChecklists.recentHistoryTitle')}</h3>
          </div>
        </div>

        {acknowledgedItems.length === 0 ? (
          <EmptyState
            title={t('storeChecklists.noAcknowledgementsTitle')}
            copy={t('storeChecklists.noAcknowledgementsCopy')}
          />
        ) : (
          <div className="stacked-table">
            {acknowledgedItems.map((item) => (
              <AcknowledgedChecklistRow
                key={item.checklistInstanceId}
                item={item}
                locale={locale}
                t={t}
              />
            ))}
          </div>
        )}
      </section>

      <div className="action-cluster">
        <Link className="control-button store-shell-link" to="/store">
          {t('storeChecklists.backHome')}
        </Link>
      </div>
    </section>
  )
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

function formatMonthlySummary(t: TranslateFunction, input: ChecklistCoverageRow) {
  if (!input.summary) {
    return t('storeChecklists.noVisit')
  }

  return t('storeChecklists.monthlySummary', {
    count: input.summary.completedCount,
    score: input.summary.averageScore ?? 0,
  })
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

function formatChecklistUrgency(t: TranslateFunction, urgency: string) {
  switch (urgency) {
    case 'high':
      return t('storeChecklists.urgency.high')
    case 'medium':
      return t('storeChecklists.urgency.medium')
    case 'low':
      return t('storeChecklists.urgency.low')
    default:
      return formatState(urgency)
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

function AcknowledgedChecklistRow(input: {
  item: ChecklistAcknowledgementItem
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <strong>{input.item.templateName}</strong>
        <StatusPill tone={mapInboxStatusTone(toChecklistAcknowledgementInboxItem(input.item).inboxStatus)}>
          {input.t('storeChecklists.acknowledged')}
        </StatusPill>
      </div>
      <p>{formatCompletedSentence(input.t, input.locale, input.item)}</p>
      <div className="key-grid">
        <KeyValue label={input.t('storeChecklists.checklistInstance')} value={input.item.checklistInstanceId} />
        <KeyValue
          label={input.t('storeChecklists.acknowledgedAt')}
          value={
            input.item.acknowledgement?.acknowledgedAt
              ? formatDateTime(input.item.acknowledgement.acknowledgedAt, input.locale)
              : input.t('storeChecklists.unknown')
          }
        />
        <KeyValue
          label={input.t('storeChecklists.acknowledgedBy')}
          value={input.item.acknowledgement?.acknowledgedByUserId ?? input.t('storeChecklists.unknown')}
        />
        <KeyValue
          label={input.t('storeChecklists.compliance')}
          value={
            input.item.complianceRate !== null
              ? `${Math.round(input.item.complianceRate * 100)}%`
              : input.t('storeChecklists.noRate')
          }
        />
      </div>
      {input.item.acknowledgement?.acknowledgementNote ? (
        <p className="queue-subtitle">{input.item.acknowledgement.acknowledgementNote}</p>
      ) : null}
    </article>
  )
}
