import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const adminShellPath = 'admin-web/src/app/admin-shell.tsx'
const evidencePath = 'docs/evidence/admin-ui-modernization-v1-pr13-admin-ui-guard-2026-05-31.md'
const adminSurfacePrimitivesPath = 'admin-web/src/pages/admin-surface-primitives.tsx'

const pageFileByComponent = new Map([
  ['AdminDataQualityCenterPage', 'admin-web/src/pages/AdminDataQualityCenterPage.tsx'],
  ['AdminFeedPage', 'admin-web/src/pages/AdminFeedPage.tsx'],
  ['AdminInboxPage', 'admin-web/src/pages/AdminInboxPage.tsx'],
  ['AdminIncentivesPage', 'admin-web/src/pages/AdminIncentivesPage.tsx'],
  ['AdminPilotFeedbackPage', 'admin-web/src/pages/AdminPilotFeedbackPage.tsx'],
  ['AuditCenterPage', 'admin-web/src/pages/AuditCenterPage.tsx'],
  ['AuthActionStoreAssignmentAuditPage', 'admin-web/src/pages/AuthActionStoreAssignmentAuditPage.tsx'],
  ['AuthAssignmentAuditPage', 'admin-web/src/pages/AuthAssignmentAuditPage.tsx'],
  ['AuthCatalogPage', 'admin-web/src/pages/AuthCatalogPage.tsx'],
  ['AuthDashboardPage', 'admin-web/src/pages/AuthDashboardPage.tsx'],
  ['AuthUserAuditPage', 'admin-web/src/pages/AuthUserAuditPage.tsx'],
  ['CompetitionDashboardPage', 'admin-web/src/pages/CompetitionDashboardPage.tsx'],
  ['ImportBatchDetailPage', 'admin-web/src/pages/ImportBatchDetailPage.tsx'],
  ['IntegrationDashboardPage', 'admin-web/src/pages/IntegrationDashboardPage.tsx'],
  ['MasterDataBootstrapPage', 'admin-web/src/pages/MasterDataBootstrapPage.tsx'],
  ['OperationsControlTowerPage', 'admin-web/src/pages/OperationsControlTowerPage.tsx'],
  ['ReportsChecklistsPage', 'admin-web/src/pages/ReportsChecklistsPage.tsx'],
  ['ReportsKpisPage', 'admin-web/src/pages/ReportsKpisPage.tsx'],
  ['ReportsSnapshotRunsPage', 'admin-web/src/pages/ReportsSnapshotRunsPage.tsx'],
  ['ReportsSummaryPage', 'admin-web/src/pages/ReportsSummaryPage.tsx'],
  ['ReportsTurnoverPage', 'admin-web/src/pages/ReportsTurnoverPage.tsx'],
  ['ReportsWorkforcePage', 'admin-web/src/pages/ReportsWorkforcePage.tsx'],
  ['SessionReadinessPage', 'admin-web/src/pages/SessionReadinessPage.tsx'],
  ['SnapshotRunDetailPage', 'admin-web/src/pages/SnapshotRunDetailPage.tsx'],
  ['SnapshotsDashboardPage', 'admin-web/src/pages/SnapshotsDashboardPage.tsx'],
  ['TargetApprovalQueuePage', 'admin-web/src/pages/TargetApprovalQueuePage.tsx'],
  ['AdminChecklistTemplatesPage', 'admin-web/src/pages/AdminChecklistTemplatesPage.tsx'],
  ['AdminKpiConfigPage', 'admin-web/src/pages/AdminKpiConfigPage.tsx'],
])

const migratedAdminSurfaces = [
  {
    id: 'pilot-feedback',
    pageFile: 'admin-web/src/pages/AdminPilotFeedbackPage.tsx',
    checkedFiles: ['admin-web/src/pages/AdminPilotFeedbackPage.tsx'],
  },
  {
    id: 'data-quality',
    pageFile: 'admin-web/src/pages/AdminDataQualityCenterPage.tsx',
    checkedFiles: ['admin-web/src/pages/AdminDataQualityCenterPage.tsx'],
  },
  {
    id: 'inbox',
    pageFile: 'admin-web/src/pages/AdminInboxPage.tsx',
    checkedFiles: ['admin-web/src/pages/AdminInboxPage.tsx'],
  },
  {
    id: 'reports',
    pageFile: 'admin-web/src/pages/ReportsSummaryPage.tsx',
    checkedFiles: [
      'admin-web/src/pages/ReportsSummaryPage.tsx',
      'admin-web/src/pages/ReportsSnapshotRunsPage.tsx',
      'admin-web/src/pages/ReportsWorkforcePage.tsx',
      'admin-web/src/pages/ReportsKpisPage.tsx',
      'admin-web/src/pages/ReportsChecklistsPage.tsx',
      'admin-web/src/pages/ReportsTurnoverPage.tsx',
    ],
  },
  {
    id: 'operations',
    pageFile: 'admin-web/src/pages/OperationsControlTowerPage.tsx',
    checkedFiles: [
      'admin-web/src/pages/OperationsControlTowerPage.tsx',
      'admin-web/src/pages/operations-data-quality-signal-panel.tsx',
      'admin-web/src/pages/operations-hero.tsx',
      'admin-web/src/pages/operations-kpi-ranking-signal-panel.tsx',
      'admin-web/src/pages/operations-metric-coverage-panel.tsx',
      'admin-web/src/pages/operations-operator-action-list.tsx',
      'admin-web/src/pages/operations-signal-freshness-panel.tsx',
      'admin-web/src/pages/operations-surface-primitives.tsx',
      'admin-web/src/pages/operations-workflow-signal-panel.tsx',
      'admin-web/src/pages/operations-workforce-signal-panel.tsx',
    ],
  },
  {
    id: 'auth-audit',
    pageFile: 'admin-web/src/pages/AuthDashboardPage.tsx',
    checkedFiles: [
      'admin-web/src/pages/AuthDashboardPage.tsx',
      'admin-web/src/features/auth/AuthDashboardSections.tsx',
      'admin-web/src/features/auth/PilotUserBindingPanel.tsx',
      'admin-web/src/features/auth/RolePermissionPreviewPanel.tsx',
      'admin-web/src/pages/AuthCatalogPage.tsx',
      'admin-web/src/pages/AuthUserAuditPage.tsx',
      'admin-web/src/pages/AuthAssignmentAuditPage.tsx',
      'admin-web/src/pages/AuthActionStoreAssignmentAuditPage.tsx',
      'admin-web/src/pages/AuditCenterPage.tsx',
    ],
  },
  {
    id: 'integrations',
    pageFile: 'admin-web/src/pages/IntegrationDashboardPage.tsx',
    checkedFiles: [
      'admin-web/src/pages/IntegrationDashboardPage.tsx',
      'admin-web/src/features/integrations/integration-dashboard-surface-controls.tsx',
      'admin-web/src/pages/ImportBatchDetailPage.tsx',
      'admin-web/src/features/integrations/import-batch-detail-surface-primitives.tsx',
    ],
  },
  {
    id: 'master-data-snapshots',
    pageFile: 'admin-web/src/pages/MasterDataBootstrapPage.tsx',
    checkedFiles: [
      'admin-web/src/pages/MasterDataBootstrapPage.tsx',
      'admin-web/src/pages/master-data-bootstrap-batch-detail-panel.tsx',
      'admin-web/src/pages/SnapshotsDashboardPage.tsx',
      'admin-web/src/pages/SnapshotRunDetailPage.tsx',
    ],
  },
  {
    id: 'checklists',
    pageFile: 'admin-web/src/pages/AdminChecklistTemplatesPage.tsx',
    checkedFiles: [
      'admin-web/src/pages/AdminChecklistTemplatesPage.tsx',
      'admin-web/src/pages/AdminChecklistTemplateSurface.tsx',
    ],
  },
  {
    id: 'targets',
    pageFile: 'admin-web/src/pages/TargetApprovalQueuePage.tsx',
    checkedFiles: ['admin-web/src/pages/TargetApprovalQueuePage.tsx'],
  },
  {
    id: 'incentives',
    pageFile: 'admin-web/src/pages/AdminIncentivesPage.tsx',
    checkedFiles: ['admin-web/src/pages/AdminIncentivesPage.tsx'],
  },
  {
    id: 'kpi-config',
    pageFile: 'admin-web/src/pages/AdminKpiConfigPage.tsx',
    checkedFiles: [
      'admin-web/src/pages/AdminKpiConfigPage.tsx',
      'admin-web/src/pages/admin-kpi-config-surface-primitives.tsx',
    ],
  },
  {
    id: 'competitions',
    pageFile: 'admin-web/src/pages/CompetitionDashboardPage.tsx',
    checkedFiles: [
      'admin-web/src/pages/CompetitionDashboardPage.tsx',
      'admin-web/src/features/competitions/StageBuilderForm.tsx',
      'admin-web/src/features/competitions/competition-admin-surface-primitives.tsx',
      'admin-web/src/features/competitions/stage-builder-package-section.tsx',
      'admin-web/src/features/competitions/stage-builder-template-sections.tsx',
    ],
  },
]

const unmigratedAdminExceptions = [
  {
    id: 'session-readiness',
    pageFile: 'admin-web/src/pages/SessionReadinessPage.tsx',
    reason: 'diagnostic session surface remains parked outside admin surface migration',
  },
  {
    id: 'admin-feed',
    pageFile: 'admin-web/src/pages/AdminFeedPage.tsx',
    reason: 'feed composer/write behavior was parked for a separate behavior-preserving PR',
  },
]

const forbiddenMigratedPatterns = [
  {
    pattern: /from ['"][^'"]*dashboard-primitives['"]/,
    reason: 'legacy dashboard-primitives import',
  },
  {
    pattern: /\b(hero-panel|hero-metrics|metric-card|control-button|ghost-button|action-cluster|form-grid|key-grid|stacked-row|field-block|queue-subtitle)\b/,
    reason: 'legacy admin layout class',
  },
  {
    pattern: /fake (metric|score|data|workflow|copy)/i,
    reason: 'fake admin data or copy language',
  },
  {
    pattern: /\b(debug|handoff) copy\b/i,
    reason: 'debug or handoff copy language',
  },
]

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' })
}

function readText(path) {
  return readFileSync(path, 'utf8')
}

function normalizePath(path) {
  return path.replaceAll('\\', '/')
}

function trackedFiles() {
  return new Set(
    git(['ls-files', 'admin-web/src/pages', 'admin-web/src/features'])
      .split(/\r?\n/)
      .filter(Boolean)
      .map(normalizePath),
  )
}

function parseLiveAdminRoutes() {
  const text = readText(adminShellPath)
  const routes = []
  const adminRoutePattern =
    /<Route\s+path="([^"]+)"\s+element=\{adminRoute\(\[[\s\S]*?\],\s*<([A-Za-z0-9_]+)/g

  for (const match of text.matchAll(adminRoutePattern)) {
    routes.push({
      path: match[1],
      page: match[2],
    })
  }

  if (text.includes('<Route path="/admin/session" element={<SessionGate />} />')) {
    routes.push({
      path: '/admin/session',
      page: 'SessionReadinessPage',
    })
  }

  return routes.sort((left, right) => left.path.localeCompare(right.path))
}

const approvedAdminSurfaceImportSources = new Set([
  './admin-operational-primitives',
  './admin-surface-primitives',
  '../../pages/admin-operational-primitives',
  '../../pages/admin-surface-primitives',
  './operations-surface-primitives',
  './AdminChecklistTemplateSurface',
  './admin-kpi-config-surface-primitives',
  './competition-admin-surface-primitives',
  '../features/competitions/competition-admin-surface-primitives',
  '../features/integrations/import-batch-detail-surface-primitives',
])

function importSources(text) {
  return [...text.matchAll(/import\s+(?:type\s+)?[^;]*?\s+from\s+['"]([^'"]+)['"]/g)].map(
    (match) => match[1],
  )
}

function containsApprovedAdminSurfaceAnchor(text) {
  return importSources(text).some((source) => approvedAdminSurfaceImportSources.has(source))
}

function countPatternMatches(text, pattern) {
  return [...text.matchAll(new RegExp(pattern, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))]
    .length
}

function adminUiSurfaceViolations(input = {}) {
  const files = trackedFiles()
  const reader = input.reader ?? readText
  const surfaces = input.surfaces ?? migratedAdminSurfaces
  const violations = []

  for (const surface of surfaces) {
    const checkedFiles = surface.checkedFiles.map(normalizePath)
    const missingFiles = checkedFiles.filter((file) => !files.has(file) && !input.reader)
    if (missingFiles.length > 0) {
      violations.push(`${surface.id}: tracked files missing: ${missingFiles.join(', ')}`)
      continue
    }

    const fileTexts = checkedFiles.map((file) => ({ file, text: reader(file, 'utf8') }))

    for (const { file, text } of fileTexts) {
      if (!containsApprovedAdminSurfaceAnchor(text)) {
        violations.push(`${file}: migrated admin file is not anchored to AdminSurface* primitives`)
      }

      for (const { pattern, reason } of forbiddenMigratedPatterns) {
        if (countPatternMatches(text, pattern) > 0) {
          violations.push(`${file}: ${reason} matched ${pattern}`)
        }
      }

      if (
        file.endsWith('surface-primitives.tsx') &&
        file !== adminSurfacePrimitivesPath &&
        !importSources(text).some((source) => source === './admin-surface-primitives' || source === '../../pages/admin-surface-primitives')
      ) {
        violations.push(`${file}: parallel surface primitive set is not anchored to AdminSurface*`)
      }
    }
  }

  return violations
}

test('live active admin route pages are explicitly migrated or exception-listed', () => {
  const liveRoutes = parseLiveAdminRoutes()
  const coveredPageFiles = new Set([
    ...migratedAdminSurfaces.flatMap((surface) => surface.checkedFiles.map(normalizePath)),
    ...unmigratedAdminExceptions.map((surface) => normalizePath(surface.pageFile)),
  ])
  const uncovered = []

  for (const route of liveRoutes) {
    const pageFile = pageFileByComponent.get(route.page)
    assert.ok(pageFile, `missing page file map for ${route.page}`)

    if (!coveredPageFiles.has(normalizePath(pageFile))) {
      uncovered.push(`${route.path} -> ${pageFile}`)
    }
  }

  assert.deepEqual(uncovered, [])
})

test('migrated admin surfaces use AdminSurface primitives and avoid legacy UI remnants', () => {
  assert.deepEqual(adminUiSurfaceViolations(), [])
})

test('unmigrated admin exceptions are explicit and reasoned', () => {
  for (const exception of unmigratedAdminExceptions) {
    assert.match(exception.id, /\S/)
    assert.match(exception.pageFile, /^admin-web\/src\/pages\/.+\.tsx$/)
    assert.match(exception.reason, /(parked|separate|diagnostic)/)
  }
})

test('admin UI guard rejects a synthetic legacy migrated page', () => {
  const fakeFile = 'admin-web/src/pages/FakeAdminSurface.tsx'
  const violations = adminUiSurfaceViolations({
    surfaces: [
      {
        id: 'fake-legacy',
        pageFile: fakeFile,
        checkedFiles: [fakeFile],
      },
    ],
    reader: () => "import { MetricCard } from '../components/dashboard-primitives'\nexport function Fake() { return <section className=\"hero-panel\">fake metric</section> }",
  })

  assert.ok(violations.some((violation) => violation.includes('legacy dashboard-primitives import')))
  assert.ok(violations.some((violation) => violation.includes('legacy admin layout class')))
  assert.ok(violations.some((violation) => violation.includes('fake admin data or copy language')))
  assert.ok(violations.some((violation) => violation.includes('not anchored to AdminSurface*')))
})

test('admin UI guard rejects synthetic primitive sprawl without AdminSurface anchoring', () => {
  const fakeFile = 'admin-web/src/features/fake/fake-surface-primitives.tsx'
  const violations = adminUiSurfaceViolations({
    surfaces: [
      {
        id: 'fake-primitive-sprawl',
        pageFile: fakeFile,
        checkedFiles: [fakeFile],
      },
    ],
    reader: () => "// admin-surface-primitives mention is not an import\nimport { Card } from '../../components/ui/card'\nexport function FakeSurfacePage() { return <Card /> }",
  })

  assert.ok(violations.some((violation) => violation.includes('not anchored to AdminSurface*')))
  assert.ok(violations.some((violation) => violation.includes('parallel surface primitive set')))
})

test('admin UI guard rejects lookalike local AdminSurface helper imports', () => {
  const fakeFile = 'admin-web/src/pages/FakeAdminSurfacePage.tsx'
  const violations = adminUiSurfaceViolations({
    surfaces: [
      {
        id: 'fake-lookalike-helper',
        pageFile: fakeFile,
        checkedFiles: [fakeFile],
      },
    ],
    reader: () => "import { AdminSurfacePage } from './local-admin-surface-primitives'\nexport function Fake() { return <AdminSurfacePage /> }",
  })

  assert.ok(violations.some((violation) => violation.includes('not anchored to AdminSurface*')))
})

test('admin UI guard evidence records migrated, exception, and negative-case coverage', () => {
  const evidence = readText(evidencePath)

  for (const expected of [
    'Migrated/new AdminSurface-required pages',
    'Explicit unmigrated exception allowlist',
    'Forbidden legacy patterns',
    'Positive AdminSurface primitive requirement',
    'Synthetic negative cases',
    'admin-web/src/pages/CompetitionDashboardPage.tsx',
    'admin-web/src/pages/AdminFeedPage.tsx',
    'admin-web/src/pages/SessionReadinessPage.tsx',
  ]) {
    assert.match(evidence, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
})
