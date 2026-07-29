const exactValues = {
  VITE_API_BASE_URL: 'https://api-staging.hr-axis.com/api',
  VITE_AUTH_MODE: 'bearer',
  VITE_AUTH_PROVIDER: 'clerk',
  VITE_BROWSER_SESSION_TRANSPORT: 'cookie',
  VITE_CLERK_JWT_TEMPLATE: 'hr-axis-api',
  VITE_SENTRY_ENABLED: 'true',
  VITE_SENTRY_ENVIRONMENT: 'staging',
}

export const blockedLocalBuildVariables = [
  'VITE_BEARER_TOKEN',
  'VITE_USER_ID',
  'VITE_ROLE_CODES',
  'VITE_COMPANY_IDS',
  'VITE_ASSIGNED_STORE_IDS',
  'VITE_READ_REGION_IDS',
  'VITE_READ_STORE_IDS',
  'VITE_REGION_IDS',
  'VITE_STORE_IDS',
]

export function validateCloudflareBuildContract(env) {
  for (const [name, expected] of Object.entries(exactValues)) {
    requireBuildValue(env, name, (value) => value === expected)
  }

  requireBuildValue(env, 'VITE_CLERK_PUBLISHABLE_KEY', (value) => /^pk_test_[A-Za-z0-9_-]{32,}$/.test(value))
  for (const name of blockedLocalBuildVariables) {
    requireBuildValue(env, name, (value) => value === '')
  }
  requireBuildValue(
    env,
    'VITE_SENTRY_DSN',
    (value) => /^https:\/\/[A-Za-z0-9]+@[A-Za-z0-9.-]+\/\d+$/.test(value),
  )
}

export function createCloudflareBuildEnvironment(env, head) {
  validateCloudflareBuildContract(env)

  return {
    ...env,
    ...Object.fromEntries(blockedLocalBuildVariables.map((name) => [name, ''])),
    VITE_SENTRY_RELEASE: head,
  }
}

function requireBuildValue(env, name, predicate) {
  const value = env[name]?.trim() ?? ''
  if (!predicate(value)) {
    throw new Error(`Cloudflare upload requires a valid ${name} build value`)
  }
}
