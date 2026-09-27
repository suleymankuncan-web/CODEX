import { useEffect, useState } from 'react'

/** Commit the search and page reset together, never request page zero of the old search. */
export function useDebouncedSearchPage(delayMs = 300) {
  const [search, setSearch] = useState('')
  const [request, setRequest] = useState({ search: '', page: 0 })
  useEffect(() => {
    if (search.trim() === request.search) return
    const timer = window.setTimeout(() => setRequest({ search: search.trim(), page: 0 }), delayMs)
    return () => window.clearTimeout(timer)
  }, [search, request.search, delayMs])
  return {
    search, setSearch, querySearch: request.search, page: request.page,
    setPage: (page: number) => setRequest(current => ({ ...current, page })),
  }
}
