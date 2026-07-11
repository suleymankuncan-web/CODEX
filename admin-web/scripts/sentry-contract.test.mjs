import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const root = join(import.meta.dirname, '..')
const read = (path) => readFileSync(join(root, path), 'utf8')

test('frontend Sentry delivery is explicitly gated and privacy bounded', () => {
  const source = read('src/lib/sentry.ts')
  const main = read('src/main.tsx')
  const envExample = read('.env.example')

  for (const expected of [
    'VITE_SENTRY_DSN',
    'VITE_SENTRY_ENABLED',
    'sendDefaultPii: false',
    'defaultIntegrations: []',
    'tracesSampleRate: 0',
    'profilesSampleRate: 0',
    "delete safe.request",
    "delete safe.user",
    "delete safe.breadcrumbs",
    "delete safe.extra",
  ]) {
    assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  for (const expected of [
    'initializeFrontendSentry',
    'onCaughtError',
    'onUncaughtError',
    'onRecoverableError',
  ]) {
    assert.match(main, new RegExp(expected))
  }

  assert.match(envExample, /^VITE_SENTRY_ENABLED=false$/m)
})
