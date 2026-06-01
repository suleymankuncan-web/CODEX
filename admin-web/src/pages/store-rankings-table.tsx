import { ArrowRight, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { PersonnelRankingRow, RankingMetricValue, RankingSummary, StoreRankingRow } from '../features/reports/api'
import type { AppLocale } from '../lib/i18n'
import {
  type ActiveRankingList,
  type RankingSortDirection,
  type RankingSortKey,
  formatMetricValue,
  formatNumber,
  formatRankBadge,
  getMetricByCode,
  getMetricLabel,
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
  onOpenStoreDetail: (row: StoreRankingRow) => void
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
      ? input.t('storeRankings.storeList')
      : input.t('storeRankings.personnelList')
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
    <StoreSectionCard
      title={title}
      description={caption}
      badge={{
        label: input.canSeeDetails
          ? input.t('storeRankings.fullDetailAccess')
          : input.t('storeRankings.summaryAccess'),
        tone: input.canSeeDetails ? 'calm' : 'warning',
      }}
      className="store-rankings-board"
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
          className="tw:grid tw:w-full tw:grid-cols-1 tw:gap-2 tw:sm:grid-cols-2"
        >
          <ToggleGroupItem
            value="stores"
            role="tab"
            aria-selected={input.activeList === 'stores'}
            className="tw:gap-2"
          >
            {input.t('storeRankings.storeList')}
            <StoreStatusBadge tone="accent">
              {formatNumber(input.locale, input.t, input.ranking.storeLeaderboard.meta.total)}
            </StoreStatusBadge>
          </ToggleGroupItem>
          <ToggleGroupItem
            value="personnel"
            role="tab"
            aria-selected={input.activeList === 'personnel'}
            className="tw:gap-2"
          >
            {input.t('storeRankings.personnelList')}
            <StoreStatusBadge tone="calm">
              {formatNumber(input.locale, input.t, input.ranking.personnelLeaderboard.meta.total)}
            </StoreStatusBadge>
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="tw:overflow-x-auto tw:rounded-lg tw:border">
          <Table
            className={`store-rankings-table tw:min-w-[980px]${
              input.canSeeDetails ? ' store-rankings-table-detail' : ' store-rankings-table-summary'
            }`}
            aria-describedby="rankings-heading"
          >
            <TableCaption className="tw:sr-only">{caption}</TableCaption>
            {input.activeList === 'stores' ? (
              <StoreRankingTable
                rows={input.storeRows}
                canSeeDetails={input.canSeeDetails}
                sortKey={input.sortKey}
                sortDirection={input.sortDirection}
                onSortChange={input.onSortChange}
                onOpenStoreDetail={input.onOpenStoreDetail}
                locale={input.locale}
                t={input.t}
              />
            ) : (
              <PersonnelRankingTable
                rows={input.personnelRows}
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
          className="tw:flex tw:flex-col tw:gap-3 tw:border-t tw:pt-3 tw:text-sm tw:text-muted-foreground tw:sm:flex-row tw:sm:items-center tw:sm:justify-between"
          aria-label={input.t('storeRankings.pagination')}
        >
          <span className="tw:font-medium">
            {input.t('storeRankings.pageInfo', {
              start: input.forceEmpty || !meta.total ? 0 : input.offset + 1,
              end: input.offset + rows.length,
              total: input.forceEmpty ? 0 : meta.total,
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
              <ChevronLeft data-icon="inline-start" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => input.onOffsetChange(input.offset + input.limit)}
              disabled={!input.hasNextPage}
              aria-label={input.t('storeRankings.nextPageLabel')}
            >
              <ChevronRight data-icon="inline-start" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </StoreSectionCard>
  )
}

function StoreRankingTable(input: {
  rows: StoreRankingRow[]
  canSeeDetails: boolean
  sortKey: RankingSortKey
  sortDirection: RankingSortDirection
  onSortChange: (value: RankingSortKey) => void
  onOpenStoreDetail: (row: StoreRankingRow) => void
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <>
      <TableHeader>
        <TableRow>
          <TableHead className="tw:w-20 tw:text-center">
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
          <TableHead className="tw:text-center">
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
                <TableHead key={code} className="tw:text-center">
                  <SortButton
                    label={getMetricLabel(input.t, code)}
                    sortKey={code}
                    activeSortKey={input.sortKey}
                    sortDirection={input.sortDirection}
                    onSortChange={input.onSortChange}
                  />
                </TableHead>
              ))
            : null}
          <TableHead className="tw:text-center">{input.t('storeRankings.action')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {input.rows.length ? (
          input.rows.map((row) => (
            <StoreRankingTableRow
              key={row.storeId}
              row={row}
              canSeeDetails={input.canSeeDetails}
              locale={input.locale}
              t={input.t}
              onOpenStoreDetail={input.onOpenStoreDetail}
            />
          ))
        ) : (
          <EmptyRankingRow
            colSpan={input.canSeeDetails ? storeMetricCodes.length + 4 : 4}
            description={input.t('storeRankings.noStores')}
          />
        )}
      </TableBody>
    </>
  )
}

function PersonnelRankingTable(input: {
  rows: PersonnelRankingRow[]
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
      <TableHeader>
        <TableRow>
          <TableHead className="tw:w-20 tw:text-center">
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
          <TableHead className="tw:text-center">
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
                <TableHead key={code} className="tw:text-center">
                  <SortButton
                    label={getMetricLabel(input.t, code)}
                    sortKey={code}
                    activeSortKey={input.sortKey}
                    sortDirection={input.sortDirection}
                    onSortChange={input.onSortChange}
                  />
                </TableHead>
              ))
            : null}
          <TableHead className="tw:text-center">{input.t('storeRankings.action')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {input.rows.length ? (
          input.rows.map((row) => (
            <PersonnelRankingTableRow
              key={row.employeeId}
              row={row}
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
      className={`store-rankings-sort-button tw:h-auto tw:px-0 tw:py-0 tw:text-xs tw:font-medium tw:uppercase tw:tracking-wide${
        input.compact ? ' tw:mx-auto' : ''
      }`}
      type="button"
      size="sm"
      variant="ghost"
      onClick={() => input.onSortChange(input.sortKey)}
      aria-sort={active ? (input.sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}
    >
      {input.label}
      <ArrowUpDown data-icon="inline-end" aria-hidden="true" />
      {active ? <span>{input.sortDirection === 'desc' ? '↓' : '↑'}</span> : null}
    </Button>
  )
}

function StoreRankingTableRow(input: {
  row: StoreRankingRow
  canSeeDetails: boolean
  locale: AppLocale
  t: TranslateFunction
  onOpenStoreDetail: (row: StoreRankingRow) => void
}) {
  const row = input.row

  return (
    <TableRow>
      <TableCell className="tw:text-center" data-label={input.t('storeRankings.rankColumn')}>
        <RankChip rank={row.rank} t={input.t} />
      </TableCell>
      <TableCell data-label={input.t('storeRankings.store')}>
        <RankingEntity label={row.storeName ?? row.storeId} />
      </TableCell>
      <TableCell className="tw:text-center" data-label={input.t('storeRankings.storeScore')}>
        <RankingScore value={row.scoreValue} locale={input.locale} t={input.t} />
      </TableCell>
      {input.canSeeDetails
        ? storeMetricCodes.map((code) => (
            <TableCell className="tw:text-center" data-label={getMetricLabel(input.t, code)} key={code}>
              <RankingMetricCell
                metric={getMetricByCode(row.metrics, code)}
                code={code}
                locale={input.locale}
                t={input.t}
              />
            </TableCell>
          ))
        : null}
      <TableCell className="tw:text-center" data-label={input.t('storeRankings.action')}>
        {input.canSeeDetails ? (
          <Button
            type="button"
            size="sm"
            onClick={() => input.onOpenStoreDetail(row)}
          >
            {input.t('storeRankings.openStoreDetail')}
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  )
}

function PersonnelRankingTableRow(input: {
  row: PersonnelRankingRow
  canSeeDetails: boolean
  canOpenProfile: boolean
  locale: AppLocale
  t: TranslateFunction
  onOpenPersonnelProfile: (employeeId: string) => void
}) {
  const row = input.row

  return (
    <TableRow>
      <TableCell className="tw:text-center" data-label={input.t('storeRankings.rankColumn')}>
        <RankChip rank={row.rank} t={input.t} />
      </TableCell>
      <TableCell data-label={input.t('storeRankings.personnel')}>
        <RankingEntity label={row.displayName} />
      </TableCell>
      <TableCell data-label={input.t('storeRankings.store')}>
        <span className="tw:text-sm tw:text-muted-foreground">
          {row.storeName ?? input.t('storeRankings.noStore')}
        </span>
      </TableCell>
      <TableCell className="tw:text-center" data-label={input.t('storeRankings.personnelScore')}>
        <RankingScore value={row.scoreValue} locale={input.locale} t={input.t} />
      </TableCell>
      {input.canSeeDetails
        ? personnelMetricCodes.map((code) => (
            <TableCell className="tw:text-center" data-label={getMetricLabel(input.t, code)} key={code}>
              <RankingMetricCell
                metric={getMetricByCode(row.metrics, code)}
                code={code}
                locale={input.locale}
                t={input.t}
              />
            </TableCell>
          ))
        : null}
      <TableCell className="tw:text-center" data-label={input.t('storeRankings.action')}>
        {input.canOpenProfile ? (
          <Button
            type="button"
            size="sm"
            onClick={() => input.onOpenPersonnelProfile(row.employeeId)}
          >
            {input.t('storeRankings.profileGo')}
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  )
}

function RankChip(input: { rank: number | null; t: TranslateFunction }) {
  const medal = input.rank === 1 ? '🥇' : input.rank === 2 ? '🥈' : input.rank === 3 ? '🥉' : null

  return (
    <StoreStatusBadge tone="accent" className="tw:gap-1">
      {medal ? <span aria-hidden="true">{medal}</span> : null}
      {formatRankBadge(input.t, input.rank)}
    </StoreStatusBadge>
  )
}

function RankingEntity(input: {
  label: string
}) {
  return (
    <strong className="tw:block tw:max-w-[18rem] tw:truncate tw:text-sm tw:font-semibold tw:text-foreground">
      {input.label}
    </strong>
  )
}

function RankingScore(input: {
  value: number | null | undefined
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <strong className="store-rankings-scorebar tw:text-lg tw:font-semibold tw:tracking-tight tw:text-foreground">
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
      <span
        className={
          isChecklist
            ? 'tw:inline-flex tw:min-h-8 tw:items-center tw:justify-center tw:gap-2 tw:rounded-full tw:border tw:border-destructive/20 tw:bg-destructive/10 tw:px-3 tw:text-xs tw:font-medium tw:text-destructive'
            : 'tw:text-sm tw:text-muted-foreground'
        }
      >
        {isChecklist ? (
          <span className="tw:size-2 tw:rounded-full tw:bg-destructive tw:shadow-[0_0_0_4px_hsl(var(--destructive)/0.12)]" aria-hidden="true" />
        ) : null}
        {isChecklist ? input.t('storeRankings.notDone') : input.t('common.noData')}
      </span>
    )
  }

  return (
    <span className="tw:inline-flex tw:min-h-8 tw:min-w-14 tw:items-center tw:justify-center tw:rounded-full tw:border tw:bg-card/80 tw:px-3 tw:text-sm tw:font-medium tw:text-foreground">
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
    return <span className="tw:text-sm tw:text-muted-foreground">{input.t('common.noData')}</span>
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
