import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { verifyBootstrap } from './onprem-offline-bootstrap-verify.mjs'

const scriptPath = fileURLToPath(new URL('./onprem-offline-bootstrap-verify.mjs', import.meta.url))
const script = readFileSync(scriptPath, 'utf8')
const runbooks = [
  readFileSync(fileURLToPath(new URL('../docs/runbooks/onprem-offline-install-v1.md', import.meta.url)), 'utf8'),
  readFileSync(fileURLToPath(new URL('../docs/runbooks/onprem-offline-backup-restore-v1.md', import.meta.url)), 'utf8'),
]
const [installRunbook, recoveryRunbook] = runbooks
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value

function fixture({ files = { 'docs/proof.txt': { content: 'synthetic\n', mode: 0o644 } }, manifestPatch = () => {}, bundlePatch = () => {} } = {}) {
  const fixtureParent = process.platform !== 'win32' && process.getuid?.() === 0 ? '/var/lib' : tmpdir()
  const root = mkdtempSync(join(fixtureParent, 'onprem-bootstrap-'))
  const bundle = join(root, 'bundle')
  mkdirSync(bundle, { recursive: true })
  const entries = Object.entries(files)
  for (const [pathname, value] of entries) {
    const target = join(bundle, ...pathname.split('/'))
    mkdirSync(join(target, '..'), { recursive: true })
    writeFileSync(target, value.content)
    if (process.platform !== 'win32') chmodSync(target, value.mode)
  }
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const publicPath = join(root, 'public.pem')
  writeFileSync(publicPath, publicKey.export({ type: 'spki', format: 'pem' }))
  const fingerprint = createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex')
  const manifest = {
    schemaVersion: 1,
    configSchemaVersion: 1,
    dataClass: 'synthetic',
    releaseId: 'release-test',
    sourceRevision: 'a'.repeat(40),
    createdAt: '2026-01-01T00:00:00.000Z',
    archiveConfigImageIdDerived: true,
    files: entries.map(([pathname, value]) => ({ path: pathname, bytes: Buffer.byteLength(value.content), sha256: createHash('sha256').update(value.content).digest('hex'), mode: value.mode })).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0),
    images: {},
  }
  manifestPatch(manifest)
  writeFileSync(join(bundle, 'bundle-manifest.json'), JSON.stringify(manifest))
  writeFileSync(join(bundle, 'bundle-signature.json'), JSON.stringify({ algorithm: 'Ed25519', encoding: 'base64url', keyFingerprintSha256: fingerprint, value: sign(null, Buffer.from(JSON.stringify(canonical(manifest))), privateKey).toString('base64url') }))
  bundlePatch({ bundle, root, publicPath })
  return { root, bundle, publicPath, fingerprint, options: { bundleDir: bundle, releaseId: 'release-test', publicKey: publicPath, trustedFingerprint: fingerprint } }
}

function withFixture(options, callback) {
  const value = fixture(options)
  try { callback(value) } finally { rmSync(value.root, { recursive: true, force: true }) }
}

test('bootstrap verifier has no pre-verification local import or producer surface', () => {
  assert.doesNotMatch(script, /from ['"]\.\//)
  assert.doesNotMatch(script, /createPrivateKey|generateKeyPair|\bsign\(/)
})

test('external pinned bootstrap verifies exact closure and rejects tampering', () => {
  withFixture({}, ({ options, bundle }) => {
    assert.equal(verifyBootstrap(options), true)
    writeFileSync(join(bundle, 'docs', 'proof.txt'), 'substitute\n')
    assert.throws(() => verifyBootstrap(options), /identity mismatch/)
  })
})

test('bootstrap verifier rejects unsigned files and empty directories', () => {
  withFixture({ bundlePatch: ({ bundle }) => { writeFileSync(join(bundle, 'docs', 'extra.txt'), 'untrusted\n'); mkdirSync(join(bundle, 'docs', 'empty')) } }, ({ options }) => {
    assert.throws(() => verifyBootstrap(options), /closure|extras|directory/i)
  })
})

test('bootstrap verifier rejects unsafe or duplicate generated paths in a signed manifest', () => {
  withFixture({ files: { 'docs/bundle-manifest.json': { content: 'shadow\n', mode: 0o644 } }, manifestPatch: (manifest) => { manifest.files[0].path = 'docs/bundle-manifest.json' } }, ({ options }) => {
    assert.throws(() => verifyBootstrap(options), /path is invalid/i)
  })
  withFixture({ files: { 'docs/unsafe name.txt': { content: 'unsafe\n', mode: 0o644 } } }, ({ options }) => {
    assert.throws(() => verifyBootstrap(options), /path is invalid/i)
  })
})

test('bootstrap verifier checks metadata identity and generated-file mode', () => {
  withFixture({ manifestPatch: (manifest) => { manifest.sourceRevision = 'not-a-git-revision' } }, ({ options }) => {
    assert.throws(() => verifyBootstrap(options), /identity mismatch/i)
  })
  if (process.platform !== 'win32') {
    withFixture({ bundlePatch: ({ bundle }) => chmodSync(join(bundle, 'bundle-manifest.json'), 0o755) }, ({ options }) => {
      assert.throws(() => verifyBootstrap(options), /mode is invalid/i)
    })
  }
})

test('bootstrap verifier rejects writable bundle and trust ancestors before authentication', () => {
  if (process.platform === 'win32') return
  withFixture({}, ({ options, bundle }) => {
    chmodSync(bundle, 0o777)
    assert.throws(() => verifyBootstrap(options), /ancestor is not root-owned and private/i)
  })
  withFixture({}, ({ options, root }) => {
    chmodSync(root, 0o777)
    assert.throws(() => verifyBootstrap(options), /ancestor is not root-owned and private/i)
  })
})

test('bootstrap verifier rejects symlinked external trust anchors and producer flags', () => {
  if (process.platform !== 'win32') {
    withFixture({ bundlePatch: ({ root, publicPath }) => symlinkSync(publicPath, join(root, 'public-link.pem')) }, ({ options, root }) => {
      assert.throws(() => verifyBootstrap({ ...options, publicKey: join(root, 'public-link.pem') }), /external public key/i)
    })
    withFixture({ bundlePatch: ({ root, bundle }) => symlinkSync(bundle, join(root, 'bundle-link')) }, ({ options, root }) => {
      assert.throws(() => verifyBootstrap({ ...options, bundleDir: join(root, 'bundle-link') }), /bundle root/i)
    })
    withFixture({ bundlePatch: ({ root }) => symlinkSync(root, join(root, 'ancestor-link'), 'dir') }, ({ options, root }) => {
      assert.throws(() => verifyBootstrap({ ...options, bundleDir: join(root, 'ancestor-link', 'bundle') }), /bundle root path is not canonical/i)
      assert.throws(() => verifyBootstrap({ ...options, publicKey: join(root, 'ancestor-link', 'public.pem') }), /external public key path is not canonical/i)
    })
  }
  const result = spawnSync(process.execPath, [scriptPath, 'verify', '--private-key', 'not-accepted'], { encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /unknown|incomplete|required/i)
})

test('operator runbooks stage and hash bootstrap trust only below checked root-private ancestors', () => {
  for (const runbook of runbooks) {
    assert.match(runbook, /require_root_private_ancestors "\$SEAL_PARENT"/)
    assert.match(runbook, /require_root_private_ancestors "\$BOOTSTRAP_PARENT"/)
    assert.match(runbook, /sudo install -o root -g root -m 0500 "\$BOOTSTRAP_SOURCE" "\$TRUSTED_BOOTSTRAP"/)
    assert.match(runbook, /sudo install -o root -g root -m 0400 "\$PUBLIC_KEY_SOURCE" "\$TRUSTED_PUBLIC_KEY"/)
    assert.match(runbook, /sudo sha256sum "\$TRUSTED_BOOTSTRAP"/)
    assert.match(runbook, /sudo node "\$TRUSTED_BOOTSTRAP" verify/)
    assert.ok(runbook.indexOf('sudo install -o root -g root -m 0500') < runbook.indexOf('sudo sha256sum "$TRUSTED_BOOTSTRAP"'))
    assert.ok(runbook.indexOf('sudo sha256sum "$TRUSTED_BOOTSTRAP"') < runbook.indexOf('sudo node "$TRUSTED_BOOTSTRAP" verify'))
  }
})

test('operator runbooks require one protected pre-backup photo handle through every recovery operation', () => {
  for (const runbook of runbooks) {
    assert.match(runbook, /PHOTO_RECOVERY_HANDLE=/)
    assert.match(runbook, /--photo-mode prepare/)
    assert.match(runbook, /--photo-recovery-handle-file "\$PHOTO_RECOVERY_HANDLE"/)
    assert.match(runbook, /--ca-file "\$HR_AXIS_SECRET_ROOT\/caddy\/ca\.crt"/)
    assert.doesNotMatch(runbook, /--ca-file "\$HR_AXIS_SECRET_ROOT\/ca\/ca\.crt"/)
    assert.match(runbook, /root-owned\s+[`']0600[`']/i)
    assert.match(runbook, /never (?:a|an|copied to a) receipt,\s+artifact,\s+upload, or log/i)
  }

  assert.ok(installRunbook.indexOf('--photo-mode prepare') > installRunbook.indexOf('operations/smoke.sh'))
  for (const operation of ['backup.sh', 'restore.sh', 'upgrade.sh', 'rollback.sh']) {
    const operationIndex = recoveryRunbook.indexOf(`operations/${operation}`)
    assert.notEqual(operationIndex, -1)
    assert.notEqual(recoveryRunbook.indexOf('--photo-recovery-handle-file "$PHOTO_RECOVERY_HANDLE"', operationIndex), -1)
  }
  assert.match(recoveryRunbook, /delete\s+.*PHOTO_RECOVERY_HANDLE.* only after .*restore.*upgrade.*rollback/i)
})
