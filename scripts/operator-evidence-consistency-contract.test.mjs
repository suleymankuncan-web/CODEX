import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requireText(text, expected) {
  assert.match(text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

const planPath = 'docs/plans/operator-evidence-consistency-pass-v1.md'
const plan = readText(planPath)
const currentState = readText('docs/history/current-state-through-pr-913-2026-07-09.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const debtLedger = readText('docs/plans/project-debt-ledger.md')
const importBatchDetailPage = readText('admin-web/src/pages/ImportBatchDetailPage.tsx')
const importBatchDetailMessages = readText('admin-web/src/features/localization/messages/import-batch-detail.ts')
const masterDataBootstrapPage = readText('admin-web/src/pages/MasterDataBootstrapPage.tsx')
const masterDataBootstrapBatchDetailPanel = readText(
  'admin-web/src/pages/master-data-bootstrap-batch-detail-panel.tsx',
)
const masterDataControlCenterPage = readText('admin-web/src/pages/master-data-control-center-page.tsx')
const masterDataControlCenterDetail = readText('admin-web/src/pages/master-data-control-center-detail.tsx')
const masterDataMessages = readText('admin-web/src/features/localization/messages/admin-master-data.ts')
const integrationSurfacesSpec = readText('admin-web/e2e/integration-surfaces.spec.ts')

test('operator evidence consistency keeps the no-new-workflow boundary', () => {
  for (const phrase of [
    '# Operator Evidence Consistency Pass V1',
    'No new workflow is introduced.',
    'No endpoint is added.',
    'No backend behavior is changed.',
    'No broad UI redesign is included.',
  ]) {
    requireText(plan, phrase)
  }
})

test('operator evidence consistency locks the shared evidence dictionary', () => {
  for (const phrase of [
    'Go / Conditional Go / No-Go',
    'row evidence',
    'dry-run evidence',
    'sanitized evidence',
    'retry evidence',
    'dependency mapping',
  ]) {
    requireText(plan, phrase)
  }
})

test('operator evidence copy is visible on existing admin surfaces', () => {
  for (const phrase of [
    'Conditional Go: review row evidence, quality guard, retry evidence, and dependency mapping before treating this batch as clean.',
    'Go / Conditional Go / No-Go',
  ]) {
    requireText(importBatchDetailMessages, phrase)
  }

  for (const phrase of [
    'importBatchDetail.conditionalReviewSummary',
    'importBatchDetail.operatorDecisionCopy',
  ]) {
    requireText(importBatchDetailPage, phrase)
  }

  for (const phrase of [
    'Conditional Go: bu partiyi temiz saymadan önce satır kanıtını, kalite kontrolünü, tekrar deneme kanıtını ve bağımlılık eşlemesini incele.',
    'Go / Conditional Go / No-Go',
  ]) {
    requireText(integrationSurfacesSpec, phrase)
  }

  for (const phrase of [
    'Open a batch to inspect row evidence, dry-run evidence, readiness counters, and promotion state.',
    'Dry-run evidence only. No rows are promoted from this panel; promotion still requires the explicit command.',
  ]) {
    requireText(masterDataMessages, phrase)
  }

  requireText(masterDataBootstrapPage, 'MasterDataControlCenterPage')
  requireText(masterDataControlCenterPage, 'İçe Aktarım')
  requireText(masterDataControlCenterDetail, 'Kayda işle')
  requireText(masterDataBootstrapBatchDetailPanel, 'adminMasterData.dryRunCopy')

  requireText(
    integrationSurfacesSpec,
    'Ana Veri Kontrolü',
  )
  requireText(
    integrationSurfacesSpec,
    'İçe Aktarım',
  )

  for (const phrase of [
    'Satır kanıtı, prova kanıtı, hazırlık sayaçları ve aktarım durumunu incelemek için bir parti aç.',
    'Yalnızca prova kanıtı. Bu panelden satır aktarılmaz; aktarım hâlâ açık komut gerektirir.',
  ]) {
    requireText(integrationSurfacesSpec, phrase)
  }
})

test('operator evidence consistency is linked from handoff and debt docs', () => {
  for (const text of [currentState, activeNextActions, debtLedger]) {
    requireText(text, planPath)
    requireText(text, 'Operator Evidence Consistency Pass V1')
  }
  assert.match(activeNextActions, /Closed active debts: \d+/)
  assert.match(debtLedger, /Closed active debts: \d+/)
  requireText(debtLedger, '71. Operator Evidence Consistency Pass V1')
})
