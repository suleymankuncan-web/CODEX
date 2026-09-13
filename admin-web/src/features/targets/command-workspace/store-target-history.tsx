import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowUpRight, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CommandCanvasOperationalDrawerContent } from '@/features/store-command-canvas/primitives'
import { getTargetDistributionRequests, type TargetDistributionRequest } from '../api'

import './target-history.css'

export function StoreTargetHistory({ storeId, storeName, period, locale, onSelect, readOnlyDetails = false }: {
  storeId: string; storeName: string; period: string; locale: 'tr' | 'en'; onSelect?: (period: string) => void; readOnlyDetails?: boolean
}) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(period.slice(0, 4))
  const history = useQuery({
    queryKey: ['store-target-history', storeId], enabled: open, staleTime: 0,
    queryFn: async () => {
      const items: TargetDistributionRequest[] = []
      let offset = 0
      while (true) {
        const page = await getTargetDistributionRequests({ storeId, limit: 100, offset })
        items.push(...page.items)
        offset += page.items.length
        if (offset >= page.meta.total) return items
        if (!page.items.length) throw new Error('Incomplete target history')
      }
    },
  })
  const tr = locale === 'tr'
  const title = tr ? 'Geçmiş Hedefler' : 'Target History'
  const years = [...new Set([year, period.slice(0, 4), ...(history.data ?? []).map(item => item.requestMonth.slice(0, 4))])].filter(value => value <= period.slice(0, 4)).sort().reverse()
  const latest = new Map<string, TargetDistributionRequest>()
  for (const item of [...(history.data ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt) || b.requestId.localeCompare(a.requestId))) {
    const month = item.requestMonth.slice(0, 7)
    if (!latest.has(month)) latest.set(month, item)
  }
  const money = new Intl.NumberFormat(tr ? 'tr-TR' : 'en-GB', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 })
  return <>
    <Button type="button" variant="outline" className="target-history-trigger" onClick={() => { setYear(period.slice(0, 4)); setSelectedMonth(null); setOpen(true) }}><History />{title}</Button>
    <Sheet open={open} onOpenChange={setOpen}>
      <CommandCanvasOperationalDrawerContent className="target-history-drawer">
        <SheetHeader className="target-history-header"><SheetTitle>{title}</SheetTitle><SheetDescription>{storeName}</SheetDescription></SheetHeader>
        <div className="target-history-body">
          <div className="target-history-toolbar" hidden={selectedMonth !== null}><span>{tr ? 'Aylık hedef geçmişi' : 'Monthly target history'}</span><Select value={year} onValueChange={setYear}><SelectTrigger aria-label={tr ? 'Hedef geçmişi yılı' : 'Target history year'}><SelectValue /></SelectTrigger><SelectContent>{years.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
          {history.isLoading ? <p role="status">{tr ? 'Hedefler yükleniyor…' : 'Loading targets…'}</p> : history.isError ? <div role="alert"><p>{tr ? 'Hedef geçmişi yüklenemedi.' : 'Target history could not be loaded.'}</p><Button variant="outline" onClick={() => void history.refetch()}>{tr ? 'Tekrar dene' : 'Retry'}</Button></div> : selectedMonth ? <div className="target-history-detail"><Button variant="outline" onClick={() => setSelectedMonth(null)}><ArrowLeft size={16}/>{tr ? 'Geçmiş hedeflere dön' : 'Back to history'}</Button><h3>{new Intl.DateTimeFormat(locale, {month:'long',year:'numeric'}).format(new Date(`${selectedMonth}-01T12:00:00`))}</h3>{latest.get(selectedMonth) ? <><div className="target-history-total"><span>{tr ? 'Mağaza hedefi' : 'Store target'}</span><strong>{money.format(latest.get(selectedMonth)!.totalTargetValue)}</strong></div><div className="target-history-allocations">{latest.get(selectedMonth)!.allocations.map(person => <div key={person.employeeId}><span><strong>{person.assigneeLabel}</strong><small>{'distributionDays' in person && typeof person.distributionDays === 'number' ? `${person.distributionDays} ${tr ? 'dağıtım günü' : 'distribution days'}` : '—'}</small></span><strong>{money.format(person.targetValue)}</strong></div>)}</div></> : <p>{tr ? 'Bu ay için hedef bulunmuyor.' : 'No target for this month.'}</p>}</div> : <div className="target-history-months">{Array.from({length: year === period.slice(0, 4) ? Number(period.slice(5, 7)) : 12}, (_, index) => {
            const i = (year === period.slice(0, 4) ? Number(period.slice(5, 7)) : 12) - index - 1
            const month = `${year}-${String(i + 1).padStart(2, '0')}`
            const item = latest.get(month)
            const label = new Intl.DateTimeFormat(locale, {month:'long',year:'numeric'}).format(new Date(Number(year), i, 1))
            const status = item?.status === 'approved' ? (tr ? 'Onaylandı' : 'Approved') : item?.status === 'pending_region_approval' ? (tr ? 'Onay bekliyor' : 'Pending approval') : item?.status === 'rejected' ? (tr ? 'İade edildi' : 'Returned') : (tr ? 'Hedef bulunmuyor' : 'No target')
            return <Button variant="ghost" type="button" key={month} className={`target-history-month${month === period ? ' is-selected' : ''}`} aria-current={month === period ? 'date' : undefined} onClick={() => {if (readOnlyDetails) { setSelectedMonth(month) } else { onSelect?.(month);setOpen(false) }}} aria-label={`${label} ${tr ? 'hedeflerini aç' : 'open targets'}`}><span><strong>{label}</strong><Badge variant="secondary" className={`target-history-status is-${item?.status ?? 'missing'}`}>{status}</Badge></span><span><strong>{item ? money.format(item.totalTargetValue) : '—'}</strong>{item && <small>{item.allocationCount} {tr ? 'personel' : 'employees'}</small>}</span><span className="target-history-arrow"><ArrowUpRight size={16} aria-hidden="true" /></span></Button>
          })}</div>}
        </div>
      </CommandCanvasOperationalDrawerContent>
    </Sheet>
  </>
}
