import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { selectAffectedVerification } from './affected-verification-selector.mjs'
import { selectRequiredReleaseGateScope } from './required-release-gate.mjs'

test('local and remote release choices agree for docs, runtime, mixed and unknown files', () => {
  for (const files of [
    ['AGENTS.md'], ['scripts/contributing-contract.test.mjs'],
    ['scripts/root-execution-routing-contract.test.mjs'],
    ['.agents/skills/hr-axis-session-handoff/SKILL.md'],
    ['.agents/skills/unreviewed/SKILL.md'], ['.agents/skills/hr-axis-session-handoff/helper.mjs'],
    ['scripts/unknown-doc-contract.test.mjs'], ['docs/api/openapi.json'],
    ['scripts/onprem-company-data-contract.test.mjs'], ['admin-web/src/pages/example.tsx'],
    ['backend/nestjs/package.json'], ['unknown.file'],
    ['AGENTS.md', 'backend/nestjs/src/shared/app-config.ts'],
  ]) {
    assert.equal(selectAffectedVerification(files).fullReleaseRequired,
      selectRequiredReleaseGateScope(files).runRootRelease, files.join(','))
  }
})

test('canonical release is selected once without duplicate broad execution commands', () => {
  const result = selectAffectedVerification(['package.json'])
  assert.deepEqual(result.executionCommands, ['git diff --check', 'npm.cmd run check:release'])
  assert.ok(result.commands.includes('npm.cmd run test:scripts'), 'detail remains available')
  const docs = selectAffectedVerification(['scripts/contributing-contract.test.mjs'])
  assert.deepEqual(docs.executionCommands, ['git diff --check', 'npm.cmd run test:scripts'])
})

test('a test suffix does not exempt operational, auth or arbitrary scripts', () => {
  for (const path of ['scripts/onprem-image-content-guard.test.mjs', 'scripts/unknown.test.mjs', 'scripts/required-release-gate-contract.test.mjs']) {
    assert.equal(selectRequiredReleaseGateScope([path]).runRootRelease, true)
  }
  assert.equal(selectRequiredReleaseGateScope(['scripts/verification-docs-scope.mjs']).proofMode, 'full')
})

test('failed Git discovery cannot masquerade as a clean docs-only working tree', () => {
  const script = fileURLToPath(new URL('./affected-verification-selector.mjs', import.meta.url))
  const result = spawnSync(process.execPath, [script], {
    encoding: 'utf8', env: { ...process.env, PATH: '', HR_AXIS_CHANGED_FILES: '' },
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Cannot determine changed files from Git/)
  assert.doesNotMatch(result.stdout, /Full release required: no/)
})
