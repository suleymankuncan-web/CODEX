import { useMemo, useState, type ReactNode } from 'react'
import { ClipboardCheck, Clock3, PenLine, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChecklistSearchField } from '@/features/checklist-command/ChecklistSearchField'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CommandCanvasPage, CommandCanvasPartialDataNotice } from '@/features/store-command-canvas/primitives'
import { CalendarPicker } from '@/components/ui/calendar-picker'
import type { useLocalization } from '@/features/localization/useLocalization'
import type { RegionManagerDirectoryItem } from '@/features/org/region-manager-directory'
import type { AppLocale } from '@/lib/i18n'
import { buildIncentiveMetrics, filterIncentiveWorkspace, scopeIncentiveWorkspaceToManager } from './model'
import { formatIncentiveDay, formatIncentiveMoney } from './format'
import { IncentiveManagerDirectory } from './manager-directory'
import type { IncentiveStatusFilter, IncentiveWorkspace } from './types'
import './workspace.css'

type Translate = ReturnType<typeof useLocalization>['t']

export function IncentiveWorkspaceScaffold(input: {
  workspace: IncentiveWorkspace
  locale: AppLocale
  t: Translate
  period: string
  onPeriodChange: (period: string) => void
  isUpdating: boolean
  backgroundError: Error | null
  actions?: ReactNode
  sectionHeader?: ReactNode
  renderContent: (workspace: IncentiveWorkspace) => ReactNode
  managerDirectory?: RegionManagerDirectoryItem[]
  managerDirectoryError?: boolean
  managerDirectoryLoading?: boolean
  onRetryManagerDirectory?: () => void
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<IncentiveStatusFilter>('all')
  const [managerUserId, setManagerUserId] = useState<string | null>(null)
  const viewer = input.workspace.view === 'report_viewer'
  const tr = input.locale === 'tr'
  const selectedManager = input.managerDirectory?.find(manager => manager.userId === managerUserId) ?? null
  const scoped = useMemo(
    () => managerUserId === null
      ? input.workspace
      : selectedManager
        ? scopeIncentiveWorkspaceToManager(input.workspace, selectedManager)
        : { ...input.workspace, managerGroups: [] },
    [input.workspace, managerUserId, selectedManager],
  )
  const metrics = useMemo(() => buildIncentiveMetrics(scoped), [scoped])
  const filtered = useMemo(() => filterIncentiveWorkspace(scoped, { search, status }), [scoped, search, status])
  const partial = Boolean(input.backgroundError) || Object.values(input.workspace.sections).some(section => section.status === 'unavailable')
  const metricItems = [
    { key: 'earning', icon: WalletCards, label: input.t('storeIncentives.command.periodTotal'), value: formatIncentiveMoney(metrics.finalTotal, input.locale) },
    { key: 'pending_review', icon: Clock3, label: tr ? 'Kontrol bekliyor' : 'Awaiting review', value: String(metrics.pendingReviewCount) },
    { key: 'reviewed', icon: ClipboardCheck, label: tr ? 'Tamamlandı' : 'Completed', value: `${metrics.reviewedStoreCount}/${metrics.storeCount}` },
    { key: 'corrected', icon: PenLine, label: input.t('storeIncentives.command.corrections'), value: String(metrics.correctionCount) },
  ] as const

  const storeContent = <section className="incentive-performance-list" aria-label={input.t('storeIncentives.command.stores')}>
    <header className="incentive-list-heading"><div><h2>{selectedManager?.displayName ?? (viewer ? (tr ? 'Tüm Mağazalar' : 'All stores') : (tr ? 'Yetkili Mağazalar' : 'Your stores'))}</h2><p>{metrics.storeCount} {tr ? 'mağaza · Personel ve prim detaylarını inceleyin' : 'stores · Explore personnel and incentive details'}</p></div></header>
    {input.workspace.salesTracking ? <p className="incentive-daily-tracking-note">{input.workspace.salesTracking.status === 'unavailable' ? (tr ? 'Günlük satış verisi şu anda alınamıyor; aylık kayıtlar gösteriliyor.' : 'Daily sales are unavailable; monthly records are shown.') : input.workspace.salesTracking.lastLoadedDate ? (tr ? `Günlük net satış ve HG% yüklenen ay içi toplamdır. Son veri tarihi: ${formatIncentiveDay(input.workspace.salesTracking.lastLoadedDate, input.locale)}. Primler dönem kapanışında kesinleşir.` : `Daily net sales and target % show the imported month-to-date total. Latest data date: ${formatIncentiveDay(input.workspace.salesTracking.lastLoadedDate, input.locale)}. Incentives are finalized at period close.`) : (tr ? 'Bu dönemde henüz günlük satış yüklenmedi; aylık kayıtlar gösteriliyor.' : 'No daily sales have been imported for this period; monthly records are shown.')}</p> : null}
    <div className="incentive-performance-toolbar">
      <div className="incentive-performance-search"><ChecklistSearchField label={input.t('storeIncentives.command.search')} placeholder={tr ? 'Mağaza veya personel ara' : 'Search stores or personnel'} value={search} onChange={setSearch} count={filtered.managerGroups.reduce((sum, region) => sum + region.stores.length, 0)} /></div>
      <Select value={status} onValueChange={value => setStatus(value as IncentiveStatusFilter)}>
        <SelectTrigger aria-label={input.t('storeIncentives.command.status')}><SelectValue /></SelectTrigger>
        <SelectContent><SelectGroup>
          {([['all', 'allStatuses'], ['pending_review', 'pending'], ['reviewed', 'reviewed'], ['corrected', 'corrected'], ['earning', 'earning']] as const).map(([value, key]) => <SelectItem value={value} key={value}>{value === 'pending_review' ? (tr ? 'Kontrol bekliyor' : 'Awaiting review') : value === 'reviewed' ? (tr ? 'Tamamlandı' : 'Completed') : input.t(`storeIncentives.command.${key}`)}</SelectItem>)}
        </SelectGroup></SelectContent>
      </Select>
      {search || status !== 'all' ? <Button size="sm" variant="ghost" onClick={() => { setSearch(''); setStatus('all') }}>{input.t('storeIncentives.command.clear')}</Button> : null}
      <span className="incentive-performance-updating" role="status">{input.isUpdating ? input.t('storeIncentives.command.updating') : null}</span>
    </div>
    {input.sectionHeader}
    {input.workspace.managerGroups.length === 0 ? <div className="incentive-command-empty-state"><h2>{input.t('storeIncentives.command.emptyTitle')}</h2><p>{input.t('storeIncentives.command.emptyCopy')}</p></div>
      : <div key={managerUserId ?? 'all'}>{input.renderContent(filtered)}</div>}
  </section>

  const page = <CommandCanvasPage ariaLabelledBy="store-incentives-command-title" className="incentive-performance">
    <header className="incentive-performance-hero">
      <div className="incentive-performance-heading"><span className="incentive-heading-icon"><WalletCards aria-hidden="true" /></span><div><small>{tr ? (viewer ? 'RAPOR GÖRÜNTÜLEYİCİ' : 'BÖLGE MÜDÜRÜ') : (viewer ? 'REPORT VIEWER' : 'REGIONAL MANAGER')}</small>
        <h1 id="store-incentives-command-title">{tr ? 'Primler' : 'Incentives'}</h1>
        <p>{tr ? (viewer ? 'Mağazalar, hakedişler ve dönem onayları.' : 'Mağaza hakedişlerini inceleyin, dönemi güvenle tamamlayın.') : (viewer ? 'Stores, entitlements and period approvals.' : 'Review store entitlements and complete the period.')}</p>
      </div></div>
      <div className="incentive-performance-actions">
        <CalendarPicker mode="month" locale={input.locale} value={input.period} onValueChange={input.onPeriodChange} ariaLabel={tr ? 'Prim dönemi' : 'Incentive period'} />
        {input.actions}
      </div>
    </header>
    <div className="incentive-performance-metrics" aria-label={input.t('storeIncentives.regionManagerSummaryAria')}>
      {metricItems.map(({ key, icon: Icon, label, value }) => <Button key={key} variant="ghost" aria-pressed={status === key} onClick={() => setStatus(current => current === key ? 'all' : key)}>
        <span><Icon aria-hidden="true" /><span>{label}</span></span><strong>{value}</strong>
      </Button>)}
    </div>
    {partial ? <CommandCanvasPartialDataNotice title={input.t('storeIncentives.command.partialTitle')} description={input.t('storeIncentives.command.partialCopy')} /> : null}
    <div className={`incentive-performance-layout${viewer ? '' : ' incentive-performance-layout--single'}`}>
      {viewer ? <IncentiveManagerDirectory
        managers={input.managerDirectory ?? []}
        storeCount={input.workspace.managerGroups.reduce((count, region) => count + region.stores.length, 0)}
        selectedId={managerUserId}
        onSelect={id => { setManagerUserId(id); setSearch(''); setStatus('all') }}
        locale={input.locale}
        loading={Boolean(input.managerDirectoryLoading)}
        error={Boolean(input.managerDirectoryError)}

        {...(input.onRetryManagerDirectory ? { onRetry: input.onRetryManagerDirectory } : {})}
      /> : null}
      <div className="incentive-performance-main">
    <div className="incentive-performance-content" aria-busy={input.isUpdating}>
      {storeContent}
    </div>
      </div>
    </div>
  </CommandCanvasPage>
  return page
}
