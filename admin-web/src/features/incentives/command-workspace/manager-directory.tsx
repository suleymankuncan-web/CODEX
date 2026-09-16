import { useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import type { AppLocale } from '@/lib/i18n'
import type { RegionManagerDirectoryItem } from '@/features/org/region-manager-directory'

export function IncentiveManagerDirectory(input: { managers: RegionManagerDirectoryItem[]; storeCount: number; selectedId: string | null; onSelect: (id: string | null) => void; locale: AppLocale; loading: boolean; error: boolean; onRetry?: () => void }) {
  const [search, setSearch] = useState('')
  const tr = input.locale === 'tr'
  const managers = input.managers.filter(manager => manager.displayName.toLocaleLowerCase(input.locale).includes(search.trim().toLocaleLowerCase(input.locale)))
  return <aside className="incentive-manager-directory" aria-label={tr ? 'Bölge müdürleri' : 'Regional managers'}>
    <header><div><h2>{tr ? 'Bölge müdürleri' : 'Regional managers'}</h2><span>{input.managers.length}</span></div>
      <InputGroup><InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon><InputGroupInput aria-label={tr ? 'Bölge müdürü ara' : 'Search regional managers'} placeholder={tr ? 'Ad ile ara' : 'Search by name'} value={search} onChange={event => setSearch(event.target.value)} /></InputGroup>
    </header>
    <div className="incentive-manager-options">
      <Button variant="ghost" aria-current={input.selectedId === null ? 'true' : undefined} onClick={() => input.onSelect(null)}><span><strong>{tr ? 'Tüm Mağazalar' : 'All stores'}</strong><small>{input.storeCount} {tr ? 'mağaza' : 'stores'}</small></span></Button>
      {managers.map(manager => {
        return <Button key={manager.userId} variant="ghost" aria-current={input.selectedId === manager.userId ? 'true' : undefined} onClick={() => input.onSelect(manager.userId)}>
          <span><strong>{manager.displayName}</strong><small>{manager.storeIds.length} {tr ? 'mağaza' : 'stores'}</small></span>
        </Button>
      })}
      {input.loading ? <p className="incentive-command-empty" role="status">{tr ? 'Bölge müdürleri yükleniyor.' : 'Loading regional managers.'}</p> : null}
      {input.error ? <div className="incentive-command-empty"><p>{tr ? 'Bölge müdürleri alınamadı.' : 'Regional managers could not be loaded.'}</p>{input.onRetry ? <Button size="sm" variant="outline" onClick={input.onRetry}>{tr ? 'Tekrar dene' : 'Retry'}</Button> : null}</div> : null}
      {!input.loading && !input.error && managers.length === 0 ? <p className="incentive-command-empty">{tr ? 'Bölge müdürü bulunamadı.' : 'No regional managers found.'}</p> : null}
    </div>
  </aside>
}
