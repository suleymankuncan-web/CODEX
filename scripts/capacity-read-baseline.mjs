import { pathToFileURL } from 'node:url'
import {
  DEFAULT_API_BASE_URL,
  DEFAULT_ENVIRONMENT,
  DEFAULT_LEVELS,
  DEFAULT_MAX_LEVEL,
  DEFAULT_TARGET_REGISTERED_USERS,
  DEFAULT_TIMEOUT_MS,
  EXCLUDED_MUTATION_ROUTES,
  PROFILE_DEFINITIONS,
} from './capacity-read-baseline-profiles.mjs'
import {
  buildProfilePlans,
  formatPercent,
  measureConcurrencyLevel,
  sanitizeProfilePlan,
} from './capacity-read-baseline-runner.mjs'

export function readCapacityReadBaselineConfig(env = process.env) {
  const apiBaseUrl = normalizeBackendApiBaseUrl(
    readEnv(env, 'CAPACITY_API_BASE_URL') ||
      readEnv(env, 'BACKEND_LOAD_API_BASE_URL') ||
      readEnv(env, 'PROTECTED_PERF_API_BASE_URL') ||
      DEFAULT_API_BASE_URL,
    'CAPACITY_API_BASE_URL',
  )
  const levels = parseLevels(readEnv(env, 'CAPACITY_LEVELS'), DEFAULT_LEVELS)
  const maxLevel = readPositiveInteger(env.CAPACITY_MAX_LEVEL, DEFAULT_MAX_LEVEL)

  if (!readBoolean(env.CAPACITY_ALLOW_HIGH_CONCURRENCY) && Math.max(...levels) > maxLevel) {
    throw new Error(
      `CAPACITY_LEVELS includes ${Math.max(...levels)}, above CAPACITY_MAX_LEVEL=${maxLevel}. ` +
        'Set CAPACITY_ALLOW_HIGH_CONCURRENCY=true only for an approved load window.',
    )
  }

  return {
    environment:
      readEnv(env, 'CAPACITY_ENVIRONMENT') ||
      readEnv(env, 'BACKEND_LOAD_ENVIRONMENT') ||
      DEFAULT_ENVIRONMENT,
    apiBaseUrl,
    targetRegisteredUsers: readPositiveInteger(
      env.CAPACITY_TARGET_REGISTERED_USERS,
      DEFAULT_TARGET_REGISTERED_USERS,
    ),
    levels,
    timeoutMs: readPositiveInteger(env.CAPACITY_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    profiles: parseProfiles(readEnv(env, 'CAPACITY_PROFILES') || 'public'),
    allowSharedToken: readBoolean(env.CAPACITY_ALLOW_SHARED_TOKEN),
    allowBlocked: readBoolean(env.CAPACITY_ALLOW_BLOCKED),
    stopOnFailure: env.CAPACITY_STOP_ON_FAILURE !== 'false',
    output: readEnv(env, 'CAPACITY_OUTPUT') || 'both',
  }
}

export async function runCapacityReadBaseline(input = {}) {
  const config = input.config ?? readCapacityReadBaselineConfig(input.env ?? process.env)
  const env = input.env ?? process.env
  const fetchFn = input.fetchFn ?? globalThis.fetch
  const now = input.now ?? (() => new Date().toISOString())

  if (typeof fetchFn !== 'function') {
    throw new Error('A fetch implementation is required for capacity read baseline')
  }

  const profilePlans = buildProfilePlans(config, env, getProfileDefinition)
  const runnableProfiles = profilePlans.filter((profile) => profile.status === 'ready')
  const blockedProfiles = profilePlans.filter((profile) => profile.status === 'blocked')
  const measurements = []

  for (const concurrency of config.levels) {
    if (runnableProfiles.length === 0) break

    const level = await measureConcurrencyLevel({
      concurrency,
      profiles: runnableProfiles,
      config,
      fetchFn,
    })
    measurements.push(level)

    if (config.stopOnFailure && level.status === 'failed') break
  }

  const failedLevels = measurements.filter((level) => level.status === 'failed').length
  const status = failedLevels > 0 ? 'failed' : blockedProfiles.length > 0 ? 'blocked' : 'ok'

  return {
    status,
    evidenceDate: now(),
    environment: config.environment,
    apiBaseUrl: config.apiBaseUrl,
    targetRegisteredUsers: config.targetRegisteredUsers,
    levels: config.levels,
    timeoutMs: config.timeoutMs,
    requestedProfiles: config.profiles,
    allowSharedToken: config.allowSharedToken,
    stopOnFailure: config.stopOnFailure,
    summary: {
      requestedProfiles: profilePlans.length,
      runnableProfiles: runnableProfiles.length,
      blockedProfiles: blockedProfiles.length,
      measuredLevels: measurements.length,
      failedLevels,
      maxMeasuredConcurrency: measurements.at(-1)?.concurrency ?? 0,
    },
    profilePlans: profilePlans.map(sanitizeProfilePlan),
    measurements,
    excludedMutationRoutes: EXCLUDED_MUTATION_ROUTES,
    safety: [
      'Only GET/read endpoints are executed; checklist, import, snapshot, and approval mutations are excluded.',
      'Raw bearer tokens, cookies, passwords, OTP codes, authorization codes, and private keys are not printed.',
      'Missing role tokens are recorded as blocked, not passed.',
      'A concurrency level fails on any 429, 5xx, request timeout/error, non-JSON API response, or budget breach.',
    ],
  }
}

export function formatCapacityReadBaselineSummary(evidence) {
  const lines = [
    `Capacity read baseline: ${evidence.status}`,
    `Environment: ${evidence.environment}`,
    `API: ${evidence.apiBaseUrl}`,
    `Target registered users: ${evidence.targetRegisteredUsers}`,
    `Requested profiles: ${evidence.requestedProfiles.join(', ')}`,
  ]

  for (const profile of evidence.profilePlans) {
    if (profile.status === 'blocked') {
      lines.push(`- ${profile.name}: blocked (${profile.reason})`)
    }
  }

  for (const level of evidence.measurements) {
    const virtualUserNote =
      level.virtualUsers && level.virtualUsers !== level.concurrency
        ? `, virtual users ${level.virtualUsers}`
        : ''
    lines.push(
      `- concurrency ${level.concurrency}${virtualUserNote}: ${level.status}, samples ${level.samples}, availability ${formatPercent(
        level.availability,
      )}, p50 ${level.p50Ms}ms, p95 ${level.p95Ms}ms, 429 ${level.rateLimitedCount}, 5xx ${level.fiveXxCount}`,
    )
  }

  if (evidence.excludedMutationRoutes.length > 0) {
    lines.push(
      `Excluded mutations: ${evidence.excludedMutationRoutes
        .map((route) => `${route.method} ${route.path}`)
        .join(', ')}`,
    )
  }

  return lines.join('\n')
}

export function parseLevels(value, fallback = DEFAULT_LEVELS) {
  const rawLevels = value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : fallback.map(String)
  const levels = rawLevels.map((item) => Number(item))

  if (levels.length === 0 || levels.some((level) => !Number.isInteger(level) || level <= 0)) {
    throw new Error('CAPACITY_LEVELS must be a comma-separated list of positive integers')
  }

  return [...new Set(levels)].sort((left, right) => left - right)
}

function parseProfiles(value) {
  const profiles = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  if (profiles.length === 0) {
    throw new Error('CAPACITY_PROFILES must include at least one profile')
  }

  for (const profile of profiles) getProfileDefinition(profile)
  return [...new Set(profiles)]
}

function getProfileDefinition(profileName) {
  const definition = PROFILE_DEFINITIONS.find((profile) => profile.name === profileName)

  if (!definition) {
    throw new Error(
      `Unsupported CAPACITY_PROFILES value "${profileName}". Use ${PROFILE_DEFINITIONS.map((profile) => profile.name).join(
        ', ',
      )}.`,
    )
  }

  return definition
}

function normalizeBackendApiBaseUrl(value, envName) {
  const parsed = parseHttpUrl(value, envName)
  const path = parsed.pathname.replace(/\/+$/, '')

  parsed.pathname = !path || path === '/' ? '/api' : path
  parsed.search = ''
  parsed.hash = ''

  return parsed.toString().replace(/\/$/, '')
}

function parseHttpUrl(value, envName) {
  let parsed

  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${envName} must be a valid HTTP(S) URL`)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${envName} must be an HTTP(S) URL`)
  }

  return parsed
}

function readEnv(env, name) {
  const value = env[name]
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function readPositiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function readBoolean(value) {
  return value === 'true'
}

function isMainModule() {
  return import.meta.url === pathToFileURL(process.argv[1]).href
}

if (isMainModule()) {
  try {
    const config = readCapacityReadBaselineConfig()
    const evidence = await runCapacityReadBaseline({ config })
    const output = config.output.toLowerCase()

    if (output === 'text' || output === 'both') {
      console.log(formatCapacityReadBaselineSummary(evidence))
    }

    if (output === 'json' || output === 'both') {
      console.log(JSON.stringify(evidence, null, 2))
    }

    if (evidence.status === 'failed') {
      process.exitCode = 1
    } else if (evidence.status === 'blocked' && !config.allowBlocked) {
      process.exitCode = 2
    }
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught)
    console.error(
      JSON.stringify(
        {
          status: 'failed',
          evidenceDate: new Date().toISOString(),
          reason: message,
        },
        null,
        2,
      ),
    )
    process.exitCode = 1
  }
}
