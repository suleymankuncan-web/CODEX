import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { PersonnelRankingRow, RankingMetricValue, RankingSummary, StoreRankingRow } from '../features/reports/api'
import type { AppLocale } from '../lib/i18n'
import {
  type ActiveRankingList,
  type RankingDetailSelection,
  type RankingSortDirection,
  type RankingSortKey,
  formatMetricValue,
  formatNumber,
  formatRankBadge,
  getMetricByCode,
  getMetricLabel,
  getScoreFill,
  personnelMetricCodes,
  storeMetricCodes,
} from './store-rankings-page-model'
import {
  StoreEmptyState,
  StoreSectionCard,
  StoreStatusBadge,
} from './store-surface-primitives'

export function RankingWorkspace(input: {
  activeList: ActiveRankingList
  ranking: RankingSummary
  storeRows: StoreRankingRow[]
  personnelRows: PersonnelRankingRow[]
  canSeeDetails: boolean
  canOpenPersonnelProfile: (row: PersonnelRankingRow) => boolean
  sortKey: RankingSortKey
  sortDirection: RankingSortDirection
  onSortChange: (value: RankingSortKey) => void
  onActiveListChange: (value: ActiveRankingList) => void
  onOpenDetail: (value: RankingDetailSelection) => void
  onOffsetChange: (value: number) => void
  hasNextPage: boolean
  offset: number
  limit: number
  locale: AppLocale
  t: TranslateFunction
}) {
  const rows = input.activeList === 'stores' ? input.storeRows : input.personnelRows
  const meta =
    input.activeList === 'stores'
      ? input.ranking.storeLeaderboard.meta
      : input.ranking.personnelLeaderboard.meta
  const title =
    input.activeList === 'stores'
      ? input.t('storeRankings.storeList')
      : input.t('storeRankings.personnelList')
  const caption =
    input.activeList === 'stores'
      ? input.t('storeRankings.storeResultCaption', {
          start: meta.total ? input.offset + 1 : 0,
          end: input.offset + rows.length,
          total: meta.total,
        })
      : input.t('storeRankings.personnelResultCaption', {
          start: meta.total ? input.offset + 1 : 0,
          end: input.offset + rows.length,
          total: meta.total,
        })
  const metricCodes = input.activeList === 'stores' ? storeMetricCodes : personnelMetricCodes

  return (
    <StoreSectionCard
      title={title}
      description={caption}
      badge={{
        label: input.canSeeDetails
          ? input.t('storeRankings.fullDetailAccess')
          : input.t('storeRankings.summaryAccess'),
        tone: input.canSeeDetails ? 'calm' : 'warning',
      }}
    >
      <div className="tw:flex tw:flex-col tw:gap-4">
        <ToggleGroup
          type="single"
          value={input.activeList}
          onValueChange={(value) => {
            if (value === 'stores' || value === 'personnel') {
              input.onActiveListChange(value)
            }
          }}
          variant="outline"
          role="tablist"
          aria-label={input.t('storeRankings.listSwitchLabel')}
          className="tw:w-full tw:flex-wrap tw:justify-start"
        >
          <ToggleGroupItem
            value="stores"
            role="tab"
            aria-selected={input.activeList === 'stores'}
          >
            {input.t('storeRankings.storeList')}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="personnel"
            role="tab"
            aria-selected={input.activeList === 'personnel'}
          >
            {input.t('storeRankings.personnelList')}
          </ToggleGroupItem>
        </ToggleGroup>

        <Table
          className={`store-rankings-table tw:min-w-[760px]${
            input.canSeeDetails ? ' store-rankings-table-detail' : ' store-rankings-table-summary'
          }`}
          aria-describedby="rankings-heading"
        >
          <TableCaption className="tw:sr-only">{caption}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{input.t('storeRankings.rankColumn')}</TableHead>
              <TableHead>
                {input.activeList === 'stores'
                  ? input.t('storeRankings.store')
                  : input.t('storeRankings.personnel')}
              </TableHead>
              <TableHead>
                <SortButton
                  label={
                    input.activeList === 'stores'
                      ? input.t('storeRankings.storeScore')
                      : input.t('storeRankings.personnelScore')
                  }
                  sortKey="score"
                  activeSortKey={input.sortKey}
                  sortDirection={input.sortDirection}
                  onSortChange={input.onSortChange}
                />
              </TableHead>
              {input.canSeeDetails ? (
                <TableHead>
                  <MetricSortRow
                    metricCodes={metricCodes}
                    activeSortKey={input.sortKey}
                    sortDirection={input.sortDirection}
                    onSortChange={input.onSortChange}
                    t={input.t}
                  />
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              input.activeList === 'stores' ? (
                input.storeRows.map((row) => (
                  <StoreRankingTableRow
                    key={row.storeId}
                    row={row}
                    canSeeDetails={input.canSeeDetails}
                    locale={input.locale}
                    t={input.t}
                    onOpenDetail={(nextRow) =>
                      input.onOpenDetail({ type: 'store', row: nextRow })
                    }
                  />
                ))
              ) : (
                input.personnelRows.map((row) => (
                  <PersonnelRankingTableRow
                    key={row.employeeId}
                    row={row}
                    canSeeDetails={input.canSeeDetails}
                    locale={input.locale}
                    t={input.t}
                    onOpenDetail={(nextRow) =>
                      input.onOpenDetail({ type: 'personnel', row: nextRow })
                    }
                  />
                ))
              )
            ) : (
              <TableRow>
                <TableCell colSpan={input.canSeeDetails ? 4 : 3}>
                  <StoreEmptyState
                    description={
                      input.activeList === 'stores'
                        ? input.t('storeRankings.noStores')
                        : input.t('storeRankings.noPersonnel')
                    }
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div
          className="tw:flex tw:flex-col tw:gap-3 tw:border-t tw:pt-3 tw:text-sm tw:text-muted-foreground tw:sm:flex-row tw:sm:items-center tw:sm:justify-between"
          aria-label={input.t('storeRankings.pagination')}
        >
          <span className="tw:font-medium">
            {input.t('storeRankings.pageInfo', {
              start: meta.total ? input.offset + 1 : 0,
              end: input.offset + rows.length,
              total: meta.total,
            })}
          </span>
          <div className="tw:flex tw:gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => input.onOffsetChange(Math.max(0, input.offset - input.limit))}
              disabled={input.offset === 0}
              aria-label={input.t('storeRankings.previousPageLabel')}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => input.onOffsetChange(input.offset + input.limit)}
              disabled={!input.hasNextPage}
              aria-label={input.t('storeRankings.nextPageLabel')}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </StoreSectionCard>
  )
}

function SortButton(input: {
  label: string
  sortKey: RankingSortKey
  activeSortKey: RankingSortKey
  sortDirection: RankingSortDirection
  onSortChange: (value: RankingSortKey) => void
}) {
  const active = input.activeSortKey === input.sortKey

  return (
    <Button
      className="store-rankings-sort-button"
      type="button"
      size="sm"
      variant={active ? 'default' : 'ghost'}
      onClick={() => input.onSortChange(input.sortKey)}
      aria-sort={active ? (input.sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}
    >
      <ArrowUpDown aria-hidden="true" />
      {input.label}
      {active ? <span>{input.sortDirection === 'desc' ? '↓' : '↑'}</span> : null}
    </Button>
  )
}

function MetricSortRow(input: {
  metricCodes: readonly string[]
  activeSortKey: RankingSortKey
  sortDirection: RankingSortDirection
  onSortChange: (value: RankingSortKey) => void
  t: TranslateFunction
}) {
  return (
    <div
      className="store-rankings-metric-sort-row tw:grid tw:grid-cols-2 tw:gap-2 tw:md:grid-cols-6"
    >
      {input.metricCodes.map((code) => (
        <SortButton
          key={code}
          label={getMetricLabel(input.t, code)}
          sortKey={code as RankingSortKey}
          activeSortKey={input.activeSortKey}
          sortDirection={input.sortDirection}
          onSortChange={input.onSortChange}
        />
      ))}
    </div>
  )
}

function StoreRankingTableRow(input: {
  row: StoreRankingRow
  canSeeDetails: boolean
  locale: AppLocale
  t: TranslateFunction
  onOpenDetail: (row: StoreRankingRow) => void
}) {
  const row = input.row

  return (
    <TableRow>
      <TableCell data-label={input.t('storeRankings.rankColumn')}>
        <StoreStatusBadge tone="accent">{formatRankBadge(input.t, row.rank)}</StoreStatusBadge>
      </TableCell>
      <TableCell data-label={input.t('storeRankings.store')}>
        <RankingEntity
          label={row.storeName ?? row.storeId}
          canOpen={input.canSeeDetails}
          onOpen={() => input.onOpenDetail(row)}
        />
      </TableCell>
      <TableCell data-label={input.t('storeRankings.storeScore')}>
        <RankingScore value={row.scoreValue} locale={input.locale} t={input.t} />
      </TableCell>
      {input.canSeeDetails ? (
        <TableCell data-label={input.t('storeRankings.metricDetailsLabel')}>
          <MetricDetails
            metrics={row.metrics ?? []}
            metricCodes={storeMetricCodes}
            locale={input.locale}
            t={input.t}
          />
        </TableCell>
      ) : null}
    </TableRow>
  )
}

function PersonnelRankingTableRow(input: {
  row: PersonnelRankingRow
  canSeeDetails: boolean
  locale: AppLocale
  t: TranslateFunction
  onOpenDetail: (row: PersonnelRankingRow) => void
}) {
  const row = input.row

  return (
    <TableRow>
      <TableCell data-label={input.t('storeRankings.rankColumn')}>
        <StoreStatusBadge tone="accent">{formatRankBadge(input.t, row.rank)}</StoreStatusBadge>
      </TableCell>
      <TableCell data-label={input.t('storeRankings.personnel')}>
        <RankingEntity
          label={row.displayName}
          caption={row.storeName ?? input.t('storeRankings.noStore')}
          canOpen={input.canSeeDetails}
          onOpen={() => input.onOpenDetail(row)}
        />
      </TableCell>
      <TableCell data-label={input.t('storeRankings.personnelScore')}>
        <RankingScore value={row.scoreValue} locale={input.locale} t={input.t} />
      </TableCell>
      {input.canSeeDetails ? (
        <TableCell data-label={input.t('storeRankings.metricDetailsLabel')}>
          <MetricDetails
            metrics={row.metrics ?? []}
            metricCodes={personnelMetricCodes}
            locale={input.locale}
            t={input.t}
          />
        </TableCell>
      ) : null}
    </TableRow>
  )
}

function RankingEntity(input: {
  label: string
  caption?: string
  canOpen: boolean
  onOpen: () => void
}) {
  return (
    <div className="tw:flex tw:min-w-0 tw:flex-col">
      {input.canOpen ? (
        <Button
          type="button"
          variant="link"
          className="tw:h-auto tw:w-fit tw:max-w-full tw:justify-start tw:p-0 tw:text-left tw:font-semibold"
          onClick={input.onOpen}
        >
          {input.label}
        </Button>
      ) : (
        <strong className="tw:text-sm tw:text-foreground">{input.label}</strong>
      )}
      {input.caption ? (
        <span className="tw:text-xs tw:text-muted-foreground">{input.caption}</span>
      ) : null}
    </div>
  )
}

function RankingScore(input: {
  value: number | null | undefined
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <div className="store-rankings-scorebar tw:grid tw:min-w-32 tw:gap-2">
      <strong className="tw:text-sm tw:text-foreground">
        {formatNumber(input.locale, input.t, input.value)}
      </strong>
      <Progress value={getScoreFill(input.value)} />
    </div>
  )
}

export function MetricDetails(input: {
  metrics: RankingMetricValue[]
  metricCodes: readonly string[]
  locale: AppLocale
  t: TranslateFunction
}) {
  if (!input.metrics.length) {
    return <span className="tw:text-sm tw:text-muted-foreground">{input.t('common.noData')}</span>
  }

  return (
    <div
      className={`store-rankings-metric-grid tw:grid tw:gap-2 tw:md:grid-cols-3${
        input.metricCodes.length > 3 ? ' tw:2xl:grid-cols-6' : ''
      }`}
      aria-label={input.t('storeRankings.metricDetailsLabel')}
    >
      {input.metricCodes.map((code) => {
        const metric = getMetricByCode(input.metrics, code)

        return (
          <div
            className={`tw:flex tw:min-h-16 tw:flex-col tw:justify-between tw:rounded-lg tw:border tw:p-2${
              metric ? ' tw:bg-card/80' : ' tw:bg-muted/30'
            }`}
            key={code}
          >
            <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">
              {getMetricLabel(input.t, code, metric?.label)}
            </span>
            <strong className="tw:text-sm tw:text-foreground">
              {metric
                ? formatMetricValue(input.locale, input.t, metric, code)
                : input.t('common.noData')}
            </strong>
          </div>
        )
      })}
    </div>
  )
}
