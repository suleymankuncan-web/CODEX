import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = process.cwd()
const routeFile = join(workspaceRoot, 'admin-web/src/pages/StoreChecklistsPage.tsx')
const workflowFile = join(
  workspaceRoot,
  'admin-web/src/features/checklist-workflow/ChecklistWorkflowLegacySurface.tsx',
)
const controllerFile = join(
  workspaceRoot,
  'admin-web/src/features/checklist-workflow/useChecklistWorkflowLegacyController.tsx',
)

test('checklist route delegates legacy workflow ownership to the checklist feature', () => {
  assert.equal(existsSync(workflowFile), true, 'feature-owned workflow surface must exist')
  assert.equal(existsSync(controllerFile), true, 'feature-owned workflow controller must exist')

  const routeSource = readFileSync(routeFile, 'utf8')
  const workflowSource = readFileSync(workflowFile, 'utf8')
  const controllerSource = readFileSync(controllerFile, 'utf8')

  assert.match(routeSource, /ChecklistWorkflowLegacySurface/)
  assert.doesNotMatch(routeSource, /function StoreChecklistsLegacyPage/)
  assert.doesNotMatch(routeSource, /useMutation\(/)
  assert.match(workflowSource, /export function ChecklistWorkflowLegacySurface/)
  assert.match(workflowSource, /useChecklistWorkflowLegacyController/)
  assert.match(controllerSource, /startMobileChecklistInstance/)
  assert.match(controllerSource, /saveMobileChecklistResponse/)
  assert.match(controllerSource, /completeMobileChecklistInstance/)
  assert.match(controllerSource, /acknowledgeChecklist/)
})
