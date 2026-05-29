import type { AuthSessionSummary } from '../features/auth/api'
import type { PersonnelRankingRow } from '../features/reports/api'

export function canOpenPersonnelProfileFromRanking(
  authSummary: AuthSessionSummary | null,
  row: PersonnelRankingRow,
) {
  if (authSummary?.user.employeeId && authSummary.user.employeeId === row.employeeId) {
    return true
  }

  return row.canOpenProfile === true
}
