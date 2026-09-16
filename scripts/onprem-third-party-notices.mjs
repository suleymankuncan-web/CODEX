import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const LICENSE_FILE_NAMES = /^(?:license|licence|notice|copying)(?:\.[a-z0-9._-]+)?$/i
// ONP-1 packages only the exact license expressions already present in the
// production dependency graph. Any new or differently expressed license is a
// fail-closed owner/legal review gate rather than an inferred permission.
const ONP1_LICENSE_ALLOWLIST = new Set([
  '0BSD',
  'Apache-2.0',
  'Apache-2.0 AND LGPL-3.0-or-later',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'LGPL-3.0-or-later',
  'MIT',
  'MIT AND ISC',
  'OFL-1.1',
  'Python-2.0',
])
// Owner-directed PR #1164 closeout, 2026-09-16: the PDF dependency is
// approved only at this identity/expression, with both upstream notices.
const PACKAGE_LICENSE_DISPOSITIONS = new Map([
  ['pako@1.0.11', { license: '(MIT AND Zlib)', files: ['LICENSE', 'lib/zlib/README'] }],
])

function readJson(pathname, label) {
  try {
    return JSON.parse(readFileSync(pathname, 'utf8'))
  } catch (error) {
    throw new Error(`unable to read ${label}: ${error.message}`)
  }
}

function normalizeLicense(value) {
  if (Array.isArray(value)) return value.map(normalizeLicense).filter(Boolean).join(' OR ')
  if (value && typeof value === 'object') return String(value.type ?? value.name ?? '').trim()
  return String(value ?? '').trim()
}

function isUnknownLicense(value) {
  const normalized = normalizeLicense(value)
  return !normalized || /^(?:unknown|unlicensed|none|proprietary|n\/a)$/i.test(normalized) || /^SEE LICENSE IN\b/i.test(normalized)
}

function assertLicensePolicy(license, identity) {
  if (!ONP1_LICENSE_ALLOWLIST.has(license) && PACKAGE_LICENSE_DISPOSITIONS.get(identity)?.license !== license) {
    throw new Error(`license policy review required before packaging ${identity}: ${license}`)
  }
}

function readPackageLicenseFiles(packageDir, identity, license) {
  const disposition = PACKAGE_LICENSE_DISPOSITIONS.get(identity)
  const required = disposition?.license === license ? disposition.files : []
  for (const name of required) {
    const pathname = join(packageDir, name)
    if (!existsSync(pathname) || !readFileSync(pathname, 'utf8').trim()) {
      throw new Error(`required license notice is missing or empty for ${identity}: ${name}`)
    }
  }
  const standard = readdirSync(packageDir, { withFileTypes: true })
    .filter((item) => item.isFile() && LICENSE_FILE_NAMES.test(item.name))
    .map((item) => item.name)
  return [...new Set([...standard, ...required])]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, text: readFileSync(join(packageDir, name), 'utf8') }))
}

function spdxLicenseIds(expression) {
  return [...new Set(
    String(expression)
      .replace(/[()]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token && !['AND', 'OR', 'WITH'].includes(token)),
  )].sort()
}

function canonicalLicenseTexts(spdxLicenseDirectory, license, identity) {
  if (!spdxLicenseDirectory) {
    throw new Error(`complete license text is missing for ${identity}; --spdx-license-directory is required`)
  }
  return spdxLicenseIds(license).map((licenseId) => {
    const pathname = join(spdxLicenseDirectory, `${licenseId}.json`)
    if (!existsSync(pathname)) throw new Error(`canonical SPDX text is missing for ${identity}: ${licenseId}`)
    const record = readJson(pathname, `SPDX ${licenseId}`)
    const text = String(record.licenseText ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd()
    if (!text) throw new Error(`canonical SPDX text is empty for ${identity}: ${licenseId}`)
    return {
      id: licenseId,
      name: String(record.name ?? licenseId).trim() || licenseId,
      source: `spdx-license-list:${licenseId}`,
      text,
    }
  })
}

function packageNameFromPath(pathname) {
  const normalized = pathname.replaceAll('\\', '/')
  const parts = normalized.split('/').filter(Boolean)
  const index = parts.lastIndexOf('node_modules')
  if (index < 0 || index + 1 >= parts.length) return null
  const first = parts[index + 1]
  if (first.startsWith('@') && parts[index + 2]) return `${first}/${parts[index + 2]}`
  return first
}

function lockPackagePath(packagePath) {
  return packagePath.replaceAll('\\', '/')
}

function resolveLockEntry(lockPackages, packagePath) {
  let candidate = lockPackagePath(packagePath)
  while (candidate) {
    const entry = lockPackages[candidate]
    if (entry) return { path: candidate, entry }
    const parent = candidate.slice(0, candidate.lastIndexOf('/'))
    if (!parent || parent === '.') break
    candidate = parent
  }
  return null
}

function resolveDependencyPath(lockPackages, fromPath, name) {
  let current = fromPath
  while (true) {
    const candidate = current ? `${current}/node_modules/${name}` : `node_modules/${name}`
    if (lockPackages[candidate]) return candidate
    const parent = current.slice(0, current.lastIndexOf('/'))
    if (!current || !parent || parent === '.') break
    current = parent
  }
  const topLevel = `node_modules/${name}`
  return lockPackages[topLevel] ? topLevel : null
}

function dependencyEdges(entry, packageJson) {
  const required = new Set(Object.keys({
    ...(entry?.dependencies ?? {}),
    ...(packageJson?.dependencies ?? {}),
  }))
  const optional = new Set(Object.keys({
    ...(entry?.optionalDependencies ?? {}),
    ...(packageJson?.optionalDependencies ?? {}),
  }))
  return [...new Set([...required, ...optional])]
    .sort()
    .map((name) => ({ name, optional: !required.has(name) && optional.has(name) }))
}

function collectProductionPackages({ packageJson, lockfile, nodeModulesPath, spdxLicenseDirectory }) {
  const lockPackages = lockfile.packages
  if (!lockPackages || typeof lockPackages !== 'object' || lockfile.lockfileVersion < 3) {
    throw new Error('package-lock v3 with a packages map is required')
  }
  const rootEntry = lockPackages[''] ?? {}
  const rootRequiredDependencies = Object.keys({
    ...(packageJson.dependencies ?? {}),
    ...(rootEntry.dependencies ?? {}),
  })
  const rootOptionalDependencies = Object.keys({
    ...(packageJson.optionalDependencies ?? {}),
    ...(rootEntry.optionalDependencies ?? {}),
  })
  const rootRequired = new Set(rootRequiredDependencies)
  const queue = [...new Set([...rootRequiredDependencies, ...rootOptionalDependencies])]
    .sort()
    .map((name) => ({ fromPath: '', name, optional: !rootRequired.has(name) }))
  const visited = new Set()
  const entries = []

  while (queue.length > 0) {
    const next = queue.shift()
    const packagePath = resolveDependencyPath(lockPackages, next.fromPath, next.name)
    if (!packagePath) {
      if (next.optional) continue
      throw new Error(`missing production dependency lock identity: ${next.name}`)
    }
    if (visited.has(packagePath)) continue
    visited.add(packagePath)
    const lockEntry = lockPackages[packagePath]
    const packageDir = join(nodeModulesPath, packagePath.slice('node_modules/'.length))
    const packageJsonPath = join(packageDir, 'package.json')
    if (!existsSync(packageJsonPath)) {
      if (next.optional) continue
      throw new Error(`missing installed package identity: ${packagePath}`)
    }
    const installed = readJson(packageJsonPath, `${packagePath}/package.json`)
    const identityName = String(installed.name ?? '').trim()
    const identityVersion = String(installed.version ?? '').trim()
    if (!identityName || !identityVersion || identityName !== packageNameFromPath(packagePath)) {
      throw new Error(`invalid package identity for ${packagePath}`)
    }
    if (lockEntry.dev === true || lockEntry.optional === false && lockEntry.dev === true) {
      continue
    }
    if (installed.private === true) {
      // Private application roots are never third-party inventory entries, but
      // their production dependencies remain reachable through the graph.
      for (const dependency of dependencyEdges(lockEntry, installed)) queue.push({ fromPath: packagePath, ...dependency })
      continue
    }
    const license = normalizeLicense(installed.license ?? installed.licenses ?? lockEntry.license)
    if (isUnknownLicense(license)) throw new Error(`unknown or missing license for ${identityName}@${identityVersion}`)
    assertLicensePolicy(license, `${identityName}@${identityVersion}`)
    const licenseFiles = readPackageLicenseFiles(packageDir, `${identityName}@${identityVersion}`, license)
    const canonicalTexts = licenseFiles.length === 0
      ? canonicalLicenseTexts(spdxLicenseDirectory, license, `${identityName}@${identityVersion}`)
      : []
    entries.push({ name: identityName, version: identityVersion, license, licenseFiles, canonicalLicenseTexts: canonicalTexts })
    for (const dependency of dependencyEdges(lockEntry, installed)) queue.push({ fromPath: packagePath, ...dependency })
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
}

export function generateLicenseInventory({ packageJsonPath, lockfilePath, nodeModulesPath, spdxLicenseDirectory }) {
  if (!packageJsonPath || !lockfilePath || !nodeModulesPath) throw new Error('packageJsonPath, lockfilePath, and nodeModulesPath are required')
  const packageJson = readJson(packageJsonPath, 'package.json')
  const lockfile = readJson(lockfilePath, 'package-lock.json')
  const packages = collectProductionPackages({ packageJson, lockfile, nodeModulesPath, spdxLicenseDirectory })
  return {
    schemaVersion: 1,
    packageManager: 'npm-package-lock-v3',
    packages,
  }
}

export function renderThirdPartyNotices(inventory) {
  if (!inventory || inventory.schemaVersion !== 1 || !Array.isArray(inventory.packages)) throw new Error('invalid license inventory')
  const lines = [
    'HR Axis On-Premise Third-Party Notices',
    '========================================',
    '',
    'This file is generated from the production dependency graph and package-lock v3.',
    '',
  ]
  for (const entry of [...inventory.packages].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))) {
    lines.push(`${entry.name}@${entry.version}`)
    lines.push(`License: ${entry.license}`)
    if (entry.licenseFiles.length === 0) {
      if (!Array.isArray(entry.canonicalLicenseTexts) || entry.canonicalLicenseTexts.length === 0) {
        throw new Error(`complete license text is missing for ${entry.name}@${entry.version}`)
      }
      lines.push('Upstream package did not include a license file; canonical SPDX text follows.')
      for (const licenseText of entry.canonicalLicenseTexts) {
        lines.push(`--- SPDX ${licenseText.id}: ${licenseText.name} ---`)
        lines.push(licenseText.text)
      }
    } else {
      for (const file of entry.licenseFiles) {
        lines.push(`--- ${file.name} ---`)
        lines.push(file.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd())
      }
    }
    lines.push('', '')
  }
  return `${lines.join('\n').trimEnd()}\n`
}

function parseArgs(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--package-json') options.packageJsonPath = argv[++index]
    else if (argument === '--lockfile') options.lockfilePath = argv[++index]
    else if (argument === '--node-modules') options.nodeModulesPath = argv[++index]
    else if (argument === '--inventory') options.inventoryPath = argv[++index]
    else if (argument === '--notices') options.noticesPath = argv[++index]
    else if (argument === '--spdx-license-directory') options.spdxLicenseDirectory = argv[++index]
    else throw new Error(`Unknown argument: ${argument}`)
  }
  for (const key of ['packageJsonPath', 'lockfilePath', 'nodeModulesPath', 'inventoryPath', 'noticesPath', 'spdxLicenseDirectory']) {
    if (!options[key]) throw new Error(`--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} is required`)
  }
  return options
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseArgs(process.argv.slice(2))
    const inventory = generateLicenseInventory(options)
    const { writeFileSync } = await import('node:fs')
    writeFileSync(options.inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`)
    writeFileSync(options.noticesPath, renderThirdPartyNotices(inventory))
    console.log(`third-party inventory: ${inventory.packages.length} production packages`)
  } catch (error) {
    console.error(`third-party notice generation: ${error.message}`)
    process.exitCode = 1
  }
}
