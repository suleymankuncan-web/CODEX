import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const evidence = readFileSync('docs/evidence/store-action-readonly-candidates-v1.md', 'utf8')

test('store action V1A evidence keeps the read-only boundary explicit', () => {
  assert.match(evidence, /read-only Store\s+Action candidate source/)
  assert.match(evidence, /Do not create `\/api\/store-actions\/candidates` yet/)
  assert.match(evidence, /does not add a new endpoint, DB table, migration, workflow state machine/)
  assert.match(evidence, /`task`, not approval/)
})

test('store action V1A evidence names the existing source of truth', () => {
  assert.match(evidence, /\/api\/workflow\/inbox/)
  assert.match(evidence, /sourceType: "kpi_exception"/)
  assert.match(evidence, /SnapshotReportingReadRepository\.getKpiReport/)
  assert.match(evidence, /assigned stores/)
})

test('store tasks derives candidates through the Store Action helper', () => {
  const page = readFileSync('admin-web/src/pages/StoreTasksPage.tsx', 'utf8')
  const helper = readFileSync('admin-web/src/features/store-actions/candidates.ts', 'utf8')

  assert.match(page, /buildReadOnlyStoreActionCandidates/)
  assert.match(helper, /item\.sourceType === 'kpi_exception'/)
  assert.match(helper, /item\.itemType === 'task'/)
  assert.match(helper, /item\.inboxStatus === 'needs_attention'/)
})
