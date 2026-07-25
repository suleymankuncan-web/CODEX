import { useLocation, useParams, useSearchParams } from 'react-router'
import type { AuthSessionSummary } from '../features/auth/api'
import { StoreMyPerformancePage } from './StoreMyPerformancePage'

function getInitialLivePeriodType(input: string | null) {
  return input === 'daily' || input === 'monthly' ? input : 'monthly'
}

function getSafeRankingsReturnTo(state: unknown) {
  if (!state || typeof state !== 'object' || !('returnTo' in state)) return undefined
  const returnTo = (state as { returnTo?: unknown }).returnTo
  return typeof returnTo === 'string' && returnTo.startsWith('/store/rankings') ? returnTo : undefined
}

export function StorePersonnelPerformancePage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { employeeId } = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const initialLivePeriodType = getInitialLivePeriodType(searchParams.get('periodType'))
  const initialLivePeriodStart =
    searchParams.get('mode') === 'live' && ['daily', 'monthly'].includes(initialLivePeriodType)
      ? searchParams.get('periodStart') ?? ''
      : ''
  const returnTo = getSafeRankingsReturnTo(location.state)

  return (
    <StoreMyPerformancePage
      key={`${employeeId ?? ''}:${initialLivePeriodType}:${initialLivePeriodStart}`}
      authSummary={input.authSummary}
      {...(employeeId === undefined ? {} : { employeeId })}
      initialLivePeriodType={initialLivePeriodType}
      initialLivePeriodStart={initialLivePeriodStart}
      profileMode="personnel"
      {...(returnTo ? { returnTo } : {})}
    />
  )
}
