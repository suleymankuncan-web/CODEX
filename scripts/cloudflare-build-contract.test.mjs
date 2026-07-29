import assert from 'node:assert/strict'
import test from 'node:test'

import {
  blockedLocalBuildVariables,
  createCloudflareBuildEnvironment,
  validateCloudflareBuildContract,
} from '../admin-web/scripts/cloudflare-build-contract.mjs'

const validContract = {
  VITE_API_BASE_URL: 'https://api-staging.hr-axis.com/api',
  VITE_AUTH_MODE: 'bearer',
  VITE_AUTH_PROVIDER: 'clerk',
  VITE_BROWSER_SESSION_TRANSPORT: 'cookie',
  VITE_CLERK_PUBLISHABLE_KEY: `pk_test_${'a'.repeat(40)}`,
  VITE_CLERK_JWT_TEMPLATE: 'hr-axis-api',
  VITE_SENTRY_DSN: `https://${'b'.repeat(32)}@example.ingest.de.sentry.io/123456`,
  VITE_SENTRY_ENABLED: 'true',
  VITE_SENTRY_ENVIRONMENT: 'staging',
}

test('Cloudflare staging build contract accepts the complete public staging configuration', () => {
  assert.doesNotThrow(() => validateCloudflareBuildContract(validContract))
})

for (const [name, invalidValue] of [
  ['VITE_API_BASE_URL', 'https://api.hr-axis.com/api'],
  ['VITE_AUTH_MODE', 'mock'],
  ['VITE_AUTH_PROVIDER', 'oidc'],
  ['VITE_BROWSER_SESSION_TRANSPORT', 'bearer'],
  ['VITE_CLERK_PUBLISHABLE_KEY', `pk_live_${'a'.repeat(40)}`],
  ['VITE_CLERK_JWT_TEMPLATE', 'default'],
  ['VITE_SENTRY_DSN', 'https://invalid.example'],
  ['VITE_SENTRY_ENABLED', 'false'],
  ['VITE_SENTRY_ENVIRONMENT', 'production'],
]) {
  test(`Cloudflare staging build contract rejects invalid ${name}`, () => {
    assert.throws(
      () => validateCloudflareBuildContract({ ...validContract, [name]: invalidValue }),
      new RegExp(`valid ${name} build value`),
    )
  })
}

for (const name of Object.keys(validContract)) {
  test(`Cloudflare staging build contract rejects missing ${name}`, () => {
    const incomplete = { ...validContract }
    delete incomplete[name]
    assert.throws(
      () => validateCloudflareBuildContract(incomplete),
      new RegExp(`valid ${name} build value`),
    )
  })
}

for (const name of blockedLocalBuildVariables) {
  test(`Cloudflare staging build contract rejects non-empty local-only ${name}`, () => {
    assert.throws(
      () => validateCloudflareBuildContract({ ...validContract, [name]: 'must-not-ship' }),
      new RegExp(`valid ${name} build value`),
    )
  })
}

test('Cloudflare child build environment explicitly clears all local-only variables', () => {
  const environment = createCloudflareBuildEnvironment(validContract, 'commit-sha')

  for (const name of blockedLocalBuildVariables) {
    assert.equal(environment[name], '')
  }
  assert.equal(environment.VITE_SENTRY_RELEASE, 'commit-sha')
})

test('Cloudflare child build environment overrides inherited local-only variables', () => {
  const inherited = Object.fromEntries(blockedLocalBuildVariables.map((name) => [name, '']))
  const environment = createCloudflareBuildEnvironment({ ...validContract, ...inherited }, 'commit-sha')

  for (const name of blockedLocalBuildVariables) {
    assert.equal(environment[name], '')
  }
})

test('Cloudflare staging build contract does not include rejected values in errors', () => {
  const rejectedValue = `pk_live_${'sensitive'.repeat(8)}`
  assert.throws(
    () => validateCloudflareBuildContract({ ...validContract, VITE_CLERK_PUBLISHABLE_KEY: rejectedValue }),
    (error) => !error.message.includes(rejectedValue),
  )
})
