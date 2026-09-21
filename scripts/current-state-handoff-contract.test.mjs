import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const currentState = readFileSync('current-state.md', 'utf8')
const archivedState = readFileSync('docs/history/current-state-before-context-budget-2026-09-18.md', 'utf8')
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

function assertActiveHandoff(text) {
  // Count characters, not lines: long single-line paragraphs are still context.
  assert.ok([...text.replace(/\r\n/g, '\n')].length <= 6500, 'active handoff exceeds character budget')
  for (const heading of ['## Now', '## Next', '## Active Evidence Gates', '## Park', '## Stop']) {
    requireText(text, heading)
  }
  for (const boundary of [
    'Last verified:', 'Conditional Go / Continue', 'Broad production rollout: `No-Go`',
    'Deployment of this change is not established', 'outside Git',
    'Reusable live connector mapping, hosted scheduling, and Excel replacement remain suspended.',
    'default-off and advisory-only', 'no authorized winners/manifests',
  ]) requireText(text, boundary)
  assert.doesNotMatch(text, /PDF implementation remains excluded from main|pending PR\/deployment|ONP-3B is active on/)
}

test('active handoff stays bounded and links preserved historical evidence', () => {
  assertActiveHandoff(currentState)
  requireText(currentState, 'Status: active')
  requireText(currentState, 'Shelf: operating')
  requireText(currentState, 'docs/history/current-state-before-context-budget-2026-09-18.md')
  requireText(archivedState, 'Status: historical')
  requireText(archivedState, 'Superseded by: `current-state.md`')
  requireText(
    archivedState,
    'docs/history/current-state-through-pr-913-2026-07-09.md',
  )
  requireText(
    archivedState,
    'docs/history/operating-truth-alignment-plan-execution-2026-07-10.md',
  )
  requireText(archive, 'Status: historical')
  requireText(archive, 'Superseded by: `current-state.md`')
  requireText(transitionArchive, 'Status: historical')
  requireText(transitionArchive, 'Shelf: historical')
  requireText(transitionArchive, 'Superseded by: `current-state.md`')
})

test('historical owner decisions remain preserved without loading them on resume', () => {
  for (const expected of [
    'Controlled staging/internal pilot: `Conditional Go / Continue`',
    'Broad production rollout: `No-Go`',
    'Separate mobile app: discovery/planning only; implementation is not active',
    'The owner approved autonomous execution of',
    'nearest-rank p95 was `13.23` minutes for that historical 371-case cohort',
    'complete current inventory, root contracts, volatile audits and two CI workers remain mandatory',
    'The product owner attested that checklist approval, Store Action task closure,',
    'Optional follow-up evidence is:',
    'account-recovery evidence if recovery becomes a pilot requirement',
    'every bucket is `owner_input_required`',
    'browser-cookie sessions re-read application-account status',
    'TREF-1 locks `completed_snapshot`, `whole_month_latest_approved`',
    'docs/evidence/pilot-readiness/2026-07-05-owner-attested-mutation-flows.md',
    'GitHub Codex review is disabled by explicit owner direction as of 2026-07-10',
    'Do not trigger `@codex review`, request it through another integration, or',
    'GitHub Codex review becomes active again only after a newer explicit owner',
    'canonical 55-60 second GitHub status loop',
    'check:release -- --resume',
    'docs/plans/workspace-hygiene-inventory-2026-07-09.md',
  ]) {
    requireText(archivedState, expected)
  }

  for (const heading of ['Now:', 'Next:', 'Park:', 'Stop:']) {
    requireText(archivedState, heading)
  }
})

test('handoff budget cannot be bypassed with one long line or missing safety fields', () => {
  assert.throws(() => assertActiveHandoff(currentState + 'x'.repeat(6501)))
  assert.throws(() => assertActiveHandoff(currentState.replace('## Stop', '## Removed')))
  assert.throws(() => assertActiveHandoff(currentState.replace('Broad production rollout: `No-Go`', 'Broad rollout enabled')))
  assert.throws(() => assertActiveHandoff(currentState + '\nPDF implementation remains excluded from main'))
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
