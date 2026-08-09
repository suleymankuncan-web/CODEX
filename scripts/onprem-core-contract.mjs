import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const EXPECTED_SERVICES = ['caddy', 'frontend', 'api', 'worker', 'migrator', 'synthetic-seed', 'postgres', 'redis']
const LONG_LIVED = ['caddy', 'frontend', 'api', 'worker', 'postgres', 'redis']
const EXPECTED_RESOURCES = {
  caddy: ['0.25', '128m'],
  frontend: ['0.25', '128m'],
  api: ['0.9', '1536m'],
  worker: ['0.9', '1536m'],
  postgres: ['1.2', '2048m'],
  redis: ['0.5', '768m'],
  migrator: ['0.5', '512m'],
  'synthetic-seed': ['0.5', '512m'],
}

function serviceBlocks(compose) {
  const lines = compose.split(/\r?\n/)
  const blocks = new Map()
  let inServices = false
  let current = null

  for (const line of lines) {
    if (line === 'services:') {
      inServices = true
      continue
    }
    if (inServices && /^\S/.test(line)) break
    const match = /^  ([a-z0-9-]+):\s*$/.exec(line)
    if (match) {
      current = match[1]
      blocks.set(current, '')
      continue
    }
    if (current) blocks.set(current, `${blocks.get(current)}${line}\n`)
  }
  return blocks
}

function hasImmutableDigest(value) {
  return /@sha256:[0-9a-f]{64}(?:\}?$|$)/i.test(value) || /^sha256:[0-9a-f]{64}$/i.test(value)
}

function envValue(text, name) {
  return text.match(new RegExp(`^${name}=(.+)$`, 'm'))?.[1]?.trim() ?? ''
}

export function validateOnpremCoreContract(input) {
  const errors = []
  const blocks = serviceBlocks(input.compose)
  const services = [...blocks.keys()]
  const fail = (condition, message) => {
    if (!condition) errors.push(message)
  }

  fail(JSON.stringify(services) === JSON.stringify(EXPECTED_SERVICES), 'compose must define only the eight approved ONP-2 services in dependency order')
  fail(!/^\s*build:/m.test(input.compose), 'compose must never build images')

  for (const name of ['HR_AXIS_BACKEND_IMAGE', 'HR_AXIS_FRONTEND_IMAGE', 'CADDY_IMAGE', 'POSTGRES_IMAGE', 'REDIS_IMAGE']) {
    fail(hasImmutableDigest(envValue(input.envTemplate, name)), `env.template must provide an immutable application image or infrastructure digest for ${name}`)
  }
  for (const [service, block] of blocks) {
    fail(/^    image:/m.test(block), `${service} must declare an image`)
  }

  for (const [service, block] of blocks) {
    if (service !== 'caddy') fail(!/^    ports:/m.test(block), `only caddy may publish host ports (${service} publishes ports)`)
  }
  fail(/ports:\s*\n\s+- ["']?443:8443["']?/m.test(blocks.get('caddy') ?? ''), 'caddy must publish host TCP 443 to its non-root listener')
  fail(!/(?:80:80|:80\b)/.test(blocks.get('caddy') ?? ''), 'TCP 80 must not be published')
  fail(/networks: \[edge, proxy\]/.test(blocks.get('caddy') ?? ''), 'caddy alone must bridge edge and internal proxy networks')
  fail(/user: ["']10001:10001["']/.test(blocks.get('caddy') ?? '') && !/cap_add:/.test(blocks.get('caddy') ?? ''), 'caddy must run as fixed numeric non-root without added capabilities')
  for (const [service, block] of blocks) {
    if (service !== 'caddy') fail(!/networks:[^\n]*\bedge\b/.test(block), `${service} must not attach to the edge network`)
  }
  for (const network of ['proxy', 'app', 'data']) {
    fail(new RegExp(`^  ${network}:\\n    internal: true`, 'm').test(input.compose), 'proxy, app, and data networks must be internal')
  }
  fail(/^  edge:\n    driver: bridge\n    ipam:\n      config:\n        - subnet: 172\.30\.0\.0\/24/m.test(input.compose), 'edge must be a pinned bridge subnet so egress policy can cover caddy')
  fail((input.compose.match(/com\.hr-axis\.project: hr-axis-onprem-core/g) ?? []).length >= 7, 'services, networks, and volumes require project labels')
  fail((input.compose.match(/com\.hr-axis\.data-class: synthetic/g) ?? []).length >= 7, 'services, networks, and volumes require synthetic data-class labels')

  const sensitiveEnvironment = /^\s{6}([A-Z0-9_]*(?:DATABASE_URL|REDIS_URL|PASSWORD|SECRET|PRIVATE_KEY|ACCESS_KEY|TOKEN|DSN)[A-Z0-9_]*):/gm
  for (const match of input.compose.matchAll(sensitiveEnvironment)) {
    if (!match[1].endsWith('_FILE')) errors.push(`sensitive environment variable must use a _FILE boundary: ${match[1]}`)
  }
  fail(!/\b(?:DATABASE_URL|REDIS_URL|JWT_SECRET|BROWSER_SESSION_SECRET):\s*\S+/.test(input.compose), 'sensitive environment variable must use a _FILE boundary')
  fail(/infra\/onprem\/core\/secret-files\//.test(input.gitignore), 'secret-files directory must be ignored')
  fail(!/(?:password|secret|token|private[_-]?key)\s*=\s*[^\s#]{12,}/i.test(input.envTemplate), 'env.template must contain non-secret values only')

  for (const service of LONG_LIVED) {
    const block = blocks.get(service) ?? ''
    for (const marker of ['restart: unless-stopped', 'healthcheck:', 'cpus:', 'mem_limit:', 'pids_limit:', 'stop_grace_period:', 'logging:']) {
      fail(block.includes(marker), `${service} must include ${marker}`)
    }
    fail(/driver: json-file|logging: \*bounded-logging/.test(block), `${service} must use bounded json-file logging`)
  }
  for (const service of ['migrator', 'synthetic-seed']) {
    fail(/restart: ["']no["']/.test(blocks.get(service) ?? ''), `${service} must be an explicit restart:no one-shot`)
  }
  for (const [service, [cpu, memory]] of Object.entries(EXPECTED_RESOURCES)) {
    const block = blocks.get(service) ?? ''
    fail(new RegExp(`cpus: ${cpu.replace('.', '\\.')}(?:\\s|$)`).test(block), `${service} CPU ceiling must remain ${cpu}`)
    fail(new RegExp(`mem_limit: ${memory}`, 'i').test(block), `${service} memory ceiling must remain ${memory}`)
  }

  for (const service of ['api', 'worker']) {
    const block = blocks.get(service) ?? ''
    fail(!/\b(?:migrator|synthetic-seed)\b/.test(block), 'runtime services must not auto-run or depend on migrations')
    fail(!/command:[^\n]*(?:migrat|seed)/i.test(block), 'API and worker commands must never run migrations or seeds')
    fail(/MIGRATIONS_HTTP_ENABLED: ["']false["']/.test(block), `${service} must disable HTTP migrations`)
  }
  fail(/profiles: \[migrate\]/.test(blocks.get('migrator') ?? ''), 'migrator must have an explicit migrate profile')
  fail(/profiles: \[seed\]/.test(blocks.get('synthetic-seed') ?? ''), 'synthetic seed must have an explicit seed profile')
  fail(/HR_AXIS_PROCESS_ROLE: migrator/.test(blocks.get('migrator') ?? ''), 'migrator must declare the DB-only strict-local process role')
  fail(/HR_AXIS_PROCESS_ROLE: synthetic-seed/.test(blocks.get('synthetic-seed') ?? ''), 'synthetic seed must declare the DB-only strict-local process role')
  fail(/dist\/src\/onprem\/migrate\.js/.test(blocks.get('migrator') ?? ''), 'migrator must use the compiled on-prem entry')
  fail(/dist\/src\/onprem\/seed-synthetic\.js/.test(blocks.get('synthetic-seed') ?? ''), 'seed must use the compiled unchanged-seed entry')
  fail(/DATABASE_URL_FILE: \/run\/secrets\/api_database_url/.test(blocks.get('synthetic-seed') ?? ''), 'synthetic seed must use the DML-only API database role')
  fail(/dist\/src\/onprem\/worker-health\.js/.test(blocks.get('worker') ?? ''), 'worker must expose its compiled health entry')
  fail(/fetch\('http:\/\/127\.0\.0\.1:3000\/api\/health'\)/.test(blocks.get('api') ?? ''), 'API container health must use dependency-aware readiness')

  fail(/postgres:16\.[0-9]+-alpine@sha256:[0-9a-f]{64}/i.test(input.compose), 'PostgreSQL 16 image must be pinned')
  fail(/redis:7\.[0-9.]+-alpine@sha256:[0-9a-f]{64}/i.test(input.compose), 'Redis 7 image must be pinned')
  fail(/DB_SSL_MODE: verify-full/.test(input.compose), 'backend database TLS must remain verify-full')
  fail(/ssl=on/.test(blocks.get('postgres') ?? '') && /ssl_ca_file=/.test(blocks.get('postgres') ?? ''), 'PostgreSQL server TLS must be mandatory')
  fail(/\/var\/lib\/postgresql\/tls:rw,noexec,nosuid,size=16m,uid=70,gid=70/.test(blocks.get('postgres') ?? ''), 'PostgreSQL TLS material must be copied into its bounded uid-70 tmpfs')
  fail(/appendonly yes/.test(input.redis) && /appendfsync everysec/.test(input.redis), 'Redis must use AOF everysec recovery')
  fail(/maxmemory 640mb/.test(input.redis) && /maxmemory-policy noeviction/.test(input.redis), 'Redis maxmemory must stay below 768 MiB with noeviction')
  fail(/aclfile \/run\/secrets\/redis_users_acl/.test(input.redis), 'Redis authentication must use a mounted ACL file')
  fail(/-flushall -flushdb -swapdb -migrate/.test(input.workflow) && /~hr-axis:rate-limit:\*/.test(input.workflow) && /~bull:hr-axis-onprem-synthetic-recovery-v1:\*/.test(input.workflow), 'runtime Redis ACLs must scope keys and deny destructive non-admin commands')
  fail(/cap_drop: \[ALL\]/.test(blocks.get('redis') ?? '') && /cap_add: \[CHOWN, DAC_OVERRIDE, FOWNER, SETGID, SETUID\]/.test(blocks.get('redis') ?? ''), 'Redis fresh-volume entrypoint must retain only the identity and ownership setup capabilities it needs')
  fail(/^  postgres_data:/m.test(input.compose) && /^  redis_data:/m.test(input.compose), 'PostgreSQL and Redis require named volumes')

  for (const role of ['hr_axis_migrator', 'hr_axis_api', 'hr_axis_worker']) {
    fail(new RegExp(`CREATE ROLE ${role}[^;]*NOINHERIT NOCREATEDB NOCREATEROLE`, 'i').test(input.bootstrap), `${role} must be NOINHERIT/NOCREATEDB/NOCREATEROLE`)
  }
  fail(/ALTER DATABASE .* OWNER TO hr_axis_migrator/.test(input.bootstrap), 'migrator must own the application database')
  fail(/--set=database_name="\$POSTGRES_DB"/.test(input.bootstrap) && /ALTER DATABASE :"database_name"/.test(input.bootstrap), 'bootstrap must pass the target database as an explicit psql identifier variable')
  fail(/REVOKE ALL ON DATABASE/.test(input.bootstrap) && /REVOKE CREATE ON SCHEMA public FROM PUBLIC/.test(input.bootstrap), 'runtime roles must not retain database or schema CREATE')
  fail(/ALTER DEFAULT PRIVILEGES FOR ROLE hr_axis_migrator GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES/.test(input.bootstrap), 'runtime roles require only DML table defaults')
  fail(/ALTER DEFAULT PRIVILEGES FOR ROLE hr_axis_migrator GRANT USAGE ON SCHEMAS/.test(input.bootstrap), 'runtime roles require USAGE but not CREATE on future schemas')
  fail(/GRANT SELECT, USAGE ON SEQUENCES/.test(input.bootstrap) && !/GRANT SELECT, USAGE, UPDATE ON SEQUENCES/.test(input.bootstrap), 'runtime sequence mutation capability must remain denied')
  fail(/GRANT EXECUTE ON FUNCTIONS/.test(input.bootstrap), 'runtime roles require bounded function access')

  fail(/identity_not_installed/.test(input.caddy) && /503/.test(input.caddy), '/auth must fail 503 identity_not_installed until ONP-3')
  fail(/ocsp_stapling off/.test(input.caddy), 'strict-local Caddy must disable external OCSP stapling fetches')
  fail(/AUTH_PROVIDER_KEY: oidc/.test(blocks.get('api') ?? ''), 'strict-local auth provider key must remain oidc until ONP-3')
  fail(!/^\s+(?:SENTRY_DSN|QWEN_API_KEY|BROWSER_SESSION_SECRET(?:_FILE)?|PHOTO_MEDIA_[A-Z0-9_]*(?:SECRET|KEY|TOKEN)):/m.test(input.compose), 'disabled providers must omit their credential keys entirely')
  fail(!/keycloak/i.test(input.compose), 'ONP-2 must not install a Keycloak stub')
  fail(/COPY db\/schema\.sql \/app\/db\/schema\.sql/.test(input.backendDockerfile), 'backend image must copy the canonical schema')
  fail(/COPY db\/migrations\/ \/app\/db\/migrations\//.test(input.backendDockerfile), 'backend image must copy canonical migrations')
  fail(/COPY db\/seeds\/001_reference_seed\.sql \/app\/db\/seeds\/001_reference_seed\.sql/.test(input.backendDockerfile), 'backend image must copy the unchanged deterministic seed')
  fail(/VITE_SENTRY_ENABLED=false/.test(input.frontendDockerfile), 'frontend on-prem image must force Sentry off')
  fail(/onprem-core-runtime-proof\.mjs/.test(input.workflow), 'the existing on-prem image proof workflow must own core runtime proof')
  fail(/proof:\s*\n\s+runs-on: ubuntu-latest/m.test(input.workflow), 'core runtime proof must run inside the required GitHub-hosted Linux proof job')
  fail(!/proof:\s*\n\s+if:/m.test(input.workflow), 'the required proof job must not be optional or conditionally skipped')
  fail(!/core-runtime-proof:/m.test(input.workflow), 'runtime proof must reuse the exact scanned images in one proof job')
  fail(!/:core-proof/.test(input.workflow), 'runtime proof must not rebuild or exercise an unscanned image identity')
  fail(/docker image inspect hr-axis-onprem-backend:proof/.test(input.workflow) && /docker image inspect hr-axis-onprem-frontend:proof/.test(input.workflow), 'runtime proof must bind Compose to the scanned proof image IDs')
  fail(/iptables-save/.test(input.workflow) && /iptables-restore/.test(input.workflow) && /trap cleanup EXIT/.test(input.workflow), 'CI firewall mutation must be ephemeral and restored by a cleanup trap')
  fail(/--require-fresh-volumes/.test(input.workflow), 'required CI runtime proof must start from fresh project volumes')
  fail(!/^\s*pull_request:/m.test(input.workflow), 'ONP-2 must not create a competing required workflow')
  fail(/42501/.test(input.runtimeProof) && /synthetic-queue-probe\.js/.test(input.runtimeProof) && /conntrack/.test(input.runtimeProof), 'runtime harness must prove DDL denial, compiled terminal Redis recovery, and zero external flows')
  fail(/assertRedisDestructiveCommandsDenied\('api'/.test(input.runtimeProof) && /assertRedisDestructiveCommandsDenied\('worker'/.test(input.runtimeProof), 'runtime harness must prove destructive Redis commands are denied for both runtime roles')
  fail(/onprem_sequence_privilege_probe/.test(input.runtimeProof) && /setval/.test(input.runtimeProof) && /apiIdentityVerified/.test(input.runtimeProof) && /workerIdentityVerified/.test(input.runtimeProof), 'runtime harness must prove exact runtime DB identities and sequence mutation denial')
  fail(/parseSequencePrivilegeMatrix\(query\("SELECT has_sequence_privilege/.test(input.runtimeProof) && /, has_sequence_privilege/.test(input.runtimeProof) && !/has_sequence_privilege\([^\n]*\)\s*\|\|/.test(input.runtimeProof), 'runtime sequence privilege probe must select six separate boolean columns without concatenation')
  fail(/orphanRejected/.test(input.runtimeProof) && /checksumMismatchRejected/.test(input.runtimeProof), 'runtime harness must reject orphaned and checksum-mutated migration state')
  fail(/CASE WHEN bool_and\(status = 'succeeded'\) THEN 't' ELSE 'f' END/.test(input.runtimeProof) && /parseMigrationIdentity\(secondMigration\)/.test(input.runtimeProof), 'runtime harness must use canonical t/f migration identity serialization and strict parsing')
  fail(/assertPersistenceIdentity\('PostgreSQL restart'\)/.test(input.runtimeProof) && /assertPersistenceIdentity\('full project restart'\)/.test(input.runtimeProof), 'runtime harness must preserve the complete seed aggregate and migration ledger across both restart phases')
  fail(/waitUnhealthy\('api'\)/.test(input.runtimeProof) && /waitUnhealthy\('worker'\)/.test(input.runtimeProof) && /\['stop', 'redis'\]/.test(input.runtimeProof), 'runtime harness must observe API and worker unhealthy during a real Redis stop')
  fail(!/\['stop', '--timeout'/.test(input.runtimeProof), 'runtime proof must preserve each service-specific Compose stop grace')
  fail(/collectFirewallEvidence\(\{ counters: true \}\)/.test(input.runtimeProof) && /egressRejectPacketDelta/.test(input.runtimeProof), 'runtime harness must prove zero rejected egress with complete per-table packet counters')
  const rollbackArgs = input.rollbackDown.match(/const args = \[([\s\S]*?)\]\n/)?.[1] ?? ''
  fail(!/(?:'--volumes'|'\-v')/.test(rollbackArgs), 'ordinary rollback down must not remove volumes')
  fail(/--confirm-delete-synthetic-volumes/.test(input.volumeDelete) && /com\.hr-axis\.release-id/.test(input.volumeDelete) && /com\.hr-axis\.data-class/.test(input.volumeDelete), 'volume deletion must require synthetic exact-identity confirmation')

  return { errors: [...new Set(errors)], ok: errors.length === 0, services }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const read = (path) => readFileSync(path, 'utf8')
  const result = validateOnpremCoreContract({
    backendDockerfile: read('infra/onprem/images/backend.Dockerfile'),
    bootstrap: read('infra/onprem/core/postgres/010-bootstrap-roles.sh'),
    caddy: read('infra/onprem/core/caddy/Caddyfile'),
    compose: read('infra/onprem/core/compose.yaml'),
    envTemplate: read('infra/onprem/core/env.template'),
    frontendDockerfile: read('infra/onprem/images/frontend.Dockerfile'),
    gitignore: read('.gitignore'),
    redis: read('infra/onprem/core/redis/redis.conf'),
    rollbackDown: read('scripts/onprem-core-down.mjs'),
    runtimeProof: read('scripts/onprem-core-runtime-proof.mjs'),
    volumeDelete: read('scripts/onprem-core-delete-synthetic-volumes.mjs'),
    workflow: read('.github/workflows/onprem-image-proof.yml'),
  })
  console.log(JSON.stringify(result, null, 2))
  if (!result.ok) process.exitCode = 1
}
