import { CalendarPicker } from '@/components/ui/calendar-picker'
import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CircleDollarSign,
  Download,
  RefreshCcw,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  TrendingUp,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Textarea } from '../components/ui/textarea'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  adminSalesTargetIncentivesQueryKey,
  createAdminSalesTargetIncentiveCorrection,
  getAdminSalesTargetIncentives,
  reviewAdminSalesTargetIncentiveRegionPackage,
  type SalesTargetIncentiveAdminRegionPackageSummary,
  type SalesTargetIncentiveProjection,
  type SalesTargetIncentiveRow,
  type SalesTargetIncentiveStatus,
} from '../features/incentives/api'
import { getSalesTargetIncentiveQueryIdentity } from '../features/incentives/query-identity'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { actionToast } from '../lib/action-toast'
import { getErrorMessage } from '../lib/format'
import { transientQueryRetryOptions } from '../lib/query-retry'
import type { AppLocale } from '../lib/i18n'
import {
  formatMoneyValue,
  formatPercentValue,
  getIncentivePositionLabel,
  getIncentiveStatusLabel,
  getPrimaryEarnedAmount,
} from './store-incentives-model'
import {
  AdminOperationalActionRow as AdminActionRow,
  AdminOperationalBadge as AdminSurfaceBadge,
  AdminOperationalEmpty as AdminSurfaceEmpty,
  AdminOperationalFilterBar as AdminFilterBar,
  AdminOperationalHeader as AdminSurfaceHeader,
  AdminOperationalMetrics as AdminMetricStrip,
  AdminOperationalPage as AdminSurfacePage,
  AdminOperationalSection as AdminSurfaceSection,
  AdminOperationalSkeleton as AdminSurfaceSkeleton,
  AdminOperationalState as AdminStatePanel,
  type AdminOperationalTone as AdminSurfaceTone,
} from './admin-operational-primitives'
import { AdminRegionPackageReviewSection } from './admin-incentive-region-packages'

type AdminIncentiveRow = {
  id: string
  projection: SalesTargetIncentiveProjection
  row: SalesTargetIncentiveRow
}

const statusTone: Record<SalesTargetIncentiveStatus, AdminSurfaceTone> = {
  adjusted: 'accent',
  blocked: 'danger',
  closed: 'success',
  corrected: 'accent',
  no_source: 'warning',
  projected: 'success',
}

const INCENTIVE_TIMEZONE = 'Europe/Istanbul'

export function AdminIncentivesPage(input: { authSummary: AuthSessionSummary | null }) {
  const { locale, t } = useLocalization()
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState(() => resolveCurrentPeriodKey())
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [adjustmentAmount, setAdjustmentAmount] = useState('')
  const [reasonNote, setReasonNote] = useState('')
  const [expandedRegionId, setExpandedRegionId] = useState<string | null>(null)
  const [returnNotes, setReturnNotes] = useState<Record<string, string>>({})
  const queryIdentity = useMemo(
    () => getSalesTargetIncentiveQueryIdentity(input.authSummary),
    [input.authSummary],
  )
  const incentivesQuery = useQuery({
    queryKey: adminSalesTargetIncentivesQueryKey(period, queryIdentity),
    queryFn: () => getAdminSalesTargetIncentives({ period }),
    ...transientQueryRetryOptions,
  })
  const correctionMutation = useMutation({
    mutationFn: createAdminSalesTargetIncentiveCorrection,
    onSuccess: async () => {
      setAdjustmentAmount('')
      setReasonNote('')
      actionToast.success(t('adminIncentives.toast.correctionSaved'))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-sales-target-incentives'] }),
        queryClient.invalidateQueries({ queryKey: ['store-sales-target-incentives'] }),
      ])
    },
    onError: (error) => actionToast.error(error, t('adminIncentives.toast.correctionError')),
  })
  const packageReviewMutation = useMutation({
    mutationFn: reviewAdminSalesTargetIncentiveRegionPackage,
    onSuccess: async (_response, variables) => {
      actionToast.success(variables.decision === 'approve'
        ? t('adminIncentives.toast.packageApproved')
        : t('adminIncentives.toast.packageReturned'))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-sales-target-incentives'] }),
        queryClient.invalidateQueries({ queryKey: ['store-sales-target-incentives'] }),
      ])
    },
    onError: (error) => actionToast.error(error, t('adminIncentives.toast.packageError')),
  })

  const data = incentivesQuery.data?.data ?? null
  const rows = useMemo(() => flattenRows(data?.projections ?? []), [data?.projections])
  const selectedRow = rows.find((item) => item.id === selectedRowId) ?? rows[0] ?? null
  const personnelRows = rows.filter((item) => item.row.participantType === 'personnel')
  const personnelSalesSourceCount = personnelRows.filter((item) => item.row.actualPositiveSales).length
  const correctedRows = rows.filter((item) => item.row.correctionAmount || item.row.adjustmentAmount)
  const regionPackages = data?.regionPackages ?? []
  const payableTotal = sumMoney(rows.map((item) => getPrimaryEarnedAmount(item.row)))
  const blockedCount = rows.filter((item) => item.row.status === 'blocked' || item.row.status === 'no_source').length
  const displayedPeriod = data?.period ?? period
  const displayedPeriodLabel = formatPeriodLabel(displayedPeriod, locale)
  const displayedPeriodRange = data
    ? formatDateRangeLabel(data.periodStart, data.periodEnd, locale)
    : formatPeriodBoundsLabel(displayedPeriod, locale)

  function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedRow || correctionMutation.isPending) return

    correctionMutation.mutate({
      period: data?.period ?? period,
      storeId: selectedRow.projection.storeId,
      employeeId: selectedRow.row.employeeId,
      participantType: selectedRow.row.participantType,
      adjustmentAmount: adjustmentAmount.trim(),
      reasonCode: 'manual_review',
      reasonNote: reasonNote.trim(),
    })
  }



  function exportRows() {
    exportAdminIncentiveRowsToExcel({
      locale,
      period: displayedPeriod,
      periodLabel: displayedPeriodLabel,
      rows,
    })
    actionToast.success(t('adminIncentives.toast.excelDownloaded'))
  }

  function submitPackageReview(
    packageSummary: SalesTargetIncentiveAdminRegionPackageSummary,
    decision: 'approve' | 'return',
  ) {
    if (packageReviewMutation.isPending) return
    const reviewNote = returnNotes[packageSummary.regionId]?.trim() ?? ''
    if (decision === 'return' && !reviewNote) return

    packageReviewMutation.mutate({
      period: displayedPeriod,
      regionId: packageSummary.regionId,
      decision,
      ...(reviewNote ? { reviewNote } : {}),
    })
  }

  if (incentivesQuery.isLoading) {
    return (
      <AdminSurfacePage ariaLabel={t('adminIncentives.aria')}>
        <AdminSurfaceSkeleton />
      </AdminSurfacePage>
    )
  }

  if (incentivesQuery.isError) {
    return (
      <AdminSurfacePage ariaLabel={t('adminIncentives.aria')}>
        <AdminStatePanel
          title={t('adminIncentives.errorTitle')}
          description={getErrorMessage(incentivesQuery.error)}
          tone="danger"
          action={(
            <Button type="button" variant="outline" onClick={() => incentivesQuery.refetch()}>
              <RefreshCcw size={14} />
              {t('adminIncentives.retry')}
            </Button>
          )}
        />
      </AdminSurfacePage>
    )
  }

  return (
    <AdminSurfacePage ariaLabel={t('adminIncentives.aria')}>
      <div className="tw:grid tw:gap-4" data-testid="admin-incentives-page">
        <AdminSurfaceHeader
          eyebrow={t('adminIncentives.eyebrow')}
          title={t('adminIncentives.title')}
          description={t('adminIncentives.description')}
          icon={<CircleDollarSign size={20} />}
          meta={(
            <>
              <AdminSurfaceBadge tone="cyan">
                {t('adminIncentives.periodBadge', { period: displayedPeriodLabel })}
              </AdminSurfaceBadge>
              <AdminSurfaceBadge tone="neutral">{displayedPeriodRange}</AdminSurfaceBadge>
              <AdminSurfaceBadge tone="success">{t('adminIncentives.companyOnly')}</AdminSurfaceBadge>
              <AdminSurfaceBadge tone="neutral">{t('adminIncentives.cashierExcluded')}</AdminSurfaceBadge>
            </>
          )}
          actions={(
            <>
              <Button type="button" variant="outline" disabled={rows.length === 0} onClick={exportRows}>
                <Download size={14} />
                {t('adminIncentives.export')}
              </Button>
              <Button type="button" variant="outline" onClick={() => incentivesQuery.refetch()}>
                <RefreshCcw size={14} />
                {t('adminIncentives.refresh')}
              </Button>
            </>
          )}
        />

        <AdminFilterBar>
          <CalendarPicker mode="month" value={period} locale={locale} onValueChange={setPeriod}
            ariaLabel={t('adminIncentives.periodAria')} />
          <span className="tw:text-xs tw:leading-5 tw:text-muted-foreground" data-testid="admin-incentive-period-summary">
            {t('adminIncentives.periodSummary', { period: displayedPeriodLabel })}
          </span>
        </AdminFilterBar>

        <AdminMetricStrip
          items={[
            {
              id: 'stores',
              label: t('adminIncentives.metric.stores'),
              value: data?.projections.length ?? 0,
              description: t('adminIncentives.metric.storesCopy'),
              icon: <Store size={18} />,
              tone: 'cyan',
            },
            {
              id: 'personnel-sales-source',
              label: t('adminIncentives.metric.personnelSource'),
              value: `${personnelSalesSourceCount}/${personnelRows.length}`,
              description: t('adminIncentives.metric.personnelSourceCopy'),
              icon: <TrendingUp size={18} />,
              tone: personnelRows.length === 0 || personnelSalesSourceCount < personnelRows.length ? 'warning' : 'success',
            },
            {
              id: 'payable',
              label: t('adminIncentives.metric.payable'),
              value: formatAdminMoneyValue(payableTotal, locale, t),
              description: t('adminIncentives.metric.payableCopy'),
              icon: <CircleDollarSign size={18} />,
              tone: 'success',
            },
            {
              id: 'corrections',
              label: t('adminIncentives.metric.corrected'),
              value: correctedRows.length,
              description: t('adminIncentives.metric.blockedCopy', { count: blockedCount }),
              icon: <SlidersHorizontal size={18} />,
              tone: correctedRows.length > 0 ? 'accent' : 'neutral',
            },
          ]}
        />

        <AdminRegionPackageReviewSection
          expandedRegionId={expandedRegionId}
          locale={locale}
          mutation={packageReviewMutation}
          onReview={submitPackageReview}
          onReturnNoteChange={(regionId, note) =>
            setReturnNotes((current) => ({ ...current, [regionId]: note }))
          }
          onToggleRegion={(regionId) =>
            setExpandedRegionId((current) => current === regionId ? null : regionId)
          }
          packages={regionPackages}
          projections={data?.projections ?? []}
          returnNotes={returnNotes}
          t={t}
        />

        {rows.length === 0 ? (
          <AdminSurfaceEmpty
            title={t('adminIncentives.emptyTitle')}
            copy={t('adminIncentives.emptyCopy')}
          />
        ) : (
          <div className="tw:grid tw:gap-4 tw:xl:grid-cols-[minmax(0,1fr)_360px]">
            <AdminSurfaceSection
              title={t('adminIncentives.rowsTitle')}
              description={t('adminIncentives.rowsCopy')}
              badge={(
                <AdminSurfaceBadge tone="neutral">
                  {t('adminIncentives.rowCount', { count: rows.length })}
                </AdminSurfaceBadge>
              )}
              testId="admin-incentive-projections"
            >
              <div className="tw:overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('adminIncentives.column.store')}</TableHead>
                      <TableHead>{t('adminIncentives.column.personnel')}</TableHead>
                      <TableHead>{t('adminIncentives.column.position')}</TableHead>
                      <TableHead className="tw:text-right">{t('adminIncentives.column.target')}</TableHead>
                      <TableHead className="tw:text-right">{t('adminIncentives.column.sales')}</TableHead>
                      <TableHead className="tw:text-right">{t('adminIncentives.column.achievement')}</TableHead>
                      <TableHead className="tw:text-right">{t('adminIncentives.column.earned')}</TableHead>
                      <TableHead className="tw:text-right">{t('adminIncentives.column.correction')}</TableHead>
                      <TableHead className="tw:text-right">{t('adminIncentives.column.final')}</TableHead>
                      <TableHead>{t('adminIncentives.column.status')}</TableHead>
                      <TableHead className="tw:text-right">{t('adminIncentives.column.action')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((item) => (
                      <TableRow key={item.id} data-testid="admin-incentive-row">
                        <TableCell className="tw:min-w-44 tw:font-medium">{item.projection.storeName}</TableCell>
                        <TableCell className="tw:min-w-44">{item.row.displayName}</TableCell>
                        <TableCell className="tw:min-w-36">
                          {getAdminIncentivePositionLabel(item.row.positionCode, t)}
                        </TableCell>
                        <TableCell className="tw:text-right">
                          {formatAdminMoneyValue(item.row.target, locale, t)}
                        </TableCell>
                        <TableCell className="tw:text-right">
                          <SalesAmountCell row={item.row} locale={locale} t={t} />
                        </TableCell>
                        <TableCell className="tw:text-right">
                          {formatAdminPercentValue(item.row.achievementPct, locale, t)}
                        </TableCell>
                        <TableCell className="tw:text-right tw:font-semibold">
                          {formatAdminMoneyValue(item.row.payableAmount, locale, t)}
                        </TableCell>
                        <TableCell className="tw:text-right">
                          <AdjustmentAmountsCell row={item.row} locale={locale} t={t} />
                        </TableCell>
                        <TableCell className="tw:text-right tw:font-semibold">
                          {formatAdminMoneyValue(item.row.finalAmount ?? item.row.payableAmount, locale, t)}
                        </TableCell>
                        <TableCell>
                          <AdminSurfaceBadge tone={statusTone[item.row.status]}>
                            {getAdminIncentiveStatusLabel(item.row.status, t)}
                          </AdminSurfaceBadge>
                        </TableCell>
                        <TableCell className="tw:text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant={selectedRow?.id === item.id ? 'default' : 'outline'}
                            onClick={() => setSelectedRowId(item.id)}
                          >
                            {t('adminIncentives.select')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </AdminSurfaceSection>

            <AdminSurfaceSection
              title={t('adminIncentives.correctionTitle')}
              description={t('adminIncentives.correctionCopy')}
              badge={(
                <AdminSurfaceBadge tone="warning">
                  {t('adminIncentives.managerAuthority')}
                </AdminSurfaceBadge>
              )}
              testId="admin-incentive-correction-panel"
            >
              {selectedRow ? (
                <form className="tw:grid tw:gap-3" onSubmit={submitCorrection}>
                  <SelectedRowSummary item={selectedRow} locale={locale} t={t} />
                  <label className="tw:grid tw:gap-1 tw:text-xs tw:font-medium tw:text-muted-foreground" htmlFor="admin-incentive-adjustment-amount">
                    {t('adminIncentives.adjustmentAmount')}
                    <Input
                      id="admin-incentive-adjustment-amount"
                      inputMode="decimal"
                      onChange={(event) => setAdjustmentAmount(event.target.value)}
                      placeholder={t('adminIncentives.adjustmentPlaceholder')}
                      required
                      value={adjustmentAmount}
                    />
                  </label>
                  <label className="tw:grid tw:gap-1 tw:text-xs tw:font-medium tw:text-muted-foreground" htmlFor="admin-incentive-reason-note">
                    {t('adminIncentives.reason')}
                    <Textarea
                      id="admin-incentive-reason-note"
                      onChange={(event) => setReasonNote(event.target.value)}
                      placeholder={t('adminIncentives.reasonPlaceholder')}
                      required
                      value={reasonNote}
                    />
                  </label>
                  {correctionMutation.isError ? (
                    <AdminStatePanel
                      title={t('adminIncentives.correctionErrorTitle')}
                      description={getErrorMessage(correctionMutation.error)}
                      tone="danger"
                    />
                  ) : null}
                  {correctionMutation.isSuccess ? (
                    <AdminStatePanel
                      title={t('adminIncentives.correctionSuccessTitle')}
                      description={t('adminIncentives.correctionSuccessCopy')}
                      tone="success"
                    />
                  ) : null}
                  <AdminActionRow>
                    <Button type="submit" disabled={correctionMutation.isPending}>
                      <ShieldCheck size={14} />
                      {correctionMutation.isPending
                        ? t('adminIncentives.saving')
                        : t('adminIncentives.applyCorrection')}
                    </Button>
                  </AdminActionRow>
                </form>
              ) : (
                <AdminSurfaceEmpty copy={t('adminIncentives.selectRowEmpty')} />
              )}
            </AdminSurfaceSection>
          </div>
        )}
      </div>
    </AdminSurfacePage>
  )
}

function SelectedRowSummary(input: {
  item: AdminIncentiveRow
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <div className="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3">
      <div>
        <div className="tw:text-xs tw:font-medium tw:text-muted-foreground">
          {input.t('adminIncentives.selectedRow')}
        </div>
        <div className="tw:mt-1 tw:text-sm tw:font-semibold tw:text-foreground">{input.item.row.displayName}</div>
        <div className="tw:text-xs tw:text-muted-foreground">{input.item.projection.storeName}</div>
      </div>
      <div className="tw:grid tw:grid-cols-2 tw:gap-2 tw:text-xs">
        <SummaryValue label={input.t('adminIncentives.column.target')} value={formatAdminMoneyValue(input.item.row.target, input.locale, input.t)} />
        <SummaryValue label={input.t('adminIncentives.column.sales')} value={formatAdminMoneyValue(input.item.row.actualPositiveSales, input.locale, input.t)} />
        <SummaryValue label={input.t('adminIncentives.column.achievement')} value={formatAdminPercentValue(input.item.row.achievementPct, input.locale, input.t)} />
        <SummaryValue label={input.t('adminIncentives.summary.rate')} value={input.item.row.rate ?? '0.0000'} />
        <SummaryValue label={input.t('adminIncentives.column.earned')} value={formatAdminMoneyValue(input.item.row.payableAmount, input.locale, input.t)} />
        <SummaryValue label={input.t('adminIncentives.column.final')} value={formatAdminMoneyValue(input.item.row.finalAmount ?? input.item.row.payableAmount, input.locale, input.t)} />
      </div>
    </div>
  )
}

function AdjustmentAmountsCell(input: {
  row: SalesTargetIncentiveRow
  locale: AppLocale
  t: TranslateFunction
}) {
  const values = [
    input.row.correctionAmount
      ? { id: 'correction', label: input.t('adminIncentives.adjustment.correction'), amount: input.row.correctionAmount }
      : null,
    input.row.adjustmentAmount
      ? { id: 'adjustment', label: input.t('adminIncentives.adjustment.closing'), amount: input.row.adjustmentAmount }
      : null,
  ].filter((value): value is { id: string; label: string; amount: string } => value !== null)

  if (values.length === 0) {
    return <>{input.t('adminIncentives.noSource')}</>
  }

  return (
    <div className="tw:grid tw:gap-1">
      {values.map((value) => (
        <div key={value.id} className="tw:grid tw:gap-0.5">
          <span className="tw:text-[11px] tw:font-medium tw:text-muted-foreground">{value.label}</span>
          <span className="tw:font-medium">{formatMoneyValue(value.amount, input.locale)}</span>
        </div>
      ))}
    </div>
  )
}

function SalesAmountCell(input: {
  row: SalesTargetIncentiveRow
  locale: AppLocale
  t: TranslateFunction
}) {
  if (!input.row.actualPositiveSales) {
    return (
      <span className="tw:text-muted-foreground">
        {input.t('adminIncentives.noSource')}
      </span>
    )
  }

  return (
    <span className="tw:font-medium">
      {formatMoneyValue(input.row.actualPositiveSales, input.locale)}
    </span>
  )
}

function SummaryValue(input: { label: string; value: string }) {
  return (
    <div className="tw:rounded-md tw:border tw:border-border/70 tw:bg-card/70 tw:p-2">
      <div className="tw:text-muted-foreground">{input.label}</div>
      <div className="tw:mt-1 tw:font-semibold tw:text-foreground">{input.value}</div>
    </div>
  )
}

function resolveCurrentPeriodKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    timeZone: INCENTIVE_TIMEZONE,
    year: 'numeric',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value

  return year && month
    ? `${year}-${month}`
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatPeriodLabel(period: string, locale: AppLocale) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period)
  if (!match) return period

  const year = Number(match[1])
  const month = Number(match[2])
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

function formatDateRangeLabel(periodStart: string, periodEnd: string, locale: AppLocale) {
  const formatter = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  })
  return `${formatter.format(new Date(`${periodStart}T00:00:00.000Z`))} - ${formatter.format(new Date(`${periodEnd}T00:00:00.000Z`))}`
}

function formatPeriodBoundsLabel(period: string, locale: AppLocale) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period)
  if (!match) return period
  const year = Number(match[1])
  const month = Number(match[2])
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return formatDateRangeLabel(`${period}-01`, `${period}-${String(lastDay).padStart(2, '0')}`, locale)
}

function getAdminIncentiveStatusLabel(
  status: SalesTargetIncentiveStatus,
  t: TranslateFunction,
) {
  const labels = {
    adjusted: t('adminIncentives.status.adjusted'),
    blocked: t('adminIncentives.status.blocked'),
    closed: t('adminIncentives.status.closed'),
    corrected: t('adminIncentives.status.corrected'),
    no_source: t('adminIncentives.status.noSource'),
    projected: t('adminIncentives.status.projected'),
  } satisfies Record<SalesTargetIncentiveStatus, string>
  return labels[status] ?? status
}

function getAdminIncentivePositionLabel(
  positionCode: SalesTargetIncentiveRow['positionCode'],
  t: TranslateFunction,
) {
  const labels = {
    ASSISTANT_MANAGER: t('adminIncentives.position.assistantManager'),
    SALES_ASSOCIATE: t('adminIncentives.position.salesAssociate'),
    SENIOR_SALES_CONSULTANT: t('adminIncentives.position.seniorSalesConsultant'),
    STORE_MANAGER: t('adminIncentives.position.storeManager'),
  } satisfies Record<SalesTargetIncentiveRow['positionCode'], string>
  return labels[positionCode] ?? positionCode
}

function formatAdminMoneyValue(
  value: string | null | undefined,
  locale: AppLocale,
  t: TranslateFunction,
) {
  const formatted = formatMoneyValue(value, locale)
  return formatted === formatMoneyValue(null, locale)
    ? t('adminIncentives.noSource')
    : formatted
}

function formatAdminPercentValue(
  value: string | null | undefined,
  locale: AppLocale,
  t: TranslateFunction,
) {
  const formatted = formatPercentValue(value, locale)
  return formatted === formatPercentValue(null, locale)
    ? t('adminIncentives.noSource')
    : formatted
}

function flattenRows(projections: SalesTargetIncentiveProjection[]): AdminIncentiveRow[] {
  return projections.flatMap((projection) =>
    projection.rows.map((row) => ({
      id: `${projection.storeId}:${row.employeeId}:${row.participantType}`,
      projection,
      row,
    })),
  )
}

function exportAdminIncentiveRowsToExcel(input: {
  locale: AppLocale
  period: string
  periodLabel: string
  rows: AdminIncentiveRow[]
}) {
  if (input.rows.length === 0) return

  const tableRows = input.rows.map((item) => ({
    Dönem: input.periodLabel,
    'Dönem kodu': input.period,
    Mağaza: item.projection.storeName,
    Personel: item.row.displayName,
    Görev: getIncentivePositionLabel(item.row.positionCode),
    'Katılımcı tipi': item.row.participantType === 'store_manager' ? 'Mağaza müdürü' : 'Satış personeli',
    Hedef: formatMoneyValue(item.row.target, input.locale),
    Satış: formatMoneyValue(item.row.actualPositiveSales, input.locale),
    Gerçekleşme: formatPercentValue(item.row.achievementPct, input.locale),
    'Mağaza gerçekleşmesi': formatPercentValue(item.row.storeAchievementPct, input.locale),
    'Mağaza kapısı': item.row.storeGatePassed === null ? 'Uygulanmaz' : item.row.storeGatePassed ? 'Geçildi' : 'Bekliyor',
    'Prim oranı': item.row.rate ?? '0.0000',
    'Ham hak ediş': formatMoneyValue(item.row.rawEarnedAmount, input.locale),
    'Hak ediş': formatMoneyValue(item.row.payableAmount, input.locale),
    Düzeltme: formatMoneyValue(item.row.correctionAmount, input.locale),
    'Kapanış düzeltmesi': formatMoneyValue(item.row.adjustmentAmount, input.locale),
    Nihai: formatMoneyValue(item.row.finalAmount ?? item.row.payableAmount, input.locale),
    Durum: getIncentiveStatusLabel(item.row.status),
    Açıklama: item.row.explanation,
  }))
  const headers = Object.keys(tableRows[0] ?? {})
  const cells = tableRows.map((row) =>
    `<tr>${headers.map((header) => `<td>${escapeHtml(String(row[header as keyof typeof row]))}</td>`).join('')}</tr>`,
  ).join('')
  const html = [
    '<!doctype html>',
    '<html>',
    '<head><meta charset="utf-8" />',
    '<style>table{border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px}th,td{border:1px solid #d9e2ec;padding:6px 8px;mso-number-format:"\\@"}th{background:#eaf5fb;font-weight:700}</style>',
    '</head>',
    '<body>',
    `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${cells}</tbody></table>`,
    '</body>',
    '</html>',
  ].join('')
  const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `prim-raporu-${input.period}.xls`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0)
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function sumMoney(values: Array<string | null>) {
  let totalCents = 0n

  for (const value of values) {
    if (!value) continue
    totalCents += decimalStringToCents(value)
  }

  const sign = totalCents < 0n ? '-' : ''
  const absolute = totalCents < 0n ? -totalCents : totalCents
  const integer = absolute / 100n
  const cents = absolute % 100n
  return `${sign}${integer.toString()}.${cents.toString().padStart(2, '0')}`
}

function decimalStringToCents(value: string) {
  const trimmed = value.trim()
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(trimmed)
  if (!match) return 0n
  const integerText = match[2]
  if (!integerText) return 0n
  const sign = match[1] ? -1n : 1n
  const integer = BigInt(integerText)
  const fraction = (match[3] ?? '').padEnd(2, '0').slice(0, 2)
  return sign * ((integer * 100n) + BigInt(fraction || '0'))
}
