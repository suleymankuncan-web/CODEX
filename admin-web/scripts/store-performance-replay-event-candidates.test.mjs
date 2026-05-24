import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const moduleUrl = new URL(
  '../src/features/store-performance-replay/event-candidates.ts',
  import.meta.url,
)
const source = await readFile(moduleUrl, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    verbatimModuleSyntax: true,
  },
})
const replay = await import(
  `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`
)

test('Store Performance Replay mapper orders factual candidates by occurrence time', () => {
  const events = replay.buildStorePerformanceReplayEvents({
    importBatches: [
      {
        batchId: 'batch-1',
        entityType: 'employee',
        finishedAt: '2026-05-24T08:00:00.000Z',
        sourceCode: 'powerbi',
        startedAt: '2026-05-24T07:55:00.000Z',
        status: 'completed',
      },
    ],
    snapshotRuns: [
      {
        companyIds: ['company-1'],
        finishedAt: '2026-05-24T09:00:00.000Z',
        generatedAt: '2026-05-24T08:55:00.000Z',
        periodEnd: '2026-05-24',
        periodStart: '2026-05-24',
        runStatus: 'completed',
        snapshotRunId: 'snapshot-1',
        snapshotType: 'daily',
      },
    ],
    storeActionPlans: [
      {
        actionPlanId: 'plan-1',
        closedAt: '2026-05-24T10:00:00.000Z',
        companyId: 'company-1',
        createdAt: '2026-05-24T06:00:00.000Z',
        priority: 'high',
        regionId: 'region-1',
        sourceDeepLink: '/store/tasks',
        status: 'closed',
        storeId: 'store-1',
        title: 'Improve conversion',
        updatedAt: '2026-05-24T09:30:00.000Z',
      },
    ],
    targetRequests: [
      {
        approvedAt: '2026-05-24T08:30:00.000Z',
        companyId: 'company-1',
        createdAt: '2026-05-24T08:10:00.000Z',
        regionId: 'region-1',
        requestId: 'target-1',
        requestMonth: '2026-05-01',
        status: 'approved',
        storeId: 'store-1',
        targetLabel: 'May target distribution',
      },
    ],
  })

  assert.deepEqual(
    events.map((event) => event.sourceFamily),
    ['store_action', 'snapshot', 'target', 'import'],
  )
  assert.equal(events[0].sourceRoute, '/store/tasks')
  assert.equal(events[1].sourceRoute, '/admin/snapshots/snapshot-1')
  assert.equal(events[2].readiness, 'ready')
  assert.equal(events[3].readiness, 'partial')
})

test('Store Performance Replay mapper skips missing or invalid timestamps and secret-like ids', () => {
  const events = replay.buildStorePerformanceReplayEvents({
    importBatches: [
      {
        batchId: 'token.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.bbbbb',
        sourceCode: 'powerbi',
        status: 'completed',
        startedAt: '2026-05-24T08:00:00.000Z',
      },
      {
        batchId: 'batch-with-invalid-time',
        finishedAt: 'not-a-date',
        sourceCode: 'powerbi',
        status: 'completed',
        startedAt: '2026-05-24T07:59:00.000Z',
      },
      {
        batchId: 'batch-without-time',
        sourceCode: 'powerbi',
        status: 'completed',
      },
    ],
    snapshotRuns: [
      {
        generatedAt: '2026-05-24T09:00:00.000Z',
        runStatus: 'completed',
        snapshotRunId: 'snapshot-1',
      },
    ],
  })

  assert.equal(events.length, 2)
  assert.deepEqual(
    events.map((event) => event.sourceId),
    ['snapshot-1', 'batch-with-invalid-time'],
  )
  assert.doesNotMatch(JSON.stringify(events), /token\./u)
  assert.equal(events[1].occurredAt, '2026-05-24T07:59:00.000Z')
})

test('Store Performance Replay mapper falls back to created evidence when terminal timestamps are invalid', () => {
  const events = replay.buildStorePerformanceReplayEvents({
    pilotFeedbackItems: [
      {
        classification: 'bug',
        classifiedAt: 'not-a-date',
        createdAt: '2026-05-24T11:55:00.000Z',
        feedbackId: 'feedback-1',
        feedbackType: 'friction',
        routePath: '/store/tasks',
        status: 'triaged',
        title: 'Button label unclear',
      },
    ],
    targetRequests: [
      {
        approvedAt: 'not-a-date',
        createdAt: '2026-05-24T08:10:00.000Z',
        requestId: 'target-1',
        status: 'approved',
        targetLabel: 'May target distribution',
      },
    ],
  })

  assert.deepEqual(
    events.map((event) => [event.sourceFamily, event.title, event.occurredAt]),
    [
      ['pilot_feedback', 'Pilot feedback submitted: Button label unclear', '2026-05-24T11:55:00.000Z'],
      ['target', 'Target request submitted', '2026-05-24T08:10:00.000Z'],
    ],
  )
})

test('Store Performance Replay mapper clamps bad limits', () => {
  const source = {
    generatedAt: '2026-05-24T09:00:00.000Z',
    runStatus: 'completed',
    snapshotRunId: 'snapshot-1',
  }

  assert.deepEqual(
    replay.buildStorePerformanceReplayEvents({
      limit: -1,
      snapshotRuns: [source],
    }),
    [],
  )
  assert.equal(
    replay.buildStorePerformanceReplayEvents({
      limit: 1.9,
      snapshotRuns: [
        source,
        {
          generatedAt: '2026-05-24T10:00:00.000Z',
          runStatus: 'completed',
          snapshotRunId: 'snapshot-2',
        },
      ],
    }).length,
    1,
  )
})

test('Store Performance Replay mapper keeps partial sources explicit', () => {
  const events = replay.buildStorePerformanceReplayEvents({
    checklistItems: [
      {
        acknowledgedAt: '2026-05-24T11:00:00.000Z',
        checklistInstanceId: 'checklist-1',
        completedAt: '2026-05-24T10:00:00.000Z',
        sourceRoute: '/store/checklists',
        status: 'completed',
        storeId: 'store-1',
        templateId: 'template-1',
      },
    ],
    kpiRankingPeriods: [
      {
        generatedAt: '2026-05-24T09:30:00.000Z',
        periodEnd: '2026-05-24',
        periodStart: '2026-05-24',
        snapshotRunId: 'snapshot-1',
        sourceRoute: '/store/rankings',
        storeId: 'store-1',
      },
    ],
    workflowItems: [
      {
        createdAt: '2026-05-24T09:00:00.000Z',
        deepLink: '/admin/inbox',
        inboxStatus: 'needs_attention',
        needsAttentionAt: '2026-05-24T09:15:00.000Z',
        sourceId: 'workflow-1',
        sourceType: 'target_distribution_request',
        storeId: 'store-1',
        storeName: 'Store One',
        title: 'Target needs approval',
        workflowStatus: 'pending_region_approval',
      },
    ],
  })

  assert.equal(events.length, 3)
  assert.ok(events.every((event) => event.readiness === 'partial'))
  assert.match(events[0].redactionNotes.join(' '), /mobile completion audit parity/u)
  assert.match(events[1].redactionNotes.join(' '), /official snapshot run/u)
  assert.match(events[2].redactionNotes.join(' '), /aggregation surface/u)
})

test('Store Performance Replay mapper marks pilot feedback as operator context', () => {
  const [event] = replay.buildStorePerformanceReplayEvents({
    pilotFeedbackItems: [
      {
        classification: 'bug',
        classifiedAt: '2026-05-24T12:00:00.000Z',
        createdAt: '2026-05-24T11:55:00.000Z',
        feedbackId: 'feedback-1',
        feedbackType: 'friction',
        routePath: '/store/tasks',
        severitySuggestion: 'p2',
        status: 'triaged',
        title: 'Button label unclear',
        updatedAt: '2026-05-24T12:00:00.000Z',
      },
    ],
  })

  assert.equal(event.sourceFamily, 'pilot_feedback')
  assert.equal(event.readiness, 'ready')
  assert.equal(event.sourceRoute, '/admin/pilot-feedback')
  assert.match(event.redactionNotes.join(' '), /not store or personnel performance evidence/u)
})

test('Store Performance Replay mapper does not emit causal wording', () => {
  const events = replay.buildStorePerformanceReplayEvents({
    storeActionPlans: [
      {
        actionPlanId: 'plan-1',
        createdAt: '2026-05-24T06:00:00.000Z',
        sourceDeepLink: '/store/tasks',
        status: 'open',
        storeId: 'store-1',
        title: 'Follow up',
      },
    ],
  })

  const text = events.map((event) => `${event.title} ${event.safeSummary}`).join(' ')

  assert.doesNotMatch(text, /\bcaused\b/iu)
  assert.doesNotMatch(text, /\bbecause of\b/iu)
  assert.doesNotMatch(text, /\bimproved due to\b/iu)
  assert.doesNotMatch(text, /\bunderperformed because\b/iu)
})
