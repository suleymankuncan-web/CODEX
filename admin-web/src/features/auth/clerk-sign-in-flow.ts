type ClerkSignInStatus =
  | 'needs_identifier'
  | 'needs_first_factor'
  | 'needs_second_factor'
  | 'needs_client_trust'
  | 'needs_new_password'
  | 'complete'

export type ClerkSignInView =
  | 'identifier'
  | 'password'
  | 'email-code'
  | 'complete'
  | 'unsupported'

export type ClerkSignInErrorKind = 'credentials' | 'verification' | 'generic'
export type ClerkFinalizeState = 'idle' | 'finalizing' | 'failed'
export type ClerkCompletionView = ClerkSignInView | 'finalizing' | 'finalize-failed'
export type ClerkAppSessionShellMode = 'setup-required' | 'verifying' | 'rejected' | 'ready'

export function resolveClerkAppSessionHandoffView(
  shellMode: ClerkAppSessionShellMode,
): 'verifying' | 'recover' {
  return shellMode === 'verifying' || shellMode === 'ready' ? 'verifying' : 'recover'
}

export async function restartClerkSignIn(input: {
  clearAppSession: () => Promise<void>
  signOutProvider: () => Promise<unknown>
}): Promise<'complete' | 'failed'> {
  try {
    await input.clearAppSession()
    await input.signOutProvider()
    return 'complete'
  } catch {
    return 'failed'
  }
}

type ClerkFinalizeOperation = (input: {
  navigate: (input: {
    session: { status: string; currentTask?: unknown }
  }) => void | Promise<unknown>
}) => Promise<{ error: unknown | null }>

export async function finalizeClerkSignIn(operation: ClerkFinalizeOperation): Promise<'active' | 'failed'> {
  let activeSessionObserved = false
  const result = await operation({
    navigate: ({ session }) => {
      activeSessionObserved = session.status === 'active' && !session.currentTask
    },
  })

  return !result.error && activeSessionObserved ? 'active' : 'failed'
}

export function readClerkErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined
  }

  if ('errors' in error && Array.isArray(error.errors)) {
    const [firstError] = error.errors
    if (firstError && typeof firstError === 'object' && 'code' in firstError && typeof firstError.code === 'string') {
      return firstError.code
    }
  }

  return 'code' in error && typeof error.code === 'string' ? error.code : undefined
}

export function resolveClerkCompletionView(
  view: ClerkSignInView,
  finalizeState: ClerkFinalizeState,
): ClerkCompletionView {
  if (view === 'complete' && finalizeState === 'failed') {
    return 'finalize-failed'
  }

  if (view === 'complete' && finalizeState === 'finalizing') {
    return 'finalizing'
  }

  return view
}

export function resolveClerkSignInView(input: {
  status: ClerkSignInStatus
  firstFactorStrategies: string[]
  secondFactorStrategies: string[]
}): ClerkSignInView {
  if (input.status === 'needs_identifier') {
    return 'identifier'
  }

  if (input.status === 'needs_first_factor') {
    return input.firstFactorStrategies.includes('password') ? 'password' : 'unsupported'
  }

  if (input.status === 'needs_second_factor' || input.status === 'needs_client_trust') {
    return input.secondFactorStrategies.includes('email_code') ? 'email-code' : 'unsupported'
  }

  if (input.status === 'complete') {
    return 'complete'
  }

  return 'unsupported'
}

export function resolveClerkSignInError(code: string | undefined): ClerkSignInErrorKind {
  if (code === 'form_identifier_not_found' || code === 'form_password_incorrect') {
    return 'credentials'
  }

  if (code === 'form_code_incorrect' || code === 'verification_failed') {
    return 'verification'
  }

  return 'generic'
}
