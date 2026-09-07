import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import monitor from './ci_monitor.cjs'

test('repo-local CI monitor exposes the supported low-noise operations', () => {
  const source = readFileSync('scripts/ci_monitor.cjs', 'utf8')
  for (const command of [
    'runs',
    'watch',
    'fail-fast',
    'log-failed',
    'test-summary',
    'grep',
    'check-actions',
    'wait-for',
    'pr-create',
    'pr-view',
    'pr-merge',
    'retention-plan',
  ]) {
    assert.match(source, new RegExp(`\\b${command}\\b`, 'u'))
  }
  assert.match(source, /--interval', '55'/u)
  assert.match(source, /'pr', 'merge', prNumber, '--squash'/u)
  assert.doesNotMatch(source, /--delete-branch/u)
  assert.doesNotMatch(source, /execSync|shell:\s*true/u)
})

test('retention wrapper cannot pass write approval and dispatches only the main inventory', () => {
  assert.throws(() => monitor.main(['retention-plan', 'approve']), /no approval or write/)
  const source = readFileSync('scripts/ci_monitor.cjs', 'utf8')
  assert.match(source, /'workflow', 'run', 'artifact-retention.yml', '--ref', 'main'/)
})
