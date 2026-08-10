import { createHash } from 'node:crypto'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FORBIDDEN = /(?:NOASSERTION|UNKNOWN|UNLICENSED|PROPRIETARY|NONCOMMERCIAL|NON-COMMERCIAL|SSPL|BUSL|COMMONS[ -]CLAUSE|POLYFORM-NONCOMMERCIAL)/i
const MISSING_LICENSE = /^(?:NONE|NOASSERTION|UNKNOWN)$/i
const LICENSE_REF = /LicenseRef-/i

export const ANGUS_EMBEDDED_LICENSE_POLICY = Object.freeze({
  expectedPackageCount: 552,
  maxUnresolvedCount: 452,
  requireFirstPartyRoot: true,
  requireExactAngusPair: true,
  allowedSpdxLicenseIds: Object.freeze([
    'Apache-2.0',
    'BSD-2-Clause',
    'BSD-3-Clause',
    'EPL-1.0',
    'GPL-2.0-only',
    'GPL-2.0-or-later',
    'LGPL-2.1-only',
    'LGPL-2.1-or-later',
    'MIT',
  ]),
  core: Object.freeze({
    name: 'angus-core',
    version: '2.0.5',
    purl: 'pkg:maven/org.eclipse.angus/angus-core@2.0.5',
  }),
  sibling: Object.freeze({
    name: 'angus-mail',
    version: '2.0.5',
    purl: 'pkg:maven/org.eclipse.angus/angus-mail@2.0.5',
  }),
  sourceInfo: 'acquired package info from installed java archive: /opt/keycloak/lib/lib/main/org.eclipse.angus.angus-mail-2.0.5.jar',
  sourceJarPath: '/opt/keycloak/lib/lib/main/org.eclipse.angus.angus-mail-2.0.5.jar',
  sourceJarSha256: 'b4d8c30d35f455def6c7a05fe595a1e62ea2b80cac3efec1e9ccf4118b23168a',
  licenseEntry: 'META-INF/LICENSE.md',
  licenseSha256: 'a8f94fd9e41984cfadc6d26821c21ed047e3bdf48c5af899d735287e7cddd997',
  noticeEntry: 'META-INF/NOTICE.md',
  noticeSha256: 'bba43e29c8098aaa07c2130d979f6d44a62f9ad51f8061c96bf6889ff5926819',
  resolvedLicense: 'EPL-2.0 OR (GPL-2.0-only WITH Classpath-exception-2.0)',
})

function readJson(path, label) {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch (error) { throw new Error(`unable to read ${label}: ${error.message}`) }
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function parseArgs(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--sbom') options.sbom = argv[++index]
    else if (arg === '--inventory') options.inventory = argv[++index]
    else if (arg === '--license-text') options.licenseText = argv[++index]
    else if (arg === '--license-paths') options.licensePaths = argv[++index]
    else if (arg === '--license-bundle') options.licenseBundle = argv[++index]
    else if (arg === '--angus-source-jar') options.angusSourceJar = argv[++index]
    else if (arg === '--angus-license') options.angusLicense = argv[++index]
    else if (arg === '--angus-notice') options.angusNotice = argv[++index]
    else if (arg === '--output') options.output = argv[++index]
    else throw new Error(`unknown argument: ${arg}`)
  }
  for (const name of ['sbom', 'inventory', 'licenseText', 'licensePaths', 'licenseBundle', 'angusSourceJar', 'angusLicense', 'angusNotice', 'output']) if (!options[name]) throw new Error(`--${name} is required`)
  return options
}

function packagePurls(pkg) {
  return Array.isArray(pkg?.externalRefs)
    ? pkg.externalRefs.filter((ref) => ref?.referenceType === 'purl').map((ref) => String(ref.referenceLocator ?? '')).filter(Boolean)
    : []
}

function exactPackage(pkg, expected, sourceInfo) {
  const purls = packagePurls(pkg)
  return String(pkg?.name ?? '').trim() === expected.name
    && String(pkg?.versionInfo ?? '').trim() === expected.version
    && String(pkg?.sourceInfo ?? '').trim() === sourceInfo
    && purls.length === 1
    && purls[0] === expected.purl
}

function rawLicenseAssertions(pkg) {
  return {
    concluded: String(pkg?.licenseConcluded ?? ''),
    declared: String(pkg?.licenseDeclared ?? ''),
    infoFromFiles: Array.isArray(pkg?.licenseInfoFromFiles) ? pkg.licenseInfoFromFiles.map(String) : [],
  }
}

function extractedLicenseInfoStatus(sbom, licenseReferences, identity) {
  const extracted = Array.isArray(sbom?.hasExtractedLicensingInfos) ? sbom.hasExtractedLicensingInfos : []
  const byId = new Map()
  for (const item of extracted) {
    const licenseId = String(item?.licenseId ?? '').trim()
    if (!licenseId || byId.has(licenseId)) throw new Error(`Keycloak SBOM extracted license identity is missing or duplicated for ${identity}`)
    byId.set(licenseId, String(item?.extractedText ?? ''))
  }
  const references = [...new Set(licenseReferences.flatMap((expression) => expression.match(/(?:DocumentRef-[A-Za-z0-9.+-]+:)?LicenseRef-[A-Za-z0-9.+-]+/g) ?? []))].sort()
  return references.map((reference) => {
    const licenseId = reference.includes(':') ? reference.slice(reference.lastIndexOf(':') + 1) : reference
    const extractedText = byId.get(licenseId)
    return {
      reference,
      licenseId,
      status: extractedText === undefined ? 'not-present' : MISSING_LICENSE.test(extractedText.trim()) ? 'no-assertion' : 'present',
    }
  })
}

function assertKnownSpdxExpression(expression, allowedIds, identity) {
  const tokens = String(expression).match(/\(|\)|AND|OR|WITH|[A-Za-z0-9][A-Za-z0-9.+-]*/g) ?? []
  if (tokens.join('').toLowerCase() !== String(expression).replace(/\s+/g, '').toLowerCase()) {
    throw new Error(`Keycloak SBOM component has an invalid SPDX expression for ${identity}`)
  }
  const atoms = tokens.filter((token) => !['(', ')', 'AND', 'OR', 'WITH'].includes(token))
  if (atoms.length === 0 || atoms.some((atom) => !allowedIds.has(atom))) {
    throw new Error(`Keycloak SBOM component has an unknown SPDX license for ${identity}`)
  }
  if (tokens.includes('WITH')) throw new Error(`Keycloak SBOM component has an unknown SPDX exception for ${identity}`)
  let depth = 0
  let expectsOperand = true
  for (const token of tokens) {
    if (token === '(') {
      if (!expectsOperand) throw new Error(`Keycloak SBOM component has an invalid SPDX expression for ${identity}`)
      depth += 1
    } else if (token === ')') {
      if (expectsOperand || depth === 0) throw new Error(`Keycloak SBOM component has an invalid SPDX expression for ${identity}`)
      depth -= 1
      expectsOperand = false
    } else if (['AND', 'OR', 'WITH'].includes(token)) {
      if (expectsOperand) throw new Error(`Keycloak SBOM component has an invalid SPDX expression for ${identity}`)
      expectsOperand = true
    } else {
      if (!expectsOperand) throw new Error(`Keycloak SBOM component has an invalid SPDX expression for ${identity}`)
      expectsOperand = false
    }
  }
  if (expectsOperand || depth !== 0) throw new Error(`Keycloak SBOM component has an invalid SPDX expression for ${identity}`)
}

function isVerifiedFirstPartyRoot(pkg, inventory) {
  if (String(pkg?.name ?? '') !== 'hr-axis-onprem-keycloak'
    || String(pkg?.SPDXID ?? '') !== 'SPDXRef-DocumentRoot-Image-hr-axis-onprem-keycloak'
    || String(pkg?.sourceInfo ?? '') !== '') return false
  const purls = packagePurls(pkg)
  if (purls.length !== 1) return false
  const match = /^pkg:oci\/hr-axis-onprem-keycloak@sha256%3A([a-f0-9]{64})\?arch=amd64&tag=proof$/i.exec(purls[0])
  if (!match) return false
  const checksums = Array.isArray(pkg?.checksums) ? pkg.checksums : []
  const packageDigest = checksums.find((item) => String(item?.algorithm ?? '').toUpperCase() === 'SHA256')?.checksumValue
  const inventoryDigest = /^sha256:([a-f0-9]{64})$/i.exec(String(inventory?.imageId ?? ''))?.[1]
  return Boolean(packageDigest && inventoryDigest
    && match[1].toLowerCase() === String(packageDigest).toLowerCase()
    && match[1].toLowerCase() === inventoryDigest.toLowerCase())
}

function verifiedAngusEvidence(packages, options, policy) {
  const possibleCores = packages.filter((pkg) => String(pkg?.name ?? '').trim() === policy.core.name || packagePurls(pkg).includes(policy.core.purl))
  const possibleSiblings = packages.filter((pkg) => String(pkg?.name ?? '').trim() === policy.sibling.name || packagePurls(pkg).includes(policy.sibling.purl))
  if (possibleCores.length === 0 && possibleSiblings.length === 0) {
    if (policy.requireExactAngusPair) throw new Error('exact angus-core and angus-mail evidence pair is required')
    return new Map()
  }
  if (possibleCores.length !== 1 || !exactPackage(possibleCores[0], policy.core, policy.sourceInfo)) {
    throw new Error('exact angus-core virtual component identity is required')
  }
  if (possibleSiblings.length !== 1 || !exactPackage(possibleSiblings[0], policy.sibling, policy.sourceInfo)) {
    throw new Error('exact angus-mail source sibling identity is required')
  }
  const evidence = [
    ['source JAR', options.angusSourceJar, policy.sourceJarSha256],
    [policy.licenseEntry, options.angusLicense, policy.licenseSha256],
    [policy.noticeEntry, options.angusNotice, policy.noticeSha256],
  ]
  for (const [label, path, expectedSha256] of evidence) {
    if (!path || !statSync(path).isFile() || statSync(path).size === 0) throw new Error(`Angus ${label} evidence is missing`)
    if (sha256(path) !== expectedSha256) throw new Error(`Angus ${label} evidence sha256 mismatch`)
  }
  const notice = readFileSync(options.angusNotice, 'utf8')
  if (!notice.includes(`SPDX-License-Identifier: ${policy.resolvedLicense.replace('GPL-2.0-only WITH Classpath-exception-2.0', 'GPL-2.0 WITH Classpath-exception-2.0').replace(/[()]/g, '')}`)) {
    throw new Error('Angus NOTICE does not contain the evidence-backed SPDX license expression')
  }
  const boundEvidence = {
    type: 'embedded-jar-license',
    sourcePurl: policy.sibling.purl,
    sourceJar: { path: policy.sourceJarPath, sha256: policy.sourceJarSha256 },
    entries: [
      { path: policy.licenseEntry, sha256: policy.licenseSha256 },
      { path: policy.noticeEntry, sha256: policy.noticeSha256 },
    ],
  }
  return new Map([[possibleCores[0], boundEvidence], [possibleSiblings[0], boundEvidence]])
}

export function reconcileKeycloakLicenses(options, angusPolicy = ANGUS_EMBEDDED_LICENSE_POLICY) {
  const sbom = readJson(options.sbom, 'Keycloak SBOM')
  const inventory = readJson(options.inventory, 'Keycloak license inventory')
  if (!Array.isArray(sbom.packages) || sbom.packages.length === 0) throw new Error('Keycloak SBOM packages are required')
  if (inventory.dataClass !== 'synthetic' || typeof inventory.image !== 'string' || typeof inventory.baseImage !== 'string' || !/^sha256:[a-f0-9]{64}$/i.test(String(inventory.imageId ?? ''))) throw new Error('Keycloak license inventory identity is incomplete')
  if (inventory.packageCount !== sbom.packages.length) throw new Error('Keycloak license inventory package count does not match SBOM')
  if (!Number.isInteger(angusPolicy.expectedPackageCount) || sbom.packages.length !== angusPolicy.expectedPackageCount) throw new Error('Keycloak pinned SBOM package count mismatch')
  const licenseText = readFileSync(options.licenseText, 'utf8').trim()
  const licensePaths = readFileSync(options.licensePaths, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (!statSync(options.licenseBundle).isFile() || statSync(options.licenseBundle).size === 0) throw new Error('Keycloak bundled license evidence is empty')
  if (!licenseText) throw new Error('Keycloak LICENSE evidence is empty')
  if (licensePaths.length === 0 || !licensePaths.some((path) => /(?:^|\/)(?:LICENSE|NOTICE)(?:\.[^/]*)?$/i.test(path))) throw new Error('Keycloak license/notice path evidence is incomplete')
  const angusEvidence = verifiedAngusEvidence(sbom.packages, options, angusPolicy)
  if (angusPolicy.requireExactAngusPair && angusEvidence.size !== 2) throw new Error('exact Angus evidence resolution count must be 2')
  const blankSourcePackages = sbom.packages.filter((pkg) => !String(pkg?.sourceInfo ?? '').trim())
  if (angusPolicy.requireFirstPartyRoot && (blankSourcePackages.length !== 1 || !isVerifiedFirstPartyRoot(blankSourcePackages[0], inventory))) {
    throw new Error('Keycloak SBOM must contain exactly one immutable first-party image root and no other blank sourceInfo')
  }
  if (!angusPolicy.requireFirstPartyRoot && blankSourcePackages.length > 0) throw new Error('Keycloak SBOM component sourceInfo is missing')
  const seenSpdxIds = new Set()
  const allowedSpdxLicenseIds = new Set(angusPolicy.allowedSpdxLicenseIds ?? [])
  const components = sbom.packages.map((pkg) => {
    const name = String(pkg.name ?? '').trim()
    const version = String(pkg.versionInfo ?? '').trim()
    const spdxId = String(pkg.SPDXID ?? '').trim()
    const sourceInfo = String(pkg.sourceInfo ?? '')
    const licenseCandidates = [pkg.licenseConcluded, pkg.licenseDeclared]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
    const exactAngusEvidence = angusEvidence.get(pkg)
    const refs = packagePurls(pkg)
    if (!name || !version || !spdxId) throw new Error(`Keycloak SBOM component identity is incomplete for ${name || 'unknown'}`)
    if (seenSpdxIds.has(spdxId)) throw new Error(`duplicate Keycloak SBOM SPDX identity: ${spdxId}`)
    seenSpdxIds.add(spdxId)
    if (refs.length !== 1) throw new Error(`Keycloak SBOM component must have exactly one purl: ${name}@${version}`)
    const firstPartyRoot = isVerifiedFirstPartyRoot(pkg, inventory)
    if (!sourceInfo.trim() && !firstPartyRoot) throw new Error(`Keycloak SBOM component sourceInfo is missing for ${name}`)
    const identity = {
      spdxId,
      name,
      version,
      purl: refs[0],
      sourceInfo,
      rawLicenseAssertions: rawLicenseAssertions(pkg),
    }
    const prohibitedCandidates = licenseCandidates.filter((candidate) => !MISSING_LICENSE.test(candidate) && FORBIDDEN.test(candidate))
    if (prohibitedCandidates.length > 0) {
      throw new Error(`Keycloak SBOM component license evidence is prohibited for ${name}`)
    }
    const standardCandidates = licenseCandidates.filter((candidate) => !MISSING_LICENSE.test(candidate) && !LICENSE_REF.test(candidate))
    for (const candidate of standardCandidates) assertKnownSpdxExpression(candidate, allowedSpdxLicenseIds, `${name}@${version}`)
    if (exactAngusEvidence) {
      return {
        ...identity,
        license: angusPolicy.resolvedLicense,
        classification: 'resolved-embedded-jar',
        evidence: exactAngusEvidence,
      }
    }
    if (firstPartyRoot) {
      return {
        ...identity,
        sourceClassification: 'first-party-image-root',
        sourceIdentity: inventory.imageId,
        license: null,
        classification: 'unresolved-external-review',
        unresolvedReason: 'missing-sbom-license-assertion',
        evidence: null,
      }
    }
    const licenseReferences = [...new Set(licenseCandidates.filter((candidate) => LICENSE_REF.test(candidate)))].sort()
    if (licenseReferences.length > 0) {
      return {
        ...identity,
        license: null,
        licenseReferences,
        extractedLicenseInfoStatus: extractedLicenseInfoStatus(sbom, licenseReferences, `${name}@${version}`),
        classification: 'unresolved-external-review',
        unresolvedReason: 'unresolved-license-reference',
        evidence: null,
      }
    }
    const license = standardCandidates[0] ?? ''
    if (!license) {
      return {
        ...identity,
        license: null,
        classification: 'unresolved-external-review',
        unresolvedReason: 'missing-sbom-license-assertion',
        evidence: null,
      }
    }
    return {
      ...identity,
      license,
      classification: 'sbom-standard-asserted',
      evidence: { type: 'upstream-distribution-bundle', path: 'keycloak-license-evidence.tar', sha256: sha256(options.licenseBundle) },
    }
  }).sort((a, b) => a.purl.localeCompare(b.purl))
  const evidenceResolvedCount = components.filter((component) => component.classification === 'resolved-embedded-jar').length
  const sbomStandardAssertedCount = components.filter((component) => component.classification === 'sbom-standard-asserted').length
  const unresolvedCount = components.filter((component) => component.classification === 'unresolved-external-review').length
  const resolvedCount = evidenceResolvedCount + sbomStandardAssertedCount
  if (resolvedCount + unresolvedCount !== components.length) throw new Error('Keycloak license classification count mismatch')
  if (!Number.isInteger(angusPolicy.maxUnresolvedCount) || angusPolicy.maxUnresolvedCount < 0) throw new Error('Keycloak unresolved license boundary is invalid')
  if (unresolvedCount > angusPolicy.maxUnresolvedCount) {
    throw new Error(`Keycloak unresolved license count ${unresolvedCount} exceeds approved maximum ${angusPolicy.maxUnresolvedCount}`)
  }
  return {
    schemaVersion: 1,
    dataClass: 'synthetic',
    image: inventory.image,
    imageId: inventory.imageId,
    baseImage: inventory.baseImage,
    packageCount: components.length,
    resolvedCount,
    evidenceResolvedCount,
    sbomStandardAssertedCount,
    unresolvedCount,
    maxUnresolvedCount: angusPolicy.maxUnresolvedCount,
    components,
    evidence: {
      sbomSha256: sha256(options.sbom),
      licenseTextSha256: sha256(options.licenseText),
      licensePathsSha256: sha256(options.licensePaths),
      licenseBundleSha256: sha256(options.licenseBundle),
      licensePathCount: licensePaths.length,
    },
    residualExternalReviewRequired: true,
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseArgs(process.argv.slice(2))
    writeFileSync(options.output, `${JSON.stringify(reconcileKeycloakLicenses(options), null, 2)}\n`, { mode: 0o600 })
    console.log('Keycloak license reconciliation: generated')
  } catch (error) {
    console.error(`Keycloak license reconciliation: ${error.message}`)
    process.exitCode = 1
  }
}

export { parseArgs }
