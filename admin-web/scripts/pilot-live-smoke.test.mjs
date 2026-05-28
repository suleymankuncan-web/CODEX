import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const appRoot = dirname(scriptsDir)

function runPilotLiveSmoke(env = {}, args = []) {
  return spawnSync(process.execPath, ['scripts/pilot-live-smoke.mjs', ...args], {
    cwd: appRoot,
    env: {
      ...process.env,
      ...env,
    },
    encoding: 'utf8',
  })
}

function runPilotLiveSmokeAsync(env = {}, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/pilot-live-smoke.mjs', ...args], {
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
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => (error ? closeReject(error) : closeResolve()))
          }),
      })
    })
  })
}

function writeHtml(response, body) {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  response.end(`<!doctype html><html><body>${body}</body></html>`)
}

test('staging pilot live smoke fails fast without a bearer token', () => {
  const result = runPilotLiveSmoke(
    {
      PILOT_SMOKE_BASE_URL: 'https://staging.hr-axis.com',
      PILOT_SMOKE_BEARER_TOKEN: '',
    },
    ['--staging'],
  )
  const output = `${result.stdout}\n${result.stderr}`

  assert.notEqual(result.status, 0)
  assert.match(output, /PILOT_SMOKE_BEARER_TOKEN/)
  assert.doesNotMatch(output, /ENOTFOUND|ECONNREFUSED|TimeoutError/)
})

test('pilot live smoke walks configured routes and injects bearer session without leaking token', async () => {
  const secretToken = 'secret-live-smoke-token'
  const visitedRoutes = []
  const server = await startServer((request, response) => {
    visitedRoutes.push(request.url)
    writeHtml(
      response,
      `<script>
        const token = window.sessionStorage.getItem('store-ops-admin-bearer-token')
        document.body.textContent = token ? 'Pilot route ready' : 'session rejected'
      </script>`,
    )
  })

  try {
    const result = await runPilotLiveSmokeAsync(
      {
        PILOT_SMOKE_BASE_URL: server.baseUrl,
        PILOT_SMOKE_BEARER_TOKEN: secretToken,
      },
      ['--routes=/store,/store/me'],
    )
    const output = `${result.stdout}\n${result.stderr}`

    assert.equal(result.status, 0, output)
    assert.deepEqual(
      visitedRoutes.filter((route) => route !== '/favicon.ico'),
      ['/store', '/store/me'],
    )
    assert.doesNotMatch(output, new RegExp(secretToken))

    const evidence = JSON.parse(result.stdout)
    assert.equal(evidence.status, 'passed')
    assert.equal(evidence.baseUrl, server.baseUrl)
    assert.deepEqual(
      evidence.routes.map((route) => route.path),
      ['/store', '/store/me'],
    )
    assert.deepEqual(
      evidence.routes.map((route) => route.status),
      ['passed', 'passed'],
    )
  } finally {
    await server.close()
  }
})

test('package exposes pilot live smoke command', () => {
  const packageJson = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8'))

  assert.equal(packageJson.scripts['smoke:pilot:live'], 'node scripts/pilot-live-smoke.mjs')
})
