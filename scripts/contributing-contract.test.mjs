import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const contributingPath = 'CONTRIBUTING.md'

function readContributing() {
  return readFileSync(contributingPath, 'utf8')
}

function requireText(text, expected) {
  assert.match(text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

test('root contributing contract exists', () => {
  assert.equal(existsSync(contributingPath), true)
})

test('contributing contract requires the operating docs', () => {
  const text = readContributing()

  for (const expected of ['current-state.md', 'sokrates.md', 'discipline.md']) {
    requireText(text, expected)
  }
})

test('contributing contract locks the Store UI stack', () => {
  const text = readContributing()

  for (const expected of ['shadcn/ui', 'Tailwind v4', 'lucide']) {
    requireText(text, expected)
  }
})

test('contributing contract rejects fake metrics and data', () => {
  const text = readContributing()

  for (const expected of [
    'No fake metrics/data',
    'fake metric',
    'fake coaching',
    'fake ranking',
    'fake trend',
  ]) {
    requireText(text, expected)
  }
})

test('contributing contract keeps PR risk separation explicit', () => {
  const text = readContributing()

  for (const expected of [
    'Risk Separation',
    'Never mix UI polish or docs cleanup',
    'API response shape',
    'auth or permission semantics',
    'KPI scoring, ranking sort, or checklist weights',
  ]) {
    requireText(text, expected)
  }
})

test('contributing contract requires current-state merge closeout', () => {
  const text = readContributing()

  for (const expected of [
    'Merge Closeout',
    'After merge, verify `origin/main`',
    '`current-state.md` is updated when',
  ]) {
    requireText(text, expected)
  }
})
