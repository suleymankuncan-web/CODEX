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

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

const specPath = 'docs/plans/store-performance-replay-readonly-surface-spec-v1.md'
const spec = readText(specPath)
const library = readText('docs/README.md')
const currentState = readText('current-state.md')
const p2Plan = readText('docs/plans/p2-product-intelligence-execution-v1.md')

test('store performance replay surface spec is discoverable', () => {
  requirePath(specPath)

  for (const text of [library, currentState, p2Plan]) {
    requireText(text, specPath)
  }
})

test('store performance replay surface spec preserves source and scope boundaries', () => {
  for (const phrase of [
    '# Store Performance Replay Read-Only Surface Spec V1',
    'Status: surface_spec_ready',
    '## Sokrates Decision',
    '## Surface Contract',
    '## Role And Scope Rules',
    'Every event must pass both event-level scope and source-route visibility',
    'If the actor cannot open `sourceRoute`, the event is omitted',
    'STORE_PERSONNEL',
    'parked for Replay V1',
    'REPORT_VIEWER',
    'Source links must stay read-only',
  ]) {
    requireText(spec, phrase)
  }
})

test('store performance replay surface spec blocks unsafe replay claims', () => {
  for (const phrase of [
    'Do not build the Replay UI yet.',
    'AI narrative and automatic recommendations are out of scope.',
    'It must not answer:',
    'why performance changed',
    'who is at fault',
    'which action caused a KPI movement',
    'raw audit payloads',
    'generic event bus',
    'causal impact labels',
    'copy implies "because", "caused", "improved due to", or blame',
  ]) {
    requireText(spec, phrase)
  }
})

test('store performance replay surface spec defines verification before UI', () => {
  for (const phrase of [
    'Slice A, still no UI:',
    'Pure view-model helper:',
    'Visible surface:',
    'targeted Playwright',
    'mobile viewport screenshot/browser check',
    'route/scope matrix evidence update if visibility changes',
    'Codex review before merge',
  ]) {
    requireText(spec, phrase)
  }
})
