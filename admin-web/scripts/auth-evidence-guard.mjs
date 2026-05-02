import { readFileSync } from 'node:fs'

const sensitiveQueryParams = new Set([
  'access_token',
  'client_secret',
  'code',
  'code_challenge',
  'code_verifier',
  'id_token',
  'id_token_hint',
  'refresh_token',
  'session_state',
  'state',
  'token',
])

const rawJwtPattern = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*\b/
const redactedValuePattern = /^<[^>]*redacted[^>]*>$/i
const sensitiveKeyPattern =
  /^(accessToken|authorizationCode|bearerToken|clientSecret|code|codeChallenge|codeVerifier|cookie|cookies|idToken|idTokenHint|privateKey|refreshToken|sessionState|sessionStorage)$/i

function getPathValue(value, path) {
  return path.reduce((current, key) => current?.[key], value)
}

function requireTruthy(evidence, failures, path, message = `${path.join('.')} is required`) {
  if (!getPathValue(evidence, path)) {
    failures.push(message)
  }
}

function requireEqual(evidence, failures, path, expected, message = `${path.join('.')} must be ${expected}`) {
  if (getPathValue(evidence, path) !== expected) {
    failures.push(message)
  }
}

function requireArray(evidence, failures, path, message = `${path.join('.')} must be a non-empty array`) {
  const value = getPathValue(evidence, path)

  if (!Array.isArray(value) || value.length === 0) {
    failures.push(message)
  }
}

function isRedacted(value) {
  return value === '' || redactedValuePattern.test(value)
}

function inspectUrl(value, path, failures) {
  let url

  try {
    url = new URL(value)
  } catch {
    return
  }

  for (const parameter of sensitiveQueryParams) {
    if (!url.searchParams.has(parameter)) {
      continue
    }

    const observedValue = url.searchParams.get(parameter) ?? ''
    if (!isRedacted(observedValue)) {
      failures.push(`${path.join('.')} has unredacted sensitive URL parameter ${parameter}`)
    }
  }
}

function walkEvidence(value, path, failures) {
  if (typeof value === 'string') {
    if (rawJwtPattern.test(value)) {
      failures.push(`${path.join('.')} contains raw compact JWT material`)
    }

    const key = path[path.length - 1] ?? ''
    if (sensitiveKeyPattern.test(key) && !isRedacted(value)) {
      failures.push(`${path.join('.')} contains unredacted secret-like material`)
    }

    inspectUrl(value, path, failures)
    return
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => walkEvidence(item, [...path, String(index)], failures))
    return
  }

  if (value && typeof value === 'object') {
    for (const [key, nestedValue] of Object.entries(value)) {
      walkEvidence(nestedValue, [...path, key], failures)
    }
  }
}

function validateEvidenceShape(evidence, failures) {
  requireTruthy(evidence, failures, ['evidenceStatus'])
  requireTruthy(evidence, failures, ['environment'])
  requireTruthy(evidence, failures, ['evidenceDate'])
  requireTruthy(evidence, failures, ['frontendOrigin'])
  requireTruthy(evidence, failures, ['apiBaseUrl'])

  requireTruthy(evidence, failures, ['provider', 'issuer'])
  requireTruthy(evidence, failures, ['provider', 'jwksUrl'])
  requireEqual(evidence, failures, ['provider', 'pkceMethod'], 'S256')
  requireEqual(evidence, failures, ['provider', 'refreshTokenRequested'], false)

  requireEqual(evidence, failures, ['bootstrap', 'authMode'], 'jwt')
  requireEqual(evidence, failures, ['bootstrap', 'provider', 'configured'], true)
  requireEqual(evidence, failures, ['bootstrap', 'provider', 'responseType'], 'code')
  requireTruthy(evidence, failures, ['bootstrap', 'provider', 'tokenUrl'])

  requireEqual(evidence, failures, ['loginRedirect', 'responseType'], 'code')
  requireEqual(evidence, failures, ['loginRedirect', 'codeChallengePresent'], true)
  requireEqual(evidence, failures, ['loginRedirect', 'codeChallengeMethod'], 'S256')
  requireEqual(evidence, failures, ['loginRedirect', 'statePresent'], true)

  requireTruthy(evidence, failures, ['accessTokenPayload', 'sub'])
  requireTruthy(evidence, failures, ['accessTokenPayload', 'aud'])
  requireArray(evidence, failures, ['accessTokenPayload', 'roles'])

  requireEqual(evidence, failures, ['session', 'authenticated'], true)
  requireArray(evidence, failures, ['session', 'user', 'roleCodes'])
  requireArray(evidence, failures, ['session', 'user', 'readScope', 'companyIds'])
  requireArray(evidence, failures, ['session', 'user', 'actionScope', 'assignedStoreIds'])

  requireEqual(evidence, failures, ['logout', 'returnedToLogin'], true)
  requireEqual(evidence, failures, ['logout', 'bearerTokenStoredAfterLogout'], false)
  requireEqual(evidence, failures, ['logout', 'providerIdTokenStoredAfterLogout'], false)

  requireEqual(evidence, failures, ['expiredToken', 'expiredJwtCleared'], true)
  requireEqual(evidence, failures, ['expiredToken', 'idTokenCleared'], true)
  requireEqual(evidence, failures, ['expiredToken', 'authorizationHeaderSent'], false)
  requireEqual(evidence, failures, ['expiredToken', 'browserRefreshTokenUsed'], false)
}

function validateActionEvidence(evidence, failures) {
  if (!String(evidence.evidenceStatus ?? '').includes('action')) {
    return
  }

  requireTruthy(evidence, failures, ['actionSmoke'])
  requireEqual(evidence, failures, ['actionSmoke', 'assignedStore', 'status'], 201)
  requireTruthy(evidence, failures, ['actionSmoke', 'assignedStore', 'storeId'])
  requireEqual(
    evidence,
    failures,
    ['actionSmoke', 'unassignedStore', 'status'],
    403,
    'actionSmoke.unassignedStore.status must be 403',
  )
  requireEqual(evidence, failures, ['actionSmoke', 'unassignedStore', 'dbWriteExpected'], false)
}

function parseEvidence(raw) {
  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new Error(`auth evidence must be JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function readInput() {
  const args = process.argv.slice(2)

  if (args.includes('--stdin')) {
    return readFileSync(0, 'utf8')
  }

  const path = args.find((arg) => !arg.startsWith('--'))
  if (!path) {
    throw new Error('usage: node scripts/auth-evidence-guard.mjs --stdin OR node scripts/auth-evidence-guard.mjs <evidence.json>')
  }

  return readFileSync(path, 'utf8')
}

function main() {
  const raw = readInput()
  const evidence = parseEvidence(raw)
  const failures = []

  walkEvidence(evidence, [], failures)
  validateEvidenceShape(evidence, failures)
  validateActionEvidence(evidence, failures)

  if (failures.length > 0) {
    console.error(`Auth evidence guard failed with ${failures.length} issue(s):`)
    for (const failure of failures) {
      console.error(`- ${failure}`)
    }
    process.exit(1)
  }

  console.log('Auth evidence guard passed')
}

main()
