import { TargetManagerDirectory } from './target-manager-directory'
import { TargetMonthPicker } from './target-month-picker'
import { useMemo, useState, type ReactNode } from 'react'
import { BadgeCheck, CircleDollarSign, Clock3, RotateCcw, Search, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { CalendarPicker } from '@/components/ui/calendar-picker'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Badge } from '@/components/ui/badge'
import { StoreOperationsHeader, OperationsMetrics } from '@/pages/store-operations-layout'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  CommandCanvasFilterBar, CommandCanvasPage,
  CommandCanvasPartialDataNotice,
} from '@/features/store-command-canvas/primitives'
import { useLocalization } from '@/features/localization/useLocalization'
import { buildTargetMetrics, filterTargetWorkspace, flattenTargetStores } from './model'
import { getTargetCommandCopy } from './copy'
import { formatTargetMoney } from './format'
import type { TargetCommandSortState, TargetCommandStatusFilter, TargetCommandWorkspace, TargetManagerSelection } from './types'
import './workspace.css'

export function TargetWorkspaceScaffold(input: {
  workspace: TargetCommandWorkspace
  pagination?: { page: number; onPageChange: (page: number) => void; disabled: boolean }
  managerSelection: TargetManagerSelection
  period: string
  onPeriodChange: (period: string) => void
  isUpdating: boolean
  backgroundError: Error | null
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  onRetry: () => void
  renderContent: (input: { workspace: TargetCommandWorkspace; sort: TargetCommandSortState; onSort: (key: TargetCommandSortState['key']) => void; page?: number | undefined }) => ReactNode
}) {
  const { locale } = useLocalization()
  const copy = getTargetCommandCopy(locale)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<TargetCommandStatusFilter>('all')
  const [sort, setSort] = useState<TargetCommandSortState>({ key: 'status', direction: 'ascending' })
  const metrics = useMemo(() => buildTargetMetrics(input.workspace), [input.workspace])
  const filtered = useMemo(() => filterTargetWorkspace(input.workspace, { search, status }), [input.workspace, search, status])
  const filteredCount = flattenTargetStores(filtered).length
  const displayPage = Math.min(input.pagination?.page ?? 0, Math.max(0, Math.ceil(filteredCount / 50) - 1))
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
      <StoreOperationsHeader
        titleId="store-targets-command-title" eyebrow={copy.eyebrow} icon={Target}
        title={viewer ? copy.viewerTitle : copy.regionTitle}
        description={viewer ? copy.viewerDescription : copy.regionDescription}
        actions={viewer ? <CalendarPicker mode="month" ariaLabel={copy.selectPeriod} locale={locale} onValueChange={input.onPeriodChange} value={input.period} triggerClassName="operations-period" /> : <TargetMonthPicker ariaLabel={copy.selectPeriod} locale={locale} onValueChange={input.onPeriodChange} value={input.period} triggerClassName="operations-period" />}
      />
      <OperationsMetrics label={copy.totalTarget} items={[
        { id: 'total', icon: CircleDollarSign, label: copy.totalTarget, value: formatTargetMoney(input.workspace.summary?.totalTargetValue, locale), selected: false, onClick: () => setStatus('all') },
        { id: 'approved', icon: BadgeCheck, label: copy.approved, value: metrics.approvedCount, selected: status === 'approved_all', onClick: () => toggle('approved_all') },
        { id: 'pending', icon: Clock3, label: copy.pending, value: metrics.pendingCount, selected: status === 'pending', onClick: () => toggle('pending') },
        { id: 'missing', icon: Target, label: copy.missing, value: metrics.missingCount, selected: status === 'missing', onClick: () => toggle('missing') },
      ]} />
      {partial ? <CommandCanvasPartialDataNotice title={copy.partialTitle} description={copy.partialCopy} retry={{ label: copy.retry, onClick: input.onRetry }} /> : null}
      <div className={viewer ? 'operations-workspace operations-workspace-with-directory' : 'operations-workspace'}>
      {viewer ? <div className="target-manager-directory">
        <TargetManagerDirectory selection={input.managerSelection} locale={locale} />
      </div> : null}
      <div className="target-command-workbench operations-board">
        <div className="operations-board-title target-command-board-title"><h2>{locale === 'tr' ? 'Mağaza hedefleri' : 'Store targets'}</h2><Badge variant="secondary">{metrics.storeCount} {copy.stores}</Badge></div>
        <CommandCanvasFilterBar
          search={<InputGroup className="target-command-search"><InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon><InputGroupInput aria-label={copy.search} placeholder={copy.search} value={search} onChange={(event) => { setSearch(event.target.value); input.pagination?.onPageChange(0) }} /></InputGroup>}
          controls={<>
            <Select value={status} onValueChange={(value) => { setStatus(value as TargetCommandStatusFilter); input.pagination?.onPageChange(0) }}><SelectTrigger aria-label={copy.status}><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">{copy.allStatuses}</SelectItem><SelectItem value="pending">{copy.pending}</SelectItem><SelectItem value="approved_all">{copy.approved}</SelectItem><SelectItem value="approved">{locale === 'tr' ? 'Doğrudan onaylanan' : 'Approved without adjustment'}</SelectItem><SelectItem value="adjusted_approved">{locale === 'tr' ? 'Düzeltilerek onaylanan' : 'Approved with adjustment'}</SelectItem><SelectItem value="returned">{copy.returned}</SelectItem><SelectItem value="missing">{copy.missing}</SelectItem></SelectGroup></SelectContent></Select>
            <Select value={compactSort} onValueChange={onCompactSort}><SelectTrigger className="target-command-compact-sort" aria-label={locale === 'tr' ? 'Hedefleri sırala' : 'Sort targets'}><SelectValue /></SelectTrigger><SelectContent><SelectGroup>
              <SelectItem value="store:ascending">{locale === 'tr' ? 'Mağaza A-Z' : 'Store A-Z'}</SelectItem><SelectItem value="store:descending">{locale === 'tr' ? 'Mağaza Z-A' : 'Store Z-A'}</SelectItem>
              <SelectItem value="target:descending">{locale === 'tr' ? 'Hedef yüksek' : 'Highest target'}</SelectItem><SelectItem value="target:ascending">{locale === 'tr' ? 'Hedef düşük' : 'Lowest target'}</SelectItem>
              <SelectItem value="distributed:descending">{locale === 'tr' ? 'Dağıtılan yüksek' : 'Highest distributed'}</SelectItem><SelectItem value="distributed:ascending">{locale === 'tr' ? 'Dağıtılan düşük' : 'Lowest distributed'}</SelectItem>
              <SelectItem value="personnel:descending">{locale === 'tr' ? 'Personel çok' : 'Most personnel'}</SelectItem><SelectItem value="personnel:ascending">{locale === 'tr' ? 'Personel az' : 'Least personnel'}</SelectItem>
              <SelectItem value="status:ascending">{locale === 'tr' ? 'Durum A-Z' : 'Status A-Z'}</SelectItem><SelectItem value="status:descending">{locale === 'tr' ? 'Durum Z-A' : 'Status Z-A'}</SelectItem>
            </SelectGroup></SelectContent></Select>
          </>}
          actions={<Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatus('all'); input.managerSelection.onChange('all') }}><RotateCcw data-icon="inline-start" />{copy.clear}</Button>}
          isUpdating={input.isUpdating} updatingLabel={copy.updating}
        />
        {input.workspace.companies.length === 0 ? <Empty><EmptyHeader><EmptyTitle>{copy.emptyTitle}</EmptyTitle><EmptyDescription>{copy.emptyCopy}</EmptyDescription></EmptyHeader></Empty>
          : filtered.companies.length === 0 ? <Empty><EmptyHeader><EmptyTitle>{copy.noMatch}</EmptyTitle></EmptyHeader></Empty>
          : input.renderContent({ workspace: filtered, sort, onSort, page: input.pagination ? displayPage : undefined })}
        {input.pagination ? <div className="target-command-pagination"><Button variant="outline" disabled={input.pagination.disabled || displayPage === 0} onClick={() => input.pagination!.onPageChange(displayPage - 1)}>{locale === 'tr' ? 'Önceki' : 'Previous'}</Button><span>{filteredCount === 0 ? 0 : displayPage * 50 + 1}–{Math.min((displayPage + 1) * 50, filteredCount)} / {filteredCount}</span><Button variant="outline" disabled={input.pagination.disabled || (displayPage + 1) * 50 >= filteredCount} onClick={() => input.pagination!.onPageChange(displayPage + 1)}>{locale === 'tr' ? 'Sonraki' : 'Next'}</Button></div> : input.hasMore ? <div className="target-command-pagination"><Button disabled={input.isLoadingMore} onClick={input.onLoadMore} variant="outline">{input.isLoadingMore ? copy.loadingMore : copy.loadMore}</Button><span>{input.workspace.pagination.limit} {copy.of} {input.workspace.pagination.total} {copy.showing}</span></div> : null}
      </div>
      </div>
    </CommandCanvasPage>
  )
}
