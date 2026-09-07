import assert from 'node:assert/strict'
import test from 'node:test'
import { createShellPath } from './test-shell-path.mjs'

test('repeated absolute fixture paths avoid repeated converters without sharing filesystem state', () => {
  let calls = 0
  const convert = createShellPath({ cygpath: 'cygpath', run: (_file, args) => {
    calls++; return { status: 0, stdout: '/converted/' + args[1] }
  } })
  for (let i = 0; i < 10; i++) assert.equal(convert('C:/fixture/a'), '/converted/C:/fixture/a')
  assert.equal(calls, 1)
  convert('C:/fixture/b')
  assert.equal(calls, 2)
})

test('relative paths and failed conversions are never cached', () => {
  let calls = 0
  const convert = createShellPath({ cygpath: 'cygpath', run: () => {
    calls++; return calls === 1 ? { status: 1 } : { status: 0, stdout: '/ok' }
  } })
  assert.equal(convert('C:/fixture'), 'C:/fixture')
  assert.equal(convert('C:/fixture'), '/ok')
  convert('relative'); convert('relative')
  assert.equal(calls, 4)
})

test('POSIX paths need no converter and empty/error results preserve fallback', () => {
  assert.equal(createShellPath()('/fixture'), '/fixture')
  for (const result of [{ status: 0, stdout: '' }, { error: new Error('unavailable') }]) {
    assert.equal(createShellPath({ cygpath: 'x', run: () => result })('C:/fixture'), 'C:/fixture')
  }
})
