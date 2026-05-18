import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const workspaceRoot = join(import.meta.dirname, '..')
const DEFAULT_TIMEOUT_MS = 15_000

export const REQUIRED_ALERTS = [
  'backend-health-down',
  'backend-5xx-spike',
  'auth-session-failure-spike',
  'import-failure-spike',
  'snapshot-worker-failure',
  'database-latency-high',
  'frontend-unreachable',
  'observability-degraded',
]

const REQUIRED_OWNER_ROLES = [
  'Incident lead',
  'Release operator',
  'Backend owner',
  'Frontend owner',
  'Data owner',
  'Business approver',
]

const REQUIRED_GUARDED_COMMANDS = [
  'npm.cmd run smoke:deployed-readiness',
  'npm.cmd run smoke:auth:staging:action',
  'npm.cmd run guard:auth:evidence',
  'npm.cmd run smoke:alert-routing',
]

const REQUIRED_SECRET_RULES = [
  'Do not paste raw bearer tokens',
  'Do not paste raw id tokens',
  'Do not paste refresh tokens',
  'Do not paste authorization codes',
  'Do not paste PKCE verifier values',
  'Do not paste client secrets',
]

export function readAlertRoutingConfig(env = process.env) {
  return {
    backendApiBaseUrl: normalizeBackendApiBaseUrl(readEnv(env, 'ALERT_SMOKE_BACKEND_URL')),
    environment: readEnv(env, 'ALERT_SMOKE_ENVIRONMENT') || 'unspecified',
    providerName: readEnv(env, 'ALERT_PROVIDER_NAME'),
    primaryDestination: readEnv(env, 'ALERT_PRIMARY_DESTINATION'),
    backupDestination: readEnv(env, 'ALERT_BACKUP_DESTINATION'),
    timeoutMs: readPositiveInteger(env.ALERT_SMOKE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  }
}

export async function runAlertRoutingSmoke(input = {}) {
  const config = input.config ?? readAlertRoutingConfig(input.env ?? process.env)
  const docs = input.docs ?? readAlertRoutingDocs()
  const fetchFn = input.fetchFn ?? globalThis.fetch
  const checks = []

  checks.push(
    checkDocumentText({
      name: 'operational monitoring alert matrix',
      requiredText: [
        '## Alert Routing V1',
        ...REQUIRED_ALERTS,
        ...REQUIRED_OWNER_ROLES,
        ...REQUIRED_GUARDED_COMMANDS,
      ],
      text: docs.monitoringContract,
    }),
  )
  checks.push(
    checkDocumentText({
      name: 'incident alert response path',
      requiredText: [
        '## Alert Trigger Playbooks',
        ...REQUIRED_ALERTS,
        ...REQUIRED_SECRET_RULES,
      ],
      text: docs.incidentRunbook,
    }),
  )
  checks.push(
    checkDocumentText({
      name: 'production readiness alert gate',
      requiredText: [
        'Alert routing smoke passed',
        'alert-routing-smoke',
        'Production incident contact path is written',
      ],
      text: docs.productionChecklist,
    }),
  )

  checks.push(checkProviderMetadata(config))

  if (config.backendApiBaseUrl) {
    checks.push(
      await checkBackendHealthSignal({
        backendApiBaseUrl: config.backendApiBaseUrl,
        fetchFn,
        timeoutMs: config.timeoutMs,
      }),
    )
  } else {
    checks.push({
      name: 'backend health alert signal',
      status: 'skipped',
      reason: 'ALERT_SMOKE_BACKEND_URL was not provided; deployed health signal was not checked.',
    })
  }

  const failed = checks.filter((check) => check.status === 'failed')

  return {
    status: failed.length === 0 ? 'ok' : 'failed',
    evidenceDate: new Date().toISOString(),
    environment: config.environment,
    backendApiBaseUrl: config.backendApiBaseUrl,
    providerDelivery: config.providerName ? 'metadata-only' : 'not-configured',
    summary: {
      total: checks.length,
      passed: checks.filter((check) => check.status === 'passed').length,
      failed: failed.length,
      skipped: checks.filter((check) => check.status === 'skipped').length,
    },
    checks,
    safety: [
      'Alert routing smoke does not print provider tokens, webhook secrets, bearer tokens, cookies, database URLs, or private keys.',
      'Provider delivery is metadata-only until an approved alerting provider/API is configured.',
    ],
  }
}

function readAlertRoutingDocs() {
  return {
    incidentRunbook: readText('docs/plans/production-staging-incident-response-skeleton.md'),
    monitoringContract: readText('docs/backend/operational-monitoring-contract.md'),
    productionChecklist: readText('docs/plans/production-environment-readiness-checklist.md'),
  }
}

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function checkDocumentText({ name, requiredText, text }) {
  const missing = requiredText.filter((value) => !text.includes(value))

  if (missing.length > 0) {
    return {
      name,
      status: 'failed',
      reason: 'required alert routing contract text is missing',
      missing,
    }
  }

  return {
    name,
    status: 'passed',
    requiredTextCount: requiredText.length,
  }
}

function checkProviderMetadata(config) {
  const configuredValues = [
    config.providerName,
    config.primaryDestination,
    config.backupDestination,
  ].filter(Boolean)

  if (configuredValues.length === 0) {
    return {
      name: 'alert provider metadata',
      status: 'skipped',
      reason: 'No alert provider metadata was provided; external alert delivery was not verified.',
    }
  }

  const missing = []

  if (!config.providerName) {
    missing.push('ALERT_PROVIDER_NAME')
  }

  if (!config.primaryDestination) {
    missing.push('ALERT_PRIMARY_DESTINATION')
  }

  if (!config.backupDestination) {
    missing.push('ALERT_BACKUP_DESTINATION')
  }

  if (missing.length > 0) {
    return {
      name: 'alert provider metadata',
      status: 'failed',
      reason: 'alert provider metadata is incomplete',
      missing,
    }
  }

  return {
    name: 'alert provider metadata',
    status: 'passed',
    providerName: config.providerName,
    primaryDestinationConfigured: true,
    backupDestinationConfigured: true,
  }
}

async function checkBackendHealthSignal({ backendApiBaseUrl, fetchFn, timeoutMs }) {
  const url = `${backendApiBaseUrl}/health`

  try {
    const response = await fetchFn(url, {
      signal: AbortSignal.timeout(timeoutMs),
    })
    const body = await response.json()

    if (!response.ok) {
      return {
        name: 'backend health alert signal',
        status: 'failed',
        url,
        httpStatus: response.status,
        reason: 'backend health endpoint did not return a successful status',
      }
    }

    const missing = []

    if (!body || typeof body !== 'object') {
      missing.push('json body')
    }

    if (!body?.status) {
      missing.push('status')
    }

    if (!body?.checks?.database?.status) {
      missing.push('checks.database.status')
    }

    if (!body?.observability?.status) {
      missing.push('observability.status')
    }

    if (missing.length > 0) {
      return {
        name: 'backend health alert signal',
        status: 'failed',
        url,
        httpStatus: response.status,
        reason: 'backend health response is missing alertable fields',
        missing,
      }
    }

    if (body.observability.status !== 'ok') {
      return {
        name: 'backend health alert signal',
        status: 'failed',
        url,
        httpStatus: response.status,
        reason: 'backend observability is degraded',
        healthStatus: body.status,
        databaseStatus: body.checks.database.status,
        observabilityStatus: body.observability.status,
      }
    }

    return {
      name: 'backend health alert signal',
      status: 'passed',
      url,
      httpStatus: response.status,
      healthStatus: body.status,
      databaseStatus: body.checks.database.status,
      observabilityStatus: body.observability.status,
    }
  } catch (caught) {
    return {
      name: 'backend health alert signal',
      status: 'failed',
      url,
      reason: caught instanceof Error ? caught.message : String(caught),
    }
  }
}

function normalizeBackendApiBaseUrl(value) {
  if (!value) {
    return null
  }

  const parsed = parseHttpUrl(value, 'ALERT_SMOKE_BACKEND_URL')
  const path = parsed.pathname.replace(/\/+$/, '')

  if (!path || path === '/') {
    parsed.pathname = '/api'
  } else if (!path.endsWith('/api')) {
    parsed.pathname = `${path}/api`
  } else {
    parsed.pathname = path
  }

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

  if (!value || value === 'undefined' || value === 'null') {
    return null
  }

  return value.trim()
}

function readPositiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function isMainModule() {
  return import.meta.url === pathToFileURL(process.argv[1]).href
}

if (isMainModule()) {
  try {
    const evidence = await runAlertRoutingSmoke()
    console.log(JSON.stringify(evidence, null, 2))

    if (evidence.status !== 'ok') {
      process.exitCode = 1
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
