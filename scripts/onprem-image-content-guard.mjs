import { closeSync, lstatSync, openSync, readFileSync, readSync, readdirSync, readlinkSync } from 'node:fs'
import { createHash, X509Certificate } from 'node:crypto'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const FORBIDDEN_FILENAMES = new Set([
  '.git',
  '.github',
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.npmrc',
  'id_rsa',
  'id_dsa',
  'id_ecdsa',
  'id_ed25519',
  'credentials.json',
  'secrets.json',
  'service-account.json',
])

const FORBIDDEN_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.d.ts',
  '.map',
  '.source',
  '.sourcemap',
])

const FORBIDDEN_SEGMENTS = new Set([
  'tests',
  'test',
  '__tests__',
  'spec',
  'specs',
  'evidence',
  'coverage',
  'cache',
  '.cache',
  'docs',
  'examples',
])

const LICENSE_NAMES = /^(?:license|licence|notice|copying)(?:\.[^.]+)?$/i
const SECRET_FILE_NAME = /(?:^|[._-])(secret|credential|credentials|private|password|passwd|token|api[_-]?key)(?:[._-]|$)/i
const PROGRAM_FILE_EXTENSION = /\.(?:c|cc|cpp|cjs|css|h|hpp|html|js|jsx|mjs|node|ts|tsx|wasm)$/i
const PLACEHOLDER_VALUE = /^(?:changeme|change[-_ ]?me|example|sample|synthetic|test|testing|placeholder|dummy|fake|public|none|null|undefined|\*+|<[^>]+>)$/i
const MAX_APPLICATION_TEXT_BYTES = 16 * 1024 * 1024
const TEXT_PROBE_BYTES = 8 * 1024
const BINARY_SCAN_BYTES = 64 * 1024
const BINARY_SCAN_OVERLAP_BYTES = 8 * 1024

const KEYCLOAK_APPROVED_CONTENT = Object.freeze({
  'etc/java/java-21-openjdk/java-21-openjdk-21.0.12.0.8-1.2.el9.x86_64/conf/management/jmxremote.password.template': Object.freeze({
    sha256: '0273b6a6b9e20e6ce54c5aee70164028e0395063b2b7d39060a40b6495543dbf',
    kind: 'jmx-template',
  }),
  'etc/pki/product-default/479.pem': Object.freeze({
    sha256: '84272960fd18a054316433a717e0bea38f804cbe06f5539a4d3b6d1f4bcf0dfd',
    kind: 'x509',
  }),
  'usr/share/pki/ca-trust-legacy/ca-bundle.legacy.default.crt': Object.freeze({
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    kind: 'empty-legacy-ca',
  }),
  'usr/share/pki/ca-trust-legacy/ca-bundle.legacy.disable.crt': Object.freeze({
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    kind: 'empty-legacy-ca',
  }),
  'opt/keycloak/lib/lib/deployment/io.quarkus.quarkus-credentials-deployment-3.33.2.1.jar': Object.freeze({
    sha256: '7381a26a584468502217e25d9b2457f3585bf7c282bf367a9d7e528151630224',
    kind: 'jar',
  }),
  'opt/keycloak/lib/lib/main/io.quarkus.quarkus-credentials-3.33.2.1.jar': Object.freeze({
    sha256: '7c7dc5e0110f9a6eac5b893a556239c4b710c671154cc037942382e549021b0f',
    kind: 'jar',
  }),
  'opt/keycloak/lib/lib/main/io.smallrye.certs.smallrye-private-key-pem-parser-0.9.3.jar': Object.freeze({
    sha256: 'c00012f3e911e6dbc06059bc7d524a0437150739c32becbb259b78ecf1e75807',
    kind: 'jar',
  }),
  'opt/keycloak/lib/lib/main/org.keycloak.keycloak-model-storage-private-26.7.0.jar': Object.freeze({
    sha256: 'dbbd5d845465bd1132b1c57ee7852d7d332ab3158f00e6d6ba7dff3d6b917af3',
    kind: 'jar',
  }),
  'opt/keycloak/lib/lib/main/org.keycloak.keycloak-server-spi-private-26.7.0.jar': Object.freeze({
    sha256: '5bc9ba1748306eba339a63a20d66690a893c723847cfe6d0ac26b30d9934f78f',
    kind: 'jar',
  }),
  'opt/keycloak/lib/lib/main/org.wildfly.security.wildfly-elytron-credential-2.8.4.Final.jar': Object.freeze({
    sha256: 'b13e94dd2319886ea2126692c44c4823531e9f36635467062b19c738be55de6b',
    kind: 'jar',
  }),
  'opt/keycloak/lib/lib/main/org.wildfly.security.wildfly-elytron-password-impl-2.8.4.Final.jar': Object.freeze({
    sha256: '95d9843470d3d46d179e94e6fd5ab921abd6f760ca2d08cb0572c5408297da43',
    kind: 'jar',
  }),
  'opt/keycloak/lib/lib/deployment/io.quarkus.quarkus-arc-test-supplement-3.33.2.1.jar': Object.freeze({
    sha256: 'e131f7ea4bce3560ee17c9d307c649c24503df1a33e751afb4e64327d8375cd4',
    kind: 'jar',
    allowTestPath: true,
  }),
  'opt/keycloak/lib/lib/deployment/io.quarkus.quarkus-arc-test-supplement-decorator-3.33.2.1.jar': Object.freeze({
    sha256: '3efbfc19d06ed9b0867610314e331f3ffbe465add53a927fe3989004b116fa0c',
    kind: 'jar',
    allowTestPath: true,
  }),
})

export const KEYCLOAK_APPROVED_CONTENT_HASHES = Object.freeze(
  Object.fromEntries(Object.entries(KEYCLOAK_APPROVED_CONTENT).map(([pathname, entry]) => [pathname, entry.sha256])),
)

function normalizePath(value) {
  return value.split(sep).join('/').replace(/^\.\//, '')
}

export function normalizeApplicationRoot(value) {
  if (typeof value !== 'string') throw new TypeError('application root must be a string')
  const normalized = value
    .replaceAll('\\', '/')
    .replace(/\/+/g, '/')
    .replace(/^(?:\.\/)+/, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
  if (!normalized) throw new Error('application root must not be empty')
  if (normalized.split('/').some((segment) => segment === '.' || segment === '..')) {
    throw new Error('application root must be canonical and traversal-free')
  }
  return normalized
}

export function classifyKeycloakApprovedContent(pathname, sha256) {
  const entry = KEYCLOAK_APPROVED_CONTENT[pathname]
  return entry && entry.sha256 === sha256 ? entry.kind : null
}

function keycloakApprovedSpec(pathname) {
  return KEYCLOAK_APPROVED_CONTENT[pathname] ?? null
}

function relativePath(root, target) {
  return normalizePath(relative(root, target)) || '.'
}

function isApplicationOwned(pathname, applicationRoots) {
  const lower = pathname.toLowerCase()
  if (applicationRoots.length > 0) {
    return applicationRoots.some((root) => {
      const normalized = normalizePath(root).replace(/\/+$/, '')
      return lower === normalized.toLowerCase() || lower.startsWith(`${normalized.toLowerCase()}/`)
    })
  }
  if (lower === '.' || lower.startsWith('app/') || lower.includes('/app/')) return true
  if (lower.startsWith('usr/share/nginx/html/') || lower === 'usr/share/nginx/html') return true
  if (/(^|\/)(dist|node_modules|public|static)(\/|$)/.test(lower)) return true
  // Synthetic fixtures often use a rootfs containing only application content.
  return !/(^|\/)(bin|boot|dev|etc|lib|lib64|proc|root|run|sbin|sys|tmp|usr\/bin|usr\/lib|var)(\/|$)/.test(lower)
}

function isInsideRoot(root, target) {
  const candidate = relative(root, target)
  return candidate !== '..' && !candidate.startsWith(`..${sep}`) && !isAbsolute(candidate)
}

function inspectApplicationSymlink(rootfsPath, absolute, pathname, applicationRoots) {
  const normalized = pathname.toLowerCase()
  if (!/^(?:app\/)?node_modules\/(?:.+\/)?\.bin\/[^/]+$/.test(normalized)) {
    return { code: 'forbidden-symlink', path: pathname, detail: 'application symlinks are limited to npm executable shims' }
  }
  let target
  try {
    const link = readlinkSync(absolute)
    target = isAbsolute(link)
      ? join(rootfsPath, link.replace(/^[/\\]+/, ''))
      : resolve(dirname(absolute), link)
  } catch (error) {
    return { code: 'unreadable-symlink', path: pathname, detail: error.message }
  }
  if (!isInsideRoot(rootfsPath, target)) {
    return { code: 'symlink-escape', path: pathname, detail: 'application symlink escapes the exported rootfs' }
  }
  const targetPath = relativePath(rootfsPath, target)
  if (!isApplicationOwned(targetPath, applicationRoots) || !/^(?:app\/)?node_modules\//.test(targetPath.toLowerCase())) {
    return { code: 'forbidden-symlink-target', path: pathname, detail: 'npm executable shim target must remain inside application node_modules' }
  }
  try {
    const targetStat = lstatSync(target)
    if (!targetStat.isFile()) {
      return { code: 'forbidden-symlink-target', path: pathname, detail: 'npm executable shim target must be a regular file' }
    }
  } catch (error) {
    return { code: 'broken-symlink', path: pathname, detail: error.message }
  }
  return null
}

function isForbiddenExtension(name) {
  const lower = name.toLowerCase()
  return [...FORBIDDEN_EXTENSIONS].some((extension) => lower.endsWith(extension))
}

function isGloballyForbiddenCredentialName(name) {
  const lower = name.toLowerCase()
  if (FORBIDDEN_FILENAMES.has(lower)) return true
  if (lower.startsWith('.env.') || lower === '.env') return true
  return false
}

function isForbiddenApplicationName(name) {
  if (isGloballyForbiddenCredentialName(name)) return true
  if (/\.(?:pem|key|p12|pfx|jks|der|crt)$/i.test(name)) return true
  if (SECRET_FILE_NAME.test(name) && !LICENSE_NAMES.test(name) && !PROGRAM_FILE_EXTENSION.test(name)) return true
  return false
}

function isAllowedOperatingSystemPublicCertificate(pathname, name) {
  const lowerPath = pathname.toLowerCase()
  if (!/\.(?:cer|crt|pem)$/i.test(name)) return false
  return /^(?:etc\/ssl\/certs|etc\/ca-certificates|etc\/pki\/ca-trust|usr\/lib\/ssl\/certs|usr\/share\/ca-certificates|usr\/local\/share\/ca-certificates)\//.test(lowerPath)
}

function isForbiddenGlobalCredentialFile(pathname, name, options = {}) {
  if (['etc/passwd', 'etc/passwd-'].includes(pathname.toLowerCase())) return false
  if (isGloballyForbiddenCredentialName(name)) return true
  if (options.keycloakApprovedPath) return false
  if (isAllowedOperatingSystemPublicCertificate(pathname, name)) return false
  return isForbiddenApplicationName(name)
}

function isForbiddenSegment(pathname) {
  const segments = pathname.split('/').filter(Boolean).map((segment) => segment.toLowerCase())
  if (segments.includes('build') && !segments.includes('node_modules')) return true
  return segments.some((segment) => FORBIDDEN_SEGMENTS.has(segment))
}

function isForbiddenTestName(name) {
  return /(?:^|\.)(?:test|spec)(?:\.|$)/i.test(name) || /^test(?:[-_.]|$)/i.test(name) || /-test(?:[-_.]|$)/i.test(name) || /^__tests__$/i.test(name)
}

function secretContentReason(content, options = {}) {
  if (/-----BEGIN [^-]*PRIVATE KEY-----\s+[A-Za-z0-9+/=\r\n]{40,}\s+-----END [^-]*PRIVATE KEY-----/i.test(content)) return 'private-key'
  if (/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16})\b/.test(content)) return 'provider-token'
  if (/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b/.test(content)) return 'jwt'
  if (!options.includeAssignments) return null

  const assignment = /\b([A-Z][A-Z0-9]*(?:[_-](?:SECRET|TOKEN|PASSWORD|PASS|PRIVATE|CREDENTIAL|APIKEY|API_KEY|ACCESS_KEY|SIGNING_KEY))|(?:SECRET|TOKEN|PASSWORD|PASS|PRIVATE_KEY|CREDENTIALS?|API_KEY|ACCESS_KEY))\s*[:=]\s*["']?([^\s"'`;,}]{12,})/g
  for (const match of content.matchAll(assignment)) {
    const value = String(match[2] ?? '').trim()
    if (!value || PLACEHOLDER_VALUE.test(value)) continue
    if (options.programFile && /^(?:process\.env|import\.meta\.env|env\.|config\.|options\.)/i.test(value)) continue
    if (options.programFile && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)) continue
    if (options.programFile && /^(?:[A-Za-z_$][A-Za-z0-9_$]*)(?:\.[A-Za-z_$][A-Za-z0-9_$]*)+(?:\([^\r\n]*\))?$/.test(value)) continue
    if (/^(?:VITE_[A-Z0-9_]+|PUBLIC_[A-Z0-9_]+)$/.test(match[1])) continue
    return 'credential-assignment'
  }

  return null
}

const PEM_PRIVATE_KEY_MARKER = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/i
const PEM_CERTIFICATE_BLOCK = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/gi

function certificateContentReason(content, { allowEmpty = false } = {}) {
  if (allowEmpty && content.length === 0) return null
  if (PEM_PRIVATE_KEY_MARKER.test(content)) return 'private-key'
  const secretReason = secretContentReason(content, { includeAssignments: true })
  if (secretReason) return secretReason

  const blocks = [...content.matchAll(PEM_CERTIFICATE_BLOCK)].map((match) => match[0])
  if (blocks.length === 0) return 'certificate-required'
  try {
    for (const block of blocks) new X509Certificate(block)
  } catch {
    return 'invalid-certificate'
  }

  const remainder = content
    .replace(PEM_CERTIFICATE_BLOCK, '')
    .replace(/^\s*(?:#.*)?$/gm, '')
    .trim()
  return remainder ? 'untrusted-certificate-material' : null
}

function validateKeycloakArtifactContent(kind, probe, absolute) {
  if (kind === 'empty-legacy-ca') {
    return probe.kind === 'text' && probe.content.length === 0 ? null : 'legacy-ca-must-be-empty'
  }
  if (kind === 'x509') {
    return probe.kind === 'text'
      ? certificateContentReason(probe.content)
      : 'certificate-must-be-text'
  }
  if (kind === 'jmx-template') {
    if (probe.kind === 'oversized-text') return 'template-is-oversized'
    if (probe.kind !== 'text') return 'template-must-be-text'
    return secretContentReason(probe.content, { includeAssignments: true })
  }
  if (kind === 'jar') {
    if (probe.kind !== 'binary') return 'jar-must-be-binary'
    return binaryHighSignalSecretReason(absolute)
  }
  return 'unknown-keycloak-artifact-class'
}

export function validateCertificateContent(content, options = {}) {
  return certificateContentReason(String(content), options)
}

function probeApplicationText(absolute, size) {
  const probeLength = Math.min(size, TEXT_PROBE_BYTES)
  if (probeLength === 0) return { kind: 'text', content: '' }

  const probe = Buffer.alloc(probeLength)
  const descriptor = openSync(absolute, 'r')
  let bytesRead
  try {
    bytesRead = readSync(descriptor, probe, 0, probeLength, 0)
  } finally {
    closeSync(descriptor)
  }

  const observed = probe.subarray(0, bytesRead)
  if (observed.includes(0)) return { kind: 'binary' }
  const controlBytes = [...observed].filter((value) => value < 9 || (value > 13 && value < 32)).length
  if (controlBytes / observed.length > 0.1) return { kind: 'binary' }
  if (size > MAX_APPLICATION_TEXT_BYTES) return { kind: 'oversized-text' }

  return { kind: 'text', content: readFileSync(absolute, 'utf8') }
}

function binaryHighSignalSecretReason(absolute) {
  const descriptor = openSync(absolute, 'r')
  const chunk = Buffer.alloc(BINARY_SCAN_BYTES)
  let carry = Buffer.alloc(0)
  let position = 0
  try {
    while (true) {
      const bytesRead = readSync(descriptor, chunk, 0, chunk.length, position)
      if (bytesRead === 0) return null
      const observed = Buffer.concat([carry, chunk.subarray(0, bytesRead)])
      const reason = secretContentReason(observed.toString('latin1'))
      if (reason) return reason
      carry = observed.subarray(Math.max(0, observed.length - BINARY_SCAN_OVERLAP_BYTES))
      position += bytesRead
    }
  } finally {
    closeSync(descriptor)
  }
}

function sha256File(absolute) {
  return createHash('sha256').update(readFileSync(absolute)).digest('hex')
}

function walk(root, current = root, entries = []) {
  let children
  try {
    children = readdirSync(current, { withFileTypes: true })
  } catch (error) {
    entries.push({ code: 'unreadable-rootfs', path: relativePath(root, current), detail: error.message })
    return entries
  }

  for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = join(current, child.name)
    const pathname = relativePath(root, absolute)
    let stat
    try {
      stat = lstatSync(absolute)
    } catch (error) {
      entries.push({ code: 'unreadable-entry', path: pathname, detail: error.message })
      continue
    }
    entries.push({ absolute, pathname, name: child.name, stat })
    if (stat.isDirectory()) walk(root, absolute, entries)
  }
  return entries
}

export function inspectImageContent(rootfsPath, options = {}) {
  const defaultRoots = options.kind === 'frontend'
    ? ['usr/share/nginx/html']
    : options.kind === 'backend'
      ? ['app']
      : []
  const applicationRoots = (options.applicationRoots ?? defaultRoots).map(normalizeApplicationRoot)
  const violations = []
  let rootStat
  try {
    rootStat = lstatSync(rootfsPath)
  } catch (error) {
    return { ok: false, rootfsPath, violations: [{ code: 'missing-rootfs', path: '.', detail: error.message }] }
  }
  if (!rootStat.isDirectory()) {
    return { ok: false, rootfsPath, violations: [{ code: 'rootfs-not-directory', path: '.', detail: 'rootfs must be a directory' }] }
  }

  for (const entry of walk(rootfsPath)) {
    if (entry.code) {
      violations.push(entry)
      continue
    }
    const { pathname, name, stat, absolute } = entry
    const applicationOwned = isApplicationOwned(pathname, applicationRoots)
    const lower = pathname.toLowerCase()
    const firstPartyApplication = applicationOwned && !lower.split('/').includes('node_modules')
    const keycloakKind = options.kind === 'keycloak'
    const keycloakApprovedEntry = keycloakKind ? keycloakApprovedSpec(pathname) : null
    const keycloakApprovedPath = Boolean(keycloakApprovedEntry)
    const operatingSystemPublicCertificate = stat.isFile() && isAllowedOperatingSystemPublicCertificate(pathname, name)
    const keycloakApprovedContentPath = keycloakApprovedPath && stat.isFile()
    const contentScoped = stat.isFile() && (applicationOwned || operatingSystemPublicCertificate || keycloakApprovedContentPath)
    if (applicationOwned && stat.isSymbolicLink()) {
      const violation = inspectApplicationSymlink(rootfsPath, absolute, pathname, applicationRoots)
      if (violation) violations.push(violation)
      continue
    }
    if (lower.split('/').includes('.git') || lower.split('/').includes('.github')) {
      violations.push({ code: 'forbidden-file', path: pathname, detail: 'repository metadata is not permitted' })
    }
    if (keycloakApprovedPath && !stat.isFile()) {
      violations.push({ code: 'forbidden-file', path: pathname, detail: 'approved Keycloak content must be a regular file' })
    }
    if (stat.isFile() && isForbiddenGlobalCredentialFile(pathname, name, { keycloakApprovedPath })) {
      violations.push({ code: 'forbidden-file', path: pathname, detail: 'credential, environment, or key file is not permitted' })
    }
    let keycloakApprovedKind = null
    if (keycloakApprovedPath && stat.isFile()) {
      let actualSha256
      try {
        actualSha256 = sha256File(absolute)
      } catch (error) {
        violations.push({ code: 'unreadable-entry', path: pathname, detail: error.message })
      }
      if (actualSha256) {
        keycloakApprovedKind = classifyKeycloakApprovedContent(pathname, actualSha256)
        if (!keycloakApprovedKind) {
          violations.push({ code: 'forbidden-file', path: pathname, detail: `approved Keycloak content SHA-256 mismatch (expected ${keycloakApprovedEntry.sha256}, observed ${actualSha256})` })
        }
      }
    }
    if (applicationOwned && isForbiddenExtension(name)) {
      violations.push({ code: 'forbidden-extension', path: pathname, detail: 'source or source-map extension is not permitted' })
    }
    const allowApprovedTestPath = keycloakApprovedEntry?.allowTestPath === true && keycloakApprovedKind === keycloakApprovedEntry.kind
    if (applicationOwned && (isForbiddenSegment(pathname) || isForbiddenTestName(name)) && !allowApprovedTestPath && !LICENSE_NAMES.test(name)) {
      violations.push({ code: 'forbidden-path', path: pathname, detail: 'test, documentation, evidence, cache, or build path is not permitted' })
    }
    if (!contentScoped) continue
    if (firstPartyApplication && stat.size > MAX_APPLICATION_TEXT_BYTES) {
      violations.push({ code: 'oversized-application-file', path: pathname, detail: 'application files above 16 MiB require explicit review' })
      continue
    }
    let textProbe
    try {
      textProbe = probeApplicationText(absolute, stat.size)
    } catch (error) {
      violations.push({ code: 'unreadable-entry', path: pathname, detail: error.message })
      continue
    }
    if (operatingSystemPublicCertificate) {
      if (textProbe.kind !== 'text') {
        violations.push({ code: 'forbidden-file', path: pathname, detail: 'public certificate content must be text PEM' })
        continue
      }
      const certificateReason = certificateContentReason(textProbe.content)
      if (certificateReason) {
        const code = ['private-key', 'provider-token', 'jwt', 'credential-assignment'].includes(certificateReason)
          ? 'secret-content'
          : 'forbidden-file'
        violations.push({ code, path: pathname, detail: `public certificate content failed validation (${certificateReason})` })
      }
      continue
    }
    const approvedKind = keycloakApprovedPath ? keycloakApprovedEntry.kind : null
    if (approvedKind) {
      const reason = validateKeycloakArtifactContent(approvedKind, textProbe, absolute)
      if (reason) {
        const code = ['private-key', 'provider-token', 'jwt', 'credential-assignment'].includes(reason)
          ? 'secret-content'
          : 'forbidden-file'
        violations.push({ code, path: pathname, detail: `approved Keycloak content failed ${approvedKind} validation (${reason})` })
      }
      continue
    }
    if (textProbe.kind === 'binary') {
      try {
        const reason = binaryHighSignalSecretReason(absolute)
        if (reason) {
          violations.push({ code: 'secret-content', path: pathname, detail: `high-signal credential material detected in binary content (${reason})` })
        }
      } catch (error) {
        violations.push({ code: 'unreadable-entry', path: pathname, detail: error.message })
      }
      continue
    }
    if (textProbe.kind === 'oversized-text') {
      violations.push({ code: 'oversized-application-text-file', path: pathname, detail: 'application-owned text above 16 MiB requires explicit review' })
      continue
    }
    const content = textProbe.content
    const secretReason = secretContentReason(content, { includeAssignments: true, programFile: PROGRAM_FILE_EXTENSION.test(name) })
    if (secretReason) {
      violations.push({ code: 'secret-content', path: pathname, detail: `high-signal credential material detected (${secretReason})` })
    }
    if (/sourcesContent/i.test(content) && /\.map$/i.test(name)) {
      violations.push({ code: 'source-map-content', path: pathname, detail: 'source-map sourcesContent is not permitted' })
    }
  }

  violations.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code))
  return { ok: violations.length === 0, rootfsPath, violations }
}

export function formatViolations(result) {
  if (result.ok) return 'on-prem image content guard: PASS'
  return ['on-prem image content guard: FAIL', ...result.violations.map((item) => `- ${item.code}: ${item.path} (${item.detail})`)].join('\n')
}

function parseArgs(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--rootfs') options.rootfs = argv[++index]
    else if (argument === '--kind') options.kind = argv[++index]
    else if (argument === '--json') options.json = true
    else if (argument === '--application-root') (options.applicationRoots ??= []).push(argv[++index])
    else throw new Error(`Unknown argument: ${argument}`)
  }
  if (!options.rootfs) throw new Error('--rootfs is required')
  if (Object.prototype.hasOwnProperty.call(options, 'kind') && !['frontend', 'backend', 'keycloak'].includes(options.kind)) {
    throw new Error('--kind must be frontend, backend, or keycloak')
  }
  return options
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseArgs(process.argv.slice(2))
    const result = inspectImageContent(options.rootfs, options)
    if (options.json) console.log(JSON.stringify(result, null, 2))
    else console.log(formatViolations(result))
    if (!result.ok) process.exitCode = 1
  } catch (error) {
    console.error(`on-prem image content guard: ${error.message}`)
    process.exitCode = 2
  }
}
