import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function readText(path) {
  return readFileSync(path, 'utf8')
}

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

function extractCount(text, label) {
  const match = text.match(new RegExp(`- ${label}: (\\d+)`))
  assert.ok(match, `Missing count for ${label}`)
  return Number(match[1])
}

function extractSection(text, startHeading, endHeading) {
  const start = text.indexOf(startHeading)
  assert.notEqual(start, -1, `Missing section start: ${startHeading}`)
  const end = text.indexOf(endHeading, start + startHeading.length)
  assert.notEqual(end, -1, `Missing section end: ${endHeading}`)
  return text.slice(start, end)
}

function extractNumberedItems(section) {
  return Array.from(section.matchAll(/^(\d+)\. .+$/gm)).map((match) => Number(match[1]))
}

function extractLastDebtLedgerBlock(text) {
  const marker = 'Debt ledger snapshot remains canonical'
  const start = text.lastIndexOf(marker)
  assert.notEqual(start, -1, `Missing latest ${marker} block`)
  const nextHeading = text.indexOf('\n## ', start + marker.length)
  return nextHeading === -1 ? text.slice(start) : text.slice(start, nextHeading)
}

const currentState = readText('current-state.md')
const historicalHandoff = readText(
  'docs/history/current-state-through-pr-913-2026-07-09.md',
)
const activeNextActions = readText('docs/plans/active-next-actions.md')
const debtLedger = readText('docs/plans/project-debt-ledger.md')

test('project debt ledger closed count matches the numbered closed debt list', () => {
  const expectedCount = extractCount(debtLedger, 'Closed active debts')
  const closedDebtSection = extractSection(
    debtLedger,
    '## Closed Active Debts',
    '## Superseded Before Overbuilding',
  )
  const items = extractNumberedItems(closedDebtSection)

  assert.equal(items.length, expectedCount)
  assert.equal(items.at(-1), expectedCount)
  assert.deepEqual(items, Array.from({ length: expectedCount }, (_, index) => index + 1))
  requireText(debtLedger, 'Project Debt Ledger Consistency Guard V1')
})

test('active next actions mirrors project debt ledger snapshot counts', () => {
  for (const label of [
    'Closed active debts',
    'Superseded before overbuilding',
    'Blocked external dependency',
    'Watchlist decision item',
    'Strategic investment backlog',
    'Silent untracked quality debt in the active gate',
  ]) {
    assert.equal(extractCount(activeNextActions, label), extractCount(debtLedger, label), label)
  }
})

test('current state latest debt ledger block mirrors project debt ledger snapshot counts', () => {
  const latestCurrentStateDebtLedger = extractLastDebtLedgerBlock(currentState)

  for (const label of [
    'Closed active debts',
    'Strategic investment backlog',
    'Silent untracked quality debt in the active gate',
  ]) {
    assert.equal(extractCount(latestCurrentStateDebtLedger, label), extractCount(debtLedger, label), label)
  }
})

test('handoff docs record the project debt ledger consistency guard', () => {
  for (const text of [currentState, activeNextActions, debtLedger]) {
    requireText(text, 'Project Debt Ledger Consistency Guard V1')
  }
})

test('controlled pilot operating checklist is counted as closed evidence work', () => {
  requireText(debtLedger, '91. Controlled Pilot Operating Checklist V1')
  requireText(debtLedger, 'Controlled Pilot Operating Checklist V1 is counted as paid because')
  requireText(activeNextActions, 'Controlled Pilot Operating Checklist V1 is counted as paid')
  requireText(
    historicalHandoff,
    '`docs/plans/controlled-pilot-operating-checklist-v1.md` - Controlled Pilot Operating Checklist V1',
  )
})
