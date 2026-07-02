import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowRight,
  ArrowUpDown,
  CalendarDays,
  CircleSlash2,
  Clock3,
  Download,
  Filter,
  RefreshCw,
  Search,
  Store,
  TrendingUp,
  UsersRound,
  X,
} from 'lucide-react'
import type { AuthSessionSummary } from '../features/auth/api'
import { getAssignedStoreIds, getReadRegionIds, getReadStoreIds } from '../features/auth/authorization'
import { getOrgStores, getStoreEmployees, getStoreHeadcountGap } from '../features/workforce/api'
import { formatNumber } from '../lib/format'
import { normalizeDisplayLabel } from '../lib/display-labels'
import type { AppLocale } from '../lib/i18n'
import { getMonthRange, interpretNormStaffingStatus } from './store-workforce-headcount'
import { deriveWorkforceSummary, getTenureFromDate } from './store-workforce-model'
import {
  compareRows,
  copy,
  downloadCsv,
  formatDateLabel,
  formatGapLabel,
  formatNormLabel,
  formatNullableNumber,
  formatShortage,
  formatTurnover,
  getAverageTenureMonths,
  getUniqueIds,
  resolveManagerName,
  statusCopy,
  toFiniteNumber,
  type DetailTab,
  type RegionStoreViewModel,
  type SortDirection,
  type SortKey,
  type StatusFilter,
} from './store-workforce-region-view-model'

export function RegionWorkforceView(input: {
  authSummary: AuthSessionSummary | null
}) {
  const locale: AppLocale = 'tr'
  const now = useMemo(() => new Date(), [])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<{ direction: SortDirection; key: SortKey }>({ direction: 'asc', key: 'status' })
  const [detailStoreId, setDetailStoreId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('people')
  const currentMonthRange = useMemo(() => getMonthRange(now), [now])
  const explicitReadStoreIds = useMemo(() => getUniqueIds(getReadStoreIds(input.authSummary)), [input.authSummary])
  const assignedStoreIds = useMemo(() => getUniqueIds(getAssignedStoreIds(input.authSummary)), [input.authSummary])
  const fallbackStoreIds = useMemo(
    () => getUniqueIds([...explicitReadStoreIds, ...assignedStoreIds]),
    [assignedStoreIds, explicitReadStoreIds],
  )
  const readRegionIds = useMemo(() => getUniqueIds(getReadRegionIds(input.authSummary)), [input.authSummary])
  const orgStoresQuery = useQuery({
    queryFn: getOrgStores,
    queryKey: ['store-workforce-region-org-stores', fallbackStoreIds.join('|'), readRegionIds.join('|')],
  })
  const scopedStores = useMemo(
    () => {
      const orgStores = orgStoresQuery.data?.items ?? []
      const scopedOrgStores = fallbackStoreIds.length > 0
        ? orgStores.filter((store) => fallbackStoreIds.includes(store.store_id))
        : orgStores

      if (scopedOrgStores.length > 0) {
        return scopedOrgStores.map((store) => ({
          storeId: store.store_id,
          storeLabel: normalizeDisplayLabel(store.store_name || store.store_code || store.store_id, 'Mağaza adı yok'),
        }))
      }

      return fallbackStoreIds.map((storeId) => ({
        storeId,
        storeLabel: 'Mağaza adı yok',
      }))
    },
    [fallbackStoreIds, orgStoresQuery.data?.items],
  )
  const storeEmployeeQueries = useQueries({
    queries: scopedStores.map((store) => ({
      enabled: Boolean(store.storeId),
      queryFn: () => getStoreEmployees(store.storeId),
      queryKey: ['workforce-store-employees', 'store-workforce-region', store.storeId],
    })),
  })
  const storeHeadcountQueries = useQueries({
    queries: scopedStores.map((store) => ({
      enabled: Boolean(store.storeId),
      queryFn: () => getStoreHeadcountGap({
        periodEnd: currentMonthRange.periodEnd,
        periodStart: currentMonthRange.periodStart,
        storeId: store.storeId,
      }),
      queryKey: [
        'workforce-headcount-gap',
        'store-workforce-region',
        store.storeId,
        currentMonthRange.periodStart,
        currentMonthRange.periodEnd,
      ],
    })),
  })
  const rows = useMemo<RegionStoreViewModel[]>(
    () =>
      scopedStores.map((store, index) => {
        const employeeQuery = storeEmployeeQueries[index]
        const headcountQuery = storeHeadcountQueries[index]
        const employees = employeeQuery?.data?.items ?? []
        const headcountGap = headcountQuery?.data ?? null
        const summary = deriveWorkforceSummary(employees, now, locale)
        const actualHeadcount = toFiniteNumber(headcountGap?.activeHeadcount) ?? employees.length
        const rawPlannedHeadcount = toFiniteNumber(headcountGap?.plannedHeadcount)
        const plannedHeadcount = rawPlannedHeadcount === null || rawPlannedHeadcount <= 0 ? null : rawPlannedHeadcount
        const status = interpretNormStaffingStatus({ actualFallback: employees.length, headcountGap })
        const openHeadcount = plannedHeadcount === null ? null : Math.max(0, plannedHeadcount - actualHeadcount)
        const overHeadcount = plannedHeadcount === null ? null : Math.max(0, actualHeadcount - plannedHeadcount)

        return {
          ...store,
          activeHeadcount: actualHeadcount,
          averageTenureMonths: getAverageTenureMonths(employees, now),
          employees,
          headcountGap,
          isEmployeeError: employeeQuery?.isError ?? false,
          isEmployeeLoading: employeeQuery?.isLoading ?? false,
          isError: (employeeQuery?.isError ?? false) || (headcountQuery?.isError ?? false),
          isHeadcountError: headcountQuery?.isError ?? false,
          isHeadcountLoading: headcountQuery?.isLoading ?? false,
          isLoading: (employeeQuery?.isLoading ?? false) || (headcountQuery?.isLoading ?? false),
          managerName: resolveManagerName(employees),
          normLabel: formatNormLabel({ actual: actualHeadcount, locale, planned: plannedHeadcount }),
          openHeadcount,
          overHeadcount,
          plannedHeadcount,
          shortageDays: status === 'short' ? toFiniteNumber(headcountGap?.shortageDays) : null,
          status,
          summary,
          turnover: toFiniteNumber(headcountGap?.turnoverRate),
        }
      }),
    [locale, now, scopedStores, storeEmployeeQueries, storeHeadcountQueries],
  )
  const visibleRows = useMemo(
    () => {
      const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR')
      const filtered = rows.filter((row) => {
        const haystack = [
          row.storeLabel,
          row.managerName ?? '',
        ].join(' ').toLocaleLowerCase('tr-TR')
        const matchesQuery = normalizedQuery === '' || haystack.includes(normalizedQuery)
        const matchesStatus = statusFilter === 'all' || row.status === statusFilter
        return matchesQuery && matchesStatus
      })

      return filtered.sort((left, right) => {
        const result = compareRows(left, right, sort.key)
        return sort.direction === 'asc' ? result : -result
      })
    },
    [query, rows, sort.direction, sort.key, statusFilter],
  )
  const detailStore = rows.find((row) => row.storeId === detailStoreId) ?? null
  const shortStoreCount = rows.filter((row) => row.status === 'short').length
  const totalOpenHeadcount = rows.reduce((sum, row) => sum + (row.openHeadcount ?? 0), 0)
  const allEmployees = useMemo(() => rows.flatMap((row) => row.employees), [rows])
  const regionSummary = useMemo(() => deriveWorkforceSummary(allEmployees, now, locale), [allEmployees, locale, now])
  const turnoverValues = useMemo(
    () => rows.map((row) => row.turnover).filter((value): value is number => value !== null),
    [rows],
  )
  const averageTurnover = useMemo(
    () => {
      if (turnoverValues.length === 0) return null
      return turnoverValues.reduce((sum, value) => sum + value, 0) / turnoverValues.length
    },
    [turnoverValues],
  )
  const isLoading = orgStoresQuery.isLoading || rows.some((row) => row.isLoading)

  const refresh = () => {
    void orgStoresQuery.refetch()
    for (const queryResult of [...storeEmployeeQueries, ...storeHeadcountQueries]) {
      void queryResult.refetch()
    }
  }

  const exportRows = () => {
    const headers = ['Mağaza', 'Aktif personel', 'Norm / Fiili', 'Durum', 'Eksik gün', 'Turnover']
    const csvRows = visibleRows.map((row) => [
      row.storeLabel,
      formatNullableNumber(row.activeHeadcount, locale),
      row.normLabel,
      statusCopy[row.status].label,
      formatShortage(row),
      formatTurnover(row.turnover),
    ])
    downloadCsv('norm-kadro-guncel.csv', [headers, ...csvRows])
  }

  const toggleSort = (key: SortKey) => {
    setSort((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      }

      return { key, direction: key === 'name' || key === 'status' ? 'asc' : 'desc' }
    })
  }

  return (
    <section
      aria-labelledby="store-workforce-title"
      className="store-workforce-command"
      data-testid="store-workforce-page"
    >
      <header className="swc-hero">
        <div className="swc-hero-copy">
          <div className="swc-kicker">
            <span>{copy.pageTitle}</span>
            <b>{copy.yearAria}</b>
            <b>{copy.managerBadge}</b>
          </div>
          <div className="swc-title-row">
            <span className="swc-title-icon" aria-hidden="true">
              <UsersRound />
            </span>
            <h1 id="store-workforce-title">{copy.pageTitle}</h1>
          </div>
          <p>{copy.pageSubtitle}</p>
        </div>
        <div className="swc-hero-actions">
          <Button type="button" variant="outline" className="swc-outline-button" onClick={exportRows}>
            <Download data-icon="inline-start" />
            {copy.exportAction}
          </Button>
          <Button type="button" className="swc-primary-button" disabled={isLoading} onClick={refresh}>
            <RefreshCw data-icon="inline-start" />
            {copy.refreshAction}
          </Button>
        </div>
      </header>

      <section className="swc-metric-grid" aria-label="Norm kadro özetleri">
        <MetricCard icon={<Store />} label={copy.totalStoresMetric} note="Aktif bölge portföyü" value={formatNumber(rows.length, locale)} />
        <MetricCard
          icon={<CircleSlash2 />}
          label={copy.gapMetric}
          note={`${formatNumber(totalOpenHeadcount, locale)} açık pozisyon`}
          tone="danger"
          value={formatNumber(shortStoreCount, locale)}
        />
        <MetricCard
          icon={<TrendingUp />}
          label={copy.turnoverMetric}
          note={turnoverValues.length > 0 ? `${formatNumber(turnoverValues.length, locale)} mağazada veri var` : 'Ayrılık geçmişi yok'}
          tone="watch"
          value={formatTurnover(averageTurnover)}
        />
        <MetricCard
          icon={<UsersRound />}
          label={copy.averageTenureMetric}
          note="Aktif personel"
          value={isLoading ? 'Yükleniyor' : regionSummary.averageTenureLabel}
        />
      </section>

      <section className="swc-toolbar" aria-label="Norm kadro filtreleri">
        <label className="swc-search-field">
          <Search aria-hidden="true" />
          <Input
            aria-label={copy.searchAria}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
            value={query}
          />
        </label>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
          <SelectTrigger aria-label="Durum filtresi" className="swc-select-trigger">
            <Filter aria-hidden="true" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" position="popper">
            <SelectItem value="all">{copy.allStatuses}</SelectItem>
            <SelectItem value="short">Eksik kadro</SelectItem>
            <SelectItem value="balanced">Tam kadro</SelectItem>
            <SelectItem value="over">Fazla kadro</SelectItem>
          </SelectContent>
        </Select>
        <button aria-label={copy.yearAria} className="swc-select-trigger swc-year-trigger" disabled type="button">
          <CalendarDays aria-hidden="true" />
          <span>{copy.yearAria}</span>
        </button>
      </section>

      <section className="swc-content-grid">
        <div className="swc-ledger">
          <div className="swc-ledger-head">
            <SortHeader
              active={sort.key === 'name'}
              direction={sort.direction}
              label={copy.storeColumn}
              onClick={() => toggleSort('name')}
            />
            <SortHeader
              active={sort.key === 'active'}
              direction={sort.direction}
              label={copy.activeColumn}
              onClick={() => toggleSort('active')}
            />
            <SortHeader
              active={sort.key === 'norm'}
              direction={sort.direction}
              label={copy.normActualColumn}
              onClick={() => toggleSort('norm')}
            />
            <SortHeader
              active={sort.key === 'status'}
              direction={sort.direction}
              label={copy.statusColumn}
              onClick={() => toggleSort('status')}
            />
            <SortHeader
              active={sort.key === 'shortage'}
              direction={sort.direction}
              label={copy.shortageColumn}
              onClick={() => toggleSort('shortage')}
            />
            <SortHeader
              active={sort.key === 'turnover'}
              direction={sort.direction}
              label={copy.turnoverColumn}
              onClick={() => toggleSort('turnover')}
            />
            <span>{copy.actionColumn}</span>
          </div>

          {visibleRows.length > 0 ? (
            <div className="swc-ledger-list" data-testid="store-workforce-region-rows">
              {visibleRows.map((row, index) => (
                <StoreRow
                  index={index}
                  key={row.storeId}
                  locale={locale}
                  onDetail={() => {
                    setDetailStoreId(row.storeId)
                    setDetailTab('people')
                  }}
                  row={row}
                />
              ))}
            </div>
          ) : (
            <div className="swc-empty-state">
              <strong>{copy.emptyTitle}</strong>
              <p>{copy.emptyCopy}</p>
            </div>
          )}
        </div>

      </section>

      <StoreDossier
        activeTab={detailTab}
        locale={locale}
        onClose={() => setDetailStoreId(null)}
        row={detailStore}
        setActiveTab={setDetailTab}
      />
    </section>
  )
}

function MetricCard(input: {
  icon: ReactNode
  label: string
  note: string
  tone?: 'danger' | 'default' | 'watch'
  value: string
}) {
  return (
    <article className={`swc-metric-card ${input.tone ?? 'default'}`}>
      <span className="swc-metric-icon" aria-hidden="true">{input.icon}</span>
      <div className="swc-metric-copy">
        <span>{input.label}</span>
        <b>{input.value}</b>
        <small>{input.note}</small>
      </div>
    </article>
  )
}

function StoreRow(input: {
  index: number
  locale: AppLocale
  onDetail: () => void
  row: RegionStoreViewModel
}) {
  const status = statusCopy[input.row.status]
  const activeValue = input.row.isEmployeeLoading ? '...' : formatNullableNumber(input.row.activeHeadcount, input.locale)

  return (
    <article
      className={`swc-store-row ${input.row.status}`}
      data-testid="store-workforce-region-row"
      style={{ '--row-index': input.index } as CSSProperties}
    >
      <div className="swc-store-name">
        <span aria-hidden="true">
          <Store />
        </span>
        <div>
          <b>{input.row.storeLabel}</b>
          <small>{input.row.managerName ?? 'Müdür bilgisi yok'}</small>
        </div>
      </div>
      <div className="swc-count-cell">
        <b>{activeValue}</b>
        <span>aktif</span>
      </div>
      <div className="swc-count-cell">
        <b>{input.row.isHeadcountLoading ? '...' : input.row.normLabel}</b>
        <span>{formatGapLabel(input.row)}</span>
      </div>
      <Pill tone={status.tone}>{status.label}</Pill>
      <div className={`swc-days-cell ${input.row.status === 'short' ? 'hot' : ''}`}>
        <Clock3 />
        <b>{formatShortage(input.row)}</b>
      </div>
      <div className="swc-turnover-cell">
        <span>{formatTurnover(input.row.turnover)}</span>
        <i aria-hidden="true">
          <em style={{ width: input.row.turnover === null ? '0%' : `${Math.min(input.row.turnover * 2.3, 100)}%` }} />
        </i>
      </div>
      <Button
        className="swc-row-action"
        onClick={input.onDetail}
        type="button"
        variant="outline"
      >
        {copy.detailAction}
        <ArrowRight data-icon="inline-end" />
      </Button>
    </article>
  )
}

function StoreDossier(input: {
  activeTab: DetailTab
  locale: AppLocale
  onClose: () => void
  row: RegionStoreViewModel | null
  setActiveTab: (tab: DetailTab) => void
}) {
  const open = Boolean(input.row)
  const status = input.row ? statusCopy[input.row.status] : statusCopy.notConfigured

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) input.onClose()
      }}
    >
      <DialogContent
        closeLabel={copy.close}
        showCloseButton={false}
        className="swc-dossier-modal"
        data-testid="store-workforce-region-detail-dialog"
      >
        <div className="swc-modal-orbit" aria-hidden="true" />
        <header className="swc-modal-header">
          <div>
            <div className="swc-kicker compact">
              <span>{input.row?.managerName ?? 'Müdür bilgisi yok'}</span>
              <b>{status.label}</b>
            </div>
            <DialogTitle>{input.row ? `${input.row.storeLabel} Norm Kadro dosyası` : 'Norm Kadro dosyası'}</DialogTitle>
            <DialogDescription>
              Mağaza norm dengesi, aktif personel ve pozisyon görünümü.
            </DialogDescription>
          </div>
          <button aria-label={copy.close} className="swc-close-button" onClick={input.onClose} type="button">
            <X />
          </button>
        </header>

        <div className="swc-modal-summary">
          <Fact label="Norm / fiili" value={input.row?.normLabel ?? '-'} />
          <Fact label="Eksik süre" value={input.row ? formatShortage(input.row) : '-'} />
          <Fact label="Yıl turnover" value={input.row ? formatTurnover(input.row.turnover) : '-'} />
          <Fact label="Ortalama kıdem" value={input.row?.summary.averageTenureLabel ?? '-'} />
        </div>

        <div className="swc-modal-tabs">
          <button
            aria-selected={input.activeTab === 'people'}
            className={`swc-tab-trigger ${input.activeTab === 'people' ? 'active' : ''}`}
            onClick={() => input.setActiveTab('people')}
            type="button"
          >
            Personel
          </button>
          <button
            aria-selected={input.activeTab === 'positions'}
            className={`swc-tab-trigger ${input.activeTab === 'positions' ? 'active' : ''}`}
            onClick={() => input.setActiveTab('positions')}
            type="button"
          >
            Pozisyon
          </button>
          <button
            aria-selected={input.activeTab === 'history'}
            className={`swc-tab-trigger ${input.activeTab === 'history' ? 'active' : ''}`}
            onClick={() => input.setActiveTab('history')}
            type="button"
          >
            Geçmiş
          </button>
        </div>

        <div className="swc-modal-body">
          {input.activeTab === 'people' ? <PeoplePane locale={input.locale} row={input.row} /> : null}
          {input.activeTab === 'positions' ? <PositionsPane locale={input.locale} row={input.row} /> : null}
          {input.activeTab === 'history' ? <HistoryPane locale={input.locale} row={input.row} /> : null}
        </div>

        <DialogFooter className="swc-modal-footer">
          <Button type="button" variant="outline" className="swc-outline-button" onClick={input.onClose}>
            {copy.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PeoplePane(input: { locale: AppLocale; row: RegionStoreViewModel | null }) {
  const employees = input.row?.employees ?? []
  const now = useMemo(() => new Date(), [])

  if (employees.length === 0) {
    return (
      <div className="swc-empty-state compact">
        <strong>Personel yok</strong>
        <p>Bu mağazada aktif personel görünmüyor.</p>
      </div>
    )
  }

  return (
    <div className="swc-people-table">
      <div className="swc-people-head">
        <span>Personel</span>
        <span>Pozisyon</span>
        <span>Kıdem</span>
        <span>Başlangıç</span>
      </div>
      {employees.map((employee) => (
        <div className="swc-people-row" key={employee.employeeId}>
          <div>
            <b>{employee.displayName}</b>
            <small>{employee.externalEmployeeRef ?? 'Personel referansı yok'}</small>
          </div>
          <span>{employee.positionName || 'Pozisyon bilgisi yok'}</span>
          <span>{getTenureFromDate(employee.assignmentStartDate, now, input.locale).label}</span>
          <span>{formatDateLabel(employee.assignmentStartDate)}</span>
        </div>
      ))}
    </div>
  )
}

function HistoryPane(input: { locale: AppLocale; row: RegionStoreViewModel | null }) {
  const employees = input.row?.employees ?? []
  const historyRows = employees
    .filter((employee) => Boolean(employee.assignmentStartDate))
    .map((employee) => ({
      date: employee.assignmentStartDate,
      name: employee.displayName,
      position: employee.positionName || 'Pozisyon bilgisi yok',
      reference: employee.externalEmployeeRef ?? 'Personel referansı yok',
    }))
    .sort((left, right) => new Date(`${right.date}T00:00:00`).getTime() - new Date(`${left.date}T00:00:00`).getTime())

  if (historyRows.length === 0) {
    return (
      <div className="swc-empty-state compact">
        <strong>Geçmiş yok</strong>
        <p>Bu mağaza için giriş geçmişi bulunamadı.</p>
      </div>
    )
  }

  return (
    <div className="swc-history-list">
      {historyRows.map((item) => (
        <article className="swc-history-row" key={`${item.reference}-${item.date}`}>
          <div>
            <b>{item.name}</b>
            <span>{item.position}</span>
          </div>
          <Pill tone="mint">Giriş</Pill>
          <strong>{formatDateLabel(item.date)}</strong>
        </article>
      ))}
    </div>
  )
}

function PositionsPane(input: { locale: AppLocale; row: RegionStoreViewModel | null }) {
  const rows = input.row?.summary.positionRows ?? []

  if (rows.length === 0) {
    return (
      <div className="swc-empty-state compact">
        <strong>Pozisyon yok</strong>
        <p>Aktif personel pozisyonu bulunamadı.</p>
      </div>
    )
  }

  return (
    <div className="swc-position-board">
      {rows.map((row) => (
        <article className="swc-position-card ok" key={row.label}>
          <div>
            <b>{row.label}</b>
            <span>{formatNumber(row.count, input.locale)} aktif personel</span>
          </div>
          <strong>{formatNumber(row.count, input.locale)}</strong>
        </article>
      ))}
    </div>
  )
}

function SortHeader(input: {
  active: boolean
  direction: SortDirection
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-pressed={input.active}
      className={`swc-column-filter-trigger ${input.active ? 'active' : ''}`}
      onClick={input.onClick}
      type="button"
    >
      <span>{input.label}</span>
      <ArrowUpDown aria-hidden="true" data-direction={input.active ? input.direction : undefined} />
    </button>
  )
}

function Pill(input: { children: ReactNode; tone: 'blue' | 'mint' | 'neutral' | 'rose' }) {
  return <span className={`swc-pill ${input.tone}`}>{input.children}</span>
}

function Fact(input: { label: string; value: string }) {
  return (
    <div className="swc-fact">
      <span>{input.label}</span>
      <b>{input.value}</b>
    </div>
  )
}
