import { useEffect, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Search, Store } from 'lucide-react'
import type { AuthSessionSummary } from '../auth/api'
import { storeChecklistVisitPlanRegionsQueryKey } from '../auth/store-query-scope'
import { Input } from '../../components/ui/input'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import {
  getChecklistVisitPlanRegionOptions,
  type ChecklistVisitPlanRegionOption,
} from './api'

export function ChecklistPlanningRegionPicker(input: {
  authSummary: AuthSessionSummary | null
  locale: 'tr' | 'en'
  selected: ChecklistVisitPlanRegionOption | null
  onSelect: (option: ChecklistVisitPlanRegionOption) => void
}) {
  const [open, setOpen] = useState(false)
  const [searchDraft, setSearchDraft] = useState('')
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      setQuery(searchDraft.trim())
      setOffset(0)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [open, searchDraft])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const filters = useMemo(() => ({ query, limit: 20, offset }), [offset, query])
  const regionsQuery = useQuery({
    queryKey: storeChecklistVisitPlanRegionsQueryKey(input.authSummary, filters),
    queryFn: () => getChecklistVisitPlanRegionOptions(filters),
    enabled: open,
    placeholderData: keepPreviousData,
    ...transientQueryRetryOptions,
  })
  const data = regionsQuery.data?.data

  return (
    <div className="checklist-region-picker" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className="checklist-region-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Store size={14} />
        <span><small>{input.locale === 'tr' ? 'BÖLGE' : 'REGION'}</small><strong>{input.selected?.regionName ?? '—'}</strong></span>
        <ChevronDown size={13} />
      </button>
      {open ? (
        <div className="checklist-region-popover" role="dialog" aria-label={input.locale === 'tr' ? 'Planlama bölgesi' : 'Planning region'}>
          <label><Search size={14} /><Input autoFocus value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={input.locale === 'tr' ? 'Bölge ara' : 'Search regions'} /></label>
          <div className="checklist-region-options">
            {!data && regionsQuery.isLoading ? <span>{input.locale === 'tr' ? 'Bölgeler yükleniyor…' : 'Loading regions…'}</span> : null}
            {!data && regionsQuery.isError ? <button type="button" onClick={() => void regionsQuery.refetch()}>{input.locale === 'tr' ? 'Yüklenemedi · Yeniden dene' : 'Failed · Retry'}</button> : null}
            {data?.items.length === 0 ? <span>{input.locale === 'tr' ? 'Eşleşen bölge yok.' : 'No matching region.'}</span> : null}
            {data?.items.map((option) => (
              <button
                type="button"
                key={option.regionId}
                aria-pressed={input.selected?.regionId === option.regionId}
                className={input.selected?.regionId === option.regionId ? 'is-selected' : ''}
                onClick={() => {
                  input.onSelect(option)
                  setOpen(false)
                  triggerRef.current?.focus()
                }}
              >
                <span>{option.regionName}</span>
                {input.selected?.regionId === option.regionId ? <Check size={13} /> : null}
              </button>
            ))}
          </div>
          {data && data.page.total > data.page.limit ? (
            <footer>
              <button type="button" disabled={offset === 0 || regionsQuery.isFetching} onClick={() => setOffset(Math.max(0, offset - data.page.limit))}><ChevronLeft size={13} /> {input.locale === 'tr' ? 'Önceki' : 'Previous'}</button>
              <span>{Math.floor(offset / data.page.limit) + 1} / {Math.ceil(data.page.total / data.page.limit)}</span>
              <button type="button" disabled={!data.page.hasMore || regionsQuery.isFetching} onClick={() => setOffset(offset + data.page.limit)}>{input.locale === 'tr' ? 'Sonraki' : 'Next'} <ChevronRight size={13} /></button>
            </footer>
          ) : null}
          {regionsQuery.isFetching && data ? <small aria-live="polite">{input.locale === 'tr' ? 'Güncelleniyor…' : 'Refreshing…'}</small> : null}
        </div>
      ) : null}
    </div>
  )
}
