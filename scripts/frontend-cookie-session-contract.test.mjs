import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

const api = readText('admin-web/src/lib/api.ts')
const app = readText('admin-web/src/App.tsx')
const clerkSession = readText('admin-web/src/features/auth/clerk-session.tsx')
const sessionContext = readText('admin-web/src/features/session/session-context.tsx')
const sessionStorage = readText('admin-web/src/features/session/session-storage.ts')
const authLogoutPage = readText('admin-web/src/pages/AuthLogoutPage.tsx')

test('cookie browser sessions do not refresh before ordinary requests', () => {
  const cookieReturnMatch = /if \(isCookieBrowserSession\(session\)\) \{\s*return \{ session, headers \}\s*\}/.exec(api)
  const cookieReturnIndex = cookieReturnMatch?.index ?? -1
  const refreshIndex = api.indexOf('const refreshedHeaders = await prepareRefreshedHeaders')

  assert.ok(
    cookieReturnIndex >= 0 && refreshIndex > cookieReturnIndex,
    'cookie transport must use existing cookie headers and avoid recreating browser sessions before normal requests',
  )
})

test('unsafe cookie requests fail fast when CSRF memory is unavailable', () => {
  assert.match(
    api,
    /function assertBrowserSessionCsrfAvailable\(session: SessionState, path: string, method: JsonMethod\) \{[\s\S]*?!isUnsafeMethod\(method\)[\s\S]*?!isCookieBrowserSession\(session\)[\s\S]*?readBrowserSessionCsrfToken\(\)/,
    'unsafe cookie-session requests must check for the in-memory CSRF nonce before building request headers',
  )
  assert.match(
    api,
    /window\.dispatchEvent\([\s\S]*?new CustomEvent<SessionExpiredDetail>\(SESSION_EXPIRED_EVENT[\s\S]*?status: 401[\s\S]*?throw new ApiError\(401, message\)/,
    'missing CSRF memory must fail closed with a session-expired event and 401 ApiError',
  )
})

test('persisted cookie sessions are not ready without CSRF memory', () => {
  assert.match(
    sessionStorage,
    /if \(isCookieBrowserSession\(session\)\) \{[\s\S]*?return Boolean\(readBrowserSessionCsrfToken\(\)\)/,
    'cookie transport must block protected shell readiness after reload when the CSRF nonce is not in memory',
  )
})

test('Clerk refresh handler preserves bearer fallback token refresh', () => {
  assert.match(
    clerkSession,
    /await startProviderSession\(token\)[\s\S]*?return \{ refreshed: true, bearerToken: token \}/,
    'bearer transport rollback must return the refreshed Clerk token to the API refresh path',
  )
})

test('saving away from cookie transport clears the HttpOnly browser-session cookie', () => {
  assert.match(
    api,
    /export async function clearBrowserSessionCookie\(\) \{[\s\S]*?const response = await fetch[\s\S]*?if \(!response\.ok\) \{[\s\S]*?throw new ApiError[\s\S]*?\}[\s\S]*?writeBrowserSessionCsrfToken\(''\)[\s\S]*?clearClientBearerSession\(\)/,
    'clearing a browser-session cookie must preserve the CSRF nonce until the backend DELETE succeeds',
  )
  assert.match(
    sessionContext,
    /sessionRef\.current\.browserSessionTransport === 'cookie'[\s\S]*?!isCookieBrowserSession\(nextSession\)[\s\S]*?await clearBrowserSessionCookie\(\)/,
    'manual session changes from cookie transport must clear the backend browser-session cookie before saving the next client mode',
  )
  assert.match(
    sessionContext,
    /catch \(error\) \{[\s\S]*?clearClientBearerSession\(\)[\s\S]*?throw error/,
    'manual session changes from cookie transport must abort instead of saving a new client mode when cookie clearing fails',
  )
  assert.match(
    sessionContext,
    /const resetSession = useCallback\(async \(\) => \{[\s\S]*?await clearBrowserSessionCookie\(\)[\s\S]*?throw error[\s\S]*?setSession\(defaultSession\)/,
    'resetting from cookie transport must clear the backend browser-session cookie before saving the default client mode',
  )
  assert.match(
    sessionContext,
    /const clearProviderSession = useCallback\(async \(\) => \{[\s\S]*?await clearBrowserSessionCookie\(\)[\s\S]*?throw error[\s\S]*?setSession/,
    'provider logout must propagate backend browser-session cookie clearing failures before clearing local session state',
  )
  assert.match(
    authLogoutPage,
    /\.then\(\(\) => \{[\s\S]*?window\.location\.replace[\s\S]*?\.catch\(\(\) => \{[\s\S]*?setLogoutFailed\(true\)/,
    'logout flow must not redirect as if logout succeeded when backend cookie clearing fails',
  )
})

test('cookie shell sessions use a non-token cache key instead of the shared token-missing key', () => {
  assert.match(
    sessionStorage,
    /browserSessionKey: string/,
    'session state must carry a non-secret browser-session cache key',
  )
  assert.match(
    sessionContext,
    /browserSessionKey: createBrowserSessionCacheKey\(\)/,
    'cookie provider sessions must rotate the cache key after browser-session creation',
  )
  assert.match(
    app,
    /const shellBearerSessionKey = isCookieBrowserSession\(session\) \? cookieSessionKey : bearerSessionKey[\s\S]*?shellBearerSessionKey/,
    'shell auth query key must distinguish cookie session identities without using a bearer token',
  )
})
