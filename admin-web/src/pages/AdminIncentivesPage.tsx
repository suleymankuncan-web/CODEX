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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
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
import { useLocalization } from '../features/localization/useLocalization'
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
  const { locale } = useLocalization()
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState(() => resolveCurrentPeriodKey())
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [adjustmentAmount, setAdjustmentAmount] = useState('')
  const [reasonNote, setReasonNote] = useState('')
  const [expandedRegionId, setExpandedRegionId] = useState<string | null>(null)
  const [returnNotes, setReturnNotes] = useState<Record<string, string>>({})
  const selectedYear = period.slice(0, 4)
  const selectedMonth = period.slice(5, 7)
  const yearOptions = useMemo(() => buildYearOptions(), [])
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-sales-target-incentives'] }),
        queryClient.invalidateQueries({ queryKey: ['store-sales-target-incentives'] }),
      ])
    },
  })
  const packageReviewMutation = useMutation({
    mutationFn: reviewAdminSalesTargetIncentiveRegionPackage,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-sales-target-incentives'] }),
        queryClient.invalidateQueries({ queryKey: ['store-sales-target-incentives'] }),
      ])
    },
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

  function updateYear(year: string) {
    setPeriod(`${year}-${selectedMonth}`)
  }

  function updateMonth(month: string) {
    setPeriod(`${selectedYear}-${month}`)
  }

  function exportRows() {
    exportAdminIncentiveRowsToExcel({
      locale,
      period: displayedPeriod,
      periodLabel: displayedPeriodLabel,
      rows,
    })
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
      <AdminSurfacePage ariaLabel="Prim yönetimi">
        <AdminSurfaceSkeleton />
      </AdminSurfacePage>
    )
  }

  if (incentivesQuery.isError) {
    return (
      <AdminSurfacePage ariaLabel="Prim yönetimi">
        <AdminStatePanel
          title="Prim verisi alınamadı"
          description={getErrorMessage(incentivesQuery.error)}
          tone="danger"
          action={(
            <Button type="button" variant="outline" onClick={() => incentivesQuery.refetch()}>
              <RefreshCcw size={14} />
              Yeniden dene
            </Button>
          )}
        />
      </AdminSurfacePage>
    )
  }

  return (
    <AdminSurfacePage ariaLabel="Prim yönetimi">
      <div className="tw:grid tw:gap-4" data-testid="admin-incentives-page">
        <AdminSurfaceHeader
          eyebrow="Satış hedef primi"
          title="Prim yönetimi"
          description="Şirket mağazaları için hesaplanan mağaza müdürü ve satış personeli primlerini dönem, hedef, satış ve hak ediş kırılımıyla izleyin."
          icon={<CircleDollarSign size={20} />}
          meta={(
            <>
              <AdminSurfaceBadge tone="cyan">Dönem: {displayedPeriodLabel}</AdminSurfaceBadge>
              <AdminSurfaceBadge tone="neutral">{displayedPeriodRange}</AdminSurfaceBadge>
              <AdminSurfaceBadge tone="success">Sadece şirket mağazası</AdminSurfaceBadge>
              <AdminSurfaceBadge tone="neutral">Kasa sorumlusu kapsam dışı</AdminSurfaceBadge>
            </>
          )}
          actions={(
            <>
              <Button type="button" variant="outline" disabled={rows.length === 0} onClick={exportRows}>
                <Download size={14} />
                Excel'e aktar
              </Button>
              <Button type="button" variant="outline" onClick={() => incentivesQuery.refetch()}>
                <RefreshCcw size={14} />
                Yenile
              </Button>
            </>
          )}
        />

        <AdminFilterBar>
          <div className="tw:grid tw:min-w-32 tw:gap-1 tw:text-xs tw:font-medium tw:text-muted-foreground">
            <span>Yıl</span>
            <Select value={selectedYear} onValueChange={updateYear}>
              <SelectTrigger id="admin-incentive-year" aria-label="Yıl" className="tw:w-full tw:min-w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="tw:grid tw:min-w-44 tw:gap-1 tw:text-xs tw:font-medium tw:text-muted-foreground">
            <span>Ay</span>
            <Select value={selectedMonth} onValueChange={updateMonth}>
              <SelectTrigger id="admin-incentive-month" aria-label="Ay" className="tw:w-full tw:min-w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodMonths(locale).map((month) => (
                  <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="tw:text-xs tw:leading-5 tw:text-muted-foreground" data-testid="admin-incentive-period-summary">
            Seçili dönem {displayedPeriodLabel}. Ocak, Şubat, Mart, Nisan ve Mayıs gibi geçmiş yüklemeler aynı filtreyle açılır.
          </span>
        </AdminFilterBar>

        <AdminMetricStrip
          items={[
            {
              id: 'stores',
              label: 'Mağaza',
              value: data?.projections.length ?? 0,
              description: 'Prim kapsamındaki şirket mağazaları.',
              icon: <Store size={18} />,
              tone: 'cyan',
            },
            {
              id: 'personnel-sales-source',
              label: 'Personel satış kaynağı',
              value: `${personnelSalesSourceCount}/${personnelRows.length}`,
              description: 'Satış tutarı bağlanan personel satırları.',
              icon: <TrendingUp size={18} />,
              tone: personnelRows.length === 0 || personnelSalesSourceCount < personnelRows.length ? 'warning' : 'success',
            },
            {
              id: 'payable',
              label: 'Toplam hak ediş',
              value: formatMoneyValue(payableTotal, locale),
              description: 'Düzeltme/final varsa nihai tutar kullanılır.',
              icon: <CircleDollarSign size={18} />,
              tone: 'success',
            },
            {
              id: 'corrections',
              label: 'Düzeltmeli satır',
              value: correctedRows.length,
              description: `${blockedCount} satır kaynak veya hesaplama bekliyor.`,
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
        />

        {rows.length === 0 ? (
          <AdminSurfaceEmpty
            title="Prim satırı bulunamadı"
            copy="Bu dönem için şirket mağazası prim hesabı yok veya kaynaklar henüz oluşmadı."
          />
        ) : (
          <div className="tw:grid tw:gap-4 tw:xl:grid-cols-[minmax(0,1fr)_360px]">
            <AdminSurfaceSection
              title="Prim satırları"
              description="Hedef, satış, gerçekleşme, hak ediş ve kayıtlı düzeltme etkisini aynı satırda izleyin."
              badge={<AdminSurfaceBadge tone="neutral">{rows.length} satır</AdminSurfaceBadge>}
              testId="admin-incentive-projections"
            >
              <div className="tw:overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mağaza</TableHead>
                      <TableHead>Personel</TableHead>
                      <TableHead>Görev</TableHead>
                      <TableHead className="tw:text-right">Hedef</TableHead>
                      <TableHead className="tw:text-right">Satış</TableHead>
                      <TableHead className="tw:text-right">Gerçekleşme</TableHead>
                      <TableHead className="tw:text-right">Hak ediş</TableHead>
                      <TableHead className="tw:text-right">Düzeltme</TableHead>
                      <TableHead className="tw:text-right">Nihai</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead className="tw:text-right">Aksiyon</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((item) => (
                      <TableRow key={item.id} data-testid="admin-incentive-row">
                        <TableCell className="tw:min-w-44 tw:font-medium">{item.projection.storeName}</TableCell>
                        <TableCell className="tw:min-w-44">{item.row.displayName}</TableCell>
                        <TableCell className="tw:min-w-36">{getIncentivePositionLabel(item.row.positionCode)}</TableCell>
                        <TableCell className="tw:text-right">{formatMoneyValue(item.row.target, locale)}</TableCell>
                        <TableCell className="tw:text-right">
                          <SalesAmountCell row={item.row} locale={locale} />
                        </TableCell>
                        <TableCell className="tw:text-right">{formatPercentValue(item.row.achievementPct, locale)}</TableCell>
                        <TableCell className="tw:text-right tw:font-semibold">{formatMoneyValue(item.row.payableAmount, locale)}</TableCell>
                        <TableCell className="tw:text-right">
                          <AdjustmentAmountsCell row={item.row} locale={locale} />
                        </TableCell>
                        <TableCell className="tw:text-right tw:font-semibold">{formatMoneyValue(item.row.finalAmount ?? item.row.payableAmount, locale)}</TableCell>
                        <TableCell>
                          <AdminSurfaceBadge tone={statusTone[item.row.status]}>
                            {getIncentiveStatusLabel(item.row.status)}
                          </AdminSurfaceBadge>
                        </TableCell>
                        <TableCell className="tw:text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant={selectedRow?.id === item.id ? 'default' : 'outline'}
                            onClick={() => setSelectedRowId(item.id)}
                          >
                            Seç
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </AdminSurfaceSection>

            <AdminSurfaceSection
              title="Manuel düzeltme"
              description="Düzeltme satış kaynağını değiştirmez; ayrı işlem kaydı oluşturur."
              badge={<AdminSurfaceBadge tone="warning">Yönetici yetkisi</AdminSurfaceBadge>}
              testId="admin-incentive-correction-panel"
            >
              {selectedRow ? (
                <form className="tw:grid tw:gap-3" onSubmit={submitCorrection}>
                  <SelectedRowSummary item={selectedRow} locale={locale} />
                  <label className="tw:grid tw:gap-1 tw:text-xs tw:font-medium tw:text-muted-foreground" htmlFor="admin-incentive-adjustment-amount">
                    Düzeltme tutarı
                    <Input
                      id="admin-incentive-adjustment-amount"
                      inputMode="decimal"
                      onChange={(event) => setAdjustmentAmount(event.target.value)}
                      placeholder="125.25 veya -50.00"
                      required
                      value={adjustmentAmount}
                    />
                  </label>
                  <label className="tw:grid tw:gap-1 tw:text-xs tw:font-medium tw:text-muted-foreground" htmlFor="admin-incentive-reason-note">
                    Gerekçe
                    <Textarea
                      id="admin-incentive-reason-note"
                      onChange={(event) => setReasonNote(event.target.value)}
                      placeholder="Düzeltme gerekçesini yazın"
                      required
                      value={reasonNote}
                    />
                  </label>
                  {correctionMutation.isError ? (
                    <AdminStatePanel
                      title="Düzeltme uygulanamadı"
                      description={getErrorMessage(correctionMutation.error)}
                      tone="danger"
                    />
                  ) : null}
                  {correctionMutation.isSuccess ? (
                    <AdminStatePanel
                      title="Düzeltme kaydedildi"
                      description="Prim listesi yeniden yüklendi; işlem kaydı oluşturuldu."
                      tone="success"
                    />
                  ) : null}
                  <AdminActionRow>
                    <Button type="submit" disabled={correctionMutation.isPending}>
                      <ShieldCheck size={14} />
                      {correctionMutation.isPending ? 'Kaydediliyor' : 'Düzeltme uygula'}
                    </Button>
                  </AdminActionRow>
                </form>
              ) : (
                <AdminSurfaceEmpty copy="Düzeltme için bir prim satırı seçin." />
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
}) {
  return (
    <div className="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3">
      <div>
        <div className="tw:text-xs tw:font-medium tw:text-muted-foreground">Seçili satır</div>
        <div className="tw:mt-1 tw:text-sm tw:font-semibold tw:text-foreground">{input.item.row.displayName}</div>
        <div className="tw:text-xs tw:text-muted-foreground">{input.item.projection.storeName}</div>
      </div>
      <div className="tw:grid tw:grid-cols-2 tw:gap-2 tw:text-xs">
        <SummaryValue label="Hedef" value={formatMoneyValue(input.item.row.target, input.locale)} />
        <SummaryValue label="Satış" value={formatMoneyValue(input.item.row.actualPositiveSales, input.locale)} />
        <SummaryValue label="Gerçekleşme" value={formatPercentValue(input.item.row.achievementPct, input.locale)} />
        <SummaryValue label="Oran" value={input.item.row.rate ?? '0.0000'} />
        <SummaryValue label="Hak ediş" value={formatMoneyValue(input.item.row.payableAmount, input.locale)} />
        <SummaryValue label="Nihai" value={formatMoneyValue(input.item.row.finalAmount ?? input.item.row.payableAmount, input.locale)} />
      </div>
    </div>
  )
}

function AdjustmentAmountsCell(input: {
  row: SalesTargetIncentiveRow
  locale: AppLocale
}) {
  const values = [
    input.row.correctionAmount
      ? { id: 'correction', label: 'Düzeltme', amount: input.row.correctionAmount }
      : null,
    input.row.adjustmentAmount
      ? { id: 'adjustment', label: 'Kapanış', amount: input.row.adjustmentAmount }
      : null,
  ].filter((value): value is { id: string; label: string; amount: string } => value !== null)

  if (values.length === 0) {
    return <>{formatMoneyValue(null, input.locale)}</>
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
}) {
  if (!input.row.actualPositiveSales) {
    return (
      <span className="tw:text-muted-foreground">
        Kaynak yok
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

function buildYearOptions(date = new Date()) {
  const currentYear = date.getFullYear()
  return [currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map(String)
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

function periodMonths(locale: AppLocale) {
  const labels = locale === 'tr'
    ? ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
    : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  return labels.map((label, index) => ({
    label,
    value: String(index + 1).padStart(2, '0'),
  }))
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
