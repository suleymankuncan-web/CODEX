import { CircleDollarSign, Clock3, ShieldCheck, Target, TrendingUp, WalletCards } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type {
  SalesTargetIncentiveProjection,
  SalesTargetIncentiveRow,
} from '../features/incentives/api'
import type { AppLocale } from '../lib/i18n'
import {
  formatDateTimeValue,
  formatMoneyValue,
  formatPercentValue,
  formatRateValue,
  getIncentivePositionLabel,
  getIncentiveStatusLabel,
  getIncentiveStatusTone,
  getManagerRow,
  getPersonnelRows,
  getPrimaryEarnedAmount,
  getRevisionLabel,
  managerRateBrackets,
  personnelRateBrackets,
  toProgressPercent,
  type IncentiveRateBracket,
} from './store-incentives-model'
import {
  StoreEmptyState,
  StoreInfoGrid,
  StoreMetricCard,
  StoreMetricGrid,
  StoreSectionCard,
  StoreStackedList,
  StoreStackedRow,
  StoreStatusBadge,
} from './store-surface-primitives'

export function StoreMeIncentiveCard(input: {
  locale: AppLocale
  projection: SalesTargetIncentiveProjection
}) {
  const row = input.projection.rows[0] ?? null
  if (!row) return null

  return (
    <StoreSectionCard
      title="Hak edilen prim"
      description="Güncel ay satış hedefi ve mağaza kapısı üzerinden hesaplanan prim görünümü."
      badge={{ label: getIncentiveStatusLabel(row.status), tone: getIncentiveStatusTone(row.status) }}
      ariaLabel="Hak edilen prim"
      testId="store-me-incentive-card"
    >
      <StoreMetricGrid className="tw:xl:grid-cols-4" ariaLabel="Kişisel prim özeti">
        <StoreMetricCard
          title="Hak ediş"
          value={formatMoneyValue(getPrimaryEarnedAmount(row), input.locale)}
          note="Kesin ödeme ay kapanışı sonrası netleşir."
          icon={<WalletCards size={18} />}
          tone={getIncentiveStatusTone(row.status)}
        />
        <StoreMetricCard
          title="Kişisel hedef"
          value={formatMoneyValue(row.target, input.locale)}
          note={`Gerçekleşen: ${formatMoneyValue(row.actualPositiveSales, input.locale)}`}
          icon={<Target size={18} />}
          {...optionalProgress(row.achievementPct)}
          tone="accent"
        />
        <StoreMetricCard
          title="Kişisel oran"
          value={formatPercentValue(row.achievementPct, input.locale)}
          note={`Prim oranı: ${formatRateValue(row.rate, input.locale)}`}
          icon={<TrendingUp size={18} />}
          tone="neutral"
        />
        <StoreMetricCard
          title="Mağaza kapısı"
          value={row.storeGatePassed ? 'Geçildi' : 'Bekliyor'}
          note={`Mağaza gerçekleşmesi: ${formatPercentValue(row.storeAchievementPct, input.locale)}`}
          icon={<ShieldCheck size={18} />}
          tone={row.storeGatePassed ? 'calm' : 'warning'}
        />
      </StoreMetricGrid>

      <div className="tw:mt-4 tw:grid tw:gap-4 tw:lg:grid-cols-[1fr_0.9fr]">
        <StoreInfoGrid
          className="tw:xl:grid-cols-2"
          items={[
            { label: 'Dönem', value: input.projection.period },
            { label: 'Son veri', value: formatDateTimeValue(input.projection.lastImportAt, input.locale) },
            { label: 'Revizyon', value: getRevisionLabel(input.projection), tone: input.projection.storeTarget ? 'calm' : 'warning' },
            { label: 'Durum', value: row.blockedReason ? 'İnceleme gerekiyor' : row.explanation },
          ]}
        />
        <IncentiveRateTable title="Satış personeli prim tablosu" rows={personnelRateBrackets} />
      </div>
    </StoreSectionCard>
  )
}

export function StoreIncentiveProjectionCard(input: {
  locale: AppLocale
  projection: SalesTargetIncentiveProjection
  showStoreName?: boolean
}) {
  const manager = getManagerRow(input.projection)
  const personnel = getPersonnelRows(input.projection)

  return (
    <StoreSectionCard
      title={input.showStoreName ? input.projection.storeName : 'Mağaza prim özeti'}
      description="Mağaza hedefi, gerçekleşen net satış ve ekip hak edişi aynı dönem üzerinden okunur."
      badge={{
        label: getIncentiveStatusLabel(input.projection.calculationState),
        tone: getIncentiveStatusTone(input.projection.calculationState),
      }}
      ariaLabel={`${input.projection.storeName} prim özeti`}
      testId="store-incentive-projection"
    >
      <StoreMetricGrid className="tw:xl:grid-cols-4" ariaLabel="Mağaza prim özetleri">
        <StoreMetricCard
          title="Mağaza hedefi"
          value={formatMoneyValue(input.projection.storeTarget, input.locale)}
          note={getRevisionLabel(input.projection)}
          icon={<Target size={18} />}
          tone={input.projection.storeTarget ? 'accent' : 'warning'}
        />
        <StoreMetricCard
          title="Net satış"
          value={formatMoneyValue(input.projection.storeActualNetSales, input.locale)}
          note={`Son veri: ${formatDateTimeValue(input.projection.lastImportAt, input.locale)}`}
          icon={<Clock3 size={18} />}
          tone={input.projection.storeActualNetSales ? 'neutral' : 'warning'}
        />
        <StoreMetricCard
          title="Gerçekleşme"
          value={formatPercentValue(input.projection.storeAchievementPct, input.locale)}
          note={input.projection.storeGatePassed ? 'Personel prim kapısı geçildi.' : 'Personel için %80 mağaza kapısı bekliyor.'}
          icon={<TrendingUp size={18} />}
          {...optionalProgress(input.projection.storeAchievementPct)}
          tone={input.projection.storeGatePassed ? 'calm' : 'warning'}
        />
        <StoreMetricCard
          title="Müdür hak edişi"
          value={formatMoneyValue(getPrimaryEarnedAmount(manager), input.locale)}
          note={`Prim oranı: ${formatRateValue(manager?.rate, input.locale)}`}
          icon={<CircleDollarSign size={18} />}
          tone={manager ? getIncentiveStatusTone(manager.status) : 'warning'}
        />
      </StoreMetricGrid>

      <div className="tw:mt-4">
        {personnel.length > 0 ? (
          <IncentivePersonnelRows locale={input.locale} rows={personnel} />
        ) : (
          <StoreEmptyState
            title="Personel prim satırı yok"
            description="Bu mağaza için V1 kapsamındaki satış personeli veya müdür yardımcısı satırı bulunmuyor."
          />
        )}
      </div>
    </StoreSectionCard>
  )
}

export function IncentiveRateTables() {
  return (
    <section className="tw:grid tw:gap-4 tw:lg:grid-cols-2" aria-label="Prim oran tabloları">
      <StoreSectionCard
        title="Mağaza müdürü prim tablosu"
        description="Mağaza müdürü prim oranı toplam mağaza net satış gerçekleşmesine göre belirlenir."
      >
        <IncentiveRateTable title="Mağaza müdürü prim tablosu" rows={managerRateBrackets} />
      </StoreSectionCard>
      <StoreSectionCard
        title="Satış personeli prim tablosu"
        description="Satış personeli ve müdür yardımcısı için önce mağaza %80 kapısı, sonra kişisel hedef gerçekleşmesi aranır."
      >
        <IncentiveRateTable title="Satış personeli prim tablosu" rows={personnelRateBrackets} />
      </StoreSectionCard>
    </section>
  )
}

function IncentivePersonnelRows(input: {
  locale: AppLocale
  rows: SalesTargetIncentiveRow[]
}) {
  return (
    <StoreStackedList>
      {input.rows.map((row) => (
        <StoreStackedRow
          key={row.employeeId}
          tone={getIncentiveStatusTone(row.status)}
          testId="store-incentive-personnel-row"
        >
          <div className="tw:flex tw:flex-col tw:gap-3">
            <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
              <div className="tw:min-w-0">
                <strong className="tw:block tw:text-sm tw:font-semibold tw:text-foreground">{row.displayName}</strong>
                <span className="tw:text-xs tw:text-muted-foreground">{getIncentivePositionLabel(row.positionCode)}</span>
              </div>
              <StoreStatusBadge tone={getIncentiveStatusTone(row.status)}>
                {getIncentiveStatusLabel(row.status)}
              </StoreStatusBadge>
            </div>
            <StoreInfoGrid
              className="tw:xl:grid-cols-5"
              items={[
                { label: 'Hedef', value: formatMoneyValue(row.target, input.locale) },
                { label: 'Satış', value: formatMoneyValue(row.actualPositiveSales, input.locale) },
                { label: 'Gerçekleşme', value: formatPercentValue(row.achievementPct, input.locale) },
                { label: 'Oran', value: formatRateValue(row.rate, input.locale) },
                { label: 'Hak ediş', value: formatMoneyValue(getPrimaryEarnedAmount(row), input.locale), tone: getIncentiveStatusTone(row.status) },
              ]}
            />
            {row.blockedReason ? (
              <p className="tw:text-xs tw:leading-5 tw:text-muted-foreground">{row.explanation}</p>
            ) : null}
          </div>
        </StoreStackedRow>
      ))}
    </StoreStackedList>
  )
}

function IncentiveRateTable(input: {
  title: string
  rows: IncentiveRateBracket[]
}) {
  return (
    <div className="tw:overflow-hidden tw:rounded-lg tw:border tw:border-border" aria-label={input.title}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Gerçekleşme</TableHead>
            <TableHead className="tw:text-right">Prim oranı</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {input.rows.map((row) => (
            <TableRow key={`${row.range}:${row.rate}`}>
              <TableCell className="tw:font-medium">{row.range}</TableCell>
              <TableCell className="tw:text-right tw:font-semibold">{row.rate}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function optionalProgress(value: string | null | undefined) {
  const progress = toProgressPercent(value)
  return progress === undefined ? {} : { progress }
}
