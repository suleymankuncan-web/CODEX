import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const appRoot = dirname(scriptsDir)
const bridgeSource = readFileSync(
  join(appRoot, 'src', 'features', 'auth', 'clerk-session.tsx'),
  'utf8',
)
const signInFormSource = readFileSync(
  join(appRoot, 'src', 'features', 'auth', 'clerk-sign-in-form.tsx'),
  'utf8',
)
const authFlowShellSource = readFileSync(join(appRoot, 'src', 'app', 'auth-flow-shell.tsx'), 'utf8')
const authLoginPageSource = readFileSync(join(appRoot, 'src', 'pages', 'AuthLoginPage.tsx'), 'utf8')

function normalize(value) {
  return value.replace(/\s+/g, ' ')
}

test('Clerk bridge forces provider session sync when app session was expired locally', () => {
  const source = normalize(bridgeSource)

  assert.match(
    bridgeSource,
    /import\s+\{\s*isSessionReady\s*\}\s+from\s+'..\/session\/session-storage'/,
  )
  assert.match(source, /const \{[^}]*session,[^}]*startProviderSession[^}]*\} = useSession\(\)/)
  assert.match(source, /const appSessionReady = isSessionReady\(session\)/)
  assert.match(
    source,
    /token === lastTokenRef\.current && appSessionReady/,
    'same Clerk token must still resync when the local app session is no longer ready',
  )
})

test('Clerk login uses the HR Axis form without weakening the provider session bridge', () => {
  assert.doesNotMatch(bridgeSource, /\bSignIn\b/)
  assert.match(signInFormSource, /useSignIn\(\)/)
  assert.match(signInFormSource, /name="identifier"/)
  assert.match(signInFormSource, /name="password"/)
  assert.match(signInFormSource, /name="code"/)
  assert.match(signInFormSource, /signIn\.mfa\.sendEmailCode\(\)/)
  assert.match(signInFormSource, /signIn\.mfa\.verifyEmailCode/)
  assert.match(signInFormSource, /signIn\.finalize/)
  assert.doesNotMatch(signInFormSource, /signUp|sessionStorage/)
  assert.deepEqual(
    signInFormSource
      .split('\n')
      .filter((line) => line.includes('localStorage'))
      .map((line) => line.trim()),
    [
      "return window.localStorage.getItem(rememberedIdentifierKey)?.trim() ?? ''",
      'if (rememberIdentifier) window.localStorage.setItem(rememberedIdentifierKey, identifier)',
      'else window.localStorage.removeItem(rememberedIdentifierKey)',
    ],
    'browser storage is limited to the explicit remembered-identifier preference; credentials and sessions stay provider-owned',
  )
})

test('provider-to-app session handoff stays product-branded and remains recoverable', () => {
  assert.doesNotMatch(bridgeSource, /UserButton/)
  assert.doesNotMatch(bridgeSource, /authFlow\.clerkSignedIn/)
  assert.match(bridgeSource, /authFlow\.loginSubmitting/)
  assert.match(bridgeSource, /authFlow\.clerkSyncingUser/)
  assert.match(authFlowShellSource, /<AuthLoginPage shellMode=\{input\.shellState\.mode\} \/>/)
  assert.match(authLoginPageSource, /<ClerkLoginActions shellMode=\{input\.shellMode\} \/>/)
  assert.match(bridgeSource, /resolveClerkAppSessionHandoffView\(input\.shellMode\) === 'recover'/)
  assert.match(bridgeSource, /authFlow\.sessionVerificationFailed/)
  assert.match(bridgeSource, /authFlow\.restartSignIn/)
})
