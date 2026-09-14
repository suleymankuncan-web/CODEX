import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const fixtureUrl = new URL('./fixtures/bm-store-visit-2026-v7.json', import.meta.url)
const seedUrl = new URL('../db/seeds/001_reference_seed.sql', import.meta.url)

async function readFixture() {
  return JSON.parse(await readFile(fixtureUrl, 'utf8'))
}

test('BM store visit v7 fixture preserves the approved workbook contract', async () => {
  const fixture = await readFixture()
  const items = fixture.items

  assert.equal(fixture.source.sha256, 'd632a864ca24f2de7a38851ac1407578401f1fe45628c5103a19a8c9d35f003f')
  assert.equal(fixture.templateCode, 'BM_STORE_VISIT_2026')
  assert.equal(fixture.templateType, 'BM_STORE_VISIT')
  assert.equal(fixture.versionNo, 7)
  assert.equal(fixture.itemDefaults.createsRemediationTask, false)
  assert.equal(fixture.source.assignmentColumnsAllEmpty, true)
  assert.deepEqual(fixture.source.assignmentColumns, ['Aksiyon', 'Sorumlu', 'Termin'])
  assert.equal(items.length, 49)
  assert.deepEqual(items.map((item) => item.itemNo), Array.from({ length: 49 }, (_, index) => index + 1))
  assert.equal(new Set(items.map((item) => item.itemText)).size, 49)
  assert.equal(items.reduce((sum, item) => sum + item.weight, 0), 100)
  assert.ok(items.every((item) => item.responseType === 'compliance'))
  assert.ok(items.every((item) => item.maxScore === 2))
  const sectionTotals = items.reduce((totals, item) => {
    const current = totals[item.sectionName] ?? { count: 0, weight: 0 }
    totals[item.sectionName] = {
      count: current.count + 1,
      weight: current.weight + item.weight,
    }
    return totals
  }, {})
  assert.deepEqual(
    sectionTotals,
    {
      'Vitrin & VM': { count: 10, weight: 19 },
      Operasyon: { count: 11, weight: 17 },
      Personel: { count: 7, weight: 14 },
      'Satış & Müşteri': { count: 10, weight: 19 },
      'Stok & Ürün': { count: 5, weight: 13 },
      'Müşteri Hizmetleri': { count: 3, weight: 6 },
      Yönetim: { count: 3, weight: 12 },
    },
  )
  assert.deepEqual(fixture.answerPolicy, {
    compliant: { label: 'Uygun', scorePercent: 100 },
    partially_compliant: { label: 'Kısmen Uygun', scorePercent: 50 },
    non_compliant: { label: 'Uygun Değil', scorePercent: 0 },
    not_applicable: { label: 'N/A', excludedFromDenominator: true },
  })
})

test('synthetic system seed publishes the exact final checklist without task assignments', async () => {
  const [fixture, seed] = await Promise.all([
    readFixture(),
    readFile(seedUrl, 'utf8'),
  ])
  const match = seed.match(/\$bm_checklist_v7\$\s*([\s\S]*?)\s*\$bm_checklist_v7\$/)
  assert.ok(match, 'final BM checklist seed payload must exist')
  const seededItems = JSON.parse(match[1])

  assert.deepEqual(
    seededItems,
    fixture.items.map(({ itemNo, sectionName, itemText, weight }) => ({
      itemNo,
      sectionName,
      itemText,
      weight,
    })),
  )
  assert.match(seed, /version_no\s*=\s*7|\n\s*7,\n/)
  assert.match(seed, /creates_remediation_task[\s\S]*?FALSE/)
  assert.match(
    seed,
    /template_type = 'BM_STORE_VISIT'[\s\S]*?AND NOT \(template_code = 'BM_STORE_VISIT_2026' AND version_no = 7\)[\s\S]*?AND status = 'published'/,
  )
})
