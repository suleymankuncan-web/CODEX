import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { assertBrowserSessionClearContract, assertBrowserSessionCookieContract, decodeHtmlAttribute, parseArgs, readAccounts } from './onprem-keycloak-auth-proof.mjs'

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
    assert.deepEqual(accounts.map((account) => account.scope), ['store', 'region', 'company', 'store', 'store'])
    assert.throws(() => parseArgs(['--host', 'onprem-proof.example.invalid', '--accounts-file', path]), /ca-file/)
    assert.deepEqual(parseArgs(['--host', 'onprem-proof.example.invalid', '--accounts-file', path, '--ca-file', 'ca.crt']), {
      host: 'onprem-proof.example.invalid',
      accountsFile: path,
      caFile: 'ca.crt',
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
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
