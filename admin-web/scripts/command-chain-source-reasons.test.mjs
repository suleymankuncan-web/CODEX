import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { Buffer } from 'node:buffer'
import ts from 'typescript'

const moduleUrl = new URL('../src/features/command-chain/source-reasons.ts', import.meta.url)
const source = await readFile(moduleUrl, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    verbatimModuleSyntax: true,
  },
})
const commandChain = await import(
  `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`
)

test('Command Chain reason helper keeps store personnel out of management reasons', () => {
  const reasons = commandChain.buildCommandChainReasonsFromCurrentSources({
    actorRole: 'STORE_PERSONNEL',
    workflowItems: [workflowItem()],
  })

  assert.deepEqual(reasons, [])
})

test('Command Chain reason helper maps workflow and action plan sources without changing source ownership', () => {
  const reasons = commandChain.buildCommandChainReasonsFromCurrentSources({
    actorRole: 'STORE_MANAGER',
    defaultScopeLabel: 'Own store',
    storeActionPlans: [storeActionPlan({ status: 'blocked' })],
    workflowItems: [
      workflowItem({ sourceType: 'kpi_exception', sourceId: 'kpi-1', urgency: 'high' }),
      workflowItem({ sourceType: 'checklist_receipt', sourceId: 'checklist-1' }),
    ],
  })

  assert.equal(reasons[0].sourceFamily, 'store_action')
  assert.equal(reasons[0].statusLabel, 'blocked')
  assert.equal(reasons[1].sourceFamily, 'kpi')
  assert.equal(reasons[2].sourceFamily, 'checklist')
  assert.match(reasons[2].limitation, /inbox evidence only/u)
  assert.ok(reasons.every((reason) => reason.roleVisibilityReason.includes('STORE_MANAGER')))
})

test('Command Chain signal sources skip ready signals and mark unavailable signals as limited proof', () => {
  const reasons = commandChain.buildCommandChainReasonsFromCurrentSources({
    actorRole: 'SUPER_ADMIN',
    signalSources: [
      {
        count: 0,
        family: 'import',
        href: '/admin/integrations',
        lastObservedAt: '2026-05-24T06:00:00.000Z',
        status: 'ready',
      },
      {
        count: null,
        family: 'snapshot',
        href: '/admin/snapshots',
        lastObservedAt: null,
        status: 'unavailable',
      },
    ],
  })

  assert.equal(reasons.length, 1)
  assert.equal(reasons[0].sourceFamily, 'snapshot')
  assert.equal(reasons[0].freshnessLabel, 'unavailable')
  assert.match(reasons[0].limitation, /unavailable/i)
})

test('Command Chain signal sources follow existing admin route role guards', () => {
  const blockedImportReasons = commandChain.buildCommandChainReasonsFromCurrentSources({
    actorRole: 'HR_ADMIN',
    signalSources: [
      {
        count: 1,
        family: 'import',
        href: '/admin/integrations',
        lastObservedAt: '2026-05-24T06:00:00.000Z',
        status: 'attention',
      },
    ],
  })
  const integrationAdminReasons = commandChain.buildCommandChainReasonsFromCurrentSources({
    actorRole: 'INTEGRATION_ADMIN',
    signalSources: [
      {
        count: 1,
        family: 'import',
        href: '/admin/integrations',
        lastObservedAt: '2026-05-24T06:00:00.000Z',
        status: 'attention',
      },
    ],
  })
  const blockedSnapshotReasons = commandChain.buildCommandChainReasonsFromCurrentSources({
    actorRole: 'REPORT_VIEWER',
    signalSources: [
      {
        count: 1,
        family: 'snapshot',
        href: '/admin/snapshots',
        lastObservedAt: '2026-05-24T06:00:00.000Z',
        status: 'attention',
      },
    ],
  })
  const snapshotOperatorReasons = commandChain.buildCommandChainReasonsFromCurrentSources({
    actorRole: 'SNAPSHOT_OPERATOR',
    signalSources: [
      {
        count: 1,
        family: 'snapshot',
        href: '/admin/snapshots',
        lastObservedAt: '2026-05-24T06:00:00.000Z',
        status: 'attention',
      },
    ],
  })

  assert.deepEqual(blockedImportReasons, [])
  assert.equal(integrationAdminReasons[0].sourceFamily, 'import')
  assert.deepEqual(blockedSnapshotReasons, [])
  assert.equal(snapshotOperatorReasons[0].sourceFamily, 'snapshot')
})

test('Command Chain workflow reasons keep low urgency as low severity', () => {
  const [reason] = commandChain.buildCommandChainReasonsFromCurrentSources({
    actorRole: 'STORE_MANAGER',
    workflowItems: [workflowItem({ urgency: 'low' })],
  })

  assert.equal(reason.severityLabel, 'low')
  assert.equal(reason.priority, 40)
})

test('Command Chain workflow source roles follow source route and inbox guards', () => {
  const blockedTargetForStoreManager = commandChain.buildCommandChainReasonsFromCurrentSources({
    actorRole: 'STORE_MANAGER',
    workflowItems: [workflowItem({ sourceType: 'target_distribution_request' })],
  })
  const targetForRegionManager = commandChain.buildCommandChainReasonsFromCurrentSources({
    actorRole: 'REGION_MANAGER',
    workflowItems: [workflowItem({ sourceType: 'target_distribution_request' })],
  })
  const targetForReportViewer = commandChain.buildCommandChainReasonsFromCurrentSources({
    actorRole: 'REPORT_VIEWER',
    workflowItems: [workflowItem({ sourceType: 'target_distribution_request' })],
  })
  const blockedChecklistForReportViewer = commandChain.buildCommandChainReasonsFromCurrentSources({
    actorRole: 'REPORT_VIEWER',
    workflowItems: [workflowItem({ sourceType: 'checklist_receipt' })],
  })
  const checklistForStoreManager = commandChain.buildCommandChainReasonsFromCurrentSources({
    actorRole: 'STORE_MANAGER',
    workflowItems: [workflowItem({ sourceType: 'checklist_receipt' })],
  })
  const blockedStoreActionForReportViewer = commandChain.buildCommandChainReasonsFromCurrentSources({
    actorRole: 'REPORT_VIEWER',
    workflowItems: [workflowItem({ sourceType: 'store_action_plan' })],
  })

  assert.deepEqual(blockedTargetForStoreManager, [])
  assert.equal(targetForRegionManager[0].sourceFamily, 'target')
  assert.equal(targetForReportViewer[0].sourceFamily, 'target')
  assert.deepEqual(blockedChecklistForReportViewer, [])
  assert.equal(checklistForStoreManager[0].sourceFamily, 'checklist')
  assert.deepEqual(blockedStoreActionForReportViewer, [])
})

test('Command Chain reason helper fails closed on unknown source drift', () => {
  const missingRoleReasons = commandChain.buildCommandChainReasons({
    actorRole: 'SUPER_ADMIN',
    sources: [
      {
        id: 'missing-roles',
        proofLabel: 'Unknown role shape should be ignored',
        sourceFamily: 'workflow',
        sourceSurface: '/admin/inbox',
      },
    ],
  })
  const unknownSignalReasons = commandChain.buildCommandChainReasonsFromCurrentSources({
    actorRole: 'SUPER_ADMIN',
    signalSources: [
      {
        count: 1,
        family: 'new_runtime_source',
        href: '/admin/operations',
        lastObservedAt: '2026-05-24T06:00:00.000Z',
        status: 'attention',
      },
    ],
  })
  const unknownWorkflowReasons = commandChain.buildCommandChainReasonsFromCurrentSources({
    actorRole: 'SUPER_ADMIN',
    workflowItems: [workflowItem({ sourceType: 'new_workflow_source' })],
  })

  assert.deepEqual(missingRoleReasons, [])
  assert.deepEqual(unknownSignalReasons, [])
  assert.deepEqual(unknownWorkflowReasons, [])
})

test('Command Chain reason helper redacts token-like source entity ids', () => {
  const [reason] = commandChain.buildCommandChainReasons({
    actorRole: 'SUPER_ADMIN',
    sources: [
      {
        eligibleRoles: ['SUPER_ADMIN'],
        id: 'token.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.bbbbb',
        proofLabel: 'Unsafe source id should not be surfaced',
        sourceEntityId: 'token.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.bbbbb',
        sourceFamily: 'auth',
        sourceSurface: '/admin/auth',
      },
    ],
  })

  assert.equal(reason.sourceEntityId, null)
  assert.equal(reason.id, 'auth:redacted')
})

test('Command Chain workflow reasons do not embed token-like source ids into reason ids', () => {
  const [reason] = commandChain.buildCommandChainReasonsFromCurrentSources({
    actorRole: 'STORE_MANAGER',
    workflowItems: [
      workflowItem({
        sourceId: 'token.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.bbbbb',
      }),
    ],
  })

  assert.equal(reason.sourceEntityId, null)
  assert.equal(reason.id, 'workflow:kpi_exception:redacted-source')
})

function workflowItem(overrides = {}) {
  return {
    actorRole: 'STORE_MANAGER',
    companyId: 'company-1',
    createdAt: '2026-05-24T05:00:00.000Z',
    deepLink: '/store/tasks',
    historyPreview: 'latest status',
    inboxStatus: 'needs_attention',
    itemType: 'task',
    needsAttentionAt: '2026-05-24T06:00:00.000Z',
    primaryActionLabel: 'Open',
    regionId: 'region-1',
    secondaryActionLabel: 'Details',
    sourceId: 'source-1',
    sourceType: 'kpi_exception',
    storeId: 'store-1',
    storeName: 'Store One',
    summary: 'KPI exception needs review',
    title: 'KPI exception',
    urgency: 'medium',
    workflowStatus: 'needs_attention',
    ...overrides,
  }
}

function storeActionPlan(overrides = {}) {
  return {
    actionPlanId: 'plan-1',
    cancelReason: null,
    cancelledAt: null,
    cancelledByUserId: null,
    closedAt: null,
    closedByUserId: null,
    companyId: 'company-1',
    createdAt: '2026-05-24T05:00:00.000Z',
    createdByUserId: 'user-1',
    dueOn: '2026-05-25',
    ownerUserId: 'user-2',
    priority: 'high',
    regionId: 'region-1',
    resolutionNote: null,
    sourceDeepLink: '/store/tasks',
    sourceId: 'source-1',
    sourceKpiId: 'kpi-1',
    sourceSnapshotRunId: 'snapshot-1',
    sourceType: 'kpi_exception',
    status: 'open',
    storeId: 'store-1',
    summary: 'Follow up on KPI exception',
    title: 'Improve conversion',
    updatedAt: '2026-05-24T06:00:00.000Z',
    ...overrides,
  }
}
