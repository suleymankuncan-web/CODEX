import { useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import type { AppLocale } from '@/lib/i18n'
import type { IncentiveRegion } from './types'

export function IncentiveManagerDirectory(input: { regions: IncentiveRegion[]; selectedId: string | null; onSelect: (id: string | null) => void; locale: AppLocale }) {
  const [search, setSearch] = useState('')
  const tr = input.locale === 'tr'
  const regions = input.regions.filter(region => `${region.regionManager.displayName ?? ''} ${region.regionName ?? ''}`.toLocaleLowerCase(input.locale).includes(search.trim().toLocaleLowerCase(input.locale)))
  return <aside className="incentive-manager-directory" aria-label={tr ? 'Bölge müdürleri' : 'Regional managers'}>
    <header><div><h2>{tr ? 'Bölge müdürleri' : 'Regional managers'}</h2><span>{input.regions.length}</span></div>
      <InputGroup><InputGroupAddon><Search aria-hidden="true" /></InputGroupAddon><InputGroupInput aria-label={tr ? 'Bölge müdürü ara' : 'Search regional managers'} placeholder={tr ? 'Ad ile ara' : 'Search by name'} value={search} onChange={event => setSearch(event.target.value)} /></InputGroup>
    </header>
    <div className="incentive-manager-options">
      <Button variant="ghost" aria-current={input.selectedId === null ? 'true' : undefined} onClick={() => input.onSelect(null)}><span><strong>{tr ? 'Tüm Mağazalar' : 'All stores'}</strong><small>{input.regions.reduce((count, region) => count + region.stores.length, 0)} {tr ? 'mağaza' : 'stores'}</small></span></Button>
      {regions.map(region => {
        const name = region.regionManager.displayName || (tr ? 'Atanmamış bölge' : 'Unassigned region')
        return <Button key={region.regionId} variant="ghost" aria-current={input.selectedId === region.regionId ? 'true' : undefined} onClick={() => input.onSelect(region.regionId)}>
          <span><strong>{name}</strong><small>{region.stores.length} {tr ? 'mağaza' : 'stores'}</small></span>
        </Button>
      })}
      {regions.length === 0 ? <p className="incentive-command-empty">{tr ? 'Bölge müdürü bulunamadı.' : 'No regional managers found.'}</p> : null}
    </div>
  </aside>
}
