import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Search, Store } from 'lucide-react'
import type { AuthSessionSummary } from '../auth/api'
import { storeChecklistVisitPlanRegionsQueryKey } from '../auth/store-query-scope'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from '../../components/ui/popover'
import { Skeleton } from '../../components/ui/skeleton'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import { cn } from '../../lib/utils'
import { getChecklistVisitPlanRegionOptions, type ChecklistVisitPlanRegionOption } from './api'

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

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => { setQuery(searchDraft.trim()); setOffset(0) }, 250)
    return () => window.clearTimeout(timer)
  }, [open, searchDraft])

  const filters = useMemo(() => ({ query, limit: 20, offset }), [offset, query])
  const regionsQuery = useQuery({
    queryKey: storeChecklistVisitPlanRegionsQueryKey(input.authSummary, filters),
    queryFn: () => getChecklistVisitPlanRegionOptions(filters),
    enabled: open,
    placeholderData: keepPreviousData,
    ...transientQueryRetryOptions,
  })
  const data = regionsQuery.data?.data
  const close = () => { setOpen(false); setSearchDraft(''); setQuery(''); setOffset(0) }

  return (
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) close() }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="checklist-region-trigger tw:min-h-10 tw:gap-2 tw:rounded-lg tw:px-2.5 tw:text-left">
          <Store className="tw:size-4 tw:text-primary" aria-hidden="true" />
          <span className="tw:grid tw:min-w-20 tw:gap-0.5"><small className="tw:text-[9px] tw:font-semibold tw:uppercase tw:tracking-[0.08em] tw:text-muted-foreground">{input.locale === 'tr' ? 'BÖLGE' : 'REGION'}</small><strong className="tw:max-w-32 tw:truncate tw:text-xs tw:text-foreground">{input.selected?.regionName ?? '—'}</strong></span>
          <ChevronDown className="tw:size-3 tw:text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent role="dialog" aria-label={input.locale === 'tr' ? 'Planlama bölgesi' : 'Planning region'} align="end" className="tw:w-[min(20rem,calc(100vw-1.5rem))] tw:p-0">
        <PopoverHeader className="tw:border-b tw:border-border tw:px-3 tw:py-2.5">
          <PopoverTitle className="tw:text-sm">{input.locale === 'tr' ? 'Bölge seçin' : 'Select a region'}</PopoverTitle>
          <PopoverDescription className="tw:text-xs">{input.locale === 'tr' ? 'Planlama kapsamını belirleyin.' : 'Choose the planning scope.'}</PopoverDescription>
        </PopoverHeader>
        <div className="tw:grid tw:gap-2 tw:p-3">
          <label className="tw:flex tw:min-h-10 tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-input tw:bg-muted/20 tw:px-2.5 tw:text-muted-foreground"><Search className="tw:size-4" aria-hidden="true" /><Input autoFocus value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={input.locale === 'tr' ? 'Bölge ara' : 'Search regions'} className="tw:h-auto tw:border-0 tw:bg-transparent tw:p-0 tw:text-base tw:shadow-none tw:focus-visible:ring-0 tw:sm:text-xs" /></label>
          <div className="tw:grid tw:max-h-64 tw:gap-1 tw:overflow-y-auto" role="listbox" aria-label={input.locale === 'tr' ? 'Bölgeler' : 'Regions'}>
            {!data && regionsQuery.isLoading ? <><Skeleton className="tw:h-10" /><Skeleton className="tw:h-10" /></> : null}
            {!data && regionsQuery.isError ? <Alert variant="destructive"><AlertDescription className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2"><span>{input.locale === 'tr' ? 'Bölgeler yüklenemedi.' : 'Regions could not load.'}</span><Button type="button" size="sm" variant="outline" onClick={() => void regionsQuery.refetch()}>{input.locale === 'tr' ? 'Tekrar dene' : 'Retry'}</Button></AlertDescription></Alert> : null}
            {data?.items.length === 0 ? <p className="tw:p-4 tw:text-center tw:text-xs tw:text-muted-foreground">{input.locale === 'tr' ? 'Eşleşen bölge yok.' : 'No matching region.'}</p> : null}
            {data?.items.map((option) => {
              const selected = input.selected?.regionId === option.regionId
              return <Button key={option.regionId} type="button" aria-pressed={selected} variant={selected ? 'secondary' : 'ghost'} className={cn('tw:min-h-11 tw:justify-between tw:rounded-md tw:px-2.5 tw:text-left', selected && 'tw:text-primary')} onClick={() => { input.onSelect(option); close() }}><span className="tw:truncate tw:text-xs">{option.regionName}</span>{selected ? <Check className="tw:size-3.5" aria-hidden="true" /> : null}</Button>
            })}
          </div>
          {data && data.page.total > data.page.limit ? <footer className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:border-t tw:border-border tw:pt-2"><Button type="button" size="sm" variant="outline" disabled={offset === 0 || regionsQuery.isFetching} onClick={() => setOffset(Math.max(0, offset - data.page.limit))}><ChevronLeft className="tw:size-3.5" />{input.locale === 'tr' ? 'Önceki' : 'Previous'}</Button><span className="tw:text-[10px] tw:tabular-nums tw:text-muted-foreground">{Math.floor(offset / data.page.limit) + 1} / {Math.ceil(data.page.total / data.page.limit)}</span><Button type="button" size="sm" variant="outline" disabled={!data.page.hasMore || regionsQuery.isFetching} onClick={() => setOffset(offset + data.page.limit)}>{input.locale === 'tr' ? 'Sonraki' : 'Next'}<ChevronRight className="tw:size-3.5" /></Button></footer> : null}
          {regionsQuery.isFetching && data ? <small aria-live="polite" className="tw:text-[10px] tw:text-muted-foreground">{input.locale === 'tr' ? 'Güncelleniyor…' : 'Refreshing…'}</small> : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
