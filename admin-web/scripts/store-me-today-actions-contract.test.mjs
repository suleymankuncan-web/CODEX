import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const actionsSource = await readFile(
  new URL('../src/pages/store-my-performance-actions.ts', import.meta.url),
  'utf8',
)
const modelSource = await readFile(
  new URL('../src/pages/store-my-performance-model.ts', import.meta.url),
  'utf8',
)
const dashboardSource = await readFile(
  new URL('../src/pages/store-my-performance-plum-dashboard.tsx', import.meta.url),
  'utf8',
)
const localizationSource = await readFile(
  new URL('../src/features/localization/messages/store-me.ts', import.meta.url),
  'utf8',
)
const dashboardCssSource = await readFile(
  new URL('../src/styles/store-me-plum-dashboard.css', import.meta.url),
  'utf8',
)
const compactCssSource = await readFile(
  new URL('../src/styles/store-me-compact-surface.css', import.meta.url),
  'utf8',
)
const storeMeCssSource = `${dashboardCssSource}\n${compactCssSource}`

test('store me today actions are threshold-driven instead of filler coaching', () => {
  assert.match(actionsSource, /KPI_AVERAGE_THRESHOLD_PERCENT\s*=\s*100/u)
  assert.match(actionsSource, /SIGNIFICANT_REGRESSION_PERCENT\s*=\s*-5/u)
  assert.match(actionsSource, /TARGET_BEHIND_THRESHOLD_PERCENT\s*=\s*100/u)
  assert.match(actionsSource, /hasActionValue\(targetCard\)/u)
  assert.match(actionsSource, /targetProgressPercent\s*<\s*TARGET_BEHIND_THRESHOLD_PERCENT/u)
  assert.match(actionsSource, /atv-regression/u)
  assert.match(actionsSource, /atv-below-average/u)
  assert.match(actionsSource, /upt-regression/u)
  assert.match(actionsSource, /upt-below-average/u)
  assert.doesNotMatch(actionsSource, /maintain-rhythm/u)
  assert.doesNotMatch(actionsSource, /storeMe\.action\.maintain/u)
})

test('store me action metrics reject missing or unscorable KPI values', () => {
  assert.match(modelSource, /actionValueAvailable/u)
  assert.match(modelSource, /scoreStatus !== 'missing_reference'/u)
  assert.match(modelSource, /scoreStatus !== 'pending_normalization'/u)
  assert.match(modelSource, /dataStatus !== 'missing'/u)
})

test('store me production surface keeps compact prototype primitives', () => {
  assert.match(dashboardSource, /function StoreMeTrendChart/u)
  assert.match(dashboardSource, /function KpiCardHead/u)
  assert.match(dashboardSource, /todayActionsEmptyTitle/u)
  assert.match(dashboardSource, /<StoreMeTrendChart points=\{chart\.chartPoints\}/u)
  assert.doesNotMatch(dashboardSource, /<svg[\s\S]*store-me-line-chart/u)
  assert.match(storeMeCssSource, /\.store-me-kpi-head/u)
  assert.match(storeMeCssSource, /\.store-me-target-strip\s*\{[\s\S]*grid-template-columns:\s*1fr/u)
  assert.doesNotMatch(storeMeCssSource, /\.store-me-line-chart/u)
})

test('store me visible Turkish copy is explicit and mojibake-free', () => {
  assert.match(localizationSource, /'storeMe\.targetProgress': 'Hedef Gerçekleştirme'/u)
  assert.match(localizationSource, /'storeMe\.progressOverTarget': 'Ortalama Üstü'/u)
  assert.match(localizationSource, /'storeMe\.progressUnderAverage': 'Ortalama Altı'/u)
  assert.match(localizationSource, /'storeMe\.todayActionsEmptyTitle': 'Bugün için net aksiyon yok'/u)
  assert.doesNotMatch(localizationSource, /Hedef gerçekleşme barı/u)
  assert.doesNotMatch(localizationSource, /Ã|Â|Ä|Å/u)
})
