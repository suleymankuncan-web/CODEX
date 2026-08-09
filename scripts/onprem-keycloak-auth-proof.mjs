import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { request as httpsRequest } from 'node:https'
import { fileURLToPath } from 'node:url'

let trustedCa = null

const PERSONAS = new Map([
  ['onprem.store-manager', { role: 'STORE_MANAGER', scope: 'store' }],
  ['onprem.region-manager', { role: 'REGION_MANAGER', scope: 'region' }],
  ['onprem.report-viewer', { role: 'REPORT_VIEWER', scope: 'company' }],
  ['onprem.store-personnel', { role: 'STORE_PERSONNEL', scope: 'store' }],
  ['onprem.visual-merchandiser', { role: 'VISUAL_MERCHANDISER', scope: 'store' }],
])

function parseArgs(argv) {
  const options = { host: 'onprem-proof.example.invalid', accountsFile: '' }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--host') options.host = argv[++index]
    else if (arg === '--accounts-file') options.accountsFile = argv[++index]
    else if (arg === '--ca-file') options.caFile = argv[++index]
    else throw new Error(`unknown argument: ${arg}`)
  }
  if (!options.host || !options.accountsFile || !options.caFile) throw new Error('--host, --accounts-file, and --ca-file are required')
  return options
}

function readAccounts(path) {
  const accounts = new Map()
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const fields = line.split('|')
    const [accountKey, username, password] = fields
    if (!accountKey || !username || !password) throw new Error('synthetic account contract is malformed')
    if (!PERSONAS.has(accountKey) || username !== accountKey) throw new Error('unexpected synthetic persona')
    if (accounts.has(accountKey)) throw new Error('duplicate synthetic persona')
    const providerReadStoreIds = String(fields[10] ?? '').split(',').map((value) => value.trim()).filter(Boolean)
    accounts.set(accountKey, {
      accountKey,
      username,
      password,
      providerClaims: { readStoreIds: providerReadStoreIds },
      overbroadReadStoreClaims: providerReadStoreIds.includes('store-999'),
      ...PERSONAS.get(accountKey),
    })
  }
  if (accounts.size !== PERSONAS.size || [...PERSONAS.keys()].some((key) => !accounts.has(key))) {
    throw new Error('all five synthetic personas are required')
  }
  return [...accounts.values()]
}

function base64url(value) {
  return Buffer.from(value).toString('base64url')
}

function cookieJar() {
  const values = new Map()
  return {
    ingest(headers) {
      for (const value of headers ?? []) {
        const first = value.split(';', 1)[0]
        const separator = first.indexOf('=')
        if (separator < 1) continue
        const name = first.slice(0, separator)
        const cookieValue = first.slice(separator + 1)
        if (/max-age=0|expires=Thu, 01 Jan 1970/i.test(value) || cookieValue === '') values.delete(name)
        else values.set(name, cookieValue)
      }
    },
    header() {
      return [...values].map(([name, value]) => `${name}=${value}`).join('; ')
    },
    snapshot() {
      return new Map(values)
    },
  }
}

function setCookieHeaders(headers) {
  const value = headers?.['set-cookie']
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

function cookieHeaderFor(headers, name) {
  return setCookieHeaders(headers).find((value) => value.startsWith(`${name}=`)) ?? null
}

function assertCookieHeaderContract(header, { name, httpOnly, clearing = false }) {
  if (!header) throw new Error(`${name} cookie header was not returned`)
  if (!/(?:^|;\s*)Secure(?:;|$)/i.test(header)) throw new Error(`${name} cookie is not Secure`)
  if (!/(?:^|;\s*)SameSite=(?:Lax|Strict)(?:;|$)/i.test(header)) throw new Error(`${name} cookie SameSite policy is missing`)
  if (!/(?:^|;\s*)Path=\/(?:;|$)/i.test(header)) throw new Error(`${name} cookie path is not host-wide`)
  if (/(?:^|;\s*)Domain=/i.test(header)) throw new Error(`${name} cookie must remain host-only`)
  if (httpOnly && !/(?:^|;\s*)HttpOnly(?:;|$)/i.test(header)) throw new Error(`${name} cookie is not HttpOnly`)
  if (!httpOnly && /(?:^|;\s*)HttpOnly(?:;|$)/i.test(header)) throw new Error(`${name} cookie must remain readable for CSRF`)
  if (clearing && !/(?:^|;\s*)Max-Age=0(?:;|$)/i.test(header) && !/Expires=Thu, 01 Jan 1970/i.test(header)) {
    throw new Error(`${name} cookie clearing response did not expire the cookie`)
  }
  return {
    secure: true,
    httpOnly,
    sameSite: header.match(/(?:^|;\s*)SameSite=([^;]+)/i)?.[1] ?? null,
    hostOnly: true,
    cleared: clearing,
  }
}

function assertBrowserSessionCookieContract(headers) {
  const session = assertCookieHeaderContract(cookieHeaderFor(headers, 'hr_axis_browser_session'), {
    name: 'hr_axis_browser_session',
    httpOnly: true,
  })
  return { session }
}

function assertBrowserSessionClearContract(headers) {
  const session = assertCookieHeaderContract(cookieHeaderFor(headers, 'hr_axis_browser_session'), {
    name: 'hr_axis_browser_session',
    httpOnly: true,
    clearing: true,
  })
  const csrf = assertCookieHeaderContract(cookieHeaderFor(headers, 'hr_axis_csrf_nonce'), {
    name: 'hr_axis_csrf_nonce',
    httpOnly: false,
    clearing: true,
  })
  return { session, csrf }
}

function requestRaw(host, path, { method = 'GET', headers = {}, body = '', jar } = {}) {
  return new Promise((resolve, reject) => {
    const request = httpsRequest({
      hostname: '127.0.0.1',
      port: 443,
      servername: host,
      path,
      method,
      ca: trustedCa,
      rejectUnauthorized: true,
      headers: {
        Host: host,
        Connection: 'close',
        ...headers,
        ...(jar?.header() ? { Cookie: jar.header() } : {}),
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
    }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => {
        jar?.ingest(response.headers['set-cookie'])
        resolve({
          status: response.statusCode ?? 0,
          headers: response.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        })
      })
    })
    request.on('error', reject)
    if (body) request.write(body)
    request.end()
  })
}

async function requestFollow(host, path, options = {}, limit = 8) {
  let current = path
  let response
  const history = []
  for (let index = 0; index <= limit; index += 1) {
    response = await requestRaw(host, current, options)
    history.push({ status: response.status, location: response.headers.location ?? null })
    if (![301, 302, 303, 307, 308].includes(response.status) || !response.headers.location) {
      return { ...response, history, finalPath: current }
    }
    const next = new URL(response.headers.location, `https://${host}`)
    if (next.protocol !== 'https:' || next.hostname !== host) throw new Error('OIDC redirect escaped the approved local host')
    current = `${next.pathname}${next.search}`
    const browserGetRedirect = [301, 302, 303].includes(response.status)
    options = { ...options, method: browserGetRedirect ? 'GET' : options.method, body: browserGetRedirect ? '' : options.body }
  }
  throw new Error('OIDC redirect chain exceeded the bounded limit')
}

function hiddenFormFields(html) {
  const fields = {}
  for (const match of html.matchAll(/<input\b[^>]*>/gi)) {
    const input = match[0]
    if (!/type\s*=\s*["']hidden["']/i.test(input)) continue
    const name = input.match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1]
    if (!name) continue
    fields[name] = decodeHtmlAttribute(input.match(/\bvalue\s*=\s*["']([^"']*)["']/i)?.[1] ?? '')
  }
  return fields
}

function decodeHtmlAttribute(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&#x2F;', '/')
    .replaceAll('&#47;', '/')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

async function loginPersona(host, account) {
  const jar = cookieJar()
  const verifier = base64url(requireRandom(32))
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const state = base64url(requireRandom(24))
  const redirectUri = `https://${host}/auth/callback`
  const authorizationPath = `/realms/store-ops/protocol/openid-connect/auth?${new URLSearchParams({
    client_id: 'store-ops-admin-web',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email roles',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })}`
  const loginPage = await requestRaw(host, authorizationPath, { jar })
  if (loginPage.status !== 200) throw new Error(`authorization endpoint returned ${loginPage.status}`)
  const formAction = loginPage.body.match(/<form\b[^>]*action\s*=\s*["']([^"']+)["']/i)?.[1]
  const decodedFormAction = formAction ? decodeHtmlAttribute(formAction) : ''
  if (!decodedFormAction) throw new Error('Keycloak login form was not rendered')
  const form = new URLSearchParams({ ...hiddenFormFields(loginPage.body), username: account.username, password: account.password })
  const loginUrl = new URL(decodedFormAction, `https://${host}`)
  if (loginUrl.protocol !== 'https:' || loginUrl.hostname !== host) throw new Error('Keycloak login form action escaped the approved local host')
  const loginResult = await requestFollow(host, `${loginUrl.pathname}${loginUrl.search}`, {
    method: 'POST',
    headers: { Accept: 'text/html', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    jar,
  })
  const codeLocation = loginResult.history.map((entry) => entry.location).find((location) => location && location.includes('code='))
  if (!codeLocation) throw new Error(`Keycloak login did not return an authorization code for ${account.accountKey}`)
  const callback = new URL(codeLocation, `https://${host}`)
  if (callback.searchParams.get('state') !== state) throw new Error('OIDC state did not round-trip')
  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: 'store-ops-admin-web',
    code: callback.searchParams.get('code'),
    redirect_uri: redirectUri,
    code_verifier: verifier,
  }).toString()
  const tokenResponse = await requestRaw(host, '/realms/store-ops/protocol/openid-connect/token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody,
  })
  if (tokenResponse.status !== 200) throw new Error(`OIDC token exchange returned ${tokenResponse.status}`)
  const tokenPayload = JSON.parse(tokenResponse.body)
  const token = tokenPayload.access_token
  if (typeof token !== 'string' || !token) throw new Error('OIDC token response omitted access_token')
  // The browser-session policy keeps access/refresh/ID tokens in memory only;
  // the proof never persists or forwards an ID-token hint during logout.
  return { token, jar }
}

function requireRandom(length) {
  return randomBytes(length)
}

async function createBrowserSession(host, token) {
  const jar = cookieJar()
  const response = await requestRaw(host, '/api/auth/browser-session', {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    jar,
  })
  if (response.status !== 201 && response.status !== 200) throw new Error(`browser-session creation returned ${response.status}`)
  const body = JSON.parse(response.body)
  if (typeof body.csrfToken !== 'string' || !body.csrfToken) throw new Error('browser-session response omitted CSRF nonce')
  const cookieContract = assertBrowserSessionCookieContract(response.headers)
  return { jar, csrfToken: body.csrfToken, sessionCookie: jar.header(), cookieContract }
}

async function jsonRequest(host, path, options = {}) {
  const response = await requestRaw(host, path, options)
  let body = null
  try { body = JSON.parse(response.body) } catch { /* sanitized status-only assertions */ }
  return { ...response, json: body }
}

async function assertPublicAdminDenials(host) {
  const paths = ['/admin', '/admin/', '/admin/master/console/', '/auth/admin', '/auth/admin/realms/master/console/']
  const statuses = {}
  for (const path of paths) {
    const response = await requestRaw(host, path, { headers: { Accept: 'application/json' } })
    statuses[path] = response.status
    if (![403, 404].includes(response.status)) throw new Error(`public Keycloak admin path was not denied: ${path} (${response.status})`)
    if (response.headers.location) throw new Error(`public Keycloak admin path redirected: ${path}`)
  }
  return { paths, statuses, allDenied: true }
}

function expectedDiscovery(host) {
  const origin = `https://${host}`
  const realm = `${origin}/realms/store-ops`
  return {
    issuer: realm,
    authorization_endpoint: `${realm}/protocol/openid-connect/auth`,
    token_endpoint: `${realm}/protocol/openid-connect/token`,
    end_session_endpoint: `${realm}/protocol/openid-connect/logout`,
    jwks_uri: `${realm}/protocol/openid-connect/certs`,
  }
}

function assertDiscovery(host, discovery) {
  const expected = expectedDiscovery(host)
  for (const field of Object.keys(expected)) {
    if (discovery?.[field] !== expected[field]) throw new Error(`OIDC discovery ${field} mismatch`)
  }
  return {
    issuerMatches: true,
    authorizationEndpointMatches: true,
    tokenEndpointMatches: true,
    logoutEndpointMatches: true,
    jwksEndpointMatches: true,
  }
}

function forgeJwt({ host, kid, claims }) {
  const { privateKey } = forgeJwt.keyPair ??= generateKeyPairSync('rsa', { modulusLength: 2048 })
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }))
  const payload = base64url(JSON.stringify({
    iss: `https://${host}/realms/store-ops`,
    aud: 'store-ops-admin-web',
    exp: Math.floor(Date.now() / 1000) + 300,
    ...claims,
  }))
  const signingInput = `${header}.${payload}`
  const signature = sign('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url')
  return `${signingInput}.${signature}`
}

async function endSessionLogout(host, jar) {
  const logoutQuery = new URLSearchParams({
    client_id: 'store-ops-admin-web',
    post_logout_redirect_uri: `https://${host}/auth/login`,
  })
  let response = await requestFollow(host, `/realms/store-ops/protocol/openid-connect/logout?${logoutQuery}`, { jar })
  const returnedToLogin = () => response.history.some(({ location }) => {
    if (!location) return false
    try { return new URL(location, `https://${host}`).pathname === '/auth/login' } catch { return false }
  }) || response.finalPath === '/auth/login'
  if (returnedToLogin()) return response
  if (response.status === 200 && /<form\b/i.test(response.body)) {
    const formAction = response.body.match(/<form\b[^>]*action\s*=\s*["']([^"']+)["']/i)?.[1]
    if (!formAction) throw new Error('Keycloak logout confirmation form was not rendered')
    const actionUrl = new URL(decodeHtmlAttribute(formAction), `https://${host}`)
    if (actionUrl.protocol !== 'https:' || actionUrl.hostname !== host) throw new Error('Keycloak logout form action escaped the approved local host')
    const fields = hiddenFormFields(response.body)
    fields.confirmLogout = fields.confirmLogout || 'true'
    response = await requestFollow(host, `${actionUrl.pathname}${actionUrl.search}`, {
      method: 'POST',
      headers: { Accept: 'text/html', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
      jar,
    })
  }
  return response
}

function assertApprovedLogoutResponse(response, host) {
  if (response.finalPath !== '/auth/login') return false
  const approvedOrigin = `https://${host}`
  const loginLocations = response.history
    .map(({ location }) => location)
    .filter(Boolean)
    .filter((location) => {
      try {
        const url = new URL(location, approvedOrigin)
        return url.origin === approvedOrigin && url.pathname === '/auth/login'
          && url.search === '' && url.hash === ''
      } catch {
        return false
      }
    })
  return loginLocations.length > 0
}

async function assertUnallowlistedLogoutRejected(host, jar) {
  const query = new URLSearchParams({
    client_id: 'store-ops-admin-web',
    post_logout_redirect_uri: `https://${host}/auth/not-allowlisted`,
  })
  const response = await requestRaw(host, `/realms/store-ops/protocol/openid-connect/logout?${query}`, { jar })
  if (![400, 403].includes(response.status)) throw new Error(`unallowlisted post-logout redirect was accepted (${response.status})`)
  if (response.headers.location) {
    const location = new URL(response.headers.location, `https://${host}`)
    if (location.protocol !== 'https:' || location.hostname !== host) throw new Error('unallowlisted logout redirect escaped the approved local host')
  }
  return response.status
}

function assertSession(session, account) {
  const roles = session?.json?.user?.roleCodes ?? []
  if (!roles.includes(account.role)) throw new Error(`${account.accountKey} session role mismatch`)
  const readScope = session?.json?.user?.readScope ?? {}
  if (account.scope === 'store' && !readScope.storeIds?.includes('00000000-0000-0000-0000-000000000100')) throw new Error(`${account.accountKey} store read scope mismatch`)
  if (account.scope === 'region' && !readScope.regionIds?.includes('00000000-0000-0000-0000-000000000010')) throw new Error(`${account.accountKey} region read scope mismatch`)
  if (account.scope === 'company' && !readScope.companyIds?.includes('00000000-0000-0000-0000-000000000001')) throw new Error(`${account.accountKey} company read scope mismatch`)
}

async function run(options) {
  trustedCa = readFileSync(options.caFile)
  const accounts = readAccounts(options.accountsFile)
  const discoveryResponse = await jsonRequest(options.host, '/realms/store-ops/.well-known/openid-configuration')
  if (discoveryResponse.status !== 200 || !discoveryResponse.json) throw new Error('OIDC discovery endpoint did not return JSON')
  const discovery = assertDiscovery(options.host, discoveryResponse.json)
  const jwks = await jsonRequest(options.host, '/realms/store-ops/protocol/openid-connect/certs')
  if (jwks.status !== 200 || !Array.isArray(jwks.json?.keys) || jwks.json.keys.length < 1) throw new Error('JWKS endpoint did not return keys')
  const publicAdminDenials = await assertPublicAdminDenials(options.host)
  const overbroadAccounts = accounts.filter(({ overbroadReadStoreClaims }) => overbroadReadStoreClaims)
  if (overbroadAccounts.length !== 1) throw new Error('exactly one synthetic persona with provider-signed overbroad read claims is required')
  const personaResults = []
  let expectedActionCountAfterAll = null
  for (const account of accounts) {
    const { token, jar: oidcJar } = await loginPersona(options.host, account)
    const browser = await createBrowserSession(options.host, token)
    const session = await jsonRequest(options.host, '/api/auth/session', { headers: { Accept: 'application/json' }, jar: browser.jar })
    if (session.status !== 200) throw new Error(`${account.accountKey} session endpoint returned ${session.status}`)
    assertSession(session, account)
    const assignedBody = JSON.stringify({
      storeId: '00000000-0000-0000-0000-000000000100',
      requestMonth: '2026-08-01',
      targetLabel: `synthetic-onprem-proof-${account.accountKey}`,
      totalTargetValue: 1,
      allocations: [{ employeeId: '00000000-0000-0000-0000-000000000201', assigneeLabel: 'synthetic', targetValue: 1 }],
    })
    const csrfDenied = await jsonRequest(options.host, '/api/target-distributions/requests', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: assignedBody, jar: browser.jar,
    })
    if (csrfDenied.status !== 403) throw new Error(`${account.accountKey} missing-CSRF request returned ${csrfDenied.status}`)
    const csrfRecovery = await jsonRequest(options.host, '/api/auth/browser-session/csrf', {
      method: 'POST', headers: { Accept: 'application/json', Origin: `https://${options.host}`, 'Sec-Fetch-Site': 'same-origin' }, jar: browser.jar,
    })
    if (csrfRecovery.status !== 200) throw new Error(`${account.accountKey} CSRF recovery returned ${csrfRecovery.status}`)
    const deniedStoreId = account.scope === 'store'
      ? '00000000-0000-0000-0000-000000000999'
      : '00000000-0000-0000-0000-000000000100'
    const scopeDenied = await jsonRequest(options.host, `/api/target-distributions/store-personnel?storeId=${deniedStoreId}`, {
      headers: { Accept: 'application/json' }, jar: browser.jar,
    })
    if (scopeDenied.status !== 403) throw new Error(`${account.accountKey} cross-scope/action request returned ${scopeDenied.status}`)
    const providerSignedOverbroadClaims = account.overbroadReadStoreClaims
      ? { accountKey: account.accountKey, claimStoreIds: account.providerClaims.readStoreIds, dbDeniedStatus: scopeDenied.status, subordinateToDbAuthorization: scopeDenied.status === 403 }
      : null
    if (account.overbroadReadStoreClaims && scopeDenied.status !== 403) throw new Error(`${account.accountKey} provider-signed overbroad claim bypassed DB authorization`)
    let assignedActionStatus = null
    let unassignedActionStatus = null
    let actionDeniedStatus = null
    let actionCountBefore = null
    let actionCountAfter = null
    if (account.accountKey === 'onprem.store-manager') {
      const listPath = '/api/target-distributions/requests?storeId=00000000-0000-0000-0000-000000000100&requestMonth=2026-08-01'
      const listBefore = await jsonRequest(options.host, listPath, { headers: { Accept: 'application/json' }, jar: browser.jar })
      if (listBefore.status !== 200) throw new Error(`assigned action baseline returned ${listBefore.status}`)
      actionCountBefore = Number(listBefore.json?.meta?.total ?? 0)
      const assigned = await jsonRequest(options.host, '/api/target-distributions/requests', {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrfRecovery.json.csrfToken }, body: assignedBody, jar: browser.jar,
      })
      assignedActionStatus = assigned.status
      if (assigned.status < 200 || assigned.status >= 300) throw new Error(`assigned action returned ${assigned.status}`)
      const listAfter = await jsonRequest(options.host, listPath, { headers: { Accept: 'application/json' }, jar: browser.jar })
      if (listAfter.status !== 200) throw new Error(`assigned action verification returned ${listAfter.status}`)
      actionCountAfter = Number(listAfter.json?.meta?.total ?? 0)
      if (actionCountAfter !== actionCountBefore + 1) throw new Error('assigned action did not create exactly one synthetic request')
      expectedActionCountAfterAll = actionCountAfter
      const unassigned = await jsonRequest(options.host, '/api/target-distributions/requests', {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrfRecovery.json.csrfToken }, body: assignedBody.replaceAll('000000000100', '000000000999'), jar: browser.jar,
      })
      unassignedActionStatus = unassigned.status
      if (unassigned.status !== 403) throw new Error(`unassigned action returned ${unassigned.status}`)
      const listAfterDenied = await jsonRequest(options.host, listPath, { headers: { Accept: 'application/json' }, jar: browser.jar })
      if (Number(listAfterDenied.json?.meta?.total ?? 0) !== actionCountAfter) throw new Error('unassigned action changed the request count')
    } else {
      const actionDenied = await jsonRequest(options.host, '/api/target-distributions/requests', {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrfRecovery.json.csrfToken }, body: assignedBody, jar: browser.jar,
      })
      actionDeniedStatus = actionDenied.status
      if (actionDenied.status !== 403) throw new Error(`${account.accountKey} role/action scope denial returned ${actionDenied.status}`)
    }
    const cookie = browser.sessionCookie
    const logout = await jsonRequest(options.host, '/api/auth/browser-session', { method: 'DELETE', headers: { Accept: 'application/json' }, jar: browser.jar })
    if (logout.status !== 200) throw new Error(`${account.accountKey} logout returned ${logout.status}`)
    const clearCookieContract = assertBrowserSessionClearContract(logout.headers)
    if (browser.jar.header()) throw new Error(`${account.accountKey} logout did not clear browser cookie state`)
    const afterLogout = await jsonRequest(options.host, '/api/auth/session', { headers: { Accept: 'application/json', Cookie: cookie } })
    if (![401, 403].includes(afterLogout.status)) throw new Error(`${account.accountKey} logout did not invalidate the session`)
    const realmLogout = await endSessionLogout(options.host, oidcJar)
    const returnedToLogin = assertApprovedLogoutResponse(realmLogout, options.host)
    if (![200, 204].includes(realmLogout.status) || !returnedToLogin) throw new Error(`${account.accountKey} realm logout did not return to the approved login route`)
    const unallowlistedLogoutStatus = await assertUnallowlistedLogoutRejected(options.host, oidcJar)
    const reauthorize = await requestRaw(options.host, `/realms/store-ops/protocol/openid-connect/auth?${new URLSearchParams({
      client_id: 'store-ops-admin-web',
      redirect_uri: `https://${options.host}/auth/callback`,
      response_type: 'code',
      scope: 'openid profile email roles',
      state: base64url(requireRandom(24)),
      code_challenge: createHash('sha256').update(base64url(requireRandom(32))).digest('base64url'),
      code_challenge_method: 'S256',
    })}`, { jar: oidcJar })
    if (reauthorize.status !== 200 || !/<form\b/i.test(reauthorize.body)) throw new Error(`${account.accountKey} realm logout left an SSO session active`)
    personaResults.push({ accountKey: account.accountKey, role: account.role, sessionStatus: session.status, csrfDeniedStatus: csrfDenied.status, csrfRecoveryStatus: csrfRecovery.status, scopeDeniedStatus: scopeDenied.status, assignedActionStatus, unassignedActionStatus, actionDeniedStatus, actionCountBefore, actionCountAfter, logoutStatus: logout.status, realmLogoutStatus: realmLogout.status, unallowlistedLogoutStatus, reauthorizeRequiresCredentials: true, cookieContract: browser.cookieContract, clearCookieContract, providerSignedOverbroadClaims })
  }

  if (expectedActionCountAfterAll !== null) {
    const manager = accounts.find(({ accountKey }) => accountKey === 'onprem.store-manager')
    const { token: managerToken, jar: managerOidcJar } = await loginPersona(options.host, manager)
    const managerBrowser = await createBrowserSession(options.host, managerToken)
    const finalList = await jsonRequest(options.host, '/api/target-distributions/requests?storeId=00000000-0000-0000-0000-000000000100&requestMonth=2026-08-01', { headers: { Accept: 'application/json' }, jar: managerBrowser.jar })
    if (finalList.status !== 200 || Number(finalList.json?.meta?.total ?? 0) !== expectedActionCountAfterAll) throw new Error('denied persona actions changed the synthetic request count')
    await jsonRequest(options.host, '/api/auth/browser-session', { method: 'DELETE', headers: { Accept: 'application/json' }, jar: managerBrowser.jar })
    await endSessionLogout(options.host, managerOidcJar)
  }

  const invalidJwtCases = [
    ['unknown-key', { kid: 'synthetic-unknown-key', claims: { sub: 'synthetic-unknown-subject' } }],
    ['wrong-issuer', { kid: 'synthetic-wrong-issuer', claims: { iss: 'https://wrong-issuer.example.invalid/realms/store-ops', sub: 'synthetic-unknown-subject' } }],
    ['wrong-audience', { kid: 'synthetic-wrong-audience', claims: { aud: 'wrong-audience', sub: 'synthetic-unknown-subject' } }],
    ['wrong-role-scope', { kid: 'synthetic-wrong-role-scope', claims: { sub: 'synthetic-unknown-subject', roles: ['SUPER_ADMIN'], employee_id: ['outside'], company_ids: ['outside'], region_ids: ['outside'], store_ids: ['outside'] } }],
  ]
  const invalidJwtStatuses = {}
  for (const [name, input] of invalidJwtCases) {
    const token = forgeJwt({ host: options.host, ...input })
    const response = await jsonRequest(options.host, '/api/auth/browser-session', { method: 'POST', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } })
    invalidJwtStatuses[name] = response.status
    if (![401, 403].includes(response.status)) throw new Error(`${name} JWT was accepted (${response.status})`)
  }

  return {
    schemaVersion: 1,
    dataClass: 'synthetic',
    discovery: { status: discoveryResponse.status, ...discovery },
    jwks: { status: jwks.status, keyCount: jwks.json.keys.length, unknownKeyStatus: invalidJwtStatuses['unknown-key'] },
    publicAdminDenials,
    jwtRejections: invalidJwtStatuses,
    personas: {
      count: personaResults.length,
      sessionsVerified: personaResults.filter(({ sessionStatus }) => sessionStatus === 200).length,
      csrfMissingDenied: personaResults.filter(({ csrfDeniedStatus }) => csrfDeniedStatus === 403).length,
      csrfRecoverySucceeded: personaResults.filter(({ csrfRecoveryStatus }) => csrfRecoveryStatus === 200).length,
      crossScopeDenied: personaResults.filter(({ scopeDeniedStatus }) => scopeDeniedStatus === 403).length,
      authorizedMutationCount: personaResults.filter(({ assignedActionStatus }) => assignedActionStatus !== null && assignedActionStatus >= 200 && assignedActionStatus < 300).length,
      deniedMutationCount: personaResults.filter(({ unassignedActionStatus, actionDeniedStatus }) => unassignedActionStatus === 403 || actionDeniedStatus === 403).length,
      realmLogoutCount: personaResults.filter(({ realmLogoutStatus }) => [200, 204].includes(realmLogoutStatus)).length,
      unallowlistedLogoutRejectedCount: personaResults.filter(({ unallowlistedLogoutStatus }) => [400, 403].includes(unallowlistedLogoutStatus)).length,
      reauthorizeCredentialCount: personaResults.filter(({ reauthorizeRequiresCredentials }) => reauthorizeRequiresCredentials).length,
      secureHttpOnlySameSiteHostOnlyCookieCount: personaResults.filter(({ cookieContract }) => cookieContract?.session?.secure && cookieContract?.session?.httpOnly && cookieContract?.session?.hostOnly && cookieContract?.session?.sameSite).length,
      clearingCookieContractCount: personaResults.filter(({ clearCookieContract }) => clearCookieContract?.session?.cleared && clearCookieContract?.csrf?.cleared).length,
    },
    csrf: { missingHeaderStatus: 403, recoveryStatus: 200 },
    logout: { invalidated: true, realmEndSession: true, reauthorizeRequiresCredentials: true },
    scopeAuthorization: { crossScopeDenied: true, validCsrfMutationObserved: true, deniedActionWriteDelta: 0 },
    forgedClaimDefense: { deniedActionWriteDelta: 0 },
    providerSignedOverbroadClaims: {
      tested: true,
      accountKey: overbroadAccounts[0].accountKey,
      claimStoreIds: overbroadAccounts[0].providerClaims.readStoreIds,
      dbAuthorizationRemainedSubordinate: personaResults.some(({ providerSignedOverbroadClaims }) => providerSignedOverbroadClaims?.subordinateToDbAuthorization === true),
    },
    jwksRotation: {
      attempted: false,
      proved: false,
      status: 'unproven',
      activationGate: 'owner-approved fresh-Linux key rotation and retired-key rehearsal required',
    },
    noRawCredentials: true,
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    console.log(JSON.stringify(await run(parseArgs(process.argv.slice(2)))))
  } catch (error) {
    console.error(`on-prem Keycloak auth proof: ${error.message}`)
    process.exitCode = 1
  }
}

export {
  assertBrowserSessionClearContract,
  assertBrowserSessionCookieContract,
  assertPublicAdminDenials,
  assertSession,
  decodeHtmlAttribute,
  parseArgs,
  readAccounts,
  run as runKeycloakAuthProof,
}
