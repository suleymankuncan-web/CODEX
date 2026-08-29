import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'

import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { ScrollArea } from '../components/ui/scroll-area'

type StoreOption = {
  storeId: string
  storeName: string
  storeCode: string
}

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase('tr-TR')
}

export function MasterDataStoreCombobox({
  onValueChange,
  stores,
  value,
}: {
  onValueChange: (value: string) => void
  stores: StoreOption[]
  value: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const selectedStore = stores.find((store) => store.storeId === value)
  const normalizedQuery = normalizeSearch(query)
  const filteredStores = useMemo(() => {
    if (!normalizedQuery) return stores
    return stores.filter((store) => normalizeSearch(`${store.storeName} ${store.storeCode}`).includes(normalizedQuery))
  }, [normalizedQuery, stores])
  const activeStore = filteredStores[activeIndex]

  useEffect(() => {
    if (!open || !activeStore) return
    document.getElementById(`${listId}-${activeStore.storeId}`)?.scrollIntoView({ block: 'nearest' })
  }, [activeStore, listId, open])

  const selectStore = (storeId: string) => {
    onValueChange(storeId)
    setOpen(false)
    setQuery('')
    setActiveIndex(0)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    setQuery('')
    const selectedIndex = stores.findIndex((store) => store.storeId === value)
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          aria-controls={listId}
          aria-expanded={open}
          aria-label="Mağaza seç"
          className="tw:w-full tw:justify-between tw:gap-3 tw:px-3 tw:font-normal"
          role="combobox"
          type="button"
          variant="outline"
        >
          <span className="tw:min-w-0 tw:truncate">
            {selectedStore ? selectedStore.storeName : 'Mağaza seçin'}
          </span>
          <span className="tw:flex tw:shrink-0 tw:items-center tw:gap-2 tw:text-xs tw:text-muted-foreground">
            {selectedStore ? selectedStore.storeCode : null}
            <ChevronsUpDown className="tw:size-4" aria-hidden="true" />
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="tw:w-(--radix-popover-trigger-width) tw:gap-0 tw:overflow-hidden tw:p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          searchInputRef.current?.focus()
        }}
      >
        <div className="tw:border-b tw:border-border tw:p-3">
          <div className="tw:relative">
            <Search className="tw:absolute tw:top-1/2 tw:left-3 tw:size-4 tw:-translate-y-1/2 tw:text-muted-foreground" aria-hidden="true" />
            <Input
              aria-activedescendant={activeStore ? `${listId}-${activeStore.storeId}` : undefined}
              aria-autocomplete="list"
              aria-controls={listId}
              aria-expanded={open}
              aria-label="Mağaza ara"
              className="tw:bg-background tw:pl-9"
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={(event) => {
                if (!filteredStores.length) return
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setActiveIndex((current) => (current + 1) % filteredStores.length)
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  setActiveIndex((current) => (current - 1 + filteredStores.length) % filteredStores.length)
                }
                if (event.key === 'Enter' && activeStore) {
                  event.preventDefault()
                  selectStore(activeStore.storeId)
                }
                if (event.key === 'Escape') setOpen(false)
              }}
              placeholder="Mağaza adı veya kodu ara"
              ref={searchInputRef}
              role="combobox"
              value={query}
            />
          </div>
        </div>

        <div className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-border tw:px-3 tw:py-2 tw:text-xs tw:text-muted-foreground">
          <span>{normalizedQuery ? `${filteredStores.length} sonuç` : `${stores.length} aktif mağaza`}</span>
          {normalizedQuery ? <span>Ad veya kod eşleşmesi</span> : null}
        </div>

        <ScrollArea className="tw:h-64">
          <div aria-label="Mağazalar" className="tw:p-1.5" id={listId} role="listbox">
            {filteredStores.length ? filteredStores.map((store, index) => {
              const selected = store.storeId === value
              const active = index === activeIndex
              return (
                <button
                  aria-selected={selected}
                  className={`tw:flex tw:min-h-12 tw:w-full tw:appearance-none tw:items-center tw:gap-3 tw:rounded-md tw:border-0 tw:px-2.5 tw:py-2 tw:text-left tw:transition-colors ${active ? 'tw:bg-accent tw:text-accent-foreground' : 'tw:bg-transparent tw:text-foreground tw:hover:bg-muted'}`}
                  id={`${listId}-${store.storeId}`}
                  key={store.storeId}
                  onClick={() => selectStore(store.storeId)}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                  type="button"
                >
                  <span className="tw:min-w-0 tw:flex-1">
                    <span className="tw:block tw:truncate tw:text-sm tw:font-medium">{store.storeName}</span>
                    <span className="tw:mt-0.5 tw:block tw:text-xs tw:text-muted-foreground">{store.storeCode}</span>
                  </span>
                  <Check className={`tw:size-4 tw:shrink-0 ${selected ? 'tw:opacity-100' : 'tw:opacity-0'}`} aria-hidden="true" />
                </button>
              )
            }) : (
              <div className="tw:px-3 tw:py-8 tw:text-center">
                <p className="tw:m-0 tw:text-sm tw:font-medium tw:text-foreground">Mağaza bulunamadı</p>
                <p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">Adı veya mağaza kodunu kontrol edin.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
