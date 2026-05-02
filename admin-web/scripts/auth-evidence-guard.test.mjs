import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const appRoot = dirname(scriptsDir)

function validEvidence(overrides = {}) {
  return {
    evidenceStatus: 'staging-provider-action-smoke-passed',
    environment: 'staging',
    evidenceDate: '2026-04-26T10:00:00.000Z',
    frontendOrigin: 'https://admin.stage.example.com',
    apiBaseUrl: 'https://api.stage.example.com/api',
    provider: {
      name: 'Corporate Staging IdP',
      issuer: 'https://idp.stage.example.com/realms/store-ops',
      clientId: 'store-ops-admin-web',
      jwksUrl: 'https://idp.stage.example.com/realms/store-ops/protocol/openid-connect/certs',
      authorizationUrl: 'https://idp.stage.example.com/realms/store-ops/protocol/openid-connect/auth',
      tokenUrl: 'https://idp.stage.example.com/realms/store-ops/protocol/openid-connect/token',
      logoutUrl: 'https://idp.stage.example.com/realms/store-ops/protocol/openid-connect/logout',
      acceptedAudience: 'store-ops-api',
      pkceMethod: 'S256',
      refreshTokenRequested: false,
    },
    bootstrap: {
      authMode: 'jwt',
      provider: {
        configured: true,
        responseType: 'code',
        tokenUrl: 'https://idp.stage.example.com/realms/store-ops/protocol/openid-connect/token',
        logoutUrl: 'https://idp.stage.example.com/realms/store-ops/protocol/openid-connect/logout',
      },
    },
    loginRedirect: {
      sanitizedAuthorizationUrl:
        'https://idp.stage.example.com/realms/store-ops/protocol/openid-connect/auth?client_id=store-ops-admin-web&response_type=code&code_challenge=%3Cpresent-redacted%3E&state=%3Cpresent-redacted%3E',
      responseType: 'code',
      codeChallengePresent: true,
      codeChallengeMethod: 'S256',
      statePresent: true,
      redirectUri: 'https://admin.stage.example.com/auth/callback',
      scope: 'openid profile email',
    },
    accessTokenPayload: {
      iss: 'https://idp.stage.example.com/realms/store-ops',
      sub: 'stage-user-1',
      aud: 'store-ops-api',
      exp: 1893456000,
      iat: 1893452400,
      preferred_username: 'stage.store.manager@example.com',
      email: 'stage.store.manager@example.com',
      roles: ['STORE_MANAGER'],
      read_company_ids: ['00000000-0000-0000-0000-000000000001'],
      read_region_ids: ['11111111-1111-1111-1111-111111111111'],
      read_store_ids: ['00000000-0000-0000-0000-000000000100'],
      assigned_store_ids: ['00000000-0000-0000-0000-000000000100'],
    },
    idTokenStoredForLogout: true,
    session: {
      authMode: 'jwt',
      authenticated: true,
      user: {
        userId: 'stage-user-1',
        roleCodes: ['STORE_MANAGER'],
        readScope: {
          companyIds: ['00000000-0000-0000-0000-000000000001'],
        },
        actionScope: {
          assignedStoreIds: ['00000000-0000-0000-0000-000000000100'],
        },
      },
    },
    actionSmoke: {
      operation: 'target-distribution-request-create',
      assignedStore: {
        status: 201,
        storeId: '00000000-0000-0000-0000-000000000100',
      },
      unassignedStore: {
        status: 403,
        storeId: '00000000-0000-0000-0000-000000000999',
        dbWriteExpected: false,
      },
    },
    logout: {
      sanitizedObservedLogoutUrl:
        'https://idp.stage.example.com/realms/store-ops/protocol/openid-connect/logout?id_token_hint=%3Cpresent-redacted%3E',
      returnedToLogin: true,
      bearerTokenStoredAfterLogout: false,
      providerIdTokenStoredAfterLogout: false,
    },
    expiredToken: {
      expiredJwtCleared: true,
      idTokenCleared: true,
      authSessionRequestCount: 1,
      authorizationHeaderSent: false,
      landingRoute: '/auth/login',
      browserRefreshTokenUsed: false,
    },
    limitations: ['Staging IdP and seeded staging DB-backed positive/negative action smoke passed.'],
    ...overrides,
  }
}

function runGuard(evidence) {
  return spawnSync(process.execPath, ['scripts/auth-evidence-guard.mjs', '--stdin'], {
    cwd: appRoot,
    input: JSON.stringify(evidence, null, 2),
    encoding: 'utf8',
  })
}

test('auth evidence guard accepts sanitized staging action evidence', () => {
  const result = runGuard(validEvidence())

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Auth evidence guard passed/)
})

test('auth evidence guard rejects raw compact JWT material', () => {
  const result = runGuard(
    validEvidence({
      bearerToken: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzdGFnZS11c2VyLTEifQ.signature',
    }),
  )

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /raw compact JWT/i)
})

test('auth evidence guard rejects unredacted sensitive URL parameters', () => {
  const result = runGuard(
    validEvidence({
      loginRedirect: {
        ...validEvidence().loginRedirect,
        sanitizedAuthorizationUrl:
          'https://idp.stage.example.com/realms/store-ops/protocol/openid-connect/auth?code_challenge=plain-secret&state=%3Cpresent-redacted%3E',
      },
    }),
  )

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /code_challenge/)
})

test('auth evidence guard requires negative action smoke to prove assigned-store boundaries', () => {
  const result = runGuard(
    validEvidence({
      actionSmoke: {
        ...validEvidence().actionSmoke,
        unassignedStore: {
          status: 200,
          storeId: '00000000-0000-0000-0000-000000000999',
          dbWriteExpected: true,
        },
      },
    }),
  )

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /unassignedStore.status must be 403/)
})
