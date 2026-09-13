import { useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { TranslationKey } from '@/features/localization/dictionary'
import { useLocalization } from '@/features/localization/useLocalization'
import type { StoreMonthlyReportPackageRow } from '@/features/reports/api'
import { filterStoreReportRows } from './store-reports-model'

const columns: Record<string, Array<{ key: keyof StoreMonthlyReportPackageRow; label: TranslationKey | string }>> = {
  kpis: [
    { key: 'score', label: 'storeReports.column.score' }, { key: 'upt', label: 'UPT' },
    { key: 'atv', label: 'ATV' }, { key: 'cr', label: 'CR' }, { key: 'hg', label: 'HG%' },
    { key: 'gsm', label: 'GSM' }, { key: 'bmChecklist', label: 'BM Checklist' }, { key: 'vmChecklist', label: 'VM Checklist' },
  ],
  operations: [
    { key: 'actionStatus', label: 'storeReports.section.actions' }, { key: 'targetStatus', label: 'storeReports.section.targets' },
    { key: 'incentiveStatus', label: 'storeReports.section.incentives' }, { key: 'normFiili', label: 'storeReports.column.headcount' },
    { key: 'missingDays', label: 'storeReports.column.missingDays' }, { key: 'turnover', label: 'Turnover' },
    { key: 'lastVisit', label: 'storeReports.column.lastVisit' }, { key: 'daysSinceVisit', label: 'storeReports.column.daysSinceVisit' },
    { key: 'dataNote', label: 'storeReports.column.note' },
  ],
}

export function StoreReportsTable({ items }: { items: StoreMonthlyReportPackageRow[] }) {
  const { locale, t } = useLocalization()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('kpis')
  const [page, setPage] = useState(0)
  const filtered = filterStoreReportRows(items, search, locale)
  const pageSize = 12
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const rows = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
  const visibleColumns = columns[tab] ?? []

  return <section className="operations-board src-records" aria-label={t('storeReports.preview')}>
    <div className="operations-board-toolbar">
      <div className="operations-board-title"><h2>{t('storeReports.preview')}</h2><Badge variant="secondary">{t('storeReports.storeCount', { count: filtered.length })}</Badge></div>
      <div className="operations-filters">
        <InputGroup><InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon><InputGroupInput aria-label={t('storeReports.search')} placeholder={t('storeReports.search')} value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} /></InputGroup>
        <Tabs value={tab} onValueChange={setTab}><TabsList aria-label={t('storeReports.view')}><TabsTrigger value="kpis">{t('storeReports.kpiView')}</TabsTrigger><TabsTrigger value="operations">{t('storeReports.operationsView')}</TabsTrigger></TabsList></Tabs>
      </div>
    </div>
    {rows.length ? <Table aria-label={t('storeReports.preview')}>
      <TableHeader><TableRow><TableHead scope="col">{t('storeReports.column.store')}</TableHead>{visibleColumns.map(column => <TableHead scope="col" key={column.key}>{column.label.startsWith('storeReports.') ? t(column.label as TranslationKey) : column.label}</TableHead>)}</TableRow></TableHeader>
      <TableBody>{rows.map((row, index) => <TableRow key={`${row.storeName}:${currentPage}:${index}`}><TableCell className="src-store-cell"><strong>{row.storeName}</strong><small>{[row.city, row.regionManager].filter(Boolean).join(' · ')}</small></TableCell>{visibleColumns.map(column => <TableCell key={column.key} data-label={column.label.startsWith('storeReports.') ? t(column.label as TranslationKey) : column.label}>{row[column.key]?.trim() || t('storeReports.noValue')}</TableCell>)}</TableRow>)}</TableBody>
    </Table> : <Empty><EmptyHeader><EmptyTitle>{t(search ? 'storeReports.noMatches' : 'storeReports.emptyTitle')}</EmptyTitle><EmptyDescription>{t(search ? 'storeReports.noMatchesCopy' : 'storeReports.emptyCopy')}</EmptyDescription></EmptyHeader></Empty>}
    <div className="operations-pager"><span>{t('storeReports.page', { current: currentPage + 1, total: pageCount })}</span><div><Button variant="outline" size="icon" aria-label={t('storeReports.previous')} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft aria-hidden="true" /></Button><Button variant="outline" size="icon" aria-label={t('storeReports.next')} disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight aria-hidden="true" /></Button></div></div>
  </section>
}
