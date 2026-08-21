import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, truncateSync, writeFileSync } from 'node:fs'
import { createHash, generateKeyPairSync } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const operationDir = join(repo, 'infra', 'onprem', 'offline', 'operations')
const recoveryScripts = ['backup.sh', 'restore.sh', 'upgrade.sh', 'rollback.sh']
const shell = process.platform === 'win32' ? 'C:\\Program Files\\Git\\usr\\bin\\sh.exe' : 'sh'
const cygpath = process.platform === 'win32' ? 'C:\\Program Files\\Git\\usr\\bin\\cygpath.exe' : null
const cannotCreateRootPrivateFixture = process.platform !== 'win32' && process.getuid?.() !== 0

function shellPath(pathname) {
  if (!cygpath) return pathname
  const result = spawnSync(cygpath, ['-u', pathname], { encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : pathname
}

function executable(pathname, content) {
  writeFileSync(pathname, content)
  chmodSync(pathname, 0o755)
}

function sources() {
  return Object.fromEntries(recoveryScripts.map((name) => [name, readFileSync(join(operationDir, name), 'utf8')]))
}

test('ONP-5 operators encode the signed synthetic rehearsal boundaries', () => {
  const source = sources()
  for (const name of recoveryScripts) {
    const text = source[name]
    assert.match(text, /^#!\/bin\/sh\nset -eu/m, name)
    for (const option of ['--bundle-root', '--release-id', '--target-project', '--public-key', '--trusted-fingerprint', '--env-file']) {
      assert.match(text, new RegExp(option.replace('-', '\\-')), `${name} requires ${option}`)
    }
    assert.match(text, /--proof-compose/, `${name} exposes the optional proof Compose overlay`)
    assert.match(text, /node .*verify.*bundle|verify --bundle-dir/i, `${name} verifies signed material`)
    assert.match(text, /synthetic|dataClass/, `${name} remains synthetic-only`)
    assert.doesNotMatch(text, /\bcurl\s+https?:\/\/|docker\s+(?:pull|build)|\bgit\s+(?:clone|pull|checkout)|\bnpm(?:\.cmd)?\s+(?:install|run|exec)|docker\s+compose[^\n]*down\s+-v|\bprune\b/i)
    assert.doesNotMatch(text, /postgres\.tar|--compatibility-file|--backup-receipt|install\.sh|smoke\.sh/)
  }
  const backup = source['backup.sh']
  for (const name of recoveryScripts) assert.match(source[name], /--photo-recovery-handle-file/, `${name} requires the photo recovery handle`)
  assert.match(backup, /--backup-private-key/)
  assert.match(backup, /--backup-trusted-fingerprint/)
  assert.match(backup, /backup-signature\.json/)
  assert.match(backup, /api worker keycloak redis|object-storage/)
  assert.match(backup, /pg_dump[\s\S]*hr_axis[\s\S]*pg_dump[\s\S]*keycloak/)
  assert.match(backup, /redis-aof|keycloak-bootstrap-state|photo-object-storage/)
  assert.match(backup, /SHA256SUMS|inventorySha/)
  assert.match(backup, /mv .*TEMP_DIR|atomic|final rename/i)
  assert.match(backup, /backup parent.*root-owned|root-owned.*backup parent/i)
  assert.match(backup, /backup parent.*group\/world writable|!022|mode_has_group_or_world_write/i)
  assert.match(backup, /pwd -P|realpath|canonical/i)
  assert.match(backup, /nlink|hard.?link/i)
  assert.match(backup, /revalidat|identity.*backup parent|backup parent.*identity/i)
  assert.match(backup, /photoRecoveryHandleSha256/)
  assert.match(backup, /photoContentSha256/)
  assert.match(backup, /photoContentLength/)
  const quiesce = backup.indexOf('compose_core stop api worker keycloak redis')
  const parentTrust = backup.indexOf('revalidate_backup_parent\n\nTEMP_DIR=')
  assert.ok(parentTrust >= 0 && parentTrust < quiesce, 'backup parent trust must precede writer quiesce')

  const restore = source['restore.sh']
  for (const name of ['OFFLINE_RESTORE_POSTGRES_VOLUME', 'OFFLINE_RESTORE_REDIS_VOLUME', 'OFFLINE_RESTORE_KEYCLOAK_VOLUME', 'OFFLINE_RESTORE_KEYCLOAK_BOOTSTRAP_VOLUME', 'OFFLINE_RESTORE_PHOTO_VOLUME']) {
    assert.match(restore, new RegExp(`${name}=\\$V_`), `restore env must bind ${name} to the target project volume`)
  }
  assert.match(restore, /awk -F= '[^']*OFFLINE_RESTORE_REDIS_VOLUME[^']*OFFLINE_RESTORE_PHOTO_VOLUME/)
  assert.match(source['backup.sh'], /docker run --pull=never --rm --network none --volume/)
  assert.match(restore, /docker run --pull=never --rm --network none --volume "\$name:\/target"/)
  assert.match(restore, /sha256sum "\$BACKUP_DIR\/volumes\/\$class_name\.tar"/)
  assert.match(restore, /BACKUP_SOURCE_DIR=\$BACKUP_DIR/)
  assert.match(restore, /SEALED_BACKUP_DIR=\$\(node - "\$BACKUP_SOURCE_DIR" "\$RECEIPT_PARENT"/)
  assert.match(restore, /O_NOFOLLOW/)
  assert.match(restore, /Buffer\.allocUnsafe\(1024 \* 1024\)/)
  assert.match(restore, /\['backup-manifest\.json','backup-signature\.json','SHA256SUMS'\]\.includes\(rel\).*opened\.size>1024\*1024/)
  assert.match(restore, /fs\.readSync\(fd,\s*buffer/)
  assert.doesNotMatch(restore, /fs\.readFileSync\(fd\)/)
  assert.match(restore, /const stableHash = \(pathname\) =>/)
  assert.match(restore, /actual\.length!==files\.length/)
  assert.match(restore, /BACKUP_DIR=\$SEALED_BACKUP_DIR/)
  assert.match(restore, /capture_sealed_backup/)
  assert.match(restore, /revalidate_sealed_backup/)
  assert.match(restore, /sha256sum -c SHA256SUMS[\s\S]*MUTATION_STARTED=1/)
  assert.match(restore, /rm -rf -- "\$SEALED_BACKUP_DIR"/)
  assert.match(restore, /revalidate_sealed_backup[\s\S]*rm -rf -- "\$SEALED_BACKUP_DIR"[\s\S]*sealed backup remained after cleanup[\s\S]*SEALED_BACKUP_DIR=[\s\S]*trap - EXIT/)
  for (const name of ['restore.sh', 'upgrade.sh', 'rollback.sh']) {
    assert.match(source[name], /--photo-fixture/)
    assert.match(source[name], /--photo-sha256/)
    assert.match(source[name], /targetProofReceiptSha256/)
    assert.match(source[name], /authReceiptSha256/)
    assert.match(source[name], /require_trusted_directory_tree/)
    assert.match(source[name], /PHOTO_RECOVERY_HANDLE_CANONICAL/)
    assert.match(source[name], /PHOTO_RECOVERY_HANDLE_IDENTITY/)
    assert.match(source[name], /PHOTO_RECOVERY_HANDLE_UID/)
    assert.match(source[name], /PHOTO_RECOVERY_HANDLE_MODE/)
    assert.match(source[name], /PHOTO_RECOVERY_HANDLE_NLINK/)
    assert.match(source[name], /revalidate_recovery_handle/)
    assert.match(source[name], /capture_receipt_parent/)
    assert.match(source[name], /revalidate_receipt_parent/)
  }
  assert.match(restore, /--photo-storage-secret-root "\$PHOTO_STORAGE_SECRET_ROOT"/)
  assert.match(restore, /backup-signature\.json/)
  assert.match(restore, /exact target volume|target volume already exists/)
  assert.match(restore, /keycloak-bootstrap[\s\S]*identity-binder[\s\S]*migrator/)
  assert.match(restore, /pg_restore[\s\S]*hr_axis[\s\S]*pg_restore[\s\S]*keycloak/)
  assert.match(restore, /CREATE ROLE hr_axis_restore SUPERUSER NOLOGIN/)
  assert.match(restore, /pg_restore[\s\S]*--role=hr_axis_restore[\s\S]*hr_axis[\s\S]*pg_restore[\s\S]*--role=hr_axis_restore[\s\S]*keycloak/)
  assert.match(restore, /SET ROLE hr_axis_restore;[\s\S]*REASSIGN OWNED BY hr_axis_restore TO hr_axis_migrator/)
  assert.match(restore, /SET ROLE hr_axis_restore;[\s\S]*REASSIGN OWNED BY hr_axis_restore TO keycloak/)
  assert.match(restore, /repair_database_ownership hr-axis/)
  assert.match(restore, /repair_database_ownership keycloak/)
  assert.match(restore, /GRANT hr_axis_migrator TO hr_axis_restore/)
  assert.match(restore, /GRANT keycloak TO hr_axis_restore/)
  assert.match(restore, /REVOKE hr_axis_migrator FROM hr_axis_restore/)
  assert.match(restore, /REVOKE keycloak FROM hr_axis_restore/)
  assert.match(restore, /DROP ROLE hr_axis_restore/)
  assert.match(restore, /GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO keycloak/)
  assert.match(restore, /FOR application_schema IN[\s\S]*REVOKE CREATE ON SCHEMA %I FROM PUBLIC, hr_axis_api, hr_axis_worker/)
  assert.match(restore, /GRANT USAGE ON SCHEMA %I TO hr_axis_api, hr_axis_worker/)
  assert.match(restore, /GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO hr_axis_api, hr_axis_worker/)
  assert.match(restore, /REVOKE UPDATE ON ALL SEQUENCES IN SCHEMA %I FROM hr_axis_api, hr_axis_worker/)
  assert.match(restore, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER[\s\S]*ON audit\.schema_migration[\s\S]*FROM hr_axis_api, hr_axis_worker/)
  assert.match(restore, /identity binder diagnostics[\s\S]*sanitize_compose_diagnostics[\s\S]*identity binder failed/)
  assert.match(restore, /--set=ON_ERROR_STOP=1[\s\S]*--dbname=\"\$db_name\"/)
  assert.match(restore, /repair_sql='SET ROLE hr_axis_restore;[\s\S]*GRANT hr_axis_migrator TO hr_axis_restore;[\s\S]*REASSIGN OWNED BY hr_axis_restore TO hr_axis_migrator;'/)
  assert.match(restore, /repair_sql='SET ROLE hr_axis_restore;[\s\S]*GRANT keycloak TO hr_axis_restore;[\s\S]*REASSIGN OWNED BY hr_axis_restore TO keycloak;'/)
  assert.match(restore, /restoredVolumeAggregateDigest|volume aggregate/i)
  assert.match(restore, /sha256sum "\$BACKUP_DIR\/volumes\/\$class_name\.tar"/)
  assert.doesNotMatch(restore, /docker run --pull=never --rm --network none --volume "\$volume_name:\/source:ro"[\s\S]{0,260}tar --numeric-owner -cf - -C \/source \. \| sha256sum/)
  assert.match(restore, /--pull=never|--pull never/)
  assert.match(restore, /onprem-offline-target-proof\.mjs/)
  assert.match(restore, /--photo-mode recover/)
  assert.match(restore, /recoveredPreBackupPhoto/)
  assert.ok(restore.indexOf('run_complete_target_proof() {') < restore.indexOf('revalidate_recovery_handle', restore.indexOf('run_complete_target_proof() {')), 'restore must revalidate the handle at target-proof entry')
  const signedPhotoMatch = restore.indexOf('BACKUP_PHOTO_HANDLE_SHA256')
  assert.ok(signedPhotoMatch >= 0 && restore.indexOf('revalidate_recovery_handle', signedPhotoMatch) > signedPhotoMatch, 'restore must recapture handle identity after signed-manifest matching')
  assert.match(restore, /--require-complete[\s\S]*--photo-fixture[\s\S]*--photo-sha256/)
  assert.match(restore, /prepare_photo_proof_handle\(\)/)
  assert.match(restore, /chown 1000:1000 -- "\$PHOTO_PROOF_HANDLE_FILE"/)
  assert.match(restore, /chmod 0400 -- "\$PHOTO_PROOF_HANDLE_FILE"/)
  assert.match(restore, /--photo-recovery-handle-file "\$PHOTO_PROOF_HANDLE_FILE"/)
  assert.match(restore, /discard_photo_proof_handle\(\)/)
  assert.match(restore, /run_auth_proof\(\)[\s\S]*--user 1000:1000/)
  assert.match(restore, /run_auth_proof\(\)[\s\S]*\$AUTH_ACCOUNTS/)
  assert.match(restore, /docker run --pull=never --rm --network "\$\{TARGET_PROJECT\}_proxy"/)
  assert.match(restore, /--entrypoint \/nodejs\/bin\/node[\s\S]*"\$BACKEND_IMAGE"[\s\S]*onprem-keycloak-auth-proof\.mjs/)
  assert.doesNotMatch(restore, /"\$BACKEND_IMAGE" node .*onprem-keycloak-auth-proof\.mjs/)
  assert.match(restore, /--rollback-authority-bundle-root/)
  assert.match(restore, /--rollback-authority-release-id/)
  assert.match(restore, /rollbackCompatible/)
  assert.match(restore, /exactly one compatibleFrom entry|compatibleFrom.*length !== 1/i)
  assert.match(restore, /rollback authority.*migration|authority.*migration.*digest/i)
  assert.match(restore, /compose_failure_context\(\)/)
  assert.match(restore, /sanitize_compose_diagnostics\(\)/)
  assert.match(restore, /compose_start core postgres .*--wait --wait-timeout 180/)
  assert.match(restore, /compose_start core redis .*--wait --wait-timeout 180/)
  assert.match(restore, /compose_start core keycloak .*--wait --wait-timeout 180/)
  assert.match(restore, /compose_start photo object-storage .*--wait --wait-timeout 180/)
  assert.match(restore, /KEYCLOAK_BOOTSTRAP_LOG=\$\(mktemp[\s\S]*?keycloak-bootstrap[\s\S]*?compose_core --profile infra --profile keycloak-bootstrap run[\s\S]*?tail -n 160[\s\S]*?sanitize_compose_diagnostics/)
  assert.match(restore, /TARGET_PROOF_LOG=\$\(mktemp[\s\S]*?target-proof[\s\S]*?tail -n 160[\s\S]*?sanitize_compose_diagnostics[\s\S]*?compose_failure_context core 'redis worker api caddy'[\s\S]*?compose_failure_context photo 'object-storage'/)
  assert.doesNotMatch(restore, /onprem-offline-target-proof\.mjs[^\n]*>\/dev\/null 2>&1/)
  assert.match(restore, /TARGET_PROOF_LOG.*cleanup|TARGET_PROOF_LOG.*rm -f/)
  assert.match(restore, /REDIS_IMAGE=\$\(node - "\$BUNDLE_ROOT\/bundle-manifest\.json"/)
  assert.match(restore, /reset_synthetic_queue_probe_state\(\)/)
  assert.match(restore, /hr-axis:onprem:synthetic-recovery-v1:(?:processed|enqueued)/)
  assert.match(restore, /bull:\$queue:(?:delayed|completed|failed)/)
  assert.doesNotMatch(restore, /flushall|flushdb/)
  assert.ok(restore.indexOf('reset_synthetic_queue_probe_state') < restore.indexOf('run_complete_target_proof\n'), 'restore must reset only the synthetic queue probe state before target proof')
  assert.match(restore, /queueProbeStateReset\":true/)
  assert.doesNotMatch(restore, /compose_core --profile infra --profile keycloak-bootstrap run[^\n]*>\/dev\/null 2>&1/)
  assert.doesNotMatch(restore, /compose_core --profile infra up --pull never -d postgres\s*>\/dev\/null/)
  assert.doesNotMatch(restore, /compose_photo up --pull never -d object-storage\s*>\/dev\/null/)

  const upgrade = source['upgrade.sh']
  assert.match(upgrade, /evidence\/migration-compatibility\.json/)
  assert.match(upgrade, /upgradeCompatible/)
  assert.match(upgrade, /compatibleFrom\.filter[\s\S]*entries\.length !== 1/)
  assert.match(upgrade, /forward_repair_or_database_restore_required/)
  assert.match(upgrade, /restore\.sh/)

  const rollback = source['rollback.sh']
  assert.match(rollback, /evidence\/migration-compatibility\.json/)
  assert.match(rollback, /rollbackCompatible/)
  assert.match(rollback, /forward_repair_or_database_restore_required/)
  assert.match(rollback, /restore\.sh/)
  assert.match(rollback, /--backup-public-key/)
  assert.match(rollback, /--backup-trusted-fingerprint/)
  assert.match(rollback, /--rollback-authority-bundle-root/)
  assert.match(rollback, /--rollback-authority-release-id/)
  assert.match(upgrade, /--backup-public-key/)
  assert.match(upgrade, /--backup-trusted-fingerprint/)
  assert.match(upgrade, /queueProbeStateReset !== true/)
  assert.match(rollback, /queueProbeStateReset !== true/)
})

test('recovery scripts pass POSIX shell syntax', (t) => {
  if (process.platform === 'win32' && !existsSync(shell)) return t.skip('POSIX shell unavailable on Windows')
  for (const name of recoveryScripts) {
    const result = spawnSync(shell, ['-n', join(operationDir, name)], { encoding: 'utf8' })
    assert.equal(result.status, 0, `${name}: ${result.stderr}`)
  }
})

function fixture(options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'onprem-offline-recovery-'))
  const bundle = join(root, 'bundle')
  const nextBundle = join(root, 'next-bundle')
  const operations = join(bundle, 'operations')
  const nextOperations = join(nextBundle, 'operations')
  const deployment = join(bundle, 'deployment')
  const nextDeployment = join(nextBundle, 'deployment')
  const evidence = join(bundle, 'evidence')
  const nextEvidence = join(nextBundle, 'evidence')
  const fakeBin = join(root, 'bin')
  const log = join(root, 'docker.log')
  const gateLog = join(root, 'gate.log')
  const nodeLog = join(root, 'node.log')
  const restoreLog = join(root, 'restore.log')
  const state = join(root, 'state')
  const envFile = join(root, 'approved.env')
  const ledger = join(root, 'ledger.json')
  const publicKey = join(root, 'trusted.pub')
  const privateKey = join(root, 'signing.pem')
  const backupDir = join(root, 'backup')
  const receipt = join(root, 'restore-receipt.json')
  const secretRoot = join(root, 'secrets')
  const photoFixture = join(root, 'photo-fixture.webp')
  const photoRecoveryHandle = join(root, 'photo-recovery.json')
  const photoSecretRoot = join(root, 'photo-secrets')
  for (const directory of [operations, nextOperations, deployment, nextDeployment, evidence, nextEvidence, fakeBin, state, join(secretRoot, 'backend'), join(secretRoot, 'keycloak'), join(secretRoot, 'caddy'), photoSecretRoot]) mkdirSync(directory, { recursive: true })
  writeFileSync(photoFixture, 'synthetic-photo-fixture\n', { mode: 0o600 })
  writeFileSync(photoRecoveryHandle, JSON.stringify({ schemaVersion: 1, dataClass: 'synthetic', mediaAssetId: '11111111-1111-4111-8111-111111111111', contentSha256: 'b'.repeat(64), contentLength: 22 }) + '\n', { mode: 0o600 })
  const photoFixtureSha256 = createHash('sha256').update(readFileSync(photoFixture)).digest('hex')
  const photoRecoveryHandleSha256 = createHash('sha256').update(readFileSync(photoRecoveryHandle)).digest('hex')
  writeFileSync(join(secretRoot, 'keycloak', 'synthetic-accounts'), 'synthetic-accounts\n', { mode: 0o600 })
  writeFileSync(join(secretRoot, 'keycloak', 'photo-proof-account'), 'photo-proof-account\n', { mode: 0o600 })
  writeFileSync(join(secretRoot, 'backend', 'redis-worker-url'), 'redis://worker:synthetic-password@redis:6379\n', { mode: 0o600 })
  writeFileSync(join(secretRoot, 'caddy', 'ca.crt'), 'synthetic-ca\n', { mode: 0o644 })
  for (const name of ['primary-access-key-id', 'primary-secret-access-key', 'recovery-access-key-id', 'recovery-secret-access-key']) writeFileSync(join(photoSecretRoot, name), 'synthetic-photo-secret\n', { mode: 0o600 })

  const { publicKey: releasePub } = generateKeyPairSync('ed25519')
  const { publicKey: backupPub, privateKey: backupPriv } = generateKeyPairSync('ed25519')
  writeFileSync(publicKey, releasePub.export({ type: 'spki', format: 'pem' }))
  const backupPublicKey = join(root, 'backup-trusted.pub')
  writeFileSync(backupPublicKey, backupPub.export({ type: 'spki', format: 'pem' }))
  writeFileSync(privateKey, backupPriv.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
  const fingerprint = createHash('sha256').update(releasePub.export({ type: 'spki', format: 'der' })).digest('hex')
  const backupFingerprint = createHash('sha256').update(backupPub.export({ type: 'spki', format: 'der' })).digest('hex')
  const migrationDigest = 'a'.repeat(64)
  writeFileSync(ledger, JSON.stringify({ project: 'hr-axis-onprem-core', releaseId: 'release-test', status: 'clean', dirty: false, orphanCount: 0, checksumValid: true, migrationTreeDigest: migrationDigest }))
  writeFileSync(envFile, [
    'HR_AXIS_DATA_CLASS=synthetic', 'HR_AXIS_STRICT_LOCAL=true', 'HR_AXIS_RELEASE_ID=release-test',
    'COMPOSE_PROJECT_NAME=hr-axis-onprem-core', `MIGRATION_LEDGER_FILE=${shellPath(ledger)}`, `HR_AXIS_SECRET_ROOT=${shellPath(secretRoot)}`, `PHOTO_STORAGE_SECRET_ROOT=${shellPath(photoSecretRoot)}`, 'HR_AXIS_PUBLIC_HOST=offline.synthetic.invalid', 'KEYCLOAK_SYNTHETIC_ACCOUNTS_ENABLED=true', 'KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED=true',
  ].join('\n') + '\n')

  function makeBundle(rootDir, opsDir, deploymentDir, evidenceDir, releaseId, compatibility, imagePrefix = 'c') {
    const imageNames = ['backend', 'frontend', 'keycloak', 'caddy', 'postgres', 'redis', 'seaweedfs']
    const images = Object.fromEntries(imageNames.map((name, index) => {
      const bytes = Buffer.from(`${releaseId}-${name}\n`)
      return [name, {
        name,
        archive: `images/${name}.tar`,
        repoTag: `registry.example/${name}:${imagePrefix}`,
        configImageId: `sha256:${index.toString(16)}${imagePrefix.repeat(63)}`,
        archiveSha256: createHash('sha256').update(bytes).digest('hex'),
        registryDigestAttestedByOwner: true,
        registryManifestDigest: `sha256:${'e'.repeat(64)}`,
      }]
    }))
    writeFileSync(join(rootDir, 'bundle-manifest.json'), JSON.stringify({ releaseId, images }))
    writeFileSync(join(rootDir, 'bundle-signature.json'), '{}\n')
    mkdirSync(join(rootDir, 'images'), { recursive: true })
    for (const name of imageNames) writeFileSync(join(rootDir, 'images', `${name}.tar`), `${releaseId}-${name}\n`)
    writeFileSync(join(deploymentDir, 'compose.yaml'), 'services: {}\n')
    writeFileSync(join(deploymentDir, 'compose.photo-proof.yaml'), 'services: {}\n')
    writeFileSync(join(deploymentDir, 'photo-compose.yaml'), 'services: {}\n')
    writeFileSync(join(deploymentDir, 'restore.compose.yaml'), 'services: {}\n')
    writeFileSync(join(opsDir, 'onprem-offline-bundle.mjs'), `import fs from 'node:fs'; fs.appendFileSync(process.env.GATE_LOG, 'verifier\\n')\n`)
    executable(join(opsDir, 'restore.sh'), `#!/bin/sh\nprintf '%s\\n' "$*" >> "\$RESTORE_LOG"\nreceipt=; target=; source=; release=\nwhile [ "$#" -gt 0 ]; do case "$1" in --receipt) receipt=$2 ;; --target-project|--project) target=$2 ;; --source-project) source=$2 ;; --release-id) release=$2 ;; esac; shift 2; done\nprintf '%s\\n' '{"operation":"restore","status":"passed","dataClass":"synthetic","releaseId":"'"$release"'","sourceProject":"'"$source"'","targetProject":"'"$target"'","sameHostRehearsal":true,"disasterRecovery":false,"targetFresh":true,"cleanupVerified":true,"recoveredPreBackupPhoto":true,"queueProbeStateReset":true,"photoRecoveryHandleSha256":"'"${photoRecoveryHandleSha256}"'","photoContentSha256":"${'b'.repeat(64)}","photoContentLength":22,"sourceMigrationTreeDigest":"${'a'.repeat(64)}","targetMigrationTreeDigest":"${'b'.repeat(64)}","backupManifestSha256":"${'c'.repeat(64)}","backupFingerprintSha256":"'"$BACKUP_FINGERPRINT"'","targetProofReceiptSha256":"${'d'.repeat(64)}","authReceiptSha256":"${'e'.repeat(64)}","targetProof":{"queue":true,"photo":true,"auth":true}}' > "$receipt"\n`)
    writeFileSync(join(opsDir, 'onprem-offline-target-proof.mjs'), '// fake target proof\n')
    writeFileSync(join(opsDir, 'onprem-keycloak-auth-proof.mjs'), '// fake auth proof\n')
    writeFileSync(join(opsDir, 'onprem-photo-auth-proof.mjs'), '// fake photo auth proof\n')
    writeFileSync(join(evidenceDir, 'migration-compatibility.json'), JSON.stringify(compatibility))
    executable(join(opsDir, 'preflight.sh'), `#!/bin/sh\nprintf '%s\\n' preflight >> "$GATE_LOG"\ncount=$(grep -c '^preflight$' "$GATE_LOG" 2>/dev/null || true)\n[ "\${FAIL_TARGET_PREFLIGHT:-0}" = 1 ] && [ "$count" -gt 1 ] && exit 1\nexit 0\n`)
  }
  const currentCompatibility = { schemaVersion: 1, releaseId: 'release-test', migrationTreeDigest: migrationDigest, upgradeCompatible: true, rollbackCompatible: true, compatibleFrom: [{ sourceReleaseId: 'release-test', sourceMigrationTreeDigest: migrationDigest }] }
  const nextCompatibility = { schemaVersion: 1, releaseId: 'next-test', migrationTreeDigest: 'b'.repeat(64), upgradeCompatible: true, rollbackCompatible: true, compatibleFrom: [{ sourceReleaseId: 'release-test', sourceMigrationTreeDigest: migrationDigest }] }
  makeBundle(bundle, operations, deployment, evidence, 'release-test', options.previousCompatibility ?? currentCompatibility, 'c')
  makeBundle(nextBundle, nextOperations, nextDeployment, nextEvidence, 'next-test', options.compatibility ?? nextCompatibility, 'd')

  executable(join(fakeBin, 'node'), `#!/bin/sh
set -eu
case "$*" in
  *onprem-offline-target-proof.mjs*)
    receipt=; previous=; photo=; mode=; for value in "$@"; do [ "$previous" = --receipt ] && receipt=$value; [ "$previous" = --photo-sha256 ] && photo=$value; [ "$previous" = --photo-mode ] && mode=$value; previous=$value; done
    [ -n "$receipt" ] || exit 41
    [ "$mode" = recover ] && photo=$(printf '%064d' 0 | tr 0 b) && recovered=',"recoveredPreBackupPhoto":true' || recovered=''
    printf '%s\\n' '{"schemaVersion":1,"dataClass":"synthetic","releaseClaimVerified":true,"queue":{"enqueued":true,"redisRestarted":true,"processed":true,"statusCompleted":true,"containerIdentityPreserved":true,"volumeIdentityPreserved":true},"photo":{"photoAdminAuthenticated":true,"nonSuperAdminDenied":true,"deniedWriteDelta":0,"exactWebpRead":true,"repeatReadExact":true,"canonicalIdentityVerified":true,"contentSha256":"'"$photo"'","contentLength":22}'"$recovered"'}' > "$receipt"
    exit 0;;
esac
set +e
"\$REAL_NODE" "\$@"; status=\$?
set -e
printf 'node-status:%s args:%s\\n' "\$status" "\$*" >> "\$NODE_LOG"
exit "\$status"
`)
  // The production operator runs as root below a root-private parent. Contract
  // tests run as the host user under /tmp, so emulate only that ownership
  // boundary while preserving real modes (including the writable-parent RED
  // fixture) and all other stat behavior.
  executable(join(fakeBin, 'stat'), `#!/bin/sh
set -eu
format=; pathname=; previous=
for value in "$@"; do
  [ "$previous" = -c ] && format=$value
  pathname=$value
  previous=$value
done
case "$pathname" in
  "$FIXTURE_ROOT"*/.photo-recovery-handle-proof.*)
    case "$format" in
      %u|%g) printf '1000\\n'; exit 0 ;;
    esac
    ;;
  /|/tmp|"$FIXTURE_ROOT"|"$FIXTURE_ROOT"/*)
    case "$format" in
      %u|%g) printf '0\\n'; exit 0 ;;
      %a) [ "$pathname" = /tmp ] && { printf '755\\n'; exit 0; } ;;
    esac
    ;;
esac
exec /usr/bin/stat "$@"
`)
  executable(join(fakeBin, 'docker'), `#!/bin/sh
set -eu
printf '%s\\n' "$*" >> "$DOCKER_LOG"
state="$STATE_DIR/stopped"
service_from_args() { last=; for value in "$@"; do last=$value; done; printf '%s' "$last"; }
if [ "$1" = compose ]; then
  args="$*"
  case "$args" in
    *' ps -q '*) service=$(service_from_args "$@"); echo "id-$service"; exit 0 ;;
    *' stop '*) touch "$state"; exit 0 ;;
    *' run '*keycloak-bootstrap*) [ "\${FAIL_BOOTSTRAP:-0}" = 1 ] && exit 1; exit 0 ;;
    *' run '*identity-binder*) exit 0 ;;
    *' run '*migrator*) printf '{"migrationTreeDigest":"%s"}\n' "\${MIGRATOR_DIGEST:-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}"; exit 0 ;;
    *' up '*) [ "\${FAIL_RESUME:-0}" = 1 ] && [ -f "$state" ] && exit 1; project=; release=; previous=; env_file=; for value in "$@"; do [ "$previous" = --project-name ] && project=$value; [ "$previous" = --env-file ] && env_file=$value; previous=$value; done; [ -n "$project" ] || project=hr-axis-onprem-core; [ -f "$env_file" ] && release=$(sed -n 's/^HR_AXIS_RELEASE_ID=//p' "$env_file" | tail -n 1); [ -n "$release" ] || release=release-test; printf '%s' "$project" > "$STATE_DIR/project"; printf '%s' "$release" > "$STATE_DIR/release"; if [ "$project" = hr-axis-onprem-core ]; then rm -f "$STATE_DIR/target"; else touch "$STATE_DIR/target"; fi; rm -f "$state"; exit 0 ;;
  esac
  exit 0
fi
if [ "$1" = volume ] && [ "$2" = create ]; then
  name=; project=; data_class=; release=; volume_class=;
  for value in "$@"; do
    case "$value" in
      com.hr-axis.project=*) project=\${value#*=} ;;
      com.hr-axis.data-class=*) data_class=\${value#*=} ;;
      com.hr-axis.release-id=*) release=\${value#*=} ;;
      com.hr-axis.volume-class=*) volume_class=\${value#*=} ;;
    esac
    case "$value" in *_postgres_data|*_redis_data|*_keycloak_data|*_keycloak_bootstrap_state|*_object_storage_data) name=$value ;; esac
  done
  printf '%s|%s|%s|%s|%s\n' "$name" "$project" "$data_class" "$release" "$volume_class" >> "$STATE_DIR/volumes"
  printf '%s\n' "$name"; exit 0
fi
if [ "$1" = load ]; then
  exit 0
fi
if [ "$1" = image ] && [ "$2" = inspect ]; then
  expected=$5
  [ "\${IMAGE_LOAD_MISMATCH:-0}" = 1 ] && expected=sha256:deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef
  printf '%s\\n' "$expected"
  exit 0
fi
if [ "$1" = volume ] && [ "$2" = rm ]; then
  name=$3; exit 0
fi
if [ "$1" = volume ] && [ "$2" = ls ]; then
  case "$*" in *'com.docker.compose.project=hr-axis-onprem-restore'*) [ "\${LABEL_COLLISION:-0}" = 1 ] && echo hr-axis-onprem-restore_compose_noncanonical; exit 0;; esac
  case "$*" in *'com.hr-axis.project=hr-axis-onprem-restore'*) [ "\${LABEL_COLLISION:-0}" = 1 ] && echo hr-axis-onprem-restore_noncanonical; exit 0;; esac
  case "$*" in *'com.hr-axis.project=hr-axis-onprem-upgrade'*) [ "\${TARGET_COLLISION:-0}" = 1 ] && echo hr-axis-onprem-upgrade_collision; exit 0;; esac
  if [ "\${DUPLICATE_CLASS:-0}" = 1 ]; then echo 'v-postgres v-redis v-redis2 v-keycloak v-bootstrap v-photo'; else echo 'v-postgres v-redis v-keycloak v-bootstrap v-photo'; fi
  exit 0
fi
if [ "$1" = volume ] && [ "$2" = inspect ]; then
  name=$3
  case "$name" in *_postgres_data|*_redis_data|*_keycloak_data|*_keycloak_bootstrap_state|*_object_storage_data)
    case "$*" in *Labels*) line=; [ -f "$STATE_DIR/volumes" ] && line=$(awk -F'|' -v n="$name" '$1 == n { print; exit }' "$STATE_DIR/volumes"); if [ -n "$line" ]; then case "$*" in *volume-class*) printf '%s\\n' "$line" ;; *) printf '%s\\n' "$line" | cut -d'|' -f1-4 ;; esac; exit 0; fi ;; esac
    [ "\${COLLIDE:-0}" = 1 ] || exit 1; exit 0 ;;
  esac
  case "$name" in
    v-postgres) class=postgres ;; v-redis|v-redis2) class=redis-aof ;; v-keycloak) class=keycloak ;; v-bootstrap) class=keycloak-bootstrap-state ;; v-photo) class=photo-object-storage ;;
    hr-axis-onprem-restore_redis_data) class=redis-aof ;; hr-axis-onprem-restore_keycloak_data) class=keycloak ;; hr-axis-onprem-restore_keycloak_bootstrap_state) class=keycloak-bootstrap-state ;; hr-axis-onprem-restore_object_storage_data) class=photo-object-storage ;; *) exit 1 ;;
  esac
  volume_project=hr-axis-onprem-core; volume_release=release-test
  [ -f "$STATE_DIR/project" ] && volume_project=$(cat "$STATE_DIR/project")
  [ -f "$STATE_DIR/release" ] && volume_release=$(cat "$STATE_DIR/release")
  printf '%s|%s|synthetic|%s|%s\\n' "$name" "$volume_project" "$volume_release" "$class"; exit 0
fi
if [ "$1" = network ] && [ "$2" = inspect ]; then
  name=$3
  case "$*" in
    *Labels*)
      [ -f "$STATE_DIR/project" ] || exit 1
      project=$(cat "$STATE_DIR/project"); release=$(cat "$STATE_DIR/release")
      printf '%s|%s|synthetic|%s\n' "$name" "$project" "$release"
      exit 0 ;;
  esac
  [ "\${COLLIDE:-0}" = 1 ] && exit 0 || exit 1
fi
if [ "$1" = ps ]; then
  case "$*" in *'label=com.docker.compose.project=hr-axis-onprem-restore'*)
    if [ "\${LABEL_COLLISION:-0}" = 1 ]; then echo id-restore-noncanonical; exit 0; fi
    [ -f "$STATE_DIR/target" ] || exit 0
    ;;
  esac
  case "$*" in *'label=com.hr-axis.project=hr-axis-onprem-restore'*)
    if [ "\${LABEL_COLLISION:-0}" = 1 ]; then echo id-restore-noncanonical; exit 0; fi
    [ -f "$STATE_DIR/target" ] || exit 0
    ;;
  esac
  case "$*" in *'com.docker.compose.project=hr-axis-onprem-upgrade'*) [ "\${TARGET_COLLISION:-0}" = 1 ] && echo id-target-collision; exit 0;; esac
  if [ "\${UNKNOWN_SERVICE:-0}" = 1 ]; then echo 'id-caddy id-frontend id-api id-worker id-keycloak id-redis id-postgres id-object-storage id-unknown'; exit 0; fi
  if [ "\${NO_ONE_SHOTS:-0}" = 1 ]; then echo 'id-caddy id-frontend id-api id-worker id-keycloak id-redis id-postgres id-object-storage'; else echo 'id-caddy id-frontend id-api id-worker id-keycloak id-redis id-postgres id-object-storage id-keycloak-bootstrap id-identity-binder id-migrator id-synthetic-seed'; fi
  exit 0
fi
if [ "$1" = container ] && [ "$2" = inspect ]; then [ "\${COLLIDE:-0}" = 1 ] && exit 0 || exit 1; fi
if [ "$1" = network ] && [ "$2" = ls ]; then
  case "$*" in *'hr-axis-onprem-restore'*) [ "\${LABEL_COLLISION:-0}" = 1 ] && echo network-restore-noncanonical; exit 0;; esac
  exit 0
fi
if [ "$1" = inspect ]; then
  id=$2; format="$*"; service=\${id#id-}; project=hr-axis-onprem-core; release=release-test; [ -f "$STATE_DIR/project" ] && project=$(cat "$STATE_DIR/project"); [ -f "$STATE_DIR/release" ] && release=$(cat "$STATE_DIR/release");
  case "$format" in
    *State.Restarting*State.Dead*RestartCount*)
      health=healthy; [ "\${RESUME_UNHEALTHY:-}" = "$service" ] && health=unhealthy
      image_id() { index=$1; printf 'sha256:%s' "$index"; i=0; while [ "$i" -lt 63 ]; do printf '%s' "\${RUNTIME_IMAGE_PREFIX:-c}"; i=$((i + 1)); done; }
      image=$(image_id 0); case "$service" in keycloak) image=$(image_id 2) ;; redis) image=$(image_id 5) ;; object-storage) image=$(image_id 6) ;; esac
      printf '%s|%s|synthetic|%s|%s|true|running|false|false||%s|0|%s\n' "$project" "$project" "$release" "$service" "$health" "$image"
      exit 0 ;;
    *com.docker.compose.project*State.Running*Image*)
      running=true
      case "$service" in keycloak-bootstrap|identity-binder|migrator|synthetic-seed) running=false ;; api|worker|keycloak|redis|object-storage) [ -f "$state" ] && running=false ;; esac
      [ "\${ONE_SHOT_RUNNING:-}" = "$service" ] && running=true
      image_id() { index=$1; printf 'sha256:%s' "$index"; i=0; while [ "$i" -lt 63 ]; do printf '%s' "\${RUNTIME_IMAGE_PREFIX:-c}"; i=$((i + 1)); done; }
      image=$(image_id 0)
      case "$service" in frontend) image=$(image_id 1) ;; keycloak) image=$(image_id 2) ;; caddy) image=$(image_id 3) ;; postgres) image=$(image_id 4) ;; redis) image=$(image_id 5) ;; object-storage) image=$(image_id 6) ;; esac
      [ "\${WRONG_IMAGE_SERVICE:-}" = "$service" ] && image=sha256:deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef
      printf '%s|%s|synthetic|%s|%s|%s|%s\n' "$project" "$project" "$release" "$service" "$running" "$image" "$image"
      exit 0
      ;;
    *com.docker.compose.project*)
      [ "$id" = id-target-collision ] && printf 'hr-axis-onprem-upgrade|hr-axis-onprem-upgrade|synthetic|next-test\n' || exit 1
      exit 0
      ;;
  esac
  case "$format" in *com.docker.compose.service*State.Health*) printf '%s|synthetic|%s|%s|true|healthy\\n' "$project" "$release" "$service"; exit 0 ;; *State.Health*) printf '%s|synthetic|%s|true|healthy\\n' "$project" "$release"; exit 0 ;; esac
  case "$format" in
    *Config.Labels*State.Running*State.Health*) printf '%s|synthetic|%s|true|healthy\\n' "$project" "$release"; exit 0 ;;
    *Config.Labels*com.docker.compose.service*State.Health*) printf '%s|synthetic|%s|%s|true|healthy\\n' "$project" "$release" "$service"; exit 0 ;;
    *Config.Labels*State.Health*) printf '%s|synthetic|%s|true|healthy\\n' "$project" "$release"; exit 0 ;;
    *Config.Labels*State.Running*) running=true; case "$service" in keycloak-bootstrap|identity-binder|migrator) running=false ;; api|worker|keycloak|redis|object-storage) [ -f "$state" ] && running=false ;; esac; printf '%s|synthetic|%s|%s|%s\\n' "$project" "$release" "$service" "$running"; exit 0 ;;
    *State.Running*) [ -f "$state" ] && case "$service" in api|worker|keycloak|redis|object-storage) echo false; exit 0;; keycloak-bootstrap|identity-binder|migrator) echo false; exit 0;; esac; echo true; exit 0 ;;
    *State.Health*) printf '%s|synthetic|%s|%s|true|healthy\\n' "$project" "$release" "$service"; exit 0 ;;
    *Config.Labels*)
      if [ "$service" = unrelated ]; then printf '/unrelated|other-project|synthetic|other-release|api\\n'; else printf '/%s|%s|synthetic|release-test|%s\\n' "$id" "$project" "$service"; fi
      exit 0 ;;
  esac
fi
if [ "$1" = exec ]; then
  case "$*" in *pg_dump*hr_axis*) printf 'hr-axis-dump\\n';; *pg_dump*keycloak*) printf 'keycloak-dump\\n';; *redis-cli*PING*) printf 'PONG\\n';; esac
  exit 0
fi
if [ "$1" = run ]; then
  args="$*"
  case "$args" in
    *'/backup/volumes/'*) host=; class=; for value in "$@"; do case "$value" in *:/backup*) host=\${value%%:/backup*};; esac; done; class=$(printf '%s' "$args" | sed -n 's#.*volumes/\\([^./ ]*\\)\\.tar.*#\\1#p'); [ -n "$host" ] || exit 1; mkdir -p "$host/volumes"; [ -f "$host/volumes/$class.tar" ] || printf 'archive-%s\\n' "$class" > "$host/volumes/$class.tar"; exit 0 ;;
    *onprem-keycloak-auth-proof.mjs*) printf '%s\\n' '{"schemaVersion":1,"dataClass":"synthetic","personas":{"count":5,"sessionsVerified":5,"crossScopeDenied":5,"deniedMutationCount":4},"scopeAuthorization":{"crossScopeDenied":true,"deniedActionWriteDelta":0},"noRawCredentials":true}'; exit 0 ;;
    *sha256sum*) volume=; for value in "$@"; do case "$value" in *:/source:ro) volume=\${value%%:/source:ro};; esac; done; case "$volume" in *redis*) printf '%s  -\\n' "$HASH_REDIS";; *keycloak_bootstrap*) printf '%s  -\\n' "$HASH_BOOTSTRAP";; *keycloak*) printf '%s  -\\n' "$HASH_KEYCLOAK";; *object_storage*) printf '%s  -\\n' "$HASH_PHOTO";; esac; exit 0 ;;
    *) exit 0 ;;
  esac
fi
if [ "$1" = load ] || [ "$1" = volume ] || [ "$1" = network ]; then exit 0; fi
exit 0
`)
  return { root, bundle, nextBundle, fakeBin, log, gateLog, nodeLog, restoreLog, state, envFile, ledger, publicKey, backupPublicKey, privateKey, fingerprint, backupFingerprint, backupDir, receipt, photoFixture, photoFixtureSha256, photoRecoveryHandle, photoRecoveryHandleSha256, secretRoot, photoSecretRoot, migrationDigest, options }
}

function envFor(value, extra = {}) {
  const path = `${shellPath(value.fakeBin)}:/usr/bin:/bin`
  const archiveHash = (className) => createHash('sha256').update(`archive-${className}\n`).digest('hex')
  return {
    ...process.env, PATH: path, REAL_NODE: shellPath(process.execPath), FIXTURE_ROOT: shellPath(value.root), DOCKER_LOG: shellPath(value.log), GATE_LOG: shellPath(value.gateLog), NODE_LOG: shellPath(value.nodeLog), STATE_DIR: shellPath(value.state),
    HASH_REDIS: archiveHash('redis-aof'), HASH_KEYCLOAK: archiveHash('keycloak'), HASH_BOOTSTRAP: archiveHash('keycloak-bootstrap-state'), HASH_PHOTO: archiveHash('photo-object-storage'), MIGRATOR_DIGEST: 'a'.repeat(64), BACKUP_FINGERPRINT: value.backupFingerprint, RESTORE_LOG: shellPath(value.restoreLog), ...extra,
  }
}

function run(name, value, args = [], extraEnv = {}) {
  const base = ['--bundle-root', shellPath(value.bundle), '--release-id', 'release-test', '--target-project', 'hr-axis-onprem-core', '--public-key', shellPath(value.publicKey), '--trusted-fingerprint', value.fingerprint, '--env-file', shellPath(value.envFile)]
  return spawnSync(shell, [shellPath(join(operationDir, name)), ...base, ...args], { encoding: 'utf8', env: envFor(value, extraEnv) })
}

function backupTrustArgs(value) {
  return ['--backup-public-key', shellPath(value.backupPublicKey), '--backup-trusted-fingerprint', value.backupFingerprint]
}

function backupArgs(value) {
  return ['--backup-private-key', shellPath(value.privateKey), '--backup-trusted-fingerprint', value.backupFingerprint, '--backup-dir', shellPath(value.backupDir), '--photo-recovery-handle-file', shellPath(value.photoRecoveryHandle)]
}
function backupArgsAt(value, directory) {
  return ['--backup-private-key', shellPath(value.privateKey), '--backup-trusted-fingerprint', value.backupFingerprint, '--backup-dir', shellPath(directory), '--photo-recovery-handle-file', shellPath(value.photoRecoveryHandle)]
}
function photoArgs(value) { return ['--photo-fixture', shellPath(value.photoFixture), '--photo-sha256', value.photoFixtureSha256, '--photo-recovery-handle-file', shellPath(value.photoRecoveryHandle)] }
function photoArgsAt(value, handle) { return ['--photo-fixture', shellPath(value.photoFixture), '--photo-sha256', value.photoFixtureSha256, '--photo-recovery-handle-file', shellPath(handle)] }

function readLog(value) { return existsSync(value.log) ? readFileSync(value.log, 'utf8') : '' }

test('stateful fake Docker proves verifier/preflight precede backup mutation and quiesce precedes dump/archive', (t) => {
  if (process.platform === 'win32' && !existsSync(shell)) return t.skip('POSIX shell unavailable on Windows')
    const value = fixture()
  try {
    const result = run('backup.sh', value, backupArgs(value))
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    const gate = readFileSync(value.gateLog, 'utf8')
    assert.match(gate, /verifier[\s\S]*preflight/)
    const log = readLog(value)
    assert.ok(log.indexOf(' stop api worker keycloak redis') >= 0)
    assert.ok(log.indexOf('exec ') > log.indexOf('stop api worker keycloak redis'))
    assert.ok(log.indexOf('run ') > log.indexOf('exec '))
    assert.doesNotMatch(log, /postgres\.tar/)
    assert.match(readFileSync(join(value.backupDir, 'backup-manifest.json'), 'utf8'), /"disasterRecovery":false/)
    assert.equal(existsSync(join(value.backupDir, 'backup-signature.json')), true)
    assert.equal(existsSync(join(value.backupDir, 'volumes', 'postgres.tar')), false)
  } finally { rmSync(value.root, { recursive: true, force: true }) }
})

test('a resume failure preserves the already committed signed backup', (t) => {
  if (process.platform === 'win32' && !existsSync(shell)) return t.skip('POSIX shell unavailable on Windows')
  const value = fixture()
  try {
    const result = run('backup.sh', value, backupArgs(value), { FAIL_RESUME: '1' })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /backup-created-but-resume-failed; signed backup retained/)
    assert.doesNotMatch(result.stdout, /backup: PASS/)
    assert.equal(existsSync(join(value.backupDir, 'backup-manifest.json')), true)
    assert.equal(existsSync(join(value.backupDir, 'backup-signature.json')), true)
    assert.equal(existsSync(join(value.backupDir, 'SHA256SUMS')), true)
    assert.match(readFileSync(join(value.backupDir, 'backup-manifest.json'), 'utf8'), /"operation":"backup"/)
  } finally { rmSync(value.root, { recursive: true, force: true }) }
})

test('an unhealthy resumed writer preserves the signed backup and cannot print PASS', (t) => {
  if (process.platform === 'win32' && !existsSync(shell)) return t.skip('POSIX shell unavailable on Windows')
  const value = fixture()
  try {
    const result = run('backup.sh', value, backupArgs(value), { RESUME_UNHEALTHY: 'api' })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /backup-created-but-resume-failed; signed backup retained/)
    assert.doesNotMatch(result.stdout, /backup: PASS/)
    assert.equal(existsSync(join(value.backupDir, 'backup-manifest.json')), true)
    assert.equal(existsSync(join(value.backupDir, 'backup-signature.json')), true)
  } finally { rmSync(value.root, { recursive: true, force: true }) }
})

test('writable backup ancestor fails before writer quiesce, dump, archive, or output publication', (t) => {
  if (process.platform === 'win32') return t.skip('filesystem mode/uid enforcement requires Linux')
  const value = fixture()
  const writableParent = join(value.root, 'writable-parent')
  const output = join(writableParent, 'backup')
  mkdirSync(writableParent, { recursive: true })
  try {
    chmodSync(writableParent, 0o777)
    const result = run('backup.sh', value, backupArgsAt(value, output))
    assert.notEqual(result.status, 0)
    assert.match(`${result.stdout}\n${result.stderr}`, /group\/world writable|backup parent|trust/i)
    assert.doesNotMatch(readLog(value), /compose .* stop|exec .*pg_dump| run /i)
    assert.equal(existsSync(output), false)
  } finally { rmSync(value.root, { recursive: true, force: true }) }
})

test('wrong trust, inventory tamper, and exact target collision fail before restore mutation', (t) => {
  if (process.platform === 'win32' && !existsSync(shell)) return t.skip('POSIX shell unavailable on Windows')
  const value = fixture()
  try {
    const backup = run('backup.sh', value, backupArgs(value))
    assert.equal(backup.status, 0, `${backup.stdout}\n${backup.stderr}`)
    writeFileSync(join(value.backupDir, 'SHA256SUMS'), readFileSync(join(value.backupDir, 'SHA256SUMS'), 'utf8').replace(/[0-9a-f]/, 'f'))
    const beforeTamperedRestore = readLog(value)
    const tampered = run('restore.sh', value, ['--target-project', 'hr-axis-onprem-restore', '--backup-dir', shellPath(value.backupDir), '--source-project', 'hr-axis-onprem-core', '--receipt', shellPath(value.receipt), ...backupTrustArgs(value), ...photoArgs(value)])
    assert.notEqual(tampered.status, 0)
    assert.equal(readLog(value), beforeTamperedRestore)
    const clean = fixture()
    try {
      assert.equal(run('backup.sh', clean, backupArgs(clean)).status, 0)
      const beforeCollisionRestore = readLog(clean)
      const collision = run('restore.sh', clean, ['--target-project', 'hr-axis-onprem-restore', '--backup-dir', shellPath(clean.backupDir), '--source-project', 'hr-axis-onprem-core', '--receipt', shellPath(clean.receipt), ...backupTrustArgs(clean), ...photoArgs(clean)], { COLLIDE: '1' })
      assert.notEqual(collision.status, 0)
      const collisionTail = readLog(clean).slice(beforeCollisionRestore.length)
      assert.doesNotMatch(collisionTail, /(?:^|\n)(?:.*\b(?:volume|network|container)\s+(?:create|rm)\b|.*\bcompose\b.*\b(?:up|run|start|stop)\b|\s*run\b)/i)
    } finally { rmSync(clean.root, { recursive: true, force: true }) }
  } finally { rmSync(value.root, { recursive: true, force: true }) }
})

test('release and backup trust keys remain distinct and cross-key restore fails before Docker mutation', (t) => {
  if (cannotCreateRootPrivateFixture) return t.skip('requires a root-owned restore seal fixture')
  if (process.platform === 'win32' && !existsSync(shell)) return t.skip('POSIX shell unavailable on Windows')
  const value = fixture()
  try {
    const backup = run('backup.sh', value, backupArgs(value))
    assert.equal(backup.status, 0, `${backup.stdout}\n${backup.stderr}`)
    const before = readLog(value)
    const wrongTrust = run('restore.sh', value, ['--target-project', 'hr-axis-onprem-restore', '--backup-dir', shellPath(value.backupDir), '--source-project', 'hr-axis-onprem-core', '--receipt', shellPath(value.receipt), '--backup-public-key', shellPath(value.publicKey), '--backup-trusted-fingerprint', value.fingerprint, ...photoArgs(value)])
    assert.notEqual(wrongTrust.status, 0)
    assert.match(`${wrongTrust.stdout}\n${wrongTrust.stderr}`, /backup manifest|signed backup|fingerprint|signature/i)
    assert.equal(readLog(value), before)
  } finally { rmSync(value.root, { recursive: true, force: true }) }
})

test('missing or duplicate volume classes fail closed before backup mutation', (t) => {
  if (process.platform === 'win32' && !existsSync(shell)) return t.skip('POSIX shell unavailable on Windows')
  const value = fixture()
  try {
    const result = run('backup.sh', value, backupArgs(value), { DUPLICATE_CLASS: '1' })
    assert.notEqual(result.status, 0)
    assert.doesNotMatch(readLog(value), /compose .* stop|exec .*pg_dump| run /)
  } finally { rmSync(value.root, { recursive: true, force: true }) }
})

test('backup accepts an absent one-shot container but rejects running seed, unknown service, and wrong image before mutation', (t) => {
  if (process.platform === 'win32' && !existsSync(shell)) return t.skip('POSIX shell unavailable on Windows')
  const absent = fixture()
  try {
    const success = run('backup.sh', absent, backupArgs(absent), { NO_ONE_SHOTS: '1' })
    assert.equal(success.status, 0, `${success.stdout}\n${success.stderr}`)
    assert.match(readLog(absent), /ps -aq .*label=com\.docker\.compose\.project=hr-axis-onprem-core/)
  } finally { rmSync(absent.root, { recursive: true, force: true }) }

  for (const [name, extra, expected] of [
    ['running seed', { ONE_SHOT_RUNNING: 'synthetic-seed' }, /one-shot service must be stopped|write-capable one-shot/],
    ['unknown service', { UNKNOWN_SERVICE: '1' }, /unknown Compose service|unknown service/],
    ['wrong image', { WRONG_IMAGE_SERVICE: 'api' }, /image identity mismatch|runtime image/],
  ]) {
    const value = fixture()
    try {
      const result = run('backup.sh', value, backupArgs(value), extra)
      assert.notEqual(result.status, 0, `${name} unexpectedly passed`)
      assert.match(`${result.stdout}\n${result.stderr}`, expected)
      assert.doesNotMatch(readLog(value), /compose .* stop|exec .*pg_dump| run /)
    } finally { rmSync(value.root, { recursive: true, force: true }) }
  }
})

test('restore invokes target-bound bootstrap, binder, one migration, health checks, and exact cleanup', (t) => {
  if (cannotCreateRootPrivateFixture) return t.skip('requires a root-owned restore seal fixture')
  if (process.platform === 'win32' && !existsSync(shell)) return t.skip('POSIX shell unavailable on Windows')
  const value = fixture()
  try {
    assert.equal(run('backup.sh', value, backupArgs(value)).status, 0)
    const result = run('restore.sh', value, ['--target-project', 'hr-axis-onprem-restore', '--backup-dir', shellPath(value.backupDir), '--source-project', 'hr-axis-onprem-core', '--receipt', shellPath(value.receipt), ...backupTrustArgs(value), ...photoArgs(value)])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    const log = readLog(value)
    assert.match(log, /run .*keycloak-bootstrap/)
    assert.match(log, /run .*identity-binder/)
    assert.match(log, /run .*migrator/)
    assert.match(log, /exec .*psql/)
    assert.match(log, /exec .*redis-cli.*PING/)
    assert.match(readFileSync(value.receipt, 'utf8'), /"targetProject":"hr-axis-onprem-restore"/)
    const seals = readdirSync(dirname(value.receipt)).filter((name) => name.startsWith('.backup-seal.'))
    assert.deepEqual(seals, [])

    const failed = fixture()
    try {
      assert.equal(run('backup.sh', failed, backupArgs(failed)).status, 0)
      const failure = run('restore.sh', failed, ['--target-project', 'hr-axis-onprem-restore', '--backup-dir', shellPath(failed.backupDir), '--source-project', 'hr-axis-onprem-core', '--receipt', shellPath(failed.receipt), ...backupTrustArgs(failed), ...photoArgs(failed)], { FAIL_BOOTSTRAP: '1' })
      assert.notEqual(failure.status, 0)
      const cleanupLog = readLog(failed)
      assert.match(cleanupLog, /rm -f? id-/)
      assert.doesNotMatch(cleanupLog, /rm -f? id-unrelated/)
    assert.match(cleanupLog, /volume rm hr-axis-onprem-restore_/)
    } finally { rmSync(failed.root, { recursive: true, force: true }) }
  } finally { rmSync(value.root, { recursive: true, force: true }) }
})

test('oversized unauthenticated backup metadata fails before restore Docker mutation', (t) => {
  if (process.platform === 'win32' && !existsSync(shell)) return t.skip('POSIX shell unavailable on Windows')
  const value = fixture()
  try {
    assert.equal(run('backup.sh', value, backupArgs(value)).status, 0)
    truncateSync(join(value.backupDir, 'backup-manifest.json'), 1024 * 1024 + 1)
    const before = readLog(value)
    const result = run('restore.sh', value, ['--target-project', 'hr-axis-onprem-restore', '--backup-dir', shellPath(value.backupDir), '--source-project', 'hr-axis-onprem-core', '--receipt', shellPath(value.receipt), ...backupTrustArgs(value), ...photoArgs(value)])
    assert.notEqual(result.status, 0)
    assert.match(`${result.stdout}\n${result.stderr}`, /backup closure could not be sealed safely/)
    assert.equal(readLog(value), before)
    assert.equal(existsSync(value.receipt), false)
  } finally { rmSync(value.root, { recursive: true, force: true }) }
})

test('restore requires the external photo fixture contract before any Docker mutation', (t) => {
  if (process.platform === 'win32' && !existsSync(shell)) return t.skip('POSIX shell unavailable on Windows')
  const value = fixture()
  try {
    assert.equal(run('backup.sh', value, backupArgs(value)).status, 0)
    const before = readLog(value)
    const result = run('restore.sh', value, ['--target-project', 'hr-axis-onprem-restore', '--backup-dir', shellPath(value.backupDir), '--source-project', 'hr-axis-onprem-core', '--receipt', shellPath(value.receipt), ...backupTrustArgs(value)])
    assert.notEqual(result.status, 0)
    assert.match(`${result.stdout}\n${result.stderr}`, /photo fixture|photo hash|required/i)
    assert.equal(existsSync(value.receipt), false)
    assert.equal(readLog(value), before)
  } finally { rmSync(value.root, { recursive: true, force: true }) }
})

test('restore rejects a writable recovery-handle ancestor before target recovery or Docker mutation', (t) => {
  if (process.platform === 'win32') return t.skip('Linux filesystem ownership/mode enforcement requires POSIX shell')
  const value = fixture()
  const writableParent = join(value.root, 'writable-handle-parent')
  const writableHandle = join(writableParent, 'photo-recovery.json')
  try {
    assert.equal(run('backup.sh', value, backupArgs(value)).status, 0)
    mkdirSync(writableParent, { recursive: true })
    writeFileSync(writableHandle, readFileSync(value.photoRecoveryHandle), { mode: 0o600 })
    chmodSync(writableParent, 0o777)
    const before = readLog(value)
    const result = run('restore.sh', value, ['--target-project', 'hr-axis-onprem-restore', '--backup-dir', shellPath(value.backupDir), '--source-project', 'hr-axis-onprem-core', '--receipt', shellPath(value.receipt), ...backupTrustArgs(value), ...photoArgsAt(value, writableHandle)])
    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.match(`${result.stdout}\n${result.stderr}`, /group\/world writable|recovery-handle-parent|trust/i)
    assert.equal(readLog(value), before)
    assert.equal(existsSync(value.receipt), false)
  } finally { rmSync(value.root, { recursive: true, force: true }) }
})

test('restore rejects group-readable recovery handles before target recovery or Docker mutation', (t) => {
  if (process.platform === 'win32') return t.skip('Linux filesystem ownership/mode enforcement requires POSIX shell')
  for (const mode of [0o440, 0o640]) {
    const value = fixture()
    const exposedHandle = join(value.root, `photo-recovery-${mode.toString(8)}.json`)
    try {
      assert.equal(run('backup.sh', value, backupArgs(value)).status, 0)
      writeFileSync(exposedHandle, readFileSync(value.photoRecoveryHandle), { mode })
      chmodSync(exposedHandle, mode)
      const before = readLog(value)
      const result = run('restore.sh', value, ['--target-project', 'hr-axis-onprem-restore', '--backup-dir', shellPath(value.backupDir), '--source-project', 'hr-axis-onprem-core', '--receipt', shellPath(value.receipt), ...backupTrustArgs(value), ...photoArgsAt(value, exposedHandle)])
      assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`)
      assert.match(`${result.stdout}\n${result.stderr}`, /photo recovery handle mode/i)
      assert.equal(readLog(value), before)
      assert.equal(existsSync(value.receipt), false)
    } finally { rmSync(value.root, { recursive: true, force: true }) }
  }
})

test('restore rejects a writable receipt ancestor before sealing or target Docker mutation', (t) => {
  if (process.platform === 'win32') return t.skip('Linux filesystem ownership/mode enforcement requires POSIX shell')
  const value = fixture()
  const writableGrandparent = join(value.root, 'writable-receipt-grandparent')
  const protectedParent = join(writableGrandparent, 'receipts')
  const unsafeReceipt = join(protectedParent, 'restore.json')
  try {
    assert.equal(run('backup.sh', value, backupArgs(value)).status, 0)
    mkdirSync(protectedParent, { recursive: true, mode: 0o700 })
    chmodSync(protectedParent, 0o700)
    chmodSync(writableGrandparent, 0o777)
    const before = readLog(value)
    const result = run('restore.sh', value, ['--target-project', 'hr-axis-onprem-restore', '--backup-dir', shellPath(value.backupDir), '--source-project', 'hr-axis-onprem-core', '--receipt', shellPath(unsafeReceipt), ...backupTrustArgs(value), ...photoArgsAt(value, value.photoRecoveryHandle)])
    assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.match(`${result.stdout}\n${result.stderr}`, /receipt-parent.*group\/world writable|receipt parent.*trust/i)
    assert.equal(readLog(value), before)
    assert.equal(existsSync(unsafeReceipt), false)
  } finally { rmSync(value.root, { recursive: true, force: true }) }
})

test('upgrade compatibility mismatch stops before target restore mutation', (t) => {
  if (process.platform === 'win32' && !existsSync(shell)) return t.skip('POSIX shell unavailable on Windows')
  const value = fixture({ compatibility: { schemaVersion: 1, releaseId: 'next-test', migrationTreeDigest: 'b'.repeat(64), upgradeCompatible: false, rollbackCompatible: true, compatibleFrom: [{ sourceReleaseId: 'release-test', sourceMigrationTreeDigest: 'a'.repeat(64) }] } })
  try {
    const backup = run('backup.sh', value, backupArgs(value))
    assert.equal(backup.status, 0, `${backup.stdout}\n${backup.stderr}`)
    const result = spawnSync(shell, [shellPath(join(operationDir, 'upgrade.sh')), '--bundle-root', shellPath(value.bundle), '--next-bundle-root', shellPath(value.nextBundle), '--release-id', 'release-test', '--next-release-id', 'next-test', '--source-project', 'hr-axis-onprem-core', '--target-project', 'hr-axis-onprem-upgrade', '--public-key', shellPath(value.publicKey), '--trusted-fingerprint', value.fingerprint, ...backupTrustArgs(value), '--env-file', shellPath(value.envFile), '--backup-dir', shellPath(value.backupDir), '--receipt', shellPath(value.receipt), ...photoArgs(value)], { encoding: 'utf8', env: envFor(value) })
    assert.notEqual(result.status, 0)
    assert.match(`${result.stdout}\n${result.stderr}`, /forward_repair_or_database_restore_required/)
    assert.doesNotMatch(readLog(value), /volume create|restore\.sh/)
  } finally { rmSync(value.root, { recursive: true, force: true }) }
})

test('upgrade loads every signed target archive and checks its config id before restore', (t) => {
  if (process.platform === 'win32' && !existsSync(shell)) return t.skip('POSIX shell unavailable on Windows')
  const value = fixture()
  try {
    const backup = run('backup.sh', value, backupArgs(value))
    assert.equal(backup.status, 0, `${backup.stdout}\n${backup.stderr}`)
    const args = [shellPath(join(operationDir, 'upgrade.sh')), '--bundle-root', shellPath(value.bundle), '--next-bundle-root', shellPath(value.nextBundle), '--release-id', 'release-test', '--next-release-id', 'next-test', '--source-project', 'hr-axis-onprem-core', '--target-project', 'hr-axis-onprem-upgrade', '--public-key', shellPath(value.publicKey), '--trusted-fingerprint', value.fingerprint, ...backupTrustArgs(value), '--env-file', shellPath(value.envFile), '--backup-dir', shellPath(value.backupDir), '--receipt', shellPath(value.receipt), ...photoArgs(value)]
    const result = spawnSync(shell, args, { encoding: 'utf8', env: envFor(value) })
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    const log = readLog(value)
    for (const name of ['backend', 'frontend', 'keycloak', 'caddy', 'postgres', 'redis', 'seaweedfs']) {
      assert.match(log, new RegExp(`load -i .*next-bundle[\\\\/]images[\\\\/]${name}\\.tar`))
      assert.match(log, new RegExp(`image inspect --format .*sha256:[0-9a-f]{64}`))
    }
    assert.match(readFileSync(value.receipt, 'utf8'), /"releaseId":"next-test"/)
  } finally { rmSync(value.root, { recursive: true, force: true }) }
})

test('rollback rejects a noncanonical target label collision before importing images', (t) => {
  if (process.platform === 'win32' && !existsSync(shell)) return t.skip('POSIX shell unavailable on Windows')
  const value = fixture()
  const nextEnv = join(value.root, 'next.env')
  try {
    const nextDigest = 'b'.repeat(64)
    writeFileSync(value.ledger, JSON.stringify({ project: 'hr-axis-onprem-core', releaseId: 'next-test', status: 'clean', dirty: false, orphanCount: 0, checksumValid: true, migrationTreeDigest: nextDigest }))
    writeFileSync(nextEnv, [
      'HR_AXIS_DATA_CLASS=synthetic', 'HR_AXIS_STRICT_LOCAL=true', 'HR_AXIS_RELEASE_ID=next-test',
      'COMPOSE_PROJECT_NAME=hr-axis-onprem-core', `MIGRATION_LEDGER_FILE=${shellPath(value.ledger)}`, `HR_AXIS_SECRET_ROOT=${shellPath(value.secretRoot)}`, `PHOTO_STORAGE_SECRET_ROOT=${shellPath(value.photoSecretRoot)}`, 'HR_AXIS_PUBLIC_HOST=offline.synthetic.invalid', 'KEYCLOAK_SYNTHETIC_ACCOUNTS_ENABLED=true', 'KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED=true',
    ].join('\n') + '\n')
    writeFileSync(join(value.state, 'project'), 'hr-axis-onprem-core')
    writeFileSync(join(value.state, 'release'), 'next-test')
    const backupArgsForNext = [
      '--bundle-root', shellPath(value.nextBundle), '--release-id', 'next-test', '--target-project', 'hr-axis-onprem-core',
      '--public-key', shellPath(value.publicKey), '--trusted-fingerprint', value.fingerprint,
      '--env-file', shellPath(nextEnv), ...backupArgs(value),
    ]
    const backup = spawnSync(shell, [shellPath(join(operationDir, 'backup.sh')), ...backupArgsForNext], { encoding: 'utf8', env: envFor(value, { RUNTIME_IMAGE_PREFIX: 'd' }) })
    assert.equal(backup.status, 0, `${backup.stdout}\n${backup.stderr}`)
    const before = readLog(value)
    const rollbackArgs = [
      '--bundle-root', shellPath(value.nextBundle), '--previous-bundle-root', shellPath(value.bundle), '--release-id', 'next-test', '--previous-release-id', 'release-test',
      '--source-project', 'hr-axis-onprem-core', '--target-project', 'hr-axis-onprem-upgrade', '--public-key', shellPath(value.publicKey), '--trusted-fingerprint', value.fingerprint,
      ...backupTrustArgs(value), '--env-file', shellPath(nextEnv), '--backup-dir', shellPath(value.backupDir), '--receipt', shellPath(value.receipt), ...photoArgs(value),
    ]
    const rollback = spawnSync(shell, [shellPath(join(operationDir, 'rollback.sh')), ...rollbackArgs], { encoding: 'utf8', env: envFor(value, { TARGET_COLLISION: '1' }) })
    assert.notEqual(rollback.status, 0, `${rollback.stdout}\n${rollback.stderr}`)
    const tail = readLog(value).slice(before.length)
    assert.match(tail, /ps -aq .*label=com\.docker\.compose\.project=hr-axis-onprem-upgrade/)
    assert.doesNotMatch(tail, /load -i|volume create|compose .*\b(?:up|run)\b/)
  } finally { rmSync(value.root, { recursive: true, force: true }) }
})

test('rollback authority allows a historical previous bundle with no forward compatibility claim', (t) => {
  if (process.platform === 'win32' && !existsSync(shell)) return t.skip('POSIX shell unavailable on Windows')
  const value = fixture({ previousCompatibility: { schemaVersion: 1, releaseId: 'release-test', migrationTreeDigest: 'a'.repeat(64), upgradeCompatible: false, rollbackCompatible: false, compatibleFrom: [] } })
  const nextEnv = join(value.root, 'next-authority.env')
  try {
    const nextDigest = 'b'.repeat(64)
    writeFileSync(value.ledger, JSON.stringify({ project: 'hr-axis-onprem-core', releaseId: 'next-test', status: 'clean', dirty: false, orphanCount: 0, checksumValid: true, migrationTreeDigest: nextDigest }))
    writeFileSync(nextEnv, [
      'HR_AXIS_DATA_CLASS=synthetic', 'HR_AXIS_STRICT_LOCAL=true', 'HR_AXIS_RELEASE_ID=next-test',
      'COMPOSE_PROJECT_NAME=hr-axis-onprem-core', `MIGRATION_LEDGER_FILE=${shellPath(value.ledger)}`, `HR_AXIS_SECRET_ROOT=${shellPath(value.secretRoot)}`, `PHOTO_STORAGE_SECRET_ROOT=${shellPath(value.photoSecretRoot)}`, 'HR_AXIS_PUBLIC_HOST=offline.synthetic.invalid', 'KEYCLOAK_SYNTHETIC_ACCOUNTS_ENABLED=true', 'KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED=true',
    ].join('\n') + '\n')
    writeFileSync(join(value.state, 'project'), 'hr-axis-onprem-core')
    writeFileSync(join(value.state, 'release'), 'next-test')
    const backupArgsForNext = [
      '--bundle-root', shellPath(value.nextBundle), '--release-id', 'next-test', '--target-project', 'hr-axis-onprem-core',
      '--public-key', shellPath(value.publicKey), '--trusted-fingerprint', value.fingerprint,
      '--env-file', shellPath(nextEnv), ...backupArgs(value),
    ]
    const backup = spawnSync(shell, [shellPath(join(operationDir, 'backup.sh')), ...backupArgsForNext], { encoding: 'utf8', env: envFor(value, { RUNTIME_IMAGE_PREFIX: 'd' }) })
    assert.equal(backup.status, 0, `${backup.stdout}\n${backup.stderr}`)
    const rollbackArgs = [
      '--bundle-root', shellPath(value.nextBundle), '--previous-bundle-root', shellPath(value.bundle), '--release-id', 'next-test', '--previous-release-id', 'release-test',
      '--source-project', 'hr-axis-onprem-core', '--target-project', 'hr-axis-onprem-restore', '--public-key', shellPath(value.publicKey), '--trusted-fingerprint', value.fingerprint,
      ...backupTrustArgs(value), '--env-file', shellPath(nextEnv), '--backup-dir', shellPath(value.backupDir), '--receipt', shellPath(value.receipt), ...photoArgs(value),
    ]
    const result = spawnSync(shell, [shellPath(join(operationDir, 'rollback.sh')), ...rollbackArgs], { encoding: 'utf8', env: envFor(value, { RUNTIME_IMAGE_PREFIX: 'd' }) })
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    const restoreArgs = readFileSync(value.restoreLog, 'utf8')
    assert.match(restoreArgs, new RegExp(`--rollback-authority-bundle-root ${shellPath(value.nextBundle).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
    assert.match(restoreArgs, /--rollback-authority-release-id next-test/)
  } finally { rmSync(value.root, { recursive: true, force: true }) }
})
