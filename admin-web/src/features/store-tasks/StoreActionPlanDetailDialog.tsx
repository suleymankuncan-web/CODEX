import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CheckCircle2, ClipboardList, RefreshCw } from 'lucide-react'
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
  storeName?: string
  canMutate: boolean
  locale: AppLocale
  t: TranslateFunction
  triggerLabel?: string
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
  const planTone = mapStoreActionPlanStatusTone(plan.status)
  const providedStoreName = input.storeName?.trim()
  const displayStoreName = providedStoreName && providedStoreName !== plan.storeId
    ? providedStoreName
    : input.t('storeTasks.actionPlansNotAvailable')

  return (
    <>
      <Button
        type="button"
        size="sm"
        className="tw:border-0 tw:bg-gradient-to-br tw:from-[#6847f5] tw:to-[#4f7cf7] tw:text-white tw:shadow-[0_15px_30px_rgba(84,75,224,0.22)] hover:tw:text-white"
        onClick={() => setIsOpen(true)}
      >
        {input.triggerLabel ?? input.t('storeTasks.actionPlansDetailAction')}
        <ArrowRight data-icon="inline-end" />
      </Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          aria-label={input.t('storeTasks.actionPlansDetailRegion')}
          className="tw:top-auto tw:bottom-0 tw:left-0 tw:max-h-[calc(100dvh-0.75rem)] tw:max-w-full tw:translate-x-0 tw:translate-y-0 tw:overflow-hidden tw:rounded-b-none tw:rounded-t-2xl tw:p-0 tw:sm:top-1/2 tw:sm:bottom-auto tw:sm:left-1/2 tw:sm:max-h-[min(760px,calc(100dvh-2rem))] tw:sm:max-w-4xl tw:sm:-translate-x-1/2 tw:sm:-translate-y-1/2 tw:sm:rounded-2xl"
        >
          <div className="tw:flex tw:max-h-[calc(100dvh-0.75rem)] tw:flex-col tw:sm:max-h-[min(760px,calc(100dvh-2rem))]">
          <div className="tw:border-b tw:border-[#dbe5f2] tw:bg-white/90 tw:p-4 tw:pr-14 tw:sm:p-[1.125rem]">
            <DialogHeader className="tw:flex-row tw:items-start tw:gap-3 tw:space-y-0">
              <span className={cn('tw:flex tw:size-11 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:border', toneSurfaceClasses[planTone])}>
                <ClipboardList className="tw:size-5" />
              </span>
              <div className="tw:min-w-0">
                <DialogTitle className="tw:text-xl tw:font-semibold tw:leading-tight tw:text-[#071631]">{plan.title}</DialogTitle>
                <DialogDescription className="tw:mt-1 tw:text-[#62708a]">{plan.summary ?? input.t('storeTasks.actionPlansNoSummary')}</DialogDescription>
              </div>
            </DialogHeader>
          </div>
          <div className="tw:grid tw:gap-4 tw:overflow-y-auto tw:p-4 tw:sm:p-5">
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
                <div className="tw:grid tw:gap-2 tw:sm:grid-cols-2 tw:lg:grid-cols-4">
                  <MiniFact label={input.t('storeTasks.actionPlansStore')} value={displayStoreName} />
                  <MiniFact label={input.t('storeTasks.actionPlansSource')} value={formatStoreActionPlanSource(input.t, plan.sourceType)} />
                  <MiniFact label={input.t('storeTasks.status')} value={formatStoreActionPlanStatus(input.t, plan.status)} tone={mapStoreActionPlanStatusTone(plan.status)} />
                  <MiniFact label={input.t('storeTasks.actionPlansDueOn')} value={formatActionPlanDate(plan.dueOn, input.locale)} />
                </div>
                <div className="tw:grid tw:gap-3 tw:lg:grid-cols-[minmax(0,1.04fr)_minmax(18rem,0.96fr)]">
                  <section className="tw:rounded-[1.125rem] tw:border tw:border-[#dbe5f2] tw:bg-white/72 tw:p-3.5">
                    <h3 className="tw:mb-2.5 tw:text-sm tw:font-semibold tw:text-[#071631]">
                      {input.t('storeTasks.actionPlansWhyTitle')}
                    </h3>
                    <div className="tw:grid tw:gap-2">
                      <EvidenceRow
                        label={input.t('storeTasks.actionPlansSource')}
                        value={formatStoreActionPlanSource(input.t, plan.sourceType)}
                        tone={planTone}
                        t={input.t}
                      />
                      <EvidenceRow
                        label={input.t('storeTasks.actionPlansTriggerEvidence')}
                        value={plan.summary ?? input.t('storeTasks.actionPlansNoSummary')}
                        tone={planTone}
                        t={input.t}
                      />
                      <EvidenceRow
                        label={input.t('storeTasks.priority')}
                        value={formatStoreActionPlanPriority(input.t, plan.priority)}
                        tone={mapStoreActionPlanPriorityTone(plan.priority)}
                        t={input.t}
                      />
                    </div>
                  </section>
                  <section className="tw:rounded-[1.125rem] tw:border tw:border-[#dbe5f2] tw:bg-white/72 tw:p-3.5">
                    <h3 className="tw:mb-2.5 tw:text-sm tw:font-semibold tw:text-[#071631]">
                      {input.canMutate
                        ? input.t('storeTasks.actionPlansStoreActionTitle')
                        : input.t('storeTasks.actionPlansRegionViewTitle')}
                    </h3>
                    {input.canMutate ? (
                      <StoreActionPlanCommandPanel plan={plan} t={input.t} />
                    ) : (
                      <div className="tw:rounded-xl tw:border tw:border-[#dbe5f2] tw:bg-[#f8fbff] tw:p-3 tw:text-sm tw:leading-6 tw:text-[#62708a]">
                        {input.t('storeTasks.actionPlansRegionViewCopy')}
                      </div>
                    )}
                  </section>
                  <section className="tw:rounded-[1.125rem] tw:border tw:border-[#dbe5f2] tw:bg-white/72 tw:p-3.5">
                    <h3 className="tw:mb-2.5 tw:text-sm tw:font-semibold tw:text-[#071631]">
                      {input.t('storeTasks.actionPlansTimelineTitle')}
                    </h3>
                    <div className="tw:grid tw:gap-2">
                      <TimelineLine label={input.t('storeTasks.actionPlansCreatedAt')} value={formatDateTime(plan.createdAt, input.locale)} />
                      <TimelineLine label={input.t('storeTasks.actionPlansUpdatedAt')} value={formatDateTime(plan.updatedAt, input.locale)} />
                      {plan.closedAt ? <TimelineLine label={input.t('storeTasks.actionPlansClosedAt')} value={formatDateTime(plan.closedAt, input.locale)} /> : null}
                      {plan.cancelledAt ? <TimelineLine label={input.t('storeTasks.actionPlansCancelledAt')} value={formatDateTime(plan.cancelledAt, input.locale)} /> : null}
                    </div>
                  </section>
                  <section className="tw:rounded-[1.125rem] tw:border tw:border-[#dbe5f2] tw:bg-white/72 tw:p-3.5">
                    <h3 className="tw:mb-2.5 tw:text-sm tw:font-semibold tw:text-[#071631]">
                      {input.t('storeTasks.actionPlansResolutionEvidence')}
                    </h3>
                    <div className="tw:grid tw:gap-2">
                      <DetailLine label={input.t('storeTasks.actionPlansResolutionEvidence')} value={formatOptionalValue(plan.resolutionNote, input.t)} />
                      <DetailLine label={input.t('storeTasks.actionPlansCancelEvidence')} value={formatOptionalValue(plan.cancelReason, input.t)} />
                    </div>
                  </section>
                </div>
                <footer className="tw:flex tw:flex-col tw:gap-2 tw:border-t tw:border-[#dbe5f2] tw:pt-3 tw:text-xs tw:text-[#62708a] tw:sm:flex-row tw:sm:items-center tw:sm:justify-between">
                  <span>{input.t('storeTasks.actionPlansDetailFootnote')}</span>
                  {sourcePath ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to={sourcePath}>
                        {input.t('storeTasks.actionPlansOpenSource')}
                        <ArrowRight data-icon="inline-end" />
                      </Link>
                    </Button>
                  ) : null}
                </footer>
              </>
            ) : null}
            {detailQuery.isError && input.canMutate ? <StoreActionPlanCommandPanel plan={plan} t={input.t} /> : null}
          </div>
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
    <div className={cn('tw:min-h-14 tw:rounded-xl tw:border tw:p-2.5', input.tone ? toneSurfaceClasses[input.tone] : 'tw:border-[#dbe5f2] tw:bg-white/80')}>
      <span className="tw:block tw:text-[0.68rem] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-[#8793a9]">{input.label}</span>
      <strong className="tw:mt-1 tw:block tw:break-words tw:text-sm tw:font-semibold tw:text-[#071631]">{input.value}</strong>
    </div>
  )
}

function EvidenceRow(input: {
  label: string
  value: string
  tone: StoreSurfaceTone
  t: TranslateFunction
}) {
  return (
    <div className="tw:grid tw:grid-cols-[minmax(0,1fr)_auto] tw:gap-3 tw:rounded-xl tw:border tw:border-[#dbe5f2] tw:bg-[#f8fbff] tw:p-3">
      <div className="tw:min-w-0">
        <span className="tw:block tw:text-[0.68rem] tw:font-medium tw:text-[#62708a]">{input.label}</span>
        <strong className="tw:mt-1 tw:block tw:break-words tw:text-sm tw:font-semibold tw:text-[#071631]">{input.value}</strong>
      </div>
      <span className={cn('tw:inline-flex tw:h-7 tw:items-center tw:justify-center tw:rounded-full tw:border tw:px-2.5 tw:text-xs tw:font-semibold', toneSurfaceClasses[input.tone])}>
        {input.t('storeTasks.actionPlansEvidenceClear')}
      </span>
    </div>
  )
}

function TimelineLine(input: {
  label: string
  value: string
}) {
  return (
    <div className="tw:grid tw:grid-cols-[1.25rem_minmax(0,1fr)] tw:gap-2">
      <span className="tw:mt-0.5 tw:flex tw:size-5 tw:items-center tw:justify-center tw:rounded-full tw:border tw:border-[#6847f5]/25 tw:bg-[#eee9ff] tw:text-[#5a37df]">
        <CheckCircle2 className="tw:size-3" />
      </span>
      <div className="tw:min-w-0">
        <strong className="tw:block tw:text-sm tw:font-semibold tw:text-[#071631]">{input.label}</strong>
        <span className="tw:block tw:text-xs tw:text-[#62708a]">{input.value}</span>
      </div>
    </div>
  )
}

function DetailLine(input: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="tw:grid tw:min-w-0 tw:grid-cols-[8rem_minmax(0,1fr)] tw:gap-3 tw:border-b tw:border-[#dbe5f2]/80 tw:pb-2 last:tw:border-b-0 last:tw:pb-0">
      <span className="tw:text-xs tw:font-medium tw:text-[#62708a]">{input.label}</span>
      <strong
        className={cn(
          'tw:block tw:break-words tw:text-sm tw:font-semibold',
          input.muted ? 'tw:text-[#62708a]' : 'tw:text-[#071631]',
        )}
      >
        {input.value}
      </strong>
    </div>
  )
}

const toneSurfaceClasses: Record<StoreSurfaceTone, string> = {
  accent: 'tw:border-[#10adc5]/25 tw:bg-[#e6fbff] tw:text-[#08798d]',
  calm: 'tw:border-[#10b981]/25 tw:bg-[#e8fbf3] tw:text-[#06784e]',
  danger: 'tw:border-[#ef426f]/25 tw:bg-[#ffe8ef] tw:text-[#d6244f]',
  neutral: 'tw:border-[#dbe5f2] tw:bg-white/80 tw:text-[#071631]',
  warning: 'tw:border-[#f59e0b]/25 tw:bg-[#fff4df] tw:text-[#925900]',
}
