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
import {
  mapInboxStatusTone,
  mapWorkflowUrgencyTone,
  toChecklistAcknowledgementInboxItem,
} from '../features/workflow/contracts'
import { formatDateTime, formatState, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { transientQueryRetryOptions } from '../lib/query-retry'

type ChecklistCoverageRow = {
  store: MobileChecklistToday['stores'][number]
  template: MobileChecklistToday['templates'][number]
  active?: MobileChecklistToday['activeInstances'][number]
  summary?: MobileChecklistToday['monthlySummaries'][number]
  completedCount: number
}

type ChecklistSession = ChecklistCoverageRow

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
  const [localActiveInstances, setLocalActiveInstances] = useState<
    Record<string, MobileChecklistToday['activeInstances'][number]>
  >({})
  const [sessionDirty, setSessionDirty] = useState(false)
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
        },
      }))
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
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['mobile-checklists-today'] })
      setLocalActiveInstances((current) =>
        Object.fromEntries(
          Object.entries(current).filter(
            ([, instance]) => instance.checklistInstanceId !== variables.checklistInstanceId,
          ),
        ),
      )
      setSelectedSessionKey(null)
      setSessionDirty(false)
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
  const selectedResult = items.find((item) => item.checklistInstanceId === selectedResultId) ?? null
  const assignedStoreIds = getAssignedStoreIds(input.authSummary)
  const primaryStoreId = assignedStoreIds[0] ?? t('storeChecklists.noActionStore')
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
  const activeVisitCount = coverageRows.filter((row) => row.active).length
  const selectedSession =
    coverageRows.find((row) => getCoverageRowKeyFromRow(row) === selectedSessionKey) ?? null

  const closeSession = () => {
    if (sessionDirty && !window.confirm(t('storeChecklists.sessionCloseConfirm'))) {
      return
    }

    setSelectedSessionKey(null)
    setSessionDirty(false)
  }

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

                    <div className="action-cluster">
                      <button
                        className="control-button"
                        type="button"
                        disabled={!active && !assignedStoreIds.includes(row.store.storeId)}
                        onClick={() => {
                          setSelectedSessionKey(getCoverageRowKeyFromRow(row))
                          setSessionDirty(false)
                        }}
                      >
                        {active ? t('storeChecklists.continueChecklist') : t('storeChecklists.startChecklist')}
                      </button>
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

      {selectedSession ? (
        <ChecklistVisitModal
          active={selectedSession.active}
          comments={comments}
          isCompleting={completeVisitMutation.isPending}
          isSaving={saveResponseMutation.isPending}
          isStarting={startVisitMutation.isPending}
          onClose={closeSession}
          onCommentChange={(templateItemId, comment) => {
            setComments((current) => ({ ...current, [templateItemId]: comment }))
            setSessionDirty(true)
          }}
          onComplete={(checklistInstanceId) =>
            completeVisitMutation.mutate({ checklistInstanceId })
          }
          onSaveResponse={(input) => {
            saveResponseMutation.mutate(input)
            setSessionDirty(false)
          }}
          onScoreChange={(templateItemId, score) => {
            setScores((current) => ({ ...current, [templateItemId]: score }))
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
                  <KeyValue
                    label={t('storeChecklists.score')}
                    value={formatScoreValue(t, item.totalScore)}
                  />
                  <KeyValue
                    label={t('storeChecklists.compliance')}
                    value={formatComplianceValue(t, item.complianceRate)}
                  />
                  <KeyValue label={t('storeChecklists.store')} value={item.storeName || item.storeId} />
                  <KeyValue label={t('storeChecklists.templateType')} value={formatChecklistTemplateType(t, item.templateType)} />
                </div>
                <div className="action-cluster">
                  <StatusPill tone={mapWorkflowUrgencyTone(toChecklistAcknowledgementInboxItem(item).urgency)}>
                    {`${t('storeChecklists.urgency')}: ${formatChecklistUrgency(t, toChecklistAcknowledgementInboxItem(item).urgency)}`}
                  </StatusPill>
                  <button
                    className="control-button"
                    type="button"
                    onClick={() => setSelectedResultId(item.checklistInstanceId)}
                  >
                    {t('storeChecklists.viewResultDetail')}
                  </button>
                </div>
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
                onOpen={() => setSelectedResultId(item.checklistInstanceId)}
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

function ChecklistVisitModal(input: {
  active?: MobileChecklistToday['activeInstances'][number]
  comments: Record<string, string>
  isCompleting: boolean
  isSaving: boolean
  isStarting: boolean
  onClose: () => void
  onCommentChange: (templateItemId: string, comment: string) => void
  onComplete: (checklistInstanceId: string) => void
  onSaveResponse: (input: {
    checklistInstanceId: string
    templateItemId: string
    scoreValue: number
    commentText?: string
  }) => void
  onScoreChange: (templateItemId: string, score: number) => void
  onStart: (session: ChecklistSession) => void
  scores: Record<string, number>
  session: ChecklistSession
  t: TranslateFunction
}) {
  const sections = groupChecklistTemplateItems(input.session.template.items)
  const hasItems = input.session.template.items.length > 0

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
            <div className="eyebrow">{input.t('storeChecklists.sessionEyebrow')}</div>
            <h3 id="store-checklist-modal-title">{input.session.template.templateName}</h3>
            <p>
              {input.t('storeChecklists.sessionCopy', {
                store: input.session.store.storeName,
                template: input.session.template.templateCode,
                version: input.session.template.versionNo,
              })}
            </p>
          </div>
          <button className="control-button" type="button" onClick={input.onClose}>
            {input.t('storeChecklists.closeSession')}
          </button>
        </div>

        <div className="store-checklist-modal-meta">
          <KeyValue label={input.t('storeChecklists.store')} value={input.session.store.storeName} />
          <KeyValue label={input.t('storeChecklists.templateCode')} value={input.session.template.templateCode} />
          <KeyValue label={input.t('storeChecklists.templateVersion')} value={`v${input.session.template.versionNo}`} />
          <KeyValue
            label={input.t('storeChecklists.status')}
            value={
              input.active
                ? formatChecklistStatus(input.t, input.active.status)
                : input.t('storeChecklists.newVisit')
            }
          />
        </div>

        {!input.active ? (
          <div className="store-checklist-modal-start">
            <div>
              <strong>{input.t('storeChecklists.sessionStartTitle')}</strong>
              <p>{input.t('storeChecklists.sessionStartCopy')}</p>
            </div>
            <button
              className="control-button"
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
          <EmptyState
            title={input.t('storeChecklists.emptyTemplateTitle')}
            copy={input.t('storeChecklists.emptyTemplateCopy')}
          />
        ) : (
          <div className="store-checklist-modal-sections">
            {sections.map((section) => (
              <article className="store-checklist-modal-section" key={section.name}>
                <div className="store-checklist-modal-section-head">
                  <strong>{section.name}</strong>
                  <StatusPill tone="accent">
                    {input.t('storeChecklists.sectionItemCount', { count: section.items.length })}
                  </StatusPill>
                </div>
                <div className="store-checklist-modal-items">
                  {section.items.map((item) => (
                    <div className="store-checklist-modal-item" key={item.templateItemId}>
                      <div>
                        <strong>{item.itemText}</strong>
                        <p>
                          {input.t('storeChecklists.itemMeta', {
                            maxScore: item.maxScore,
                            weight: item.weight,
                          })}
                        </p>
                      </div>
                      <div className="store-checklist-modal-inputs">
                        <label>
                          <span>{input.t('storeChecklists.scoreInput')}</span>
                          <input
                            disabled={!input.active || input.isSaving}
                            max={item.maxScore}
                            min={0}
                            type="number"
                            value={input.scores[item.templateItemId] ?? ''}
                            onChange={(event) =>
                              input.onScoreChange(
                                item.templateItemId,
                                Number(event.target.value || 0),
                              )
                            }
                          />
                        </label>
                        <label>
                          <span>{input.t('storeChecklists.noteInput')}</span>
                          <textarea
                            disabled={!input.active || input.isSaving}
                            rows={2}
                            value={input.comments[item.templateItemId] ?? ''}
                            onChange={(event) =>
                              input.onCommentChange(item.templateItemId, event.target.value)
                            }
                          />
                        </label>
                        <button
                          className="control-button"
                          disabled={!input.active || input.isSaving}
                          type="button"
                          onClick={() =>
                            input.active
                              ? input.onSaveResponse({
                                  checklistInstanceId: input.active.checklistInstanceId,
                                  templateItemId: item.templateItemId,
                                  scoreValue: input.scores[item.templateItemId] ?? 0,
                                  commentText: input.comments[item.templateItemId] || undefined,
                                })
                              : undefined
                          }
                        >
                          {input.isSaving
                            ? input.t('storeChecklists.savingItem')
                            : input.t('storeChecklists.saveItem')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="store-checklist-modal-footer">
          <button className="control-button" type="button" onClick={input.onClose}>
            {input.t('storeChecklists.cancelSession')}
          </button>
          <button
            className="control-button"
            disabled={!input.active || input.isCompleting || !hasItems}
            type="button"
            onClick={() =>
              input.active ? input.onComplete(input.active.checklistInstanceId) : undefined
            }
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
            <div className="eyebrow">{input.t('storeChecklists.resultEyebrow')}</div>
            <h3 id="store-checklist-result-title">{input.item.templateName}</h3>
            <p>{formatCompletedSentence(input.t, input.locale, input.item)}</p>
          </div>
          <button className="control-button" type="button" onClick={input.onClose}>
            {input.t('storeChecklists.closeSession')}
          </button>
        </div>

        <div className="store-checklist-modal-meta">
          <KeyValue label={input.t('storeChecklists.store')} value={input.item.storeName || input.item.storeId} />
          <KeyValue label={input.t('storeChecklists.templateType')} value={formatChecklistTemplateType(input.t, input.item.templateType)} />
          <KeyValue label={input.t('storeChecklists.score')} value={formatScoreValue(input.t, input.item.totalScore)} />
          <KeyValue label={input.t('storeChecklists.compliance')} value={formatComplianceValue(input.t, input.item.complianceRate)} />
        </div>

        <div className="store-checklist-result-summary">
          <div>
            <span>{input.t('storeChecklists.resultCompletedBy')}</span>
            <strong>{input.item.completedByUserId ?? input.t('storeChecklists.unknown')}</strong>
          </div>
          <div>
            <span>{input.t('storeChecklists.resultLowScore')}</span>
            <strong>{input.t('storeChecklists.lowScoreCount', { count: lowScoreResponses.length })}</strong>
          </div>
          <div>
            <span>{input.t('storeChecklists.resultStatus')}</span>
            <strong>
              {hasAcknowledgement
                ? input.t('storeChecklists.acknowledged')
                : input.t('storeChecklists.needsAcknowledgement')}
            </strong>
          </div>
        </div>

        {lowScoreResponses.length > 0 ? (
          <div className="store-checklist-result-alert">
            <strong>{input.t('storeChecklists.lowScoreTitle')}</strong>
            <p>
              {lowScoreResponses
                .slice(0, 3)
                .map((response) => response.itemText)
                .join(' · ')}
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
                <StatusPill tone={section.averageScore >= 70 ? 'calm' : 'warning'}>
                  {`${section.averageScore}%`}
                </StatusPill>
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
                      <div className="store-checklist-result-score">
                        <span>{input.t('storeChecklists.score')}</span>
                        <strong>
                          {response.scoreValue === null
                            ? input.t('storeChecklists.noScore')
                            : `${response.scoreValue}/${response.maxScore}`}
                        </strong>
                      </div>
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
              <div className="eyebrow">{input.t('storeChecklists.acknowledged')}</div>
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
              <label className="eyebrow" htmlFor={`result-ack-note-${input.item.checklistInstanceId}`}>
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
                <button className="control-button" type="button" onClick={input.onClose}>
                  {input.t('storeChecklists.cancelSession')}
                </button>
                <button
                  className="control-button"
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
            <p className="queue-subtitle">{input.t('storeChecklists.reviewOnlyCopy')}</p>
          )}
        </div>
      </section>
    </div>
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
  return value === null ? t('storeChecklists.noScore') : value.toLocaleString('tr-TR')
}

function formatComplianceValue(t: TranslateFunction, value: number | null) {
  return value === null ? t('storeChecklists.noRate') : `${Math.round(value * 100)}%`
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
  onOpen: () => void
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
          value={formatComplianceValue(input.t, input.item.complianceRate)}
        />
        <KeyValue label={input.t('storeChecklists.templateType')} value={formatChecklistTemplateType(input.t, input.item.templateType)} />
      </div>
      {input.item.acknowledgement?.acknowledgementNote ? (
        <p className="queue-subtitle">{input.item.acknowledgement.acknowledgementNote}</p>
      ) : null}
      <div className="action-cluster">
        <button className="control-button" type="button" onClick={input.onOpen}>
          {input.t('storeChecklists.viewResultDetail')}
        </button>
      </div>
    </article>
  )
}
