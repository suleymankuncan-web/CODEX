import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { collectFirewallEvidence, validateFirewallRules } from './onprem-core-firewall-verify.mjs'
import { isConfidentialRuntimeSecretName } from './onprem-core-runtime-proof.mjs'
import {
  assertControlledKeycloakStop,
  assertKeycloakContainerIdentity,
  assertKeycloakPreStopState,
  buildKeycloakStopArgs,
  observeKeycloakGracefulStop,
} from './onprem-graceful-stop-contract.mjs'

function parseArgs(argv) {
  const options = { execute: false, cleanup: false, requireFreshVolumes: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--execute') options.execute = true
    else if (arg === '--cleanup') options.cleanup = true
    else if (arg === '--require-fresh-volumes') options.requireFreshVolumes = true
    else if (arg === '--compose') options.compose = argv[++index]
    else if (arg === '--env-file') options.envFile = argv[++index]
    else if (arg === '--project') options.project = argv[++index]
    else if (arg === '--release-id') options.releaseId = argv[++index]
    else if (arg === '--receipt') options.receipt = argv[++index]
    else if (arg === '--auth-host') options.authHost = argv[++index]
    else if (arg === '--accounts-file') options.accountsFile = argv[++index]
    else if (arg === '--ca-file') options.caFile = argv[++index]
    else throw new Error(`unknown argument: ${arg}`)
  }
  if ((options.execute || options.cleanup) && (!options.compose || !options.envFile || !options.project || !options.releaseId)) {
    throw new Error('--compose, --env-file, --project, and --release-id are required with --execute or --cleanup')
  }
  if (options.execute && (!options.receipt || !options.authHost || !options.accountsFile || !options.caFile)) {
    throw new Error('--compose, --env-file, --project, --release-id, --receipt, --auth-host, --accounts-file, and --ca-file are required with --execute')
  }
  if ((options.execute || options.cleanup) && options.project !== 'hr-axis-onprem-keycloak') {
    throw new Error('Keycloak runtime proof refuses an unapproved Compose project')
  }
  return options
}

const KEYCLOAK_BOOTSTRAP_DIAGNOSTIC_CATEGORIES = Object.freeze({
  SERVER_EXITED_BEFORE_AUTHENTICATION: 'server-exited-before-authentication',
  BOOTSTRAP_AUTH_TIMEOUT: 'bootstrap-auth-timeout',
  DATABASE_OR_TLS_CONTRACT: 'database-or-tls-contract',
  REALM_RECONCILIATION: 'realm-reconciliation',
  SECRET_CONTRACT: 'secret-contract',
  RESOURCE_OR_EXTERNAL_TERMINATION: 'resource-or-external-termination',
  GENERIC_FAILED_CLOSED: 'generic-failed-closed',
})

const KEYCLOAK_BOOTSTRAP_DIAGNOSTIC_MARKERS = Object.freeze({
  [KEYCLOAK_BOOTSTRAP_DIAGNOSTIC_CATEGORIES.SERVER_EXITED_BEFORE_AUTHENTICATION]: Object.freeze([
    'temporary Keycloak server exited before authentication',
    'keycloak bootstrap: server log scan skipped (server did not start)',
  ]),
  [KEYCLOAK_BOOTSTRAP_DIAGNOSTIC_CATEGORIES.BOOTSTRAP_AUTH_TIMEOUT]: Object.freeze([
    'temporary bootstrap principal authentication failed',
  ]),
  [KEYCLOAK_BOOTSTRAP_DIAGNOSTIC_CATEGORIES.DATABASE_OR_TLS_CONTRACT]: Object.freeze([
    'required database secret file is unavailable',
    'required database secret is empty',
    'database secret value exceeds the bounded length',
    'database secret contains unsupported characters',
    'Keycloak PostgreSQL CA secret is unavailable',
  ]),
  [KEYCLOAK_BOOTSTRAP_DIAGNOSTIC_CATEGORIES.REALM_RECONCILIATION]: Object.freeze([
    'only the approved store-ops realm is supported',
    'only the approved browser client is supported',
    'sanitized realm configuration fixture is unavailable',
    'public origin must be an exact HTTPS origin',
    'public origin must contain a hostname',
    'public origin hostname is too long',
    'public origin hostname is not a valid hostname',
    'public origin hostname contains an empty label',
    'public origin hostname label is too long',
    'public origin hostname label is invalid',
    'realm fixture parity check failed',
    'browser client fixture parity check failed',
    'synthetic role fixture parity check failed',
    'realm fixture must remain user-free',
    'realm creation failed',
    'realm settings reconciliation failed',
    'realm role reconciliation failed',
    'browser client reconciliation failed',
    'browser client creation failed',
    'browser client id was not resolved',
    'claim mapper update failed',
    'claim mapper creation failed',
    'claim mapper inventory read failed',
    'claim mapper inventory contains duplicate names',
    'SMTP contract reconciliation failed',
    'realm parity read failed',
    'realm parity mismatch',
    'SMTP parity mismatch',
    'browser client parity read failed',
    'browser client parity mismatch',
    'browser client PKCE parity mismatch',
    'browser client logout parity mismatch',
    'managed mapper parity read failed',
    'managed mapper identity parity mismatch',
    'managed mapper name parity mismatch',
    'managed mapper type parity mismatch',
    'audience mapper parity mismatch',
    'audience mapper access-token parity mismatch',
    'audience mapper id-token parity mismatch',
    'audience mapper userinfo parity mismatch',
    'roles mapper claim parity mismatch',
    'roles mapper multivalue parity mismatch',
    'roles mapper token parity mismatch',
    'claim mapper source parity mismatch',
    'claim mapper target parity mismatch',
    'claim mapper token parity mismatch',
    'browser client default scopes parity read failed',
    'browser client default scopes parity mismatch',
    'realm role parity mismatch',
    'temporary bootstrap client was not found for deletion',
    'temporary bootstrap client deletion failed',
    'temporary bootstrap client still exists',
  ]),
  [KEYCLOAK_BOOTSTRAP_DIAGNOSTIC_CATEGORIES.SECRET_CONTRACT]: Object.freeze([
    'required secret file is unavailable',
    'required secret file is empty',
    'secret value exceeds the bounded length',
    'secret value contains unsupported characters',
    'bootstrap principal must use the temporary bootstrap-* name',
    'required configuration is missing: KEYCLOAK_SMTP_HOST',
    'required configuration is missing: KEYCLOAK_SMTP_PORT',
    'required configuration is missing: KEYCLOAK_SMTP_FROM',
    'required configuration is missing: KEYCLOAK_SMTP_STARTTLS',
    'configuration contains unsupported characters: KEYCLOAK_SMTP_HOST',
    'configuration contains unsupported characters: KEYCLOAK_SMTP_PORT',
    'configuration contains unsupported characters: KEYCLOAK_SMTP_FROM',
    'configuration contains unsupported characters: KEYCLOAK_SMTP_STARTTLS',
    'SMTP port must be numeric',
    'SMTP STARTTLS must be true or false',
    'SMTP from value contains unsupported characters',
    'synthetic account contract is enabled but its secret file is unavailable',
    'synthetic account identity contains unsupported characters',
    'synthetic account persona is not one of the five approved roles',
    'duplicate synthetic account persona',
    'synthetic account password is below the minimum length',
    'synthetic account creation failed',
    'synthetic account claim update failed',
    'synthetic account subject was not resolved',
    'synthetic account password update failed',
    'stale synthetic account role removal failed',
    'synthetic account role assignment failed',
    'synthetic account role is not approved',
    'synthetic account role parity mismatch',
    'synthetic account contract must provide all five approved personas',
    'synthetic scope value contains unsupported characters',
    'keycloak bootstrap: server log scan failed (invalid bounded size)',
    'keycloak bootstrap: server log scan failed (log exceeded bounded size)',
    'keycloak bootstrap: server log scan failed (secret value detected)',
  ]),
  [KEYCLOAK_BOOTSTRAP_DIAGNOSTIC_CATEGORIES.RESOURCE_OR_EXTERNAL_TERMINATION]: Object.freeze([
    'bootstrap watchdog timeout',
  ]),
})

// Phase markers are emitted only from fixed bootstrap boundaries. They carry
// no runtime values; category selection remains independent and still comes
// from one exact failed-closed marker.
export const KEYCLOAK_BOOTSTRAP_PHASES = Object.freeze({
  'secret-input': true,
  'server-start': true,
  'bootstrap-authentication': true,
  'realm-reconciliation': true,
  'synthetic-account-reconciliation': true,
  'subject-manifest': true,
  'server-log-scan': true,
})

const SAFE_KEYCLOAK_DIAGNOSTIC_SIGNALS = new Set([
  'SIGABRT',
  'SIGBUS',
  'SIGFPE',
  'SIGHUP',
  'SIGILL',
  'SIGINT',
  'SIGKILL',
  'SIGPIPE',
  'SIGQUIT',
  'SIGSEGV',
  'SIGTERM',
])

const KEYCLOAK_BOOTSTRAP_MARKER_PREFIX = /^keycloak bootstrap: failed closed \(([^()\r\n]+)\)$/
const KEYCLOAK_BOOTSTRAP_PHASE_MARKER = /^keycloak bootstrap: phase=([a-z-]+)$/
const KEYCLOAK_BOOTSTRAP_LOG_PREFIX = /^(?:keycloak-bootstrap(?:-[1-9][0-9]*)?\s*\|\s*)?/
const SECRET_LIKE_DIAGNOSTIC_TEXT = /(?:password|secret|token|authorization)\s*[=:]\s*[^\s,;]+|Bearer\s+\S+|\beyJ[A-Za-z0-9_-]{20,}\b|-----BEGIN\s+[A-Z ]+PRIVATE KEY-----|:\/\/[^\s/:@]+:[^\s/@]+@/i

function boundedDockerExitCode(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 255 ? value : null
}

function boundedDockerSignal(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  return SAFE_KEYCLOAK_DIAGNOSTIC_SIGNALS.has(normalized) ? normalized : null
}

function markerCategory(marker) {
  const categories = []
  for (const [category, markers] of Object.entries(KEYCLOAK_BOOTSTRAP_DIAGNOSTIC_MARKERS)) {
    if (markers.includes(marker)) categories.push(category)
  }
  return categories.length === 1 ? categories[0] : null
}

function extractAllowlistedBootstrapCategories(value) {
  const categories = new Set()
  const phases = []
  let malformed = false
  const lines = String(value ?? '').replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const withoutComposePrefix = trimmed.replace(KEYCLOAK_BOOTSTRAP_LOG_PREFIX, '')
    const phaseMarker = withoutComposePrefix.match(KEYCLOAK_BOOTSTRAP_PHASE_MARKER)
    if (phaseMarker) {
      if (Object.hasOwn(KEYCLOAK_BOOTSTRAP_PHASES, phaseMarker[1])) phases.push(phaseMarker[1])
      else malformed = true
      continue
    }
    if (/^keycloak bootstrap:\s+phase(?:=|\s|$)/i.test(withoutComposePrefix)) {
      malformed = true
      continue
    }
    const failedClosed = withoutComposePrefix.match(KEYCLOAK_BOOTSTRAP_MARKER_PREFIX)
    if (failedClosed) {
      const category = markerCategory(failedClosed[1])
      if (category) categories.add(category)
      else malformed = true
      continue
    }
    if (/^keycloak bootstrap:\s+failed closed(?:\s|$)/i.test(withoutComposePrefix)) malformed = true
    const category = markerCategory(withoutComposePrefix)
    if (category) categories.add(category)
  }
  return { categories, phases, malformed }
}

/**
 * Return a bounded, secret-free classification for a failed Keycloak bootstrap
 * child process. Only exact markers emitted by the approved bootstrap script
 * can select a category; zero, multiple, malformed, or secret-bearing markers
 * fail closed to the generic category while unrelated log noise is ignored.
 * Exact phase markers are independent and report only the last bounded phase
 * that preceded the single primary category marker.
 */
export function classifyKeycloakBootstrapDiagnostic({
  status = null,
  exitCode = undefined,
  signal = null,
  stdout = '',
  stderr = '',
} = {}) {
  const boundedExitCode = boundedDockerExitCode(status ?? exitCode)
  const boundedSignal = boundedDockerSignal(signal)
  const combined = `${String(stdout ?? '')}\n${String(stderr ?? '')}`
  if (SECRET_LIKE_DIAGNOSTIC_TEXT.test(combined)) {
    return {
      category: KEYCLOAK_BOOTSTRAP_DIAGNOSTIC_CATEGORIES.GENERIC_FAILED_CLOSED,
      phase: null,
      exitCode: boundedExitCode,
      signal: boundedSignal,
    }
  }
  const stdoutCategories = extractAllowlistedBootstrapCategories(stdout)
  const stderrCategories = extractAllowlistedBootstrapCategories(stderr)
  const categories = new Set([...stdoutCategories.categories, ...stderrCategories.categories])
  const malformed = stdoutCategories.malformed || stderrCategories.malformed
  const phases = [...stdoutCategories.phases, ...stderrCategories.phases]
  const lastPhase = phases.length > 0 ? phases[phases.length - 1] : null
  if (malformed || categories.size > 1) {
    return {
      category: KEYCLOAK_BOOTSTRAP_DIAGNOSTIC_CATEGORIES.GENERIC_FAILED_CLOSED,
      phase: null,
      exitCode: boundedExitCode,
      signal: boundedSignal,
    }
  }
  if (boundedExitCode === 137 || boundedSignal === 'SIGKILL') {
    return {
      category: KEYCLOAK_BOOTSTRAP_DIAGNOSTIC_CATEGORIES.RESOURCE_OR_EXTERNAL_TERMINATION,
      phase: lastPhase,
      exitCode: boundedExitCode,
      signal: boundedSignal,
    }
  }
  return {
    category: categories.size === 1
      ? [...categories][0]
      : KEYCLOAK_BOOTSTRAP_DIAGNOSTIC_CATEGORIES.GENERIC_FAILED_CLOSED,
    phase: categories.size === 1 ? lastPhase : null,
    exitCode: boundedExitCode,
    signal: boundedSignal,
  }
}

function formatKeycloakBootstrapDiagnostic(diagnostic) {
  const exit = diagnostic.exitCode === null ? 'unknown' : String(diagnostic.exitCode)
  const phase = diagnostic.phase ? `; phase=${diagnostic.phase}` : ''
  const signal = diagnostic.signal ? `; signal=${diagnostic.signal}` : ''
  return `category=${diagnostic.category}${phase}; exit=${exit}${signal}`
}

export function runDockerCapture(args, label, inspectOutput = null, spawnRunner = spawnSync) {
  const result = spawnRunner('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  const output = { stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
  let inspectionFailed = false
  try { inspectOutput?.(output) } catch { inspectionFailed = true }
  if (result.error || result.status !== 0) {
    const diagnostic = classifyKeycloakBootstrapDiagnostic({
      status: result.status,
      signal: result.signal,
      stdout: output.stdout,
      stderr: output.stderr,
    })
    throw new Error(`${label} failed (${formatKeycloakBootstrapDiagnostic(diagnostic)})`)
  }
  if (inspectionFailed) throw new Error(`${label} output inspection failed`)
  return output
}

function runDocker(args, label) {
  return runDockerCapture(args, label).stdout
}

function composeArgs(options, profiles = []) {
  const args = ['compose', '--project-name', options.project, '--env-file', options.envFile, '--file', options.compose]
  for (const profile of profiles) args.push('--profile', profile)
  return args
}

const KEYCLOAK_VOLUME_CLASSES = Object.freeze({
  postgres_data: 'postgres',
  redis_data: 'redis-aof',
  keycloak_data: 'keycloak',
  keycloak_bootstrap_state: 'keycloak-bootstrap-state',
})

const ALLOWED_SERVICES = new Set([
  'api',
  'caddy',
  'frontend',
  'identity-binder',
  'keycloak',
  'keycloak-bootstrap',
  'migrator',
  'postgres',
  'redis',
  'synthetic-seed',
  'worker',
])

const FIREWALL_PRIVATE_SUBNETS = ['172.30.0.0/24', '172.30.10.0/24', '172.30.20.0/24', '172.30.30.0/24']

export function validateComposeContainerIdentities(containers, options, label = 'Keycloak cleanup') {
  const services = new Set()
  return containers.map((container) => {
    const labels = container?.Config?.Labels ?? container?.labels ?? {}
    const service = labels['com.docker.compose.service']
    if (labels['com.docker.compose.project'] !== options.project
      || !ALLOWED_SERVICES.has(service)
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

function listProjectContainers(options, label) {
  const raw = runDocker(['ps', '-aq', '--filter', `label=com.docker.compose.project=${options.project}`], `${label} container inventory`)
  const ids = raw.split(/\r?\n/).map((id) => id.trim()).filter(Boolean)
  const containers = []
  for (const id of ids) {
    let inspected
    try {
      inspected = JSON.parse(runDocker(['inspect', id], `${label} container inspect`))[0]
    } catch {
      throw new Error(`${label} refused an unreadable container identity`)
    }
    containers.push({ id, Config: inspected?.Config })
  }
  return validateComposeContainerIdentities(containers, options, label)
}

function assertGuardedContainers(options, label) {
  return listProjectContainers(options, label)
}

function guardedVolumeNames(options, base, label) {
  const expected = new Set(Object.keys(KEYCLOAK_VOLUME_CLASSES).map((name) => `${options.project}_${name}`))
  const raw = runDocker(['volume', 'ls', '--quiet', '--filter', `name=${options.project}_`], label)
  const listed = raw.split(/\r?\n/).map((name) => name.trim()).filter(Boolean)
  const unexpected = listed.filter((name) => !expected.has(name))
  if (unexpected.length > 0) throw new Error(`${label} refused unexpected volume name`)
  return [...expected].filter((name) => listed.includes(name))
}

function assertGuardedVolumes(options, base, label) {
  const volumes = guardedVolumeNames(options, base, label)
  for (const volume of volumes) {
    const inspected = JSON.parse(runDocker(['volume', 'inspect', volume], `${label} inspect`))[0]
    const labels = inspected?.Labels ?? {}
    if (labels['com.docker.compose.project'] !== options.project
      || labels['com.hr-axis.project'] !== 'hr-axis-onprem-core'
      || labels['com.hr-axis.data-class'] !== 'synthetic'
      || labels['com.hr-axis.release-id'] !== options.releaseId) {
      throw new Error(`${label} refused unexpected volume identity`)
    }
    const logicalName = volume.slice(`${options.project}_`.length)
    if (labels['com.hr-axis.volume-class'] !== KEYCLOAK_VOLUME_CLASSES[logicalName]) {
      throw new Error(`${label} refused volume class/name mismatch`)
    }
  }
  return volumes
}

function guardedDown(options, base, label, { removeVolumes = false } = {}) {
  assertGuardedContainers(options, label)
  assertGuardedVolumes(options, base, label)
  const downArgs = [...base, 'down', '--remove-orphans']
  if (removeVolumes) downArgs.splice(downArgs.length - 1, 0, '--volumes')
  runDocker(downArgs, label)
  const remainingContainers = listProjectContainers(options, `${label} postcondition`)
  if (remainingContainers.length > 0) throw new Error(`${label} left project containers behind`)
  if (removeVolumes) {
    const remaining = guardedVolumeNames(options, base, `${label} postcondition`)
    if (remaining.length > 0) throw new Error(`${label} left approved volumes behind`)
  }
}

function parseRejectCounters(iptables) {
  const counters = { packets: 0, bytes: 0, ruleCount: 0 }
  for (const line of String(iptables).split(/\r?\n/)) {
    if (!line.includes('-A DOCKER-USER') || !FIREWALL_PRIVATE_SUBNETS.some((subnet) => line.includes(`-s ${subnet}`)) || !/-j (?:REJECT|DROP)\b/.test(line)) continue
    const match = line.match(/^\[(\d+):(\d+)\]\s+-A\s+/)
    if (!match) continue
    counters.packets += Number(match[1])
    counters.bytes += Number(match[2])
    counters.ruleCount += 1
  }
  return counters
}

function collectScopedFirewallCounters(label) {
  let evidence
  try {
    evidence = collectFirewallEvidence({ counters: true })
  } catch (error) {
    throw new Error(`${label} firewall counter evidence unavailable`)
  }
  const contract = validateFirewallRules({
    iptables: evidence,
    privateSubnets: FIREWALL_PRIVATE_SUBNETS,
    proxyPorts: [443],
    sshAdminCidrs: ['192.0.2.0/24'],
  })
  if (!contract.ok) throw new Error(`${label} firewall contract rejected scoped evidence`)
  return {
    verifier: 'scripts/onprem-core-firewall-verify.mjs',
    scope: { project: 'hr-axis-onprem-keycloak', phases: ['keycloak-bootstrap', 'keycloak-auth'] },
    counters: parseRejectCounters(evidence),
    contractSummary: contract.summary,
  }
}

export function assertFirewallCounterDelta(before, after, label = 'Keycloak firewall proof') {
  const beforePackets = Number(before?.packets)
  const beforeBytes = Number(before?.bytes)
  const afterPackets = Number(after?.packets)
  const afterBytes = Number(after?.bytes)
  if (![beforePackets, beforeBytes, afterPackets, afterBytes].every(Number.isSafeInteger)) {
    throw new Error(`${label} firewall reject counters were malformed`)
  }
  const delta = {
    packets: afterPackets - beforePackets,
    bytes: afterBytes - beforeBytes,
  }
  if (delta.packets < 0 || delta.bytes < 0) {
    throw new Error(`${label} firewall reject counter reset during proof`)
  }
  if (delta.packets !== 0 || delta.bytes !== 0) {
    throw new Error(`${label} observed blocked outbound traffic (packets=${delta.packets}, bytes=${delta.bytes})`)
  }
  return delta
}

function assertComposeIdentity(config, options) {
  const services = config.services ?? {}
  const checked = ['keycloak', 'keycloak-bootstrap', 'identity-binder', 'postgres']
  for (const name of checked) {
    const labels = services[name]?.labels ?? {}
    if (labels['com.hr-axis.project'] !== 'hr-axis-onprem-core'
      || labels['com.hr-axis.data-class'] !== 'synthetic'
      || labels['com.hr-axis.release-id'] !== options.releaseId) {
      throw new Error(`Keycloak Compose identity mismatch for ${name}`)
    }
  }
  const volumes = config.volumes ?? {}
  for (const name of ['postgres_data', 'redis_data', 'keycloak_data', 'keycloak_bootstrap_state']) {
    const labels = volumes[name]?.labels ?? {}
    if (labels['com.hr-axis.project'] !== 'hr-axis-onprem-core'
      || labels['com.hr-axis.data-class'] !== 'synthetic'
      || labels['com.hr-axis.release-id'] !== options.releaseId) {
      throw new Error(`Keycloak Compose volume identity mismatch for ${name}`)
    }
  }
}

function assertSecretSafeLogs(value, label) {
  return assertSecretSafeLogsWithValues(value, label, new Set())
}

export function assertSecretSafeLogsWithValues(value, label, secretValues) {
  const text = String(value)
  for (const secret of secretValues) {
    if (secret && text.includes(secret)) throw new Error(`${label} contained a raw secret or token`)
  }
  if (/(?:password\s*[=:]\s*[^\s,;]+|secret\s*[=:]\s*[^\s,;]+|Bearer\s+eyJ|eyJ[A-Za-z0-9_-]{20,})/i.test(text)) {
    throw new Error(`${label} contained a raw secret or token`)
  }
}

export function collectSecretValues(options) {
  const composePath = resolve(options.compose)
  const composeText = readFileSync(composePath, 'utf8')
  const environment = options.env ?? process.env
  const publicSecretNames = new Set(['caddy_tls_certificate', 'caddy_tls_ca', 'postgres_tls_certificate', 'postgres_tls_ca'])
  const values = new Set()
  const add = (value) => {
    const normalized = String(value ?? '').trim()
    if (normalized) values.add(normalized)
  }
  const entries = [...composeText.matchAll(/^  ([a-z0-9_]+):\r?\n    file:\s+(.+)\r?$/gm)]
  if (entries.length === 0) throw new Error('Keycloak runtime secret scan could not resolve Compose file-backed secrets')
  for (const [, secretName, configuredPath] of entries) {
    if (publicSecretNames.has(secretName) || !isConfidentialRuntimeSecretName(secretName)) continue
    let rawPath = configuredPath.trim().replace(/^['"]|['"]$/g, '')
    rawPath = rawPath.replace(/^\$\{HR_AXIS_SECRET_ROOT:-([^}]*)\}/, (_, defaultRoot) => (
      String(environment.HR_AXIS_SECRET_ROOT ?? '').trim() || defaultRoot
    ))
    if (rawPath.includes('${')) throw new Error(`Keycloak runtime secret scan could not resolve ${secretName} file expression`)
    const filePath = resolve(dirname(composePath), rawPath)
    try {
      const raw = readFileSync(filePath, 'utf8')
      if (secretName === 'keycloak_synthetic_accounts' || secretName === 'keycloak_synthetic_photo_proof_account') {
        for (const line of raw.split(/\r?\n/)) {
          if (!line.trim() || line.trim().startsWith('#')) continue
          const fields = line.split('|')
          if (fields.length !== 12) throw new Error('Keycloak synthetic account secret row is malformed')
          add(fields[2])
        }
      } else add(raw)
    } catch (error) {
      throw new Error(`Keycloak runtime secret scan could not read ${secretName}: ${error.message}`)
    }
  }
  return values
}

export function assertKeycloakAuthProofReceipt(receipt) {
  const denialStatus = (value) => value === 401 || value === 403
  const discovery = receipt?.discovery
  const personas = receipt?.personas
  const expectedCount = 5
  const discoveryValid = discovery?.status === 200
    && discovery.issuerMatches === true
    && discovery.authorizationEndpointMatches === true
    && discovery.tokenEndpointMatches === true
    && discovery.logoutEndpointMatches === true
    && discovery.jwksEndpointMatches === true
  const personasValid = personas?.count === expectedCount
    && personas.sessionsVerified === expectedCount
    && personas.csrfMissingDenied === expectedCount
    && personas.csrfRecoverySucceeded === expectedCount
    && personas.crossScopeDenied === expectedCount
    && personas.authorizedMutationCount === 1
    && personas.deniedMutationCount === expectedCount
    && personas.realmLogoutCount === expectedCount
    && personas.unallowlistedLogoutRejectedCount === expectedCount
    && personas.reauthorizeCredentialCount === expectedCount
    && personas.secureHttpOnlySameSiteHostOnlyCookieCount === expectedCount
    && personas.clearingCookieContractCount === expectedCount
  const jwtRejections = receipt?.jwtRejections ?? {}
  if (!receipt || typeof receipt !== 'object'
    || receipt.schemaVersion !== 1
    || receipt.dataClass !== 'synthetic'
    || !discoveryValid
    || receipt.jwks?.status !== 200
    || !Number.isSafeInteger(receipt.jwks?.keyCount)
    || receipt.jwks.keyCount < 1
    || !denialStatus(receipt.jwks?.unknownKeyStatus)
    || receipt.publicAdminDenials?.allDenied !== true
    || receipt.publicAdminDenials?.paths?.length !== 5
    || !['unknown-key', 'wrong-issuer', 'wrong-audience', 'wrong-role-scope'].every((key) => denialStatus(jwtRejections[key]))
    || !personasValid
    || receipt.csrf?.missingHeaderStatus !== 403
    || receipt.csrf?.recoveryStatus !== 200
    || receipt.logout?.invalidated !== true
    || receipt.logout?.realmEndSession !== true
    || receipt.logout?.reauthorizeRequiresCredentials !== true
    || receipt.scopeAuthorization?.crossScopeDenied !== true
    || receipt.scopeAuthorization?.validCsrfMutationObserved !== true
    || receipt.scopeAuthorization?.deniedActionWriteDelta !== 0
    || receipt.forgedClaimDefense?.deniedActionWriteDelta !== 0
    || receipt.providerSignedOverbroadClaims?.tested !== true
    || !receipt.providerSignedOverbroadClaims?.claimStoreIds?.includes('store-999')
    || receipt.providerSignedOverbroadClaims?.dbAuthorizationRemainedSubordinate !== true
    || receipt.noRawCredentials !== true) {
    throw new Error('Keycloak auth proof receipt failed the authorization acceptance contract')
  }
  return receipt
}

export function resolveAuthProofMounts({ accountsFile, caFile, cwd = process.cwd() }) {
  if (typeof accountsFile !== 'string' || !accountsFile.trim()
    || typeof caFile !== 'string' || !caFile.trim()
    || typeof cwd !== 'string' || !cwd.trim()) {
    throw new Error('Keycloak auth proof mount source is invalid')
  }
  return {
    accountsFile: resolve(cwd, accountsFile),
    caFile: resolve(cwd, caFile),
  }
}

export function resolveAuthProofNetwork(config, options) {
  const edge = config?.networks?.edge
  const labels = edge?.labels ?? {}
  const caddy = config?.services?.caddy
  const caddyLabels = caddy?.labels ?? {}
  if (edge?.name !== `${options.project}_edge`
    || labels['com.hr-axis.project'] !== 'hr-axis-onprem-core'
    || labels['com.hr-axis.data-class'] !== 'synthetic'
    || labels['com.hr-axis.network-class'] !== 'edge'
    || labels['com.hr-axis.release-id'] !== options.releaseId
    || !Object.hasOwn(caddy?.networks ?? {}, 'edge')
    || caddyLabels['com.hr-axis.project'] !== 'hr-axis-onprem-core'
    || caddyLabels['com.hr-axis.data-class'] !== 'synthetic'
    || caddyLabels['com.hr-axis.release-id'] !== options.releaseId) {
    throw new Error('Keycloak auth proof edge network identity mismatch')
  }
  return edge.name
}

export function runKeycloakRuntimeProof(options) {
  if (options.project !== 'hr-axis-onprem-keycloak') throw new Error('Keycloak runtime proof refuses an unapproved Compose project')
  const profiles = ['infra', 'keycloak-bootstrap', 'migrate', 'seed', 'identity-binder', 'runtime']
  const base = composeArgs(options, profiles)
  const receipt = {
    schemaVersion: 1,
    dataClass: 'synthetic',
    releaseId: options.releaseId,
    keycloak: {
      image: null,
      imagePinned: false,
      freshVolumes: options.requireFreshVolumes,
      managementHealth: false,
      realmMetadata: false,
      authorizationEndpoint: false,
      bootstrapCompleted: false,
      bootstrapSecondRun: false,
      gracefulStopVerified: false,
      gracefulStopLifecycleVerified: false,
      gracefulStopMarkerObserved: false,
      restartIdentityVerified: false,
      restartCountStable: false,
      persistenceAfterRestart: false,
      hostPortPublished: null,
      subjectManifestPrivate: false,
      projectIdentityMatched: false,
      logsSecretScanned: false,
      noRawCredentials: false,
      initialAuthProof: null,
      authProof: null,
      publicAdminDenials: null,
      cookieContract: null,
      providerSignedOverbroadClaims: null,
      jwksRotation: null,
      firewallRejectCounters: null,
    },
  }
  let started = false
  if (options.requireFreshVolumes) guardedDown(options, base, 'fresh-volume cleanup', { removeVolumes: true })
  try {
    const secretValues = collectSecretValues(options)
    const authProofMounts = resolveAuthProofMounts(options)
    if (secretValues.size === 0) throw new Error('Keycloak runtime secret scan has no readable secret values')
    const firewallBefore = collectScopedFirewallCounters('Keycloak preflight')
    const scanCapture = (capture, label) => {
      assertSecretSafeLogsWithValues(capture.stdout, `${label} stdout`, secretValues)
      assertSecretSafeLogsWithValues(capture.stderr, `${label} stderr`, secretValues)
      return capture.stdout
    }
    const runScannedOneShot = (args, label) => runDockerCapture(args, label, (capture) => scanCapture(capture, label)).stdout
    const composeConfig = JSON.parse(runDocker([...base, 'config', '--format', 'json'], 'Keycloak Compose identity').toString())
    assertComposeIdentity(composeConfig, options)
    const authProofNetwork = resolveAuthProofNetwork(composeConfig, options)
    const executePersonaAuthProof = (label) => {
      const capture = runDockerCapture(['run', '--rm', '--user', '1000:1000', '--network', authProofNetwork, '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges:true', '--tmpfs', '/tmp:rw,noexec,nosuid,size=32m',
        '-v', `${authProofMounts.accountsFile}:/run/onprem/synthetic-accounts:ro`,
        '-v', `${authProofMounts.caFile}:/run/onprem/ca.crt:ro`,
        '-v', `${process.cwd()}/scripts/onprem-keycloak-auth-proof.mjs:/opt/onprem-keycloak-auth-proof.mjs:ro`,
        'node:24-trixie-slim@sha256:0711b541c1c33a8a530ac4f0d391baa9a15b3d804695b1b24a47daa5fb60e74d',
        'node', '/opt/onprem-keycloak-auth-proof.mjs', '--host', options.authHost, '--connect-host', 'caddy', '--connect-port', '8443', '--accounts-file', '/run/onprem/synthetic-accounts', '--ca-file', '/run/onprem/ca.crt'], label, (value) => scanCapture(value, label))
      const parsed = JSON.parse(scanCapture(capture, label))
      assertKeycloakAuthProofReceipt(parsed)
      const text = JSON.stringify(parsed)
      assertSecretSafeLogsWithValues(text, `${label} receipt`, secretValues)
      if (/(?:access_token|id_token|Bearer\s+eyJ|password\s*[=:]\s*[^\s,;]+|secret\s*[=:]\s*[^\s,;]+|eyJ[A-Za-z0-9_-]{20,})/i.test(text)) {
        throw new Error(`${label} receipt contained raw credentials`)
      }
      return parsed
    }
    receipt.keycloak.projectIdentityMatched = true
    const keycloakImage = composeConfig.services?.keycloak?.image ?? ''
    receipt.keycloak.image = keycloakImage
    // CI supplies the immutable local image config digest directly. A pushed
    // release may instead resolve through name@manifest-digest; both are
    // accepted, while mutable tags and bare names remain rejected.
    receipt.keycloak.imagePinned = /^(?:sha256:[0-9a-f]{64}|.+@sha256:[0-9a-f]{64})$/i.test(keycloakImage)
    receipt.keycloak.hostPortPublished = Array.isArray(composeConfig.services?.keycloak?.ports) && composeConfig.services.keycloak.ports.length > 0
    if (!receipt.keycloak.imagePinned) throw new Error('Keycloak image identity is mutable or unresolved')
    if (receipt.keycloak.hostPortPublished) throw new Error('Keycloak management ports must remain private')
    // bootstrap-admin requires all Keycloak nodes to be stopped. Migrate and
    // seed first, reconcile in the one-shot service, then start the long-lived
    // server and prove persistence across a stop/reconcile/restart cycle.
    // Mark the project as started before the first mutating Compose call so a
    // partial `up` failure still enters the guarded cleanup path.
    started = true
    runDocker([...base, 'up', '-d', 'postgres'], 'PostgreSQL dependency startup')
    runScannedOneShot([...base, 'run', '--rm', 'migrator'], 'strict-local migration')
    runScannedOneShot([...base, 'run', '--rm', 'synthetic-seed'], 'strict-local synthetic seed')
    runScannedOneShot([...base, 'run', '--rm', 'keycloak-bootstrap'], 'Keycloak bootstrap reconcile')
    receipt.keycloak.bootstrapCompleted = true
    runDocker([...base, 'run', '--rm', '--no-deps', '--entrypoint', '/bin/sh', 'keycloak-bootstrap', '-ec', 'test "$(stat -c %u /var/lib/keycloak-bootstrap)" = 1000; test "$(stat -c %a /var/lib/keycloak-bootstrap)" = 700; test "$(stat -c %u /var/lib/keycloak-bootstrap/subjects.v1.json)" = 1000; test "$(stat -c %a /var/lib/keycloak-bootstrap/subjects.v1.json)" = 600'], 'private subject manifest ownership')
    receipt.keycloak.subjectManifestPrivate = true
    runScannedOneShot([...base, 'run', '--rm', '--no-deps', 'identity-binder'], 'synthetic identity binder')
    runDocker([...base, 'up', '-d', 'keycloak', 'api', 'worker', 'frontend', 'caddy'], 'long-lived Keycloak runtime startup')
    runDocker([...base, 'exec', '-T', 'keycloak', '/bin/bash', '-ec', "exec 3<>/dev/tcp/127.0.0.1/9000; printf 'GET /health/ready HTTP/1.0\\r\\n\\r\\n' >&3; grep -q '200' <&3"], 'Keycloak management health')
    receipt.keycloak.managementHealth = true
    runDocker([...base, 'exec', '-T', 'keycloak', '/bin/bash', '-ec', "exec 3<>/dev/tcp/127.0.0.1/8080; printf 'GET /realms/store-ops/.well-known/openid-configuration HTTP/1.0\\r\\n\\r\\n' >&3; grep -q '200' <&3"], 'Keycloak realm metadata')
    receipt.keycloak.realmMetadata = true
    receipt.keycloak.initialAuthProof = executePersonaAuthProof('initial Keycloak persona auth proof')
    scanCapture(runDockerCapture([...base, 'logs', '--no-color', '--no-log-prefix'], 'Keycloak project secret-log scan'), 'Keycloak project logs')
    receipt.keycloak.noRawCredentials = true
    receipt.keycloak.logsSecretScanned = true
    const stoppedKeycloakId = runDocker([...base, 'ps', '--all', '--quiet', '--no-trunc', 'keycloak'], 'pre-stop Keycloak identity').trim()
    if (!stoppedKeycloakId) throw new Error('Keycloak container identity is missing before stop')
    const keycloakBeforeInspect = JSON.parse(runDocker(['inspect', stoppedKeycloakId], 'pre-stop Keycloak state'))[0]
    const keycloakBeforeIdentity = assertKeycloakPreStopState({ containerId: stoppedKeycloakId, inspect: keycloakBeforeInspect })
    runDockerCapture(
      buildKeycloakStopArgs(keycloakBeforeIdentity.containerId),
      'explicit Keycloak SIGTERM stop',
      (capture) => scanCapture(capture, 'explicit Keycloak SIGTERM stop'),
    )
    const keycloakAfterInspect = JSON.parse(runDocker(['inspect', keycloakBeforeIdentity.containerId], 'post-stop Keycloak state'))[0]
    const keycloakStopProof = assertControlledKeycloakStop({ beforeInspect: keycloakBeforeInspect, afterInspect: keycloakAfterInspect })
    const keycloakLogObservation = observeKeycloakGracefulStop({
      service: 'keycloak',
      state: keycloakAfterInspect.State,
      secretValues,
      readLogs: ({ since, timestamps }) => {
        if (since !== keycloakAfterInspect.State?.StartedAt || timestamps !== true) throw new Error('Keycloak log reader received an invalid fresh-log window')
        const capture = runDockerCapture(
          ['logs', '--since', since, '--timestamps', keycloakBeforeIdentity.containerId],
          'stopped Keycloak graceful-shutdown logs',
          (value) => scanCapture(value, 'stopped Keycloak graceful-shutdown logs'),
        )
        return capture
      },
    })
    receipt.keycloak.gracefulStopVerified = keycloakStopProof.lifecycleVerified
    receipt.keycloak.gracefulStopLifecycleVerified = keycloakStopProof.lifecycleVerified
    receipt.keycloak.gracefulStopMarkerObserved = keycloakLogObservation.markerObserved
    runScannedOneShot([...base, 'run', '--rm', 'keycloak-bootstrap'], 'Keycloak bootstrap idempotency retry')
    receipt.keycloak.bootstrapSecondRun = true
    runScannedOneShot([...base, 'run', '--rm', '--no-deps', 'identity-binder'], 'synthetic identity binder retry')
    runDocker([...base, 'up', '-d', '--wait', '--wait-timeout', '180', 'keycloak'], 'Keycloak restart after retry')
    const keycloakAfterRestartInspect = JSON.parse(runDocker(['inspect', keycloakBeforeIdentity.containerId], 'post-restart Keycloak state'))[0]
    assertKeycloakContainerIdentity({ containerId: keycloakBeforeIdentity.containerId, inspect: keycloakAfterRestartInspect, expectedRestartCount: 0 })
    if (keycloakAfterRestartInspect.State?.Status !== 'running' || keycloakAfterRestartInspect.State?.Running !== true
      || keycloakAfterRestartInspect.State?.Health?.Status !== 'healthy') {
      throw new Error('Keycloak post-restart state contract failed')
    }
    receipt.keycloak.restartIdentityVerified = true
    receipt.keycloak.restartCountStable = true
    runDocker([...base, 'exec', '-T', 'keycloak', '/bin/bash', '-ec', "exec 3<>/dev/tcp/127.0.0.1/9000; printf 'GET /health/ready HTTP/1.0\\r\\n\\r\\n' >&3; grep -q '200' <&3"], 'Keycloak health after retry')
    runDocker([...base, 'exec', '-T', 'keycloak', '/bin/bash', '-ec', "exec 3<>/dev/tcp/127.0.0.1/8080; printf 'GET /realms/store-ops/.well-known/openid-configuration HTTP/1.0\\r\\n\\r\\n' >&3; grep -q '200' <&3"], 'Keycloak metadata after retry')
    receipt.keycloak.authProof = executePersonaAuthProof('post-reconcile Keycloak persona auth proof')
    receipt.keycloak.authorizationEndpoint = true
    receipt.keycloak.publicAdminDenials = receipt.keycloak.authProof.publicAdminDenials ?? null
    receipt.keycloak.cookieContract = {
      secureHttpOnlySameSiteHostOnly: receipt.keycloak.authProof.personas?.secureHttpOnlySameSiteHostOnlyCookieCount === receipt.keycloak.authProof.personas?.count,
      clearingObserved: receipt.keycloak.authProof.personas?.clearingCookieContractCount === receipt.keycloak.authProof.personas?.count,
    }
    receipt.keycloak.providerSignedOverbroadClaims = receipt.keycloak.authProof.providerSignedOverbroadClaims ?? null
    receipt.keycloak.jwksRotation = receipt.keycloak.authProof.jwksRotation ?? {
      attempted: false,
      proved: false,
      status: 'unproven',
      activationGate: 'owner-approved fresh-Linux key rotation and retired-key rehearsal required',
    }
    receipt.keycloak.persistenceAfterRestart = true
    scanCapture(runDockerCapture([...base, 'logs', '--no-color', '--no-log-prefix'], 'Keycloak retry project secret-log scan'), 'Keycloak retry project logs')
    const firewallAfter = collectScopedFirewallCounters('Keycloak post-auth')
    const firewallDelta = assertFirewallCounterDelta(
      firewallBefore.counters,
      firewallAfter.counters,
      'Keycloak firewall proof',
    )
    receipt.keycloak.firewallRejectCounters = {
      before: firewallBefore,
      after: firewallAfter,
      delta: firewallDelta,
    }
    if (options.receipt) {
      mkdirSync(dirname(options.receipt), { recursive: true })
      writeFileSync(options.receipt, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 })
    }
    return receipt
  } finally {
    if (started) {
      guardedDown(options, base, 'Keycloak runtime cleanup', { removeVolumes: false })
    }
  }
}

export function cleanupKeycloakRuntime(options) {
  if (options.project !== 'hr-axis-onprem-keycloak') throw new Error('Keycloak runtime cleanup refuses an unapproved Compose project')
  const profiles = ['infra', 'keycloak-bootstrap', 'migrate', 'seed', 'identity-binder', 'runtime']
  const base = composeArgs(options, profiles)
  guardedDown(options, base, 'Keycloak runtime cleanup', { removeVolumes: false })
  return { cleaned: true, project: options.project, releaseId: options.releaseId }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.cleanup) {
      cleanupKeycloakRuntime(options)
      console.log('on-prem Keycloak runtime cleanup: PASS (exact project, guarded identity)')
    } else if (!options.execute) {
      console.log('on-prem Keycloak runtime proof: use --execute with an isolated synthetic Compose project')
    } else {
       runKeycloakRuntimeProof(options)
      console.log('on-prem Keycloak runtime proof: PASS (synthetic, sanitized)')
    }
  } catch (error) {
    console.error(`on-prem Keycloak runtime proof: ${error.message}`)
    process.exitCode = 1
  }
}

export { assertGuardedContainers, collectScopedFirewallCounters, parseRejectCounters }
