import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { reconcileKeycloakLicenses } from './onprem-keycloak-license-reconciliation.mjs'

test('Keycloak license reconciliation covers every SBOM component and bundled evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-keycloak-license-'))
  try {
    const sbomPath = join(root, 'sbom.json')
    const inventoryPath = join(root, 'inventory.json')
    const textPath = join(root, 'LICENSE.txt')
    const pathsPath = join(root, 'paths.txt')
    const bundlePath = join(root, 'evidence.tar')
    const sbom = { packages: [
      { name: 'keycloak', versionInfo: '26.7.0', licenseConcluded: 'Apache-2.0', externalRefs: [{ referenceType: 'purl', referenceLocator: 'pkg:generic/keycloak@26.7.0' }] },
      { name: 'runtime', versionInfo: '1.0.0', licenseDeclared: 'MIT', externalRefs: [{ referenceType: 'purl', referenceLocator: 'pkg:generic/runtime@1.0.0' }] },
    ] }
    writeFileSync(sbomPath, JSON.stringify(sbom))
    writeFileSync(textPath, 'Keycloak upstream license\n')
    writeFileSync(pathsPath, 'opt/keycloak/LICENSE.txt\nopt/keycloak/NOTICE\n')
    writeFileSync(bundlePath, 'bundled license evidence\n')
    writeFileSync(inventoryPath, JSON.stringify({ image: 'hr-axis-onprem-keycloak:proof', baseImage: 'quay.io/keycloak/keycloak:26.7.0@sha256:base', packageCount: 2, dataClass: 'synthetic' }))
    const receipt = reconcileKeycloakLicenses({ sbom: sbomPath, inventory: inventoryPath, licenseText: textPath, licensePaths: pathsPath, licenseBundle: bundlePath })
    assert.equal(receipt.packageCount, 2)
    assert.equal(receipt.components.every((component) => component.evidence.type === 'upstream-distribution-bundle'), true)
    assert.equal(receipt.residualExternalReviewRequired, true)
    assert.throws(() => reconcileKeycloakLicenses({ sbom: sbomPath, inventory: inventoryPath, licenseText: textPath, licensePaths: pathsPath, licenseBundle: join(root, 'missing.tar') }), /empty|ENOENT/)
    const unknownSbomPath = join(root, 'unknown-sbom.json')
    writeFileSync(unknownSbomPath, JSON.stringify({ packages: [{ ...sbom.packages[0], licenseConcluded: 'NOASSERTION' }] }))
    const unknownInventoryPath = join(root, 'unknown-inventory.json')
    writeFileSync(unknownInventoryPath, JSON.stringify({ image: 'hr-axis-onprem-keycloak:proof', baseImage: 'quay.io/keycloak/keycloak:26.7.0@sha256:base', packageCount: 1, dataClass: 'synthetic' }))
    assert.throws(() => reconcileKeycloakLicenses({ sbom: unknownSbomPath, inventory: unknownInventoryPath, licenseText: textPath, licensePaths: pathsPath, licenseBundle: bundlePath }), /prohibited|missing/)

    const fallbackSbomPath = join(root, 'fallback-sbom.json')
    writeFileSync(fallbackSbomPath, JSON.stringify({ packages: [{ ...sbom.packages[0], licenseConcluded: 'NOASSERTION', licenseDeclared: 'Apache-2.0' }] }))
    const fallbackInventoryPath = join(root, 'fallback-inventory.json')
    writeFileSync(fallbackInventoryPath, JSON.stringify({ image: 'hr-axis-onprem-keycloak:proof', baseImage: 'quay.io/keycloak/keycloak:26.7.0@sha256:base', packageCount: 1, dataClass: 'synthetic' }))
    const fallback = reconcileKeycloakLicenses({ sbom: fallbackSbomPath, inventory: fallbackInventoryPath, licenseText: textPath, licensePaths: pathsPath, licenseBundle: bundlePath })
    assert.equal(fallback.components[0].license, 'Apache-2.0')

    const noneSbomPath = join(root, 'none-sbom.json')
    writeFileSync(noneSbomPath, JSON.stringify({ packages: [{ ...sbom.packages[0], licenseConcluded: 'NONE', licenseDeclared: 'NONE' }] }))
    const noneInventoryPath = join(root, 'none-inventory.json')
    writeFileSync(noneInventoryPath, JSON.stringify({ image: 'hr-axis-onprem-keycloak:proof', baseImage: 'quay.io/keycloak/keycloak:26.7.0@sha256:base', packageCount: 1, dataClass: 'synthetic' }))
    assert.throws(() => reconcileKeycloakLicenses({ sbom: noneSbomPath, inventory: noneInventoryPath, licenseText: textPath, licensePaths: pathsPath, licenseBundle: bundlePath }), /missing|prohibited/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
