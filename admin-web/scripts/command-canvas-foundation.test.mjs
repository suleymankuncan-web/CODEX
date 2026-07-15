import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

const sourcePath = resolve('src/features/store-command-canvas/primitives.tsx')
const stylePath = resolve('src/features/store-command-canvas/foundation.css')
const manifestPath = resolve('../docs/evidence/store-command-canvas-parity/prototype-digest-manifest-v1.json')
const parityFixturePath = resolve('e2e/fixtures/command-canvas-parity-data.ts')
const parityHarnessPath = resolve('e2e/fixtures/command-canvas-parity-harness.ts')

test('Command Canvas owns the approved shared primitive set only', async () => {
  const source = await readFile(sourcePath, 'utf8')

  for (const owner of [
    'CommandCanvasPageHeader',
    'CommandCanvasActionCluster',
    'CommandCanvasMonthYearPicker',
    'CommandCanvasMetricRail',
    'CommandCanvasMetricFilter',
    'CommandCanvasFilterBar',
    'CommandCanvasSortableHeading',
    'CommandCanvasDataList',
    'CommandCanvasOperationalDrawerContent',
    'CommandCanvasConfirmationContent',
    'CommandCanvasPartialDataNotice',
  ]) {
    assert.match(source, new RegExp(`export function ${owner}`))
  }

  assert.doesNotMatch(source, /target allocation|approval mutation/i)
})

test('Command Canvas exposes semantic selection, sorting and live-update hooks', async () => {
  const source = await readFile(sourcePath, 'utf8')

  assert.match(source, /aria-pressed=\{input\.active\}/)
  assert.match(source, /aria-sort=\{input\.semantic === false \? undefined : input\.direction\}/)
  assert.match(source, /aria-live="polite"/)
  assert.match(source, /data-command-canvas-page/)
  assert.match(source, /data-command-canvas-list/)
})

test('Command Canvas retains the approved responsive geometry and bounded overlays', async () => {
  const styles = await readFile(stylePath, 'utf8')

  assert.match(styles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(styles, /@media \(min-width: 1181px\)/)
  assert.match(styles, /max-height: calc\(100dvh - 28px\)/)
  assert.match(styles, /overflow-y: auto/)
  assert.match(styles, /min-width: 16px/)
})

test('prototype manifest binds both approved sources and every accepted capture to SHA-256', async () => {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

  assert.equal(manifest.schemaVersion, 1)
  assert.deepEqual(
    manifest.prototypes.map((entry) => entry.id),
    ['incentives-command-canvas-v1', 'store-targets-command-canvas-v1'],
  )

  for (const prototype of manifest.prototypes) {
    assert.ok(prototype.sources.length >= 3)
    assert.ok(prototype.captures.length >= 8)
    for (const artifact of [...prototype.sources, ...prototype.captures]) {
      assert.match(artifact.sha256, /^[a-f0-9]{64}$/)
    }
  }
})

test('parity helpers stay under test ownership and cover long lists, partial data and real Store shell checks', async () => {
  const fixtures = await readFile(parityFixturePath, 'utf8')
  const harness = await readFile(parityHarnessPath, 'utf8')

  assert.match(fixtures, /count = 36/)
  assert.match(fixtures, /nextCursor/)
  assert.match(fixtures, /commandCanvasPartialDataFixture/)
  assert.match(harness, /\.store-shell/)
  assert.match(harness, /data-command-canvas-page/)
  assert.match(harness, /AxeBuilder/)
  assert.match(harness, /scrollWidth - document\.documentElement\.clientWidth/)
  assert.match(harness, /toHaveScreenshot/)
})
