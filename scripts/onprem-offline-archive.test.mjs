import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { inspectDockerSaveArchive, MAX_ARCHIVE_JSON_BYTES } from './onprem-offline-archive.mjs'

function header(name, size, type = '0') {
  const value = Buffer.alloc(512); value.write(name, 0, 100, 'ascii'); value.write('0000644\0', 100, 8, 'ascii')
  value.write(`${size.toString(8).padStart(11, '0')}\0`, 124, 12, 'ascii'); value.write('        ', 148, 8, 'ascii'); value.write(type, 156, 1, 'ascii'); value.write('ustar\0', 257, 6, 'ascii'); value.write('00', 263, 2, 'ascii')
  let sum = 0; for (const byte of value) sum += byte; value.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii'); return value
}
function archive({ repository = 'registry.example/backend', configBytes = Buffer.from('{"synthetic":true}'), configName, configType = '0', repoTags, layerName = null, layerBytes = Buffer.from('layer'), layerType = '0', modern = false, manifestFirst = true, extraEntries = [] } = {}) {
  const id = createHash('sha256').update(configBytes).digest('hex'); const config = configName ?? `${id}.json`
  const configPath = modern ? `blobs/sha256/${id}` : config
  const manifest = Buffer.from(JSON.stringify([{ Config: config, RepoTags: repoTags ?? [`${repository}:synthetic`], Layers: layerName ? [layerName] : [] }]))
  const modernManifest = modern ? Buffer.from(JSON.stringify([{ Config: configPath, RepoTags: repoTags ?? [`${repository}:synthetic`], Layers: layerName ? [layerName] : [] }])) : manifest
  const entries = manifestFirst ? [['manifest.json', modernManifest], [configPath, configBytes, configType]] : [[configPath, configBytes, configType], ['manifest.json', modernManifest]]
  if (layerName) entries.push([layerName, layerBytes, layerType])
  entries.push(...extraEntries)
  const blocks = []
  for (const [name, body, type = '0'] of entries) blocks.push(header(name, body.length, type), body, Buffer.alloc((512 - (body.length % 512)) % 512))
  return { bytes: Buffer.concat([...blocks, Buffer.alloc(1024)]), id: `sha256:${id}` }
}
function fixture(value) {
  const root = mkdtempSync(join(tmpdir(), 'onprem-archive-')); const path = join(root, 'image.tar'); writeFileSync(path, value.bytes); return { root, path }
}

test('inspects Docker-save archive and derives config image id', () => {
  const value = archive(); const file = fixture(value)
  try {
    const result = inspectDockerSaveArchive(file.path, { identity: 'registry.example/backend:synthetic@sha256:' + 'a'.repeat(64), imageId: value.id })
    assert.equal(result.imageId, value.id); assert.equal(result.archiveConfigImageIdDerived, true)
    assert.deepEqual(result.layers, []); assert.equal(result.layerCount, 0)
  } finally { rmSync(file.root, { recursive: true, force: true }) }
})

test('rejects swapped identity, traversal, symlink, duplicate, and device entries', () => {
  const valid = archive(); const file = fixture(valid)
  try {
    assert.throws(() => inspectDockerSaveArchive(file.path, { identity: 'registry.example/frontend:synthetic@sha256:' + 'a'.repeat(64), imageId: valid.id }), /RepoTags|identity/i)
    const traversal = archive({ layerName: '../layer.tar' }); const traversalFile = fixture(traversal)
    assert.throws(() => inspectDockerSaveArchive(traversalFile.path, { identity: 'registry.example/backend:synthetic@sha256:' + 'a'.repeat(64), imageId: traversal.id }), /unsafe|path/i)
    rmSync(traversalFile.root, { recursive: true, force: true })
    const duplicate = (() => { const id = createHash('sha256').update(Buffer.from('{"synthetic":true}')).digest('hex'); const config = Buffer.from('{"synthetic":true}'); const m = Buffer.from(JSON.stringify([{ Config: `${id}.json`, RepoTags: ['registry.example/backend:synthetic'], Layers: [] }])); return { bytes: Buffer.concat([header('manifest.json', m.length), m, Buffer.alloc(512 - m.length), header(`${id}.json`, config.length), config, Buffer.alloc(512 - config.length), header(`${id}.json`, config.length), config, Buffer.alloc(512 - config.length), Buffer.alloc(1024)]), id: `sha256:${id}` } })()
    const duplicateFile = fixture(duplicate); assert.throws(() => inspectDockerSaveArchive(duplicateFile.path, { identity: 'registry.example/backend:synthetic@sha256:' + 'a'.repeat(64), imageId: duplicate.id }), /duplicate/i); rmSync(duplicateFile.root, { recursive: true, force: true })
  } finally { rmSync(file.root, { recursive: true, force: true }) }
})

test('accepts modern Docker-save OCI blob config paths and validates listed regular layers', () => {
  const value = archive({ modern: true, layerName: 'blobs/sha256/' + 'b'.repeat(64) }); const file = fixture(value)
  try {
    const result = inspectDockerSaveArchive(file.path, { identity: 'registry.example/backend:synthetic@sha256:' + 'a'.repeat(64), imageId: value.id })
    assert.equal(result.config, 'blobs/sha256/' + value.id.slice('sha256:'.length)); assert.equal(result.imageId, value.id)
    assert.deepEqual(result.layers, ['blobs/sha256/' + 'b'.repeat(64)]); assert.equal(result.layerCount, 1)
  } finally { rmSync(file.root, { recursive: true, force: true }) }
})

test('does not apply the bounded JSON config limit to modern OCI layer blobs', () => {
  const value = archive({
    modern: true,
    layerName: 'blobs/sha256/' + 'b'.repeat(64),
    layerBytes: Buffer.alloc(MAX_ARCHIVE_JSON_BYTES + 512),
  })
  const file = fixture(value)
  try {
    const result = inspectDockerSaveArchive(file.path, { identity: 'registry.example/backend:synthetic@sha256:' + 'a'.repeat(64), imageId: value.id })
    assert.equal(result.imageId, value.id)
    assert.deepEqual(result.layers, ['blobs/sha256/' + 'b'.repeat(64)])
  } finally { rmSync(file.root, { recursive: true, force: true }) }
})

test('still rejects an oversized manifest-selected modern OCI config blob', () => {
  const value = archive({ modern: true, configBytes: Buffer.alloc(MAX_ARCHIVE_JSON_BYTES + 1) })
  const file = fixture(value)
  try {
    assert.throws(
      () => inspectDockerSaveArchive(file.path, { identity: 'registry.example/backend:synthetic@sha256:' + 'a'.repeat(64), imageId: value.id }),
      /config.*too large/i,
    )
  } finally { rmSync(file.root, { recursive: true, force: true }) }
})

test('accepts config-before-manifest and NUL-typed regular config entries', () => {
  const value = archive({ manifestFirst: false, configType: '\0' }); const file = fixture(value)
  try {
    const result = inspectDockerSaveArchive(file.path, { identity: 'registry.example/backend:synthetic@sha256:' + 'a'.repeat(64), imageId: value.id })
    assert.equal(result.imageId, value.id)
  } finally { rmSync(file.root, { recursive: true, force: true }) }
})

test('requires the exact owner repository and tag before the identity digest', () => {
  for (const repoTags of [['registry.example/backend:other'], ['registry.example/other:synthetic']]) {
    const value = archive({ repoTags }); const file = fixture(value)
    try {
      assert.throws(() => inspectDockerSaveArchive(file.path, { identity: 'registry.example/backend:synthetic@sha256:' + 'a'.repeat(64), imageId: value.id }), /RepoTags|identity/i)
    } finally { rmSync(file.root, { recursive: true, force: true }) }
  }
})

test('allows safe trailing-slash directory entries that are not manifest layers', () => {
  const value = archive({ extraEntries: [['blobs/', Buffer.alloc(0), '5']] }); const file = fixture(value)
  try {
    assert.equal(inspectDockerSaveArchive(file.path, { identity: 'registry.example/backend:synthetic@sha256:' + 'a'.repeat(64), imageId: value.id }).archiveConfigImageIdDerived, true)
  } finally { rmSync(file.root, { recursive: true, force: true }) }
})

test('rejects PAX entries, corrupt checksums, layer directories, and non-zero trailing data', () => {
  const identity = { identity: 'registry.example/backend:synthetic@sha256:' + 'a'.repeat(64) }
  const paxBody = Buffer.from('24 path=../outside\n')
  const pax = archive({ extraEntries: [['PaxHeaders.0', paxBody, 'x']] }); const paxFile = fixture(pax)
  try { assert.throws(() => inspectDockerSaveArchive(paxFile.path, { ...identity, imageId: pax.id }), /PAX|link|device|entry/i) } finally { rmSync(paxFile.root, { recursive: true, force: true }) }

  const checksum = archive(); checksum.bytes[0] ^= 1; const checksumFile = fixture(checksum)
  try { assert.throws(() => inspectDockerSaveArchive(checksumFile.path, { ...identity, imageId: checksum.id }), /checksum/i) } finally { rmSync(checksumFile.root, { recursive: true, force: true }) }

  const layerDirectory = archive({ layerName: 'blobs/sha256/' + 'b'.repeat(64), layerType: '5' }); const directoryFile = fixture(layerDirectory)
  try { assert.throws(() => inspectDockerSaveArchive(directoryFile.path, { ...identity, imageId: layerDirectory.id }), /layer|regular/i) } finally { rmSync(directoryFile.root, { recursive: true, force: true }) }

  const trailing = archive(); trailing.bytes = Buffer.concat([trailing.bytes, Buffer.concat([Buffer.alloc(511), Buffer.from([1])])]); const trailingFile = fixture(trailing)
  try { assert.throws(() => inspectDockerSaveArchive(trailingFile.path, { ...identity, imageId: trailing.id }), /trailing|non-zero/i) } finally { rmSync(trailingFile.root, { recursive: true, force: true }) }
})

test('hashes and parses an archive through one descriptor and rejects same-size mutation before final identity check', () => {
  const value = archive(); const file = fixture(value)
  try {
    const result = inspectDockerSaveArchive(file.path, { imageId: value.id })
    assert.equal(result.archiveSha256, createHash('sha256').update(value.bytes).digest('hex'))
    assert.throws(() => inspectDockerSaveArchive(file.path, { imageId: value.id }, {
      hooks: { beforeFinalStat: () => { const mutated = Buffer.from(value.bytes); mutated[0] ^= 1; writeFileSync(file.path, mutated); utimesSync(file.path, new Date(Date.now() + 5000), new Date(Date.now() + 5000)) } },
    }), /changed|parsing/i)
  } finally { rmSync(file.root, { recursive: true, force: true }) }
})
