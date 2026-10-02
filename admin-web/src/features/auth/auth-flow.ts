import { createManagedBrowserSession } from '../../lib/api'
import type { AuthBootstrap } from './api'
import { sanitizeAuthReturnPath } from './return-path'
import { buildPushedAuthorizationLoginUrl } from './pushed-authorization'
import { BrowserLoginUnavailableError } from '../../lib/browser-login-error'

const DEFAULT_CALLBACK_PATH = '/auth/callback'
const DEFAULT_LOGOUT_PATH = '/auth/login'
const DEFAULT_RESPONSE_TYPE = 'code'
const DEFAULT_SCOPE = 'openid profile email'
const PKCE_STORAGE_KEY = 'store-ops-admin-pkce-login'
const PKCE_MAX_AGE_MS = 10 * 60 * 1000

export class UnavailablePkceLoginStateError extends Error {}

export function isDirectOidcLoginEnabled() {
  return import.meta.env.VITE_OIDC_AUTO_REDIRECT === 'true' &&
    import.meta.env.VITE_AUTH_PROVIDER?.trim().toLowerCase() === 'oidc'
}

type CallbackPayload = {
  accessToken: string
  code: string
  state: string | null
  returnTo: string | null
  error: string | null
  errorDescription: string | null
}

type PkceLoginState = {
  state: string
  codeVerifier: string
  returnTo: string | null
  createdAt: number
  authorizationExpiresAt?: number
}

type TokenResponse = {
  access_token?: unknown
  id_token?: unknown
}

export function hasProviderLoginConfig(bootstrap?: AuthBootstrap | null) {
  if (bootstrap) {
    return bootstrap.provider.configured
  }

  return Boolean(
    import.meta.env.VITE_OIDC_AUTHORIZATION_URL?.trim() &&
      import.meta.env.VITE_OIDC_CLIENT_ID?.trim(),
  )
}

export function isManualTokenCallbackAllowed() {
  return import.meta.env.DEV
}

export function clearManualTokenCallbackFromAddressBar() {
  if (typeof window === 'undefined') {
    return
  }

  window.history.replaceState(null, '', window.location.pathname)
}

export async function buildProviderLoginUrl(input?: {
  returnTo?: string
  bootstrap?: AuthBootstrap | null
}) {
  const authorizationUrl =
    input?.bootstrap?.provider.authorizationUrl ??
    import.meta.env.VITE_OIDC_AUTHORIZATION_URL?.trim()
  const clientId =
    input?.bootstrap?.provider.clientId ?? import.meta.env.VITE_OIDC_CLIENT_ID?.trim()

  if (!authorizationUrl || !clientId || typeof window === 'undefined') {
    return null
  }

  const url = new URL(authorizationUrl)
  const callbackUrl = resolveAbsoluteUrl(
    input?.bootstrap?.provider.callbackPath ?? import.meta.env.VITE_OIDC_CALLBACK_PATH,
    DEFAULT_CALLBACK_PATH,
  )
  const responseType =
    input?.bootstrap?.provider.responseType?.trim() ||
    import.meta.env.VITE_OIDC_RESPONSE_TYPE?.trim() ||
    DEFAULT_RESPONSE_TYPE
  const scope =
    input?.bootstrap?.provider.scope?.trim() ||
    import.meta.env.VITE_OIDC_SCOPE?.trim() ||
    DEFAULT_SCOPE
  const audience =
    input?.bootstrap?.provider.audience ?? import.meta.env.VITE_OIDC_AUDIENCE?.trim()
  const returnTo = sanitizeAuthReturnPath(input?.returnTo)

  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', callbackUrl)
  url.searchParams.set('response_type', responseType)
  url.searchParams.set('scope', scope)

  if (audience) {
    url.searchParams.set('audience', audience)
  }

  if (responseType === 'code') {
    const pkceState = await createPkceLoginState(returnTo)
    url.searchParams.set('state', pkceState.state)
    url.searchParams.set('code_challenge', pkceState.codeChallenge)
    url.searchParams.set('code_challenge_method', 'S256')
  } else if (returnTo) {
    url.searchParams.set('state', returnTo)
  }

  if (import.meta.env.VITE_OIDC_PAR_ENABLED === 'true') {
    const pushed = await buildPushedAuthorizationLoginUrl(url)
    // A slower request must not navigate using a superseded same-tab verifier.
    const pkceState = readPkceLoginState(url.searchParams.get('state'))
    savePkceLoginState({
      ...pkceState, authorizationExpiresAt: pushed.expiresAt,
    })
    return pushed.url
  }
  return url.toString()
}

export function buildProviderLogoutUrl(input?: {
  bootstrap?: AuthBootstrap | null
  idToken?: string | null
}) {
  const logoutUrl =
    input?.bootstrap?.provider.logoutUrl ?? import.meta.env.VITE_OIDC_LOGOUT_URL?.trim()
  const clientId =
    input?.bootstrap?.provider.clientId ?? import.meta.env.VITE_OIDC_CLIENT_ID?.trim()

  if (!logoutUrl || typeof window === 'undefined') {
    return null
  }

  const url = new URL(logoutUrl)
  const postLogoutUrl = resolveAbsoluteUrl(
    input?.bootstrap?.provider.postLogoutRedirectPath ??
      import.meta.env.VITE_POST_LOGOUT_REDIRECT_PATH,
    DEFAULT_LOGOUT_PATH,
  )

  url.searchParams.set('post_logout_redirect_uri', postLogoutUrl)

  const idToken = input?.idToken?.trim()
  if (idToken) {
    url.searchParams.set('id_token_hint', idToken)
  }

  if (clientId) {
    url.searchParams.set('client_id', clientId)
  }

  return url.toString()
}

export function readCallbackPayload(input: {
  search: string
  hash: string
}): CallbackPayload {
  const searchParams = new URLSearchParams(input.search)
  const hashParams = new URLSearchParams(input.hash.startsWith('#') ? input.hash.slice(1) : input.hash)

  const accessToken =
    searchParams.get('access_token') ??
    hashParams.get('access_token') ??
    searchParams.get('token') ??
    hashParams.get('token') ??
    ''

  const error = searchParams.get('error') ?? hashParams.get('error')
  const errorDescription =
    searchParams.get('error_description') ?? hashParams.get('error_description')
  const code = searchParams.get('code') ?? hashParams.get('code') ?? ''
  const state = searchParams.get('state') ?? hashParams.get('state')
  const returnTo = sanitizeAuthReturnPath(
    searchParams.get('returnTo') ??
      hashParams.get('returnTo') ??
      searchParams.get('state') ??
      hashParams.get('state'),
  )

  return {
    accessToken,
    code,
    state,
    returnTo,
    error,
    errorDescription,
  }
}

export async function exchangeAuthorizationCodeForToken(input: {
  code: string
  state: string | null
  bootstrap?: AuthBootstrap | null
}) {
  const tokenUrl =
    input.bootstrap?.provider.tokenUrl ?? import.meta.env.VITE_OIDC_TOKEN_URL?.trim()
  const clientId =
    input.bootstrap?.provider.clientId ?? import.meta.env.VITE_OIDC_CLIENT_ID?.trim()

  if (!tokenUrl || !clientId) {
    throw new Error('PKCE token endpoint is not configured')
  }

  const pkceState = readPkceLoginState(input.state)
  const callbackUrl = resolveAbsoluteUrl(
    input.bootstrap?.provider.callbackPath ?? import.meta.env.VITE_OIDC_CALLBACK_PATH,
    DEFAULT_CALLBACK_PATH,
  )
  if (input.bootstrap?.provider.managedBrowserSession) {
    const browserSession = await createManagedBrowserSession({ code: input.code, state: pkceState.state,
      codeVerifier: pkceState.codeVerifier, redirectUri: callbackUrl })
    clearPkceLoginState()
    return { accessToken: '', idToken: null, browserSession, returnTo: pkceState.returnTo ?? '/' }
  }
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code: input.code,
    redirect_uri: callbackUrl,
    code_verifier: pkceState.codeVerifier,
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!response.ok) {
    throw new Error(`Token exchange failed with status ${response.status}`)
  }

  const payload = (await response.json()) as TokenResponse
  const accessToken =
    typeof payload.access_token === 'string' ? payload.access_token.trim() : ''
  const idToken = typeof payload.id_token === 'string' ? payload.id_token.trim() : null

  if (!accessToken) {
    throw new Error('Token endpoint did not return an access_token')
  }

  clearPkceLoginState()
  return {
    accessToken,
    idToken,
    browserSession: null,
    returnTo: pkceState.returnTo ?? '/',
  }
}

export async function buildRestartLoginUrl(bootstrap: AuthBootstrap, state: string | null) {
  let returnTo: string | undefined
  try { returnTo = readPkceLoginState(state).returnTo ?? undefined } catch { /* Start a new bounded login attempt. */ }
  return buildProviderLoginUrl({ bootstrap, ...(returnTo ? { returnTo } : {}) })
}

export function readPendingLoginReturnPath() {
  try {
    const raw = window.sessionStorage.getItem(PKCE_STORAGE_KEY)
    if (!raw) return null
    const stored: unknown = JSON.parse(raw)
    if (!stored || typeof stored !== 'object' || !('state' in stored) ||
      typeof stored.state !== 'string') return null
    // Recover only the destination of a valid same-tab attempt. A fresh login
    // still creates its own verifier and state, even after a native-page refresh.
    return readPkceLoginState(stored.state).returnTo
  } catch {
    return null
  }
}

async function createPkceLoginState(returnTo: string | null) {
  if (typeof window === 'undefined') {
    throw new Error('PKCE login requires a browser session')
  }

  const codeVerifier = generateRandomString(32)
  const state = generateRandomString(24)
  const codeChallenge = await createCodeChallenge(codeVerifier)
  const storageValue: PkceLoginState = {
    state,
    codeVerifier,
    returnTo,
    createdAt: Date.now(),
  }

  savePkceLoginState(storageValue)

  return {
    state,
    codeChallenge,
  }
}

function savePkceLoginState(storageValue: PkceLoginState) {
  try {
    window.sessionStorage.setItem(PKCE_STORAGE_KEY, JSON.stringify(storageValue))
  } catch {
    throw new BrowserLoginUnavailableError('storage')
  }
}

function clearPkceLoginState() {
  try {
    window.sessionStorage.removeItem(PKCE_STORAGE_KEY)
  } catch {
    throw new BrowserLoginUnavailableError('storage')
  }
}

function readPkceLoginState(state: string | null): PkceLoginState {
  if (typeof window === 'undefined') {
    throw new Error('PKCE callback requires a browser session')
  }

  let raw: string | null
  try {
    raw = window.sessionStorage.getItem(PKCE_STORAGE_KEY)
  } catch {
    throw new BrowserLoginUnavailableError('storage')
  }
  if (!raw) {
    throw new UnavailablePkceLoginStateError('PKCE login state is missing')
  }
  if (!state) {
    throw new Error('PKCE login state is invalid')
  }

  let parsed: Partial<PkceLoginState>
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid state')
    parsed = value as Partial<PkceLoginState>
  } catch {
    throw new Error('PKCE login state is invalid')
  }

  if (
    parsed.state !== state ||
    typeof parsed.codeVerifier !== 'string' ||
    !parsed.codeVerifier.trim()
  ) {
    throw new Error('PKCE login state is invalid')
  }

  if (typeof parsed.createdAt !== 'number' || !Number.isFinite(parsed.createdAt) || Date.now() < parsed.createdAt) {
    throw new Error('PKCE login state is invalid')
  }
  if (Date.now() - parsed.createdAt > PKCE_MAX_AGE_MS) {
    throw new UnavailablePkceLoginStateError('PKCE login state expired')
  }

  return {
    state: parsed.state,
    codeVerifier: parsed.codeVerifier,
    returnTo: sanitizeAuthReturnPath(parsed.returnTo),
    createdAt: parsed.createdAt,
  }
}

async function createCodeChallenge(codeVerifier: string) {
  if (!window.crypto.subtle) {
    throw new Error('PKCE requires Web Crypto support')
  }

  const digest = await window.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(codeVerifier),
  )

  return base64UrlEncode(new Uint8Array(digest))
}

function generateRandomString(byteLength: number) {
  const bytes = new Uint8Array(byteLength)
  window.crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

function base64UrlEncode(bytes: Uint8Array) {
  let value = ''
  bytes.forEach((byte) => {
    value += String.fromCharCode(byte)
  })

  return window
    .btoa(value)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function resolveAbsoluteUrl(input: string | undefined, fallbackPath: string) {
  if (typeof window === 'undefined') {
    return fallbackPath
  }

  const value = input?.trim() || fallbackPath
  return new URL(value, window.location.origin).toString()
}
