import { useState } from 'react'
import { Store, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChecklistSearchField } from '@/features/checklist-command/ChecklistSearchField'
import type { AppLocale } from '@/lib/i18n'
import type { RegionManagerDirectoryItem } from '@/features/org/region-manager-directory'

export function IncentiveManagerDirectory(input: {
  managers: RegionManagerDirectoryItem[]; storeCount: number; selectedId: string | null
  onSelect: (id: string | null) => void; locale: AppLocale; loading: boolean; error: boolean
  disabled?: boolean; onRetry?: () => void; ownScope?: boolean
}) {
  const [search, setSearch] = useState('')
  const tr = input.locale === 'tr'
  const managers = input.managers.filter(manager => manager.displayName.toLocaleLowerCase(input.locale).includes(search.trim().toLocaleLowerCase(input.locale)))
  return <aside className="incentive-manager-directory" aria-label={tr ? 'Bölge müdürleri' : 'Regional managers'}>
    <header>
      <div><div><p>{tr ? 'DİZİN' : 'DIRECTORY'}</p><h2>{tr ? 'Bölge müdürleri' : 'Regional managers'}</h2></div><span>{input.managers.length}</span></div>
      {!input.ownScope ? <ChecklistSearchField label={tr ? 'Bölge müdürü ara' : 'Search regional managers'} placeholder={tr ? 'Ad ile ara' : 'Search by name'} value={search} onChange={setSearch} maxLength={120} /> : null}
    </header>
    <div className="incentive-manager-options">
      <Button variant="ghost" disabled={input.disabled} aria-current={input.selectedId === null ? 'true' : undefined} onClick={() => input.onSelect(null)}>
        <span className="incentive-manager-avatar" aria-hidden="true"><Store /></span><span className="incentive-manager-copy"><strong>{tr ? 'Tüm Mağazalar' : 'All stores'}</strong><small>{input.storeCount} {tr ? 'mağaza' : 'stores'}</small></span>
      </Button>
      {managers.map(manager => <Button key={manager.userId} variant="ghost" disabled={input.disabled} aria-current={input.selectedId === manager.userId ? 'true' : undefined} onClick={() => input.onSelect(manager.userId)}>
        <span className="incentive-manager-avatar" aria-hidden="true">{initials(manager.displayName, input.locale)}</span><span className="incentive-manager-copy"><strong>{manager.displayName}</strong><small>{manager.storeIds.length} {tr ? 'sorumlu mağaza' : 'assigned stores'}</small></span>
      </Button>)}
      {input.loading ? <p className="incentive-directory-state" role="status">{tr ? 'Bölge müdürleri yükleniyor…' : 'Loading regional managers…'}</p> : null}
      {input.error ? <div className="incentive-directory-state" role="alert"><p>{tr ? 'Bölge müdürleri alınamadı.' : 'Regional managers could not be loaded.'}</p>{input.onRetry ? <Button size="sm" variant="outline" onClick={input.onRetry}>{tr ? 'Tekrar dene' : 'Retry'}</Button> : null}</div> : null}
      {!input.loading && !input.error && managers.length === 0 ? <p className="incentive-directory-state">{tr ? 'Bölge müdürü bulunamadı.' : 'No regional managers found.'}</p> : null}
    </div>
    <footer><UsersRound aria-hidden="true" /><span>{input.ownScope ? (tr ? 'Yetkili olduğunuz mağazalar' : 'Your authorized stores') : (tr ? 'Bölge müdürü atamalarına göre' : 'Based on manager assignments')}</span></footer>
  </aside>
}

function initials(name: string, locale: AppLocale) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return `${words[0]?.[0] ?? ''}${words.length > 1 ? words.at(-1)?.[0] ?? '' : ''}`.toLocaleUpperCase(locale)
}
