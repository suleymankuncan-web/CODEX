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
} from '../features/checklists/api'
import {
  mapInboxStatusTone,
  mapWorkflowUrgencyTone,
  toChecklistAcknowledgementInboxItem,
} from '../features/workflow/contracts'
import { formatDateTime, formatState, getErrorMessage } from '../lib/format'

export function StoreChecklistsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
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
      setAckNotice('Checklist cevabi kaydedildi')
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
        title="Checklist alani hazirlaniyor"
        copy="Atanmis magaza checklistleri ve acknowledgement sirasi yukleniyor."
      />
    )
  }

  if (
    (canUseAcknowledgements && checklistsQuery.isError) ||
    (canManageVisits && mobileTodayQuery.isError)
  ) {
    return (
      <ScreenState
        title="Checklist alani acilamadi"
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
  const primaryStoreId = assignedStoreIds[0] ?? 'No action store'
  const coverageRows = (mobileToday?.stores ?? []).flatMap((store) =>
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
          <div className="eyebrow">Store Checklists</div>
          <h2 className="hero-title">
            Checklist sonuclari onay degil, goruldu bilgisi olarak akar.
          </h2>
          <p className="hero-copy">
            BM ve VM ziyaretleri ayni checklist motorunda kalir; rol, sablon tipi ve magaza
            kapsami backend tarafinda korunur.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Route" value="/store/checklists" />
          <MetricAccent label="Store scope" value={primaryStoreId} />
          <MetricAccent label="Mode" value={canManageVisits ? 'Visit' : 'Acknowledgement'} />
        </div>
      </section>

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title="Pending acknowledgements"
          value={inboxItems.filter((item) => item.inboxStatus === 'needs_attention').length}
          note="Completed checklists still waiting on store acknowledgement."
          icon={<ClipboardList size={18} />}
          tone={pendingItems.length > 0 ? 'warning' : 'accent'}
        />
        <MetricCard
          title="Acknowledged"
          value={inboxItems.filter((item) => item.inboxStatus === 'completed').length}
          note="Recently acknowledged checklist receipts."
          icon={<BadgeCheck size={18} />}
          tone="calm"
        />
        <MetricCard
          title="Action model"
          value={1}
          note="Checklist result confirmation stays separate from approval."
          icon={<ShieldAlert size={18} />}
          tone="accent"
        />
      </section>

      {canManageVisits ? (
        <section className="panel" aria-label="Assigned store checklist visits">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Ziyaret Akisi</div>
              <h3>Atanmis magaza checklist ziyaretleri</h3>
            </div>
            <StatusPill tone={activeVisitCount > 0 ? 'warning' : 'accent'}>
              {activeVisitCount > 0 ? 'Devam ediyor' : 'Hazir'}
            </StatusPill>
          </div>

          {coverageRows.length === 0 ? (
            <EmptyState
              title="Aktif checklist bulunamadi"
              copy="Atanmis magaza ve yayinlanmis checklist sablonu geldiginde ziyaret akisi burada gorunur."
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
                        {describeChecklistCoverage(row)}
                      </StatusPill>
                    </div>
                    <p>{row.template.templateName}</p>
                    <div className="key-grid">
                      <KeyValue label="Sablon tipi" value={row.template.templateType} />
                      <KeyValue
                        label="Bu ay"
                        value={
                          row.summary
                            ? `${row.summary.completedCount} ziyaret / ${row.summary.averageScore ?? 0} ort.`
                            : 'Ziyaret yok'
                        }
                      />
                      <KeyValue
                        label="Durum"
                        value={active ? formatState(active.status) : 'Yeni ziyaret'}
                      />
                      <KeyValue label="Magaza" value={row.store.storeId} />
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
                              <KeyValue label="Bolum" value={item.sectionName} />
                              <KeyValue label="Maksimum" value={String(item.maxScore)} />
                            </div>
                            <label className="eyebrow" htmlFor={`score-${item.templateItemId}`}>
                              Puan
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
                              Not
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
                                Kaydet
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
                          {startVisitMutation.isPending ? 'Baslatiliyor...' : 'Checklist yap'}
                        </button>
                      ) : (
                        <>
                        <button className="control-button" type="button" disabled>
                          Checklist yap
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
                          Tamamla
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
            <div className="eyebrow">Checklist Inbox</div>
            <h3>Completed checklist instances waiting on store acknowledgement</h3>
          </div>
          <StatusPill tone={pendingItems.length > 0 ? 'warning' : 'calm'}>
            {pendingItems.length > 0 ? 'Needs acknowledgement' : 'Clear'}
          </StatusPill>
        </div>

        {pendingItems.length === 0 ? (
          <EmptyState
            title="No pending checklist receipts"
            copy="Completed field checklists will appear here once the store is expected to acknowledge them."
          />
        ) : (
          <div className="stacked-table">
            {pendingItems.map((item) => (
              <article className="stacked-row" key={item.checklistInstanceId}>
                <div className="stacked-row-head">
                  <strong>{item.templateName}</strong>
                  <StatusPill tone={mapInboxStatusTone(toChecklistAcknowledgementInboxItem(item).inboxStatus)}>
                    {formatState(item.status)}
                  </StatusPill>
                </div>
                <p>
                  {item.storeName || item.storeId} - {item.category} - completed{' '}
                  {item.completedAt ? formatDateTime(item.completedAt) : 'recently'}
                </p>
                <div className="key-grid">
                  <KeyValue label="Checklist instance" value={item.checklistInstanceId} />
                  <KeyValue
                    label="Score"
                    value={item.totalScore !== null ? String(item.totalScore) : 'No score'}
                  />
                  <KeyValue
                    label="Compliance"
                    value={
                      item.complianceRate !== null
                        ? `${Math.round(item.complianceRate * 100)}%`
                        : 'No rate'
                    }
                  />
                  <KeyValue label="Store" value={item.storeName || item.storeId} />
                </div>
                {canAcknowledgeChecklist(input.authSummary, item.storeId) ? (
                  <>
                    <label className="eyebrow" htmlFor={`ack-note-${item.checklistInstanceId}`}>
                      Acknowledgement note
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
                      placeholder="Optional store-side note"
                    />
                    <div className="action-cluster">
                      <StatusPill tone={mapWorkflowUrgencyTone(toChecklistAcknowledgementInboxItem(item).urgency)}>
                        {`Urgency: ${formatState(toChecklistAcknowledgementInboxItem(item).urgency)}`}
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
                          ? 'Acknowledging...'
                          : 'Kabul ettim'}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="queue-subtitle">
                    This checklist can be reviewed, but acknowledgement is limited to assigned
                    action stores.
                  </p>
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
            <div className="eyebrow">Recent History</div>
            <h3>Recently acknowledged checklist receipts</h3>
          </div>
        </div>

        {acknowledgedItems.length === 0 ? (
          <EmptyState
            title="No acknowledgements yet"
            copy="Once a store manager confirms they have seen a checklist, it will remain visible here."
          />
        ) : (
          <div className="stacked-table">
            {acknowledgedItems.map((item) => (
              <AcknowledgedChecklistRow key={item.checklistInstanceId} item={item} />
            ))}
          </div>
        )}
      </section>

      <div className="action-cluster">
        <Link className="control-button store-shell-link" to="/store">
          Back to store home
        </Link>
      </div>
    </section>
  )
}

function describeChecklistCoverage(input: {
  active?: { status: string }
  completedCount: number
  template: { templateType: string }
}) {
  const prefix = input.template.templateType === 'VM_STORE_VISIT' ? 'VM checklist' : 'BM checklist'

  if (input.active) return 'Taslak'
  if (input.completedCount > 1) return `${input.completedCount} ${prefix} tamamlandi`
  if (input.completedCount === 1) return `1 ${prefix} tamamlandi`
  return `${prefix} yapilmadi`
}

function AcknowledgedChecklistRow(input: { item: ChecklistAcknowledgementItem }) {
  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <strong>{input.item.templateName}</strong>
        <StatusPill tone={mapInboxStatusTone(toChecklistAcknowledgementInboxItem(input.item).inboxStatus)}>
          Acknowledged
        </StatusPill>
      </div>
      <p>
        {input.item.storeName || input.item.storeId} - {input.item.category} - completed{' '}
        {input.item.completedAt ? formatDateTime(input.item.completedAt) : 'recently'}
      </p>
      <div className="key-grid">
        <KeyValue label="Checklist instance" value={input.item.checklistInstanceId} />
        <KeyValue
          label="Acknowledged at"
          value={
            input.item.acknowledgement?.acknowledgedAt
              ? formatDateTime(input.item.acknowledgement.acknowledgedAt)
              : 'Unknown'
          }
        />
        <KeyValue
          label="Acknowledged by"
          value={input.item.acknowledgement?.acknowledgedByUserId ?? 'Unknown'}
        />
        <KeyValue
          label="Compliance"
          value={
            input.item.complianceRate !== null
              ? `${Math.round(input.item.complianceRate * 100)}%`
              : 'No rate'
          }
        />
      </div>
      {input.item.acknowledgement?.acknowledgementNote ? (
        <p className="queue-subtitle">{input.item.acknowledgement.acknowledgementNote}</p>
      ) : null}
    </article>
  )
}
