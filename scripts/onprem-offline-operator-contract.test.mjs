import assert from 'node:assert/strict'
import { chmodSync, existsSync, linkSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, readFileSync } from 'node:fs'
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

  const activate = source['activate.sh']
  assert.match(activate, /migration-compatibility\.json/)
  assert.match(activate, /SIGNED_DIGEST/)
  assert.match(activate, /migration-status\.js/)
  assert.match(activate, /read-only migration status|clean target migration status/)
  assert.doesNotMatch(activate, /MIGRATION_LEDGER_FILE.*required|migration ledger is incompatible/i)
  assert.match(activate, /keycloak-bootstrap[\s\S]*identity-binder[\s\S]*synthetic-seed/)
  assert.match(activate, /up --pull never/)

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
  assert.match(smoke, /KEYCLOAK_SYNTHETIC_ACCOUNTS_FILE/)
  assert.match(smoke, /runtime-receipt|mktemp/)
  const preflightSource = source['preflight.sh']
  for (const variable of ['HR_AXIS_BACKEND_IMAGE', 'HR_AXIS_FRONTEND_IMAGE', 'KEYCLOAK_IMAGE', 'CADDY_IMAGE', 'POSTGRES_IMAGE', 'REDIS_IMAGE', 'SEAWEEDFS_IMAGE']) {
    assert.match(preflightSource, new RegExp(variable), `preflight maps ${variable}`)
  }
  assert.match(preflightSource, /approved env image identity mismatch/)
  assert.match(preflightSource, /HR_AXIS_PROJECT_ID/)
  assert.match(preflightSource, /merged Compose labels are missing or mismatched/)
  assert.match(preflightSource, /com\.hr-axis\.project/)
  assert.match(preflightSource, /com\.hr-axis\.release-id/)
  assert.match(preflightSource, /configImageId/)
  assert.match(preflightSource, /repoTag/)
  assert.match(preflightSource, /migration ledger parent/)
  assert.match(preflightSource, /docker inspect/)
  assert.match(preflightSource, /Config\.Labels/)
  assert.match(preflightSource, /docker network inspect/)
  assert.match(preflightSource, /docker volume inspect/)
  assert.match(preflightSource, /\.Labels/)
  assert.match(preflightSource, /HR_AXIS_SECRET_ROOT/)
  assert.match(preflightSource, /mode must be 0700/)
  assert.match(preflightSource, /rendered_secret_identity/)
  assert.match(preflightSource, /file_gid/)
  for (const identity of ['10001:10001:400', '70:70:400', '1000:1000:400', '999:1000:400', '65532:65532:400', '0:0:444']) assert.match(preflightSource, new RegExp(identity.replaceAll(':', '\\:')))
  assert.match(preflightSource, /rendered secret source identity is unsafe/)
  assert.match(preflightSource, /PHOTO_STORAGE_SECRET_ROOT/)
  assert.match(preflightSource, /file_links|hard link/)
  assert.match(preflightSource, /SECRET_LINES/)
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

function makeFixture() {
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
  const composeVersionFile = join(root, 'compose-version')
  const inputRoot = join(root, 'operator-inputs')
  const envFile = join(inputRoot, 'approved.env')
  const publicKey = join(inputRoot, 'trusted.pub')
  const tlsDir = join(root, 'tls')
  const receiptDir = join(root, 'receipts')
  const authAccounts = join(root, 'synthetic-accounts')
  const secretRoot = join(inputRoot, 'hr-axis-secrets')
  const photoSecretRoot = join(inputRoot, 'photo-secrets')
  const hardlinkPath = join(photoSecretRoot, 'photo-hardlink')
  for (const directory of [operations, deployment, fakeBin, tlsDir, inputRoot, secretRoot, photoSecretRoot, receiptDir, join(bundle, 'images')]) mkdirSync(directory, { recursive: true })
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
  for (const pathname of [join(secretRoot, 'caddy.crt'), join(secretRoot, 'caddy.key'), join(secretRoot, 'caddy.ca'), join(secretRoot, 'keycloak', 'photo-proof-account'), join(photoSecretRoot, 'photo.key')]) writeFileSync(pathname, 'synthetic\n')
  writeFileSync(authAccounts, 'synthetic-accounts\n')
  const imageDigests = { backend: 'a'.repeat(64), frontend: 'a'.repeat(64), keycloak: 'b'.repeat(64), caddy: 'a'.repeat(64), postgres: 'a'.repeat(64), redis: 'a'.repeat(64), seaweedfs: 'a'.repeat(64) }
  const imageVariables = { backend: 'HR_AXIS_BACKEND_IMAGE', frontend: 'HR_AXIS_FRONTEND_IMAGE', keycloak: 'KEYCLOAK_IMAGE', caddy: 'CADDY_IMAGE', postgres: 'POSTGRES_IMAGE', redis: 'REDIS_IMAGE', seaweedfs: 'SEAWEEDFS_IMAGE' }
  writeFileSync(envFile, [
    'COMPOSE_PROJECT_NAME=hr-axis-onprem-core', 'HR_AXIS_RELEASE_ID=release-test', 'HR_AXIS_PUBLIC_HOST=onprem.example.invalid',
    `HR_AXIS_SECRET_ROOT=${shellPath(secretRoot)}`, `PHOTO_STORAGE_SECRET_ROOT=${shellPath(photoSecretRoot)}`, 'HR_AXIS_PROJECT_ID=hr-axis-onprem-core',
    `TLS_CERT_FILE=${shellPath(join(tlsDir, 'server.crt'))}`, `TLS_KEY_FILE=${shellPath(join(tlsDir, 'server.key'))}`, `TLS_CA_FILE=${shellPath(join(tlsDir, 'ca.crt'))}`,
    `KEYCLOAK_SYNTHETIC_ACCOUNTS_FILE=${shellPath(authAccounts)}`,
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
    `photo_primary_secret_access_key\t${shellPath(join(photoSecretRoot, 'photo.key'))}`,
    `keycloak_synthetic_photo_proof_account\t${shellPath(join(secretRoot, 'keycloak', 'photo-proof-account'))}`,
  ]
  executable(join(fakeBin, 'node'), [
    '#!/bin/sh',
    `printf '%s\\n' "$*" >> '${shellPath(nodeLog)}'`,
    '[ "$1" = "--version" ] && { echo v20.11.0; exit 0; }',
    `case "$*" in *verify*) case "$*" in *bbbbbbbbbbbb*) exit 9;; esac; [ -f '${shellPath(mode)}' ] && exit 9 || exit 0;; esac`,
    `case "$*" in *Object.keys*services*) exit 0;; esac`,
    `case "$*" in *Object.entries*secrets*) ${renderedSecrets.map((line) => `printf '%s\\n' '${line}'`).join('; ')}; exit 0;; esac`,
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
case "$*" in
  *%a*)
    [ -f '${shellPath(broadMode)}' ] && { echo 644; exit 0; }
    case "$pathname" in
      *writable-receipt-grandparent*) exec /usr/bin/stat "$@";;
      '${shellPath(secretRoot)}'|'${shellPath(photoSecretRoot)}') echo 700;;
      '${shellPath(inputRoot)}') [ -f '${shellPath(unsafeInputAncestorMode)}' ] && echo 777 || echo 600;;
      '${shellPath(join(secretRoot, 'caddy.crt'))}'|'${shellPath(join(secretRoot, 'caddy.ca'))}') echo 444;;
      '${shellPath(join(secretRoot, 'caddy.key'))}'|'${shellPath(join(secretRoot, 'keycloak', 'photo-proof-account'))}'|'${shellPath(join(photoSecretRoot, 'photo.key'))}') echo 400;;
      *operations/*|*deployment/keycloak/bootstrap.sh*|*deployment/postgres/entrypoint-tls.sh*|*deployment/postgres/010-bootstrap-roles.sh*|*deployment/photo-storage/bootstrap.sh*) echo 755;;
      *) echo 600;;
    esac;;
  *%d:%i*) exec /usr/bin/stat "$@";;
  *%u*)
    [ -f '${shellPath(nonRootMode)}' ] && { echo 1000; exit 0; }
    case "$pathname" in '${shellPath(join(secretRoot, 'caddy.key'))}') echo 10001;; '${shellPath(join(secretRoot, 'keycloak', 'photo-proof-account'))}') echo 1000;; '${shellPath(join(photoSecretRoot, 'photo.key'))}') echo 65532;; *) echo 0;; esac;;
  *%g*) case "$pathname" in '${shellPath(join(secretRoot, 'caddy.key'))}') echo 10001;; '${shellPath(join(secretRoot, 'keycloak', 'photo-proof-account'))}') echo 1000;; '${shellPath(join(photoSecretRoot, 'photo.key'))}') echo 65532;; *) echo 0;; esac;;
  *%h*) [ -f '${shellPath(hardlinkPath)}' ] && echo 2 || echo 1;;
  *%s*) echo 10;;
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
    `inspect) case "$*" in *Config.Labels*Image*) if [ -f '${shellPath(runtimeImageMode)}' ]; then echo "keycloak|sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"; else echo "keycloak|sha256:${'b'.repeat(64)}"; fi;; *State.Health.Status*) echo "hr-axis-onprem-core|hr-axis-onprem-core|release-test|synthetic|healthy";; *NetworkSettings.Networks*) echo data;; *NetworkSettings.Ports*) case "$2" in caddy-id) echo "{\\"443/tcp\\":[{\\"HostPort\\":\\"443\\"}]}";; *) echo "{}";; esac;; *Config.Labels*) echo "hr-axis-onprem-core|release-test|synthetic";; *) echo wrong-label-path;; esac; exit 0;;`,
    `exec) case "$2" in postgres-id) echo t;; redis-id) echo PONG;; esac; exit 0;;`,
    `compose) case "$*" in *version*) [ -f '${shellPath(composeVersionFile)}' ] && cat '${shellPath(composeVersionFile)}' || echo 2.30.0; exit 0;; *' ps -q caddy'*) echo caddy-id; exit 0;; *' ps -q frontend'*) echo frontend-id; exit 0;; *' ps -q api'*) echo api-id; exit 0;; *' ps -q worker'*) echo worker-id; exit 0;; *' ps -q postgres'*) echo postgres-id; exit 0;; *' ps -q redis'*) echo redis-id; exit 0;; *' ps -q keycloak'*) echo keycloak-id; exit 0;; *' ps -q object-storage'*) echo object-storage-id; exit 0;; *'config --format json'*) echo '{"name":"hr-axis-onprem-core","release":"release-test","services":{"object-storage":{}},"secrets":{"caddy_tls_certificate":{"file":"${shellPath(join(secretRoot, 'caddy.crt'))}"},"caddy_tls_private_key":{"file":"${shellPath(join(secretRoot, 'caddy.key'))}"},"caddy_tls_ca":{"file":"${shellPath(join(secretRoot, 'caddy.ca'))}"},"photo_primary_secret_access_key":{"file":"${shellPath(join(photoSecretRoot, 'photo.key'))}"}}}'; exit 0;; *'config --quiet'*) exit 0;; *'up --pull never'*|*'run --pull never'*) echo MUTATE >> '${shellPath(log)}'; echo '{"migrationTreeDigest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'; exit 0;; esac;;`,
    'esac', 'exit 0',
  ].join('\n') + '\n')
  return { root, bundle, fakeBin, log, nodeLog, mode, idMode, broadMode, wrongKeyMode, wrongCaMode, runtimeImageMode, nonRootMode, unsafeInputAncestorMode, composeVersionFile, envFile, publicKey, secretRoot, photoSecretRoot, receiptDir }
}

const VALID_FINGERPRINT = 'a'.repeat(64)

function runInstall(fixture, fingerprint = VALID_FINGERPRINT, bundleRoot = fixture.bundle) {
  return spawnSync(POSIX_SHELL, [shellPath(join(operationDir, 'install.sh')), '--bundle-root', shellPath(bundleRoot), '--release-id', 'release-test', '--target-project', 'hr-axis-onprem-core', '--public-key', shellPath(fixture.publicKey), '--trusted-fingerprint', fingerprint, '--env-file', shellPath(fixture.envFile)], {
    encoding: 'utf8', env: shellEnv(fixture),
  })
}
function runSmoke(fixture, receipt) {
  return spawnSync(POSIX_SHELL, [shellPath(join(operationDir, 'smoke.sh')), '--bundle-root', shellPath(fixture.bundle), '--release-id', 'release-test', '--target-project', 'hr-axis-onprem-core', '--public-key', shellPath(fixture.publicKey), '--trusted-fingerprint', VALID_FINGERPRINT, '--env-file', shellPath(fixture.envFile), '--receipt', shellPath(receipt)], {
    encoding: 'utf8', env: shellEnv(fixture),
  })
}
function shellEnv(fixture) {
  const inherited = process.platform === 'win32' ? '/usr/bin:/bin' : process.env.PATH
  return { ...process.env, PATH: `${shellPath(fixture.fakeBin)}:${inherited}` }
}
function commandLog(fixture) {
  return existsSync(fixture.log) ? readFileSync(fixture.log, 'utf8') : ''
}

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
  const restoreCertificate = () => writeFileSync(certificate, 'synthetic\n')
  try {
    rmSync(certificate)
    let result = runInstall(fixture)
    assert.notEqual(result.status, 0)
    assert.doesNotMatch(commandLog(fixture), /LOAD|MUTATE/)
    restoreCertificate()

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
