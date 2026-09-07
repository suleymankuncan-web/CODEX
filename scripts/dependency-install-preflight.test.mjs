import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { checkInstalledDependencies } from './dependency-install-preflight.mjs'

test('dependency preflight inspects both worktree trees without installation or audit suppression', () => {
  const calls = []
  checkInstalledDependencies({ workspaceRoot: '/workspace', run: (...args) => {
    calls.push(args); return { status: 0, stdout: '{"dependencies":{}}' }
  } })
  assert.equal(calls.length, 2)
  for (const [command, args, options] of calls) {
    assert.match([command, ...args].join(' '), /npm(?:\.cmd)? ls --all --json/)
    assert.doesNotMatch(args.join(' '), /install|audit|omit/)
    assert.equal(options.timeout, 60_000)
    assert.ok(options.cwd.includes('workspace'))
  }
})

test('missing, invalid, malformed and timed-out dependencies stop before expensive stages', () => {
  for (const result of [
    { status: 1, stdout: '{"problems":["invalid: qs"]}' },
    { status: 0, stdout: '{"problems":["missing: compiler"]}' },
    { status: 0, stdout: 'not JSON' }, { error: new Error('timeout') },
  ]) {
    let calls = 0
    assert.throws(() => checkInstalledDependencies({ workspaceRoot: '/workspace', run: () => {
      calls++; return result
    } }), /Dependency preflight failed/)
    assert.equal(calls, 1)
  }
})

test('npm-success optional-platform extras do not invalidate a clean installation', () => {
  assert.doesNotThrow(() => checkInstalledDependencies({ workspaceRoot: '/workspace', run: () => ({
    status: 0, stdout: '{"dependencies":{},"problems":["extraneous: optional-platform-package"]}',
  }) }))
})

test('canonical fresh root stage starts with dependency preflight and retains the complete script suite', () => {
  const manifest = JSON.parse(readFileSync(new URL('./release-stage-manifest.json', import.meta.url), 'utf8'))
  const commands = manifest.stages.find(stage => stage.id === 'root-contracts').commands
  assert.deepEqual(commands[0], ['node', 'scripts/dependency-install-preflight.mjs'])
  assert.ok(commands.some(command => command.join(' ') === 'npm run test:scripts'))
})
