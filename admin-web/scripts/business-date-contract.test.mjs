import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const auditedCallers = [
  '../src/features/integrations/integration-dashboard-list-model.ts',
  '../src/pages/CompetitionDashboardPage.tsx',
  '../src/pages/AdminChecklistTemplatesPage.tsx',
  '../src/pages/store-approvals-model.ts',
  '../src/features/competitions/stage-presets.ts',
]

test('audited business-date callers do not derive calendar values from UTC ISO slicing', async () => {
  for (const relativePath of auditedCallers) {
    const source = await readFile(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
    assert.doesNotMatch(
      source,
      /new Date\(\)\.toISOString\(\)\.slice\(0,\s*(?:7|10)\)/,
      relativePath,
    )
  }
})

test('audited callers retain the shared Istanbul business-date adapters', async () => {
  const expectations = new Map([
    [
      '../src/features/integrations/integration-dashboard-list-model.ts',
      'createIntegrationPeriodDefaults(now)',
    ],
    ['../src/pages/CompetitionDashboardPage.tsx', 'createCompetitionDraftDateDefaults(now)'],
    ['../src/pages/AdminChecklistTemplatesPage.tsx', 'getChecklistTemplateEffectiveDate(now)'],
    ['../src/pages/store-approvals-model.ts', 'createStoreApprovalsDateDefaults(now)'],
    ['../src/features/competitions/stage-presets.ts', 'addCalendarDaysToDateInput('],
  ])

  for (const [relativePath, expectedCall] of expectations) {
    const source = await readFile(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
    assert.match(source, new RegExp(escapeRegExp(expectedCall)), relativePath)
  }
})

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
