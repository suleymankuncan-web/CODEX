import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const moduleUrl = new URL('../src/pages/store-me-performance-badges.ts', import.meta.url)
const source = await readFile(moduleUrl, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    verbatimModuleSyntax: true,
  },
})
const badges = await import(
  `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`
)

function base(overrides = {}) {
  return {
    currentPeriodDataQuality: 'trusted',
    periodKey: '2026-06-01',
    previousPeriodScore: null,
    previousPeriodTurkeyRank: null,
    regionPopulation: 78,
    regionRank: 12,
    score: 87,
    scoreHistory: [74, 76, 87],
    storePopulation: 4,
    storeRank: 3,
    targetAchievementPercent: null,
    turkeyPopulation: 842,
    turkeyRank: 24,
    ...overrides,
  }
}

test('store me badge resolver follows the locked priority order', () => {
  assert.equal(badges.resolveStoreMePerformanceBadge(base({ turkeyRank: 1 }))?.code, 'TURKEY_1')
  assert.equal(badges.resolveStoreMePerformanceBadge(base({ turkeyRank: 5, storeRank: 1 }))?.code, 'TOP_1_PERCENT')
  assert.equal(badges.resolveStoreMePerformanceBadge(base({ storeRank: 1 }))?.code, 'STORE_LEADER')
  assert.equal(badges.resolveStoreMePerformanceBadge(base({ regionRank: 2, storeRank: 4 }))?.code, 'REGION_TOP_3')
})

test('store me badge resolver handles improvement, target and consistency badges', () => {
  assert.equal(
    badges.resolveStoreMePerformanceBadge(base({
      previousPeriodScore: 80,
      previousPeriodTurkeyRank: 95,
      regionRank: 12,
      score: 82,
      storeRank: 4,
      turkeyRank: 60,
    }))?.code,
    'RISING_STAR',
  )
  assert.equal(
    badges.resolveStoreMePerformanceBadge(base({
      regionRank: 12,
      scoreHistory: [54, 68, 87],
      storeRank: 4,
      targetAchievementPercent: 136,
    }))?.code,
    'TARGET_ABOVE',
  )
  assert.equal(
    badges.resolveStoreMePerformanceBadge(base({
      regionRank: 12,
      scoreHistory: [74, 76, 72],
      storeRank: 4,
      targetAchievementPercent: null,
    }))?.code,
    'CONSISTENT_PERFORMER',
  )
})

test('store me badge resolver rejects missing, partial and single-person leadership data', () => {
  assert.equal(badges.resolveStoreMePerformanceBadge(base({ turkeyRank: null })), null)
  assert.equal(badges.resolveStoreMePerformanceBadge(base({ currentPeriodDataQuality: 'partial' })), null)
  assert.notEqual(
    badges.resolveStoreMePerformanceBadge(base({ storeRank: 1, storePopulation: 1 }))?.code,
    'STORE_LEADER',
  )
})

test('store me percentile display never returns zero', () => {
  assert.equal(badges.getStoreMePerformancePercentile({ turkeyRank: 1, turkeyPopulation: 842 }), 1)
  assert.equal(badges.getStoreMePerformancePercentile({ turkeyRank: null, turkeyPopulation: 842 }), null)
})
