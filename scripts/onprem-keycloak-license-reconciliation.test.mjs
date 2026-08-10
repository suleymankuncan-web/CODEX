import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { ANGUS_EMBEDDED_LICENSE_POLICY, reconcileKeycloakLicenses } from './onprem-keycloak-license-reconciliation.mjs'

const purl = (referenceLocator) => [{ referenceType: 'purl', referenceLocator }]
const digest = (value) => createHash('sha256').update(value).digest('hex')
const TEST_IMAGE_ID = `sha256:${'a'.repeat(64)}`
const inventoryFor = (packageCount) => ({ image: 'hr-axis-onprem-keycloak:proof', imageId: TEST_IMAGE_ID, baseImage: 'quay.io/keycloak/keycloak:26.7.0@sha256:base', packageCount, dataClass: 'synthetic' })
const fixturePolicy = (packageCount, overrides = {}) => ({
  ...ANGUS_EMBEDDED_LICENSE_POLICY,
  expectedPackageCount: packageCount,
  maxUnresolvedCount: packageCount,
  requireFirstPartyRoot: false,
  requireExactAngusPair: false,
  ...overrides,
})
const reconcileFixture = (options, overrides = {}) => {
  const packageCount = JSON.parse(readFileSync(options.sbom, 'utf8')).packages.length
  return reconcileKeycloakLicenses(options, fixturePolicy(packageCount, overrides))
}

test('Keycloak license reconciliation covers every SBOM component and bundled evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-keycloak-license-'))
  try {
    const sbomPath = join(root, 'sbom.json')
    const inventoryPath = join(root, 'inventory.json')
    const textPath = join(root, 'LICENSE.txt')
    const pathsPath = join(root, 'paths.txt')
    const bundlePath = join(root, 'evidence.tar')
    const sbom = { packages: [
      { name: 'keycloak', SPDXID: 'SPDXRef-keycloak', versionInfo: '26.7.0', sourceInfo: 'fixture:keycloak', licenseConcluded: 'Apache-2.0', externalRefs: [{ referenceType: 'purl', referenceLocator: 'pkg:generic/keycloak@26.7.0' }] },
      { name: 'runtime', SPDXID: 'SPDXRef-runtime', versionInfo: '1.0.0', sourceInfo: 'fixture:runtime', licenseDeclared: 'MIT', externalRefs: [{ referenceType: 'purl', referenceLocator: 'pkg:generic/runtime@1.0.0' }] },
    ] }
    writeFileSync(sbomPath, JSON.stringify(sbom))
    writeFileSync(textPath, 'Keycloak upstream license\n')
    writeFileSync(pathsPath, 'opt/keycloak/LICENSE.txt\nopt/keycloak/NOTICE\n')
    writeFileSync(bundlePath, 'bundled license evidence\n')
    writeFileSync(inventoryPath, JSON.stringify(inventoryFor(2)))
    const receipt = reconcileFixture({ sbom: sbomPath, inventory: inventoryPath, licenseText: textPath, licensePaths: pathsPath, licenseBundle: bundlePath })
    assert.equal(receipt.packageCount, 2)
    assert.equal(receipt.resolvedCount, 2)
    assert.equal(receipt.unresolvedCount, 0)
    assert.equal(receipt.resolvedCount + receipt.unresolvedCount, receipt.packageCount)
    assert.equal(receipt.components.every((component) => component.evidence.type === 'upstream-distribution-bundle'), true)
    assert.equal(receipt.residualExternalReviewRequired, true)
    assert.throws(() => reconcileFixture({ sbom: sbomPath, inventory: inventoryPath, licenseText: textPath, licensePaths: pathsPath, licenseBundle: join(root, 'missing.tar') }), /empty|ENOENT/)
    const unknownSbomPath = join(root, 'unknown-sbom.json')
    writeFileSync(unknownSbomPath, JSON.stringify({ packages: [{ ...sbom.packages[0], licenseConcluded: 'NOASSERTION' }] }))
    const unknownInventoryPath = join(root, 'unknown-inventory.json')
    writeFileSync(unknownInventoryPath, JSON.stringify(inventoryFor(1)))
    const unknown = reconcileFixture({ sbom: unknownSbomPath, inventory: unknownInventoryPath, licenseText: textPath, licensePaths: pathsPath, licenseBundle: bundlePath })
    assert.equal(unknown.components[0].unresolvedReason, 'missing-sbom-license-assertion')
    assert.equal(unknown.components[0].license, null)
    assert.equal(unknown.components[0].evidence, null)

    const fallbackSbomPath = join(root, 'fallback-sbom.json')
    writeFileSync(fallbackSbomPath, JSON.stringify({ packages: [{ ...sbom.packages[0], licenseConcluded: 'NOASSERTION', licenseDeclared: 'Apache-2.0' }] }))
    const fallbackInventoryPath = join(root, 'fallback-inventory.json')
    writeFileSync(fallbackInventoryPath, JSON.stringify(inventoryFor(1)))
    const fallback = reconcileFixture({ sbom: fallbackSbomPath, inventory: fallbackInventoryPath, licenseText: textPath, licensePaths: pathsPath, licenseBundle: bundlePath })
    assert.equal(fallback.components[0].license, 'Apache-2.0')

    const noneSbomPath = join(root, 'none-sbom.json')
    writeFileSync(noneSbomPath, JSON.stringify({ packages: [{ ...sbom.packages[0], licenseConcluded: 'NONE', licenseDeclared: 'NONE' }] }))
    const noneInventoryPath = join(root, 'none-inventory.json')
    writeFileSync(noneInventoryPath, JSON.stringify(inventoryFor(1)))
    const none = reconcileFixture({ sbom: noneSbomPath, inventory: noneInventoryPath, licenseText: textPath, licensePaths: pathsPath, licenseBundle: bundlePath })
    assert.equal(none.components[0].unresolvedReason, 'missing-sbom-license-assertion')

    const licenseRefSbomPath = join(root, 'license-ref-sbom.json')
    writeFileSync(licenseRefSbomPath, JSON.stringify({
      packages: [{ ...sbom.packages[0], licenseConcluded: 'LicenseRef-Made-Up', licenseDeclared: 'NOASSERTION' }],
      hasExtractedLicensingInfos: [{ licenseId: 'LicenseRef-Made-Up', extractedText: 'NOASSERTION' }],
    }))
    const unresolved = reconcileFixture({ sbom: licenseRefSbomPath, inventory: noneInventoryPath, licenseText: textPath, licensePaths: pathsPath, licenseBundle: bundlePath })
    assert.equal(unresolved.resolvedCount, 0)
    assert.equal(unresolved.unresolvedCount, 1)
    assert.equal(unresolved.components[0].spdxId, 'SPDXRef-keycloak')
    assert.equal(unresolved.components[0].sourceInfo, 'fixture:keycloak')
    assert.deepEqual(unresolved.components[0].rawLicenseAssertions, { concluded: 'LicenseRef-Made-Up', declared: 'NOASSERTION', infoFromFiles: [] })
    assert.equal(unresolved.components[0].license, null)
    assert.deepEqual(unresolved.components[0].licenseReferences, ['LicenseRef-Made-Up'])
    assert.deepEqual(unresolved.components[0].extractedLicenseInfoStatus, [{ reference: 'LicenseRef-Made-Up', licenseId: 'LicenseRef-Made-Up', status: 'no-assertion' }])
    assert.equal(unresolved.components[0].classification, 'unresolved-external-review')
    assert.equal(unresolved.components[0].unresolvedReason, 'unresolved-license-reference')
    assert.equal(unresolved.components[0].evidence, null)

    const documentRefSbomPath = join(root, 'document-ref-sbom.json')
    writeFileSync(documentRefSbomPath, JSON.stringify({ packages: [{
      ...sbom.packages[0],
      licenseConcluded: 'Apache-2.0 AND DocumentRef-upstream:LicenseRef-Custom',
      licenseDeclared: 'MIT',
    }] }))
    const documentRef = reconcileFixture({ sbom: documentRefSbomPath, inventory: noneInventoryPath, licenseText: textPath, licensePaths: pathsPath, licenseBundle: bundlePath })
    assert.equal(documentRef.components[0].classification, 'unresolved-external-review')
    assert.equal(documentRef.components[0].license, null)
    assert.deepEqual(documentRef.components[0].licenseReferences, ['Apache-2.0 AND DocumentRef-upstream:LicenseRef-Custom'])
    assert.deepEqual(documentRef.components[0].extractedLicenseInfoStatus, [{ reference: 'DocumentRef-upstream:LicenseRef-Custom', licenseId: 'LicenseRef-Custom', status: 'not-present' }])
    assert.equal(documentRef.components[0].evidence, null)

    const forbiddenRefSbomPath = join(root, 'forbidden-ref-sbom.json')
    writeFileSync(forbiddenRefSbomPath, JSON.stringify({ packages: [{ ...sbom.packages[0], licenseConcluded: 'LicenseRef-Proprietary' }] }))
    assert.throws(() => reconcileFixture({ sbom: forbiddenRefSbomPath, inventory: noneInventoryPath, licenseText: textPath, licensePaths: pathsPath, licenseBundle: bundlePath }), /prohibited/)

    assert.throws(
      () => reconcileFixture({ sbom: licenseRefSbomPath, inventory: noneInventoryPath, licenseText: textPath, licensePaths: pathsPath, licenseBundle: bundlePath }, { maxUnresolvedCount: 0 }),
      /exceeds approved maximum/,
    )

    const invalidCases = [
      ['missing purl', [{ ...sbom.packages[0], externalRefs: [] }], /exactly one purl/],
      ['multiple purls', [{ ...sbom.packages[0], externalRefs: [...purl('pkg:generic/keycloak@26.7.0'), ...purl('pkg:generic/other@1')] }], /exactly one purl/],
      ['blank source', [{ ...sbom.packages[0], sourceInfo: '' }], /sourceInfo is missing/],
      ['unknown expression', [{ ...sbom.packages[0], licenseConcluded: 'Made-Up-License' }], /unknown SPDX license/],
      ['secondary unknown expression', [{ ...sbom.packages[0], licenseConcluded: 'Apache-2.0', licenseDeclared: 'Made-Up-License' }], /unknown SPDX license/],
      ['invalid expression', [{ ...sbom.packages[0], licenseConcluded: 'Apache-2.0 OR' }], /invalid SPDX expression/],
      ['unknown exception', [{ ...sbom.packages[0], licenseConcluded: 'MIT WITH Apache-2.0' }], /unknown SPDX exception/],
      ['duplicate SPDX identity', [sbom.packages[0], { ...sbom.packages[1], SPDXID: sbom.packages[0].SPDXID }], /duplicate Keycloak SBOM SPDX identity/],
    ]
    for (const [label, packages, expected] of invalidCases) {
      const invalidSbomPath = join(root, `${label.replaceAll(' ', '-')}.json`)
      const invalidInventoryPath = join(root, `${label.replaceAll(' ', '-')}-inventory.json`)
      writeFileSync(invalidSbomPath, JSON.stringify({ packages }))
      writeFileSync(invalidInventoryPath, JSON.stringify(inventoryFor(packages.length)))
      assert.throws(() => reconcileFixture({ sbom: invalidSbomPath, inventory: invalidInventoryPath, licenseText: textPath, licensePaths: pathsPath, licenseBundle: bundlePath }), expected, label)
    }
    assert.throws(
      () => reconcileFixture({ sbom: sbomPath, inventory: inventoryPath, licenseText: textPath, licensePaths: pathsPath, licenseBundle: bundlePath }, { requireExactAngusPair: true }),
      /exact angus-core and angus-mail evidence pair is required/i,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('Keycloak license reconciliation binds the exact Angus virtual component to embedded JAR evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-keycloak-angus-license-'))
  try {
    const sourceJar = join(root, 'angus-mail.jar')
    const license = join(root, 'LICENSE.md')
    const notice = join(root, 'NOTICE.md')
    const licenseBytes = '# Eclipse Public License - v 2.0\nfixture\n'
    const noticeBytes = '# Notices\nSPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0\n'
    const jarBytes = 'synthetic exact jar fixture'
    writeFileSync(sourceJar, jarBytes)
    writeFileSync(license, licenseBytes)
    writeFileSync(notice, noticeBytes)

    const policy = {
      ...ANGUS_EMBEDDED_LICENSE_POLICY,
      expectedPackageCount: 2,
      maxUnresolvedCount: 0,
      requireFirstPartyRoot: false,
      sourceJarSha256: digest(jarBytes),
      licenseSha256: digest(licenseBytes),
      noticeSha256: digest(noticeBytes),
    }
    const core = {
      name: policy.core.name,
      SPDXID: 'SPDXRef-angus-core',
      versionInfo: policy.core.version,
      sourceInfo: policy.sourceInfo,
      licenseConcluded: 'NOASSERTION',
      licenseDeclared: 'NOASSERTION',
      externalRefs: purl(policy.core.purl),
    }
    const sibling = {
      name: policy.sibling.name,
      SPDXID: 'SPDXRef-angus-mail',
      versionInfo: policy.sibling.version,
      sourceInfo: policy.sourceInfo,
      licenseConcluded: 'NOASSERTION',
      licenseDeclared: 'LicenseRef-http---www.eclipse.org-legal-epl-2.0--https---www.gnu.org-software-classpath-license.html',
      externalRefs: purl(policy.sibling.purl),
    }
    const sbomPath = join(root, 'sbom.json')
    const inventoryPath = join(root, 'inventory.json')
    const textPath = join(root, 'keycloak-LICENSE.txt')
    const pathsPath = join(root, 'paths.txt')
    const bundlePath = join(root, 'evidence.tar')
    writeFileSync(sbomPath, JSON.stringify({ packages: [core, sibling] }))
    writeFileSync(inventoryPath, JSON.stringify(inventoryFor(2)))
    writeFileSync(textPath, 'Keycloak upstream license\n')
    writeFileSync(pathsPath, 'opt/keycloak/LICENSE.txt\n')
    writeFileSync(bundlePath, 'deterministic evidence bundle\n')
    const options = { sbom: sbomPath, inventory: inventoryPath, licenseText: textPath, licensePaths: pathsPath, licenseBundle: bundlePath, angusSourceJar: sourceJar, angusLicense: license, angusNotice: notice }

    const receipt = reconcileKeycloakLicenses(options, policy)
    assert.equal(receipt.components.length, 2)
    assert.equal(receipt.resolvedCount, 2)
    assert.equal(receipt.unresolvedCount, 0)
    assert.equal(receipt.resolvedCount + receipt.unresolvedCount, receipt.packageCount)
    for (const component of receipt.components) {
      assert.equal(component.license, policy.resolvedLicense)
      assert.equal(component.classification, 'resolved-embedded-jar')
      assert.equal(component.evidence.type, 'embedded-jar-license')
      assert.equal(component.evidence.sourcePurl, policy.sibling.purl)
      assert.deepEqual(component.evidence.sourceJar, { path: policy.sourceJarPath, sha256: policy.sourceJarSha256 })
      assert.deepEqual(component.evidence.entries, [
        { path: policy.licenseEntry, sha256: policy.licenseSha256 },
        { path: policy.noticeEntry, sha256: policy.noticeSha256 },
      ])
    }
    const prohibitedAngus = structuredClone([core, sibling])
    prohibitedAngus[0].licenseDeclared = 'LicenseRef-Proprietary'
    writeFileSync(sbomPath, JSON.stringify({ packages: prohibitedAngus }))
    assert.throws(() => reconcileKeycloakLicenses(options, policy), /prohibited for angus-core/i)
    writeFileSync(sbomPath, JSON.stringify({ packages: [core, sibling] }))

    const mutations = [
      ['core name', (packages) => { packages[0].name = 'angus-core-neighbor' }],
      ['core version', (packages) => { packages[0].versionInfo = '2.0.4' }],
      ['core purl', (packages) => { packages[0].externalRefs = purl('pkg:maven/org.eclipse.angus/angus-core@2.0.4') }],
      ['core source', (packages) => { packages[0].sourceInfo = `${policy.sourceInfo}.bak` }],
      ['missing sibling', (packages) => { packages.pop() }],
      ['duplicate sibling', (packages) => { packages.push(structuredClone(packages[1])) }],
      ['sibling name', (packages) => { packages[1].name = 'angus-mail-neighbor' }],
      ['sibling version', (packages) => { packages[1].versionInfo = '2.0.4' }],
      ['sibling purl', (packages) => { packages[1].externalRefs = purl('pkg:maven/org.eclipse.angus/angus-mail@2.0.4') }],
      ['sibling source', (packages) => { packages[1].sourceInfo = `${policy.sourceInfo}.bak` }],
    ]
    for (const [label, mutate] of mutations) {
      const packages = structuredClone([core, sibling])
      mutate(packages)
      writeFileSync(sbomPath, JSON.stringify({ packages }))
      writeFileSync(inventoryPath, JSON.stringify(inventoryFor(packages.length)))
      assert.throws(() => reconcileKeycloakLicenses(options, { ...policy, expectedPackageCount: packages.length }), /exact angus-(?:core|mail)/i, label)
    }

    writeFileSync(sbomPath, JSON.stringify({ packages: [core, sibling] }))
    writeFileSync(inventoryPath, JSON.stringify(inventoryFor(2)))
    for (const [label, path, original] of [
      ['jar', sourceJar, jarBytes],
      ['license', license, licenseBytes],
      ['notice', notice, noticeBytes],
    ]) {
      writeFileSync(path, `${original}tampered`)
      assert.throws(() => reconcileKeycloakLicenses(options, policy), /sha256 mismatch/i, label)
      writeFileSync(path, original)
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('Keycloak license reconciliation binds the sole blank-source package to the immutable first-party image root', () => {
  const root = mkdtempSync(join(tmpdir(), 'onprem-keycloak-root-license-'))
  try {
    const imageDigest = 'b'.repeat(64)
    const sbomPath = join(root, 'sbom.json')
    const inventoryPath = join(root, 'inventory.json')
    const textPath = join(root, 'LICENSE.txt')
    const pathsPath = join(root, 'paths.txt')
    const bundlePath = join(root, 'evidence.tar')
    writeFileSync(sbomPath, JSON.stringify({ packages: [{
      name: 'hr-axis-onprem-keycloak',
      SPDXID: 'SPDXRef-DocumentRoot-Image-hr-axis-onprem-keycloak',
      versionInfo: 'proof',
      sourceInfo: '',
      checksums: [{ algorithm: 'SHA256', checksumValue: imageDigest }],
      licenseConcluded: 'NOASSERTION',
      licenseDeclared: 'NOASSERTION',
      externalRefs: purl(`pkg:oci/hr-axis-onprem-keycloak@sha256%3A${imageDigest}?arch=amd64&tag=proof`),
    }] }))
    writeFileSync(inventoryPath, JSON.stringify({ ...inventoryFor(1), imageId: `sha256:${imageDigest}` }))
    writeFileSync(textPath, 'Keycloak upstream license\n')
    writeFileSync(pathsPath, 'opt/keycloak/LICENSE.txt\n')
    writeFileSync(bundlePath, 'evidence\n')
    const options = { sbom: sbomPath, inventory: inventoryPath, licenseText: textPath, licensePaths: pathsPath, licenseBundle: bundlePath }
    const policy = fixturePolicy(1, { requireFirstPartyRoot: true, maxUnresolvedCount: 1 })
    const receipt = reconcileKeycloakLicenses(options, policy)
    assert.equal(receipt.packageCount, 1)
    assert.equal(receipt.unresolvedCount, 1)
    assert.equal(receipt.components[0].sourceClassification, 'first-party-image-root')
    assert.equal(receipt.components[0].sourceIdentity, `sha256:${imageDigest}`)
    assert.equal(receipt.components[0].sourceInfo, '')
    assert.equal(receipt.components[0].license, null)
    assert.equal(receipt.components[0].evidence, null)

    writeFileSync(inventoryPath, JSON.stringify({ ...inventoryFor(1), imageId: `sha256:${'c'.repeat(64)}` }))
    assert.throws(() => reconcileKeycloakLicenses(options, policy), /immutable first-party image root/)
    writeFileSync(inventoryPath, JSON.stringify({ ...inventoryFor(1), imageId: `sha256:${imageDigest}` }))
    assert.throws(() => reconcileKeycloakLicenses(options, { ...policy, maxUnresolvedCount: 0 }), /exceeds approved maximum/)
    assert.throws(() => reconcileKeycloakLicenses(options, { ...policy, expectedPackageCount: 2 }), /pinned SBOM package count mismatch/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
