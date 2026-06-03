import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Eye, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDateTime, getErrorMessage } from '../../lib/format'
import type { AppLocale } from '../../lib/i18n'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import { cn } from '../../lib/utils'
import {
  StoreEmptyState,
  StoreErrorState,
  type StoreSurfaceTone,
} from '../../pages/store-surface-primitives'
import type { TranslateFunction } from '../localization/dictionary'
import {
  getStoreActionPlan,
  type StoreActionPlan,
} from '../store-actions/api'
import {
  formatActionPlanDate,
  formatOptionalDateTime,
  formatOptionalValue,
  formatStoreActionPlanPriority,
  formatStoreActionPlanSource,
  formatStoreActionPlanStatus,
  getSafeInAppPath,
  mapStoreActionPlanPriorityTone,
  mapStoreActionPlanStatusTone,
} from './store-tasks-workbench-model'
import { StoreActionPlanCommandPanel } from './StoreActionPlanCommandPanel'

export function StoreActionPlanDetailDialog(input: {
  plan: StoreActionPlan
  canMutate: boolean
  locale: AppLocale
  t: TranslateFunction
}) {
  const [isOpen, setIsOpen] = useState(false)
  const detailQuery = useQuery({
    queryKey: ['store-action-plans', 'store-tasks', 'detail', input.plan.actionPlanId],
    queryFn: () => getStoreActionPlan({ actionPlanId: input.plan.actionPlanId }),
    enabled: isOpen,
    ...transientQueryRetryOptions,
  })
  const plan = detailQuery.data?.data?.plan ?? input.plan
  const sourcePath = plan.sourceDeepLink ? getSafeInAppPath(plan.sourceDeepLink) : null

  return (
    <>
      <Button type="button" size="sm" onClick={() => setIsOpen(true)}>
        <Eye data-icon="inline-start" />
        {input.t('storeTasks.actionPlansDetailAction')}
      </Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          aria-label={input.t('storeTasks.actionPlansDetailRegion')}
          className="tw:max-h-[min(760px,calc(100dvh-2rem))] tw:max-w-3xl tw:overflow-y-auto tw:p-0"
        >
          <div className="tw:border-b tw:border-border/70 tw:bg-muted/25 tw:p-5">
            <DialogHeader>
              <DialogTitle className="tw:text-xl tw:font-semibold">{plan.title}</DialogTitle>
              <DialogDescription>{plan.summary ?? input.t('storeTasks.actionPlansNoSummary')}</DialogDescription>
            </DialogHeader>
          </div>
          <div className="tw:grid tw:gap-4 tw:p-5">
            {detailQuery.isLoading ? (
              <StoreEmptyState
                title={input.t('storeTasks.actionPlansDetailLoadingTitle')}
                description={input.t('storeTasks.actionPlansDetailLoadingCopy')}
              />
            ) : null}
            {detailQuery.isError ? (
              <StoreErrorState
                title={input.t('storeTasks.actionPlansDetailErrorTitle')}
                description={getErrorMessage(detailQuery.error)}
                action={{
                  disabled: detailQuery.isFetching,
                  icon: <RefreshCw data-icon="inline-start" />,
                  label: input.t('storeTasks.retryAction'),
                  onClick: () => void detailQuery.refetch(),
                  variant: 'outline',
                }}
              />
            ) : null}
            {!detailQuery.isError ? (
              <>
                <section className="tw:grid tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-background/70 tw:p-4">
                  <div className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
                    <h3 className="tw:text-sm tw:font-semibold tw:text-foreground">
                      {input.t('storeTasks.actionPlansEvidenceSnapshot')}
                    </h3>
                    {sourcePath ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to={sourcePath}>
                          {input.t('storeTasks.actionPlansOpenSource')}
                          <ArrowRight data-icon="inline-end" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                  <div className="tw:grid tw:gap-2 tw:sm:grid-cols-2 tw:lg:grid-cols-3">
                    <MiniFact label={input.t('storeTasks.actionPlansStore')} value={plan.storeId} />
                    <MiniFact label={input.t('storeTasks.actionPlansSource')} value={formatStoreActionPlanSource(input.t, plan.sourceType)} />
                    <MiniFact label={input.t('storeTasks.actionPlansDueOn')} value={formatActionPlanDate(plan.dueOn, input.locale)} />
                    <MiniFact label={input.t('storeTasks.status')} value={formatStoreActionPlanStatus(input.t, plan.status)} tone={mapStoreActionPlanStatusTone(plan.status)} />
                    <MiniFact label={input.t('storeTasks.priority')} value={formatStoreActionPlanPriority(input.t, plan.priority)} tone={mapStoreActionPlanPriorityTone(plan.priority)} />
                    <MiniFact label={input.t('storeTasks.actionPlansUpdatedAt')} value={formatDateTime(plan.updatedAt, input.locale)} />
                  </div>
                </section>
                <section className="tw:grid tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-card tw:p-4">
                  <h3 className="tw:text-sm tw:font-semibold tw:text-foreground">
                    {input.t('storeTasks.actionPlansLifecycleSnapshot')}
                  </h3>
                  <div className="tw:grid tw:gap-2 tw:sm:grid-cols-2">
                    <DetailLine label={input.t('storeTasks.actionPlansCreatedAt')} value={formatDateTime(plan.createdAt, input.locale)} />
                    <DetailLine label={input.t('storeTasks.actionPlansClosedAt')} value={formatOptionalDateTime(plan.closedAt, input.locale, input.t)} />
                    <DetailLine label={input.t('storeTasks.actionPlansCancelledAt')} value={formatOptionalDateTime(plan.cancelledAt, input.locale, input.t)} />
                    <DetailLine label={input.t('storeTasks.actionPlansResolutionEvidence')} value={formatOptionalValue(plan.resolutionNote, input.t)} />
                    <DetailLine label={input.t('storeTasks.actionPlansCancelEvidence')} value={formatOptionalValue(plan.cancelReason, input.t)} />
                  </div>
                </section>
                <section className="tw:grid tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-muted/25 tw:p-4">
                  <h3 className="tw:text-sm tw:font-semibold tw:text-foreground">
                    {input.t('storeTasks.actionPlansAuditTrace')}
                  </h3>
                  <div className="tw:grid tw:gap-2 tw:sm:grid-cols-2">
                    <DetailLine label={input.t('storeTasks.actionPlansOwner')} value={plan.ownerUserId} muted />
                    <DetailLine label={input.t('storeTasks.actionPlansCreatedBy')} value={plan.createdByUserId} muted />
                    <DetailLine label={input.t('storeTasks.actionPlansSourceId')} value={plan.sourceId} muted />
                    <DetailLine label={input.t('storeTasks.actionPlansSourceSnapshot')} value={formatOptionalValue(plan.sourceSnapshotRunId, input.t)} muted />
                    <DetailLine label={input.t('storeTasks.actionPlansSourceKpi')} value={formatOptionalValue(plan.sourceKpiId, input.t)} muted />
                  </div>
                </section>
              </>
            ) : null}
            {input.canMutate ? <StoreActionPlanCommandPanel plan={plan} t={input.t} /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
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

function DetailLine(input: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="tw:min-w-0">
      <span className="tw:block tw:text-xs tw:font-medium tw:text-muted-foreground">{input.label}</span>
      <strong
        className={cn(
          'tw:mt-1 tw:block tw:break-words tw:text-sm tw:font-semibold',
          input.muted ? 'tw:text-muted-foreground' : 'tw:text-foreground',
        )}
      >
        {input.value}
      </strong>
    </div>
  )
}

const toneSurfaceClasses: Record<StoreSurfaceTone, string> = {
  accent: 'tw:border-primary/20 tw:bg-primary/5 tw:text-primary',
  calm: 'tw:border-accent/25 tw:bg-accent/10 tw:text-accent-foreground',
  danger: 'tw:border-destructive/20 tw:bg-destructive/10 tw:text-destructive',
  neutral: 'tw:border-border tw:bg-card/80 tw:text-foreground',
  warning: 'tw:border-chart-4/30 tw:bg-chart-4/10 tw:text-foreground',
}
