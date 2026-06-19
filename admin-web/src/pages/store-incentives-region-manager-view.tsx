import { useState } from 'react'
import { type UseMutationResult } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  FileCheck2,
  RotateCcw,
  Search,
  Send,
  UsersRound,
  WalletCards,
} from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
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
  formatDateTimeValue,
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
  getPackageStatus,
  getProjectionWorkflowStatus,
  getRegionEffectiveEarnedAmount,
  getRegionSummary,
  getReviewState,
  getSubmitDisabledReason,
  isPackageLocked,
  matchesStoreFilter,
  normalizeMoneyInput,
  sumMoney,
  type SelectedIncentiveRow,
  type StoreStatusFilter,
} from './store-incentives-region-manager-model'
import { IncentiveRateTables } from './store-incentives-widgets'
import {
  StoreEmptyState,
  StoreErrorState,
  StoreInfoGrid,
  StoreMetricCard,
  StoreMetricGrid,
  StoreSectionCard,
  StoreStatusBadge,
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
  }
}) {
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
  const packageStatus = getPackageStatus(workflow)
  const allStoresReviewed = summary.pendingReviewCount === 0
  const allStoresClosed = summary.projectionOnlyCount === 0
  const packageCanSubmit =
    Boolean(workflow?.regionId) &&
    allStoresReviewed &&
    allStoresClosed &&
    !isPackageLocked(workflow)
  const submitDisabledReason = getSubmitDisabledReason({
    workflow,
    allStoresReviewed,
    allStoresClosed,
  })
  const workflowLocked = isPackageLocked(workflow)
  const mutationError =
    input.mutationState.reviewMutation.error ??
    input.mutationState.correctionMutation.error ??
    input.mutationState.voidCorrectionMutation.error ??
    input.mutationState.submitPackageMutation.error

  return (
    <StoreSurfacePage
      ariaLabel="Primler"
      className="tw:mx-auto tw:w-full tw:max-w-7xl"
      testId="store-incentives-page"
    >
      <div className="tw:flex tw:flex-col tw:gap-4 tw:rounded-xl tw:border tw:border-border tw:bg-card/90 tw:p-4 tw:shadow-sm">
        <div className="tw:flex tw:flex-col tw:gap-3 tw:lg:flex-row tw:lg:items-start tw:lg:justify-between">
          <div className="tw:flex tw:min-w-0 tw:gap-3">
            <span className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:bg-primary/10 tw:text-primary">
              <CircleDollarSign size={20} />
            </span>
            <div className="tw:min-w-0">
              <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">Primler</span>
              <h1 className="tw:text-xl tw:font-semibold tw:leading-tight tw:text-foreground tw:md:text-2xl">
                Bölge primleri
              </h1>
              <p className="tw:mt-1 tw:max-w-3xl tw:text-sm tw:leading-6 tw:text-muted-foreground">
                Mağaza ve personel hakedişleri, düzeltmeler ve onay süreci.
              </p>
            </div>
          </div>
          <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:flex-wrap tw:sm:justify-end">
            <PeriodPicker
              period={input.selectedPeriod}
              onChange={input.onPeriodChange}
            />
            <Button
              type="button"
              disabled={!packageCanSubmit || input.mutationState.submitPackageMutation.isPending}
              onClick={() => setSubmitDialogOpen(true)}
            >
              <Send data-icon="inline-start" />
              {workflow?.regionPackageStatus === 'admin_returned' ? 'Tekrar gönder' : 'Onaya gönder'}
            </Button>
          </div>
        </div>

        <div className="tw:grid tw:gap-3 tw:lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="tw:rounded-xl tw:border tw:border-border tw:bg-muted/30 tw:p-4">
            <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">Dönem hakedişi</span>
            <div className="tw:mt-2 tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-end tw:sm:justify-between">
              <strong className="tw:text-3xl tw:font-semibold tw:leading-none tw:text-foreground tw:md:text-4xl">
                {formatMoneyValue(summary.payableTotal, input.locale)}
              </strong>
              <StoreStatusBadge tone={packageStatus.tone}>
                {packageStatus.label}
              </StoreStatusBadge>
            </div>
          </div>
          <div className="tw:rounded-xl tw:border tw:border-border tw:bg-card tw:p-4">
            <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">Gönderim durumu</span>
            <strong className="tw:mt-2 tw:block tw:text-base tw:font-semibold tw:text-foreground">
              {submitDisabledReason ?? 'Gönderime hazır'}
            </strong>
            <p className="tw:mt-1 tw:text-xs tw:leading-5 tw:text-muted-foreground">
              {summary.reviewedStoreCount}/{summary.storeCount} mağaza kontrol edildi.
            </p>
          </div>
        </div>
      </div>

      <StoreMetricGrid ariaLabel="Bölge prim özeti">
        <StoreMetricCard
          title="Toplam hakediş"
          value={formatMoneyValue(summary.payableTotal, input.locale)}
          note={`${summary.storeCount} şirket mağazası`}
          icon={<WalletCards size={18} />}
          tone="calm"
        />
        <StoreMetricCard
          title="Prim hakeden personel"
          value={summary.earningPersonnelCount}
          note="%80 eşiği geçen mağazalarda"
          icon={<UsersRound size={18} />}
          tone="accent"
        />
        <StoreMetricCard
          title="Kontrol bekleyen mağaza"
          value={summary.pendingReviewCount}
          note={summary.projectionOnlyCount > 0 ? 'Ay kapanışı bekleyen mağaza var.' : 'Dönem kontrolüne hazır.'}
          icon={<FileCheck2 size={18} />}
          tone={summary.pendingReviewCount > 0 ? 'warning' : 'calm'}
        />
        <StoreMetricCard
          title="Düzeltme yapılan kayıt"
          value={summary.correctionCount}
          note="Notla kaydedilen final prim düzeltmeleri"
          icon={<CheckCircle2 size={18} />}
          tone={summary.correctionCount > 0 ? 'warning' : 'neutral'}
        />
      </StoreMetricGrid>

      {mutationError ? (
        <StoreErrorState
          title="İşlem tamamlanamadı"
          description={getErrorMessage(mutationError)}
        />
      ) : null}

      <StoreSectionCard
        title="Bölge mağazaları"
        ariaLabel="Bölge mağazaları"
        className="tw:overflow-visible"
      >
        <div className="tw:flex tw:flex-col tw:gap-3">
          <div className="tw:grid tw:gap-2 tw:lg:grid-cols-[minmax(0,1fr)_12rem]">
            <label className="tw:relative tw:block">
              <Search
                size={16}
                className="tw:pointer-events-none tw:absolute tw:left-2.5 tw:top-1/2 tw:-translate-y-1/2 tw:text-muted-foreground"
              />
              <Input
                aria-label="Mağaza ara"
                className="tw:pl-8"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Mağaza ara"
                value={search}
              />
            </label>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StoreStatusFilter)}
            >
              <SelectTrigger aria-label="Durum filtresi" className="tw:w-full">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="earning">Hakediş var</SelectItem>
                <SelectItem value="no_earning">Hakediş yok</SelectItem>
                <SelectItem value="corrected">Düzeltildi</SelectItem>
                <SelectItem value="reviewed">Kontrol edildi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {visibleProjections.length > 0 ? (
            <>
              <div className="tw:hidden tw:lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mağaza</TableHead>
                      <TableHead>Hedef</TableHead>
                      <TableHead>Gerçekleşen</TableHead>
                      <TableHead>Hedef %</TableHead>
                      <TableHead>Mağaza müdürü</TableHead>
                      <TableHead>Personel primi</TableHead>
                      <TableHead>Kontrol</TableHead>
                      <TableHead className="tw:text-right">Durum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleProjections.map((projection) => (
                      <RegionStoreTableRows
                        expanded={expandedStoreId === projection.storeId}
                        key={projection.storeId}
                        locale={input.locale}
                        onOpenChange={() =>
                          setExpandedStoreId(expandedStoreId === projection.storeId ? null : projection.storeId)
                        }
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
                  </TableBody>
                </Table>
              </div>

              <div className="tw:flex tw:flex-col tw:gap-3 tw:lg:hidden">
                {visibleProjections.map((projection) => (
                  <RegionStoreMobileCard
                    expanded={expandedStoreId === projection.storeId}
                    key={projection.storeId}
                    locale={input.locale}
                    onOpenChange={() =>
                      setExpandedStoreId(expandedStoreId === projection.storeId ? null : projection.storeId)
                    }
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
              </div>
            </>
          ) : (
            <StoreEmptyState description="Bu filtrelerle eşleşen mağaza yok." />
          )}
        </div>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formatPeriodLabel(input.data.period)} primlerini onaya gönder</DialogTitle>
            <DialogDescription>
              {summary.storeCount} mağaza ve {summary.correctionCount} düzeltme kaydı admin onayına gönderilecek.
            </DialogDescription>
          </DialogHeader>
          <StoreInfoGrid
            className="tw:grid-cols-2"
            items={[
              { label: 'Toplam hakediş', value: formatMoneyValue(summary.payableTotal, input.locale), tone: 'calm' },
              { label: 'Kontrol edilen mağaza', value: `${summary.reviewedStoreCount}/${summary.storeCount}`, tone: allStoresReviewed ? 'calm' : 'warning' },
            ]}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSubmitDialogOpen(false)}>
              Vazgeç
            </Button>
            <Button
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
              Onaya gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StoreSurfacePage>
  )
}

function RegionStoreTableRows(input: {
  projection: SalesTargetIncentiveProjection
  locale: ReturnType<typeof useLocalization>['locale']
  expanded: boolean
  reviewDisabled: boolean
  onOpenChange: () => void
  onSelectRow: (row: SalesTargetIncentiveRow) => void
  onReviewChange: (status: 'pending_review' | 'reviewed') => void
}) {
  const manager = getManagerRow(input.projection)
  const personnel = getPersonnelRows(input.projection)
  const personnelTotal = sumMoney(personnel.map(getRegionEffectiveEarnedAmount))
  const review = getReviewState(input.projection.review)
  const status = getProjectionWorkflowStatus(input.projection)

  return (
    <>
      <TableRow aria-expanded={input.expanded}>
        <TableCell>
          <button
            className="tw:flex tw:min-w-0 tw:flex-col tw:items-start tw:gap-1 tw:text-left"
            onClick={input.onOpenChange}
            type="button"
          >
            <span className="tw:flex tw:items-center tw:gap-2 tw:font-medium tw:text-foreground">
              <ChevronDown
                size={16}
                className={cn('tw:transition-transform', input.expanded ? 'tw:rotate-180' : undefined)}
              />
              {input.projection.storeName}
            </span>
            <span className="tw:text-xs tw:text-muted-foreground">
              {formatDateTimeValue(input.projection.lastImportAt, input.locale)}
            </span>
          </button>
        </TableCell>
        <TableCell>{formatMoneyValue(input.projection.storeTarget, input.locale)}</TableCell>
        <TableCell>{formatMoneyValue(input.projection.storeActualNetSales, input.locale)}</TableCell>
        <TableCell>{formatPercentValue(input.projection.storeAchievementPct, input.locale)}</TableCell>
        <TableCell>{formatMoneyValue(getRegionEffectiveEarnedAmount(manager), input.locale)}</TableCell>
        <TableCell>{formatMoneyValue(personnelTotal, input.locale)}</TableCell>
        <TableCell>
          <label className="tw:inline-flex tw:items-center tw:gap-2 tw:text-sm tw:text-foreground">
            <Checkbox
              checked={review.storeReviewStatus === 'reviewed'}
              disabled={input.reviewDisabled}
              onCheckedChange={(checked) =>
                input.onReviewChange(checked === true ? 'reviewed' : 'pending_review')
              }
            />
            Kontrol edildi
          </label>
        </TableCell>
        <TableCell className="tw:text-right">
          <StoreStatusBadge tone={status.tone}>{status.label}</StoreStatusBadge>
        </TableCell>
      </TableRow>
      {input.expanded ? (
        <TableRow>
          <TableCell className="tw:bg-muted/20 tw:p-3" colSpan={8}>
            <RegionPersonnelTable
              locale={input.locale}
              onSelectRow={input.onSelectRow}
              rows={[...(manager ? [manager] : []), ...personnel]}
            />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}

function RegionStoreMobileCard(input: {
  projection: SalesTargetIncentiveProjection
  locale: ReturnType<typeof useLocalization>['locale']
  expanded: boolean
  reviewDisabled: boolean
  onOpenChange: () => void
  onSelectRow: (row: SalesTargetIncentiveRow) => void
  onReviewChange: (status: 'pending_review' | 'reviewed') => void
}) {
  const manager = getManagerRow(input.projection)
  const personnel = getPersonnelRows(input.projection)
  const status = getProjectionWorkflowStatus(input.projection)
  const review = getReviewState(input.projection.review)

  return (
    <article className="tw:rounded-xl tw:border tw:border-border tw:bg-card tw:p-3">
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
        <button
          className="tw:min-w-0 tw:text-left"
          onClick={input.onOpenChange}
          type="button"
        >
          <strong className="tw:block tw:text-sm tw:font-semibold tw:text-foreground">
            {input.projection.storeName}
          </strong>
          <span className="tw:text-xs tw:text-muted-foreground">
            {formatPercentValue(input.projection.storeAchievementPct, input.locale)} hedef
          </span>
        </button>
        <StoreStatusBadge tone={status.tone}>{status.label}</StoreStatusBadge>
      </div>
      <StoreInfoGrid
        className="tw:mt-3 tw:grid-cols-2"
        items={[
          { label: 'Mağaza müdürü', value: formatMoneyValue(getRegionEffectiveEarnedAmount(manager), input.locale) },
          { label: 'Personel primi', value: formatMoneyValue(sumMoney(personnel.map(getRegionEffectiveEarnedAmount)), input.locale) },
        ]}
      />
      <label className="tw:mt-3 tw:inline-flex tw:items-center tw:gap-2 tw:text-sm tw:text-foreground">
        <Checkbox
          checked={review.storeReviewStatus === 'reviewed'}
          disabled={input.reviewDisabled}
          onCheckedChange={(checked) =>
            input.onReviewChange(checked === true ? 'reviewed' : 'pending_review')
          }
        />
        Kontrol edildi
      </label>
      {input.expanded ? (
        <div className="tw:mt-3">
          <RegionPersonnelCards
            locale={input.locale}
            onSelectRow={input.onSelectRow}
            rows={[...(manager ? [manager] : []), ...personnel]}
          />
        </div>
      ) : null}
    </article>
  )
}

function RegionPersonnelTable(input: {
  rows: SalesTargetIncentiveRow[]
  locale: ReturnType<typeof useLocalization>['locale']
  onSelectRow: (row: SalesTargetIncentiveRow) => void
}) {
  if (input.rows.length === 0) {
    return <StoreEmptyState description="Bu mağaza için prim satırı yok." />
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Personel</TableHead>
          <TableHead>Rol</TableHead>
          <TableHead>Hedef</TableHead>
          <TableHead>Gerçekleşen</TableHead>
          <TableHead>Hedef %</TableHead>
          <TableHead>Oran</TableHead>
          <TableHead>Hesaplanan</TableHead>
          <TableHead>Final prim</TableHead>
          <TableHead>Not</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {input.rows.map((row) => (
          <TableRow key={`${row.employeeId}:${row.participantType}`}>
            <TableCell>
              <Button
                className="tw:h-auto tw:justify-start tw:p-0 tw:text-left"
                onClick={() => input.onSelectRow(row)}
                type="button"
                variant="link"
              >
                {row.displayName}
              </Button>
            </TableCell>
            <TableCell>{getIncentivePositionLabel(row.positionCode)}</TableCell>
            <TableCell>{formatMoneyValue(row.target, input.locale)}</TableCell>
            <TableCell>{formatMoneyValue(row.actualPositiveSales, input.locale)}</TableCell>
            <TableCell>{formatPercentValue(row.achievementPct, input.locale)}</TableCell>
            <TableCell>{formatRateValue(row.rate, input.locale)}</TableCell>
            <TableCell>{formatMoneyValue(row.payableAmount, input.locale)}</TableCell>
            <TableCell>{formatMoneyValue(getRegionEffectiveEarnedAmount(row), input.locale)}</TableCell>
            <TableCell>
              {row.regionCorrection ? (
                <StoreStatusBadge tone={getCorrectionTone(row.regionCorrection)}>
                  {getCorrectionLabel(row.regionCorrection)}
                </StoreStatusBadge>
              ) : (
                <span className="tw:text-muted-foreground">Yok</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
            {getIncentivePositionLabel(row.positionCode)} / {formatPercentValue(row.achievementPct, input.locale)}
          </span>
          <span className="tw:mt-2 tw:block tw:text-sm tw:font-semibold tw:text-foreground">
            {formatMoneyValue(getRegionEffectiveEarnedAmount(row), input.locale)}
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
  const [finalAmount, setFinalAmount] = useState(getRegionEffectiveEarnedAmount(row) ?? '0.00')
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
  const normalizedFinalAmount = normalizeMoneyInput(finalAmount)
  const amountIsValid = normalizedFinalAmount !== null
  const noteIsValid = reasonNote.trim().length >= 3

  return (
    <SheetContent closeLabel="Kapat">
      <SheetHeader>
        <SheetTitle>{row.displayName}</SheetTitle>
        <SheetDescription>
          {projection.storeName} / {getIncentivePositionLabel(row.positionCode)}
        </SheetDescription>
      </SheetHeader>

      <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-4 tw:overflow-y-auto">
        <StoreInfoGrid
          className="tw:grid-cols-2"
          items={[
            { label: 'Hedef', value: formatMoneyValue(row.target, input.locale) },
            { label: 'Gerçekleşen', value: formatMoneyValue(row.actualPositiveSales, input.locale) },
            { label: 'Hedef %', value: formatPercentValue(row.achievementPct, input.locale), tone: progress >= 80 ? 'calm' : 'warning' },
            { label: 'Prim oranı', value: formatRateValue(row.rate, input.locale) },
          ]}
        />

        <div className="tw:rounded-xl tw:border tw:border-border tw:bg-card tw:p-4">
          <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
            <span className="tw:text-sm tw:font-medium tw:text-foreground">Hedef gerçekleşme</span>
            <span className="tw:text-sm tw:font-semibold tw:text-foreground">
              {formatPercentValue(row.achievementPct, input.locale)}
            </span>
          </div>
          <Progress className="tw:mt-3" value={progress} />
        </div>

        <div className="tw:rounded-xl tw:border tw:border-border tw:bg-muted/30 tw:p-4">
          <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">Hakediş özeti</span>
          <div className="tw:mt-3 tw:grid tw:gap-2">
            <AmountLine label="Hesaplanan" value={formatMoneyValue(row.payableAmount, input.locale)} />
            <AmountLine label="Düzeltme" value={formatMoneyValue(row.regionCorrection?.adjustmentAmount ?? row.correctionAmount, input.locale)} />
            <AmountLine label="Final prim" strong value={formatMoneyValue(getRegionEffectiveEarnedAmount(row), input.locale)} />
          </div>
        </div>

        <label className="tw:flex tw:flex-col tw:gap-1">
          <span className="tw:text-sm tw:font-medium tw:text-foreground">Final prim tutarı</span>
          <Input
            disabled={!canEdit}
            inputMode="decimal"
            onChange={(event) => setFinalAmount(event.target.value)}
            value={finalAmount}
          />
          {!amountIsValid ? (
            <span className="tw:text-xs tw:text-destructive">Geçerli bir tutar girin.</span>
          ) : null}
        </label>

        <label className="tw:flex tw:flex-col tw:gap-1">
          <span className="tw:text-sm tw:font-medium tw:text-foreground">Düzeltme notu</span>
          <Textarea
            disabled={!canEdit}
            onChange={(event) => setReasonNote(event.target.value)}
            placeholder="Düzeltme nedenini yazın"
            value={reasonNote}
          />
        </label>
      </div>

      <SheetFooter>
        <Button type="button" variant="outline" onClick={() => input.onOpenChange(false)}>
          İptal
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!canVoid || input.voidCorrectionMutation.isPending}
          onClick={() => {
            const correctionId = row.regionCorrection?.correctionId
            if (!correctionId) {
              setFinalAmount(row.payableAmount ?? '0.00')
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
          Eski değere dön
        </Button>
        <Button
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
          Kaydet
        </Button>
      </SheetFooter>
    </SheetContent>
  )
}

function AmountLine(input: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
      <span className="tw:text-sm tw:text-muted-foreground">{input.label}</span>
      <span className={cn('tw:text-sm tw:text-foreground', input.strong ? 'tw:font-semibold' : undefined)}>
        {input.value}
      </span>
    </div>
  )
}
