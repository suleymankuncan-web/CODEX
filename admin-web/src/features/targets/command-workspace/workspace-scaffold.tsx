import { useMemo, useState, type ReactNode } from 'react'
import { BadgeCheck, CircleDollarSign, Clock3, RotateCcw, Search, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  CommandCanvasFilterBar, CommandCanvasMetricFilter, CommandCanvasMetricRail,
  CommandCanvasCalendarMonthYearPicker, CommandCanvasPage, CommandCanvasPageHeader,
  CommandCanvasPartialDataNotice,
} from '@/features/store-command-canvas/primitives'
import { useLocalization } from '@/features/localization/useLocalization'
import { buildTargetMetrics, filterTargetWorkspace } from './model'
import { getTargetCommandCopy } from './copy'
import { formatTargetMoney } from './format'
import type { TargetCommandSortState, TargetCommandStatusFilter, TargetCommandWorkspace } from './types'
import './workspace.css'

export function TargetWorkspaceScaffold(input: {
  workspace: TargetCommandWorkspace
  period: string
  onPeriodChange: (period: string) => void
  isUpdating: boolean
  backgroundError: Error | null
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  onRetry: () => void
  renderContent: (input: { workspace: TargetCommandWorkspace; sort: TargetCommandSortState; onSort: (key: TargetCommandSortState['key']) => void }) => ReactNode
}) {
  const { locale } = useLocalization()
  const copy = getTargetCommandCopy(locale)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<TargetCommandStatusFilter>('all')
  const [sort, setSort] = useState<TargetCommandSortState>({ key: 'status', direction: 'ascending' })
  const metrics = useMemo(() => buildTargetMetrics(input.workspace), [input.workspace])
  const filtered = useMemo(() => filterTargetWorkspace(input.workspace, { search, status }), [input.workspace, search, status])
  const viewer = input.workspace.view === 'report_viewer'
  const partial = input.backgroundError !== null || Object.values(input.workspace.sections).some((section) => section.status === 'unavailable')
  const toggle = (next: TargetCommandStatusFilter) => setStatus((current) => current === next ? 'all' : next)
  const onSort = (key: TargetCommandSortState['key']) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'ascending' ? 'descending' : 'ascending' }))
  const compactSort = `${sort.key}:${sort.direction}`
  const onCompactSort = (value: string) => {
    const [key, direction] = value.split(':') as [TargetCommandSortState['key'], TargetCommandSortState['direction']]
    setSort({ key, direction })
  }

  return (
    <CommandCanvasPage ariaLabelledBy="store-targets-command-title" className={`target-command-page ${viewer ? 'is-report-viewer' : 'is-region-manager'}`}>
      <CommandCanvasPageHeader
        titleId="store-targets-command-title" eyebrow={copy.eyebrow}
        title={viewer ? copy.viewerTitle : copy.regionTitle}
        description={viewer ? copy.viewerDescription : copy.regionDescription}
        actions={<div className="target-command-period"><span>{copy.viewedPeriod}</span><CommandCanvasCalendarMonthYearPicker ariaLabel={copy.selectPeriod} locale={locale} onValueChange={input.onPeriodChange} value={input.period} /></div>}
      />
      <CommandCanvasMetricRail ariaLabel={copy.totalTarget}>
        <CommandCanvasMetricFilter active={false} icon={<CircleDollarSign size={16} />} label={copy.totalTarget} note={copy.selectedPeriod} onClick={() => setStatus('all')} tone="plum" value={formatTargetMoney(input.workspace.summary?.totalTargetValue, locale)} />
        <CommandCanvasMetricFilter active={status === 'approved_all'} icon={<BadgeCheck size={16} />} label={copy.approved} note={copy.approvedNote} onClick={() => toggle('approved_all')} tone="mint" value={String(metrics.approvedCount)} />
        <CommandCanvasMetricFilter active={status === 'pending'} icon={<Clock3 size={16} />} label={copy.pending} note={copy.pendingNote} onClick={() => toggle('pending')} tone="amber" value={String(metrics.pendingCount)} />
        <CommandCanvasMetricFilter active={status === 'missing'} icon={<Target size={16} />} label={copy.missing} note={copy.missingNote} onClick={() => toggle('missing')} tone="rose" value={String(metrics.missingCount)} />
      </CommandCanvasMetricRail>
      {partial ? <CommandCanvasPartialDataNotice title={copy.partialTitle} description={copy.partialCopy} retry={{ label: copy.retry, onClick: input.onRetry }} /> : null}
      <div className="target-command-workbench">
        <CommandCanvasFilterBar
          search={<div className="target-command-search"><Search size={16} /><Input aria-label={copy.search} placeholder={copy.search} value={search} onChange={(event) => setSearch(event.target.value)} /></div>}
          controls={<>
            <Select value={status} onValueChange={(value) => setStatus(value as TargetCommandStatusFilter)}><SelectTrigger aria-label={copy.status}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{copy.allStatuses}</SelectItem><SelectItem value="pending">{copy.pending}</SelectItem><SelectItem value="approved_all">{copy.approved}</SelectItem><SelectItem value="approved">{locale === 'tr' ? 'Doğrudan onaylanan' : 'Approved without adjustment'}</SelectItem><SelectItem value="adjusted_approved">{locale === 'tr' ? 'Düzeltilerek onaylanan' : 'Approved with adjustment'}</SelectItem><SelectItem value="returned">{copy.returned}</SelectItem><SelectItem value="missing">{copy.missing}</SelectItem></SelectContent></Select>
            <Select value={compactSort} onValueChange={onCompactSort}><SelectTrigger className="target-command-compact-sort" aria-label={locale === 'tr' ? 'Hedefleri sırala' : 'Sort targets'}><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="store:ascending">{locale === 'tr' ? 'Mağaza A-Z' : 'Store A-Z'}</SelectItem><SelectItem value="store:descending">{locale === 'tr' ? 'Mağaza Z-A' : 'Store Z-A'}</SelectItem>
              <SelectItem value="target:descending">{locale === 'tr' ? 'Hedef yüksek' : 'Highest target'}</SelectItem><SelectItem value="target:ascending">{locale === 'tr' ? 'Hedef düşük' : 'Lowest target'}</SelectItem>
              <SelectItem value="distributed:descending">{locale === 'tr' ? 'Dağıtılan yüksek' : 'Highest distributed'}</SelectItem><SelectItem value="distributed:ascending">{locale === 'tr' ? 'Dağıtılan düşük' : 'Lowest distributed'}</SelectItem>
              <SelectItem value="personnel:descending">{locale === 'tr' ? 'Personel çok' : 'Most personnel'}</SelectItem><SelectItem value="personnel:ascending">{locale === 'tr' ? 'Personel az' : 'Least personnel'}</SelectItem>
              <SelectItem value="status:ascending">{locale === 'tr' ? 'Durum A-Z' : 'Status A-Z'}</SelectItem><SelectItem value="status:descending">{locale === 'tr' ? 'Durum Z-A' : 'Status Z-A'}</SelectItem>
            </SelectContent></Select>
          </>}
          actions={<Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatus('all') }}><RotateCcw />{copy.clear}</Button>}
          isUpdating={input.isUpdating} updatingLabel={copy.updating}
        />
        {input.workspace.companies.length === 0 ? <div className="target-command-empty-state"><h2>{copy.emptyTitle}</h2><p>{copy.emptyCopy}</p></div>
          : filtered.companies.length === 0 ? <div className="target-command-empty">{copy.noMatch}</div>
          : input.renderContent({ workspace: filtered, sort, onSort })}
        {input.hasMore ? <div className="target-command-pagination"><Button disabled={input.isLoadingMore} onClick={input.onLoadMore} variant="outline">{input.isLoadingMore ? copy.loadingMore : copy.loadMore}</Button><span>{input.workspace.pagination.limit} {copy.of} {input.workspace.pagination.total} {copy.showing}</span></div> : null}
      </div>
    </CommandCanvasPage>
  )
}
