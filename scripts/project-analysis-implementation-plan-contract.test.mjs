import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const planPath = 'docs/plans/project-analysis-implementation-plan-v1.md'
const plan = readFileSync(planPath, 'utf8')

function requireText(text, expected) {
  assert.ok(text.includes(expected), `expected text: ${expected}`)
}

test('project analysis implementation plan has the mandatory spec sections', () => {
  for (const section of [
    '## 1. Context',
    '## 2. Objective And Success Definition',
    '## 3. Functional Requirements',
    '## 4. Non-Functional Requirements',
    '## 5. Acceptance Criteria',
    '## 6. Edge Cases And Failure Modes',
    '## 7. API Contracts',
    '## 8. Data Models',
    '## 9. Out Of Scope',
    '## 11. Ordered Execution Plan',
    '## 13. Verification Ladder',
    '## 15. Stop And Escalation Rules',
    '## 16. Definition Of Plan Completion',
  ]) {
    requireText(plan, section)
  }

  requireText(plan, 'Status: guarded')
  requireText(plan, 'Spec status: Draft - implementation requires explicit owner approval')
})

test('requirements and acceptance criteria are complete and traceable', () => {
  const requirementIds = new Set()

  for (let index = 1; index <= 17; index += 1) {
    const id = `FR-${index}`
    requireText(plan, `**${id}:`)
    requirementIds.add(id)
  }

  for (let index = 1; index <= 7; index += 1) {
    const id = `NFR-${index}`
    requireText(plan, `**${id} `)
    requirementIds.add(id)
  }

  for (let index = 1; index <= 15; index += 1) {
    const id = `AC-${index}`
    const line = plan.split(/\r?\n/).find((item) => item.startsWith(`- **${id} (`))
    assert.ok(line, `missing acceptance criterion: ${id}`)

    const references = [...line.matchAll(/(?:FR|NFR)-\d+/g)].map((match) => match[0])
    assert.ok(references.length > 0, `${id} must reference at least one requirement`)
    for (const reference of references) {
      assert.ok(requirementIds.has(reference), `${id} references unknown requirement ${reference}`)
    }
  }
})

test('execution order keeps runtime and broad production behind explicit gates', () => {
  for (const expected of [
    '### PR-A1 - Required Release Gate Alignment',
    '### PR-A2 - Remove Duplicate Full Frontend Execution',
    '### PR-A3 - E2E Timing And Safe Sharding',
    '### Pilot-B1 - Controlled Pilot/Demo Evidence Pass',
    '### PR-Cx - Finding-Specific Runtime Fix',
    '### Gate-F1 - Broad Production Reopen Decision',
    'required before the next runtime PR',
    'an approved P0/P1 finding',
    'Broad-production work **MUST** remain blocked',
    'This plan **MUST NOT** authorize deletion',
  ]) {
    requireText(plan, expected)
  }
})

test('operating documents point to the guarded plan', () => {
  for (const path of [
    'current-state.md',
    'docs/README.md',
    'docs/plans/active-next-actions.md',
    'docs/plans/decision-registry-v1.md',
    'docs/plans/project-control-board-v1.md',
  ]) {
    requireText(readFileSync(path, 'utf8'), planPath)
  }
})
