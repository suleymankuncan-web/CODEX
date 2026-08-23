import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export function assertDocker29ExistingContainerContract(t, {
  POSIX_SHELL,
  VALID_FINGERPRINT,
  commandLog,
  makeFixture,
  nodeLog,
  runInstallBounded,
  shellEnv,
  shellPath,
}) {
  if (process.platform === 'win32') {
    t.skip('bundled Node archive verifier requires native Linux/WSL path semantics')
    return
  }
  if (!existsSync('/bin/sh')) {
    t.skip('behavioral POSIX harness requires a POSIX shell')
    return
  }

  const runPreflight = (fixture) => spawnSync(POSIX_SHELL, [
    shellPath(join(fixture.bundle, 'operations', 'preflight.sh')),
    '--bundle-root', shellPath(fixture.bundle),
    '--release-id', 'release-test',
    '--target-project', 'hr-axis-onprem-core',
    '--public-key', shellPath(fixture.publicKey),
    '--trusted-fingerprint', VALID_FINGERPRINT,
    '--env-file', shellPath(fixture.envFile),
    '--allow-unloaded-images',
    '--allow-missing-ledger',
  ], { encoding: 'utf8', env: shellEnv(fixture) })

  const valid = makeFixture()
  try {
    // Docker 29 reports container .Image as runtime/manifest identity M, while
    // the signed Docker-save archive carries config identity C. Only the
    // signed RepoTag re-export proof can establish C provenance when C != M.
    writeFileSync(valid.idMode, 'docker-29-runtime-id\n')
    writeFileSync(valid.reexportMode, 'valid\n')
    const result = runPreflight(valid)
    assert.equal(result.status, 0, [result.stdout, result.stderr, commandLog(valid)].join('\n'))
    assert.notEqual('sha256:' + 'b'.repeat(64), 'sha256:' + valid.imageDigests.keycloak, 'Docker 29 fixture must exercise distinct runtime M and config C identities')
    const lines = commandLog(valid).split(/\r?\n/).filter(Boolean)
    assert.equal(lines.filter((line) => line.startsWith('image inspect --format')).length, 1, 'existing-container runtime identity is read once before signed re-export')
    assert.equal(lines.filter((line) => line.startsWith('image save --output')).length, 1, 'existing-container runtime identity requires one signed re-export proof')
    assert.match(lines.find((line) => line.startsWith('image save --output')) ?? '', /registry\.example\/keycloak:synthetic$/)
    const verifierCalls = nodeLog(valid).split(/\r?\n/).filter((line) => line.includes('--input-type=module'))
    assert.equal(verifierCalls.length, 1, 'existing-container runtime identity reaches the bundled archive verifier')
    assert.match(verifierCalls[0], new RegExp('registry\\.example/keycloak:synthetic sha256:' + valid.imageDigests.keycloak))
  } finally {
    rmSync(valid.root, { recursive: true, force: true })
  }

  const wrongRuntime = makeFixture()
  try {
    // Keep a valid signed config C and expected runtime M available, but make
    // the container report a wrong runtime identity; reject before re-export.
    writeFileSync(wrongRuntime.idMode, 'docker-29-runtime-id\n')
    writeFileSync(wrongRuntime.runtimeImageMode, 'wrong-container-runtime\n')
    writeFileSync(wrongRuntime.reexportMode, 'valid\n')
    const result = runInstallBounded(wrongRuntime)
    const output = [result.stdout, result.stderr].join('\n')
    assert.notEqual(result.status, 0, output)
    assert.match(output, /existing target container image identity mismatch: keycloak/)
    const lines = commandLog(wrongRuntime).split(/\r?\n/).filter(Boolean)
    assert.equal(lines.filter((line) => line.startsWith('image save --output')).length, 0, 'wrong container runtime identity fails before re-export')
    assert.equal(lines.filter((line) => line === 'MUTATE').length, 0, 'wrong container runtime identity fails before Compose mutation')
  } finally {
    rmSync(wrongRuntime.root, { recursive: true, force: true })
  }

  const sameIdentity = makeFixture()
  try {
    // The compatibility case remains M == C: no archive fallback is needed.
    const result = runPreflight(sameIdentity)
    assert.equal(result.status, 0, [result.stdout, result.stderr, commandLog(sameIdentity)].join('\n'))
    const lines = commandLog(sameIdentity).split(/\r?\n/).filter(Boolean)
    assert.equal(lines.filter((line) => line.startsWith('image inspect --format')).length, 1, 'M == C compatibility reads the RepoTag runtime identity once')
    assert.equal(lines.filter((line) => line.startsWith('image save --output')).length, 0, 'M == C compatibility does not re-export')
  } finally {
    rmSync(sameIdentity.root, { recursive: true, force: true })
  }
}
