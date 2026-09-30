import type { ReactNode } from 'react'
import type { AuthSessionSummary } from '../auth/api'
import { ReturnsScopeContext } from './scope-context'

export function StoreReturnsScopeProvider(input: { authSummary: AuthSessionSummary | null; children: ReactNode }) {
  return <ReturnsScopeContext value={input.authSummary}>{input.children}</ReturnsScopeContext>
}
