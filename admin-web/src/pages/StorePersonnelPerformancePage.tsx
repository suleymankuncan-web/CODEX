import { useParams } from 'react-router-dom'
import type { AuthSessionSummary } from '../features/auth/api'
import { StoreMyPerformancePage } from './StoreMyPerformancePage'

export function StorePersonnelPerformancePage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { employeeId } = useParams()

  return (
    <StoreMyPerformancePage
      authSummary={input.authSummary}
      employeeId={employeeId}
      profileMode="personnel"
    />
  )
}
