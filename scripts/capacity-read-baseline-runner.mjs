import { COMMON_TOKEN_ENVS } from './capacity-read-baseline-profiles.mjs'

export function buildProfilePlans(config, env, getProfileDefinition) {
  return config.profiles.map((profileName) => {
    const definition = getProfileDefinition(profileName)
    const token = resolveToken(definition, config, env)
    const basePlan = {
      name: definition.name,
      description: definition.description,
      requiresAuth: definition.requiresAuth,
      endpoints: sanitizeEndpoints(definition.endpoints),
      budget: definition.budget,
    }

    if (definition.requiresAuth && !token) {
      return {
        ...basePlan,
        status: 'blocked',
        reason: missingTokenReason(definition, config),
        requiredEnv: tokenRequirement(definition, config),
      }
    }

    return {
      ...basePlan,
      status: 'ready',
      tokenSource: token?.source ?? null,
      tokenValue: token?.value ?? '',
    }
  })
}

export async function measureConcurrencyLevel({ concurrency, profiles, config, fetchFn }) {
  const virtualUserCount = Math.max(concurrency, profiles.length)
  const virtualUsers = Array.from({ length: virtualUserCount }, (_value, index) => ({
    index: index + 1,
    profile: profiles[index % profiles.length],
  }))
  const sampleGroups = await Promise.all(
    virtualUsers.map((virtualUser) => measureVirtualUser({ virtualUser, config, fetchFn })),
  )
  const samples = sampleGroups.flat()
  const profileSummaries = summarizeByProfile(samples, profiles)
  const durations = samples.map((sample) => sample.durationMs).sort((left, right) => left - right)
  const passedCount = samples.filter((sample) => sample.passed).length
  const fiveXxCount = samples.filter((sample) => typeof sample.status === 'number' && sample.status >= 500).length
  const rateLimitedCount = samples.filter((sample) => sample.status === 429).length
  const requestErrorCount = samples.filter((sample) => sample.status === null).length
  const failures = profileSummaries.flatMap((profile) =>
    profile.failures.map((failure) => `${profile.name}: ${failure}`),
  )

  return {
    concurrency,
    virtualUsers: virtualUserCount,
    status: failures.length > 0 ? 'failed' : 'passed',
    samples: samples.length,
    availability: samples.length > 0 ? passedCount / samples.length : 0,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    maxMs: round(durations[durations.length - 1] ?? 0, 2),
    fiveXxCount,
    rateLimitedCount,
    requestErrorCount,
    failures,
    profiles: profileSummaries,
  }
}

export function sanitizeProfilePlan(profilePlan) {
  const { tokenValue: _tokenValue, ...safePlan } = profilePlan
  return safePlan
}

export function formatPercent(value) {
  return `${round(value * 100, 2)}%`
}

async function measureVirtualUser({ virtualUser, config, fetchFn }) {
  const samples = []

  for (const endpoint of virtualUser.profile.endpoints) {
    samples.push(await measureEndpoint({ endpoint, virtualUser, config, fetchFn }))
  }

  return samples
}

async function measureEndpoint({ endpoint, virtualUser, config, fetchFn }) {
  const startedAt = performance.now()
  const url = `${config.apiBaseUrl}${ensureLeadingSlash(endpoint.path)}`

  try {
    const { response, body } = await fetchTextWithTimeout(fetchFn, url, {
      headers: buildHeaders(virtualUser.profile.tokenValue),
      timeoutMs: config.timeoutMs,
    })
    const durationMs = round(performance.now() - startedAt, 2)
    const contentType = response.headers.get('content-type') ?? ''
    const bodyLooksHtml = looksLikeHtml(body, contentType)
    const jsonOk = isJsonResponse(body, contentType)
    const passed = response.ok && jsonOk && !bodyLooksHtml

    return {
      virtualUser: virtualUser.index,
      profile: virtualUser.profile.name,
      label: endpoint.label,
      method: endpoint.method,
      path: endpoint.path,
      status: response.status,
      durationMs,
      contentType,
      bytes: Buffer.byteLength(body, 'utf8'),
      passed,
      ...(passed
        ? {}
        : {
            reason: sampleFailureReason({ response, bodyLooksHtml, jsonOk }),
            bodySample: sanitizeBodySample(body, virtualUser.profile.tokenValue),
          }),
    }
  } catch (caught) {
    return {
      virtualUser: virtualUser.index,
      profile: virtualUser.profile.name,
      label: endpoint.label,
      method: endpoint.method,
      path: endpoint.path,
      status: null,
      durationMs: round(performance.now() - startedAt, 2),
      contentType: null,
      bytes: 0,
      passed: false,
      reason: `request failed: ${errorMessage(caught)}`,
    }
  }
}

function summarizeByProfile(samples, profiles) {
  return profiles.map((profile) => {
    const profileSamples = samples.filter((sample) => sample.profile === profile.name)
    const durations = profileSamples
      .map((sample) => sample.durationMs)
      .sort((left, right) => left - right)
    const passedCount = profileSamples.filter((sample) => sample.passed).length
    const availability = profileSamples.length > 0 ? passedCount / profileSamples.length : 0
    const p50Ms = percentile(durations, 0.5)
    const p95Ms = percentile(durations, 0.95)
    const fiveXxCount = profileSamples.filter(
      (sample) => typeof sample.status === 'number' && sample.status >= 500,
    ).length
    const rateLimitedCount = profileSamples.filter((sample) => sample.status === 429).length
    const requestErrorCount = profileSamples.filter((sample) => sample.status === null).length

    return {
      name: profile.name,
      description: profile.description,
      tokenSource: profile.tokenSource,
      samples: profileSamples.length,
      availability,
      p50Ms,
      p95Ms,
      maxMs: round(durations[durations.length - 1] ?? 0, 2),
      fiveXxCount,
      rateLimitedCount,
      requestErrorCount,
      failures: evaluateBudget({
        budget: profile.budget,
        availability,
        p50Ms,
        p95Ms,
        fiveXxCount,
        rateLimitedCount,
        requestErrorCount,
        samples: profileSamples,
      }),
      endpoints: summarizeByEndpoint(profileSamples),
    }
  })
}

function summarizeByEndpoint(samples) {
  const groups = new Map()

  for (const sample of samples) {
    const key = `${sample.method} ${sample.path}`
    groups.set(key, [...(groups.get(key) ?? []), sample])
  }

  return [...groups.entries()].map(([key, group]) => {
    const durations = group.map((sample) => sample.durationMs).sort((left, right) => left - right)
    const passedCount = group.filter((sample) => sample.passed).length
    const fiveXxCount = group.filter(
      (sample) => typeof sample.status === 'number' && sample.status >= 500,
    ).length
    const [method, ...rest] = key.split(' ')

    return {
      label: group[0]?.label ?? key,
      method,
      path: rest.join(' '),
      samples: group.length,
      availability: group.length > 0 ? passedCount / group.length : 0,
      statuses: [...new Set(group.map((sample) => sample.status ?? 'request-error'))],
      p50Ms: percentile(durations, 0.5),
      p95Ms: percentile(durations, 0.95),
      maxMs: round(durations[durations.length - 1] ?? 0, 2),
      fiveXxCount,
      rateLimitedCount: group.filter((sample) => sample.status === 429).length,
      requestErrorCount: group.filter((sample) => sample.status === null).length,
      failures: group
        .filter((sample) => !sample.passed)
        .slice(0, 3)
        .map(({ status, reason, bodySample }) => ({
          status,
          reason,
          ...(bodySample ? { bodySample } : {}),
        })),
    }
  })
}

function evaluateBudget({
  budget,
  availability,
  p50Ms,
  p95Ms,
  fiveXxCount,
  rateLimitedCount,
  requestErrorCount,
  samples,
}) {
  const failures = []

  if (availability < budget.minAvailability) {
    failures.push(`availability ${formatPercent(availability)} is below ${formatPercent(budget.minAvailability)}`)
  }

  if (p50Ms > budget.maxP50Ms) failures.push(`p50 ${p50Ms}ms is above ${budget.maxP50Ms}ms`)
  if (p95Ms > budget.maxP95Ms) failures.push(`p95 ${p95Ms}ms is above ${budget.maxP95Ms}ms`)
  if (fiveXxCount > budget.max5xx) failures.push(`5xx count ${fiveXxCount} is above ${budget.max5xx}`)
  if (rateLimitedCount > budget.max429) failures.push(`429 count ${rateLimitedCount} is above ${budget.max429}`)

  if (requestErrorCount > budget.maxRequestErrors) {
    failures.push(`request error count ${requestErrorCount} is above ${budget.maxRequestErrors}`)
  }

  const nonJsonFailures = samples.filter((sample) => !sample.passed && /non-JSON|HTML/i.test(sample.reason ?? ''))

  if (nonJsonFailures.length > 0) {
    failures.push(`${nonJsonFailures.length} API samples returned non-JSON or HTML responses`)
  }

  return failures
}

async function fetchTextWithTimeout(fetchFn, url, { headers, timeoutMs }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchFn(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    })
    const body = await response.text()

    return { response, body }
  } finally {
    clearTimeout(timeout)
  }
}

function resolveToken(definition, config, env) {
  if (!definition.requiresAuth) return null

  for (const envName of definition.tokenEnvs) {
    const value = readEnv(env, envName)
    if (value) return { source: envName, value }
  }

  if (definition.allowCommonTokenFallback !== false && (config.profiles.length === 1 || config.allowSharedToken)) {
    for (const envName of COMMON_TOKEN_ENVS) {
      const value = readEnv(env, envName)
      if (value) return { source: envName, value }
    }
  }

  return null
}

function missingTokenReason(definition, config) {
  const sharedHint =
    definition.allowCommonTokenFallback !== false && config.profiles.length > 1 && !config.allowSharedToken
      ? ' Shared fallback tokens are intentionally not reused across multiple personas unless CAPACITY_ALLOW_SHARED_TOKEN=true.'
      : ''

  return `No bearer token was provided for ${definition.name}.${sharedHint}`
}

function tokenRequirement(definition, config) {
  const envs = [...definition.tokenEnvs]
  const allowCommonTokenFallback = definition.allowCommonTokenFallback !== false

  if (allowCommonTokenFallback && (config.profiles.length === 1 || config.allowSharedToken)) {
    envs.push(...COMMON_TOKEN_ENVS)
  } else if (allowCommonTokenFallback) {
    envs.push('or CAPACITY_ALLOW_SHARED_TOKEN=true with a shared diagnostic token')
  }

  return envs
}

function buildHeaders(bearerToken) {
  const headers = {
    accept: 'application/json',
    'cache-control': 'no-cache',
  }

  if (bearerToken) headers.authorization = `Bearer ${bearerToken}`
  return headers
}

function sanitizeEndpoints(endpoints) {
  return endpoints.map(({ label, method, path }) => ({ label, method, path }))
}

function sampleFailureReason({ response, bodyLooksHtml, jsonOk }) {
  if (!response.ok) return `HTTP ${response.status}`
  if (bodyLooksHtml) return 'API returned HTML instead of JSON'
  if (!jsonOk) return 'API returned non-JSON response'
  return 'API response failed capacity checks'
}

function looksLikeHtml(body, contentType) {
  const lowerType = contentType.toLowerCase()
  const lowerBody = body.trimStart().toLowerCase()

  return (
    lowerType.includes('text/html') ||
    lowerBody.startsWith('<!doctype html') ||
    lowerBody.startsWith('<html')
  )
}

function isJsonResponse(body, contentType) {
  if (!contentType.toLowerCase().includes('application/json')) return false

  try {
    JSON.parse(body)
    return true
  } catch {
    return false
  }
}

function sanitizeBodySample(value, bearerToken = '') {
  const redacted = bearerToken ? value.split(bearerToken).join('<redacted-token>') : value

  return redacted
    .replace(/\bBearer\s+[^"',}\]\s]+/gi, 'Bearer <redacted-token>')
    .replace(/\b(?:Bearer\s+)?[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '<redacted-jwt>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)
}

function ensureLeadingSlash(value) {
  return value.startsWith('/') ? value : `/${value}`
}

function readEnv(env, name) {
  const value = env[name]
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function percentile(values, ratio) {
  if (values.length === 0) return 0

  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * ratio) - 1))
  return round(values[index] ?? 0, 2)
}

function round(value, digits) {
  return Number(value.toFixed(digits))
}

function errorMessage(error) {
  if (error instanceof Error) return error.name === 'AbortError' ? 'request timed out' : error.message
  return String(error)
}
