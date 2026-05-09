import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const apiBaseUrl = trimTrailingSlash(
  process.env.PROTECTED_PERF_API_BASE_URL ??
    process.env.PERF_BASE_URL ??
    'https://api-staging.hr-axis.com/api',
)
const iterations = readPositiveInteger(
  process.env.PROTECTED_PERF_ITERATIONS ?? process.env.PERF_ITERATIONS,
  5,
)
const enableMutations =
  process.env.PROTECTED_PERF_ENABLE_MUTATIONS === 'true' ||
  process.env.PERF_ENABLE_MUTATIONS === 'true'
const allowBlocked = process.env.PROTECTED_PERF_ALLOW_BLOCKED === 'true'
const allowSharedToken = process.env.PROTECTED_PERF_ALLOW_SHARED_TOKEN === 'true'
const requestedProfiles = readProfiles(
  process.env.PROTECTED_PERF_PROFILES ??
    (process.env.PERF_TARGET_PROFILE &&
    process.env.PERF_TARGET_PROFILE !== 'admin' &&
    process.env.PERF_TARGET_PROFILE !== 'all'
      ? process.env.PERF_TARGET_PROFILE
      : 'store-manager,store-personnel'),
)

const profileTokenEnv = {
  admin: 'PROTECTED_PERF_ADMIN_TOKEN',
  'store-manager': 'PROTECTED_PERF_STORE_MANAGER_TOKEN',
  'store-personnel': 'PROTECTED_PERF_STORE_PERSONNEL_TOKEN',
}
const commonTokenEnv = [
  'PROTECTED_PERF_TOKEN',
  'PERF_AUTH_TOKEN',
  'SMOKE_AUTH_TOKEN',
  'STORE_ME_SMOKE_TOKEN',
  'PILOT_SMOKE_BEARER_TOKEN',
  'AUTH_SMOKE_BEARER_TOKEN',
]

const results = []

for (const profile of requestedProfiles) {
  const token = resolveToken(profile)

  if (!token.value) {
    results.push({
      profile,
      status: 'blocked',
      reason: 'missing real bearer token',
      requiredEnv: tokenRequirement(profile),
    })
    continue
  }

  const childEnv = {
    ...process.env,
    NODE_OPTIONS: process.env.NODE_OPTIONS ?? '--dns-result-order=ipv4first',
    PERF_BASE_URL: apiBaseUrl,
    PERF_AUTH_TOKEN: token.value,
    PERF_ITERATIONS: String(iterations),
    PERF_TARGET_PROFILE: profile,
    PERF_ENABLE_MUTATIONS: enableMutations ? 'true' : 'false',
  }

  const run = await runBackendBaseline(childEnv)
  const sanitizedStdout = redactSecrets(run.stdout, token.value)
  const sanitizedStderr = redactSecrets(run.stderr, token.value)

  if (run.exitCode !== 0) {
    results.push({
      profile,
      status: 'failed',
      tokenSource: token.source,
      exitCode: run.exitCode,
      stderr: sanitizeOutputSample(sanitizedStderr),
      stdout: sanitizeOutputSample(sanitizedStdout),
    })
    continue
  }

  results.push({
    profile,
    status: 'passed',
    tokenSource: token.source,
    baseline: sanitizeBaseline(parseBaselineJson(sanitizedStdout)),
  })
}

const blockedCount = results.filter((item) => item.status === 'blocked').length
const failedCount = results.filter((item) => item.status === 'failed').length
const status =
  failedCount > 0 ? 'failed' : blockedCount > 0 ? 'blocked' : 'ok'
const evidence = {
  status,
  evidenceDate: new Date().toISOString(),
  apiBaseUrl,
  iterations,
  enableMutations,
  profiles: results,
  safety: [
    'Raw bearer tokens, Clerk cookies, passwords, provider subjects, full JWTs, and private user data are not recorded.',
    'Bearer tokens are accepted only through local environment variables and are redacted from child-process output.',
  ],
}

console.log(JSON.stringify(evidence, null, 2))

if (failedCount > 0) {
  process.exit(1)
}

if (blockedCount > 0 && !allowBlocked) {
  process.exit(2)
}

function resolveToken(profile) {
  const directEnv = profileTokenEnv[profile]
  const directValue = directEnv ? readEnv(directEnv) : ''

  if (directValue) {
    return { source: directEnv, value: directValue }
  }

  if (requestedProfiles.length > 1 && !allowSharedToken) {
    return { source: null, value: '' }
  }

  for (const envName of commonTokenEnv) {
    const value = readEnv(envName)
    if (value) {
      return { source: envName, value }
    }
  }

  return { source: null, value: '' }
}

function tokenRequirement(profile) {
  const directEnv = profileTokenEnv[profile]

  if (requestedProfiles.length > 1 && !allowSharedToken) {
    return [
      directEnv,
      'or set PROTECTED_PERF_ALLOW_SHARED_TOKEN=true with a shared fallback token for diagnostics',
    ].filter(Boolean)
  }

  return [directEnv, ...commonTokenEnv].filter(Boolean)
}

function runBackendBaseline(env) {
  return new Promise((resolve) => {
    const child = spawn(
      npmCommand,
      ['--silent', '--prefix', 'backend/nestjs', 'run', 'perf:baseline'],
      {
        cwd: workspaceRoot,
        env,
        windowsHide: true,
      },
    )
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('close', (exitCode) => {
      resolve({
        exitCode: exitCode ?? 1,
        stdout,
        stderr,
      })
    })
  })
}

function parseBaselineJson(stdout) {
  const trimmed = stdout.trim()
  if (!trimmed) {
    return null
  }

  try {
    return JSON.parse(trimmed)
  } catch {
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1))
    }
    throw new Error('Protected performance baseline output was not JSON')
  }
}

function sanitizeBaseline(baseline) {
  if (!baseline || typeof baseline !== 'object') {
    return null
  }

  const next = structuredClone(baseline)

  if (next.environment) {
    next.environment.authMode = 'bearer'
    next.environment.userId = null
    next.environment.roleCodes = null
  }

  return next
}

function redactSecrets(value, token) {
  if (!value) {
    return ''
  }

  return value.split(token).join('<redacted-bearer-token>')
}

function sanitizeOutputSample(value) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 800)
}

function readProfiles(value) {
  const profiles = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (profiles.length === 0) {
    throw new Error('PROTECTED_PERF_PROFILES must include at least one profile')
  }

  for (const profile of profiles) {
    if (!['admin', 'store-manager', 'store-personnel'].includes(profile)) {
      throw new Error(
        `Unsupported protected performance profile "${profile}". Use admin, store-manager, or store-personnel.`,
      )
    }
  }

  return profiles
}

function readEnv(name) {
  const value = process.env[name]
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function readPositiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function trimTrailingSlash(value) {
  return value.replace(/\/$/, '')
}
