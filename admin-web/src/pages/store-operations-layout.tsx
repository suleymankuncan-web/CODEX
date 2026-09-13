import { useState, type ReactNode } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Store, Search, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CalendarPicker } from '@/components/ui/calendar-picker'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { AppLocale } from '@/lib/i18n'
import './store-operations-layout.css'

export function StoreOperationsHeader(input: { title: string; titleId: string; eyebrow: string; description: string; icon: LucideIcon; actions?: ReactNode }) {
  const Icon = input.icon
  return <header className="operations-header"><div className="operations-heading"><span className="operations-header-icon"><Icon aria-hidden="true" /></span><div><p className="operations-eyebrow">{input.eyebrow}</p><h1 id={input.titleId}>{input.title}</h1><p>{input.description}</p></div></div><div className="operations-header-actions">{input.actions}</div></header>
}

export function OperationsPeriod(input: { value: string; locale: AppLocale; onChange: (value: string) => void; label: string; allowAll?: boolean; monthOnly?: boolean }) {
  const all = input.value === 'all'
  const month = input.value.length === 7
  const label = all ? (input.locale === 'tr' ? 'Tüm dönemler' : 'All dates') : month ? new Intl.DateTimeFormat(input.locale, { month: 'short', year: 'numeric' }).format(new Date(`${input.value}-01T12:00:00`)) : undefined
  return <><CalendarPicker mode="single" locale={input.locale} ariaLabel={input.label} triggerClassName="operations-period" triggerContent={label} value={all ? '' : month ? `${input.value}-01` : input.value} minYear={new Date().getFullYear() - 10} maxYear={new Date().getFullYear() + 1} onValueChange={value => input.onChange(input.monthOnly ? value.slice(0, 7) : value)} onFullMonth={value => input.onChange(value.slice(0, 7))} />{input.allowAll && !all ? <Button variant="ghost" size="sm" className="operations-period-clear" onClick={() => input.onChange('all')}>{input.locale === 'tr' ? 'Tüm dönemler' : 'All dates'}</Button> : null}</>
}

export function OperationsMetrics(input: { label: string; items: Array<{ id: string; label: string; value: number | string; icon: LucideIcon; selected: boolean; onClick: () => void }> }) {
  return <div className="operations-metrics" role="group" aria-label={input.label}>{input.items.map(item => <Button key={item.id} variant="outline" className="operations-metric command-canvas-metric" aria-pressed={item.selected} onClick={item.onClick}><span><span className="operations-metric-icon"><item.icon aria-hidden="true" /></span>{item.label}</span><strong>{item.value}</strong></Button>)}</div>
}

export type OperationsDirectoryItem = { id: string; label: string; detail: string }
export function OperationsDirectory(input: { items: OperationsDirectoryItem[]; value: string; onChange: (value: string) => void; locale: AppLocale; title?: string; allLabel?: string; allDetail?: string; avatars?: boolean }) {
  const [query, setQuery] = useState('')
  const tr = input.locale === 'tr'
  const items = input.items.filter(item => `${item.label} ${item.detail}`.toLocaleLowerCase(input.locale).includes(query.toLocaleLowerCase(input.locale)))
  return <aside className="operations-directory" aria-label={input.title ?? (tr ? 'Bölge müdürleri' : 'Region managers')}><div className="operations-directory-heading"><h2>{input.title ?? (tr ? 'Bölge müdürleri' : 'Region managers')}</h2><Badge variant="secondary">{input.items.length}</Badge></div><InputGroup><InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon><InputGroupInput aria-label={tr ? 'Listede ara' : 'Search directory'} placeholder={tr ? 'Ad ile ara' : 'Search by name'} value={query} onChange={event => setQuery(event.target.value)} /></InputGroup><ToggleGroup type="single" orientation="vertical" value={input.value} onValueChange={value => { if (value) input.onChange(value) }} className="operations-directory-items"><ToggleGroupItem value="all">{input.avatars ? <Avatar size="sm"><AvatarFallback><Store size={15} aria-hidden="true" /></AvatarFallback></Avatar> : null}<span><strong>{input.allLabel ?? (tr ? 'Tüm mağazalar' : 'All stores')}</strong><small>{input.allDetail ?? (tr ? 'Tüm kayıtları göster' : 'Show all records')}</small></span></ToggleGroupItem>{items.map(item => <ToggleGroupItem key={item.id} value={item.id}>{input.avatars ? <Avatar size="sm"><AvatarFallback>{item.label.split(/\s+/).map(part => part[0]).slice(0, 2).join('')}</AvatarFallback></Avatar> : null}<span><strong>{item.label}</strong><small>{item.detail}</small></span></ToggleGroupItem>)}</ToggleGroup>{!items.length && query ? <p className="tw:p-3 tw:text-sm tw:text-muted-foreground">{tr ? 'Eşleşme bulunamadı.' : 'No matches found.'}</p> : null}</aside>
}
