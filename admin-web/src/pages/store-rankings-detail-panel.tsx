import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { AppLocale } from '../lib/i18n'
import {
  type RankingDetailSelection,
  formatNumber,
  formatRank,
  formatRankBadge,
  getScoreFill,
  storeMetricCodes,
} from './store-rankings-page-model'
import { MetricDetails } from './store-rankings-table'
import {
  StoreInfoGrid,
  StoreStackedList,
  StoreStackedRow,
  StoreStatusBadge,
} from './store-surface-primitives'

export function RankingDetailDrawer(input: {
  selection: RankingDetailSelection
  locale: AppLocale
  t: TranslateFunction
  onClose: () => void
}) {
  if (!input.selection) {
    return null
  }

  const row = input.selection.row
  const title = row.storeName ?? row.storeId

  return (
    <>
      <button
        className="store-rankings-drawer-backdrop tw:fixed tw:inset-0 tw:z-40 tw:bg-background/55 tw:backdrop-blur-sm"
        type="button"
        aria-label={input.t('storeRankings.closeDetail')}
        onClick={input.onClose}
      />
      <aside
        className="store-rankings-drawer tw:fixed tw:inset-y-3 tw:right-3 tw:z-50 tw:flex tw:w-[min(520px,calc(100vw-1.5rem))] tw:flex-col tw:overflow-hidden tw:rounded-xl tw:border tw:bg-card tw:shadow-lg"
        aria-label={input.t('storeRankings.detailPanel')}
      >
        <div className="tw:flex tw:flex-col tw:gap-4 tw:border-b tw:p-4">
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            <Button type="button" variant="outline" onClick={input.onClose}>
              {input.t('storeRankings.closeDetail')}
            </Button>
            <StoreStatusBadge tone="neutral">{input.t('storeRankings.inlineDetail')}</StoreStatusBadge>
          </div>
          <div>
            <h2 className="tw:text-xl tw:font-semibold tw:text-foreground">{title}</h2>
            <span className="tw:text-sm tw:text-muted-foreground">
              {input.t('storeRankings.storeDetailCaption')}
            </span>
          </div>
        </div>
        <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-4 tw:overflow-y-auto tw:p-4">
          <StoreInfoGrid
            className="tw:xl:grid-cols-3"
            items={[
              {
                label: input.t('storeRankings.storeScore'),
                value: formatNumber(input.locale, input.t, row.scoreValue),
              },
              { label: input.t('storeRankings.turkeyRank'), value: formatRankBadge(input.t, row.rank) },
              {
                label: input.t('storeRankings.scope'),
                value: formatRank(input.t, row.rank, row.population),
              },
            ]}
          />
          <StoreStackedList>
            <StoreStackedRow>
              <div className="tw:flex tw:flex-col tw:gap-3">
                <h3 className="tw:text-sm tw:font-semibold tw:text-foreground">
                  {input.t('storeRankings.kpiDistribution')}
                </h3>
                <MetricDetails
                  metrics={row.metrics ?? []}
                  metricCodes={storeMetricCodes}
                  locale={input.locale}
                  t={input.t}
                />
              </div>
            </StoreStackedRow>
            <StoreStackedRow>
              <div className="tw:flex tw:flex-col tw:gap-3">
                <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
                  <h3 className="tw:text-sm tw:font-semibold tw:text-foreground">
                    {input.t('storeRankings.monthlyProgress')}
                  </h3>
                  <StoreStatusBadge tone="neutral">{input.t('storeRankings.loadedPeriod')}</StoreStatusBadge>
                </div>
                <div className="tw:grid tw:gap-2">
                  <span className="tw:text-sm tw:text-muted-foreground">
                    {input.t('storeRankings.currentPeriod')}
                  </span>
                  <strong className="tw:text-sm tw:text-foreground">
                    {formatNumber(input.locale, input.t, row.scoreValue)}
                  </strong>
                  <Progress value={getScoreFill(row.scoreValue)} />
                </div>
              </div>
            </StoreStackedRow>
            <StoreStackedRow>
              <h3 className="tw:text-sm tw:font-semibold tw:text-foreground">
                {input.t('storeRankings.coachingNote')}
              </h3>
              <p className="tw:mt-2 tw:text-sm tw:leading-6 tw:text-muted-foreground">
                {input.t('storeRankings.storeDetailNote')}
              </p>
            </StoreStackedRow>
          </StoreStackedList>
        </div>
      </aside>
    </>
  )
}
