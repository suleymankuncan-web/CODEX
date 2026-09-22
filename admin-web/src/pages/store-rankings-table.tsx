import type { ReactNode } from 'react'
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight, Store as StoreIcon, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { PersonnelRankingRow, RankingMetricValue, RankingSummary, StoreRankingRow } from '../features/reports/api'
import { normalizeDisplayLabel } from '../lib/display-labels'
import type { AppLocale } from '../lib/i18n'
import {
  type ActiveRankingList,
  type RankingSortDirection,
  type RankingSortKey,
  formatMetricValue,
  formatNumber,
  formatRankBadge,
  getMetricByCode,
  getMetricHeaderLabel,
  getMetricLabel,
  personnelMetricCodes,
  storeMetricCodes,
} from './store-rankings-page-model'
import { StoreEmptyState } from './store-surface-primitives'

export function RankingWorkspace(input: {
  toolbar?: ReactNode
  loading?: boolean
  activeList: ActiveRankingList
  ranking: RankingSummary
  storeRows: StoreRankingRow[]
  personnelRows: PersonnelRankingRow[]
  canSeeDetails: boolean
  sortKey: RankingSortKey
  sortDirection: RankingSortDirection
  onSortChange: (value: RankingSortKey) => void
  onActiveListChange: (value: ActiveRankingList) => void
  onOffsetChange: (value: number) => void
  hasNextPage: boolean
  offset: number
  limit: number
  forceEmpty?: boolean
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
      ? input.t('storeRankings.turkeyStoreRanking')
      : input.t('storeRankings.turkeyPersonnelRanking')
  const displayedOffset = input.loading ? meta.offset : input.offset
  const hasRows = !input.forceEmpty && meta.total > 0 && rows.length > 0
  const visibleWindow = {
    start: hasRows ? displayedOffset + 1 : 0,
    end: hasRows ? displayedOffset + rows.length : 0,
    total: input.forceEmpty ? 0 : meta.total,
  }
  const caption = input.t(
    input.activeList === 'stores' ? 'storeRankings.storeResultCaption' : 'storeRankings.personnelResultCaption',
    visibleWindow,
  )

  return (
    <Tabs value={input.activeList} onValueChange={value => { if (value === 'stores' || value === 'personnel') input.onActiveListChange(value) }} className="store-rankings-board">
      <div className="store-rankings-list-toolbar">
        <TabsList aria-label={input.t('storeRankings.listSwitchLabel')}>
          <TabsTrigger value="stores"><StoreIcon aria-hidden="true" />{input.t('storeRankings.storeList')}<Badge variant="secondary">{input.ranking.storeLeaderboard.meta.total}</Badge></TabsTrigger>
          <TabsTrigger value="personnel"><UsersRound aria-hidden="true" />{input.t('storeRankings.personnelList')}<Badge variant="secondary">{input.ranking.personnelLeaderboard.meta.total}</Badge></TabsTrigger>
        </TabsList>
        {input.toolbar}
      </div>
      <TabsContent value={input.activeList} className="store-rankings-leaderboard">
        <h2 className="tw:sr-only">{title}</h2>
        <div className="store-rankings-table-wrap" aria-busy={input.loading}>
          <Table
            className={`store-rankings-table${
              input.canSeeDetails ? ' store-rankings-table-detail' : ' store-rankings-table-summary'
            }`}
            aria-describedby="rankings-heading"
          >
            <TableCaption className="tw:sr-only">{caption}</TableCaption>
            {input.activeList === 'stores' ? (
              <StoreRankingTable
                rows={input.storeRows}
                currentStoreId={input.ranking.storeLeaderboard.currentStore?.storeId ?? null}
                canSeeDetails={input.canSeeDetails}
                sortKey={input.sortKey}
                sortDirection={input.sortDirection}
                onSortChange={input.onSortChange}
                locale={input.locale}
                t={input.t}
              />
            ) : (
              <PersonnelRankingTable
                rows={input.personnelRows}
                currentEmployeeId={input.ranking.personnelLeaderboard.currentEmployee?.employeeId ?? null}
                canSeeDetails={input.canSeeDetails}
                sortKey={input.sortKey}
                sortDirection={input.sortDirection}
                onSortChange={input.onSortChange}
                locale={input.locale}
                t={input.t}
              />
            )}
          </Table>
        </div>

        <div
          className="store-rankings-pagination"
          aria-label={input.t('storeRankings.pagination')}
        >
          <span>
            {input.t('storeRankings.pageInfo', visibleWindow)}
          </span>
          <div className="store-rankings-page-actions">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="store-rankings-page-button"
              onClick={() => input.onOffsetChange(Math.max(0, input.offset - input.limit))}
              disabled={input.loading || input.offset === 0}
              aria-label={input.t('storeRankings.previousPageLabel')}
            >
              <ChevronLeft data-icon="inline-start" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="store-rankings-page-button"
              onClick={() => input.onOffsetChange(input.offset + input.limit)}
              disabled={input.loading || !input.hasNextPage}
              aria-label={input.t('storeRankings.nextPageLabel')}
            >
              <ChevronRight data-icon="inline-start" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}

function StoreRankingTable(input: {
  rows: StoreRankingRow[]
  currentStoreId: string | null
  canSeeDetails: boolean
  sortKey: RankingSortKey
  sortDirection: RankingSortDirection
  onSortChange: (value: RankingSortKey) => void
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <>
      <colgroup>
        <col className="store-rankings-col-rank" />
        <col className="store-rankings-col-entity" />
        <col className="store-rankings-col-score" />
        {input.canSeeDetails
          ? storeMetricCodes.map((code) => <col key={code} className="store-rankings-col-kpi" />)
          : null}
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>
            <SortButton
              label={input.t('storeRankings.rankColumn')}
              sortKey="score"
              activeSortKey={input.sortKey}
              sortDirection={input.sortDirection}
              onSortChange={input.onSortChange}
              compact
            />
          </TableHead>
          <TableHead>{input.t('storeRankings.store')}</TableHead>
          <TableHead aria-sort={input.sortKey === 'score' ? (input.sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}>
            <SortButton
              label={input.t('storeRankings.score')}
              sortKey="score"
              activeSortKey={input.sortKey}
              sortDirection={input.sortDirection}
              onSortChange={input.onSortChange}
            />
          </TableHead>
          {input.canSeeDetails
            ? storeMetricCodes.map((code) => (
                <TableHead key={code} aria-sort={input.sortKey === code ? (input.sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}>
                  <SortButton
                    label={getMetricHeaderLabel(input.t, code)}
                    sortKey={code}
                    activeSortKey={input.sortKey}
                    sortDirection={input.sortDirection}
                    onSortChange={input.onSortChange}
                  />
                </TableHead>
              ))
            : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {input.rows.length ? (
          input.rows.map((row) => (
            <StoreRankingTableRow
              key={row.storeId}
              row={row}
              current={input.currentStoreId === row.storeId}
              canSeeDetails={input.canSeeDetails}
              locale={input.locale}
              t={input.t}
            />
          ))
        ) : (
          <EmptyRankingRow
            colSpan={input.canSeeDetails ? storeMetricCodes.length + 3 : 3}
            description={input.t('storeRankings.noStores')}
          />
        )}
      </TableBody>
    </>
  )
}

function PersonnelRankingTable(input: {
  rows: PersonnelRankingRow[]
  currentEmployeeId: string | null
  canSeeDetails: boolean
  sortKey: RankingSortKey
  sortDirection: RankingSortDirection
  onSortChange: (value: RankingSortKey) => void
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <>
      <colgroup>
        <col className="store-rankings-col-rank" />
        <col className="store-rankings-col-entity" />
        <col className="store-rankings-col-store" />
        <col className="store-rankings-col-score" />
        {input.canSeeDetails
          ? personnelMetricCodes.map((code) => <col key={code} className="store-rankings-col-kpi" />)
          : null}
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>
            <SortButton
              label={input.t('storeRankings.rankColumn')}
              sortKey="score"
              activeSortKey={input.sortKey}
              sortDirection={input.sortDirection}
              onSortChange={input.onSortChange}
              compact
            />
          </TableHead>
          <TableHead>{input.t('storeRankings.personnel')}</TableHead>
          <TableHead>{input.t('storeRankings.store')}</TableHead>
          <TableHead aria-sort={input.sortKey === 'score' ? (input.sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}>
            <SortButton
              label={input.t('storeRankings.score')}
              sortKey="score"
              activeSortKey={input.sortKey}
              sortDirection={input.sortDirection}
              onSortChange={input.onSortChange}
            />
          </TableHead>
          {input.canSeeDetails
            ? personnelMetricCodes.map((code) => (
                <TableHead key={code} aria-sort={input.sortKey === code ? (input.sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}>
                  <SortButton
                    label={getMetricHeaderLabel(input.t, code)}
                    sortKey={code}
                    activeSortKey={input.sortKey}
                    sortDirection={input.sortDirection}
                    onSortChange={input.onSortChange}
                  />
                </TableHead>
              ))
            : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {input.rows.length ? (
          input.rows.map((row) => (
            <PersonnelRankingTableRow
              key={row.employeeId}
              row={row}
              current={input.currentEmployeeId === row.employeeId}
              canSeeDetails={input.canSeeDetails}
              locale={input.locale}
              t={input.t}
            />
          ))
        ) : (
          <EmptyRankingRow
            colSpan={input.canSeeDetails ? personnelMetricCodes.length + 4 : 4}
            description={input.t('storeRankings.noPersonnel')}
          />
        )}
      </TableBody>
    </>
  )
}

function SortButton(input: {
  label: string
  sortKey: RankingSortKey
  activeSortKey: RankingSortKey
  sortDirection: RankingSortDirection
  onSortChange: (value: RankingSortKey) => void
  compact?: boolean
}) {
  const active = input.activeSortKey === input.sortKey

  return (
    <Button
      className={`store-rankings-sort-button${input.compact ? ' store-rankings-sort-button-compact' : ''}`}
      type="button"
      size="sm"
      variant="ghost"
      onClick={() => input.onSortChange(input.sortKey)}
      data-active={active ? 'true' : undefined}
    >
      {input.label}
      {active ? input.sortDirection === 'desc' ? <ChevronDown data-icon="inline-end" aria-hidden="true" /> : <ChevronUp data-icon="inline-end" aria-hidden="true" /> : <ChevronsUpDown data-icon="inline-end" aria-hidden="true" />}
    </Button>
  )
}

function StoreRankingTableRow(input: {
  row: StoreRankingRow
  current: boolean
  canSeeDetails: boolean
  locale: AppLocale
  t: TranslateFunction
}) {
  const row = input.row

  return (
    <TableRow className={input.current ? 'store-rankings-own-row' : undefined}>
      <TableCell
        className="store-rankings-cell-rank"
        data-label={input.t('storeRankings.rankColumn')}
      >
        <RankChip rank={row.rank} t={input.t} />
      </TableCell>
      <TableCell className="store-rankings-cell-entity" data-label={input.t('storeRankings.store')}>
        <RankingEntity label={normalizeDisplayLabel(row.storeName, input.t('storeRankings.store'))} kind="store" rank={row.rank} />
      </TableCell>
      <TableCell className="store-rankings-cell-score" data-label={input.t('storeRankings.storeScore')}>
        <RankingScore value={row.scoreValue} locale={input.locale} t={input.t} />
      </TableCell>
      {input.canSeeDetails
        ? storeMetricCodes.map((code) => (
            <TableCell className="store-rankings-cell-kpi" data-label={getMetricLabel(input.t, code)} key={code}>
              <RankingMetricCell
                metric={getMetricByCode(row.metrics, code)}
                code={code}
                locale={input.locale}
                t={input.t}
              />
            </TableCell>
          ))
        : null}
    </TableRow>
  )
}

function PersonnelRankingTableRow(input: {
  row: PersonnelRankingRow
  current: boolean
  canSeeDetails: boolean
  locale: AppLocale
  t: TranslateFunction
}) {
  const row = input.row

  return (
    <TableRow
      className={input.current ? 'store-rankings-own-row' : undefined}
      data-testid="personnel-ranking-row"
    >
      <TableCell
        className="store-rankings-cell-rank"
        data-label={input.t('storeRankings.rankColumn')}
        data-testid="personnel-ranking-rank"
      >
        <RankChip rank={row.rank} t={input.t} />
      </TableCell>
      <TableCell className="store-rankings-cell-entity" data-label={input.t('storeRankings.personnel')}>
        <RankingEntity
          label={row.displayName}
          detail={row.storeName ?? input.t('storeRankings.noStore')}
          kind="personnel"
          rank={row.rank}
        />
      </TableCell>
      <TableCell className="store-rankings-cell-store" data-label={input.t('storeRankings.store')}>
        <span className="store-rankings-muted-value">
          {row.storeName ?? input.t('storeRankings.noStore')}
        </span>
      </TableCell>
      <TableCell className="store-rankings-cell-score" data-label={input.t('storeRankings.personnelScore')}>
        <RankingScore value={row.scoreValue} locale={input.locale} t={input.t} />
      </TableCell>
      {input.canSeeDetails
        ? personnelMetricCodes.map((code) => (
            <TableCell className="store-rankings-cell-kpi" data-label={getMetricLabel(input.t, code)} key={code}>
              <RankingMetricCell
                metric={getMetricByCode(row.metrics, code)}
                code={code}
                locale={input.locale}
                t={input.t}
              />
            </TableCell>
          ))
        : null}

    </TableRow>
  )
}

function RankChip(input: { rank: number | null; t: TranslateFunction }) {

  return (
    <Badge variant="secondary" className="store-rankings-rank-chip">
      {formatRankBadge(input.t, input.rank)}
    </Badge>
  )
}

function RankingEntity(input: {
  label: string
  detail?: string
  kind: 'store' | 'personnel'
  rank: number | null
}) {
  return <div className="store-rankings-entity"><span className={`store-rankings-entity-copy store-rankings-entity-copy-${input.kind}`}><strong>{input.label}</strong>{input.detail ? <span className="store-rankings-entity-detail">{input.detail}</span> : null}</span></div>
}

function RankingScore(input: {
  value: number | null | undefined
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <strong className="store-rankings-scorebar store-rankings-score-number">
      {formatNumber(input.locale, input.t, input.value)}
    </strong>
  )
}

function RankingMetricCell(input: {
  metric: RankingMetricValue | undefined
  code: string
  locale: AppLocale
  t: TranslateFunction
}) {
  if (!input.metric) {
    const isChecklist = input.code === 'BM_CHECKLIST' || input.code === 'VM_CHECKLIST'

    return (
      <span className={isChecklist ? 'store-rankings-kpi-cell store-rankings-kpi-missing' : 'store-rankings-muted-value'}>
        {isChecklist ? input.t('storeRankings.notDone') : input.t('common.noData')}
      </span>
    )
  }

  return (
    <span className="store-rankings-kpi-cell">
      {formatMetricValue(input.locale, input.t, input.metric, input.code)}
    </span>
  )
}

function EmptyRankingRow(input: { colSpan: number; description: string }) {
  return (
    <TableRow>
      <TableCell colSpan={input.colSpan}>
        <StoreEmptyState description={input.description} />
      </TableCell>
    </TableRow>
  )
}

export function MetricDetails(input: {
  metrics: RankingMetricValue[]
  metricCodes: readonly string[]
  locale: AppLocale
  t: TranslateFunction
}) {
  if (!input.metrics.length) {
    return <span className="store-rankings-muted-value">{input.t('common.noData')}</span>
  }

  return (
    <div
      className={`store-rankings-metric-grid tw:grid tw:gap-2 tw:md:grid-cols-3${
        input.metricCodes.length > 3 ? ' tw:2xl:grid-cols-5' : ''
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
