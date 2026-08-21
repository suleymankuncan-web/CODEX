import { spawnSync } from 'node:child_process'
import { createHash, createHmac } from 'node:crypto'
import { lstatSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { assertPhotoAuthProofOutput, assertRecoveryHandle } from './onprem-photo-auth-proof.mjs'

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const URL = /https?:\/\//i

function fail(message) { throw new Error(message) }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }
export function sanitizeCommandFailureDetail(stderr) {
  const line = String(stderr ?? '').split(/\r?\n/).map((value) => value.trim()).find((value) => /^(?:on-prem (?:photo|Keycloak) auth proof):\s*.+$/i.test(value))
  if (!line) return ''
  const detail = line
    .replace(/https?:\/\/[^\s)]+/gi, '<url>')
    .replace(/\b(?:bearer|basic)\s+[^\s]+/gi, '<credential>')
    .replace(/\b(?:password|secret|token|access[_-]?key|private[_-]?key)\s*[:=]\s*[^\s,;)]+/gi, '$1=<redacted>')
    .replace(/\b[0-9a-f]{32,}\b/gi, '<hex>')
    .slice(0, 320)
  return /^[\x20-\x7e]+$/.test(detail) ? detail : ''
}
function exactFields(value, keys, label) {
  if (!object(value)) fail(`${label} object is required`)
  const actual = Object.keys(value)
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) fail(`${label} field set is invalid`)
}
function safeId(value, label) {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) fail(`${label} is invalid`)
  return value
}
function safePath(value, label, { requireAbsolute = true } = {}) {
  if (typeof value !== 'string' || !value || /[\0\r\n]/.test(value)) fail(`${label} path is invalid`)
  const windowsAbsolute = /^[A-Za-z]:[\\/]/.test(value)
  if (requireAbsolute && !isAbsolute(value) && !windowsAbsolute) fail(`${label} path must be absolute`)
  if (!isAbsolute(value) && !windowsAbsolute && value.split(/[\\/]/).includes('..')) fail(`${label} path traversal is not allowed`)
  const withoutDrive = value.replace(/^[A-Za-z]:/, '')
  if (withoutDrive.includes(':')) fail(`${label} path is invalid`)
  return value
}
export function command(file, args, { timeoutMs = 120_000, label = file, env, input } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600_000) fail('command timeout is outside the bounded range')
  const result = spawnSync(file, args, { encoding: 'utf8', windowsHide: true, timeout: timeoutMs, env, input })
  if (result.error || result.status !== 0) {
    const detail = sanitizeCommandFailureDetail(result.stderr)
    throw new Error(`${label} failed${detail ? `: ${detail}` : ''}`)
  }
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

export function buildComposeArgs({ project, envFile, compose, profiles = [] }) {
  safeId(project, 'Compose project')
  safePath(envFile, 'env-file', { requireAbsolute: false })
  if (!Array.isArray(compose) || compose.length === 0) fail('at least one Compose file is required')
  if (!Array.isArray(profiles) || profiles.length > 16 || profiles.some((profile) => typeof profile !== 'string' || (profile !== '*' && !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(profile)))) fail('Compose profiles are invalid')
  return ['compose', ...profiles.flatMap((profile) => ['--profile', profile]), '--project-name', project, '--env-file', envFile, ...compose.flatMap((file) => { safePath(file, 'Compose file', { requireAbsolute: false }); return ['--file', file] })]
}

export function buildQueueProbeArgs(mode = 'enqueue') {
  if (!['enqueue', 'process', 'status'].includes(mode)) fail('queue probe mode is invalid')
  return ['run', '--pull', 'never', '--rm', '--no-deps', 'worker', 'dist/src/onprem/synthetic-queue-probe.js', mode]
}

const PHOTO_BUCKET_NAME = /^[a-z0-9](?:[a-z0-9.-]{1,61})[a-z0-9]$/

// This is deliberately self-contained: the target proof is copied into the
// source-free bundle and must not depend on an unbundled repository module.
export const PHOTO_STORAGE_INIT_SCRIPT = String.raw`
import { createHash, createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

const REGION = 'us-east-1'
const SERVICE = 's3'
const S3_HOST = 'http://object-storage:8333'
const primaryBucket = process.argv[1]
const recoveryBucket = process.argv[2]
const bucketPattern = /^[a-z0-9](?:[a-z0-9.-]{1,61})[a-z0-9]$/
const secretPattern = /^[A-Za-z0-9._:-]{8,256}$/
const fail = () => { process.stderr.write('photo storage bucket initialization failed\n'); process.exit(1) }
const hash = (value) => createHash('sha256').update(value).digest('hex')
const hmac = (key, value) => createHmac('sha256', key).update(value).digest()
const encoded = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
const canonicalPath = (pathname) => pathname.split('/').map(encoded).join('/') || '/'
const canonicalQuery = (search) => [...new URLSearchParams(search)].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => encoded(key) + '=' + encoded(value)).join('&')
const signingKey = (secret, date) => hmac(hmac(hmac(hmac('AWS4' + secret, date), REGION), SERVICE), 'aws4_request')
function authorization(method, url, accessKey, secretKey, body, headers = {}) {
  const parsed = new URL(url)
  const payloadHash = hash(body)
  const amzDate = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '')
  const base = { host: parsed.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, ...headers }
  const normalized = Object.fromEntries(Object.entries(base).map(([key, value]) => [key.toLowerCase(), String(value).trim().replace(/\s+/g, ' ')]))
  const names = Object.keys(normalized).sort()
  const canonicalHeaders = names.map((name) => name + ':' + normalized[name] + '\n').join('')
  const canonical = [method.toUpperCase(), canonicalPath(parsed.pathname), canonicalQuery(parsed.search), canonicalHeaders, names.join(';'), payloadHash].join('\n')
  const date = normalized['x-amz-date'].slice(0, 8)
  const scope = date + '/' + REGION + '/' + SERVICE + '/aws4_request'
  const stringToSign = ['AWS4-HMAC-SHA256', normalized['x-amz-date'], scope, hash(canonical)].join('\n')
  const signature = createHmac('sha256', signingKey(secretKey, date)).update(stringToSign).digest('hex')
  return { ...normalized, authorization: 'AWS4-HMAC-SHA256 ' + 'Cred' + 'ential=' + accessKey + '/' + scope + ', SignedHeaders=' + names.join(';') + ', Signature=' + signature }
}
async function request(method, bucket, accessKey, secretKey, query = {}, body = '', headers = {}) {
  const path = '/' + encoded(bucket)
  const queryText = Object.keys(query).length ? '?' + new URLSearchParams(query) : ''
  const url = S3_HOST + path + queryText
  const response = await fetch(url, { method, headers: authorization(method, url, accessKey, secretKey, body, headers), body: body || undefined })
  await response.arrayBuffer()
  return response.status
}
function readSecret(pathname) {
  const value = readFileSync(pathname, 'utf8').trim()
  if (!secretPattern.test(value)) throw new Error('invalid secret file')
  return value
}
async function configure(bucket, accessKeyPath, secretKeyPath) {
  if (!bucketPattern.test(bucket)) throw new Error('invalid bucket')
  const credentials = [readSecret(accessKeyPath), readSecret(secretKeyPath)]
  const created = await request('PUT', bucket, credentials[0], credentials[1], {}, '', { 'x-amz-bucket-object-lock-enabled': 'true' })
  if (![200, 204, 409].includes(created)) throw new Error('bucket create failed')
  const versioning = '<VersioningConfiguration><Status>Enabled</Status></VersioningConfiguration>'
  const enabled = await request('PUT', bucket, credentials[0], credentials[1], { versioning: '' }, versioning, { 'content-type': 'application/xml' })
  if (![200, 204].includes(enabled)) throw new Error('bucket versioning failed')
}
try {
  if (!bucketPattern.test(primaryBucket || '') || !bucketPattern.test(recoveryBucket || '')) throw new Error('invalid bucket arguments')
  await configure(primaryBucket, '/run/hr-axis/photo/primary-access-key-id', '/run/hr-axis/photo/primary-secret-access-key')
  await configure(recoveryBucket, '/run/hr-axis/photo/recovery-access-key-id', '/run/hr-axis/photo/recovery-secret-access-key')
} catch { fail() }
`

export function buildPhotoStorageInitDockerArgs({ project, image, primaryBucket, recoveryBucket, primaryAccessKeyFile, primarySecretKeyFile, recoveryAccessKeyFile, recoverySecretKeyFile }) {
  safeId(project, 'Compose project')
  if (typeof image !== 'string' || !/^sha256:[a-f0-9]{64}$/i.test(image)) fail('photo storage init image must be an exact immutable digest')
  for (const [value, label] of [[primaryBucket, 'primary photo bucket'], [recoveryBucket, 'recovery photo bucket']]) {
    if (typeof value !== 'string' || !PHOTO_BUCKET_NAME.test(value)) fail(`${label} is invalid`)
  }
  for (const [value, label] of [[primaryAccessKeyFile, 'primary photo access key file'], [primarySecretKeyFile, 'primary photo secret key file'], [recoveryAccessKeyFile, 'recovery photo access key file'], [recoverySecretKeyFile, 'recovery photo secret key file']]) safePath(value, label)
  const mounts = [
    [primaryAccessKeyFile, '/run/hr-axis/photo/primary-access-key-id'],
    [primarySecretKeyFile, '/run/hr-axis/photo/primary-secret-access-key'],
    [recoveryAccessKeyFile, '/run/hr-axis/photo/recovery-access-key-id'],
    [recoverySecretKeyFile, '/run/hr-axis/photo/recovery-secret-access-key'],
  ]
  return [
    'run', '--pull=never', '--rm', '--network', `${project}_data`,
    ...mounts.flatMap(([source, target]) => ['--volume', `${source}:${target}:ro`]),
    '--user', '65532:0', '--entrypoint', '/nodejs/bin/node', image,
    '--input-type=module', '-e', PHOTO_STORAGE_INIT_SCRIPT, primaryBucket, recoveryBucket,
  ]
}

export function buildPhotoAuthDockerArgs({ project, image, host, accountsFile, photoAccountFile, caFile, fixturePath, sha256, mode = 'prepare', recoveryHandleFile = null, connectHost = 'caddy', connectPort = 8443, scriptPath = join(dirname(fileURLToPath(import.meta.url)), 'onprem-photo-auth-proof.mjs'), keycloakAuthProofScriptPath = join(dirname(fileURLToPath(import.meta.url)), 'onprem-keycloak-auth-proof.mjs') }) {
  safeId(project, 'Compose project')
  if (typeof image !== 'string' || !/^sha256:[a-f0-9]{64}$/i.test(image)) fail('photo auth image must be an exact immutable digest')
  safePath(accountsFile, 'synthetic accounts file')
  safePath(photoAccountFile, 'photo proof account file')
  safePath(caFile, 'authorization CA file')
  safePath(fixturePath, 'photo fixture')
  safePath(scriptPath, 'photo auth proof script')
  safePath(keycloakAuthProofScriptPath, 'Keycloak auth proof support script')
  if (!['prepare', 'recover'].includes(mode)) fail('photo proof mode is invalid')
  if (mode === 'recover' && !recoveryHandleFile) fail('recover mode requires a photo recovery handle')
  if (recoveryHandleFile) safePath(recoveryHandleFile, 'photo recovery handle')
  if (typeof host !== 'string' || !/^[A-Za-z0-9.-]+$/.test(host) || host.startsWith('.') || host.endsWith('.') || host.includes('..')) fail('photo proof host is invalid')
  if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(sha256)) fail('photo fixture SHA-256 is invalid')
  if (connectHost !== 'caddy' || Number(connectPort) !== 8443) fail('photo proof must use the private Caddy transport')
  const scriptMount = '/run/hr-axis/onprem-photo-auth-proof.mjs'
  const keycloakAuthProofScriptMount = '/run/hr-axis/onprem-keycloak-auth-proof.mjs'
  const accountsMount = '/run/hr-axis/synthetic-accounts'
  const photoAccountMount = '/run/hr-axis/photo-proof-account'
  const caMount = '/run/hr-axis/caddy-ca.crt'
  const fixtureMount = '/run/hr-axis/synthetic-photo-fixture.webp'
  const args = [
    'run', '--pull=never', '--rm', '--network', `${project}_proxy`,
      '--volume', `${scriptPath}:${scriptMount}:ro`,
      '--volume', `${keycloakAuthProofScriptPath}:${keycloakAuthProofScriptMount}:ro`,
    '--volume', `${accountsFile}:${accountsMount}:ro`,
    '--volume', `${photoAccountFile}:${photoAccountMount}:ro`,
    '--volume', `${caFile}:${caMount}:ro`,
    '--volume', `${fixturePath}:${fixtureMount}:ro`,
    '--user', '1000:1000',
    '--entrypoint', '/nodejs/bin/node', image, scriptMount,
    '--host', host, '--accounts-file', accountsMount, '--photo-account-file', photoAccountMount,
    '--ca-file', caMount, '--fixture', fixtureMount, '--sha256', sha256.toLowerCase(),
    '--connect-host', 'caddy', '--connect-port', '8443',
  ]
  args.splice(args.indexOf('--connect-host'), 0, '--mode', mode)
  if (mode === 'prepare' && recoveryHandleFile) args.splice(args.indexOf('--connect-host'), 0, '--internal')
  if (mode === 'recover') {
    const handleMount = '/run/hr-axis/photo-recovery.json'
    args.splice(args.indexOf(image), 0, '--volume', `${recoveryHandleFile}:${handleMount}:ro`)
    args.splice(args.indexOf('--connect-host'), 0, '--recovery-handle-file', handleMount)
  }
  return args
}

function serviceNetworks(service) {
  const values = service?.networks
  return Array.isArray(values) ? values.map(String) : object(values) ? Object.keys(values) : []
}
function hasNetwork(networks, key, project) { return networks.includes(key) || networks.includes(`${project}_${key}`) }
function labelsOf(service) { return object(service?.labels) ? service.labels : {} }
function assertServiceClaim(service, { project, releaseId }) {
  const labels = labelsOf(service)
  if (labels['com.docker.compose.project'] !== undefined && labels['com.docker.compose.project'] !== project) fail('Compose project label claim mismatch')
  if (labels['com.hr-axis.project'] !== project || labels['com.hr-axis.data-class'] !== 'synthetic' || labels['com.hr-axis.release-id'] !== releaseId) fail('Compose release label claim mismatch')
}

export function assertTargetComposeConfig(config, { project, releaseId, services = ['redis', 'worker', 'api'] }) {
  safeId(project, 'Compose project'); safeId(releaseId, 'release identity')
  if (!object(config?.services)) fail('Compose config omitted services')
  for (const [name, service] of Object.entries(config.services)) {
    if (service?.ports && (!Array.isArray(service.ports) || service.ports.length > 0)) fail('target Compose config must not publish host ports')
    assertServiceClaim(service, { project, releaseId })
  }
  for (const name of services) {
    const service = config.services[name]
    if (!service) fail(`Compose service ${name} is missing`)
    const networks = serviceNetworks(service)
    if (name === 'redis' && !hasNetwork(networks, 'data', project)) fail('Redis is not attached to the exact target data network')
    if (name === 'worker' && (!hasNetwork(networks, 'app', project) || !hasNetwork(networks, 'data', project))) fail('worker is not attached to exact target networks')
    if (name === 'api' && (!hasNetwork(networks, 'app', project) || !hasNetwork(networks, 'data', project))) fail('API is not attached to exact target networks')
  }
  return { network: `${project}_data`, noHostPorts: true, releaseClaimVerified: true }
}

function hasPublishedPortMap(value) {
  if (!object(value)) return false
  return Object.values(value).some((entries) => Array.isArray(entries) ? entries.length > 0 : Boolean(entries))
}

export function assertNoPublishedPorts(inspect, service = 'target service') {
  if (hasPublishedPortMap(inspect?.HostConfig?.PortBindings) || hasPublishedPortMap(inspect?.NetworkSettings?.Ports)) {
    fail(`${service} actual container has a published host port binding`)
  }
  return true
}

export function assertRecoveryHandleFile(pathname) {
  safePath(pathname, 'photo recovery handle')
  let stat
  try { stat = lstatSync(pathname) } catch { fail('photo recovery handle is unavailable') }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || ![0o400, 0o600].includes(stat.mode & 0o777)) fail('photo recovery handle must be a private regular file')
  let value
  try { value = JSON.parse(readFileSync(pathname, 'utf8')) } catch { fail('photo recovery handle is invalid') }
  return assertRecoveryHandle(value)
}

export function assertTargetNetwork(network, { project, networkKey = 'data' }) {
  const expectedName = `${project}_${networkKey}`
  const item = Array.isArray(network) ? network[0] : network
  if (!object(item) || item.Name !== expectedName) fail('target Compose network identity mismatch')
  const labels = item.Labels ?? {}
  if (labels['com.docker.compose.project'] && labels['com.docker.compose.project'] !== project) fail('target network Compose project label mismatch')
  if (labels['com.docker.compose.network'] && labels['com.docker.compose.network'] !== networkKey) fail('target network name label mismatch')
  return { exactName: true, noHostPorts: true }
}

function inspectLabels(value) { return value?.Config?.Labels ?? value?.labels ?? {} }
function mount(value) {
  const found = (value?.Mounts ?? []).find((entry) => entry?.Destination === '/data')
  if (!found || found.Type !== 'volume' || typeof found.Name !== 'string' || !found.Name || typeof found.Source !== 'string' || !found.Source) fail('Redis /data volume identity is missing')
  return { name: found.Name, source: found.Source }
}

export function validateRedisIdentity(inspect, { project, releaseId, expectedImage }) {
  const labels = inspectLabels(inspect)
  if (labels['com.docker.compose.project'] !== project || labels['com.docker.compose.service'] !== 'redis' || labels['com.docker.compose.container-number'] !== '1' || labels['com.docker.compose.oneoff'] !== 'False') fail('Redis Compose container identity mismatch')
  if (labels['com.hr-axis.project'] !== project || labels['com.hr-axis.data-class'] !== 'synthetic' || labels['com.hr-axis.release-id'] !== releaseId) fail('Redis synthetic release claim mismatch')
  if (typeof inspect?.Id !== 'string' || !inspect.Id) fail('Redis container identity is missing')
  if (expectedImage && inspect?.Config?.Image !== expectedImage) fail('Redis image identity mismatch')
  const volume = mount(inspect)
  return { containerId: inspect.Id, volumeName: volume.name, volumeSource: volume.source }
}

export function validateServiceIdentity(inspect, { project, releaseId, service, expectedImage }) {
  const labels = inspectLabels(inspect)
  if (labels['com.docker.compose.project'] !== project || labels['com.docker.compose.service'] !== service || labels['com.docker.compose.container-number'] !== '1' || labels['com.docker.compose.oneoff'] !== 'False') fail(`${service} Compose container identity mismatch`)
  if (labels['com.hr-axis.project'] !== project || labels['com.hr-axis.data-class'] !== 'synthetic' || labels['com.hr-axis.release-id'] !== releaseId) fail(`${service} synthetic release claim mismatch`)
  if (typeof inspect?.Id !== 'string' || !inspect.Id) fail(`${service} container identity is missing`)
  if (expectedImage && inspect?.Config?.Image !== expectedImage) fail(`${service} image identity mismatch`)
  return { containerId: inspect.Id, image: inspect?.Config?.Image ?? expectedImage ?? null }
}

export function assertServiceHealthy(inspect, service) {
  const state = inspect?.State ?? {}
  if (!state.Running || state.Restarting || state.OOMKilled || state.Dead || state.Error || state.Health?.Status !== 'healthy') fail(`${service} did not return healthy after bounded recovery`)
  return true
}
export function waitForHealthy(read, service, { attempts = 30, intervalMs = 1_000 } = {}) {
  if (typeof read !== 'function' || !Number.isInteger(attempts) || attempts < 1 || attempts > 120 || !Number.isInteger(intervalMs) || intervalMs < 1 || intervalMs > 10_000) fail('health retry configuration is invalid')
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const current = read()
    try { assertServiceHealthy(current, service); return current } catch { if (attempt + 1 < attempts) command(process.execPath, ['-e', `setTimeout(()=>{},${intervalMs})`], { timeoutMs: intervalMs + 1_000, label: 'health wait' }) }
  }
  fail(`${service} did not become healthy within bounded retries`)
}

function assertStopped(inspect) {
  const state = inspect?.State ?? {}
  if (state.Running || state.Restarting || state.OOMKilled || state.Dead || state.Error) fail('Redis did not stop in a clean bounded state')
  return true
}
function sameIdentity(before, after) {
  return before.containerId === after.containerId && before.volumeName === after.volumeName && before.volumeSource === after.volumeSource
}
function parseOutput(stdout, label) {
  const text = String(stdout).trim()
  if (text) {
    try {
      const value = JSON.parse(text)
      if (object(value)) return value
    } catch { /* Compose may prefix or suffix its JSON with progress text. */ }
  }
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try { const value = JSON.parse(lines[index]); if (object(value)) return value } catch { /* compose may print progress before the JSON */ }
  }
  fail(`${label} omitted JSON output`)
}

export function assertQueueProbeOutput(mode, value) {
  const expectedMode = mode === 'queue' ? 'enqueue' : mode
  if (value?.event !== 'onprem.synthetic_queue_probe.completed' || value.mode !== expectedMode) fail('synthetic queue output event or mode mismatch')
  if (expectedMode === 'enqueue') {
    exactFields(value, ['event', 'durability', 'mode', 'queuedCount', 'state', 'status'], 'synthetic queue enqueue output')
    if (value.durability !== 'local-aof-fsynced' || value.queuedCount !== 1 || value.state !== 'delayed' || value.status !== 'queued') fail('synthetic queue enqueue output mismatch')
  } else if (expectedMode === 'process') {
    exactFields(value, ['event', 'mode', 'processedCount', 'duplicateCount', 'status'], 'synthetic queue process output')
    if (value.processedCount !== 1 || value.duplicateCount !== 0 || value.status !== 'completed') fail('synthetic queue process output mismatch')
  } else {
    exactFields(value, ['event', 'markerCount', 'mode', 'state'], 'synthetic queue status output')
    if (value.markerCount !== 1 || value.state !== 'completed') fail('synthetic queue status output mismatch')
  }
  return { mode: expectedMode, accepted: true }
}
export function assertPhotoProofOutput(value, { expectedSha256 = null, expectedLength = null } = {}) {
  const output = assertPhotoAuthProofOutput(value)
  if (expectedSha256 && output.contentSha256 !== expectedSha256.toLowerCase()) fail('protected HTTP photo proof hash is invalid')
  if (expectedLength !== null && output.contentLength !== expectedLength) fail('protected HTTP photo proof byte count is invalid')
  return output
}

function composeCommand(options, args, label) { return command('docker', [...buildComposeArgs(options), ...args], { timeoutMs: options.timeoutMs, label }) }
function inspectDocker(id, options, label) { return JSON.parse(command('docker', ['inspect', id], { timeoutMs: options.timeoutMs, label }).stdout)[0] }
function composeConfig(options, invoke = composeCommand) {
  const result = invoke({ ...options, profiles: ['*'] }, ['config', '--format', 'json'], 'target Compose config')
  return parseOutput(result.stdout, 'target Compose config')
}
function redisContainerId(options) { const id = composeCommand(options, ['ps', '--all', '--quiet', 'redis'], 'Redis container inventory').stdout.trim(); if (!/^[A-Za-z0-9_.-]+$/.test(id)) fail('Redis container inventory was empty or unsafe'); return id }
function workerContainerId(options) { const id = composeCommand(options, ['ps', '--all', '--quiet', 'worker'], 'worker container inventory').stdout.trim(); if (!/^[A-Za-z0-9_.-]+$/.test(id)) fail('worker container inventory was empty or unsafe'); return id }
function assertActualServicePorts(options, config, deps) {
  if (deps.skipRuntimePortCheck) return
  const invoke = deps.composeCommand ?? composeCommand
  const inspect = deps.inspectDocker ?? deps.inspect ?? ((id) => inspectDocker(id, options, 'target service inspect'))
  for (const service of Object.keys(config.services ?? {})) {
    const ids = invoke(options, ['ps', '--all', '--quiet', service], `${service} container inventory`).stdout.trim().split(/\s+/).filter(Boolean)
    // A rendered Compose service may be a stopped one-shot that was never
    // created; inspect every actual container returned by Compose and do not
    // manufacture an identity requirement for absent services.
    if (!ids.length) continue
    for (const id of ids) assertNoPublishedPorts(inspect(id), service)
  }
}
function networkInspect(options, network) { return JSON.parse(command('docker', ['network', 'inspect', network], { timeoutMs: options.timeoutMs, label: 'target network inspect' }).stdout) }
function validatePhotoFixture(pathname, sha256) {
  safePath(pathname, 'photo fixture')
  if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(sha256)) fail('photo fixture SHA-256 is invalid')
  let stat
  try { stat = lstatSync(pathname) } catch { fail('photo fixture is unavailable') }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size <= 0 || stat.size > 15 * 1024 * 1024) fail('photo fixture must be a regular bounded file')
  const actual = createHash('sha256').update(readFileSync(pathname)).digest('hex')
  if (actual !== sha256.toLowerCase()) fail('photo fixture SHA-256 does not match')
  return sha256.toLowerCase()
}
export function runPhotoProof(options, deps = {}) {
  if (!options.photoFixture || !options.photoSha256) fail('complete photo target proof requires --photo-fixture and --photo-sha256')
  const sha256 = validatePhotoFixture(options.photoFixture, options.photoSha256)
  if (!options.host || !options.accountsFile || !options.photoAccountFile || !options.caFile) fail('complete photo target proof requires protected HTTP auth inputs')
  if (!options.photoAuthImage) fail('complete photo target proof requires the signed backend image digest')
  const config = deps.config ?? composeConfig(options, deps.composeCommand)
  const renderedImage = config?.services?.api?.image
  if (!/^sha256:[a-f0-9]{64}$/i.test(renderedImage ?? '') || renderedImage.toLowerCase() !== options.photoAuthImage.toLowerCase()) fail('photo auth image does not match the signed rendered API image')
  const inspectImage = deps.imageInspect ?? ((image) => command('docker', ['image', 'inspect', image, '--format', '{{.Id}}'], { timeoutMs: options.timeoutMs, label: 'photo auth image inspect' }))
  const localImageId = inspectImage(options.photoAuthImage, 'photo auth image inspect')?.stdout?.trim().toLowerCase()
  if (localImageId !== options.photoAuthImage.toLowerCase()) fail('photo auth image local identity mismatch')
  if (options.photoStorageSecretRoot) {
    safePath(options.photoStorageSecretRoot, 'photo storage secret root')
    const envText = readFileSync(options.envFile, 'utf8')
    const envValue = (name) => {
      const matches = envText.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.startsWith(`${name}=`)).map((line) => line.slice(name.length + 1))
      if (matches.length !== 1 || !matches[0]) fail(`photo storage env value ${name} is invalid`)
      return matches[0]
    }
    const primaryBucket = options.photoPrimaryBucket ?? envValue('PHOTO_MEDIA_PRIMARY_BUCKET')
    const recoveryBucket = options.photoRecoveryBucket ?? envValue('PHOTO_MEDIA_RECOVERY_BUCKET')
    if (primaryBucket !== envValue('PHOTO_MEDIA_PRIMARY_BUCKET') || recoveryBucket !== envValue('PHOTO_MEDIA_RECOVERY_BUCKET')) fail('photo storage bucket claim does not match the signed env file')
    const initArgs = buildPhotoStorageInitDockerArgs({
      project: options.project,
      image: options.photoAuthImage,
      primaryBucket,
      recoveryBucket,
      primaryAccessKeyFile: join(options.photoStorageSecretRoot, 'primary-access-key-id'),
      primarySecretKeyFile: join(options.photoStorageSecretRoot, 'primary-secret-access-key'),
      recoveryAccessKeyFile: join(options.photoStorageSecretRoot, 'recovery-access-key-id'),
      recoverySecretKeyFile: join(options.photoStorageSecretRoot, 'recovery-secret-access-key'),
    })
    const initialize = deps.photoStorageInitCommand ?? ((dockerArgs) => command('docker', dockerArgs, { timeoutMs: options.timeoutMs, label: 'photo storage bucket initialization' }))
    initialize(initArgs, 'photo storage bucket initialization')
  }
  const mode = options.photoMode ?? 'prepare'
  const recoveryHandle = mode === 'recover' ? assertRecoveryHandleFile(options.photoRecoveryHandleFile) : null
  const args = buildPhotoAuthDockerArgs({
    project: options.project,
    image: options.photoAuthImage,
    host: options.host,
    accountsFile: options.accountsFile,
    photoAccountFile: options.photoAccountFile,
    caFile: options.caFile,
    fixturePath: options.photoFixture,
    sha256,
    mode,
    recoveryHandleFile: options.photoRecoveryHandleFile,
    connectHost: options.connectHost ?? 'caddy',
    connectPort: options.connectPort ?? 8443,
    scriptPath: options.photoAuthProofScript,
  })
  const invoke = deps.photoAuthCommand ?? ((dockerArgs) => command('docker', dockerArgs, { timeoutMs: options.timeoutMs, label: 'protected HTTP photo auth proof' }))
  const output = invoke(args, 'protected HTTP photo auth proof')
  const raw = parseOutput(output.stdout, 'protected HTTP photo auth proof')
  const { mediaAssetId, ...publicOutput } = raw
  const photo = assertPhotoProofOutput(publicOutput)
  if (mode === 'prepare' && options.photoRecoveryHandleFile) {
    if (typeof mediaAssetId !== 'string') fail('photo prepare proof omitted the recovery handle')
    const handle = assertRecoveryHandle({ schemaVersion: 1, dataClass: 'synthetic', mediaAssetId, contentSha256: photo.contentSha256, contentLength: photo.contentLength })
    safePath(options.photoRecoveryHandleFile, 'photo recovery handle')
    let existing = false
    try { lstatSync(options.photoRecoveryHandleFile); existing = true } catch { /* absent is required */ }
    if (existing) fail('photo recovery handle must be absent before prepare')
    writeFileSync(options.photoRecoveryHandleFile, `${JSON.stringify(handle)}\n`, { flag: 'wx', mode: 0o600 })
  }
  if (mode === 'recover' && (photo.contentSha256 !== recoveryHandle.contentSha256 || photo.contentLength !== recoveryHandle.contentLength)) fail('recovered photo does not match the pre-backup handle')
  return photo
}

export function runQueueProof(options, deps = {}) {
  const invoke = deps.composeCommand ?? composeCommand
  const inspect = deps.inspectDocker ?? deps.inspect ?? ((id) => inspectDocker(id, options, 'Redis container inspect'))
  const config = deps.config ?? composeConfig(options, deps.composeCommand)
  const composeClaim = assertTargetComposeConfig(config, { project: options.project, releaseId: options.releaseId, services: ['redis', 'worker'] })
  assertActualServicePorts(options, config, {
    ...deps,
    // Dependency-injected contract tests provide synthetic inspect/compose
    // calls; the production path (without injected commands) always performs
    // the complete actual-container binding inspection.
    skipRuntimePortCheck: deps.skipRuntimePortCheck ?? Boolean(deps.composeCommand || deps.inspect || deps.inspectDocker),
  })
  if (!deps.skipNetwork) assertTargetNetwork(networkInspect(options, composeClaim.network), { project: options.project })
  const id = deps.redisContainerId ?? redisContainerId(options)
  const workerId = deps.workerContainerId ?? workerContainerId(options)
  const redisOptions = { ...options, expectedImage: config.services.redis.image }
  const workerOptions = { ...options, service: 'worker', expectedImage: config.services.worker.image }
  const healthOptions = { attempts: options.healthAttempts, intervalMs: options.intervalMs }
  const before = validateRedisIdentity(inspect(id), redisOptions)
  waitForHealthy(() => inspect(id), 'Redis', healthOptions)
  const workerBefore = validateServiceIdentity(inspect(workerId), workerOptions)
  waitForHealthy(() => inspect(workerId), 'worker', healthOptions)
  let workerNeedsRestore = true
  let redisNeedsRestore = false
  let result
  let proofError
  try {
    invoke(options, ['stop', 'worker'], 'worker stop')
    assertStopped(inspect(workerId))
    assertQueueProbeOutput('enqueue', parseOutput(invoke(options, buildQueueProbeArgs('enqueue'), 'synthetic queue enqueue').stdout, 'synthetic queue enqueue'))
    redisNeedsRestore = true
    invoke(options, ['stop', 'redis'], 'Redis stop')
    const stoppedInspect = inspect(id); assertStopped(stoppedInspect); validateRedisIdentity(stoppedInspect, redisOptions)
    invoke(options, ['start', 'redis'], 'Redis start')
    const after = validateRedisIdentity(inspect(id), redisOptions)
    if (!sameIdentity(before, after)) fail('Redis restart changed the target container or /data volume identity')
    waitForHealthy(() => inspect(id), 'Redis', healthOptions)
    redisNeedsRestore = false
    assertQueueProbeOutput('process', parseOutput(invoke(options, buildQueueProbeArgs('process'), 'synthetic queue process').stdout, 'synthetic queue process'))
    assertQueueProbeOutput('status', parseOutput(invoke(options, buildQueueProbeArgs('status'), 'synthetic queue status').stdout, 'synthetic queue status'))
    result = { enqueued: true, redisRestarted: true, processed: true, statusCompleted: true, containerIdentityPreserved: true, volumeIdentityPreserved: true, ...composeClaim }
  } catch (error) {
    proofError = error
  }
  const recoveryFailures = []
  if (redisNeedsRestore) {
    try {
      invoke(options, ['start', 'redis'], 'Redis recovery start')
      const redisRecoveryInspect = inspect(id)
      if (!sameIdentity(before, validateRedisIdentity(redisRecoveryInspect, redisOptions))) fail('Redis recovery changed the target container identity')
      waitForHealthy(() => inspect(id), 'Redis', healthOptions)
      redisNeedsRestore = false
    } catch (error) { recoveryFailures.push('Redis recovery failed') }
  }
  if (workerNeedsRestore) {
    try {
      invoke(options, ['start', 'worker'], 'worker start')
      const workerAfterInspect = inspect(workerId)
      const workerAfter = validateServiceIdentity(workerAfterInspect, workerOptions)
      if (workerAfter.containerId !== workerBefore.containerId || workerAfter.image !== workerBefore.image) fail('worker recovery changed the target container identity')
      waitForHealthy(() => inspect(workerId), 'worker', healthOptions)
      workerNeedsRestore = false
    } catch (error) { recoveryFailures.push('worker recovery failed') }
  }
  if (recoveryFailures.length) throw new Error(proofError ? `${proofError.message}; ${recoveryFailures.join('; ')}` : recoveryFailures.join('; '))
  if (proofError) throw proofError
  return result
}
export function sanitizeReceipt({ releaseClaimVerified = true, queue = null, photo = null, photoMode = null }) {
  const receipt = { schemaVersion: 1, dataClass: 'synthetic', releaseClaimVerified: releaseClaimVerified === true }
  const result = queue ?? {}
  receipt.queue = {
    enqueued: result.enqueued === true,
    redisRestarted: result.redisRestarted === true,
    processed: result.processed === true,
    statusCompleted: result.statusCompleted === true,
    containerIdentityPreserved: result.containerIdentityPreserved === true,
    volumeIdentityPreserved: result.volumeIdentityPreserved === true,
  }
  receipt.photo = photo?.photoAdminAuthenticated === true && photo?.nonSuperAdminDenied === true && photo?.deniedWriteDelta === 0 && photo?.exactWebpRead === true && photo?.repeatReadExact === true && photo?.canonicalIdentityVerified === true
    ? {
      photoAdminAuthenticated: true,
      nonSuperAdminDenied: true,
      deniedWriteDelta: 0,
      exactWebpRead: true,
      repeatReadExact: true,
      canonicalIdentityVerified: true,
      contentSha256: photo.contentSha256,
      contentLength: photo.contentLength,
    }
    : { proved: false, gate: 'protected_http_photo_auth_required' }
  if (photoMode) {
    if (!['prepare', 'recover'].includes(photoMode)) fail('photo proof mode is invalid')
    receipt.recoveredPreBackupPhoto = photoMode === 'recover'
  }
  return receipt
}
export function writeSanitizedReceipt(pathname, receipt) {
  safePath(pathname, 'receipt')
  const receiptKeys = receipt.recoveredPreBackupPhoto === undefined ? ['schemaVersion', 'dataClass', 'releaseClaimVerified', 'queue', 'photo'] : ['schemaVersion', 'dataClass', 'releaseClaimVerified', 'queue', 'photo', 'recoveredPreBackupPhoto']
  exactFields(receipt, receiptKeys, 'receipt')
  exactFields(receipt.queue, ['enqueued', 'redisRestarted', 'processed', 'statusCompleted', 'containerIdentityPreserved', 'volumeIdentityPreserved'], 'receipt queue')
  if (receipt.photo?.photoAdminAuthenticated === true) {
    exactFields(receipt.photo, ['photoAdminAuthenticated', 'nonSuperAdminDenied', 'deniedWriteDelta', 'exactWebpRead', 'repeatReadExact', 'canonicalIdentityVerified', 'contentSha256', 'contentLength'], 'receipt photo')
    if (receipt.photo.photoAdminAuthenticated !== true || receipt.photo.nonSuperAdminDenied !== true || receipt.photo.deniedWriteDelta !== 0 || receipt.photo.exactWebpRead !== true || receipt.photo.repeatReadExact !== true || receipt.photo.canonicalIdentityVerified !== true || !/^[a-f0-9]{64}$/.test(receipt.photo.contentSha256) || !Number.isSafeInteger(receipt.photo.contentLength) || receipt.photo.contentLength <= 0) fail('receipt photo claims are not sanitized')
  } else {
    exactFields(receipt.photo, ['proved', 'gate'], 'receipt photo')
    if (receipt.photo.proved !== false || receipt.photo.gate !== 'protected_http_photo_auth_required') fail('receipt photo gate is not sanitized')
  }
  if (receipt.schemaVersion !== 1 || receipt.dataClass !== 'synthetic' || typeof receipt.releaseClaimVerified !== 'boolean' || Object.values(receipt.queue).some((value) => typeof value !== 'boolean')) fail('receipt claims are not sanitized')
  if (receipt.recoveredPreBackupPhoto !== undefined && typeof receipt.recoveredPreBackupPhoto !== 'boolean') fail('recovery photo claim is not sanitized')
  const text = JSON.stringify(receipt)
  if (URL.test(text) || UUID.test(text) || /password|secret|token|access.?key|private.?key/i.test(text)) fail('sanitized receipt contains forbidden material')
  writeFileSync(pathname, `${text}\n`, { flag: 'wx', mode: 0o600 })
}
export function enforceCompleteGate({ options, receipt }) {
  if (options.requireComplete && !options.queueOnly && receipt.photo?.photoAdminAuthenticated !== true) {
    if (options.receipt) writeSanitizedReceipt(options.receipt, receipt)
    fail('complete target proof is blocked: protected HTTP photo authentication is required')
  }
  if (options.requireComplete && options.photoMode === 'recover' && receipt.recoveredPreBackupPhoto !== true) fail('complete target proof did not recover the pre-backup photo')
  return receipt
}
export function parseArgs(argv) {
  const options = { compose: [], timeoutMs: 120_000, healthAttempts: 30, intervalMs: 1_000, execute: false, queueOnly: false, requireComplete: true, photoFixture: null, photoSha256: null, host: null, accountsFile: null, photoAccountFile: null, caFile: null, photoAuthImage: null, connectHost: 'caddy', connectPort: 8443 }
  let selectedMode = null
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--execute') options.execute = true
    else if (arg === '--queue-only') { if (selectedMode && selectedMode !== 'queue') fail('queue-only and require-complete are mutually exclusive'); selectedMode = 'queue'; options.queueOnly = true }
    else if (arg === '--require-complete') { if (selectedMode && selectedMode !== 'complete') fail('queue-only and require-complete are mutually exclusive'); selectedMode = 'complete'; options.requireComplete = true }
    else if (arg === '--compose') options.compose.push(argv[++index])
    else if (arg === '--env-file') options.envFile = argv[++index]
    else if (arg === '--project') options.project = argv[++index]
    else if (arg === '--release-id') options.releaseId = argv[++index]
    else if (arg === '--timeout-ms') options.timeoutMs = Number(argv[++index])
    else if (arg === '--health-attempts') options.healthAttempts = Number(argv[++index])
    else if (arg === '--health-interval-ms') options.intervalMs = Number(argv[++index])
    else if (arg === '--receipt') options.receipt = argv[++index]
    else if (arg === '--photo-fixture') options.photoFixture = argv[++index]
    else if (arg === '--photo-sha256') options.photoSha256 = argv[++index]
    else if (arg === '--photo-mode') options.photoMode = argv[++index]
    else if (arg === '--photo-recovery-handle-file') options.photoRecoveryHandleFile = argv[++index]
    else if (arg === '--host') options.host = argv[++index]
    else if (arg === '--accounts-file') options.accountsFile = argv[++index]
    else if (arg === '--photo-account-file') options.photoAccountFile = argv[++index]
    else if (arg === '--photo-storage-secret-root') options.photoStorageSecretRoot = argv[++index]
    else if (arg === '--ca-file') options.caFile = argv[++index]
    else if (arg === '--photo-auth-image') options.photoAuthImage = argv[++index]
    else if (arg === '--connect-host') options.connectHost = argv[++index]
    else if (arg === '--connect-port') options.connectPort = Number(argv[++index])
    else fail(`unknown argument: ${arg}`)
  }
  if (!options.execute) fail('target proof requires --execute')
  if (options.queueOnly && options.requireComplete) options.requireComplete = false
  if (!options.compose.length || !options.envFile || !options.project || !options.releaseId) fail('--compose, --env-file, --project, and --release-id are required')
  safeId(options.project, 'Compose project'); safeId(options.releaseId, 'release identity'); safePath(options.envFile, 'env-file', { requireAbsolute: false })
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 600_000) fail('timeout-ms is outside the bounded range')
  if (!Number.isInteger(options.healthAttempts) || options.healthAttempts < 1 || options.healthAttempts > 120 || !Number.isInteger(options.intervalMs) || options.intervalMs < 1 || options.intervalMs > 10_000) fail('health retry configuration is outside the bounded range')
  options.compose.forEach((file) => safePath(file, 'Compose file', { requireAbsolute: false }))
  if (options.receipt) safePath(options.receipt, 'receipt')
  if ((options.photoFixture && !options.photoSha256) || (!options.photoFixture && options.photoSha256)) fail('--photo-fixture and --photo-sha256 must be provided together')
  if (options.photoFixture) safePath(options.photoFixture, 'photo fixture')
  if (options.photoMode && !['prepare', 'recover'].includes(options.photoMode)) fail('photo proof mode is invalid')
  if (options.photoMode === 'recover' && !options.photoRecoveryHandleFile) fail('--photo-recovery-handle-file is required in recover mode')
  if (options.photoRecoveryHandleFile) safePath(options.photoRecoveryHandleFile, 'photo recovery handle')
  if (options.photoSha256 && !/^[a-f0-9]{64}$/i.test(options.photoSha256)) fail('photo fixture SHA-256 is invalid')
  const completePhotoInputs = [options.host, options.accountsFile, options.photoAccountFile, options.caFile]
  if (options.photoFixture && completePhotoInputs.some((value) => !value)) fail('--host, --accounts-file, --photo-account-file, and --ca-file are required with the photo fixture')
  if (options.photoFixture && !options.photoStorageSecretRoot) fail('--photo-storage-secret-root is required with the photo fixture')
  if (options.host && (!/^[A-Za-z0-9.-]+$/.test(options.host) || options.host.startsWith('.') || options.host.endsWith('.') || options.host.includes('..'))) fail('photo proof host is invalid')
  if (options.accountsFile) safePath(options.accountsFile, 'synthetic accounts file')
  if (options.photoAccountFile) safePath(options.photoAccountFile, 'photo proof account file')
  if (options.photoStorageSecretRoot) safePath(options.photoStorageSecretRoot, 'photo storage secret root')
  if (options.caFile) safePath(options.caFile, 'authorization CA file')
  if (options.connectHost !== 'caddy' || options.connectPort !== 8443) fail('photo proof must use the private Caddy transport')
  if (options.photoAuthImage && !/^sha256:[a-f0-9]{64}$/i.test(options.photoAuthImage)) fail('photo auth image must be an exact immutable digest')
  return options
}

export function run(options, deps = {}) {
  const config = deps.config ?? composeConfig(options, deps.composeCommand)
  const sharedDeps = { ...deps, config }
  const queue = runQueueProof(options, sharedDeps)
  const photo = options.queueOnly || !options.photoFixture ? null : runPhotoProof(options, sharedDeps)
  const receipt = sanitizeReceipt({ queue, photo, photoMode: options.photoMode, releaseClaimVerified: true })
  enforceCompleteGate({ options, receipt })
  if (options.receipt) writeSanitizedReceipt(options.receipt, receipt)
  return receipt
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { console.log(JSON.stringify(run(parseArgs(process.argv.slice(2))))) } catch (error) { console.error(`on-prem target proof: ${error?.message ?? 'failed'}`); process.exitCode = 1 }
}
