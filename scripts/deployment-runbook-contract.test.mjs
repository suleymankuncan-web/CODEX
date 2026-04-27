import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
