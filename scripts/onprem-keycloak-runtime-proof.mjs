import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { collectFirewallEvidence, validateFirewallRules } from './onprem-core-firewall-verify.mjs'

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

function runDockerCapture(args, label, inspectOutput = null) {
  const result = spawnSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  const output = { stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
  inspectOutput?.(output)
  if (result.error || result.status !== 0) throw new Error(`${label} failed`)
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

function assertSecretSafeLogsWithValues(value, label, secretValues) {
  const text = String(value)
  for (const secret of secretValues) {
    if (secret && text.includes(secret)) throw new Error(`${label} contained a raw secret or token`)
  }
  if (/(?:password\s*[=:]\s*[^\s,;]+|secret\s*[=:]\s*[^\s,;]+|Bearer\s+eyJ|eyJ[A-Za-z0-9_-]{20,})/i.test(text)) {
    throw new Error(`${label} contained a raw secret or token`)
  }
}

function collectSecretValues(options) {
  const composePath = resolve(options.compose)
  const composeText = readFileSync(composePath, 'utf8')
  const publicSecretNames = new Set(['caddy_tls_certificate', 'caddy_tls_ca', 'postgres_tls_certificate', 'postgres_tls_ca'])
  const values = new Set()
  const add = (value) => {
    const normalized = String(value ?? '').trim()
    if (normalized) values.add(normalized)
  }
  const entries = [...composeText.matchAll(/^  ([a-z0-9_]+):\r?\n    file:\s+(.+)\r?$/gm)]
  if (entries.length === 0) throw new Error('Keycloak runtime secret scan could not resolve Compose file-backed secrets')
  for (const [, secretName, configuredPath] of entries) {
    if (publicSecretNames.has(secretName)) continue
    const rawPath = configuredPath.trim().replace(/^['"]|['"]$/g, '')
    const filePath = resolve(dirname(composePath), rawPath)
    try {
      const raw = readFileSync(filePath, 'utf8')
      if (secretName === 'keycloak_synthetic_accounts') {
        for (const line of raw.split(/\r?\n/)) {
          if (!line.trim() || line.trim().startsWith('#')) continue
          const fields = line.split('|')
          if (fields.length < 3) throw new Error('Keycloak synthetic account secret row is malformed')
          add(fields[2])
        }
      } else add(raw)
    } catch (error) {
      throw new Error(`Keycloak runtime secret scan could not read ${secretName}: ${error.message}`)
    }
  }
  return values
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
      persistenceAfterRestart: false,
      hostPortPublished: null,
      subjectManifestPrivate: false,
      projectIdentityMatched: false,
      logsSecretScanned: false,
      noRawCredentials: false,
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
    runDocker([...base, 'exec', '-T', 'keycloak', '/bin/bash', '-ec', "request='GET /realms/store-ops/protocol/openid-connect/auth?client_id=store-ops-admin-web&redirect_uri=https%3A%2F%2Fhr-axis.example.invalid%2Fauth%2Fcallback&response_type=code&scope=openid&code_challenge_method=S256&code_challenge=synthetic HTTP/1.0'; exec 3<>/dev/tcp/127.0.0.1/8080; printf '%s\\r\\nHost: hr-axis.example.invalid\\r\\nConnection: close\\r\\n\\r\\n' \"$request\" >&3; { grep -q '200' <&3 || grep -q '302' <&3; }"], 'Keycloak authorization endpoint')
    receipt.keycloak.authorizationEndpoint = true
    const authProofCapture = runDockerCapture(['run', '--rm', '--network', 'host', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges:true', '--tmpfs', '/tmp:rw,noexec,nosuid,size=32m',
      '-v', `${options.accountsFile}:/run/onprem/synthetic-accounts:ro`,
      '-v', `${options.caFile}:/run/onprem/ca.crt:ro`,
      '-v', `${process.cwd()}/scripts/onprem-keycloak-auth-proof.mjs:/opt/onprem-keycloak-auth-proof.mjs:ro`,
      'node:24-trixie-slim@sha256:0711b541c1c33a8a530ac4f0d391baa9a15b3d804695b1b24a47daa5fb60e74d',
      '/opt/onprem-keycloak-auth-proof.mjs', '--host', options.authHost, '--accounts-file', '/run/onprem/synthetic-accounts', '--ca-file', '/run/onprem/ca.crt'], 'Keycloak persona auth proof', (capture) => scanCapture(capture, 'Keycloak persona auth proof'))
    const authProof = scanCapture(authProofCapture, 'Keycloak persona auth proof')
    receipt.keycloak.authProof = JSON.parse(authProof)
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
    const authReceiptText = JSON.stringify(receipt.keycloak.authProof)
    assertSecretSafeLogsWithValues(authReceiptText, 'Keycloak auth receipt', secretValues)
    if (/(?:access_token|id_token|Bearer\s+eyJ|password\s*[=:]\s*[^\s,;]+|secret\s*[=:]\s*[^\s,;]+|eyJ[A-Za-z0-9_-]{20,})/i.test(authReceiptText)) throw new Error('Keycloak auth receipt contained raw credentials')
    scanCapture(runDockerCapture([...base, 'logs', '--no-color', '--no-log-prefix'], 'Keycloak project secret-log scan'), 'Keycloak project logs')
    receipt.keycloak.noRawCredentials = true
    receipt.keycloak.logsSecretScanned = true
    runDocker([...base, 'stop', 'keycloak'], 'long-lived Keycloak stop before retry')
    runScannedOneShot([...base, 'run', '--rm', 'keycloak-bootstrap'], 'Keycloak bootstrap idempotency retry')
    receipt.keycloak.bootstrapSecondRun = true
    runScannedOneShot([...base, 'run', '--rm', '--no-deps', 'identity-binder'], 'synthetic identity binder retry')
    runDocker([...base, 'up', '-d', 'keycloak'], 'Keycloak restart after retry')
    runDocker([...base, 'exec', '-T', 'keycloak', '/bin/bash', '-ec', "exec 3<>/dev/tcp/127.0.0.1/9000; printf 'GET /health/ready HTTP/1.0\\r\\n\\r\\n' >&3; grep -q '200' <&3"], 'Keycloak health after retry')
    runDocker([...base, 'exec', '-T', 'keycloak', '/bin/bash', '-ec', "exec 3<>/dev/tcp/127.0.0.1/8080; printf 'GET /realms/store-ops/.well-known/openid-configuration HTTP/1.0\\r\\n\\r\\n' >&3; grep -q '200' <&3"], 'Keycloak metadata after retry')
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
