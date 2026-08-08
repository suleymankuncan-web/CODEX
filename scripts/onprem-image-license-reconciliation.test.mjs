import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { reconcileImageLicenses, renderImageLicenseNotices } from './onprem-image-license-reconciliation.mjs'

const DIGEST = 'synthetic@sha256:' + 'a'.repeat(64)

function purlRef(value) {
  return [{ referenceType: 'purl', referenceLocator: value }]
}

function fixture({ customBase = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'onprem-image-license-'))
  const spdx = join(root, 'spdx')
  const evidence = join(root, 'evidence')
  mkdirSync(spdx)
  mkdirSync(evidence)
  for (const id of ['MIT', 'Apache-2.0']) writeFileSync(join(spdx, `${id}.json`), JSON.stringify({ name: `${id} License`, licenseText: `${id} canonical text` }))
  writeFileSync(join(spdx, 'GPL-3.0-or-later.json'), JSON.stringify({ name: 'GPL v3 or later', licenseText: 'GPL canonical text' }))
  writeFileSync(join(spdx, 'GPL-3.0-with-GCC-exception.json'), JSON.stringify({ name: 'GPL with GCC exception', licenseText: 'insert GPL v3 text here\nGCC exception canonical text' }))
  writeFileSync(join(evidence, 'runtime-lib.txt'), 'custom runtime notice')
  const evidenceSha256 = createHash('sha256').update('custom runtime notice').digest('hex')
  const npmInventory = {
    schemaVersion: 1,
    packages: [{ name: 'prod-lib', version: '1.0.0', license: 'MIT', licenseFiles: [{ name: 'LICENSE', text: 'prod license' }], canonicalLicenseTexts: [] }],
  }
  const packages = [
    { SPDXID: 'SPDXRef-first', name: 'hr-axis-onprem-backend', versionInfo: 'synthetic', licenseDeclared: 'NOASSERTION', externalRefs: purlRef(`pkg:oci/hr-axis-onprem-backend@sha256%3A${'b'.repeat(64)}?arch=amd64`) },
    { SPDXID: 'SPDXRef-npm', name: 'prod-lib', versionInfo: '1.0.0', licenseDeclared: 'MIT', externalRefs: purlRef('pkg:npm/prod-lib@1.0.0') },
    { SPDXID: 'SPDXRef-derived', name: 'prod-lib/subpath', versionInfo: 'UNKNOWN', licenseDeclared: 'NOASSERTION', externalRefs: purlRef('pkg:npm/prod-lib/subpath') },
    { SPDXID: 'SPDXRef-base', name: 'runtime-lib', versionInfo: '2.0.0', licenseDeclared: customBase ? 'NOASSERTION' : 'Apache-2.0', externalRefs: purlRef('pkg:deb/synthetic/runtime-lib@2.0.0') },
  ]
  const overrides = customBase
    ? [{ name: 'runtime-lib', version: '2.0.0', purl: 'pkg:deb/synthetic/runtime-lib@2.0.0', declaredLicense: 'NOASSERTION', resolvedLicense: 'MIT', evidencePath: 'runtime-lib.txt', evidenceSha256 }]
    : []
  const policy = {
    schemaVersion: 1,
    allowedSpdxLicenseIds: ['MIT', 'Apache-2.0'],
    images: { backend: { baseImage: DIGEST, firstPartyPackage: 'hr-axis-onprem-backend', overrides } },
  }
  return { root, spdx, evidence, sbom: { packages }, npmInventory, policy }
}

function reconcile(item, overrides = {}) {
  return reconcileImageLicenses({ sbom: item.sbom, npmInventory: item.npmInventory, policy: item.policy, imageKind: 'backend', baseImage: DIGEST, rootfsPath: item.root, evidenceDirectory: item.evidence, ...overrides })
}

test('reconciliation deterministically accounts for first-party, npm, derived, and base packages', () => {
  const item = fixture()
  try {
    const first = reconcile(item)
    const second = reconcile(item)
    assert.deepEqual(first, second)
    assert.equal(first.packageCount, 4)
    assert.deepEqual(first.counts, {
      'base-runtime-spdx': 1,
      'first-party-image': 1,
      'npm-derived-artifact': 1,
      'npm-production-dependency': 1,
    })
    const notices = renderImageLicenseNotices({ receipt: first, npmNotices: 'complete npm notices', spdxLicenseDirectory: item.spdx, evidenceDirectory: item.evidence })
    assert.match(notices, /runtime-lib@2\.0\.0/)
    assert.match(notices, /Apache-2\.0 canonical text/)
    assert.match(notices, /not legal advice/)
  } finally {
    rmSync(item.root, { recursive: true, force: true })
  }
})

test('exact override resolves NOASSERTION only with bound evidence', () => {
  const item = fixture({ customBase: true })
  try {
    item.policy.images.backend.overrides[0].resolvedLicense = 'MIT AND LicenseRef-runtime'
    const receipt = reconcile(item)
    const base = receipt.packages.find((entry) => entry.name === 'runtime-lib')
    assert.equal(base.classification, 'base-runtime-override')
    assert.equal(base.license, 'MIT AND LicenseRef-runtime')
    assert.equal(base.evidence.type, 'embedded-file')
    assert.match(base.evidence.sha256, /^[0-9a-f]{64}$/)
    const notices = renderImageLicenseNotices({ receipt, npmNotices: 'complete npm notices', spdxLicenseDirectory: item.spdx, evidenceDirectory: item.evidence })
    assert.match(notices, /custom runtime notice/)
    assert.match(notices, new RegExp(`Evidence bytes: ${base.evidence.bytes}`))
    base.evidence.bytes += 1
    assert.throws(
      () => renderImageLicenseNotices({ receipt, npmNotices: 'complete npm notices', spdxLicenseDirectory: item.spdx, evidenceDirectory: item.evidence }),
      /byte count mismatch/i,
    )
    base.evidence.bytes -= 1
    item.policy.images.backend.overrides[0].evidencePath = 'missing'
    assert.throws(() => reconcile(item), /missing license evidence/i)
  } finally {
    rmSync(item.root, { recursive: true, force: true })
  }
})

test('URL-only base-runtime override evidence fails closed', () => {
  const item = fixture({ customBase: true })
  try {
    const override = item.policy.images.backend.overrides[0]
    delete override.evidencePath
    delete override.evidenceSha256
    override.evidenceUrl = 'https://packages.example.invalid/runtime-lib'
    assert.throws(
      () => reconcile(item),
      /evidence.*(file|sha|bytes)|exactly one license evidence source/i,
    )
  } finally {
    rmSync(item.root, { recursive: true, force: true })
  }
})

test('evidence proof rejects hash drift, traversal, and ambiguous fields', () => {
  const item = fixture({ customBase: true })
  try {
    const override = item.policy.images.backend.overrides[0]
    override.evidenceSha256 = '0'.repeat(64)
    assert.throws(() => reconcile(item), /sha256 mismatch/i)
    override.evidenceSha256 = createHash('sha256').update('custom runtime notice').digest('hex')
    override.evidencePath = '../runtime-lib.txt'
    assert.throws(() => reconcile(item), /unsafe license evidence path/i)
    override.evidencePath = 'runtime-lib.txt'
    override.extra = 'unexpected'
    assert.throws(() => reconcile(item), /unrecognized license policy override field/i)
  } finally {
    rmSync(item.root, { recursive: true, force: true })
  }
})

test('GCC exception uses the pinned catalog exception text without the legacy GPL placeholder', () => {
  const item = fixture({ customBase: true })
  try {
    item.policy.allowedSpdxLicenseIds.push('GPL-3.0-or-later', 'GCC-exception-3.1')
    item.policy.images.backend.overrides[0].resolvedLicense = 'GPL-3.0-or-later WITH GCC-exception-3.1'
    const notices = renderImageLicenseNotices({ receipt: reconcile(item), npmNotices: 'complete npm notices', spdxLicenseDirectory: item.spdx, evidenceDirectory: item.evidence })
    assert.match(notices, /GPL canonical text/)
    assert.match(notices, /GCC exception canonical text/)
    assert.doesNotMatch(notices, /insert GPL v3 text here/i)
  } finally {
    rmSync(item.root, { recursive: true, force: true })
  }
})

test('base digest, package identity, and purl drift fail closed', () => {
  const item = fixture({ customBase: true })
  try {
    assert.throws(() => reconcile(item, { baseImage: `other@sha256:${'c'.repeat(64)}` }), /base image digest mismatch/i)
    item.sbom.packages[3].versionInfo = '2.0.1'
    assert.throws(() => reconcile(item), /license review|required|unused or stale|purl mismatch/i)
    item.sbom.packages[3].versionInfo = '2.0.0'
    item.sbom.packages[3].externalRefs = purlRef('pkg:deb/synthetic/spoof@2.0.0')
    assert.throws(() => reconcile(item), /license review|required|unused or stale|purl mismatch/i)
  } finally {
    rmSync(item.root, { recursive: true, force: true })
  }
})

test('unknown, noncommercial, and unapproved LicenseRef components fail closed', () => {
  for (const license of ['NOASSERTION', 'CC-BY-NC-4.0', 'LicenseRef-Made-Up']) {
    const item = fixture()
    try {
      item.sbom.packages[3].licenseDeclared = license
      assert.throws(() => reconcile(item), /license review|required|LicenseRef/i)
    } finally {
      rmSync(item.root, { recursive: true, force: true })
    }
  }
})

test('npm subpath spoofing and incomplete npm notices fail closed', () => {
  const item = fixture()
  try {
    item.sbom.packages[2].externalRefs = purlRef('pkg:npm/other-lib/subpath')
    assert.throws(() => reconcile(item), /unmatched or spoofed npm/i)
    item.sbom.packages[2].externalRefs = purlRef('pkg:npm/prod-lib/subpath')
    const receipt = reconcile(item)
    assert.throws(() => renderImageLicenseNotices({ receipt, npmNotices: 'License text: not packaged by upstream', spdxLicenseDirectory: item.spdx }), /complete npm notices/i)
  } finally {
    rmSync(item.root, { recursive: true, force: true })
  }
})

test('first-party exemption is limited to the exact expected OCI artifact', () => {
  const item = fixture()
  try {
    item.sbom.packages[0].name = 'hr-axis-onprem-backend-copy'
    assert.throws(() => reconcile(item), /license review|required/i)
  } finally {
    rmSync(item.root, { recursive: true, force: true })
  }
})
