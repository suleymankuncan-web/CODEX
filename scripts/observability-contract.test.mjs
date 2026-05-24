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
const observabilityService = readText(
  'backend/nestjs/src/shared/observability/observability.service.ts',
)
const standardErrorFilter = readText(
  'backend/nestjs/src/shared/http/standard-error.filter.ts',
)
const structuredLog = readText('backend/nestjs/src/shared/structured-log.ts')
const healthService = readText('backend/nestjs/src/shared/health.service.ts')
const authUserAuditPage = readText('admin-web/src/pages/AuthUserAuditPage.tsx')
const authAssignmentAuditPage = readText('admin-web/src/pages/AuthAssignmentAuditPage.tsx')
const auditCenterPage = readText('admin-web/src/pages/AuditCenterPage.tsx')
const operationalObservabilityReview = readText('docs/plans/operational-observability-review.md')
const phase6CloseoutChecklist = readText('docs/plans/phase-6-closeout-checklist.md')

test('observability env contract is documented and example-only', () => {
  for (const variable of [
    'ERROR_TRACKING_DSN',
    'ERROR_TRACKING_ENVIRONMENT',
    'ERROR_TRACKING_RELEASE',
    'LOG_LEVEL',
    'READINESS_PROFILE',
  ]) {
    requireText(appConfigService, variable)
    requireText(backendEnvExample, `${variable}=`)
    requireText(envInventory, `\`${variable}\``)
  }

  requireText(envInventory, 'Broad production without `ERROR_TRACKING_DSN`')
  requireText(backendEnvExample, 'ERROR_TRACKING_DSN=')
})

test('observability service captures log-only backend failure signals', () => {
  for (const expected of [
    'captureException',
    'installProcessHandlers',
    'process.unhandled_rejection',
    'process.uncaught_exception',
    'externalDelivery: "not-enabled"',
    'mode: "log-only"',
    'redactSensitiveLogValue',
  ]) {
    requireText(observabilityService, expected)
  }
})

test('standard error filter sends 5xx failures to observability without changing generic responses', () => {
  requireText(standardErrorFilter, 'constructor(private readonly observabilityService?')
  requireText(standardErrorFilter, 'captureException')
  requireText(standardErrorFilter, 'statusCode >= HttpStatus.INTERNAL_SERVER_ERROR')
  requireText(standardErrorFilter, 'message: this.resolveMessage')
  requireText(standardErrorFilter, 'Internal server error')
})

test('health endpoint exposes observability status without making secrets public', () => {
  requireText(healthService, 'observability: this.observabilityService.getStatus()')
  requireText(observabilityService, 'dsnConfigured')
  assert.doesNotMatch(observabilityService, /ERROR_TRACKING_DSN.*logger\.(log|warn|error)/)
})

test('structured logs redact secret-like failure values before logging', () => {
  for (const expected of [
    'redactSensitiveLogValue',
    'Bearer [redacted]',
    '[redacted-url]',
    'authorization|client_secret|password|pwd|refresh_token|secret|token',
  ]) {
    requireText(structuredLog, expected)
  }
})

test('auth audit detail pages expose correlation ids for operator trace joins', () => {
  for (const page of [authUserAuditPage, authAssignmentAuditPage]) {
    requireText(page, 'authAuditDetails.eventLogId')
    requireText(page, 'authAuditDetails.correlationId')
    requireText(page, 'item.correlationId ?? t')
    requireText(page, 'authAuditDetails.changedFields')
    requireText(page, 'metadata.sourceContext?.module')
    requireText(page, 'metadata.sourceContext?.operation')
  }
})

test('audit center exposes recent trace correlation visibility without a new feed endpoint', () => {
  for (const expected of [
    'AuditRecentTracePanel',
    'adminAudit.recentTrace',
    'adminAudit.correlation',
    'item.correlationId ?? t',
    'adminAudit.correlationFallback',
    '/admin/audit/users/',
    '/admin/audit/role-assignments/',
  ]) {
    requireText(auditCenterPage, expected)
  }
})

test('operational observability review reflects the current controlled-pilot boundary', () => {
  for (const expected of [
    'Status: phase_6_closed_next_phase_parked',
    'Status: Closed',
    'auth user audit detail pages surface `eventLogId`, `correlationId`',
    'Status: Partially closed for Phase 6; parked for next phase',
    'Do not build the backend-wide feed until real pilot usage',
    'keep app-level external error tracking behind the P0 trust operations',
    'Complete for controlled pilot; backend-wide audit feed parked for next phase',
  ]) {
    requireText(operationalObservabilityReview + phase6CloseoutChecklist, expected)
  }
})
