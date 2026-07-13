import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const currentState = readFileSync('current-state.md', 'utf8')
const archive = readFileSync(
  'docs/history/current-state-through-pr-913-2026-07-09.md',
  'utf8',
)
const transitionArchive = readFileSync(
  'docs/history/operating-truth-alignment-plan-execution-2026-07-10.md',
  'utf8',
)

function requireText(text, expected) {
  assert.ok(text.includes(expected), `expected text: ${expected}`)
}

test('active handoff stays short and points historical detail to the archive', () => {
  const lineCount = currentState.split(/\r?\n/).length

  assert.ok(lineCount >= 150, `expected a useful handoff, got ${lineCount} lines`)
  assert.ok(lineCount <= 250, `active handoff grew to ${lineCount} lines`)
  requireText(currentState, 'Status: active')
  requireText(currentState, 'Shelf: operating')
  requireText(
    currentState,
    'docs/history/current-state-through-pr-913-2026-07-09.md',
  )
  requireText(
    currentState,
    'docs/history/operating-truth-alignment-plan-execution-2026-07-10.md',
  )
  requireText(archive, 'Status: historical')
  requireText(archive, 'Superseded by: `current-state.md`')
  requireText(transitionArchive, 'Status: historical')
  requireText(transitionArchive, 'Shelf: historical')
  requireText(transitionArchive, 'Superseded by: `current-state.md`')
})

test('active handoff records the owner-approved operating truth', () => {
  for (const expected of [
    'Controlled staging/internal pilot: `Conditional Go / Continue`',
    'Broad production rollout: `No-Go`',
    'Separate mobile app: discovery/planning only; implementation is not active',
    'The owner approved autonomous execution of',
    'nearest-rank p95 is `13.23` minutes',
    'Keep all 371 tests and two CI workers',
    'The product owner attested that checklist approval, Store Action task closure,',
    'Optional follow-up evidence is:',
    'account-recovery evidence if recovery becomes a pilot requirement',
    'next evidence action is a sanitized read-only reason classification',
    'docs/evidence/pilot-readiness/2026-07-05-owner-attested-mutation-flows.md',
    'GitHub Codex review is disabled by explicit owner direction as of 2026-07-10',
    'Do not trigger `@codex review`, request it through another integration, or',
    'GitHub Codex review becomes active again only after a newer explicit owner',
    'canonical 30-second GitHub status loop',
    'docs/plans/workspace-hygiene-inventory-2026-07-09.md',
  ]) {
    requireText(currentState, expected)
  }

  for (const heading of ['Now:', 'Next:', 'Park:', 'Stop:']) {
    requireText(currentState, heading)
  }
})

test('active handoff does not regain stale archive-only direction', () => {
  for (const staleText of [
    'Fresh verified state on',
    '## Recovered Thread Summary',
    'Architecture Hardening V5 is the active follow-up debt line',
    'Current user direction on 2026-05-18',
    'docs/plans/repo-hygiene-contract-v1.md',
  ]) {
    assert.ok(!currentState.includes(staleText), `stale text returned: ${staleText}`)
  }
})
