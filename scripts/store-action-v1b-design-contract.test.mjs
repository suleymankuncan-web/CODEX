import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const design = readFileSync('docs/plans/store-action-v1b-persisted-action-plan-design-v1.md', 'utf8')
const plan = readFileSync('docs/superpowers/plans/2026-05-22-store-action-v1b-persisted-action-plans.md', 'utf8')
const coachingPlan = readFileSync('docs/plans/store-action-coaching-loop-v1.md', 'utf8')
const v1bDecision = readFileSync('docs/evidence/store-action-persisted-action-plan-v1b-decision.md', 'utf8')

test('store action V1B design keeps write scope explicit', () => {
  assert.match(design, /ops\.store_action_plan/)
  assert.match(design, /source_type IN \('kpi_exception'\)/)
  assert.match(design, /Write actions require assigned-store action scope/)
  assert.match(design, /read scope alone does not allow write/)
  assert.match(design, /duplicate active source create fails with 409/)
  assert.match(design, /DB, commands, auth action\s+scope, audit, OpenAPI, workflow inbox, and UI/)
})

test('store action V1B design preserves source-domain boundaries', () => {
  assert.match(design, /KPI exception candidates/)
  assert.match(design, /Parked direct sources/)
  assert.match(design, /checklist_receipt/)
  assert.match(design, /target_distribution_request/)
  assert.match(design, /must not reinterpret KPI score math, checklist scores, target\s+approval/)
  assert.match(coachingPlan, /V1B Detailed Design/)
})

test('store action V1B design defines API and workflow semantics before code', () => {
  assert.match(design, /GET \/api\/store-actions\/plans/)
  assert.match(design, /POST \/api\/store-actions\/plans/)
  assert.match(design, /PATCH \/api\/store-actions\/plans\/:actionPlanId\/close/)
  assert.match(design, /store_action_plan/)
  assert.match(design, /itemType.*task/s)
  assert.match(design, /OpenAPI and generated frontend types are required/)
})

test('store action V1B implementation plan is staged and guarded', () => {
  assert.match(plan, /Task 1: Schema Contract And Migration/)
  assert.match(plan, /Task 2: Audit Catalog And Lifecycle Contract/)
  assert.match(plan, /Task 3: Repository And Service Commands/)
  assert.match(plan, /Task 4: Controller, DTOs, OpenAPI, Generated Client/)
  assert.match(plan, /Task 5: Workflow Inbox Integration/)
  assert.match(plan, /Task 6: Minimal Store Tasks UI/)
  assert.match(plan, /Do not hand-roll fetch shapes/)
  assert.doesNotMatch(plan, /\bTBD\b|\bTODO\b|fill in details|Similar to Task/)
})

test('store action V1B design is consistent with the prior go no-go decision', () => {
  assert.match(v1bDecision, /NO-GO for V1B implementation right now/)
  assert.match(design, /Do not implement V1B code in the design PR/)
  assert.match(design, /Proceed with V1B design as the next safe step/)
})
