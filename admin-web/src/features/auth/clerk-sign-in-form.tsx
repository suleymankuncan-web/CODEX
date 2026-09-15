import { useSignIn } from '@clerk/react'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocalization } from '../localization/useLocalization'
import { useSession } from '../session/session-context-value'
import {
  finalizeClerkSignIn,
  readClerkErrorCode,
  resolveClerkCompletionView,
  resolveClerkSignInError,
  resolveClerkSignInView,
  type ClerkFinalizeState,
  type ClerkSignInErrorKind,
} from './clerk-sign-in-flow'
import { AuthLoginNotice } from './auth-login-notice'

const rememberedIdentifierKey = 'hr-axis:remembered-login-identifier'

type RecoveryView = 'identifier' | 'code' | 'password' | null
type FormError = ClerkSignInErrorKind | 'required' | 'unsupported' | 'password-mismatch' | 'recovery' | null

function readRememberedIdentifier() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(rememberedIdentifierKey)?.trim() ?? ''
}

function persistRememberedIdentifier(identifier: string, rememberIdentifier: boolean) {
  if (typeof window === 'undefined') return
  if (rememberIdentifier) window.localStorage.setItem(rememberedIdentifierKey, identifier)
  else window.localStorage.removeItem(rememberedIdentifierKey)
}

export function ClerkSignInForm() {
  const { t } = useLocalization()
  const { setProviderSessionHydrating } = useSession()
  const { signIn, fetchStatus } = useSignIn()
  const rememberedIdentifier = readRememberedIdentifier()
  const [identifier, setIdentifier] = useState(rememberedIdentifier)
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('')
  const [rememberIdentifier, setRememberIdentifier] = useState(Boolean(rememberedIdentifier))
  const [error, setError] = useState<FormError>(null)
  const [codeSent, setCodeSent] = useState(false)
  const [recoveryView, setRecoveryView] = useState<RecoveryView>(null)
  const [finalizeState, setFinalizeState] = useState<ClerkFinalizeState>('idle')
  const recoveryDialogRef = useRef<HTMLDialogElement>(null)
  const busy = fetchStatus === 'fetching'
  const resolveView = () => resolveClerkSignInView({
    status: signIn.status,
    firstFactorStrategies: signIn.supportedFirstFactors.map((factor) => factor.strategy),
    secondFactorStrategies: signIn.supportedSecondFactors.map((factor) => factor.strategy),
  })
  const view = resolveClerkCompletionView(resolveView(), finalizeState)

  useEffect(() => {
    const dialog = recoveryDialogRef.current
    if (!dialog) return
    if (recoveryView !== null && !dialog.open) dialog.showModal()
    if (recoveryView === null && dialog.open) dialog.close()
  }, [recoveryView])

  const finalize = async () => {
    setFinalizeState('finalizing')
    setProviderSessionHydrating(true)
    const outcome = await finalizeClerkSignIn(({ navigate }) => signIn.finalize({
      navigate: ({ session }) => navigate({
        session: {
          status: session.status,
          currentTask: session.currentTask,
        },
      }),
    }))
    if (outcome === 'failed') {
      setProviderSessionHydrating(false)
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

  const continueAfterCredential = async () => {
    const nextView = resolveView()
    if (nextView === 'complete') await finalize()
    else if (nextView === 'email-code') await sendVerificationCode()
    else setError('unsupported')
  }

  const handleCredentials = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedIdentifier = identifier.trim()
    if (!normalizedIdentifier || !password) {
      setError('required')
      return
    }

    setError(null)
    const result = await signIn.create({ identifier: normalizedIdentifier, password })
    if (result.error) {
      setError(resolveClerkSignInError(readClerkErrorCode(result.error)))
      return
    }

    persistRememberedIdentifier(normalizedIdentifier, rememberIdentifier)
    if (resolveView() === 'password') {
      const passwordResult = await signIn.password({ password })
      if (passwordResult.error) {
        setError(resolveClerkSignInError(readClerkErrorCode(passwordResult.error)))
        return
      }
    }
    await continueAfterCredential()
  }

  const beginPasswordRecovery = () => {
    setError(null)
    setRecoveryView('identifier')
  }

  const sendPasswordRecoveryCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedIdentifier = identifier.trim()
    if (!normalizedIdentifier) {
      setError('required')
      return
    }

    setError(null)
    await signIn.reset()
    const identifierResult = await signIn.create({ identifier: normalizedIdentifier })
    if (identifierResult.error) {
      setError('recovery')
      return
    }
    const sendResult = await signIn.resetPasswordEmailCode.sendCode()
    if (sendResult.error) {
      setError('recovery')
      return
    }

    setCode('')
    setRecoveryView('code')
  }

  const closePasswordRecovery = async () => {
    if (busy) return
    await restart()
  }

  const verifyRecoveryCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!code.trim()) {
      setError('required')
      return
    }
    setError(null)
    const result = await signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() })
    if (result.error) {
      setError('recovery')
      return
    }
    setRecoveryView('password')
  }

  const submitRecoveredPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!newPassword || !newPasswordConfirmation) {
      setError('required')
      return
    }
    if (newPassword !== newPasswordConfirmation) {
      setError('password-mismatch')
      return
    }
    setError(null)
    const result = await signIn.resetPasswordEmailCode.submitPassword({
      password: newPassword,
    })
    if (result.error) {
      setError('recovery')
      return
    }

    setRecoveryView(null)
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
    setNewPassword('')
    setNewPasswordConfirmation('')
    setCodeSent(false)
    setRecoveryView(null)
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
          : error === 'password-mismatch'
            ? t('authFlow.passwordMismatch')
            : error === 'recovery'
              ? t('authFlow.passwordRecoveryFailed')
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
      <div className="auth-login-form-state">
        <AuthLoginNotice>{t('authFlow.loginUnavailableCopy')}</AuthLoginNotice>
        <button className="auth-login-primary" type="button" onClick={() => void finalize()}>
          {t('authFlow.retrySignIn')}
        </button>
        <button className="auth-login-secondary" type="button" onClick={() => void restart()}>
          {t('authFlow.restartSignIn')}
        </button>
      </div>
    )
  }

  return (
    <div className="auth-login-native">
      {view !== 'email-code' ? (
        <form className="auth-login-form" onSubmit={(event) => void handleCredentials(event)} noValidate>
          <div className="auth-login-field field-block">
            <label className="auth-login-label" htmlFor="auth-identifier">{t('authFlow.identifierLabel')}</label>
            <input
              id="auth-identifier" className="auth-login-input" name="identifier" type="text"
              autoComplete="username" autoCapitalize="none" spellCheck={false} value={identifier}
              onChange={(event) => setIdentifier(event.target.value)} placeholder={t('authFlow.identifierPlaceholder')}
              disabled={busy} aria-invalid={Boolean(errorMessage)} aria-describedby={errorMessage ? 'auth-login-error' : undefined}
              required autoFocus
            />
          </div>
          <div className="auth-login-field field-block">
            <label className="auth-login-label" htmlFor="auth-password">{t('authFlow.passwordLabel')}</label>
            <div className="password-wrap">
              <input
                id="auth-password" className="auth-login-input" name="password" type={passwordVisible ? 'text' : 'password'}
                autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)}
                placeholder={t('authFlow.passwordPlaceholder')} disabled={busy} aria-invalid={Boolean(errorMessage)}
                aria-describedby={errorMessage ? 'auth-login-error' : undefined} required
              />
              <button
                className="password-toggle"
                type="button"
                aria-label={t(passwordVisible ? 'authFlow.hidePassword' : 'authFlow.showPassword')}
                aria-pressed={passwordVisible}
                onClick={() => setPasswordVisible((visible) => !visible)}
                disabled={busy}
              >
                {passwordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </div>
          </div>
          <div className="form-options">
            <label className="auth-login-remember remember-label">
              <input
                type="checkbox"
                checked={rememberIdentifier}
                onChange={(event) => setRememberIdentifier(event.target.checked)}
                disabled={busy}
              />
              <span>{t('authFlow.rememberIdentifier')}</span>
            </label>
            <button className="auth-login-link forgot-button" type="button" onClick={beginPasswordRecovery} disabled={busy}>
              {t('authFlow.forgotPassword')}
            </button>
          </div>
          <button className="auth-login-primary login-submit" type="submit" disabled={busy}>
            <span>{busy ? t('authFlow.loginSubmitting') : t('authFlow.loginTitle')}</span>
            <ArrowRight aria-hidden="true" />
          </button>
        </form>
      ) : null}

      <dialog
        ref={recoveryDialogRef}
        className="auth-recovery-dialog"
        aria-labelledby="auth-recovery-title"
        onCancel={(event) => {
          event.preventDefault()
          void closePasswordRecovery()
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) void closePasswordRecovery()
        }}
      >
        <div className="auth-recovery-surface">
          <div className="auth-recovery-head">
            <div>
              <span>{t('authFlow.passwordRecoveryEyebrow')}</span>
              <h2 id="auth-recovery-title">{recoveryView === 'password' ? t('authFlow.newPasswordTitle') : t('authFlow.passwordRecoveryTitle')}</h2>
            </div>
            <button
              className="auth-recovery-close"
              type="button"
              aria-label={t('authFlow.closePasswordRecovery')}
              onClick={() => void closePasswordRecovery()}
              disabled={busy}
            >
              ×
            </button>
          </div>

          <div className="auth-recovery-body">
            {recoveryView === 'identifier' ? (
              <form className="auth-login-form" onSubmit={(event) => void sendPasswordRecoveryCode(event)} noValidate>
                <p className="auth-recovery-copy">{t('authFlow.passwordRecoveryIdentifierCopy')}</p>
                <div className="auth-login-field field-block">
                  <label className="auth-login-label" htmlFor="auth-recovery-identifier">{t('authFlow.identifierLabel')}</label>
                  <input
                    id="auth-recovery-identifier" className="auth-login-input" name="recovery-identifier" type="text"
                    autoComplete="username" autoCapitalize="none" spellCheck={false} value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)} placeholder={t('authFlow.identifierPlaceholder')}
                    disabled={busy} aria-invalid={Boolean(errorMessage)} required autoFocus
                  />
                </div>
                <button className="auth-login-primary login-submit login-submit-centered" type="submit" disabled={busy}>
                  {busy ? t('authFlow.verificationSending') : t('authFlow.sendVerificationCode')}
                </button>
              </form>
            ) : null}

            {recoveryView === 'code' ? (
              <form className="auth-login-form" onSubmit={(event) => void verifyRecoveryCode(event)} noValidate>
                <p className="auth-recovery-copy">{t('authFlow.passwordRecoveryCodeCopy')}</p>
                <div className="auth-login-field field-block">
                  <label className="auth-login-label" htmlFor="auth-recovery-code">{t('authFlow.verificationCodeLabel')}</label>
                  <input
                    id="auth-recovery-code" className="auth-login-input auth-login-code-input" name="recovery-code" type="text"
                    inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)}
                    disabled={busy} aria-invalid={Boolean(errorMessage)} required autoFocus
                  />
                </div>
                <button className="auth-login-primary login-submit login-submit-centered" type="submit" disabled={busy}>
                  {busy ? t('authFlow.verificationSubmitting') : t('authFlow.continueSignIn')}
                </button>
              </form>
            ) : null}

            {recoveryView === 'password' ? (
              <form className="auth-login-form" onSubmit={(event) => void submitRecoveredPassword(event)} noValidate>
                <p className="auth-recovery-copy">{t('authFlow.newPasswordCopy')}</p>
                <div className="auth-login-field field-block">
                  <label className="auth-login-label" htmlFor="auth-new-password">{t('authFlow.newPasswordLabel')}</label>
                  <input
                    id="auth-new-password" className="auth-login-input" name="new-password" type="password"
                    autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)}
                    disabled={busy} aria-invalid={Boolean(errorMessage)} required autoFocus
                  />
                </div>
                <div className="auth-login-field field-block">
                  <label className="auth-login-label" htmlFor="auth-new-password-confirmation">{t('authFlow.newPasswordConfirmationLabel')}</label>
                  <input
                    id="auth-new-password-confirmation" className="auth-login-input" name="new-password-confirmation" type="password"
                    autoComplete="new-password" value={newPasswordConfirmation}
                    onChange={(event) => setNewPasswordConfirmation(event.target.value)} disabled={busy}
                    aria-invalid={Boolean(errorMessage)} required
                  />
                </div>
                <button className="auth-login-primary login-submit login-submit-centered" type="submit" disabled={busy}>
                  {busy ? t('authFlow.loginSubmitting') : t('authFlow.updatePassword')}
                </button>
              </form>
            ) : null}

            {recoveryView !== null && errorMessage ? <AuthLoginNotice>{errorMessage}</AuthLoginNotice> : null}
            <button className="auth-recovery-cancel" type="button" onClick={() => void closePasswordRecovery()} disabled={busy}>
              {t('authFlow.cancelPasswordRecovery')}
            </button>
          </div>
        </div>
      </dialog>

      {recoveryView === null && view === 'email-code' ? (
        <form className="auth-login-form" onSubmit={(event) => void handleVerification(event)} noValidate>
          <div className="auth-login-verification-copy">
            <strong>{t('authFlow.verificationTitle')}</strong>
            <p>{codeSent ? t('authFlow.verificationCopy') : t('authFlow.verificationReadyCopy')}</p>
          </div>
          <div className="auth-login-field field-block">
            <label className="auth-login-label" htmlFor="auth-code">{t('authFlow.verificationCodeLabel')}</label>
            <input
              id="auth-code" className="auth-login-input auth-login-code-input" name="code" type="text"
              inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)}
              disabled={busy || !codeSent} aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? 'auth-login-error' : undefined} required autoFocus={codeSent}
            />
          </div>
          {codeSent ? (
            <>
              <button className="auth-login-primary login-submit login-submit-centered" type="submit" disabled={busy}>
                {busy ? t('authFlow.verificationSubmitting') : t('authFlow.verifyAndContinue')}
              </button>
              <button className="auth-login-link" type="button" onClick={() => void sendVerificationCode()} disabled={busy}>
                {t('authFlow.resendCode')}
              </button>
            </>
          ) : (
            <button className="auth-login-primary login-submit login-submit-centered" type="button" onClick={() => void sendVerificationCode()} disabled={busy}>
              {busy ? t('authFlow.verificationSending') : t('authFlow.sendVerificationCode')}
            </button>
          )}
        </form>
      ) : null}

      {recoveryView === null && errorMessage ? <AuthLoginNotice id="auth-login-error">{errorMessage}</AuthLoginNotice> : null}
    </div>
  )
}
