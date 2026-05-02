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
  const queryStart = app.indexOf('const sessionQuery = useQuery({')
  const queryEnd = app.indexOf('  })', queryStart)

  assert.notEqual(queryStart, -1, 'shell session query block was not found')
  assert.notEqual(queryEnd, -1, 'shell session query block end was not found')

  const queryBlock = app.slice(queryStart, queryEnd)
  assert.doesNotMatch(
    queryBlock,
    /session\.bearerToken\s*,/,
    'raw bearer token in the shell query key causes a visible refetch every Clerk refresh',
  )
  assert.match(queryBlock, /bearerTokenReadiness/)
  assert.match(app, /token-present/)
  assert.match(app, /token-missing/)
})
