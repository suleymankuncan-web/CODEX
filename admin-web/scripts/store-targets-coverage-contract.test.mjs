import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const targetsPageSource = await readFile(
  new URL('../src/pages/StoreTargetsPage.tsx', import.meta.url),
  'utf8',
)
const targetsModelSource = await readFile(
  new URL('../src/pages/store-targets-page-model.ts', import.meta.url),
  'utf8',
)
const targetSectionsSource = await readFile(
  new URL('../src/pages/store-targets-contract-sections.tsx', import.meta.url),
  'utf8',
)

test('store target metrics read active target references instead of approved workflow requests', () => {
  assert.match(targetsModelSource, /export function createStoreTargetReferenceSummary/u)
  assert.match(targetsPageSource, /createStoreTargetReferenceSummary\(\{/u)
  assert.match(targetsPageSource, /storeTargetReferenceSummary\.coverageRate/u)
  assert.match(targetsPageSource, /storeTargetReferenceSummary\.coveredStores/u)
  assert.match(targetsPageSource, /storeTargetReferenceSummary\.pendingStores/u)
  assert.match(targetsPageSource, /storeTargetReferenceSummary\.missingStores/u)
  assert.doesNotMatch(targetsPageSource, /const storeRequestSummary = createStoreRequestSummary/u)
})

test('approved target workflow list stays separate from target references', () => {
  assert.match(targetsPageSource, /<TargetCoveragePanel/u)
  assert.match(targetsPageSource, /<TargetApprovedRequestsPanel/u)
  assert.match(targetSectionsSource, /title=\{input\.copy\.coverageTitle\}/u)
  assert.match(targetSectionsSource, /title=\{input\.copy\.approvedRequests\}/u)
  assert.match(targetsModelSource, /coverageTitle: 'Hedef referansları'/u)
  assert.match(targetsModelSource, /approvedRequests: 'Onaylananlar'/u)
})
