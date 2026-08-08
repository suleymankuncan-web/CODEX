import { closeSync, lstatSync, openSync, readFileSync, readSync, readdirSync, readlinkSync } from 'node:fs'
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

function normalizePath(value) {
  return value.split(sep).join('/').replace(/^\.\//, '')
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

function isForbiddenGlobalCredentialFile(pathname, name) {
  if (['etc/passwd', 'etc/passwd-'].includes(pathname.toLowerCase())) return false
  if (isGloballyForbiddenCredentialName(name)) return true
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
  const applicationRoots = (options.applicationRoots ?? defaultRoots).map(normalizePath)
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
    if (applicationOwned && stat.isSymbolicLink()) {
      const violation = inspectApplicationSymlink(rootfsPath, absolute, pathname, applicationRoots)
      if (violation) violations.push(violation)
      continue
    }
    if (lower.split('/').includes('.git') || lower.split('/').includes('.github')) {
      violations.push({ code: 'forbidden-file', path: pathname, detail: 'repository metadata is not permitted' })
    }
    if (stat.isFile() && isForbiddenGlobalCredentialFile(pathname, name)) {
      violations.push({ code: 'forbidden-file', path: pathname, detail: 'credential, environment, or key file is not permitted' })
    }
    if (applicationOwned && isForbiddenExtension(name)) {
      violations.push({ code: 'forbidden-extension', path: pathname, detail: 'source or source-map extension is not permitted' })
    }
    if (applicationOwned && (isForbiddenSegment(pathname) || isForbiddenTestName(name)) && !LICENSE_NAMES.test(name)) {
      violations.push({ code: 'forbidden-path', path: pathname, detail: 'test, documentation, evidence, cache, or build path is not permitted' })
    }
    if (!stat.isFile() || !applicationOwned) continue
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
  if (options.kind && !['frontend', 'backend'].includes(options.kind)) throw new Error('--kind must be frontend or backend')
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
