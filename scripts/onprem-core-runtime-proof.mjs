import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectFirewallEvidence, validateFirewallRules } from './onprem-core-firewall-verify.mjs'
import { assertControlledKeycloakStop, assertGracefulStopState, assertKeycloakContainerIdentity, assertKeycloakPreStopState, buildKeycloakStopArgs, observeKeycloakGracefulStop } from './onprem-graceful-stop-contract.mjs'
import {
  buildTlsProbeDockerArgs, CADDY_CMDLINE, CADDY_IMAGE,
  classifyTlsProbeResult, sanitizeTlsErrorCode, TLS_PROBE_MARKER,
  verifyCaddyRuntimeInvariants,
} from './onprem-caddy-runtime-proof.mjs'
import { assertPostRedisLoadCheckpoint, assertProbeOutput, assertStoppedAofCommandSequence, buildQueueSnapshotComposeArgs, classifyQueueFailureReason, classifyRedisPersistenceLogs, collectRedisRestartLogDelta, collectStoppedAofInventoryEvidence, createRuntimeIsolationControls, parseStoppedAofInventory, sanitizeQueuePersistenceCheckpoint } from './onprem-redis-persistence-diagnostic.mjs'
export {
  buildTlsProbeDockerArgs, classifyTlsProbeResult,
  sanitizeTlsErrorCode, TLS_WRONG_CA_CODES,
  verifyCaddyRuntimeInvariants,
} from './onprem-caddy-runtime-proof.mjs'
export { assertProbeOutput, classifyRedisPersistenceLogs, parseProbeCompletion, parseStoppedAofInventory, sanitizeQueuePersistenceCheckpoint } from './onprem-redis-persistence-diagnostic.mjs'
const PRIVATE_SUBNETS = ['172.30.0.0/24', '172.30.10.0/24', '172.30.20.0/24', '172.30.30.0/24']
const LONG_LIVED = ['caddy', 'frontend', 'api', 'worker', 'postgres', 'redis', 'keycloak']
const CORE_CLEANUP_PROFILES = ['infra', 'migrate', 'seed', 'runtime']
const CORE_ALLOWED_SERVICES = new Set(['api', 'caddy', 'frontend', 'identity-binder', 'keycloak', 'keycloak-bootstrap', 'migrator', 'postgres', 'redis', 'synthetic-seed', 'worker'])
const EXPECTED_LIMITS = { caddy: [0.25, 128 * 1024 * 1024, 64], frontend: [0.25, 128 * 1024 * 1024, 64], api: [0.75, 1536 * 1024 * 1024, 192], worker: [0.75, 1536 * 1024 * 1024, 192], postgres: [1.0, 2048 * 1024 * 1024, 192], keycloak: [0.5, 2048 * 1024 * 1024, 256], redis: [0.5, 768 * 1024 * 1024, 96] }
let activeSecretValues = []
export function redact(value) {
  let redacted = String(value)
    .replace(/(postgres(?:ql)?|redis):\/\/[^\s:@]+:[^\s@]+@/gi, '$1://[redacted]@')
    .replace(/(password|secret|token)=\S+/gi, '$1=[redacted]')
  for (const secret of activeSecretValues) {
    if (secret) redacted = redacted.replaceAll(secret, '[redacted]')
  }
  return redacted
}
function boundedText(value, limit = 768) {
  const text = String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
  return text.length <= limit ? text : `${text.slice(0, limit)}…[truncated]`
}
export function serviceFailureDiagnostic({ service, state = {}, logs = '', secretValues = new Map() }) {
  const redactDiagnostic = (value) => {
    let result = redact(String(value ?? ''))
    for (const secret of secretValues.values()) {
      if (secret) result = result.replaceAll(secret, '[redacted]')
    }
    return boundedText(result)
  }
  const healthEntries = (state.Health?.Log ?? []).slice(-3).map((entry) => ({
    exitCode: Number.isInteger(entry?.ExitCode) ? entry.ExitCode : null,
    output: redactDiagnostic(entry?.Output),
  }))
  const logTail = String(logs ?? '').split(/\r?\n/).filter(Boolean).slice(-12).join('\n')
  const diagnostic = {
    service: redactDiagnostic(service),
    state: {
      status: redactDiagnostic(state.Status),
      exitCode: Number.isInteger(state.ExitCode) ? state.ExitCode : null,
      oomKilled: state.OOMKilled === true,
      error: redactDiagnostic(state.Error),
    },
    health: state.Health ? {
      status: redactDiagnostic(state.Health.Status),
      recent: healthEntries,
    } : null,
    logs: redactDiagnostic(logTail),
  }
  return boundedText(JSON.stringify(diagnostic), 4096)
}
export function command(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env ?? process.env,
    input: options.input,
    windowsHide: true,
  }); const output = { status: result.status ?? -1, stderr: result.stderr ?? '', stdout: result.stdout ?? '' }; let inspectionFailed = false; try { options.inspectOutput?.(output) } catch { inspectionFailed = true }
  if (result.error || (!options.allowFailure && result.status !== 0)) { const tail = options.suppressOutput || inspectionFailed ? '' : redact(`${result.stderr ?? ''}\n${result.stdout ?? ''}`).trim().split(/\r?\n/).slice(-12).join('\n')
    throw new Error(`${options.label ?? command} failed${tail ? `\n${tail}` : ''}`)
  }
  if (inspectionFailed) throw new Error(`${options.label ?? command} output inspection failed`); return output
}
function parseArgs(argv) {
  const options = {
    compose: 'infra/onprem/core/compose.yaml',
    project: 'hr-axis-onprem-core',
    sshAdminCidrs: [],
    cleanup: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--compose') options.compose = argv[++index]
    else if (arg === '--env-file') options.envFile = argv[++index]
    else if (arg === '--project') options.project = argv[++index]
    else if (arg === '--release-id') options.releaseId = argv[++index]
    else if (arg === '--ssh-admin-cidr') options.sshAdminCidrs.push(argv[++index])
    else if (arg === '--receipt') options.receipt = argv[++index]
    else if (arg === '--require-fresh-volumes') options.requireFreshVolumes = true
    else if (arg === '--execute') options.execute = true
    else if (arg === '--cleanup') options.cleanup = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  if (!options.envFile) throw new Error('--env-file is required')
  if (!options.releaseId || !/^[A-Za-z0-9._-]{8,128}$/.test(options.releaseId)) throw new Error('--release-id must be an exact sanitized release identity')
  if (!options.execute && !options.cleanup) throw new Error('full Linux/Docker proof or guarded cleanup requires an explicit mode')
  if (options.execute && options.sshAdminCidrs.length === 0) throw new Error('at least one --ssh-admin-cidr is required')
  if (options.cleanup && options.project !== 'hr-axis-onprem-core') throw new Error('core runtime cleanup refuses an unapproved Compose project')
  if (options.execute && process.platform !== 'linux') throw new Error('full runtime proof is Linux-only; docker compose config remains portable')
  return options
}
function coreComposeBaseArgs(options) {
  return [
    'compose',
    '--project-name', options.project,
    '--env-file', resolve(options.envFile),
    '--file', resolve(options.compose),
  ]
}
export function validateCoreCleanupContainerIdentities(containers, options, label = 'Core runtime cleanup') {
  const services = new Set()
  return containers.map((container) => {
    const labels = container?.Config?.Labels ?? container?.labels ?? {}
    const service = labels['com.docker.compose.service']
    if (labels['com.docker.compose.project'] !== options.project
      || !CORE_ALLOWED_SERVICES.has(service)
      || labels['com.hr-axis.project'] !== 'hr-axis-onprem-core'
      || labels['com.hr-axis.data-class'] !== 'synthetic'
      || labels['com.hr-axis.release-id'] !== options.releaseId) {
      throw new Error(`${label} refused unexpected or mismatched project container`)
    }
    if (labels['com.docker.compose.container-number'] !== '1') {
      throw new Error(`${label} refused non-1 Compose container-number for ${service ?? 'unknown service'}`)
    }
    if (labels['com.docker.compose.oneoff'] !== 'False') {
      throw new Error(`${label} refused one-off Compose container for ${service ?? 'unknown service'}`)
    }
    if (services.has(service)) throw new Error(`${label} refused duplicate Compose service identity: ${service}`)
    services.add(service)
    return { id: container.id, service }
  })
}
function listCoreCleanupContainers(options, label) {
  const raw = command('docker', [
    'ps', '-aq', '--filter', `label=com.docker.compose.project=${options.project}`,
  ], { label: `${label} container inventory` }).stdout
  const ids = raw.split(/\r?\n/).map((id) => id.trim()).filter(Boolean)
  const containers = ids.map((id) => {
    let inspected
    try {
      inspected = JSON.parse(command('docker', ['inspect', id], { label: `${label} container inspect` }).stdout)[0]
    } catch {
      throw new Error(`${label} refused an unreadable container identity`)
    }
    return { id, Config: inspected?.Config }
  })
  return validateCoreCleanupContainerIdentities(containers, options, label)
}
function guardedCoreDown(options, label = 'Core runtime cleanup') {
  if (options.project !== 'hr-axis-onprem-core') throw new Error('core runtime cleanup refuses an unapproved Compose project')
  if (!options.releaseId || !/^[A-Za-z0-9._-]{8,128}$/.test(options.releaseId)) {
    throw new Error('core runtime cleanup requires an exact sanitized release identity')
  }
  listCoreCleanupContainers(options, label)
  const profiles = CORE_CLEANUP_PROFILES.flatMap((profile) => ['--profile', profile])
  command('docker', [
    ...coreComposeBaseArgs(options),
    ...profiles,
    'down', '--remove-orphans',
  ], { label })
  const remaining = listCoreCleanupContainers(options, `${label} postcondition`)
  if (remaining.length > 0) throw new Error(`${label} left project containers behind`)
  return { cleaned: true, project: options.project, releaseId: options.releaseId }
}
export function cleanupCoreRuntime(options) {
  return guardedCoreDown(options)
}
function immutableImage(value) {
  return (/^sha256:[0-9a-f]{64}$/i.test(value) || /@sha256:[0-9a-f]{64}$/i.test(value)) && !/sha256:0{64}$/i.test(value)
}
function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}
export function assertSecretSourceMetadata(name, metadata) {
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`secret source is not a regular non-symlink file: ${name}`)
  }
}
export function assertNoSecretLeak(secretValues, surfaces) {
  for (const [surface, value] of Object.entries(surfaces)) {
    const serialized = String(value ?? '')
    for (const [name, secret] of secretValues) {
      if (secret && serialized.includes(secret)) {
        throw new Error(`secret value leaked into ${surface}: ${name}`)
      }
    }
  }
}
export const isConfidentialRuntimeSecretName = (name) => String(name) !== 'keycloak_database_username'
export function migrationTreeDigestFromOutput(output) {
  const digest = String(output?.stdout ?? '').match(
    /"migrationTreeDigest":"([0-9a-f]{64})"/i,
  )?.[1]
  if (!digest) throw new Error('migration runner omitted its resolved tree digest')
  return digest.toLowerCase()
}
export function parseMigrationIdentity(value) {
  const match = String(value).match(/^(\d+)\|t\|([0-9a-f]{64})$/)
  const succeededCount = Number(match?.[1])
  if (!match || !Number.isSafeInteger(succeededCount)) {
    throw new Error('migration idempotency/checksum proof mismatch')
  }
  return { identity: match[2], succeededCount }
}
export function parseSequencePrivilegeMatrix(value) {
  if (String(value) !== 't|t|f|t|t|f') {
    throw new Error('runtime sequence least-privilege contract mismatch')
  }
  return {
    api: { select: true, update: false, usage: true },
    worker: { select: true, update: false, usage: true },
  }
}
export const EXPECTED_PUBLIC_SECRET_NAMES = Object.freeze(['caddy_tls_certificate', 'caddy_tls_ca', 'postgres_tls_certificate', 'postgres_tls_ca'])
export const EXPECTED_SECRET_UIDS = Object.freeze({ caddy_tls_private_key: 10001, postgres_tls_private_key: 70, postgres_bootstrap_password: 70, postgres_migrator_password: 70, postgres_api_password: 70, postgres_worker_password: 70, redis_users_acl: 999, redis_health_url: 999, migrator_database_url: 65532, api_database_url: 65532, worker_database_url: 65532, redis_api_url: 65532, redis_worker_url: 65532, browser_session_secret: 65532, binder_database_url: 1000, keycloak_database_url: 1000, keycloak_database_username: 1000, keycloak_database_password: 1000, postgres_keycloak_database_password: 70, keycloak_bootstrap_username: 1000, keycloak_bootstrap_password: 1000, keycloak_smtp_auth_user: 1000, keycloak_smtp_password: 1000, keycloak_synthetic_accounts: 1000 })
function assertSecretPermissions(config) {
  const publicFiles = new Set(EXPECTED_PUBLIC_SECRET_NAMES)
  const expectedUid = new Map(Object.entries(EXPECTED_SECRET_UIDS))
  for (const [name, descriptor] of Object.entries(config.secrets ?? {})) {
    const path = descriptor.file
    const stat = lstatSync(path)
    const mode = stat.mode & 0o777
    assertSecretSourceMetadata(name, stat)
    if (publicFiles.has(name)) {
      if ((mode & 0o022) !== 0 || (mode & 0o444) === 0) throw new Error(`public certificate/CA permissions are unsafe: ${name}`)
      continue
    }
    if (!expectedUid.has(name)) throw new Error(`secret ownership contract is missing: ${name}`)
    if (stat.uid !== expectedUid.get(name) || ![0o400, 0o600].includes(mode)) {
      throw new Error(`secret ${name} must be owned by uid ${expectedUid.get(name)} with mode 0400 or 0600`)
    }
  }
}
function ipv4InCidr(ip, cidr) {
  const [base, bitsText] = cidr.split('/')
  const bits = Number(bitsText)
  const number = (value) => value.split('.').reduce((result, octet) => (result * 256 + Number(octet)) >>> 0, 0)
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return (number(ip) & mask) === (number(base) & mask)
}
function observeNoExternalFlows(privateIps) {
  let text = ''
  try {
    text = execFileSync('conntrack', ['-L', '-o', 'extended'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch {
    try {
      text = readFileSync('/proc/net/nf_conntrack', 'utf8')
    } catch {
      throw new Error('read-only conntrack observation is unavailable; zero-external-flow proof fails closed')
    }
  }
  const violations = []
  for (const line of text.split(/\r?\n/)) {
    const source = line.match(/\bsrc=(\d+\.\d+\.\d+\.\d+)/)?.[1]
    const destination = line.match(/\bdst=(\d+\.\d+\.\d+\.\d+)/)?.[1]
    if (!source || !destination || !privateIps.has(source)) continue
    if (!PRIVATE_SUBNETS.some((cidr) => ipv4InCidr(destination, cidr))) violations.push({ source, destination })
  }
  if (violations.length > 0) throw new Error(`external flow observation failed with ${violations.length} project-origin flow(s)`)
  return { observedLines: text.split(/\r?\n/).filter(Boolean).length, projectExternalFlows: 0 }
}
export function egressRejectCounters(text) {
  const counters = new Map()
  for (const subnet of PRIVATE_SUBNETS) {
    const line = text.split(/\r?\n/).find((candidate) =>
      candidate.includes('-A DOCKER-USER ')
        && candidate.includes(`-s ${subnet}`)
        && /--ctstate NEW/.test(candidate)
        && /-j (?:REJECT|DROP)\b/.test(candidate),
    )
    if (!line) throw new Error(`missing counted DOCKER-USER egress rejection for ${subnet}`)
    const prefix = line.match(/^\[(\d+):(\d+)\]/)
    const suffix = line.match(/(?:^|\s)-c\s+(\d+)\s+(\d+)(?:\s|$)/)
    const packets = Number(prefix?.[1] ?? suffix?.[1])
    const bytes = Number(prefix?.[2] ?? suffix?.[2])
    if (!Number.isSafeInteger(packets) || !Number.isSafeInteger(bytes)) {
      throw new Error(`iptables-save -c omitted counters for ${subnet}`)
    }
    counters.set(subnet, { bytes, packets })
  }
  return counters
}
export function buildRedisProbeComposeArgs(service, script) {
  if (!['api', 'worker'].includes(service)) throw new Error('Redis probe requires an approved runtime service')
  if (!String(script ?? '').trim()) throw new Error('Redis probe script is required')
  return ['run', '--rm', '--no-deps', '--entrypoint', '/nodejs/bin/node', service, '-e', script]
}
async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.cleanup) {
    cleanupCoreRuntime(options)
    console.log('on-prem core runtime cleanup: PASS (exact project, guarded identity)')
    return
  }
  const composePath = resolve(options.compose)
  const envPath = resolve(options.envFile)
  const base = ['compose', '--project-name', options.project, '--env-file', envPath, '--file', composePath]
  const composeArgs = (args, profiles = []) => [...base, ...profiles.flatMap((profile) => ['--profile', profile]), ...args]
  let secretValues = new Map()
  const compose = (args, profiles = [], label = `docker compose ${args[0]}`) => {
    const result = command('docker', composeArgs(args, profiles), { label })
    if (secretValues.size > 0) {
      assertNoSecretLeak(secretValues, {
        [`docker compose ${args[0]} stderr`]: result.stderr,
        [`docker compose ${args[0]} stdout`]: result.stdout,
      })
    }
    return result
  }
  const composeExpectedFailure = (args, profiles, label) => {
    const result = command('docker', composeArgs(args, profiles), { allowFailure: true, label })
    if (secretValues.size > 0) {
      assertNoSecretLeak(secretValues, {
        [`${label} stderr`]: result.stderr,
        [`${label} stdout`]: result.stdout,
      })
    }
    return result
  }
  const configResult = compose(['config', '--format', 'json'], ['infra', 'migrate', 'seed', 'runtime'])
  const config = JSON.parse(configResult.stdout)
  const serializedConfig = JSON.stringify(config)
  const receipt = {
    dataClass: 'synthetic',
    firewall: null,
    flowObservation: null,
    egressRejectPacketDelta: null,
    freshVolumes: null,
    images: {},
    migration: null,
    databaseRoles: null,
    caddyRuntime: null,
    project: options.project,
    releaseId: options.releaseId,
    resources: 'exact-approved-ceilings',
    seedAggregates: null,
    services: LONG_LIVED,
    outageRecovery: null,
    redisPersistenceDiagnostics: null,
    volumeRecovery: 'same-volume-only', keycloakLifecycleProof: null,
  }
  if (config.name !== options.project) throw new Error('Compose project identity mismatch')
  if (config.services.caddy.image !== CADDY_IMAGE) throw new Error('Caddy must use the exact approved upstream image identity')
  if (config.services.caddy.environment.HR_AXIS_PUBLIC_HOST === 'hr-axis.example.invalid') throw new Error('placeholder public host is forbidden in executable proof')
  for (const [name, service] of Object.entries(config.services)) {
    if (!immutableImage(service.image)) throw new Error(`service ${name} does not use an exact immutable image identity`)
    if (service.labels?.['com.hr-axis.release-id'] !== options.releaseId) throw new Error(`service ${name} release identity mismatch`)
  }
  assertSecretPermissions(config)
  secretValues = new Map(
    Object.entries(config.secrets ?? {})
      .filter(([name]) => isConfidentialRuntimeSecretName(name))
      .map(([name, descriptor]) => [name, readFileSync(descriptor.file, 'utf8').trim()]),
  )
  activeSecretValues = [...secretValues.values()].filter(Boolean)
  assertNoSecretLeak(secretValues, { 'docker compose config': serializedConfig })
  const caddyfilePath = resolve(dirname(composePath), 'caddy', 'Caddyfile')
  receipt.caddyRuntime = {
    bootstrapDigest: sha256(JSON.stringify({
      command: config.services.caddy.command,
      entrypoint: config.services.caddy.entrypoint,
    })),
    caddyfileDigest: sha256(readFileSync(caddyfilePath)),
    upstreamImage: CADDY_IMAGE,
  }
  if (options.requireFreshVolumes) {
    const existingVolumes = command('docker', ['volume', 'ls', '--quiet', '--filter', `label=com.hr-axis.project=${options.project}`], { label: 'fresh volume precondition' }).stdout.trim()
    const expectedNames = [`${options.project}_postgres_data`, `${options.project}_redis_data`]
    const nameCollisions = expectedNames.filter((name) => command('docker', ['volume', 'inspect', name], { allowFailure: true, label: `inspect volume ${name}` }).status === 0)
    if (existingVolumes || nameCollisions.length > 0) throw new Error('fresh-volume proof found an existing labelled or exact-name project volume')
    receipt.freshVolumes = true
  }
  const firewallText = collectFirewallEvidence()
  const firewall = validateFirewallRules({
    iptables: firewallText,
    privateSubnets: PRIVATE_SUBNETS,
    proxyPorts: [443],
    sshAdminCidrs: options.sshAdminCidrs,
  })
  if (!firewall.ok) throw new Error(`host firewall contract failed: ${firewall.errors.join('; ')}`)
  receipt.firewall = firewall.summary
  const initialRejectCounters = egressRejectCounters(collectFirewallEvidence({ counters: true }))
  const waitHealthy = (service, attempts = 60) => {
    const id = compose(['ps', '--quiet', service], ['infra', 'runtime']).stdout.trim()
    if (!id) throw new Error(`${service} container is missing`)
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const state = JSON.parse(command('docker', ['inspect', id], { label: `inspect ${service}` }).stdout)[0].State
      if (state.Status === 'running' && (!state.Health || state.Health.Status === 'healthy')) return id
      if (['dead', 'exited', 'removing'].includes(state.Status) || state.OOMKilled === true || Boolean(state.Error)) {
        const logs = command('docker', ['logs', '--tail', '12', id], { allowFailure: true, label: `logs ${service}` })
        throw new Error(`${service} terminated before becoming healthy\n${serviceFailureDiagnostic({
          service,
          state,
          logs: `${logs.stderr}\n${logs.stdout}`,
          secretValues,
        })}`)
      }
      command(process.execPath, ['-e', 'setTimeout(()=>{},1000)'], { label: 'health wait' })
    }
    const state = JSON.parse(command('docker', ['inspect', id], { label: `inspect ${service}` }).stdout)[0].State
    const logs = command('docker', ['logs', '--tail', '12', id], { allowFailure: true, label: `logs ${service}` })
    throw new Error(`${service} did not become healthy\n${serviceFailureDiagnostic({
      service,
      state,
      logs: `${logs.stderr}\n${logs.stdout}`,
      secretValues,
    })}`)
  }
  const waitUnhealthy = (service, attempts = 150) => {
    const id = compose(['ps', '--quiet', service], ['infra', 'runtime']).stdout.trim()
    if (!id) throw new Error(`${service} container is missing during outage proof`)
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const state = JSON.parse(command('docker', ['inspect', id], { label: `inspect ${service}` }).stdout)[0].State
      if (state.Status === 'running' && state.Health?.Status === 'unhealthy') return id
      command(process.execPath, ['-e', 'setTimeout(()=>{},1000)'], { label: 'unhealthy wait' })
    }
    throw new Error(`${service} did not become unhealthy during the Redis outage`)
  }
  const inspectContainer = (containerId, label) => { const inspectResult = command('docker', ['inspect', containerId], { label }); assertNoSecretLeak(secretValues, { [`${label} output`]: inspectResult.stdout, [`${label} errors`]: inspectResult.stderr }); const record = JSON.parse(inspectResult.stdout)[0]; if (!record) throw new Error(`${label} returned no container identity`); return record }
  const assertStoppedServiceState = (service, profiles, phase) => { const containerId = compose(['ps', '--all', '--quiet', service], profiles).stdout.trim(); if (!containerId) throw new Error(`${service} container is missing during ${phase} stop proof`); const inspect = inspectContainer(containerId, `inspect stopped ${service}`); return assertGracefulStopState({ service, state: inspect.State ?? {}, logs: '', secretValues }) }
  const captureKeycloakBeforeStop = (phase) => { const candidateId = compose(['ps', '--all', '--quiet', '--no-trunc', 'keycloak'], ['runtime'], `${phase} Keycloak identity`).stdout.trim(); if (!candidateId) throw new Error(`Keycloak container is missing during ${phase}`); const inspect = inspectContainer(candidateId, `${phase} Keycloak state`); const identity = assertKeycloakPreStopState({ containerId: candidateId, inspect }); return { ...identity, inspect } }
  const observeStoppedKeycloak = ({ identity, inspect }) => observeKeycloakGracefulStop({ service: 'keycloak', state: inspect.State ?? {}, secretValues, readLogs: ({ since, timestamps }) => { if (since !== inspect.State?.StartedAt || timestamps !== true) throw new Error('Keycloak log reader received an invalid fresh-log window'); const logs = command('docker', ['logs', '--since', since, '--timestamps', identity.containerId], { label: 'stopped Keycloak logs', suppressOutput: true, inspectOutput: (capture) => assertNoSecretLeak(secretValues, { 'stopped Keycloak logs': `${capture.stderr ?? ''}\n${capture.stdout ?? ''}` }) }); return `${logs.stderr ?? ''}\n${logs.stdout ?? ''}` } })
  const verifyKeycloakRestartIdentity = (identity, phase) => { const inspect = inspectContainer(identity.containerId, `${phase} Keycloak state`); const sameIdentity = assertKeycloakContainerIdentity({ containerId: identity.containerId, inspect, expectedRestartCount: 0 }); const state = inspect.State ?? {}; if (state.Status !== 'running' || state.Running !== true || state.Health?.Status !== 'healthy') throw new Error(`Keycloak ${phase} state contract failed`); return sameIdentity }
  const verifyCaddyRuntime = (pathState = 'installed') => {
    const id = compose(['ps', '--quiet', 'caddy'], ['runtime']).stdout.trim()
    if (!id) throw new Error('caddy container is missing during bootstrap verification')
    const inspect = JSON.parse(command('docker', ['inspect', id], { label: 'inspect caddy bootstrap runtime' }).stdout)[0]
    if (inspect.Config.User !== '10001:10001') throw new Error('Caddy runtime user config must equal 10001:10001')
    const execCaddyShell = (script) => compose(['exec', '-T', 'caddy', '/bin/sh', '-ec', script], ['runtime']).stdout
    const processProbe = [
      `expected="$(printf '%s\\n' ${CADDY_CMDLINE.map((value) => `'${value}'`).join(' ')})"`,
      'matched_pid=',
      'count=0',
      'for proc in /proc/[0-9]*; do',
      '  [ -r "$proc/cmdline" ] || continue',
      '  candidate="$(tr \'\\0\' \'\\n\' < "$proc/cmdline")"',
      '  if [ "$candidate" = "$expected" ]; then',
      '    matched_pid="${proc#/proc/}"',
      '    count=$((count + 1))',
      '  fi',
      'done',
      'test "$count" -eq 1',
      'printf \'%s|%s\\n\' "$count" "$matched_pid"',
    ].join('\n')
    const [processCountText, caddyPidText] = execCaddyShell(processProbe).trim().split('|')
    const processCount = Number(processCountText)
    const caddyPid = Number(caddyPidText)
    if (!Number.isSafeInteger(caddyPid)) throw new Error('Caddy process resolver returned an invalid PID')
    const cmdline = execCaddyShell(`tr '\\0' '\\n' < /proc/${caddyPid}/cmdline`).trim().split(/\r?\n/)
    const procStatus = execCaddyShell(`cat /proc/${caddyPid}/status`)
    const exeTarget = execCaddyShell(`readlink /proc/${caddyPid}/exe`).trim()
    const exeInode = execCaddyShell(`stat -Lc '%d:%i' /proc/${caddyPid}/exe`).trim()
    const copyInode = execCaddyShell("stat -Lc '%d:%i' /run/caddy-bin/caddy").trim()
    const digest = (path) => {
      const output = execCaddyShell(`sha256sum ${path}`).trim()
      const value = output.match(/^([0-9a-f]{64})\s+/i)?.[1]?.toLowerCase()
      if (!value) throw new Error(`Caddy SHA-256 output was invalid for ${path}`)
      return value
    }
    const sourceDigest = digest('/usr/bin/caddy')
    const copyDigest = digest('/run/caddy-bin/caddy')
    const liveExeDigest = digest(`/proc/${caddyPid}/exe`)
    const copyCapabilities = execCaddyShell('/usr/sbin/getcap /run/caddy-bin/caddy')
    const mountInfo = execCaddyShell(`awk '$5=="/run/caddy-bin"{print;found=1} END{exit !found}' /proc/${caddyPid}/mountinfo`).trim()
    const memoryPeakText = compose(['exec', '-T', 'caddy', '/bin/sh', '-ec', 'cat /sys/fs/cgroup/memory.peak'], ['runtime']).stdout.trim()
    const memoryPeakBytes = Number(memoryPeakText)
    const verified = verifyCaddyRuntimeInvariants({
      caddyPid,
      cmdline,
      copyCapabilities,
      copyDigest,
      copyInode,
      exeInode,
      exeTarget,
      liveExeDigest,
      memoryPeakBytes,
      mountInfo,
      oomKilled: inspect.State.OOMKilled === true,
      pathState,
      processCount,
      procStatus,
      sourceDigest,
      tmpfsConfig: inspect.HostConfig.Tmpfs?.['/run/caddy-bin'],
    })
    return verified
  }
  const assertRedisDestructiveCommandsDenied = (service, urlFile) => {
    const script = [
      "const fs=require('node:fs')",
      "const Redis=require('ioredis')",
      `const client=new Redis(fs.readFileSync('${urlFile}','utf8').trim(),{connectTimeout:5000,maxRetriesPerRequest:1})`,
      "const probes=[['flushall'],['flushdb'],['swapdb','0','1'],['migrate','127.0.0.1','1','__acl_probe__','0','1']]",
      "Promise.all(probes.map(async(args)=>{try{await client.call(...args);throw new Error('destructive Redis command was allowed')}catch(error){if(!String(error?.message).includes('NOPERM'))throw error}})).then(()=>client.quit()).then(()=>process.exit(0)).catch(()=>{client.disconnect(false);process.exit(1)})",
    ].join(';')
    compose(buildRedisProbeComposeArgs(service, script), ['runtime'], `${service} Redis destructive-command denial probe`)
  }
  const captureQueueCheckpoint = (checkpoint) => {
    const spec = buildQueueSnapshotComposeArgs(checkpoint)
    return sanitizeQueuePersistenceCheckpoint(compose(spec.args, spec.profiles, spec.label), checkpoint)
  }
  const collectStoppedAofInventory = (volumeName) => {
    return collectStoppedAofInventoryEvidence({
      command, assertNoSecretLeak, secretValues, volumeName,
      redisImage: config.services.redis.image, workerImage: config.services.worker.image,
    })
  }
  const {
    resolveRuntimeTarget,
    pauseRuntimeService,
    unpauseRuntimeService,
  } = createRuntimeIsolationControls({ compose, command, assertNoSecretLeak, secretValues })
  const query = (sql) => compose(['exec', '-T', 'postgres', 'psql', '--no-psqlrc', '--username', 'hr_axis_bootstrap', '--dbname', 'hr_axis', '--tuples-only', '--no-align', '--command', sql], ['infra']).stdout.trim()
  const runtimeRoleQuery = (role, passwordFile, sql, { allowFailure = false, label } = {}) => {
    if (!['hr_axis_api', 'hr_axis_worker'].includes(role)) throw new Error('unsupported runtime role proof identity')
    const result = command('docker', [
      ...base,
      '--profile', 'infra',
      'exec', '-T', 'postgres',
      'sh', '-ec',
      'PGPASSWORD="$(cat "$1")" exec psql "host=postgres port=5432 dbname=hr_axis user=$2 sslmode=verify-full sslrootcert=/var/lib/postgresql/tls/ca.crt" --no-psqlrc --tuples-only --no-align --set=VERBOSITY=verbose --command="$3"',
      'runtime-role-proof', passwordFile, role, sql,
    ], { allowFailure, label: label ?? `${role} database privilege proof` })
    assertNoSecretLeak(secretValues, {
      [`${role} database proof stderr`]: result.stderr,
      [`${role} database proof stdout`]: result.stdout,
    })
    return result
  }
  let cleanupRequired = false
  let tlsTempDirectory = null
  try {
    compose(['up', '--detach', 'postgres', 'redis'], ['infra'])
    cleanupRequired = true
    waitHealthy('postgres')
    waitHealthy('redis')
    const firstMigrationRun = compose(['run', '--rm', '--no-deps', 'migrator'], ['migrate'])
    const firstTreeDigest = migrationTreeDigestFromOutput(firstMigrationRun)
    const migrationIdentitySql = "SELECT count(*) || '|' || CASE WHEN bool_and(status = 'succeeded') THEN 't' ELSE 'f' END || '|' || encode(digest(string_agg(migration_name || ':' || migration_checksum, ',' ORDER BY migration_name), 'sha256'), 'hex') FROM audit.schema_migration"
    const firstMigration = query(migrationIdentitySql)
    const secondMigrationRun = compose(['run', '--rm', '--no-deps', 'migrator'], ['migrate'])
    const secondTreeDigest = migrationTreeDigestFromOutput(secondMigrationRun)
    const secondMigration = query(migrationIdentitySql)
    if (firstMigration !== secondMigration) throw new Error('migration idempotency/checksum proof mismatch')
    const migrationIdentity = parseMigrationIdentity(secondMigration)
    if (firstTreeDigest !== secondTreeDigest) throw new Error('migration resolved tree digest changed between identical runs')
    receipt.migration = { checksumMismatchRejected: false, ...migrationIdentity, orphanRejected: false, secondRunStable: true, treeDigest: secondTreeDigest }
    query("INSERT INTO audit.schema_migration (migration_name, migration_checksum, status) VALUES ('999_onprem_orphan.sql', repeat('a', 64), 'succeeded')")
    try {
      const orphan = composeExpectedFailure(['run', '--rm', '--no-deps', 'migrator'], ['migrate'], 'orphan migration rejection')
      if (orphan.status === 0) throw new Error('migrator accepted an orphaned migration record')
      receipt.migration.orphanRejected = true
    } finally {
      query("DELETE FROM audit.schema_migration WHERE migration_name = '999_onprem_orphan.sql'")
    }
    const [checksumName, checksumOriginal] = query("SELECT migration_name || '|' || migration_checksum FROM audit.schema_migration ORDER BY migration_name LIMIT 1").split('|')
    if (!checksumName || !/^[0-9a-f]{64}$/i.test(checksumOriginal ?? '')) throw new Error('migration checksum mutation fixture is unavailable')
    const sqlLiteral = (value) => `'${String(value).replaceAll("'", "''")}'`
    query(`UPDATE audit.schema_migration SET migration_checksum = repeat('0', 64) WHERE migration_name = ${sqlLiteral(checksumName)}`)
    try {
      const mismatch = composeExpectedFailure(['run', '--rm', '--no-deps', 'migrator'], ['migrate'], 'migration checksum rejection')
      if (mismatch.status === 0) throw new Error('migrator accepted a checksum mismatch')
      receipt.migration.checksumMismatchRejected = true
    } finally {
      query(`UPDATE audit.schema_migration SET migration_checksum = ${sqlLiteral(checksumOriginal)} WHERE migration_name = ${sqlLiteral(checksumName)}`)
    }
    const restoredMigration = query(migrationIdentitySql)
    if (restoredMigration !== secondMigration) throw new Error('migration negative proof did not restore the exact migration ledger')
    const runtimeRoles = [
      ['hr_axis_api', '/run/secrets/postgres_api_password'],
      ['hr_axis_worker', '/run/secrets/postgres_worker_password'],
    ]
    for (const [role, passwordFile] of runtimeRoles) {
      const identity = runtimeRoleQuery(role, passwordFile, 'SELECT CURRENT_USER').stdout.trim()
      if (identity !== role) throw new Error(`${role} database identity mismatch`)
    }
    query('SET ROLE hr_axis_migrator; CREATE SEQUENCE ops.onprem_sequence_privilege_probe; RESET ROLE')
    try {
      parseSequencePrivilegeMatrix(query("SELECT has_sequence_privilege('hr_axis_api', 'ops.onprem_sequence_privilege_probe', 'USAGE'), has_sequence_privilege('hr_axis_api', 'ops.onprem_sequence_privilege_probe', 'SELECT'), has_sequence_privilege('hr_axis_api', 'ops.onprem_sequence_privilege_probe', 'UPDATE'), has_sequence_privilege('hr_axis_worker', 'ops.onprem_sequence_privilege_probe', 'USAGE'), has_sequence_privilege('hr_axis_worker', 'ops.onprem_sequence_privilege_probe', 'SELECT'), has_sequence_privilege('hr_axis_worker', 'ops.onprem_sequence_privilege_probe', 'UPDATE')"))
      for (const [role, passwordFile] of runtimeRoles) {
        const mutation = runtimeRoleQuery(
          role,
          passwordFile,
          "SELECT setval('ops.onprem_sequence_privilege_probe', 9001)",
          { allowFailure: true, label: `${role} sequence mutation denial` },
        )
        if (mutation.status === 0 || !/42501/.test(`${mutation.stderr}\n${mutation.stdout}`)) {
          throw new Error(`${role} sequence mutation denial did not return SQLSTATE 42501`)
        }
      }
      receipt.databaseRoles = {
        apiIdentityVerified: true,
        sequenceUpdateDenied: true,
        workerIdentityVerified: true,
      }
    } finally {
      query('SET ROLE hr_axis_migrator; DROP SEQUENCE IF EXISTS ops.onprem_sequence_privilege_probe; RESET ROLE')
    }
    compose(['run', '--rm', '--no-deps', 'synthetic-seed'], ['seed'])
    const seedAggregateSql = "SELECT (SELECT count(*) FROM ops.company) || '|' || (SELECT count(*) FROM ops.store) || '|' || (SELECT count(*) FROM ops.employee) || '|' || (SELECT count(*) FROM ops.role) || '|' || (SELECT count(*) FROM ops.kpi_definition)"
    const aggregate = query(seedAggregateSql)
    if (!/^\d+\|\d+\|\d+\|\d+\|\d+$/.test(aggregate)) throw new Error('synthetic seed aggregate proof failed')
    receipt.seedAggregates = aggregate.split('|').map(Number)
    const assertPersistenceIdentity = (phase) => {
      if (query(seedAggregateSql) !== aggregate || query(migrationIdentitySql) !== secondMigration) {
        throw new Error(`${phase} persistence identity mismatch`)
      }
    }
    const ddl = command('docker', [...base, '--profile', 'infra', 'exec', '-T', 'postgres', 'sh', '-ec', 'PGPASSWORD="$(cat /run/secrets/postgres_api_password)" psql "host=postgres port=5432 dbname=hr_axis user=hr_axis_api sslmode=verify-full sslrootcert=/var/lib/postgresql/tls/ca.crt" --no-psqlrc --set=VERBOSITY=verbose --command="CREATE TABLE ops.onprem_runtime_ddl_must_fail(id integer)"'], { allowFailure: true, label: 'runtime DDL denial' })
    if (ddl.status === 0 || !/42501/.test(`${ddl.stderr}\n${ddl.stdout}`)) throw new Error('runtime DDL denial did not return SQLSTATE 42501')
    compose(['up', '--detach', 'api', 'worker', 'frontend', 'caddy'], ['runtime'])
    for (const service of LONG_LIVED) waitHealthy(service)
    const initialCaddyRuntime = verifyCaddyRuntime()
    compose([
      'exec', '-T', 'caddy', '/bin/sh', '-ec',
      "rm -f /run/caddy-bin/caddy && printf '%s' stale-bootstrap-copy > /run/caddy-bin/caddy && chmod 0500 /run/caddy-bin/caddy",
    ], ['runtime'])
    const tamperedCaddyRuntime = verifyCaddyRuntime('tampered')
    if (tamperedCaddyRuntime.executableDigest !== initialCaddyRuntime.executableDigest) {
      throw new Error('Caddy pathname tamper changed the already-running executable identity')
    }
    compose(['restart', 'caddy'], ['runtime'])
    waitHealthy('caddy')
    const restartedCaddyRuntime = verifyCaddyRuntime()
    if (initialCaddyRuntime.executableDigest !== restartedCaddyRuntime.executableDigest) {
      throw new Error('Caddy restart bootstrap did not restore the exact upstream binary')
    }
    receipt.caddyRuntime = {
      ...receipt.caddyRuntime,
      approvedExecutableDigest: initialCaddyRuntime.executableDigest,
      phases: {
        initial: initialCaddyRuntime,
        pathnameTampered: tamperedCaddyRuntime,
        restarted: restartedCaddyRuntime,
      },
      restartOverwriteVerified: true,
      tamperedPathRejected: true,
      tamperLiveExecutableUnchanged: true,
    }
    const publicHost = config.services.caddy.environment.HR_AXIS_PUBLIC_HOST
    const caddyIdForTls = compose(['ps', '--quiet', 'caddy'], ['runtime']).stdout.trim()
    const caddyInspectForTls = JSON.parse(
      command('docker', ['inspect', caddyIdForTls], { label: 'inspect caddy TLS endpoint' }).stdout,
    )[0]
    const caddyProxyIp = caddyInspectForTls.NetworkSettings.Networks[`${options.project}_proxy`]?.IPAddress
    if (!caddyProxyIp || !ipv4InCidr(caddyProxyIp, '172.30.10.0/24')) {
      throw new Error('Caddy proxy-network identity is unavailable for verify-full proof')
    }
    const tlsProbe = [
      "const fs=require('node:fs')",
      "const https=require('node:https')",
      "const tls=require('node:tls')",
      sanitizeTlsErrorCode.toString(),
      `const marker=${JSON.stringify(TLS_PROBE_MARKER)}`,
      "const emit=(payload,exitCode)=>{process.stdout.write(JSON.stringify({marker,...payload})+'\\n');process.exit(exitCode)}",
      "const ca=fs.readFileSync(process.env.PROOF_CA)",
      "const request=https.get({ca,checkServerIdentity:(_servername,cert)=>tls.checkServerIdentity(process.env.PROOF_VERIFY_HOST,cert),headers:{host:process.env.PROOF_HOST},host:process.env.PROOF_IP,port:8443,servername:process.env.PROOF_HOST,path:'/healthz',timeout:5000},response=>{response.resume();const statusCode=response.statusCode;if(statusCode===200)emit({result:'success',statusCode},0);emit({result:'http_error',statusCode:Number.isInteger(statusCode)?statusCode:null},21)})",
      "request.on('error',error=>{emit({result:'tls_error',code:sanitizeTlsErrorCode(error?.code)},20)})",
      "request.on('timeout',()=>{request.removeAllListeners('error');request.destroy();emit({result:'timeout'},22)})",
    ].join(';')
    const runTlsProbe = ({ caPath, host, label, verifyHost }) => {
      const args = buildTlsProbeDockerArgs({
        caPath,
        caddyProxyIp,
        host,
        image: config.services.api.image,
        network: `${options.project}_proxy`,
        probeScript: tlsProbe,
        verifyHost,
      })
      const result = command('docker', args, { allowFailure: true, label })
      assertNoSecretLeak(secretValues, {
        [`${label} stderr`]: result.stderr,
        [`${label} stdout`]: result.stdout,
      })
      return result
    }
    const approvedCaPath = resolve(config.secrets.caddy_tls_ca.file)
    tlsTempDirectory = mkdtempSync(join(tmpdir(), 'hr-axis-wrong-ca-'))
    const wrongCaPath = join(tlsTempDirectory, 'unrelated-ca.crt')
    const wrongCaKeyPath = join(tlsTempDirectory, 'unrelated-ca.key')
    command('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
      '-subj', '/CN=HR Axis unrelated synthetic proof CA',
      '-keyout', wrongCaKeyPath,
      '-out', wrongCaPath,
    ], { label: 'generate unrelated synthetic TLS CA' })
    const tlsResult = runTlsProbe({ caPath: approvedCaPath, host: publicHost, label: 'isolated proxy-network verify-full HTTPS proof', verifyHost: publicHost })
    classifyTlsProbeResult(tlsResult, 'success')
    const wrongHostname = runTlsProbe({ caPath: approvedCaPath, host: publicHost, label: 'wrong-hostname TLS rejection proof', verifyHost: 'wrong-host.example.invalid' })
    classifyTlsProbeResult(wrongHostname, 'wrong-host')
    const wrongCa = runTlsProbe({ caPath: wrongCaPath, host: publicHost, label: 'wrong-CA TLS rejection proof', verifyHost: publicHost })
    classifyTlsProbeResult(wrongCa, 'wrong-ca')
    receipt.tls = {
      internalHostnameVerified: true,
      wrongCaRejected: true,
      wrongHostnameRejected: true,
    }
    const privateIps = new Set()
    for (const service of LONG_LIVED) {
      const id = compose(['ps', '--quiet', service], ['runtime']).stdout.trim()
      const inspectResult = command('docker', ['inspect', id], { label: `inspect ${service}` })
      assertNoSecretLeak(secretValues, { [`docker inspect ${service}`]: inspectResult.stdout })
      const inspect = JSON.parse(inspectResult.stdout)[0]
      const expectedImageId = JSON.parse(command('docker', ['image', 'inspect', config.services[service].image], { label: `inspect image ${service}` }).stdout)[0].Id
      if (inspect.Image !== expectedImageId) throw new Error(`${service} image identity mismatch`)
      receipt.images[service] = expectedImageId
      const [cpu, memory, pids] = EXPECTED_LIMITS[service]
      if (inspect.HostConfig.NanoCpus !== cpu * 1e9 || inspect.HostConfig.Memory !== memory || inspect.HostConfig.PidsLimit !== pids) throw new Error(`${service} runtime resource ceiling mismatch`)
      for (const network of Object.values(inspect.NetworkSettings.Networks ?? {})) if (network.IPAddress) privateIps.add(network.IPAddress)
      const published = Object.entries(inspect.NetworkSettings.Ports ?? {}).filter(([, bindings]) => Array.isArray(bindings) && bindings.length > 0)
      if (service === 'caddy') {
        if (published.length !== 1 || published[0][0] !== '8443/tcp' || published[0][1][0].HostPort !== '443') throw new Error('caddy must be the sole TCP 443 publisher')
      } else if (published.length !== 0) throw new Error(`${service} unexpectedly publishes a host port`)
    }
    const redisId = compose(['ps', '--quiet', 'redis'], ['infra']).stdout.trim()
    assertRedisDestructiveCommandsDenied('api', '/run/secrets/redis_api_url')
    assertRedisDestructiveCommandsDenied('worker', '/run/secrets/redis_worker_url')
    receipt.redisAcl = { destructiveCommandsDenied: true, keyPrefixesScoped: true }
    const redisInspectBefore = JSON.parse(command('docker', ['inspect', redisId], { label: 'inspect Redis before restart' }).stdout)[0]
    const redisMountBefore = redisInspectBefore.Mounts.find((mount) => mount.Destination === '/data')
    if (!redisMountBefore?.Name || !redisMountBefore?.Source) throw new Error('Redis named AOF volume inspection failed')
    const redisPersistenceDiagnostics = {
      checkpoints: {},
      redisLogClassification: null,
      stoppedAof: null,
    }
    try {
      const enqueued = compose(['run', '--rm', '--no-deps', 'worker', 'dist/src/onprem/synthetic-queue-probe.js', 'enqueue'], ['runtime'])
      assertProbeOutput(enqueued, { durability: 'local-aof-fsynced', mode: 'enqueue', queuedCount: 1, state: 'delayed', status: 'queued' })
      redisPersistenceDiagnostics.checkpoints.preStop = captureQueueCheckpoint('pre_stop')
      const preStop = redisPersistenceDiagnostics.checkpoints.preStop
      if (
        preStop.jobHashExists !== 1
        || preStop.delayedMembershipExists !== 1
        || preStop.enqueueSentinelExists !== 1
        || preStop.processedMarkerExists !== 0
        || preStop.persistence.aofEnabled !== 1
        || preStop.persistence.aofLastWriteStatus !== 'ok'
      ) throw new Error('synthetic queue pre-stop persistence checkpoint failed')
      const redisRestartLogSince = new Date().toISOString()
      compose(['stop', 'redis'], ['infra'])
      const redisStoppedInspect = JSON.parse(command('docker', ['inspect', redisId], { label: 'inspect stopped Redis' }).stdout)[0]
      const redisStoppedState = redisStoppedInspect.State
      if (redisStoppedState.ExitCode !== 0 || redisStoppedState.OOMKilled || redisStoppedState.Dead || redisStoppedState.Error) {
        throw new Error('Redis outage was not a graceful stop')
      }
      const redisStoppedMount = redisStoppedInspect.Mounts.find((mount) => mount.Destination === '/data')
      const stoppedInventory = collectStoppedAofInventory(redisMountBefore?.Name)
      redisPersistenceDiagnostics.stoppedAof = {
        checkpoint: 'stopped_aof',
        sameContainerId: redisStoppedInspect.Id === redisId,
        sameVolumeName: Boolean(redisMountBefore?.Name && redisStoppedMount?.Name === redisMountBefore.Name),
        sameVolumeSource: Boolean(redisMountBefore?.Source && redisStoppedMount?.Source === redisMountBefore.Source),
        ...stoppedInventory,
      }
      if (
        !redisPersistenceDiagnostics.stoppedAof.sameContainerId
        || !redisPersistenceDiagnostics.stoppedAof.sameVolumeName
        || !redisPersistenceDiagnostics.stoppedAof.sameVolumeSource
        || !redisPersistenceDiagnostics.stoppedAof.manifestPresent
        || redisPersistenceDiagnostics.stoppedAof.files.length === 0
      ) throw new Error('stopped Redis AOF identity or manifest checkpoint failed')
      assertStoppedAofCommandSequence(redisPersistenceDiagnostics.stoppedAof)
      waitUnhealthy('api')
      waitUnhealthy('worker')
      const runtimeTargets = ['api', 'worker'].map(resolveRuntimeTarget)
      try {
        for (const target of runtimeTargets) pauseRuntimeService(target)
        compose(['start', 'redis'], ['infra'])
        waitHealthy('redis')
        const redisIdAfter = compose(['ps', '--quiet', 'redis'], ['infra']).stdout.trim()
        const redisInspectAfter = JSON.parse(command('docker', ['inspect', redisIdAfter], { label: 'inspect restarted Redis' }).stdout)[0]
        const redisMountAfter = redisInspectAfter.Mounts.find((mount) => mount.Destination === '/data')
        redisPersistenceDiagnostics.stoppedAof.sameContainerId &&= redisIdAfter === redisId
        redisPersistenceDiagnostics.stoppedAof.sameVolumeName &&= Boolean(redisMountBefore?.Name && redisMountAfter?.Name === redisMountBefore.Name)
        redisPersistenceDiagnostics.stoppedAof.sameVolumeSource &&= Boolean(redisMountBefore?.Source && redisMountAfter?.Source === redisMountBefore.Source)
        if (
          !redisPersistenceDiagnostics.stoppedAof.sameContainerId
          || !redisPersistenceDiagnostics.stoppedAof.sameVolumeName
          || !redisPersistenceDiagnostics.stoppedAof.sameVolumeSource
        ) throw new Error('Redis restart did not preserve the exact container and named AOF volume')
        redisPersistenceDiagnostics.checkpoints.postRedisLoad = captureQueueCheckpoint('post_redis_load')
        assertPostRedisLoadCheckpoint(redisPersistenceDiagnostics.checkpoints.postRedisLoad)
        redisPersistenceDiagnostics.redisLogClassification = classifyRedisPersistenceLogs(
          collectRedisRestartLogDelta({
            command,
            assertNoSecretLeak,
            secretValues,
            containerId: redisIdAfter,
            since: redisRestartLogSince,
          }),
          redisRestartLogSince,
        )
      } finally {
        const unpauseFailures = []
        for (const target of runtimeTargets) {
          try {
            unpauseRuntimeService(target)
          } catch (error) {
            unpauseFailures.push({ service: target.service, reason: classifyQueueFailureReason(error) })
          }
        }
        if (unpauseFailures.length > 0) {
          throw new Error(`Redis runtime unpause failed ${boundedText(JSON.stringify({
            event: 'onprem.redis_runtime_isolation.failed',
            phase: 'unpause',
            reason: 'runtime_unpause_failed',
            services: unpauseFailures,
          }), 2048)}`)
        }
      }
      waitHealthy('api')
      waitHealthy('worker')
      redisPersistenceDiagnostics.checkpoints.postRuntimeReconnect = captureQueueCheckpoint('post_runtime_reconnect')
      const processed = compose(['run', '--rm', '--no-deps', 'worker', 'dist/src/onprem/synthetic-queue-probe.js', 'process'], ['runtime'])
      assertProbeOutput(processed, { duplicateCount: 0, mode: 'process', processedCount: 1, status: 'completed' })
    } catch (error) {
      throw new Error(`Redis persistence diagnostic failed ${JSON.stringify({
        event: 'onprem.redis_persistence_diagnostic.failed',
        reason: classifyQueueFailureReason(error),
        ...redisPersistenceDiagnostics,
      })}`)
    }
    receipt.redisPersistenceDiagnostics = redisPersistenceDiagnostics
    const queueStatus = compose(['run', '--rm', '--no-deps', 'worker', 'dist/src/onprem/synthetic-queue-probe.js', 'status'], ['runtime'])
    assertProbeOutput(queueStatus, { markerCount: 1, mode: 'status', state: 'completed' })
    receipt.outageRecovery = { apiUnhealthy: true, recovered: true, redisStoppedGracefully: true, workerUnhealthy: true }
    compose(['restart', 'postgres'], ['infra'])
    waitHealthy('postgres')
    assertPersistenceIdentity('PostgreSQL restart')
    const workloadCaddyRuntime = verifyCaddyRuntime()
    if (workloadCaddyRuntime.executableDigest !== receipt.caddyRuntime.approvedExecutableDigest) {
      throw new Error('Caddy workload phase changed the verified binary identity')
    }
    receipt.caddyRuntime.phases.workload = workloadCaddyRuntime; compose(['stop', 'caddy', 'frontend', 'api', 'worker'], ['runtime']); for (const service of ['caddy', 'frontend', 'api', 'worker']) assertStoppedServiceState(service, ['runtime'], 'edge/application')
    waitHealthy('postgres'); const keycloakBeforeStop = captureKeycloakBeforeStop('pre-stop')
    const keycloakStop = command('docker', buildKeycloakStopArgs(keycloakBeforeStop.containerId), { label: 'explicit Keycloak SIGTERM stop' }); assertNoSecretLeak(secretValues, { 'explicit Keycloak SIGTERM stop stdout': keycloakStop.stdout, 'explicit Keycloak SIGTERM stop stderr': keycloakStop.stderr })
    const keycloakAfterStop = inspectContainer(keycloakBeforeStop.containerId, 'post-stop Keycloak state'); const keycloakStopProof = assertControlledKeycloakStop({ beforeInspect: keycloakBeforeStop.inspect, afterInspect: keycloakAfterStop }); const keycloakLogObservation = observeStoppedKeycloak({ identity: keycloakBeforeStop, inspect: keycloakAfterStop })
    receipt.keycloakLifecycleProof = { stoppedCleanly: keycloakStopProof.lifecycleVerified, restartCountStable: keycloakStopProof.restartCount === 0, markerObserved: keycloakLogObservation.markerObserved }
    waitHealthy('postgres'); compose(['stop', 'postgres', 'redis'], ['infra']); for (const service of ['postgres', 'redis']) assertStoppedServiceState(service, ['infra'], 'postgres/redis')
    compose(['up', '--detach', 'postgres', 'redis'], ['infra'])
    waitHealthy('postgres'); waitHealthy('redis')
    compose(['up', '--detach', 'api', 'worker', 'frontend', 'caddy'], ['runtime']); for (const service of LONG_LIVED) waitHealthy(service); verifyKeycloakRestartIdentity(keycloakBeforeStop, 'post-restart'); receipt.keycloakLifecycleProof = { ...receipt.keycloakLifecycleProof, restartIdentityVerified: true }
    assertPersistenceIdentity('full project restart')
    const finalCaddyRuntime = verifyCaddyRuntime()
    if (finalCaddyRuntime.executableDigest !== receipt.caddyRuntime.approvedExecutableDigest) {
      throw new Error('full project restart changed the verified Caddy binary identity')
    }
    receipt.caddyRuntime = {
      ...receipt.caddyRuntime,
      fullProjectRestartVerified: true,
      memoryPeakBytes: Math.max(...Object.values(receipt.caddyRuntime.phases).map((phase) => phase.memoryPeakBytes), finalCaddyRuntime.memoryPeakBytes),
      phases: { ...receipt.caddyRuntime.phases, fullProjectRestart: finalCaddyRuntime },
      restartOverwriteVerified: true,
    }
    const projectLogs = compose(['logs', '--no-color'], ['infra', 'migrate', 'seed', 'runtime'])
    assertNoSecretLeak(secretValues, {
      'project logs stderr': projectLogs.stderr,
      'project logs stdout': projectLogs.stdout,
    })
    command(process.execPath, ['-e', 'setTimeout(()=>{},3000)'], { label: 'external flow observation window' })
    receipt.flowObservation = observeNoExternalFlows(privateIps)
    const finalFirewallText = collectFirewallEvidence()
    const finalFirewall = validateFirewallRules({ iptables: finalFirewallText, privateSubnets: PRIVATE_SUBNETS, proxyPorts: [443], sshAdminCidrs: options.sshAdminCidrs })
    if (!finalFirewall.ok) throw new Error(`post-runtime firewall contract failed: ${finalFirewall.errors.join('; ')}`)
    const finalRejectCounters = egressRejectCounters(collectFirewallEvidence({ counters: true }))
    let packetDelta = 0
    for (const subnet of PRIVATE_SUBNETS) {
      const delta = finalRejectCounters.get(subnet).packets - initialRejectCounters.get(subnet).packets
      if (delta < 0) throw new Error(`egress rejection counter reset during proof for ${subnet}`)
      packetDelta += delta
    }
    if (packetDelta !== 0) throw new Error(`project containers attempted ${packetDelta} externally rejected flow(s)`)
    receipt.egressRejectPacketDelta = packetDelta
  } finally {
    try {
      if (cleanupRequired) cleanupCoreRuntime(options)
    } finally {
      if (tlsTempDirectory) rmSync(tlsTempDirectory, { force: true, recursive: true })
    }
  }
  const output = { ...receipt, ok: true }
  assertNoSecretLeak(secretValues, { 'sanitized runtime receipt': JSON.stringify(output) })
  if (options.receipt) writeFileSync(isAbsolute(options.receipt) ? options.receipt : resolve(options.receipt), `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 })
  console.log(JSON.stringify(output, null, 2))
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`on-prem core runtime proof: ${redact(error.message)}`)
    process.exitCode = 1
  })
}
