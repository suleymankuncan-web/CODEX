import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  assertPhotoAuthProofOutput,
  assertCanonicalReadIdentity,
  assertRetentionUsage,
  buildMultipartBody,
  canonicalRetentionUsage,
  parseArgs,
  runPhotoAuthProof,
  assertRecoveryHandle,
  summarizePhotoInitiateFailure,
} from './onprem-photo-auth-proof.mjs'

const accountRow = 'onprem.photo-proof-admin|onprem.photo-proof-admin|synthetic-photo-proof-password-0123456789-abcdef|SUPER_ADMIN|synthetic-employee-photo-proof-admin|company-001|region-001|store-100|company-001|region-001|store-100|store-100'
const managerRow = 'onprem.store-manager|onprem.store-manager|synthetic-password-store-manager|STORE_MANAGER|synthetic-employee-store-manager|company-001|region-001|store-100|company-001|region-001|store-100|store-100'
const fixture = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x18, 0, 0, 0]), Buffer.from('WEBP'), Buffer.from('VP8 '), Buffer.from('synthetic-webp-fixture')])
const sha256 = createHash('sha256').update(fixture).digest('hex')

test('canonical protected read is bound to the finalized database identity', () => {
  const canonical = Buffer.concat([Buffer.from('RIFF'), Buffer.from([12, 0, 0, 0]), Buffer.from('WEBP'), Buffer.from('canonical')])
  const substitute = Buffer.concat([Buffer.from('RIFF'), Buffer.from([12, 0, 0, 0]), Buffer.from('WEBP'), Buffer.from('substitute')])
  const digest = (body) => createHash('sha256').update(body).digest('hex')
  const finalized = { state: 'ready', canonicalSha256: digest(canonical), canonicalByteCount: canonical.byteLength }
  assert.deepEqual(assertCanonicalReadIdentity(finalized, { contentBody: canonical, contentDigest: digest(canonical) }, { contentBody: canonical, contentDigest: digest(canonical) }), { canonicalIdentityVerified: true, contentSha256: digest(canonical), contentLength: canonical.byteLength })
  assert.throws(() => assertCanonicalReadIdentity(finalized, { contentBody: substitute, contentDigest: digest(substitute) }, { contentBody: substitute, contentDigest: digest(substitute) }), /does not match finalized identity/)
})
const canonical = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x20, 0, 0, 0]), Buffer.from('WEBP'), Buffer.from('VP8 '), Buffer.from('canonical-reencoded-webp')])
const canonicalSha256 = createHash('sha256').update(canonical).digest('hex')
const usage = {
  current: { bytes: 7, classAOperations: 2, classBOperations: 3 },
  recentGrowthBytes: 0,
  projectedThirtyDayBytes: 7,
  classifications: [
    { classification: 'checklist_evidence', assetCount: 1, bytes: 7 },
    { classification: 'action_evidence', assetCount: 0, bytes: 0 },
    { classification: 'vm_reference', assetCount: 0, bytes: 0 },
    { classification: 'vm_campaign_evidence', assetCount: 0, bytes: 0 },
    { classification: 'derived_artifact', assetCount: 0, bytes: 0 },
  ],
  lifecycle: { purgeEligibleCount: 0, protectedExpiredCount: 0, stuckUploadCount: 0, stuckPurgeCount: 0, cleanupFailureCount: 0 },
  alerts: [
    { dimension: 'bytes', used: 7, limit: 100, state: 'normal' },
    { dimension: 'class_a', used: 2, limit: 100, state: 'normal' },
    { dimension: 'class_b', used: 3, limit: 100, state: 'normal' },
  ],
}

test('photo proof CLI requires separate account, CA, fixture, and host inputs', () => {
  assert.throws(() => parseArgs([]), /host/i)
  const parsed = parseArgs([
    '--host', 'offline.synthetic.invalid', '--accounts-file', 'accounts', '--photo-account-file', 'photo-account',
    '--ca-file', 'ca.crt', '--fixture', 'fixture.webp', '--sha256', 'a'.repeat(64),
    '--connect-host', 'caddy', '--connect-port', '8443',
  ])
  assert.deepEqual(parsed, {
    host: 'offline.synthetic.invalid', accountsFile: 'accounts', photoAccountFile: 'photo-account', caFile: 'ca.crt',
    fixture: 'fixture.webp', sha256: 'a'.repeat(64), connectHost: 'caddy', connectPort: 8443,
  })
})

test('photo proof exposes explicit prepare/recover modes and a sanitized recovery handle contract', () => {
  const handle = { schemaVersion: 1, dataClass: 'synthetic', mediaAssetId: '11111111-1111-4111-8111-111111111111', contentSha256: 'a'.repeat(64), contentLength: 42 }
  assert.deepEqual(assertRecoveryHandle(handle), handle)
  assert.throws(() => assertRecoveryHandle({ ...handle, contentLength: 0 }), /content length/i)
  const prepare = parseArgs(['--mode', 'prepare', '--host', 'offline.synthetic.invalid', '--accounts-file', 'accounts', '--photo-account-file', 'photo-account', '--ca-file', 'ca.crt', '--fixture', 'fixture.webp', '--sha256', 'a'.repeat(64)])
  const recover = parseArgs(['--mode', 'recover', '--host', 'offline.synthetic.invalid', '--accounts-file', 'accounts', '--photo-account-file', 'photo-account', '--ca-file', 'ca.crt', '--fixture', 'fixture.webp', '--sha256', 'a'.repeat(64), '--recovery-handle-file', 'handle.json'])
  assert.equal(prepare.mode, 'prepare')
  assert.equal(recover.mode, 'recover')
  assert.equal(recover.recoveryHandleFile, 'handle.json')
})

test('photo proof retention usage is strict, sanitized, and canonical', () => {
  assert.deepEqual(assertRetentionUsage(usage), usage)
  assert.deepEqual(assertRetentionUsage({ ...usage, classifications: [] }).classifications, [])
  assert.deepEqual(canonicalRetentionUsage({ ...usage, classifications: [...usage.classifications].reverse() }), canonicalRetentionUsage(usage))
  assert.throws(() => assertRetentionUsage({ ...usage, current: { ...usage.current, assetCount: 1 } }), /field set/i)
  assert.throws(() => assertRetentionUsage({ ...usage, alerts: [{ ...usage.alerts[0], url: 'https://sensitive.invalid' }] }), /invalid/i)
})

test('photo initiate failure diagnostics preserve only bounded safe status details', () => {
  assert.equal(
    summarizePhotoInitiateFailure({
      status: 503,
      body: JSON.stringify({
        errorCode: 'SERVICE_UNAVAILABLE',
        message: 'Photo media retention policy is not configured',
        correlationId: '11111111-1111-4111-8111-111111111111',
      }),
    }),
    'status=503 code=SERVICE_UNAVAILABLE message=Photo media retention policy is not configured',
  )
  assert.equal(
    summarizePhotoInitiateFailure({
      status: 500,
      json: { errorCode: 'INTERNAL_SERVER_ERROR', message: 'secret=do-not-print https://storage.invalid/object' },
    }),
    'status=500 code=INTERNAL_SERVER_ERROR message=<redacted-sensitive-message>',
  )
  assert.equal(summarizePhotoInitiateFailure({ status: 422, body: 'not-json' }), 'status=422')
})

test('photo multipart body keeps fixture bytes and only approved fields', () => {
  const multipart = buildMultipartBody({ fixture, storeId: '00000000-0000-0000-0000-000000000100' })
  const text = multipart.body.toString('latin1')
  assert.match(text, /name="storeId"/)
  assert.match(text, /name="syntheticFixtureAttestation"/)
  assert.match(text, /name="file"; filename="synthetic-photo-proof\.webp"/)
  assert.equal(multipart.contentType.startsWith('multipart/form-data; boundary='), true)
  assert.equal(text.endsWith('--' + multipart.boundary + '--\r\n'), true)
  assert.equal(text.includes(fixture.toString('latin1')), true)
})

test('photo proof performs admin usage-before/manager-denied/usage-after then exact read', async () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-photo-auth-proof-'))
  const fixturePath = join(root, 'fixture.webp')
  const accountsPath = join(root, 'synthetic-accounts')
  const photoAccountPath = join(root, 'photo-proof-account')
  const caPath = join(root, 'ca.crt')
  writeFileSync(fixturePath, fixture, { mode: 0o600 })
  writeFileSync(accountsPath, `${managerRow}\n${'onprem.region-manager|onprem.region-manager|synthetic-password-region-manager'}\n${'onprem.report-viewer|onprem.report-viewer|synthetic-password-report-viewer'}\n${'onprem.store-personnel|onprem.store-personnel|synthetic-password-store-personnel'}\n${'onprem.visual-merchandiser|onprem.visual-merchandiser|synthetic-password-visual-merchandiser'}\n`, { mode: 0o600 })
  writeFileSync(photoAccountPath, `${accountRow}\n`, { mode: 0o600 })
  writeFileSync(caPath, 'synthetic-ca', { mode: 0o600 })
  const calls = []
  let usageReads = 0
  const sessions = new Map()
  const responses = {
    usage: () => ({ status: 200, json: usage, body: JSON.stringify(usage), headers: {}, bodyBuffer: Buffer.from(JSON.stringify(usage)) }),
    denied: () => ({ status: 403, json: null, body: '', headers: {}, bodyBuffer: Buffer.alloc(0) }),
    initiate: () => ({ status: 201, json: { mediaAssetId: '11111111-1111-4111-8111-111111111111', state: 'uploaded' }, body: JSON.stringify({ mediaAssetId: '11111111-1111-4111-8111-111111111111', state: 'uploaded' }), headers: {}, bodyBuffer: Buffer.alloc(0) }),
    finalize: () => ({ status: 200, json: { mediaAssetId: '11111111-1111-4111-8111-111111111111', state: 'ready', canonicalSha256, canonicalByteCount: canonical.byteLength }, body: JSON.stringify({ state: 'ready', canonicalSha256, canonicalByteCount: canonical.byteLength }), headers: {}, bodyBuffer: Buffer.alloc(0) }),
    readUrl: () => ({ status: 201, json: { url: '/api/internal/photo-media/assets/11111111-1111-4111-8111-111111111111/content/canonical', expiresInSeconds: 60 }, body: '{}', headers: {}, bodyBuffer: Buffer.alloc(0) }),
    content: () => ({ status: 200, headers: { 'content-type': 'image/webp' }, body: canonical.toString('utf8'), bodyBuffer: canonical }),
    logout: () => ({ status: 200, json: {}, body: '{}', headers: {}, bodyBuffer: Buffer.from('{}') }),
  }
  try {
    const result = await runPhotoAuthProof({ host: 'offline.synthetic.invalid', accountsFile: accountsPath, photoAccountFile: photoAccountPath, caFile: caPath, fixture: fixturePath, sha256, connectHost: '127.0.0.1', connectPort: 443 }, {
      configureAuthorizationClient: () => {},
      loginPersona: async (_host, account) => ({ token: `token-${account.accountKey}`, jar: { header: () => '' } }),
      createBrowserSession: async (_host, token) => {
        const jar = { header: () => token }
        const browser = { jar, csrfToken: `csrf-${token}` }
        sessions.set(token, browser)
        return browser
      },
      jsonRequest: async (_host, path, options = {}) => {
        calls.push({ path, method: options.method ?? 'GET', body: options.body, token: options.jar?.header?.() ?? '' })
        if (path === '/api/auth/session') {
          const isManager = String(options.jar?.header?.() ?? '').includes('onprem.store-manager')
          return {
            status: 200,
            json: {
              user: {
                roleCodes: [isManager ? 'STORE_MANAGER' : 'SUPER_ADMIN'],
                readScope: isManager
                  ? { storeIds: ['00000000-0000-0000-0000-000000000100'] }
                  : { companyIds: ['00000000-0000-0000-0000-000000000001'] },
              },
            },
            body: '{}', headers: {}, bodyBuffer: Buffer.alloc(0),
          }
        }
        if (path.endsWith('/maintenance/retention/usage')) { usageReads += 1; return responses.usage() }
        if (path === '/api/auth/browser-session' && options.method === 'DELETE') return responses.logout()
        if (path === '/api/internal/photo-media/assets/11111111-1111-4111-8111-111111111111/read-url') return responses.readUrl()
        if (path === '/api/internal/photo-media/uploads/11111111-1111-4111-8111-111111111111/finalize') return responses.finalize()
        throw new Error(`unexpected json path ${path}`)
      },
      requestRaw: async (_host, path, options = {}) => {
        calls.push({ path, method: options.method ?? 'GET', body: options.body, token: options.jar?.header?.() ?? '' })
        if (path === '/api/internal/photo-media/uploads/initiate' && String(options.jar?.header?.()).includes('onprem.store-manager')) return responses.denied()
        if (path === '/api/internal/photo-media/uploads/initiate') return responses.initiate()
        if (path === '/api/internal/photo-media/assets/11111111-1111-4111-8111-111111111111/content/canonical') return responses.content()
        throw new Error(`unexpected raw path ${path}`)
      },
    })
    assert.deepEqual(result, { photoAdminAuthenticated: true, nonSuperAdminDenied: true, deniedWriteDelta: 0, exactWebpRead: true, repeatReadExact: true, canonicalIdentityVerified: true, contentSha256: canonicalSha256, contentLength: canonical.byteLength })
    assert.equal(usageReads, 2)
    assert.equal(calls.filter(({ path }) => path === '/api/internal/photo-media/uploads/initiate').length, 2)
    assert.deepEqual(assertPhotoAuthProofOutput(result), result)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
