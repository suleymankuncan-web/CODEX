import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()

function readText(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8')
}

test('pilot daily ops runbook keeps daily start, import, triage, and stop rules explicit', () => {
  const runbook = readText('docs/runbooks/pilot-daily-ops-runbook-v1.md')

  assert.match(runbook, /## Daily Start/)
  assert.match(runbook, /## Persona Smoke/)
  assert.match(runbook, /## Import Day Flow/)
  assert.match(runbook, /## Data Quality Triage/)
  assert.match(runbook, /## Issue Triage/)
  assert.match(runbook, /## Stop Rules/)
  assert.match(runbook, /## Rollback And Parking/)
  assert.match(runbook, /## Daily End/)
})

test('pilot daily ops runbook preserves external-source and no-secret boundaries', () => {
  const runbook = readText('docs/runbooks/pilot-daily-ops-runbook-v1.md')

  assert.match(runbook, /implement Nebim or any new provider adapter/)
  assert.match(runbook, /change DB schema/)
  assert.match(runbook, /change API shape/)
  assert.match(runbook, /change auth, role, scope, or assigned-store semantics/)
  assert.match(runbook, /change KPI, ranking, incentive, target, checklist, or workforce formulas/)
  assert.match(runbook, /create fake metrics or fake data/)
  assert.match(runbook, /Do not record raw session data/)
  assert.doesNotMatch(runbook, /sk_live|sk_test|AKIA|BEGIN PRIVATE KEY|Bearer\s+[A-Za-z0-9._-]+/)
})

test('pilot daily ops runbook links canonical external data contracts', () => {
  const runbook = readText('docs/runbooks/pilot-daily-ops-runbook-v1.md')

  assert.match(runbook, /docs\/contracts\/external-source-canonical-data-contract-v1\.md/)
  assert.match(runbook, /docs\/contracts\/external-source-data-quality-rules-v1\.md/)
  assert.match(runbook, /accepted-without-person/)
  assert.match(runbook, /quarantined row count/)
})

test('pilot daily ops runbook is discoverable from docs index and runbook registry', () => {
  const readme = readText('docs/README.md')
  const registry = readText('docs/plans/runbook-registry-v1.md')

  assert.match(readme, /docs\/runbooks\/pilot-daily-ops-runbook-v1\.md/)
  assert.match(registry, /Run pilot daily ops before external data/)
  assert.match(registry, /docs\/runbooks\/pilot-daily-ops-runbook-v1\.md/)
})
