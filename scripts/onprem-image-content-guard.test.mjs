import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rootCertificates } from 'node:tls'
import { test } from 'node:test'

import {
  classifyKeycloakApprovedContent,
  inspectImageContent,
  KEYCLOAK_APPROVED_CONTENT_HASHES,
  normalizeApplicationRoot,
  validateCertificateContent,
} from './onprem-image-content-guard.mjs'

const KEYCLOAK_OPTIONS = { kind: 'keycloak', applicationRoots: ['/opt/keycloak'] }
const VALID_CERTIFICATE = rootCertificates[0]

test('application-root canonicalizer normalizes separators and rejects empty or traversal roots', () => {
  assert.equal(normalizeApplicationRoot('./\\opt\\keycloak///'), 'opt/keycloak')
  assert.equal(normalizeApplicationRoot('///opt/keycloak/'), 'opt/keycloak')
  assert.equal(normalizeApplicationRoot('/opt//keycloak///'), 'opt/keycloak')
  assert.throws(() => normalizeApplicationRoot('////'), /application root must not be empty/)
  for (const root of ['.', './', '../opt/keycloak', '/opt/../keycloak', '/opt/./keycloak']) {
    assert.throws(() => normalizeApplicationRoot(root), /application root must (?:not be empty|be canonical and traversal-free)/)
  }
})

function keycloakFixture() {
  const root = mkdtempSync(join(tmpdir(), 'onprem-keycloak-image-guard-'))
  mkdirSync(join(root, 'opt', 'keycloak'), { recursive: true })
  return root
}

function writeFixtureFile(root, pathname, content) {
  const absolute = join(root, ...pathname.split('/'))
  mkdirSync(join(absolute, '..'), { recursive: true })
  writeFileSync(absolute, content)
}

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
    writeFileSync(join(root, 'etc', 'ssl', 'certs', 'public-ca.pem'), VALID_CERTIFICATE)
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

test('content guard rejects a DER private key stored under an operating-system public certificate path', () => {
  const root = fixture()
  try {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { format: 'der', type: 'pkcs8' },
      publicKeyEncoding: { format: 'der', type: 'spki' },
    })
    mkdirSync(join(root, 'etc', 'ssl', 'certs'), { recursive: true })
    writeFileSync(join(root, 'etc', 'ssl', 'certs', 'leak.crt'), privateKey)

    const result = inspectImageContent(root, { kind: 'backend' })

    assert.equal(result.ok, false)
    assert.ok(result.violations.some((item) => item.code === 'forbidden-file' && item.path.endsWith('etc/ssl/certs/leak.crt')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('content guard canonicalizes an absolute Keycloak application root before applying content and extension guards', () => {
  const root = keycloakFixture()
  try {
    writeFixtureFile(root, 'opt/keycloak/conf/runtime.txt', 'DATABASE_PASSWORD=real-password-value\n')
    writeFixtureFile(root, 'opt/keycloak/conf/source.ts', 'export const value = 1\n')

    const result = inspectImageContent(root, KEYCLOAK_OPTIONS)

    assert.equal(result.ok, false)
    assert.ok(result.violations.some((item) => item.code === 'secret-content' && item.path.endsWith('opt/keycloak/conf/runtime.txt')))
    assert.ok(result.violations.some((item) => item.code === 'forbidden-extension' && item.path.endsWith('opt/keycloak/conf/source.ts')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('content guard rejects traversal roots instead of silently skipping Keycloak application content', () => {
  const root = keycloakFixture()
  try {
    writeFixtureFile(root, 'opt/keycloak/conf/runtime.txt', 'DATABASE_PASSWORD=real-password-value\n')
    writeFixtureFile(root, 'opt/keycloak/conf/source.ts', 'export const value = 1\n')

    for (const applicationRoot of ['../opt/keycloak', '/opt/../keycloak', '.', './']) {
      assert.throws(
        () => inspectImageContent(root, { kind: 'keycloak', applicationRoots: [applicationRoot] }),
        /application root must (?:not be empty|be canonical and traversal-free)/,
      )
    }

    const repeatedSeparatorResult = inspectImageContent(root, {
      kind: 'keycloak',
      applicationRoots: ['/opt//keycloak///'],
    })
    assert.equal(repeatedSeparatorResult.ok, false)
    assert.ok(repeatedSeparatorResult.violations.some((item) => item.path.endsWith('opt/keycloak/conf/runtime.txt')))
    assert.ok(repeatedSeparatorResult.violations.some((item) => item.path.endsWith('opt/keycloak/conf/source.ts')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('Keycloak approved-content classifier requires the exact CI path and SHA-256 pair', () => {
  const entries = Object.entries(KEYCLOAK_APPROVED_CONTENT_HASHES)
  assert.equal(entries.length, 13)
  for (const [pathname, sha256] of entries) {
    assert.equal(typeof classifyKeycloakApprovedContent(pathname, sha256), 'string')
    assert.equal(classifyKeycloakApprovedContent(pathname, `${sha256.slice(0, -1)}0`), null)
    assert.equal(classifyKeycloakApprovedContent(pathname.replace(/\.jar$|\.pem$|\.crt$|\.template$/, ''), sha256), null)
  }
  assert.equal(
    classifyKeycloakApprovedContent('opt/keycloak/lib/lib/main/io.quarkus.quarkus-credentials-3.33.2.1.jar', entries[0][1]),
    null,
  )
})

test('certificate validator accepts a parsed trust anchor and rejects private-key material', () => {
  assert.equal(validateCertificateContent(VALID_CERTIFICATE), null)
  assert.equal(validateCertificateContent(VALID_CERTIFICATE.replaceAll('CERTIFICATE', 'TRUSTED CERTIFICATE')), null)
  assert.equal(validateCertificateContent('-----BEGIN PRIVATE KEY-----\nshort\n-----END PRIVATE KEY-----\n'), 'private-key')
  assert.equal(validateCertificateContent('not a certificate'), 'certificate-required')
})

test('content guard accepts the two exact empty Keycloak legacy CA files only with keycloak kind', () => {
  const root = keycloakFixture()
  try {
    for (const pathname of [
      'usr/share/pki/ca-trust-legacy/ca-bundle.legacy.default.crt',
      'usr/share/pki/ca-trust-legacy/ca-bundle.legacy.disable.crt',
    ]) writeFixtureFile(root, pathname, '')

    const result = inspectImageContent(root, KEYCLOAK_OPTIONS)
    assert.equal(result.ok, true)
    assert.deepEqual(result.violations, [])

    const defaultResult = inspectImageContent(root)
    assert.equal(defaultResult.ok, false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('content guard rejects Keycloak near-neighbor paths, providers, renamed extensions, and secret content', () => {
  const root = keycloakFixture()
  try {
    const privateKey = '-----BEGIN ENCRYPTED PRIVATE KEY-----\n' + 'A'.repeat(80) + '\n-----END ENCRYPTED PRIVATE KEY-----\n'
    writeFixtureFile(root, 'etc/ssl/certs/leak.pem', privateKey)
    writeFixtureFile(root, 'etc/java/java-21-openjdk/java-21-openjdk-21.0.12.0.8-1.2.el9.x86_64/conf/management/jmxremote.password', 'monitorRole readonly\n')
    writeFixtureFile(root, 'etc/java/java-21-openjdk/java-21-openjdk-21.0.12.0.8-1.2.el9.x86_64/conf/management/jmxremote.password.template.bak', 'monitorRole readonly\n')
    writeFixtureFile(root, 'etc/pki/product-default/not-digits.pem', VALID_CERTIFICATE)
    writeFixtureFile(root, 'opt/keycloak/providers/io.quarkus.quarkus-credentials-9.9.9.jar', Buffer.from([0, 1, 2, 3]))
    writeFixtureFile(root, 'opt/keycloak/lib/lib/main/io.quarkus.quarkus-credentials-9.9.9.jar', Buffer.from([0, 1, 2, 3]))
    writeFixtureFile(root, 'opt/keycloak/.env', 'MODE=synthetic\n')
    writeFixtureFile(root, 'opt/keycloak/credentials.json', '{}\n')
    writeFixtureFile(root, 'opt/keycloak/lib/lib/main/io.quarkus.quarkus-credentials-3.33.2.1.zip', Buffer.from([0, 1, 2, 3]))

    const result = inspectImageContent(root, KEYCLOAK_OPTIONS)
    assert.equal(result.ok, false)
    assert.ok(result.violations.some((item) => item.code === 'secret-content' && item.path.endsWith('etc/ssl/certs/leak.pem')))
    assert.ok(result.violations.some((item) => item.path.endsWith('/jmxremote.password')))
    assert.ok(result.violations.some((item) => item.path.endsWith('/providers/io.quarkus.quarkus-credentials-9.9.9.jar')))
    assert.ok(result.violations.some((item) => item.path.endsWith('/main/io.quarkus.quarkus-credentials-9.9.9.jar')))
    assert.ok(result.violations.some((item) => item.path.endsWith('/.env')))
    assert.ok(result.violations.some((item) => item.path.endsWith('/credentials.json')))
    assert.ok(result.violations.some((item) => item.path.endsWith('.zip')))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('content guard CLI accepts keycloak kind and rejects unknown kinds', () => {
  const root = keycloakFixture()
  const guard = join(process.cwd(), 'scripts', 'onprem-image-content-guard.mjs')
  try {
    execFileSync(process.execPath, [guard, '--rootfs', root, '--kind', 'keycloak', '--application-root', '/opt/keycloak', '--json'], { encoding: 'utf8' })
    assert.throws(
      () => execFileSync(process.execPath, [guard, '--rootfs', root, '--kind', 'default'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
      (error) => error.status === 2 && String(error.stderr).includes('--kind must be frontend, backend, or keycloak'),
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
