import { useState } from 'react'
import { type UseMutationResult } from '@tanstack/react-query'
import {
  CircleDollarSign,
  ClipboardCheck,
  Loader2,
  PencilLine,
  RefreshCw,
  Search,
  Send,
  Store,
  type LucideIcon,
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { normalizeDisplayLabel } from '../lib/display-labels'
import { useToastViewportOffset } from '../lib/toast-viewport'
import {
  type SalesTargetIncentiveProjection,
  type SalesTargetIncentiveResponse,
  type SalesTargetIncentiveRow,
  type StoreSalesTargetIncentiveCorrectionResponse,
  type StoreSalesTargetIncentivePackageResponse,
  type StoreSalesTargetIncentiveRegionCorrectionInput,
  type StoreSalesTargetIncentiveReviewInput,
  type StoreSalesTargetIncentiveReviewResponse,
  type StoreSalesTargetIncentiveSubmitPackageInput,
  type StoreSalesTargetIncentiveVoidCorrectionInput,
} from '../features/incentives/api'
import { useLocalization } from '../features/localization/useLocalization'
import {
  formatMoneyValue,
  getIncentivePositionLabel,
  getManagerRow,
  getPersonnelRows,
  toProgressPercent,
} from './store-incentives-model'
import { formatPeriodLabel } from './store-incentives-period-model'
import { PeriodPicker } from './store-incentives-period-picker'
import {
  canReviewProjection,
  getCorrectionLabel,
  getCorrectionTone,
  getRegionEffectiveEarnedAmount,
  getRegionSummary,
  getReviewState,
  isPackageLocked,
  isProjectionOnlyReview,
  matchesStoreFilter,
  type SelectedIncentiveRow,
  type StoreStatusFilter,
} from './store-incentives-region-manager-model'
import {
  formatAchievementState,
  formatIncentiveMoneyValue,
  formatSalesMoneyValue,
  formatTargetMoneyValue,
  getFinalChange,
  getStoreGateState,
  regionManagerPrimaryActionClass,
} from './store-incentives-region-manager-format'
import { IncentiveCorrectionSheet } from './store-incentives-region-manager-sheet'
import {
  StoreCommandPersonLink,
  StoreEmptyState,
  StoreStatusBadge,
  StoreSurfacePage,
} from './store-surface-primitives'

export function RegionManagerIncentivesView(input: {
  data: SalesTargetIncentiveResponse['data']
  locale: ReturnType<typeof useLocalization>['locale']
  selectedPeriod: string
  onPeriodChange: (period: string) => void
  onRefresh: () => void
  refreshing: boolean
  mutationState: {
    reviewMutation: UseMutationResult<
      StoreSalesTargetIncentiveReviewResponse,
      Error,
      StoreSalesTargetIncentiveReviewInput
    >
    correctionMutation: UseMutationResult<
      StoreSalesTargetIncentiveCorrectionResponse,
      Error,
      StoreSalesTargetIncentiveRegionCorrectionInput
    >
    voidCorrectionMutation: UseMutationResult<
      StoreSalesTargetIncentiveCorrectionResponse,
      Error,
      StoreSalesTargetIncentiveVoidCorrectionInput
    >
    submitPackageMutation: UseMutationResult<
      StoreSalesTargetIncentivePackageResponse,
      Error,
      StoreSalesTargetIncentiveSubmitPackageInput
    >
    pendingReviewStoreIds: ReadonlySet<string>
    pendingCorrectionKeys: ReadonlySet<string>
  }
}) {
  const { t } = useLocalization()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StoreStatusFilter>('all')
  const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null)
  const [selectedRowKey, setSelectedRowKey] = useState<{ storeId: string; employeeId: string } | null>(null)
  const [isSubmitDialogOpen, setSubmitDialogOpen] = useState(false)
  const selectedRow = selectedRowKey
    ? findSelectedIncentiveRow(input.data.projections, selectedRowKey)
    : null
  useToastViewportOffset(Boolean(selectedRow))

  const summary = getRegionSummary(input.data.projections)
  const workflow = input.data.regionWorkflow
  const visibleProjections = input.data.projections.filter((projection) =>
    matchesStoreFilter(projection, search, statusFilter),
  )
  const allStoresReviewed = summary.pendingReviewCount === 0
  const allStoresClosed = summary.projectionOnlyCount === 0
  const packageCanSubmit =
    Boolean(workflow?.regionId) &&
    allStoresReviewed &&
    allStoresClosed &&
    !isPackageLocked(workflow)
  const workflowLocked = isPackageLocked(workflow)

  return (
    <StoreSurfacePage
      ariaLabel={t('storeIncentives.regionManagerAria')}
      className="tw:max-w-[1240px] tw:gap-3"
      testId="store-incentives-page"
    >
      <section className="tw:rounded-[1.5rem] tw:border tw:border-border/80 tw:bg-[radial-gradient(circle_at_82%_8%,color-mix(in_oklab,var(--accent)_14%,transparent),transparent_32%),radial-gradient(circle_at_14%_10%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_30%),color-mix(in_oklab,var(--card)_88%,transparent)] tw:p-4 tw:shadow-[0_18px_48px_color-mix(in_oklab,var(--foreground)_8%,transparent)]">
        <div className="tw:flex tw:flex-col tw:gap-4 tw:lg:flex-row tw:lg:items-center tw:lg:justify-between">
          <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
            <span className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-[1rem] tw:border tw:border-primary/20 tw:bg-gradient-to-br tw:from-primary/10 tw:to-accent/10 tw:text-primary">
              <CircleDollarSign size={22} strokeWidth={1.8} />
            </span>
            <h1 className="tw:text-[clamp(1.45rem,2.8vw,2.1rem)] tw:font-semibold tw:leading-none tw:tracking-[-0.015em] tw:text-foreground">
              Prim Kontrol Sayfası
            </h1>
          </div>

          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            <PeriodPicker
              period={input.selectedPeriod}
              onChange={input.onPeriodChange}
              triggerClassName="tw:h-9 tw:min-w-[10.5rem] tw:rounded-2xl tw:bg-background/80 tw:px-3 tw:font-semibold tw:shadow-sm"
            />
            <Button
              className={cn(regionManagerPrimaryActionClass, 'tw:h-9')}
              type="button"
              disabled={!packageCanSubmit || input.mutationState.submitPackageMutation.isPending}
              onClick={() => setSubmitDialogOpen(true)}
            >
              <Send data-icon="inline-start" />
              {workflow?.regionPackageStatus === 'admin_returned'
                ? t('storeIncentives.regionManagerResubmit')
                : t('storeIncentives.regionManagerSubmit')}
            </Button>
          </div>
        </div>

        <div
          aria-label={t('storeIncentives.regionManagerSummaryAria')}
          className="tw:mt-4 tw:grid tw:gap-3 tw:md:grid-cols-2 tw:xl:grid-cols-4"
        >
          <RegionSignalCard
            icon={CircleDollarSign}
            title="Dönem toplamı"
            value={formatMoneyValue(summary.payableTotal, input.locale)}
          />
          <RegionSignalCard
            icon={Store}
            title="Kontrol bekleyen"
            value={summary.pendingReviewCount}
          />
          <RegionSignalCard
            icon={PencilLine}
            title="Düzeltme"
            value={summary.correctionCount}
          />
          <RegionSignalCard
            icon={ClipboardCheck}
            title="Mağaza kontrolü"
            value={`${summary.reviewedStoreCount}/${summary.storeCount}`}
          />
        </div>
      </section>

      <section
        aria-label="Prim filtreleri"
        className="tw:rounded-[1.35rem] tw:border tw:border-border/80 tw:bg-card/85 tw:p-3.5 tw:shadow-[0_14px_34px_color-mix(in_oklab,var(--foreground)_8%,transparent)]"
      >
        <div className="tw:grid tw:gap-3 tw:lg:grid-cols-[minmax(18rem,1fr)_minmax(13rem,0.34fr)_auto]">
          <div className="tw:flex tw:h-11 tw:min-w-0 tw:items-center tw:gap-2 tw:rounded-xl tw:border tw:border-border/80 tw:bg-background/80 tw:px-3">
            <span className="tw:shrink-0 tw:text-xs tw:font-medium tw:text-muted-foreground">
              Mağaza ara
            </span>
            <InputGroup className="tw:h-9 tw:flex-1 tw:border-0 tw:bg-transparent tw:shadow-none">
              <InputGroupAddon className="tw:pl-0">
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                aria-label={t('storeIncentives.regionManagerSearchField')}
                className="tw:h-9 tw:px-0 tw:font-semibold"
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('storeIncentives.regionManagerSearchPlaceholder')}
                value={search}
              />
            </InputGroup>
          </div>

          <div className="tw:flex tw:h-11 tw:min-w-0 tw:items-center tw:gap-2 tw:rounded-xl tw:border tw:border-border/80 tw:bg-background/80 tw:px-3">
            <span className="tw:shrink-0 tw:text-xs tw:font-medium tw:text-muted-foreground">
              Durum
            </span>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StoreStatusFilter)}
            >
              <SelectTrigger aria-label={t('storeIncentives.regionManagerStatusField')} className="tw:h-9 tw:flex-1 tw:border-0 tw:bg-transparent tw:px-0 tw:font-semibold tw:shadow-none tw:focus:ring-0">
                <SelectValue placeholder={t('storeIncentives.regionManagerStatusPlaceholder')} />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  <SelectItem value="all">{t('storeIncentives.regionManagerStatusAll')}</SelectItem>
                  <SelectItem value="pending_review">{t('storeIncentives.regionManagerStatusPendingReview')}</SelectItem>
                  <SelectItem value="reviewed">{t('storeIncentives.regionManagerStatusReviewed')}</SelectItem>
                  <SelectItem value="earning">{t('storeIncentives.regionManagerStatusEarning')}</SelectItem>
                  <SelectItem value="no_earning">{t('storeIncentives.regionManagerStatusNoEarning')}</SelectItem>
                  <SelectItem value="corrected">{t('storeIncentives.regionManagerStatusCorrected')}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <Button
            className="tw:h-11 tw:rounded-xl tw:border-border/80 tw:bg-background/80 tw:px-3 tw:font-semibold tw:shadow-none tw:hover:bg-muted/60"
            type="button"
            variant="outline"
            disabled={input.refreshing}
            onClick={input.onRefresh}
          >
            <RefreshCw data-icon="inline-start" />
            {t('storeIncentives.regionManagerRefresh')}
          </Button>
        </div>
      </section>

      <section
        aria-label={t('storeIncentives.regionManagerStoresAria')}
        className="tw:rounded-[1.5rem] tw:border tw:border-border/80 tw:bg-card/85 tw:p-3.5 tw:shadow-[0_14px_34px_color-mix(in_oklab,var(--foreground)_8%,transparent)]"
      >
        {visibleProjections.length > 0 ? (
          <Accordion
            type="single"
            collapsible
            value={expandedStoreId ?? ''}
            onValueChange={(value) => setExpandedStoreId(value || null)}
            className="tw:grid tw:gap-3"
          >
            {visibleProjections.map((projection) => (
              <RegionStoreCard
                key={projection.storeId}
                locale={input.locale}
                onReviewChange={(reviewStatus) =>
                  input.mutationState.reviewMutation.mutate({
                    period: input.data.period,
                    storeId: projection.storeId,
                    reviewStatus,
                  })
                }
                onSelectRow={(row) => setSelectedRowKey({ storeId: projection.storeId, employeeId: row.employeeId })}
                projection={projection}
                pendingCorrectionKeys={input.mutationState.pendingCorrectionKeys}
                expanded={expandedStoreId === projection.storeId}
                reviewDisabled={workflowLocked || !canReviewProjection(projection)}
                reviewPending={input.mutationState.pendingReviewStoreIds.has(projection.storeId)}
              />
            ))}
          </Accordion>
        ) : (
          <StoreEmptyState description={t('storeIncentives.regionManagerNoStoreMatch')} />
        )}
      </section>

      <IncentiveCorrectionSheet
        correctionMutation={input.mutationState.correctionMutation}
        locale={input.locale}
        onOpenChange={(open) => {
          if (!open) setSelectedRowKey(null)
        }}
        period={input.data.period}
        selectedRow={selectedRow}
        voidCorrectionMutation={input.mutationState.voidCorrectionMutation}
        workflowLocked={workflowLocked}
      />

      <Dialog open={isSubmitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent className="tw:w-[calc(100vw-64px)] tw:max-w-[30rem] tw:overflow-hidden tw:p-0 tw:sm:max-w-[30rem]">
          <DialogHeader className="tw:border-b tw:border-border tw:bg-muted/20 tw:p-5">
            <div className="tw:flex tw:items-start tw:gap-3">
              <span className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-2xl tw:bg-primary/10 tw:text-primary">
                <Send size={18} />
              </span>
              <div>
                <DialogTitle>
                  {t('storeIncentives.regionManagerSubmitDialogTitle', { period: formatPeriodLabel(input.data.period) })}
                </DialogTitle>
                <DialogDescription className="tw:mt-1">
                  Kontrol edilen dönem paketi admin onayına gönderilecek.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="tw:grid tw:gap-3 tw:p-5">
            <div className="tw:rounded-2xl tw:border tw:border-border tw:bg-card tw:p-4">
              <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
                <span className="tw:text-sm tw:text-muted-foreground">{t('storeIncentives.regionManagerTotalTitle')}</span>
                <strong className="tw:text-xl tw:font-semibold tw:text-foreground">
                  {formatMoneyValue(summary.payableTotal, input.locale)}
                </strong>
              </div>
              <div className="tw:mt-4 tw:grid tw:gap-2">
                <DialogAmountLine
                  label={t('storeIncentives.regionManagerReviewedStores')}
                  value={`${summary.reviewedStoreCount}/${summary.storeCount}`}
                />
                <DialogAmountLine
                  label={t('storeIncentives.regionManagerCorrectionTitle')}
                  value={String(summary.correctionCount)}
                />
                <DialogAmountLine label="Gönderim tipi" value="Dönem paketi" />
              </div>
            </div>
            <div className="tw:rounded-2xl tw:border tw:border-border tw:bg-muted/30 tw:p-4">
              <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
                <span className="tw:text-sm tw:font-medium tw:text-foreground">Kontrol ilerlemesi</span>
                <StoreStatusBadge tone={allStoresReviewed ? 'calm' : 'warning'}>
                  {allStoresReviewed ? 'Gönderime hazır' : `${summary.pendingReviewCount} mağaza bekliyor`}
                </StoreStatusBadge>
              </div>
              <Progress
                className="tw:mt-3"
                value={summary.storeCount > 0 ? (summary.reviewedStoreCount / summary.storeCount) * 100 : 0}
              />
              <p className="tw:mt-3 tw:text-xs tw:leading-5 tw:text-muted-foreground">
                Onaya gönderildiğinde paket dönem bazında tek kayıt olarak admin kontrolüne düşer.
              </p>
            </div>
          </div>
          <DialogFooter className="tw:mx-0 tw:mb-0 tw:flex-row tw:items-center tw:justify-end tw:border-t tw:border-border tw:bg-muted/20 tw:p-4">
            <Button type="button" variant="outline" onClick={() => setSubmitDialogOpen(false)}>
              {t('storeIncentives.regionManagerCancel')}
            </Button>
            <Button
              className={regionManagerPrimaryActionClass}
              type="button"
              disabled={!packageCanSubmit || input.mutationState.submitPackageMutation.isPending}
              onClick={() => {
                if (!workflow?.regionId) return
                input.mutationState.submitPackageMutation.mutate({
                  period: input.data.period,
                  regionId: workflow.regionId,
                })
                setSubmitDialogOpen(false)
              }}
            >
              <Send data-icon="inline-start" />
              {t('storeIncentives.regionManagerSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StoreSurfacePage>
  )
}

function RegionSignalCard(input: { icon: LucideIcon; title: string; value: string | number }) {
  const Icon = input.icon
  return (
    <article className="tw:grid tw:min-h-[76px] tw:grid-cols-[auto_1fr] tw:items-center tw:gap-3 tw:rounded-2xl tw:border tw:border-border/80 tw:bg-background/75 tw:p-3.5">
      <span className="tw:flex tw:size-10 tw:items-center tw:justify-center tw:rounded-xl tw:bg-primary/10 tw:text-primary">
        <Icon size={18} strokeWidth={1.9} />
      </span>
      <span className="tw:min-w-0">
        <span className="tw:block tw:text-xs tw:font-medium tw:text-muted-foreground">{input.title}</span>
        <strong className="tw:mt-1.5 tw:block tw:text-xl tw:font-semibold tw:leading-none tw:tracking-[-0.015em] tw:text-foreground">
          {input.value}
        </strong>
      </span>
    </article>
  )
}

function findSelectedIncentiveRow(
  projections: SalesTargetIncentiveProjection[],
  key: { storeId: string; employeeId: string },
): SelectedIncentiveRow | null {
  const projection = projections.find((item) => item.storeId === key.storeId)
  const row = projection?.rows.find((item) => item.employeeId === key.employeeId)
  return projection && row ? { projection, row } : null
}

function RegionStoreCard(input: {
  projection: SalesTargetIncentiveProjection
  locale: ReturnType<typeof useLocalization>['locale']
  expanded: boolean
  reviewDisabled: boolean
  reviewPending: boolean
  pendingCorrectionKeys: ReadonlySet<string>
  onSelectRow: (row: SalesTargetIncentiveRow) => void
  onReviewChange: (status: 'pending_review' | 'reviewed') => void
}) {
  const { t } = useLocalization()
  const manager = getManagerRow(input.projection)
  const personnel = getPersonnelRows(input.projection)
  const rows = [...(manager ? [manager] : []), ...personnel]
  const review = getReviewState(input.projection.review)
  const isReviewed = review.storeReviewStatus === 'reviewed'
  const reviewActionLabel = input.reviewPending
    ? t('storeIncentives.regionManagerReviewSaving')
    : isReviewed
      ? t('storeIncentives.regionManagerReviewedCheckbox')
      : t('storeIncentives.regionManagerReviewAction')
  const achievementProgress = toProgressPercent(input.projection.storeAchievementPct) ?? 0
  const gate = getStoreGateState(input.projection)
  const storeLabel = normalizeDisplayLabel(input.projection.storeName, t('storeIncentives.unknownStore'))
  const visualState = gate.known && !gate.passed
    ? 'blocked'
    : isReviewed
      ? 'checked'
      : 'review'
  const visualStatusLabel = visualState === 'blocked'
    ? '%80 aşılmadı'
    : visualState === 'checked'
      ? 'Kontrol edildi'
      : 'Kontrol edilmeli'
  const visualSurfaceClass = visualState === 'blocked'
    ? 'tw:bg-gradient-to-r tw:from-destructive/15 tw:to-card/80 tw:hover:from-destructive/20 tw:data-[state=open]:from-destructive/20'
    : visualState === 'checked'
      ? 'tw:bg-gradient-to-r tw:from-accent/15 tw:to-card/80 tw:hover:from-accent/20 tw:data-[state=open]:from-accent/20'
      : 'tw:bg-gradient-to-r tw:from-chart-4/20 tw:to-card/80 tw:hover:from-chart-4/25 tw:data-[state=open]:from-chart-4/25'
  const visualBadgeTone = visualState === 'blocked'
    ? 'danger'
    : visualState === 'checked'
      ? 'calm'
      : 'warning'
  const isWaitingForMonthClose = isProjectionOnlyReview(review)

  return (
    <AccordionItem
      className={cn(
        'tw:overflow-hidden tw:rounded-2xl tw:border tw:border-border tw:bg-card/90 tw:shadow-sm tw:data-[state=open]:border-primary/35 tw:data-[state=open]:shadow-xl tw:data-[state=open]:ring-1 tw:data-[state=open]:ring-primary/15',
      )}
      data-slot="card"
      value={input.projection.storeId}
    >
      <AccordionTrigger
        className={cn(
          'tw:relative tw:overflow-hidden tw:px-4 tw:py-4 tw:hover:no-underline',
          visualSurfaceClass,
        )}
        >
        <div className="tw:grid tw:w-full tw:min-w-0 tw:gap-3 tw:pr-3 tw:lg:grid-cols-[minmax(14rem,1.25fr)_repeat(3,minmax(8.5rem,0.8fr))_minmax(9.5rem,auto)_minmax(3.5rem,auto)] tw:lg:items-center">
          <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
            <span className="tw:flex tw:size-[38px] tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:bg-primary/10 tw:text-primary">
              <Store size={17} />
            </span>
            <span className="tw:min-w-0">
              <span className="tw:block tw:text-sm tw:font-semibold tw:text-foreground">
                {storeLabel}
              </span>
              <span className="tw:mt-0.5 tw:block tw:text-xs tw:text-muted-foreground">
                {t('storeIncentives.regionManagerStoreType')}
              </span>
            </span>
          </div>
          <StoreKv label={t('storeIncentives.regionManagerStoreTarget')} value={formatTargetMoneyValue(input.projection.storeTarget, input.locale)} />
          <StoreKv label={t('storeIncentives.regionManagerStoreActual')} value={formatSalesMoneyValue(input.projection.storeActualNetSales, input.locale)} />
          <div className="tw:grid tw:gap-1">
            <StoreKv
              label={t('storeIncentives.regionManagerAchievement')}
              value={formatAchievementState(
                input.projection.storeAchievementPct,
                input.projection.storeTarget,
                input.projection.storeActualNetSales,
                input.locale,
              )}
            />
            <Progress value={achievementProgress} />
          </div>
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:lg:justify-end">
            {isWaitingForMonthClose ? (
              <StoreStatusBadge tone="warning">Ay kapanışı bekliyor</StoreStatusBadge>
            ) : null}
            <StoreStatusBadge tone={visualBadgeTone}>{visualStatusLabel}</StoreStatusBadge>
          </div>
          <span className="tw:text-right tw:text-xs tw:font-semibold tw:text-primary">
            {input.expanded ? 'Kapat' : 'Aç'}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="tw:border-t tw:border-border tw:bg-muted/20 tw:p-3">
        <div className="tw:mb-3 tw:flex tw:flex-col tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-card/80 tw:p-3 tw:lg:flex-row tw:lg:items-center tw:lg:justify-between">
          <label
            className={cn(
              'tw:inline-flex tw:min-h-9 tw:w-fit tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-full tw:border tw:px-3 tw:text-xs tw:font-semibold tw:shadow-sm tw:transition-all tw:duration-150 tw:active:scale-[0.98]',
              isReviewed
                ? 'tw:border-emerald-500/25 tw:bg-emerald-500/10 tw:text-emerald-700'
                : 'tw:border-chart-4/30 tw:bg-chart-4/10 tw:text-chart-4 tw:hover:border-primary/30 tw:hover:bg-primary/5 tw:hover:text-primary',
              input.reviewPending && 'tw:cursor-wait tw:border-primary/25 tw:bg-primary/10 tw:text-primary',
              input.reviewDisabled && 'tw:cursor-not-allowed tw:opacity-60',
            )}
          >
            <span className="tw:grid tw:size-5 tw:place-items-center">
              {input.reviewPending ? (
                <Loader2 className="tw:size-4 tw:animate-spin" />
              ) : (
                <Checkbox
                  checked={isReviewed}
                  className="tw:size-5 tw:transition-transform tw:duration-150 tw:data-[state=checked]:scale-105"
                  disabled={input.reviewDisabled}
                  onCheckedChange={(checked) =>
                    input.onReviewChange(checked === true ? 'reviewed' : 'pending_review')
                  }
                />
              )}
            </span>
            {reviewActionLabel}
          </label>
        </div>
        <RegionPersonnelTable
          locale={input.locale}
          onSelectRow={input.onSelectRow}
          pendingCorrectionKeys={input.pendingCorrectionKeys}
          projection={input.projection}
          rows={rows}
        />
      </AccordionContent>
    </AccordionItem>
  )
}

function StoreKv(input: { label: string; value: string }) {
  return (
    <div className="tw:min-w-0">
      <span className="tw:block tw:text-xs tw:font-medium tw:text-muted-foreground">{input.label}</span>
      <strong className="tw:mt-1 tw:block tw:truncate tw:text-sm tw:font-semibold tw:text-foreground">{input.value}</strong>
    </div>
  )
}

function RegionPersonnelTable(input: {
  rows: SalesTargetIncentiveRow[]
  projection: SalesTargetIncentiveProjection
  locale: ReturnType<typeof useLocalization>['locale']
  pendingCorrectionKeys: ReadonlySet<string>
  onSelectRow: (row: SalesTargetIncentiveRow) => void
}) {
  const { t } = useLocalization()
  if (input.rows.length === 0) {
    return <StoreEmptyState description={t('storeIncentives.regionManagerNoRows')} />
  }

  return (
    <>
      <div className="tw:hidden tw:lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('storeIncentives.regionManagerPersonnelColumn')}</TableHead>
              <TableHead>{t('storeIncentives.regionManagerRoleColumn')}</TableHead>
              <TableHead>{t('storeIncentives.regionManagerTargetColumn')}</TableHead>
              <TableHead>{t('storeIncentives.regionManagerActualColumn')}</TableHead>
              <TableHead>{t('storeIncentives.regionManagerAchievementColumn')}</TableHead>
              <TableHead>{t('storeIncentives.regionManagerCalculatedColumn')}</TableHead>
              <TableHead>{t('storeIncentives.regionManagerFinalColumn')}</TableHead>
              <TableHead>{t('storeIncentives.regionManagerChangeColumn')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {input.rows.map((row) => (
              <TableRow key={`${row.employeeId}:${row.participantType}`}>
                <TableCell>
                  <StoreCommandPersonLink
                    onClick={() => input.onSelectRow(row)}
                    type="button"
                  >
                    {row.displayName}
                  </StoreCommandPersonLink>
                </TableCell>
                <TableCell>{getIncentivePositionLabel(row.positionCode)}</TableCell>
                <TableCell>{formatTargetMoneyValue(row.target, input.locale)}</TableCell>
                <TableCell>{formatSalesMoneyValue(row.actualPositiveSales, input.locale)}</TableCell>
                <TableCell>{formatAchievementState(row.achievementPct, row.target, row.actualPositiveSales, input.locale)}</TableCell>
                <TableCell>{formatIncentiveMoneyValue(row.payableAmount, input.locale)}</TableCell>
                <TableCell>
                  <FinalAmountCell locale={input.locale} row={row} />
                </TableCell>
                <TableCell>
                  <ChangeCell locale={input.locale} row={row} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="tw:lg:hidden">
        <RegionPersonnelCards
          locale={input.locale}
          onSelectRow={input.onSelectRow}
          pendingCorrectionKeys={input.pendingCorrectionKeys}
          projection={input.projection}
          rows={input.rows}
        />
      </div>
    </>
  )
}

function FinalAmountCell(input: {
  row: SalesTargetIncentiveRow
  locale: ReturnType<typeof useLocalization>['locale']
}) {
  const effectiveAmount = getRegionEffectiveEarnedAmount(input.row)

  return (
    <strong className="tw:text-sm tw:font-semibold tw:text-foreground">
      {formatIncentiveMoneyValue(effectiveAmount, input.locale)}
    </strong>
  )
}

function ChangeCell(input: {
  row: SalesTargetIncentiveRow
  locale: ReturnType<typeof useLocalization>['locale']
}) {
  const change = getFinalChange(input.row, input.locale)

  return (
    <StoreStatusBadge className="tw:whitespace-nowrap tw:font-semibold" tone={change.tone}>
      {change.label}
    </StoreStatusBadge>
  )
}

function RegionPersonnelCards(input: {
  rows: SalesTargetIncentiveRow[]
  projection: SalesTargetIncentiveProjection
  locale: ReturnType<typeof useLocalization>['locale']
  pendingCorrectionKeys: ReadonlySet<string>
  onSelectRow: (row: SalesTargetIncentiveRow) => void
}) {
  const { t } = useLocalization()

  return (
    <div className="tw:flex tw:flex-col tw:gap-2">
      {input.rows.map((row) => (
        <button
          className="tw:rounded-lg tw:border tw:border-border tw:bg-muted/30 tw:p-3 tw:text-left"
          key={`${row.employeeId}:${row.participantType}`}
          onClick={() => input.onSelectRow(row)}
          type="button"
        >
          <span className="tw:block tw:text-sm tw:font-semibold tw:text-foreground">{row.displayName}</span>
          <span className="tw:block tw:text-xs tw:text-muted-foreground">
            {getIncentivePositionLabel(row.positionCode)} / {formatAchievementState(row.achievementPct, row.target, row.actualPositiveSales, input.locale)}
          </span>
          <span className="tw:mt-2 tw:flex tw:items-center tw:justify-between tw:gap-3">
            <span className="tw:text-sm tw:font-semibold tw:text-foreground">
              {formatIncentiveMoneyValue(getRegionEffectiveEarnedAmount(row), input.locale)}
            </span>
            <ChangeCell locale={input.locale} row={row} />
          </span>
          <span className="tw:mt-2 tw:flex tw:justify-end">
            {input.pendingCorrectionKeys.has(getPendingCorrectionKey(input.projection, row)) ? (
              <StoreStatusBadge tone="warning">
                {t('storeIncentives.regionManagerReviewSaving')}
              </StoreStatusBadge>
            ) : row.regionCorrection ? (
                <StoreStatusBadge tone={getCorrectionTone(row.regionCorrection)}>
                  {getCorrectionLabel(row.regionCorrection)}
                </StoreStatusBadge>
              ) : null}
          </span>
        </button>
      ))}
    </div>
  )
}

function getPendingCorrectionKey(
  projection: SalesTargetIncentiveProjection,
  row: SalesTargetIncentiveRow,
) {
  return `${projection.storeId}:${row.employeeId}:${row.participantType}`
}

function DialogAmountLine(input: { label: string; value: string }) {
  return (
    <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
      <span className="tw:text-sm tw:text-muted-foreground">{input.label}</span>
      <span className="tw:text-sm tw:text-foreground">{input.value}</span>
    </div>
  )
}
