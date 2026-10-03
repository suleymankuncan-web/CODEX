// Exact upload selection contracts; failure diagnostics are never release artifacts.
const fail = (message) => { throw new Error(message) }
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

export const FULL_PROOF_UPLOAD_CONTRACT = Object.freeze([
  Object.freeze({
    name: 'Upload sanitized runtime receipt',
    artifactName: 'onprem-core-runtime-proof-${{ github.sha }}',
    ifNoFilesFound: 'error',
    paths: Object.freeze(['${{ runner.temp }}/onprem-core-runtime-receipt.json']),
  }),
  Object.freeze({
    name: 'Upload sanitized Keycloak runtime receipt',
    artifactName: 'onprem-keycloak-runtime-proof-${{ github.sha }}',
    ifNoFilesFound: 'error',
    paths: Object.freeze(['${{ runner.temp }}/onprem-keycloak-runtime-receipt.json']),
  }),
  Object.freeze({
    name: 'Upload sanitized photo-storage proof and supply-chain evidence',
    artifactName: 'onprem-photo-storage-proof-${{ github.sha }}',
    ifNoFilesFound: 'error',
    paths: Object.freeze([
      '${{ runner.temp }}/onprem-photo-storage-runtime-receipt.json',
      'proof/photo-storage-sbom.spdx.json',
      'proof/photo-storage-trivy.json',
      'proof/photo-storage-license-receipt.json',
    ]),
  }),
  Object.freeze({
    name: 'Upload sanitized proof artifacts',
    artifactName: 'onprem-image-proof-${{ github.sha }}',
    ifNoFilesFound: 'error',
    paths: Object.freeze([
      'proof/*-content-guard.json',
      'proof/*-sbom.spdx.json',
      'proof/*-trivy.json',
      'proof/*-license-inventory.json',
      'proof/*-image-license-reconciliation.json',
      'proof/base-license-evidence/**',
      'proof/base-license-evidence.tar',
      'proof/*-THIRD_PARTY_NOTICES.txt',
      'proof/keycloak-image-manifest.json',
      'proof/keycloak-LICENSE.txt',
      'proof/keycloak-license-paths.txt',
      'proof/keycloak-license-reconciliation.json',
      'proof/keycloak-license-evidence.tar',
      'proof/backend-image.tar',
      'proof/frontend-image.tar',
      'proof/keycloak-image.tar',
      'proof/release-manifest.json',
      'proof/onprem-proof-receipt.json',
      'proof/content-guard-index.json',
      'proof/content-guard-index-public.pem',
      'proof/ephemeral-public.pem',
    ]),
  }),
])
export function assertExactUploadContract(uploads) {
  if (!Array.isArray(uploads) || uploads.length !== FULL_PROOF_UPLOAD_CONTRACT.length) {
    fail('full proof upload contract changed')
  }
  for (const [index, upload] of uploads.entries()) {
    const expected = FULL_PROOF_UPLOAD_CONTRACT[index]
    const actualKeys = isObject(upload) ? Object.keys(upload).sort() : []
    const expectedKeys = ['artifactName', 'ifNoFilesFound', 'name', 'paths']
    const keysMatch = actualKeys.length === expectedKeys.length && actualKeys.every((key, keyIndex) => key === expectedKeys[keyIndex])
    const pathsMatch = Array.isArray(upload?.paths)
      && upload.paths.length === expected.paths.length
      && upload.paths.every((path, pathIndex) => path === expected.paths[pathIndex])
    if (!keysMatch
      || upload.name !== expected.name
      || upload.artifactName !== expected.artifactName
      || upload.ifNoFilesFound !== expected.ifNoFilesFound
      || !pathsMatch) {
      fail(`full proof upload contract changed: ${expected.name}`)
    }
  }
  return true
}

export function validateAndStripFailureDiagnostics(allSteps) {
  const diagnostics = allSteps.filter((step) => step.name === 'Upload failed Keycloak license diagnostics')
  if (diagnostics.length !== 1) fail('Keycloak license diagnostic contract changed')
  const diagnostic = diagnostics[0]
  const expectedDiagnostic = {
    name: 'Upload failed Keycloak license diagnostics',
    body: null,
    uses: 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',
    env: {},
    with: {
      name: 'onprem-keycloak-license-diagnostics-${{ inputs.expected_sha }}',
      'if-no-files-found': 'warn',
      'retention-days': '3',
      path: [
        'proof/keycloak-sbom.spdx.json',
        'proof/keycloak-license-inventory.json',
        'proof/keycloak-LICENSE.txt',
        'proof/keycloak-license-paths.txt',
        'proof/keycloak-license-evidence.tar',
      ].join('\n'),
    },
    condition: "failure() && inputs.proof_mode == 'full' && github.event_name != 'pull_request'",
  }
  const diagnosticIndex = allSteps.indexOf(diagnostic)
  if (JSON.stringify(diagnostic) !== JSON.stringify(expectedDiagnostic)
    || allSteps[diagnosticIndex - 1]?.name !== 'Generate production license inventories and notices'
    || allSteps[diagnosticIndex + 1]?.name !== 'Generate sanitized Keycloak image manifest') {
    fail('Keycloak license diagnostic contract changed')
  }
  // GitHub-only failure evidence must never become a successful local release upload.
  return allSteps.filter((step) => step !== diagnostic)
}
