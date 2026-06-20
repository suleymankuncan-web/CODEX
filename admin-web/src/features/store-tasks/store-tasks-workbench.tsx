import { type ReactNode } from 'react'
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ClipboardList,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  Store,
  Target,
  TrendingDown,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { AuthSessionSummary } from '../auth/api'
import type { TranslateFunction } from '../localization/dictionary'
import { StoreActionPlanCreateControl } from '../store-actions/StoreActionPlanCreateControl'
import { getErrorMessage } from '../../lib/format'
import type { AppLocale } from '../../lib/i18n'
import { cn } from '../../lib/utils'
import {
  StoreEmptyState,
  StoreStatusBadge,
  type StoreSurfaceTone,
} from '../../pages/store-surface-primitives'
import {
  formatDisplayRoleLabels,
  formatWorkflowPrimaryActionLabel,
  getSafeInAppPath,
  isActiveStatus,
  type TaskPersona,
  type WorkbenchRow,
  type WorkbenchRowFamily,
  type WorkbenchSummary,
  type WorkbenchTabId,
} from './store-tasks-workbench-model'
import { StoreActionPlanDetailDialog } from './StoreActionPlanDetailDialog'

export function AccessState(input: {
  authSummary: AuthSessionSummary | null
  primaryStoreId: string
  t: TranslateFunction
}) {
  return (
    <Card className="tw:border-border/80 tw:bg-card/85 tw:shadow-sm">
      <CardHeader>
        <div className="tw:flex tw:size-10 tw:items-center tw:justify-center tw:rounded-xl tw:bg-secondary tw:text-primary">
          <ShieldCheck className="tw:size-5" />
        </div>
        <CardTitle>
          <h1 className="tw:text-xl tw:font-semibold tw:text-foreground">
            {input.t('storeTasks.unavailableTitle')}
          </h1>
        </CardTitle>
        <CardDescription>{input.t('storeTasks.unavailableCopy')}</CardDescription>
      </CardHeader>
      <CardContent className="tw:flex tw:flex-wrap tw:gap-2">
        <StoreStatusBadge tone="neutral">{`${input.t('storeTasks.storeScope')}: ${input.primaryStoreId}`}</StoreStatusBadge>
        <StoreStatusBadge tone="warning">
          {formatDisplayRoleLabels(input.t, input.authSummary?.user.roleCodes)}
        </StoreStatusBadge>
      </CardContent>
    </Card>
  )
}

export function WorkbenchHeader(input: {
  persona: TaskPersona
  t: TranslateFunction
}) {
  const isRegion = input.persona === 'regionManager'
  return (
    <header className="tw:grid tw:gap-4">
      <div className="tw:min-w-0">
        <div className="tw:mb-2.5 tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          <Badge variant="outline" className="tw:min-h-7 tw:gap-1.5 tw:border-[#10adc5]/25 tw:bg-[#e6fbff] tw:px-2.5 tw:font-medium tw:text-[#08798d]">
            <ShieldCheck className="tw:size-3.5" />
            {isRegion ? input.t('storeTasks.regionScopePill') : input.t('storeTasks.storeScopePill')}
          </Badge>
          <Badge variant="outline" className="tw:min-h-7 tw:gap-1.5 tw:border-[#ef426f]/25 tw:bg-[#ffe8ef] tw:px-2.5 tw:font-medium tw:text-[#d6244f]">
            <ClipboardList className="tw:size-3.5" />
            {input.t('storeTasks.checklistCount')}
          </Badge>
          <Badge variant="outline" className="tw:min-h-7 tw:gap-1.5 tw:border-[#f59e0b]/25 tw:bg-[#fff4df] tw:px-2.5 tw:font-medium tw:text-[#925900]">
            <TrendingDown className="tw:size-3.5" />
            {input.t('storeTasks.projectionCount')}
          </Badge>
        </div>
        <h1 className="tw:max-w-4xl tw:text-[1.9rem] tw:font-bold tw:leading-[1.04] tw:tracking-[-0.035em] tw:text-[#071631] tw:md:text-[2.375rem]">
          {isRegion ? input.t('storeTasks.titleRegion') : input.t('storeTasks.titleStore')}
        </h1>
        <p className="tw:mt-2.5 tw:max-w-[790px] tw:text-sm tw:leading-[1.55] tw:text-[#62708a]">
          {isRegion ? input.t('storeTasks.heroCopyRegion') : input.t('storeTasks.heroCopyStore')}
        </p>
      </div>
    </header>
  )
}

export function SummaryGrid(input: {
  summary: WorkbenchSummary
  persona: TaskPersona
  t: TranslateFunction
}) {
  const cards = [
    {
      label: input.persona === 'regionManager' ? input.t('storeTasks.regionPendingMetric') : input.t('storeTasks.pendingActions'),
      note: input.persona === 'regionManager' ? input.t('storeTasks.pendingActionsNoteRegion') : input.t('storeTasks.pendingActionsNoteStore'),
      badge: input.t('storeTasks.openBadge'),
      value: input.summary.pending,
      tone: input.summary.pending > 0 ? 'warning' : 'calm',
      icon: <Bell className="tw:size-4" />,
    },
    {
      label: input.t('storeTasks.checklistCount'),
      note: input.t('storeTasks.checklistMetricNote'),
      badge: input.t('storeTasks.tab.checklist'),
      value: input.summary.checklist,
      tone: input.summary.checklist > 0 ? 'danger' : 'neutral',
      icon: <ListChecks className="tw:size-4" />,
    },
    {
      label: input.t('storeTasks.projectionCount'),
      note: input.t('storeTasks.projectionMetricNote'),
      badge: input.t('storeTasks.tab.projection'),
      value: input.summary.projection,
      tone: input.summary.projection > 0 ? 'warning' : 'neutral',
      icon: <TrendingDown className="tw:size-4" />,
    },
    {
      label: input.t('storeTasks.reportedResolvedMetric'),
      note: input.t('storeTasks.reportedResolvedMetricNote'),
      badge: input.t('storeTasks.now'),
      value: input.summary.reported,
      tone: input.summary.reported > 0 ? 'calm' : 'neutral',
      icon: <CheckCircle2 className="tw:size-4" />,
    },
  ] as const

  return (
    <section className="tw:grid tw:gap-3 tw:md:grid-cols-2 tw:xl:grid-cols-4" aria-label={input.t('storeTasks.summaryRegion')}>
      {cards.map((card) => (
        <article
          key={card.label}
          className="tw:min-h-24 tw:rounded-[1.125rem] tw:border tw:border-[rgba(207,218,234,0.82)] tw:bg-white/80 tw:p-3.5 tw:shadow-[0_14px_36px_rgba(39,58,91,0.07)] tw:backdrop-blur"
        >
          <div className="tw:mb-[9px] tw:flex tw:items-center tw:justify-between tw:gap-3">
            <span className={cn('tw:grid tw:size-[38px] tw:shrink-0 tw:place-items-center tw:rounded-[14px] tw:border', summaryIconClasses[card.tone])}>
              {card.icon}
            </span>
            <span className={cn('tw:inline-flex tw:min-h-[27px] tw:items-center tw:justify-center tw:rounded-full tw:border tw:px-2.5 tw:text-xs tw:font-semibold', summaryBadgeClasses[card.tone])}>
              {card.badge}
            </span>
          </div>
          <b className="tw:block tw:text-2xl tw:font-bold tw:leading-none tw:tracking-[-0.03em] tw:text-[#071631]">
            {card.value}
          </b>
          <span className="tw:mt-1 tw:block tw:truncate tw:text-xs tw:text-[#62708a]">{card.note}</span>
        </article>
      ))}
    </section>
  )
}

export function WorkbenchTabs(input: {
  activeTab: WorkbenchTabId
  tabs: Array<{ id: WorkbenchTabId; label: string; count: number; icon: ReactNode }>
  onTabChange: (tab: WorkbenchTabId) => void
}) {
  return (
    <div className="tw:grid tw:grid-cols-2 tw:gap-[7px] tw:rounded-[1.125rem] tw:border tw:border-[#dbe5f2] tw:bg-white/65 tw:p-[7px] tw:backdrop-blur tw:md:grid-cols-5">
      {input.tabs.map((tab) => {
        const active = input.activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            className={cn(
              'tw:flex tw:min-h-[38px] tw:items-center tw:justify-center tw:gap-2 tw:rounded-[13px] tw:border tw:border-transparent tw:bg-transparent tw:px-3 tw:text-xs tw:font-semibold tw:text-[#5b6885] tw:transition-colors',
              tab.id === 'closed' && 'tw:col-span-2 tw:md:col-span-1',
              active && 'tw:border-[#6847f5]/25 tw:bg-gradient-to-br tw:from-[#6847f5]/10 tw:to-[#10adc5]/10 tw:text-[#6847f5]',
            )}
            aria-pressed={active}
            onClick={() => input.onTabChange(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <Badge variant="secondary" className={cn('tw:h-[22px] tw:min-w-[22px] tw:rounded-full tw:px-1.5 tw:text-[0.7rem] tw:font-semibold', active ? 'tw:bg-[#eee9ff] tw:text-[#5a37df]' : 'tw:bg-[#eef2f8] tw:text-[#62708a]')}>
              {tab.count}
            </Badge>
          </button>
        )
      })}
    </div>
  )
}

export function StoreTasksWorkbenchBody(input: {
  rows: readonly WorkbenchRow[]
  allRows: readonly WorkbenchRow[]
  search: string
  persona: TaskPersona
  storeActionPlansEnabled: boolean
  storeActionPlansMeta: { total: number; limit: number; offset: number; count: number } | undefined
  isStoreActionPlansLoading: boolean
  isStoreActionPlansError: boolean
  isStoreActionPlansFetching: boolean
  storeActionPlansError: unknown
  locale: AppLocale
  t: TranslateFunction
  onActionPlanCreated: () => void
  onRetryStoreActionPlans: () => void
  onPreviousPage: () => void
  onNextPage: () => void
}) {
  if (input.storeActionPlansEnabled && input.isStoreActionPlansLoading && input.allRows.length === 0) {
    return (
      <div className="tw:p-4">
        <StoreEmptyState
          title={input.t('storeTasks.actionPlansLoadingTitle')}
          description={input.t('storeTasks.actionPlansLoadingCopy')}
        />
      </div>
    )
  }

  const actionPlansError = input.storeActionPlansEnabled && input.isStoreActionPlansError
    ? renderActionPlansError(input)
    : null

  if (input.rows.length === 0) {
    return (
      <>
        {actionPlansError}
        <div className="tw:p-4">
          <StoreEmptyState
            title={input.search.trim() ? input.t('storeTasks.filteredEmptyTitle') : input.t('storeTasks.emptyTitle')}
            description={input.search.trim() ? input.t('storeTasks.filteredEmptyCopy') : input.t('storeTasks.emptyCopy')}
          />
        </div>
      </>
    )
  }

  return (
    <>
      {actionPlansError}
      <div className="tw:grid">
        {input.rows.map((row) => (
          <WorkbenchRowView
            key={row.id}
            row={row}
            persona={input.persona}
            locale={input.locale}
            t={input.t}
            onActionPlanCreated={input.onActionPlanCreated}
          />
        ))}
      </div>
      {renderPagination(input)}
    </>
  )
}

function renderActionPlansError(input: {
  storeActionPlansError: unknown
  isStoreActionPlansFetching: boolean
  t: TranslateFunction
  onRetryStoreActionPlans: () => void
}) {
  return (
    <div className="tw:border-b tw:border-border/70 tw:p-4">
      <div className={cn('tw:rounded-xl tw:border tw:p-4', toneSurfaceClasses.danger)}>
        <div className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
          <strong className="tw:text-sm tw:text-foreground">{input.t('storeTasks.actionPlansErrorTitle')}</strong>
          <Button
            type="button"
            variant="outline"
            disabled={input.isStoreActionPlansFetching}
            onClick={input.onRetryStoreActionPlans}
          >
            <RefreshCw data-icon="inline-start" />
            {input.isStoreActionPlansFetching ? input.t('storeTasks.retryingAction') : input.t('storeTasks.retryAction')}
          </Button>
        </div>
        <p className="tw:mt-2 tw:text-sm tw:text-muted-foreground">{getErrorMessage(input.storeActionPlansError)}</p>
      </div>
    </div>
  )
}

function renderPagination(input: {
  rows: readonly WorkbenchRow[]
  storeActionPlansMeta: { total: number; limit: number; offset: number; count: number } | undefined
  isStoreActionPlansFetching: boolean
  t: TranslateFunction
  onPreviousPage: () => void
  onNextPage: () => void
}) {
  const meta = input.storeActionPlansMeta
  if (!meta || meta.total === 0) {
    return null
  }

  const start = meta.offset + 1
  const end = meta.offset + meta.count
  const canGoPrevious = meta.offset > 0
  const canGoNext = end < meta.total

  return (
    <div className="tw:flex tw:flex-col tw:gap-2 tw:border-t tw:border-border/70 tw:p-3 tw:text-sm tw:text-muted-foreground tw:sm:flex-row tw:sm:items-center tw:sm:justify-between">
      <span>
        {input.t('storeTasks.actionPlansRange', {
          start,
          end,
          total: meta.total,
        })}
      </span>
      <div className="tw:flex tw:flex-wrap tw:gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!canGoPrevious || input.isStoreActionPlansFetching}
          onClick={input.onPreviousPage}
        >
          {input.t('storeTasks.actionPlansPrevious')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!canGoNext || input.isStoreActionPlansFetching}
          onClick={input.onNextPage}
        >
          {input.t('storeTasks.actionPlansNext')}
        </Button>
      </div>
    </div>
  )
}

function WorkbenchRowView(input: {
  row: WorkbenchRow
  persona: TaskPersona
  locale: AppLocale
  t: TranslateFunction
  onActionPlanCreated: () => void
}) {
  const plan = input.row.plan
  const canMutatePlan = input.persona === 'storeManager' && plan !== undefined && isActiveStatus(plan.status)
  const accentClass = rowAccentClasses[input.row.tone]
  const rowBackgroundClass = rowBackgroundClasses[input.row.tone]
  const displayStoreName = input.row.storeName !== input.row.storeId ? input.row.storeName : null
  const title = displayStoreName && !input.row.title.includes(displayStoreName)
    ? `${displayStoreName}, ${input.row.title}`
    : input.row.title
  const actionLabel = input.persona === 'regionManager'
    ? input.t('storeTasks.regionInspectAction')
    : input.row.state === 'closed' || input.row.state === 'reported'
      ? input.t('storeTasks.rowRecordAction')
      : input.t('storeTasks.rowDetailAction')
  const secondaryLine = [
    input.row.summary,
    displayStoreName,
    input.row.historyPreview,
  ].filter((part): part is string => Boolean(part && part.trim()))
    .join(' · ')
  return (
    <article
      data-testid={input.row.source === 'plan' ? 'store-action-plan-row' : 'store-task-queue-row'}
      aria-label={secondaryLine ? `${title}: ${secondaryLine}` : title}
      className={cn(
        'tw:relative tw:grid tw:w-full tw:grid-cols-[2.45rem_minmax(0,1fr)] tw:gap-2 tw:border-b tw:border-[#dbe5f2] tw:px-3 tw:py-3 tw:text-left tw:transition-colors tw:last:border-b-0 tw:hover:bg-white/80 tw:md:grid-cols-[42px_minmax(250px,1fr)_140px_168px_118px_116px] tw:md:items-center tw:md:gap-3 tw:md:px-4 tw:md:py-3.5',
        rowBackgroundClass,
      )}
    >
      <span className={cn('tw:absolute tw:inset-y-0 tw:left-0 tw:w-[3px]', accentClass)} aria-hidden />
      <span className={cn('tw:grid tw:size-[39px] tw:shrink-0 tw:place-items-center tw:rounded-[14px] tw:border', toneSurfaceClasses[input.row.tone])}>
        {renderFamilyIcon(input.row.family)}
      </span>
      <div className="tw:min-w-0">
        <h3 className="tw:block tw:truncate tw:text-sm tw:font-semibold tw:tracking-[-0.01em] tw:text-[#0b1732]">
          {title}
        </h3>
        <p className="tw:mt-[5px] tw:truncate tw:text-xs tw:leading-4 tw:text-[#62708a]">{input.row.summary}</p>
      </div>

      <RowFact label={input.t('storeTasks.actionPlansSource')} value={input.row.sourceLabel} />
      <RowFact label={input.t('storeTasks.evidenceLabel')} value={input.row.historyPreview ?? input.row.evidenceLabel} />
      <RowFact label={input.t('storeTasks.status')} value={input.row.statusLabel} tone={input.row.statusTone} />

      <div className="tw:col-start-2 tw:flex tw:flex-wrap tw:items-center tw:gap-1.5 tw:md:col-auto tw:md:justify-end tw:[&_a]:min-h-[38px] tw:[&_a]:w-full tw:[&_button]:min-h-[38px] tw:[&_button]:w-full tw:[&_button]:rounded-[13px] tw:[&_button]:px-[13px] tw:[&_button]:text-xs tw:[&_button]:font-semibold tw:md:[&_a]:w-auto tw:md:[&_button]:w-auto">
        {plan ? (
          <StoreActionPlanDetailDialog
            plan={plan}
            storeName={displayStoreName ?? input.row.storeName}
            canMutate={canMutatePlan}
            locale={input.locale}
            t={input.t}
            triggerLabel={actionLabel}
          />
        ) : null}
        {!plan && input.row.candidate && input.persona === 'storeManager' ? (
          <StoreActionPlanCreateControl
            candidate={input.row.candidate}
            t={input.t}
            onCreated={input.onActionPlanCreated}
            triggerLabel={input.t('storeTasks.rowPlanAction')}
            triggerClassName={softPlumActionClass}
          />
        ) : null}
        {!plan && input.row.workflowItem ? (
          <SourceLink
            to={input.row.workflowItem.deepLink}
            label={
              input.row.candidate && input.persona === 'storeManager'
                ? input.t('storeTasks.actionPlansOpenSource')
                : formatWorkflowPrimaryActionLabel(input.t, input.row.workflowItem)
            }
            variant={input.row.candidate && input.persona === 'storeManager' ? 'secondary' : 'primary'}
          />
        ) : null}
      </div>
    </article>
  )
}

function RowFact(input: {
  label: string
  value: string
  tone?: StoreSurfaceTone
}) {
  return (
    <div className="tw:col-start-2 tw:min-w-0 tw:md:col-auto">
      <span className="tw:block tw:text-[10px] tw:font-semibold tw:uppercase tw:tracking-[0.04em] tw:text-[#8793a9]">{input.label}</span>
      <strong
        className={cn(
          'tw:mt-1 tw:block tw:truncate tw:text-[13px] tw:font-medium tw:text-[#101d3b]',
          input.tone && 'tw:inline-flex tw:max-w-full tw:items-center tw:justify-center tw:rounded-full tw:border tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold',
          input.tone ? toneSurfaceClasses[input.tone] : undefined,
        )}
      >
        {input.value}
      </strong>
    </div>
  )
}

function SourceLink(input: {
  to: string
  label: string
  variant?: 'primary' | 'secondary'
}) {
  const safePath = getSafeInAppPath(input.to)
  if (!safePath) {
    return null
  }

  const variant = input.variant ?? 'primary'

  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      className={cn(
        variant === 'primary'
          ? softPlumActionClass
          : 'store-command-muted-action hover:tw:bg-white',
      )}
    >
      <Link to={safePath}>
        {input.label}
        <ArrowRight data-icon="inline-end" />
      </Link>
    </Button>
  )
}

function renderFamilyIcon(family: WorkbenchRowFamily) {
  switch (family) {
    case 'checklist':
      return <ClipboardList className="tw:size-4" />
    case 'projection':
      return <TrendingDown className="tw:size-4" />
    case 'targets':
      return <Target className="tw:size-4" />
    default:
      return <Store className="tw:size-4" />
  }
}

const toneSurfaceClasses: Record<StoreSurfaceTone, string> = {
  accent: 'tw:border-[#10adc5]/25 tw:bg-[#e6fbff] tw:text-[#08798d]',
  amber: 'tw:border-chart-4/30 tw:bg-chart-4/15 tw:text-chart-4',
  calm: 'tw:border-[#10b981]/25 tw:bg-[#e8fbf3] tw:text-[#06784e]',
  cyan: 'tw:border-accent/25 tw:bg-accent/10 tw:text-accent',
  danger: 'tw:border-[#ef426f]/25 tw:bg-[#ffe8ef] tw:text-[#d6244f]',
  mint: 'tw:border-emerald-500/20 tw:bg-emerald-500/10 tw:text-emerald-700',
  neutral: 'tw:border-[#dbe5f2] tw:bg-white/80 tw:text-[#071631]',
  plum: 'tw:border-primary/20 tw:bg-primary/10 tw:text-primary',
  warning: 'tw:border-[#f59e0b]/25 tw:bg-[#fff4df] tw:text-[#925900]',
}

const softPlumActionClass = 'store-command-soft-action'

const summaryIconClasses: Record<StoreSurfaceTone, string> = {
  accent: 'tw:border-[#10adc5]/25 tw:bg-[#e6fbff] tw:text-[#08798d]',
  amber: 'tw:border-chart-4/30 tw:bg-chart-4/15 tw:text-chart-4',
  calm: 'tw:border-[#10b981]/25 tw:bg-[#e8fbf3] tw:text-[#06784e]',
  cyan: 'tw:border-accent/25 tw:bg-accent/10 tw:text-accent',
  danger: 'tw:border-[#ef426f]/25 tw:bg-[#ffe8ef] tw:text-[#d6244f]',
  mint: 'tw:border-emerald-500/20 tw:bg-emerald-500/10 tw:text-emerald-700',
  neutral: 'tw:border-[#6847f5]/20 tw:bg-[#eee9ff] tw:text-[#5a37df]',
  plum: 'tw:border-primary/20 tw:bg-primary/10 tw:text-primary',
  warning: 'tw:border-[#f59e0b]/25 tw:bg-[#fff4df] tw:text-[#925900]',
}

const summaryBadgeClasses: Record<StoreSurfaceTone, string> = {
  accent: 'tw:border-[#10adc5]/25 tw:bg-[#e6fbff] tw:text-[#08798d]',
  amber: 'tw:border-chart-4/30 tw:bg-chart-4/15 tw:text-chart-4',
  calm: 'tw:border-[#10b981]/25 tw:bg-[#e8fbf3] tw:text-[#06784e]',
  cyan: 'tw:border-accent/25 tw:bg-accent/10 tw:text-accent',
  danger: 'tw:border-[#ef426f]/25 tw:bg-[#ffe8ef] tw:text-[#d6244f]',
  mint: 'tw:border-emerald-500/20 tw:bg-emerald-500/10 tw:text-emerald-700',
  neutral: 'tw:border-[#dbe5f2] tw:bg-[#eef2f8] tw:text-[#62708a]',
  plum: 'tw:border-primary/20 tw:bg-primary/10 tw:text-primary',
  warning: 'tw:border-[#f59e0b]/25 tw:bg-[#fff4df] tw:text-[#925900]',
}

const rowAccentClasses: Record<StoreSurfaceTone, string> = {
  accent: 'tw:bg-[#10adc5]',
  amber: 'tw:bg-chart-4',
  calm: 'tw:bg-[#10b981]',
  cyan: 'tw:bg-accent',
  danger: 'tw:bg-[#ef426f]',
  mint: 'tw:bg-emerald-500',
  neutral: 'tw:bg-[#dbe5f2]',
  plum: 'tw:bg-primary',
  warning: 'tw:bg-[#f59e0b]',
}

const rowBackgroundClasses: Record<StoreSurfaceTone, string> = {
  accent: 'tw:bg-[linear-gradient(90deg,rgba(16,173,197,0.07),rgba(255,255,255,0.62)_42%)]',
  amber: 'tw:bg-chart-4/10',
  calm: 'tw:bg-white/60',
  cyan: 'tw:bg-accent/5',
  danger: 'tw:bg-[linear-gradient(90deg,rgba(239,66,111,0.08),rgba(255,255,255,0.62)_42%)]',
  mint: 'tw:bg-emerald-500/5',
  neutral: 'tw:bg-white/60',
  plum: 'tw:bg-primary/5',
  warning: 'tw:bg-[linear-gradient(90deg,rgba(245,158,11,0.08),rgba(255,255,255,0.62)_42%)]',
}
