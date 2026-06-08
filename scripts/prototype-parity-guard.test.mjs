import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const prototypeReadmePath = 'docs/prototypes/README.md'

function sha256(path) {
  const normalizedText = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
  return createHash('sha256').update(normalizedText, 'utf8').digest('hex').toUpperCase()
}

function lockedPrototypeRows(readme = readFileSync(prototypeReadmePath, 'utf8')) {
  return readme
    .split(/\r?\n/)
    .map((line) => line.match(/^\| `(docs\/prototypes\/[^`]+)` \| ([^|]+) \| `([A-F0-9]{64})` \|$/))
    .filter(Boolean)
    .map((match) => ({
      path: match[1],
      surface: match[2].trim(),
      hash: match[3],
    }))
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, ' ')
}

test('locked prototype hashes match the checked-in prototype files', () => {
  const rows = lockedPrototypeRows()

  assert.ok(rows.length >= 2, 'expected at least the locked Store workforce and approvals prototypes')

  for (const row of rows) {
    assert.equal(
      sha256(row.path),
      row.hash,
      `${row.path} hash drifted; update the locked prototype contract deliberately`,
    )
  }
})

test('prototype shelf records the minimum implementation evidence checklist', () => {
  const readme = readFileSync(prototypeReadmePath, 'utf8')
  const normalizedReadme = normalizeWhitespace(readme)

  for (const expected of [
    'Prototype Implementation Evidence',
    'approved prototype path',
    'route, persona, role visibility, and scope matrix',
    'real data source for every visible metric, status, row, and action',
    'loading, empty, error, access, and partial-data states',
    'desktop and mobile screenshot comparison',
    'intentional production deviations with reasons',
    'fake data, demo rows, and prototype-only helper cleanup',
    'not a second product-experience policy',
  ]) {
    assert.ok(normalizedReadme.includes(expected), `missing README evidence text: ${expected}`)
  }
})

test('prototype hash parser rejects a synthetic stale hash', () => {
  const fakeReadme = '| `docs/prototypes/store-workforce-prototype-v1.html` | `/store/workforce` | `0000000000000000000000000000000000000000000000000000000000000000` |'
  const [row] = lockedPrototypeRows(fakeReadme)

  assert.notEqual(sha256(row.path), row.hash)
})
