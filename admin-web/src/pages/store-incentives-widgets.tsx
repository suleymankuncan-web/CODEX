import { CircleDollarSign, Clock3, ShieldCheck, Target, TrendingUp, WalletCards } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type {
  SalesTargetIncentiveProjection,
  SalesTargetIncentiveRow,
  SalesTargetIncentiveStatus,
} from '../features/incentives/api'
import { useLocalization } from '../features/localization/useLocalization'
import type { AppLocale } from '../lib/i18n'
import {
  formatDateTimeValue,
  formatMoneyValue,
  formatPercentValue,
  formatRateValue,
  getIncentiveStatusTone,
  getManagerRow,
  getPersonnelRows,
  getPrimaryEarnedAmount,
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

type StoreIncentiveTranslate = ReturnType<typeof useLocalization>['t']

export function StoreMeIncentiveCard(input: {
  locale: AppLocale
  projection: SalesTargetIncentiveProjection
}) {
  const { t } = useLocalization()
  const row = input.projection.rows[0] ?? null
  if (!row) return null

  return (
    <StoreSectionCard
      title={t('storeIncentives.widgetEarnedTitle')}
      description={t('storeIncentives.widgetEarnedDescription')}
      badge={{ label: getWidgetStatusLabel(t, row.status), tone: getIncentiveStatusTone(row.status) }}
      ariaLabel={t('storeIncentives.widgetEarnedAria')}
      testId="store-me-incentive-card"
    >
      <StoreMetricGrid className="tw:xl:grid-cols-4" ariaLabel={t('storeIncentives.widgetPersonalSummaryAria')}>
        <StoreMetricCard
          title={t('storeIncentives.widgetEarnedValue')}
          value={formatMoneyValue(getPrimaryEarnedAmount(row), input.locale)}
          note={t('storeIncentives.widgetFinalAfterClose')}
          icon={<WalletCards size={18} />}
          tone={getIncentiveStatusTone(row.status)}
        />
        <StoreMetricCard
          title={t('storeIncentives.widgetPersonalTarget')}
          value={formatMoneyValue(row.target, input.locale)}
          note={t('storeIncentives.widgetActualPrefix', {
            value: formatMoneyValue(row.actualPositiveSales, input.locale),
          })}
          icon={<Target size={18} />}
          {...optionalProgress(row.achievementPct)}
          tone="accent"
        />
        <StoreMetricCard
          title={t('storeIncentives.widgetPersonalRate')}
          value={formatPercentValue(row.achievementPct, input.locale)}
          note={t('storeIncentives.widgetRatePrefix', { value: formatRateValue(row.rate, input.locale) })}
          icon={<TrendingUp size={18} />}
          tone="neutral"
        />
        <StoreMetricCard
          title={t('storeIncentives.widgetStoreGate')}
          value={row.storeGatePassed ? t('storeIncentives.widgetGatePassed') : t('storeIncentives.widgetGateWaiting')}
          note={t('storeIncentives.widgetStoreAchievementPrefix', {
            value: formatPercentValue(row.storeAchievementPct, input.locale),
          })}
          icon={<ShieldCheck size={18} />}
          tone={row.storeGatePassed ? 'calm' : 'warning'}
        />
      </StoreMetricGrid>

      <div className="tw:mt-4 tw:grid tw:gap-4 tw:lg:grid-cols-[1fr_0.9fr]">
        <StoreInfoGrid
          className="tw:xl:grid-cols-2"
          items={[
            { label: t('storeIncentives.widgetPeriod'), value: input.projection.period },
            { label: t('storeIncentives.widgetLastData'), value: formatDateTimeValue(input.projection.lastImportAt, input.locale) },
            { label: t('storeIncentives.widgetRevision'), value: getWidgetRevisionLabel(t, input.projection), tone: input.projection.storeTarget ? 'calm' : 'warning' },
            { label: t('storeIncentives.widgetStatus'), value: row.blockedReason ? t('storeIncentives.widgetNeedsReview') : getWidgetStatusLabel(t, row.status) },
          ]}
        />
        <IncentiveRateTable title={t('storeIncentives.widgetPersonnelRateTableTitle')} rows={personnelRateBrackets} t={t} />
      </div>
    </StoreSectionCard>
  )
}

export function StoreIncentiveProjectionCard(input: {
  locale: AppLocale
  projection: SalesTargetIncentiveProjection
  showStoreName?: boolean
}) {
  const { t } = useLocalization()
  const manager = getManagerRow(input.projection)
  const personnel = getPersonnelRows(input.projection)

  return (
    <StoreSectionCard
      title={input.showStoreName ? input.projection.storeName : t('storeIncentives.widgetStoreProjectionFallbackTitle')}
      description={t('storeIncentives.widgetStoreProjectionDescription')}
      badge={{
        label: getWidgetStatusLabel(t, input.projection.calculationState),
        tone: getIncentiveStatusTone(input.projection.calculationState),
      }}
      ariaLabel={t('storeIncentives.widgetStoreProjectionAria', { storeName: input.projection.storeName })}
      testId="store-incentive-projection"
    >
      <StoreMetricGrid className="tw:xl:grid-cols-4" ariaLabel={t('storeIncentives.widgetStoreMetricAria')}>
        <StoreMetricCard
          title={t('storeIncentives.widgetStoreTarget')}
          value={formatMoneyValue(input.projection.storeTarget, input.locale)}
          note={getWidgetRevisionLabel(t, input.projection)}
          icon={<Target size={18} />}
          tone={input.projection.storeTarget ? 'accent' : 'warning'}
        />
        <StoreMetricCard
          title={t('storeIncentives.widgetNetSales')}
          value={formatMoneyValue(input.projection.storeActualNetSales, input.locale)}
          note={t('storeIncentives.widgetLastDataPrefix', {
            value: formatDateTimeValue(input.projection.lastImportAt, input.locale),
          })}
          icon={<Clock3 size={18} />}
          tone={input.projection.storeActualNetSales ? 'neutral' : 'warning'}
        />
        <StoreMetricCard
          title={t('storeIncentives.widgetAchievement')}
          value={formatPercentValue(input.projection.storeAchievementPct, input.locale)}
          note={input.projection.storeGatePassed ? t('storeIncentives.widgetPersonnelGatePassed') : t('storeIncentives.widgetPersonnelGateWaiting')}
          icon={<TrendingUp size={18} />}
          {...optionalProgress(input.projection.storeAchievementPct)}
          tone={input.projection.storeGatePassed ? 'calm' : 'warning'}
        />
        <StoreMetricCard
          title={t('storeIncentives.widgetManagerEarning')}
          value={formatMoneyValue(getPrimaryEarnedAmount(manager), input.locale)}
          note={t('storeIncentives.widgetRatePrefix', { value: formatRateValue(manager?.rate, input.locale) })}
          icon={<CircleDollarSign size={18} />}
          tone={manager ? getIncentiveStatusTone(manager.status) : 'warning'}
        />
      </StoreMetricGrid>

      <div className="tw:mt-4">
        {personnel.length > 0 ? (
          <IncentivePersonnelRows locale={input.locale} rows={personnel} t={t} />
        ) : (
          <StoreEmptyState
            title={t('storeIncentives.widgetNoPersonnelTitle')}
            description={t('storeIncentives.widgetNoPersonnelCopy')}
          />
        )}
      </div>
    </StoreSectionCard>
  )
}

export function IncentiveRateTables() {
  const { t } = useLocalization()

  return (
    <section className="tw:grid tw:gap-4 tw:lg:grid-cols-2" aria-label={t('storeIncentives.widgetRateTablesAria')}>
      <StoreSectionCard
        title={t('storeIncentives.widgetManagerRateTableTitle')}
        description={t('storeIncentives.widgetManagerRateTableDescription')}
      >
        <IncentiveRateTable title={t('storeIncentives.widgetManagerRateTableTitle')} rows={managerRateBrackets} t={t} />
      </StoreSectionCard>
      <StoreSectionCard
        title={t('storeIncentives.widgetPersonnelRateTableTitle')}
        description={t('storeIncentives.widgetPersonnelRateTableDescription')}
      >
        <IncentiveRateTable title={t('storeIncentives.widgetPersonnelRateTableTitle')} rows={personnelRateBrackets} t={t} />
      </StoreSectionCard>
    </section>
  )
}

function IncentivePersonnelRows(input: {
  locale: AppLocale
  rows: SalesTargetIncentiveRow[]
  t: StoreIncentiveTranslate
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
                <span className="tw:text-xs tw:text-muted-foreground">{getWidgetPositionLabel(input.t, row.positionCode)}</span>
              </div>
              <StoreStatusBadge tone={getIncentiveStatusTone(row.status)}>
                {getWidgetStatusLabel(input.t, row.status)}
              </StoreStatusBadge>
            </div>
            <StoreInfoGrid
              className="tw:xl:grid-cols-5"
              items={[
                { label: input.t('storeIncentives.widgetTarget'), value: formatMoneyValue(row.target, input.locale) },
                { label: input.t('storeIncentives.widgetSales'), value: formatMoneyValue(row.actualPositiveSales, input.locale) },
                { label: input.t('storeIncentives.widgetAchievement'), value: formatPercentValue(row.achievementPct, input.locale) },
                { label: input.t('storeIncentives.widgetRate'), value: formatRateValue(row.rate, input.locale) },
                { label: input.t('storeIncentives.widgetEarnedValue'), value: formatMoneyValue(getPrimaryEarnedAmount(row), input.locale), tone: getIncentiveStatusTone(row.status) },
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
  t: StoreIncentiveTranslate
}) {
  return (
    <div className="tw:overflow-hidden tw:rounded-lg tw:border tw:border-border" aria-label={input.title}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{input.t('storeIncentives.widgetAchievement')}</TableHead>
            <TableHead className="tw:text-right">{input.t('storeIncentives.widgetRate')}</TableHead>
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

function getWidgetStatusLabel(t: StoreIncentiveTranslate, status: SalesTargetIncentiveStatus) {
  const labels: Record<SalesTargetIncentiveStatus, ReturnType<StoreIncentiveTranslate>> = {
    adjusted: t('storeIncentives.widgetStatusAdjusted'),
    blocked: t('storeIncentives.widgetStatusBlocked'),
    closed: t('storeIncentives.widgetStatusClosed'),
    corrected: t('storeIncentives.widgetStatusCorrected'),
    no_source: t('storeIncentives.widgetStatusNoSource'),
    projected: t('storeIncentives.widgetStatusProjected'),
  }
  return labels[status] ?? status
}

function getWidgetRevisionLabel(t: StoreIncentiveTranslate, projection: SalesTargetIncentiveProjection) {
  if (projection.storeTarget) return t('storeIncentives.widgetRevisionApproved')
  if (projection.calculationState === 'blocked') return t('storeIncentives.widgetRevisionWaitingTarget')
  return t('storeIncentives.widgetRevisionNone')
}

function getWidgetPositionLabel(
  t: StoreIncentiveTranslate,
  positionCode: SalesTargetIncentiveRow['positionCode'],
) {
  const labels: Record<SalesTargetIncentiveRow['positionCode'], ReturnType<StoreIncentiveTranslate>> = {
    ASSISTANT_MANAGER: t('storeIncentives.widgetPositionAssistantManager'),
    SALES_ASSOCIATE: t('storeIncentives.widgetPositionSalesAssociate'),
    SENIOR_SALES_CONSULTANT: t('storeIncentives.widgetPositionSeniorSalesConsultant'),
    STORE_MANAGER: t('storeIncentives.widgetPositionStoreManager'),
  }
  return labels[positionCode] ?? positionCode
}
