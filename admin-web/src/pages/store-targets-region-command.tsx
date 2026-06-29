import { useMemo, useState, type ReactNode } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  RefreshCcw,
  Search,
  Store,
  Target,
  UsersRound,
  X,
} from 'lucide-react'
import type { AuthSessionSummary } from '../features/auth/api'
import { canApproveTargetDistributionRequest } from '../features/auth/authorization'
import {
  approveTargetDistributionRequest,
  type TargetCoverageRow,
  type TargetCoverageSummary,
  type TargetDistributionRequest,
} from '../features/targets/api'
import type { AppLocale } from '../lib/i18n'
import { formatMonthLabel } from './store-targets-page-model'
import { StoreTargetsPeriodPicker } from './store-targets-period-picker'
import {
  createPeoplePreview,
  createRegionTargetRows,
  decisionCopy,
  filterOptions,
  formatCoveragePercent,
  formatDateLabel,
  formatDelta,
  formatMoney,
  formatPlainNumber,
  formatTargetShare,
  parseCurrencyInputValue,
  resolveApprovalState,
  statusCopy,
  type ApprovalDraft,
  type RegionTargetRow,
  type StoreOption,
  type TargetCommandStatus,
} from './store-targets-region-command-model'

type TargetSortKey = 'store' | 'storeTarget' | 'distribution' | 'personnel' | 'status'
type TargetSortDirection = 'asc' | 'desc'
type TargetSortState = { key: TargetSortKey; direction: TargetSortDirection }

export function StoreTargetsRegionCommand(input: {
  activeRequestMonth: string
  assignedStoreIds: string[]
  authSummary: AuthSessionSummary | null
  coverageRows: TargetCoverageRow[]
  coverageSummary: TargetCoverageSummary
  onApprovalNoteChange: (requestId: string, value: string) => void
  onMonthChange: (month: string) => void
  onRefresh: () => void
  approveMutation: UseMutationResult<
    Awaited<ReturnType<typeof approveTargetDistributionRequest>>,
    Error,
    Parameters<typeof approveTargetDistributionRequest>[0]
  >
  approvalNotes: Record<string, string>
  locale: AppLocale
  storeOptions: StoreOption[]
  targetRequests: TargetDistributionRequest[]
}) {
  const [activeFilter, setActiveFilter] = useState<TargetCommandStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const [drawerStoreId, setDrawerStoreId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [approvalDrafts, setApprovalDrafts] = useState<Record<string, ApprovalDraft>>({})
  const [sortState, setSortState] = useState<TargetSortState>({ key: 'store', direction: 'asc' })

  const storeRows = useMemo(
    () =>
      createRegionTargetRows({
        assignedStoreIds: input.assignedStoreIds,
        coverageRows: input.coverageRows,
        locale: input.locale,
        month: input.activeRequestMonth,
        storeOptions: input.storeOptions,
        targetRequests: input.targetRequests,
      }),
    [
      input.activeRequestMonth,
      input.assignedStoreIds,
      input.coverageRows,
      input.locale,
      input.storeOptions,
      input.targetRequests,
    ],
  )

  const filteredStores = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('tr-TR')

    return storeRows.filter((store) => {
      const matchesFilter = activeFilter === 'all' || store.status === activeFilter
      const matchesSearch =
        !search ||
        `${store.storeName} ${store.subtitle}`.toLocaleLowerCase('tr-TR').includes(search)

      return matchesFilter && matchesSearch
    })
  }, [activeFilter, query, storeRows])

  const sortedStores = useMemo(
    () => sortTargetRows(filteredStores, sortState),
    [filteredStores, sortState],
  )

  const selectedStore = storeRows.find((store) => store.storeId === drawerStoreId) ?? null
  const pendingCount = storeRows.filter((store) => store.status === 'pending').length
  const approvedCount = storeRows.filter((store) =>
    store.status === 'approved' || store.status === 'adjusted-approved',
  ).length
  const missingCount = storeRows.filter((store) => store.status === 'missing').length

  const closeDrawer = () => {
    setDrawerStoreId(null)
    setNotice(null)
  }
  const toggleSort = (key: TargetSortKey) => {
    setSortState((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  return (
    <section className="targets-prototype" aria-labelledby="targets-prototype-title">
      <header className="targets-prototype-header">
        <div>
          <div className="targets-prototype-pills">
            <span className="targets-pill targets-pill-primary">
              <Target size={14} />
              Hedefler
            </span>
            <span className="targets-pill">{formatMonthLabel(input.activeRequestMonth, input.locale)}</span>
            <span className="targets-pill targets-pill-warning">{pendingCount} karar bekliyor</span>
            <span className="targets-pill">{approvedCount} onaylandı</span>
          </div>
          <h1 id="targets-prototype-title">Hedefler</h1>
          <p>Mağaza hedefleri, personel dağılımı ve bölge onayları.</p>
        </div>

        <div className="targets-header-actions">
          <StoreTargetsPeriodPicker
            locale={input.locale}
            onPeriodChange={input.onMonthChange}
            period={input.activeRequestMonth}
            triggerClassName="targets-month-button"
          />
          <button type="button" onClick={input.onRefresh}>
            <RefreshCcw size={16} />
            Yenile
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('pending')}
            aria-pressed={activeFilter === 'pending'}
          >
            <Clock3 size={16} />
            Bekleyenleri göster
          </button>
        </div>
      </header>

      <div className="targets-metrics" aria-label="Hedef özeti">
        <MetricCard icon={<Store size={20} />} label="Toplam mağaza" note="Bölge portföyü" value={String(storeRows.length)} tone="plum" />
        <MetricCard
          icon={<UsersRound size={20} />}
          label="Personel hedefli"
          note={`${input.coverageSummary.coveredEmployees} / ${input.coverageSummary.totalEmployees} personel`}
          value={formatCoveragePercent(input.coverageSummary.coverageRate)}
          tone="cyan"
        />
        <MetricCard icon={<Clock3 size={20} />} label="Onay bekleyen" note="Bölge kararı" value={String(pendingCount)} tone="amber" />
        <MetricCard icon={<AlertTriangle size={20} />} label="Hedefsiz mağaza" note="Bu dönem aksiyon bekliyor" value={String(missingCount)} tone="rose" />
      </div>

      <section className="targets-toolbar" aria-label="Hedef filtreleri">
        <label className="targets-search">
          <Search size={17} />
          <input
            aria-label="Mağaza veya müdür ara"
            placeholder="Mağaza veya müdür ara"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="targets-segments" role="group" aria-label="Durum filtresi">
          {filterOptions.map((option) => (
            <button
              className={activeFilter === option.id ? 'active' : ''}
              key={option.id}
              onClick={() => setActiveFilter(option.id)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <div className="targets-workspace">
        <section className="targets-ledger" aria-label="Mağaza hedef listesi">
          <div className="targets-ledger-head">
            <TargetSortHeader label="Mağaza" sortKey="store" sortState={sortState} onSort={toggleSort} />
            <TargetSortHeader label="Mağaza hedefi" sortKey="storeTarget" sortState={sortState} onSort={toggleSort} />
            <TargetSortHeader label="Dağıtım" sortKey="distribution" sortState={sortState} onSort={toggleSort} />
            <TargetSortHeader label="Personel" sortKey="personnel" sortState={sortState} onSort={toggleSort} />
            <TargetSortHeader label="Durum" sortKey="status" sortState={sortState} onSort={toggleSort} />
            <span>Aksiyon</span>
          </div>
          <div className="targets-ledger-list">
            {sortedStores.map((store) => {
              const status = statusCopy[store.status]
              const preview = createPeoplePreview(store)

              return (
                <button
                  className={`targets-row targets-row-${store.status}`}
                  key={store.id}
                  onClick={() => {
                    setDrawerStoreId(store.storeId)
                    setNotice(null)
                  }}
                  type="button"
                >
                  <span className="targets-store-cell">
                    <span className="targets-store-icon">
                      <Store size={17} />
                    </span>
                    <span>
                      <strong>{store.storeName}</strong>
                      <small>{store.subtitle}</small>
                    </span>
                  </span>
                  <span>
                    <strong>{formatMoney(store.storeTarget, input.locale)}</strong>
                    <small>{store.submittedAt}</small>
                  </span>
                  <span>
                    <strong>{formatMoney(store.totalDistributed, input.locale)}</strong>
                    <small>{store.people} personel</small>
                  </span>
                  <span className="targets-people-preview" aria-label={`${store.storeName} personel özeti`}>
                    <strong>{preview.primary}</strong>
                    <small>{preview.secondary}</small>
                  </span>
                  <span className={`targets-status ${status.tone}`}>{status.label}</span>
                  <span className="targets-row-action">{status.action}</span>
                </button>
              )
            })}
          </div>
        </section>
      </div>

      {selectedStore ? (
        <TargetDecisionDrawer
          approvalDraft={selectedStore.request ? approvalDrafts[selectedStore.request.requestId] : undefined}
          approvalNote={selectedStore.request ? input.approvalNotes[selectedStore.request.requestId] ?? '' : ''}
          approveMutation={input.approveMutation}
          authSummary={input.authSummary}
          locale={input.locale}
          notice={notice}
          onAllocationChange={(employeeId, value) => {
            if (!selectedStore.request) return
            setApprovalDrafts((current) => ({
              ...current,
              [selectedStore.request!.requestId]: {
                ...(current[selectedStore.request!.requestId] ?? {}),
                allocations: {
                  ...(current[selectedStore.request!.requestId]?.allocations ?? {}),
                  [employeeId]: value,
                },
              },
            }))
          }}
          onClose={closeDrawer}
          onNoteChange={(value) => {
            if (selectedStore.request) {
              input.onApprovalNoteChange(selectedStore.request.requestId, value)
            }
          }}
          onReset={() => {
            if (!selectedStore.request) return
            setApprovalDrafts((current) => {
              const next = { ...current }
              delete next[selectedStore.request!.requestId]
              return next
            })
            setNotice('Değişiklikler geri alındı.')
          }}
          onSetNotice={setNotice}
          onSubmit={(payload) => input.approveMutation.mutate(payload)}
          onTotalChange={(value) => {
            if (!selectedStore.request) return
            setApprovalDrafts((current) => ({
              ...current,
              [selectedStore.request!.requestId]: {
                ...(current[selectedStore.request!.requestId] ?? {}),
                totalTargetValue: value,
              },
            }))
          }}
          store={selectedStore}
        />
      ) : null}
    </section>
  )
}

function TargetSortHeader(input: {
  label: string
  sortKey: TargetSortKey
  sortState: TargetSortState
  onSort: (key: TargetSortKey) => void
}) {
  const active = input.sortState.key === input.sortKey
  const indicator = active ? (input.sortState.direction === 'asc' ? '↑' : '↓') : '↕'

  return (
    <button
      aria-label={`${input.label} sırala`}
      aria-pressed={active}
      className={`targets-sort-heading ${active ? 'active' : ''}`}
      onClick={() => input.onSort(input.sortKey)}
      type="button"
    >
      {input.label}
      <span aria-hidden="true">{indicator}</span>
    </button>
  )
}

function sortTargetRows(rows: RegionTargetRow[], sortState: TargetSortState) {
  return [...rows].sort((left, right) => {
    const result = compareTargetRows(left, right, sortState)
    if (result !== 0) return result
    return left.storeName.localeCompare(right.storeName, 'tr-TR')
  })
}

function compareTargetRows(left: RegionTargetRow, right: RegionTargetRow, sortState: TargetSortState) {
  if (sortState.key === 'store') {
    return directionMultiplier(sortState.direction) * left.storeName.localeCompare(right.storeName, 'tr-TR')
  }

  if (sortState.key === 'storeTarget') {
    return compareNullableNumber(left.storeTarget, right.storeTarget, sortState.direction)
  }

  if (sortState.key === 'distribution') {
    return compareNullableNumber(left.totalDistributed, right.totalDistributed, sortState.direction)
  }

  if (sortState.key === 'personnel') {
    return compareNullableNumber(left.people, right.people, sortState.direction)
  }

  return directionMultiplier(sortState.direction) * (targetStatusOrder(left.status) - targetStatusOrder(right.status))
}

function compareNullableNumber(left: number | null, right: number | null, direction: TargetSortDirection) {
  const leftMissing = left === null || !Number.isFinite(left)
  const rightMissing = right === null || !Number.isFinite(right)
  if (leftMissing && rightMissing) return 0
  if (leftMissing) return 1
  if (rightMissing) return -1

  return direction === 'asc' ? Number(left) - Number(right) : Number(right) - Number(left)
}

function directionMultiplier(direction: TargetSortDirection) {
  return direction === 'asc' ? 1 : -1
}

function targetStatusOrder(status: TargetCommandStatus) {
  if (status === 'pending') return 0
  if (status === 'returned') return 1
  if (status === 'approved' || status === 'adjusted-approved') return 2
  if (status === 'missing') return 3
  return 4
}

function TargetDecisionDrawer(input: {
  approvalDraft: ApprovalDraft | undefined
  approvalNote: string
  approveMutation: UseMutationResult<
    Awaited<ReturnType<typeof approveTargetDistributionRequest>>,
    Error,
    Parameters<typeof approveTargetDistributionRequest>[0]
  >
  authSummary: AuthSessionSummary | null
  locale: AppLocale
  notice: string | null
  onAllocationChange: (employeeId: string, value: number) => void
  onClose: () => void
  onNoteChange: (value: string) => void
  onReset: () => void
  onSetNotice: (notice: string) => void
  onSubmit: (payload: Parameters<typeof approveTargetDistributionRequest>[0]) => void
  onTotalChange: (value: number) => void
  store: RegionTargetRow
}) {
  const approvalState = resolveApprovalState(input.store, input.approvalDraft)
  const canApprove =
    input.store.request !== null &&
    input.store.status === 'pending' &&
    canApproveTargetDistributionRequest(input.authSummary, input.store.storeId)
  const isApproving =
    input.approveMutation.isPending &&
    input.approveMutation.variables?.requestId === input.store.request?.requestId
  const note = input.approvalNote.trim()
  const canSubmit =
    canApprove &&
    !isApproving &&
    (!approvalState.hasEditedTargets ||
      (approvalState.hasEveryTarget && approvalState.totalsAligned && Boolean(note)))

  const submitApproval = () => {
    if (!input.store.request || !canApprove) return

    if (approvalState.hasEditedTargets) {
      if (!approvalState.totalsAligned) {
        input.onSetNotice('Personel hedef toplamı mağaza hedefiyle eşleşmeli.')
        return
      }

      if (!note) {
        input.onSetNotice('Düzenleyerek onay için kısa not yazın.')
        return
      }
    }

    input.onSubmit({
      requestId: input.store.request.requestId,
      ...(note ? { approvalNote: note } : {}),
      ...(approvalState.hasEditedTargets
        ? {
            approvedTotalTargetValue: approvalState.effectiveTotal,
            approvedAllocations: approvalState.allocations.map((allocation) => ({
              employeeId: allocation.employeeId,
              assigneeLabel: allocation.assigneeLabel,
              targetValue: allocation.targetValue,
              ...(allocation.note ? { note: allocation.note } : {}),
            })),
          }
        : {}),
    })
  }

  return (
    <div className="targets-drawer-layer" role="presentation">
      <button
        aria-label="Hedef detayını kapat"
        className="targets-drawer-backdrop"
        onClick={input.onClose}
        type="button"
      />
      <aside className="targets-detail targets-detail-drawer" aria-label="Seçili mağaza hedef dosyası">
        <div className="targets-detail-head">
          <div>
            <span className={`targets-status ${statusCopy[input.store.status].tone}`}>
              {statusCopy[input.store.status].label}
            </span>
            <h2>{input.store.storeName}</h2>
            <p>{input.store.subtitle} · {input.store.submittedAt}</p>
          </div>
          <div className="targets-drawer-head-actions">
            <button type="button" aria-label="Kapat" onClick={input.onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="targets-detail-grid">
          <MiniStat label="Mağaza hedefi" value={formatMoney(approvalState.effectiveTotal, input.locale)} />
          <MiniStat label="Dağıtılan" value={formatMoney(approvalState.allocationTotal, input.locale)} />
          <MiniStat label="Personel" value={`${input.store.people} kişi`} />
          <MiniStat label="Gönderim" value={input.store.submittedAt} />
        </div>

        <div className="targets-progress-card">
          <div>
            <strong>Dağıtım dengesi</strong>
            <span>{approvalState.totalsAligned ? 'Dengede' : 'Fark var'}</span>
          </div>
          <div className="targets-progress-track">
            <span style={{ width: `${approvalState.progress}%` }} />
          </div>
        </div>

        <div className="targets-decision-card">
          <div className="targets-card-title">
            <strong>Hedef düzenleme</strong>
            <span>{input.store.status === 'pending' ? 'Drawer içinde karar' : statusCopy[input.store.status].label}</span>
          </div>

          {canApprove ? (
            <PendingDecisionForm
              approvalNote={input.approvalNote}
              approvalState={approvalState}
              isApproving={isApproving}
              locale={input.locale}
              onAllocationChange={input.onAllocationChange}
              onNoteChange={input.onNoteChange}
              onReset={input.onReset}
              onSubmit={submitApproval}
              onTotalChange={input.onTotalChange}
              submitDisabled={!canSubmit}
            />
          ) : (
            <DecisionSummary approvalState={approvalState} locale={input.locale} store={input.store} />
          )}
        </div>

        {input.notice ? (
          <div className="targets-notice">
            <CheckCircle2 size={16} />
            {input.notice}
          </div>
        ) : null}
      </aside>
    </div>
  )
}

function PendingDecisionForm(input: {
  approvalNote: string
  approvalState: ReturnType<typeof resolveApprovalState>
  isApproving: boolean
  locale: AppLocale
  onAllocationChange: (employeeId: string, value: number) => void
  onNoteChange: (value: string) => void
  onReset: () => void
  onSubmit: () => void
  onTotalChange: (value: number) => void
  submitDisabled: boolean
}) {
  return (
    <>
      <label className="targets-store-target-edit">
        <span>Mağaza hedefi</span>
        <input
          aria-label="Mağaza hedefi"
          disabled={input.isApproving}
          inputMode="numeric"
          value={formatPlainNumber(input.approvalState.effectiveTotal, input.locale)}
          onChange={(event) => input.onTotalChange(parseCurrencyInputValue(event.target.value))}
        />
        <small>Önceki: {formatMoney(input.approvalState.originalTotal, input.locale)}</small>
      </label>

      <div className="targets-target-editor" aria-label="Personel hedef düzenleme">
        <div className="targets-target-editor-head">
          <span>Personel</span>
          <span>Önceki</span>
          <span>Yeni hedef</span>
          <span>Fark</span>
        </div>
        {input.approvalState.allocations.map((allocation) => (
          <div className="targets-target-row" key={allocation.employeeId}>
            <span>
              <strong>{allocation.assigneeLabel}</strong>
              <small>{allocation.note || 'Personel hedefi'}</small>
            </span>
            <span>{formatMoney(allocation.originalValue, input.locale)}</span>
            <label className="targets-money-input">
              <input
                aria-label={`${allocation.assigneeLabel} Hedef`}
                disabled={input.isApproving}
                inputMode="numeric"
                value={formatPlainNumber(allocation.targetValue, input.locale)}
                onChange={(event) =>
                  input.onAllocationChange(allocation.employeeId, parseCurrencyInputValue(event.target.value))
                }
              />
              <small>{formatTargetShare(allocation.targetValue, input.approvalState.effectiveTotal, input.locale)}</small>
            </label>
            <span className={`targets-delta ${allocation.delta === 0 ? '' : allocation.delta > 0 ? 'up' : 'down'}`}>
              {formatDelta(allocation.delta, input.locale)}
            </span>
          </div>
        ))}
      </div>

      <div className={`targets-balance ${input.approvalState.totalsAligned ? 'ok' : 'warn'}`}>
        <strong>{input.approvalState.totalsAligned ? 'Dağıtım dengede' : 'Dağıtım farkı var'}</strong>
        <span>
          {input.approvalState.difference === 0
            ? 'Personel toplamı mağaza hedefiyle eşleşiyor.'
            : `${formatMoney(Math.abs(input.approvalState.difference), input.locale)} ${
                input.approvalState.difference > 0 ? 'fazla dağıtıldı' : 'eksik dağıtıldı'
              }.`}
        </span>
      </div>

      <label className="targets-decision-note">
        <span>Karar notu</span>
        <textarea
          disabled={input.isApproving}
          placeholder="Düzenleme için kısa not yazın"
          value={input.approvalNote}
          onChange={(event) => input.onNoteChange(event.target.value)}
        />
      </label>

      <div className="targets-detail-actions">
        <button type="button" onClick={input.onReset} disabled={input.isApproving}>
          Değişiklikleri sıfırla
        </button>
        <button
          className="targets-primary-action"
          type="button"
          onClick={input.onSubmit}
          disabled={input.submitDisabled}
        >
          <BadgeCheck size={16} />
          {input.isApproving
            ? 'Onaylanıyor'
            : input.approvalState.hasEditedTargets
              ? 'Düzenleyerek onayla'
              : 'Onayla'}
        </button>
      </div>
    </>
  )
}

function DecisionSummary(input: {
  approvalState: ReturnType<typeof resolveApprovalState>
  locale: AppLocale
  store: RegionTargetRow
}) {
  const decisionTime = input.store.request?.approvedAt
    ? formatDateLabel(input.store.request.approvedAt, input.locale)
    : input.store.submittedAt
  const hasStoreChange = input.approvalState.hasEditedTargets
  const changedPeopleCount = input.approvalState.allocations.filter((allocation) => allocation.delta !== 0).length

  return (
    <div className="targets-decision-summary">
      <p className="targets-decision-copy">{decisionCopy[input.store.status]}</p>

      {input.store.request ? (
        <div className="targets-summary-grid">
          <MiniStat label="Karar tipi" value={statusCopy[input.store.status].label} />
          <MiniStat label="Karar zamanı" value={decisionTime} />
          <MiniStat label="Değişiklik" value={hasStoreChange ? `${changedPeopleCount} alan` : 'Yok'} />
          <MiniStat label="Mağaza farkı" value={formatDelta(input.approvalState.totalDelta, input.locale)} />
        </div>
      ) : null}

      <div className="targets-readonly-distribution">
        <div className="targets-card-title">
          <strong>Son hedef dağılımı</strong>
          <span>Tüm personel</span>
        </div>
        <div className="targets-target-editor targets-target-editor-readonly" aria-label="Son hedef dağılımı">
          <div className="targets-target-editor-head">
            <span>Personel</span>
            <span>Önceki</span>
            <span>Son hedef</span>
            <span>Fark</span>
          </div>
          {input.approvalState.allocations.length > 0 ? (
            input.approvalState.allocations.map((allocation) => (
              <div
                className={`targets-target-row ${allocation.delta !== 0 ? 'changed' : ''}`}
                key={allocation.employeeId}
              >
                <span>
                  <strong>{allocation.assigneeLabel}</strong>
                  <small>{allocation.note || 'Personel hedefi'}</small>
                </span>
                <span>{formatMoney(allocation.originalValue, input.locale)}</span>
                <span className="targets-final-target">
                  {formatMoney(allocation.targetValue, input.locale)}
                  <small>{formatTargetShare(allocation.targetValue, input.approvalState.effectiveTotal, input.locale)}</small>
                </span>
                <span className={`targets-delta ${allocation.delta === 0 ? '' : allocation.delta > 0 ? 'up' : 'down'}`}>
                  {formatDelta(allocation.delta, input.locale)}
                </span>
              </div>
            ))
          ) : (
            <div className="targets-target-row">
              <span>
                <strong>Personel hedefi yok</strong>
                <small>Mağazadan hedef bekleniyor</small>
              </span>
              <span>Yok</span>
              <span className="targets-readonly-target">Yok</span>
              <span className="targets-delta">Yok</span>
            </div>
          )}
        </div>
      </div>

      {input.store.request?.approvalNote ? (
        <div className="targets-decision-note-readonly">
          <strong>Karar notu</strong>
          <span>{input.store.request.approvalNote}</span>
        </div>
      ) : null}
    </div>
  )
}

function MetricCard(input: {
  icon: ReactNode
  label: string
  note: string
  tone: string
  value: string
}) {
  return (
    <article className={`targets-metric targets-metric-${input.tone}`}>
      <span className="targets-metric-icon">{input.icon}</span>
      <div>
        <span>{input.label}</span>
        <strong>{input.value}</strong>
        <small>{input.note}</small>
      </div>
    </article>
  )
}

function MiniStat(input: { label: string; value: string }) {
  return (
    <div className="targets-mini-stat">
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </div>
  )
}
