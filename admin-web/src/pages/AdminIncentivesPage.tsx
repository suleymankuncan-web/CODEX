import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleDollarSign, RefreshCcw, ShieldCheck, SlidersHorizontal, Store, UserRound } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Textarea } from '../components/ui/textarea'
import {
  adminSalesTargetIncentivesQueryKey,
  createAdminSalesTargetIncentiveCorrection,
  getAdminSalesTargetIncentives,
  type SalesTargetIncentiveProjection,
  type SalesTargetIncentiveRow,
  type SalesTargetIncentiveStatus,
} from '../features/incentives/api'
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
  AdminActionRow,
  AdminFilterBar,
  AdminMetricStrip,
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  AdminSurfaceHeader,
  AdminSurfacePage,
  AdminSurfaceSection,
  AdminSurfaceSkeleton,
  type AdminSurfaceTone,
} from './admin-surface-primitives'

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

export function AdminIncentivesPage() {
  const { locale } = useLocalization()
  const queryClient = useQueryClient()
  const [period, setPeriod] = useState('')
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [adjustmentAmount, setAdjustmentAmount] = useState('')
  const [reasonNote, setReasonNote] = useState('')
  const trimmedPeriod = period.trim()
  const completePeriod = resolveCompletePeriodFilter(trimmedPeriod)
  const incentivesQuery = useQuery({
    queryKey: adminSalesTargetIncentivesQueryKey(completePeriod),
    queryFn: () => getAdminSalesTargetIncentives(completePeriod ? { period: completePeriod } : undefined),
    ...transientQueryRetryOptions,
  })
  const correctionMutation = useMutation({
    mutationFn: createAdminSalesTargetIncentiveCorrection,
    onSuccess: async () => {
      setAdjustmentAmount('')
      setReasonNote('')
      await queryClient.invalidateQueries({ queryKey: adminSalesTargetIncentivesQueryKey(completePeriod) })
    },
  })

  const data = incentivesQuery.data?.data ?? null
  const rows = useMemo(() => flattenRows(data?.projections ?? []), [data?.projections])
  const selectedRow = rows.find((item) => item.id === selectedRowId) ?? rows[0] ?? null
  const correctedRows = rows.filter((item) => item.row.correctionAmount || item.row.adjustmentAmount)
  const payableTotal = sumMoney(rows.map((item) => getPrimaryEarnedAmount(item.row)))
  const blockedCount = rows.filter((item) => item.row.status === 'blocked' || item.row.status === 'no_source').length

  function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedRow || correctionMutation.isPending) return

    correctionMutation.mutate({
      period: data?.period ?? trimmedPeriod,
      storeId: selectedRow.projection.storeId,
      employeeId: selectedRow.row.employeeId,
      participantType: selectedRow.row.participantType,
      adjustmentAmount: adjustmentAmount.trim(),
      reasonCode: 'manual_review',
      reasonNote: reasonNote.trim(),
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
          description="Şirket mağazaları için hesaplanan mağaza müdürü ve satış personeli prim projeksiyonlarını admin kapsamıyla izleyin; manuel düzeltmeleri audit kayıtlı olarak uygulayın."
          icon={<CircleDollarSign size={20} />}
          meta={(
            <>
              <AdminSurfaceBadge tone="cyan">Dönem: {data?.period ?? 'Güncel'}</AdminSurfaceBadge>
              <AdminSurfaceBadge tone="success">Sadece şirket mağazası</AdminSurfaceBadge>
              <AdminSurfaceBadge tone="neutral">Kasa sorumlusu kapsam dışı</AdminSurfaceBadge>
            </>
          )}
          actions={(
            <Button type="button" variant="outline" onClick={() => incentivesQuery.refetch()}>
              <RefreshCcw size={14} />
              Yenile
            </Button>
          )}
        />

        <AdminFilterBar>
          <label className="tw:grid tw:min-w-56 tw:gap-1 tw:text-xs tw:font-medium tw:text-muted-foreground" htmlFor="admin-incentive-period">
            Dönem
            <Input
              id="admin-incentive-period"
              inputMode="numeric"
              onChange={(event) => setPeriod(event.target.value)}
              placeholder={data?.period ?? '2026-06'}
              value={period}
            />
          </label>
          <span className="tw:text-xs tw:leading-5 tw:text-muted-foreground">
            Boş bırakılırsa backend güncel dönemi döndürür. Düzeltmeler seçili döneme yazılır.
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
              id: 'participants',
              label: 'Katılımcı',
              value: rows.length,
              description: 'Müdür ve satış ekibi satırları.',
              icon: <UserRound size={18} />,
              tone: 'neutral',
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

        {rows.length === 0 ? (
          <AdminSurfaceEmpty
            title="Prim satırı bulunamadı"
            copy="Bu dönem için şirket mağazası prim projeksiyonu yok veya kaynaklar henüz oluşmadı."
          />
        ) : (
          <div className="tw:grid tw:gap-4 tw:xl:grid-cols-[minmax(0,1fr)_360px]">
            <AdminSurfaceSection
              title="Prim projeksiyonları"
              description="Hedef, satış, oran, hak ediş ve audit’li düzeltme etkisini aynı satırda izleyin."
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
              description="Düzeltme satış/import kanıtını değiştirmez; ayrı adjustment ve audit kaydı oluşturur."
              badge={<AdminSurfaceBadge tone="warning">SUPER_ADMIN</AdminSurfaceBadge>}
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
                      description="Projeksiyon yeniden yüklendi; audit kaydı backend tarafından oluşturuldu."
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

function SummaryValue(input: { label: string; value: string }) {
  return (
    <div className="tw:rounded-md tw:border tw:border-border/70 tw:bg-card/70 tw:p-2">
      <div className="tw:text-muted-foreground">{input.label}</div>
      <div className="tw:mt-1 tw:font-semibold tw:text-foreground">{input.value}</div>
    </div>
  )
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

function resolveCompletePeriodFilter(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : undefined
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
