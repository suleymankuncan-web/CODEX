import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

async function importTypeScriptSource(path) {
  const moduleUrl = new URL(path, import.meta.url)
  const source = await readFile(moduleUrl, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
  })

  return import(`data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`)
}

const impactRules = await importTypeScriptSource('../src/pages/master-data-impact-rules.ts')
const model = await importTypeScriptSource('../src/pages/master-data-control-center-model.ts')

test('master data impact rules describe store and personnel blast radius', () => {
  const storeModules = impactRules.getMasterDataImpactModules({
    entityType: 'store',
    changedFields: ['storeType', 'regionId', 'storeType'],
  })
  assert.deepEqual(
    storeModules.map((item) => item.module),
    ['Primler', 'KPI', 'Raporlar', 'Hedefler'],
  )

  const personnelModules = impactRules.getMasterDataImpactModules({
    entityType: 'personnel',
    changedFields: ['externalEmployeeRef', 'positionId'],
  })
  assert.ok(personnelModules.some((item) => item.module === 'Satış aktarımı'))
  assert.ok(personnelModules.some((item) => item.module === 'Norm Kadro'))
})

test('master data issue adapter keeps business labels and source copy', () => {
  const row = model.mapMasterDataIssueToRow({
    id: 'issue-1',
    issueCode: 'personnel_missing_seller_code',
    severity: 'warning',
    entityType: 'personnel',
    entityId: '55ddf9e8-9e87-4fd6-bad9-c3408f59e0ce',
    entityLabel: 'Mert Alcan',
    secondaryLabel: 'Balıkesir 10 Burda AVM',
    problemLabel: 'Satıcı kodu eksik',
    recommendedAction: 'Satıcı kodunu girin',
    affectedModules: ['KPI', 'Primler'],
    lastSeenAt: '2026-06-30T12:00:00.000Z',
    source: 'employee_master',
  })

  assert.equal(row.title, 'Mert Alcan')
  assert.equal(row.subtitle, 'Balıkesir 10 Burda AVM')
  assert.equal(row.sourceLabel, 'Personel kaydı')
  assert.deepEqual(row.affectedModules, ['KPI', 'Primler'])
})

test('master data workbench adapters map store and personnel records', () => {
  const store = model.mapStoreMasterToWorkbenchRow({
    storeId: 'store-1',
    storeName: 'Balıkesir 10 Burda AVM',
    storeCode: 'B10',
    storeType: 'company',
    regionId: 'region-1',
    regionName: 'Onur Kaytan Bölgesi',
    status: 'active',
    kpiImportEnabled: true,
    storeManagerName: 'Mert Alcan',
    updatedAt: '2026-06-30T12:00:00.000Z',
  })
  assert.equal(store.title, 'Balıkesir 10 Burda AVM')
  assert.equal(store.typeLabel, 'Şirket mağazası')
  assert.equal(store.kpiLabel, 'KPI aktarımı açık')

  const personnel = model.mapPersonnelMasterToWorkbenchRow({
    employeeId: 'employee-1',
    firstName: 'Ayşe',
    lastName: 'Demir',
    externalEmployeeRef: 'CORP_1001',
    employmentStatus: 'active',
    storeName: 'Bağdat Caddesi',
    positionName: 'Satış danışmanı',
    updatedAt: '2026-06-30T12:00:00.000Z',
  })
  assert.equal(personnel.title, 'Ayşe Demir')
  assert.equal(personnel.sellerCodeLabel, 'CORP_1001')
  assert.equal(personnel.statusLabel, 'Aktif')
})

test('master data query keys include tab, filters and selected entity', () => {
  assert.deepEqual(
    model.masterDataQueryKeys.issues({
      activeTab: 'issues',
      search: 'balıkesir',
      entityType: 'store',
      severity: 'critical',
      selectedEntityId: 'store-1',
      limit: 25,
      offset: 50,
    }),
    [
      'master-data-quality-issues',
      'issues',
      'balıkesir',
      'store',
      'critical',
      'store-1',
      25,
      50,
    ],
  )
})

test('master data conflict adapter preserves draft recovery copy', () => {
  assert.deepEqual(model.mapMasterDataConflict({ status: 409 }), {
    isConflict: true,
    message: 'Kayıt güncellendi, tekrar kontrol edin.',
  })
  assert.equal(model.mapMasterDataConflict(new Error('Kaydedilemedi')).message, 'Kaydedilemedi')
})
