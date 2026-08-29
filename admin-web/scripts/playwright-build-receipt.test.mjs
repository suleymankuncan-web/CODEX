import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { PLAYWRIGHT_BUILD_ENVIRONMENT, verifyPlaywrightBuildReceipt, writePlaywrightBuildReceipt } from './playwright-build-receipt.mjs'

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
    writeFileSync(join(root, 'dist', '.playwright-build-receipt.json'), '{not-json')
    assert.equal(verifyPlaywrightBuildReceipt(root).reason, 'receipt malformed')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
