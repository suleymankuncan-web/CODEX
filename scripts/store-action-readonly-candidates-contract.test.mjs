import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const evidence = readFileSync('docs/evidence/store-action-readonly-candidates-v1.md', 'utf8')
const sourceGuardEvidence = readFileSync('docs/evidence/store-action-source-guard-v1.md', 'utf8')
const checklistSourceDecision = readFileSync('docs/evidence/store-action-checklist-source-decision-v1.md', 'utf8')
const sourcePlan = readFileSync('docs/plans/store-action-coaching-loop-v1.md', 'utf8')

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
  assert.match(helper, /kpi_exception: 'read_only_candidate'/)
  assert.match(helper, /STORE_ACTION_WORKFLOW_SOURCE_DECISIONS\[item\.sourceType\] === 'read_only_candidate'/)
  assert.match(helper, /item\.itemType === 'task'/)
  assert.match(helper, /item\.inboxStatus === 'needs_attention'/)
})

test('store action source guard parks acknowledgement and approval workflow sources', () => {
  const helper = readFileSync('admin-web/src/features/store-actions/candidates.ts', 'utf8')

  assert.match(helper, /STORE_ACTION_WORKFLOW_SOURCE_DECISIONS/)
  assert.match(helper, /satisfies Record<WorkflowInboxItem\['sourceType'\], StoreActionWorkflowSourceDecision>/)
  assert.match(helper, /checklist_receipt: 'parked_acknowledgement_boundary'/)
  assert.match(helper, /target_distribution_request: 'parked_approval_boundary'/)

  assert.match(sourceGuardEvidence, /checklist_receipt/)
  assert.match(sourceGuardEvidence, /parked_acknowledgement_boundary/)
  assert.match(sourceGuardEvidence, /target_distribution_request/)
  assert.match(sourceGuardEvidence, /parked_approval_boundary/)
  assert.match(sourceGuardEvidence, /not automatically a coaching candidate/)
  assert.match(sourcePlan, /V1A Source Guard Decision/)
})

test('store action checklist source decision routes score follow-up through KPI exceptions', () => {
  const kpiConfig = readFileSync('backend/nestjs/src/modules/store-ops/application/kpi-config.contract.ts', 'utf8')
  const workflowContract = readFileSync('backend/nestjs/src/modules/store-ops/application/workflow-inbox.contract.ts', 'utf8')

  assert.match(checklistSourceDecision, /BM_CHECKLIST/)
  assert.match(checklistSourceDecision, /VM_CHECKLIST/)
  assert.match(checklistSourceDecision, /KPI exception source/)
  assert.match(checklistSourceDecision, /Do not create direct `checklist_receipt` Store Action candidates/)
  assert.match(checklistSourceDecision, /direct Store Action low-score threshold owner/)
  assert.match(sourcePlan, /V1A Checklist Source Decision/)

  assert.match(kpiConfig, /code: "BM_CHECKLIST"[\s\S]*?scoreBehavior: "task_candidate"/)
  assert.match(kpiConfig, /code: "VM_CHECKLIST"[\s\S]*?scoreBehavior: "task_candidate"/)
  assert.match(workflowContract, /itemType: "acknowledgement"[\s\S]*?sourceType: "checklist_receipt"/)
  assert.match(workflowContract, /itemType: "task"[\s\S]*?sourceType: "kpi_exception"/)
})
