import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const appRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(appRoot, path), 'utf8')
}

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

test('unit-test seed runs only the dedicated pure-logic files before script contracts', () => {
  const packageJson = readText('package.json')
  const viteConfig = readText('vite.config.ts')

  requireText(packageJson, '"test:unit": "vitest run"')
  requireText(packageJson, '"test:scripts": "npm run test:unit && node --test scripts/*.test.mjs"')
  requireText(viteConfig, "import { defineConfig } from 'vitest/config'")
  requireText(viteConfig, "environment: 'node'")
  requireText(viteConfig, "include: ['src/**/*.unit.test.ts']")

  for (const path of [
    'src/pages/store-my-performance-model.unit.test.ts',
    'src/pages/store-incentives-region-manager-model.unit.test.ts',
  ]) {
    assert.ok(existsSync(join(appRoot, path)), `Missing unit-test seed: ${path}`)
  }
})
