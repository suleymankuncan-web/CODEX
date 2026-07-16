import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, join, normalize } from 'node:path'
import test from 'node:test'

const prototypeReadmePath = 'docs/prototypes/README.md'
const commandCanvasManifestPath =
  'docs/evidence/store-operational-surfaces-command-canvas/prototype-digest-manifest-v1.json'

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

function commandCanvasManifest() {
  return JSON.parse(readFileSync(commandCanvasManifestPath, 'utf8'))
}

function commandCanvasEntries(manifest = commandCanvasManifest()) {
  return [...manifest.prototype.sources, ...manifest.prototype.captures]
}

function commandCanvasSelectionDigest(entries = commandCanvasEntries()) {
  const canonical = entries
    .map(({ path, sha256: hash }) => `${path.replaceAll('\\', '/')}\t${hash.toLowerCase()}\n`)
    .sort()
    .join('')

  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}

function binarySha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
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

test('Store operational Command Canvas manifest freezes route role state and viewport matrices', () => {
  const manifest = commandCanvasManifest()

  assert.equal(manifest.status, 'owner_approved_locked_reference')
  assert.deepEqual(
    manifest.prototype.surfaces.map(({ route }) => route),
    ['/store/kpis', '/store/approvals', '/store/workforce', '/store/tasks'],
  )
  assert.deepEqual(
    manifest.prototype.contractMatrices.roles.map(({ role }) => role),
    ['REPORT_VIEWER', 'REGION_MANAGER', 'STORE_MANAGER'],
  )
  assert.deepEqual(manifest.prototype.contractMatrices.viewports, [
    '1440x900',
    '1024x768',
    '390x844',
    '320x844',
  ])
  assert.deepEqual(manifest.prototype.contractMatrices.states, [
    'loading',
    'ready',
    'empty',
    'local_filter_empty',
    'partial',
    'background_error',
    'full_error_retry',
    'unauthorized',
  ])
})

test('Store operational Command Canvas selection digest freezes every approved source and capture', () => {
  const manifest = commandCanvasManifest()
  const entries = commandCanvasEntries(manifest)

  assert.equal(entries.length, 31)
  assert.equal(entries.length, manifest.prototype.selectionDigest.entryCount)
  assert.equal(commandCanvasSelectionDigest(entries), manifest.prototype.selectionDigest.sha256)

  const staleEntries = entries.map((entry, index) =>
    index === 0 ? { ...entry, sha256: '0'.repeat(64) } : entry,
  )
  assert.notEqual(
    commandCanvasSelectionDigest(staleEntries),
    manifest.prototype.selectionDigest.sha256,
  )
})

test('Store operational Command Canvas external source matches the locked manifest when available', (t) => {
  const manifest = commandCanvasManifest()
  const root = manifest.prototype.authoritativeRoot

  if (!existsSync(root)) {
    t.skip(`external Labs root is not available: ${root}`)
    return
  }

  for (const entry of commandCanvasEntries(manifest)) {
    assert.equal(isAbsolute(entry.path), false, `manifest path must be relative: ${entry.path}`)
    assert.equal(
      normalize(entry.path).split(/[\\/]/).includes('..'),
      false,
      `manifest path must stay inside the prototype root: ${entry.path}`,
    )

    const target = join(root, entry.path)
    assert.equal(existsSync(target), true, `locked prototype file is missing: ${entry.path}`)
    assert.equal(binarySha256(target), entry.sha256, `locked prototype file drifted: ${entry.path}`)

    if ('bytes' in entry) {
      assert.equal(statSync(target).size, entry.bytes, `locked prototype size drifted: ${entry.path}`)
    }
  }
})
