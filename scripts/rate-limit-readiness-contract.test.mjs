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

const appConfigService = readText('backend/nestjs/src/shared/app-config.service.ts')
const backendEnvExample = readText('backend/nestjs/.env.example')
const envInventory = readText('docs/plans/environment-variable-inventory.md')
const productionChecklist = readText(
  'docs/plans/production-environment-readiness-checklist.md',
)
const rateLimitMiddleware = readText('backend/nestjs/src/shared/http/rate-limit.middleware.ts')
const redisStore = readText('backend/nestjs/src/shared/http/redis-rate-limit-store.ts')
const configureHttpSecurity = readText(
  'backend/nestjs/src/shared/http/configure-http-security.ts',
)
const readinessProgress = readText('docs/superpowers/plans/2026-05-18-readiness-progress.md')

test('rate limit backend env contract is documented and example-only', () => {
  for (const variable of ['RATE_LIMIT_BACKEND', 'RATE_LIMIT_REDIS_PREFIX']) {
    requireText(appConfigService, variable)
    requireText(backendEnvExample, `${variable}=`)
    requireText(envInventory, `\`${variable}\``)
  }

  requireText(envInventory, '`redis` is required when `READINESS_PROFILE=broad-production`')
  requireText(
    envInventory,
    'Required when `QUEUE_BACKEND=bullmq` or `RATE_LIMIT_BACKEND=redis` in production',
  )
  requireText(productionChecklist, '`RATE_LIMIT_BACKEND=redis`')
  requireText(productionChecklist, '`REDIS_URL` is explicitly configured')
})

test('rate limit store boundary supports memory and Redis backends', () => {
  requireText(rateLimitMiddleware, 'RateLimitStore')
  requireText(rateLimitMiddleware, 'RATE_LIMIT_STORE_UNAVAILABLE')
  requireText(redisStore, 'RedisRateLimitStore')
  requireText(redisStore, 'redis.call("INCR"')
  requireText(redisStore, 'PEXPIRE')
  requireText(configureHttpSecurity, 'config.rateLimitBackend === "redis"')
  requireText(configureHttpSecurity, 'createRedisRateLimitStore')
})

test('broad production memory rate limiting is fail-closed in config', () => {
  requireText(
    appConfigService,
    'RATE_LIMIT_BACKEND=redis is required when READINESS_PROFILE=broad-production',
  )
  requireText(appConfigService, 'READINESS_PROFILE')
  requireText(
    appConfigService,
    'REDIS_URL must be configured in production when RATE_LIMIT_BACKEND=redis',
  )
})

test('readiness plan records Slice 5 implementation evidence', () => {
  requireText(readinessProgress, 'Redis-Backed Rate Limit')
  requireText(readinessProgress, 'RATE_LIMIT_BACKEND=memory|redis')
  requireText(readinessProgress, 'Production can share rate limits across instances')
})
