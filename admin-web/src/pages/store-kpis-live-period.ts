import type { SetURLSearchParams } from 'react-router'

export function buildStoreKpiLivePeriodControls(
  searchParams: URLSearchParams,
  setSearchParams: SetURLSearchParams,
) {
  const livePeriodType: 'daily' | 'monthly' = searchParams.get('periodType') === 'daily' ? 'daily' : 'monthly'
  const activeLivePeriodStart = searchParams.get('periodStart')?.trim() ?? ''
  const setLivePeriodType = (value: 'daily' | 'monthly') => {
    const next = new URLSearchParams(searchParams)
    next.set('periodType', value)
    next.delete('periodStart')
    setSearchParams(next, { replace: true })
  }
  const setLivePeriodFilter = (value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set('periodStart', value)
    else next.delete('periodStart')
    setSearchParams(next, { replace: true })
  }
  return { livePeriodType, activeLivePeriodStart, setLivePeriodType, setLivePeriodFilter }
}
