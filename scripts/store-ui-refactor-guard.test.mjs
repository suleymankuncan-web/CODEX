import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const storeRedesignPlanPath = 'docs/plans/store-surfaces-redesign-implementation-plan-v1.md'
const parkedStoreRouteFiles = new Set([
  'admin-web/src/pages/StoreIncentivesPage.tsx',
  'admin-web/src/features/localization/messages/store-incentives.ts',
])

const activeStoreUiPathspecs = [
  'admin-web/src/pages/Store*.tsx',
  'admin-web/src/pages/store-*.tsx',
  'admin-web/src/app/store*.ts',
  'admin-web/src/app/store*.tsx',
  'admin-web/src/features/store-actions/*.ts',
  'admin-web/src/features/store-actions/*.tsx',
  'admin-web/src/features/localization/messages/store-*.ts',
]

const allowedCurrentMatches = new Map([
  ['admin-web/src/features/localization/messages/store-approvals.ts::debug or handoff copy leaking into Store UI', 1],
  ['admin-web/src/features/localization/messages/store-home.ts::debug or handoff copy leaking into Store UI', 1],
  ['admin-web/src/features/localization/messages/store-rankings.ts::debug or handoff copy leaking into Store UI', 1],
])

const forbiddenActiveStorePatterns = [
  {
    pattern: /\bstore-hero-panel\b/,
    reason: 'legacy Store hero panel class',
  },
  {
    pattern: /\bstore-me-score-card\b/,
    reason: 'legacy Store Me score card class',
  },
  {
    pattern: /\bstore-me-action-panel\b/,
    reason: 'legacy Store Me action panel class',
  },
  {
    pattern: /\bstacked-row\b/,
    reason: 'legacy stacked-row Store layout class',
  },
  {
    pattern: /\bstore-metric-grid\b/,
    reason: 'legacy Store metric grid class',
  },
  {
    pattern: /Resolved Session|Source mode|Weighted score|Turkey ranking|Store ranking/,
    reason: 'debug or handoff copy leaking into Store UI',
  },
  {
    pattern: /fake (metric|coaching|ranking|trend|score|target|todo)/i,
    reason: 'fake Store data or copy',
  },
]

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' })
}

function trackedStoreUiFiles() {
  return git(['ls-files', ...activeStoreUiPathspecs])
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((path) => !parkedStoreRouteFiles.has(path))
}

function activeStoreViolations(files = trackedStoreUiFiles()) {
  const violations = []

  for (const path of files) {
    const text = readFileSync(path, 'utf8')
    for (const { pattern, reason } of forbiddenActiveStorePatterns) {
      const matchCount = [...text.matchAll(new RegExp(pattern, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))]
        .length
      const allowedCount = allowedCurrentMatches.get(`${path}::${reason}`) ?? 0
      if (matchCount > allowedCount) {
        violations.push(`${path}: ${reason} matched ${pattern}`)
      }
    }
  }

  return violations
}

function requireText(text, expected) {
  assert.match(text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

test('Store redesign plan keeps stack, data, role, and parked-route guardrails explicit', () => {
  const text = readFileSync(storeRedesignPlanPath, 'utf8')

  for (const expected of [
    'shadcn/ui',
    'Tailwind v4',
    'lucide-icons/lucide',
    'Do not invent data',
    'Keep role-aware navigation and direct-route availability aligned',
    '/store/incentives` is parked',
    'Do not productize it',
  ]) {
    requireText(text, expected)
  }
})

test('active Store UI files do not reintroduce legacy classes, debug copy, or fake data language', () => {
  assert.deepEqual(activeStoreViolations(), [])
})

test('Store UI guard rejects a synthetic fake-data and legacy-class violation', () => {
  const fakePath = 'admin-web/src/pages/StoreFakePage.tsx'

  const violations = activeStoreViolationsWithReader([fakePath], (path, encoding) => {
    assert.equal(path, fakePath)
    assert.equal(encoding, 'utf8')
    return '<section className="store-hero-panel">fake metric</section>'
  })

  assert.ok(violations.some((violation) => violation.includes('legacy Store hero panel class')))
  assert.ok(violations.some((violation) => violation.includes('fake Store data or copy')))
})

function activeStoreViolationsWithReader(files, reader) {
  const violations = []

  for (const path of files) {
    const text = reader(path, 'utf8')
    for (const { pattern, reason } of forbiddenActiveStorePatterns) {
      const matchCount = [...text.matchAll(new RegExp(pattern, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))]
        .length
      const allowedCount = allowedCurrentMatches.get(`${path}::${reason}`) ?? 0
      if (matchCount > allowedCount) {
        violations.push(`${path}: ${reason} matched ${pattern}`)
      }
    }
  }

  return violations
}
