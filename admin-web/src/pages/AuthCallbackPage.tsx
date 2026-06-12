import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState, ScreenState, StatusPill } from '../components/dashboard-primitives'
import { getAuthBootstrap } from '../features/auth/api'
import {
  clearManualTokenCallbackFromAddressBar,
  exchangeAuthorizationCodeForToken,
  isManualTokenCallbackAllowed,
  readCallbackPayload,
} from '../features/auth/auth-flow'
import { useLocalization } from '../features/localization/useLocalization'
import { useSession } from '../features/session/session-context-value'

export function AuthCallbackPage() {
  const { t } = useLocalization()
  const { startProviderSession } = useSession()
  const navigate = useNavigate()
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
      startProviderSession(token)
        .then(() => navigate(callbackPayload.returnTo ?? '/', { replace: true }))
        .catch((error: unknown) => {
          setExchangeError(error instanceof Error ? error.message : String(error))
        })
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
        return startProviderSession(result.accessToken, result.idToken).then(() => {
          navigate(result.returnTo, { replace: true })
        })
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
    navigate,
    startProviderSession,
    token,
  ])

  if (callbackPayload.error) {
    return (
      <section className="auth-flow-shell">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('authFlow.callbackEyebrow')}</div>
              <h3>{t('authFlow.callbackFailedTitle')}</h3>
            </div>
            <StatusPill tone="danger">{t('authFlow.providerError')}</StatusPill>
          </div>
          <p className="panel-copy">
            {callbackPayload.errorDescription ??
              t('authFlow.providerReturnedError', { error: callbackPayload.error })}
          </p>
        </div>
      </section>
    )
  }

  const visibleExchangeError =
    exchangeError ??
    (callbackPayload.code && bootstrapQuery.isError
      ? t('authFlow.bootstrapUnavailable')
      : null)

  if (visibleExchangeError) {
    return (
      <section className="auth-flow-shell">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('authFlow.callbackEyebrow')}</div>
              <h3>{t('authFlow.secureExchangeFailedTitle')}</h3>
            </div>
            <StatusPill tone="danger">{t('authFlow.pkceError')}</StatusPill>
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
          title={t('authFlow.completingSecureLoginTitle')}
          copy={t('authFlow.completingSecureLoginCopy')}
        />
      </section>
    )
  }

  if (!token) {
    return (
      <section className="auth-flow-shell">
        <EmptyState
          title={t('authFlow.noCredentialTitle')}
          copy={t('authFlow.noCredentialCopy')}
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
              <div className="eyebrow">{t('authFlow.callbackEyebrow')}</div>
              <h3>{t('authFlow.manualTokenDisabledTitle')}</h3>
            </div>
            <StatusPill tone="danger">{t('authFlow.productionHardening')}</StatusPill>
          </div>
          <p className="panel-copy">{t('authFlow.manualTokenDisabledCopy')}</p>
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
              <div className="eyebrow">{t('authFlow.callbackEyebrow')}</div>
              <h3>{t('authFlow.placeholderReadyTitle')}</h3>
            </div>
            <StatusPill tone="warning">{t('authFlow.placeholderToken')}</StatusPill>
          </div>
          <p className="panel-copy">{t('authFlow.placeholderReadyCopy')}</p>
          {callbackPayload.returnTo ? (
            <p className="panel-copy">{t('authFlow.intendedReturnPath', { returnTo: callbackPayload.returnTo })}</p>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <section className="auth-flow-shell">
      <ScreenState
        title={t('authFlow.completingLoginTitle')}
        copy={t('authFlow.completingLoginCopy')}
      />
    </section>
  )
}
