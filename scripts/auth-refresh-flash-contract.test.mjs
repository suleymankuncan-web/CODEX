import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, expected) {
  assert.ok(text.includes(expected), `${expected} must be present`)
}

const app = readText('admin-web/src/App.tsx')
const shellState = readText('admin-web/src/app/shell-state.ts')
const sessionContext = readText('admin-web/src/features/session/session-context.tsx')
const sessionContextValue = readText('admin-web/src/features/session/session-context-value.ts')
const clerkSession = readText('admin-web/src/features/auth/clerk-session.tsx')

test('protected routes wait for Clerk bearer hydration instead of flashing through login', () => {
  requireText(sessionContextValue, 'isProviderSessionHydrating: boolean')
  requireText(sessionContextValue, 'setProviderSessionHydrating: (isHydrating: boolean) => void')
  requireText(sessionContext, 'isClerkSessionProviderAvailable')
  requireText(sessionContext, 'isProviderSessionHydrating')
  requireText(app, 'isProviderSessionHydrating')
  requireText(app, 'providerSessionHydrating: isProviderSessionHydrating')
  assert.match(
    shellState,
    /if \(!input\.isReady && input\.providerSessionHydrating\) \{[\s\S]*?mode: 'verifying'/,
    'shell state must prefer verifying while the external provider is hydrating a bearer token',
  )
})

test('Clerk bridge owns the provider hydration lifecycle', () => {
  requireText(clerkSession, 'setProviderSessionHydrating')
  assert.match(
    clerkSession,
    /if \(!isLoaded\) \{[\s\S]*?setProviderSessionHydrating\(true\)/,
    'Clerk must mark provider hydration as pending until Clerk has loaded',
  )
  assert.match(
    clerkSession,
    /if \(!isSignedIn\) \{[\s\S]*?setProviderSessionHydrating\(false\)/,
    'Clerk must release provider hydration when there is no signed-in Clerk user',
  )
  assert.match(
    clerkSession,
    /finally \{[\s\S]*?setProviderSessionHydrating\(false\)/,
    'Clerk must release provider hydration after token sync finishes',
  )
})

test('Clerk bridge clears stale provider session when token refresh fails', () => {
  assert.match(
    clerkSession,
    /catch \{[\s\S]*?lastTokenRef\.current = null[\s\S]*?clearProviderSession\(\)/,
    'Clerk token refresh failures must clear the provider session instead of leaving stale credentials active',
  )
})
