import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')
const repository = readFileSync(
  join(
    workspaceRoot,
    'backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts',
  ),
  'utf8',
)

function methodBody(name) {
  const marker = `async ${name}(`
  const start = repository.indexOf(marker)
  assert.notEqual(start, -1, `${name} must exist`)
  const nextMethod = repository.indexOf('\n  async ', start + marker.length)
  return repository.slice(start, nextMethod === -1 ? repository.length : nextMethod)
}

test('monthly ranking period lookup excludes demo seed source rows', () => {
  const body = methodBody('getLatestMonthlyRankingPeriod')
  assert.ok(body.includes("COALESCE(ka.source_type, '') <> 'demo_seed'"))
})

test('ranking available period lookup excludes demo seed source rows', () => {
  const body = methodBody('listRankingAvailablePeriods')
  assert.ok(body.includes("COALESCE(ka.source_type, '') <> 'demo_seed'"))
})

test('store ranking row lookup excludes demo seed source rows', () => {
  const body = methodBody('listRankingStoreKpiRows')
  assert.ok(body.includes("COALESCE(ka.source_type, '') <> 'demo_seed'"))
})

test('personnel ranking row lookup excludes demo seed source rows', () => {
  const body = methodBody('listRankingPersonnelKpiRows')
  assert.ok(body.includes("COALESCE(ka.source_type, '') <> 'demo_seed'"))
})

test('ranking filter options exclude demo seed source rows', () => {
  const body = methodBody('listRankingFilterOptions')
  const filterCount = body.match(/COALESCE\(ka\.source_type, ''\) <> 'demo_seed'/g)?.length ?? 0

  assert.ok(
    filterCount >= 2,
    'region and store filter option queries must both exclude demo seed rows',
  )
})
