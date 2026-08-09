import { createHash } from 'node:crypto'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FORBIDDEN = /(?:NOASSERTION|UNKNOWN|UNLICENSED|PROPRIETARY|NONCOMMERCIAL|NON-COMMERCIAL|SSPL|BUSL|COMMONS[ -]CLAUSE|POLYFORM-NONCOMMERCIAL)/i
const MISSING_LICENSE = /^(?:NONE|NOASSERTION|UNKNOWN)$/i

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
    else if (arg === '--output') options.output = argv[++index]
    else throw new Error(`unknown argument: ${arg}`)
  }
  for (const name of ['sbom', 'inventory', 'licenseText', 'licensePaths', 'licenseBundle', 'output']) if (!options[name]) throw new Error(`--${name} is required`)
  return options
}

export function reconcileKeycloakLicenses(options) {
  const sbom = readJson(options.sbom, 'Keycloak SBOM')
  const inventory = readJson(options.inventory, 'Keycloak license inventory')
  if (!Array.isArray(sbom.packages) || sbom.packages.length === 0) throw new Error('Keycloak SBOM packages are required')
  if (inventory.dataClass !== 'synthetic' || typeof inventory.image !== 'string' || typeof inventory.baseImage !== 'string') throw new Error('Keycloak license inventory identity is incomplete')
  if (inventory.packageCount !== sbom.packages.length) throw new Error('Keycloak license inventory package count does not match SBOM')
  const licenseText = readFileSync(options.licenseText, 'utf8').trim()
  const licensePaths = readFileSync(options.licensePaths, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (!statSync(options.licenseBundle).isFile() || statSync(options.licenseBundle).size === 0) throw new Error('Keycloak bundled license evidence is empty')
  if (!licenseText) throw new Error('Keycloak LICENSE evidence is empty')
  if (licensePaths.length === 0 || !licensePaths.some((path) => /(?:^|\/)(?:LICENSE|NOTICE)(?:\.[^/]*)?$/i.test(path))) throw new Error('Keycloak license/notice path evidence is incomplete')
  const components = sbom.packages.map((pkg) => {
    const name = String(pkg.name ?? '').trim()
    const version = String(pkg.versionInfo ?? '').trim()
    const licenseCandidates = [pkg.licenseConcluded, pkg.licenseDeclared]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
    const license = licenseCandidates.find((candidate) => !MISSING_LICENSE.test(candidate) && !FORBIDDEN.test(candidate)) ?? ''
    const hasProhibitedLicense = licenseCandidates.some((candidate) => !MISSING_LICENSE.test(candidate) && FORBIDDEN.test(candidate))
    if (!name || !version || !license || hasProhibitedLicense) throw new Error(`Keycloak SBOM component license evidence is missing or prohibited for ${name || 'unknown'}`)
    const refs = Array.isArray(pkg.externalRefs) ? pkg.externalRefs.filter((ref) => ref?.referenceType === 'purl').map((ref) => String(ref.referenceLocator ?? '')).filter(Boolean) : []
    if (refs.length !== 1) throw new Error(`Keycloak SBOM component must have exactly one purl: ${name}@${version}`)
    return { name, version, purl: refs[0], license, evidence: { type: 'upstream-distribution-bundle', path: 'keycloak-license-evidence.tar', sha256: sha256(options.licenseBundle) } }
  }).sort((a, b) => a.purl.localeCompare(b.purl))
  return {
    schemaVersion: 1,
    dataClass: 'synthetic',
    image: inventory.image,
    baseImage: inventory.baseImage,
    packageCount: components.length,
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
