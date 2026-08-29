import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

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
  ]) {
    assert.match(source, new RegExp(`\\b${command}\\b`, 'u'))
  }
  assert.match(source, /--interval', '55'/u)
  assert.match(source, /'pr', 'merge', prNumber, '--squash'/u)
  assert.doesNotMatch(source, /--delete-branch/u)
  assert.doesNotMatch(source, /execSync|shell:\s*true/u)
})
