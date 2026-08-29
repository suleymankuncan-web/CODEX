import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const appRoot = join(import.meta.dirname, '..')
const specFiles = [
  'e2e/store-surfaces-workforce.spec.ts',
  'e2e/store-surfaces-performance.spec.ts',
  'e2e/store-surfaces-shell.spec.ts',
  'e2e/store-surfaces-rankings.spec.ts',
  'e2e/store-surfaces-personnel-performance.spec.ts',
  'e2e/store-surfaces-operations.spec.ts',
]
const fixtureFiles = [
  'e2e/store-surfaces-identities.ts',
  'e2e/store-surfaces-api-fixtures.ts',
  'e2e/store-surfaces-profile-fixtures.ts',
  'e2e/store-surfaces-ranking-fixtures.ts',
  'e2e/store-surfaces-operations-fixtures.ts',
]

function read(path) {
  return readFileSync(join(appRoot, path), 'utf8')
}

test('store surface regressions stay split into bounded domain specs without losing cases', () => {
  assert.equal(existsSync(join(appRoot, 'e2e/store-surfaces.spec.ts')), false)

  const titles = []
  for (const path of specFiles) {
    const source = read(path)
    const lines = source.split(/\r?\n/u).length
    assert.ok(lines <= 1200, `${path} has ${lines} lines; split it before adding more coverage`)

    for (const match of source.matchAll(/^test\((['"])(.*?)\1,/gmu)) {
      titles.push(match[2])
    }
  }

  assert.equal(titles.length, 93, 'the split must preserve all 93 Store surface regressions')
  assert.equal(new Set(titles).size, titles.length, 'Store surface regression titles must remain unique')
})

test('store surface fixtures remain test-free and below the tracked source limit', () => {
  for (const path of fixtureFiles) {
    const source = read(path)
    const lines = source.split(/\r?\n/u).length
    assert.ok(lines <= 1200, `${path} has ${lines} lines; split the fixture before it becomes broad`)
    assert.doesNotMatch(source, /^test\(/mu, `${path} must not own executable test cases`)
  }
})
