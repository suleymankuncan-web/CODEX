import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const packageJson = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
)
const contractDoc = await readFile(
  new URL('../../docs/contracts/store-page-qa-contract-v1.md', import.meta.url),
  'utf8',
)
const processDoc = await readFile(
  new URL('../../docs/process/store-admin-surface-standardization-v1.md', import.meta.url),
  'utf8',
)
const evidenceDoc = await readFile(
  new URL('../../docs/evidence/store-page-qa-contract-v1/README.md', import.meta.url),
  'utf8',
)

const expectedStoreContractSpecs = [
  'store-page-contracts.spec.ts',
  'store-checklists-contracts.spec.ts',
  'store-rankings-contracts.spec.ts',
  'store-kpis-contracts.spec.ts',
  'store-incentives-contracts.spec.ts',
  'store-targets-contracts.spec.ts',
  'store-workforce-contracts.spec.ts',
  'store-tasks-contracts.spec.ts',
  'store-feed-contracts.spec.ts',
  'store-reports-contracts.spec.ts',
  'store-home-contracts.spec.ts',
  'store-me-contracts.spec.ts',
  'store-personnel-contracts.spec.ts',
]
const mojibakePattern = new RegExp(`[${String.fromCharCode(0xc3, 0xc4, 0xc5, 0xc2, 0xd0, 0xfffd)}]`, 'u')

test('store page QA contract gate exposes every store contract spec', () => {
  const script = packageJson.scripts['test:e2e:store-contracts']
  assert.ok(script, 'test:e2e:store-contracts script should exist')

  const referencedSpecs = [...script.matchAll(/store-[\w-]+\.spec\.ts/gu)].map(
    (match) => match[0],
  )

  assert.deepEqual([...referencedSpecs].sort(), [...expectedStoreContractSpecs].sort())
  assert.equal(new Set(referencedSpecs).size, expectedStoreContractSpecs.length)
})

test('store page QA process docs require the pre-PR gate', () => {
  assert.match(processDoc, /## Store Page QA Contract Gate/u)
  assert.match(processDoc, /npm\.cmd run test:scripts/u)
  assert.match(processDoc, /npm\.cmd run test:e2e:store-contracts/u)
  assert.match(processDoc, /If dependency installation is incomplete/u)
})

test('store page QA evidence records coverage mode and deferrals', () => {
  assert.match(evidenceDoc, /## Coverage Mode/u)
  assert.match(evidenceDoc, /Mocked contract coverage/u)
  assert.match(evidenceDoc, /Live\/staging coverage/u)
  assert.match(evidenceDoc, /Intentionally deferred/u)
  assert.match(evidenceDoc, /npm\.cmd run test:e2e:store-contracts/u)
})

test('store page QA docs keep Turkish copy encoded correctly', () => {
  const docs = [contractDoc, processDoc, evidenceDoc].join('\n')

  assert.doesNotMatch(docs, mojibakePattern)
  assert.match(docs, /Türkiye Sıralaması/u)
  assert.match(docs, /KPI Özetleri/u)
  assert.match(docs, /Görevler/u)
  assert.match(docs, /Dönem gönderimi/u)
  assert.match(docs, /Kontrol edildi/u)
})
