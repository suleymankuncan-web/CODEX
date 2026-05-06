import { createContext, useContext } from 'react'
import type { SessionState } from './session-storage'

export type SessionContextValue = {
  session: SessionState
  isReady: boolean
  isProviderSessionHydrating: boolean
  saveSession: (next: SessionState) => void
  resetSession: () => void
  expireSession: () => void
  startBearerSession: (token: string, providerIdToken?: string | null) => void
  clearToBearerMode: () => void
  setProviderSessionHydrating: (isHydrating: boolean) => void
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within SessionProvider')
  }
  return context
}
