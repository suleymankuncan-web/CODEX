import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
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

function inlineNodeHeredocBody(section, marker) {
  const start = section.indexOf(marker)
  assert.ok(start >= 0, `missing inline Node heredoc marker: ${marker}`)
  const match = section.slice(start).match(/<<'NODE'\r?\n([\s\S]*?)\r?\n\s*NODE/)
  assert.ok(match, `missing inline Node heredoc body: ${marker}`)
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
  assert.deepEqual([...jobs.matchAll(/^  ([a-z][a-z0-9_-]*)\s*:/gm)].map((match) => match[1]), [
    'source-preflight',
    'build_bundle',
    'offline_rehearsal',
  ])
  assert.doesNotMatch(workflow, /onprem-proof-dispatch\.mjs verify-status/)
  const sourceGate = jobSection('source-preflight')
  assert.match(sourceGate, /name:\s*github-source-preflight/)
  assert.match(sourceGate, /Run bounded exact-SHA on-prem source preflight/)
  assert.match(sourceGate, /node --check scripts\/onprem-offline-target-proof\.mjs/)
  assert.match(sourceGate, /onprem-offline-target-proof\.test\.mjs/)
  assert.match(sourceGate, /onprem-offline-workflow-contract\.test\.mjs/)
  assert.doesNotMatch(sourceGate, /GITHUB_EVENT_NAME|GITHUB_EXECUTION_SHA|GITHUB_TOKEN|statuses:\s*read/)
  assert.match(workflow, /build_bundle:[\s\S]*needs:\s*source-preflight/)
  for (const input of ['expected_sha', 'proof_artifact_name', 'proof_run_id']) {
    assert.match(workflow, new RegExp(`${input}:[\\s\\S]{0,220}?required:\\s*true`), input)
  }
  const actions = [...workflow.matchAll(/(?:^|\n)\s*uses:\s*([^\s#]+)/g)].map((match) => match[1])
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
  assert.match(build, /onprem-bundle-archives/)
  assert.match(build, /current\.tar/)
  assert.match(build, /next-transition\.tar/)
  assert.match(build, /previous-transition\.tar/)
  assert.match(build, /transition_members/)
  assert.match(build, /maximum_bundle_copies=3/)
  assert.match(build, /preflight_reserve_kib/)
  assert.match(build, /\['previous', previous[\s\S]*\['next', next/)
  assert.match(build, /same-build-lifecycle-mechanics/)
  assert.match(build, /registryManifestDigest/)
  assert.match(build, /artifacts:[\s\S]*vulnerabilityScan/)
  assert.match(build, /sensitiveDataScan/)
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

test('build proof material uses one external runner-temp root from assembly through bundle verification', () => {
  const build = jobSection('build_bundle')
  const rootSetup = stepSection(build, 'Establish external proof root')
  assert.match(rootSetup, /PROOF_ROOT:\s*\$\{\{\s*runner\.temp\s*\}\}\/onprem-proof/)
  const rootTestIndex = rootSetup.indexOf('test "$PROOF_ROOT" = "$RUNNER_TEMP/onprem-proof"')
  const rootCleanupIndex = rootSetup.indexOf('rm -rf "$PROOF_ROOT"')
  assert.ok(rootTestIndex >= 0, 'external proof root must be pinned before cleanup')
  assert.ok(rootCleanupIndex >= 0, 'external proof root cleanup must be explicit')
  assert.ok(rootTestIndex < rootCleanupIndex, 'external proof root pin must be checked before cleanup')
  assert.match(rootSetup, /mkdir -p "\$PROOF_ROOT\/download"/)
  assert.match(rootSetup, /PROOF_ROOT=\$PROOF_ROOT.*GITHUB_ENV/)

  for (const name of ['Download upstream image proof artifact', 'Download upstream core runtime proof', 'Download upstream keycloak runtime proof', 'Download upstream photo-storage proof']) {
    assert.match(stepSection(build, name), /path:\s*\$\{\{\s*runner\.temp\s*\}\}\/onprem-proof\/download/, `${name} must download under PROOF_ROOT`)
  }

  const assembly = stepSection(build, 'Validate proof identity and assemble complete evidence')
  assert.match(assembly, /PROOF_DOWNLOAD:\s*\$\{\{\s*runner\.temp\s*\}\}\/onprem-proof\/download/)
  assert.match(assembly, /const output = process\.env\.PROOF_ROOT/)
  assert.match(assembly, /copyContentGuardLayerReceipts\(root, output\)/)
  assert.match(assembly, /--base-dir "\$PROOF_ROOT"/)

  const vendor = stepSection(build, 'Pull pinned vendor images and save immutable archives')
  assert.match(vendor, /vendor_evidence="\$PROOF_ROOT\/vendor-evidence"/)
  assert.match(vendor, /"\$PROOF_ROOT\/\$\{image\}-image\.tar"/)

  const metadata = stepSection(build, 'Generate complete offline metadata and migration compatibility evidence')
  assert.match(metadata, /process\.env\.PROOF_ROOT/)
  assert.match(metadata, /join\(proofRoot, 'migration-compatibility\.json'\)/)

  const stage = stepSection(build, 'Stage source-free release closure')
  assert.match(stage, /--proof-dir "\$PROOF_ROOT"/)
  assert.match(stage, /--metadata "\$PROOF_ROOT\/offline-metadata\.json"/)

  const bundle = stepSection(build, 'Create and verify signed offline bundle')
  assert.match(bundle, /process\.env\.PROOF_ROOT/)
  assert.match(bundle, /--upstream-manifest "\$PROOF_ROOT\/release-manifest\.json"/)
  assert.match(bundle, /--upstream-public-key "\$PROOF_ROOT\/ephemeral-public\.pem"/)
  assert.match(bundle, /--upstream-base-dir "\$PROOF_ROOT"/)
  assert.match(bundle, /--content-guard-index "\$PROOF_ROOT\/content-guard-index\.json"/)
  assert.match(bundle, /--content-guard-public-key "\$PROOF_ROOT\/content-guard-index-public\.pem"/)

  assert.doesNotMatch(build, /\$GITHUB_WORKSPACE\/proof/)
  assert.doesNotMatch(build, /\$RUNNER_TEMP\/onprem-proof-download|\$RUNNER_TEMP\/onprem-vendor-evidence/)
  assert.doesNotMatch(build, /\$RUNNER_TEMP\/offline-(?:metadata|trust)/)
  assert.doesNotMatch(build, /(?:['"`])proof\//)
  assert.doesNotMatch(build, /(?:--(?:base-dir|input|public-key|upstream-manifest|upstream-public-key|upstream-base-dir|content-guard-index|content-guard-public-key)\s+)(?:proof(?:\/|\b))/)
})

test('offline rehearsal downloads only the bundle, cuts egress before verification, and never checks out source', () => {
  const rehearsal = jobSection('offline_rehearsal')
  const heartbeatDefinition = rehearsal.indexOf('offline_rehearsal_heartbeat()')
  const heartbeatStart = rehearsal.indexOf('offline_rehearsal_heartbeat &')
  const firstOperator = rehearsal.indexOf('sudo_operator "$BUNDLE_ROOT/operations/preflight.sh"')
  assert.ok(heartbeatDefinition >= 0 && heartbeatStart > heartbeatDefinition && heartbeatStart < firstOperator, 'offline rehearsal must start its bounded heartbeat before operator work')
  assert.match(rehearsal, /offline rehearsal heartbeat seq=.*phase=.*elapsed_seconds=/)
  assert.match(rehearsal, /offline_heartbeat_phase=.*unknown/)
  assert.match(rehearsal, /OPERATOR_TIMEOUT_SECONDS=960/)
  assert.match(rehearsal, /OPERATOR_KILL_AFTER_SECONDS=30/)
  assert.match(rehearsal, /DIRECT_TIMEOUT_SECONDS=600/)
  assert.match(rehearsal, /DIRECT_KILL_AFTER_SECONDS=30/)
  assert.match(rehearsal, /SETSID_BIN="\$\(command -v setsid \|\| true\)"/)
  assert.match(rehearsal, /test -n "\$SETSID_BIN"/)
  assert.match(rehearsal, /run_bounded_group\(\)/)
  assert.match(rehearsal, /group_pid_file="\$\(mktemp "\$RUNNER_TEMP\/offline-process-group\.XXXXXX"\)"/)
  assert.match(rehearsal, /"\$SETSID_BIN" sh -c '/)
  assert.match(rehearsal, /printf "%s\\n" "\$\$" > "\$pid_file"/)
  assert.match(rehearsal, /exec sudo env "PATH=\$operator_path" timeout --foreground --signal=TERM --kill-after="\$\{kill_after_seconds\}s" "\$\{timeout_seconds\}s"/)
  assert.match(rehearsal, /kill -TERM -- "-\$process_group_id"/)
  assert.match(rehearsal, /kill -KILL -- "-\$process_group_id"/)
  assert.match(rehearsal, /process_group_id" =~ \^\[0-9\]\+\$/)
  assert.match(rehearsal, /run_bounded_group "\$bounded_label" "\$DIRECT_TIMEOUT_SECONDS" "\$DIRECT_KILL_AFTER_SECONDS"/)
  assert.match(rehearsal, /run_bounded_group "\$operator_name" "\$OPERATOR_TIMEOUT_SECONDS" "\$OPERATOR_KILL_AFTER_SECONDS"/)
  assert.match(rehearsal, /offline operator failure script=/)
  assert.match(rehearsal, /sudo_bounded "verify-bootstrap-\$release_id" "\$NODE_BIN" "\$TRUSTED_BOOTSTRAP" verify/)
  assert.match(rehearsal, /sudo_bounded "verify-bundle-\$release_id" "\$NODE_BIN" "\$root\/operations\/onprem-offline-bundle\.mjs" verify/)
  assert.doesNotMatch(rehearsal, /sudo -- "\$NODE_BIN" "\$TRUSTED_BOOTSTRAP" verify/)
  assert.doesNotMatch(rehearsal, /edge-network-inspect[^\n]*2>\/dev\/null/)
  assert.match(rehearsal, /trap 'if \[ -n "\$\{offline_heartbeat_pid:-\}" \]; then kill "\$offline_heartbeat_pid"/)
  for (const phase of ['preflight', 'install', 'migrate', 'activate', 'smoke', 'photo-prebackup', 'backup', 'restore', 'upgrade', 'rollback']) {
    assert.equal((rehearsal.match(new RegExp(`offline phase=${phase}`, 'g')) ?? []).length, 1, `${phase} phase marker must be unique`)
  }
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
  assert.match(rehearsal, /UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoCAAIAAUAmJaQAA3AA\/vz0AAA=/, 'offline photo fixture must be a known decodable WebP')
  assert.doesNotMatch(rehearsal, /UklGRiIAAABXRUJQVlA4IBAAAADwAQCdASoBAAEAAUAmJaQAA3AA\/vuUAAA=/, 'offline photo fixture must not use the header-only invalid WebP')
  assert.match(rehearsal, /chmod 400 "\$photo_fixture"/)
  assert.match(rehearsal, /OPERATOR_ROOT="\$SEALED_ROOT\/operator"/)
  assert.match(rehearsal, /sudo install -d -o 0 -g 0 -m 0700 "\$OPERATOR_ROOT"/)
  assert.match(rehearsal, /sudo cp -a -- "\$RUNNER_TEMP\/offline-secrets" "\$OPERATOR_ROOT\/secrets"/)
  assert.match(rehearsal, /sudo chown 1000:1000 -- "\$OPERATOR_ROOT\/photo-fixture\.webp"/, 'photo fixture must be readable by the UID used by protected photo auth proof')
  assert.match(rehearsal, /sudo chmod 0400 "\$OPERATOR_ROOT\/photo-fixture\.webp"/)
  assert.match(rehearsal, /sudo cp -a -- "\$OPERATOR_ROOT\/receipts\/\." "\$RUNNER_TEMP\/offline-receipts\/"/)
  assert.match(rehearsal, /chmod 700 "\$RUNNER_TEMP\/offline-receipts"/)
  assert.match(workflow, /Materialize sanitized failure receipt when rehearsal stops early/)
  assert.match(workflow, /status\\\":\\\"failed\\\"/)
  assert.match(workflow, /lastPhase.*\$phase/)
  assert.match(workflow, /reason\\\":\\\"rehearsal did not reach final aggregate\\\"/)
  assert.ok(workflow.indexOf('Materialize sanitized failure receipt when rehearsal stops early') < workflow.indexOf('Upload sanitized offline rehearsal receipt'), 'failure receipt must be materialized before upload')
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
  const bootstrap = rehearsal.indexOf('sudo_bounded "verify-bootstrap-$release_id" "$NODE_BIN" "$TRUSTED_BOOTSTRAP" verify')
  const verify = rehearsal.search(/offline-bundle\.mjs["']?\s+verify/)
  const install = rehearsal.indexOf('operations/install.sh')
  assert.ok(bootstrap >= 0 && verify > bootstrap && install > verify, 'external bootstrap and bundle verification must precede bundled install/docker load')
  for (const operation of ['preflight.sh', 'install.sh', 'migrate.sh', 'activate.sh', 'smoke.sh', 'backup.sh', 'restore.sh', 'upgrade.sh', 'rollback.sh']) {
    assert.match(rehearsal, new RegExp(`operations/${operation.replace('.', '\\.')}`), operation)
  }
  assert.doesNotMatch(rehearsal, /sudo .*operations\/(?:preflight|install|migrate|activate|smoke|backup|restore|upgrade|rollback)\.sh[^\n]*\$RUNNER_TEMP\/offline/)
  assert.match(rehearsal, /onprem-offline-target-proof\.mjs[\s\S]*--require-complete[\s\S]*--photo-fixture[\s\S]*--photo-sha256/)
  assert.match(rehearsal, /onprem-offline-target-proof\.mjs[^\n]*--photo-storage-secret-root "\$PHOTO_STORAGE_SECRET_ROOT"/)
  assert.match(rehearsal, /PHOTO_STORAGE_SECRET_ROOT="\$OPERATOR_ROOT\/secrets\/photo"/)
  assert.match(rehearsal, /photo\.canonicalIdentityVerified !== true/)
  for (const operation of ['preflight', 'install', 'migrate', 'activate', 'smoke', 'backup', 'restore', 'upgrade', 'rollback']) {
    assert.match(rehearsal, new RegExp(`sudo_operator "\\$BUNDLE_ROOT/operations/${operation}\\.sh"`), `${operation} remains under pinned sudo operator`)
  }
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
  const envCreation = rehearsal.indexOf("writeEnv('offline-previous.env'")
  const ownerKey = rehearsal.indexOf('owner_key_source=')
  const rootChown = rehearsal.indexOf('sudo find "$OPERATOR_ROOT" -exec chown 0:0')
  assert.ok(envCreation >= 0 && ownerKey > envCreation && rootChown > ownerKey, 'all root-private envs and backup key must exist before ownership hardening')
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
    const expression = new RegExp(`(?:sudo|sudo_operator) \\\"\\$[^\\n]*?/operations/${operator}\\.sh\\\"`, 'g')
    const calls = [...rehearsal.matchAll(expression)]
    assert.equal(calls.length, 1, `${operator}.sh must run exactly once under sudo`)
    positions.push(calls[0].index)
  }
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'operator calls must preserve install/migrate/activate/smoke/backup order')
  assert.match(rehearsal, /sudo_bounded "photo-prebackup-target-proof" "\$NODE_BIN" "\$BUNDLE_ROOT\/operations\/onprem-offline-target-proof\.mjs"/)
  assert.equal((rehearsal.match(/sudo_bounded "photo-prebackup-target-proof" "\$NODE_BIN" "\$BUNDLE_ROOT\/operations\/onprem-offline-target-proof\.mjs"/g) ?? []).length, 1)
  assert.doesNotMatch(rehearsal, /target_gate_status=\$\?/)
  assert.doesNotMatch(rehearsal, /^\s*"\$BUNDLE_ROOT\/operations\/(?:preflight|install|migrate|activate|smoke|backup|restore|upgrade|rollback)\.sh"/m)
})

test('restore, upgrade, and rollback remain complete photo-gated operations', () => {
  const rehearsal = jobSection('offline_rehearsal')
  const identities = {
    restore: ['--release-id "$RELEASE_ID"', '--target-project hr-axis-onprem-restore', '--source-project hr-axis-onprem-core', '--source-release-id "$RELEASE_ID"'],
    upgrade: ['--release-id "$RELEASE_ID"', '--next-release-id "onprem-next-$release_suffix"', '--source-project hr-axis-onprem-core', '--target-project hr-axis-onprem-upgrade'],
    rollback: ['--release-id "$RELEASE_ID"', '--previous-release-id "onprem-previous-$release_suffix"', '--source-project hr-axis-onprem-core', '--target-project hr-axis-onprem-rollback'],
  }
  for (const operator of Object.keys(identities)) {
    const calls = [...rehearsal.matchAll(new RegExp(`(?:sudo|sudo_operator) "[^\\n]+/operations/${operator}\\.sh"[^\\n]+`, 'g'))]
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
  assert.match(rehearsal, /offline-phase/)
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
    assert.match(block, /path:\s*\$\{\{\s*runner\.temp\s*\}\}\/onprem-proof\/download/, name)
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
  assert.match(rehearsal, /sudo install -d -o 0 -g 0 -m 0755 "\$SEALED_ROOT\/bundle" "\$SEALED_ROOT\/archives" "\$SEALED_ROOT\/trust"/)
  assert.match(rehearsal, /install_release_archive\(\)/)
  for (const archive of ['current', 'next-transition', 'previous-transition']) {
    assert.equal(
      [...rehearsal.matchAll(new RegExp(`^\\s*install_release_archive ${archive}$`, 'gm'))].length,
      1,
      `${archive} must be sealed exactly once`,
    )
  }
  const incomingRemoval = rehearsal.indexOf('rm -rf -- "$INCOMING_ARCHIVE_ROOT"')
  assert.ok(incomingRemoval > 0)
  assert.doesNotMatch(rehearsal.slice(incomingRemoval), /^\s*install_release_archive /m)
  assert.match(rehearsal, /extract_current_bundle\(\)/)
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
  assert.match(rehearsal, /verify_release_bundle "\$BUNDLE_ROOT" "\$RELEASE_ID"/)
  assert.match(rehearsal, /materialize_transition_bundle next "\$NEXT_BUNDLE_ROOT" "onprem-next-\$release_suffix"/)
  assert.match(rehearsal, /materialize_transition_bundle previous "\$PREVIOUS_BUNDLE_ROOT" "onprem-previous-\$release_suffix"/)
  assert.match(rehearsal, /local release="\$1" target="\$2" release_id="\$3" archive materialization_root/)
  assert.match(rehearsal, /archive="\$SEALED_ROOT\/archives\/\$\{release\}-transition\.tar"/)
  assert.match(rehearsal, /materialization_root="\$SEALED_ROOT\/\.\$\{release\}-materialize"/)
  assert.match(rehearsal, /verify_release_bundle "\$materialization_root" "\$release_id"/)
  assert.match(rehearsal, /NODE_BIN="\$TRUST_ROOT\/node"/)
  assert.match(rehearsal, /sudo install -o 0 -g 0 -m 0755 -- "\$PINNED_NODE_SOURCE" "\$SEALED_ROOT\/trust\/node"/)
  assert.match(rehearsal, /test "\$\(sudo -- "\$NODE_BIN" --version\)" = v24\.19\.0/)
  assert.doesNotMatch(rehearsal, /sudo node(?:\s|$)/)
  assert.match(rehearsal, /\/var\/lib\/hr-axis-onprem-offline-proof\/\$\{GITHUB_RUN_ID\}-\$\{GITHUB_RUN_ATTEMPT\}/)
  assert.match(rehearsal, /sudo test -e "\$sensitive_path" \|\| sudo test -L "\$sensitive_path"/)
})

test('offline rehearsal keeps every sealed bundle and operator input behind the privileged boundary', () => {
  const rehearsal = stepSection(
    jobSection('offline_rehearsal'),
    'Verify bundle before docker load and run bundled operations',
  )
  const plainSealedPathConsumers = rehearsal
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^(?:test|node)\b/.test(line))
    .filter((line) => !/^test "\$\(sudo /.test(line))
    .filter((line) => /\$(?:BUNDLE_ROOT|NEXT_BUNDLE_ROOT|PREVIOUS_BUNDLE_ROOT|TRUST_ROOT|OPERATOR_ROOT|PUBLIC_KEY|PROOF_COMPOSE|NEXT_PROOF_COMPOSE|PREVIOUS_PROOF_COMPOSE)\b/.test(line))
  assert.deepEqual(plainSealedPathConsumers, [])
  assert.match(rehearsal, /sudo test -f "\$BUNDLE_ROOT\/bundle-manifest\.json" && sudo test ! -L "\$BUNDLE_ROOT\/bundle-manifest\.json"/)
  assert.match(rehearsal, /sudo test -f "\$PUBLIC_KEY" && sudo test ! -L "\$PUBLIC_KEY"/)
  for (const forbiddenPath of ['.git', 'backend', 'admin-web', 'src']) {
    assert.match(rehearsal, new RegExp(`sudo test ! -e "\\$BUNDLE_ROOT/${forbiddenPath.replace('.', '\\.')}" && sudo test ! -L "\\$BUNDLE_ROOT/${forbiddenPath.replace('.', '\\.')}"`))
  }
  assert.match(rehearsal, /sudo -- "\$NODE_BIN" - "\$BUNDLE_ROOT\/bundle-manifest\.json" "\$OPERATOR_ROOT"/)
  assert.match(rehearsal, /flag: 'wx'/)
  for (const operatorEnv of ['offline.env', 'offline-current.env', 'offline-next.env', 'offline-previous.env']) {
    assert.match(rehearsal, new RegExp(`writeEnv\\('${operatorEnv.replace('.', '\\.')}'`))
    assert.match(rehearsal, new RegExp(`sudo test -f "\\$OPERATOR_ROOT/\\$operator_env"`))
  }
  assert.doesNotMatch(rehearsal, /"\$RUNNER_TEMP\/offline(?:-(?:previous|current|next))?\.env"/)
  for (const proofCompose of ['PROOF_COMPOSE', 'NEXT_PROOF_COMPOSE', 'PREVIOUS_PROOF_COMPOSE']) {
    assert.match(rehearsal, new RegExp(`sudo test -f "\\$${proofCompose}" && sudo test ! -L "\\$${proofCompose}"`))
  }
})

test('sealed operator env generation is exact and refuses every overwrite', () => {
  const rehearsal = stepSection(
    jobSection('offline_rehearsal'),
    'Verify bundle before docker load and run bundled operations',
  )
  const body = inlineNodeHeredocBody(
    rehearsal,
    'sudo -- "$NODE_BIN" - "$BUNDLE_ROOT/bundle-manifest.json" "$OPERATOR_ROOT"',
  )
  const root = mkdtempSync(join(tmpdir(), 'onprem-offline-sealed-env-'))
  const manifestPath = join(root, 'bundle-manifest.json')
  const operatorRoot = join(root, 'operator')
  const imageNames = ['backend', 'frontend', 'keycloak', 'caddy', 'postgres', 'redis', 'seaweedfs']
  const images = Object.fromEntries(imageNames.map((name, index) => [name, {
    configImageId: `sha256:${String(index + 1).repeat(64)}`,
  }]))
  const expectedReleases = {
    'offline.env': 'onprem-test-abc123',
    'offline-current.env': 'onprem-test-abc123',
    'offline-next.env': 'onprem-next-abc123',
    'offline-previous.env': 'onprem-previous-abc123',
  }
  try {
    mkdirSync(operatorRoot, { mode: 0o700 })
    writeFileSync(manifestPath, JSON.stringify({ images }))
    const args = ['-', manifestPath, operatorRoot, 'onprem-test-abc123', 'abc123', '/sealed/core', '/sealed/photo', '/sealed/ledger.json', 'a'.repeat(64)]
    const first = spawnSync(process.execPath, args, { input: `${body}\n`, encoding: 'utf8' })
    assert.equal(first.status, 0, first.stderr)
    const original = {}
    for (const [file, releaseId] of Object.entries(expectedReleases)) {
      const pathname = join(operatorRoot, file)
      const content = readFileSync(pathname, 'utf8')
      if (process.platform !== 'win32') assert.equal(statSync(pathname).mode & 0o777, 0o600, `${file} mode`)
      assert.match(content, new RegExp(`^HR_AXIS_RELEASE_ID=${releaseId}$`, 'm'))
      for (const image of Object.values(images)) assert.ok(content.includes(`=${image.configImageId}`), `${file} image identity`)
      original[file] = content
    }
    const second = spawnSync(process.execPath, args, { input: `${body}\n`, encoding: 'utf8' })
    assert.notEqual(second.status, 0, 'pre-existing env files must fail closed')
    for (const [file, content] of Object.entries(original)) {
      assert.equal(readFileSync(join(operatorRoot, file), 'utf8'), content, `${file} must not be overwritten`)
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('offline rehearsal maps every service secret through exact privileged paths without runner-side globs', () => {
  const rehearsal = stepSection(
    jobSection('offline_rehearsal'),
    'Verify bundle before docker load and run bundled operations',
  )
  assert.match(rehearsal, /set_secret_identity\(\)/)
  assert.doesNotMatch(rehearsal, /\$OPERATOR_ROOT\/secrets\/[^\n]*\*/)
  const expected = new Map([
    ['10001:10001:0400', ['core/caddy/server.key']],
    ['70:70:0400', ['core/postgres/server.key', 'core/postgres/bootstrap-password', 'core/postgres/migrator-password', 'core/postgres/api-password', 'core/postgres/worker-password', 'core/postgres/keycloak-password']],
    ['1000:1000:0400', ['core/keycloak/binder-database-url', 'core/keycloak/database-password', 'core/keycloak/database-url', 'core/keycloak/database-username', 'core/keycloak/bootstrap-username', 'core/keycloak/bootstrap-password', 'core/keycloak/smtp-auth-user', 'core/keycloak/smtp-password', 'core/keycloak/synthetic-accounts', 'core/keycloak/photo-proof-account']],
    ['999:1000:0400', ['core/redis/users.acl', 'core/redis/health-url']],
    ['65532:65532:0400', ['core/backend/api-database-url', 'core/backend/worker-database-url', 'core/backend/migrator-database-url', 'core/backend/redis-api-url', 'core/backend/redis-worker-url', 'core/backend/browser-session-secret']],
    ['65532:0:0440', ['photo/primary-access-key-id', 'photo/primary-secret-access-key', 'photo/recovery-access-key-id', 'photo/recovery-secret-access-key']],
    ['0:0:0444', ['core/postgres/ca.crt', 'core/postgres/server.crt', 'core/caddy/ca.crt', 'core/caddy/server.crt']],
  ])
  const actualEntries = []
  const seenPaths = new Set()
  const invocations = rehearsal.split('\n').map((line) => line.trim()).filter((line) => /^set_secret_identity \d+:\d+ 0\d+ /.test(line))
  assert.equal(invocations.length, expected.size)
  for (const invocation of invocations) {
    const [, ownerGroup, mode, argumentsText] = invocation.match(/^set_secret_identity (\d+:\d+) (0\d+) (.+)$/) ?? []
    assert.ok(ownerGroup && mode && argumentsText, `invalid secret identity invocation: ${invocation}`)
    const paths = [...argumentsText.matchAll(/"\$OPERATOR_ROOT\/secrets\/([^"\n]+)"/g)].map((match) => match[1])
    assert.ok(paths.length > 0, `secret identity invocation has no exact paths: ${invocation}`)
    assert.equal(argumentsText, paths.map((path) => `"$OPERATOR_ROOT/secrets/${path}"`).join(' '), `secret identity invocation contains an unparsed operand: ${invocation}`)
    for (const path of paths) {
      assert.equal(seenPaths.has(path), false, `duplicate secret identity path: ${path}`)
      seenPaths.add(path)
      actualEntries.push([path, `${ownerGroup}:${mode}`])
    }
  }
  const expectedEntries = [...expected].flatMap(([identity, paths]) => paths.map((path) => [path, identity]))
  assert.deepEqual(actualEntries.sort(), expectedEntries.sort())
})

test('secret identity helper validates every path before any ownership mutation', (t) => {
  const shell = process.platform === 'win32' && existsSync('C:\\Program Files\\Git\\usr\\bin\\bash.exe')
    ? 'C:\\Program Files\\Git\\usr\\bin\\bash.exe' : 'bash'
  const available = spawnSync(shell, ['--version'], { encoding: 'utf8' })
  if (available.status !== 0) return t.skip('Bash is unavailable')
  const rehearsal = stepSection(jobSection('offline_rehearsal'), 'Verify bundle before docker load and run bundled operations')
  const functionMatch = rehearsal.match(/\n\s*(set_secret_identity\(\) \{[\s\S]*?\n\s*\})\n\s*set_secret_identity 10001:/)
  assert.ok(functionMatch, 'missing production secret identity helper')
  const helper = functionMatch[1].split('\n').map((line) => line.replace(/^\s{10}/, '')).join('\n')
  const runCase = (...kinds) => spawnSync(shell, ['-c', `${helper}\nsudo() {\n  command_name=$1; shift\n  case "$command_name:$1:$2" in\n    test:-f:valid|test:-f:symlink) return 0 ;;\n    test:-L:symlink) return 0 ;;\n    test:-L:valid) return 1 ;;\n    chown:*|chmod:*) printf '%s\\n' "$command_name"; return 0 ;;\n    *) return 1 ;;\n  esac\n}\nset_secret_identity 1:1 0400 "$@"\n`, '--', ...kinds], {
    encoding: 'utf8',
    env: process.env,
  })
  for (const kind of ['missing', 'directory', 'symlink']) {
    const result = runCase(kind)
    assert.notEqual(result.status, 0, `${kind} must fail closed`)
    assert.doesNotMatch(result.stdout + result.stderr, /chown|chmod/, `${kind} must not reach mutation`)
    const afterValid = runCase('valid', kind)
    assert.notEqual(afterValid.status, 0, `valid followed by ${kind} must fail closed`)
    assert.doesNotMatch(afterValid.stdout + afterValid.stderr, /chown|chmod/, `valid followed by ${kind} must not partially mutate`)
  }
  const valid = runCase('valid')
  assert.equal(valid.status, 0, valid.stderr)
  assert.equal(valid.stdout, 'chown\nchmod\n')
})

test('offline bundle handoff preserves modes and bounds disk use with sequential signed release archives', () => {
  const build = jobSection('build_bundle')
  const rehearsal = jobSection('offline_rehearsal')
  assert.doesNotMatch(build, /onprem-bundle\.tar/)
  assert.match(build, /onprem-bundle-archives/)
  assert.match(build, /current\.tar/)
  assert.match(build, /next-transition\.tar/)
  assert.match(build, /previous-transition\.tar/)
  assert.doesNotMatch(build, /(?:next|previous)\.tar/)
  assert.match(build, /transition bundle differs outside migration compatibility evidence/)
  assert.match(build, /SHA256SUMS/)
  assert.match(build, /bundle_archive_manifest_sha256/)
  assert.match(build, /compression-level:\s*0/)
  assert.match(build, /rm -rf -- "\$bundle_dir"/)
  assert.match(build, /rm -rf -- "\$staging"/)
  assert.match(build, /available_kib[\s\S]*required_kib/)

  assert.match(rehearsal, /BUNDLE_ARCHIVE_MANIFEST_SHA256/)
  assert.match(rehearsal, /SHA256SUMS/)
  assert.match(rehearsal, /install_release_archive\(\)/)
  assert.match(rehearsal, /extract_current_bundle\(\)/)
  assert.match(rehearsal, /materialize_transition_bundle\(\)/)
  assert.match(rehearsal, /sha256sum --check/)
  assert.match(rehearsal, /sudo rm -- "\$sealed_archive"/)
  const sealedRootCapacityLines = rehearsal
    .split('\n')
    .filter((line) => line.includes('available_kib=') && line.includes('$SEALED_ROOT'))
    .map((line) => line.trim())
  assert.deepEqual(sealedRootCapacityLines, [
    `available_kib="$(sudo df -Pk -- "$SEALED_ROOT" | awk 'NR == 2 { print $4 }')"`,
  ])
  assert.doesNotMatch(rehearsal, /sudo cp -a -- "\$INCOMING_BUNDLE_ROOT\/\."/)
  assert.doesNotMatch(rehearsal, /onprem-bundle\.tar/)
})

test('offline rehearsal enforces Docker and host IPv4/IPv6 egress with bound negative probes', () => {
  const rehearsal = jobSection('offline_rehearsal')
  const verifyStep = stepSection(rehearsal, 'Verify bundle before docker load and run bundled operations')
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
  assert.match(rehearsal, /conntrack_accept_rule=.*sed -n '2p'/)
  assert.match(rehearsal, /--ctstate ESTABLISHED,RELATED -j ACCEPT"\|\\\s*\n\s*"-A \$docker_egress_chain -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT"/)
  assert.match(rehearsal, /offline Docker conntrack accept rule identity mismatch/)
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
  assert.match(rehearsal, /runner_control_uid="\$\(id -u\)"/)
  assert.match(rehearsal, /host_probe_uid="\$\(id -u nobody\)"/)
  assert.match(rehearsal, /test "\$runner_control_uid" -gt 0/)
  assert.match(rehearsal, /test "\$host_probe_uid" -gt 0/)
  assert.match(rehearsal, /test "\$runner_control_uid" -ne "\$host_probe_uid"/)
  assert.match(rehearsal, /iptables -A "\$host_egress_chain" -m owner --uid-owner "\$runner_control_uid" -j ACCEPT/)
  assert.match(rehearsal, /ip6tables -A "\$host6_egress_chain" -m owner --uid-owner "\$runner_control_uid" -j ACCEPT/)
  assert.match(rehearsal, /sudo iptables -I OUTPUT 1 -j "\$host_egress_chain"/)
  assert.match(rehearsal, /sudo ip6tables -I OUTPUT 1 -j "\$host6_egress_chain"/)
  assert.match(rehearsal, /host6_probe_interface=HRAXIS_OFFLINE6/)
  assert.match(rehearsal, /sudo ip link add "\$host6_probe_interface" type dummy/)
  assert.match(rehearsal, /sudo ip -6 addr add "\$host6_probe_source\/128" dev "\$host6_probe_interface"/)
  assert.match(rehearsal, /sudo ip -6 route add "\$host6_probe_target\/128" dev "\$host6_probe_interface"/)
  assert.match(rehearsal, /test "\$host6_probe_target" = "fd42:6872:6178:6973::2"/)
  assert.match(verifyStep, /host_probe_uid="\$\(id -u nobody\)"/)
  assert.match(verifyStep, /host6_probe_target=fd42:6872:6178:6973::2/)
  assert.ok(verifyStep.indexOf('host_probe_uid="$(id -u nobody)"') < verifyStep.indexOf('host6_probe_target=fd42:6872:6178:6973::2'))
  assert.ok(verifyStep.indexOf('host6_probe_target=fd42:6872:6178:6973::2') < verifyStep.indexOf("host:'$host6_probe_target'"))
  assert.match(rehearsal, /host_reject_rule_line=4/)
  assert.match(rehearsal, /sudo -u nobody -- "\$PINNED_NODE_SOURCE" --input-type=module -e/)
  assert.doesNotMatch(rehearsal, /(?<!sudo -u nobody -- )node --input-type=module -e "import net from 'node:net'/)
  assert.match(rehearsal, /host:'198\.51\.100\.1'/)
  assert.match(rehearsal, /host:'\$host6_probe_target'/)
  assert.match(rehearsal, /host4_after=.*read_host_reject_packets iptables/)
  assert.match(rehearsal, /host6_after=.*read_host_reject_packets ip6tables/)
  assert.match(rehearsal, /docker network inspect.*EnableIPv6/)
  assert.match(rehearsal, /docker network inspect bridge --format '\{\{\.EnableIPv6\}\}'/)
  assert.match(rehearsal, /sudo sh -c 'iptables-restore < "\$1"' sh "\$RUNNER_TEMP\/offline-firewall\.snapshot"/)
  assert.match(rehearsal, /sudo sh -c 'ip6tables-restore < "\$1"' sh "\$RUNNER_TEMP\/offline-firewall6\.snapshot"/)
  assert.doesNotMatch(rehearsal, /sudo ip6?tables-restore < /)
  assert.match(rehearsal, /cleanup_host6_probe_interface\(\)/)
  assert.match(rehearsal, /sudo ip -6 route del fd42:6872:6178:6973::2\/128 dev HRAXIS_OFFLINE6/)
  assert.match(rehearsal, /sudo ip -6 addr del fd42:6872:6178:6973::1\/128 dev HRAXIS_OFFLINE6/)
  assert.match(rehearsal, /sudo ip link del HRAXIS_OFFLINE6/)
  assert.match(rehearsal, /offline IPv6 probe interface remained after cleanup/)
  assert.match(rehearsal, /offline egress chain remained after complete firewall restore/)
  assert.match(rehearsal, /edge_network="hr-axis-onprem-core_edge"/)
  assert.match(rehearsal, /--format '\{\{\.Internal\}\}\|\{\{index \.Labels "com\.hr-axis\.project"\}\}\|\{\{index \.Labels "com\.hr-axis\.data-class"\}\}\|\{\{index \.Labels "com\.hr-axis\.release-id"\}\}\|\{\{index \.Labels "com\.hr-axis\.network-class"\}\}'/)
  assert.match(rehearsal, /test "\$edge_meta" = "false\|hr-axis-onprem-core\|synthetic\|\$RELEASE_ID\|edge"/)
  assert.match(rehearsal, /offline edge network is missing after activation/)
  assert.doesNotMatch(rehearsal, /offline edge network is missing after install/)
  assert.match(rehearsal, /backend_image="\$\(sudo awk -F= '\$1 == "HR_AXIS_BACKEND_IMAGE" \{ print \$2; exit \}' "\$ENV_FILE"\)/)
  assert.match(rehearsal, /sudo_bounded "edge-image-inspect" docker image inspect "\$backend_image" --format '\{\{\.Id\}\}' \| grep -Fqx "\$backend_image"/)
  assert.match(rehearsal, /--entrypoint \/nodejs\/bin\/node "\$backend_image" --input-type=module -e/)
  assert.doesNotMatch(rehearsal, /--entrypoint node "\$backend_image"/)
  const install = rehearsal.indexOf('sudo_operator "$BUNDLE_ROOT/operations/install.sh"')
  const migrate = rehearsal.indexOf('sudo_operator "$BUNDLE_ROOT/operations/migrate.sh"')
  const activate = rehearsal.indexOf('sudo_operator "$BUNDLE_ROOT/operations/activate.sh"')
  const edgeCheck = rehearsal.indexOf('sudo_bounded "edge-network-inspect" docker network inspect "$edge_network"')
  const probe = rehearsal.indexOf('sudo_bounded "docker-egress-probe" docker run --pull=never --rm --network "$edge_network"')
  const egressReceipt = rehearsal.indexOf('sudo -- "$NODE_BIN" - "$RECEIPT_ROOT/egress.json"')
  const smoke = rehearsal.indexOf('sudo_operator "$BUNDLE_ROOT/operations/smoke.sh"')
  assert.ok(install >= 0 && install < migrate && migrate < activate && activate < edgeCheck && edgeCheck < probe && probe < egressReceipt && egressReceipt < smoke, 'operator order must be install < migrate < activate < edge check/probe/receipt < smoke')
  assert.equal((rehearsal.match(/edge_network="hr-axis-onprem-core_edge"/g) ?? []).length, 1, 'edge network probe block must be unique')
  assert.equal((rehearsal.match(/sudo_bounded "docker-egress-probe" docker run --pull=never --rm --network "\$edge_network"/g) ?? []).length, 1, 'edge network probe invocation must be unique')
  assert.equal((rehearsal.match(/sudo -- "\$NODE_BIN" - "\$RECEIPT_ROOT\/egress\.json"/g) ?? []).length, 1, 'edge egress receipt emission must be unique')
  assert.match(rehearsal, /operation: 'egress-probe'/)
  assert.match(rehearsal, /dockerIpv4CounterDelta: Number\(dockerDelta\)/)
  assert.match(rehearsal, /hostIpv4CounterDelta: Number\(host4Delta\)/)
  assert.match(rehearsal, /hostIpv6CounterDelta: Number\(host6Delta\)/)
  assert.match(rehearsal, /hostControlPlaneException: true, hostProbeUid: Number\(hostProbeUid\)/)
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

test('Docker egress identity accepts only the two equivalent conntrack serializations', () => {
  const rehearsal = jobSection('offline_rehearsal')
  const caseBlock = rehearsal.match(/case "\$conntrack_accept_rule" in[\s\S]*?\n\s*esac/)?.[0]
  assert.ok(caseBlock, 'production conntrack identity case block is required')
  const normalizedCaseBlock = caseBlock.split('\n').map((line) => line.trim()).join('\n')
  const expectedCaseBlock = [
    'case "$conntrack_accept_rule" in',
    '"-A $docker_egress_chain -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT"|\\',
    '"-A $docker_egress_chain -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT") ;;',
    "*) echo 'offline Docker conntrack accept rule identity mismatch' >&2; exit 1 ;;",
    'esac',
  ].join('\n')
  assert.equal(normalizedCaseBlock, expectedCaseBlock)
  const chain = 'HR_AXIS_OFF_DOCKER_EGRESS'
  const extractAcceptedPatterns = (source) => [...source.matchAll(/"(-A \$docker_egress_chain -m conntrack --ctstate [A-Z,]+ -j ACCEPT)"/g)]
    .map((match) => match[1])
  const acceptedPatterns = extractAcceptedPatterns(caseBlock)
  assert.deepEqual(acceptedPatterns, [
    '-A $docker_egress_chain -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT',
    '-A $docker_egress_chain -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT',
  ])
  assert.equal(caseBlock.match(/\*\)/g)?.length, 1)
  const failClosedPattern = /\*\) echo 'offline Docker conntrack accept rule identity mismatch' >&2; exit 1 ;;/
  assert.match(caseBlock, failClosedPattern)
  const extraStateMutation = normalizedCaseBlock.replace(
    '*) echo',
    '"-A $docker_egress_chain -m conntrack --ctstate NEW,RELATED,ESTABLISHED -j ACCEPT") ;;\n*) echo',
  )
  assert.notEqual(extraStateMutation, expectedCaseBlock)
  const broadAcceptMutation = normalizedCaseBlock.replace(
    '*) echo',
    '"-A $docker_egress_chain -j ACCEPT") ;;\n*) echo',
  )
  assert.notEqual(broadAcceptMutation, expectedCaseBlock)
  assert.doesNotMatch(normalizedCaseBlock.replace(failClosedPattern, '*) ;;'), failClosedPattern)
  const accepted = new Set(acceptedPatterns.map((pattern) => pattern.replace('$docker_egress_chain', chain)))
  assert.equal(accepted.has(`-A ${chain} -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT`), true)
  assert.equal(accepted.has(`-A ${chain} -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT`), true)
  assert.equal(accepted.has(`-A ${chain} -m conntrack --ctstate NEW,RELATED,ESTABLISHED -j ACCEPT`), false)
  assert.equal(accepted.has(`-A ${chain} -m conntrack --ctstate RELATED,ESTABLISHED,INVALID -j ACCEPT`), false)
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
  const vendors = {
    caddy: { ref: 'caddy:2.11.4-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648', configImageId: 'af555904a0961945f16bb323a501457b13a4f7e9bde969b145b97da80b38ecbe' },
    postgres: { ref: 'postgres:16.15-alpine@sha256:44c4ee9810eff91f7eab4d822642e01115b1a9eccce4bcbdde7604752d68eac6', configImageId: '75f5a96988cdf694a215073c3e9c001b706b371e2f94df3967f2efdec2787f6b' },
    redis: { ref: 'redis:7.4.10-alpine@sha256:e7723ff73d963f5cc6d9c4643ea3d989527a402a319239054e9472a7fb9219a2', configImageId: '2a51817f79255c8b69f86a974459c2e0359aff81417d80158f2b9e541e6f4b33' },
    seaweedfs: { ref: 'chrislusf/seaweedfs:4.41@sha256:43b768cd62b00d132439cda881b93fd1adebf1b315e996e794087743821d771d', configImageId: '8da20bce07d3a7978d8c2de72351df4b3600cce8f133f6417458aeca796defd0' },
  }
  for (const [image, { ref, configImageId }] of Object.entries(vendors)) {
    const variable = image.toUpperCase()
    assert.match(workflow, new RegExp(`\\n  ${variable}_CONFIG_IMAGE_ID: sha256:${configImageId}\\n`), `${variable} config image ID is required`)
    assert.match(vendor, new RegExp(`${image}\\) ref="\\$${variable}_IMAGE"; image_id="\\$${variable}_CONFIG_IMAGE_ID" ;;`), `${variable} config image ID is not bound to its archive`)
    assert.match(vendor, new RegExp(`test "\\$${variable}_IMAGE" = '${ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`), `${variable} image ref is not guarded`)
    assert.match(vendor, new RegExp(`test "\\$${variable}_CONFIG_IMAGE_ID" = 'sha256:${configImageId}'`), `${variable} config image ID is not guarded`)
  }
  assert.match(vendor, /readonly CADDY_IMAGE CADDY_CONFIG_IMAGE_ID POSTGRES_IMAGE POSTGRES_CONFIG_IMAGE_ID REDIS_IMAGE REDIS_CONFIG_IMAGE_ID SEAWEEDFS_IMAGE SEAWEEDFS_CONFIG_IMAGE_ID/)
  assert.match(vendor, /\$\{image\}-trivy-vuln\.json/)
  assert.match(vendor, /\$\{image\}-trivy-secret\.json/)
  assert.match(vendor, /--scanners vuln --severity CRITICAL[\s\S]*--exit-code 1/)
  assert.match(vendor, /--scanners secret[\s\S]*--exit-code 1/)
  assert.doesNotMatch(vendor, /--scanners vuln,secret/)
  assert.doesNotMatch(vendor, /\/var\/run\/docker\.sock/)
  assert.match(vendor, /\[\[ "\$ref" =~ @sha256:\[a-f0-9\]\{64\}\$ \]\]/)
  assert.match(vendor, /archive_tag="\$\{ref%@sha256:\*\}"/)
  assert.match(vendor, /docker tag "\$ref" "\$archive_tag"[\s\S]*docker save "\$archive_tag"/)
  assert.doesNotMatch(vendor, /docker image inspect "\$ref" --format '\{\{\.Id\}\}'/)
  assert.doesNotMatch(vendor, /docker save "\$ref"/)
  const metadata = build.slice(end)
  for (const { ref, configImageId } of Object.values(vendors)) {
    assert.match(metadata, new RegExp(ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(metadata, new RegExp(`sha256:${configImageId}`))
  }
  assert.match(metadata, /if \(expectedVendorConfigImageIds\[name\] && imageIds\[name\] !== expectedVendorConfigImageIds\[name\]\) throw new Error\('vendor config image ID mismatch'\)/)
  assert.match(metadata, /const vendor = vendorRefs\[name\][\s\S]*inspectDockerSaveArchive\(archivePath, \{ imageId: imageIds\[name\], \.\.\.\(vendor \? \{ identity: vendor \} : \{\}\) \}\)/)
})

test('offline workflow permits only the signed exact PostgreSQL gosu reachability exception', () => {
  assert.match(workflow, /POSTGRES_IMAGE: postgres:16\.15-alpine@sha256:44c4ee9810eff91f7eab4d822642e01115b1a9eccce4bcbdde7604752d68eac6/)
  assert.match(workflow, /POSTGRES_CONFIG_IMAGE_ID: sha256:75f5a96988cdf694a215073c3e9c001b706b371e2f94df3967f2efdec2787f6b/)
  assert.match(workflow, /POSTGRES_INSPECT_IMAGE: golang:1\.26\.3-alpine@sha256:91eda9776261207ea25fd06b5b7fed8d397dd2c0a283e77f2ab6e91bfa71079d/)
  assert.match(workflow, /--ignorefile \/policy\/postgres-gosu\.trivyignore\.yaml --show-suppressed/)
  assert.match(workflow, /onprem-postgres-vulnerability-exception\.mjs verify/)
  assert.match(workflow, /postgres-vulnerability-exception-receipt\.json/)
  assert.match(workflow, /postgres\) ref="\$POSTGRES_IMAGE"; image_id="\$POSTGRES_CONFIG_IMAGE_ID" ;;/)
  assert.match(workflow, /gosu_symbols="\$\(docker run[\s\S]*go tool nm \/work\/postgres-gosu\)"/)
  assert.match(workflow, /gosu_symbol_count[\s\S]*main_symbol_present[\s\S]*runtime_main_symbol_present/)
  assert.doesNotMatch(workflow, /printf '%s\\n' "\$gosu_symbols" \| grep -Eq ' T (?:main\\\.main|runtime\\\.main)\$'/)
  assert.match(workflow, /if grep -Eq ' T main\\\.main\$' <<< "\$gosu_symbols"; then\s+main_symbol_present=true\s+fi/)
  assert.match(workflow, /if grep -Eq ' T runtime\\\.main\$' <<< "\$gosu_symbols"; then\s+runtime_main_symbol_present=true\s+fi/)
  assert.match(workflow, /CRYPTO_TLS_SYMBOL_COUNT="\$crypto_tls_symbol_count"[\s\S]{0,500}?VENDOR_EVIDENCE="\$vendor_evidence"[\s\S]{0,200}?node --input-type=module/, 'the verified gosu symbol count and external evidence root must both reach the proof emitter')
  assert.doesNotMatch(workflow, /(?:caddy|redis|seaweedfs)-gosu\.trivyignore/)
})
