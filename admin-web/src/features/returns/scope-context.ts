import { createContext, use } from 'react'
import type { AuthSessionSummary } from '../auth/api'

export const ReturnsScopeContext = createContext<AuthSessionSummary | null>(null)

export function useStoreReturnsScope() {
  return use(ReturnsScopeContext)
}
