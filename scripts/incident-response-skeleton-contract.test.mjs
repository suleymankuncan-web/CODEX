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

const incidentSkeleton = readText('docs/plans/production-staging-incident-response-skeleton.md')
const deploymentRunbook = readText('docs/plans/deployment-runbook-skeleton.md')
const productionChecklist = readText('docs/plans/production-environment-readiness-checklist.md')

test('incident response skeleton keeps operator-ready sections', () => {
  for (const heading of [
    '# Production And Staging Incident Response Skeleton',
    '## Decision Rule',
    '## Incident Severity',
    '## Roles And Ownership',
    '## Triage Flow',
    '## Auth Incident Playbook',
    '## Import And Data Quality Incident Playbook',
    '## Deploy And Release Incident Playbook',
    '## Evidence And Secret Rules',
    '## Incident Note Template',
    '## Post-Incident Review',
  ]) {
    requireText(incidentSkeleton, heading)
  }
})

test('incident response skeleton preserves no-secret evidence rules', () => {
  for (const phrase of [
    'Do not paste raw bearer tokens',
    'Do not paste raw id tokens',
    'Do not paste refresh tokens',
    'Do not paste authorization codes',
    'Do not paste PKCE verifier values',
    'Do not paste client secrets',
    'Sanitized evidence only',
  ]) {
    requireText(incidentSkeleton, phrase)
  }
})

test('incident response skeleton links failures to guarded commands and rollback decisions', () => {
  for (const phrase of [
    'npm.cmd run check:release',
    'npm.cmd run smoke:auth:staging:action',
    'npm.cmd run guard:auth:evidence',
    'Stop the release',
    'pause import/materialization jobs',
    'Rollback / Forward-fix / No-Go',
    'assigned-store action',
    'unassigned-store action returns `403`',
  ]) {
    requireText(incidentSkeleton, phrase)
  }
})

test('incident response skeleton keeps JSON source integration suspended during incidents', () => {
  for (const phrase of [
    'Do not create a source-specific JSON adapter during an incident',
    'JSON source integration is suspended for the current pilot and Power BI/Excel operating path.',
    'Power BI/Excel remains the active operating source.',
    'source mapping spec',
    'canonical raw KPI contract',
  ]) {
    requireText(incidentSkeleton, phrase)
  }
})

test('incident response skeleton is linked from release readiness docs', () => {
  const path = 'docs/plans/production-staging-incident-response-skeleton.md'

  requireText(deploymentRunbook, path)
  requireText(productionChecklist, path)
})
