import { execFileSync, spawnSync } from 'node:child_process'
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const STORAGE_PROJECT = 'hr-axis-onprem-photo-storage'
export const STORAGE_IMAGE = 'chrislusf/seaweedfs:4.41@sha256:43b768cd62b00d132439cda881b93fd1adebf1b315e996e794087743821d771d'
const REGION = 'us-east-1'
const SERVICE = 's3'
const PROOF_PORT = 18333
const SANITIZED_RELEASE_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/
export const SYNTHETIC_PROOF_INPUT_ROOT_MODE = 0o700
export const SYNTHETIC_PROOF_SECRET_FILE_MODE = 0o644
export const SYNTHETIC_PROOF_ENV_FILE_MODE = 0o600

export function buildSyntheticProofReceipt(options, claims) {
  if (
    !options ||
    typeof options !== 'object' ||
    options.project !== STORAGE_PROJECT ||
    typeof options.releaseId !== 'string' ||
    !SANITIZED_RELEASE_ID_PATTERN.test(options.releaseId)
  ) {
    throw new Error('photo-storage proof receipt identity is invalid')
  }
  if (!claims || typeof claims !== 'object' || Array.isArray(claims)) {
    throw new Error('photo-storage proof receipt claims are invalid')
  }
  if (Object.keys(claims).some((key) => /(access.?key|password|secret|token)/i.test(key))) {
    throw new Error('photo-storage proof receipt claims are not sanitized')
  }
  return {
    ...claims,
    schemaVersion: 1,
    dataClass: 'synthetic',
    status: 'passed',
    project: options.project,
    releaseId: options.releaseId,
  }
}

export function exactObjectStorageVolumeName(options) {
  return `${options.project}_object_storage_data`
}

export function redact(value, secrets = []) {
  let output = String(value ?? '')
    .replace(/(AWS_SECRET_ACCESS_KEY|secretKey|accessKey|password|token)=?[^\s,}"']+/gi, '$1=[redacted]')
  for (const secret of secrets) if (secret) output = output.replaceAll(String(secret), '[redacted]')
  return output
}

export function command(file, args, options = {}) {
  if (options.timeout !== undefined && (!Number.isInteger(options.timeout) || options.timeout <= 0)) {
    throw new Error(`${options.label ?? file} timeout must be a positive integer`)
  }
  const result = spawnSync(file, args, {
    encoding: 'utf8',
    windowsHide: true,
    input: options.input,
    env: options.env,
    ...(options.timeout === undefined ? {} : { timeout: options.timeout }),
  })
  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  options.inspectOutput?.({ stdout, stderr, status: result.status ?? -1 })
  if (result.error || (!options.allowFailure && result.status !== 0)) {
    const tail = options.suppressOutput ? '' : redact(`${stderr}\n${stdout}`, options.secrets).trim().split(/\r?\n/).slice(-8).join('\n')
    throw new Error(`${options.label ?? file} failed${tail ? `\n${tail}` : ''}`)
  }
  return { stdout, stderr, status: result.status ?? 0 }
}

export function validateCleanupIdentity(labels, options) {
  const expected = {
    'com.docker.compose.project': options.project,
    'com.hr-axis.project': 'hr-axis-onprem-core',
    'com.hr-axis.data-class': 'synthetic',
    'com.hr-axis.release-id': options.releaseId,
  }
  for (const [key, value] of Object.entries(expected)) {
    if (labels?.[key] !== value) throw new Error(`storage cleanup refused mismatched ${key}`)
  }
  if (labels['com.docker.compose.service'] !== 'object-storage') throw new Error('storage cleanup refused an unexpected service')
  if (labels['com.docker.compose.oneoff'] === 'True') throw new Error('storage cleanup refused a one-off container')
  return true
}

export function validateCleanupVolumeIdentity(labels, options, volumeClass) {
  const expected = {
    'com.docker.compose.project': options.project,
    'com.hr-axis.project': 'hr-axis-onprem-core',
    'com.hr-axis.data-class': 'synthetic',
    'com.hr-axis.release-id': options.releaseId,
    'com.hr-axis.volume-class': volumeClass,
  }
  for (const [key, value] of Object.entries(expected)) {
    if (labels?.[key] !== value) throw new Error(`storage cleanup refused mismatched volume ${key}`)
  }
  return true
}

export function validateFreshExecutionInventory(inventory) {
  if (inventory.containers.length || inventory.volumes.length || inventory.networks.length) {
    throw new Error('photo-storage proof requires a fresh project with no pre-existing resources')
  }
  return true
}

function inventoryProjectResources(options) {
  const list = (kind, args) => command('docker', args, { allowFailure: true, label: `photo-storage ${kind} inventory`, suppressOutput: true }).stdout.split(/\r?\n/).filter(Boolean)
  const exactContainers = [`${options.project}-restore`, `${options.project}-object-storage-1`]
    .flatMap((name) => list('fixed container', ['ps', '-aq', '--filter', `name=^/${name}$`]))
  const exactVolumes = [exactObjectStorageVolumeName(options), `${options.project}-backup`, `${options.project}-restore`]
    .filter((name) => command('docker', ['volume', 'inspect', name], { allowFailure: true, label: 'photo-storage fixed volume inventory', suppressOutput: true }).status === 0)
  const exactNetworks = [`${options.project}_data`, `${options.project}_photo-storage-proof`]
    .filter((name) => command('docker', ['network', 'inspect', name], { allowFailure: true, label: 'photo-storage fixed network inventory', suppressOutput: true }).status === 0)
  return {
    containers: [...new Set([...list('container', ['ps', '-aq', '--filter', `label=com.docker.compose.project=${options.project}`]), ...exactContainers])],
    volumes: [...new Set([...list('volume', ['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${options.project}`]), ...exactVolumes])],
    networks: [...new Set([...list('network', ['network', 'ls', '-q', '--filter', `label=com.docker.compose.project=${options.project}`]), ...exactNetworks])],
  }
}

export function buildComposeArgs(options, args) {
  return [
    'compose', '--project-name', options.project, '--env-file', resolve(options.envFile),
    '--file', resolve(options.coreCompose), '--file', resolve(options.compose), '--file', resolve(options.proofCompose),
    ...args,
  ]
}

function sha256(value) { return createHash('sha256').update(value).digest('hex') }
function hmac(key, value) { return createHmac('sha256', key).update(value).digest() }
function awsEncode(value) { return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`) }
function canonicalPath(path) { return path.split('/').map((part) => awsEncode(part)).join('/') || '/' }
function canonicalQuery(query) { return [...query.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${awsEncode(key)}=${awsEncode(value)}`).join('&') }
function objectPath(bucket, key = '') { return `/${awsEncode(bucket)}${key ? `/${key.split('/').map(awsEncode).join('/')}` : ''}` }

export function signingKey(secret, date) {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), REGION), SERVICE), 'aws4_request')
}

export function buildAuthorization({ method, url, accessKey, secretKey, body = '', headers = {}, now = new Date() }) {
  const parsed = new URL(url)
  const payloadHash = sha256(body)
  const baseHeaders = { host: parsed.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': now.toISOString().replace(/[-:]|\.\d{3}/g, ''), ...headers }
  const normalized = Object.fromEntries(Object.entries(baseHeaders).map(([key, value]) => [key.toLowerCase(), String(value).trim().replace(/\s+/g, ' ')]))
  const signedHeaders = Object.keys(normalized).sort()
  const canonicalHeaders = signedHeaders.map((key) => `${key}:${normalized[key]}\n`).join('')
  const canonical = [method.toUpperCase(), canonicalPath(parsed.pathname), canonicalQuery(parsed.searchParams), canonicalHeaders, signedHeaders.join(';'), payloadHash].join('\n')
  const date = normalized['x-amz-date'].slice(0, 8)
  const scope = `${date}/${REGION}/${SERVICE}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', normalized['x-amz-date'], scope, sha256(canonical)].join('\n')
  const signature = createHmac('sha256', signingKey(secretKey, date)).update(stringToSign).digest('hex')
  return { ...normalized, authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders.join(';')}, Signature=${signature}` }
}

export function buildPresignedGet({ endpoint, bucket, key, accessKey, secretKey, expires = 60, now = new Date() }) {
  const parsed = new URL(`${endpoint.replace(/\/$/, '')}${objectPath(bucket, key)}`)
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, '')
  const date = amzDate.slice(0, 8)
  const scope = `${date}/${REGION}/${SERVICE}/aws4_request`
  parsed.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256')
  parsed.searchParams.set('X-Amz-Credential', `${accessKey}/${scope}`)
  parsed.searchParams.set('X-Amz-Date', amzDate)
  parsed.searchParams.set('X-Amz-Expires', String(expires))
  parsed.searchParams.set('X-Amz-SignedHeaders', 'host')
  const canonical = ['GET', canonicalPath(parsed.pathname), canonicalQuery(parsed.searchParams), `host:${parsed.host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n')
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n')
  parsed.searchParams.set('X-Amz-Signature', createHmac('sha256', signingKey(secretKey, date)).update(stringToSign).digest('hex'))
  return parsed.toString()
}

async function s3Request({ endpoint, method, bucket = '', key = '', query = {}, accessKey, secretKey, body = '', headers = {}, now, signal }) {
  const url = `${endpoint.replace(/\/$/, '')}${objectPath(bucket, key)}${Object.keys(query).length ? `?${new URLSearchParams(query)}` : ''}`
  const signed = buildAuthorization({ method, url, accessKey, secretKey, body, headers, now })
  const response = await fetch(url, { method, headers: signed, body: body || undefined, signal })
  const bytes = Buffer.from(await response.arrayBuffer())
  return { status: response.status, headers: response.headers, body: bytes }
}

function expectStatus(result, statuses, label) {
  if (!statuses.includes(result.status)) throw new Error(`${label} unexpected status ${result.status}`)
  return result
}

function throwPortBindingError(message) {
  throw new Error(message)
}

function exactRequestedBinding(bindings, expectedPort, message) {
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) throwPortBindingError(message)
  const keys = Object.keys(bindings)
  if (keys.length !== 1 || keys[0] !== '8333/tcp') throwPortBindingError(message)
  const entries = bindings['8333/tcp']
  if (!Array.isArray(entries) || entries.length !== 1) throwPortBindingError(message)
  const binding = entries[0]
  const bindingKeys = binding && typeof binding === 'object' && !Array.isArray(binding) ? Object.keys(binding).sort() : []
  if (bindingKeys.length !== 2 || bindingKeys[0] !== 'HostIp' || bindingKeys[1] !== 'HostPort' ||
      binding.HostIp !== '127.0.0.1' || binding.HostPort !== String(expectedPort)) throwPortBindingError(message)
  return binding
}

export function validateRequestedProofPortBinding(bindings, expectedPort = PROOF_PORT) {
  exactRequestedBinding(bindings, expectedPort, 'requested loopback port binding missing')
  return true
}

export function validateProofPortBinding(ports, expectedPort = PROOF_PORT) {
  if (!ports || typeof ports !== 'object' || Array.isArray(ports)) throwPortBindingError('effective loopback port binding missing')
  const keys = Object.keys(ports)
  const extraKeys = keys.filter((key) => key !== '8333/tcp')
  if (extraKeys.some((key) => ports[key] !== null)) throwPortBindingError('effective loopback port binding contradictory')
  if (!keys.includes('8333/tcp') || ports['8333/tcp'] === null) return false
  exactRequestedBinding({ '8333/tcp': ports['8333/tcp'] }, expectedPort, 'effective loopback port binding contradictory')
  return true
}

function proofPortReadinessError(reason, diagnostics) {
  return new Error(`proof port readiness ${reason} (status=${diagnostics.status ?? 'unknown'}, restartCount=${diagnostics.restartCount ?? 'unknown'}, running=${diagnostics.running ?? 'unknown'}, restarting=${diagnostics.restarting ?? 'unknown'}, effective=${diagnostics.effective}, httpStatus=${diagnostics.httpStatus ?? 'none'})`)
}

function retryableProofTransportError(error) {
  const name = String(error?.name ?? '')
  const message = String(error?.message ?? error ?? '')
  return name === 'AbortError' || name === 'TimeoutError' || name === 'TypeError' || /fetch failed|ECONNRESET|ECONNREFUSED|EPIPE|socket hang up|terminated/i.test(message)
}

export async function waitForProofPortReady({
  endpoint,
  inspect,
  expectedPort = PROOF_PORT,
  timeoutMs = 30_000,
  requestTimeoutMs = 1_000,
  request = (url, options) => fetch(url, options),
  sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds)),
  now = () => globalThis.performance?.now?.() ?? Date.now(),
}) {
  if (typeof inspect !== 'function' || typeof request !== 'function' || !Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new Error('proof port readiness configuration is invalid')
  }
  const startedAt = now()
  const target = `${String(endpoint).replace(/\/$/, '')}/`
  let lastHttpStatus = null
  let status = 'unknown'
  let restartCount = 'unknown'
  let running = 'unknown'
  let restarting = 'unknown'
  let effective = 'pending'
  for (;;) {
    const elapsed = now() - startedAt
    if (elapsed >= timeoutMs) throw proofPortReadinessError('timed out', { status, restartCount, running, restarting, effective, httpStatus: lastHttpStatus })
    let container = null
    let inspectFailed = false
    let containerReady = false
    const remainingBeforeInspect = timeoutMs - (now() - startedAt)
    if (remainingBeforeInspect <= 0) throw proofPortReadinessError('timed out', { status, restartCount, running, restarting, effective, httpStatus: lastHttpStatus })
    const inspectBudget = Math.max(1, Math.floor(Math.min(1_000, remainingBeforeInspect)))
    try {
      container = await inspect({ timeoutMs: inspectBudget })
    } catch {
      inspectFailed = true
      status = 'unknown'
      restartCount = 'unknown'
      running = 'unknown'
      restarting = 'unknown'
      effective = 'unknown'
    }
    if (container) {
      status = container.State?.Status ?? 'unknown'
      restartCount = Number.isInteger(container.RestartCount) ? container.RestartCount : 'unknown'
      running = container.State?.Running === true
      restarting = container.State?.Restarting === true
      validateRequestedProofPortBinding(container.HostConfig?.PortBindings, expectedPort)
      effective = validateProofPortBinding(container.NetworkSettings?.Ports, expectedPort) ? 'exact' : 'pending'
      if (['exited', 'dead', 'paused'].includes(status) || container.State?.OOMKilled === true) {
        throw proofPortReadinessError('container not running', { status, restartCount, running, restarting, effective, httpStatus: lastHttpStatus })
      }
      containerReady = status === 'running' && running === true && restarting !== true
    }
    const remaining = timeoutMs - (now() - startedAt)
    if (remaining <= 0) throw proofPortReadinessError('timed out', { status, restartCount, running, restarting, effective, httpStatus: lastHttpStatus })
    const requestBudget = Math.max(1, Math.floor(Math.min(requestTimeoutMs, remaining)))
    const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(requestBudget)
      : undefined
    try {
      const response = await request(target, { signal })
      lastHttpStatus = Number.isInteger(response?.status) ? response.status : null
      if ([200, 403, 404].includes(lastHttpStatus) && !inspectFailed && container && containerReady) return { status: lastHttpStatus, effective }
      if (lastHttpStatus >= 400 && lastHttpStatus < 500 && ![403, 404].includes(lastHttpStatus)) {
        throw proofPortReadinessError('returned an unexpected HTTP status', { status, restartCount, running, restarting, effective, httpStatus: lastHttpStatus })
      }
    } catch (error) {
      if (error?.message?.startsWith('proof port readiness returned an unexpected HTTP status')) throw error
      if (!retryableProofTransportError(error)) lastHttpStatus = null
    }
    const afterRequest = now() - startedAt
    if (afterRequest >= timeoutMs) throw proofPortReadinessError('timed out', { status, restartCount, running, restarting, effective, httpStatus: lastHttpStatus })
    await sleep(Math.min(250, Math.max(1, timeoutMs - afterRequest)))
  }
}

export function validateRestoreContainer(inspect, restoreVolume, expectedPort = PROOF_PORT + 1) {
  if (inspect?.Config?.Image !== STORAGE_IMAGE && !String(inspect?.Config?.Image).includes('@sha256:43b768cd62b00d132439cda881b93fd1adebf1b315e996e794087743821d771d')) throw new Error('restore image identity mismatch')
  validateRequestedProofPortBinding(inspect?.HostConfig?.PortBindings, expectedPort)
  if (!inspect?.Mounts?.some((mount) => mount?.Destination === '/data' && mount?.Name === restoreVolume)) throw new Error('restore storage volume identity mismatch')
  if (inspect?.State?.Running !== true) throw new Error('restore storage container is not running')
  return true
}

const RETRYABLE_EXACT_VERSION_STATUSES = new Set([404, 429, 500, 502, 503, 504])
const RETRYABLE_BUCKET_CONFIGURATION_STATUSES = new Set([404, 429, 500, 502, 503, 504])

function isRetryableExactVersionTransportError(error) {
  const name = String(error?.name ?? '')
  const message = String(error?.message ?? error ?? '')
  return name === 'AbortError' || name === 'TimeoutError' || /terminated|fetch failed|ECONNRESET|ECONNREFUSED|EPIPE|socket hang up/i.test(message)
}

function exactVersionFailure(attempts, lastStatus, reason) {
  return new Error(`exact-version GET ${reason} (attempts=${attempts}, lastStatus=${lastStatus ?? 'none'})`)
}

function bucketConfigurationFailure(attempts, lastStatus, reason) {
  return new Error(`bucket configuration GET ${reason} (attempts=${attempts}, lastStatus=${lastStatus ?? 'none'})`)
}

export async function waitForBucketConfiguration({
  endpoint,
  bucket,
  query,
  accessKey,
  secretKey,
  expected,
  timeoutMs = 60_000,
  requestTimeoutMs = 1_000,
  request = s3Request,
  sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds)),
  now = () => globalThis.performance?.now?.() ?? Date.now(),
}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0 || typeof expected !== 'function') {
    throw new Error('bucket configuration timeout configuration is invalid')
  }
  const startedAt = now()
  let attempts = 0
  let lastStatus = null
  for (;;) {
    const elapsed = now() - startedAt
    if (elapsed >= timeoutMs) throw bucketConfigurationFailure(attempts, lastStatus, 'timed out')
    attempts += 1
    const remaining = timeoutMs - elapsed
    const requestBudget = Math.max(1, Math.floor(Math.min(requestTimeoutMs, remaining)))
    const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(requestBudget)
      : undefined
    let response
    try {
      response = await request({ endpoint, method: 'GET', bucket, query, accessKey, secretKey, signal })
    } catch (error) {
      if (!isRetryableExactVersionTransportError(error)) throw bucketConfigurationFailure(attempts, lastStatus, 'failed')
    }
    if (response) {
      lastStatus = Number.isInteger(response.status) ? response.status : null
      if (lastStatus === 200) {
        let matches = false
        try { matches = expected(response.body ?? Buffer.alloc(0)) === true } catch { matches = false }
        if (matches) return response
      } else if (!RETRYABLE_BUCKET_CONFIGURATION_STATUSES.has(lastStatus)) {
        throw bucketConfigurationFailure(attempts, lastStatus, 'failed')
      }
    }
    if (now() - startedAt >= timeoutMs) throw bucketConfigurationFailure(attempts, lastStatus, 'timed out')
    await sleep(Math.min(500, timeoutMs - (now() - startedAt)))
  }
}

export async function waitForExactVersion({
  endpoint,
  bucket,
  key,
  versionId,
  accessKey,
  secretKey,
  expectedSha256,
  timeoutMs = 60_000,
  requestTimeoutMs = 1_000,
  request = s3Request,
  sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds)),
  now = () => globalThis.performance?.now?.() ?? Date.now(),
}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new Error('exact-version GET timeout configuration is invalid')
  }
  const startedAt = now()
  let attempts = 0
  let lastStatus = null
  for (;;) {
    const elapsed = now() - startedAt
    if (elapsed >= timeoutMs) throw exactVersionFailure(attempts, lastStatus, 'timed out')
    attempts += 1
    const remaining = timeoutMs - elapsed
    const requestBudget = Math.max(1, Math.floor(Math.min(requestTimeoutMs, remaining)))
    const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(requestBudget)
      : undefined
    let response
    try {
      response = await request({
        endpoint,
        method: 'GET',
        bucket,
        key,
        query: { versionId },
        accessKey,
        secretKey,
        signal,
      })
    } catch (error) {
      if (!isRetryableExactVersionTransportError(error)) {
        throw exactVersionFailure(attempts, lastStatus, 'failed')
      }
    }
    if (response) {
      lastStatus = Number.isInteger(response.status) ? response.status : null
      if (lastStatus === 200) {
        if (sha256(response.body ?? Buffer.alloc(0)) !== expectedSha256) {
          throw exactVersionFailure(attempts, lastStatus, 'returned an unexpected hash')
        }
        return response
      }
      if (!RETRYABLE_EXACT_VERSION_STATUSES.has(lastStatus)) {
        throw exactVersionFailure(attempts, lastStatus, 'failed')
      }
    }
    if (now() - startedAt >= timeoutMs) throw exactVersionFailure(attempts, lastStatus, 'timed out')
    await sleep(Math.min(500, timeoutMs - (now() - startedAt)))
  }
}

export function writeRuntimeInputs(options, root) {
  chmodSync(root, SYNTHETIC_PROOF_INPUT_ROOT_MODE)
  const values = {
    primaryKey: `synthetic-primary-${randomBytes(8).toString('hex')}`,
    primarySecret: `synthetic-primary-secret-${randomBytes(16).toString('hex')}`,
    recoveryKey: `synthetic-recovery-${randomBytes(8).toString('hex')}`,
    recoverySecret: `synthetic-recovery-secret-${randomBytes(16).toString('hex')}`,
  }
  for (const [name, value] of Object.entries({
    'primary-access-key-id': values.primaryKey,
    'primary-secret-access-key': values.primarySecret,
    'recovery-access-key-id': values.recoveryKey,
    'recovery-secret-access-key': values.recoverySecret,
  })) {
    const path = join(root, name)
    writeFileSync(path, `${value}\n`, { mode: SYNTHETIC_PROOF_SECRET_FILE_MODE })
    chmodSync(path, SYNTHETIC_PROOF_SECRET_FILE_MODE)
  }
  const env = join(root, 'storage.env')
  writeFileSync(env, [
    `HR_AXIS_RELEASE_ID=${options.releaseId}`,
    'HR_AXIS_PUBLIC_HOST=onprem-proof.example.invalid',
    'KEYCLOAK_SMTP_HOST=smtp.internal.example.invalid', 'KEYCLOAK_SMTP_FROM=synthetic@example.invalid',
    'HR_AXIS_BACKEND_IMAGE=busybox:1.36.1', 'HR_AXIS_FRONTEND_IMAGE=busybox:1.36.1',
    'CADDY_IMAGE=caddy:2.11.4-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648',
    'POSTGRES_IMAGE=postgres:16.15-alpine@sha256:44c4ee9810eff91f7eab4d822642e01115b1a9eccce4bcbdde7604752d68eac6',
    'REDIS_IMAGE=redis:7.4.10-alpine@sha256:e7723ff73d963f5cc6d9c4643ea3d989527a402a319239054e9472a7fb9219a2',
    `KEYCLOAK_IMAGE=busybox:1.36.1`, `SEAWEEDFS_IMAGE=${STORAGE_IMAGE}`,
    'PHOTO_MEDIA_PRIMARY_BUCKET=hr-axis-media-primary', 'PHOTO_MEDIA_RECOVERY_BUCKET=hr-axis-media-recovery',
    `PHOTO_MEDIA_SYNTHETIC_FIXTURE_SHA256_ALLOWLIST=${'a'.repeat(64)}`,
    `PHOTO_STORAGE_SECRET_ROOT=${root}`, `PHOTO_STORAGE_PROOF_PORT=${PROOF_PORT}`,
  ].join('\n') + '\n', { mode: SYNTHETIC_PROOF_ENV_FILE_MODE })
  chmodSync(env, SYNTHETIC_PROOF_ENV_FILE_MODE)
  return { env, ...values }
}

function secretLeakGuard(secrets) {
  return (capture) => {
    const output = `${capture.stdout ?? ''}\n${capture.stderr ?? ''}`
    for (const value of secrets) if (value && output.includes(value)) throw new Error('storage secret leaked into command output')
  }
}

async function runSyntheticProof(options) {
  const root = mkdtempSync(join(tmpdir(), 'hr-axis-photo-storage-proof-'))
  chmodSync(root, SYNTHETIC_PROOF_INPUT_ROOT_MODE)
  const input = writeRuntimeInputs(options, root)
  const secrets = [input.primaryKey, input.primarySecret, input.recoveryKey, input.recoverySecret]
  const endpoint = `http://127.0.0.1:${PROOF_PORT}`
  const base = (args, extra = {}) => command('docker', buildComposeArgs({ ...options, envFile: input.env }, args), { ...extra, secrets, inspectOutput: secretLeakGuard(secrets), label: `photo storage ${args[0]}` })
  const inspectContainer = (id, label = 'inspect object-storage', timeoutMs = 1_000) => JSON.parse(command('docker', ['inspect', id], { timeout: timeoutMs, label, secrets, inspectOutput: secretLeakGuard(secrets) }).stdout)[0]
  const primary = { accessKey: input.primaryKey, secretKey: input.primarySecret }
  const recovery = { accessKey: input.recoveryKey, secretKey: input.recoverySecret }
    const body = Buffer.from([0x00, 0x53, 0x79, 0x6e, 0x74, 0x68, 0x65, 0x74, 0x69, 0x63, 0x00, 0xff, 0x01, 0x0a])
  const fixtureHash = sha256(body)
  let containerId = ''
  let restoreId = ''
  let backupVolume = ''
  let restoreVolume = ''
  let objectVolume = ''
  let phase = 'startup'
  try {
    validateFreshExecutionInventory(inventoryProjectResources(options))
    command('docker', ['pull', STORAGE_IMAGE], { secrets, inspectOutput: secretLeakGuard(secrets), label: 'pull exact SeaweedFS image' })
    base(['--profile', 'proof', 'up', '-d', 'object-storage'])
    containerId = base(['ps', '-q', 'object-storage']).stdout.trim()
    if (!containerId) throw new Error('object-storage container identity missing')
    const inspect = inspectContainer(containerId)
    objectVolume = command('docker', ['inspect', '-f', '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}', containerId], { label: 'inspect storage volume' }).stdout.trim()
    if (!objectVolume) throw new Error('object-storage data volume identity missing')
    if (inspect.Config?.Image !== STORAGE_IMAGE && !String(inspect.Config?.Image).includes('@sha256:43b768cd62b00d132439cda881b93fd1adebf1b315e996e794087743821d771d')) throw new Error('object-storage image identity mismatch')
    validateRequestedProofPortBinding(inspect.HostConfig?.PortBindings)
    try {
      await waitForProofPortReady({ endpoint, inspect: ({ timeoutMs }) => inspectContainer(containerId, 'inspect object-storage', timeoutMs) })
    } catch (error) {
      const startup = base(['--profile', 'proof', 'logs', '--no-color', '--tail', '40', 'object-storage'], { allowFailure: true, suppressOutput: true })
      const tail = redact(`${startup.stderr}\n${startup.stdout}`, secrets).trim().split(/\r?\n/).slice(-40).join('\n')
      throw new Error(`${error.message}${tail ? `\n${tail}` : ''}`)
    }

    phase = 'bucket configuration'
    expectStatus(await s3Request({ endpoint, method: 'PUT', bucket: 'hr-axis-media-primary', ...primary, headers: { 'x-amz-bucket-object-lock-enabled': 'true' } }), [200, 204], 'create primary bucket')
    expectStatus(await s3Request({ endpoint, method: 'PUT', bucket: 'hr-axis-media-recovery', ...recovery, headers: { 'x-amz-bucket-object-lock-enabled': 'true' } }), [200, 204], 'create recovery bucket')
    const versioning = '<VersioningConfiguration><Status>Enabled</Status></VersioningConfiguration>'
    expectStatus(await s3Request({ endpoint, method: 'PUT', bucket: 'hr-axis-media-primary', query: { versioning: '' }, body: versioning, ...primary, headers: { 'content-type': 'application/xml' } }), [200, 204], 'enable primary versioning')
    expectStatus(await s3Request({ endpoint, method: 'PUT', bucket: 'hr-axis-media-recovery', query: { versioning: '' }, body: versioning, ...recovery, headers: { 'content-type': 'application/xml' } }), [200, 204], 'enable recovery versioning')
    for (const [bucket, credentials] of [['hr-axis-media-primary', primary], ['hr-axis-media-recovery', recovery]]) {
      await waitForBucketConfiguration({
        endpoint,
        bucket,
        query: { versioning: '' },
        ...credentials,
        expected: (responseBody) => /<VersioningConfiguration\b[^>]*>[\s\S]*?<Status>Enabled<\/Status>[\s\S]*?<\/VersioningConfiguration>/i.test(responseBody.toString('utf8')),
      })
      await waitForBucketConfiguration({
        endpoint,
        bucket,
        query: { 'object-lock': '' },
        ...credentials,
        expected: (responseBody) => /<ObjectLockConfiguration\b[^>]*>[\s\S]*?<ObjectLockEnabled>Enabled<\/ObjectLockEnabled>[\s\S]*?<\/ObjectLockConfiguration>/i.test(responseBody.toString('utf8')),
      })
    }

    phase = 'exact object and authorization proof'
    const retainUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const lockHeaders = { 'x-amz-object-lock-mode': 'COMPLIANCE', 'x-amz-object-lock-retain-until-date': retainUntil }
    const lockedKey = 'locked/companies/synthetic/media/fixture/canonical.webp'
    const put = await s3Request({ endpoint, method: 'PUT', bucket: 'hr-axis-media-primary', key: lockedKey, body, ...primary, headers: { 'x-amz-meta-sha256': fixtureHash, 'content-type': 'application/octet-stream', ...lockHeaders } })
    expectStatus(put, [200], 'put locked fixture')
    const versionId = put.headers.get('x-amz-version-id')
    if (!versionId) throw new Error('put fixture omitted a version id')
    const head = expectStatus(await s3Request({ endpoint, method: 'HEAD', bucket: 'hr-axis-media-primary', key: lockedKey, ...primary }), [200], 'head fixture')
    if (head.headers.get('x-amz-meta-sha256') !== fixtureHash) throw new Error('head metadata hash mismatch')
    const get = expectStatus(await s3Request({ endpoint, method: 'GET', bucket: 'hr-axis-media-primary', key: lockedKey, ...primary }), [200], 'get fixture')
    if (sha256(await getBody(get)) !== fixtureHash) throw new Error('get byte hash mismatch')
    expectStatus(await s3Request({ endpoint, method: 'GET', bucket: 'hr-axis-media-primary', key: lockedKey, ...recovery }), [403], 'cross-bucket credential denial')
    expectStatus(await s3Request({ endpoint, method: 'GET', bucket: 'hr-axis-media-primary', key: lockedKey }), [403], 'unsigned access denial')
    expectStatus(await s3Request({ endpoint, method: 'GET', bucket: 'hr-axis-media-primary', key: lockedKey, ...{ accessKey: 'wrong-key', secretKey: 'wrong-secret' } }), [403], 'wrong credential denial')
    const list = expectStatus(await s3Request({ endpoint, method: 'GET', bucket: 'hr-axis-media-primary', query: { versions: '' }, ...primary }), [200], 'list versions')
    if (!list.body.toString('utf8').includes(versionId)) throw new Error('version listing omitted exact version')

    phase = 'presigned read proof'
    const signed = buildPresignedGet({ endpoint, bucket: 'hr-axis-media-primary', key: lockedKey, ...primary, expires: 60 })
    const signedResponse = await fetch(signed)
    if (signedResponse.status !== 200 || sha256(Buffer.from(await signedResponse.arrayBuffer())) !== fixtureHash) throw new Error('presigned GET failed')
    const expired = buildPresignedGet({ endpoint, bucket: 'hr-axis-media-primary', key: lockedKey, ...primary, expires: 0, now: new Date(Date.now() - 120000) })
    if (![400, 403].includes((await fetch(expired)).status)) throw new Error('expired presigned GET was accepted')

    phase = 'delete and lock proof'
    const recoveryLocked = expectStatus(await s3Request({ endpoint, method: 'PUT', bucket: 'hr-axis-media-recovery', key: lockedKey, body, ...recovery, headers: { 'x-amz-meta-sha256': fixtureHash, 'content-type': 'application/octet-stream', ...lockHeaders } }), [200], 'put recovery locked fixture')
    const recoveryLockedVersion = recoveryLocked.headers.get('x-amz-version-id')
    if (!recoveryLockedVersion) throw new Error('recovery locked fixture omitted a version id')
    const transientKey = 'transient/companies/synthetic/media/fixture/raw'
    const derivedKey = 'derived/companies/synthetic/media/fixture/thumbnail.webp'
    const transient = expectStatus(await s3Request({ endpoint, method: 'PUT', bucket: 'hr-axis-media-primary', key: transientKey, body: Buffer.from('transient'), ...primary }), [200], 'put transient fixture')
    const transientVersion = transient.headers.get('x-amz-version-id')
    if (!transientVersion) throw new Error('transient fixture omitted a version id')
    const derived = expectStatus(await s3Request({ endpoint, method: 'PUT', bucket: 'hr-axis-media-primary', key: derivedKey, body: Buffer.from('derived'), ...primary }), [200], 'put derived fixture')
    const derivedVersion = derived.headers.get('x-amz-version-id')
    if (!derivedVersion) throw new Error('derived fixture omitted a version id')
    expectStatus(await s3Request({ endpoint, method: 'DELETE', bucket: 'hr-axis-media-primary', key: transientKey, query: { versionId: transientVersion }, ...primary }), [204, 200], 'delete transient exact version')
    expectStatus(await s3Request({ endpoint, method: 'DELETE', bucket: 'hr-axis-media-primary', key: derivedKey, query: { versionId: derivedVersion }, ...primary }), [204, 200], 'delete derived exact version')
    expectStatus(await s3Request({ endpoint, method: 'DELETE', bucket: 'hr-axis-media-primary', key: lockedKey, query: { versionId }, ...primary }), [403], 'primary locked DeleteObject denial')
    expectStatus(await s3Request({ endpoint, method: 'DELETE', bucket: 'hr-axis-media-recovery', key: lockedKey, query: { versionId: recoveryLockedVersion }, ...recovery }), [403], 'recovery locked DeleteObject denial')
    expectStatus(await s3Request({ endpoint, method: 'DELETE', bucket: 'hr-axis-media-primary', ...primary }), [403, 409], 'locked DeleteBucket denial')
    const primaryLockedAfterDenial = expectStatus(await s3Request({ endpoint, method: 'GET', bucket: 'hr-axis-media-primary', key: lockedKey, query: { versionId }, ...primary }), [200], 'primary locked version remains readable')
    const recoveryLockedAfterDenial = expectStatus(await s3Request({ endpoint, method: 'GET', bucket: 'hr-axis-media-recovery', key: lockedKey, query: { versionId: recoveryLockedVersion }, ...recovery }), [200], 'recovery locked version remains readable')
    if (sha256(await getBody(primaryLockedAfterDenial)) !== fixtureHash || sha256(await getBody(recoveryLockedAfterDenial)) !== fixtureHash) throw new Error('locked version hash mismatch after delete denial')

    phase = 'restart proof'
    base(['restart', 'object-storage'])
    await waitForProofPortReady({ endpoint, inspect: ({ timeoutMs }) => inspectContainer(containerId, 'inspect object-storage', timeoutMs) })
    await waitForExactVersion({
      endpoint,
      bucket: 'hr-axis-media-primary',
      key: lockedKey,
      versionId,
      expectedSha256: fixtureHash,
      ...primary,
    })
    phase = 'stopped-volume snapshot'
    backupVolume = command('docker', ['volume', 'create', '--label', `com.docker.compose.project=${options.project}`, '--label', 'com.hr-axis.project=hr-axis-onprem-core', '--label', 'com.hr-axis.data-class=synthetic', '--label', `com.hr-axis.release-id=${options.releaseId}`, '--label', 'com.hr-axis.volume-class=photo-storage-backup', `${options.project}-backup`], { label: 'create synthetic backup volume' }).stdout.trim()
    restoreVolume = command('docker', ['volume', 'create', '--label', `com.docker.compose.project=${options.project}`, '--label', 'com.hr-axis.project=hr-axis-onprem-core', '--label', 'com.hr-axis.data-class=synthetic', '--label', `com.hr-axis.release-id=${options.releaseId}`, '--label', 'com.hr-axis.volume-class=photo-storage-restore', `${options.project}-restore`], { label: 'create fresh restore volume' }).stdout.trim()
    base(['stop', 'object-storage'])
    command('docker', ['run', '--rm', '--entrypoint', '/bin/sh', '--volumes-from', containerId, '-v', `${backupVolume}:/backup`, STORAGE_IMAGE, '-ec', 'tar -cf /backup/object-storage.tar -C /data .'], { label: 'stopped-volume snapshot' })
    command('docker', ['run', '--rm', '--entrypoint', '/bin/sh', '-v', `${restoreVolume}:/restore`, '-v', `${backupVolume}:/backup`, STORAGE_IMAGE, '-ec', 'tar -xf /backup/object-storage.tar -C /restore'], { label: 'restore into fresh labeled volume' })
    // The restore is a consistent stopped-volume tar rehearsal; exact identity is checked by a fresh process below.
    phase = 'fresh-volume restore proof'
    restoreId = command('docker', ['run', '-d', '--name', `${options.project}-restore`, '--hostname', 'object-storage', '--read-only', '--cap-drop', 'ALL', '--cap-add', 'CHOWN', '--cap-add', 'SETGID', '--cap-add', 'SETUID', '--security-opt', 'no-new-privileges:true', '-p', `127.0.0.1:${PROOF_PORT + 1}:8333`, '-v', `${restoreVolume}:/data`, '-v', `${resolve(options.bootstrap)}:/opt/hr-axis/photo-storage/bootstrap.sh:ro`, '-v', `${join(root, 'primary-access-key-id')}:/run/secrets/photo_primary_access_key_id:ro`, '-v', `${join(root, 'primary-secret-access-key')}:/run/secrets/photo_primary_secret_access_key:ro`, '-v', `${join(root, 'recovery-access-key-id')}:/run/secrets/photo_recovery_access_key_id:ro`, '-v', `${join(root, 'recovery-secret-access-key')}:/run/secrets/photo_recovery_secret_access_key:ro`, '--tmpfs', '/run:rw,noexec,nosuid,nodev,size=16m', '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=32m', '-e', 'PHOTO_MEDIA_PRIMARY_BUCKET=hr-axis-media-primary', '-e', 'PHOTO_MEDIA_RECOVERY_BUCKET=hr-axis-media-recovery', '-e', 'PHOTO_MEDIA_PRIMARY_ACCESS_KEY_ID_FILE=/run/secrets/photo_primary_access_key_id', '-e', 'PHOTO_MEDIA_PRIMARY_SECRET_ACCESS_KEY_FILE=/run/secrets/photo_primary_secret_access_key', '-e', 'PHOTO_MEDIA_RECOVERY_ACCESS_KEY_ID_FILE=/run/secrets/photo_recovery_access_key_id', '-e', 'PHOTO_MEDIA_RECOVERY_SECRET_ACCESS_KEY_FILE=/run/secrets/photo_recovery_secret_access_key', '-e', 'SEAWEEDFS_IMAGE=' + STORAGE_IMAGE, '--entrypoint', '/bin/sh', STORAGE_IMAGE, '/opt/hr-axis/photo-storage/bootstrap.sh'], { label: 'start restored storage' }).stdout.trim()
    const restoreInspect = inspectContainer(restoreId, 'inspect restored storage')
    validateRestoreContainer(restoreInspect, restoreVolume)
    const restoreEndpoint = `http://127.0.0.1:${PROOF_PORT + 1}`
    await waitForProofPortReady({ endpoint: restoreEndpoint, expectedPort: PROOF_PORT + 1, inspect: ({ timeoutMs }) => inspectContainer(restoreId, 'inspect restored storage', timeoutMs) })
    await waitForExactVersion({
      endpoint: restoreEndpoint,
      bucket: 'hr-axis-media-primary',
      key: lockedKey,
      versionId,
      expectedSha256: fixtureHash,
      ...primary,
    })
    return buildSyntheticProofReceipt(options, {
      image: STORAGE_IMAGE,
      fixtureSha256: fixtureHash,
      versioning: 'enabled',
      perObjectRetention30Days: true,
      lockedPrefixRetention: 'COMPLIANCE_30_DAYS',
      primaryLockedDeleteDenied: true,
      recoveryLockedDeleteDenied: true,
      transientDelete: true,
      derivedDelete: true,
      privateAccess: true,
      crossBucketDenied: true,
      unsignedDenied: true,
      wrongCredentialDenied: true,
      presignedGet: true,
      presignedExpiryDenied: true,
      lockedDeleteBucketDenied: true,
      restartPreserved: true,
      stoppedVolumeSnapshot: true,
      restorePreserved: true,
    })
  } catch (error) {
    throw new Error(`${phase}: ${error.message}`)
  } finally {
    const cleanupFailures = []
    if (restoreId) {
      const result = command('docker', ['rm', '-f', restoreId], { allowFailure: true, label: 'remove restored storage', suppressOutput: true })
      if (result.status !== 0) cleanupFailures.push('remove restored storage')
    }
    const down = base(['--profile', 'proof', 'down', '--remove-orphans'], { allowFailure: true, label: 'remove storage compose resources', suppressOutput: true })
    if (down.status !== 0) cleanupFailures.push('remove storage compose resources')
    if (!objectVolume) {
      try {
        const candidate = exactObjectStorageVolumeName(options)
        const inspected = command('docker', ['volume', 'inspect', candidate], { allowFailure: true, label: 'inspect exact storage volume fallback', suppressOutput: true })
        if (inspected.status === 0) {
          const volume = JSON.parse(inspected.stdout)[0]
          validateCleanupVolumeIdentity(volume?.Labels ?? {}, options, 'photo-object-storage')
          objectVolume = candidate
        }
      } catch {
        cleanupFailures.push('remove photo-object-storage')
      }
    }
    for (const [volume, volumeClass] of [[objectVolume, 'photo-object-storage'], [backupVolume, 'photo-storage-backup'], [restoreVolume, 'photo-storage-restore']]) {
      if (!volume) continue
      try {
        const inspected = JSON.parse(command('docker', ['volume', 'inspect', volume], { label: 'inspect labeled storage rehearsal volume' }).stdout)[0]
        validateCleanupVolumeIdentity(inspected.Labels ?? {}, options, volumeClass)
        const result = command('docker', ['volume', 'rm', volume], { allowFailure: true, label: 'remove labeled storage rehearsal volume', suppressOutput: true })
        if (result.status !== 0) cleanupFailures.push(`remove ${volumeClass}`)
      } catch {
        cleanupFailures.push(`remove ${volumeClass}`)
      }
    }
    rmSync(root, { recursive: true, force: true })
    if (cleanupFailures.length > 0) throw new Error(`photo-storage cleanup failed: ${cleanupFailures.join(', ')}`)
  }
}

async function getBody(response) {
  if (response.body instanceof ArrayBuffer) return Buffer.from(response.body)
  return Buffer.from(response.body ?? '')
}

function parseArgs(argv) {
  const options = { compose: 'infra/onprem/photo-storage/compose.yaml', proofCompose: 'infra/onprem/photo-storage/compose.proof.yaml', coreCompose: 'infra/onprem/core/compose.yaml', bootstrap: 'infra/onprem/photo-storage/bootstrap.sh', project: STORAGE_PROJECT, execute: false, cleanup: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--compose') options.compose = argv[++i]
    else if (arg === '--proof-compose') options.proofCompose = argv[++i]
    else if (arg === '--core-compose') options.coreCompose = argv[++i]
    else if (arg === '--project') options.project = argv[++i]
    else if (arg === '--release-id') options.releaseId = argv[++i]
    else if (arg === '--receipt') options.receipt = argv[++i]
    else if (arg === '--execute') options.execute = true
    else if (arg === '--cleanup') options.cleanup = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  if (!options.releaseId || !SANITIZED_RELEASE_ID_PATTERN.test(options.releaseId)) throw new Error('--release-id must be sanitized')
  if (options.project !== STORAGE_PROJECT) throw new Error(`storage runtime requires project ${STORAGE_PROJECT}`)
  if (!options.execute && !options.cleanup) throw new Error('explicit --execute or --cleanup is required')
  return options
}

function cleanup(options) {
  const ids = command('docker', ['ps', '-aq', '--filter', `label=com.docker.compose.project=${options.project}`], { allowFailure: true, label: 'storage cleanup inventory' }).stdout.split(/\r?\n/).filter(Boolean)
  for (const id of ids) {
    const inspect = JSON.parse(command('docker', ['inspect', id], { label: 'storage cleanup inspect' }).stdout)[0]
    validateCleanupIdentity(inspect.Config?.Labels ?? {}, options)
  }
  if (ids.length) command('docker', ['rm', '-f', ...ids], { label: 'storage cleanup containers' })
  const volumeIds = command('docker', ['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${options.project}`], { allowFailure: true, label: 'storage cleanup volume inventory' }).stdout.split(/\r?\n/).filter(Boolean)
  for (const volume of volumeIds) {
    const inspect = JSON.parse(command('docker', ['volume', 'inspect', volume], { label: 'storage cleanup volume inspect' }).stdout)[0]
    const labels = inspect.Labels ?? {}
    for (const key of ['com.docker.compose.project', 'com.hr-axis.project', 'com.hr-axis.data-class', 'com.hr-axis.release-id']) if (labels[key] !== (key === 'com.docker.compose.project' ? options.project : key === 'com.hr-axis.project' ? 'hr-axis-onprem-core' : key === 'com.hr-axis.data-class' ? 'synthetic' : options.releaseId)) throw new Error('storage cleanup refused mismatched volume label')
    if (!['photo-object-storage', 'photo-storage-backup', 'photo-storage-restore'].includes(labels['com.hr-axis.volume-class'])) throw new Error('storage cleanup refused unexpected volume class')
  }
  if (volumeIds.length) command('docker', ['volume', 'rm', ...volumeIds], { label: 'storage cleanup volumes' })
  return { cleaned: true, project: options.project, releaseId: options.releaseId }
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  const receipt = options.cleanup ? cleanup(options) : await runSyntheticProof(options)
  if (options.receipt) writeFileSync(resolve(options.receipt), `${JSON.stringify(receipt)}\n`, { mode: 0o600 })
  console.log(JSON.stringify(receipt))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((error) => { console.error(redact(error.message)); process.exitCode = 1 })
