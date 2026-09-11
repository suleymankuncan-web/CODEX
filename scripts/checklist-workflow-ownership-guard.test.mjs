import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = process.cwd()
const routeFile = join(workspaceRoot, 'admin-web/src/pages/StoreChecklistsPage.tsx')
const overlayFile = join(
  workspaceRoot,
  'admin-web/src/features/checklist-workflow/ChecklistWorkflowCommandOverlay.tsx',
)
const legacySurfaceFile = join(workspaceRoot, 'admin-web/src/features/checklist-workflow/ChecklistWorkflowLegacySurface.tsx')
const controllerFile = join(
  workspaceRoot,
  'admin-web/src/features/checklist-workflow/useChecklistWorkflowController.tsx',
)

test('checklist route owns only Command Canvas personas and the canonical workflow overlay', () => {
  assert.equal(existsSync(overlayFile), true, 'feature-owned workflow overlay must exist')
  assert.equal(existsSync(legacySurfaceFile), false, 'legacy checklist surface must be removed')
  assert.equal(existsSync(controllerFile), true, 'feature-owned workflow controller must exist')

  const routeSource = readFileSync(routeFile, 'utf8')
  const overlaySource = readFileSync(overlayFile, 'utf8')
  const controllerSource = readFileSync(controllerFile, 'utf8')

  assert.doesNotMatch(routeSource, /ChecklistWorkflowLegacySurface/)
  assert.doesNotMatch(routeSource, /function StoreChecklistsLegacyPage/)
  assert.doesNotMatch(routeSource, /useMutation\(/)
  assert.match(routeSource, /RegionManagerChecklistCommandPage/)
  assert.match(routeSource, /ReportViewerChecklistCommandPage/)
  assert.match(routeSource, /usesStoreReportViewerView/)
  assert.match(routeSource, /StoreManagerChecklistCommandPage/)
  assert.match(routeSource, /VisualMerchandiserChecklistCommandPage/)
  assert.doesNotMatch(routeSource, /SuperAdminChecklistCommandPage/)
  assert.match(overlaySource, /export function ChecklistWorkflowCommandOverlay/)
  assert.match(overlaySource, /useChecklistWorkflowController/)
  assert.match(controllerSource, /startMobileChecklistInstance/)
  assert.match(controllerSource, /saveMobileChecklistResponse/)
  assert.match(controllerSource, /completeMobileChecklistInstance/)
  assert.match(controllerSource, /acknowledgeChecklist/)
})

test('orphaned legacy checklist page modules stay deleted', () => {
  for (const relativePath of [
    'admin-web/src/pages/store-checklists-acknowledgement-panels.tsx',
    'admin-web/src/pages/store-checklists-controls.tsx',
    'admin-web/src/pages/store-checklists-hero.tsx',
    'admin-web/src/pages/store-checklists-visit-panel.tsx',
    'admin-web/src/pages/store-checklists-visit-plan.tsx',
  ]) {
    assert.equal(existsSync(join(workspaceRoot, relativePath)), false, `${relativePath} must stay deleted`)
  }
})

test('active checklist deep-link producers use the canonical route contract', () => {
  const producerSources = [
    'admin-web/src/pages/store-home-command-model.ts',
    'admin-web/src/features/checklist-workflow/useChecklistWorkflowController.tsx',
    'backend/nestjs/src/modules/store-ops/application/checklist-remediation-finding.extractor.ts',
    'backend/nestjs/src/modules/store-ops/application/workflow-inbox.contract.ts',
  ].map((relativePath) => readFileSync(join(workspaceRoot, relativePath), 'utf8'))

  const combined = producerSources.join('\n')
  assert.doesNotMatch(combined, /\/store\/checklists\?(?:tab|result|view)=/)
  assert.doesNotMatch(combined, /buildChecklistSearch/)
  assert.match(combined, /\/store\/checklists\?canvasView=plan/)
  assert.match(combined, /overlay=result&checklistInstanceId=/)
  assert.match(combined, /storeId=/)
})
