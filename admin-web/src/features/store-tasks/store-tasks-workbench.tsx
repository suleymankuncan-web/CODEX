import { useState, type ReactNode } from 'react'
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ClipboardList,
  Eye,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AuthSessionSummary } from '../auth/api'
import type { TranslateFunction } from '../localization/dictionary'
import { StoreActionPlanCreateControl } from '../store-actions/StoreActionPlanCreateControl'
import { WorkflowInboxDetail } from '../workflow/WorkflowInboxDetail'
import type { WorkflowInboxItem } from '../workflow/contracts'
import { formatDateTime, getErrorMessage } from '../../lib/format'
import type { AppLocale } from '../../lib/i18n'
import { cn } from '../../lib/utils'
import {
  StoreEmptyState,
  StoreStatusBadge,
  type StoreSurfaceTone,
} from '../../pages/store-surface-primitives'
import {
  formatActorRoleLabel,
  formatDisplayRoleLabels,
  formatWorkflowItemTypeLabel,
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
  summary: WorkbenchSummary
  primaryStoreId: string
  roleLabel: string
  t: TranslateFunction
}) {
  const isRegion = input.persona === 'regionManager'
  return (
    <header className="tw:overflow-hidden tw:rounded-2xl tw:border tw:border-border/80 tw:bg-card/85 tw:shadow-sm">
      <div className="tw:grid tw:gap-4 tw:p-4 tw:lg:grid-cols-[minmax(0,1fr)_auto] tw:lg:items-center">
        <div className="tw:min-w-0">
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            <Badge variant="outline" className="tw:border-primary/20 tw:bg-primary/5 tw:text-primary">
              {isRegion ? input.t('storeTasks.regionScopePill') : input.t('storeTasks.storeScopePill')}
            </Badge>
            <Badge variant="secondary">{input.roleLabel}</Badge>
          </div>
          <h1 className="tw:mt-3 tw:max-w-4xl tw:text-2xl tw:font-semibold tw:leading-tight tw:text-foreground tw:md:text-3xl">
            {isRegion ? input.t('storeTasks.titleRegion') : input.t('storeTasks.titleStore')}
          </h1>
          <p className="tw:mt-2 tw:max-w-3xl tw:text-sm tw:leading-6 tw:text-muted-foreground">
            {isRegion ? input.t('storeTasks.heroCopyRegion') : input.t('storeTasks.heroCopyStore')}
          </p>
        </div>
        <div className="tw:grid tw:w-full tw:min-w-0 tw:grid-cols-3 tw:gap-2 tw:lg:w-[28rem]">
          <HeaderStat label={input.t('storeTasks.pendingActions')} value={input.summary.pending} tone="warning" />
          <HeaderStat label={input.t('storeTasks.checklistCount')} value={input.summary.checklist} tone="danger" />
          <HeaderStat label={input.t('storeTasks.storeScope')} value={input.primaryStoreId} tone="accent" compact />
        </div>
      </div>
    </header>
  )
}

function HeaderStat(input: {
  label: string
  value: string | number
  tone: StoreSurfaceTone
  compact?: boolean
}) {
  return (
    <div className={cn('tw:min-w-0 tw:rounded-xl tw:border tw:p-3', toneSurfaceClasses[input.tone])}>
      <span className="tw:block tw:text-[0.72rem] tw:font-medium tw:text-muted-foreground">{input.label}</span>
      <strong className={cn('tw:mt-1 tw:block tw:font-semibold tw:text-foreground', input.compact ? 'tw:truncate tw:text-sm' : 'tw:text-xl')}>
        {input.value}
      </strong>
    </div>
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
      value: input.summary.pending,
      tone: input.summary.pending > 0 ? 'warning' : 'calm',
      icon: <Bell className="tw:size-4" />,
    },
    {
      label: input.t('storeTasks.checklistCount'),
      value: input.summary.checklist,
      tone: input.summary.checklist > 0 ? 'danger' : 'neutral',
      icon: <ListChecks className="tw:size-4" />,
    },
    {
      label: input.t('storeTasks.projectionCount'),
      value: input.summary.projection,
      tone: input.summary.projection > 0 ? 'warning' : 'neutral',
      icon: <TrendingDown className="tw:size-4" />,
    },
    {
      label: input.t('storeTasks.reportedResolvedMetric'),
      value: input.summary.reported,
      tone: input.summary.reported > 0 ? 'calm' : 'neutral',
      icon: <CheckCircle2 className="tw:size-4" />,
    },
  ] as const

  return (
    <section className="tw:grid tw:gap-3 tw:md:grid-cols-2 tw:xl:grid-cols-4" aria-label={input.t('storeTasks.summaryRegion')}>
      {cards.map((card) => (
        <Card key={card.label} className={cn('tw:min-h-28 tw:border-border/80 tw:bg-card/85 tw:shadow-sm', toneSurfaceClasses[card.tone])}>
          <CardContent className="tw:flex tw:h-full tw:items-center tw:gap-3 tw:p-4">
            <span className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:bg-background/85 tw:text-primary">
              {card.icon}
            </span>
            <div className="tw:min-w-0">
              <span className="tw:block tw:text-xs tw:font-medium tw:text-muted-foreground">{card.label}</span>
              <strong className="tw:mt-1 tw:block tw:text-2xl tw:font-semibold tw:leading-none tw:text-foreground">
                {card.value}
              </strong>
            </div>
          </CardContent>
        </Card>
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
    <div className="tw:grid tw:grid-cols-2 tw:gap-px tw:border-t tw:border-border/70 tw:bg-border/60 tw:md:grid-cols-5">
      {input.tabs.map((tab) => {
        const active = input.activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            className={cn(
              'tw:flex tw:min-h-12 tw:items-center tw:justify-center tw:gap-2 tw:border-0 tw:bg-card tw:px-3 tw:text-sm tw:font-medium tw:text-muted-foreground tw:transition-colors',
              tab.id === 'closed' && 'tw:col-span-2 tw:md:col-span-1',
              active && 'tw:bg-primary/5 tw:text-primary tw:ring-1 tw:ring-inset tw:ring-primary/20',
            )}
            aria-pressed={active}
            onClick={() => input.onTabChange(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <Badge variant={active ? 'default' : 'secondary'} className="tw:h-5 tw:min-w-5 tw:px-1.5 tw:text-[0.7rem]">
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
      <div className="tw:divide-y tw:divide-border/70">
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
  const planSourcePath = plan?.sourceDeepLink ? getSafeInAppPath(plan.sourceDeepLink) : null
  return (
    <article
      data-testid={input.row.source === 'plan' ? 'store-action-plan-row' : 'store-task-queue-row'}
      className={cn(
        'tw:grid tw:gap-3 tw:p-4 tw:transition-colors tw:hover:bg-muted/25',
        input.row.tone === 'danger' && 'tw:bg-destructive/5',
        input.row.tone === 'warning' && 'tw:bg-chart-4/5',
        input.row.tone === 'calm' && 'tw:bg-accent/5',
      )}
    >
      <div className="tw:flex tw:min-w-0 tw:gap-3">
        <span className={cn('tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:border', toneSurfaceClasses[input.row.tone])}>
          {renderFamilyIcon(input.row.family)}
        </span>
        <div className="tw:min-w-0">
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            <strong className="tw:block tw:max-w-full tw:truncate tw:text-sm tw:font-semibold tw:text-foreground">
              {input.row.storeName}
            </strong>
            <StoreStatusBadge tone={input.row.tone}>{input.row.sourceLabel}</StoreStatusBadge>
          </div>
          <span className="tw:mt-1 tw:block tw:truncate tw:text-xs tw:text-muted-foreground">{input.row.storeId}</span>
          <h3 className="tw:mt-2 tw:text-sm tw:font-medium tw:leading-snug tw:text-foreground">
            {input.row.title}
          </h3>
          <p className="tw:mt-1 tw:max-w-3xl tw:text-sm tw:leading-5 tw:text-muted-foreground">{input.row.summary}</p>
          {input.row.historyPreview ? (
            <p className="tw:mt-2 tw:max-w-3xl tw:rounded-lg tw:border tw:border-border/70 tw:bg-background/70 tw:px-2.5 tw:py-1.5 tw:text-xs tw:leading-5 tw:text-muted-foreground">
              {input.row.historyPreview}
            </p>
          ) : null}
        </div>
      </div>

      <div className="tw:grid tw:gap-3 tw:xl:grid-cols-[minmax(0,36rem)_minmax(18rem,1fr)] tw:xl:items-start">
        <div className="tw:grid tw:grid-cols-2 tw:gap-2 tw:sm:grid-cols-4">
          <MiniFact label={input.t('storeTasks.status')} value={input.row.statusLabel} tone={input.row.tone} />
          <MiniFact label={input.t('storeTasks.priority')} value={input.row.priorityLabel} tone={input.row.priorityTone} />
          <MiniFact label={input.t('storeTasks.actionPlansDueOn')} value={input.row.dueLabel} />
          <MiniFact label={input.t('storeTasks.evidenceLabel')} value={input.row.evidenceLabel} />
        </div>

        <div className="tw:flex tw:flex-wrap tw:items-start tw:gap-2 tw:xl:justify-end tw:xl:pr-36">
          {plan ? (
            <StoreActionPlanDetailDialog
              plan={plan}
              canMutate={canMutatePlan}
              locale={input.locale}
              t={input.t}
            />
          ) : null}
          {input.row.workflowItem ? (
            <WorkflowItemDetailDialog item={input.row.workflowItem} locale={input.locale} t={input.t} />
          ) : null}
          {planSourcePath ? (
            <Button asChild size="sm" variant="outline">
              <Link to={planSourcePath}>
                {input.t('storeTasks.actionPlansOpenSource')}
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          ) : plan ? (
            <span className="tw:rounded-full tw:bg-muted tw:px-2.5 tw:py-1 tw:text-xs tw:font-medium tw:text-muted-foreground">
              {input.t('storeTasks.actionPlansNoSourceLink')}
            </span>
          ) : null}
          {input.row.workflowItem ? (
            <SourceLink to={input.row.workflowItem.deepLink} label={formatWorkflowPrimaryActionLabel(input.t, input.row.workflowItem)} />
          ) : null}
          {input.row.candidate && input.persona === 'storeManager' ? (
            <StoreActionPlanCreateControl
              candidate={input.row.candidate}
              t={input.t}
              onCreated={input.onActionPlanCreated}
            />
          ) : null}
          {input.persona === 'regionManager' ? (
            <span className="tw:rounded-full tw:bg-muted tw:px-2.5 tw:py-1 tw:text-xs tw:font-medium tw:text-muted-foreground">
              {input.t('storeTasks.regionReadOnlyHint')}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function MiniFact(input: {
  label: string
  value: string
  tone?: StoreSurfaceTone
}) {
  return (
    <div className={cn('tw:min-h-14 tw:rounded-xl tw:border tw:p-2.5', input.tone ? toneSurfaceClasses[input.tone] : 'tw:border-border tw:bg-background/70')}>
      <span className="tw:block tw:text-[0.7rem] tw:font-medium tw:text-muted-foreground">{input.label}</span>
      <strong className="tw:mt-1 tw:block tw:text-sm tw:font-semibold tw:text-foreground">{input.value}</strong>
    </div>
  )
}

function SourceLink(input: {
  to: string
  label: string
}) {
  const safePath = getSafeInAppPath(input.to)
  if (!safePath) {
    return null
  }

  return (
    <Button asChild size="sm" variant="outline">
      <Link to={safePath}>
        {input.label}
        <ArrowRight data-icon="inline-end" />
      </Link>
    </Button>
  )
}

function WorkflowItemDetailDialog(input: {
  item: WorkflowInboxItem
  locale: AppLocale
  t: TranslateFunction
}) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <>
      <Button type="button" size="sm" onClick={() => setIsOpen(true)}>
        <Eye data-icon="inline-start" />
        {input.t('storeTasks.workflowDetailAction')}
      </Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          aria-label={input.t('storeTasks.workflowDetailRegion')}
          className="tw:max-h-[min(720px,calc(100dvh-2rem))] tw:max-w-2xl tw:overflow-y-auto tw:p-0"
        >
          <div className="tw:border-b tw:border-border/70 tw:bg-muted/25 tw:p-5">
            <DialogHeader>
              <DialogTitle className="tw:text-xl tw:font-semibold">{input.item.title}</DialogTitle>
              <DialogDescription>{input.item.summary}</DialogDescription>
            </DialogHeader>
          </div>
          <div className="tw:grid tw:gap-4 tw:p-5">
            <div className="tw:grid tw:gap-2 tw:sm:grid-cols-2">
              <MiniFact label={input.t('storeTasks.workType')} value={formatWorkflowItemTypeLabel(input.t, input.item.itemType)} />
              <MiniFact label={input.t('storeTasks.actorRole')} value={formatActorRoleLabel(input.t, input.item.actorRole)} />
              <MiniFact label={input.t('storeTasks.store')} value={input.item.storeName || input.item.storeId} />
              <MiniFact
                label={input.t('storeTasks.actionTime')}
                value={input.item.needsAttentionAt ? formatDateTime(input.item.needsAttentionAt, input.locale) : input.t('storeTasks.now')}
              />
            </div>
            {input.item.historyPreview ? (
              <div className="tw:rounded-xl tw:border tw:border-border tw:bg-background/70 tw:p-4 tw:text-sm tw:text-muted-foreground">
                {input.item.historyPreview}
              </div>
            ) : null}
            <WorkflowInboxDetail item={input.item} />
          </div>
        </DialogContent>
      </Dialog>
    </>
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
  accent: 'tw:border-primary/20 tw:bg-primary/5 tw:text-primary',
  calm: 'tw:border-accent/25 tw:bg-accent/10 tw:text-accent-foreground',
  danger: 'tw:border-destructive/20 tw:bg-destructive/10 tw:text-destructive',
  neutral: 'tw:border-border tw:bg-card/80 tw:text-foreground',
  warning: 'tw:border-chart-4/30 tw:bg-chart-4/10 tw:text-foreground',
}
