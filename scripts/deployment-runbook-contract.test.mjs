import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, expected) {
  assert.match(text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

const inventory = readText('docs/plans/environment-variable-inventory.md')
const runbook = readText('docs/plans/deployment-runbook-skeleton.md')
const backendEnvExample = readText('backend/nestjs/.env.example')
const frontendEnvExample = readText('admin-web/.env.example')
const appConfigService = readText('backend/nestjs/src/shared/app-config.service.ts')
const authLiveSmokeScript = readText('admin-web/scripts/auth-live-smoke.mjs')
const renderBlueprint = readText('render.yaml')

function uniqueSorted(values) {
  return [...new Set(values)].sort()
}

function extractMatches(text, regex) {
  return uniqueSorted([...text.matchAll(regex)].map((match) => match[1]))
}

function listFiles(directory, predicate) {
  const absoluteDirectory = join(workspaceRoot, directory)
  const entries = readdirSync(absoluteDirectory)
  const files = []

  for (const entry of entries) {
    const absoluteEntry = join(absoluteDirectory, entry)
    const relativeEntry = `${directory}/${entry}`.replaceAll('\\', '/')
    const stats = statSync(absoluteEntry)

    if (stats.isDirectory()) {
      files.push(...listFiles(relativeEntry, predicate))
    } else if (predicate(relativeEntry)) {
      files.push(relativeEntry)
    }
  }

  return files
}

function readEnvExampleValue(example, variable) {
  const line = example.split(/\r?\n/).find((entry) => entry.startsWith(`${variable}=`))

  assert.ok(line, `${variable} must be present in example env`)

  return line.slice(variable.length + 1).trim()
}

function isSecretLike(variable) {
  return /SECRET|PASSWORD|PRIVATE_KEY|API_KEY|CLIENT_SECRET|(^|_)TOKEN$|ACCESS_TOKEN|REFRESH_TOKEN/.test(variable)
}

function isPlaceholderValue(value) {
  return value === '' || /^(change-me|placeholder|example|dummy|test|dev|local|mock|not-set)$/i.test(value)
}

function requireEnvMentionedEverywhere(variable, docs, example, context) {
  requireText(docs, `\`${variable}\``)
  const exampleValue = readEnvExampleValue(example, variable)

  if (isSecretLike(variable)) {
    assert.ok(isPlaceholderValue(exampleValue), `${context} ${variable} must be placeholder-only in example env`)
  }
}

test('environment variable inventory keeps required sections', () => {
  for (const heading of [
    '# Environment Variable Inventory',
    '## Decision Rule',
    '## Backend Runtime Variables',
    '## Frontend Build-Time Variables',
    '## Auth Smoke Evidence Variables',
    '## Secret Handling Rules',
    '## Production Fill-In Checklist',
  ]) {
    requireText(inventory, heading)
  }
})

test('environment variable inventory covers runtime auth database queue and closure variables', () => {
  for (const variable of [
    'NODE_ENV',
    'DATABASE_URL',
    'AUTH_MODE',
    'ALLOW_MOCK_AUTH',
    'JWT_JWKS_URL',
    'JWT_SECRET',
    'AUTH_AUTHORIZATION_URL',
    'AUTH_TOKEN_URL',
    'DB_POOL_MAX',
    'DB_SSL_MODE',
    'QUEUE_BACKEND',
    'REDIS_URL',
    'DAILY_CLOSURE_AUTOMATION_ENABLED',
    'DAILY_CLOSURE_ACTOR_USER_ID',
  ]) {
    requireText(inventory, `\`${variable}\``)
  }
})

test('environment variable inventory covers frontend and smoke variables', () => {
  for (const variable of [
    'VITE_API_BASE_URL',
    'VITE_AUTH_MODE',
    'VITE_OIDC_RESPONSE_TYPE',
    'VITE_OIDC_TOKEN_URL',
    'AUTH_SMOKE_BASE_URL',
    'AUTH_SMOKE_API_BASE_URL',
    'AUTH_SMOKE_PROVIDER_ISSUER',
    'AUTH_SMOKE_JWKS_URL',
    'AUTH_SMOKE_ASSIGNED_STORE_ID',
    'AUTH_SMOKE_UNASSIGNED_STORE_ID',
  ]) {
    requireText(inventory, `\`${variable}\``)
  }
})

test('deployment runbook keeps release migration smoke rollback and sign-off sections', () => {
  for (const heading of [
    '# Deployment Runbook Skeleton',
    '## Decision Rule',
    '## 1. Preflight',
    '## 2. Build And Release Gate',
    '## 3. Database Migration',
    '## 4. Deploy Backend',
    '## 5. Deploy Frontend',
    '## 6. Smoke Evidence',
    '## 7. Rollback',
    '## 8. Sign-Off Record',
  ]) {
    requireText(runbook, heading)
  }
})

test('deployment runbook requires guarded commands and sanitized evidence', () => {
  for (const phrase of [
    'npm.cmd run check:release',
    'npm.cmd run smoke:auth:staging:action',
    'npm.cmd run guard:auth:evidence',
    'assigned-store action returns success',
    'unassigned-store action returns `403`',
    'Do not paste raw bearer tokens',
  ]) {
    requireText(runbook, phrase)
  }
})

test('render backend deploy runs database migrations before starting the api', () => {
  requireText(renderBlueprint, 'name: hr-axis-api')
  requireText(renderBlueprint, 'buildCommand: npm ci --include=dev && npm run build')
  requireText(renderBlueprint, 'preDeployCommand: npm run db:migrate')
  requireText(renderBlueprint, 'startCommand: node dist/src/main.js')
})

test('env examples expose production-relevant variables and PKCE response type', () => {
  for (const variable of [
    'ALLOW_MOCK_AUTH=',
    'JWT_JWKS_URL=',
    'DAILY_CLOSURE_AUTOMATION_ENABLED=',
    'DAILY_CLOSURE_ACTOR_USER_ID=',
  ]) {
    requireText(backendEnvExample, variable)
  }

  requireText(frontendEnvExample, 'VITE_OIDC_RESPONSE_TYPE=code')
  requireText(frontendEnvExample, 'VITE_OIDC_TOKEN_URL=')
})

test('backend env inventory and example stay aligned with AppConfigService', () => {
  const backendVariables = uniqueSorted([
    ...extractMatches(appConfigService, /readString\("([A-Z0-9_]+)"/g),
    ...extractMatches(appConfigService, /readOptionalString\("([A-Z0-9_]+)"/g),
    ...extractMatches(appConfigService, /configService\.get<string>\("([A-Z0-9_]+)"/g),
  ])

  assert.ok(backendVariables.length > 0, 'AppConfigService env extraction returned no variables')

  for (const variable of backendVariables) {
    requireEnvMentionedEverywhere(variable, inventory, backendEnvExample, 'backend')
  }
})

test('frontend env inventory and example stay aligned with import.meta.env usage', () => {
  const frontendVariables = uniqueSorted(
    listFiles('admin-web/src', (path) => /\.(ts|tsx)$/.test(path))
      .flatMap((path) => extractMatches(readText(path), /import\.meta\.env\.([A-Z0-9_]+)/g))
      .filter((variable) => variable.startsWith('VITE_')),
  )

  assert.ok(frontendVariables.length > 0, 'frontend env extraction returned no VITE variables')

  for (const variable of frontendVariables) {
    requireEnvMentionedEverywhere(variable, inventory, frontendEnvExample, 'frontend')
  }
})

test('auth smoke env inventory stays aligned with smoke script usage', () => {
  const smokeVariables = extractMatches(authLiveSmokeScript, /envValue\('([A-Z0-9_]+)'/g)

  assert.ok(smokeVariables.length > 0, 'auth smoke env extraction returned no variables')

  for (const variable of smokeVariables) {
    requireText(inventory, `\`${variable}\``)
  }
})

test('environment drift guard is documented as the maintenance contract', () => {
  requireText(inventory, '## Drift Guard')
  requireText(inventory, 'AppConfigService')
  requireText(inventory, 'import.meta.env')
  requireText(inventory, 'AUTH_SMOKE_*')
})
