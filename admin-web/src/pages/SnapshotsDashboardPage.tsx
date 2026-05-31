import { useDeferredValue, useMemo, useReducer, type Dispatch } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, ArrowRight, Clock3, RefreshCcw, Rocket } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AdminReportingToolbar } from '../components/admin-reporting-tools'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Progress } from '../components/ui/progress'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { downloadCsv } from '../lib/download-csv'
import {
  getDailyClosureStatus,
  getSnapshotNeedsAction,
  getSnapshotOverview,
  runDailyClosure,
  rerunSnapshotRun,
  type DailyClosureStatus,
  type SnapshotNeedsActionItem,
  type SnapshotOverview,
} from '../features/snapshots/api'
import {
  formatSnapshotState,
  formatSnapshotType,
  mapSnapshotSurfaceTone,
} from '../features/snapshots/snapshot-surface-semantics'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { formatDate, formatNumber, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import {
  AdminActionRow,
  AdminFilterBar,
  AdminKeyValue as KeyValue,
  AdminKeyValueGrid,
  AdminMetricStrip,
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  AdminSurfaceHeader,
  AdminSurfacePage,
  AdminSurfaceSection,
  type AdminSurfaceTone,
} from './admin-surface-primitives'

const PAGE_SIZE = 12

const snapshotTypes = ['daily', 'weekly', 'monthly', 'payroll', 'compliance'] as const
const runStatuses = ['queued', 'running', 'completed', 'failed'] as const

type SnapshotSortValue = 'priority' | 'generated-desc' | 'reruns' | 'type'
type SnapshotTypeFilter = '' | (typeof snapshotTypes)[number]
type SnapshotRunStatusFilter = '' | (typeof runStatuses)[number]

type SnapshotsDashboardPageState = {
  search: string
  sortBy: SnapshotSortValue
  offset: number
  snapshotTypeFilter: SnapshotTypeFilter
  runStatusFilter: SnapshotRunStatusFilter
  feedback: string | null
}

type SnapshotsDashboardPageAction =
  | { type: 'setSearch'; value: string }
  | { type: 'setSortBy'; value: SnapshotSortValue }
  | { type: 'setSnapshotTypeFilter'; value: SnapshotTypeFilter }
  | { type: 'setRunStatusFilter'; value: SnapshotRunStatusFilter }
  | { type: 'setFeedback'; value: string | null }
  | { type: 'previousPage' }
  | { type: 'nextPage' }
  | { type: 'clearFilters' }

const initialSnapshotsDashboardPageState: SnapshotsDashboardPageState = {
  search: '',
  sortBy: 'priority',
  offset: 0,
  snapshotTypeFilter: '',
  runStatusFilter: '',
  feedback: null,
}

function snapshotsDashboardPageReducer(
  state: SnapshotsDashboardPageState,
  action: SnapshotsDashboardPageAction,
): SnapshotsDashboardPageState {
  switch (action.type) {
    case 'setSearch':
      return { ...state, search: action.value }
    case 'setSortBy':
      return { ...state, sortBy: action.value }
    case 'setSnapshotTypeFilter':
      return { ...state, offset: 0, snapshotTypeFilter: action.value }
    case 'setRunStatusFilter':
      return { ...state, offset: 0, runStatusFilter: action.value }
    case 'setFeedback':
      return { ...state, feedback: action.value }
    case 'previousPage':
      return { ...state, offset: Math.max(0, state.offset - PAGE_SIZE) }
    case 'nextPage':
      return { ...state, offset: state.offset + PAGE_SIZE }
    case 'clearFilters':
      return {
        ...state,
        search: '',
        offset: 0,
        snapshotTypeFilter: '',
        runStatusFilter: '',
      }
    default:
      return state
  }
}

export function SnapshotsDashboardPage() {
  const { locale, t } = useLocalization()
  const [pageState, dispatchPageState] = useReducer(
    snapshotsDashboardPageReducer,
    initialSnapshotsDashboardPageState,
  )
  const { search, sortBy, offset, snapshotTypeFilter, runStatusFilter, feedback } = pageState
  const deferredSearch = useDeferredValue(search)
  const queryClient = useQueryClient()

  const overviewQuery = useQuery({
    queryKey: ['snapshot-overview'],
    queryFn: getSnapshotOverview,
  })
  const dailyClosureQuery = useQuery({
    queryKey: ['snapshot-daily-closure'],
    queryFn: getDailyClosureStatus,
  })
  const needsActionQuery = useQuery({
    queryKey: ['snapshot-needs-action', offset, snapshotTypeFilter, runStatusFilter],
    queryFn: () =>
      getSnapshotNeedsAction({
        limit: PAGE_SIZE,
        offset,
        ...(snapshotTypeFilter ? { snapshotType: snapshotTypeFilter } : {}),
        ...(runStatusFilter ? { runStatus: runStatusFilter } : {}),
      }),
  })
  const rerunMutation = useMutation({
    mutationFn: rerunSnapshotRun,
    onSuccess: async (response) => {
      dispatchPageState({ type: 'setFeedback', value: response.command.message })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['snapshot-needs-action'] }),
        queryClient.invalidateQueries({ queryKey: ['snapshot-overview'] }),
      ])
    },
  })
  const dailyClosureMutation = useMutation({
    mutationFn: runDailyClosure,
    onSuccess: async (response) => {
      dispatchPageState({ type: 'setFeedback', value: response.command.message })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['snapshot-daily-closure'] }),
        queryClient.invalidateQueries({ queryKey: ['snapshot-needs-action'] }),
        queryClient.invalidateQueries({ queryKey: ['snapshot-overview'] }),
      ])
    },
  })

  const filteredItems = useMemo(() => {
    const input = deferredSearch.trim().toLowerCase()
    const items = needsActionQuery.data?.items ?? []

    if (!input) {
      return items
    }

    return items.filter((item) =>
      [
        item.snapshotRunId,
        item.snapshotType,
        formatSnapshotType(item.snapshotType, t),
        item.runStatus,
        formatSnapshotState(item.runStatus, t),
        item.healthState,
        formatSnapshotState(item.healthState, t),
        item.actionReason,
        item.recommendedAction,
      ]
        .join(' ')
        .toLowerCase()
        .includes(input),
    )
  }, [deferredSearch, needsActionQuery.data?.items, t])

  const sortedItems = useMemo(() => {
    const items = [...filteredItems]
    if (sortBy === 'generated-desc') {
      return items.sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))
    }
    if (sortBy === 'reruns') {
      return items.sort((left, right) => right.rerunCount - left.rerunCount)
    }
    if (sortBy === 'type') {
      return items.sort((left, right) => left.snapshotType.localeCompare(right.snapshotType))
    }

    const priority = (state: string) => {
      if (state === 'stuck') return 4
      if (state === 'needs_action') return 3
      if (state === 'retry_ready') return 2
      if (state === 'in_progress') return 1
      return 0
    }

    return items.sort((left, right) => priority(right.healthState) - priority(left.healthState))
  }, [filteredItems, sortBy])

  if (overviewQuery.isLoading || needsActionQuery.isLoading || dailyClosureQuery.isLoading) {
    return (
      <AdminSurfacePage ariaLabel={t('adminSnapshots.loadingTitle')}>
        <AdminStatePanel
          isLoading
          title={t('adminSnapshots.loadingTitle')}
          description={t('adminSnapshots.loadingCopy')}
        />
      </AdminSurfacePage>
    )
  }

  if (overviewQuery.isError) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('adminSnapshots.overviewUnavailableTitle')}
          description={getErrorMessage(overviewQuery.error)}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  if (needsActionQuery.isError) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('adminSnapshots.queueUnavailableTitle')}
          description={getErrorMessage(needsActionQuery.error)}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }
  if (dailyClosureQuery.isError) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('adminSnapshots.dailyClosureUnavailableTitle')}
          description={getErrorMessage(dailyClosureQuery.error)}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  const overview = overviewQuery.data
  const dailyClosure = dailyClosureQuery.data
  if (!overview) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('adminSnapshots.overviewUnavailableTitle')}
          description={t('adminSnapshots.overviewMissingCopy')}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }
  if (!dailyClosure) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('adminSnapshots.dailyClosureUnavailableTitle')}
          description={t('adminSnapshots.dailyClosureMissingCopy')}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  const meta = needsActionQuery.data?.meta
  const canGoBack = offset > 0
  const canGoForward = meta ? offset + PAGE_SIZE < meta.total : false

  return (
    <AdminSurfacePage ariaLabel={t('adminSnapshots.heroTitle')}>
      <SnapshotsHeader overview={overview} t={t} />
      <SnapshotFeedbackPanel feedback={feedback} />
      <DailyClosurePanels
        dailyClosure={dailyClosure}
        isQueuing={dailyClosureMutation.isPending}
        locale={locale}
        onQueue={() => dailyClosureMutation.mutate()}
        t={t}
      />
      <SnapshotHealthMetricGrid overview={overview} t={t} />
      <SnapshotHealthSummaryPanels overview={overview} t={t} />
      <SnapshotActionQueuePanel
        dispatchPageState={dispatchPageState}
        filters={{ search, snapshotTypeFilter, runStatusFilter }}
        isRerunning={rerunMutation.isPending}
        locale={locale}
        meta={meta}
        offset={offset}
        pagination={{ canGoBack, canGoForward }}
        sortedItems={sortedItems}
        sortBy={sortBy}
        onRerun={(snapshotRunId) => rerunMutation.mutate(snapshotRunId)}
        t={t}
      />
    </AdminSurfacePage>
  )
}

type SnapshotNeedsActionMeta = {
  total: number
}

function SnapshotsHeader(input: { overview: SnapshotOverview; t: TranslateFunction }) {
  return (
    <AdminSurfaceHeader
      eyebrow={input.t('adminSnapshots.heroEyebrow')}
      title={input.t('adminSnapshots.heroTitle')}
      description={input.t('adminSnapshots.heroCopy')}
      icon={<Rocket size={18} />}
      meta={
        <>
          <AdminSurfaceBadge tone="neutral">
            {input.t('adminSnapshots.allRuns')}: {formatNumber(input.overview.totals.all)}
          </AdminSurfaceBadge>
          <AdminSurfaceBadge tone="accent">
            {input.t('adminSnapshots.retryReady')}: {formatNumber(input.overview.healthTotals.retryReady)}
          </AdminSurfaceBadge>
          <AdminSurfaceBadge tone="danger">
            {input.t('adminSnapshots.stuck')}: {formatNumber(input.overview.healthTotals.stuck)}
          </AdminSurfaceBadge>
        </>
      }
    />
  )
}

function SnapshotFeedbackPanel(input: { feedback: string | null }) {
  return input.feedback ? (
    <AdminStatePanel title={input.feedback} tone="accent" />
  ) : null
}

function DailyClosurePanels(input: {
  dailyClosure: DailyClosureStatus
  isQueuing: boolean
  locale: AppLocale
  onQueue: () => void
  t: TranslateFunction
}) {
  return (
    <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <AdminSurfaceSection
        eyebrow={input.t('adminSnapshots.dailyClosureEyebrow')}
        title={input.t('adminSnapshots.dailyClosureTitle')}
        description={input.t('adminSnapshots.dailyClosureCopy')}
        badge={
          <AdminSurfaceBadge tone={mapSnapshotSurfaceTone(input.dailyClosure.healthState)}>
            {formatSnapshotState(input.dailyClosure.healthState, input.t)}
          </AdminSurfaceBadge>
        }
        actions={
          <>
            <Button
              type="button"
              onClick={input.onQueue}
              disabled={!input.dailyClosure.canQueue || input.isQueuing}
            >
              {input.isQueuing
                ? input.t('adminSnapshots.queuing')
                : input.t('adminSnapshots.queueDailyClosure')}
            </Button>
            {input.dailyClosure.existingSnapshotRunId ? (
              <Button asChild type="button" variant="outline">
                <Link to={`/admin/snapshots/${input.dailyClosure.existingSnapshotRunId}`}>
                  {input.t('adminSnapshots.openSnapshotRun')}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
          </>
        }
      >
        <AdminKeyValueGrid className="tw:lg:grid-cols-3">
          <KeyValue
            label={input.t('adminSnapshots.closureDate')}
            value={formatDate(input.dailyClosure.closureDate, input.locale)}
          />
          <KeyValue
            label={input.t('adminSnapshots.localDate')}
            value={formatDate(input.dailyClosure.localDate, input.locale)}
          />
          <KeyValue label={input.t('adminSnapshots.timezone')} value={input.dailyClosure.timezone} />
          <KeyValue
            label={input.t('adminSnapshots.existingRun')}
            value={input.dailyClosure.existingSnapshotRunId ?? input.t('adminSnapshots.noRunYet')}
          />
          <KeyValue
            label={input.t('adminSnapshots.automation')}
            value={
              input.dailyClosure.automationEnabled
                ? input.t('adminSnapshots.enabled')
                : input.t('adminSnapshots.disabled')
            }
          />
          <KeyValue
            label={input.t('adminSnapshots.pollCadence')}
            value={input.t('adminSnapshots.minutes', {
              count: input.dailyClosure.automationPollMinutes,
            })}
          />
        </AdminKeyValueGrid>
        <div className="tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3 tw:text-sm tw:text-muted-foreground">
          {input.dailyClosure.recommendedAction}
        </div>
        {input.dailyClosure.existingFailureReason ? (
          <AdminStatePanel
            title={input.t('adminSnapshots.failureReason')}
            description={input.dailyClosure.existingFailureReason}
            tone="danger"
          />
        ) : null}
      </AdminSurfaceSection>

      <AdminSurfaceSection
        eyebrow={input.t('adminSnapshots.closureRuleEyebrow')}
        title={input.t('adminSnapshots.closureRuleTitle')}
      >
        <AdminKeyValueGrid className="tw:lg:grid-cols-2">
          <KeyValue
            label={input.t('adminSnapshots.sourceModel')}
            value={input.t('adminSnapshots.sourceModelValue')}
          />
          <KeyValue
            label={input.t('adminSnapshots.automaticTarget')}
            value={input.t('adminSnapshots.automaticTargetValue')}
          />
          <KeyValue
            label={input.t('adminSnapshots.queueBehavior')}
            value={
              input.dailyClosure.canQueue
                ? input.t('adminSnapshots.readyToQueue')
                : input.t('adminSnapshots.waitingOrClosed')
            }
          />
          <KeyValue
            label={input.t('adminSnapshots.retryPath')}
            value={
              input.dailyClosure.canRerun
                ? input.t('adminSnapshots.useRerunOnFailed')
                : input.t('adminSnapshots.notNeeded')
            }
          />
        </AdminKeyValueGrid>
      </AdminSurfaceSection>
    </div>
  )
}

function SnapshotHealthMetricGrid(input: { overview: SnapshotOverview; t: TranslateFunction }) {
  return (
    <AdminMetricStrip
      items={[
        {
          id: 'healthy',
          label: input.t('adminSnapshots.healthy'),
          value: input.overview.healthTotals.healthy,
          description: input.t('adminSnapshots.healthyNote', { count: input.overview.totals.completed }),
          icon: <Rocket size={18} />,
          tone: 'success',
        },
        {
          id: 'in-progress',
          label: input.t('adminSnapshots.inProgress'),
          value: input.overview.healthTotals.inProgress,
          description: input.t('adminSnapshots.inProgressNote', {
            count: input.overview.totals.queued + input.overview.totals.running,
          }),
          icon: <Activity size={18} />,
          tone: 'neutral',
        },
        {
          id: 'retry-ready',
          label: input.t('adminSnapshots.retryReady'),
          value: input.overview.healthTotals.retryReady,
          description: input.t('adminSnapshots.retryReadyNote'),
          icon: <RefreshCcw size={18} />,
          tone: 'accent',
        },
        {
          id: 'stuck',
          label: input.t('adminSnapshots.stuck'),
          value: input.overview.healthTotals.stuck,
          description: input.t('adminSnapshots.stuckNote'),
          icon: <Clock3 size={18} />,
          tone: 'danger',
        },
      ]}
    />
  )
}

function SnapshotHealthSummaryPanels(input: { overview: SnapshotOverview; t: TranslateFunction }) {
  return (
    <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:xl:grid-cols-2">
      <AdminSurfaceSection
        eyebrow={input.t('adminSnapshots.latestPointers')}
        title={input.t('adminSnapshots.runTransitions')}
      >
        <AdminKeyValueGrid>
          <KeyValue
            label={input.t('adminSnapshots.latestCompleted')}
            value={input.overview.latest.completedSnapshotRunId ?? input.t('adminSnapshots.noCompletedRun')}
          />
          <KeyValue
            label={input.t('adminSnapshots.latestFailed')}
            value={input.overview.latest.failedSnapshotRunId ?? input.t('adminSnapshots.noFailedRun')}
          />
          <KeyValue
            label={input.t('adminSnapshots.latestInProgress')}
            value={input.overview.latest.inProgressSnapshotRunId ?? input.t('adminSnapshots.noActiveRun')}
          />
          <KeyValue
            label={input.t('adminSnapshots.latestStuck')}
            value={input.overview.latest.stuckSnapshotRunId ?? input.t('adminSnapshots.noStuckRun')}
          />
        </AdminKeyValueGrid>
      </AdminSurfaceSection>

      <AdminSurfaceSection
        eyebrow={input.t('adminSnapshots.healthReading')}
        title={input.t('adminSnapshots.runStateBalance')}
      >
        <HealthProgressRow label={input.t('adminSnapshots.healthy')} tone="success" value={input.overview.healthTotals.healthy} total={input.overview.totals.all} />
        <HealthProgressRow label={input.t('adminSnapshots.inProgress')} tone="neutral" value={input.overview.healthTotals.inProgress} total={input.overview.totals.all} />
        <HealthProgressRow label={input.t('adminSnapshots.retryReady')} tone="accent" value={input.overview.healthTotals.retryReady} total={input.overview.totals.all} />
        <HealthProgressRow label={input.t('adminSnapshots.stuck')} tone="danger" value={input.overview.healthTotals.stuck} total={input.overview.totals.all} />
      </AdminSurfaceSection>
    </div>
  )
}

function HealthProgressRow(input: { label: string; tone: AdminSurfaceTone; value: number; total: number }) {
  const percent = input.total > 0 ? Math.round((input.value / input.total) * 100) : 0
  return (
    <div className="tw:grid tw:gap-2">
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:text-sm">
        <span className="tw:text-muted-foreground">{input.label}</span>
        <span className="tw:font-medium">{input.value} / {input.total}</span>
      </div>
      <Progress
        className={progressToneClass(input.tone)}
        value={percent}
        aria-label={input.label}
      />
    </div>
  )
}

function SnapshotActionQueuePanel(input: {
  dispatchPageState: Dispatch<SnapshotsDashboardPageAction>
  filters: {
    search: string
    snapshotTypeFilter: SnapshotTypeFilter
    runStatusFilter: SnapshotRunStatusFilter
  }
  isRerunning: boolean
  locale: AppLocale
  meta: SnapshotNeedsActionMeta | undefined
  offset: number
  onRerun: (snapshotRunId: string) => void
  pagination: {
    canGoBack: boolean
    canGoForward: boolean
  }
  sortedItems: SnapshotNeedsActionItem[]
  sortBy: SnapshotSortValue
  t: TranslateFunction
}) {
  return (
    <AdminSurfaceSection
      eyebrow={input.t('adminSnapshots.actionQueueEyebrow')}
      title={input.t('adminSnapshots.actionQueueTitle')}
      description={input.t('adminSnapshots.actionQueueCopy')}
      actions={
        <AdminReportingToolbar
          sortValue={input.sortBy}
          onSortChange={(value) =>
            input.dispatchPageState({ type: 'setSortBy', value: value as SnapshotSortValue })
          }
          sortOptions={[
            { value: 'priority', label: input.t('adminSnapshots.sort.priority') },
            { value: 'generated-desc', label: input.t('adminSnapshots.sort.generatedDesc') },
            { value: 'reruns', label: input.t('adminSnapshots.sort.reruns') },
            { value: 'type', label: input.t('adminSnapshots.sort.type') },
          ]}
          sortAriaLabel={input.t('adminSnapshots.sortRows')}
          exportLabel={input.t('adminSnapshots.exportCsv')}
          onExport={() =>
            downloadCsv({
              filename: 'snapshot-needs-action.csv',
              columns: [
                'snapshotRunId',
                'snapshotType',
                'runStatus',
                'healthState',
                'generatedAt',
                'periodStart',
                'periodEnd',
                'rerunCount',
                'actionReason',
                'recommendedAction',
              ],
              rows: input.sortedItems.map((item) => [
                item.snapshotRunId,
                item.snapshotType,
                item.runStatus,
                item.healthState,
                item.generatedAt,
                item.periodStart,
                item.periodEnd,
                item.rerunCount,
                item.actionReason,
                item.recommendedAction,
              ]),
            })
          }
        >
          <Input
            className="tw:w-full tw:bg-background/70 tw:sm:w-64"
            value={input.filters.search}
            onChange={(event) =>
              input.dispatchPageState({ type: 'setSearch', value: event.target.value })
            }
            placeholder={input.t('adminSnapshots.searchPlaceholder')}
            aria-label={input.t('adminSnapshots.filterQueue')}
          />
        </AdminReportingToolbar>
      }
    >
      <SnapshotQueueFilters
        dispatchPageState={input.dispatchPageState}
        runStatusFilter={input.filters.runStatusFilter}
        snapshotTypeFilter={input.filters.snapshotTypeFilter}
        t={input.t}
      />

      {input.sortedItems.length === 0 ? (
        <AdminSurfaceEmpty
          title={input.t('adminSnapshots.emptyQueueTitle')}
          copy={input.t('adminSnapshots.emptyQueueCopy')}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{input.t('adminSnapshots.actionQueueTitle')}</TableHead>
              <TableHead>{input.t('adminSnapshots.period')}</TableHead>
              <TableHead>{input.t('adminSnapshots.runStatus')}</TableHead>
              <TableHead>{input.t('adminSnapshots.reruns', { count: 0 })}</TableHead>
              <TableHead className="tw:text-right">{input.t('adminSnapshots.recommendedAction')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {input.sortedItems.map((item) => (
              <SnapshotActionQueueRow
                isRerunning={input.isRerunning}
                item={item}
                key={item.snapshotRunId}
                locale={input.locale}
                onRerun={input.onRerun}
                t={input.t}
              />
            ))}
          </TableBody>
        </Table>
      )}

      <SnapshotQueuePagination
        dispatchPageState={input.dispatchPageState}
        meta={input.meta}
        offset={input.offset}
        pagination={input.pagination}
        t={input.t}
      />
    </AdminSurfaceSection>
  )
}

function SnapshotQueueFilters(input: {
  dispatchPageState: Dispatch<SnapshotsDashboardPageAction>
  runStatusFilter: SnapshotRunStatusFilter
  snapshotTypeFilter: SnapshotTypeFilter
  t: TranslateFunction
}) {
  return (
    <AdminFilterBar>
      <Select
        value={input.snapshotTypeFilter || 'all'}
        onValueChange={(value) =>
          input.dispatchPageState({
            type: 'setSnapshotTypeFilter',
            value: (value === 'all' ? '' : value) as SnapshotTypeFilter,
          })
        }
      >
        <SelectTrigger aria-label={input.t('adminSnapshots.filterSnapshotType')} className="tw:w-full tw:bg-background/70 tw:md:w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">{input.t('adminSnapshots.allSnapshotTypes')}</SelectItem>
            {snapshotTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {formatSnapshotType(type, input.t)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select
        value={input.runStatusFilter || 'all'}
        onValueChange={(value) =>
          input.dispatchPageState({
            type: 'setRunStatusFilter',
            value: (value === 'all' ? '' : value) as SnapshotRunStatusFilter,
          })
        }
      >
        <SelectTrigger aria-label={input.t('adminSnapshots.filterRunStatus')} className="tw:w-full tw:bg-background/70 tw:md:w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">{input.t('adminSnapshots.allRunStatuses')}</SelectItem>
            {runStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                {formatSnapshotState(status, input.t)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button
        className="tw:w-full tw:md:w-auto"
        type="button"
        variant="outline"
        onClick={() => input.dispatchPageState({ type: 'clearFilters' })}
      >
        {input.t('adminSnapshots.clearFilters')}
      </Button>
    </AdminFilterBar>
  )
}

function SnapshotActionQueueRow(input: {
  isRerunning: boolean
  item: SnapshotNeedsActionItem
  locale: AppLocale
  onRerun: (snapshotRunId: string) => void
  t: TranslateFunction
}) {
  return (
    <TableRow data-testid={`snapshot-queue-row-${input.item.snapshotRunId}`}>
      <TableCell className="tw:max-w-md">
        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-2">
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            <Button asChild size="sm" variant="link" className="tw:h-auto tw:p-0 tw:text-left tw:font-medium">
              <Link to={`/admin/snapshots/${input.item.snapshotRunId}`}>
                {input.t('adminSnapshots.snapshotTitle', {
                  type: formatSnapshotType(input.item.snapshotType, input.t),
                })}
              </Link>
            </Button>
            <AdminSurfaceBadge tone={mapSnapshotSurfaceTone(input.item.healthState)}>
              {formatSnapshotState(input.item.healthState, input.t)}
            </AdminSurfaceBadge>
          </div>
          <div className="tw:max-w-72 tw:truncate tw:text-xs tw:text-muted-foreground">
            {input.item.snapshotRunId}
          </div>
          <p className="tw:m-0 tw:text-sm tw:text-muted-foreground">{input.item.actionReason}</p>
          {input.item.latestRerunSnapshotRunId ? (
            <div className="tw:text-xs tw:text-muted-foreground">
              {input.t('adminSnapshots.latestRerun', { id: input.item.latestRerunSnapshotRunId })}
            </div>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        {formatDate(input.item.periodStart, input.locale)} - {formatDate(input.item.periodEnd, input.locale)}
      </TableCell>
      <TableCell>
        <AdminSurfaceBadge tone={mapSnapshotSurfaceTone(input.item.runStatus)}>
          {formatSnapshotState(input.item.runStatus, input.t)}
        </AdminSurfaceBadge>
      </TableCell>
      <TableCell>{input.t('adminSnapshots.reruns', { count: input.item.rerunCount })}</TableCell>
      <TableCell>
        <div className="tw:flex tw:flex-col tw:items-start tw:gap-2 tw:text-sm tw:md:items-end">
          <span className="tw:max-w-sm tw:text-muted-foreground tw:md:text-right">{input.item.recommendedAction}</span>
          <AdminActionRow className="tw:justify-end">
            <Button asChild size="sm" variant="outline">
              <Link to={`/admin/snapshots/${input.item.snapshotRunId}`}>
                {input.t('adminSnapshots.openSnapshotRun')}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            {input.item.canRerun ? (
              <Button
                size="sm"
                type="button"
                onClick={() => input.onRerun(input.item.snapshotRunId)}
                disabled={input.isRerunning}
              >
                <RefreshCcw aria-hidden="true" />
                {input.isRerunning
                  ? input.t('adminSnapshots.rerunning')
                  : input.t('adminSnapshots.rerunSnapshot')}
              </Button>
            ) : null}
          </AdminActionRow>
        </div>
      </TableCell>
    </TableRow>
  )
}

function SnapshotQueuePagination(input: {
  dispatchPageState: Dispatch<SnapshotsDashboardPageAction>
  meta: SnapshotNeedsActionMeta | undefined
  offset: number
  pagination: {
    canGoBack: boolean
    canGoForward: boolean
  }
  t: TranslateFunction
}) {
  return (
    <AdminActionRow className="tw:justify-between">
      <Button
        type="button"
        variant="outline"
        onClick={() => input.dispatchPageState({ type: 'previousPage' })}
        disabled={!input.pagination.canGoBack}
      >
        {input.t('adminSnapshots.previous')}
      </Button>
      <AdminSurfaceBadge tone="neutral">
        {input.meta
          ? `${input.offset + 1}-${Math.min(input.offset + PAGE_SIZE, input.meta.total)} / ${input.meta.total}`
          : input.t('adminSnapshots.zeroResults')}
      </AdminSurfaceBadge>
      <Button
        type="button"
        variant="outline"
        onClick={() => input.dispatchPageState({ type: 'nextPage' })}
        disabled={!input.pagination.canGoForward}
      >
        {input.t('adminSnapshots.next')}
      </Button>
    </AdminActionRow>
  )
}

function progressToneClass(tone: AdminSurfaceTone) {
  if (tone === 'success') return 'tw:[&_[data-slot=progress-indicator]]:bg-emerald-500'
  if (tone === 'accent') return 'tw:[&_[data-slot=progress-indicator]]:bg-violet-500'
  if (tone === 'warning') return 'tw:[&_[data-slot=progress-indicator]]:bg-amber-500'
  if (tone === 'danger') return 'tw:[&_[data-slot=progress-indicator]]:bg-rose-500'
  if (tone === 'cyan') return 'tw:[&_[data-slot=progress-indicator]]:bg-cyan-500'
  return 'tw:[&_[data-slot=progress-indicator]]:bg-slate-400'
}
