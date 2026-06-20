import { useState } from 'react'
import { type UseMutationResult } from '@tanstack/react-query'
import {
  ClipboardCheck,
  CircleDollarSign,
  Download,
  RefreshCw,
  RotateCcw,
  Save,
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
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
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
  formatPercentValue,
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
  normalizeMoneyInput,
  sumMoney,
  type SelectedIncentiveRow,
  type StoreStatusFilter,
} from './store-incentives-region-manager-model'
import { IncentiveRateTables } from './store-incentives-widgets'
import {
  StoreCommandBar,
  StoreCommandPersonLink,
  StoreCommandSheetContent,
  StoreEmptyState,
  StoreErrorState,
  StoreMetricCard,
  StoreMetricGrid,
  StoreSectionCard,
  StoreStatusBadge,
  StoreSurfaceHeader,
  StoreSurfacePage,
} from './store-surface-primitives'

const prototypePrimaryActionClass =
  'tw:bg-gradient-to-r tw:from-primary tw:to-accent tw:text-primary-foreground tw:shadow-lg tw:shadow-primary/20 tw:hover:from-primary/90 tw:hover:to-accent/90'

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
              className={prototypePrimaryActionClass}
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
                reviewDisabled={workflowLocked || !canReviewProjection(projection)}
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
              className={prototypePrimaryActionClass}
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
  const achievementProgress = toProgressPercent(input.projection.storeAchievementPct) ?? 0
  const gate = getStoreGateState(input.projection)
  const gateLabel = getStoreGateLabel(input.projection)

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
                {input.projection.storeName}
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
            <StoreStatusBadge tone={status.tone}>{status.label}</StoreStatusBadge>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="tw:border-t tw:border-border tw:bg-muted/20 tw:p-3">
        <div className="tw:mb-3 tw:flex tw:flex-col tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-card/80 tw:p-3 tw:lg:flex-row tw:lg:items-center tw:lg:justify-between">
          <label className="tw:inline-flex tw:min-h-8 tw:items-center tw:gap-2 tw:rounded-full tw:border tw:border-chart-4/30 tw:bg-chart-4/10 tw:px-3 tw:text-xs tw:font-semibold tw:text-chart-4">
            <Checkbox
              checked={review.storeReviewStatus === 'reviewed'}
              disabled={input.reviewDisabled}
              onCheckedChange={(checked) =>
                input.onReviewChange(checked === true ? 'reviewed' : 'pending_review')
              }
            />
            {t('storeIncentives.regionManagerReviewedCheckbox')}
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
  locale: ReturnType<typeof useLocalization>['locale']
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
              <TableHead>Değişim</TableHead>
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
                  {row.regionCorrection ? (
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
  locale: ReturnType<typeof useLocalization>['locale']
  onSelectRow: (row: SalesTargetIncentiveRow) => void
}) {
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
            {row.regionCorrection ? (
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

function IncentiveCorrectionSheet(input: {
  selectedRow: SelectedIncentiveRow | null
  locale: ReturnType<typeof useLocalization>['locale']
  period: string
  workflowLocked: boolean
  onOpenChange: (open: boolean) => void
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
}) {
  const row = input.selectedRow?.row ?? null
  const projection = input.selectedRow?.projection ?? null

  if (!row || !projection) {
    return <Sheet open={false} onOpenChange={input.onOpenChange} />
  }

  return (
    <Sheet open={Boolean(input.selectedRow)} onOpenChange={input.onOpenChange}>
      <IncentiveCorrectionSheetForm
        correctionMutation={input.correctionMutation}
        key={`${projection.storeId}:${row.employeeId}:${row.participantType}:${row.regionCorrection?.correctionId ?? 'base'}`}
        locale={input.locale}
        onOpenChange={input.onOpenChange}
        period={input.period}
        projection={projection}
        row={row}
        voidCorrectionMutation={input.voidCorrectionMutation}
        workflowLocked={input.workflowLocked}
      />
    </Sheet>
  )
}

function IncentiveCorrectionSheetForm(input: {
  row: SalesTargetIncentiveRow
  projection: SalesTargetIncentiveProjection
  locale: ReturnType<typeof useLocalization>['locale']
  period: string
  workflowLocked: boolean
  onOpenChange: (open: boolean) => void
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
}) {
  const { row, projection } = input
  const { t } = useLocalization()
  const [finalAmount, setFinalAmount] = useState(() =>
    formatMoneyDisplayValue(formatIncentiveMoneyValue(getRegionEffectiveEarnedAmount(row), input.locale)),
  )
  const [reasonNote, setReasonNote] = useState(row.regionCorrection?.reasonNote ?? '')
  const progress = toProgressPercent(row.achievementPct) ?? 0
  const projectionCanEdit = canReviewProjection(projection)
  const canEdit =
    projectionCanEdit &&
    !input.workflowLocked &&
    (!row.regionCorrection || row.regionCorrection.status === 'draft' || row.regionCorrection.status === 'admin_returned')
  const canVoid =
    projectionCanEdit &&
    !input.workflowLocked &&
    Boolean(row.regionCorrection) &&
    (row.regionCorrection?.status === 'draft' || row.regionCorrection?.status === 'admin_returned')
  const normalizedFinalAmount = normalizeMoneyInput(toMoneyEditValue(finalAmount))
  const amountIsValid = normalizedFinalAmount !== null
  const savedFinalChange = getFinalChange(row, input.locale)
  const finalChange = amountIsValid
    ? getFinalChangeFromAmounts(
        row.regionCorrection?.beforeAmount ?? row.payableAmount,
        normalizedFinalAmount,
        input.locale,
      )
    : savedFinalChange
  const noteIsValid = reasonNote.trim().length >= 3

  return (
    <StoreCommandSheetContent
      className="tw:flex tw:max-h-[calc(100dvh-28px)] tw:flex-col tw:overflow-hidden"
      closeLabel={t('storeIncentives.regionManagerClose')}
    >
      <SheetHeader className="tw:border-b tw:border-border tw:bg-gradient-to-br tw:from-primary/5 tw:via-card tw:to-accent/10 tw:p-4">
        <div className="tw:flex tw:items-start tw:justify-between tw:gap-4 tw:pr-8">
          <div className="tw:min-w-0">
            <SheetTitle className="tw:text-base tw:font-semibold tw:tracking-normal">{row.displayName}</SheetTitle>
            <SheetDescription className="tw:mt-1 tw:text-sm">
              {getIncentivePositionLabel(row.positionCode)}, {projection.storeName}
            </SheetDescription>
            <div className="tw:mt-3 tw:flex tw:flex-wrap tw:gap-2">
              {row.regionCorrection ? (
                <StoreStatusBadge tone={getCorrectionTone(row.regionCorrection)}>
                  {getCorrectionLabel(row.regionCorrection)}
                </StoreStatusBadge>
              ) : (
                <StoreStatusBadge tone="neutral">{t('storeIncentives.regionManagerNoCorrection')}</StoreStatusBadge>
              )}
              <StoreStatusBadge tone={progress >= 80 ? 'calm' : 'warning'}>
                {t('storeIncentives.regionManagerGoalBadge', {
                  value: formatAchievementState(row.achievementPct, row.target, row.actualPositiveSales, input.locale),
                })}
              </StoreStatusBadge>
            </div>
          </div>
        </div>
        <div className="tw:mt-4 tw:grid tw:grid-cols-3 tw:gap-2">
          <SheetStat
            label={t('storeIncentives.regionManagerAchievement')}
            value={formatAchievementState(row.achievementPct, row.target, row.actualPositiveSales, input.locale)}
          />
          <SheetStat
            label={t('storeIncentives.regionManagerFinalLine')}
            value={formatIncentiveMoneyValue(getRegionEffectiveEarnedAmount(row), input.locale)}
          />
          <SheetStat label="Değişim" value={finalChange.label} />
        </div>
      </SheetHeader>

      <ScrollArea className="tw:min-h-0 tw:flex-1">
        <div className="tw:flex tw:flex-col tw:gap-3 tw:px-4 tw:py-3">
          <section className="tw:rounded-2xl tw:border tw:border-primary/15 tw:bg-card/95 tw:p-3.5 tw:shadow-sm">
            <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
              <h3 className="tw:text-sm tw:font-semibold tw:text-foreground">{t('storeIncentives.regionManagerEarningSummaryTitle')}</h3>
              <span className="tw:text-sm tw:font-semibold tw:text-foreground">
                {formatAchievementState(row.achievementPct, row.target, row.actualPositiveSales, input.locale)}
              </span>
            </div>
            <Progress className="tw:mt-3" value={progress} />
            <div className="tw:mt-3 tw:grid tw:gap-2 tw:sm:grid-cols-2">
              <SheetStat label={t('storeIncentives.regionManagerTargetColumn')} value={formatTargetMoneyValue(row.target, input.locale)} />
              <SheetStat label={t('storeIncentives.regionManagerActualColumn')} value={formatSalesMoneyValue(row.actualPositiveSales, input.locale)} />
              <SheetStat label={t('storeIncentives.regionManagerRateLine')} value={formatRateValue(row.rate, input.locale)} />
              <SheetStat label={t('storeIncentives.regionManagerCalculatedLine')} value={formatIncentiveMoneyValue(row.payableAmount, input.locale)} />
            </div>
          </section>

          <section className="tw:rounded-2xl tw:border tw:border-border tw:bg-card/95 tw:p-3.5 tw:shadow-sm">
            <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
              <h3 className="tw:text-sm tw:font-semibold tw:text-foreground">{t('storeIncentives.regionManagerCorrectionSectionTitle')}</h3>
              <StoreStatusBadge tone={finalChange.tone}>{finalChange.label}</StoreStatusBadge>
            </div>
            <FieldGroup className="tw:mt-4 tw:gap-4">
              <Field>
                <FieldLabel htmlFor="region-final-incentive">
                  {t('storeIncentives.regionManagerFinalAmountField')}
                </FieldLabel>
                <Input
                  className="tw:h-11 tw:px-3 tw:text-base tw:font-semibold tw:tracking-normal"
                  disabled={!canEdit}
                  id="region-final-incentive"
                  inputMode="decimal"
                  onBlur={() => setFinalAmount(formatMoneyDisplayValue(finalAmount))}
                  onChange={(event) => setFinalAmount(formatMoneyEditValue(event.target.value))}
                  onFocus={(event) => {
                    const inputElement = event.currentTarget
                    setFinalAmount(toMoneyEditValue(finalAmount))
                    window.requestAnimationFrame(() => inputElement.select())
                  }}
                  value={finalAmount}
                />
                <FieldDescription>Kaydedilen tutar admin onayına bu notla gider.</FieldDescription>
                {!amountIsValid ? (
                  <span className="tw:text-xs tw:text-destructive">{t('storeIncentives.regionManagerInvalidAmount')}</span>
                ) : null}
              </Field>
              <div className="tw:grid tw:gap-2 tw:sm:grid-cols-2">
                <SheetStat label={t('storeIncentives.regionManagerCalculatedLine')} value={formatIncentiveMoneyValue(row.payableAmount, input.locale)} />
                <SheetStat label="Değişim" value={finalChange.label} />
              </div>
              <Field>
                <FieldLabel htmlFor="region-correction-note">
                  {t('storeIncentives.regionManagerCorrectionNoteField')}
                </FieldLabel>
                <Textarea
                  className="tw:min-h-20 tw:resize-y"
                  disabled={!canEdit}
                  id="region-correction-note"
                  onChange={(event) => setReasonNote(event.target.value)}
                  placeholder={t('storeIncentives.regionManagerCorrectionNotePlaceholder')}
                  value={reasonNote}
                />
              </Field>
            </FieldGroup>
          </section>
        </div>
      </ScrollArea>

      <SheetFooter className="tw:mx-0 tw:mb-0 tw:border-t tw:border-border tw:bg-muted/25 tw:p-3">
        <div className="tw:flex tw:w-full tw:flex-row tw:items-center tw:justify-end tw:gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!canVoid || input.voidCorrectionMutation.isPending}
            onClick={() => {
              const correctionId = row.regionCorrection?.correctionId
              if (!correctionId) {
                setFinalAmount(formatMoneyDisplayValue(formatIncentiveMoneyValue(row.payableAmount, input.locale)))
                setReasonNote('')
                return
              }
              input.voidCorrectionMutation.mutate({
                period: input.period,
                correctionId,
              })
              input.onOpenChange(false)
            }}
          >
            <RotateCcw data-icon="inline-start" />
            {t('storeIncentives.regionManagerRevert')}
          </Button>
          <Button type="button" variant="outline" onClick={() => input.onOpenChange(false)}>
            {t('storeIncentives.regionManagerCancel')}
          </Button>
          <Button
            className={prototypePrimaryActionClass}
            type="button"
            disabled={!canEdit || !amountIsValid || !noteIsValid || input.correctionMutation.isPending}
            onClick={() => {
              if (!normalizedFinalAmount) return
              input.correctionMutation.mutate({
                period: input.period,
                storeId: projection.storeId,
                employeeId: row.employeeId,
                participantType: row.participantType,
                finalAmount: normalizedFinalAmount,
                reasonNote: reasonNote.trim(),
              })
              input.onOpenChange(false)
            }}
          >
            <Save data-icon="inline-start" />
            {t('storeIncentives.regionManagerSave')}
          </Button>
        </div>
      </SheetFooter>
    </StoreCommandSheetContent>
  )
}

function SheetStat(input: { label: string; value: string }) {
  return (
    <div className="tw:min-w-0 tw:rounded-xl tw:border tw:border-border/80 tw:bg-background/70 tw:px-3 tw:py-2">
      <span className="tw:block tw:text-xs tw:font-medium tw:text-muted-foreground">{input.label}</span>
      <strong className="tw:mt-1 tw:block tw:truncate tw:text-sm tw:font-semibold tw:text-foreground">{input.value}</strong>
    </div>
  )
}

function DialogAmountLine(input: { label: string; value: string }) {
  return (
    <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
      <span className="tw:text-sm tw:text-muted-foreground">{input.label}</span>
      <span className="tw:text-sm tw:text-foreground">{input.value}</span>
    </div>
  )
}

function getStoreGateState(projection: SalesTargetIncentiveProjection) {
  if (projection.storeGatePassed !== null) {
    return { known: true, passed: projection.storeGatePassed }
  }

  const achievement = parseDecimalNumber(projection.storeAchievementPct)
  if (achievement !== null) {
    return { known: true, passed: achievement >= 80 }
  }

  return { known: false, passed: false }
}

function getStoreGateLabel(projection: SalesTargetIncentiveProjection) {
  const gate = getStoreGateState(projection)
  if (gate.known) return gate.passed ? '%80 kapısı geçildi' : '%80 kapısı bekliyor'
  if (!projection.storeTarget && projection.storeActualNetSales) return 'Hedef bekliyor'
  if (projection.storeTarget && !projection.storeActualNetSales) return 'Satış bekliyor'
  return 'Hedef bekliyor'
}

function formatTargetMoneyValue(
  value: string | null | undefined,
  locale: ReturnType<typeof useLocalization>['locale'],
) {
  return value ? formatMoneyValue(value, locale) : 'Hedef yok'
}

function formatSalesMoneyValue(
  value: string | null | undefined,
  locale: ReturnType<typeof useLocalization>['locale'],
) {
  return value ? formatMoneyValue(value, locale) : 'Satış verisi yok'
}

function formatIncentiveMoneyValue(
  value: string | null | undefined,
  locale: ReturnType<typeof useLocalization>['locale'],
) {
  return value ? formatMoneyValue(value, locale) : formatMoneyValue('0.00', locale)
}

function formatAchievementState(
  achievementPct: string | null | undefined,
  target: string | null | undefined,
  actual: string | null | undefined,
  locale: ReturnType<typeof useLocalization>['locale'],
) {
  if (achievementPct) return formatPercentValue(achievementPct, locale)
  if (!target && actual) return 'Hedef bekliyor'
  if (target && !actual) return 'Satış bekliyor'
  if (!target) return 'Hedef yok'
  return 'Bekliyor'
}

function getFinalChange(
  row: SalesTargetIncentiveRow,
  locale: ReturnType<typeof useLocalization>['locale'],
) {
  return getFinalChangeFromAmounts(
    row.regionCorrection?.beforeAmount ?? row.payableAmount,
    getRegionEffectiveEarnedAmount(row),
    locale,
  )
}

function getFinalChangeFromAmounts(
  beforeAmount: string | null | undefined,
  finalAmount: string | null | undefined,
  locale: ReturnType<typeof useLocalization>['locale'],
): { label: string; tone: 'neutral' | 'warning' | 'danger' } {
  const beforeCents = decimalStringToCents(beforeAmount ?? '0.00')
  const finalCents = decimalStringToCents(finalAmount ?? '0.00')
  const delta = finalCents - beforeCents

  if (delta === 0n) return { label: 'Yok', tone: 'neutral' }

  const sign = delta > 0n ? '+' : '-'
  const absolute = delta > 0n ? delta : -delta

  return {
    label: `${sign}${formatMoneyValue(centsToDecimalString(absolute), locale)}`,
    tone: delta > 0n ? 'warning' : 'danger',
  }
}

function toMoneyEditValue(rawValue: string) {
  return formatMoneyEditValue(rawValue).replace(/\s*TL\s*$/i, '')
}

function formatMoneyEditValue(rawValue: string) {
  const withoutCurrency = rawValue.replace(/\s*TL\s*$/i, '')
  const [integerRaw = '', fractionRaw] = withoutCurrency.split(',', 2)
  const integerDigits = integerRaw.replace(/\D/g, '')
  const integerValue = integerDigits.replace(/^0+(?=\d)/, '')
  const groupedInteger = integerValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  if (fractionRaw !== undefined) {
    const fractionDigits = fractionRaw.replace(/\D/g, '').slice(0, 2)
    return `${groupedInteger || '0'},${fractionDigits}`
  }

  return groupedInteger
}

function formatMoneyDisplayValue(rawValue: string) {
  const editValue = formatMoneyEditValue(rawValue)
  const [integerText = '', fractionText = ''] = editValue.split(',', 2)
  const normalizedInteger = integerText || '0'
  const normalizedFraction = fractionText.padEnd(2, '0').slice(0, 2)

  return `${normalizedInteger},${normalizedFraction} TL`
}

function parseDecimalNumber(value: string | null | undefined) {
  if (!value) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function decimalStringToCents(value: string) {
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(value.trim().replace(',', '.'))
  if (!match) return 0n
  const integerText = match[2]
  if (!integerText) return 0n
  const sign = match[1] ? -1n : 1n
  const fraction = (match[3] ?? '').padEnd(2, '0').slice(0, 2)
  return sign * ((BigInt(integerText) * 100n) + BigInt(fraction || '0'))
}

function centsToDecimalString(cents: bigint) {
  const integer = cents / 100n
  const fraction = cents % 100n
  return `${integer.toString()}.${fraction.toString().padStart(2, '0')}`
}
