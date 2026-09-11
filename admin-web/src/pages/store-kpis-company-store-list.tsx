import { Link } from 'react-router'
import { ArrowDown, ArrowUp, ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { StoreRankingRow } from '../features/reports/api'
import type { StoreKpiHighlightsPageModel, StoreKpisRegionSortKey } from './store-kpi-highlights-model'
import { getMetricByCode, getMetricComparableValue } from './store-rankings-page-model'

const columns: Array<{ key: StoreKpisRegionSortKey; label: string }> = [
  { key: 'score', label: 'Skor' }, { key: 'TARGET_ACHIEVEMENT', label: 'HG%' },
  { key: 'ATV', label: 'ATV' }, { key: 'UPT', label: 'UPT' }, { key: 'CR', label: 'CR' },
  { key: 'gsm_approval', label: 'GSM' }, { key: 'BM_CHECKLIST', label: 'BM' }, { key: 'VM_CHECKLIST', label: 'VM' },
]
type Props = {
  rows: StoreRankingRow[]
  model: StoreKpiHighlightsPageModel
  sort: { key: StoreKpisRegionSortKey; direction: 'asc' | 'desc' }
  onSort: (key: StoreKpisRegionSortKey, direction?: 'asc' | 'desc') => void
}

export function CompanyKpiStoreList({ rows, model, sort, onSort }: Props) {
  const Icon = sort.direction === 'asc' ? ArrowUp : ArrowDown
  return <>
    <div className="region-performance-desktop">
      <Table aria-label="Mağaza KPI değerleri">
        <colgroup><col />{columns.map(column => <col key={column.key} className="region-performance-metric-column" />)}<col className="region-performance-action-column" /></colgroup>
        <TableHeader><TableRow><TableHead>Mağaza</TableHead>
          {columns.map(column => <TableHead key={column.key} aria-sort={sort.key === column.key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><Button variant="ghost" size="sm" aria-label={`${column.label} sütununa göre sırala`} onClick={() => onSort(column.key)}>{column.label}{sort.key === column.key ? <Icon aria-hidden="true" data-icon="inline-end" /> : null}</Button></TableHead>)}
          <TableHead><span className="tw:sr-only">Mağaza detayı</span></TableHead>
        </TableRow></TableHeader>
        <TableBody>{rows.map(row => <TableRow key={row.storeId}>
          <TableCell><strong>{row.storeName ?? model.t('storeKpis.noStoreScope')}</strong></TableCell>
          {columns.map(column => <TableCell key={column.key}><span className={column.key === 'score' ? 'region-performance-score' : undefined}>{metricValue(row, column.key, model)}</span></TableCell>)}
          <TableCell><DetailButton row={row} model={model} /></TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </div>
    <div className="region-performance-mobile">
      <div className="company-performance-sort"><Select value={`${sort.key}:${sort.direction}`} onValueChange={value => { const [key, direction] = value.split(':') as [StoreKpisRegionSortKey, 'asc' | 'desc']; onSort(key, direction) }}><SelectTrigger aria-label="KPI sıralama seçenekleri"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{columns.flatMap(column => ['asc', 'desc'].map(direction => <SelectItem key={`${column.key}:${direction}`} value={`${column.key}:${direction}`}>{column.label} · {direction === 'asc' ? 'Artan' : 'Azalan'}</SelectItem>))}</SelectGroup></SelectContent></Select></div>
      {rows.map(row => <article className="region-performance-store" key={row.storeId}>
        <div className="region-performance-store-heading"><h3>{row.storeName ?? model.t('storeKpis.noStoreScope')}</h3><DetailButton row={row} model={model} mobile /></div>
        <dl>{columns.map(column => <div key={column.key}><dt>{column.label}</dt><dd className={column.key === 'score' ? 'region-performance-score' : undefined}>{metricValue(row, column.key, model)}</dd></div>)}</dl>
      </article>)}
    </div>
  </>
}

function DetailButton({ row, model, mobile = false }: { row: StoreRankingRow; model: StoreKpiHighlightsPageModel; mobile?: boolean }) {
  return <Button asChild size={mobile ? 'lg' : 'xs'} className="checklist-record-history-result-action region-performance-detail tw:min-w-0"><Link aria-label={`${row.storeName ?? model.t('storeKpis.noStoreScope')} — Detay`} to={model.getCompanyStoreDetailPath(row.storeId)}><ClipboardCheck aria-hidden="true" /><span>Detay</span></Link></Button>
}

function metricValue(row: StoreRankingRow, code: StoreKpisRegionSortKey, model: StoreKpiHighlightsPageModel) {
  const value = code === 'score' ? row.scoreValue : getMetricComparableValue(getMetricByCode(row.metrics, code), code)
  if (value === null || value === undefined || !Number.isFinite(value)) return code.endsWith('_CHECKLIST') ? model.t('storeKpis.regionChecklistPassive') : model.t('common.noData')
  if (code === 'ATV') return new Intl.NumberFormat(model.locale, { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value)
  if (code === 'UPT') return new Intl.NumberFormat(model.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  const percentage = code === 'TARGET_ACHIEVEMENT' || code === 'CR'
  const formatted = new Intl.NumberFormat(model.locale, { maximumFractionDigits: code.endsWith('_CHECKLIST') ? 0 : 1 }).format(percentage ? value * 100 : value)
  return percentage || code === 'gsm_approval' ? `%${formatted}` : formatted
}