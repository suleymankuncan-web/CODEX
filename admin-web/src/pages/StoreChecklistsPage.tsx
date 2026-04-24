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
} from '../features/auth/authorization'
import {
  acknowledgeChecklist,
  getChecklistAcknowledgements,
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
  const checklistsQuery = useQuery({
    queryKey: ['checklist-acknowledgements'],
    queryFn: getChecklistAcknowledgements,
    retry: false,
  })
  const acknowledgeMutation = useMutation({
    mutationFn: acknowledgeChecklist,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['checklist-acknowledgements'] })
      setAckNotice(result.command.message)
    },
  })

  if (checklistsQuery.isLoading) {
    return (
      <ScreenState
        title="Loading checklist acknowledgements"
        copy="Pulling completed checklist instances that the store should review and acknowledge."
      />
    )
  }

  if (checklistsQuery.isError) {
    return (
      <ScreenState
        title="Checklist acknowledgement queue unavailable"
        copy={getErrorMessage(checklistsQuery.error)}
        tone="error"
      />
    )
  }

  const items = checklistsQuery.data?.items ?? []
  const inboxItems = items.map((item) => toChecklistAcknowledgementInboxItem(item))
  const pendingItems = items.filter((item) => item.acknowledgement === null)
  const acknowledgedItems = items.filter((item) => item.acknowledgement !== null).slice(0, 5)
  const assignedStoreIds = getAssignedStoreIds(input.authSummary)
  const primaryStoreId = assignedStoreIds[0] ?? 'No action store'

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">Store Checklists</div>
          <h2 className="hero-title">
            Completed field checklists should arrive here as acknowledgement work, not as approval.
          </h2>
          <p className="hero-copy">
            This is the first real acknowledgement flow. Store managers do not reject these items;
            they confirm they have seen and accepted the checklist outcome.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Route" value="/store/checklists" />
          <MetricAccent label="Store scope" value={primaryStoreId} />
          <MetricAccent label="Mode" value="Acknowledgement" />
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
          note="This flow confirms receipt instead of requesting an approval decision."
          icon={<ShieldAlert size={18} />}
          tone="accent"
        />
      </section>

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
                          : 'Kabul ediyorum'}
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
