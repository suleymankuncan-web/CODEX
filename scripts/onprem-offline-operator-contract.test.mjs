import assert from 'node:assert/strict'
import { chmodSync, chownSync, existsSync, linkSync, mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const operationDir = join(repo, 'infra', 'onprem', 'offline', 'operations')
const scriptNames = ['preflight.sh', 'install.sh', 'migrate.sh', 'activate.sh', 'smoke.sh']
const source = Object.fromEntries(scriptNames.map((name) => [name, readFileSync(join(operationDir, name), 'utf8')]))

test('ONP-5 operation scripts expose the locked fail-closed contract', () => {
  for (const name of scriptNames) {
    const text = source[name]
    assert.match(text, /^#!\/bin\/sh\nset -eu/m, name)
    for (const option of ['--bundle-root', '--release-id', '--target-project', '--public-key', '--env-file']) {
      assert.match(text, new RegExp(option.replace('-', '\\-')), `${name} requires ${option}`)
    }
    assert.match(text, /--proof-compose/, `${name} exposes the optional proof Compose overlay`)
    assert.match(text, /--trusted-fingerprint/)
    assert.match(text, /trusted fingerprint must be 64 lowercase hex/)
    assert.match(text, /onprem-offline-bundle\.mjs.*verify|verify.*onprem-offline-bundle\.mjs/s, `${name} calls bundled verifier`)
    assert.doesNotMatch(text, /docker\s+compose[^\n]*down\s+-v|docker\s+compose[^\n]*--volumes/)
    assert.doesNotMatch(text, /\brm\s+-rf\b|\bcurl\s+https?:\/\/|\bgit\s+(?:clone|pull|checkout)|\bnpm(?:\.cmd)?\s+(?:install|run|exec)|docker\s+build/)
  }
  for (const name of scriptNames) assert.match(source[name], /--file "\$CORE_COMPOSE" --file "\$PHOTO_PROOF_COMPOSE" --file "\$PHOTO_COMPOSE"/, `${name} uses the locked core/photo-proof/photo project`)
  const install = source['install.sh']
  const verify = install.indexOf('node "$VERIFIER" verify')
  const preflight = install.indexOf('operations/preflight.sh')
  const firstLoad = install.indexOf('docker load -i')
  const firstComposeMutation = install.indexOf('up --pull never')
  assert.ok(verify >= 0 && verify < firstLoad)
  assert.ok(preflight > verify && preflight < firstLoad)
  assert.ok(firstLoad < firstComposeMutation)
  for (const image of ['backend', 'frontend', 'keycloak', 'caddy', 'postgres', 'redis', 'seaweedfs']) assert.match(install, new RegExp(image))
  assert.match(install, /docker image inspect --format '\{\{\.Id\}\}'/)
  assert.doesNotMatch(install, /docker image inspect[^\n]*RepoDigests/)
  assert.match(install, /expected_image_id/)
  assert.doesNotMatch(install, /migrator/)
  assert.match(install, /separate-migrate\.sh/)
  assert.doesNotMatch(install, /keycloak-bootstrap|identity-binder|synthetic-seed/)
  assert.match(install, /up --pull never/)
  assert.match(install, /object-storage/)
  assert.match(install, /CONFIG=\$\(compose --profile '\*' config --format json 2>\/dev\/null\)/, 'install config identity check must render every signed Compose profile')
  const expectedMutationLine = 'compose --profile infra --profile runtime up --pull never -d postgres redis keycloak object-storage >/dev/null || die "private prerequisite startup failed"'
  const mutationLines = install.split(/\r?\n/).filter((line) => line.startsWith('compose --profile infra --profile runtime up --pull never'))
  assert.deepEqual(mutationLines, [expectedMutationLine], 'install mutation must stay exact and limited to the private prerequisite services')
  assert.doesNotMatch(install, /compose --profile '\*'[^\n]*\bup\b/, 'wildcard profile must not be applied to the install mutation')
  const composeWrapperStart = install.indexOf('compose() {')
  const composeWrapperEnd = install.indexOf('\n}\nCONFIG=', composeWrapperStart)
  assert.ok(composeWrapperStart >= 0 && composeWrapperEnd > composeWrapperStart, 'install compose wrapper remains easy to inspect')
  assert.doesNotMatch(install.slice(composeWrapperStart, composeWrapperEnd), /--profile/, 'profiles must be supplied only at explicit Compose call sites')

  const activate = source['activate.sh']
  assert.match(activate, /migration-compatibility\.json/)
  assert.match(activate, /SIGNED_DIGEST/)
  assert.match(activate, /migration-status\.js/)
  assert.match(activate, /read-only migration status|clean target migration status/)
  assert.doesNotMatch(activate, /MIGRATION_LEDGER_FILE.*required|migration ledger is incompatible/i)
  assert.match(activate, /keycloak-bootstrap[\s\S]*identity-binder[\s\S]*synthetic-seed/)
  assert.match(activate, /up --pull never/)
  const expectedPrivatePrerequisiteUp = 'compose --profile infra --profile runtime up --pull never --wait --wait-timeout 180 -d postgres redis keycloak object-storage >/dev/null || die "private prerequisite startup failed"'
  const expectedApplicationUp = 'compose --profile infra --profile runtime up --pull never --wait --wait-timeout 180 -d postgres redis keycloak object-storage caddy frontend api worker >/dev/null || die "application service startup failed"'
  const activationUpLines = activate.split(/\r?\n/).filter((line) => line.startsWith('compose --profile infra --profile runtime up --pull never'))
  assert.deepEqual(activationUpLines, [expectedPrivatePrerequisiteUp, expectedApplicationUp], 'activation Compose up commands must stay exact and service-scoped')
  assert.doesNotMatch(activate, /compose --profile infra --profile runtime up --pull never -d\b/, 'activation Compose up must not be unbounded')
  assert.doesNotMatch(activate, /compose --profile '\*'[^\n]*\bup\b/, 'wildcard Compose profiles must not drive activation mutations')
  const postStatusIndex = activate.indexOf('POST_STATUS=$(read_status)')
  const privatePrerequisiteIndex = activate.indexOf(expectedPrivatePrerequisiteUp)
  const keycloakInspectIndex = activate.indexOf('KEYCLOAK_ID=$(compose ps -q keycloak 2>/dev/null || true)')
  const applicationUpIndex = activate.indexOf(expectedApplicationUp)
  assert.ok(postStatusIndex >= 0 && postStatusIndex < privatePrerequisiteIndex && privatePrerequisiteIndex < keycloakInspectIndex && keycloakInspectIndex < applicationUpIndex, 'activation ordering must be migration status, prerequisite wait, Keycloak inspect/bootstrap, application wait')
  assert.match(activate, /KEYCLOAK_ID=\$\(compose ps -q keycloak 2>\/dev\/null \|\| true\); \[ -n "\$KEYCLOAK_ID" \] \|\| die "Keycloak prerequisite is not running"/)
  assert.match(activate, /\[ "\$\(docker inspect "\$KEYCLOAK_ID" --format '\{\{\.State\.Health\.Status\}\}' 2>\/dev\/null \|\| true\)" = healthy \] \|\| die "Keycloak prerequisite is not healthy"/)
  const expectedKeycloakBootstrapRun = 'compose --profile infra --profile keycloak-bootstrap run --pull never --rm --no-deps keycloak-bootstrap >/dev/null || die "Keycloak bootstrap reconcile failed"'
  const expectedIdentityBinderRun = 'compose --profile infra --profile keycloak-bootstrap --profile identity-binder run --pull never --rm --no-deps identity-binder >/dev/null || die "identity binder failed"'
  const expectedSeedRun = 'compose --profile seed run --pull never --rm --no-deps synthetic-seed >/dev/null || die "synthetic seed failed"'
  assert.deepEqual(
    activate.split(/\r?\n/).filter((line) => line.includes('keycloak-bootstrap run --pull never --rm --no-deps') || line.includes('identity-binder run --pull never --rm --no-deps') || line.includes('profile seed run --pull never --rm --no-deps synthetic-seed')),
    [expectedKeycloakBootstrapRun, expectedIdentityBinderRun, expectedSeedRun],
    'activation one-shot services must activate every dependency-sharing profile explicitly',
  )

  const restore = readFileSync(join(operationDir, 'restore.sh'), 'utf8')
  const expectedRestoreKeycloakBootstrapRun = 'compose_core --profile infra --profile keycloak-bootstrap run --pull never --rm --no-deps keycloak-bootstrap >/dev/null 2>&1 || die "Keycloak bootstrap reconcile failed"'
  const expectedRestoreIdentityBinderRun = 'compose_core --profile infra --profile keycloak-bootstrap --profile identity-binder run --pull never --rm --no-deps identity-binder >/dev/null 2>&1 || die "identity binder failed"'
  assert.ok(restore.includes(expectedRestoreKeycloakBootstrapRun), 'restore bootstrap must activate dependency-sharing profiles explicitly')
  assert.ok(restore.includes(expectedRestoreIdentityBinderRun), 'restore identity binder must activate dependency-sharing profiles explicitly')

  const migrate = source['migrate.sh']
  assert.match(migrate, /dirty|orphanCount|checksumValid/i)
  assert.match(migrate, /MIGRATION_LEDGER_FILE/)
  assert.match(migrate, /migration-status\.js/)
  assert.match(migrate, /target database|read-only migration status/i)
  assert.match(migrate, /migration-compatibility\.json/)
  assert.match(migrate, /SIGNED_DIGEST/)
  assert.match(migrate, /exactly one migration tree digest/)
  assert.match(migrate, /migrator tree digest does not match signed/)
  assert.match(migrate, /mktemp[\s\S]*chmod 600[\s\S]*mv -f/)
  assert.doesNotMatch(migrate, /MIGRATION_LEDGER_FILE is required|migration ledger is incompatible, dirty/i)
  assert.doesNotMatch(migrate, /compose --profile[^\n]*\bup\b/)
  assert.match(migrate, /run --pull never/)

  const smoke = source['smoke.sh']
  assert.doesNotMatch(smoke, /onprem-core-runtime-proof|\bCORE_PROOF\b|onprem-photo-storage-runtime-proof|\bPHOTO_PROOF\b/)
  assert.match(smoke, /onprem-keycloak-auth-proof\.mjs/)
  for (const service of ['caddy', 'frontend', 'api', 'worker', 'postgres', 'redis', 'keycloak', 'object-storage']) assert.match(smoke, new RegExp(service))
  assert.match(smoke, /HR_AXIS_DATA_CLASS|synthetic/)
  assert.match(smoke, /hr_axis_bootstrap/)
  assert.match(smoke, /redis_health_url/)
  assert.match(smoke, /keycloak_synthetic_accounts/)
  assert.match(smoke, /caddy_tls_ca/)
  assert.match(smoke, /config --format json/)
  assert.match(smoke, /file_gid/)
  assert.match(smoke, /1000:1000:400/)
  assert.match(smoke, /0:0:444/)
  assert.doesNotMatch(smoke, /KEYCLOAK_SYNTHETIC_ACCOUNTS_FILE|TLS_CA_FILE/)
  assert.match(smoke, /case "\$secret_name" in[\s\S]*keycloak_database_username\) ;;[\s\S]*\*\) \[ -z "\$value" \]/)
  assert.doesNotMatch(smoke, /keycloak_\*username|keycloak_\*\)/, 'receipt value scan exemption must stay exact-name coupled')
  assert.match(smoke, /runtime-receipt|mktemp/)
  const preflightSource = source['preflight.sh']
  for (const variable of ['HR_AXIS_BACKEND_IMAGE', 'HR_AXIS_FRONTEND_IMAGE', 'KEYCLOAK_IMAGE', 'CADDY_IMAGE', 'POSTGRES_IMAGE', 'REDIS_IMAGE', 'SEAWEEDFS_IMAGE']) {
    assert.match(preflightSource, new RegExp(variable), `preflight maps ${variable}`)
  }
  assert.match(preflightSource, /approved env image identity mismatch/)
  assert.match(preflightSource, /HR_AXIS_PROJECT_ID/)
  assert.match(preflightSource, /merged Compose labels are missing or mismatched/)
  assert.match(preflightSource, /docker compose --project-name "\$TARGET_PROJECT" --profile '\*' --env-file "\$ENV_FILE"/)
  assert.match(preflightSource, /com\.hr-axis\.project/)
  assert.match(preflightSource, /com\.hr-axis\.release-id/)
  assert.match(preflightSource, /configImageId/)
  assert.match(preflightSource, /repoTag/)
  assert.match(preflightSource, /migration ledger parent/)
  assert.doesNotMatch(preflightSource, /\[ "\$\(file_links "\$ledger_parent"\)" = 1 \]/, 'directory link counts must not require the POSIX empty-directory value')
  assert.match(preflightSource, /ledger_parent_links=\$\(file_links "\$ledger_parent"\)/)
  assert.match(preflightSource, /case "\$ledger_parent_links" in[\s\S]*\[ "\$ledger_parent_links" -ge 1 \]/)
  assert.match(preflightSource, /\[ "\$\(file_links "\$ledger_file"\)" = 1 \]/, 'ledger regular files retain the single-link guard')
  assert.match(preflightSource, /docker inspect/)
  assert.match(preflightSource, /Config\.Labels/)
  assert.match(preflightSource, /docker network inspect/)
  assert.match(preflightSource, /docker volume inspect/)
  assert.match(preflightSource, /\.Labels/)
  assert.match(preflightSource, /HR_AXIS_SECRET_ROOT/)
  assert.match(preflightSource, /mode must be 0700/)
  assert.match(preflightSource, /rendered_secret_identity/)
  assert.match(preflightSource, /file_gid/)
  for (const identity of ['10001:10001:400', '70:70:400', '1000:1000:400', '999:1000:400', '65532:65532:400', '0:65532:440', '0:0:444']) assert.match(preflightSource, new RegExp(identity.replaceAll(':', '\\:')))
  assert.match(preflightSource, /photo_primary_access_key_id\|photo_primary_secret_access_key\|photo_recovery_access_key_id\|photo_recovery_secret_access_key\) printf '%s' 0:65532:440/)
  assert.doesNotMatch(preflightSource, /photo_primary_access_key_id\|photo_primary_secret_access_key\|photo_recovery_access_key_id\|photo_recovery_secret_access_key\) printf '%s' 65532:65532:400/)
  assert.match(preflightSource, /rendered secret source identity is unsafe/)
  assert.match(preflightSource, /PHOTO_STORAGE_SECRET_ROOT/)
  assert.match(preflightSource, /file_links|hard link/)
  assert.match(preflightSource, /SECRET_LINES/)
  const renderedValuePolicy = preflightSource.match(/  case "\$secret_name" in\n    keycloak_database_username\) ;;\n    \*\) \[ -z "\$value" \] \|\| case "\$CONFIG" in \*"\$value"\*\) die "Compose config contains a rendered secret value: \$secret_name";; esac;;\n  esac/)?.[0]
  assert.equal(renderedValuePolicy, `  case "$secret_name" in
    keycloak_database_username) ;;
    *) [ -z "$value" ] || case "$CONFIG" in *"$value"*) die "Compose config contains a rendered secret value: $secret_name";; esac;;
  esac`)
  const renderedPolicyIndex = preflightSource.indexOf(renderedValuePolicy)
  for (const requiredCheck of ['rendered secret source is missing or symlinked', 'rendered secret source is a hard link', 'rendered secret source identity is unsafe', 'rendered secret source is too large']) {
    const checkIndex = preflightSource.indexOf(requiredCheck)
    assert.ok(checkIndex >= 0 && checkIndex < renderedPolicyIndex, `${requiredCheck} must precede the sole value-scan exemption`)
  }
  assert.match(preflightSource, /openssl verify -CAfile/)
  assert.match(preflightSource, /cert_public_digest|key_public_digest/)
  assert.match(preflightSource, /bundle root must not be the filesystem root/)
  assert.match(preflightSource, /find -P/)
  assert.match(preflightSource, /bundle directory must be root-owned/)
  assert.match(preflightSource, /signed bundle file must not be a hard link/)
  assert.match(preflightSource, /group\/world writable/)
  assert.match(preflightSource, /required 0755 mode/)
  assert.match(preflightSource, /external input ancestor must be root-owned/)
  assert.match(preflightSource, /external input ancestor is group\/world writable/)
})

test('photo secret leaf identity permits root and backend-group reads while denying unrelated users', (t) => {
  if (process.platform !== 'linux' || process.getuid?.() !== 0) {
    t.skip('POSIX UID/GID permission proof requires the Linux root run')
    return
  }
  const root = mkdtempSync(join('/var/lib', 'onprem-photo-secret-identity-'))
  const secret = join(root, 'primary-secret-access-key')
  try {
    chmodSync(root, 0o755)
    writeFileSync(secret, 'synthetic-photo-secret\n', { mode: 0o440 })
    chownSync(secret, 0, 65532)
    chmodSync(secret, 0o440)
    const readAs = (uid, gid) => spawnSync(process.execPath, ['-e', 'process.stdout.write(require("node:fs").readFileSync(process.argv[1], "utf8"))', secret], {
      encoding: 'utf8', uid, gid,
    })
    const metadata = statSync(secret)
    assert.equal(metadata.uid, 0)
    assert.equal(metadata.gid, 65532)
    assert.equal(metadata.mode & 0o777, 0o440)
    const rootRead = readAs(0, 0)
    assert.equal(rootRead.status, 0, rootRead.stderr)
    assert.equal(rootRead.stdout, 'synthetic-photo-secret\n')
    const backendRead = readAs(65532, 65532)
    assert.equal(backendRead.status, 0, backendRead.stderr)
    assert.equal(backendRead.stdout, 'synthetic-photo-secret\n')
    const unrelatedRead = readAs(65531, 65531)
    assert.notEqual(unrelatedRead.status, 0, 'unrelated UID/GID must not read photo secret')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('offline lifecycle composes the signed photo-proof overlay in locked order', () => {
  for (const name of ['preflight.sh', 'install.sh', 'migrate.sh', 'activate.sh', 'smoke.sh', 'backup.sh', 'restore.sh']) {
    const text = readFileSync(join(operationDir, name), 'utf8')
    assert.match(text, /deployment\/compose\.photo-proof\.yaml/)
    assert.match(text, /(?:--file|--compose) "?\$CORE_COMPOSE"?[\s\\]*--(?:file|compose) "?\$PHOTO_PROOF_COMPOSE"?[\s\\]*--(?:file|compose) "?\$PHOTO_COMPOSE"?/)
    assert.match(text, /PROOF_COMPOSE|proof-compose/, `${name} validates proof Compose overlay`)
  }
})

test('operation scripts pass shell syntax when POSIX sh is available', (t) => {
  const shell = process.platform === 'win32' && existsSync('C:\\Program Files\\Git\\usr\\bin\\sh.exe')
    ? 'C:\\Program Files\\Git\\usr\\bin\\sh.exe' : 'sh'
  if (process.platform === 'win32' && !existsSync(shell)) {
    t.skip('POSIX shell unavailable on Windows')
    return
  }
  for (const name of scriptNames) {
    const result = spawnSync(shell, ['-n', join(operationDir, name)], { encoding: 'utf8' })
    assert.equal(result.status, 0, `${name}: ${result.stderr}`)
  }
})

function executable(pathname, content) {
  writeFileSync(pathname, content)
  chmodSync(pathname, 0o755)
}

const POSIX_SHELL = process.platform === 'win32' ? 'C:\\Program Files\\Git\\usr\\bin\\sh.exe' : 'sh'
const CYGPATH = process.platform === 'win32' ? 'C:\\Program Files\\Git\\usr\\bin\\cygpath.exe' : null
function shellPath(pathname) {
  if (!CYGPATH) return pathname
  const result = spawnSync(CYGPATH, ['-u', pathname], { encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : pathname
}

function makeFixture({ ledger = false, nativeLedgerStat = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'onprem-operator-contract-'))
  const bundle = join(root, 'bundle')
  const operations = join(bundle, 'operations')
  const deployment = join(bundle, 'deployment')
  const fakeBin = join(root, 'bin')
  const log = join(root, 'commands.log')
  const nodeLog = join(root, 'node-commands.log')
  const mode = join(root, 'mode')
  const idMode = join(root, 'id-mismatch')
  const broadMode = join(root, 'broad-secret-mode')
  const wrongKeyMode = join(root, 'wrong-key')
  const wrongCaMode = join(root, 'wrong-ca')
  const runtimeImageMode = join(root, 'runtime-image-mismatch')
  const nonRootMode = join(root, 'non-root-owner')
  const unsafeInputAncestorMode = join(root, 'unsafe-input-ancestor')
  const unsafeSecretAncestorMode = join(root, 'unsafe-secret-ancestor')
  const largeSecretMode = join(root, 'large-rendered-secret')
  const wrongSecretIdentityMode = join(root, 'wrong-rendered-secret-identity')
  const legacyPhotoIdentityMode = join(root, 'legacy-photo-identity')
  const missingAccountsSecretMode = join(root, 'missing-accounts-secret')
  const wrongAccountsSecretTypeMode = join(root, 'wrong-accounts-secret-type')
  const composeVersionFile = join(root, 'compose-version')
  const inputRoot = join(root, 'operator-inputs')
  const envFile = join(inputRoot, 'approved.env')
  const publicKey = join(inputRoot, 'trusted.pub')
  const tlsDir = join(root, 'tls')
  const receiptDir = join(root, 'receipts')
  const secretRoot = join(inputRoot, 'hr-axis-secrets')
  const authAccounts = join(secretRoot, 'keycloak', 'synthetic-accounts')
  const photoSecretRoot = join(inputRoot, 'photo-secrets')
  const ledgerParent = join(inputRoot, 'migration-ledger')
  const ledgerFile = join(ledgerParent, 'migration-ledger.json')
  const hardlinkPath = join(photoSecretRoot, 'photo-hardlink')
  for (const directory of [operations, deployment, fakeBin, tlsDir, inputRoot, secretRoot, photoSecretRoot, receiptDir, join(bundle, 'images'), ...(ledger ? [ledgerParent] : [])]) mkdirSync(directory, { recursive: true })
  if (ledger) chmodSync(ledgerParent, 0o700)
  writeFileSync(join(bundle, 'bundle-manifest.json'), '{}\n')
  writeFileSync(join(bundle, 'bundle-signature.json'), '{}\n')
  writeFileSync(join(bundle, 'operations', 'onprem-offline-bundle.mjs'), '// fake verifier\n')
  writeFileSync(join(bundle, 'deployment', 'compose.yaml'), 'name: hr-axis-onprem-core\n')
  writeFileSync(join(bundle, 'deployment', 'compose.photo-proof.yaml'), 'services: {}\n')
  writeFileSync(join(bundle, 'deployment', 'photo-compose.yaml'), 'services: { object-storage: {} }\n')
  writeFileSync(join(bundle, 'operations', 'onprem-keycloak-auth-proof.mjs'), '// fake auth proof\n')
  mkdirSync(join(bundle, 'evidence'), { recursive: true })
  writeFileSync(join(bundle, 'evidence', 'runtime-receipt.json'), `{"releaseId":"release-test","photo":{"version":"v1","sha256":"${'a'.repeat(64)}"}}\n`)
  for (const image of ['backend', 'frontend', 'keycloak', 'caddy', 'postgres', 'redis', 'seaweedfs']) writeFileSync(join(bundle, 'images', `${image}.tar`), `synthetic:${image}\n`)
  for (const pathname of [publicKey, join(tlsDir, 'server.crt'), join(tlsDir, 'server.key'), join(tlsDir, 'ca.crt')]) writeFileSync(pathname, 'synthetic\n')
  mkdirSync(join(secretRoot, 'keycloak'), { recursive: true })
  writeFileSync(join(secretRoot, 'caddy.crt'), 'canary-caddy-certificate-v1\n')
  writeFileSync(join(secretRoot, 'caddy.key'), 'canary-caddy-private-key-v1\n')
  writeFileSync(join(secretRoot, 'caddy.ca'), 'canary-caddy-ca-v1\n')
  writeFileSync(join(secretRoot, 'keycloak', 'photo-proof-account'), 'canary-photo-proof-account-v1\n')
  writeFileSync(join(photoSecretRoot, 'photo.key'), 'canary-photo-primary-v1\n')
  writeFileSync(join(secretRoot, 'keycloak', 'database-username'), 'hr-axis-onprem-core\n')
  writeFileSync(join(secretRoot, 'keycloak', 'bootstrap-username'), 'canary-keycloak-bootstrap-user-v1\n')
  writeFileSync(join(secretRoot, 'keycloak', 'bootstrap-password'), 'canary-keycloak-bootstrap-password-v1\n')
  writeFileSync(join(secretRoot, 'keycloak', 'smtp-auth-user'), 'canary-keycloak-smtp-user-v1\n')
  writeFileSync(authAccounts, 'canary-keycloak-accounts-v1\n', { mode: 0o400 })
  chmodSync(authAccounts, 0o400)
  const imageDigests = { backend: 'a'.repeat(64), frontend: 'a'.repeat(64), keycloak: 'b'.repeat(64), caddy: 'a'.repeat(64), postgres: 'a'.repeat(64), redis: 'a'.repeat(64), seaweedfs: 'a'.repeat(64) }
  const imageVariables = { backend: 'HR_AXIS_BACKEND_IMAGE', frontend: 'HR_AXIS_FRONTEND_IMAGE', keycloak: 'KEYCLOAK_IMAGE', caddy: 'CADDY_IMAGE', postgres: 'POSTGRES_IMAGE', redis: 'REDIS_IMAGE', seaweedfs: 'SEAWEEDFS_IMAGE' }
  writeFileSync(envFile, [
    'COMPOSE_PROJECT_NAME=hr-axis-onprem-core', 'HR_AXIS_RELEASE_ID=release-test', 'HR_AXIS_PUBLIC_HOST=onprem.example.invalid',
    `HR_AXIS_SECRET_ROOT=${shellPath(secretRoot)}`, `PHOTO_STORAGE_SECRET_ROOT=${shellPath(photoSecretRoot)}`, 'HR_AXIS_PROJECT_ID=hr-axis-onprem-core',
    ...(ledger ? [`MIGRATION_LEDGER_FILE=${shellPath(ledgerFile)}`] : []),
    ...Object.entries(imageVariables).map(([name, variable]) => `${variable}=sha256:${imageDigests[name]}`),
    'HR_AXIS_DATA_CLASS=synthetic', 'HR_AXIS_STRICT_LOCAL=true', 'KEYCLOAK_SYNTHETIC_ACCOUNTS_ENABLED=true', 'KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED=true',
  ].join('\n') + '\n')
  const preflightFixture = readFileSync(join(operationDir, 'preflight.sh'), 'utf8')
    .replace('"services":{"object-storage":{}}', '"services":{"object-storage":{"labels":{"com.hr-axis.project":"hr-axis-onprem-core","com.hr-axis.release-id":"release-test","com.hr-axis.data-class":"synthetic"}}}')
  executable(join(operations, 'preflight.sh'), preflightFixture)
  const digest = `sha256:${imageDigests.backend}`
  const records = ['backend', 'frontend', 'keycloak', 'caddy', 'postgres', 'redis', 'seaweedfs']
    .map((name) => `${name}|images/${name}.tar|registry.example/${name}:synthetic|sha256:${imageDigests[name]}`).join('\n')
  const renderedSecrets = [
    `caddy_tls_certificate\t${shellPath(join(secretRoot, 'caddy.crt'))}`,
    `caddy_tls_private_key\t${shellPath(join(secretRoot, 'caddy.key'))}`,
    `caddy_tls_ca\t${shellPath(join(secretRoot, 'caddy.ca'))}`,
    `keycloak_synthetic_accounts\t${shellPath(authAccounts)}`,
    `photo_primary_secret_access_key\t${shellPath(join(photoSecretRoot, 'photo.key'))}`,
    `keycloak_synthetic_photo_proof_account\t${shellPath(join(secretRoot, 'keycloak', 'photo-proof-account'))}`,
    `keycloak_database_username\t${shellPath(join(secretRoot, 'keycloak', 'database-username'))}`,
    `keycloak_bootstrap_username\t${shellPath(join(secretRoot, 'keycloak', 'bootstrap-username'))}`,
    `keycloak_bootstrap_password\t${shellPath(join(secretRoot, 'keycloak', 'bootstrap-password'))}`,
    `keycloak_smtp_auth_user\t${shellPath(join(secretRoot, 'keycloak', 'smtp-auth-user'))}`,
  ]
  executable(join(fakeBin, 'node'), [
    '#!/bin/sh',
    `printf '%s\\n' "$*" >> '${shellPath(nodeLog)}'`,
    '[ "$1" = "--version" ] && { echo v20.11.0; exit 0; }',
    `case "$*" in *verify*) case "$*" in *bbbbbbbbbbbb*) exit 9;; esac; [ -f '${shellPath(mode)}' ] && exit 9 || exit 0;; esac`,
    `case "$*" in *Object.keys*services*) exit 0;; esac`,
    `case "$*" in *Object.entries*secrets*) if [ -f '${shellPath(missingAccountsSecretMode)}' ]; then ${renderedSecrets.filter((line) => !line.startsWith('keycloak_synthetic_accounts\t')).map((line) => `printf '%s\\n' '${line}'`).join('; ')}; elif [ -f '${shellPath(wrongAccountsSecretTypeMode)}' ]; then ${renderedSecrets.filter((line) => !line.startsWith('keycloak_synthetic_accounts\t')).map((line) => `printf '%s\\n' '${line}'`).join('; ')}; printf '%s\\n' 'keycloak_synthetic_accounts'; else ${renderedSecrets.map((line) => `printf '%s\\n' '${line}'`).join('; ')}; fi; exit 0;; esac`,
    `case "$*" in *keycloak_synthetic_accounts*) if [ -f '${shellPath(missingAccountsSecretMode)}' ]; then ${renderedSecrets.filter((line) => !line.startsWith('keycloak_synthetic_accounts\t')).map((line) => `printf '%s\\n' '${line}'`).join('; ')}; elif [ -f '${shellPath(wrongAccountsSecretTypeMode)}' ]; then ${renderedSecrets.filter((line) => !line.startsWith('keycloak_synthetic_accounts\t')).map((line) => `printf '%s\\n' '${line}'`).join('; ')}; printf '%s\\n' 'keycloak_synthetic_accounts'; else ${renderedSecrets.map((line) => `printf '%s\\n' '${line}'`).join('; ')}; fi; exit 0;; esac`,
    'case "$*" in *JSON.parse*) cat >/dev/null; exit 0;; esac',
    `case "$1" in *onprem-keycloak-auth-proof.mjs) echo '{"dataClass":"synthetic","personas":{"count":5},"scopeAuthorization":{"crossScopeDenied":true,"deniedActionWriteDelta":0}}'; exit 0;; esac`,
    `[ "$1" = "-" ] && { cat >/dev/null; printf '%s\\n' '${records}'; }`,
  ].join('\n') + '\n')
  executable(join(fakeBin, 'uname'), '#!/bin/sh\necho Linux\n')
  executable(join(fakeBin, 'id'), '#!/bin/sh\n[ "$1" = "-u" ] && echo 0\n')
  executable(join(fakeBin, 'df'), '#!/bin/sh\ncase "$*" in *-Pi*) echo "Filesystem Inodes IUsed IFree IUse% Mounted"; echo "fake 1000000 1 999999 1% /";; *) echo "Filesystem 1024-blocks Used Available Capacity Mounted"; echo "fake 100000000 1 90000000 1% /";; esac\n')
  executable(join(fakeBin, 'free'), '#!/bin/sh\necho "              total        used        free      shared  buff/cache   available"; echo "Mem: 10000000000 1 9000000000 1 1 9000000000"\n')
  executable(join(fakeBin, 'nproc'), '#!/bin/sh\necho 8\n')
  executable(join(fakeBin, 'stat'), `#!/bin/sh
pathname=; for arg do pathname=$arg; done
${nativeLedgerStat ? `case "$pathname" in
  '${shellPath(ledgerParent)}'|'${shellPath(ledgerFile)}') exec /usr/bin/stat "$@";;
esac
` : ''}case "$*" in
  *%a*)
    [ -f '${shellPath(broadMode)}' ] && { echo 644; exit 0; }
    [ -f '${shellPath(legacyPhotoIdentityMode)}' ] && case "$pathname" in '${shellPath(join(photoSecretRoot, 'photo.key'))}') echo 400; exit 0;; esac
    case "$pathname" in
      *writable-receipt-grandparent*) exec /usr/bin/stat "$@";;
      '${shellPath(secretRoot)}'|'${shellPath(photoSecretRoot)}') echo 700;;
      '${shellPath(join(secretRoot, 'keycloak'))}') [ -f '${shellPath(unsafeSecretAncestorMode)}' ] && echo 777 || echo 700;;
      '${shellPath(inputRoot)}') [ -f '${shellPath(unsafeInputAncestorMode)}' ] && echo 777 || echo 600;;
      '${shellPath(join(secretRoot, 'caddy.crt'))}'|'${shellPath(join(secretRoot, 'caddy.ca'))}') echo 444;;
      '${shellPath(join(secretRoot, 'caddy.key'))}'|'${shellPath(join(secretRoot, 'keycloak', 'photo-proof-account'))}'|'${shellPath(join(secretRoot, 'keycloak', 'database-username'))}'|'${shellPath(join(secretRoot, 'keycloak', 'bootstrap-username'))}'|'${shellPath(join(secretRoot, 'keycloak', 'bootstrap-password'))}'|'${shellPath(join(secretRoot, 'keycloak', 'smtp-auth-user'))}'|'${shellPath(join(secretRoot, 'keycloak', 'synthetic-accounts'))}') echo 400;;
      '${shellPath(join(photoSecretRoot, 'photo.key'))}') echo 440;;
      *operations/*|*deployment/keycloak/bootstrap.sh*|*deployment/postgres/entrypoint-tls.sh*|*deployment/postgres/010-bootstrap-roles.sh*|*deployment/photo-storage/bootstrap.sh*) echo 755;;
      *) echo 600;;
    esac;;
  *%d:%i*) exec /usr/bin/stat "$@";;
  *%u*)
    [ -f '${shellPath(legacyPhotoIdentityMode)}' ] && case "$pathname" in '${shellPath(join(photoSecretRoot, 'photo.key'))}') echo 65532; exit 0;; esac
    [ -f '${shellPath(wrongSecretIdentityMode)}' ] && case "$pathname" in '${shellPath(join(secretRoot, 'caddy.ca'))}'|'${shellPath(authAccounts)}') echo 1; exit 0;; esac
    [ -f '${shellPath(nonRootMode)}' ] && { echo 1000; exit 0; }
    case "$pathname" in '${shellPath(join(secretRoot, 'caddy.key'))}') echo 10001;; '${shellPath(join(secretRoot, 'keycloak', 'photo-proof-account'))}'|'${shellPath(join(secretRoot, 'keycloak', 'database-username'))}'|'${shellPath(join(secretRoot, 'keycloak', 'bootstrap-username'))}'|'${shellPath(join(secretRoot, 'keycloak', 'bootstrap-password'))}'|'${shellPath(join(secretRoot, 'keycloak', 'smtp-auth-user'))}'|'${shellPath(authAccounts)}') echo 1000;; '${shellPath(join(photoSecretRoot, 'photo.key'))}') echo 0;; *) echo 0;; esac;;
  *%g*)
    [ -f '${shellPath(legacyPhotoIdentityMode)}' ] && case "$pathname" in '${shellPath(join(photoSecretRoot, 'photo.key'))}') echo 65532; exit 0;; esac
    [ -f '${shellPath(wrongSecretIdentityMode)}' ] && case "$pathname" in '${shellPath(join(secretRoot, 'caddy.ca'))}'|'${shellPath(authAccounts)}') echo 1; exit 0;; esac
    case "$pathname" in '${shellPath(join(secretRoot, 'caddy.key'))}') echo 10001;; '${shellPath(join(secretRoot, 'keycloak', 'photo-proof-account'))}'|'${shellPath(join(secretRoot, 'keycloak', 'database-username'))}'|'${shellPath(join(secretRoot, 'keycloak', 'bootstrap-username'))}'|'${shellPath(join(secretRoot, 'keycloak', 'bootstrap-password'))}'|'${shellPath(join(secretRoot, 'keycloak', 'smtp-auth-user'))}'|'${shellPath(authAccounts)}') echo 1000;; '${shellPath(join(photoSecretRoot, 'photo.key'))}') echo 65532;; *) echo 0;; esac;;
  *%h*) [ -f '${shellPath(hardlinkPath)}' ] && echo 2 || echo 1;;
  *%s*) [ -f '${shellPath(largeSecretMode)}' ] && echo 1048577 || echo 10;;
  *) exit 1;;
esac
`)
  executable(join(fakeBin, 'openssl'), `#!/bin/sh
case "$*" in *verify*) [ -f '${shellPath(wrongCaMode)}' ] && exit 9;; esac
case "$*" in *dgst*key.der*) [ -f '${shellPath(wrongKeyMode)}' ] && { echo 'SHA2-256= bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'; exit 0; };; esac
case "$*" in *dgst*) echo 'SHA2-256= aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; exit 0;; esac
case "$*" in *-pubkey*) printf '%s\\n' '-----BEGIN PUBLIC KEY-----' 'synthetic' '-----END PUBLIC KEY-----'; exit 0;; esac
case "$*" in *-outform*DER*) out=; previous=; for arg do if [ "$previous" = 1 ]; then out=$arg; previous=; elif [ "$arg" = -out ]; then previous=1; fi; done; [ -n "$out" ] && printf '%s\\n' der > "$out"; exit 0;; esac
exit 0
`)
  executable(join(fakeBin, 'docker'), [
    '#!/bin/sh', `printf '%s\\n' "$*" >> '${shellPath(log)}'`,
    'case "$1" in',
    'version) echo 27.0.0; exit 0;;',
    `image) echo IMAGE >> '${shellPath(log)}'; if [ -f '${shellPath(idMode)}' ]; then echo 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'; else echo "$5"; fi; exit 0;;`,
    `load) echo LOAD >> '${shellPath(log)}'; exit 0;;`,
    'ps) echo container-id; exit 0;;',
    'network) case "$2" in ls) echo network-id;; inspect) case "$*" in *Internal*) echo true;; *Labels*) echo "hr-axis-onprem-core|release-test|synthetic";; *) echo wrong-label-path;; esac;; esac; exit 0;;',
    'volume) case "$2" in ls) echo volume-id;; inspect) case "$*" in *Labels*) echo "hr-axis-onprem-core|release-test|synthetic";; *) echo wrong-label-path;; esac;; esac; exit 0;;',
    `inspect) case "$*" in *Config.Labels*Image*) if [ -f '${shellPath(runtimeImageMode)}' ]; then echo "keycloak|sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"; else echo "keycloak|sha256:${'b'.repeat(64)}"; fi;; *State.Health.Status*) echo "hr-axis-onprem-core|hr-axis-onprem-core|release-test|synthetic|healthy";; *json*) case "$2" in caddy-id) echo '{"HostConfig":{"HostPort":null,"PortBindings":{"443/tcp":[{"HostPort":"443"}]}},"NetworkSettings":{"Ports":{"443/tcp":[{"HostPort":"443"}]}}}';; *) echo '{"HostConfig":{},"NetworkSettings":{"Ports":{}}}';; esac;; *NetworkSettings.Networks*) echo data;; *NetworkSettings.Ports*) case "$2" in caddy-id) echo "{\\"443/tcp\\":[{\\"HostPort\\":\\"443\\"}]}";; *) echo "{}";; esac;; *Config.Labels*) echo "hr-axis-onprem-core|release-test|synthetic";; *) echo wrong-label-path;; esac; exit 0;;`,
    `exec) case "$2" in postgres-id) echo t;; redis-id) echo PONG;; esac; exit 0;;`,
    `compose) case "$*" in *version*) [ -f '${shellPath(composeVersionFile)}' ] && cat '${shellPath(composeVersionFile)}' || echo 2.30.0; exit 0;; *' ps -q caddy'*) echo caddy-id; exit 0;; *' ps -q frontend'*) echo frontend-id; exit 0;; *' ps -q api'*) echo api-id; exit 0;; *' ps -q worker'*) echo worker-id; exit 0;; *' ps -q postgres'*) echo postgres-id; exit 0;; *' ps -q redis'*) echo redis-id; exit 0;; *' ps -q keycloak'*) echo keycloak-id; exit 0;; *' ps -q object-storage'*) echo object-storage-id; exit 0;; *'config --format json'*) case "$*" in *'--profile *'*'config --format json'*) echo '{"name":"hr-axis-onprem-core","release":"release-test","services":{"object-storage":{}},"secrets":{"caddy_tls_certificate":{"file":"${shellPath(join(secretRoot, 'caddy.crt'))}"},"caddy_tls_private_key":{"file":"${shellPath(join(secretRoot, 'caddy.key'))}"},"caddy_tls_ca":{"file":"${shellPath(join(secretRoot, 'caddy.ca'))}"},"keycloak_synthetic_accounts":{"file":"${shellPath(authAccounts)}"},"photo_primary_secret_access_key":{"file":"${shellPath(join(photoSecretRoot, 'photo.key'))}"}}}';; *) echo '{"name":"hr-axis-onprem-core","services":{"object-storage":{}},"secrets":{"caddy_tls_certificate":{"file":"${shellPath(join(secretRoot, 'caddy.crt'))}"},"caddy_tls_private_key":{"file":"${shellPath(join(secretRoot, 'caddy.key'))}"},"caddy_tls_ca":{"file":"${shellPath(join(secretRoot, 'caddy.ca'))}"},"keycloak_synthetic_accounts":{"file":"${shellPath(authAccounts)}"},"photo_primary_secret_access_key":{"file":"${shellPath(join(photoSecretRoot, 'photo.key'))}"}}}';; esac; exit 0;; *'config --quiet'*) exit 0;; *'up --pull never'*|*'run --pull never'*) echo MUTATE >> '${shellPath(log)}'; echo '{"migrationTreeDigest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'; exit 0;; esac;;`,
    'esac', 'exit 0',
  ].join('\n') + '\n')
  return { root, bundle, fakeBin, log, nodeLog, mode, idMode, broadMode, wrongKeyMode, wrongCaMode, runtimeImageMode, nonRootMode, unsafeInputAncestorMode, unsafeSecretAncestorMode, largeSecretMode, wrongSecretIdentityMode, legacyPhotoIdentityMode, missingAccountsSecretMode, wrongAccountsSecretTypeMode, composeVersionFile, envFile, publicKey, secretRoot, photoSecretRoot, authAccounts, hardlinkPath, ledgerParent, ledgerFile, receiptDir }
}

const VALID_FINGERPRINT = 'a'.repeat(64)
const SMOKE_TIMEOUT_MS = process.platform === 'win32' ? 120_000 : 45_000

function runInstall(fixture, fingerprint = VALID_FINGERPRINT, bundleRoot = fixture.bundle) {
  return spawnSync(POSIX_SHELL, [shellPath(join(operationDir, 'install.sh')), '--bundle-root', shellPath(bundleRoot), '--release-id', 'release-test', '--target-project', 'hr-axis-onprem-core', '--public-key', shellPath(fixture.publicKey), '--trusted-fingerprint', fingerprint, '--env-file', shellPath(fixture.envFile)], {
    encoding: 'utf8', env: shellEnv(fixture),
  })
}
function runSmoke(fixture, receipt) {
  return spawnSync(POSIX_SHELL, [shellPath(join(operationDir, 'smoke.sh')), '--bundle-root', shellPath(fixture.bundle), '--release-id', 'release-test', '--target-project', 'hr-axis-onprem-core', '--public-key', shellPath(fixture.publicKey), '--trusted-fingerprint', VALID_FINGERPRINT, '--env-file', shellPath(fixture.envFile), '--receipt', shellPath(receipt)], {
    encoding: 'utf8', env: shellEnv(fixture), timeout: SMOKE_TIMEOUT_MS,
  })
}
function shellEnv(fixture) {
  const inherited = process.platform === 'win32' ? '/usr/bin:/bin' : process.env.PATH
  return { ...process.env, PATH: `${shellPath(fixture.fakeBin)}:${inherited}` }
}
function commandLog(fixture) {
  return existsSync(fixture.log) ? readFileSync(fixture.log, 'utf8') : ''
}
function nodeLog(fixture) {
  return existsSync(fixture.nodeLog) ? readFileSync(fixture.nodeLog, 'utf8') : ''
}
function regexLiteral(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function stubPreflight(fixture) {
  executable(join(fixture.bundle, 'operations', 'preflight.sh'), '#!/bin/sh\nexit 0\n')
}

test('smoke derives exact rendered secret sources and ignores legacy env aliases', (t) => {
  if (process.platform === 'win32' && !existsSync(POSIX_SHELL) || process.platform !== 'win32' && !existsSync('/bin/sh')) {
    t.skip('behavioral POSIX harness requires a shell')
    return
  }
  const fixture = makeFixture()
  const receipt = join(fixture.receiptDir, 'rendered-secrets.json')
  const aliasAccounts = join(fixture.root, 'legacy-accounts')
  const aliasCa = join(fixture.root, 'legacy-ca.crt')
  try {
    chmodSync(fixture.authAccounts, 0o600)
    for (const [pathname, value] of [
      [join(fixture.secretRoot, 'caddy.crt'), 'fixture-cert-value\n'],
      [join(fixture.secretRoot, 'caddy.key'), 'fixture-key-value\n'],
      [join(fixture.secretRoot, 'caddy.ca'), 'fixture-ca-value\n'],
      [fixture.authAccounts, 'fixture-accounts-value\n'],
      [join(fixture.secretRoot, 'keycloak', 'photo-proof-account'), 'fixture-photo-proof-value\n'],
      [join(fixture.secretRoot, 'keycloak', 'bootstrap-username'), 'fixture-bootstrap-user-value\n'],
      [join(fixture.secretRoot, 'keycloak', 'bootstrap-password'), 'fixture-bootstrap-password-value\n'],
      [join(fixture.secretRoot, 'keycloak', 'smtp-auth-user'), 'fixture-smtp-user-value\n'],
      [join(fixture.photoSecretRoot, 'photo.key'), 'fixture-photo-value\n'],
    ]) writeFileSync(pathname, value)
    chmodSync(fixture.authAccounts, 0o400)
    writeFileSync(aliasAccounts, 'legacy-accounts\n')
    writeFileSync(aliasCa, 'legacy-ca\n')
    writeFileSync(fixture.envFile, `${readFileSync(fixture.envFile, 'utf8')}KEYCLOAK_SYNTHETIC_ACCOUNTS_FILE=${shellPath(aliasAccounts)}\nTLS_CA_FILE=${shellPath(aliasCa)}\n`)
    const result = runSmoke(fixture, receipt)
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}\n${commandLog(fixture)}`)
    assert.match(result.stdout, /smoke: PASS/)
    assert.match(commandLog(fixture), /compose .*--profile \* .*config --format json/)
    assert.match(nodeLog(fixture), /onprem-keycloak-auth-proof\.mjs/)
    assert.match(nodeLog(fixture), new RegExp(`--accounts-file ${regexLiteral(shellPath(fixture.authAccounts))} --ca-file ${regexLiteral(shellPath(join(fixture.secretRoot, 'caddy.ca')))}`))
    assert.doesNotMatch(nodeLog(fixture), new RegExp(`${regexLiteral(aliasAccounts)}|${regexLiteral(aliasCa)}`), 'auth proof must not receive legacy alias paths')
    assert.match(readFileSync(receipt, 'utf8'), /"project":"hr-axis-onprem-core"/)

    stubPreflight(fixture)
    writeFileSync(join(fixture.secretRoot, 'caddy.key'), 'hr-axis-onprem-core\n')
    const rejectedReceipt = join(fixture.receiptDir, 'credential-collision.json')
    const rejected = runSmoke(fixture, rejectedReceipt)
    assert.notEqual(rejected.status, 0)
    assert.match(rejected.stderr, /runtime receipt contains an external secret value/)
    assert.equal(existsSync(rejectedReceipt), false)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test('smoke rejects unsafe rendered auth secret sources before auth or receipt publication', (t) => {
  if (process.platform !== 'linux' || process.getuid?.() !== 0) {
    t.skip('rendered secret ownership and pathname negatives require the Linux root proof')
    return
  }
  const cases = [
    ['missing rendered account source', 'missingAccountsSecretMode', /rendered auth secret must have exactly one string file source: keycloak_synthetic_accounts/],
    ['wrong rendered account source type', 'wrongAccountsSecretTypeMode', /rendered auth secret must have exactly one string file source: keycloak_synthetic_accounts/],
    ['unsafe rendered account ancestor', 'unsafeSecretAncestorMode', /rendered secret source: keycloak_synthetic_accounts ancestor is group\/world writable/],
    ['oversized rendered account source', 'largeSecretMode', /rendered secret source is too large: keycloak_synthetic_accounts/],
    ['wrong rendered account identity', 'wrongSecretIdentityMode', /rendered secret source identity is unsafe: keycloak_synthetic_accounts/],
  ]
  for (const [label, mode, errorPattern] of cases) {
    const fixture = makeFixture()
    const receipt = join(fixture.receiptDir, `${mode}.json`)
    try {
      stubPreflight(fixture)
      writeFileSync(fixture[mode], `${label}\n`)
      const result = runSmoke(fixture, receipt)
      assert.notEqual(result.status, 0, label)
      assert.match(result.stderr, errorPattern, label)
      assert.doesNotMatch(nodeLog(fixture), /onprem-keycloak-auth-proof\.mjs/, `${label}: auth proof must not run`)
      assert.equal(existsSync(receipt), false, `${label}: receipt must not publish`)
      assert.doesNotMatch(commandLog(fixture), /MUTATE/, `${label}: no mutation command may run`)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  }

  for (const [label, prepare, errorPattern] of [
    ['rendered account symlink', (fixture) => {
      const target = join(fixture.secretRoot, 'caddy.key')
      rmSync(fixture.authAccounts)
      symlinkSync(target, fixture.authAccounts)
    }, /rendered secret source is missing or symlinked: keycloak_synthetic_accounts/],
    ['rendered account hard link', (fixture) => {
      linkSync(fixture.authAccounts, fixture.hardlinkPath)
    }, /rendered secret source is a hard link: keycloak_synthetic_accounts/],
  ]) {
    const fixture = makeFixture()
    const receipt = join(fixture.receiptDir, `${label.replaceAll(' ', '-')}.json`)
    try {
      stubPreflight(fixture)
      prepare(fixture)
      const result = runSmoke(fixture, receipt)
      assert.notEqual(result.status, 0, label)
      assert.match(result.stderr, errorPattern, label)
      assert.doesNotMatch(nodeLog(fixture), /onprem-keycloak-auth-proof\.mjs/, `${label}: auth proof must not run`)
      assert.equal(existsSync(receipt), false, `${label}: receipt must not publish`)
      assert.doesNotMatch(commandLog(fixture), /MUTATE/, `${label}: no mutation command may run`)
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  }
})

test('preflight accepts native Linux root-private ledger parents with empty and child-containing directory link counts', (t) => {
  if (process.platform !== 'linux' || process.getuid?.() !== 0) {
    t.skip('native ledger directory link-count proof requires Linux root; run in the root Docker proof')
    return
  }
  const fixture = makeFixture({ ledger: true, nativeLedgerStat: true })
  try {
    assert.equal(statSync(fixture.ledgerParent).nlink, 2, 'an empty Linux directory has two links')
    let result = runInstall(fixture)
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}\n${commandLog(fixture)}`)

    mkdirSync(join(fixture.ledgerParent, 'child-directory'), { mode: 0o700 })
    assert.equal(statSync(fixture.ledgerParent).nlink, 3, 'a directory with one child directory has three links')
    rmSync(fixture.log, { force: true })
    result = runInstall(fixture)
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}\n${commandLog(fixture)}`)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test('ledger parent and regular-file guards fail closed before Docker load or Compose mutation', (t) => {
  if (process.platform !== 'linux' || process.getuid?.() !== 0) {
    t.skip('native ledger filesystem guard proof requires Linux root; run in the root Docker proof')
    return
  }
  const fixture = makeFixture({ ledger: true, nativeLedgerStat: true })
  const symlinkTarget = join(fixture.root, 'ledger-target')
  try {
    rmSync(fixture.ledgerParent, { recursive: true, force: true })
    mkdirSync(symlinkTarget, { mode: 0o700 })
    symlinkSync(symlinkTarget, fixture.ledgerParent)
    const symlinkParent = runInstall(fixture)
    assert.notEqual(symlinkParent.status, 0)
    assert.match(symlinkParent.stderr, /migration ledger parent is missing or symlinked/)
    assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
    rmSync(fixture.ledgerParent, { force: true })
    mkdirSync(fixture.ledgerParent, { mode: 0o700 })

    chmodSync(fixture.ledgerParent, 0o770)
    rmSync(fixture.log, { force: true })
    const unsafeMode = runInstall(fixture)
    assert.notEqual(unsafeMode.status, 0)
    assert.match(unsafeMode.stderr, /group\/world writable: migration ledger parent/)
    assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
    chmodSync(fixture.ledgerParent, 0o700)

    chownSync(fixture.ledgerParent, 1000, 1000)
    rmSync(fixture.log, { force: true })
    const nonRootParent = runInstall(fixture)
    assert.notEqual(nonRootParent.status, 0)
    assert.match(nonRootParent.stderr, /root-owned: migration ledger parent|migration ledger parent owner is unsafe/)
    assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
    chownSync(fixture.ledgerParent, 0, 0)

    writeFileSync(fixture.ledgerFile, 'synthetic-ledger\n', { mode: 0o600 })
    linkSync(fixture.ledgerFile, join(fixture.ledgerParent, 'ledger-hardlink'))
    rmSync(fixture.log, { force: true })
    const hardLinkedLedger = runInstall(fixture)
    assert.notEqual(hardLinkedLedger.status, 0)
    assert.match(hardLinkedLedger.stderr, /migration ledger is a hard link/)
    assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test('fake commands prove verification failure causes zero Docker mutation and imports precede Compose', (t) => {
  if (process.platform === 'win32' && !existsSync(POSIX_SHELL) || process.platform !== 'win32' && !existsSync('/bin/sh')) {
    t.skip('behavioral POSIX harness runs on Linux only')
    return
  }
  const fixture = makeFixture()
  try {
    writeFileSync(fixture.mode, 'fail-verifier\n')
    const failed = runInstall(fixture)
    assert.notEqual(failed.status, 0)
    assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
    rmSync(fixture.mode, { force: true })
    rmSync(fixture.log, { force: true })
    writeFileSync(fixture.nonRootMode, 'non-root-owner\n')
    const nonRootOwner = runInstall(fixture)
    assert.notEqual(nonRootOwner.status, 0)
    assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
    rmSync(fixture.nonRootMode, { force: true })

    rmSync(fixture.log, { force: true })
    writeFileSync(fixture.unsafeInputAncestorMode, 'unsafe-input-ancestor\n')
    const unsafeInputAncestor = runInstall(fixture)
    assert.notEqual(unsafeInputAncestor.status, 0)
    assert.match(unsafeInputAncestor.stderr, /external input ancestor is group\/world writable/)
    assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
    rmSync(fixture.unsafeInputAncestorMode, { force: true })

    rmSync(fixture.log, { force: true })
    const symlinkAncestor = join(fixture.root, 'delivery-link')
    try {
      symlinkSync(fixture.root, symlinkAncestor, process.platform === 'win32' ? 'junction' : 'dir')
      const symlinkedBundle = runInstall(fixture, VALID_FINGERPRINT, join(symlinkAncestor, 'bundle'))
      assert.notEqual(symlinkedBundle.status, 0)
      assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
    } catch (error) {
      if (error?.code !== 'EPERM' && error?.code !== 'EACCES') throw error
    } finally {
      rmSync(symlinkAncestor, { recursive: true, force: true })
    }

    const missingFingerprint = spawnSync(POSIX_SHELL, [shellPath(join(operationDir, 'install.sh')), '--bundle-root', shellPath(fixture.bundle), '--release-id', 'release-test', '--target-project', 'hr-axis-onprem-core', '--public-key', shellPath(fixture.publicKey), '--env-file', shellPath(fixture.envFile)], {
      encoding: 'utf8', env: shellEnv(fixture),
    })
    assert.notEqual(missingFingerprint.status, 0)
    assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
    const approvedEnv = readFileSync(fixture.envFile, 'utf8')
    writeFileSync(fixture.envFile, approvedEnv.replace(/HR_AXIS_BACKEND_IMAGE=sha256:[0-9a-f]{64}/, `HR_AXIS_BACKEND_IMAGE=sha256:${'b'.repeat(64)}`))
    const imageEnvMismatch = runInstall(fixture)
    assert.notEqual(imageEnvMismatch.status, 0)
    assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
    writeFileSync(fixture.envFile, approvedEnv)
    const wrongFingerprint = runInstall(fixture, 'b'.repeat(64))
    assert.notEqual(wrongFingerprint.status, 0)
    assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
    rmSync(fixture.log, { force: true })
    writeFileSync(fixture.wrongKeyMode, 'wrong-key\n')
    const wrongKey = runInstall(fixture)
    assert.notEqual(wrongKey.status, 0)
    assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
    rmSync(fixture.wrongKeyMode, { force: true })
    rmSync(fixture.log, { force: true })
    writeFileSync(fixture.wrongCaMode, 'wrong-ca\n')
    const wrongCa = runInstall(fixture)
    assert.notEqual(wrongCa.status, 0)
    assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
    rmSync(fixture.wrongCaMode, { force: true })
    rmSync(fixture.log, { force: true })
    writeFileSync(fixture.runtimeImageMode, 'runtime-image-mismatch\n')
    const runtimeMismatch = runInstall(fixture)
    assert.notEqual(runtimeMismatch.status, 0)
    assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
    rmSync(fixture.runtimeImageMode, { force: true })
    writeFileSync(fixture.idMode, 'id-mismatch\n')
    const mismatch = runInstall(fixture)
    assert.notEqual(mismatch.status, 0)
    assert.doesNotMatch(commandLog(fixture), /MUTATE/)
    rmSync(fixture.idMode, { force: true })
    rmSync(fixture.log, { force: true })
    const passed = runInstall(fixture)
    assert.equal(passed.status, 0, `${passed.stdout}\n${passed.stderr}\n${commandLog(fixture)}`)
    assert.match(readFileSync(fixture.nodeLog, 'utf8'), new RegExp(`--trusted-fingerprint ${VALID_FINGERPRINT}`), 'trusted fingerprint reaches bundled verifier')
    const lines = commandLog(fixture).split(/\r?\n/).filter(Boolean)
    assert.match(commandLog(fixture), /inspect container-id .*Config\.Labels/, 'container labels are read from Config.Labels')
    assert.match(commandLog(fixture), /network inspect network-id .*\.Labels/, 'network labels are read from Labels')
    assert.match(commandLog(fixture), /volume inspect volume-id .*\.Labels/, 'volume labels are read from Labels')
    assert.match(commandLog(fixture), /compose .*up --pull never/, 'Compose up refuses pulls')
    assert.doesNotMatch(commandLog(fixture), /compose .*run --pull never/, 'install does not run migration or bootstrap')
    assert.equal(lines.filter((line) => line === 'LOAD').length, 7)
    const firstMutation = lines.indexOf('MUTATE')
    const loadIndexes = lines.map((line, index) => line === 'LOAD' ? index : -1).filter((index) => index >= 0)
    assert.ok(firstMutation > loadIndexes.at(-1), 'Compose mutation follows all image loads')
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test('Compose 2.24.4 is the minimum accepted version for !override overlays', (t) => {
  if (process.platform === 'win32' && !existsSync(POSIX_SHELL) || process.platform !== 'win32' && !existsSync('/bin/sh')) {
    t.skip('behavioral POSIX harness runs on Linux only')
    return
  }
  const fixture = makeFixture()
  try {
    writeFileSync(fixture.composeVersionFile, '2.24.3\n')
    const rejected = runInstall(fixture)
    assert.notEqual(rejected.status, 0)
    assert.match(rejected.stderr, /Docker Compose plugin 2\.24\.4 or newer is required/)
    assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
    writeFileSync(fixture.composeVersionFile, '2.24.4\n')
    rmSync(fixture.log, { force: true })
    const accepted = runInstall(fixture)
    assert.equal(accepted.status, 0, `${accepted.stdout}\n${accepted.stderr}\n${commandLog(fixture)}`)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test('smoke refuses an existing receipt without changing its bytes', (t) => {
  if (process.platform === 'win32' && !existsSync(POSIX_SHELL) || process.platform !== 'win32' && !existsSync('/bin/sh')) return t.skip('behavioral POSIX harness requires a shell')
  const fixture = makeFixture()
  const receipt = join(fixture.receiptDir, 'existing.json')
  try {
    writeFileSync(receipt, 'owner-evidence\n', { mode: 0o600 })
    const result = runSmoke(fixture, receipt)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /receipt destination must be absent/i)
    assert.equal(readFileSync(receipt, 'utf8'), 'owner-evidence\n')
    assert.equal(commandLog(fixture), '')
  } finally { rmSync(fixture.root, { recursive: true, force: true }) }
})

test('smoke rejects a writable receipt ancestor before Docker inspection', (t) => {
  if (process.platform === 'win32') return t.skip('Linux filesystem ownership/mode enforcement requires POSIX shell')
  const fixture = makeFixture()
  const writableGrandparent = join(fixture.root, 'writable-receipt-grandparent')
  const protectedParent = join(writableGrandparent, 'receipts')
  try {
    mkdirSync(protectedParent, { recursive: true, mode: 0o700 })
    chmodSync(protectedParent, 0o700)
    chmodSync(writableGrandparent, 0o777)
    const result = runSmoke(fixture, join(protectedParent, 'smoke.json'))
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /receipt parent.*group\/world writable/i)
    assert.equal(commandLog(fixture), '')
  } finally { rmSync(fixture.root, { recursive: true, force: true }) }
})

test('rendered secret source failures stay before Docker load or Compose mutation', (t) => {
  if (process.platform === 'win32' && !existsSync(POSIX_SHELL) || process.platform !== 'win32' && !existsSync('/bin/sh')) {
    t.skip('behavioral POSIX harness runs on Linux only')
    return
  }
  const fixture = makeFixture()
  const certificate = join(fixture.secretRoot, 'caddy.crt')
  const restoreCertificate = () => writeFileSync(certificate, 'canary-caddy-certificate-v1\n')
  try {
    rmSync(certificate)
    let result = runInstall(fixture)
    assert.notEqual(result.status, 0)
    assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
    restoreCertificate()

    rmSync(fixture.log, { force: true })
    writeFileSync(fixture.legacyPhotoIdentityMode, 'legacy-photo-identity\n')
    result = runInstall(fixture)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /rendered secret source identity is unsafe: photo_primary_secret_access_key/)
    assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
    rmSync(fixture.legacyPhotoIdentityMode, { force: true })

    rmSync(fixture.log, { force: true })
    writeFileSync(fixture.broadMode, 'broad\n')
    result = runInstall(fixture)
    assert.notEqual(result.status, 0)
    assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
    rmSync(fixture.broadMode, { force: true })

    rmSync(fixture.log, { force: true })
    rmSync(certificate)
    try {
      symlinkSync(join(fixture.secretRoot, 'caddy.key'), certificate)
      result = runInstall(fixture)
      assert.notEqual(result.status, 0)
      assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
    } catch (error) {
      if (error?.code !== 'EPERM' && error?.code !== 'EACCES') throw error
    } finally {
      rmSync(certificate, { force: true })
      restoreCertificate()
    }

    rmSync(fixture.log, { force: true })
    const hardlink = join(fixture.photoSecretRoot, 'photo-hardlink')
    linkSync(join(fixture.photoSecretRoot, 'photo.key'), hardlink)
    result = runInstall(fixture)
    assert.notEqual(result.status, 0)
    assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
    rmSync(hardlink, { force: true })
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test('preflight exempts only the fixed Keycloak database role identity from rendered secret leak checks', (t) => {
  if (process.platform === 'win32' && !existsSync(POSIX_SHELL) || process.platform !== 'win32' && !existsSync('/bin/sh')) {
    t.skip('behavioral POSIX harness runs on Linux only')
    return
  }
  const fixture = makeFixture()
  try {
    let result = runInstall(fixture)
    assert.equal(result.status, 0, result.stderr)

    rmSync(fixture.log, { force: true })
    writeFileSync(join(fixture.secretRoot, 'caddy.key'), 'hr-axis-onprem-core\n')
    result = runInstall(fixture)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Compose config contains a rendered secret value: caddy_tls_private_key/)
    assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)

    writeFileSync(join(fixture.secretRoot, 'caddy.key'), 'canary-caddy-private-key-v1\n')
    for (const [relativePath, secretName, original] of [
      ['keycloak/bootstrap-username', 'keycloak_bootstrap_username', 'canary-keycloak-bootstrap-user-v1\n'],
      ['keycloak/bootstrap-password', 'keycloak_bootstrap_password', 'canary-keycloak-bootstrap-password-v1\n'],
      ['keycloak/smtp-auth-user', 'keycloak_smtp_auth_user', 'canary-keycloak-smtp-user-v1\n'],
    ]) {
      rmSync(fixture.log, { force: true })
      const pathname = join(fixture.secretRoot, ...relativePath.split('/'))
      writeFileSync(pathname, 'hr-axis-onprem-core\n')
      result = runInstall(fixture)
      assert.notEqual(result.status, 0)
      assert.match(result.stderr, new RegExp(`Compose config contains a rendered secret value: ${secretName}`))
      assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
      writeFileSync(pathname, original)
    }

    rmSync(fixture.log, { force: true })
    const databaseUsername = join(fixture.secretRoot, 'keycloak', 'database-username')
    rmSync(databaseUsername)
    try {
      symlinkSync(join(fixture.secretRoot, 'caddy.key'), databaseUsername)
      result = runInstall(fixture)
      assert.notEqual(result.status, 0)
      assert.match(result.stderr, /rendered secret source is missing or symlinked: keycloak_database_username/)
      assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
    } catch (error) {
      if (error?.code !== 'EPERM' && error?.code !== 'EACCES') throw error
    }
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})
