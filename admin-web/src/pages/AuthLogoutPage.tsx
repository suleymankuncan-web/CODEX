import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ScreenState } from '../components/dashboard-primitives'
import { getAuthBootstrap } from '../features/auth/api'
import { buildProviderLogoutUrl } from '../features/auth/auth-flow'
import { readClientProviderIdToken } from '../features/session/session-storage'
import { useSession } from '../features/session/session-context-value'

export function AuthLogoutPage() {
  const { clearToBearerMode } = useSession()
  const handledRef = useRef(false)
  const bootstrapQuery = useQuery({
    queryKey: ['auth-bootstrap'],
    queryFn: getAuthBootstrap,
    retry: false,
  })

  useEffect(() => {
    if (handledRef.current || (bootstrapQuery.isPending && !bootstrapQuery.data)) {
      return
    }

    handledRef.current = true
    const providerIdToken = readClientProviderIdToken()
    const providerLogoutUrl = buildProviderLogoutUrl({
      bootstrap: bootstrapQuery.data,
      idToken: providerIdToken,
    })
    clearToBearerMode()

    if (providerLogoutUrl) {
      window.location.replace(providerLogoutUrl)
      return
    }

    window.location.replace('/auth/login')
  }, [bootstrapQuery.data, bootstrapQuery.isPending, clearToBearerMode])

  return (
    <section className="auth-flow-shell">
      <ScreenState
        title="Signing out"
        copy="The client bearer session is being cleared and the app is returning to the configured logout destination."
      />
    </section>
  )
}
