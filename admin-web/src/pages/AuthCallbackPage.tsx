import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState, ScreenState, StatusPill } from '../components/dashboard-primitives'
import { getAuthBootstrap } from '../features/auth/api'
import {
  clearManualTokenCallbackFromAddressBar,
  exchangeAuthorizationCodeForToken,
  isManualTokenCallbackAllowed,
  readCallbackPayload,
} from '../features/auth/auth-flow'
import { useSession } from '../features/session/session-context-value'

export function AuthCallbackPage() {
  const { startBearerSession } = useSession()
  const [exchangeError, setExchangeError] = useState<string | null>(null)
  const handledRef = useRef(false)
  const callbackPayload = useMemo(
    () =>
      readCallbackPayload({
        search: window.location.search,
        hash: window.location.hash,
      }),
    [],
  )
  const token = callbackPayload.accessToken
  const manualTokenCallbackAllowed = isManualTokenCallbackAllowed()
  const manualTokenCallbackRejected = Boolean(token && !manualTokenCallbackAllowed)
  const bootstrapQuery = useQuery({
    queryKey: ['auth-bootstrap'],
    queryFn: getAuthBootstrap,
    retry: false,
    enabled: Boolean(callbackPayload.code),
  })

  useEffect(() => {
    if (handledRef.current || callbackPayload.error) {
      return
    }

    if (manualTokenCallbackRejected) {
      handledRef.current = true
      clearManualTokenCallbackFromAddressBar()
      return
    }

    if (token && token !== 'demo-placeholder-token') {
      handledRef.current = true
      startBearerSession(token)
      window.location.replace(callbackPayload.returnTo ?? '/')
      return
    }

    if (!callbackPayload.code) {
      return
    }

    if (!bootstrapQuery.data) {
      return
    }

    handledRef.current = true
    exchangeAuthorizationCodeForToken({
      code: callbackPayload.code,
      state: callbackPayload.state,
      bootstrap: bootstrapQuery.data,
    })
      .then((result) => {
        startBearerSession(result.accessToken, result.idToken)
        window.location.replace(result.returnTo)
      })
      .catch((error: unknown) => {
        setExchangeError(error instanceof Error ? error.message : String(error))
      })
  }, [
    bootstrapQuery.data,
    bootstrapQuery.isError,
    callbackPayload.code,
    callbackPayload.error,
    callbackPayload.returnTo,
    callbackPayload.state,
    manualTokenCallbackRejected,
    startBearerSession,
    token,
  ])

  if (callbackPayload.error) {
    return (
      <section className="auth-flow-shell">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Auth Callback</div>
              <h3>Login callback failed</h3>
            </div>
            <StatusPill tone="danger">Provider error</StatusPill>
          </div>
          <p className="panel-copy">
            {callbackPayload.errorDescription ??
              `The provider returned ${callbackPayload.error}. Retry login or fall back to manual session setup while the integration is still being finalized.`}
          </p>
        </div>
      </section>
    )
  }

  const visibleExchangeError =
    exchangeError ??
    (callbackPayload.code && bootstrapQuery.isError
      ? 'Auth bootstrap metadata is unavailable'
      : null)

  if (visibleExchangeError) {
    return (
      <section className="auth-flow-shell">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Auth Callback</div>
              <h3>Secure login exchange failed</h3>
            </div>
            <StatusPill tone="danger">PKCE error</StatusPill>
          </div>
          <p className="panel-copy">{visibleExchangeError}</p>
        </div>
      </section>
    )
  }

  if (callbackPayload.code) {
    return (
      <section className="auth-flow-shell">
        <ScreenState
          title="Completing secure login"
          copy="The callback received an authorization code and is exchanging it with the saved PKCE verifier before opening the app session."
        />
      </section>
    )
  }

  if (!token) {
    return (
      <section className="auth-flow-shell">
        <EmptyState
          title="No callback credential found"
          copy="This callback route is ready, but no authorization `code`, `access_token`, or `token` was found in the query string or URL hash."
        />
      </section>
    )
  }

  if (manualTokenCallbackRejected) {
    return (
      <section className="auth-flow-shell">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Auth Callback</div>
              <h3>Manual token callback is disabled</h3>
            </div>
            <StatusPill tone="danger">Production hardening</StatusPill>
          </div>
          <p className="panel-copy">
            This build only accepts the Authorization Code + PKCE callback path. Start login again
            through the provider so the app can exchange a code and verify the session normally.
          </p>
        </div>
      </section>
    )
  }

  if (token === 'demo-placeholder-token') {
    return (
      <section className="auth-flow-shell">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Auth Callback</div>
              <h3>Callback route is ready for a real provider response</h3>
            </div>
            <StatusPill tone="warning">Placeholder token</StatusPill>
          </div>
          <p className="panel-copy">
            A real provider will later return a valid bearer token or code exchange result here.
            This placeholder proves the route and handoff shape without claiming that a fake token
            is usable.
          </p>
          {callbackPayload.returnTo ? (
            <p className="panel-copy">Intended return path: <code>{callbackPayload.returnTo}</code></p>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <section className="auth-flow-shell">
      <ScreenState
        title="Completing login"
        copy="The callback received a bearer token, stored it as the current session, and is routing the app back into the verified shell flow now."
      />
    </section>
  )
}
