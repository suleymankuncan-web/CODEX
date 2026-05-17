import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  REQUIRED_ALERTS,
  readAlertRoutingConfig,
  runAlertRoutingSmoke,
} from './alert-routing-smoke.mjs'

const validDocs = {
  incidentRunbook: [
    '## Alert Trigger Playbooks',
    ...REQUIRED_ALERTS,
    'Do not paste raw bearer tokens',
    'Do not paste raw id tokens',
    'Do not paste refresh tokens',
    'Do not paste authorization codes',
    'Do not paste PKCE verifier values',
    'Do not paste client secrets',
  ].join('\n'),
  monitoringContract: [
    '## Alert Routing V1',
    ...REQUIRED_ALERTS,
    'Incident lead',
    'Release operator',
    'Backend owner',
    'Frontend owner',
    'Data owner',
    'Business approver',
    'npm.cmd run smoke:deployed-readiness',
    'npm.cmd run smoke:auth:staging:action',
    'npm.cmd run guard:auth:evidence',
    'npm.cmd run smoke:alert-routing',
  ].join('\n'),
  productionChecklist: [
    'Alert routing smoke passed',
    'alert-routing-smoke',
    'Production incident contact path is written',
  ].join('\n'),
}

test('alert routing config accepts backend origin or api base url', () => {
  assert.equal(
    readAlertRoutingConfig({
      ALERT_SMOKE_BACKEND_URL: 'https://api.example.com',
    }).backendApiBaseUrl,
    'https://api.example.com/api',
  )
  assert.equal(
    readAlertRoutingConfig({
      ALERT_SMOKE_BACKEND_URL: 'https://api.example.com/api',
    }).backendApiBaseUrl,
    'https://api.example.com/api',
  )
})

test('alert routing smoke passes docs and deployed backend signal without provider metadata', async () => {
  const evidence = await runAlertRoutingSmoke({
    docs: validDocs,
    env: {
      ALERT_SMOKE_BACKEND_URL: 'https://api.example.com/api',
      ALERT_SMOKE_ENVIRONMENT: 'staging',
    },
    fetchFn: async () =>
      jsonResponse({
        status: 'ok',
        observability: {
          status: 'ok',
        },
        checks: {
          database: {
            status: 'ok',
          },
        },
      }),
  })

  assert.equal(evidence.status, 'ok')
  assert.equal(evidence.summary.failed, 0)
  assert.equal(evidence.summary.skipped, 1)
  assert.ok(
    evidence.checks.some(
      (check) =>
        check.name === 'backend health alert signal' &&
        check.status === 'passed' &&
        check.observabilityStatus === 'ok',
    ),
  )
  assert.ok(
    evidence.checks.some(
      (check) =>
        check.name === 'alert provider metadata' && check.status === 'skipped',
    ),
  )
})

test('alert routing smoke fails when a required alert is missing from docs', async () => {
  const docs = {
    ...validDocs,
    monitoringContract: validDocs.monitoringContract.replace(
      'backend-health-down',
      'backend-health-missing',
    ),
  }

  const evidence = await runAlertRoutingSmoke({
    docs,
    env: {},
  })

  assert.equal(evidence.status, 'failed')
  assert.ok(
    evidence.checks.some(
      (check) =>
        check.name === 'operational monitoring alert matrix' &&
        check.status === 'failed' &&
        check.missing.includes('backend-health-down'),
    ),
  )
})

test('alert routing smoke fails when backend health signal is missing alertable fields', async () => {
  const evidence = await runAlertRoutingSmoke({
    docs: validDocs,
    env: {
      ALERT_SMOKE_BACKEND_URL: 'https://api.example.com',
    },
    fetchFn: async () =>
      jsonResponse({
        status: 'ok',
        checks: {},
      }),
  })

  assert.equal(evidence.status, 'failed')
  assert.ok(
    evidence.checks.some(
      (check) =>
        check.name === 'backend health alert signal' &&
        check.status === 'failed' &&
        check.missing.includes('observability.status'),
    ),
  )
})

test('alert routing smoke validates complete provider metadata without printing secret material', async () => {
  const evidence = await runAlertRoutingSmoke({
    docs: validDocs,
    env: {
      ALERT_PROVIDER_NAME: 'render-log-alerts',
      ALERT_PRIMARY_DESTINATION: 'ops-channel',
      ALERT_BACKUP_DESTINATION: 'backup-channel',
    },
  })

  assert.equal(evidence.status, 'ok')
  const providerCheck = evidence.checks.find(
    (check) => check.name === 'alert provider metadata',
  )
  assert.equal(providerCheck.status, 'passed')
  assert.equal(providerCheck.providerName, 'render-log-alerts')
  assert.equal(providerCheck.primaryDestinationConfigured, true)
  assert.equal(providerCheck.backupDestinationConfigured, true)
  assert.doesNotMatch(JSON.stringify(evidence), /ops-channel|backup-channel/)
})

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => headers[name.toLowerCase()] ?? null,
    },
    json: async () => body,
  }
}
