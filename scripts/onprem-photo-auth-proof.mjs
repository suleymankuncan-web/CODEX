import { createHash, randomBytes } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  assertSession,
  configureAuthorizationClient,
  createBrowserSession,
  jsonRequest,
  loginPersona,
  readAccounts,
  readPhotoProofAccount,
  requestRaw,
  resolveAuthorizationTransport,
} from './onprem-keycloak-auth-proof.mjs'

const MAX_FIXTURE_BYTES = 15 * 1024 * 1024
const MAX_ACCOUNT_BYTES = 16 * 1024
const HOST = /^[A-Za-z0-9.-]+$/
const SHA256 = /^[a-f0-9]{64}$/i
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const STORE_ID = '00000000-0000-0000-0000-000000000100'
const USAGE_PATH = '/api/internal/photo-media/maintenance/retention/usage'
const INITIATE_PATH = '/api/internal/photo-media/uploads/initiate'

function fail(message) { throw new Error(message) }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function exactFields(value, keys, label) {
  if (!object(value)) fail(`${label} object is required`)
  const actual = Object.keys(value)
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) fail(`${label} field set is invalid`)
}
function nonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${label} is invalid`)
  return value
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (!object(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
}

function validateUsageArray(value, keys, label) {
  if (!Array.isArray(value) || value.length > keys.length) fail(`${label} is invalid`)
  return value
}

export function assertRetentionUsage(value) {
  exactFields(value, ['current', 'recentGrowthBytes', 'projectedThirtyDayBytes', 'classifications', 'lifecycle', 'alerts'], 'retention usage')
  exactFields(value.current, ['bytes', 'classAOperations', 'classBOperations'], 'retention current')
  nonNegativeInteger(value.current.bytes, 'retention current bytes')
  nonNegativeInteger(value.current.classAOperations, 'retention class A operations')
  nonNegativeInteger(value.current.classBOperations, 'retention class B operations')
  nonNegativeInteger(value.recentGrowthBytes, 'retention recent growth')
  nonNegativeInteger(value.projectedThirtyDayBytes, 'retention projected bytes')
  const classifications = validateUsageArray(value.classifications, ['checklist_evidence', 'action_evidence', 'vm_reference', 'vm_campaign_evidence', 'derived_artifact'], 'retention classifications')
  const classificationNames = new Set()
  for (const entry of classifications) {
    exactFields(entry, ['classification', 'assetCount', 'bytes'], 'retention classification')
    if (!['checklist_evidence', 'action_evidence', 'vm_reference', 'vm_campaign_evidence', 'derived_artifact'].includes(entry.classification) || classificationNames.has(entry.classification)) fail('retention classification set is invalid')
    classificationNames.add(entry.classification)
    nonNegativeInteger(entry.assetCount, 'retention classification asset count')
    nonNegativeInteger(entry.bytes, 'retention classification bytes')
  }
  const lifecycle = value.lifecycle
  exactFields(lifecycle, ['purgeEligibleCount', 'protectedExpiredCount', 'stuckUploadCount', 'stuckPurgeCount', 'cleanupFailureCount'], 'retention lifecycle')
  for (const key of Object.keys(lifecycle)) nonNegativeInteger(lifecycle[key], `retention lifecycle ${key}`)
  const alerts = validateUsageArray(value.alerts, ['bytes', 'class_a', 'class_b'], 'retention alerts')
  const alertNames = new Set()
  for (const entry of alerts) {
    exactFields(entry, ['dimension', 'used', 'limit', 'state'], 'retention alert')
    if (!['bytes', 'class_a', 'class_b'].includes(entry.dimension) || alertNames.has(entry.dimension)) fail('retention alert set is invalid')
    alertNames.add(entry.dimension)
    nonNegativeInteger(entry.used, 'retention alert used')
    if (!Number.isSafeInteger(entry.limit) || entry.limit < 1) fail('retention alert limit is invalid')
    if (!['normal', 'warning', 'critical', 'limit_reached'].includes(entry.state)) fail('retention alert state is invalid')
  }
  if (alertNames.size !== 3) fail('retention usage set is incomplete')
  return value
}

export function canonicalRetentionUsage(value) {
  assertRetentionUsage(value)
  const clone = JSON.parse(JSON.stringify(value))
  clone.classifications.sort((left, right) => left.classification.localeCompare(right.classification))
  clone.alerts.sort((left, right) => left.dimension.localeCompare(right.dimension))
  return stable(clone)
}

export function buildMultipartBody({ fixture, storeId = STORE_ID }) {
  if (!Buffer.isBuffer(fixture) || fixture.byteLength <= 0 || fixture.byteLength > MAX_FIXTURE_BYTES) fail('photo fixture body is outside the bounded range')
  if (typeof storeId !== 'string' || !/^[0-9a-f-]{36}$/i.test(storeId)) fail('photo store id is invalid')
  const boundary = `hr-axis-photo-proof-${randomBytes(12).toString('hex')}`
  const parts = [
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="storeId"\r\n\r\n${storeId}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="syntheticFixtureAttestation"\r\n\r\ntrue\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="synthetic-photo-proof.webp"\r\nContent-Type: image/webp\r\n\r\n`),
    fixture,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]
  return { boundary, contentType: `multipart/form-data; boundary=${boundary}`, body: Buffer.concat(parts) }
}

function readFixture(pathname, expectedSha256) {
  let stats
  try { stats = lstatSync(pathname) } catch { fail('photo fixture is unavailable') }
  if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1 || stats.size <= 0 || stats.size > MAX_FIXTURE_BYTES) fail('photo fixture must be a regular bounded file')
  let fixture
  try { fixture = readFileSync(pathname) } catch { fail('photo fixture is unavailable') }
  if (fixture.byteLength !== stats.size) fail('photo fixture changed while reading')
  if (fixture.subarray(0, 4).toString('ascii') !== 'RIFF' || fixture.subarray(8, 12).toString('ascii') !== 'WEBP') fail('photo fixture must be a WebP file')
  const actual = createHash('sha256').update(fixture).digest('hex')
  if (actual !== String(expectedSha256).toLowerCase()) fail('photo fixture SHA-256 does not match')
  return { fixture, sha256: actual }
}

function requestHeaders(host, browser, headers = {}) {
  return {
    Accept: 'application/json',
    Origin: `https://${host}`,
    'Sec-Fetch-Site': 'same-origin',
    'X-CSRF-Token': browser.csrfToken,
    ...headers,
  }
}

function assertStatus(response, expected, label) {
  if (!response || response.status !== expected) fail(`${label} returned an unexpected status`)
  return response
}

async function browserSession(host, account, deps) {
  const login = deps.loginPersona ?? loginPersona
  const create = deps.createBrowserSession ?? createBrowserSession
  const { token, jar: oidcJar } = await login(host, account)
  const browser = await create(host, token)
  const sessionRequest = deps.jsonRequest ?? jsonRequest
  const session = await sessionRequest(host, '/api/auth/session', { headers: { Accept: 'application/json' }, jar: browser.jar })
  assertStatus(session, 200, `${account.accountKey} browser session`)
  assertSession(session, account)
  return { browser, oidcJar }
}

async function closeBrowser(host, browser, deps) {
  if (!browser) return null
  const request = deps.jsonRequest ?? jsonRequest
  const response = await request(host, '/api/auth/browser-session', { method: 'DELETE', headers: { Accept: 'application/json' }, jar: browser.jar })
  if (![200, 204].includes(response.status)) fail('photo proof browser session cleanup failed')
  return response
}

function parseJsonBody(response, label) {
  if (object(response?.json)) return response.json
  try { return JSON.parse(response?.body ?? '') } catch { fail(`${label} response was not JSON`) }
}

const SAFE_ERROR_CODE = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/
const SENSITIVE_ERROR_TEXT = /(?:https?:\/\/|password|secret|token|access[\s_-]?key|private[\s_-]?key|authorization|cookie|bearer|set-cookie)/i

function sanitizeErrorText(value) {
  if (typeof value !== 'string') return ''
  let text = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  text = text
    .replace(/https?:\/\/\S+/gi, '<redacted-url>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, '<redacted-id>')
    .replace(/\b[0-9a-f]{64}\b/gi, '<redacted-digest>')
  if (SENSITIVE_ERROR_TEXT.test(text)) return '<redacted-sensitive-message>'
  return text.slice(0, 160)
}

export function summarizePhotoInitiateFailure(response) {
  const status = Number(response?.status)
  const parts = [Number.isInteger(status) && status >= 100 && status <= 599 ? `status=${status}` : 'status=unknown']
  let body = response?.json
  if (!object(body)) {
    try { body = JSON.parse(String(response?.body ?? '')) } catch { body = null }
  }
  if (object(body)) {
    const code = typeof body.errorCode === 'string' && SAFE_ERROR_CODE.test(body.errorCode) ? body.errorCode : ''
    if (code) parts.push(`code=${code}`)
    const rawMessage = Array.isArray(body.message) ? body.message.find((entry) => typeof entry === 'string') : body.message
    const message = sanitizeErrorText(rawMessage)
    if (message) parts.push(`message=${message}`)
  }
  return parts.join(' ')
}

export function assertPhotoAuthProofOutput(value) {
  exactFields(value, ['photoAdminAuthenticated', 'nonSuperAdminDenied', 'deniedWriteDelta', 'exactWebpRead', 'repeatReadExact', 'canonicalIdentityVerified', 'contentSha256', 'contentLength'], 'photo auth proof output')
  if (value.photoAdminAuthenticated !== true || value.nonSuperAdminDenied !== true || value.exactWebpRead !== true || value.repeatReadExact !== true || value.canonicalIdentityVerified !== true || value.deniedWriteDelta !== 0 || !SHA256.test(value.contentSha256) || !Number.isSafeInteger(value.contentLength) || value.contentLength <= 0) fail('photo auth proof output mismatch')
  const text = JSON.stringify(value)
  if (/https?:\/\/|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|password|secret|token|access.?key|private.?key|object.?key|version.?id/i.test(text)) fail('photo auth proof output contains forbidden material')
  return value
}
export function assertRecoveryHandle(value) {
  exactFields(value, ['schemaVersion', 'dataClass', 'mediaAssetId', 'contentSha256', 'contentLength'], 'photo recovery handle')
  if (value.schemaVersion !== 1 || value.dataClass !== 'synthetic' || !UUID.test(value.mediaAssetId) || !SHA256.test(value.contentSha256)) fail('photo recovery handle identity is invalid')
  if (!Number.isSafeInteger(value.contentLength) || value.contentLength <= 0) fail('photo recovery handle content length is invalid')
  return value
}
function readRecoveryHandle(pathname) {
  let value
  try { value = JSON.parse(readFileSync(pathname, 'utf8')) } catch { fail('photo recovery handle is unavailable') }
  return assertRecoveryHandle(value)
}
export function assertCanonicalReadIdentity(finalized, firstRead, secondRead) {
  if (!object(finalized) || finalized.state !== 'ready' || !SHA256.test(finalized.canonicalSha256 ?? '') || !Number.isSafeInteger(finalized.canonicalByteCount) || finalized.canonicalByteCount <= 0) fail('photo finalize response contract failed')
  if (!object(firstRead) || !object(secondRead) || !Buffer.isBuffer(firstRead.contentBody) || !Buffer.isBuffer(secondRead.contentBody) || !SHA256.test(firstRead.contentDigest ?? '') || !SHA256.test(secondRead.contentDigest ?? '')) fail('photo canonical read identity is invalid')
  if (firstRead.contentDigest !== secondRead.contentDigest || !firstRead.contentBody.equals(secondRead.contentBody)) fail('photo canonical content changed between exact authenticated reads')
  if (firstRead.contentDigest !== finalized.canonicalSha256 || firstRead.contentBody.byteLength !== finalized.canonicalByteCount) fail('photo canonical content does not match finalized identity')
  return { canonicalIdentityVerified: true, contentSha256: firstRead.contentDigest, contentLength: firstRead.contentBody.byteLength }
}

export async function runPhotoAuthProofInternal(options, deps = {}) {
  if (!options || !HOST.test(options.host) || options.host.startsWith('.') || options.host.endsWith('.') || options.host.includes('..')) fail('photo proof host is invalid')
  if (!options.accountsFile || !options.photoAccountFile || !options.caFile || !options.fixture || !SHA256.test(String(options.sha256 ?? ''))) fail('photo proof requires account, CA, fixture, and SHA-256 inputs')
  resolveAuthorizationTransport(options)
  const { fixture, sha256 } = readFixture(options.fixture, options.sha256)
  const mode = options.mode ?? 'prepare'
  if (!['prepare', 'recover'].includes(mode)) fail('photo proof mode is invalid')
  const recoveryHandle = mode === 'recover' ? readRecoveryHandle(options.recoveryHandleFile) : null
  const accounts = readAccounts(options.accountsFile)
  if (accounts.length !== 5) fail('photo proof requires the unchanged five-persona account file')
  const manager = accounts.find((account) => account.accountKey === 'onprem.store-manager')
  if (!manager || manager.role !== 'STORE_MANAGER') fail('photo proof store-manager persona is unavailable')
  const photoAccount = readPhotoProofAccount(options.photoAccountFile)
  const configure = deps.configureAuthorizationClient ?? configureAuthorizationClient
  configure(options)
  const json = deps.jsonRequest ?? jsonRequest
  const raw = deps.requestRaw ?? requestRaw
  let adminSession
  let managerSession
  let proofError = null
  let result = null
  try {
    adminSession = await browserSession(options.host, photoAccount, deps)
    managerSession = await browserSession(options.host, manager, deps)
    const usageBeforeResponse = await json(options.host, USAGE_PATH, { method: 'POST', headers: requestHeaders(options.host, adminSession.browser), jar: adminSession.browser.jar })
    assertStatus(usageBeforeResponse, 200, 'photo retention usage before')
    const usageBefore = canonicalRetentionUsage(parseJsonBody(usageBeforeResponse, 'photo retention usage before'))

    const multipart = buildMultipartBody({ fixture })
    const denied = await raw(options.host, INITIATE_PATH, {
      method: 'POST', headers: requestHeaders(options.host, managerSession.browser, { 'Content-Type': multipart.contentType, 'Content-Length': multipart.body.byteLength }), body: multipart.body, jar: managerSession.browser.jar,
    })
    assertStatus(denied, 403, 'non-SUPER_ADMIN photo initiate')

    const usageAfterResponse = await json(options.host, USAGE_PATH, { method: 'POST', headers: requestHeaders(options.host, adminSession.browser), jar: adminSession.browser.jar })
    assertStatus(usageAfterResponse, 200, 'photo retention usage after')
    const usageAfter = canonicalRetentionUsage(parseJsonBody(usageAfterResponse, 'photo retention usage after'))
    if (JSON.stringify(usageAfter) !== JSON.stringify(usageBefore)) fail('non-SUPER_ADMIN denied photo initiate changed retention usage')

    let mediaAssetId
    let finalizedBody
    if (mode === 'recover') {
      mediaAssetId = recoveryHandle.mediaAssetId
      finalizedBody = { state: 'ready', canonicalSha256: recoveryHandle.contentSha256, canonicalByteCount: recoveryHandle.contentLength }
    } else {
      const initiated = await raw(options.host, INITIATE_PATH, {
        method: 'POST', headers: requestHeaders(options.host, adminSession.browser, { 'Content-Type': multipart.contentType, 'Content-Length': multipart.body.byteLength }), body: multipart.body, jar: adminSession.browser.jar,
      })
      if (![200, 201].includes(initiated.status)) fail(`photo-admin photo initiate was not accepted (${summarizePhotoInitiateFailure(initiated)})`)
      const initiatedBody = parseJsonBody(initiated, 'photo initiate')
      if (!UUID.test(initiatedBody.mediaAssetId) || initiatedBody.state !== 'uploaded') fail('photo initiate response contract failed')
      mediaAssetId = initiatedBody.mediaAssetId

      const finalized = await json(options.host, `/api/internal/photo-media/uploads/${mediaAssetId}/finalize`, { method: 'POST', headers: requestHeaders(options.host, adminSession.browser), jar: adminSession.browser.jar })
      if (![200, 201].includes(finalized.status)) fail('photo-admin photo finalize was not accepted')
      finalizedBody = parseJsonBody(finalized, 'photo finalize')
    }

    const readUrlPath = `/api/internal/photo-media/assets/${mediaAssetId}/read-url`
    const readUrl = await json(options.host, readUrlPath, {
      method: 'POST', headers: requestHeaders(options.host, adminSession.browser, { 'Content-Type': 'application/json' }), body: JSON.stringify({ variant: 'canonical' }), jar: adminSession.browser.jar,
    })
    if (!readUrl || ![200, 201].includes(readUrl.status)) {
      const detail = summarizePhotoInitiateFailure(readUrl)
      fail(`photo read-url returned an unexpected status${detail ? ` (${detail})` : ''}`)
    }
    const readUrlBody = parseJsonBody(readUrl, 'photo read-url')
    const contentPath = `/api/internal/photo-media/assets/${mediaAssetId}/content/canonical`
    if (!object(readUrlBody) || readUrlBody.url !== contentPath || !Number.isSafeInteger(readUrlBody.expiresInSeconds) || readUrlBody.expiresInSeconds <= 0) fail('photo read-url response contract failed')

    const readCanonical = async () => {
      const content = await raw(options.host, contentPath, { method: 'GET', headers: requestHeaders(options.host, adminSession.browser, { Accept: 'image/webp' }), jar: adminSession.browser.jar })
      assertStatus(content, 200, 'photo canonical content')
      const contentBody = Buffer.isBuffer(content.bodyBuffer) ? content.bodyBuffer : Buffer.from(content.body ?? '', 'utf8')
      if (!String(content.headers?.['content-type'] ?? '').toLowerCase().startsWith('image/webp')) fail('photo canonical content type was not WebP')
      const contentDigest = createHash('sha256').update(contentBody).digest('hex')
      if (contentBody.byteLength <= 0 || !/^[a-f0-9]{64}$/.test(contentDigest) || contentBody.subarray(0, 4).toString('ascii') !== 'RIFF' || contentBody.subarray(8, 12).toString('ascii') !== 'WEBP') fail('photo canonical content was not an exact WebP read')
      return { contentBody, contentDigest }
    }
    const firstRead = await readCanonical()
    const secondRead = await readCanonical()
    const canonicalIdentity = assertCanonicalReadIdentity(finalizedBody, firstRead, secondRead)
    if (mode === 'recover' && (canonicalIdentity.contentSha256 !== recoveryHandle.contentSha256 || canonicalIdentity.contentLength !== recoveryHandle.contentLength)) fail('photo recovery content does not match the signed handle')
    result = { photoAdminAuthenticated: true, nonSuperAdminDenied: true, deniedWriteDelta: 0, exactWebpRead: true, repeatReadExact: true, ...canonicalIdentity }
    if (mode === 'prepare') result.mediaAssetId = mediaAssetId
  } catch (error) {
    proofError = error
  }
  const cleanupErrors = []
  for (const session of [managerSession, adminSession]) {
    try { await closeBrowser(options.host, session?.browser, deps) } catch { cleanupErrors.push('cleanup') }
  }
  if (proofError) throw proofError
  if (cleanupErrors.length) fail('photo proof browser session cleanup failed')
  return result
}

export async function runPhotoAuthProof(options, deps = {}) {
  const result = await runPhotoAuthProofInternal(options, deps)
  const { mediaAssetId: _mediaAssetId, ...publicResult } = result
  return assertPhotoAuthProofOutput(publicResult)
}

export function parseArgs(argv) {
  const options = { host: '', accountsFile: '', photoAccountFile: '', caFile: '', fixture: '', sha256: '', connectHost: 'caddy', connectPort: 8443 }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--host') options.host = argv[++index]
    else if (arg === '--accounts-file') options.accountsFile = argv[++index]
    else if (arg === '--photo-account-file') options.photoAccountFile = argv[++index]
    else if (arg === '--ca-file') options.caFile = argv[++index]
    else if (arg === '--fixture') options.fixture = argv[++index]
    else if (arg === '--sha256') options.sha256 = argv[++index]
    else if (arg === '--mode') options.mode = argv[++index]
    else if (arg === '--internal') options.internal = true
    else if (arg === '--recovery-handle-file') options.recoveryHandleFile = argv[++index]
    else if (arg === '--connect-host') options.connectHost = argv[++index]
    else if (arg === '--connect-port') options.connectPort = Number(argv[++index])
    else fail(`unknown argument: ${arg}`)
  }
  if (!options.host || !options.accountsFile || !options.photoAccountFile || !options.caFile || !options.fixture || !options.sha256) fail('--host, --accounts-file, --photo-account-file, --ca-file, --fixture, and --sha256 are required')
  if (options.mode && !['prepare', 'recover'].includes(options.mode)) fail('photo proof mode is invalid')
  if ((options.mode ?? 'prepare') === 'recover' && !options.recoveryHandleFile) fail('--recovery-handle-file is required in recover mode')
  if (!HOST.test(options.host) || options.host.startsWith('.') || options.host.endsWith('.') || options.host.includes('..')) fail('photo proof host is invalid')
  if (!SHA256.test(options.sha256)) fail('photo fixture SHA-256 is invalid')
  resolveAuthorizationTransport(options)
  return options
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseArgs(process.argv.slice(2))
    const result = options.internal ? await runPhotoAuthProofInternal(options) : await runPhotoAuthProof(options)
    console.log(JSON.stringify(result))
  } catch (error) { console.error(`on-prem photo auth proof: ${error?.message ?? 'failed'}`); process.exitCode = 1 }
}
