import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(document, expected) {
  assert.match(document, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

function readEnvExampleValue(example, variable) {
  const line = example.split(/\r?\n/).find((entry) => entry.startsWith(`${variable}=`))
  assert.ok(line, `${variable} must be present in example env`)
  return line.slice(variable.length + 1)
}

function extractTableRowsAfterHeading(document, heading) {
  const start = document.indexOf(heading)
  assert.notEqual(start, -1, `${heading} section must exist`)

  const section = document.slice(start).split(/\r?\n## /)[0]
  const tableLines = section
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('|'))

  assert.ok(tableLines.length >= 3, `${heading} must contain a markdown table`)

  const headers = tableLines[0]
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())
  const rows = new Map()

  for (const line of tableLines.slice(2)) {
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim())

    if (cells.length !== headers.length) {
      continue
    }

    rows.set(cells[0].replaceAll('`', ''), Object.fromEntries(headers.map((header, index) => [header, cells[index]])))
  }

  return rows
}

const inventory = readText('docs/plans/environment-variable-inventory.md')
const deploymentRunbook = readText('docs/plans/deployment-runbook-skeleton.md')
const stagingRunbook = readText('docs/deployment/render-supabase-vercel-staging.md')
const productionChecklist = readText('docs/plans/production-environment-readiness-checklist.md')
const backendEnvExample = readText('backend/nestjs/.env.example')
const frontendEnvExample = readText('admin-web/.env.example')

const criticalVariables = [
  'NODE_ENV',
  'DATABASE_URL',
  'DB_SSL_MODE',
  'AUTH_MODE',
  'AUTH_PROVIDER_KEY',
  'ALLOW_MOCK_AUTH',
  'MIGRATIONS_HTTP_ENABLED',
  'CORS_ALLOWED_ORIGINS',
  'TRUST_PROXY_HOPS',
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_MAX',
  'RATE_LIMIT_BACKEND',
  'RATE_LIMIT_REDIS_PREFIX',
  'QUEUE_BACKEND',
  'REDIS_URL',
  'UPLOAD_PARSE_MAX_CONCURRENCY',
  'UPLOAD_PARSE_TIMEOUT_MS',
  'READINESS_PROFILE',
  'JWT_ISSUER',
  'JWT_AUDIENCE',
  'JWT_JWKS_URL',
  'JWT_SECRET',
  'AUTH_AUTHORIZATION_URL',
  'AUTH_CLIENT_ID',
  'AUTH_SCOPE',
  'AUTH_RESPONSE_TYPE',
  'AUTH_TOKEN_URL',
  'AUTH_CALLBACK_PATH',
  'AUTH_POST_LOGOUT_REDIRECT_PATH',
  'VITE_API_BASE_URL',
  'VITE_AUTH_MODE',
  'VITE_AUTH_PROVIDER',
  'VITE_BEARER_TOKEN',
  'VITE_CLERK_PUBLISHABLE_KEY',
  'VITE_CLERK_JWT_TEMPLATE',
  'DAILY_CLOSURE_ACTOR_USER_ID',
]

test('production env contract guard records owner location classification and defaults', () => {
  const rows = extractTableRowsAfterHeading(inventory, '## Production Env Contract Guard')
  const backendRows = extractTableRowsAfterHeading(inventory, '## Backend Runtime Variables')

  for (const variable of criticalVariables) {
    const row = rows.get(variable)

    assert.ok(row, `${variable} must have a production env contract row`)
    for (const column of [
      'Owner',
      'Runtime location',
      'Classification',
      'Production requirement',
      'Local/default value',
    ]) {
      assert.ok(row[column], `${variable} must define ${column}`)
      assert.notEqual(row[column], 'TBD', `${variable} ${column} must not be TBD`)
    }
  }

  for (const [variable, row] of backendRows) {
    if (!row['P0/P1']?.startsWith('P0')) {
      continue
    }

    assert.ok(rows.has(variable), `${variable} is backend ${row['P0/P1']} and must have a contract guard row`)
  }
})

test('critical secret and public env boundaries are explicit', () => {
  const rows = extractTableRowsAfterHeading(inventory, '## Production Env Contract Guard')

  for (const variable of ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'VITE_BEARER_TOKEN']) {
    assert.equal(rows.get(variable)?.Classification, 'Secret')
  }

  for (const variable of [
    'CORS_ALLOWED_ORIGINS',
    'TRUST_PROXY_HOPS',
    'JWT_JWKS_URL',
    'AUTH_CLIENT_ID',
    'VITE_API_BASE_URL',
    'VITE_AUTH_PROVIDER',
    'VITE_CLERK_PUBLISHABLE_KEY',
  ]) {
    assert.match(rows.get(variable)?.Classification ?? '', /Public|Internal/)
  }

  assert.match(rows.get('VITE_BEARER_TOKEN')?.['Production requirement'] ?? '', /empty/i)
  assert.equal(readEnvExampleValue(frontendEnvExample, 'VITE_BEARER_TOKEN'), '')
})

test('render and vercel env verification remains manual and no-secret', () => {
  for (const text of [deploymentRunbook, stagingRunbook, productionChecklist]) {
    requireText(text, 'Manual Env Verification')
    requireText(text, 'Render')
    requireText(text, 'Vercel')
    requireText(text, 'Do not copy values')
    requireText(text, 'variable names, status, and owner')
  }

  for (const variable of ['TRUST_PROXY_HOPS', 'RATE_LIMIT_BACKEND', 'JWT_JWKS_URL', 'VITE_AUTH_PROVIDER']) {
    requireText(stagingRunbook, variable)
  }
})

test('committed env examples keep production-only secrets out of frontend and placeholders in backend', () => {
  assert.equal(readEnvExampleValue(frontendEnvExample, 'VITE_BEARER_TOKEN'), '')
  assert.equal(readEnvExampleValue(backendEnvExample, 'ERROR_TRACKING_DSN'), '')
  assert.equal(readEnvExampleValue(backendEnvExample, 'JWT_SECRET'), 'change-me')

  assert.doesNotMatch(frontendEnvExample, /^VITE_.*(?:SECRET|PASSWORD|PRIVATE_KEY)=.+$/m)
  assert.doesNotMatch(frontendEnvExample, /^VITE_BEARER_TOKEN=.+$/m)
})
