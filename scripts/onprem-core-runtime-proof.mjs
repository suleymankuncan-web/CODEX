import { execFileSync, spawnSync } from 'node:child_process'
import { lstatSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { collectFirewallEvidence, validateFirewallRules } from './onprem-core-firewall-verify.mjs'

const PRIVATE_SUBNETS = ['172.30.0.0/24', '172.30.10.0/24', '172.30.20.0/24', '172.30.30.0/24']
const LONG_LIVED = ['caddy', 'frontend', 'api', 'worker', 'postgres', 'redis']
const EXPECTED_LIMITS = {
  caddy: [0.25, 128 * 1024 * 1024, 64],
  frontend: [0.25, 128 * 1024 * 1024, 64],
  api: [0.9, 1536 * 1024 * 1024, 192],
  worker: [0.9, 1536 * 1024 * 1024, 192],
  postgres: [1.2, 2048 * 1024 * 1024, 192],
  redis: [0.5, 768 * 1024 * 1024, 96],
}

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

function command(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env ?? process.env,
    input: options.input,
    windowsHide: true,
  })
  if (result.error || (!options.allowFailure && result.status !== 0)) {
    const tail = redact(`${result.stderr ?? ''}\n${result.stdout ?? ''}`).trim().split(/\r?\n/).slice(-12).join('\n')
    throw new Error(`${options.label ?? command} failed${tail ? `\n${tail}` : ''}`)
  }
  return { status: result.status ?? -1, stderr: result.stderr ?? '', stdout: result.stdout ?? '' }
}

function parseArgs(argv) {
  const options = {
    compose: 'infra/onprem/core/compose.yaml',
    project: 'hr-axis-onprem-core',
    sshAdminCidrs: [],
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
    else throw new Error(`unknown argument: ${arg}`)
  }
  if (!options.envFile) throw new Error('--env-file is required')
  if (!options.releaseId || !/^[A-Za-z0-9._-]{8,128}$/.test(options.releaseId)) throw new Error('--release-id must be an exact sanitized release identity')
  if (options.sshAdminCidrs.length === 0) throw new Error('at least one --ssh-admin-cidr is required')
  if (!options.execute) throw new Error('full Linux/Docker proof requires explicit --execute')
  if (process.platform !== 'linux') throw new Error('full runtime proof is Linux-only; docker compose config remains portable')
  return options
}

function immutableImage(value) {
  return (/^sha256:[0-9a-f]{64}$/i.test(value) || /@sha256:[0-9a-f]{64}$/i.test(value)) && !/sha256:0{64}$/i.test(value)
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

function assertSecretPermissions(config) {
  const publicFiles = new Set(['caddy_tls_certificate', 'caddy_tls_ca', 'postgres_tls_certificate', 'postgres_tls_ca'])
  const expectedUid = new Map([
    ['caddy_tls_private_key', 10001],
    ['postgres_tls_private_key', 70],
    ['postgres_bootstrap_password', 70],
    ['postgres_migrator_password', 70],
    ['postgres_api_password', 70],
    ['postgres_worker_password', 70],
    ['redis_users_acl', 999],
    ['redis_health_url', 999],
    ['migrator_database_url', 65532],
    ['api_database_url', 65532],
    ['worker_database_url', 65532],
    ['redis_api_url', 65532],
    ['redis_worker_url', 65532],
    ['jwt_secret', 65532],
  ])

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

export function assertProbeOutput(output, expected) {
  const text = `${output.stdout}\n${output.stderr}`
  if (!/"event"\s*:\s*"onprem\.synthetic_queue_probe\.completed"/.test(text)) {
    throw new Error(`synthetic queue ${expected.mode} omitted the completion event`)
  }
  for (const [key, value] of Object.entries(expected)) {
    const rendered = typeof value === 'string' ? `"${value}"` : String(value)
    if (!new RegExp(`"${key}"\\s*:\\s*${rendered}`).test(text)) {
      throw new Error(`synthetic queue ${expected.mode} result mismatch for ${key}`)
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const composePath = resolve(options.compose)
  const envPath = resolve(options.envFile)
  const base = ['compose', '--project-name', options.project, '--env-file', envPath, '--file', composePath]
  const composeArgs = (args, profiles = []) => [...base, ...profiles.flatMap((profile) => ['--profile', profile]), ...args]
  let secretValues = new Map()
  const compose = (args, profiles = []) => {
    const result = command('docker', composeArgs(args, profiles), { label: `docker compose ${args[0]}` })
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
    project: options.project,
    releaseId: options.releaseId,
    resources: 'exact-approved-ceilings',
    seedAggregates: null,
    services: LONG_LIVED,
    outageRecovery: null,
    volumeRecovery: 'same-volume-only',
  }

  if (config.name !== options.project) throw new Error('Compose project identity mismatch')
  if (config.services.caddy.environment.HR_AXIS_PUBLIC_HOST === 'hr-axis.example.invalid') throw new Error('placeholder public host is forbidden in executable proof')
  for (const [name, service] of Object.entries(config.services)) {
    if (!immutableImage(service.image)) throw new Error(`service ${name} does not use an exact immutable image identity`)
    if (service.labels?.['com.hr-axis.release-id'] !== options.releaseId) throw new Error(`service ${name} release identity mismatch`)
  }
  assertSecretPermissions(config)
  secretValues = new Map(
    Object.entries(config.secrets ?? {}).map(([name, descriptor]) => [
      name,
      readFileSync(descriptor.file, 'utf8').trim(),
    ]),
  )
  activeSecretValues = [...secretValues.values()].filter(Boolean)
  assertNoSecretLeak(secretValues, { 'docker compose config': serializedConfig })

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
      command(process.execPath, ['-e', 'setTimeout(()=>{},1000)'], { label: 'health wait' })
    }
    throw new Error(`${service} did not become healthy`)
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

  const assertRedisDestructiveCommandsDenied = (service, urlFile) => {
    const script = [
      "const fs=require('node:fs')",
      "const Redis=require('ioredis')",
      `const client=new Redis(fs.readFileSync('${urlFile}','utf8').trim(),{connectTimeout:5000,maxRetriesPerRequest:1})`,
      "const probes=[['flushall'],['flushdb'],['swapdb','0','1'],['migrate','127.0.0.1','1','__acl_probe__','0','1']]",
      "Promise.all(probes.map(async(args)=>{try{await client.call(...args);throw new Error('destructive Redis command was allowed')}catch(error){if(!String(error?.message).includes('NOPERM'))throw error}})).then(()=>client.quit()).then(()=>process.exit(0)).catch(()=>{client.disconnect(false);process.exit(1)})",
    ].join(';')
    compose(['run', '--rm', '--no-deps', service, '/nodejs/bin/node', '-e', script], ['runtime'])
  }

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
      "const request=https.get({ca:fs.readFileSync('/run/proof/ca.crt'),headers:{host:process.env.PROOF_HOST},host:process.env.PROOF_IP,port:8443,servername:process.env.PROOF_HOST,path:'/healthz',timeout:5000},response=>{response.resume();process.exit(response.statusCode===200?0:1)})",
      "request.on('error',()=>process.exit(1))",
      "request.on('timeout',()=>{request.destroy();process.exit(1)})",
    ].join(';')
    const tlsResult = command('docker', [
      'run', '--rm',
      '--network', `${options.project}_proxy`,
      '--read-only',
      '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges',
      '--volume', `${config.secrets.caddy_tls_ca.file}:/run/proof/ca.crt:ro`,
      '--env', `PROOF_HOST=${publicHost}`,
      '--env', `PROOF_IP=${caddyProxyIp}`,
      '--entrypoint', '/nodejs/bin/node',
      config.services.api.image,
      '-e', tlsProbe,
    ], { label: 'isolated proxy-network verify-full HTTPS proof' })
    assertNoSecretLeak(secretValues, {
      'TLS proof stderr': tlsResult.stderr,
      'TLS proof stdout': tlsResult.stdout,
    })
    receipt.tls = { internalHostnameVerified: true }

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
    const redisMountBefore = JSON.parse(command('docker', ['inspect', redisId], { label: 'inspect redis volume' }).stdout)[0].Mounts.find((mount) => mount.Destination === '/data')?.Name
    const enqueued = compose(['run', '--rm', '--no-deps', 'worker', 'dist/src/onprem/synthetic-queue-probe.js', 'enqueue'], ['runtime'])
    assertProbeOutput(enqueued, { mode: 'enqueue', queuedCount: 1, status: 'queued' })
    command(process.execPath, ['-e', 'setTimeout(()=>{},2000)'], { label: 'AOF everysec wait' })
    compose(['stop', 'redis'], ['infra'])
    const redisStoppedState = JSON.parse(command('docker', ['inspect', redisId], { label: 'inspect stopped redis' }).stdout)[0].State
    if (redisStoppedState.ExitCode !== 0 || redisStoppedState.OOMKilled || redisStoppedState.Dead || redisStoppedState.Error) {
      throw new Error('Redis outage was not a graceful stop')
    }
    waitUnhealthy('api')
    waitUnhealthy('worker')
    compose(['start', 'redis'], ['infra'])
    waitHealthy('redis')
    waitHealthy('api')
    waitHealthy('worker')
    const redisIdAfter = compose(['ps', '--quiet', 'redis'], ['infra']).stdout.trim()
    const redisMountAfter = JSON.parse(command('docker', ['inspect', redisIdAfter], { label: 'inspect restarted redis volume' }).stdout)[0].Mounts.find((mount) => mount.Destination === '/data')?.Name
    if (!redisMountBefore || redisMountBefore !== redisMountAfter) throw new Error('Redis restart did not preserve the exact named AOF volume')
    const processed = compose(['run', '--rm', '--no-deps', 'worker', 'dist/src/onprem/synthetic-queue-probe.js', 'process'], ['runtime'])
    assertProbeOutput(processed, { duplicateCount: 0, mode: 'process', processedCount: 1, status: 'completed' })
    const queueStatus = compose(['run', '--rm', '--no-deps', 'worker', 'dist/src/onprem/synthetic-queue-probe.js', 'status'], ['runtime'])
    assertProbeOutput(queueStatus, { markerCount: 1, mode: 'status', state: 'completed' })
    receipt.outageRecovery = { apiUnhealthy: true, recovered: true, redisStoppedGracefully: true, workerUnhealthy: true }

    compose(['restart', 'postgres'], ['infra'])
    waitHealthy('postgres')
    assertPersistenceIdentity('PostgreSQL restart')

    compose(['stop', ...LONG_LIVED], ['runtime'])
    for (const service of LONG_LIVED) {
      const id = compose(['ps', '--all', '--quiet', service], ['runtime']).stdout.trim()
      const state = JSON.parse(command('docker', ['inspect', id], { label: `inspect stopped ${service}` }).stdout)[0].State
      if (state.ExitCode !== 0 || state.OOMKilled || state.Dead || state.Error) throw new Error(`${service} did not stop gracefully`)
    }
    compose(['up', '--detach', 'postgres', 'redis'], ['infra'])
    waitHealthy('postgres')
    waitHealthy('redis')
    compose(['up', '--detach', 'api', 'worker', 'frontend', 'caddy'], ['runtime'])
    for (const service of LONG_LIVED) waitHealthy(service)
    assertPersistenceIdentity('full project restart')

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
    if (cleanupRequired) compose(['down', '--remove-orphans'], ['infra', 'migrate', 'seed', 'runtime'])
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
