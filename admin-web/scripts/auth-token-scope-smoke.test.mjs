import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const appRoot = dirname(scriptsDir)

function runTokenScopeSmoke(env = {}, args = []) {
  return spawnSync(process.execPath, ['scripts/auth-token-scope-smoke.mjs', ...args], {
    cwd: appRoot,
    env: {
      ...process.env,
      ...env,
    },
    encoding: 'utf8',
  })
}

function runTokenScopeSmokeAsync(env = {}, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/auth-token-scope-smoke.mjs', ...args], {
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

function writeJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}

test('token scope smoke fails fast without reading the network when bearer token is missing', () => {
  const result = runTokenScopeSmoke({
    AUTH_SMOKE_API_BASE_URL: 'http://127.0.0.1:9/api',
    AUTH_SMOKE_BEARER_TOKEN: '',
  })
  const output = `${result.stdout}\n${result.stderr}`

  assert.notEqual(result.status, 0)
  assert.match(output, /AUTH_SMOKE_BEARER_TOKEN/)
  assert.doesNotMatch(output, /ECONNREFUSED/)
})

test('token scope smoke prints sanitized assigned and unassigned action-scope evidence', async () => {
  const bearerToken = 'secret-token-value'
  const assignedStoreId = '00000000-0000-0000-0000-000000000100'
  const unassignedStoreId = '00000000-0000-0000-0000-000000000101'
  const seen = []

  const server = await startServer((request, response) => {
    seen.push({
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
          roleCodes: ['STORE_MANAGER', 'SUPER_ADMIN'],
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

    if (request.url === `/api/target-distributions/store-personnel?storeId=${assignedStoreId}`) {
      writeJson(response, 200, { data: [{ employeeId: 'redacted-employee' }] })
      return
    }

    if (request.url === `/api/target-distributions/store-personnel?storeId=${unassignedStoreId}`) {
      writeJson(response, 403, { message: 'Out-of-scope store action' })
      return
    }

    writeJson(response, 404, { message: 'not found' })
  })

  try {
    const result = await runTokenScopeSmokeAsync({
      AUTH_SMOKE_API_BASE_URL: server.baseUrl,
      AUTH_SMOKE_BEARER_TOKEN: bearerToken,
      AUTH_SMOKE_EXPECTED_ROLE: 'STORE_MANAGER',
      AUTH_SMOKE_ASSIGNED_STORE_ID: assignedStoreId,
      AUTH_SMOKE_UNASSIGNED_STORE_ID: unassignedStoreId,
      AUTH_SMOKE_ENVIRONMENT: 'test',
    })
    const output = `${result.stdout}\n${result.stderr}`

    assert.equal(result.status, 0, output)
    assert.doesNotMatch(output, new RegExp(bearerToken))
    assert.equal(seen.length, 3)
    assert.deepEqual(
      seen.map((item) => item.authorization),
      [`Bearer ${bearerToken}`, `Bearer ${bearerToken}`, `Bearer ${bearerToken}`],
    )

    const evidence = JSON.parse(result.stdout)
    assert.equal(evidence.evidenceStatus, 'test-clerk-token-action-scope-smoke-passed')
    assert.equal(evidence.session.user.roleCodes.includes('STORE_MANAGER'), true)
    assert.equal(evidence.session.user.actionScope.assignedStoreIds[0], assignedStoreId)
    assert.equal(evidence.actionScopeSmoke.assignedStore.status, 200)
    assert.equal(evidence.actionScopeSmoke.assignedStore.storeId, assignedStoreId)
    assert.equal(evidence.actionScopeSmoke.assignedStore.result.rowCount, 1)
    assert.equal(evidence.actionScopeSmoke.unassignedStore.status, 403)
    assert.equal(evidence.actionScopeSmoke.unassignedStore.storeId, unassignedStoreId)
  } finally {
    await server.close()
  }
})

test('package exposes explicit staging token action-scope smoke script', () => {
  const packageJson = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8'))

  assert.equal(
    packageJson.scripts['smoke:auth:staging:token-scope'],
    'node scripts/auth-token-scope-smoke.mjs --staging',
  )
})
