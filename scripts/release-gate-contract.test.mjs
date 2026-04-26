import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function readJson(path) {
  return JSON.parse(readText(path))
}

test('root package exposes the official release gate', () => {
  const packageJson = readJson('package.json')

  assert.equal(packageJson.private, true)
  assert.equal(
    packageJson.scripts['check:release'],
    'npm run test:scripts && node scripts/check-release.mjs',
  )
  assert.equal(packageJson.scripts['test:scripts'], 'node --test scripts/*.test.mjs')
})

test('official release gate runs backend before frontend', () => {
  const script = readText('scripts/check-release.mjs')

  const backendIndex = script.indexOf("backend/nestjs")
  const frontendIndex = script.indexOf("admin-web")

  assert.notEqual(backendIndex, -1)
  assert.notEqual(frontendIndex, -1)
  assert.ok(backendIndex < frontendIndex)
  assert.match(script, /args:\s*\['run', 'check:release'\]/)
})

test('official release gate uses cmd.exe wrapping for npm on Windows', () => {
  const script = readText('scripts/check-release.mjs')

  assert.match(script, /cmd\.exe/)
  assert.match(script, /\/d/)
  assert.match(script, /\/s/)
  assert.match(script, /\/c/)
})

test('package release scripts include production audit gates', () => {
  const backendPackage = readJson('backend/nestjs/package.json')
  const frontendPackage = readJson('admin-web/package.json')

  assert.match(backendPackage.scripts['check:release'], /npm audit --omit=dev/)
  assert.match(frontendPackage.scripts['check:release'], /npm audit --omit=dev/)
})

test('github release workflow delegates to the root release gate on Node 24', () => {
  const workflow = readText('.github/workflows/release-check.yml')

  assert.match(workflow, /node-version:\s*24/)
  assert.match(workflow, /cache-dependency-path:\s*\|\s*\n\s*backend\/nestjs\/package-lock\.json\s*\n\s*admin-web\/package-lock\.json/)
  assert.match(workflow, /working-directory:\s*backend\/nestjs\s*\n\s*run:\s*npm ci/)
  assert.match(workflow, /working-directory:\s*admin-web\s*\n\s*run:\s*npm ci/)
  assert.match(workflow, /working-directory:\s*admin-web\s*\n\s*run:\s*npx playwright install --with-deps chromium/)
  assert.match(workflow, /run:\s*npm run check:release/)
})
