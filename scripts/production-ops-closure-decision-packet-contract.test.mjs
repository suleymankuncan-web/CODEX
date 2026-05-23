import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requirePath(path) {
  assert.ok(existsSync(join(workspaceRoot, path)), `Missing expected path: ${path}`)
}

function requireText(text, expected) {
  assert.ok(text.includes(expected), `Missing expected text: ${expected}`)
}

const packetPath =
  'docs/evidence/readiness/2026-05-23-production-ops-closure-decision-packet-v1.md'
const packet = readText(packetPath)
const currentState = readText('current-state.md')
const growthRoadmap = readText('docs/plans/project-growth-execution-roadmap-v1.md')
const readinessShelf = readText('docs/domains/readiness-ops.md')
const decisionRegistry = readText('docs/plans/decision-registry-v1.md')
const runbookRegistry = readText('docs/plans/runbook-registry-v1.md')

test('production ops closure packet preserves no-go and owner acceptance boundaries', () => {
  requirePath(packetPath)

  for (const phrase of [
    '# Production Ops Closure Decision Packet V1 - 2026-05-23',
    'Controlled pilot remains `Conditional Go / Continue`.',
    'Broad production remains `No-Go`.',
    'owner acceptance for provider tiers, recovery posture, incident ownership',
    'Redis / BullMQ',
    'Supabase recovery',
    'Better Stack email alert proof',
    'Owner Acceptance Checklist',
    'Rollback authority',
    'Before broad production, after final provider/env decisions:',
    'Broad production remains `No-Go` if any of these are true:',
    'Track 8 is closed as an operating decision packet, not as broad-production',
  ]) {
    requireText(packet, phrase)
  }
})

test('production ops closure packet is linked from operating records', () => {
  for (const text of [
    currentState,
    growthRoadmap,
    readinessShelf,
    decisionRegistry,
    runbookRegistry,
  ]) {
    requireText(text, packetPath)
    requireText(text, 'Production Ops Closure Decision Packet V1')
  }
})
