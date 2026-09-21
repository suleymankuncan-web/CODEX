import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const KEYCLOAK_IMAGE = 'quay.io/keycloak/keycloak:26.7.3@sha256:ff4257d0d64efbe99ed1ddfaf07765cc3c36dc7518bf8324d41961327f441c54'
export const KEYCLOAK_REALM = 'store-ops'
export const KEYCLOAK_PUBLIC_PATHS = [
  '/realms/store-ops',
  '/realms/store-ops/.well-known/openid-configuration',
  '/realms/store-ops/protocol/openid-connect/auth',
  '/realms/store-ops/protocol/openid-connect/token',
  '/realms/store-ops/protocol/openid-connect/logout',
  '/realms/store-ops/protocol/openid-connect/logout/*',
  '/realms/store-ops/protocol/openid-connect/certs',
  '/realms/store-ops/login-actions/*',
  '/resources/*',
]

export function isStrictHttpsOrigin(value) {
  if (typeof value !== 'string' || !/^https:\/\/[A-Za-z0-9.-]+$/.test(value)) return false
  const host = value.slice('https://'.length)
  if (host.length === 0 || host.length > 253 || /^\.|\.$|\.\./.test(host)) return false
  return host.split('.').every((label) => label.length > 0 && label.length <= 63 && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label))
}

// SMTP sender addresses intentionally use a narrow ASCII dot-atom local part
// (letters, digits, dot, plus, and hyphen; alphanumeric edges)
// and DNS-style domain labels.  Display names, quoted local parts, comments,
// internationalized addresses, and single-label domains are not accepted.
const SMTP_LOCAL_PART = /^[A-Za-z0-9](?:[A-Za-z0-9.+-]*[A-Za-z0-9])?$/
const SMTP_DOMAIN_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/

export function isValidSmtpSender(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 254) return false
  const atIndex = value.indexOf('@')
  if (atIndex <= 0 || atIndex !== value.lastIndexOf('@') || atIndex === value.length - 1) return false

  const localPart = value.slice(0, atIndex)
  const domain = value.slice(atIndex + 1)
  if (localPart.length > 64 || !SMTP_LOCAL_PART.test(localPart) || localPart.includes('..')) return false
  if (domain.length === 0 || domain.length > 253) return false

  const labels = domain.split('.')
  return labels.length >= 2 && labels.every((label) => SMTP_DOMAIN_LABEL.test(label))
}

export function selectCsvFirstFieldsByExactSecond(rows, target) {
  if (typeof rows !== 'string' || typeof target !== 'string') return []
  return rows.split(/\r?\n/).filter(Boolean).flatMap((row) => {
    const fields = row.split(',')
    return fields.length === 2 && fields[0] && fields[1] === target ? [fields[0]] : []
  })
}

export function selectCsvFirstFields(rows) {
  if (typeof rows !== 'string') return []
  return rows.split(/\r?\n/).filter(Boolean).flatMap((row) => {
    const fields = row.split(',')
    return fields.length === 1 && fields[0] ? [fields[0]] : []
  })
}

export function countCsvItems(value) {
  if (typeof value !== 'string' || value.length === 0) return 0
  const fields = value.split(',')
  return fields.every((field) => /^[A-Za-z0-9._:-]+$/.test(field)) ? fields.length : null
}

const STEADY_RESOURCES = {
  caddy: ['0.25', '128m'],
  frontend: ['0.25', '128m'],
  api: ['0.75', '1536m'],
  worker: ['0.75', '1536m'],
  postgres: ['1.0', '2048m'],
  keycloak: ['0.5', '2048m'],
  redis: ['0.5', '768m'],
}

function serviceBlocks(compose) {
  const lines = String(compose).split(/\r?\n/)
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

function envValue(text, name) {
  return String(text).match(new RegExp(`^${name}=(.+)$`, 'm'))?.[1]?.trim() ?? ''
}

function rawEnvValue(text, name) {
  return String(text).match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1] ?? ''
}

function hasImmutableImage(value) {
  return value === KEYCLOAK_IMAGE
}

function has(text, pattern) {
  return pattern.test(String(text))
}

function parseMemory(value) {
  const match = String(value).match(/mem_limit:\s*([0-9]+)([mg])/i)
  if (!match) return 0
  const amount = Number(match[1])
  return match[2].toLowerCase() === 'g' ? amount * 1024 : amount
}

export function validateOnpremKeycloakContract(input) {
  const errors = []
  const fail = (condition, message) => {
    if (!condition) errors.push(message)
  }
  const blocks = serviceBlocks(input.compose)
  const photoProofCompose = String(input.photoProofCompose ?? '')
  const keycloak = blocks.get('keycloak') ?? ''
  const bootstrap = blocks.get('keycloak-bootstrap') ?? ''
  const binder = blocks.get('identity-binder') ?? ''
  const serviceNames = [...blocks.keys()]
  let realmFixture = null
  try { realmFixture = JSON.parse(String(input.realmConfig)) } catch { /* raw guards below still report fixture problems */ }

  fail(serviceNames.includes('keycloak'), 'compose must define the production Keycloak service')
  fail(serviceNames.includes('keycloak-bootstrap'), 'compose must define the one-shot Keycloak bootstrap service')
  fail(serviceNames.includes('identity-binder'), 'compose must define the one-shot identity binder service')
  fail(hasImmutableImage(envValue(input.envTemplate, 'KEYCLOAK_BASE_IMAGE')), 'env.template must pin the exact upstream Keycloak 26.7.3 base digest')
  fail(/image:\s*\$\{KEYCLOAK_IMAGE:\?set an immutable built Keycloak image reference\}/.test(keycloak), 'Keycloak service must use the immutable built image supplied by the release env')
  fail(/ARG KEYCLOAK_BASE_IMAGE=.*ff4257d0d64efbe99ed1ddfaf07765cc3c36dc7518bf8324d41961327f441c54/.test(input.keycloakDockerfile) && /kc\.sh build --db=postgres --health-enabled=true --metrics-enabled=true/.test(input.keycloakDockerfile) && /var\/lib\/keycloak-bootstrap/.test(input.keycloakDockerfile) && /chown 1000:1000/.test(input.keycloakDockerfile), 'Keycloak image must be built and optimized from the pinned upstream base with a writable private state mountpoint')
  fail(
    /COPY scripts\/onprem-keycloak-bouncycastle-patch\.mjs \/patch\/download-bouncycastle\.mjs/.test(input.keycloakDockerfile)
      && /node \/patch\/download-bouncycastle\.mjs/.test(input.keycloakDockerfile)
      && /\/patch\/bouncycastle\/bcprov-jdk18on\.jar \/opt\/keycloak\/lib\/lib\/main\/org\.bouncycastle\.bcprov-jdk18on-1\.84\.jar/.test(input.keycloakDockerfile)
      && /\/patch\/bouncycastle\/bcprov-jdk18on\.jar \/opt\/keycloak\/bin\/client\/lib\/bcprov-jdk18on-1\.84\.jar/.test(input.keycloakDockerfile)
      && /\/patch\/bouncycastle\/bcpkix-jdk18on\.jar \/opt\/keycloak\/lib\/lib\/main\/org\.bouncycastle\.bcpkix-jdk18on-1\.84\.jar/.test(input.keycloakDockerfile)
      && /\/patch\/bouncycastle\/bcutil-jdk18on\.jar \/opt\/keycloak\/lib\/lib\/main\/org\.bouncycastle\.bcutil-jdk18on-1\.84\.jar/.test(input.keycloakDockerfile),
    'Keycloak image must replace the complete vulnerable Bouncy Castle 1.84 provider family with checksum-pinned 1.85 artifacts',
  )
  fail(!/start-dev/i.test(input.compose) && !/start-dev/i.test(input.bootstrap), 'production Compose and bootstrap must never use start-dev')
  fail(!/KEYCLOAK_ADMIN(?:_PASSWORD)?\s*:/i.test(input.compose) && !/admin\s*[:=]\s*admin/i.test(input.compose), 'default Keycloak admin credentials must be absent')
  fail(/start\s+--optimized/.test(keycloak), 'Keycloak must use optimized production startup')
  const keycloakInitDeclarations = keycloak.match(/^    init:\s*\S+\s*$/gm) ?? []
  const keycloakEntrypointDeclarations = keycloak.match(/^    entrypoint:\s*.*$/gm) ?? []
  fail(
    keycloakInitDeclarations.length === 1
      && /^    init:\s*false\s*$/.test(keycloakInitDeclarations[0])
      && keycloakEntrypointDeclarations.length === 1
      && /^    entrypoint:\s*\["\/bin\/sh", "-ec"\]\s*$/.test(keycloakEntrypointDeclarations[0])
      && /^        exec \/opt\/keycloak\/bin\/kc\.sh start --optimized(?:\s|$)/m.test(keycloak),
    'Keycloak must remain the direct PID 1 through the final exec for reliable graceful shutdown',
  )
  fail(/health-enabled=true/.test(keycloak) && /metrics-enabled=true/.test(keycloak), 'Keycloak health and metrics must be enabled')
  fail(/9000/.test(keycloak) && /health\/ready/.test(keycloak) && /\/bin\/bash/.test(keycloak) && /dev\/tcp/.test(keycloak), 'Keycloak management health endpoint must use port 9000 without curl/network tooling')
  fail(/^    expose:\r?\n\s+- "8080"\r?\n\s+- "9000"/m.test(keycloak), 'Keycloak must expose only private application and management ports')
  fail(!/^    ports:/m.test(keycloak), 'Keycloak must not publish a host port')
  fail(/networks: \[proxy, data\]/.test(keycloak), 'Keycloak must bridge only private proxy and data networks')
  fail(/read_only: true/.test(keycloak) && /cap_drop: \[ALL\]/.test(keycloak) && /no-new-privileges:true/.test(keycloak), 'Keycloak must run with read-only least privilege restrictions')
  fail(/restart: unless-stopped/.test(keycloak) && /logging: \*bounded-logging/.test(keycloak), 'Keycloak must retain restart and bounded log policy')
  fail(/restart: ["']no["']/.test(bootstrap) && /profiles: \[[^\]]*keycloak-bootstrap/.test(bootstrap), 'Keycloak bootstrap must be an explicit one-shot profile')
  fail(/bootstrap\.sh/.test(bootstrap), 'Keycloak bootstrap service must execute the sanitized bootstrap script')
  fail(/entrypoint: \["\/bin\/sh"\]/.test(bootstrap) && /command: \["\/opt\/keycloak\/bootstrap\.sh"\]/.test(bootstrap), 'Keycloak bootstrap must override the optimized image entrypoint to execute its script')
  fail(/HR_AXIS_PROCESS_ROLE: identity-binder/.test(binder) && /bind-keycloak-identities\.js/.test(binder), 'identity binder must use the strict-local compiled process role')
  fail(/KEYCLOAK_SYNTHETIC_SUBJECT_MANIFEST_FILE: \/var\/lib\/keycloak-bootstrap\/subjects\.v1\.json/.test(binder), 'identity binder must consume the private subject manifest')
  fail(/KEYCLOAK_SYNTHETIC_ACCOUNTS_ENABLED: \$\{KEYCLOAK_SYNTHETIC_ACCOUNTS_ENABLED:-false\}/.test(binder), 'identity binder must receive the exact synthetic accounts flag interpolation')
  fail(/KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED: \$\{KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED:-false\}/.test(binder), 'identity binder must default the dedicated photo-proof gate to false')
  fail(/keycloak_bootstrap_state:\/var\/lib\/keycloak-bootstrap:ro/.test(binder), 'identity binder must mount subject state read-only')
  fail(/keycloak-bootstrap:\s*\n\s+condition: service_completed_successfully/.test(binder), 'identity binder must wait for a successful Keycloak bootstrap')
  fail(/user: ["']1000:1000["']/.test(binder) && /binder_database_url/.test(binder), 'identity binder must run as the subject-state owner and use its dedicated DB URL secret')
  fail(/keycloak_bootstrap_state/.test(input.compose), 'Keycloak bootstrap must persist only its synthetic state manifest volume')
  fail(/state_dir=.*keycloak-bootstrap/.test(input.bootstrapScript) && /manifest_path=.*subjects\.v1\.json/.test(input.bootstrapScript), 'bootstrap must write the versioned subject manifest to the private state path')
  fail(/KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED: \$\{KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED:-false\}/.test(bootstrap), 'bootstrap must default the dedicated photo-proof gate to false')
  fail(!/KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ACCOUNT_FILE|KEYCLOAK_PHOTO_PROOF_SUBJECT_MANIFEST_FILE|keycloak_synthetic_photo_proof_account/.test(input.compose), 'base Compose must remain photo-proof credential-free')
  if (photoProofCompose) {
    fail(/KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED:\s*["']true["']/.test(photoProofCompose), 'photo-proof overlay must enable the dedicated photo-proof gate')
    fail(/KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ACCOUNT_FILE:\s*\/run\/secrets\/keycloak_synthetic_photo_proof_account/.test(photoProofCompose), 'photo-proof overlay must wire the exact photo-proof account input')
    fail(/KEYCLOAK_PHOTO_PROOF_SUBJECT_MANIFEST_FILE:\s*\/var\/lib\/keycloak-bootstrap\/photo-proof-subject\.v1\.json/.test(photoProofCompose), 'photo-proof overlay must wire the exact subject manifest output')
    fail(/keycloak_synthetic_photo_proof_account/.test(photoProofCompose) && /photo-proof-account/.test(photoProofCompose), 'photo-proof overlay must mount the separate photo-proof account secret')
  }

  for (const [service, [cpu, memory]] of Object.entries(STEADY_RESOURCES)) {
    const block = blocks.get(service) ?? ''
    fail(new RegExp(`cpus: ${cpu.replace('.', '\\.')}(?:\\s|$)`).test(block), `${service} CPU ceiling must remain ${cpu}`)
    fail(new RegExp(`mem_limit: ${memory}`, 'i').test(block), `${service} memory ceiling must remain ${memory}`)
  }
  const steadyCpu = Object.keys(STEADY_RESOURCES).reduce((sum, service) => sum + Number(String(blocks.get(service) ?? '').match(/cpus:\s*([0-9.]+)/)?.[1] ?? 0), 0)
  const steadyMemory = Object.keys(STEADY_RESOURCES).reduce((sum, service) => sum + parseMemory(blocks.get(service) ?? ''), 0)
  fail(Math.abs(steadyCpu - 4) < 0.001, `steady CPU ceilings must total exactly 4.0 vCPU (got ${steadyCpu})`)
  fail(steadyMemory <= 8192, `steady container memory ceilings must not exceed 8 GiB (got ${steadyMemory} MiB)`)

  for (const name of ['keycloak_database_url', 'keycloak_database_username', 'keycloak_database_password', 'postgres_keycloak_database_password', 'keycloak_bootstrap_username', 'keycloak_bootstrap_password', 'keycloak_smtp_password']) {
    fail(new RegExp(`^  ${name}:`, 'm').test(input.compose), `Compose must mount the ${name} Docker secret`)
  }
  fail(/keycloak:\s*[\s\S]*?source: keycloak_database_password\s*\n\s+target: keycloak_database_password/.test(input.compose), 'Keycloak must consume its uid-1000 database password copy')
  fail(/keycloak-bootstrap:\s*[\s\S]*?source: keycloak_database_password\s*\n\s+target: keycloak_database_password/.test(input.compose), 'Keycloak bootstrap must consume its uid-1000 database password copy')
  fail(/postgres:\s*[\s\S]*?source: postgres_keycloak_database_password\s*\n\s+target: keycloak_database_password/.test(input.compose), 'PostgreSQL must consume its uid-70 database password copy')
  fail(/source: postgres_keycloak_database_password/.test(input.compose) && (input.compose.match(/source: keycloak_database_password/g) ?? []).length >= 2, 'Keycloak database password copies must be explicitly separated by runtime owner')
  fail(/(?:printf '%s' "\$keycloak_database_password" > "\$secret_root\/postgres\/keycloak-password"|cat > "\$secret_root\/postgres\/keycloak-password" <<EOF[\s\S]*?\$keycloak_database_password)/.test(input.workflow)
    && /(?:printf '%s' "\$keycloak_database_password" > "\$secret_root\/keycloak\/database-password"|cat > "\$secret_root\/keycloak\/database-password" <<EOF[\s\S]*?\$keycloak_database_password)/.test(input.workflow)
    && /sha256sum.*postgres\/keycloak-password/.test(input.workflow)
    && /sha256sum.*keycloak\/database-password/.test(input.workflow), 'workflow must copy and digest-compare the owner-specific Keycloak database password files before startup')
  fail(/KEYCLOAK_DATABASE_URL_FILE: \/run\/secrets\/keycloak_database_url/.test(keycloak), 'Keycloak database URL must be read from a secret file')
  fail(/jdbc:postgresql:\/\/postgres:5432\/keycloak\?sslmode=verify-full&sslrootcert=\/run\/secrets\/postgres_tls_ca/.test(input.workflow), 'Keycloak runtime proof must use a JDBC URL with verify-full and the mounted PostgreSQL CA')
  fail(/KEYCLOAK_DATABASE_USERNAME_FILE: \/run\/secrets\/keycloak_database_username/.test(keycloak), 'Keycloak database username must be read from a secret file')
  fail(/KEYCLOAK_DATABASE_PASSWORD_FILE: \/run\/secrets\/keycloak_database_password/.test(keycloak), 'Keycloak database password must be read from a secret file')
  fail(/CREATE ROLE\s+keycloak\b/i.test(input.bootstrapSql) && /CREATE DATABASE\s+keycloak\b/i.test(input.bootstrapSql), 'PostgreSQL bootstrap must create a dedicated Keycloak role and database')
  fail(/keycloak_database_password/.test(input.bootstrapSql), 'PostgreSQL Keycloak role password must come from a secret file')
  fail(/postgres_data:/.test(input.compose) && /keycloak_data:/.test(input.compose), 'PostgreSQL and Keycloak require persistent named volumes')

  fail(/validate_public_origin/.test(input.bootstrapScript), 'bootstrap must call strict KEYCLOAK_PUBLIC_ORIGIN validation')
  for (const origin of [
    'https://hr-axis.example.invalid',
    'http://hr-axis.example.invalid',
    'https://user:pass@hr-axis.example.invalid',
    'https://hr-axis.example.invalid:443',
    'https://hr-axis.example.invalid/path',
    'https://.hr-axis.example.invalid',
    'https://hr-axis.example.invalid.',
    'https://hr..axis.example.invalid',
    'https://hr_axis.example.invalid',
  ]) fail(origin === 'https://hr-axis.example.invalid' ? isStrictHttpsOrigin(origin) : !isStrictHttpsOrigin(origin), `strict public origin validation mismatch for ${origin}`)

  if (input.personaSeed) {
    const personaSeed = String(input.personaSeed)
    const personas = [
      ['onprem.store-manager', 'STORE_MANAGER'],
      ['onprem.region-manager', 'REGION_MANAGER'],
      ['onprem.report-viewer', 'REPORT_VIEWER'],
      ['onprem.store-personnel', 'STORE_PERSONNEL'],
      ['onprem.visual-merchandiser', 'VISUAL_MERCHANDISER'],
    ]
    const photoProofAccount = 'onprem.photo-proof-admin'
    const accountValues = personaSeed.match(/INSERT INTO ops\.user_account[\s\S]*?VALUES([\s\S]*?)ON CONFLICT/i)?.[1] ?? ''
    const collisionPreflight = personaSeed.match(/DO \$\$[\s\S]*?\$\$;/)?.[0] ?? ''
    fail(collisionPreflight.length > 0
      && /username = 'onprem\.photo-proof-admin'[\s\S]*?user_id <> '80000000-0000-0000-0000-000000000016'::uuid/.test(collisionPreflight)
      && /user_id = '80000000-0000-0000-0000-000000000016'::uuid[\s\S]*?username <> 'onprem\.photo-proof-admin'/.test(collisionPreflight)
      && /user_role_assignment_id = '90000000-0000-0000-0000-000000000016'::uuid[\s\S]*?user_id <> '80000000-0000-0000-0000-000000000016'::uuid/.test(collisionPreflight)
      && /user_action_store_assignment_id = '91000000-0000-0000-0000-000000000015'::uuid[\s\S]*?user_id <> '80000000-0000-0000-0000-000000000016'::uuid/.test(collisionPreflight)
      && (collisionPreflight.match(/RAISE EXCEPTION/g) ?? []).length >= 4,
    'persona seed must preflight all fixed photo-proof identity collisions before mutation')
    const accountRows = [...accountValues.matchAll(/\(\s*'[^']+'\s*,\s*NULL\s*,\s*'(onprem\.[a-z-]+)'\s*,\s*'[^']+@onprem\.invalid'\s*,\s*NULL\s*,\s*'local'\s*,\s*NULL\s*,\s*(TRUE|FALSE)\s*\)/g)].map((match) => match[1])
    for (const [username, role] of personas) {
      fail(accountRows.includes(username) && personaSeed.includes(`'${role}'`), `persona seed must contain the exact ${role} synthetic account`)
    }
    fail(accountRows.length === 6 && new Set(accountRows).size === 6 && accountRows.includes(photoProofAccount), 'persona seed must contain exactly five approved personas plus the separate photo-proof account')
    fail(/'onprem\.photo-proof-admin'[^\n]*NULL\s*,\s*FALSE\s*\)/.test(accountValues), 'photo-proof account must be dormant with a NULL provider subject in the seed')
    fail((accountValues.match(/'onprem\.(?:store-manager|region-manager|report-viewer|store-personnel|visual-merchandiser)'[^\n]*NULL\s*,\s*TRUE\s*\)/g) ?? []).length === 5, 'the exact five approved personas must remain active in the seed')
    fail((accountValues.match(/NULL\s*,\s*'local'\s*,\s*NULL/g) ?? []).length === 6, 'persona seed must use local provider rows with NULL subjects before binding')
    fail(accountRows.length === 6 && (accountValues.match(/@onprem\.invalid/g) ?? []).length === 6, 'persona seed must never contain password hashes or real e-mail domains')
    fail(/'onprem\.photo-proof-admin',\s*'SUPER_ADMIN',\s*'company',\s*'00000000-0000-0000-0000-000000000001'::uuid,\s*NULL::uuid,\s*NULL::uuid/.test(personaSeed), 'photo-proof account must have the exact company-scoped SUPER_ADMIN assignment')
    fail(/onprem\.photo-proof-admin/.test(personaSeed) && /90000000-0000-0000-0000-000000000016/.test(personaSeed), 'photo-proof account role assignment must use its dedicated deterministic identity')
    fail(!/clerk/i.test(personaSeed), 'persona seed must not contain Clerk references')
    fail(/ON CONFLICT \(username\) DO UPDATE/.test(personaSeed), 'persona seed must reconcile account rows idempotently')
    fail(/ON CONFLICT \(user_role_assignment_id\) DO UPDATE/.test(personaSeed) && /ON CONFLICT \(user_action_store_assignment_id\) DO UPDATE/.test(personaSeed), 'persona seed must reconcile role and action assignments idempotently')
    fail(/'STORE_MANAGER'\s*,\s*'store'/.test(personaSeed) && /'REGION_MANAGER'\s*,\s*'region'/.test(personaSeed) && /'REPORT_VIEWER'\s*,\s*'company'/.test(personaSeed), 'persona seed must retain deterministic role scope assignments')
    const completeScopeAncestry = [
      "'onprem.store-manager', 'STORE_MANAGER', 'store', '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000100'::uuid",
      "'onprem.region-manager', 'REGION_MANAGER', 'region', '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, NULL::uuid",
      "'onprem.report-viewer', 'REPORT_VIEWER', 'company', '00000000-0000-0000-0000-000000000001'::uuid, NULL::uuid, NULL::uuid",
      "'onprem.store-personnel', 'STORE_PERSONNEL', 'store', '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000100'::uuid",
      "'onprem.visual-merchandiser', 'VISUAL_MERCHANDISER', 'store', '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000100'::uuid",
    ]
    fail(completeScopeAncestry.every((row) => personaSeed.includes(row)), 'persona seed authorization hierarchy must retain complete scope ancestry')
  }
  if (input.backendDockerfile) {
    fail(/COPY db\/seeds\/002_onprem_keycloak_personas\.sql \/app\/db\/seeds\/002_onprem_keycloak_personas\.sql/.test(input.backendDockerfile), 'backend image must copy the synthetic Keycloak persona seed')
  }

  const smtpFrom = rawEnvValue(input.envTemplate, 'KEYCLOAK_SMTP_FROM')
  fail(isValidSmtpSender(smtpFrom), 'env.template must contain a valid SMTP sender address')

  fail(!/"users"\s*:/.test(input.realmConfig), 'sanitized realm configuration must not contain a users import')
  fail(realmFixture?.['x-hr-axis-authoritative'] === false && realmFixture?.['x-hr-axis-fixture-authority'] === 'non-authoritative-bootstrap-parity', 'realm fixture must explicitly remain non-authoritative')
  if (realmFixture) {
    const expectedClient = realmFixture.clients?.find((client) => client.clientId === 'store-ops-admin-web')
    fail(realmFixture.realm === KEYCLOAK_REALM && realmFixture.enabled === true && realmFixture.sslRequired === 'external' && realmFixture.registrationAllowed === false && realmFixture.loginWithEmailAllowed === true && realmFixture.resetPasswordAllowed === true && realmFixture.verifyEmail === true, 'realm fixture settings must match the bootstrap contract')
    fail(Boolean(expectedClient) && expectedClient.publicClient === true && expectedClient.standardFlowEnabled === true && expectedClient.implicitFlowEnabled === false && expectedClient.directAccessGrantsEnabled === false && expectedClient.serviceAccountsEnabled === false, 'realm browser client fixture must match the bootstrap contract')
    const expectedDefaultScopes = ['web-origins', 'profile', 'roles', 'email', 'basic']
    const fixtureDefaultScopes = expectedClient?.defaultClientScopes
    fail(Array.isArray(fixtureDefaultScopes) && fixtureDefaultScopes.length === expectedDefaultScopes.length && new Set(fixtureDefaultScopes).size === expectedDefaultScopes.length && expectedDefaultScopes.every((scope) => fixtureDefaultScopes.includes(scope)), 'realm browser client must retain exactly the five approved default scopes including canonical basic subject claims')
    const fixtureOrigin = expectedClient?.redirectUris?.[0]?.replace(/\/auth\/callback$/, '')
    fail(Boolean(expectedClient) && isStrictHttpsOrigin(fixtureOrigin), 'realm browser client redirect must use a strict HTTPS origin')
    fail(Boolean(expectedClient) && expectedClient.webOrigins?.length === 1 && expectedClient.webOrigins[0] === fixtureOrigin, 'realm browser client web origin must match its strict HTTPS origin')
    fail(Boolean(expectedClient) && expectedClient.attributes?.['pkce.code.challenge.method'] === 'S256' && expectedClient.attributes?.['post.logout.redirect.uris'] === `${fixtureOrigin}/auth/login`, 'realm browser client PKCE/logout fixture must match the bootstrap contract')

    // Keep the checked-in parity fixture semantically identical to the mapper
    // definitions reconciled by bootstrap.sh.  A mapper name alone is not a
    // sufficient contract: changing its type, claim source, token placement,
    // or multivalue setting silently changes the backend authorization input.
    const expectedMappers = {
      roles: {
        protocolMapper: 'oidc-usermodel-realm-role-mapper',
        config: {
          'claim.name': 'roles',
          multivalued: 'true',
          'access.token.claim': 'true',
          'id.token.claim': 'true',
          'userinfo.token.claim': 'true',
        },
      },
      'store-ops-api-audience': {
        protocolMapper: 'oidc-audience-mapper',
        config: {
          'included.client.audience': 'store-ops-api',
          'access.token.claim': 'true',
          'id.token.claim': 'false',
          'userinfo.token.claim': 'false',
        },
      },
      employee_id: { protocolMapper: 'oidc-usermodel-attribute-mapper', attribute: 'employee_id' },
      company_ids: { protocolMapper: 'oidc-usermodel-attribute-mapper', attribute: 'company_ids' },
      region_ids: { protocolMapper: 'oidc-usermodel-attribute-mapper', attribute: 'region_ids' },
      store_ids: { protocolMapper: 'oidc-usermodel-attribute-mapper', attribute: 'store_ids' },
      read_company_ids: { protocolMapper: 'oidc-usermodel-attribute-mapper', attribute: 'read_company_ids' },
      read_region_ids: { protocolMapper: 'oidc-usermodel-attribute-mapper', attribute: 'read_region_ids' },
      read_store_ids: { protocolMapper: 'oidc-usermodel-attribute-mapper', attribute: 'read_store_ids' },
      assigned_store_ids: { protocolMapper: 'oidc-usermodel-attribute-mapper', attribute: 'assigned_store_ids' },
    }
    const fixtureMappers = Array.isArray(expectedClient?.protocolMappers) ? expectedClient.protocolMappers : []
    const fixtureMapperNames = fixtureMappers.map((mapper) => mapper?.name).filter(Boolean)
    const expectedMapperNames = Object.keys(expectedMappers)
    fail(fixtureMapperNames.length === expectedMapperNames.length && new Set(fixtureMapperNames).size === expectedMapperNames.length && expectedMapperNames.every((name) => fixtureMapperNames.includes(name)), 'realm browser client must contain exactly the ten managed bootstrap mappers')
    for (const [name, expected] of Object.entries(expectedMappers)) {
      const mapper = fixtureMappers.find((candidate) => candidate?.name === name)
      fail(Boolean(mapper) && mapper.protocol === 'openid-connect' && mapper.consentRequired === false && mapper.protocolMapper === expected.protocolMapper, `realm mapper ${name} must match its bootstrap protocol and type`)
      if (!mapper) continue
      const config = mapper.config ?? {}
      if (expected.attribute) {
        fail(config.multivalued === 'true' && config['user.attribute'] === expected.attribute && config['claim.name'] === expected.attribute && config['jsonType.label'] === 'String' && config['access.token.claim'] === 'true' && config['id.token.claim'] === 'true' && config['userinfo.token.claim'] === 'true', `realm mapper ${name} must preserve the multi-valued attribute claim contract`)
      } else {
        for (const [key, value] of Object.entries(expected.config)) fail(config[key] === value, `realm mapper ${name} must preserve ${key}=${value}`)
      }
    }
  }
  fail(!/StoreOps123|admin\s*[:=]\s*admin|demo\.(?:user|manager|operator)/i.test(input.realmConfig), 'sanitized realm configuration must not contain demo credentials or users')
  for (const role of ['STORE_MANAGER', 'REGION_MANAGER', 'REPORT_VIEWER', 'STORE_PERSONNEL', 'VISUAL_MERCHANDISER']) {
    fail(new RegExp(role).test(input.bootstrapScript) || new RegExp(role).test(input.realmConfig), `bootstrap must define the synthetic ${role} role contract`)
  }
  for (const claim of ['roles', 'company_ids', 'region_ids', 'store_ids', 'read_company_ids', 'read_region_ids', 'read_store_ids', 'assigned_store_ids']) {
    fail(new RegExp(claim).test(input.bootstrapScript) || new RegExp(claim).test(input.realmConfig), `bootstrap must configure the ${claim} claim mapper`)
  }
  fail(/create_or_update_mapper roles '(?=[^']*"protocolMapper":"oidc-usermodel-realm-role-mapper")(?=[^']*"multivalued":"true")(?=[^']*"claim.name":"roles")(?=[^']*"userinfo.token.claim":"true")(?=[^']*"id.token.claim":"true")(?=[^']*"access.token.claim":"true")[^']*'/.test(input.bootstrapScript), 'bootstrap roles mapper must preserve the multi-valued realm-role claim contract')
  fail(/create_or_update_mapper store-ops-api-audience '(?=[^']*"protocolMapper":"oidc-audience-mapper")(?=[^']*"included.client.audience":"store-ops-api")(?=[^']*"id.token.claim":"false")(?=[^']*"access.token.claim":"true")(?=[^']*"userinfo.token.claim":"false")[^']*'/.test(input.bootstrapScript), 'bootstrap audience mapper must target store-ops-api only in access tokens')
  fail(/"defaultClientScopes":\["web-origins","profile","roles","email","basic"\]/.test(input.bootstrapScript)
    && /\[ "\$default_scope_count" -eq 5 \]/.test(input.bootstrapScript)
    && /for expected_scope in web-origins profile roles email basic; do/.test(input.bootstrapScript)
    && /resolve_client_scope_uuid\(\)[\s\S]*get client-scopes[\s\S]*csv_first_fields_matching_second "\$scope_name"[\s\S]*\[ "\$scope_count" -eq 1 \][\s\S]*\*\[!A-Fa-f0-9-\]\*\) die 'client scope id contains unsupported characters'/.test(input.bootstrapScript)
    && /attached_scope_rows="\$\(kcadm_query get "clients\/\$client_uuid\/default-client-scopes"[\s\S]*for expected_scope in web-origins profile roles email basic; do[\s\S]*scope_uuid="\$\(resolve_client_scope_uuid "\$expected_scope"\)"[\s\S]*kcadm_quiet update "clients\/\$client_uuid\/default-client-scopes\/\$scope_uuid" -r "\$realm" -n \|\| die 'browser client default scope attachment failed'/.test(input.bootstrapScript)
    && !/create_or_update_mapper sub |assert_mapper sub |"protocolMapper":"oidc-sub-mapper"/.test(input.bootstrapScript), 'bootstrap browser client must receive subject claims from exactly the five canonical default scopes with explicit fail-closed scope attachment and without a client-level sub mapper')
  fail(/for claim in employee_id company_ids region_ids store_ids read_company_ids read_region_ids read_store_ids assigned_store_ids; do/.test(input.bootstrapScript)
    && /\\"protocolMapper\\":\\"oidc-usermodel-attribute-mapper\\"/.test(input.bootstrapScript)
    && /\\"multivalued\\":\\"true\\"/.test(input.bootstrapScript)
    && /\\"user.attribute\\":\\"\$claim\\"/.test(input.bootstrapScript)
    && /\\"claim.name\\":\\"\$claim\\"/.test(input.bootstrapScript)
    && /\\"access.token.claim\\":\\"true\\"/.test(input.bootstrapScript)
    && /\\"id.token.claim\\":\\"true\\"/.test(input.bootstrapScript)
    && /\\"userinfo.token.claim\\":\\"true\\"/.test(input.bootstrapScript), 'bootstrap attribute mappers must preserve the multi-valued identity and authorization claim contract')
  fail(/store-ops-api-audience/.test(input.bootstrapScript) && /store-ops-api/.test(input.realmConfig), 'Keycloak access tokens must carry the store-ops-api audience accepted by the backend')
  fail(/resetPasswordAllowed=true/.test(input.bootstrapScript) && /verifyEmail=true/.test(input.bootstrapScript) && !/updatePasswordAllowed/.test(input.bootstrapScript), 'realm must enable reset and verify-email flows without the unsupported updatePasswordAllowed setting')
  fail(/smtpServer/.test(input.bootstrapScript) && /KEYCLOAK_SMTP_(?:HOST|PORT|FROM|STARTTLS)/.test(input.bootstrapScript), 'SMTP host, port, from, starttls and auth config must be wired by bootstrap')
  const smtpSenderSource = String(input.bootstrapScript).match(/read_smtp_sender\(\) \{[\s\S]*?\n\}/)?.[0] ?? ''
  fail(smtpSenderSource.length > 0, 'bootstrap must define a field-specific SMTP sender validator')
  fail(/smtp_from="\$\(read_smtp_sender "\$\{KEYCLOAK_SMTP_FROM:-\}"\)"/.test(input.bootstrapScript), 'bootstrap must parse KEYCLOAK_SMTP_FROM with its field-specific validator')
  fail(!/smtp_from="\$\(read_config /.test(input.bootstrapScript), 'bootstrap must not pass KEYCLOAK_SMTP_FROM through generic read_config')
  fail(smtpSenderSource.includes('[ "${#value}" -le 254 ]'), 'SMTP sender validator must retain the bounded sender length')
  fail(smtpSenderSource.includes('*[!A-Za-z0-9.+@-]*)'), 'SMTP sender validator must retain its narrow ASCII character allowlist')
  fail(smtpSenderSource.includes('    *@*) ;;') && smtpSenderSource.includes("    ''|*@*) die"), 'SMTP sender validator must reject missing or multiple @ characters')
  fail(smtpSenderSource.includes('local_part="${value%%@*}"') && smtpSenderSource.includes('domain="${value#*@}"'), 'SMTP sender validator must parse local and domain parts explicitly')
  fail(smtpSenderSource.includes('[ "${#local_part}" -le 64 ]') && smtpSenderSource.includes('*..*) die'), 'SMTP sender validator must bound and validate the local part')
  fail(smtpSenderSource.includes('[ "${#domain}" -le 253 ]') && smtpSenderSource.includes('*.*) ;;'), 'SMTP sender validator must require a bounded dotted domain')
  fail(smtpSenderSource.includes('-*|*-|*[!A-Za-z0-9-]*)'), 'SMTP sender validator must reject malformed domain labels')
  fail(/keycloak_smtp_password/.test(input.compose) && /KEYCLOAK_SMTP_AUTH_USER_FILE/.test(input.bootstrapScript), 'SMTP auth credentials must be secret-file inputs')
  fail(/set -eu/.test(input.bootstrapScript) && !/set -x/.test(input.bootstrapScript), 'bootstrap must be fail-closed and never enable shell tracing')
  fail(String(input.bootstrapScript).includes('*[!A-Za-z0-9._:/?\\&=%+-]*')
    && !String(input.bootstrapScript).includes('*[!A-Za-z0-9._:/?&=%+-]*'), 'database secret allowlist must escape ampersand for POSIX shell parsing')
  fail(/bootstrap-admin\s+service/.test(input.bootstrapScript), 'bootstrap must provision a temporary service principal with kc.sh bootstrap-admin')
  fail(/--client-secret:env=KEYCLOAK_BOOTSTRAP_SERVICE_SECRET/.test(input.bootstrapScript), 'bootstrap-admin must receive the service secret only through its environment')
  const kcadmTimeoutSource = input.bootstrapScript.match(/kcadm_timeout\(\) \{[\s\S]*?\n\}/)?.[0] ?? ''
  fail(/readonly KCADM_TIMEOUT_SECONDS=90/.test(input.bootstrapScript)
    && /timeout --signal=TERM --kill-after=5s "[^"]*KCADM_TIMEOUT_SECONDS}s" \/opt\/keycloak\/bin\/kcadm\.sh/.test(kcadmTimeoutSource), 'every kcadm request must use the fixed bounded timeout wrapper')
  const kcadmWrapperSource = input.bootstrapScript.match(/kcadm\(\) \{[\s\S]*?\n\}/)?.[0] ?? ''
  const kcadmWrapperHasSuffixConfig = /kcadm_timeout "\$@" --config "\$config_file"/.test(kcadmWrapperSource)
  const kcadmWrapperHasPrefixConfig = /\/opt\/keycloak\/bin\/kcadm\.sh\s+--config "\$config_file"/.test(kcadmWrapperSource)
  const kcadmWrapperConfigArguments = kcadmWrapperSource.match(/--config\s+"[^"]+"/g) ?? []
  fail(kcadmWrapperSource.length > 0 && kcadmWrapperHasSuffixConfig && !kcadmWrapperHasPrefixConfig && kcadmWrapperConfigArguments.length === 1, 'kcadm wrapper must append exactly one explicit config file after command arguments (Keycloak 26.7 rejects prefix --config ordering)')
  fail(!/\bKCADM_CONFIG\b/.test(input.bootstrapScript), 'bootstrap must not rely on the unsupported KCADM_CONFIG environment variable')
  const bootstrapAuthBlock = input.bootstrapScript.match(/credentials_ready=false[\s\S]*?credentials_ready=true/)?.[0] ?? ''
  fail(bootstrapAuthBlock.length > 0, 'bootstrap must retain its bounded authentication retry loop')
  fail(/if KC_CLI_CLIENT_SECRET="\$\(tr -d '\\r\\n' < "\$bootstrap_password_file"\)" kcadm_timeout config credentials/.test(bootstrapAuthBlock), 'kcadm service credential login must normalize the password through a command-local KC_CLI_CLIENT_SECRET')
  const kcadmDirectAuthHasSuffixConfig = /kcadm_timeout config credentials[\s\S]*--config "\$config_file"/.test(bootstrapAuthBlock)
  const kcadmDirectAuthHasPrefixConfig = /kcadm_timeout\s+--config "\$config_file"\s+config credentials/.test(bootstrapAuthBlock)
  const kcadmDirectAuthConfigArguments = bootstrapAuthBlock.match(/--config\s+"[^"]+"/g) ?? []
  fail(kcadmDirectAuthHasSuffixConfig && !kcadmDirectAuthHasPrefixConfig && kcadmDirectAuthConfigArguments.length === 1, 'kcadm service credential login must pass exactly one explicit config file after config credentials (Keycloak 26.7 rejects prefix --config ordering)')
  fail(!/cat\s+"\$bootstrap_password_file"\s*\|/.test(bootstrapAuthBlock), 'kcadm service credential login must not pipe its secret through stdin')
  fail(!/kcadm_timeout config credentials[\s\S]*--(?:secret|password|client-secret)(?:=|\s+)/.test(bootstrapAuthBlock), 'kcadm service credential login must not pass a secret in argv')
  fail(!/(?:^|\s)export\s+KC_CLI_CLIENT_SECRET=/.test(input.bootstrapScript), 'kcadm service credential login must not export its secret beyond the command')
  fail(!/\$bootstrap_password(?:["'\s]|$)/.test(bootstrapAuthBlock), 'kcadm service credential login must not interpolate the raw bootstrap secret')
  fail(/credentials_ready=false/.test(input.bootstrapScript)
    && /readonly BOOTSTRAP_AUTH_ATTEMPTS=8/.test(input.bootstrapScript)
    && /while \[ "\$attempt" -lt "\$BOOTSTRAP_AUTH_ATTEMPTS" \]; do/.test(input.bootstrapScript)
    && /kill -0 "\$server_pid"/.test(input.bootstrapScript)
    && /attempt=\$\(\(attempt \+ 1\)\)/.test(input.bootstrapScript)
    && /sleep 1/.test(input.bootstrapScript)
    && /\[ "\$credentials_ready" = true \] \|\| die 'temporary bootstrap principal authentication failed'/.test(input.bootstrapScript), 'bootstrap must retain the bounded authentication retry and server-liveness checks')
  fail(/phase_marker server-start/.test(input.bootstrapScript)
    && /\/opt\/keycloak\/bin\/kc\.sh start --optimized[\s\S]*server_pid="\$!"/.test(input.bootstrapScript), 'bootstrap must retain the optimized temporary server start and pid capture')
  fail(!/set-password[\s\S]*--new-password/.test(input.bootstrapScript), 'persona passwords must not use kcadm set-password --new-password')
  const exactCsvHelper = input.bootstrapScript.match(/csv_first_fields_matching_second\(\) \{[\s\S]*?\n\}/)?.[0] ?? ''
  const firstCsvHelper = input.bootstrapScript.match(/csv_first_fields\(\) \{[\s\S]*?\n\}/)?.[0] ?? ''
  const countCsvHelper = input.bootstrapScript.match(/csv_item_count\(\) \{[\s\S]*?\n\}/)?.[0] ?? ''
  fail(!/\bawk\b/.test(input.bootstrapScript), 'bootstrap must not depend on awk because the pinned Keycloak image does not provide it')
  fail(exactCsvHelper.includes('while IFS= read -r row')
    && exactCsvHelper.includes("*,*,*) die 'kcadm CSV row contains unexpected fields'")
    && exactCsvHelper.includes("*) die 'kcadm CSV row contains unexpected fields'")
    && exactCsvHelper.includes('first="${row%%,*}"')
    && exactCsvHelper.includes('second="${row#*,}"')
    && exactCsvHelper.includes('[ -n "$first" ]')
    && exactCsvHelper.includes('[ -n "$second" ]')
    && exactCsvHelper.includes('[ "$second" = "$target" ]')
    && exactCsvHelper.includes("printf '%s\\n' \"$first\""), 'bootstrap must select mapper ids with the bounded exact-second-field POSIX CSV helper')
  fail(firstCsvHelper.includes('while IFS= read -r row')
    && firstCsvHelper.includes("*,*) die 'kcadm CSV row contains unexpected fields'")
    && firstCsvHelper.includes("printf '%s\\n' \"$row\""), 'bootstrap must select default scope names with the bounded first-field POSIX CSV helper')
  fail(countCsvHelper.includes('if [ -z "$value" ]')
    && countCsvHelper.includes('set -- $value')
    && countCsvHelper.includes('count=$((count + 1))')
    && countCsvHelper.includes("printf '%s' \"$count\""), 'bootstrap must count synthetic scope ids with the bounded POSIX CSV helper')
  fail(/mapper_matches="\$\(printf '%s\\n' "\$mapper_rows" \| csv_first_fields_matching_second "\$mapper_name"\)"/.test(input.bootstrapScript)
    && /default_scope_names="\$\(printf '%s\\n' "\$default_scope_rows" \| csv_first_fields \| sed/.test(input.bootstrapScript)
    && /csv_item_count "\$read_company_ids"/.test(input.bootstrapScript)
    && /csv_item_count "\$read_region_ids"/.test(input.bootstrapScript)
    && /csv_item_count "\$read_store_ids"/.test(input.bootstrapScript)
    && /csv_item_count "\$assigned_store_ids"/.test(input.bootstrapScript), 'bootstrap must route mapper, scope, and manifest CSV operations through the approved POSIX helpers')
  fail(/\*\[!A-Fa-f0-9-\]\*\) die 'claim mapper id contains unsupported characters'/.test(input.bootstrapScript)
    && /mapper_update_file="\$tmp_dir\/\$mapper_name\.update\.json"/.test(input.bootstrapScript)
    && /printf '\{"id":"%s",%s\\n' "\$mapper_uuid" "\$\{mapper_json#\\\{\}" > "\$mapper_update_file"/.test(input.bootstrapScript)
    && /chmod 0600 "\$mapper_update_file"/.test(input.bootstrapScript)
    && /update "clients\/\$client_uuid\/protocol-mappers\/models\/\$mapper_uuid"[\s\S]*-f "\$mapper_update_file"/.test(input.bootstrapScript), 'existing mapper updates must bind the validated mapper id into a private JSON body for Keycloak 26.7 idempotency')
  fail(/users\/\$user_uuid\/reset-password/.test(input.bootstrapScript) && /-f\s+"\$password_file"/.test(input.bootstrapScript) && /-n/.test(input.bootstrapScript) && /chmod 0600\s+"\$password_file"/.test(input.bootstrapScript), 'persona password reset must use a mode-0600 JSON request file and kcadm update -f -n')
  fail(/profile_email="\$username@example\.invalid"/.test(input.bootstrapScript)
    && /,"email":"%s","firstName":"Synthetic","lastName":"Persona"/.test(input.bootstrapScript)
    && /"\$username" "\$profile_email"/.test(input.bootstrapScript), 'synthetic persona profile must use a complete deterministic non-personal identity')
  fail(/kcadm\(\)[\s\S]*kcadm_timeout/.test(input.bootstrapScript)
    && /kcadm_timeout\(\)[\s\S]*\/opt\/keycloak\/bin\/kcadm\.sh/.test(input.bootstrapScript)
    && /kcadm_quiet\(\)[\s\S]*kcadm "\$@" >\/dev\/null 2>&1/.test(input.bootstrapScript)
    && /kcadm_query\(\)[\s\S]*kcadm "\$@"/.test(input.bootstrapScript)
    && /kcadm_quiet delete "clients\/\$bootstrap_client_uuid" -r master/.test(input.bootstrapScript)
    && /if kcadm_query get "clients\/\$bootstrap_client_uuid" -r master/.test(input.bootstrapScript), 'bootstrap must split quiet mutations from output-preserving kcadm queries and delete/verify its temporary master service client after success')
  fail(/readonly KCADM_TIMEOUT_SECONDS=90/.test(input.bootstrapScript)
    && /readonly BOOTSTRAP_TIMEOUT_SECONDS=1800/.test(input.bootstrapScript)
    && /start_bootstrap_watchdog\(\)[\s\S]*?sleep "\$BOOTSTRAP_TIMEOUT_SECONDS"[\s\S]*?kill -TERM "\$\$"/.test(input.bootstrapScript)
    && /\nstart_bootstrap_watchdog\n/.test(input.bootstrapScript)
    && /bootstrap_watchdog_pid/.test(input.bootstrapScript)
    && /handle_termination\(\)[\s\S]*?bootstrap watchdog timeout/.test(input.bootstrapScript)
    && /trap cleanup EXIT[\s\S]*?trap 'handle_termination TERM' TERM[\s\S]*?trap 'handle_termination INT' INT[\s\S]*?trap 'handle_termination HUP' HUP/.test(input.bootstrapScript)
    && /timeout --signal=TERM --kill-after=5s "\$\{KCADM_TIMEOUT_SECONDS\}s" \/opt\/keycloak\/bin\/kc\.sh bootstrap-admin service/.test(input.bootstrapScript)
    && /readonly BOOTSTRAP_AUTH_ATTEMPTS=8/.test(input.bootstrapScript)
    && /while \[ "\$attempt" -lt "\$BOOTSTRAP_AUTH_ATTEMPTS" \]; do/.test(input.bootstrapScript), 'bootstrap must enforce bounded per-request and whole-reconciliation timeouts')
  fail(!/KEYCLOAK_BOOTSTRAP_USERNAME_FILE/.test(keycloak) && !/KEYCLOAK_BOOTSTRAP_PASSWORD_FILE/.test(keycloak), 'production Keycloak must not retain bootstrap credentials after reconciliation')
  fail(!/delete\s+realms\//.test(input.bootstrapScript), 'bootstrap must reconcile in place and never delete the realm')
  fail(/subjects\.v1\.json/.test(input.bootstrapScript) && /schemaVersion/.test(input.bootstrapScript), 'bootstrap must emit a versioned sanitized synthetic subject manifest')
  fail(/\\\"subject\\\"/.test(input.bootstrapScript), 'subject manifest writer must persist the exact synthetic Keycloak subject for backend binding')
  fail(/validate_synthetic_photo_proof_mode/.test(input.bootstrapScript)
    && /validate_synthetic_photo_proof_mode "\$strict_local" "\$data_class" "\$accounts_enabled" "\$photo_proof_enabled"/.test(input.bootstrapScript)
    && /case "\$accounts_enabled" in\s+true\|false\)/.test(input.bootstrapScript)
    && /case "\$photo_proof_enabled" in\s+true\|false\)/.test(input.bootstrapScript)
    && /if \[ "\$photo_proof_enabled" = true \]; then/.test(input.bootstrapScript)
    && /\[ "\$accounts_enabled" = true \] \|\| die 'synthetic photo proof requires synthetic accounts to be enabled'/.test(input.bootstrapScript)
    && /\[ "\$data_class" = synthetic \]/.test(input.bootstrapScript)
    && /synthetic photo proof account secret is forbidden while photo proof is disabled/.test(input.bootstrapScript), 'photo-proof account creation must be gated by the dedicated strict-local synthetic mode and reject dormant/production secrets')
  fail(/read_photo_proof_account/.test(input.bootstrapScript)
    && /photo_proof_key.*onprem\.photo-proof-admin/.test(input.bootstrapScript)
    && /\[ "\$photo_proof_roles" = 'SUPER_ADMIN' \]/.test(input.bootstrapScript)
    && /photo_proof_employee_id.*synthetic-employee-photo-proof-admin/.test(input.bootstrapScript)
    && /photo_proof_company_ids.*company-001/.test(input.bootstrapScript)
    && /photo_proof_region_ids.*region-001/.test(input.bootstrapScript)
    && /photo_proof_store_ids.*store-100/.test(input.bootstrapScript)
    && /photo_proof_read_company_ids.*company-001/.test(input.bootstrapScript)
    && /photo_proof_read_region_ids.*region-001/.test(input.bootstrapScript)
    && /photo_proof_read_store_ids.*store-100/.test(input.bootstrapScript)
    && /photo_proof_assigned_store_ids.*store-100/.test(input.bootstrapScript), 'photo-proof account parser must enforce the exact fixed identity, role, claim, and action scope')
  fail(/photo_proof_manifest_path=.*photo-proof-subject\.v1\.json/.test(input.bootstrapScript)
    && /onprem-keycloak-photo-proof-subject-v1/.test(input.bootstrapScript)
    && /photo-proof-subject\.v1\.json/.test(input.bootstrapScript)
    && /photo_proof_manifest_tmp/.test(input.bootstrapScript)
    && /mv -f "\$photo_proof_manifest_tmp" "\$photo_proof_manifest_path"/.test(input.bootstrapScript), 'photo-proof subject must be emitted to a separate atomic private manifest')
  fail(/if \[ "\$photo_proof_enabled" = true \]; then/.test(input.bootstrapScript)
    && /rm -f "\$photo_proof_manifest_path" "\$photo_proof_manifest_tmp"/.test(input.bootstrapScript), 'disabled photo-proof reconciliation must remove stale managed proof state')
  fail(/photo_disable_file/.test(input.bootstrapScript)
    && /\{"enabled":false\}/.test(input.bootstrapScript)
    && /stale synthetic photo proof account disable failed/.test(input.bootstrapScript)
    && /stale synthetic photo proof account remained enabled/.test(input.bootstrapScript)
    && /stale synthetic photo proof managed role remained assigned/.test(input.bootstrapScript), 'disabled photo-proof reconciliation must disable and verify the exact managed Keycloak user and role revocation')
  const manifestLine = input.bootstrapScript.match(/printf '%s\\n' \"\{\\\"schemaVersion[\s\S]*?manifest_tmp/)?.[0] ?? ''
  fail(!/email|password|token/i.test(manifestLine), 'subject manifest writer must not include emails, passwords, or tokens')
  fail(/scan_server_log/.test(input.bootstrapScript) && /secret value detected/.test(input.bootstrapScript) && /bounded bytes=/.test(input.bootstrapScript), 'bootstrap must scan its temporary server log for exact secret values and emit only bounded sanitized diagnostics')
  const phaseMarkerSource = input.bootstrapScript.match(/phase_marker\(\) \{[\s\S]*?\n\}/)?.[0] ?? ''
  fail(phaseMarkerSource.includes('secret-input|server-start|bootstrap-authentication|realm-reconciliation|synthetic-account-reconciliation|subject-manifest|server-log-scan'), 'bootstrap phase markers must use the exact bounded allowlist')
  fail(/printf '%s\\n' \"keycloak bootstrap: phase=\$phase\"/.test(phaseMarkerSource), 'bootstrap phase markers must emit only a static phase diagnostic')
  for (const phase of ['secret-input', 'server-start', 'bootstrap-authentication', 'realm-reconciliation', 'synthetic-account-reconciliation', 'subject-manifest', 'server-log-scan']) {
    fail(new RegExp(`phase_marker ${phase}(?:\\s|$)`).test(input.bootstrapScript), `bootstrap must emit the bounded ${phase} phase marker`)
  }
  fail(/unset bootstrap_password/.test(input.bootstrapScript), 'bootstrap must unset the service secret immediately after bootstrap-admin')

  const caddy = String(input.caddy)
  for (const path of ['/auth/login', '/auth/callback', '/auth/logout']) fail(caddy.includes(`handle ${path}`), `Caddy must preserve the HR Axis SPA route ${path}`)
  fail(/path \/auth\/admin(?:\s|\/|$)/.test(caddy) && /respond @authAdmin/.test(caddy), 'Caddy must explicitly deny Keycloak admin UI and API paths')
  fail(/path \/admin(?:\s|\/|\*)/.test(caddy) && /respond @keycloakAdmin/.test(caddy), 'Caddy must explicitly deny the Keycloak root admin UI and API paths')
  fail(/reverse_proxy keycloak:8080/.test(caddy), 'Caddy must proxy allowed OIDC paths to private Keycloak')
  fail(!/strip_prefix \/auth/.test(caddy), 'Caddy must not rewrite the strict-local OIDC root paths')
  for (const path of KEYCLOAK_PUBLIC_PATHS) {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\*', '\\*')
    fail(caddy.includes(path) || caddy.includes(path.replace('/auth', '')), `Caddy allowlist must include ${path}`)
  }
  fail(!/handle\s+\/auth\/admin/.test(caddy) || /respond @authAdmin/.test(caddy), 'Caddy admin denial must run before any Keycloak proxy handle')
  fail(!/path \/auth(?:\s|\/\*)/.test(caddy) || /respond @authUnknown/.test(caddy), 'Caddy must fail closed for unlisted /auth paths')

  const workflow = String(input.workflow)
  const syntheticPersonaFixture = workflow.match(/done <<'PERSONAS'([\s\S]*?)\n\s*PERSONAS/)?.[1] ?? ''
  const syntheticPersonaRows = syntheticPersonaFixture.split(/\r?\n/).map((row) => row.trim()).filter(Boolean)
  fail(syntheticPersonaRows.length === 5 && !syntheticPersonaRows.some((row) => row.includes('onprem.photo-proof-admin')), 'workflow synthetic account input must contain exactly five approved personas; photo-proof identity is separate')
  fail(/synthetic_account_count=0/.test(input.bootstrapScript)
    && /synthetic_account_count=\$\(\(synthetic_account_count \+ 1\)\)/.test(input.bootstrapScript)
    && /\[ "\$synthetic_account_count" -le 5 \]/.test(input.bootstrapScript)
    && /\[ "\$synthetic_account_count" -eq 5 \]/.test(input.bootstrapScript), 'bootstrap synthetic account parser must enforce exactly five approved personas')
  const keycloakBuildStep = workflow.match(/- name: Pull pinned Keycloak base and build the optimized ONP-3B image[\s\S]*?(?=\n\s+- name:|$)/)?.[0] ?? ''
  const bootstrapCommandInventory = 'required_bootstrap_commands="cat chmod grep mkdir mktemp mv rm sed sleep tr wc"'
  const keycloakBuildIndex = keycloakBuildStep.indexOf('docker build --file infra/onprem/images/keycloak.Dockerfile --tag "$KEYCLOAK_IMAGE"')
  const keycloakIdentityIndex = keycloakBuildStep.indexOf('test "$(docker image inspect "$KEYCLOAK_IMAGE"')
  const bootstrapPreflightIndex = keycloakBuildStep.indexOf('docker run --rm --volume "$PWD/infra/onprem/core/keycloak/bootstrap.sh:/opt/keycloak/bootstrap.sh:ro"')
  const imageIdCaptureIndex = keycloakBuildStep.indexOf("printf 'KEYCLOAK_IMAGE_ID=%s\\n'")
  fail(keycloakBuildIndex >= 0
    && keycloakIdentityIndex > keycloakBuildIndex
    && bootstrapPreflightIndex > keycloakIdentityIndex
    && imageIdCaptureIndex > bootstrapPreflightIndex
    && /docker run --rm --volume "\$PWD\/infra\/onprem\/core\/keycloak\/bootstrap\.sh:\/opt\/keycloak\/bootstrap\.sh:ro"[\s\S]*?--entrypoint \/bin\/sh "\$KEYCLOAK_IMAGE" -ec '/.test(keycloakBuildStep)
    && keycloakBuildStep.includes(bootstrapCommandInventory)
    && /for required_command in \$required_bootstrap_commands; do[\s\S]*command -v "\$required_command" >\/dev\/null[\s\S]*done/.test(keycloakBuildStep)
    && /test -x \/opt\/keycloak\/bin\/kc\.sh/.test(keycloakBuildStep)
    && /test -x \/opt\/keycloak\/bin\/kcadm\.sh/.test(keycloakBuildStep)
    && /\/bin\/sh -n \/opt\/keycloak\/bootstrap\.sh/.test(keycloakBuildStep), 'workflow must preflight every bootstrap executable and POSIX-parse the script in the freshly built pinned Keycloak image after its identity check')
  const syftStep = workflow.match(/- name: Generate SPDX SBOMs with pinned Syft[\s\S]*?(?=\n\s+- name:|$)/)?.[0] ?? ''
  const licenseStep = workflow.match(/- name: Generate production license inventories and notices[\s\S]*?(?=\n\s+- name:|$)/)?.[0] ?? ''
  const syftIdentityCheck = 'test "$(docker image inspect "$KEYCLOAK_IMAGE" --format \'{{.Id}}\')" = "$KEYCLOAK_IMAGE_ID"'
  const keycloakSyftCommand = '"$KEYCLOAK_IMAGE" -o spdx-json=/out/keycloak-sbom.spdx.json'
  const reconciliationIdentityRead = 'keycloak_image_id="$(docker image inspect "$KEYCLOAK_IMAGE" --format \'{{.Id}}\')"'
  const reconciliationIdentityCheck = 'test "$keycloak_image_id" = "$KEYCLOAK_IMAGE_ID"'
  const reconciliationCommand = 'node scripts/onprem-keycloak-license-reconciliation.mjs'
  fail(workflow.includes(KEYCLOAK_IMAGE), 'on-prem image proof must pin and pull the Keycloak image')
  fail(/docker pull ["']?\$KEYCLOAK_BASE_IMAGE/.test(workflow) || /docker pull .*KEYCLOAK_BASE_IMAGE/.test(workflow), 'workflow must pull the pinned Keycloak base image')
  fail(/keycloak.*(?:trivy|vulnerability|scan)/i.test(workflow) && /KEYCLOAK_TRIVY_IMAGE/.test(workflow), 'workflow must scan the pinned Keycloak image')
  fail(/keycloak.*sbom|KEYCLOAK_IMAGE.*spdx/i.test(workflow), 'workflow must generate a Keycloak SBOM')
  fail(/keycloak.*license|license.*keycloak/i.test(workflow), 'workflow must retain Keycloak license evidence')
  fail(/keycloak-LICENSE\.txt/.test(workflow) && /keycloak-license-paths\.txt/.test(workflow), 'workflow must retain Keycloak license text and discovered license/notice paths')
  fail(/keycloak-license-evidence\.tar/.test(workflow), 'workflow must retain the bundled Keycloak dependency license evidence')
  fail(/--license-text\s+proof\/keycloak-LICENSE\.txt/.test(workflow) && /--license-paths\s+proof\/keycloak-license-paths\.txt/.test(workflow), 'Keycloak image manifest must bind license text and path evidence')
  fail(/onprem-keycloak-license-reconciliation\.mjs/.test(workflow) && /keycloak-license-reconciliation\.json/.test(workflow), 'workflow must reconcile every Keycloak SBOM component against license evidence')
  fail(/"imageId":"'"\$keycloak_image_id"'"/.test(workflow) && /docker image inspect "\$KEYCLOAK_IMAGE" --format '\{\{\.Id\}\}'/.test(workflow), 'Keycloak license inventory must bind the immutable built image identity')
  fail(syftStep.indexOf(syftIdentityCheck) >= 0 && syftStep.indexOf(syftIdentityCheck) < syftStep.indexOf(keycloakSyftCommand), 'Keycloak Syft proof must reject tag drift before reading the built image')
  fail(licenseStep.indexOf(reconciliationIdentityRead) >= 0
    && licenseStep.indexOf(reconciliationIdentityRead) < licenseStep.indexOf(reconciliationIdentityCheck)
    && licenseStep.indexOf(reconciliationIdentityCheck) < licenseStep.indexOf(reconciliationCommand), 'Keycloak license reconciliation must reject tag drift before consuming the SBOM identity')
  fail(/keycloak.*content|content.*keycloak/i.test(workflow), 'workflow must content-scan Keycloak layers')
  fail(/keycloak.*manifest|manifest.*keycloak/i.test(workflow), 'workflow must bind Keycloak evidence into a sanitized manifest')
  fail(/proof\/keycloak-image-manifest\.json/.test(workflow), 'workflow must upload the sanitized Keycloak image manifest')
  fail(/keycloak\.Dockerfile/.test(workflow) && /docker build/.test(workflow), 'workflow must build the optimized Keycloak image from its pinned base')
  fail(/onprem-keycloak-runtime-proof\.mjs/.test(workflow) && /--require-fresh-volumes/.test(workflow), 'workflow must run a fresh-volume synthetic Keycloak runtime proof')
  fail(/onprem-keycloak-runtime-proof\.mjs\s+--cleanup/.test(workflow) || /onprem-keycloak-runtime-proof\.mjs'[\s\S]*--cleanup/.test(workflow), 'workflow EXIT cleanup must call the guarded Keycloak runtime cleanup contract')
  fail(/residualExternalReviewRequired/.test(workflow), 'workflow must surface residualExternalReviewRequired as an unresolved license activation gate')
  fail(/receipt\.packageCount !== 556/.test(workflow) && /receipt\.maxUnresolvedCount !== 455/.test(workflow), 'workflow must pin the Keycloak license package and unresolved boundaries')
  fail(/receipt\.resolvedCount \+ receipt\.unresolvedCount !== receipt\.packageCount/.test(workflow), 'workflow must fail closed on Keycloak license summary drift')
  fail(/component\.license !== null \|\| component\.evidence !== null/.test(workflow), 'workflow must prevent unresolved Keycloak components from claiming license evidence')
  fail(/onprem\.store-manager\|onprem\.store-manager\|STORE_MANAGER\|synthetic-employee-store-manager\|company-001\|region-001\|store-100\|company-001\|region-001\|store-100,store-999\|store-100/.test(workflow), 'workflow must exercise a provider-signed overbroad read-store claim while keeping the assigned store narrow')

  return { ok: errors.length === 0, errors: [...new Set(errors)], services: [...blocks.keys()], steadyCpu, steadyMemory }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const read = (path) => readFileSync(path, 'utf8')
  const result = validateOnpremKeycloakContract({
    backendDockerfile: read('infra/onprem/images/backend.Dockerfile'),
    keycloakDockerfile: read('infra/onprem/images/keycloak.Dockerfile'),
    bootstrapScript: read('infra/onprem/core/keycloak/bootstrap.sh'),
    bootstrapSql: read('infra/onprem/core/postgres/010-bootstrap-roles.sh'),
    caddy: read('infra/onprem/core/caddy/Caddyfile'),
    compose: read('infra/onprem/core/compose.yaml'),
    envTemplate: read('infra/onprem/core/env.template'),
    realmConfig: read('infra/onprem/core/keycloak/realm-config.json'),
    personaSeed: read('db/seeds/002_onprem_keycloak_personas.sql'),
    workflow: read('.github/workflows/onprem-image-proof.yml'),
  })
  console.log(JSON.stringify(result, null, 2))
  if (!result.ok) process.exitCode = 1
}
