import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const workflowPath = '.github/workflows/onprem-offline-proof.yml'
const workflow = readFileSync(workflowPath, 'utf8')

function jobSection(name) {
  const marker = `  ${name}:`
  const start = workflow.indexOf(marker)
  assert.notEqual(start, -1, `missing ${name} job`)
  const nextMatch = workflow.slice(start + marker.length).match(/\n  [a-z][a-z0-9_]*:\s*\n/)
  const next = nextMatch ? start + marker.length + nextMatch.index : -1
  return workflow.slice(start, next === -1 ? workflow.length : next)
}

function stepSection(job, name) {
  const marker = `      - name: ${name}`
  const start = job.indexOf(marker)
  assert.notEqual(start, -1, `missing ${name} step`)
  const nextMatch = job.slice(start + marker.length).match(/\n      - name:/)
  const next = nextMatch ? start + marker.length + nextMatch.index : -1
  return job.slice(start, next === -1 ? job.length : next)
}

function heredocBody(section, marker) {
  const start = section.indexOf(marker)
  assert.ok(start >= 0, `missing heredoc marker: ${marker}`)
  const source = section.slice(start)
  const match = source.match(/node --input-type=module <<'NODE'\n([\s\S]*?)\n\s*NODE/)
  assert.ok(match, `missing Node heredoc for ${marker}`)
  return match[1]
}

function runProofValidator(run, { expectedSha, proofArtifactName }) {
  const build = jobSection('build_bundle')
  const body = heredocBody(build, 'Validate caller image-proof run before artifact download')
  const root = mkdtempSync(join(tmpdir(), 'onprem-offline-proof-validator-'))
  const script = join(root, 'validator.mjs')
  const output = join(root, 'github-output')
  writeFileSync(script, `globalThis.fetch = async () => ({ ok: true, json: async () => (${JSON.stringify(run)}) })\n${body}\n`)
  const result = spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      EXPECTED_SHA: expectedSha,
      PROOF_ARTIFACT_NAME: proofArtifactName,
      PROOF_RUN_ID: '31720253857',
      REPOSITORY: 'suleymankuncan-web/CODEX',
      GITHUB_TOKEN: 'synthetic-token',
      GITHUB_OUTPUT: output,
    },
  })
  const outputText = existsSync(output) ? readFileSync(output, 'utf8') : ''
  rmSync(root, { recursive: true, force: true })
  return { ...result, outputText }
}

test('offline proof is a two-job, source-free handoff workflow with pinned actions', () => {
  assert.match(workflow, /^name:\s*on-prem offline proof/m)
  assert.match(workflow, /workflow_call:/)
  assert.match(workflow, /workflow_dispatch:/)
  const jobs = workflow.slice(workflow.indexOf('\njobs:'))
  assert.deepEqual([...jobs.matchAll(/^  ([a-z][a-z0-9_]*)\s*:/gm)].map((match) => match[1]), [
    'build_bundle',
    'offline_rehearsal',
  ])
  for (const input of ['expected_sha', 'proof_artifact_name', 'proof_run_id']) {
    assert.match(workflow, new RegExp(`${input}:[\\s\\S]{0,220}?required:\\s*true`), input)
  }
  const actions = [...workflow.matchAll(/uses:\s*([^\s#]+)/g)].map((match) => match[1])
  assert.ok(actions.length >= 4)
  for (const action of actions) assert.match(action, /@[0-9a-f]{40}$/i, `action is not pinned: ${action}`)
})

test('build job checks out the trusted SHA, consumes proof evidence, and creates a signed seven-image bundle', () => {
  const build = jobSection('build_bundle')
  assert.doesNotMatch(build, /\[native code\]|\\function \(\)/)
  assert.match(build, /actions\/checkout@[0-9a-f]{40}/)
  assert.match(build, /ref:\s*\$\{\{\s*inputs\.expected_sha\s*\}\}/)
  assert.match(build, /test "\$\(git rev-parse HEAD\)" = "\$EXPECTED_SHA"/)
  assert.match(build, /actions\/download-artifact@[0-9a-f]{40}/)
  assert.match(build, /proof_artifact_name/)
  assert.match(build, /proof_run_id/)
  assert.match(build, /onprem-image-proof-/)
  assert.match(build, /docker save/)
  for (const image of ['backend', 'frontend', 'keycloak', 'caddy', 'postgres', 'redis', 'seaweedfs']) {
    assert.match(build, new RegExp(`images/${image}\\.tar`), `${image} archive is not staged`)
    assert.match(build, new RegExp(`\\b${image}\\b`), `${image} is not referenced`)
  }
  assert.match(build, /onprem-offline-stage\.mjs/)
  assert.match(build, /onprem-offline-bundle\.mjs\s+create/)
  assert.match(build, /verify\s+--bundle-dir/)
  assert.match(build, /generateKeyPairSync\(['"]ed25519['"]\)/)
  assert.match(build, /readFileSync[^\n]*from 'node:fs'/)
  assert.doesNotMatch(build, /createHash, createPublicKey, readFileSync } from 'node:crypto'/)
  assert.match(build, /SYFT_IMAGE/)
  assert.match(build, /TRIVY_IMAGE/)
  assert.match(build, /docker run[^\n]*\$SYFT_IMAGE/)
  assert.match(build, /docker run[^\n]*\$TRIVY_IMAGE/)
  assert.match(build, /hash\.update\([^\n]*\)\.update\('\\0'\)/)
  assert.match(build, /resolveMigrationSql/)
  assert.match(build, /readdirSync\('db\/migrations'\)\.filter\(\(file\) => file\.endsWith\('\.sql'\)\)\.sort\(\)/)
  assert.doesNotMatch(build, /walk\('db\/migrations'\)/)
  assert.match(build, /onprem-core-runtime-receipt\.json/)
  assert.match(build, /onprem-keycloak-runtime-receipt\.json/)
  assert.match(build, /onprem-photo-storage-runtime-receipt\.json/)
  assert.match(build, /copyContentGuardLayerReceipts\(root, output\)/)
  assert.match(build, /onprem-staged-\$\{name\}/)
  assert.match(build, /\['previous', previous[\s\S]*\['next', next/)
  assert.match(build, /same-build-lifecycle-mechanics/)
  assert.match(build, /registryManifestDigest/)
  assert.match(build, /sbomSha256/)
  assert.match(build, /vulnerabilitySha256/)
  assert.match(build, /licenseSha256/)
  assert.match(build, /configImageId/)
  assert.match(build, /private-key|privateKey/i)
  assert.match(build, /public-key|publicKey/i)
  assert.match(build, /fingerprint/i)
  assert.match(build, /upload-artifact@[0-9a-f]{40}/)
  assert.match(build, /name: onprem-offline-bundle-\$\{\{ inputs\.expected_sha \}\}/)
  assert.match(build, /name: onprem-offline-trust-\$\{\{ inputs\.expected_sha \}\}/)
  assert.match(build, /cp scripts\/onprem-offline-bootstrap-verify\.mjs "\$RUNNER_TEMP\/onprem-trust\/onprem-offline-bootstrap-verify\.mjs"/)
  assert.match(build, /bootstrap_sha256=.*sha256sum/)
  const uploadBlocks = [...build.matchAll(/uses:\s*actions\/upload-artifact@[\s\S]*?(?=\n\s*- name:|$)/g)].map((match) => match[0]).join('\n')
  assert.doesNotMatch(uploadBlocks, /private|signing-private/i)
})

test('offline rehearsal downloads only the bundle, cuts egress before verification, and never checks out source', () => {
  const rehearsal = jobSection('offline_rehearsal')
  assert.doesNotMatch(rehearsal, /actions\/checkout@/)
  assert.match(rehearsal, /actions\/download-artifact@[0-9a-f]{40}/)
  assert.match(rehearsal, /onprem-offline-bundle-/)
  assert.match(rehearsal, /sudo iptables -I OUTPUT 1 -j "\$host_egress_chain"/)
  assert.match(rehearsal, /sudo ip6tables -I OUTPUT 1 -j "\$host6_egress_chain"/)
  assert.match(rehearsal, /umask 077/)
  assert.match(rehearsal, /chmod 600/)
  assert.match(rehearsal, /MIGRATION_LEDGER_FILE/)
  assert.match(rehearsal, /MIGRATION_LEDGER_REQUIRED=true/)
  assert.doesNotMatch(rehearsal, /status["']:\s*["']clean["'][\s\S]{0,180}dirty["']:\s*false/)
  assert.match(rehearsal, /onprem\.store-manager\|onprem\.store-manager\|/)
  assert.match(rehearsal, /onprem\.visual-merchandiser\|onprem\.visual-merchandiser\|/)
  assert.match(rehearsal, /onprem\.photo-proof-admin\|onprem\.photo-proof-admin\|.*\|SUPER_ADMIN\|synthetic-employee-photo-proof-admin\|company-001\|region-001\|store-100\|company-001\|region-001\|store-100\|store-100/)
  assert.match(rehearsal, /keycloak\/photo-proof-account/)
  assert.match(rehearsal, /offline-photo-fixture\.webp/)
  assert.match(rehearsal, /base64 --decode/)
  assert.match(rehearsal, /chmod 400 "\$photo_fixture"/)
  assert.match(rehearsal, /OPERATOR_ROOT="\$SEALED_ROOT\/operator"/)
  assert.match(rehearsal, /sudo install -d -o 0 -g 0 -m 0700 "\$OPERATOR_ROOT"/)
  assert.match(rehearsal, /sudo cp -a -- "\$RUNNER_TEMP\/offline-secrets" "\$OPERATOR_ROOT\/secrets"/)
  assert.match(rehearsal, /sudo chmod 0400 "\$OPERATOR_ROOT\/photo-fixture\.webp"/)
  assert.match(rehearsal, /sudo cp -a -- "\$OPERATOR_ROOT\/receipts\/\." "\$RUNNER_TEMP\/offline-receipts\/"/)
  assert.match(rehearsal, /chmod 700 "\$RUNNER_TEMP\/offline-receipts"/)
  assert.match(rehearsal, /PHOTO_MEDIA_SYNTHETIC_FIXTURE_SHA256_ALLOWLIST=\$\{photoFixtureSha256\}/)
  assert.match(rehearsal, /postgresql:\/\//)
  assert.match(rehearsal, /redis:\/\//)
  assert.match(rehearsal, /user health on/)
  assert.match(rehearsal, /user api on/)
  assert.match(rehearsal, /user worker on/)
  assert.match(rehearsal, /-flushall -flushdb -swapdb -migrate/)
  assert.match(rehearsal, /subjectAltName=DNS:offline\.synthetic\.invalid/)
  assert.match(rehearsal, /subjectAltName=DNS:postgres/)
  assert.match(rehearsal, /openssl rand -hex/)
  assert.doesNotMatch(rehearsal, /personas":\[\]/)
  assert.match(rehearsal, /KEYCLOAK_SYNTHETIC_ACCOUNTS_ENABLED=true/)
  assert.match(rehearsal, /KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED=true/)
  for (const operation of ['preflight', 'install', 'migrate', 'activate', 'smoke', 'backup', 'restore']) {
    assert.match(rehearsal, new RegExp(`operations/${operation}\\.sh"[^\\n]*--proof-compose "\\$BUNDLE_ROOT/deployment/proof\\.compose\\.yaml"`), `${operation} receives the exact proof overlay`)
  }
  assert.match(rehearsal, /operations\/upgrade\.sh"[^\n]*--proof-compose "\$NEXT_BUNDLE_ROOT\/deployment\/proof\.compose\.yaml"/)
  assert.match(rehearsal, /operations\/rollback\.sh"[^\n]*--proof-compose "\$PREVIOUS_BUNDLE_ROOT\/deployment\/proof\.compose\.yaml"/)
  assert.match(rehearsal, /--compose "\$BUNDLE_ROOT\/deployment\/compose\.yaml" --compose "\$BUNDLE_ROOT\/deployment\/compose\.photo-proof\.yaml" --compose "\$BUNDLE_ROOT\/deployment\/photo-compose\.yaml" --compose "\$BUNDLE_ROOT\/deployment\/proof\.compose\.yaml"/)
  assert.match(rehearsal, /no repo|no source|GITHUB_WORKSPACE.*\.git|repo.*dirs/i)
  const bootstrap = rehearsal.indexOf('sudo -- "$NODE_BIN" "$TRUSTED_BOOTSTRAP" verify')
  const verify = rehearsal.search(/offline-bundle\.mjs["']?\s+verify/)
  const install = rehearsal.indexOf('operations/install.sh')
  assert.ok(bootstrap >= 0 && verify > bootstrap && install > verify, 'external bootstrap and bundle verification must precede bundled install/docker load')
  for (const operation of ['preflight.sh', 'install.sh', 'migrate.sh', 'activate.sh', 'smoke.sh', 'backup.sh', 'restore.sh', 'upgrade.sh', 'rollback.sh']) {
    assert.match(rehearsal, new RegExp(`operations/${operation.replace('.', '\\.')}`), operation)
  }
  assert.doesNotMatch(rehearsal, /sudo .*operations\/(?:preflight|install|migrate|activate|smoke|backup|restore|upgrade|rollback)\.sh[^\n]*\$RUNNER_TEMP\/offline/)
  assert.match(rehearsal, /onprem-offline-target-proof\.mjs[\s\S]*--require-complete[\s\S]*--photo-fixture[\s\S]*--photo-sha256/)
  assert.match(rehearsal, /photo\.canonicalIdentityVerified !== true/)
  assert.match(rehearsal, /sudo "\$BUNDLE_ROOT\/operations\/preflight\.sh"/)
  assert.match(rehearsal, /sudo "\$BUNDLE_ROOT\/operations\/install\.sh"/)
  assert.match(rehearsal, /sudo "\$BUNDLE_ROOT\/operations\/migrate\.sh"/)
  assert.match(rehearsal, /sudo "\$BUNDLE_ROOT\/operations\/activate\.sh"/)
  assert.match(rehearsal, /sudo "\$BUNDLE_ROOT\/operations\/smoke\.sh"/)
  assert.match(rehearsal, /sudo "\$BUNDLE_ROOT\/operations\/backup\.sh"/)
  assert.match(rehearsal, /sudo "\$BUNDLE_ROOT\/operations\/restore\.sh"/)
  assert.match(rehearsal, /sudo "\$BUNDLE_ROOT\/operations\/upgrade\.sh"/)
  assert.match(rehearsal, /sudo "\$BUNDLE_ROOT\/operations\/rollback\.sh"/)
  assert.match(rehearsal, /operations\.json/)
  assert.match(rehearsal, /bundleManifests[\s\S]*current[\s\S]*next[\s\S]*previous/)
  assert.match(rehearsal, /\$RECEIPT_ROOT\/backup\.json/)
  assert.match(rehearsal, /\$RECEIPT_ROOT\/(?:restore|upgrade|rollback)\.json/)
  assert.match(rehearsal, /operations\/smoke\.sh[\s\S]*operation: 'smoke'[\s\S]*status: 'passed'/)
  assert.match(rehearsal, /operation: 'upgrade-mechanics'/)
  assert.match(rehearsal, /operation: 'rollback-mechanics'/)
  assert.match(rehearsal, /evidenceScope: 'same-build-lifecycle-mechanics'/)
  assert.match(rehearsal, /realVersionTransitionProved: false/)
  assert.match(rehearsal, /incompatibleMigrationHandlingProved: false/)
  assert.doesNotMatch(rehearsal, /operation: 'upgrade',\s*status: 'passed'/)
  assert.doesNotMatch(rehearsal, /operation: 'rollback',\s*status: 'passed'/)
  assert.match(rehearsal, /const expected = \{[\s\S]*smoke:[\s\S]*backup:[\s\S]*restore:[\s\S]*upgrade:[\s\S]*rollback:[\s\S]*'photo-prebackup':/)
  assert.match(rehearsal, /value\.operation !== operation[\s\S]*value\.status !== status[\s\S]*value\.releaseId !== expectedRelease[\s\S]*value\.sourceProject !== sourceProject[\s\S]*value\.targetProject !== targetProject/)
  assert.match(rehearsal, /com\.hr-axis\.data-class=synthetic/)
  assert.ok(rehearsal.indexOf('operations/install.sh') < rehearsal.indexOf('operations/migrate.sh'))
  assert.ok(rehearsal.indexOf('operations/migrate.sh') < rehearsal.indexOf('operations/activate.sh'))
  assert.ok(rehearsal.indexOf('operations/activate.sh') < rehearsal.indexOf('operations/smoke.sh'))
  for (const forbidden of [/git\s+(checkout|clone|pull|fetch)/i, /npm(?:\.cmd)?\s+(install|ci|run|exec)/i, /docker\s+build/i, /docker\s+pull/i, /\bcurl\b/i, /\bwget\b/i]) {
    assert.doesNotMatch(rehearsal, forbidden)
  }
  assert.match(rehearsal, /--pull never/)
  assert.match(rehearsal, /--backup-private-key/)
  assert.match(rehearsal, /--backup-public-key/)
  assert.match(rehearsal, /--backup-trusted-fingerprint/)
  assert.match(rehearsal, /onprem-next-/)
  assert.match(rehearsal, /onprem-previous-/)
  assert.match(rehearsal, /commandsCompleteBeforeEgressRestore: true/)
  assert.match(rehearsal, /target_gate_status=0/)
  assert.match(rehearsal, /photoAdminAuthenticated !== true[\s\S]*nonSuperAdminDenied !== true[\s\S]*repeatReadExact !== true/)
  assert.match(rehearsal, /--photo-mode prepare --photo-recovery-handle-file "\$photo_recovery_handle"/)
  assert.match(rehearsal, /photoRecoveryHandleSha256|photoContentSha256|photoContentLength/)
  assert.match(rehearsal, /recoveredPreBackupPhoto !== true/)
  assert.ok(rehearsal.indexOf('--photo-mode prepare') < rehearsal.indexOf('operations/backup.sh'), 'pre-backup prepare proof must precede backup')
  for (const operation of ['backup', 'restore', 'upgrade', 'rollback']) {
    assert.match(rehearsal, new RegExp(`operations/${operation}\\.sh[^\\n]*--photo-recovery-handle-file "\\$photo_recovery_handle"`), `${operation} receives the recovery handle`)
  }
  assert.match(rehearsal, /photo-recovery\.json/)
  assert.match(rehearsal, /Quiesce exact rehearsal runtimes before restoring egress[\s\S]*Restore runner egress only after runtime quiescence[\s\S]*Upload sanitized offline rehearsal receipt/)
  assert.match(rehearsal, /cleanup|remove|down/i)
  assert.match(rehearsal, /sanitized|receipt/i)
  const envCopies = rehearsal.indexOf('for release in previous current next')
  const ownerKey = rehearsal.indexOf('owner_key_source=')
  const rootChown = rehearsal.indexOf('sudo find "$OPERATOR_ROOT" -exec chown 0:0')
  assert.ok(envCopies >= 0 && ownerKey > envCopies && rootChown > ownerKey, 'all envs and backup key must exist before root ownership hardening')
  const backupCommand = rehearsal.indexOf('operations/backup.sh')
  const backupReceipt = rehearsal.indexOf('$RECEIPT_ROOT/backup.json')
  assert.ok(backupCommand >= 0 && backupReceipt > backupCommand, 'backup receipt must be generated after backup artifacts')
  assert.doesNotMatch(rehearsal, /docker network rm[^\n]*\|\| true/)
  for (const project of ['hr-axis-onprem-core', 'hr-axis-onprem-restore', 'hr-axis-onprem-upgrade', 'hr-axis-onprem-rollback']) {
    assert.match(rehearsal, new RegExp(`docker ps -aq[^\\n]*com\.docker\.compose\.project=\\$project`), project)
    assert.match(rehearsal, new RegExp(`docker volume ls -q[^\\n]*com\.docker\.compose\.project=\\$project`), project)
    assert.match(rehearsal, new RegExp(`docker network ls -q[^\\n]*com\.docker\.compose\.project=\\$project`), project)
  }
})

test('offline rehearsal keeps the ordered operator calls privileged and exactly once', () => {
  const rehearsal = jobSection('offline_rehearsal')
  const operators = ['preflight', 'install', 'migrate', 'activate', 'smoke', 'backup', 'restore', 'upgrade', 'rollback']
  const positions = []
  for (const operator of operators) {
    const expression = new RegExp(`sudo \\\"\\$[^\\n]*?/operations/${operator}\\.sh\\\"`, 'g')
    const calls = [...rehearsal.matchAll(expression)]
    assert.equal(calls.length, 1, `${operator}.sh must run exactly once under sudo`)
    positions.push(calls[0].index)
  }
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'operator calls must preserve install/migrate/activate/smoke/backup order')
  assert.match(rehearsal, /sudo -- "\$NODE_BIN" "\$BUNDLE_ROOT\/operations\/onprem-offline-target-proof\.mjs"/)
  assert.equal((rehearsal.match(/sudo -- "\$NODE_BIN" "\$BUNDLE_ROOT\/operations\/onprem-offline-target-proof\.mjs"/g) ?? []).length, 1)
  assert.doesNotMatch(rehearsal, /target_gate_status=\$\?/)
  assert.doesNotMatch(rehearsal, /(?:^|\s)(?<!sudo )"\$BUNDLE_ROOT\/operations\/(?:preflight|install|migrate|activate|smoke|backup|restore|upgrade|rollback)\.sh"/m)
})

test('restore, upgrade, and rollback remain complete photo-gated operations', () => {
  const rehearsal = jobSection('offline_rehearsal')
  const identities = {
    restore: ['--release-id "$RELEASE_ID"', '--target-project hr-axis-onprem-restore', '--source-project hr-axis-onprem-core', '--source-release-id "$RELEASE_ID"'],
    upgrade: ['--release-id "$RELEASE_ID"', '--next-release-id "onprem-next-$release_suffix"', '--source-project hr-axis-onprem-core', '--target-project hr-axis-onprem-upgrade'],
    rollback: ['--release-id "$RELEASE_ID"', '--previous-release-id "onprem-previous-$release_suffix"', '--source-project hr-axis-onprem-core', '--target-project hr-axis-onprem-rollback'],
  }
  for (const operator of Object.keys(identities)) {
    const calls = [...rehearsal.matchAll(new RegExp(`sudo "[^\\n]+/operations/${operator}\\.sh"[^\\n]+`, 'g'))]
    assert.equal(calls.length, 1, `${operator}.sh must have one workflow invocation`)
    const call = calls[0][0]
    for (const identity of identities[operator]) assert.match(call, new RegExp(identity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${operator}.sh identity ${identity}`)
    assert.match(call, /--photo-fixture "\$photo_fixture"/, `${operator}.sh photo fixture`)
    assert.match(call, /--photo-sha256 "\$photo_fixture_sha256"/, `${operator}.sh photo digest`)
  }
})

test('workflow Node heredocs are complete modules and contain no native-code escape hatch', () => {
  const lines = workflow.split(/\r?\n/)
  const blocks = []
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^\s*(?:sudo\s+(?:--\s+)?)?(?:node\b|"\$NODE_BIN").*<<['"]NODE['"]\s*$/.test(lines[index])) continue
    const body = []
    index += 1
    while (index < lines.length && !/^\s*NODE\s*$/.test(lines[index])) {
      body.push(lines[index])
      index += 1
    }
    assert.ok(index < lines.length, 'every Node heredoc must have a closing NODE marker')
    blocks.push(body.join('\n'))
  }
  assert.ok(blocks.length >= 8, 'workflow must retain all explicit Node heredocs')
  assert.doesNotMatch(workflow, /\[native code\]|new\s+Function\s*\(|\beval\s*\(/i)
  const root = mkdtempSync(join(tmpdir(), 'onprem-offline-workflow-heredocs-'))
  try {
    blocks.forEach((body, index) => {
      const pathname = join(root, `${index}.mjs`)
      writeFileSync(pathname, `${body}\n`)
      const result = spawnSync(process.execPath, ['--check', pathname], { encoding: 'utf8' })
      assert.equal(result.status, 0, `Node heredoc ${index} is not syntactically valid: ${result.stderr}`)
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('offline source and receipt ordering remains fail-closed', () => {
  const rehearsal = jobSection('offline_rehearsal')
  const build = jobSection('build_bundle')
  const verify = rehearsal.indexOf('offline-bundle.mjs" verify')
  const install = rehearsal.indexOf('operations/install.sh')
  const backup = rehearsal.indexOf('operations/backup.sh')
  const backupReceipt = rehearsal.indexOf('$RECEIPT_ROOT/backup.json')
  const quiesce = workflow.indexOf('Quiesce exact rehearsal runtimes before restoring egress')
  const restore = workflow.indexOf('Restore runner egress only after runtime quiescence')
  const upload = workflow.indexOf('Upload sanitized offline rehearsal receipt')
  const cleanup = workflow.indexOf('Clean exact rehearsal targets')
  assert.ok(verify >= 0 && verify < install, 'bundle verification must precede any operator mutation')
  assert.ok(backup >= 0 && backupReceipt > backup, 'backup receipt must follow explicit backup output checks')
  assert.ok(quiesce > 0 && quiesce < restore && restore < upload && upload < cleanup, 'runtime quiescence must precede egress restoration, upload, and final cleanup')
  const quiesceSection = workflow.slice(quiesce, restore)
  assert.match(quiesceSection, /docker rm -f/)
  assert.match(quiesceSection, /docker network rm/)
  assert.match(quiesceSection, /test -z .*docker ps -aq/)
  assert.match(quiesceSection, /test -z .*docker network ls -q/)
  assert.match(workflow.slice(restore, upload), /test -f "\$RUNNER_TEMP\/offline-runtime-quiesced"/)
  assert.match(rehearsal, /sudo test -s "\$BACKUP_ROOT\/backup\/backup-manifest\.json"/)
  assert.match(rehearsal, /sudo test -s "\$BACKUP_ROOT\/backup\/backup-signature\.json"/)
  assert.match(rehearsal, /sudo test -s "\$BACKUP_ROOT\/backup\/SHA256SUMS"/)
  assert.match(rehearsal, /bundleManifests: \{ current: manifestDigests\.current, next: manifestDigests\.next, previous: manifestDigests\.previous \}/)
  assert.match(rehearsal, /manifestSha256: manifestDigests\[manifestName\]/)
  assert.match(rehearsal, /sensitive_paths=\(/)
  assert.match(rehearsal, /sudo rm -rf -- "\$sensitive_path"/)
  assert.match(rehearsal, /sudo test -e "\$sensitive_path" \|\| sudo test -L "\$sensitive_path"/)
  assert.match(rehearsal, /label=com\.docker\.compose\.project=\$project[^\n]*label=com\.hr-axis\.project=\$project/)
  assert.match(rehearsal, /offline cleanup failed \(status=/)
  assert.doesNotMatch(build, /MIGRATION_LEDGER_FILE=.*migration-ledger\.json[^\n]*write/i)
  assert.match(build, /resolveMigrationSql/)
  assert.match(build, /migrationFiles = readdirSync\('db\/migrations'\)\.filter\(\(file\) => file\.endsWith\('\.sql'\)\)\.sort\(\)/)
})

test('final cleanup is self-contained in its fresh shell and removes the fixed sealed root', () => {
  const cleanup = workflow.slice(workflow.indexOf('Clean exact rehearsal targets'))
  assert.doesNotMatch(cleanup, /\$OPERATOR_ROOT/)
  assert.match(cleanup, /\/var\/lib\/hr-axis-onprem-offline-proof\/\$\{GITHUB_RUN_ID\}-\$\{GITHUB_RUN_ATTEMPT\}/)
  assert.match(cleanup, /sudo rm -rf -- "\$sensitive_path"/)
})

test('workflow does not mount or copy the source repository into the offline bundle', () => {
  const build = jobSection('build_bundle')
  const rehearsal = jobSection('offline_rehearsal')
  assert.doesNotMatch(build, /docker\s+(?:run|create)[^\n]*(?:-v|--volume)[^\n]*(?:GITHUB_WORKSPACE|\$PWD)/i)
  assert.doesNotMatch(rehearsal, /(?:-v|--volume)[^\n]*(?:GITHUB_WORKSPACE|\$PWD)[^\n]*(?:app|src|repo)/i)
  assert.match(build, /source-free|source free|no source/i)
})

test('caller proof run identity is validated through GitHub REST before artifact download', () => {
  const build = jobSection('build_bundle')
  const validation = build.indexOf('Validate caller image-proof run before artifact download')
  const download = build.indexOf('actions/download-artifact@')
  assert.ok(validation >= 0 && validation < download, 'caller proof validation must precede artifact download')
  const block = build.slice(validation, download)
  assert.match(block, /GITHUB_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/)
  assert.match(block, /fetch\(endpoint/)
  assert.match(block, /Authorization:\s*`Bearer \$\{token\}`/)
  assert.match(block, /run\?\.repository\?\.full_name\s*!==\s*repository/)
  assert.match(block, /required-release-gate\.yml/)
  assert.match(block, /Required Release Gate/)
  assert.match(block, /referenced_workflows/)
  assert.match(block, /onprem-image-proof\.yml/)
  assert.match(block, /executionSha/)
  assert.match(block, /GITHUB_OUTPUT/)
  assert.match(block, /run\?\.status\s*!==\s*'completed'/)
  assert.match(block, /run\?\.conclusion\s*!==\s*'success'/)
  assert.match(block, /run\?\.head_sha\s*!==\s*expectedSha/)
  assert.doesNotMatch(block, /response\.text\(|console\.error\(|response\.body/)
  assert.match(block, /PROOF_ARTIFACT_NAME/)
  const artifactCheck = build.indexOf('test "$PROOF_ARTIFACT_NAME" = "onprem-image-proof-${EXECUTION_SHA}"')
  assert.ok(artifactCheck > download, 'exact expected proof artifact name must remain enforced')
  assert.match(build, /id:\s*validate_proof_run/)
  assert.match(build, /onprem-image-proof-\$\{\{\s*steps\.validate_proof_run\.outputs\.execution_sha\s*\}\}/)
  assert.match(build, /onprem-core-runtime-proof-\$\{\{\s*steps\.validate_proof_run\.outputs\.execution_sha\s*\}\}/)
  assert.match(build, /onprem-keycloak-runtime-proof-\$\{\{\s*steps\.validate_proof_run\.outputs\.execution_sha\s*\}\}/)
  assert.match(build, /onprem-photo-storage-proof-\$\{\{\s*steps\.validate_proof_run\.outputs\.execution_sha\s*\}\}/)

  const executionShaExpression = '${{ steps.validate_proof_run.outputs.execution_sha }}'
  const downloadSteps = [
    ['Download upstream image proof artifact', `onprem-image-proof-${executionShaExpression}`],
    ['Download upstream core runtime proof', `onprem-core-runtime-proof-${executionShaExpression}`],
    ['Download upstream keycloak runtime proof', `onprem-keycloak-runtime-proof-${executionShaExpression}`],
    ['Download upstream photo-storage proof', `onprem-photo-storage-proof-${executionShaExpression}`],
  ].map(([name, artifactName]) => ({ name, artifactName, block: stepSection(build, name) }))
  assert.equal((build.match(/actions\/download-artifact@[0-9a-f]{40}/g) ?? []).length, 4, 'build must use four exact artifact downloads')
  assert.doesNotMatch(build, /pattern:\s*\|/, 'exact downloads must not use a multiline pattern')
  for (const { name, artifactName, block } of downloadSteps) {
    assert.match(block, /uses:\s*actions\/download-artifact@[0-9a-f]{40}/, name)
    const nameLines = block.split(/\r?\n/).filter((line) => line.startsWith('          name: '))
    assert.deepEqual(nameLines, [`          name: ${artifactName}`], `${name} must bind one exact artifact name`)
    assert.match(block, /github-token:\s*\$\{\{\s*github\.token\s*\}\}/, name)
    assert.match(block, /run-id:\s*\$\{\{\s*inputs\.proof_run_id\s*\}\}/, name)
    assert.match(block, /merge-multiple:\s*true/, name)
    assert.match(block, /path:\s*\$\{\{\s*runner\.temp\s*\}\}\/onprem-proof-download/, name)
    assert.doesNotMatch(block, /pattern:|continue-on-error:\s*true|if:\s*always\(\)/, `${name} must fail closed when its exact artifact is missing`)
  }
})

test('caller proof validator accepts reusable parent provenance and preserves standalone image-proof acceptance', () => {
  const expectedSha = 'a'.repeat(40)
  const executionSha = 'b'.repeat(40)
  const parentRun = {
    repository: { full_name: 'suleymankuncan-web/CODEX' },
    event: 'pull_request',
    path: '.github/workflows/required-release-gate.yml',
    name: 'Required Release Gate',
    status: 'completed',
    conclusion: 'success',
    head_sha: expectedSha,
    referenced_workflows: [
      {
        path: `suleymankuncan-web/CODEX/.github/workflows/release-check.yml@${executionSha}`,
        sha: executionSha,
        ref: 'refs/pull/1062/merge',
      },
      {
        path: `suleymankuncan-web/CODEX/.github/workflows/onprem-image-proof.yml@${executionSha}`,
        sha: executionSha,
        ref: 'refs/pull/1062/merge',
      },
    ],
  }
  const parent = runProofValidator(parentRun, {
    expectedSha,
    proofArtifactName: `onprem-image-proof-${executionSha}`,
  })
  assert.equal(parent.status, 0, parent.stderr)
  assert.match(parent.outputText, new RegExp(`^execution_sha=${executionSha}$`, 'm'))

  const standaloneRun = {
    ...parentRun,
    event: 'workflow_dispatch',
    path: '.github/workflows/onprem-image-proof.yml',
    name: 'on-prem image proof',
    referenced_workflows: [],
  }
  const standalone = runProofValidator(standaloneRun, {
    expectedSha,
    proofArtifactName: `onprem-image-proof-${expectedSha}`,
  })
  assert.equal(standalone.status, 0, standalone.stderr)
  assert.match(standalone.outputText, new RegExp(`^execution_sha=${expectedSha}$`, 'm'))
})

test('caller proof validator rejects missing, wrong, or duplicate image-proof references and wrong execution artifacts', () => {
  const expectedSha = 'a'.repeat(40)
  const executionSha = 'b'.repeat(40)
  const reference = {
    path: `suleymankuncan-web/CODEX/.github/workflows/onprem-image-proof.yml@${executionSha}`,
    sha: executionSha,
    ref: 'refs/pull/1062/merge',
  }
  const parentRun = {
    repository: { full_name: 'suleymankuncan-web/CODEX' },
    event: 'pull_request',
    path: '.github/workflows/required-release-gate.yml',
    name: 'Required Release Gate',
    status: 'completed',
    conclusion: 'success',
    head_sha: expectedSha,
    referenced_workflows: [reference],
  }
  const cases = [
    ['missing reference', { referenced_workflows: [] }],
    ['wrong repository', { referenced_workflows: [{ ...reference, path: `other/CODEX/.github/workflows/onprem-image-proof.yml@${executionSha}` }] }],
    ['wrong path', { referenced_workflows: [{ ...reference, path: `suleymankuncan-web/CODEX/.github/workflows/other.yml@${executionSha}` }] }],
    ['duplicate reference', { referenced_workflows: [reference, { ...reference }] }],
    ['valid plus branch suffix', { referenced_workflows: [reference, { ...reference, path: `suleymankuncan-web/CODEX/.github/workflows/onprem-image-proof.yml@main` }] }],
    ['valid plus tag suffix', { referenced_workflows: [reference, { ...reference, path: `suleymankuncan-web/CODEX/.github/workflows/onprem-image-proof.yml@v2` }] }],
    ['valid plus malformed suffix', { referenced_workflows: [reference, { ...reference, path: 'suleymankuncan-web/CODEX/.github/workflows/onprem-image-proof.yml@not-a-sha' }] }],
    ['mismatched reference sha', { referenced_workflows: [{ ...reference, sha: 'c'.repeat(40) }] }],
    ['invalid reference ref', { referenced_workflows: [{ ...reference, ref: 'main' }] }],
    ['missing event', { event: undefined }],
    ['wrong event', { event: 'workflow_dispatch' }],
    ['wrong artifact execution sha', {}, `onprem-image-proof-${expectedSha}`],
  ]
  for (const [label, overrides, artifact = `onprem-image-proof-${executionSha}`] of cases) {
    const result = runProofValidator({ ...parentRun, ...overrides }, {
      expectedSha,
      proofArtifactName: artifact,
    })
    assert.notEqual(result.status, 0, `${label} must fail closed`)
    assert.match(result.stderr, /image proof (?:run identity|artifact identity|run referenced workflow identity) mismatch/i, label)
  }
})

test('offline rehearsal seals downloaded bundle and trust material under a fresh root-owned /var/lib root', () => {
  const rehearsal = jobSection('offline_rehearsal')
  assert.match(rehearsal, /SEALED_PARENT=\/var\/lib\/hr-axis-onprem-offline-proof/)
  assert.match(rehearsal, /SEALED_ROOT="\$SEALED_PARENT\/\$\{GITHUB_RUN_ID\}-\$\{GITHUB_RUN_ATTEMPT\}"/)
  assert.match(rehearsal, /if sudo test -e "\$SEALED_ROOT" \|\| sudo test -L "\$SEALED_ROOT"/)
  assert.match(rehearsal, /sudo install -d -o 0 -g 0 -m 0755 "\$SEALED_ROOT\/bundle" "\$SEALED_ROOT\/trust"/)
  assert.match(rehearsal, /sudo cp -a -- "\$INCOMING_BUNDLE_ROOT\/\." "\$SEALED_ROOT\/bundle\/"/)
  assert.match(rehearsal, /sudo cp -a -- "\$INCOMING_TRUST_ROOT\/\." "\$SEALED_ROOT\/trust\/"/)
  assert.match(rehearsal, /sudo find "\$SEALED_ROOT" -exec chown 0:0 \{\} \+/)
  assert.match(rehearsal, /find "\$SEALED_ROOT" -type l/)
  assert.match(rehearsal, /find "\$SEALED_ROOT".*! -uid 0.*! -gid 0/)
  assert.match(rehearsal, /find "\$SEALED_ROOT".*-type f.*-type d.*-perm \/022/)
  assert.doesNotMatch(rehearsal, /^\s*BUNDLE_ROOT="\$RUNNER_TEMP\/offline-incoming/m)
  for (const root of ['BUNDLE_ROOT', 'NEXT_BUNDLE_ROOT', 'PREVIOUS_BUNDLE_ROOT', 'TRUST_ROOT']) {
    assert.match(rehearsal, new RegExp(`${root}=[^\\n]*\\$SEALED_ROOT`), `${root} must use sealed root`)
  }
  assert.match(rehearsal, /PUBLIC_KEY="\$TRUST_ROOT\/public-key\.pem"/)
  assert.match(rehearsal, /TRUSTED_BOOTSTRAP="\$TRUST_ROOT\/onprem-offline-bootstrap-verify\.mjs"/)
  assert.match(rehearsal, /sha256sum "\$TRUSTED_BOOTSTRAP"/)
  assert.match(rehearsal, /sudo -- "\$NODE_BIN" "\$TRUSTED_BOOTSTRAP" verify --bundle-dir "\$BUNDLE_ROOT" --release-id "\$RELEASE_ID"/)
  assert.match(rehearsal, /sudo -- "\$NODE_BIN" "\$TRUSTED_BOOTSTRAP" verify --bundle-dir "\$NEXT_BUNDLE_ROOT" --release-id "onprem-next-\$release_suffix"/)
  assert.match(rehearsal, /sudo -- "\$NODE_BIN" "\$TRUSTED_BOOTSTRAP" verify --bundle-dir "\$PREVIOUS_BUNDLE_ROOT" --release-id "onprem-previous-\$release_suffix"/)
  assert.match(rehearsal, /NODE_BIN="\$TRUST_ROOT\/node"/)
  assert.match(rehearsal, /sudo install -o 0 -g 0 -m 0755 -- "\$PINNED_NODE_SOURCE" "\$SEALED_ROOT\/trust\/node"/)
  assert.match(rehearsal, /test "\$\(sudo -- "\$NODE_BIN" --version\)" = v24\.19\.0/)
  assert.doesNotMatch(rehearsal, /sudo node(?:\s|$)/)
  assert.match(rehearsal, /\/var\/lib\/hr-axis-onprem-offline-proof\/\$\{GITHUB_RUN_ID\}-\$\{GITHUB_RUN_ATTEMPT\}/)
  assert.match(rehearsal, /sudo test -e "\$sensitive_path" \|\| sudo test -L "\$sensitive_path"/)
})

test('offline rehearsal enforces Docker and host IPv4/IPv6 egress with bound negative probes', () => {
  const rehearsal = jobSection('offline_rehearsal')
  const dockerChain = rehearsal.match(/docker_egress_chain=([A-Z0-9_]+)/)?.[1]
  assert.equal(dockerChain, 'HR_AXIS_OFF_DOCKER_EGRESS')
  assert.ok(dockerChain.length <= 28, `iptables chain name exceeds the Linux 28-character limit: ${dockerChain}`)
  assert.doesNotMatch(rehearsal, /HR_AXIS_OFFLINE_DOCKER_EGRESS/)
  assert.match(rehearsal, /sudo iptables -N "\$docker_egress_chain"/)
  assert.match(rehearsal, /sudo iptables -I DOCKER-USER 1 -j "\$docker_egress_chain"/)
  assert.match(rehearsal, /sudo iptables -I FORWARD 1 -j "\$docker_egress_chain"/)
  assert.match(rehearsal, /-i br\+ -o br\+ -j ACCEPT/)
  assert.match(rehearsal, /-i docker0 -o docker0 -j ACCEPT/)
  assert.match(rehearsal, /-i br\+ -o docker0 -j ACCEPT/)
  assert.match(rehearsal, /-i docker0 -o br\+ -j ACCEPT/)
  assert.match(rehearsal, /-i br\+ ! -o br\+ -m conntrack --ctstate NEW -j REJECT/)
  assert.doesNotMatch(rehearsal, /-i br\+ ! -o br\+ ! -o docker0/)
  assert.match(rehearsal, /-i docker0 ! -o docker0 -m conntrack --ctstate NEW -j REJECT/)
  assert.match(rehearsal, /docker_egress_rules=.*iptables -S/)
  assert.match(rehearsal, /for hook in DOCKER-USER FORWARD/)
  assert.match(rehearsal, /reject_rule_line=6/)
  assert.match(rehearsal, /iptables -L "\$docker_egress_chain" -v -x -n --line-numbers/)
  assert.match(rehearsal, /reject_rule_text=.*REJECT/)
  assert.match(rehearsal, /reject_packets_before=.*read_reject_packets/)
  assert.match(rehearsal, /reject_packets_after=.*read_reject_packets/)
  assert.match(rehearsal, /test "\$reject_packets_after" -gt "\$reject_packets_before"/)
  assert.match(rehearsal, /packets=.*awk.*REJECT/)
  assert.match(rehearsal, /printf '%s\\n' "\$packets" \| grep -Eq '\^\[0-9\]\+\$'[\s\S]*printf '%s\\n' "\$packets"/)
  assert.match(rehearsal, /docker_reject_counter_delta=\$\(\(reject_packets_after - reject_packets_before\)\)/)
  assert.match(rehearsal, /host_egress_chain=HR_AXIS_OFFLINE_HOST_EGRESS/)
  assert.match(rehearsal, /host6_egress_chain=HR_AXIS_OFFLINE_HOST6_EGRESS/)
  assert.match(rehearsal, /sudo iptables -I OUTPUT 1 -j "\$host_egress_chain"/)
  assert.match(rehearsal, /sudo ip6tables -I OUTPUT 1 -j "\$host6_egress_chain"/)
  assert.match(rehearsal, /host:'198\.51\.100\.1'/)
  assert.match(rehearsal, /host:'2001:db8::1'/)
  assert.match(rehearsal, /host4_after=.*read_host_reject_packets iptables/)
  assert.match(rehearsal, /host6_after=.*read_host_reject_packets ip6tables/)
  assert.match(rehearsal, /docker network inspect.*EnableIPv6/)
  assert.match(rehearsal, /docker network inspect bridge --format '\{\{\.EnableIPv6\}\}'/)
  assert.match(rehearsal, /sudo sh -c 'iptables-restore < "\$1"' sh "\$RUNNER_TEMP\/offline-firewall\.snapshot"/)
  assert.match(rehearsal, /sudo sh -c 'ip6tables-restore < "\$1"' sh "\$RUNNER_TEMP\/offline-firewall6\.snapshot"/)
  assert.doesNotMatch(rehearsal, /sudo ip6?tables-restore < /)
  assert.match(rehearsal, /offline egress chain remained after complete firewall restore/)
  const install = rehearsal.indexOf('sudo "$BUNDLE_ROOT/operations/install.sh"')
  const probe = rehearsal.indexOf('sudo docker run --pull=never --rm --network "$edge_network"')
  const migrate = rehearsal.indexOf('sudo "$BUNDLE_ROOT/operations/migrate.sh"')
  assert.ok(install >= 0 && install < probe && probe < migrate, 'negative probe must run after install and before later private operations')
  assert.match(rehearsal, /operation: 'egress-probe'/)
  assert.match(rehearsal, /dockerIpv4CounterDelta: Number\(dockerDelta\)/)
  assert.match(rehearsal, /hostIpv4CounterDelta: Number\(host4Delta\)/)
  assert.match(rehearsal, /hostIpv6CounterDelta: Number\(host6Delta\)/)
  assert.match(rehearsal, /dockerIpv6Disabled: true, rejectRulesVerified: true/)
  assert.match(rehearsal, /egressDisabledDuringOperations: true/)
  assert.match(rehearsal, /egressProofSha256: egressDigest/)
})

test('Docker egress rejection rule is accepted by the Linux iptables parser', (context) => {
  const available = spawnSync('iptables-translate', ['--version'], { encoding: 'utf8' })
  if (available.error?.code === 'ENOENT') {
    context.skip('iptables-translate is unavailable on this host')
    return
  }
  const parsed = spawnSync('iptables-translate', [
     '-A', 'HR_AXIS_OFF_DOCKER_EGRESS',
    '-i', 'br+', '!', '-o', 'br+',
    '-m', 'conntrack', '--ctstate', 'NEW',
    '-j', 'REJECT', '--reject-with', 'icmp-port-unreachable',
  ], { encoding: 'utf8' })
  assert.equal(parsed.status, 0, `${parsed.stdout}\n${parsed.stderr}`)
  assert.match(parsed.stdout, /reject/i)
})

test('every vendored runtime image receives separate fail-closed Trivy vulnerability and secret scans', () => {
  const build = jobSection('build_bundle')
  const start = build.indexOf('Pull pinned vendor images and save immutable archives')
  const end = build.indexOf('Generate complete offline metadata and migration compatibility evidence')
  const vendor = build.slice(start, end)
  assert.match(vendor, /for image in caddy postgres redis seaweedfs; do/)
  for (const image of ['caddy', 'postgres', 'redis', 'seaweedfs']) {
    assert.match(vendor, new RegExp(`${image}\\)`), `${image} vendor reference is required`)
  }
  assert.match(vendor, /\$\{image\}-trivy-vuln\.json/)
  assert.match(vendor, /\$\{image\}-trivy-secret\.json/)
  assert.match(vendor, /--scanners vuln --severity CRITICAL[\s\S]*--exit-code 1/)
  assert.match(vendor, /--scanners secret[\s\S]*--exit-code 1/)
  assert.doesNotMatch(vendor, /--scanners vuln,secret/)
  assert.doesNotMatch(vendor, /\/var\/run\/docker\.sock/)
})
