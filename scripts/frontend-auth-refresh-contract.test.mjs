import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

test('frontend shell session query key is stable across Clerk token refreshes', () => {
  const app = readText('admin-web/src/App.tsx')
  const sessionStorage = readText('admin-web/src/features/session/session-storage.ts')
  const keyStart = app.indexOf('const shellSessionQueryKey = useMemo(')
  const keyEnd = app.indexOf('  const currentReturnPath', keyStart)
  const queryStart = app.indexOf('const sessionQuery = useQuery({')
  const queryEnd = app.indexOf('  })', queryStart)

  assert.notEqual(keyStart, -1, 'memoized shell session query key was not found')
  assert.notEqual(keyEnd, -1, 'memoized shell session query key end was not found')
  assert.notEqual(queryStart, -1, 'shell session query block was not found')
  assert.notEqual(queryEnd, -1, 'shell session query block end was not found')

  const keyBlock = app.slice(keyStart, keyEnd)
  const queryBlock = app.slice(queryStart, queryEnd)
  assert.doesNotMatch(
    keyBlock,
    /session\.bearerToken\s*,/,
    'raw bearer token in the shell query key causes a visible refetch every Clerk refresh',
  )
  assert.match(keyBlock, /bearerTokenReadiness/)
  assert.match(queryBlock, /queryKey: shellSessionQueryKey/)
  assert.match(app, /token-present/)
  assert.match(app, /token-missing/)
  assert.match(sessionStorage, /buildStableIdentityFingerprint\(payload\)/)
  assert.match(sessionStorage, /hashTokenFingerprint\(identityParts\.join\('\|'\)\)/)
  assert.doesNotMatch(
    sessionStorage,
    /return `token:\$\{hashTokenFingerprint\(normalized\)\}`/,
    'hashing the whole bearer token makes the shell query key churn on token rotation',
  )
})
