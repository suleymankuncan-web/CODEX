import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const appRoot = dirname(scriptsDir)

function runCommandSmoke(env = {}, args = []) {
  return spawnSync(process.execPath, ['scripts/store-action-command-smoke.mjs', ...args], {
    cwd: appRoot,
    env: {
      ...process.env,
      ...env,
    },
    encoding: 'utf8',
  })
}

function runCommandSmokeAsync(env = {}, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/store-action-command-smoke.mjs', ...args], {
      cwd: appRoot,
      env: {
        ...process.env,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.once('error', reject)
    child.once('close', (code, signal) => {
      resolve({ status: code, signal, stdout, stderr })
    })
  })
}

function startServer(handler) {
  const server = createServer(handler)

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}/api`,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => (error ? closeReject(error) : closeResolve()))
          }),
      })
    })
  })
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
    })
    request.once('error', reject)
    request.once('end', () => {
      resolve(body ? JSON.parse(body) : null)
    })
  })
}

function writeJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}

function commandResponse(commandStatus, message, plan) {
  return {
    command: {
      status: commandStatus,
      message,
    },
    data: {
      plan,
    },
  }
}

function plan(input) {
  return {
    actionPlanId: input.actionPlanId,
    storeId: input.storeId,
    sourceType: 'kpi_exception',
    sourceId: input.sourceId,
    status: input.status,
    priority: 'medium',
    dueOn: '2026-05-30',
  }
}

test('store action command smoke fails fast without reading the network when bearer token is missing', () => {
  const result = runCommandSmoke({
    STORE_ACTION_SMOKE_API_BASE_URL: 'http://127.0.0.1:9/api',
    STORE_ACTION_SMOKE_BEARER_TOKEN: '',
  })
  const output = `${result.stdout}\n${result.stderr}`

  assert.notEqual(result.status, 0)
  assert.match(output, /STORE_ACTION_SMOKE_BEARER_TOKEN/)
  assert.doesNotMatch(output, /ECONNREFUSED/)
})

test('staging store action command smoke requires explicit mutation acknowledgement', () => {
  const result = runCommandSmoke(
    {
      STORE_ACTION_SMOKE_API_BASE_URL: 'https://api-staging.example.test/api',
      STORE_ACTION_SMOKE_BEARER_TOKEN: 'secret-token-value',
      STORE_ACTION_SMOKE_EXPECTED_ROLE: 'STORE_MANAGER',
      STORE_ACTION_SMOKE_ENVIRONMENT: 'staging',
      STORE_ACTION_SMOKE_ASSIGNED_STORE_ID: '00000000-0000-0000-0000-000000000100',
      STORE_ACTION_SMOKE_UNASSIGNED_STORE_ID: '00000000-0000-0000-0000-000000000101',
    },
    ['--staging'],
  )
  const output = `${result.stdout}\n${result.stderr}`

  assert.notEqual(result.status, 0)
  assert.match(output, /STORE_ACTION_SMOKE_ALLOW_STAGING_MUTATION/)
  assert.doesNotMatch(output, /secret-token-value/)
})

test('store action command smoke prints sanitized assigned and unassigned command evidence', async () => {
  const bearerToken = 'secret-token-value'
  const assignedStoreId = '00000000-0000-0000-0000-000000000100'
  const unassignedStoreId = '00000000-0000-0000-0000-000000000101'
  const seen = []
  const requestBodies = []

  const server = await startServer(async (request, response) => {
    seen.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization,
    })

    if (request.headers.authorization !== `Bearer ${bearerToken}`) {
      writeJson(response, 401, { message: 'missing bearer' })
      return
    }

    if (request.url === '/api/auth/session') {
      writeJson(response, 200, {
        authMode: 'jwt',
        authenticated: true,
        user: {
          userId: '80000000-0000-0000-0000-000000000900',
          employeeId: null,
          roleCodes: ['STORE_MANAGER'],
          readScope: {
            companyIds: ['00000000-0000-0000-0000-000000000001'],
            regionIds: ['00000000-0000-0000-0000-000000000010'],
            storeIds: [assignedStoreId],
          },
          actionScope: {
            assignedStoreIds: [assignedStoreId],
          },
        },
        scopeSummary: {
          companyCount: 1,
          regionCount: 1,
          storeCount: 1,
          assignedStoreCount: 1,
        },
      })
      return
    }

    if (request.method === 'POST' && request.url === '/api/store-actions/plans') {
      const body = await readJsonBody(request)
      requestBodies.push(body)

      if (body.storeId === unassignedStoreId) {
        writeJson(response, 403, { message: 'Store action plan is outside assigned action stores' })
        return
      }

      const actionPlanId = body.sourceId.endsWith(':close') ? 'plan-close' : 'plan-cancel'
      writeJson(
        response,
        201,
        commandResponse(
          'created',
          'Store action plan created',
          plan({
            actionPlanId,
            sourceId: body.sourceId,
            status: 'open',
            storeId: body.storeId,
          }),
        ),
      )
      return
    }

    if (request.method === 'PATCH' && request.url === '/api/store-actions/plans/plan-close/status') {
      writeJson(
        response,
        200,
        commandResponse(
          'updated',
          'Store action plan status updated',
          plan({
            actionPlanId: 'plan-close',
            sourceId: requestBodies[0].sourceId,
            status: 'in_progress',
            storeId: assignedStoreId,
          }),
        ),
      )
      return
    }

    if (request.method === 'PATCH' && request.url === '/api/store-actions/plans/plan-close/close') {
      writeJson(
        response,
        200,
        commandResponse(
          'closed',
          'Store action plan closed',
          plan({
            actionPlanId: 'plan-close',
            sourceId: requestBodies[0].sourceId,
            status: 'closed',
            storeId: assignedStoreId,
          }),
        ),
      )
      return
    }

    if (request.method === 'PATCH' && request.url === '/api/store-actions/plans/plan-cancel/cancel') {
      writeJson(
        response,
        200,
        commandResponse(
          'cancelled',
          'Store action plan cancelled',
          plan({
            actionPlanId: 'plan-cancel',
            sourceId: requestBodies[1].sourceId,
            status: 'cancelled',
            storeId: assignedStoreId,
          }),
        ),
      )
      return
    }

    writeJson(response, 404, { message: 'not found' })
  })

  try {
    const result = await runCommandSmokeAsync({
      STORE_ACTION_SMOKE_API_BASE_URL: server.baseUrl,
      STORE_ACTION_SMOKE_BEARER_TOKEN: bearerToken,
      STORE_ACTION_SMOKE_EXPECTED_ROLE: 'STORE_MANAGER',
      STORE_ACTION_SMOKE_ASSIGNED_STORE_ID: assignedStoreId,
      STORE_ACTION_SMOKE_UNASSIGNED_STORE_ID: unassignedStoreId,
      STORE_ACTION_SMOKE_ENVIRONMENT: 'test',
      STORE_ACTION_SMOKE_SOURCE_PREFIX: 'store-action-smoke:test',
    })
    const output = `${result.stdout}\n${result.stderr}`

    assert.equal(result.status, 0, output)
    assert.doesNotMatch(output, /secret-token-value/)
    assert.equal(seen.length, 7)
    assert.deepEqual(
      seen.map((item) => item.authorization),
      Array.from({ length: 7 }, () => `Bearer ${bearerToken}`),
    )

    const evidence = JSON.parse(result.stdout)
    assert.equal(evidence.evidenceStatus, 'test-store-action-command-smoke-passed')
    assert.equal(evidence.session.user.roleCodes.includes('STORE_MANAGER'), true)
    assert.equal(evidence.storeActionCommandSmoke.assignedStore.createForClose.command.status, 'created')
    assert.equal(evidence.storeActionCommandSmoke.assignedStore.statusUpdate.plan.status, 'in_progress')
    assert.equal(evidence.storeActionCommandSmoke.assignedStore.close.plan.status, 'closed')
    assert.equal(evidence.storeActionCommandSmoke.assignedStore.createForCancel.command.status, 'created')
    assert.equal(evidence.storeActionCommandSmoke.assignedStore.cancel.plan.status, 'cancelled')
    assert.equal(evidence.storeActionCommandSmoke.unassignedStore.createStatus, 403)
    assert.equal(evidence.storeActionCommandSmoke.unassignedStore.dbWriteExpected, false)
  } finally {
    await server.close()
  }
})

test('package exposes explicit staging Store Action command smoke script', () => {
  const packageJson = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8'))

  assert.equal(
    packageJson.scripts['smoke:store-action:staging:command'],
    'node scripts/store-action-command-smoke.mjs --staging',
  )
})
