import { useParams, useSearchParams } from 'react-router-dom'
import type { AuthSessionSummary } from '../features/auth/api'
import { StoreMyPerformancePage } from './StoreMyPerformancePage'

export function StorePersonnelPerformancePage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { employeeId } = useParams()
  const [searchParams] = useSearchParams()
  const initialLivePeriodStart =
    searchParams.get('mode') === 'live' && searchParams.get('periodType') === 'monthly'
      ? searchParams.get('periodStart') ?? ''
      : ''

  return (
    <StoreMyPerformancePage
      authSummary={input.authSummary}
      employeeId={employeeId}
      initialLivePeriodStart={initialLivePeriodStart}
      profileMode="personnel"
    />
  )
}
