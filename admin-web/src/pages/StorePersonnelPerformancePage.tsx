import { useParams, useSearchParams } from 'react-router-dom'
import type { AuthSessionSummary } from '../features/auth/api'
import { StoreMyPerformancePage } from './StoreMyPerformancePage'

function getInitialLivePeriodType(input: string | null) {
  return input === 'daily' || input === 'monthly' ? input : 'monthly'
}

export function StorePersonnelPerformancePage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { employeeId } = useParams()
  const [searchParams] = useSearchParams()
  const initialLivePeriodType = getInitialLivePeriodType(searchParams.get('periodType'))
  const initialLivePeriodStart =
    searchParams.get('mode') === 'live' && ['daily', 'monthly'].includes(initialLivePeriodType)
      ? searchParams.get('periodStart') ?? ''
      : ''

  return (
    <StoreMyPerformancePage
      key={`${employeeId ?? ''}:${initialLivePeriodType}:${initialLivePeriodStart}`}
      authSummary={input.authSummary}
      {...(employeeId === undefined ? {} : { employeeId })}
      initialLivePeriodType={initialLivePeriodType}
      initialLivePeriodStart={initialLivePeriodStart}
      profileMode="personnel"
    />
  )
}
