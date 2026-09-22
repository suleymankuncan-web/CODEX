import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Inbox, MessageSquareWarning, RefreshCw, Save, Tags } from 'lucide-react'
import {
  AdminOperationalBadge as AdminSurfaceBadge,
  AdminOperationalEmpty as EmptyState,
  AdminOperationalFilterBar as AdminFilterBar,
  AdminOperationalHeader as AdminSurfaceHeader,
  AdminOperationalKeyGrid as AdminKeyValueGrid,
  AdminOperationalKeyValue as KeyValue,
  AdminOperationalMetrics as AdminMetricStrip,
  AdminOperationalPage as AdminSurfacePage,
  AdminOperationalSection as AdminSurfaceSection,
  AdminOperationalState as AdminStatePanel,
  type AdminOperationalTone as AdminSurfaceTone,
} from './admin-operational-primitives'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
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
const allStatusSelectValue = '__all_statuses__'
const allClassificationSelectValue = '__all_classifications__'

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
  const activeStatusLabel = status ? formatPilotFeedbackStatus(t, status) : t('pilotFeedback.admin.allStatuses')
  const activeClassificationLabel = classification
    ? formatPilotFeedbackClassification(t, classification)
    : t('pilotFeedback.admin.allClassifications')

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
      <AdminSurfacePage ariaLabel={t('pilotFeedback.admin.loadingTitle')}>
        <AdminStatePanel
          isLoading
          title={t('pilotFeedback.admin.loadingTitle')}
          description={t('pilotFeedback.admin.loadingCopy')}
        />
      </AdminSurfacePage>
    )
  }

  if (feedbackQuery.isError) {
    return (
      <AdminSurfacePage ariaLabel={t('pilotFeedback.admin.errorTitle')}>
        <AdminStatePanel
          title={t('pilotFeedback.admin.errorTitle')}
          description={getErrorMessage(feedbackQuery.error)}
          tone="danger"
          action={
            <Button
              type="button"
              variant="outline"
              disabled={feedbackQuery.isFetching}
              onClick={() => void feedbackQuery.refetch()}
            >
              <RefreshCw aria-hidden="true" size={16} />
              {feedbackQuery.isFetching
                ? t('pilotFeedback.admin.retryingAction')
                : t('pilotFeedback.admin.retryAction')}
              </Button>
          }
        />
      </AdminSurfacePage>
    )
  }

  return (
    <AdminSurfacePage ariaLabel={t('pilotFeedback.admin.heroTitle')}>
      <AdminSurfaceHeader
        eyebrow={t('pilotFeedback.admin.heroEyebrow')}
        title={t('pilotFeedback.admin.heroTitle')}
        description={t('pilotFeedback.admin.heroCopy')}
        icon={<MessageSquareWarning size={18} />}
        meta={<AdminSurfaceBadge tone="neutral">/admin/pilot-feedback</AdminSurfaceBadge>}
      />

      <AdminMetricStrip
        items={[
          {
            id: 'total',
            label: t('pilotFeedback.admin.total'),
            value: String(total),
            description: t('pilotFeedback.admin.route'),
            trend: '/admin/pilot-feedback',
            icon: <Inbox size={18} />,
            tone: 'cyan',
          },
          {
            id: 'new',
            label: t('pilotFeedback.admin.newItems'),
            value: String(newCount),
            icon: <AlertTriangle size={18} />,
            tone: newCount > 0 ? 'warning' : 'neutral',
          },
          {
            id: 'triaged',
            label: t('pilotFeedback.admin.triagedItems'),
            value: String(triagedCount),
            icon: <CheckCircle2 size={18} />,
            tone: triagedCount > 0 ? 'accent' : 'neutral',
          },
          {
            id: 'visible',
            label: t('pilotFeedback.admin.queueTitle'),
            value: String(items.length),
            icon: <Tags size={18} />,
            tone: items.length > 0 ? 'success' : 'neutral',
          },
        ]}
      />

      <AdminSurfaceSection
        eyebrow={t('pilotFeedback.admin.filtersTitle')}
        title={t('pilotFeedback.admin.queueTitle')}
        badge={
          <StatusPill tone={items.length > 0 ? 'accent' : 'neutral'}>
            {`${t('pilotFeedback.admin.total')}: ${total}`}
          </StatusPill>
        }
      >
        <AdminFilterBar>
          <label className="tw:grid tw:min-w-44 tw:gap-1 tw:text-xs tw:font-medium tw:text-muted-foreground">
            {t('pilotFeedback.admin.statusFilter')}
            <Select
              value={status || allStatusSelectValue}
              onValueChange={(value) =>
                updateStatusFilter(value === allStatusSelectValue ? '' : (value as PilotFeedbackStatus))
              }
            >
              <SelectTrigger className="tw:h-8 tw:bg-background/70">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allStatusSelectValue}>{t('pilotFeedback.admin.allStatuses')}</SelectItem>
                {statuses.map((value) => (
                  <SelectItem key={value} value={value}>
                    {formatPilotFeedbackStatus(t, value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="tw:grid tw:min-w-52 tw:gap-1 tw:text-xs tw:font-medium tw:text-muted-foreground">
            {t('pilotFeedback.admin.classificationFilter')}
            <Select
              value={classification || allClassificationSelectValue}
              onValueChange={(value) =>
                updateClassificationFilter(
                  value === allClassificationSelectValue ? '' : (value as PilotFeedbackClassification),
                )
              }
            >
              <SelectTrigger className="tw:h-8 tw:bg-background/70">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allClassificationSelectValue}>
                  {t('pilotFeedback.admin.allClassifications')}
                </SelectItem>
                {classifications.map((value) => (
                  <SelectItem key={value} value={value}>
                    {formatPilotFeedbackClassification(t, value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </AdminFilterBar>
      </AdminSurfaceSection>

      <AdminSurfaceSection
        eyebrow={t('pilotFeedback.admin.heroEyebrow')}
        title={t('pilotFeedback.admin.queueTitle')}
        badge={
          <StatusPill tone={feedbackQuery.isFetching ? 'warning' : 'calm'}>
            {feedbackQuery.isFetching ? t('pilotFeedback.admin.loadingTitle') : t('pilotFeedback.admin.total')}
          </StatusPill>
        }
      >
        <AdminKeyValueGrid>
          <KeyValue label={t('pilotFeedback.admin.statusFilter')} value={activeStatusLabel} />
          <KeyValue label={t('pilotFeedback.admin.classificationFilter')} value={activeClassificationLabel} />
          <KeyValue label={t('pilotFeedback.admin.queueTitle')} value={String(items.length)} />
          <KeyValue label={t('pilotFeedback.admin.total')} value={String(total)} />
        </AdminKeyValueGrid>
        {items.length === 0 ? (
          <EmptyState
            title={t('pilotFeedback.admin.emptyTitle')}
            copy={t('pilotFeedback.admin.emptyCopy')}
          />
        ) : (
          <div className="tw:grid tw:gap-3">
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
      </AdminSurfaceSection>
    </AdminSurfacePage>
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
  const [note, setNote] = useState<string | null>(null)
  const classifyMutation = useMutation({
    mutationFn: classifyPilotFeedback,
    onSuccess: async () => {
      setNote(trimmedNote)
      await queryClient.invalidateQueries({ queryKey: ['pilot-feedback'] })
    },
  })

  const currentNote = note ?? input.item.classificationNote ?? ''
  const trimmedNote = currentNote.trim()

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

  function updateClassificationDraft(value: PilotFeedbackClassification) {
    classifyMutation.reset()
    setClassification(value)
  }

  function updateNoteDraft(value: string) {
    classifyMutation.reset()
    setNote(value)
  }

  return (
    <article className="tw:grid tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-background/70 tw:p-4">
      <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-start tw:md:justify-between">
        <div>
          <strong className="tw:text-sm tw:font-medium tw:text-foreground">{input.item.title}</strong>
          <p className="tw:mt-1 tw:text-sm tw:text-muted-foreground">{input.item.description}</p>
        </div>
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          <StatusPill tone={mapSeverityTone(input.item.severitySuggestion)}>
            {input.t(`pilotFeedback.severity.${input.item.severitySuggestion}`)}
          </StatusPill>
          <StatusPill tone={mapStatusTone(input.item.status)}>
            {formatPilotFeedbackStatus(input.t, input.item.status)}
          </StatusPill>
        </div>
      </div>

      <AdminKeyValueGrid>
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
      </AdminKeyValueGrid>

      <form className="tw:grid tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-card/70 tw:p-3" onSubmit={submitClassification}>
        <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:md:grid-cols-2">
          <label className="tw:grid tw:gap-1 tw:text-xs tw:font-medium tw:text-muted-foreground">
            {input.t('pilotFeedback.admin.classificationFilter')}
            <Select
              disabled={classifyMutation.isPending}
              value={classification}
              onValueChange={(value) => updateClassificationDraft(value as PilotFeedbackClassification)}
            >
              <SelectTrigger className="tw:h-8 tw:bg-background/70">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {classifications.map((value) => (
                  <SelectItem key={value} value={value}>
                    {formatPilotFeedbackClassification(input.t, value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="tw:grid tw:gap-1 tw:text-xs tw:font-medium tw:text-muted-foreground">
            {input.t('pilotFeedback.admin.noteLabel')}
            <Input
              disabled={classifyMutation.isPending}
              value={currentNote}
              maxLength={2000}
              onChange={(event) => updateNoteDraft(event.target.value)}
            />
          </label>
        </div>

        {classifyMutation.isError ? (
          <p role="alert" className="tw:text-sm tw:text-destructive">
            {input.t('pilotFeedback.admin.classifyError')}: {getErrorMessage(classifyMutation.error)}
          </p>
        ) : null}
        {classifyMutation.isSuccess ? (
          <p role="status" className="tw:text-sm tw:text-emerald-700">
            {input.t('pilotFeedback.admin.classifySuccess')}
          </p>
        ) : null}

        <div className="tw:flex tw:justify-end">
          <Button type="submit" disabled={classifyMutation.isPending}>
            <Save aria-hidden="true" size={16} />
            {classifyMutation.isPending
              ? input.t('pilotFeedback.admin.classifying')
              : input.t('pilotFeedback.admin.classifyAction')}
          </Button>
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
    <div className="tw:flex tw:flex-col tw:gap-2 tw:text-sm tw:text-muted-foreground tw:md:flex-row tw:md:items-center tw:md:justify-between">
      <span>
        {input.t('pilotFeedback.admin.range', {
          start,
          end,
          total: input.meta.total,
        })}
      </span>
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!canGoPrevious || input.isFetching}
          onClick={input.onPreviousPage}
        >
          {input.t('pilotFeedback.admin.previous')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!canGoNext || input.isFetching}
          onClick={input.onNextPage}
        >
          {input.t('pilotFeedback.admin.next')}
        </Button>
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

type Tone = AdminSurfaceTone | 'calm'

function StatusPill(input: { children: ReactNode; tone?: Tone }) {
  return <AdminSurfaceBadge tone={toSurfaceTone(input.tone)}>{input.children}</AdminSurfaceBadge>
}

function toSurfaceTone(tone: Tone | undefined): AdminSurfaceTone {
  if (tone === 'calm') return 'success'
  return tone ?? 'neutral'
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
