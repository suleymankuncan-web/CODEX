import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Save } from 'lucide-react'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  ScreenState,
  StatusPill,
  type Tone,
} from '../components/dashboard-primitives'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import {
  classifyPilotFeedback,
  listPilotFeedback,
  type PilotFeedback,
  type PilotFeedbackClassification,
  type PilotFeedbackStatus,
} from '../features/pilot-feedback/api'
import { formatDateTime, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { transientQueryRetryOptions } from '../lib/query-retry'

const PAGE_SIZE = 20
const statuses = ['new', 'triaged', 'parked', 'resolved'] as const satisfies readonly PilotFeedbackStatus[]
const classifications = [
  'p0_stop',
  'p1_pilot_blocker',
  'p2_pilot_friction',
  'p3_backlog',
] as const satisfies readonly PilotFeedbackClassification[]

export function AdminPilotFeedbackPage() {
  const { locale, t } = useLocalization()
  const [status, setStatus] = useState<PilotFeedbackStatus | ''>('')
  const [classification, setClassification] = useState<PilotFeedbackClassification | ''>('')
  const [offset, setOffset] = useState(0)
  const feedbackQuery = useQuery({
    queryKey: ['pilot-feedback', status, classification, offset],
    queryFn: () => listPilotFeedback({ status, classification, limit: PAGE_SIZE, offset }),
    ...transientQueryRetryOptions,
  })

  const items = useMemo(() => feedbackQuery.data?.items ?? [], [feedbackQuery.data?.items])
  const meta = feedbackQuery.data?.meta
  const total = meta?.total ?? items.length
  const newCount = items.filter((item) => item.status === 'new').length
  const triagedCount = items.filter((item) => item.status === 'triaged').length

  useEffect(() => {
    if (
      feedbackQuery.isFetching ||
      !meta ||
      items.length > 0 ||
      meta.total === 0 ||
      offset === 0
    ) {
      return
    }

    const lastAvailableOffset = Math.floor((meta.total - 1) / PAGE_SIZE) * PAGE_SIZE
    const previousPageOffset = Math.max(0, offset - PAGE_SIZE)
    const nextOffset = Math.min(lastAvailableOffset, previousPageOffset)

    const timeoutId = window.setTimeout(() => setOffset(nextOffset), 0)
    return () => window.clearTimeout(timeoutId)
  }, [feedbackQuery.isFetching, items.length, meta, offset])

  function updateStatusFilter(nextStatus: PilotFeedbackStatus | '') {
    setStatus(nextStatus)
    setOffset(0)
  }

  function updateClassificationFilter(nextClassification: PilotFeedbackClassification | '') {
    setClassification(nextClassification)
    setOffset(0)
  }

  if (feedbackQuery.isLoading) {
    return (
      <ScreenState
        title={t('pilotFeedback.admin.loadingTitle')}
        copy={t('pilotFeedback.admin.loadingCopy')}
      />
    )
  }

  if (feedbackQuery.isError) {
    return (
      <ScreenState
        title={t('pilotFeedback.admin.errorTitle')}
        copy={getErrorMessage(feedbackQuery.error)}
        tone="error"
        action={
          <button
            type="button"
            className="control-button"
            disabled={feedbackQuery.isFetching}
            onClick={() => void feedbackQuery.refetch()}
          >
            <RefreshCw aria-hidden="true" size={16} />
            {feedbackQuery.isFetching
              ? t('pilotFeedback.admin.retryingAction')
              : t('pilotFeedback.admin.retryAction')}
          </button>
        }
      />
    )
  }

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('pilotFeedback.admin.heroEyebrow')}</div>
          <h2 className="hero-title">{t('pilotFeedback.admin.heroTitle')}</h2>
          <p className="hero-copy">{t('pilotFeedback.admin.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('pilotFeedback.admin.route')} value="/admin/pilot-feedback" />
          <MetricAccent label={t('pilotFeedback.admin.total')} value={String(total)} />
          <MetricAccent label={t('pilotFeedback.admin.newItems')} value={String(newCount)} />
          <MetricAccent label={t('pilotFeedback.admin.triagedItems')} value={String(triagedCount)} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('pilotFeedback.admin.filtersTitle')}</div>
            <h3>{t('pilotFeedback.admin.queueTitle')}</h3>
          </div>
          <StatusPill tone={items.length > 0 ? 'accent' : 'neutral'}>
            {`${t('pilotFeedback.admin.total')}: ${total}`}
          </StatusPill>
        </div>
        <div className="toolbar-cluster">
          <label className="control-select">
            <span>{t('pilotFeedback.admin.statusFilter')}</span>
            <select
              value={status}
              onChange={(event) => updateStatusFilter(event.target.value as PilotFeedbackStatus | '')}
            >
              <option value="">{t('pilotFeedback.admin.allStatuses')}</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {formatPilotFeedbackStatus(t, value)}
                </option>
              ))}
            </select>
          </label>
          <label className="control-select">
            <span>{t('pilotFeedback.admin.classificationFilter')}</span>
            <select
              value={classification}
              onChange={(event) =>
                updateClassificationFilter(event.target.value as PilotFeedbackClassification | '')
              }
            >
              <option value="">{t('pilotFeedback.admin.allClassifications')}</option>
              {classifications.map((value) => (
                <option key={value} value={value}>
                  {formatPilotFeedbackClassification(t, value)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('pilotFeedback.admin.heroEyebrow')}</div>
            <h3>{t('pilotFeedback.admin.queueTitle')}</h3>
          </div>
          <StatusPill tone={feedbackQuery.isFetching ? 'warning' : 'calm'}>
            {feedbackQuery.isFetching ? t('pilotFeedback.admin.loadingTitle') : t('pilotFeedback.admin.total')}
          </StatusPill>
        </div>
        {items.length === 0 ? (
          <EmptyState
            title={t('pilotFeedback.admin.emptyTitle')}
            copy={t('pilotFeedback.admin.emptyCopy')}
          />
        ) : (
          <div className="stacked-table">
            {items.map((item) => (
              <PilotFeedbackRow
                item={item}
                key={item.feedbackId}
                locale={locale}
                t={t}
              />
            ))}
          </div>
        )}
        {renderPagination({
          isFetching: feedbackQuery.isFetching,
          meta,
          t,
          onNextPage: () => setOffset(offset + PAGE_SIZE),
          onPreviousPage: () => setOffset(Math.max(0, offset - PAGE_SIZE)),
        })}
      </section>
    </section>
  )
}

function PilotFeedbackRow(input: {
  item: PilotFeedback
  locale: AppLocale
  t: TranslateFunction
}) {
  const queryClient = useQueryClient()
  const [classification, setClassification] = useState<PilotFeedbackClassification>(
    input.item.classification ?? 'p2_pilot_friction',
  )
  const [note, setNote] = useState('')
  const classifyMutation = useMutation({
    mutationFn: classifyPilotFeedback,
    onSuccess: async () => {
      setNote('')
      await queryClient.invalidateQueries({ queryKey: ['pilot-feedback'] })
    },
  })

  const trimmedNote = note.trim()

  function submitClassification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    classifyMutation.mutate({
      feedbackId: input.item.feedbackId,
      body: {
        classification,
        ...(trimmedNote.length > 0 ? { note: trimmedNote } : {}),
      },
    })
  }

  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <div>
          <strong>{input.item.title}</strong>
          <p className="queue-subtitle">{input.item.description}</p>
        </div>
        <div className="action-cluster">
          <StatusPill tone={mapSeverityTone(input.item.severitySuggestion)}>
            {input.t(`pilotFeedback.severity.${input.item.severitySuggestion}`)}
          </StatusPill>
          <StatusPill tone={mapStatusTone(input.item.status)}>
            {formatPilotFeedbackStatus(input.t, input.item.status)}
          </StatusPill>
        </div>
      </div>

      <div className="key-grid">
        <KeyValue label={input.t('pilotFeedback.typeLabel')} value={input.t(`pilotFeedback.type.${input.item.feedbackType}`)} />
        <KeyValue label={input.t('pilotFeedback.admin.route')} value={input.item.routePath} />
        <KeyValue label={input.t('pilotFeedback.admin.actor')} value={formatActor(input.item)} />
        <KeyValue
          label={input.t('pilotFeedback.admin.createdAt')}
          value={formatDateTime(input.item.createdAt, input.locale)}
        />
        <KeyValue label={input.t('pilotFeedback.admin.status')} value={formatPilotFeedbackStatus(input.t, input.item.status)} />
        <KeyValue
          label={input.t('pilotFeedback.admin.classification')}
          value={
            input.item.classification
              ? formatPilotFeedbackClassification(input.t, input.item.classification)
              : input.t('pilotFeedback.admin.noClassification')
          }
        />
      </div>

      <form className="stacked-row" onSubmit={submitClassification}>
        <div className="key-grid">
          <label className="control-select">
            <span>{input.t('pilotFeedback.admin.classificationFilter')}</span>
            <select
              value={classification}
              onChange={(event) => setClassification(event.target.value as PilotFeedbackClassification)}
            >
              {classifications.map((value) => (
                <option key={value} value={value}>
                  {formatPilotFeedbackClassification(input.t, value)}
                </option>
              ))}
            </select>
          </label>
          <label className="control-select">
            <span>{input.t('pilotFeedback.admin.noteLabel')}</span>
            <input
              className="control-input"
              value={note}
              maxLength={2000}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </div>

        {classifyMutation.isError ? (
          <p role="alert" className="queue-subtitle">
            {input.t('pilotFeedback.admin.classifyError')}: {getErrorMessage(classifyMutation.error)}
          </p>
        ) : null}
        {classifyMutation.isSuccess ? (
          <p role="status" className="queue-subtitle">
            {input.t('pilotFeedback.admin.classifySuccess')}
          </p>
        ) : null}

        <div className="action-cluster">
          <button type="submit" className="control-button" disabled={classifyMutation.isPending}>
            <Save aria-hidden="true" size={16} />
            {classifyMutation.isPending
              ? input.t('pilotFeedback.admin.classifying')
              : input.t('pilotFeedback.admin.classifyAction')}
          </button>
        </div>
      </form>
    </article>
  )
}

function renderPagination(input: {
  meta: { count: number; limit: number; offset: number; total: number } | undefined
  isFetching: boolean
  t: TranslateFunction
  onPreviousPage: () => void
  onNextPage: () => void
}) {
  if (!input.meta || input.meta.total === 0) {
    return null
  }

  const start = input.meta.offset + 1
  const end = input.meta.offset + input.meta.count
  const canGoPrevious = input.meta.offset > 0
  const canGoNext = end < input.meta.total

  return (
    <div className="queue-meta">
      <span>
        {input.t('pilotFeedback.admin.range', {
          start,
          end,
          total: input.meta.total,
        })}
      </span>
      <div className="action-cluster">
        <button
          type="button"
          className="control-button"
          disabled={!canGoPrevious || input.isFetching}
          onClick={input.onPreviousPage}
        >
          {input.t('pilotFeedback.admin.previous')}
        </button>
        <button
          type="button"
          className="control-button"
          disabled={!canGoNext || input.isFetching}
          onClick={input.onNextPage}
        >
          {input.t('pilotFeedback.admin.next')}
        </button>
      </div>
    </div>
  )
}

function formatActor(item: PilotFeedback) {
  const roleSummary = item.actorRoleCodes.join(', ')
  return roleSummary ? `${item.actorUserId} - ${roleSummary}` : item.actorUserId
}

function formatPilotFeedbackStatus(t: TranslateFunction, status: PilotFeedbackStatus) {
  return t(`pilotFeedback.status.${status}`)
}

function formatPilotFeedbackClassification(
  t: TranslateFunction,
  classification: PilotFeedbackClassification,
) {
  return t(`pilotFeedback.classification.${classification}`)
}

function mapSeverityTone(severity: PilotFeedback['severitySuggestion']): Tone {
  switch (severity) {
    case 'p0':
      return 'danger'
    case 'p1':
      return 'warning'
    case 'p2':
      return 'accent'
    case 'p3':
      return 'neutral'
    default:
      return 'neutral'
  }
}

function mapStatusTone(status: PilotFeedbackStatus): Tone {
  switch (status) {
    case 'new':
      return 'warning'
    case 'triaged':
      return 'accent'
    case 'parked':
      return 'neutral'
    case 'resolved':
      return 'calm'
    default:
      return 'neutral'
  }
}
