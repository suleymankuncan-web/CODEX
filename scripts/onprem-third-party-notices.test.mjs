import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { generateLicenseInventory, renderThirdPartyNotices } from './onprem-third-party-notices.mjs'

function packageFixture({ includeUnknown = false, blockedLicense = null, omitProductionLicenseFile = false, productionLicense = 'MIT' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'onprem-notices-'))
  const modules = join(root, 'node_modules')
  mkdirSync(join(modules, 'prod-lib'), { recursive: true })
  mkdirSync(join(modules, 'dev-lib'), { recursive: true })
  writeFileSync(join(modules, 'prod-lib', 'package.json'), JSON.stringify({ name: 'prod-lib', version: '1.0.0', licenses: [{ type: productionLicense }] }))
  if (!omitProductionLicenseFile) writeFileSync(join(modules, 'prod-lib', 'LICENSE'), 'prod license\n')
  writeFileSync(join(modules, 'dev-lib', 'package.json'), JSON.stringify({ name: 'dev-lib', version: '9.0.0', license: 'Apache-2.0' }))
  writeFileSync(join(modules, 'dev-lib', 'LICENSE'), 'dev license\n')
  const packageJson = {
    name: 'synthetic-app',
    private: true,
    dependencies: { 'prod-lib': '1.0.0' },
    optionalDependencies: { 'platform-lib': '2.0.0' },
    devDependencies: { 'dev-lib': '9.0.0' },
  }
  const lockfile = {
    name: 'synthetic-app',
    version: '1.0.0',
    lockfileVersion: 3,
    packages: {
      '': { name: 'synthetic-app', version: '1.0.0', private: true, dependencies: { 'prod-lib': '1.0.0' }, optionalDependencies: { 'platform-lib': '2.0.0' }, devDependencies: { 'dev-lib': '9.0.0' } },
      'node_modules/prod-lib': { version: '1.0.0', license: productionLicense },
      'node_modules/platform-lib': { version: '2.0.0', optional: true, license: 'MIT' },
      'node_modules/dev-lib': { version: '9.0.0', dev: true, license: 'Apache-2.0' },
    },
  }
  if (includeUnknown) {
    mkdirSync(join(modules, 'unknown-lib'), { recursive: true })
    writeFileSync(join(modules, 'unknown-lib', 'package.json'), JSON.stringify({ name: 'unknown-lib', version: '1.0.0' }))
    packageJson.dependencies['unknown-lib'] = '1.0.0'
    lockfile.packages[''].dependencies['unknown-lib'] = '1.0.0'
    lockfile.packages['node_modules/unknown-lib'] = { version: '1.0.0' }
  }
  if (blockedLicense) {
    mkdirSync(join(modules, 'blocked-lib'), { recursive: true })
    writeFileSync(join(modules, 'blocked-lib', 'package.json'), JSON.stringify({ name: 'blocked-lib', version: '1.0.0', license: blockedLicense }))
    packageJson.dependencies['blocked-lib'] = '1.0.0'
    lockfile.packages[''].dependencies['blocked-lib'] = '1.0.0'
    lockfile.packages['node_modules/blocked-lib'] = { version: '1.0.0', license: blockedLicense }
  }
  const packagePath = join(root, 'package.json')
  const lockPath = join(root, 'package-lock.json')
  writeFileSync(packagePath, JSON.stringify(packageJson))
  writeFileSync(lockPath, JSON.stringify(lockfile))
  const spdxLicenseDirectory = join(root, 'spdx-licenses')
  mkdirSync(spdxLicenseDirectory, { recursive: true })
  writeFileSync(join(spdxLicenseDirectory, 'MIT.json'), JSON.stringify({ name: 'MIT License', licenseText: 'canonical MIT license text\n' }))
  writeFileSync(join(spdxLicenseDirectory, 'LGPL-3.0-or-later.json'), JSON.stringify({ name: 'GNU Lesser General Public License v3.0 or later', licenseText: 'canonical LGPL license text\n' }))
  return { root, modules, packagePath, lockPath, spdxLicenseDirectory }
}

test('license inventory and notices are deterministic and exclude dev-only roots', () => {
  const fixture = packageFixture()
  try {
    const first = generateLicenseInventory({ packageJsonPath: fixture.packagePath, lockfilePath: fixture.lockPath, nodeModulesPath: fixture.modules })
    const second = generateLicenseInventory({ packageJsonPath: fixture.packagePath, lockfilePath: fixture.lockPath, nodeModulesPath: fixture.modules })
    assert.deepEqual(first, second)
    assert.deepEqual(first.packages.map((item) => item.name), ['prod-lib'])
    const notices = renderThirdPartyNotices(first)
    assert.match(notices, /prod-lib@1\.0\.0/)
    assert.match(notices, /prod license/)
    assert.doesNotMatch(notices, /dev-lib/)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test('Linux image LGPL runtime dependency is an explicit packaging disposition', () => {
  const fixture = packageFixture({ productionLicense: 'LGPL-3.0-or-later' })
  try {
    const inventory = generateLicenseInventory({ packageJsonPath: fixture.packagePath, lockfilePath: fixture.lockPath, nodeModulesPath: fixture.modules })
    assert.equal(inventory.packages[0].license, 'LGPL-3.0-or-later')
    assert.match(renderThirdPartyNotices(inventory), /License: LGPL-3\.0-or-later/)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test('license generator fails closed when a production package identity or license is unknown', () => {
  const fixture = packageFixture({ includeUnknown: true })
  try {
    assert.throws(
      () => generateLicenseInventory({ packageJsonPath: fixture.packagePath, lockfilePath: fixture.lockPath, nodeModulesPath: fixture.modules }),
      /license|identity/i,
    )
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test('license generator fails closed on licenses that require an explicit packaging decision', () => {
  for (const blockedLicense of ['AGPL-3.0-only', 'CC-BY-NC-4.0', 'LicenseRef-No-Commercial-Use', 'Made-Up-License']) {
    const fixture = packageFixture({ blockedLicense })
    try {
      assert.throws(
        () => generateLicenseInventory({ packageJsonPath: fixture.packagePath, lockfilePath: fixture.lockPath, nodeModulesPath: fixture.modules }),
        /license policy review required/i,
      )
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  }
})

test('missing upstream license files use pinned canonical SPDX text instead of an incomplete placeholder', () => {
  const fixture = packageFixture({ omitProductionLicenseFile: true })
  try {
    const inventory = generateLicenseInventory({
      packageJsonPath: fixture.packagePath,
      lockfilePath: fixture.lockPath,
      nodeModulesPath: fixture.modules,
      spdxLicenseDirectory: fixture.spdxLicenseDirectory,
    })
    assert.equal(inventory.packages[0].canonicalLicenseTexts[0].id, 'MIT')
    const notices = renderThirdPartyNotices(inventory)
    assert.match(notices, /canonical SPDX text follows/)
    assert.match(notices, /canonical MIT license text/)
    assert.doesNotMatch(notices, /not packaged by upstream/)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})

test('missing upstream and canonical license texts fail closed', () => {
  const fixture = packageFixture({ omitProductionLicenseFile: true })
  try {
    assert.throws(
      () => generateLicenseInventory({ packageJsonPath: fixture.packagePath, lockfilePath: fixture.lockPath, nodeModulesPath: fixture.modules }),
      /complete license text is missing/i,
    )
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
})
