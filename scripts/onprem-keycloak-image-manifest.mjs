import { createHash } from 'node:crypto'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const PINNED_BASE_IMAGE = 'quay.io/keycloak/keycloak:26.7.0@sha256:0f198be292568439d700cdbfb893e69a6009bb43a94a06a945b1d3d506c76b13'
const DIGEST = /^sha256:[0-9a-f]{64}$/i

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function parseArgs(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--image') options.image = argv[++index]
    else if (arg === '--base-image') options.baseImage = argv[++index]
    else if (arg === '--image-id') options.imageId = argv[++index]
    else if (arg === '--sbom') options.sbom = argv[++index]
    else if (arg === '--trivy') options.trivy = argv[++index]
    else if (arg === '--license') options.license = argv[++index]
    else if (arg === '--license-text') options.licenseText = argv[++index]
    else if (arg === '--license-paths') options.licensePaths = argv[++index]
    else if (arg === '--license-reconciliation') options.licenseReconciliation = argv[++index]
    else if (arg === '--license-bundle') options.licenseBundle = argv[++index]
    else if (arg === '--content') options.content = argv[++index]
    else if (arg === '--output') options.output = argv[++index]
    else throw new Error(`unknown argument: ${arg}`)
  }
  for (const name of ['image', 'baseImage', 'imageId', 'sbom', 'trivy', 'license', 'licenseText', 'licensePaths', 'licenseReconciliation', 'licenseBundle', 'content', 'output']) if (!options[name]) throw new Error(`--${name} is required`)
  return options
}

export function createKeycloakImageManifest(options) {
  if (options.baseImage !== PINNED_BASE_IMAGE) throw new Error('Keycloak base image is not the approved immutable digest')
  if (!/^hr-axis-onprem-keycloak@sha256:[0-9a-f]{64}$/i.test(options.image)) throw new Error('Keycloak final image identity must be immutable')
  if (!DIGEST.test(options.imageId)) throw new Error('Keycloak image id must be a sha256 digest')
  const artifacts = {}
  for (const [name, path] of Object.entries({ sbom: options.sbom, trivy: options.trivy, license: options.license, licenseText: options.licenseText, licensePaths: options.licensePaths, licenseReconciliation: options.licenseReconciliation, licenseBundle: options.licenseBundle, content: options.content })) {
    const bytes = statSync(path).size
    artifacts[name] = { path: path.replaceAll('\\', '/').split('/').pop(), sha256: sha256(path), bytes }
  }
  return {
    schemaVersion: 1,
    dataClass: 'synthetic',
    baseImage: options.baseImage,
    image: options.image,
    imageId: options.imageId.toLowerCase(),
    artifacts,
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseArgs(process.argv.slice(2))
    writeFileSync(options.output, `${JSON.stringify(createKeycloakImageManifest(options), null, 2)}\n`)
    console.log('Keycloak image manifest: generated')
  } catch (error) {
    console.error(`Keycloak image manifest: ${error.message}`)
    process.exitCode = 1
  }
}

export { parseArgs }
