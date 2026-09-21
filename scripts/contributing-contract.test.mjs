import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'

const contributingPath = 'CONTRIBUTING.md'

function readContributing() {
  return readFileSync(contributingPath, 'utf8')
}

function requireText(text, expected) {
  assert.ok(text.replace(/\s+/g, ' ').includes(expected.replace(/\s+/g, ' ')), `Missing contract: ${expected}`)
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
    'KPI scoring/ranking/checklist weights',
  ]) {
    requireText(text, expected)
  }
})

test('contributing contract requires current-state merge closeout', () => {
  const text = readContributing()

  for (const expected of [
    'Merge Closeout',
    'After merge, verify `origin/main`',
    'update `current-state.md` when',
  ]) {
    requireText(text, expected)
  }
})

test('operating documents route readers through live canonical Markdown links', () => {
  const paths = [
    'AGENTS.md', 'CONTRIBUTING.md', 'sokrates.md', 'discipline.md', 'current-state.md',
    'docs/process/execution-release.md', 'docs/process/execution-ui.md',
    'docs/process/execution-maintenance.md', 'docs/process/decision-risk-reference.md',
    '.agents/skills/hr-axis-ui/SKILL.md', 'SKILL/ui-ux-pro-max/SKILL.md',
  ]
  requireText(readContributing(), 'AGENTS.md#reading-map')
  requireText(readFileSync('sokrates.md', 'utf8'), 'AGENTS.md#reading-map')
  for (const path of paths) {
    const text = readFileSync(path, 'utf8')
    for (const [, target, anchor] of text.matchAll(/\]\(([^\s()]+\.md)(?:#([^\s()]+))?\)/g)) {
      if (/^https?:/.test(target)) continue
      const absolute = resolve(dirname(path), target)
      assert.ok(existsSync(absolute), `${path}: missing canonical document ${target}`)
      if (!anchor) continue
      const headings = [...readFileSync(absolute, 'utf8').matchAll(/^#{1,6}\s+(.+)$/gm)]
        .map(([, title]) => title.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-'))
      assert.ok(headings.includes(anchor), `${path}: missing canonical heading ${target}#${anchor}`)
    }
  }
})
