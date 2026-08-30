import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { assertAccessTokenContract, assertBrowserSessionClearContract, assertBrowserSessionCookieContract, buildAuthorizationRequest, classifyAuthorizationEntryFailure, classifyBrowserSessionCreateFailure, classifyLoginCodeFailure, classifyRealmLogoutFailure, configureAuthorizationClient, createBrowserSession, decodeHtmlAttribute, jsonRequest, loginPersona, parseArgs, readAccounts, readPhotoProofAccount, requestRaw, resolveAuthorizationTransport } from './onprem-keycloak-auth-proof.mjs'

const rows = [
  'onprem.store-manager|onprem.store-manager|synthetic-password-store-manager',
  'onprem.region-manager|onprem.region-manager|synthetic-password-region-manager',
  'onprem.report-viewer|onprem.report-viewer|synthetic-password-report-viewer',
  'onprem.store-personnel|onprem.store-personnel|synthetic-password-store-personnel',
  'onprem.visual-merchandiser|onprem.visual-merchandiser|synthetic-password-visual-merchandiser',
]

test('Keycloak auth proof requires the exact five synthetic personas and CA file', () => {
  const directory = mkdtempSync(join(tmpdir(), 'onprem-keycloak-auth-proof-'))
  const path = join(directory, 'accounts')
  try {
    writeFileSync(path, `${rows.join('\n')}\n`)
    const accounts = readAccounts(path)
    assert.equal(accounts.length, 5)
    assert.deepEqual(accounts.map((account) => account.scope), ['store', 'store', 'company', 'store', 'store'])
    assert.throws(() => parseArgs(['--host', 'onprem-proof.example.invalid', '--accounts-file', path]), /ca-file/)
    assert.deepEqual(parseArgs(['--host', 'onprem-proof.example.invalid', '--accounts-file', path, '--ca-file', 'ca.crt']), {
      host: 'onprem-proof.example.invalid',
      accountsFile: path,
      caFile: 'ca.crt',
      connectHost: '127.0.0.1',
      connectPort: 443,
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Keycloak auth proof exposes only bounded reusable OIDC/BFF helpers and the exact separate photo account contract', () => {
  const directory = mkdtempSync(join(tmpdir(), 'onprem-keycloak-photo-account-'))
  const accountPath = join(directory, 'photo-account')
  const caPath = join(directory, 'ca.crt')
  try {
    writeFileSync(accountPath, 'onprem.photo-proof-admin|onprem.photo-proof-admin|synthetic-photo-proof-password-0123456789-abcdef|SUPER_ADMIN|synthetic-employee-photo-proof-admin|company-001|region-001|store-100|company-001|region-001|store-100|store-100\n')
    writeFileSync(caPath, 'synthetic-ca')
    const account = readPhotoProofAccount(accountPath)
    assert.deepEqual({ accountKey: account.accountKey, username: account.username, role: account.role, scope: account.scope, providerClaims: account.providerClaims }, { accountKey: 'onprem.photo-proof-admin', username: 'onprem.photo-proof-admin', role: 'SUPER_ADMIN', scope: 'company', providerClaims: { readStoreIds: ['store-100'] } })
    assert.deepEqual(configureAuthorizationClient({ caFile: caPath, connectHost: 'caddy', connectPort: 8443, timeoutMs: 1000, maxResponseBytes: 2048, maxRequestBytes: 4096 }), { transport: { hostname: 'caddy', port: 8443 }, timeoutMs: 1000, maxResponseBytes: 2048, maxRequestBytes: 4096 })
    for (const helper of [loginPersona, createBrowserSession, jsonRequest, requestRaw]) assert.equal(typeof helper, 'function')
    assert.throws(() => readPhotoProofAccount(accountPath.replace('photo-account', 'missing')), /unavailable/i)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('Keycloak auth proof permits only the standalone or private Caddy transport', () => {
  assert.deepEqual(resolveAuthorizationTransport({ connectHost: '127.0.0.1', connectPort: 443 }), {
    hostname: '127.0.0.1',
    port: 443,
  })
  assert.deepEqual(resolveAuthorizationTransport({ connectHost: 'caddy', connectPort: 8443 }), {
    hostname: 'caddy',
    port: 8443,
  })
  for (const input of [
    { connectHost: 'caddy', connectPort: 443 },
    { connectHost: '127.0.0.1', connectPort: 8443 },
    { connectHost: 'api', connectPort: 8443 },
    { connectHost: 'example.com', connectPort: 443 },
  ]) {
    assert.throws(() => resolveAuthorizationTransport(input), /transport/i)
  }
  assert.deepEqual(parseArgs([
    '--host', 'onprem-proof.example.invalid',
    '--accounts-file', 'accounts',
    '--ca-file', 'ca.crt',
    '--connect-host', 'caddy',
    '--connect-port', '8443',
  ]), {
    host: 'onprem-proof.example.invalid',
    accountsFile: 'accounts',
    caFile: 'ca.crt',
    connectHost: 'caddy',
    connectPort: 8443,
  })
})

test('Keycloak auth proof emits only bounded login failure classifications', () => {
  assert.equal(classifyLoginCodeFailure({ status: 200, finalPath: '/realms/store-ops/login-actions/authenticate', history: [], body: '<div class="alert-error">Invalid username or password.</div>' }), 'credentials-rejected')
  assert.equal(classifyLoginCodeFailure({ status: 400, finalPath: '/realms/store-ops/protocol/openid-connect/auth', history: [], body: 'Invalid parameter: redirect_uri' }), 'authorization-request-rejected')
  assert.equal(classifyLoginCodeFailure({ status: 200, finalPath: '/realms/store-ops/login-actions/authenticate', history: [], body: '<form id="kc-form-login">' }), 'login-form-returned-without-code')
  assert.equal(classifyLoginCodeFailure({ status: 200, finalPath: '/auth/callback?state=redacted', history: [], body: '<html>' }), 'callback-returned-without-observed-code')
  assert.equal(classifyLoginCodeFailure({ status: 200, finalPath: '/realms/store-ops/login-actions/authenticate', history: [], body: '<div class="pf-v5-c-alert alert-error">localized message</div>' }), 'login-form-error')
  assert.equal(classifyLoginCodeFailure({ status: 502, finalPath: '/', history: [], body: 'arbitrary upstream text' }), 'unexpected-login-response-502')
})

test('Keycloak auth proof classifies authorization-entry redirects without exposing redirect values', () => {
  const host = 'onprem-proof.example.invalid'
  assert.equal(classifyAuthorizationEntryFailure({
    status: 302,
    headers: { location: `https://${host}/auth/callback?error=invalid_scope&error_description=synthetic-sensitive-value&state=synthetic-sensitive-state` },
  }, host), 'scope-rejected')
  assert.equal(classifyAuthorizationEntryFailure({
    status: 302,
    headers: { location: `https://${host}/auth/callback?error=invalid_request&error_description=synthetic-sensitive-value` },
  }, host), 'authorization-request-rejected')
  assert.equal(classifyAuthorizationEntryFailure({
    status: 302,
    headers: { location: 'https://outside.example.invalid/auth/callback?error=invalid_scope' },
  }, host), 'redirect-escaped-approved-host')
  assert.equal(classifyAuthorizationEntryFailure({ status: 502, headers: {} }, host), 'unexpected-authorization-response-502')
})

test('Keycloak auth proof classifies browser-session failures without exposing response bodies', () => {
  assert.equal(classifyBrowserSessionCreateFailure({ status: 401, body: JSON.stringify({ message: 'Invalid JWT' }) }), 'invalid-jwt')
  assert.equal(classifyBrowserSessionCreateFailure({ status: 401, body: JSON.stringify({ message: 'User account is not mapped' }) }), 'account-not-mapped')
  assert.equal(classifyBrowserSessionCreateFailure({ status: 401, body: JSON.stringify({ message: 'User account has no active role assignments' }) }), 'no-active-role-assignment')
  assert.equal(classifyBrowserSessionCreateFailure({ status: 401, body: JSON.stringify({ message: 'synthetic-sensitive-value' }) }), 'unauthorized')
  assert.equal(classifyBrowserSessionCreateFailure({ status: 503, body: 'synthetic-sensitive-value' }), 'authorization-context-unavailable')
  assert.equal(classifyBrowserSessionCreateFailure({ status: 502, body: 'synthetic-sensitive-value' }), 'unexpected-browser-session-response-502')
})

test('Keycloak auth proof classifies realm logout failures without exposing query values', () => {
  const host = 'onprem-proof.example.invalid'
  assert.equal(classifyRealmLogoutFailure({ status: 404, finalPath: '/realms/store-ops/protocol/openid-connect/logout/logout-confirm?session_code=sensitive' }, host), 'logout-confirmation-route-unavailable')
  assert.equal(classifyRealmLogoutFailure({ status: 404, finalPath: '/realms/store-ops/login-actions/logout-confirm?code=sensitive' }, host), 'logout-login-action-route-unavailable')
  assert.equal(classifyRealmLogoutFailure({ status: 404, finalPath: '/auth/login' }, host), 'approved-login-route-unavailable')
  assert.equal(classifyRealmLogoutFailure({ status: 502, finalPath: '/unexpected?sensitive=value' }, host), 'unexpected-realm-logout-response-502')
})

test('Keycloak auth proof requires the provider token issuer, audience, client, role, and subject', () => {
  const payload = {
    iss: 'https://onprem-proof.example.invalid/realms/store-ops',
    aud: ['store-ops-api', 'account'],
    azp: 'store-ops-admin-web',
    sub: '11111111-1111-4111-8111-111111111111',
    auth_time: 1,
    roles: ['STORE_MANAGER'],
  }
  const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`
  const account = { role: 'STORE_MANAGER' }
  assert.deepEqual(assertAccessTokenContract('onprem-proof.example.invalid', token, account), {
    issuer: true,
    audience: true,
    authorizedParty: true,
    subject: true,
    role: true,
  })
  for (const mutate of [
    value => { value.iss = 'https://wrong.example.invalid/realms/store-ops' },
    value => { value.aud = ['account'] },
    value => { value.azp = 'wrong-client' },
    value => { value.sub = '' },
    value => { value.roles = ['REPORT_VIEWER'] },
  ]) {
    const invalid = structuredClone(payload)
    mutate(invalid)
    const invalidToken = `header.${Buffer.from(JSON.stringify(invalid)).toString('base64url')}.signature`
    assert.throws(() => assertAccessTokenContract('onprem-proof.example.invalid', invalidToken, account), /access token/i)
  }
  const missingCanonicalBasicScope = structuredClone(payload)
  delete missingCanonicalBasicScope.sub
  delete missingCanonicalBasicScope.auth_time
  const missingCanonicalBasicScopeToken = `header.${Buffer.from(JSON.stringify(missingCanonicalBasicScope)).toString('base64url')}.signature`
  assert.throws(
    () => assertAccessTokenContract('onprem-proof.example.invalid', missingCanonicalBasicScopeToken, account),
    /canonical basic scope/i,
  )
})

test('Keycloak auth proof rejects duplicate or missing personas', () => {
  const directory = mkdtempSync(join(tmpdir(), 'onprem-keycloak-auth-proof-'))
  const path = join(directory, 'accounts')
  try {
    writeFileSync(path, `${rows.slice(0, 4).join('\n')}\n${rows[0]}\n`)
    assert.throws(() => readAccounts(path), /duplicate|five synthetic/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Keycloak auth proof builds a valid host-bound PKCE authorization request', () => {
  const request = buildAuthorizationRequest({
    host: 'onprem-proof.example.invalid',
    verifier: 'v'.repeat(43),
    state: 'synthetic-state',
  })
  const url = new URL(request.authorizationPath, 'https://onprem-proof.example.invalid')
  assert.equal(request.redirectUri, 'https://onprem-proof.example.invalid/auth/callback')
  assert.match(request.challenge, /^[A-Za-z0-9_-]{43}$/)
  assert.equal(url.pathname, '/realms/store-ops/protocol/openid-connect/auth')
  assert.equal(url.searchParams.get('client_id'), 'store-ops-admin-web')
  assert.equal(url.searchParams.get('redirect_uri'), request.redirectUri)
  assert.equal(url.searchParams.get('response_type'), 'code')
  assert.equal(url.searchParams.get('scope'), 'openid profile email roles')
  assert.equal(url.searchParams.get('state'), 'synthetic-state')
  assert.equal(url.searchParams.get('code_challenge'), request.challenge)
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
  assert.throws(() => buildAuthorizationRequest({ host: 'hr-axis.example.invalid/path', verifier: 'v'.repeat(43), state: 'state' }), /host/i)
  assert.throws(() => buildAuthorizationRequest({ host: 'onprem-proof.example.invalid', verifier: 'short', state: 'state' }), /verifier/i)
})

test('Keycloak auth proof keeps browser redirects and logout local without persisting ID-token hints', () => {
  const source = readFileSync('scripts/onprem-keycloak-auth-proof.mjs', 'utf8')
  assert.equal(decodeHtmlAttribute('/logout?x=1&amp;y=2&#x2F;ok'), '/logout?x=1&y=2/ok')
  assert.match(source, /next\.protocol !== 'https:' \|\| next\.hostname !== host/)
  assert.match(source, /\[301, 302, 303\]\.includes\(response\.status\)/)
  assert.match(source, /loginUrl\.protocol !== 'https:' \|\| loginUrl\.hostname !== host/)
  assert.match(source, /actionUrl\.protocol !== 'https:' \|\| actionUrl\.hostname !== host/)
  assert.match(source, /response\.finalPath !== '\/auth\/login'/)
  assert.match(source, /post_logout_redirect_uri.*auth\/not-allowlisted/)
  assert.match(source, /unallowlisted post-logout redirect was accepted/)
  assert.doesNotMatch(source, /id_token_hint/)
  assert.match(source, /post_logout_redirect_uri/)
  assert.match(source, /confirmLogout/)
  assert.doesNotMatch(source, /const cookie = browser\.sessionCookie|Cookie: cookie/)
  assert.match(source, /const afterLogout = await jsonRequest\(options\.host, '\/api\/auth\/session', \{ headers: \{ Accept: 'application\/json' \}, jar: browser\.jar \}\)/)
})

test('Keycloak auth proof requires strict secure host-only session cookies and clearing', () => {
  const secureSession = ['hr_axis_browser_session=opaque; Path=/; HttpOnly; Secure; SameSite=Lax']
  assert.deepEqual(assertBrowserSessionCookieContract({ 'set-cookie': secureSession }), {
    session: { secure: true, httpOnly: true, sameSite: 'Lax', hostOnly: true, cleared: false },
  })
  const clearHeaders = [
    'hr_axis_browser_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax',
    'hr_axis_csrf_nonce=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/; Secure; SameSite=Lax',
  ]
  assert.equal(assertBrowserSessionClearContract({ 'set-cookie': clearHeaders }).session.cleared, true)
  assert.throws(() => assertBrowserSessionCookieContract({ 'set-cookie': ['hr_axis_browser_session=x; Path=/; SameSite=Lax'] }), /Secure/)
  assert.throws(() => assertBrowserSessionCookieContract({ 'set-cookie': ['hr_axis_browser_session=x; Path=/; HttpOnly; Secure; Domain=example.invalid; SameSite=Lax'] }), /host-only/)
})

test('Keycloak auth proof keeps provider-signed overbroad claims and JWKS rotation as explicit receipt contracts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'onprem-keycloak-auth-proof-'))
  const path = join(directory, 'accounts')
  try {
    writeFileSync(path, `${rows[0]}|STORE_MANAGER|synthetic-employee|company-001|region-001|store-100|company-001|region-001|store-100,store-999|store-100\n${rows.slice(1).join('\n')}\n`)
    const accounts = readAccounts(path)
    assert.equal(accounts[0].overbroadReadStoreClaims, true)
    assert.deepEqual(accounts[0].providerClaims.readStoreIds, ['store-100', 'store-999'])
    const source = readFileSync('scripts/onprem-keycloak-auth-proof.mjs', 'utf8')
    assert.match(source, /providerSignedOverbroadClaims/)
    assert.match(source, /status: 'unproven'/)
    assert.match(source, /publicAdminDenials/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
