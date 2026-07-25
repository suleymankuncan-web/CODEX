import { useSignIn } from '@clerk/react'
import { useState, type FormEvent } from 'react'
import { useLocalization } from '../localization/useLocalization'
import {
  finalizeClerkSignIn,
  readClerkErrorCode,
  resolveClerkCompletionView,
  resolveClerkSignInError,
  resolveClerkSignInView,
  type ClerkFinalizeState,
  type ClerkSignInErrorKind,
} from './clerk-sign-in-flow'

type FormError = ClerkSignInErrorKind | 'required' | 'unsupported' | null

export function ClerkSignInForm() {
  const { t } = useLocalization()
  const { signIn, fetchStatus } = useSignIn()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<FormError>(null)
  const [codeSent, setCodeSent] = useState(false)
  const [finalizeState, setFinalizeState] = useState<ClerkFinalizeState>('idle')
  const busy = fetchStatus === 'fetching'
  const resolveView = () => resolveClerkSignInView({
    status: signIn.status,
    firstFactorStrategies: signIn.supportedFirstFactors.map((factor) => factor.strategy),
    secondFactorStrategies: signIn.supportedSecondFactors.map((factor) => factor.strategy),
  })
  const view = resolveClerkCompletionView(resolveView(), finalizeState)

  const finalize = async () => {
    setFinalizeState('finalizing')
    const outcome = await finalizeClerkSignIn(({ navigate }) => signIn.finalize({
      navigate: ({ session }) => navigate({
        session: {
          status: session.status,
          currentTask: session.currentTask,
        },
      }),
    }))
    if (outcome === 'failed') {
      setFinalizeState('failed')
    }
  }

  const sendVerificationCode = async () => {
    setError(null)
    const result = await signIn.mfa.sendEmailCode()
    if (result.error) {
      setError(resolveClerkSignInError(readClerkErrorCode(result.error)))
      return
    }
    setCodeSent(true)
  }

  const handleIdentifier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!identifier.trim()) {
      setError('required')
      return
    }
    setError(null)
    const result = await signIn.create({ identifier: identifier.trim() })
    if (result.error) {
      setError(resolveClerkSignInError(readClerkErrorCode(result.error)))
    } else if (resolveView() === 'unsupported') {
      setError('unsupported')
    }
  }

  const handlePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!password) {
      setError('required')
      return
    }
    setError(null)
    const result = await signIn.password({ password })
    if (result.error) {
      setError(resolveClerkSignInError(readClerkErrorCode(result.error)))
      return
    }
    const nextView = resolveView()
    if (nextView === 'complete') await finalize()
    else if (nextView === 'email-code') await sendVerificationCode()
    else setError('unsupported')
  }

  const handleVerification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!code.trim()) {
      setError('required')
      return
    }
    setError(null)
    const result = await signIn.mfa.verifyEmailCode({ code: code.trim() })
    if (result.error) {
      setError(resolveClerkSignInError(readClerkErrorCode(result.error)))
    } else if (signIn.status === 'complete') {
      await finalize()
    } else {
      setError('unsupported')
    }
  }

  const restart = async () => {
    await signIn.reset()
    setPassword('')
    setCode('')
    setCodeSent(false)
    setFinalizeState('idle')
    setError(null)
  }

  const errorMessage = error === 'credentials'
    ? t('authFlow.emailPasswordFailed')
    : error === 'verification'
      ? t('authFlow.verificationFailed')
      : error === 'required'
        ? t('authFlow.requiredField')
        : error === 'unsupported'
          ? t('authFlow.unsupportedSignIn')
          : error === 'generic'
            ? t('authFlow.loginUnavailableCopy')
            : null

  if (view === 'finalizing' || view === 'complete') {
    return (
      <button className="auth-login-primary" type="button" role="status" aria-live="polite" disabled>
        {t('authFlow.loginSubmitting')}
      </button>
    )
  }

  if (view === 'finalize-failed') {
    return (
      <div className="auth-login-form-state" role="alert">
        <p>{t('authFlow.loginUnavailableCopy')}</p>
        <button className="auth-login-primary" type="button" onClick={() => void finalize()}>
          {t('authFlow.retrySignIn')}
        </button>
        <button className="auth-login-secondary" type="button" onClick={() => void restart()}>
          {t('authFlow.restartSignIn')}
        </button>
      </div>
    )
  }

  if (view === 'unsupported') {
    return (
      <div className="auth-login-form-state" role="alert">
        <p>{t('authFlow.unsupportedSignIn')}</p>
        <button className="auth-login-secondary" type="button" onClick={() => void restart()}>
          {t('authFlow.restartSignIn')}
        </button>
      </div>
    )
  }

  return (
    <div className="auth-login-native">
      {view === 'identifier' ? (
        <form className="auth-login-form" onSubmit={(event) => void handleIdentifier(event)} noValidate>
          <label className="auth-login-label" htmlFor="auth-identifier">{t('authFlow.emailLabel')}</label>
          <input
            id="auth-identifier" className="auth-login-input" name="identifier" type="text"
            autoComplete="username" autoCapitalize="none" spellCheck={false} value={identifier}
            onChange={(event) => setIdentifier(event.target.value)} placeholder={t('authFlow.emailPlaceholder')}
            disabled={busy} aria-invalid={Boolean(errorMessage)} aria-describedby={errorMessage ? 'auth-login-error' : undefined}
            required autoFocus
          />
          <button className="auth-login-primary" type="submit" disabled={busy}>
            {busy ? t('authFlow.loginPreparing') : t('authFlow.continueSignIn')}
          </button>
        </form>
      ) : null}

      {view === 'password' ? (
        <form className="auth-login-form" onSubmit={(event) => void handlePassword(event)} noValidate>
          <div className="auth-login-identity-row">
            <span>{identifier || signIn.identifier}</span>
            <button type="button" onClick={() => void restart()} disabled={busy}>{t('authFlow.changeIdentifier')}</button>
          </div>
          <label className="auth-login-label" htmlFor="auth-password">{t('authFlow.passwordLabel')}</label>
          <input
            id="auth-password" className="auth-login-input" name="password" type="password"
            autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)}
            placeholder={t('authFlow.passwordPlaceholder')} disabled={busy} aria-invalid={Boolean(errorMessage)}
            aria-describedby={errorMessage ? 'auth-login-error' : undefined} required autoFocus
          />
          <button className="auth-login-primary" type="submit" disabled={busy}>
            {busy ? t('authFlow.loginSubmitting') : t('authFlow.loginTitle')}
          </button>
        </form>
      ) : null}

      {view === 'email-code' ? (
        <form className="auth-login-form" onSubmit={(event) => void handleVerification(event)} noValidate>
          <div className="auth-login-verification-copy">
            <strong>{t('authFlow.verificationTitle')}</strong>
            <p>{codeSent ? t('authFlow.verificationCopy') : t('authFlow.verificationReadyCopy')}</p>
          </div>
          <label className="auth-login-label" htmlFor="auth-code">{t('authFlow.verificationCodeLabel')}</label>
          <input
            id="auth-code" className="auth-login-input auth-login-code-input" name="code" type="text"
            inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)}
            disabled={busy || !codeSent} aria-invalid={Boolean(errorMessage)}
            aria-describedby={errorMessage ? 'auth-login-error' : undefined} required autoFocus={codeSent}
          />
          {codeSent ? (
            <>
              <button className="auth-login-primary" type="submit" disabled={busy}>
                {busy ? t('authFlow.verificationSubmitting') : t('authFlow.verifyAndContinue')}
              </button>
              <button className="auth-login-link" type="button" onClick={() => void sendVerificationCode()} disabled={busy}>
                {t('authFlow.resendCode')}
              </button>
            </>
          ) : (
            <button className="auth-login-primary" type="button" onClick={() => void sendVerificationCode()} disabled={busy}>
              {busy ? t('authFlow.verificationSending') : t('authFlow.sendVerificationCode')}
            </button>
          )}
        </form>
      ) : null}

      {errorMessage ? <p id="auth-login-error" className="auth-login-error" role="alert">{errorMessage}</p> : null}
    </div>
  )
}
