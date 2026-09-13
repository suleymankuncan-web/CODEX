import { useState } from 'react'
import { ChevronLeft, ChevronRight, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChecklistSearchField } from '@/features/checklist-command/ChecklistSearchField'
import type { TargetManagerSelection } from './types'

export function TargetManagerDirectory({ selection, locale }: { selection: TargetManagerSelection; locale: 'tr' | 'en' }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const tr = locale === 'tr'
  const filtered = selection.items.filter(item => item.displayName.toLocaleLowerCase(locale).includes(search.trim().toLocaleLowerCase(locale)))
  const rows = filtered.slice(page * 20, (page + 1) * 20)
  const title = tr ? 'Bölge müdürleri' : 'Region managers'
  const entries = [{ userId: 'all', displayName: tr ? 'Tüm mağazalar' : 'All stores', storeIds: [] as string[] }, ...rows]
  return <aside className="tw:min-w-0 tw:self-start tw:overflow-hidden tw:rounded-2xl tw:border tw:border-border tw:bg-card tw:shadow-sm" aria-labelledby="target-manager-list-title">
    <header className="tw:border-b tw:border-border tw:p-3">
      <div className="tw:mb-2.5 tw:flex tw:items-end tw:justify-between tw:gap-3"><div><p className="tw:m-0 tw:text-[9px] tw:font-bold tw:uppercase tw:tracking-[0.14em] tw:text-muted-foreground">{tr ? 'Dizin' : 'Directory'}</p><h2 id="target-manager-list-title" className="tw:mt-0.5 tw:mb-0 tw:text-base tw:font-semibold tw:tracking-[-0.015em]">{title}</h2></div><span className="tw:text-[11px] tw:font-medium tw:text-muted-foreground">{selection.items.length}</span></div>
      <ChecklistSearchField label={tr ? 'Bölge müdürü ara' : 'Search region managers'} placeholder={tr ? 'Ad ile ara' : 'Search by name'} value={search} maxLength={120} onChange={value => { setSearch(value); setPage(0) }} />
    </header>
    {selection.loading && <p role="status" className="tw:p-3 tw:text-xs">{tr ? 'Yükleniyor…' : 'Loading…'}</p>}
    {selection.error && <div role="alert" className="tw:p-3 tw:text-xs"><p>{tr ? 'Bölge müdürleri yüklenemedi.' : 'Region managers could not be loaded.'}</p><Button variant="outline" onClick={selection.onRetry}>{tr ? 'Tekrar dene' : 'Retry'}</Button></div>}
    <div aria-label={title} className="tw:max-h-[520px] tw:overflow-y-auto tw:px-2 tw:py-1.5">
      {entries.map(item => <button key={item.userId} type="button" aria-current={selection.value === item.userId ? 'true' : undefined} className="tw:group tw:relative tw:flex tw:w-full tw:appearance-none tw:items-center tw:gap-2.5 tw:border-0 tw:border-b tw:border-border tw:bg-transparent tw:px-2 tw:py-2 tw:text-left tw:shadow-none tw:transition tw:last:border-b-0 tw:hover:bg-muted/50 tw:aria-current:bg-accent/25 tw:aria-current:before:absolute tw:aria-current:before:top-2 tw:aria-current:before:bottom-2 tw:aria-current:before:left-0 tw:aria-current:before:w-0.5 tw:aria-current:before:rounded-full tw:aria-current:before:bg-primary" onClick={() => selection.onChange(item.userId)}>
        <span aria-hidden className="tw:grid tw:size-8 tw:shrink-0 tw:place-items-center tw:rounded-lg tw:bg-muted tw:text-[10px] tw:font-bold tw:text-primary tw:group-aria-current:bg-primary tw:group-aria-current:text-primary-foreground">{item.userId === 'all' ? <Store size={16}/> : initials(item.displayName, locale)}</span>
        <span className="tw:min-w-0 tw:flex-1"><strong className="tw:block tw:truncate tw:text-[13px] tw:font-semibold">{item.displayName}</strong><small className="tw:block tw:text-[11px] tw:text-muted-foreground">{item.userId === 'all' ? (tr ? 'Tüm kayıtları göster' : 'Show all records') : `${item.storeIds.length} ${tr ? 'sorumlu mağaza' : 'assigned stores'}`}</small></span>
      </button>)}
      {!filtered.length && !selection.loading && !selection.error && <p className="tw:p-3 tw:text-xs tw:text-muted-foreground">{tr ? 'Eşleşen bölge müdürü yok.' : 'No matching region managers.'}</p>}
    </div>
    <footer className="tw:flex tw:items-center tw:justify-between tw:border-t tw:border-border tw:px-3 tw:py-2"><span className="tw:text-[11px] tw:font-medium tw:text-muted-foreground">{page + 1}</span><div className="tw:flex tw:gap-1"><Button size="icon-xs" variant="ghost" aria-label={tr ? 'Önceki bölge müdürü sayfası' : 'Previous region manager page'} disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft/></Button><Button size="icon-xs" variant="ghost" aria-label={tr ? 'Sonraki bölge müdürü sayfası' : 'Next region manager page'} disabled={(page + 1) * 20 >= filtered.length} onClick={() => setPage(page + 1)}><ChevronRight/></Button></div></footer>
  </aside>
}
function initials(name: string, locale: string) { const words = name.trim().split(/\s+/).filter(Boolean); return `${words[0]?.[0] ?? ''}${words.at(-1)?.[0] ?? ''}`.toLocaleUpperCase(locale) }
