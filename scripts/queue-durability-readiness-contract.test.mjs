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
const healthService = readText('backend/nestjs/src/shared/health.service.ts')
const readinessProgress = readText('docs/superpowers/plans/2026-05-18-readiness-progress.md')

test('queue backend env contract is documented and example-only', () => {
  for (const variable of [
    'QUEUE_BACKEND',
    'REDIS_URL',
    'QUEUE_IMPORT_NAME',
    'QUEUE_SNAPSHOT_NAME',
  ]) {
    requireText(appConfigService, variable)
    requireText(backendEnvExample, `${variable}=`)
    requireText(envInventory, `\`${variable}\``)
  }

  requireText(envInventory, '`bullmq` is required when `READINESS_PROFILE=broad-production`')
  requireText(productionChecklist, '`QUEUE_BACKEND=bullmq`')
  requireText(productionChecklist, 'queue `status=durable` and Redis `status=ok`')
})

test('broad production queue durability is fail-closed in config', () => {
  requireText(
    appConfigService,
    'QUEUE_BACKEND=bullmq is required when READINESS_PROFILE=broad-production',
  )
  requireText(
    appConfigService,
    'REDIS_URL must be configured in production when QUEUE_BACKEND=bullmq',
  )
  requireText(appConfigService, 'QUEUE_BACKEND must be one of in-memory, bullmq')
})

test('health endpoint exposes queue durability and Redis dependency state', () => {
  requireText(healthService, 'queue: this.buildQueueHealth(redis)')
  requireText(healthService, 'process-local')
  requireText(healthService, 'BullMQ queue is using Redis-backed durable dispatch')
  requireText(healthService, 'BullMQ queue requires Redis health to be ok')
  requireText(healthService, 'Redis health check skipped because queue backend is not bullmq')
})

test('readiness plan records Slice 6 implementation evidence', () => {
  requireText(readinessProgress, 'Queue Durability Gate')
  requireText(readinessProgress, 'QUEUE_BACKEND=bullmq')
  requireText(
    readinessProgress,
    'The team can say exactly when in-memory queue is acceptable',
  )
})
