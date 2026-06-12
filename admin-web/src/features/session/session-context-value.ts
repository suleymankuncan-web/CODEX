import { createContext, use } from 'react'
import type { SessionState } from './session-storage'

export type SessionContextValue = {
  session: SessionState
  isReady: boolean
  isProviderSessionHydrating: boolean
  saveSession: (next: SessionState) => Promise<void>
  resetSession: () => Promise<void>
  expireSession: () => void
  startBearerSession: (token: string, providerIdToken?: string | null) => void
  startProviderSession: (token: string, providerIdToken?: string | null) => Promise<void>
  clearProviderSession: () => Promise<void>
  clearToBearerMode: () => void
  setProviderSessionHydrating: (isHydrating: boolean) => void
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession() {
  const context = use(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within SessionProvider')
  }
  return context
}
