import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { PLAYWRIGHT_BUILD_PROFILE } from './playwright-build-profile.mjs'

export const PLAYWRIGHT_BUILD_RECEIPT = '.playwright-build-receipt.json'
export const PLAYWRIGHT_BUILD_ENVIRONMENT = Object.freeze({
  VITE_API_BASE_URL: '/api',
  VITE_SENTRY_DSN: '',
  VITE_SENTRY_ENABLED: 'false',
  VITE_PLAYWRIGHT_BUILD_PROFILE: PLAYWRIGHT_BUILD_PROFILE,
})

const sourceRoots = ['src', 'public']
const sourceFiles = [
  'index.html',
  'package.json',
  'package-lock.json',
  'scripts/playwright-build-profile.d.mts',
  'scripts/playwright-build-profile.mjs',
  'vite.config.ts',
]
const sourceFilePattern = /^tsconfig(?:\.[^.]+)?\.json$/

export function verifyPlaywrightBuildReceipt(projectRoot, environment = PLAYWRIGHT_BUILD_ENVIRONMENT) {
  const root = resolve(projectRoot)
  const receiptPath = join(root, 'dist', PLAYWRIGHT_BUILD_RECEIPT)
  if (!existsSync(receiptPath)) return { valid: false, reason: 'receipt missing' }

  let receipt
  try {
    receipt = JSON.parse(readFileSync(receiptPath, 'utf8'))
  } catch {
    return { valid: false, reason: 'receipt malformed' }
  }

  if (receipt?.schemaVersion !== 1) return { valid: false, reason: 'receipt schema mismatch' }
  if (receipt.environmentDigest !== digestJson(environment)) return { valid: false, reason: 'build environment changed' }
  if (receipt.sourceDigest !== digestSourceInputs(root)) return { valid: false, reason: 'build inputs changed' }
  if (receipt.distDigest !== digestDirectory(join(root, 'dist'), new Set([PLAYWRIGHT_BUILD_RECEIPT]))) return { valid: false, reason: 'build output changed' }
  return { valid: true, reason: 'exact build receipt matched' }
}

export function writePlaywrightBuildReceipt(projectRoot, environment = PLAYWRIGHT_BUILD_ENVIRONMENT) {
  const root = resolve(projectRoot)
  const distRoot = join(root, 'dist')
  if (!existsSync(distRoot)) throw new Error('Cannot write Playwright build receipt before dist exists')

  const receipt = {
    schemaVersion: 1,
    sourceDigest: digestSourceInputs(root),
    environmentDigest: digestJson(environment),
    distDigest: digestDirectory(distRoot, new Set([PLAYWRIGHT_BUILD_RECEIPT])),
  }
  const receiptPath = join(distRoot, PLAYWRIGHT_BUILD_RECEIPT)
  const temporaryPath = `${receiptPath}.${process.pid}.tmp`
  mkdirSync(distRoot, { recursive: true })
  writeFileSync(temporaryPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8')
  try {
    renameSync(temporaryPath, receiptPath)
  } finally {
    rmSync(temporaryPath, { force: true })
  }
  return receipt
}

export function digestSourceInputs(projectRoot) {
  const root = resolve(projectRoot)
  const paths = []
  for (const sourceRoot of sourceRoots) {
    const absolute = join(root, sourceRoot)
    if (existsSync(absolute)) paths.push(...walkFiles(absolute).map((file) => relative(root, file).replaceAll('\\', '/')))
  }
  for (const file of sourceFiles) if (existsSync(join(root, file))) paths.push(file)
  for (const entry of existsSync(root) ? readdirSync(root) : []) if (sourceFilePattern.test(entry)) paths.push(entry)
  return digestFiles(root, paths)
}

function digestDirectory(directory, excludedBasenames = new Set()) {
  if (!existsSync(directory)) return digestJson({ missing: true })
  const files = walkFiles(directory)
    .filter((file) => !excludedBasenames.has(basename(file)))
    .map((file) => relative(directory, file).replaceAll('\\', '/'))
  return digestFiles(directory, files)
}

function walkFiles(directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...walkFiles(path))
    else if (entry.isFile() || lstatSync(path).isSymbolicLink()) files.push(path)
  }
  return files
}

function digestFiles(root, paths) {
  const hash = createHash('sha256')
  for (const path of [...new Set(paths)].sort()) {
    const absolute = join(root, path)
    hash.update(`${path}\0`)
    hash.update(readFileSync(absolute))
    hash.update('\0')
  }
  return hash.digest('hex')
}

function digestJson(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
