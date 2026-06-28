import { useState } from 'react'
import { type UseMutationResult } from '@tanstack/react-query'
import {
  ClipboardCheck,
  CircleDollarSign,
  Download,
  Loader2,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  Store,
  UsersRound,
  WalletCards,
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
import { getErrorMessage } from '../lib/format'
import {
  formatMoneyValue,
  formatRateValue,
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
  getProjectionWorkflowStatus,
  getRegionEffectiveEarnedAmount,
  getRegionSummary,
  getReviewState,
  isPackageLocked,
  matchesStoreFilter,
  sumMoney,
  type SelectedIncentiveRow,
  type StoreStatusFilter,
} from './store-incentives-region-manager-model'
import {
  formatAchievementState,
  formatIncentiveMoneyValue,
  formatSalesMoneyValue,
  formatTargetMoneyValue,
  getFinalChange,
  getStoreGateLabel,
  getStoreGateState,
  regionManagerPrimaryActionClass,
} from './store-incentives-region-manager-format'
import { IncentiveCorrectionSheet } from './store-incentives-region-manager-sheet'
import { IncentiveRateTables } from './store-incentives-widgets'
import {
  StoreCommandBar,
  StoreCommandPersonLink,
  StoreEmptyState,
  StoreErrorState,
  StoreMetricCard,
  StoreMetricGrid,
  StoreSectionCard,
  StoreStatusBadge,
  StoreSurfaceHeader,
  StoreSurfacePage,
} from './store-surface-primitives'

export function RegionManagerIncentivesView(input: {
  data: SalesTargetIncentiveResponse['data']
  locale: ReturnType<typeof useLocalization>['locale']
  selectedPeriod: string
  onPeriodChange: (period: string) => void
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
  const [expandedStoreId, setExpandedStoreId] = useState<string | null>(
    input.data.projections[0]?.storeId ?? null,
  )
  const [selectedRow, setSelectedRow] = useState<SelectedIncentiveRow | null>(null)
  const [isSubmitDialogOpen, setSubmitDialogOpen] = useState(false)
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
  const mutationError =
    input.mutationState.reviewMutation.error ??
    input.mutationState.correctionMutation.error ??
    input.mutationState.voidCorrectionMutation.error ??
    input.mutationState.submitPackageMutation.error

  return (
    <StoreSurfacePage
      ariaLabel={t('storeIncentives.regionManagerAria')}
      testId="store-incentives-page"
    >
      <StoreCommandBar
        title={t('storeIncentives.regionManagerTitle')}
        description={t('storeIncentives.regionManagerCommandDescription')}
        end={(
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            <Button type="button" variant="outline" onClick={() => undefined}>
              <Download data-icon="inline-start" />
              {t('storeIncentives.regionManagerExportExcel')}
            </Button>
            <Button
              className={regionManagerPrimaryActionClass}
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
        )}
      />

      <StoreSurfaceHeader
        title={t('storeIncentives.regionManagerTitle')}
        description={t('storeIncentives.regionManagerCopy')}
        icon={<CircleDollarSign size={23} />}
      />

      <StoreMetricGrid ariaLabel={t('storeIncentives.regionManagerSummaryAria')}>
        <StoreMetricCard
          title={t('storeIncentives.regionManagerTotalTitle')}
          value={formatMoneyValue(summary.payableTotal, input.locale)}
          note={t('storeIncentives.regionManagerTotalNote')}
          icon={<WalletCards size={20} />}
          tone="plum"
        />
        <StoreMetricCard
          title={t('storeIncentives.regionManagerEarningPersonnelTitle')}
          value={summary.earningPersonnelCount}
          note={t('storeIncentives.regionManagerEarningPersonnelNote')}
          icon={<UsersRound size={20} />}
          tone="mint"
        />
        <StoreMetricCard
          title={t('storeIncentives.regionManagerCorrectionTitle')}
          value={summary.correctionCount}
          note={t('storeIncentives.regionManagerCorrectionNote')}
          icon={<SlidersHorizontal size={20} />}
          tone="amber"
        />
        <StoreMetricCard
          title={t('storeIncentives.regionManagerPendingReviewTitle')}
          value={summary.pendingReviewCount}
          note={t('storeIncentives.regionManagerPendingReviewNote')}
          icon={<ClipboardCheck size={20} />}
          tone="cyan"
        />
      </StoreMetricGrid>

      {mutationError ? (
        <StoreErrorState
          title={t('storeIncentives.regionManagerMutationErrorTitle')}
          description={getErrorMessage(mutationError)}
        />
      ) : null}

      <section
        aria-label="Prim filtreleri"
        className="tw:rounded-2xl tw:border tw:border-border/80 tw:bg-card/80 tw:p-3 tw:shadow-sm"
      >
        <div className="tw:grid tw:gap-2 tw:lg:grid-cols-[minmax(13rem,0.75fr)_minmax(18rem,1.2fr)_minmax(12rem,0.75fr)_auto]">
          <div className="tw:flex tw:h-11 tw:min-w-0 tw:items-center tw:gap-2 tw:rounded-xl tw:border tw:border-border/80 tw:bg-background/80 tw:px-3">
            <span className="tw:shrink-0 tw:text-xs tw:font-medium tw:text-muted-foreground">
              {t('storeIncentives.regionManagerPeriodField')}
            </span>
            <div className="tw:min-w-0 tw:flex-1">
              <PeriodPicker
                period={input.selectedPeriod}
                onChange={input.onPeriodChange}
                triggerClassName="tw:h-9 tw:w-full tw:justify-start tw:border-0 tw:bg-transparent tw:px-0 tw:font-semibold tw:shadow-none tw:hover:bg-transparent tw:focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="tw:flex tw:h-11 tw:min-w-0 tw:items-center tw:gap-2 tw:rounded-xl tw:border tw:border-border/80 tw:bg-background/80 tw:px-3">
            <span className="tw:shrink-0 tw:text-xs tw:font-medium tw:text-muted-foreground">
              {t('storeIncentives.regionManagerSearchField').replace(' ara', '')}
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
              {t('storeIncentives.regionManagerStatusField')}
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
            onClick={() => undefined}
          >
            <RefreshCw data-icon="inline-start" />
            {t('storeIncentives.regionManagerRefresh')}
          </Button>
        </div>
      </section>

      <StoreSectionCard
        ariaLabel={t('storeIncentives.regionManagerStoresAria')}
        title={t('storeIncentives.regionManagerStoresTitle')}
        description={t('storeIncentives.regionManagerStoresCopy')}
        badge={{ label: t('storeIncentives.regionManagerCompanyStoreCount', { count: summary.storeCount }), tone: 'accent' }}
      >
        {visibleProjections.length > 0 ? (
          <Accordion
            type="single"
            collapsible
            value={expandedStoreId ?? ''}
            onValueChange={(value) => setExpandedStoreId(value || null)}
            className="tw:gap-3"
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
                onSelectRow={(row) => setSelectedRow({ projection, row })}
                projection={projection}
                pendingCorrectionKeys={input.mutationState.pendingCorrectionKeys}
                reviewDisabled={workflowLocked || !canReviewProjection(projection)}
                reviewPending={input.mutationState.pendingReviewStoreIds.has(projection.storeId)}
              />
            ))}
          </Accordion>
        ) : (
          <StoreEmptyState description={t('storeIncentives.regionManagerNoStoreMatch')} />
        )}
      </StoreSectionCard>

      <IncentiveRateTables />

      <IncentiveCorrectionSheet
        correctionMutation={input.mutationState.correctionMutation}
        locale={input.locale}
        onOpenChange={(open) => {
          if (!open) setSelectedRow(null)
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

function RegionStoreCard(input: {
  projection: SalesTargetIncentiveProjection
  locale: ReturnType<typeof useLocalization>['locale']
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
  const personnelTotal = sumMoney(personnel.map(getRegionEffectiveEarnedAmount))
  const review = getReviewState(input.projection.review)
  const status = getProjectionWorkflowStatus(input.projection)
  const isReviewed = review.storeReviewStatus === 'reviewed'
  const reviewStatus = input.reviewPending
    ? { label: t('storeIncentives.regionManagerReviewSaving'), tone: 'warning' as const }
    : isReviewed
      ? { label: t('storeIncentives.regionManagerReviewedCheckbox'), tone: 'calm' as const }
      : status
  const reviewActionLabel = input.reviewPending
    ? t('storeIncentives.regionManagerReviewSaving')
    : isReviewed
      ? t('storeIncentives.regionManagerReviewedCheckbox')
      : t('storeIncentives.regionManagerReviewAction')
  const achievementProgress = toProgressPercent(input.projection.storeAchievementPct) ?? 0
  const gate = getStoreGateState(input.projection)
  const gateLabel = getStoreGateLabel(input.projection)
  const storeLabel = normalizeDisplayLabel(input.projection.storeName, t('storeIncentives.unknownStore'))

  return (
    <AccordionItem
      className={cn(
        'tw:overflow-hidden tw:rounded-2xl tw:border tw:border-border tw:bg-card/90 tw:shadow-sm tw:data-[state=open]:shadow-xl tw:data-[state=open]:ring-1 tw:data-[state=open]:ring-primary/15',
      )}
      data-slot="card"
      value={input.projection.storeId}
    >
      <AccordionTrigger
        className={cn(
          'tw:relative tw:overflow-hidden tw:px-3.5 tw:py-3 tw:hover:no-underline',
          gate.known
            ? gate.passed
              ? 'tw:bg-chart-2/10 tw:hover:bg-chart-2/15 tw:data-[state=open]:bg-chart-2/15'
              : 'tw:bg-destructive/10 tw:hover:bg-destructive/15 tw:data-[state=open]:bg-destructive/15'
            : 'tw:bg-muted/30 tw:hover:bg-muted/40 tw:data-[state=open]:bg-muted/40',
        )}
        >
        <div className="tw:grid tw:w-full tw:min-w-0 tw:gap-3 tw:pr-3 tw:lg:grid-cols-[minmax(14rem,1.1fr)_repeat(5,minmax(7.5rem,0.72fr))_minmax(8.5rem,auto)] tw:lg:items-center">
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
          <StoreKv label={t('storeIncentives.regionManagerManagerIncentive')} value={formatIncentiveMoneyValue(getRegionEffectiveEarnedAmount(manager), input.locale)} />
          <StoreKv label={t('storeIncentives.regionManagerTeamIncentive')} value={formatIncentiveMoneyValue(personnelTotal, input.locale)} />
          <div className="tw:flex tw:flex-wrap tw:items-start tw:gap-2 tw:lg:justify-end">
            <StoreStatusBadge tone={gate.known ? (gate.passed ? 'calm' : 'danger') : 'neutral'}>
              {gateLabel}
            </StoreStatusBadge>
            <StoreStatusBadge tone={reviewStatus.tone}>{reviewStatus.label}</StoreStatusBadge>
          </div>
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
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            <StoreStatusBadge tone={rows.length > 0 ? 'calm' : 'neutral'}>
              {rows.length > 0 ? 'Personel listesi hazır' : t('storeIncentives.regionManagerNoRows')}
            </StoreStatusBadge>
            <StoreStatusBadge tone={gate.known ? (gate.passed ? 'calm' : 'danger') : 'neutral'}>
              {gateLabel}
            </StoreStatusBadge>
          </div>
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
              <TableHead>{t('storeIncentives.regionManagerRateColumn')}</TableHead>
              <TableHead>{t('storeIncentives.regionManagerCalculatedColumn')}</TableHead>
              <TableHead>{t('storeIncentives.regionManagerFinalColumn')}</TableHead>
              <TableHead>{t('storeIncentives.regionManagerChangeColumn')}</TableHead>
              <TableHead>{t('storeIncentives.regionManagerNoteColumn')}</TableHead>
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
                <TableCell>{formatRateValue(row.rate, input.locale)}</TableCell>
                <TableCell>{formatIncentiveMoneyValue(row.payableAmount, input.locale)}</TableCell>
                <TableCell>
                  <FinalAmountCell locale={input.locale} row={row} />
                </TableCell>
                <TableCell>
                  <ChangeCell locale={input.locale} row={row} />
                </TableCell>
                <TableCell>
                  {input.pendingCorrectionKeys.has(getPendingCorrectionKey(input.projection, row)) ? (
                    <StoreStatusBadge tone="warning">
                      {t('storeIncentives.regionManagerReviewSaving')}
                    </StoreStatusBadge>
                  ) : row.regionCorrection ? (
                    <StoreStatusBadge tone={getCorrectionTone(row.regionCorrection)}>
                      {getCorrectionLabel(row.regionCorrection)}
                    </StoreStatusBadge>
                  ) : (
                    <span className="tw:text-muted-foreground">{t('storeIncentives.regionManagerNone')}</span>
                  )}
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
    <StoreStatusBadge className="tw:font-semibold" tone={change.tone}>
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
