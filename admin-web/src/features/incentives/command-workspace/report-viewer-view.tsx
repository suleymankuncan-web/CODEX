import { useState } from 'react'
import { BadgeCheck, Building2, Check, ChevronDown, CircleDollarSign, Clock3, Undo2, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CalendarPicker } from '@/components/ui/calendar-picker'
import { CommandCanvasPage, CommandCanvasPartialDataNotice } from '@/features/store-command-canvas/primitives'
import { StoreOperationsHeader } from '@/pages/store-operations-layout'
import type { AuthSessionSummary } from '@/features/auth/api'
import type { RegionManagerDirectoryItem } from '@/features/org/region-manager-directory'
import type { useLocalization } from '@/features/localization/useLocalization'
import type { AppLocale } from '@/lib/i18n'
import { FinalIncentiveApproval, type IncentiveApprovalControls } from './final-incentive-approval'
import { IncentiveHrHandoff } from './hr-handoff'
import { buildIncentiveMetrics, countAdjustedIncentivePersonnel, sumMoney } from './model'
import { incentiveManagerGroupKey } from './package-presentation'
import { formatIncentiveDay, formatIncentiveMoney } from './format'
import { IncentiveWorkspaceHierarchy } from './workspace-hierarchy'
import type { IncentiveManagerGroup, IncentiveWorkspace } from './types'
import './workspace.css'
import './report-viewer.css'

export function ReportViewerIncentivesView(input: {
  authSummary?: AuthSessionSummary | null
  workspace: IncentiveWorkspace
  period: string
  onPeriodChange: (period: string) => void
  isUpdating: boolean
  backgroundError: Error | null
  locale: AppLocale
  t: ReturnType<typeof useLocalization>['t']
  managerDirectory: RegionManagerDirectoryItem[]
  managerDirectoryError: boolean
  managerDirectoryLoading: boolean
  onRetryManagerDirectory: () => void
}) {
  const [status, setStatus] = useState<'all' | IncentiveManagerGroup['package']['status']>('all')
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const tr = input.locale === 'tr'
  const metrics = buildIncentiveMetrics(input.workspace)
  const partial = Boolean(input.backgroundError) || input.managerDirectoryError || Object.values(input.workspace.sections).some(section => section.status === 'unavailable')
  const disabled = input.isUpdating || Boolean(input.backgroundError) || input.workspace.sections.core.status === 'unavailable' || input.period !== input.workspace.period || sending

  return <FinalIncentiveApproval authSummary={input.authSummary ?? null} workspace={input.workspace} period={input.period} locale={input.locale} managerGroupKeys={input.workspace.managerGroups.map(incentiveManagerGroupKey)} statusFilter={status} disabled={disabled}>
    {approval => {
      const busy = approval.busy || sending
      const packageStatus = (group: IncentiveManagerGroup) => approval.items.find(item => item.companyId === group.companyId && item.managerUserId === group.managerUserId)?.status ?? group.package.status
      const filtered = { ...input.workspace, managerGroups: input.workspace.managerGroups.filter(group => status === 'all' || packageStatus(group) === status) }
      const pending = input.workspace.managerGroups.filter(region => packageStatus(region) === 'submitted').length
      const approved = input.workspace.managerGroups.filter(region => packageStatus(region) === 'admin_approved').length
      const metricItems = [
        { id: 'total', icon: CircleDollarSign, label: tr ? 'Toplam prim' : 'Total incentive', value: formatIncentiveMoney(metrics.finalTotal, input.locale), filter: 'all' },
        { id: 'pending', icon: Clock3, label: tr ? 'Final onay bekleyen' : 'Awaiting final approval', value: pending, filter: 'submitted' },
        { id: 'approved', icon: BadgeCheck, label: tr ? 'Onaylanan paket' : 'Approved packages', value: `${approved} / ${input.workspace.managerGroups.length}`, filter: 'admin_approved' },
        { id: 'stores', icon: Building2, label: tr ? 'Mağaza' : 'Stores', value: metrics.storeCount, filter: 'all' },
      ] as const
      return <CommandCanvasPage ariaLabelledBy="store-incentives-command-title" className="incentive-performance incentive-viewer-workspace">
        <StoreOperationsHeader titleId="store-incentives-command-title" icon={WalletCards} eyebrow={tr ? 'Prim yönetimi' : 'Incentive management'} title={tr ? 'Primler' : 'Incentives'} description={tr ? 'Mağazalar ve personel primleri.' : 'Stores and personnel incentives.'}
          actions={<><CalendarPicker mode="month" value={input.period} locale={input.locale} disabled={busy} onValueChange={input.onPeriodChange} ariaLabel={tr ? 'Prim dönemi' : 'Incentive period'} triggerClassName="operations-period" />
            {approval.enabled ? <IncentiveHrHandoff packages={approval.items} auth={input.authSummary ?? null} period={input.period} locale={input.locale} disabled={disabled || approval.busy || approval.loading || approval.error} onBusyChange={setSending} /> : null}</>}
        />
        <div className="operations-metrics" role="group" aria-label={tr ? 'Dönem özeti' : 'Period summary'}>{metricItems.map(item => <Button key={item.id} variant="outline" className="operations-metric command-canvas-metric" disabled={busy} aria-pressed={item.filter !== 'all' && status === item.filter} onClick={() => { if (!busy) { approval.resetSelection(); setStatus(current => current === item.filter ? 'all' : item.filter) } }}><span><span className="operations-metric-icon"><item.icon aria-hidden="true" /></span>{item.label}</span><strong>{item.value}</strong></Button>)}</div>
        {partial ? <CommandCanvasPartialDataNotice title={input.t('storeIncentives.command.partialTitle')} description={input.t('storeIncentives.command.partialCopy')} /> : null}
        {input.workspace.salesTracking ? <p className="incentive-daily-tracking-note">{input.workspace.salesTracking.status === 'unavailable' ? (tr ? 'Günlük satış verisi şu anda alınamıyor; aylık kayıtlar gösteriliyor.' : 'Daily sales are unavailable; monthly records are shown.') : input.workspace.salesTracking.lastLoadedDate ? (tr ? `Günlük net satış ve HG% yüklenen ay içi toplamdır. Son veri tarihi: ${formatIncentiveDay(input.workspace.salesTracking.lastLoadedDate, input.locale)}. Prim tutarları dönem kapanışında kesinleşir.` : `Daily net sales and target % show the imported month-to-date total. Latest data date: ${formatIncentiveDay(input.workspace.salesTracking.lastLoadedDate, input.locale)}. Incentives are finalized at period close.`) : (tr ? 'Bu dönemde henüz günlük satış yüklenmedi; aylık kayıtlar gösteriliyor.' : 'No daily sales have been imported for this period; monthly records are shown.')}</p> : null}
        <section className="incentive-performance-list incentive-flat-store-list" aria-label={tr ? 'Mağaza primleri' : 'Store incentives'}>
            {approval.error ? <div className="incentive-approval-notice" role="alert"><p>{tr ? 'Onay paketleri alınamadı veya yetkiniz kaldırıldı.' : 'Could not load approval packages, or your permission was revoked.'}</p><Button variant="outline" onClick={approval.retry}>{tr ? 'Yeniden dene' : 'Retry'}</Button></div> : null}
            <div className="incentive-region-packages-heading"><span><small>{tr ? 'BÖLGE MÜDÜRLERİ' : 'REGIONAL MANAGERS'}</small><strong>{tr ? 'Prim paketleri' : 'Incentive packages'}</strong></span><div className="incentive-region-packages-heading-actions"><span className="incentive-region-packages-count">{filtered.managerGroups.length} {tr ? 'müdür paketi' : 'manager packages'}</span>{approval.enabled && approval.eligible.length > 1 ? <Button variant="secondary" className="incentive-bulk-approve" disabled={!approval.canAct || disabled} onClick={() => approval.approve(approval.eligible)}><Check aria-hidden="true" />{tr ? `${approval.eligible.length} paketi toplu onayla` : `Approve ${approval.eligible.length} packages`}</Button> : null}</div></div>
            {approval.result?.failed && !approval.error ? <div className="incentive-approval-notice" role="alert"><p>{tr ? `${approval.result.completed.length} paket işlendi; ${approval.result.failed} için karar doğrulanamadı. Güncel listeyi kontrol edin, kalan paketlere işlem yapılmadı.` : `${approval.result.completed.length} packages completed; the decision for ${approval.result.failed} could not be confirmed. Review the current list; remaining packages were not processed.`}</p></div> : null}
            {filtered.managerGroups.length ? <div className="incentive-region-packages">
              {filtered.managerGroups.map((region, index) => <ReportViewerRegionPackage key={incentiveManagerGroupKey(region)} index={index + 1} region={region} workspace={filtered} approval={approval} locale={input.locale} t={input.t} disabled={disabled || busy} expanded={expandedGroupKey === incentiveManagerGroupKey(region)} onToggle={() => setExpandedGroupKey(current => current === incentiveManagerGroupKey(region) ? null : incentiveManagerGroupKey(region))} />)}
            </div> : <div className="incentive-command-empty">{input.workspace.managerGroups.length ? input.t('storeIncentives.command.noMatch') : input.t('storeIncentives.command.emptyCopy')}</div>}
        </section>
      </CommandCanvasPage>
    }}
  </FinalIncentiveApproval>
}

function ReportViewerRegionPackage(input: {
  index: number
  region: IncentiveManagerGroup
  workspace: IncentiveWorkspace
  approval: IncentiveApprovalControls
  locale: AppLocale
  t: ReturnType<typeof useLocalization>['t']
  disabled: boolean
  expanded: boolean
  onToggle: () => void
}) {
  const tr = input.locale === 'tr'
  const packageItem = input.approval.items.find(item => item.companyId === input.region.companyId && item.managerUserId === input.region.managerUserId)
  const packageStatus = packageItem?.status ?? input.region.package.status
  const eligiblePackage = input.approval.eligible.find(item => item.companyId === input.region.companyId && item.managerUserId === input.region.managerUserId)
  const storeCount = input.region.stores.length
  const packageTotal = sumMoney(input.region.stores.flatMap(store => store.rows.map(row => row.finalAmount)))
  const adjustedPersonnel = countAdjustedIncentivePersonnel(input.region.stores.flatMap(store => store.rows))
  const statusLabel = packageStatus === 'admin_approved' ? (tr ? 'Onaylandı' : 'Approved')
    : packageStatus === 'submitted' ? (tr ? 'Final onay bekliyor' : 'Awaiting final approval')
    : packageStatus === 'admin_returned' ? (tr ? 'Reddedildi' : 'Returned')
    : (tr ? 'Bölge onayı bekliyor' : 'Awaiting regional approval')
  const titleId = `incentive-package-${incentiveManagerGroupKey(input.region)}`
  return <article className={`incentive-region-package${input.expanded ? ' is-expanded' : ''}`} data-status={packageStatus}>
    <header className="incentive-region-package-header">
      <Button variant="ghost" className="incentive-region-package-toggle" aria-expanded={input.expanded} aria-controls={input.expanded ? titleId : undefined} onClick={input.onToggle}>
        <span className="incentive-region-package-index" aria-hidden="true">{String(input.index).padStart(2, '0')}</span>
        <span className="incentive-region-package-title"><strong>{input.region.managerName || (tr ? 'Atanmamış mağazalar' : 'Unassigned stores')}</strong><small>{storeCount} {tr ? 'mağaza' : 'stores'} <span aria-hidden="true">·</span> {formatIncentiveMoney(packageTotal, input.locale)}</small>{adjustedPersonnel > 0 ? <small className="incentive-region-change-count">{adjustedPersonnel} {tr ? 'personelde düzenleme var' : 'people with adjustments'}</small> : null}</span>
        <span className={`incentive-region-package-status is-${packageStatus}`}><span aria-hidden="true" />{statusLabel}</span>
        <ChevronDown aria-hidden="true" className="incentive-region-package-chevron" />
      </Button>
      {input.approval.enabled && packageStatus === 'submitted' ? <div className="incentive-region-package-actions">
        <Button variant="outline" className="incentive-region-package-reject" disabled={!eligiblePackage || !input.approval.canAct || input.disabled} onClick={() => { if (eligiblePackage) input.approval.reject(eligiblePackage) }}><Undo2 aria-hidden="true" />{tr ? 'Reddet' : 'Return'}</Button>
        <Button className="incentive-region-package-approve" disabled={!eligiblePackage || !input.approval.canAct || input.disabled} onClick={() => { if (eligiblePackage) input.approval.approve([eligiblePackage]) }}><Check aria-hidden="true" />{tr ? 'Paketi onayla' : 'Approve package'}</Button>
      </div> : null}
    </header>
    {input.expanded ? <div id={titleId} className="incentive-region-package-content">
      <IncentiveWorkspaceHierarchy workspace={{ ...input.workspace, managerGroups: [input.region] }} locale={input.locale} t={input.t} readOnly interactionLocked={input.disabled} pageSize={50} />
    </div> : null}
  </article>
}
