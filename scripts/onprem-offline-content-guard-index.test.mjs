import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync } from 'node:crypto'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { canonicalize, createContentGuardIndex, verifyContentGuardIndex } from './onprem-offline-content-guard-index.mjs'

function header(name, size, type = '0') {
  const value = Buffer.alloc(512)
  value.write(name, 0, 100, 'ascii')
  value.write('0000644\0', 100, 8, 'ascii')
  value.write(`${size.toString(8).padStart(11, '0')}\0`, 124, 12, 'ascii')
  value.write('        ', 148, 8, 'ascii')
  value.write(type, 156, 1, 'ascii')
  value.write('ustar\0', 257, 6, 'ascii')
  value.write('00', 263, 2, 'ascii')
  let sum = 0
  for (const byte of value) sum += byte
  value.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii')
  return value
}
function archive(configBytes, name, layerCount = 0) {
  const id = createHash('sha256').update(configBytes).digest('hex')
  const configName = `${id}.json`
  const layerNames = Array.from({ length: layerCount }, (_, index) => `layers/${String(index).padStart(2, '0')}-${String(index + 1).repeat(64)}`)
  const manifest = Buffer.from(JSON.stringify([{ Config: configName, RepoTags: [`registry.example/${name}:synthetic`], Layers: layerNames }]))
  const blocks = []
  for (const [path, body] of [['manifest.json', manifest], [configName, configBytes]]) blocks.push(header(path, body.length), body, Buffer.alloc((512 - (body.length % 512)) % 512))
  for (const path of layerNames) {
    const body = Buffer.from(`layer:${name}:${path}\n`)
    blocks.push(header(path, body.length), body, Buffer.alloc((512 - (body.length % 512)) % 512))
  }
  return { bytes: Buffer.concat([...blocks, Buffer.alloc(1024)]), imageId: `sha256:${id}` }
}
function write(root, path, value, mode = 0o644) {
  const pathname = join(root, ...path.split('/'))
  mkdirSync(join(pathname, '..'), { recursive: true })
  writeFileSync(pathname, value, { mode })
  if (process.platform !== 'win32') chmodSync(pathname, mode)
  return pathname
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'onprem-content-guard-index-'))
  const proof = join(root, 'proof'); mkdirSync(proof)
  const keys = generateKeyPairSync('ed25519')
  const privateKeyPath = join(root, 'private.pem'); const publicKeyPath = join(root, 'public.pem')
  writeFileSync(privateKeyPath, keys.privateKey.export({ type: 'pkcs8', format: 'pem' }))
  writeFileSync(publicKeyPath, keys.publicKey.export({ type: 'spki', format: 'pem' }))
  const images = {}
  for (const name of ['backend', 'frontend', 'keycloak']) {
    const config = Buffer.from(JSON.stringify({ image: name, synthetic: true }))
    const layerCount = name === 'backend' ? 2 : name === 'frontend' ? 1 : 0
    const value = archive(config, name, layerCount)
    write(root, `proof/${name}-image.tar`, value.bytes)
    write(root, `proof/${name}-content-guard.json`, JSON.stringify({ ok: true, violations: [] }))
    for (let index = 0; index < layerCount; index += 1) write(root, `proof/${name}-layer-${index}-content-guard.json`, JSON.stringify({ ok: true, violations: [] }))
    images[name] = { imageId: value.imageId, archivePath: `${name}-image.tar`, finalRootfsPath: `${name}-content-guard.json` }
  }
  const fingerprint = createHash('sha256').update(keys.publicKey.export({ type: 'spki', format: 'der' })).digest('hex')
  return { root, baseDir: proof, images, privateKeyPath, publicKeyPath, fingerprint }
}

test('generates and verifies a signed workflow-shaped index with complete ordered layer receipts', () => {
  const value = fixture()
  try {
    const index = createContentGuardIndex({ baseDir: value.baseDir, images: value.images, privateKeyPath: value.privateKeyPath })
    assert.equal(index.artifacts.backend.layerCount, 2)
    assert.deepEqual(index.artifacts.backend.layers.map((layer) => layer.index), [0, 1])
    assert.equal(index.artifacts.frontend.layerCount, 1)
    assert.equal(index.artifacts.keycloak.layerCount, 0)
    assert.deepEqual(Object.keys(verifyContentGuardIndex(index, { baseDir: value.baseDir, publicKeyPath: value.publicKeyPath, trustedKeyFingerprintSha256: value.fingerprint, expectedImages: value.images })).sort(), ['backend', 'frontend', 'keycloak'])
    assert.equal(index.artifacts.backend.layers[0].manifestLayerPath, 'layers/00-' + '1'.repeat(64))
    rmSync(join(value.baseDir, 'backend-layer-1-content-guard.json'))
    assert.throws(() => createContentGuardIndex({ baseDir: value.baseDir, images: value.images, privateKeyPath: value.privateKeyPath }), /layer receipt count|complete|manifest/i)
    write(value.root, 'proof/backend-layer-1-content-guard.json', JSON.stringify({ ok: true, violations: [] }))
    rmSync(join(value.baseDir, 'frontend-content-guard.json'))
    assert.throws(() => createContentGuardIndex({ baseDir: value.baseDir, images: value.images, privateKeyPath: value.privateKeyPath }), /final rootfs receipt|missing/i)
  } finally { rmSync(value.root, { recursive: true, force: true }) }
})

test('rejects omitted, failed, duplicate, wrong-image, wrong-archive, wrong-key, and tampered-signature evidence', () => {
  const value = fixture()
  try {
    const index = createContentGuardIndex({ baseDir: value.baseDir, images: value.images, privateKeyPath: value.privateKeyPath })
    const verify = (candidate, options = {}) => assert.throws(() => verifyContentGuardIndex(candidate, { baseDir: value.baseDir, publicKeyPath: value.publicKeyPath, trustedKeyFingerprintSha256: value.fingerprint, expectedImages: value.images, ...options }), /content guard|layer|archive|signature|fingerprint/i)
    verify({ ...index, artifacts: { ...index.artifacts, backend: { ...index.artifacts.backend, layers: index.artifacts.backend.layers.slice(1), layerCount: 1 } } })
    write(value.root, 'proof/frontend-layer-0-content-guard.json', JSON.stringify({ ok: false, violations: ['x'] }))
    verify(index)
    rmSync(join(value.root, 'proof', 'frontend-layer-0-content-guard.json'))
    const duplicate = { ...index, artifacts: { ...index.artifacts, backend: { ...index.artifacts.backend, layers: [...index.artifacts.backend.layers, { ...index.artifacts.backend.layers[1], index: 2 }] , layerCount: 3 } } }
    verify(duplicate)
    verify({ ...index, artifacts: { ...index.artifacts, backend: { ...index.artifacts.backend, imageId: value.images.frontend.imageId } } })
    verify({ ...index, artifacts: { ...index.artifacts, backend: { ...index.artifacts.backend, archive: { ...index.artifacts.backend.archive, path: 'proof/frontend-image.tar' } } } })
    verify({ ...index, artifacts: { ...index.artifacts, backend: { ...index.artifacts.backend, layers: index.artifacts.backend.layers.map((layer, index) => index === 0 ? { ...layer, manifestLayerPath: 'layers/00-' + '9'.repeat(64) } : layer) } } })
    const tampered = { ...index, signature: { ...index.signature, value: `${index.signature.value.slice(0, -1)}${index.signature.value.endsWith('A') ? 'B' : 'A'}` } }
    verify(tampered)
    const wrong = generateKeyPairSync('ed25519'); const wrongPath = join(value.root, 'wrong.pem'); writeFileSync(wrongPath, wrong.publicKey.export({ type: 'spki', format: 'pem' }))
    verify(index, { publicKeyPath: wrongPath, trustedKeyFingerprintSha256: value.fingerprint })
  } finally { rmSync(value.root, { recursive: true, force: true }) }
})

test('canonical signature payload excludes the mutable signature envelope', () => {
  const value = fixture()
  try {
    const index = createContentGuardIndex({ baseDir: value.baseDir, images: value.images, privateKeyPath: value.privateKeyPath })
    assert.equal(typeof canonicalize({ schemaVersion: index.schemaVersion, dataClass: index.dataClass, artifacts: index.artifacts }), 'string')
  } finally { rmSync(value.root, { recursive: true, force: true }) }
})
