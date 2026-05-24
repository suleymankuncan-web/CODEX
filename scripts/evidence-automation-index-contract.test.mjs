import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requirePath(path) {
  assert.ok(existsSync(join(workspaceRoot, path)), `Missing expected path: ${path}`)
}

function requireText(text, expected) {
  assert.ok(text.includes(expected), `Missing expected text: ${expected}`)
}

const indexPath = 'docs/plans/evidence-automation-index-v1.md'
const index = readText(indexPath)
const docsReadme = readText('docs/README.md')
const runbookRegistry = readText('docs/plans/runbook-registry-v1.md')
const p3Triggers = readText('docs/plans/p3-operating-triggers-v1.md')
const currentState = readText('current-state.md')
const packageJson = readText('package.json')
const adminPackageJson = readText('admin-web/package.json')
const backendPackageJson = readText('backend/nestjs/package.json')

test('evidence automation index is discoverable from operating docs', () => {
  requirePath(indexPath)

  for (const text of [docsReadme, runbookRegistry, p3Triggers, currentState]) {
    requireText(text, indexPath)
  }
})

test('evidence automation index maps existing repository commands', () => {
  for (const command of [
    'npm.cmd run test:scripts',
    'npm.cmd run check:release',
    'npm.cmd run system-flow:generate',
    'node --test scripts/system-flow-generator-contract.test.mjs',
    'npm.cmd --prefix admin-web run lint',
    'npm.cmd --prefix admin-web run build',
    'npm.cmd --prefix admin-web run test:scripts',
    'npm.cmd --prefix admin-web run test:e2e -- <spec>',
    'npm.cmd --prefix admin-web run smoke:pilot',
    'npm.cmd --prefix backend/nestjs run openapi:generate',
    'npm.cmd --prefix admin-web run api:generate',
    'npm.cmd --prefix admin-web run api:check',
    'npm.cmd --prefix backend/nestjs run test -- <pattern> --runInBand',
    'npm.cmd --prefix backend/nestjs run check:release',
    'npm.cmd run smoke:deployed-readiness',
    'npm.cmd run smoke:backend-readiness-load',
    'npm.cmd run perf:public',
    'npm.cmd run perf:protected',
    'npm.cmd run smoke:alert-routing',
    'npm.cmd run smoke:migration:fresh-db',
    'npm.cmd run check:pilot-stabilization',
    'npm.cmd run check:supabase-boundary',
  ]) {
    requireText(index, command)
  }

  for (const scriptName of [
    '"test:scripts"',
    '"check:release"',
    '"system-flow:generate"',
    '"smoke:deployed-readiness"',
    '"smoke:backend-readiness-load"',
    '"perf:public"',
    '"perf:protected"',
    '"smoke:alert-routing"',
    '"smoke:migration:fresh-db"',
    '"check:pilot-stabilization"',
    '"check:supabase-boundary"',
  ]) {
    requireText(packageJson, scriptName)
  }

  requirePath('scripts/system-flow-generator-contract.test.mjs')

  for (const scriptName of [
    '"lint"',
    '"build"',
    '"test:scripts"',
    '"test:e2e"',
    '"smoke:pilot"',
    '"api:generate"',
    '"api:check"',
  ]) {
    requireText(adminPackageJson, scriptName)
  }

  for (const scriptName of ['"test"', '"check:release"', '"openapi:generate"']) {
    requireText(backendPackageJson, scriptName)
  }
})

test('evidence automation index blocks fake provider protected and restore proof', () => {
  for (const phrase of [
    'Do not convert local or mock checks into provider, protected-user, production, or restore proof.',
    'protected route claim needs a bearer token but none is available',
    'provider-delivery claim needs Render, Better Stack, Sentry, email, Slack',
    'restore/PITR claim needs a managed Supabase target',
    'broad-production claim needs owner acceptance',
    'raw tokens, cookies, provider subjects, database URLs, Redis URLs, or private payloads',
    'exact reason skipped checks are not promoted to pass',
  ]) {
    requireText(index, phrase)
  }
})
