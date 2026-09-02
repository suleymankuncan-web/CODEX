import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { PLAYWRIGHT_BUILD_ENVIRONMENT, verifyPlaywrightBuildReceipt, writePlaywrightBuildReceipt } from './playwright-build-receipt.mjs'
import {
  PLAYWRIGHT_BUILD_PROFILE,
  createPlaywrightManualChunks,
  resolveModulePreload,
} from './playwright-build-profile.mjs'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'hr-axis-playwright-build-'))
  mkdirSync(join(root, 'src'), { recursive: true })
  mkdirSync(join(root, 'dist', 'assets'), { recursive: true })
  writeFileSync(join(root, 'src', 'main.tsx'), 'export const value = 1\n')
  writeFileSync(join(root, 'index.html'), '<div id="root"></div>\n')
  writeFileSync(join(root, 'package.json'), '{}\n')
  writeFileSync(join(root, 'package-lock.json'), '{}\n')
  writeFileSync(join(root, 'tsconfig.json'), '{}\n')
  writeFileSync(join(root, 'vite.config.ts'), 'export default {}\n')
  writeFileSync(join(root, 'dist', 'index.html'), '<script src="/assets/app.js"></script>\n')
  writeFileSync(join(root, 'dist', 'assets', 'app.js'), 'console.log("built")\n')
  return root
}

test('exact Playwright build receipt is reusable', () => {
  const root = fixture()
  try {
    writePlaywrightBuildReceipt(root)
    assert.deepEqual(verifyPlaywrightBuildReceipt(root), { valid: true, reason: 'exact build receipt matched' })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('source, dist, environment, missing, and malformed receipt drift fail closed', () => {
  for (const mutate of [
    (root) => writeFileSync(join(root, 'src', 'main.tsx'), 'export const value = 2\n'),
    (root) => writeFileSync(join(root, 'dist', 'assets', 'app.js'), 'console.log("mutated")\n'),
  ]) {
    const root = fixture()
    try {
      writePlaywrightBuildReceipt(root)
      mutate(root)
      assert.equal(verifyPlaywrightBuildReceipt(root).valid, false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }

  const root = fixture()
  try {
    assert.equal(verifyPlaywrightBuildReceipt(root).reason, 'receipt missing')
    writePlaywrightBuildReceipt(root)
    assert.equal(verifyPlaywrightBuildReceipt(root, { ...PLAYWRIGHT_BUILD_ENVIRONMENT, VITE_API_BASE_URL: '/changed' }).reason, 'build environment changed')
    assert.equal(
      verifyPlaywrightBuildReceipt(root, {
        ...PLAYWRIGHT_BUILD_ENVIRONMENT,
        VITE_PLAYWRIGHT_BUILD_PROFILE: 'unknown',
      }).reason,
      'build environment changed',
    )
    writeFileSync(join(root, 'dist', '.playwright-build-receipt.json'), '{not-json')
    assert.equal(verifyPlaywrightBuildReceipt(root).reason, 'receipt malformed')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('Playwright build environment pins the exact isolated build profile', () => {
  assert.equal(PLAYWRIGHT_BUILD_ENVIRONMENT.VITE_PLAYWRIGHT_BUILD_PROFILE, PLAYWRIGHT_BUILD_PROFILE)
})

test('only the exact Playwright build profile disables eager module preloads', () => {
  assert.equal(resolveModulePreload(PLAYWRIGHT_BUILD_ENVIRONMENT), false)
  for (const marker of [undefined, '', 'production', 'playwright-e2e-unknown']) {
    assert.equal(resolveModulePreload({ VITE_PLAYWRIGHT_BUILD_PROFILE: marker }), undefined)
  }
})

test('only the exact Playwright build profile enables manual chunks', () => {
  assert.equal(typeof createPlaywrightManualChunks(PLAYWRIGHT_BUILD_ENVIRONMENT), 'function')
  for (const marker of [undefined, '', 'production', 'playwright-e2e-unknown']) {
    assert.equal(createPlaywrightManualChunks({ VITE_PLAYWRIGHT_BUILD_PROFILE: marker }), undefined)
  }
})

test('manual chunks coalesce static entry dependencies but preserve dynamic roots and descendants', () => {
  const modules = {
    entry: { isEntry: true, importers: [] },
    staticRoot: { isEntry: false, importers: ['entry'] },
    staticChild: { isEntry: false, importers: ['staticRoot'] },
    dynamicRoot: { isEntry: false, importers: [], dynamicImporters: ['entry'] },
    dynamicChild: { isEntry: false, importers: ['dynamicRoot'] },
    shared: { isEntry: false, importers: ['staticRoot', 'dynamicRoot'] },
  }
  let lookups = 0
  const getModuleInfo = (moduleId) => {
    lookups += 1
    return modules[moduleId] ?? null
  }
  const manualChunks = createPlaywrightManualChunks(PLAYWRIGHT_BUILD_ENVIRONMENT)
  assert.equal(typeof manualChunks, 'function')
  const context = { getModuleInfo }

  assert.equal(manualChunks('entry', context), undefined)
  assert.equal(manualChunks('staticRoot', context), 'e2e-static')
  assert.equal(manualChunks('staticChild', context), 'e2e-static')
  assert.equal(manualChunks('dynamicRoot', context), undefined)
  assert.equal(manualChunks('dynamicChild', context), undefined)
  assert.equal(manualChunks('shared', context), 'e2e-static')

  const lookupsAfterFirstPass = lookups
  assert.equal(manualChunks('shared', context), 'e2e-static')
  assert.equal(lookups, lookupsAfterFirstPass)
})

test('manual chunks resolve cyclic importer graphs without naming entries', () => {
  const modules = {
    entry: { isEntry: true, importers: [] },
    cycleA: { isEntry: false, importers: ['entry', 'cycleB'] },
    cycleB: { isEntry: false, importers: ['cycleA'] },
    isolatedA: { isEntry: false, importers: ['isolatedB'] },
    isolatedB: { isEntry: false, importers: ['isolatedA'] },
  }
  const manualChunks = createPlaywrightManualChunks(PLAYWRIGHT_BUILD_ENVIRONMENT)
  assert.equal(typeof manualChunks, 'function')
  const context = { getModuleInfo: (moduleId) => modules[moduleId] ?? null }

  assert.equal(manualChunks('cycleB', context), 'e2e-static')
  assert.equal(manualChunks('cycleA', context), 'e2e-static')
  assert.equal(manualChunks('isolatedA', context), undefined)
  assert.equal(manualChunks('isolatedB', context), undefined)
})
