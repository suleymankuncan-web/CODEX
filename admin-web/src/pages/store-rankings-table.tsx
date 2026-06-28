import { ArrowRight, ArrowUpDown, ChevronLeft, ChevronRight, Store as StoreIcon, UserRound, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
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
  onOpenPersonnelProfile: (employeeId: string) => void
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
  const caption =
    input.activeList === 'stores'
      ? input.t('storeRankings.storeResultCaption', {
          start: input.forceEmpty || !meta.total ? 0 : input.offset + 1,
          end: input.offset + rows.length,
          total: input.forceEmpty ? 0 : meta.total,
        })
      : input.t('storeRankings.personnelResultCaption', {
          start: input.forceEmpty || !meta.total ? 0 : input.offset + 1,
          end: input.offset + rows.length,
          total: input.forceEmpty ? 0 : meta.total,
        })

  return (
    <div className="store-rankings-board">
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
        className="store-rankings-tabs-card"
      >
        <ToggleGroupItem
          value="stores"
          role="tab"
          aria-selected={input.activeList === 'stores'}
          className="store-rankings-tab"
        >
          <StoreIcon aria-hidden="true" />
          {input.t('storeRankings.storeList')}
          <span className="store-rankings-badge store-rankings-badge-plum">
            {formatNumber(input.locale, input.t, input.ranking.storeLeaderboard.meta.total)}
          </span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="personnel"
          role="tab"
          aria-selected={input.activeList === 'personnel'}
          className="store-rankings-tab"
        >
          <UsersRound aria-hidden="true" />
          {input.t('storeRankings.personnelList')}
          <span className="store-rankings-badge store-rankings-badge-aqua">
            {formatNumber(input.locale, input.t, input.ranking.personnelLeaderboard.meta.total)}
          </span>
        </ToggleGroupItem>
      </ToggleGroup>

      <section className="store-rankings-leaderboard" aria-label={title}>
        <div className="store-rankings-leaderboard-header">
          <div>
            <h2>{title}</h2>
            <p>{caption}</p>
          </div>
          <span className={`store-rankings-badge ${
            input.canSeeDetails ? 'store-rankings-badge-mint' : 'store-rankings-badge-warning'
          }`}>
            {input.canSeeDetails
              ? input.t('storeRankings.fullDetailAccess')
              : input.t('storeRankings.summaryAccess')}
          </span>
        </div>

        <div className="store-rankings-table-wrap">
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
                canOpenPersonnelProfile={input.canOpenPersonnelProfile}
                sortKey={input.sortKey}
                sortDirection={input.sortDirection}
                onSortChange={input.onSortChange}
                onOpenPersonnelProfile={input.onOpenPersonnelProfile}
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
            {input.t('storeRankings.pageInfo', {
              start: input.forceEmpty || !meta.total ? 0 : input.offset + 1,
              end: input.offset + rows.length,
              total: input.forceEmpty ? 0 : meta.total,
            })}
          </span>
          <div className="store-rankings-page-actions">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="store-rankings-page-button"
              onClick={() => input.onOffsetChange(Math.max(0, input.offset - input.limit))}
              disabled={input.offset === 0}
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
              disabled={!input.hasNextPage}
              aria-label={input.t('storeRankings.nextPageLabel')}
            >
              <ChevronRight data-icon="inline-start" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </section>
    </div>
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
          <TableHead>
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
                <TableHead key={code}>
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
  canOpenPersonnelProfile: (row: PersonnelRankingRow) => boolean
  sortKey: RankingSortKey
  sortDirection: RankingSortDirection
  onSortChange: (value: RankingSortKey) => void
  onOpenPersonnelProfile: (employeeId: string) => void
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
        <col className="store-rankings-col-action" />
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
          <TableHead>
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
                <TableHead key={code}>
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
          <TableHead>{input.t('storeRankings.action')}</TableHead>
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
              canOpenProfile={input.canOpenPersonnelProfile(row)}
              locale={input.locale}
              t={input.t}
              onOpenPersonnelProfile={input.onOpenPersonnelProfile}
            />
          ))
        ) : (
          <EmptyRankingRow
            colSpan={input.canSeeDetails ? personnelMetricCodes.length + 5 : 5}
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
      aria-sort={active ? (input.sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}
      data-active={active ? 'true' : undefined}
    >
      {input.label}
      <ArrowUpDown data-icon="inline-end" aria-hidden="true" />
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
      <TableCell className="store-rankings-cell-rank" data-label={input.t('storeRankings.rankColumn')}>
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
  canOpenProfile: boolean
  locale: AppLocale
  t: TranslateFunction
  onOpenPersonnelProfile: (employeeId: string) => void
}) {
  const row = input.row

  return (
    <TableRow className={input.current ? 'store-rankings-own-row' : undefined}>
      <TableCell className="store-rankings-cell-rank" data-label={input.t('storeRankings.rankColumn')}>
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
      <TableCell className="store-rankings-cell-action" data-label={input.t('storeRankings.action')}>
        {input.canOpenProfile ? (
          <Button
            type="button"
            size="sm"
            className="store-rankings-primary-button"
            onClick={() => input.onOpenPersonnelProfile(row.employeeId)}
          >
            {input.t('storeRankings.profileGo')}
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Button>
        ) : (
          <span className="store-rankings-action-empty" aria-hidden="true">
            {input.t('storeRankings.summaryAccess')}
          </span>
        )}
      </TableCell>
    </TableRow>
  )
}

function RankChip(input: { rank: number | null; t: TranslateFunction }) {
  const medal = input.rank === 1 ? '\u{1F947}' : input.rank === 2 ? '\u{1F948}' : input.rank === 3 ? '\u{1F949}' : null

  return (
    <span className="store-rankings-rank-chip">
      {medal ? <span aria-hidden="true">{medal}</span> : null}
      {formatRankBadge(input.t, input.rank)}
    </span>
  )
}

function RankingEntity(input: {
  label: string
  detail?: string
  kind: 'store' | 'personnel'
  rank: number | null
}) {
  const tone =
    input.rank === 1 ? 'plum' : input.rank === 2 ? 'aqua' : input.rank === 3 ? 'mint' : 'neutral'
  const Icon = input.kind === 'store' ? StoreIcon : UserRound

  return (
    <div className="store-rankings-entity">
      <span className={`store-rankings-entity-icon store-rankings-entity-${tone}`}>
        <Icon aria-hidden="true" />
      </span>
      <span className={`store-rankings-entity-copy store-rankings-entity-copy-${input.kind}`}>
        <strong>{input.label}</strong>
        {input.detail ? <span className="store-rankings-entity-detail">{input.detail}</span> : null}
      </span>
    </div>
  )
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
        {isChecklist ? <span className="store-rankings-live-dot" aria-hidden="true" /> : null}
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
