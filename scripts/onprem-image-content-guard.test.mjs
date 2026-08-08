import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { inspectImageContent } from './onprem-image-content-guard.mjs'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'onprem-image-guard-'))
  mkdirSync(join(root, 'app', 'dist'), { recursive: true })
  mkdirSync(join(root, 'app', 'node_modules', 'demo'), { recursive: true })
  mkdirSync(join(root, 'usr', 'share', 'nginx', 'html'), { recursive: true })
  writeFileSync(join(root, 'app', 'dist', 'main.js'), 'console.log("synthetic")\n')
  writeFileSync(join(root, 'app', 'node_modules', 'demo', 'LICENSE'), 'MIT\n')
  writeFileSync(join(root, 'usr', 'share', 'nginx', 'html', 'index.html'), '<main>synthetic</main>\n')
  return root
}

test('content guard accepts clean frontend/backend rootfs fixtures and public VITE values', () => {
  const root = fixture()
  try {
    writeFileSync(join(root, 'usr', 'share', 'nginx', 'html', 'assets.js'), 'const mode = "VITE_API_BASE_URL";\n')
    const result = inspectImageContent(root)
    assert.equal(result.ok, true)
    assert.deepEqual(result.violations, [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('content guard rejects source, metadata, credential files, and high-signal secrets', () => {
  const root = fixture()
  try {
    writeFileSync(join(root, 'app', 'dist', 'source.ts'), 'export const value = 1\n')
    writeFileSync(join(root, 'app', 'dist', 'source.js.map'), '{"sourcesContent":["secret"]}\n')
    writeFileSync(join(root, 'app', '.env.production'), 'DATABASE_PASSWORD=real-password-value\n')
    writeFileSync(join(root, 'app', 'dist', 'private.pem'), '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n')
    const result = inspectImageContent(root)
    assert.equal(result.ok, false)
    assert.ok(result.violations.some((item) => item.code === 'forbidden-extension'))
    assert.ok(result.violations.some((item) => item.code === 'forbidden-file'))
    assert.ok(result.violations.some((item) => item.code === 'secret-content'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('content guard rejects credential filenames anywhere in the exported rootfs', () => {
  const root = fixture()
  try {
    mkdirSync(join(root, 'opt', 'vendor', 'config'), { recursive: true })
    writeFileSync(join(root, 'opt', 'vendor', 'config', '.env.runtime'), 'MODE=synthetic\n')
    writeFileSync(join(root, 'opt', 'vendor', 'config', 'credentials.json'), '{"mode":"synthetic"}\n')
    writeFileSync(join(root, 'opt', 'vendor', 'config', 'id_ed25519'), 'synthetic-placeholder\n')

    const result = inspectImageContent(root)

    assert.equal(result.ok, false)
    assert.ok(result.violations.some((item) => item.code === 'forbidden-file' && item.path.endsWith('/.env.runtime')))
    assert.ok(result.violations.some((item) => item.code === 'forbidden-file' && item.path.endsWith('/credentials.json')))
    assert.ok(result.violations.some((item) => item.code === 'forbidden-file' && item.path.endsWith('/id_ed25519')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('content guard rejects credential files and secret content inside transitive dependencies', () => {
  const root = fixture()
  try {
    const dependencyRoot = join(root, 'app', 'node_modules', 'demo')
    writeFileSync(join(dependencyRoot, '.env'), 'MODE=synthetic\n')
    writeFileSync(join(dependencyRoot, 'credentials.json'), '{"mode":"synthetic"}\n')
    writeFileSync(join(dependencyRoot, 'id_rsa'), 'synthetic-placeholder\n')
    const syntheticToken = ['gh', 'p_', '1234567890abcdefghijklmnop'].join('')
    writeFileSync(join(dependencyRoot, 'runtime.js'), `const token = "${syntheticToken}"\n`)

    const result = inspectImageContent(root, { kind: 'backend' })

    assert.equal(result.ok, false)
    assert.ok(result.violations.some((item) => item.code === 'forbidden-file' && item.path.includes('/node_modules/')))
    assert.ok(result.violations.some((item) => item.code === 'secret-content' && item.path.endsWith('/runtime.js')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('content guard rejects concrete credential assignments in dependency program files', () => {
  const root = fixture()
  try {
    const dependencyRoot = join(root, 'app', 'node_modules', 'demo')
    writeFileSync(join(dependencyRoot, 'runtime.js'), 'DATABASE_PASSWORD=real-password-value\n')

    const result = inspectImageContent(root, { kind: 'backend' })

    assert.equal(result.ok, false)
    assert.ok(result.violations.some((item) => item.code === 'secret-content' && item.path.endsWith('/runtime.js')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('content guard accepts dependency program references without weakening literal assignment checks', () => {
  const root = fixture()
  try {
    const dependencyRoot = join(root, 'app', 'node_modules', 'demo')
    writeFileSync(
      join(dependencyRoot, 'runtime.js'),
      'credentials: inputCredentials\ntoken = wrapper.token\npassword=Y.auth.slice(1)\nACCESS_KEY_ID: AWS_ACCESS_KEY_ID\nPASSWORD=Y.auth.slice(1)\n',
    )

    const result = inspectImageContent(root, { kind: 'backend' })

    assert.equal(result.ok, true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('content guard rejects high-signal tokens embedded in dependency binaries', () => {
  const root = fixture()
  try {
    const dependencyRoot = join(root, 'app', 'node_modules', 'demo')
    const syntheticToken = ['gh', 'p_', '1234567890abcdefghijklmnop'].join('')
    writeFileSync(join(dependencyRoot, 'native.node'), Buffer.concat([
      Buffer.from([0, 1, 2, 3]),
      Buffer.from(syntheticToken),
      Buffer.from([0, 4, 5]),
    ]))

    const result = inspectImageContent(root, { kind: 'backend' })

    assert.equal(result.ok, false)
    assert.ok(result.violations.some((item) => item.code === 'secret-content' && item.path.endsWith('/native.node')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('content guard rejects private key files outside application roots', () => {
  const root = fixture()
  try {
    mkdirSync(join(root, 'etc', 'ssl', 'private'), { recursive: true })
    writeFileSync(join(root, 'etc', 'ssl', 'private', 'server.key'), 'synthetic-private-key\n')

    const result = inspectImageContent(root, { kind: 'backend' })

    assert.equal(result.ok, false)
    assert.ok(result.violations.some((item) => item.code === 'forbidden-file' && item.path.endsWith('etc/ssl/private/server.key')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('content guard keeps operating-system public certificates outside application roots', () => {
  const root = fixture()
  try {
    mkdirSync(join(root, 'etc', 'ssl', 'certs'), { recursive: true })
    writeFileSync(join(root, 'etc', 'ssl', 'certs', 'public-ca.pem'), '-----BEGIN CERTIFICATE-----\nsynthetic-public-ca\n-----END CERTIFICATE-----\n')
    writeFileSync(join(root, 'etc', 'passwd'), 'nonroot:x:65532:65532:nonroot:/home/nonroot:/sbin/nologin\n')
    writeFileSync(join(root, 'etc', 'passwd-'), 'nonroot:x:65532:65532:nonroot:/home/nonroot:/sbin/nologin\n')

    const result = inspectImageContent(root, { kind: 'backend' })

    assert.equal(result.ok, true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('content guard skips binary dependency payloads but fails closed on oversized dependency text', () => {
  const root = fixture()
  try {
    const dependencyRoot = join(root, 'app', 'node_modules', 'demo')
    writeFileSync(join(dependencyRoot, 'native.node'), Buffer.from([0, 1, 2, 3, 4]))
    writeFileSync(join(dependencyRoot, 'oversized.txt'), 'a'.repeat(16 * 1024 * 1024 + 1))

    const result = inspectImageContent(root, { kind: 'backend' })

    assert.equal(result.ok, false)
    assert.ok(result.violations.some((item) => item.code === 'oversized-application-text-file' && item.path.endsWith('/oversized.txt')))
    assert.equal(result.violations.some((item) => item.path.endsWith('/native.node')), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('content guard rejects application-owned tests/docs/cache while allowing license metadata', () => {
  const root = fixture()
  try {
    mkdirSync(join(root, 'app', 'dist', 'tests'), { recursive: true })
    writeFileSync(join(root, 'app', 'dist', 'tests', 'example.js'), 'test("fixture")\n')
    writeFileSync(join(root, 'app', 'node_modules', 'demo', 'NOTICE'), 'Notice\n')
    const result = inspectImageContent(root)
    assert.equal(result.ok, false)
    assert.ok(result.violations.some((item) => item.code === 'forbidden-path'))
    assert.equal(result.violations.some((item) => item.path.endsWith('/NOTICE')), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('content guard rejects application symlinks that can conceal external content', () => {
  const root = fixture()
  const external = mkdtempSync(join(tmpdir(), 'onprem-image-guard-external-'))
  try {
    writeFileSync(join(external, 'hidden.env'), 'PRIVATE_KEY=synthetic-placeholder\n')
    symlinkSync(external, join(root, 'app', 'dist', 'assets'), 'junction')
    const result = inspectImageContent(root, { kind: 'backend' })
    assert.equal(result.ok, false)
    assert.ok(result.violations.some((item) => item.code === 'forbidden-symlink'))
  } finally {
    rmSync(root, { recursive: true, force: true })
    rmSync(external, { recursive: true, force: true })
  }
})
