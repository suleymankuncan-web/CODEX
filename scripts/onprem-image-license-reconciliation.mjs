import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const IMAGE_KINDS = new Set(['backend', 'frontend'])
const FORBIDDEN_LICENSE = /(?:NOASSERTION|UNKNOWN|UNLICENSED|PROPRIETARY|NONCOMMERCIAL|NON-COMMERCIAL|CC-BY-NC|SSPL|BUSL|COMMONS[ -]CLAUSE|POLYFORM-NONCOMMERCIAL)/i

function readJson(pathname, label) {
  try {
    return JSON.parse(readFileSync(pathname, 'utf8'))
  } catch (error) {
    throw new Error(`unable to read ${label}: ${error.message}`)
  }
}

function sha256(pathname) {
  return createHash('sha256').update(readFileSync(pathname)).digest('hex')
}

function purlFor(pkg) {
  const refs = Array.isArray(pkg.externalRefs) ? pkg.externalRefs : []
  const values = refs.filter((item) => item?.referenceType === 'purl').map((item) => String(item.referenceLocator ?? ''))
  if (values.length !== 1 || !values[0]) throw new Error(`exactly one purl is required for SBOM package ${pkg.name ?? 'unknown'}`)
  return values[0]
}

function npmIdentityFromPurl(purl) {
  if (!purl.startsWith('pkg:npm/')) return null
  const body = purl.slice('pkg:npm/'.length).split('?')[0]
  const versionAt = body.lastIndexOf('@')
  const encodedName = versionAt > 0 ? body.slice(0, versionAt) : body
  const encodedVersion = versionAt > 0 ? body.slice(versionAt + 1) : ''
  try {
    return { name: decodeURIComponent(encodedName), version: decodeURIComponent(encodedVersion) }
  } catch {
    throw new Error(`invalid npm purl encoding: ${purl}`)
  }
}

function licenseAtoms(expression) {
  return [...new Set((String(expression).match(/[A-Za-z0-9][A-Za-z0-9.+-]*/g) ?? [])
    .filter((token) => !['AND', 'OR', 'WITH'].includes(token)))].sort()
}

function assertNoCommercialRestriction(expression, identity) {
  if (!expression || FORBIDDEN_LICENSE.test(expression)) {
    throw new Error(`license review required for ${identity}: ${expression || 'missing'}`)
  }
}

function assertStandardExpression(expression, allowedIds, identity, { allowLicenseRef = false } = {}) {
  assertNoCommercialRestriction(expression, identity)
  const atoms = licenseAtoms(expression)
  if (atoms.length === 0) throw new Error(`empty license expression for ${identity}`)
  for (const atom of atoms) {
    if (/^LicenseRef-/i.test(atom)) {
      if (allowLicenseRef) continue
      throw new Error(`LicenseRef requires an exact policy override for ${identity}`)
    }
    if (!allowedIds.has(atom)) throw new Error(`license policy review required for ${identity}: ${atom}`)
  }
  return atoms
}

function assertNpmEvidence(entry) {
  const packageFiles = Array.isArray(entry.licenseFiles) ? entry.licenseFiles : []
  const canonical = Array.isArray(entry.canonicalLicenseTexts) ? entry.canonicalLicenseTexts : []
  if (packageFiles.length === 0 && canonical.length === 0) {
    throw new Error(`npm license evidence is incomplete for ${entry.name}@${entry.version}`)
  }
  for (const item of [...packageFiles, ...canonical]) {
    if (!String(item.text ?? '').trim()) throw new Error(`empty npm license evidence for ${entry.name}@${entry.version}`)
  }
}

function safeEvidencePath(evidenceDirectory, relativePath, expectedSha256, identity) {
  if (!evidenceDirectory || !existsSync(evidenceDirectory) || !statSync(evidenceDirectory).isDirectory()) {
    throw new Error(`license evidence directory is required for ${identity}`)
  }
  const segments = String(relativePath ?? '').split(/[\\/]/)
  if (!relativePath || isAbsolute(relativePath) || segments.some((segment) => segment === '..' || segment === '.')) {
    throw new Error(`unsafe license evidence path for ${identity}`)
  }
  if (!/^[a-f0-9]{64}$/i.test(String(expectedSha256 ?? ''))) {
    throw new Error(`license evidence sha256 is required for ${identity}`)
  }
  const root = realpathSync(evidenceDirectory)
  const candidate = join(root, relativePath)
  if (!existsSync(candidate) || !statSync(candidate).isFile()) throw new Error(`missing license evidence file for ${identity}: ${relativePath}`)
  const actual = realpathSync(candidate)
  const rel = relative(root, actual).replaceAll('\\', '/')
  if (!rel || rel === '..' || rel.startsWith('../') || isAbsolute(rel)) throw new Error(`license evidence escapes evidence directory for ${identity}`)
  const bytes = statSync(actual).size
  if (bytes === 0) throw new Error(`empty license evidence file for ${identity}: ${relativePath}`)
  const digest = sha256(actual)
  if (digest.toLowerCase() !== String(expectedSha256).toLowerCase()) {
    throw new Error(`license evidence sha256 mismatch for ${identity}: ${relativePath}`)
  }
  return { type: 'embedded-file', path: rel, sha256: digest, bytes }
}

function overrideEvidence(evidenceDirectory, override, identity) {
  const allowedFields = new Set(['name', 'version', 'purl', 'declaredLicense', 'resolvedLicense', 'evidencePath', 'evidenceSha256', 'evidenceUrl'])
  const unknown = Object.keys(override).filter((key) => !allowedFields.has(key))
  if (unknown.length > 0) throw new Error(`unrecognized license policy override field for ${identity}: ${unknown.sort().join(', ')}`)
  if (typeof override.evidencePath !== 'string' || typeof override.evidenceSha256 !== 'string') {
    throw new Error(`proof-bundled license evidence file and sha256 are required for ${identity}`)
  }
  const evidence = safeEvidencePath(evidenceDirectory, override.evidencePath, override.evidenceSha256, identity)
  if (override.evidenceUrl !== undefined && !/^https:\/\/[A-Za-z0-9.-]+(?:\/[^\s]*)?$/.test(String(override.evidenceUrl))) {
    throw new Error(`stable HTTPS license evidence is required for ${identity}`)
  }
  if (override.evidenceUrl) evidence.sourceUrl = override.evidenceUrl
  return evidence
}

function firstPartyPackage(pkg, purl, expectedName) {
  return pkg.name === expectedName && purl.startsWith(`pkg:oci/${expectedName}@sha256%3A`)
}

function derivedNpmParent(pkg, npmIdentity, npmEntries) {
  if (String(pkg.versionInfo ?? '') !== 'UNKNOWN' || npmIdentity?.version) return null
  const candidates = [...npmEntries.values()]
    .filter((entry) => pkg.name.startsWith(`${entry.name}/`) && npmIdentity?.name === pkg.name)
    .sort((a, b) => b.name.length - a.name.length)
  return candidates[0] ?? null
}

export function reconcileImageLicenses({ sbom, npmInventory, policy, imageKind, baseImage, rootfsPath, evidenceDirectory, evidenceDir }) {
  if (!IMAGE_KINDS.has(imageKind)) throw new Error('imageKind must be backend or frontend')
  if (!sbom || !Array.isArray(sbom.packages)) throw new Error('SPDX SBOM packages are required')
  if (!npmInventory || !Array.isArray(npmInventory.packages)) throw new Error('npm license inventory is required')
  if (!policy || policy.schemaVersion !== 1 || !policy.images?.[imageKind]) throw new Error(`license policy is missing image ${imageKind}`)
  if (!rootfsPath || !existsSync(rootfsPath) || !statSync(rootfsPath).isDirectory()) throw new Error('exported rootfs directory is required')
  const evidenceRoot = evidenceDirectory ?? evidenceDir
  if (!evidenceRoot || !existsSync(evidenceRoot) || !statSync(evidenceRoot).isDirectory()) throw new Error('explicit license evidence directory is required')
  const imagePolicy = policy.images[imageKind]
  if (baseImage !== imagePolicy.baseImage) throw new Error(`base image digest mismatch for ${imageKind}`)
  const allowedIds = new Set(policy.allowedSpdxLicenseIds ?? [])
  const npmEntries = new Map()
  for (const entry of npmInventory.packages) {
    assertNoCommercialRestriction(entry.license, `${entry.name}@${entry.version}`)
    assertNpmEvidence(entry)
    const key = `${entry.name}@${entry.version}`
    const existing = npmEntries.get(key)
    if (existing) {
      if (existing.license !== entry.license) throw new Error(`conflicting duplicate npm license identity: ${key}`)
      continue
    }
    npmEntries.set(key, entry)
  }
  const overrides = new Map()
  for (const item of imagePolicy.overrides ?? []) {
    for (const field of ['name', 'version', 'purl', 'declaredLicense', 'resolvedLicense']) {
      if (typeof item?.[field] !== 'string' || !item[field].trim()) throw new Error(`incomplete license policy override: ${field}`)
    }
    const key = `${item.name}\u0000${item.version}\u0000${item.purl}`
    if (overrides.has(key)) throw new Error(`ambiguous duplicate license policy override: ${key.replaceAll('\u0000', '@')}`)
    overrides.set(key, item)
  }
  const usedOverrides = new Set()
  let firstPartyCount = 0
  const packages = sbom.packages.map((pkg) => {
    const name = String(pkg.name ?? '').trim()
    const version = String(pkg.versionInfo ?? '').trim()
    const declaredLicense = String(pkg.licenseDeclared ?? pkg.licenseConcluded ?? '').trim()
    const purl = purlFor(pkg)
    const identity = `${name}@${version}`
    if (firstPartyPackage(pkg, purl, imagePolicy.firstPartyPackage)) {
      firstPartyCount += 1
      return { name, version, purl, classification: 'first-party-image', license: 'PROJECT-PROPRIETARY' }
    }
    const npmPurl = npmIdentityFromPurl(purl)
    if (npmPurl) {
      const exact = npmEntries.get(`${name}@${version}`)
      if (exact && npmPurl.name === name && npmPurl.version === version) {
        return { name, version, purl, classification: 'npm-production-dependency', license: exact.license, evidence: { type: 'npm-inventory', package: `${name}@${version}` } }
      }
      const parent = derivedNpmParent(pkg, npmPurl, npmEntries)
      if (!parent) throw new Error(`unmatched or spoofed npm SBOM package: ${identity} ${purl}`)
      return { name, version, purl, classification: 'npm-derived-artifact', license: parent.license, evidence: { type: 'npm-parent', package: `${parent.name}@${parent.version}` } }
    }
    const overrideKey = `${name}\u0000${version}\u0000${purl}`
    const override = overrides.get(overrideKey)
    if (override) {
      if (override.declaredLicense !== declaredLicense) throw new Error(`declared license mismatch for ${identity}`)
      assertStandardExpression(override.resolvedLicense, allowedIds, identity, { allowLicenseRef: true })
      usedOverrides.add(overrideKey)
      return { name, version, purl, classification: 'base-runtime-override', license: override.resolvedLicense, evidence: overrideEvidence(evidenceRoot, override, identity) }
    }
    if ([...overrides.keys()].some((key) => key.startsWith(`${name}\u0000${version}\u0000`))) {
      throw new Error(`license policy purl mismatch for ${identity}`)
    }
    const atoms = assertStandardExpression(declaredLicense, allowedIds, identity)
    return { name, version, purl, classification: 'base-runtime-spdx', license: declaredLicense, evidence: { type: 'spdx-expression', ids: atoms } }
  })
  if (firstPartyCount !== 1) throw new Error(`exactly one first-party OCI package is required for ${imageKind}`)
  for (const key of overrides.keys()) if (!usedOverrides.has(key)) throw new Error(`unused or stale license policy override: ${key.replaceAll('\u0000', '@')}`)
  packages.sort((a, b) => a.classification.localeCompare(b.classification) || a.name.localeCompare(b.name) || a.version.localeCompare(b.version) || a.purl.localeCompare(b.purl))
  const counts = Object.fromEntries([...new Set(packages.map((item) => item.classification))].sort().map((kind) => [kind, packages.filter((item) => item.classification === kind).length]))
  return { schemaVersion: 1, imageKind, baseImage, packageCount: packages.length, counts, packages }
}

function canonicalText(spdxLicenseDirectory, id) {
  // spdx-license-list publishes the GCC 3.1 exception under the legacy
  // combined identifier. The paired GPL text is emitted separately from the
  // SPDX expression, so strip the legacy placeholder and retain the complete
  // exception text from the same pinned catalog.
  const catalogId = id === 'GCC-exception-3.1' ? 'GPL-3.0-with-GCC-exception' : id
  const pathname = join(spdxLicenseDirectory, `${catalogId}.json`)
  if (!existsSync(pathname)) throw new Error(`canonical SPDX text is missing: ${id}`)
  const record = readJson(pathname, `SPDX ${id}`)
  const text = String(record.licenseText ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^insert GPL v3 text here\s*/i, '')
    .trimEnd()
  if (!text) throw new Error(`canonical SPDX text is empty: ${id}`)
  return { id, name: String(record.name ?? id).trim() || id, text }
}

function evidenceText(evidenceDirectory, evidence, identity) {
  if (evidence?.type !== 'embedded-file') throw new Error(`embedded license evidence is required for ${identity}`)
  const resolved = safeEvidencePath(evidenceDirectory, evidence.path, evidence.sha256, identity)
  if (!Number.isSafeInteger(evidence.bytes) || evidence.bytes !== resolved.bytes) {
    throw new Error(`license evidence byte count mismatch for ${identity}: ${evidence.path}`)
  }
  const root = realpathSync(evidenceDirectory)
  const pathname = join(root, resolved.path)
  return readFileSync(pathname, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd()
}

export function renderImageLicenseNotices({ receipt, npmNotices, spdxLicenseDirectory, evidenceDirectory, evidenceDir }) {
  if (!receipt || receipt.schemaVersion !== 1 || !Array.isArray(receipt.packages)) throw new Error('valid reconciliation receipt is required')
  if (!String(npmNotices ?? '').trim() || /License text:\s*not packaged by upstream/i.test(npmNotices)) throw new Error('complete npm notices are required')
  const thirdParty = receipt.packages.filter((item) => item.classification.startsWith('base-runtime-'))
  const ids = new Set()
  for (const item of thirdParty) for (const id of licenseAtoms(item.license)) if (!id.startsWith('LicenseRef-')) ids.add(id)
  const lines = [
    `HR Axis On-Premise ${receipt.imageKind} Image Notices`,
    '====================================================',
    '',
    'Technical license reconciliation receipt; this artifact is not legal advice.',
    `Pinned base image: ${receipt.baseImage}`,
    '',
    'Application production dependency notices',
    '-----------------------------------------',
    String(npmNotices).trimEnd(),
    '',
    'Base and runtime components',
    '---------------------------',
  ]
  const evidenceRoot = evidenceDirectory ?? evidenceDir
  for (const item of thirdParty) {
    lines.push(`${item.name}@${item.version}`, `PURL: ${item.purl}`, `License: ${item.license}`)
    if (item.evidence.type === 'embedded-file') {
      const text = evidenceText(evidenceRoot, item.evidence, `${item.name}@${item.version}`)
      lines.push(`License evidence: bundle://${item.evidence.path}`, `Evidence SHA-256: ${item.evidence.sha256}`, `Evidence bytes: ${item.evidence.bytes}`, `--- Complete evidence ${item.evidence.path} ---`, text)
      if (item.evidence.sourceUrl) lines.push(`Informational upstream reference: ${item.evidence.sourceUrl}`)
    }
    else if (item.evidence.type === 'stable-reference') throw new Error(`proof-bundled license evidence is required for ${item.name}@${item.version}`)
    else if (item.evidence.type === 'spdx-expression') lines.push(`License evidence: SPDX ${item.evidence.ids.join(', ')}`)
    else throw new Error(`unknown license evidence type for ${item.name}@${item.version}`)
    lines.push('')
  }
  lines.push('Canonical SPDX texts for base/runtime expressions', '-------------------------------------------------')
  for (const id of [...ids].sort()) {
    const license = canonicalText(spdxLicenseDirectory, id)
    lines.push('', `--- SPDX ${license.id}: ${license.name} ---`, license.text)
  }
  return `${lines.join('\n').trimEnd()}\n`
}

function parseArgs(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const next = () => argv[++index]
    if (argument === '--sbom') options.sbomPath = next()
    else if (argument === '--npm-inventory') options.npmInventoryPath = next()
    else if (argument === '--npm-notices') options.npmNoticesPath = next()
    else if (argument === '--policy') options.policyPath = next()
    else if (argument === '--image-kind') options.imageKind = next()
    else if (argument === '--base-image') options.baseImage = next()
    else if (argument === '--rootfs') options.rootfsPath = next()
    else if (argument === '--evidence-dir') options.evidenceDirectory = next()
    else if (argument === '--spdx-license-directory') options.spdxLicenseDirectory = next()
    else if (argument === '--receipt') options.receiptPath = next()
    else if (argument === '--notices') options.noticesPath = next()
    else throw new Error(`Unknown argument: ${argument}`)
  }
  for (const key of ['sbomPath', 'npmInventoryPath', 'npmNoticesPath', 'policyPath', 'imageKind', 'baseImage', 'rootfsPath', 'evidenceDirectory', 'spdxLicenseDirectory', 'receiptPath', 'noticesPath']) {
    if (!options[key]) throw new Error(`missing required option: ${key}`)
  }
  return options
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseArgs(process.argv.slice(2))
    const receipt = reconcileImageLicenses({
      sbom: readJson(options.sbomPath, 'SPDX SBOM'),
      npmInventory: readJson(options.npmInventoryPath, 'npm license inventory'),
      policy: readJson(options.policyPath, 'base license policy'),
      imageKind: options.imageKind,
      baseImage: options.baseImage,
      rootfsPath: options.rootfsPath,
      evidenceDirectory: options.evidenceDirectory,
    })
    const notices = renderImageLicenseNotices({ receipt, npmNotices: readFileSync(options.npmNoticesPath, 'utf8'), spdxLicenseDirectory: options.spdxLicenseDirectory, evidenceDirectory: options.evidenceDirectory })
    writeFileSync(options.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
    writeFileSync(options.noticesPath, notices)
    console.log(`image license reconciliation: ${receipt.imageKind} ${receipt.packageCount} packages`)
  } catch (error) {
    console.error(`image license reconciliation: ${error.message}`)
    process.exitCode = 1
  }
}
