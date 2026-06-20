import { useState } from 'react'
import { type UseMutationResult } from '@tanstack/react-query'
import {
  CalendarDays,
  ClipboardCheck,
  CircleDollarSign,
  Download,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  Store,
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
  StoreEmptyState,
  StoreErrorState,
  StoreInfoGrid,
  StoreMetricCard,
  StoreMetricGrid,
  StoreSectionCard,
  StoreStatusBadge,
  StoreSurfaceHeader,
  StoreSurfacePage,
  StoreToolbar,
  StoreToolbarField,
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
      ariaLabel="Primler"
      testId="store-incentives-page"
    >
      <StoreCommandBar
        title="Prim Merkezi"
        description="Bölge hakediş kontrol ekranı"
        end={(
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            <PeriodPicker period={input.selectedPeriod} onChange={input.onPeriodChange} />
            <Button type="button" variant="outline" onClick={() => undefined}>
              <RefreshCw data-icon="inline-start" />
              Yenile
            </Button>
          </div>
        )}
      />

      <StoreSurfaceHeader
        title="Primler"
        description="Mağaza ve personel hakedişleri, düzeltmeler ve onay süreci."
        icon={<CircleDollarSign size={23} />}
        actions={[
          {
            label: 'Dönem seç',
            icon: <CalendarDays data-icon="inline-start" />,
            onClick: () => undefined,
            variant: 'outline',
          },
          {
            label: 'Excel dışa aktar',
            icon: <Download data-icon="inline-start" />,
            onClick: () => undefined,
            variant: 'outline',
          },
          {
            label: workflow?.regionPackageStatus === 'admin_returned' ? 'Tekrar gönder' : 'Onaya gönder',
            icon: <Send data-icon="inline-start" />,
            disabled: !packageCanSubmit || input.mutationState.submitPackageMutation.isPending,
            onClick: () => setSubmitDialogOpen(true),
          },
        ]}
      />

      <StoreMetricGrid ariaLabel="Bölge prim özeti">
        <StoreMetricCard
          title="Toplam hakediş"
          value={formatMoneyValue(summary.payableTotal, input.locale)}
          note="Mağaza müdürü ve ekip toplamı"
          icon={<WalletCards size={20} />}
          tone="plum"
        />
        <StoreMetricCard
          title="Prim hakeden personel"
          value={summary.earningPersonnelCount}
          note="%80 kapısı geçen mağazalarda"
          icon={<UsersRound size={20} />}
          tone="mint"
        />
        <StoreMetricCard
          title="Düzeltme yapılan kayıt"
          value={summary.correctionCount}
          note="Notlu değişiklikler"
          icon={<SlidersHorizontal size={20} />}
          tone="amber"
        />
        <StoreMetricCard
          title="Kontrol bekleyen mağaza"
          value={summary.pendingReviewCount}
          note="Gönderim öncesi kontrol"
          icon={<ClipboardCheck size={20} />}
          tone="cyan"
        />
      </StoreMetricGrid>

      {mutationError ? (
        <StoreErrorState
          title="İşlem tamamlanamadı"
          description={getErrorMessage(mutationError)}
        />
      ) : null}

      <StoreToolbar>
        <div className="tw:grid tw:gap-3 tw:lg:grid-cols-[minmax(18rem,0.95fr)_minmax(18rem,1.2fr)_minmax(13rem,0.85fr)]">
          <StoreToolbarField label="Dönem">
            <PeriodPicker period={input.selectedPeriod} onChange={input.onPeriodChange} />
          </StoreToolbarField>
          <StoreToolbarField label="Mağaza ara">
            <span className="tw:relative tw:block">
              <Search
                size={16}
                className="tw:pointer-events-none tw:absolute tw:left-0 tw:top-1/2 tw:-translate-y-1/2 tw:text-muted-foreground"
              />
              <Input aria-label="Mağaza ara" className="tw:h-8 tw:border-0 tw:bg-transparent tw:pl-7 tw:shadow-none tw:focus-visible:ring-0" onChange={(event) => setSearch(event.target.value)} placeholder="Mağaza ara" value={search} />
            </span>
          </StoreToolbarField>
          <StoreToolbarField label="Durum">
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StoreStatusFilter)}
            >
              <SelectTrigger aria-label="Durum filtresi" className="tw:h-8 tw:border-0 tw:bg-transparent tw:px-0 tw:shadow-none tw:focus:ring-0">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="pending_review">Kontrol edilmeli</SelectItem>
                <SelectItem value="reviewed">Kontrol edildi</SelectItem>
                <SelectItem value="earning">Hakediş var</SelectItem>
                <SelectItem value="no_earning">Hakediş yok</SelectItem>
                <SelectItem value="corrected">Düzeltildi</SelectItem>
              </SelectContent>
            </Select>
          </StoreToolbarField>
        </div>
      </StoreToolbar>

      <StoreSectionCard
        ariaLabel="Mağaza prim hakedişleri"
        title="Mağaza hakedişleri"
        description="Mağazaya tıklayın, personel satırlarını kontrol edin."
        badge={{ label: `${summary.storeCount} şirket mağazası`, tone: 'accent' }}
      >
        {visibleProjections.length > 0 ? (
          <div className="tw:flex tw:flex-col tw:gap-3">
            {visibleProjections.map((projection) => (
              <RegionStoreCard
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
        ) : (
          <StoreEmptyState description="Bu filtrelerle eşleşen mağaza yok." />
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

function RegionStoreCard(input: {
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
  const achievementProgress = toProgressPercent(input.projection.storeAchievementPct) ?? 0

  return (
    <article
      className={cn(
        'tw:overflow-hidden tw:rounded-2xl tw:border tw:border-border tw:bg-card/90 tw:shadow-sm tw:transition-colors',
        input.expanded ? 'tw:shadow-xl tw:ring-1 tw:ring-primary/15' : undefined,
      )}
    >
      <div className="tw:grid tw:min-h-[82px] tw:gap-3 tw:p-3.5 tw:lg:grid-cols-[minmax(13.75rem,1.1fr)_repeat(5,minmax(7.5rem,0.72fr))_minmax(10.5rem,auto)] tw:lg:items-center">
        <div
          aria-expanded={input.expanded}
          className="tw:flex tw:min-w-0 tw:items-center tw:gap-3 tw:text-left"
          onClick={input.onOpenChange}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              input.onOpenChange()
            }
          }}
          role="button"
          tabIndex={0}
        >
          <span className="tw:flex tw:size-[38px] tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:bg-primary/10 tw:text-primary">
            <Store size={17} />
          </span>
          <span className="tw:min-w-0">
            <span className="tw:block tw:text-sm tw:font-semibold tw:text-foreground">
              {input.projection.storeName}
            </span>
            <span className="tw:mt-0.5 tw:block tw:text-xs tw:text-muted-foreground">
              Şirket mağazası
            </span>
          </span>
        </div>
        <StoreKv label="Mağaza hedefi" value={formatMoneyValue(input.projection.storeTarget, input.locale)} />
        <StoreKv label="Gerçekleşen" value={formatMoneyValue(input.projection.storeActualNetSales, input.locale)} />
        <div className="tw:grid tw:gap-1">
          <StoreKv label="Hedef" value={formatPercentValue(input.projection.storeAchievementPct, input.locale)} />
          <Progress value={achievementProgress} />
        </div>
        <StoreKv label="Müdür primi" value={formatMoneyValue(getRegionEffectiveEarnedAmount(manager), input.locale)} />
        <StoreKv label="Ekip primi" value={formatMoneyValue(personnelTotal, input.locale)} />
        <div className="tw:flex tw:flex-col tw:items-start tw:gap-2 tw:lg:items-end">
          <StoreStatusBadge tone={status.tone}>{status.label}</StoreStatusBadge>
          <label className="tw:inline-flex tw:min-h-8 tw:items-center tw:gap-2 tw:rounded-full tw:border tw:border-chart-4/30 tw:bg-chart-4/10 tw:px-3 tw:text-xs tw:font-semibold tw:text-chart-4">
            <Checkbox
              checked={review.storeReviewStatus === 'reviewed'}
              disabled={input.reviewDisabled}
              onCheckedChange={(checked) =>
                input.onReviewChange(checked === true ? 'reviewed' : 'pending_review')
              }
            />
            Kontrol edildi
          </label>
        </div>
      </div>
      {input.expanded ? (
        <div className="tw:border-t tw:border-border tw:bg-muted/20 tw:p-3">
          <RegionPersonnelTable
            locale={input.locale}
            onSelectRow={input.onSelectRow}
            rows={[...(manager ? [manager] : []), ...personnel]}
          />
        </div>
      ) : null}
    </article>
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
  if (input.rows.length === 0) {
    return <StoreEmptyState description="Bu mağaza için prim satırı yok." />
  }

  return (
    <>
      <div className="tw:hidden tw:lg:block">
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
                <TableCell>
                  <FinalAmountCell locale={input.locale} row={row} />
                </TableCell>
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
  const hasCorrection = Boolean(input.row.regionCorrection && input.row.regionCorrection.status !== 'voided')

  if (!hasCorrection || effectiveAmount === input.row.payableAmount) {
    return <span>{formatMoneyValue(effectiveAmount, input.locale)}</span>
  }

  return (
    <span className="tw:flex tw:flex-col tw:gap-0.5">
      <s className="tw:text-xs tw:text-muted-foreground">{formatMoneyValue(input.row.payableAmount, input.locale)}</s>
      <strong className="tw:text-sm tw:font-semibold tw:text-foreground">{formatMoneyValue(effectiveAmount, input.locale)}</strong>
    </span>
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
          <span className="tw:mt-2 tw:flex tw:items-center tw:justify-between tw:gap-3">
            <span className="tw:text-sm tw:font-semibold tw:text-foreground">
              {formatMoneyValue(getRegionEffectiveEarnedAmount(row), input.locale)}
            </span>
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
  const adjustmentAmount = row.regionCorrection?.adjustmentAmount ?? row.correctionAmount

  return (
    <SheetContent
      closeLabel="Kapat"
      className="tw:inset-x-0 tw:bottom-0 tw:top-auto tw:h-[min(88vh,740px)] tw:max-w-none tw:rounded-b-none tw:rounded-t-[18px] tw:bg-card tw:p-0 tw:shadow-xl tw:sm:inset-x-auto tw:sm:bottom-3.5 tw:sm:right-3.5 tw:sm:top-3.5 tw:sm:h-auto tw:sm:w-[min(440px,calc(100vw-28px))] tw:sm:rounded-[18px]"
    >
      <SheetHeader className="tw:border-b tw:border-border tw:p-[18px]">
        <SheetTitle>{row.displayName}</SheetTitle>
        <SheetDescription>
          {getIncentivePositionLabel(row.positionCode)}, {projection.storeName}
        </SheetDescription>
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          <StoreStatusBadge tone={progress >= 80 ? 'calm' : 'warning'}>
            Hedef {formatPercentValue(row.achievementPct, input.locale)}
          </StoreStatusBadge>
          {row.regionCorrection ? (
            <StoreStatusBadge tone={getCorrectionTone(row.regionCorrection)}>
              {getCorrectionLabel(row.regionCorrection)}
            </StoreStatusBadge>
          ) : (
            <StoreStatusBadge tone="neutral">Düzeltme yok</StoreStatusBadge>
          )}
        </div>
      </SheetHeader>

      <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-3 tw:overflow-y-auto tw:px-[18px] tw:py-4">
        <section className="tw:rounded-xl tw:border tw:border-border tw:bg-muted/30 tw:p-4">
          <h3 className="tw:text-sm tw:font-semibold tw:text-foreground">Hakediş özeti</h3>
          <div className="tw:mt-3 tw:rounded-lg tw:border tw:border-border tw:bg-card tw:p-3">
            <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
              <span className="tw:text-sm tw:font-medium tw:text-foreground">Hedef gerçekleşme</span>
              <strong className="tw:text-sm tw:font-semibold tw:text-foreground">
                {formatPercentValue(row.achievementPct, input.locale)}
              </strong>
            </div>
            <Progress className="tw:mt-3" value={progress} />
          </div>
          <div className="tw:mt-3 tw:grid tw:gap-2">
            <AmountLine label="Hedef" value={formatMoneyValue(row.target, input.locale)} />
            <AmountLine label="Gerçekleşen" value={formatMoneyValue(row.actualPositiveSales, input.locale)} />
            <AmountLine label="Prim oranı" value={formatRateValue(row.rate, input.locale)} />
            <AmountLine label="Hesaplanan prim" value={formatMoneyValue(row.payableAmount, input.locale)} />
            <AmountLine
              label="Düzeltme"
              value={adjustmentAmount ? formatMoneyValue(adjustmentAmount, input.locale) : 'Yok'}
            />
            <AmountLine label="Final prim" strong value={formatMoneyValue(getRegionEffectiveEarnedAmount(row), input.locale)} />
          </div>
        </section>

        <section className="tw:grid tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-card tw:p-4">
          <h3 className="tw:text-sm tw:font-semibold tw:text-foreground">Düzeltme</h3>
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
        </section>
      </div>

      <SheetFooter className="tw:mx-0 tw:mb-0">
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
