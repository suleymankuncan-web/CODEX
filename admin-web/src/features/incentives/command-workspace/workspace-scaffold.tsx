import { useMemo, useState, type ReactNode } from 'react'
import { ClipboardCheck, Clock3, PenLine, Search, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CommandCanvasPage, CommandCanvasPartialDataNotice } from '@/features/store-command-canvas/primitives'
import { ReportViewerPeriodPicker } from '@/features/checklist-command/ReportViewerPeriodPicker'
import type { useLocalization } from '@/features/localization/useLocalization'
import type { RegionManagerDirectoryItem } from '@/features/org/region-manager-directory'
import type { AppLocale } from '@/lib/i18n'
import { buildIncentiveMetrics, filterIncentiveWorkspace, scopeIncentiveWorkspaceToManager } from './model'
import { formatIncentiveMoney } from './format'
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
  tabs?: ReactNode
  sectionHeader?: ReactNode
  renderContent: (workspace: IncentiveWorkspace) => ReactNode
  renderApproval?: (regionIds: string[] | undefined) => ReactNode
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
        : { ...input.workspace, regions: [] },
    [input.workspace, managerUserId, selectedManager],
  )
  const metrics = useMemo(() => buildIncentiveMetrics(scoped), [scoped])
  const filtered = useMemo(() => filterIncentiveWorkspace(scoped, { search, status }), [scoped, search, status])
  const partial = Boolean(input.backgroundError) || Object.values(input.workspace.sections).some(section => section.status === 'unavailable')
  const metricItems = [
    { key: 'earning', icon: WalletCards, label: input.t('storeIncentives.command.periodTotal'), value: formatIncentiveMoney(metrics.finalTotal, input.locale) },
    { key: 'pending_review', icon: Clock3, label: input.t('storeIncentives.command.pendingReview'), value: String(metrics.pendingReviewCount) },
    { key: 'reviewed', icon: ClipboardCheck, label: input.t('storeIncentives.command.reviewed'), value: `${metrics.reviewedStoreCount}/${metrics.storeCount}` },
    { key: 'corrected', icon: PenLine, label: input.t('storeIncentives.command.corrections'), value: String(metrics.correctionCount) },
  ] as const

  return <CommandCanvasPage ariaLabelledBy="store-incentives-command-title" className="incentive-performance">
    <header className="incentive-performance-hero">
      <div className="incentive-performance-heading">
        <span className="incentive-performance-icon"><WalletCards aria-hidden="true" /></span>
        <div>
          <p>{viewer ? (tr ? 'RAPOR GÖRÜNTÜLEYİCİ' : 'REPORT VIEWER') : (tr ? 'BÖLGE MÜDÜRÜ' : 'REGION MANAGER')}</p>
          <h1 id="store-incentives-command-title">{tr ? (viewer ? 'LUFIAN Mağaza Primleri' : 'Bölge Primleri') : (viewer ? 'LUFIAN Store Incentives' : 'Regional Incentives')}</h1>
          <small>{tr ? (viewer ? 'Bölge müdürlerini seçin, mağaza ve personel primlerini inceleyin.' : 'Mağaza primlerini inceleyin, kontrol edin ve onaya gönderin.') : (viewer ? 'Select a regional manager to review store and personnel incentives.' : 'Review store incentives and submit your regional package.')}</small>
        </div>
      </div>
      <div className="incentive-performance-actions">
        <ReportViewerPeriodPicker locale={input.locale} period={input.period} onChange={input.onPeriodChange} />
        {input.actions}
      </div>
    </header>

    {!viewer ? <div className="incentive-performance-metrics" aria-label={input.t('storeIncentives.regionManagerSummaryAria')}>
      {metricItems.map(({ key, icon: Icon, label, value }) => <Button key={key} variant="outline" aria-pressed={status === key} onClick={() => setStatus(current => current === key ? 'all' : key)}>
        <span><Icon aria-hidden="true" /><span>{label}</span></span><strong>{value}</strong>
      </Button>)}
    </div> : null}

    {partial ? <CommandCanvasPartialDataNotice title={input.t('storeIncentives.command.partialTitle')} description={input.t('storeIncentives.command.partialCopy')} /> : null}

    <div className={viewer ? 'incentive-performance-layout is-viewer' : 'incentive-performance-layout'}>
      {viewer ? <IncentiveManagerDirectory
        managers={input.managerDirectory ?? []}
        storeCount={input.workspace.regions.reduce((count, region) => count + region.stores.length, 0)}
        selectedId={managerUserId}
        onSelect={id => { setManagerUserId(id); setSearch(''); setStatus('all') }}
        locale={input.locale}
        loading={Boolean(input.managerDirectoryLoading)}
        error={Boolean(input.managerDirectoryError)}
        {...(input.onRetryManagerDirectory ? { onRetry: input.onRetryManagerDirectory } : {})}
      /> : null}
      <div className="incentive-performance-content" aria-busy={input.isUpdating}>
        {input.renderApproval?.(selectedManager ? [...new Set(scoped.regions.map(region => region.regionId))] : undefined)}
        <section className="incentive-performance-list" aria-label={input.t('storeIncentives.command.stores')}>
          {viewer ? <div className="incentive-performance-context">
            <div><h2>{selectedManager?.displayName || (tr ? 'Tüm Mağazalar' : 'All stores')}</h2><small>{selectedManager ? `${selectedManager.storeIds.length} ${tr ? 'atanmış mağaza' : 'assigned stores'}` : (tr ? 'Şirket mağazaları' : 'Company stores')}</small></div>
            <div><small>{tr ? 'Toplam prim' : 'Total incentive'}</small><strong>{formatIncentiveMoney(metrics.finalTotal, input.locale)}</strong></div>
          </div> : null}
          {input.tabs}
          <div className="incentive-performance-toolbar">
            <InputGroup className="incentive-performance-search">
              <InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon>
              <InputGroupInput aria-label={input.t('storeIncentives.command.search')} placeholder={tr ? 'Mağaza veya personel ara' : 'Search stores or personnel'} value={search} onChange={event => setSearch(event.target.value)} />
              <InputGroupAddon align="inline-end"><Badge variant="secondary">{filtered.regions.reduce((count, region) => count + region.stores.length, 0)}</Badge></InputGroupAddon>
            </InputGroup>
            <Select value={status} onValueChange={value => setStatus(value as IncentiveStatusFilter)}>
              <SelectTrigger aria-label={input.t('storeIncentives.command.status')}><SelectValue /></SelectTrigger>
              <SelectContent><SelectGroup>
                {([['all', 'allStatuses'], ['pending_review', 'pending'], ['reviewed', 'reviewed'], ['corrected', 'corrected'], ['earning', 'earning']] as const).map(([value, key]) => <SelectItem value={value} key={value}>{input.t(`storeIncentives.command.${key}`)}</SelectItem>)}
              </SelectGroup></SelectContent>
            </Select>
            {search || status !== 'all' ? <Button size="sm" variant="ghost" onClick={() => { setSearch(''); setStatus('all') }}>{input.t('storeIncentives.command.clear')}</Button> : null}
            <span className="incentive-performance-updating" role="status">{input.isUpdating ? input.t('storeIncentives.command.updating') : null}</span>
          </div>
          {input.sectionHeader}
          {input.workspace.regions.length === 0 ? <div className="incentive-command-empty-state"><h2>{input.t('storeIncentives.command.emptyTitle')}</h2><p>{input.t('storeIncentives.command.emptyCopy')}</p></div>
            : input.renderContent(filtered)}
        </section>
      </div>
    </div>
  </CommandCanvasPage>
}
