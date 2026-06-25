import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const modelSource = await readFile(
  new URL('../src/pages/store-my-performance-model.ts', import.meta.url),
  'utf8',
)
const dashboardSource = await readFile(
  new URL('../src/pages/store-my-performance-plum-dashboard.tsx', import.meta.url),
  'utf8',
)
const metricKpiCardSource = dashboardSource.slice(
  dashboardSource.indexOf('function MetricKpiCard'),
  dashboardSource.indexOf('export function StoreMyPerformancePlumDashboard'),
)

test('store me KPI cards render metric-specific rank labels instead of the overall employee rank', () => {
  assert.match(modelSource, /metricRanksByCode/u)
  assert.match(modelSource, /storeRankLabel:\s*formatRank\(metricRank\?\.storeRank/u)
  assert.match(modelSource, /turkeyRankLabel:\s*formatRank\(metricRank\?\.turkeyRank/u)
  assert.doesNotMatch(metricKpiCardSource, /storeRankLabel,/u)
  assert.doesNotMatch(metricKpiCardSource, /turkeyRankLabel,/u)
  assert.doesNotMatch(dashboardSource, /<MetricKpiCard[\s\S]{0,400}storeRankLabel=\{storeRankLabel\}/u)
})
