import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

async function importTranspiled(path, options = {}) {
  let source = await readFile(new URL(path, import.meta.url), 'utf8')
  if (options.stripImports) {
    source = source.replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"]\s*$/gm, '')
  }
  if (options.prepend) {
    source = `${options.prepend}\n${source}`
  }
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
  })
  return import(`data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`)
}

const reportsModel = await importTranspiled('../src/pages/store-reports-model.ts')
const reportsMessages = await importTranspiled('../src/features/localization/messages/store-reports.ts')
const storeReportsT = (key, params = {}) => reportsMessages.storeReportsTr[key].replace(
  /\{([A-Za-z0-9_]+)\}/g,
  (match, paramKey) => params[paramKey] ?? match,
)
const checklistLogic = await importTranspiled('../src/pages/store-checklists-logic.ts', {
  stripImports: true,
  prepend: `
const hasAnyRole = () => false
const normalizeDisplayLabel = (value, fallback) => value || fallback
const formatDateTime = (value) => value || '-'
const formatNumber = (value) => String(value)
const formatState = (value) => String(value)
const getIntlLocale = (locale) => locale === 'en' ? 'en-US' : 'tr-TR'
`,
})
const checklistScorePolicy = await importTranspiled('../src/pages/store-checklists-score-policy.ts')
const workforceViewSource = await readFile(
  new URL('../src/pages/store-workforce-region-view.tsx', import.meta.url),
  'utf8',
)
const workforceModelSource = await readFile(
  new URL('../src/pages/store-workforce-region-view-model.ts', import.meta.url),
  'utf8',
)

test('store reports do not mark empty backend packages as ready', () => {
  const model = reportsModel.buildStoreReportsViewModel(null, storeReportsT)

  assert.equal(model.metrics.find((metric) => metric.id === 'period-state')?.value, 'Bekliyor')
  assert.equal(model.metrics.find((metric) => metric.id === 'detail-output')?.value, '0')
  assert.ok(model.sections.every((section) => section.status !== 'ready'))
})

test('store reports mark missing sections as waiting when package scope exists', () => {
  const model = reportsModel.buildStoreReportsViewModel({
    coverageLabel: '1-14 Haziran',
    period: '2026-06',
    periodLabel: 'Haziran 2026',
    sections: [],
    storeCount: 30,
  }, storeReportsT)

  assert.equal(model.metrics.find((metric) => metric.id === 'period-state')?.value, 'Bekliyor')
  assert.equal(model.metrics.find((metric) => metric.id === 'detail-output')?.value, '0')
  assert.ok(model.sections.every((section) => section.status === 'missing'))
})

test('store reports preserve backend section readiness', () => {
  const model = reportsModel.buildStoreReportsViewModel({
    coverageLabel: '1-14 Haziran',
    period: '2026-06',
    periodLabel: 'Haziran 2026',
    sections: [
      { code: 'kpis', label: 'KPI kolonları', status: 'ready', value: 'Skor' },
      { code: 'actions', label: 'Aksiyon durumu', status: 'partial', value: 'Eksik kayıt var' },
    ],
    storeCount: 30,
  }, storeReportsT)

  assert.equal(model.sections.find((section) => section.code === 'kpis')?.status, 'ready')
  assert.equal(model.sections.find((section) => section.code === 'actions')?.status, 'partial')
  assert.equal(model.metrics.find((metric) => metric.id === 'detail-output')?.value, '1')
})

test('checklist acknowledgement filter keeps pending rows inside selected month only', () => {
  const mayPending = {
    acknowledgement: null,
    category: 'BM',
    checklistInstanceId: 'may-result',
    completedAt: '2026-05-12T09:00:00.000Z',
    complianceRate: null,
    responses: [],
    status: 'completed',
    storeName: 'Mayıs Mağazası',
    templateName: 'BM Checklist',
    templateType: 'BM_STORE_VISIT',
    totalScore: 82,
  }
  const junePending = {
    ...mayPending,
    checklistInstanceId: 'june-result',
    completedAt: '2026-06-12T09:00:00.000Z',
    storeName: 'Haziran Mağazası',
  }
  const noCompletion = {
    ...mayPending,
    checklistInstanceId: 'draft-result',
    completedAt: null,
    storeName: 'Taslak Mağaza',
  }
  const filters = { month: '2026-06', query: '', status: 'all', type: 'all' }

  assert.equal(checklistLogic.doesChecklistItemMatchFilters(mayPending, filters), false)
  assert.equal(
    checklistLogic.doesChecklistItemMatchFilters(mayPending, {
      ...filters,
      includeOutOfPeriodPending: true,
    }),
    true,
  )
  assert.equal(checklistLogic.doesChecklistItemMatchFilters(junePending, filters), true)
  assert.equal(checklistLogic.doesChecklistItemMatchFilters(noCompletion, filters), false)
})

test('checklist score options follow template min and max policy', () => {
  assert.deepEqual(
    checklistScorePolicy.getChecklistScoreOptions({
      maxScore: 5,
      minScore: 1,
      responseType: 'score',
    }),
    [1, 2, 3, 4, 5],
  )
  assert.deepEqual(
    checklistScorePolicy.getChecklistScoreOptions({
      maxScore: 10,
      responseType: 'score',
    }),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  )
})

test('checklist score parsing clamps to template score bounds', () => {
  const item = { maxScore: 5, minScore: 1, responseType: 'score' }

  assert.equal(checklistScorePolicy.parseChecklistScoreInput('0', item), 1)
  assert.equal(checklistScorePolicy.parseChecklistScoreInput('6', item), 5)
  assert.equal(checklistScorePolicy.parseChecklistScoreInput('3', item), 3)
  assert.equal(checklistScorePolicy.parseChecklistScoreInput('', item), null)
  assert.equal(checklistScorePolicy.parseChecklistScoreInput('bad', item), null)
})

test('checklist low score note requirement only blocks low score selections', () => {
  const item = {
    lowScoreThreshold: 2,
    maxScore: 5,
    minScore: 1,
    requiresLowScoreNote: true,
    responseType: 'score',
  }

  assert.equal(checklistScorePolicy.isChecklistLowScoreSelection(item, 2), true)
  assert.equal(checklistScorePolicy.isChecklistLowScoreSelection(item, 3), false)
  assert.equal(
    checklistScorePolicy.isChecklistLowScoreNoteMissing({
      commentText: '',
      item,
      score: 2,
    }),
    true,
  )
  assert.equal(
    checklistScorePolicy.isChecklistLowScoreNoteMissing({
      commentText: 'Reyon standardı tekrar kontrol edilecek.',
      item,
      score: 2,
    }),
    false,
  )
  assert.equal(
    checklistScorePolicy.isChecklistLowScoreNoteMissing({
      commentText: '',
      item,
      score: 3,
    }),
    false,
  )
})

test('workforce region view has honest current-snapshot year copy and no store id label fallback', () => {
  assert.match(workforceModelSource, /yearAria:\s*'Güncel görünüm'/u)
  assert.match(workforceViewSource, /storeLabel:\s*'Mağaza adı yok'/u)
  assert.doesNotMatch(workforceViewSource, /storeLabel:\s*storeId/u)
  assert.match(workforceViewSource, /norm-kadro-guncel\.csv/u)
})
