import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const evidencePath =
  'docs/evidence/project-health-uplift-pr4-store-persona-regression-pack-2026-06-08.md'

const protectedEvidence = [
  {
    file: 'backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts',
    phrases: [
      'reads selected store KPI highlights when the store is inside active region-manager scope',
      'does not trust aggregate region scope for dual-role selected store KPI highlights',
      'allows selected store KPI highlights inside assigned store scope',
      'does not score personnel target achievement without an approved target',
    ],
  },
  {
    file: 'backend/nestjs/src/modules/store-ops/application/ranking.service.spec.ts',
    phrases: [
      'marks personnel profile navigation from active assignment scope, not ranking period region',
      'keeps store manager global rankings summary-only while exposing own-store personnel details',
      'caps store personnel to Turkey Top 100 summary rows and includes own position outside the top list',
    ],
  },
  {
    file: 'backend/nestjs/src/modules/store-ops/infrastructure/workforce-lookup-read.repository.spec.ts',
    phrases: [
      'uses employee hire date as the store workforce start-date fallback',
    ],
  },
  {
    file: 'backend/nestjs/src/modules/store-ops/application/workforce.service.headcount-gap.spec.ts',
    phrases: [
      'keeps workforce request lists limited to assigned stores even when read scope is broader',
      'allows a region manager to read headcount gap for a store in their region',
      'blocks a region manager from reading headcount gap outside their region',
    ],
  },
]

function requireText(text, expected) {
  assert.ok(text.includes(expected), `missing required text: ${expected}`)
}

test('Store persona regression pack evidence maps recent bug classes to real tests', () => {
  const evidence = readFileSync(evidencePath, 'utf8')

  for (const expected of [
    'Region Manager assigned-store KPI visibility',
    'Missing personnel target fallback',
    'Ranking profile action visibility',
    'Store personnel Top 100 cap',
    'Workforce assigned-store rows',
    'Workforce tenure/start date',
    'Targeted Verification Set',
    'Stop Conditions',
  ]) {
    requireText(evidence, expected)
  }
})

test('Store persona regression pack points to existing test cases', () => {
  const evidence = readFileSync(evidencePath, 'utf8')

  for (const { file, phrases } of protectedEvidence) {
    const text = readFileSync(file, 'utf8')
    requireText(evidence, file)

    for (const phrase of phrases) {
      requireText(text, phrase)
      requireText(evidence, phrase)
    }
  }
})

test('Store persona regression pack blocks runtime-behavior claims', () => {
  const evidence = readFileSync(evidencePath, 'utf8')

  for (const expected of [
    'does not change Store UI',
    'does not change Store UI,\nbackend behavior',
    'If any protected behavior above must change',
  ]) {
    requireText(evidence, expected)
  }
})
