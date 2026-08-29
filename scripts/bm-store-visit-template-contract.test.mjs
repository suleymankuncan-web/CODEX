import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const fixtureUrl = new URL('./fixtures/bm-store-visit-2026-v6.json', import.meta.url)

async function readFixture() {
  return JSON.parse(await readFile(fixtureUrl, 'utf8'))
}

test('BM store visit v6 fixture preserves the approved workbook contract', async () => {
  const fixture = await readFixture()
  const items = fixture.items

  assert.equal(fixture.source.sha256, 'fb087f7008c94b616af89aabe9af58f574b80cf4f9f1aa2aedb505d2c0479e22')
  assert.equal(fixture.templateCode, 'BM_STORE_VISIT_2026')
  assert.equal(fixture.templateType, 'BM_STORE_VISIT')
  assert.equal(items.length, 50)
  assert.deepEqual(items.map((item) => item.itemNo), Array.from({ length: 50 }, (_, index) => index + 1))
  assert.equal(new Set(items.map((item) => item.itemText)).size, 50)
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
      'Müşteri Hizmetleri': { count: 4, weight: 8 },
      Operasyon: { count: 10, weight: 17 },
      Personel: { count: 6, weight: 11 },
      'Satış & Müşteri': { count: 11, weight: 24 },
      'Stok & Ürün': { count: 6, weight: 13 },
      'Vitrin & VM': { count: 11, weight: 20 },
      Yönetim: { count: 2, weight: 7 },
    },
  )
  assert.deepEqual(fixture.answerPolicy, {
    compliant: { label: 'Uygun', scorePercent: 100 },
    partially_compliant: { label: 'Kısmen Uygun', scorePercent: 50 },
    non_compliant: { label: 'Uygun Değil', scorePercent: 0 },
    not_applicable: { label: 'N/A', excludedFromDenominator: true },
  })
})
