import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const guardedSpecs = [
  'admin-web/e2e/checklist-command-canvas.spec.ts',
  'admin-web/e2e/checklist-command-records.spec.ts',
  'admin-web/e2e/checklist-command-store-manager.spec.ts',
  'admin-web/e2e/checklist-today-surfaces.spec.ts',
]

test('canonical Playwright never writes checklist evidence into tracked docs', () => {
  const packageJson = JSON.parse(readFileSync('admin-web/package.json', 'utf8'))
  assert.equal(packageJson.scripts['check:release:e2e'], 'npm run test:e2e')
  assert.equal(packageJson.scripts['test:e2e'], 'node scripts/run-release-e2e.mjs')
  assert.equal(packageJson.scripts['test:e2e:capture'], 'playwright test')

  const releaseRunner = readFileSync('admin-web/scripts/run-release-e2e.mjs', 'utf8')
  assert.match(releaseRunner, /buildReleasePlaywrightEnvironment/)
  const runtime = readFileSync('admin-web/scripts/playwright-runtime.mjs', 'utf8')
  assert.match(runtime, /delete result\.CAPTURE_COMMAND_CANVAS_EVIDENCE/)

  for (const specPath of guardedSpecs) {
    const source = readFileSync(specPath, 'utf8')
    assert.match(source, /checklistEvidenceOutputPath/)
    assert.doesNotMatch(source, /docs[\\/]evidence/)
  }
})

test('checklist evidence helper is transient by default and validates manual promotion paths', () => {
  const helper = readFileSync('admin-web/e2e/checklist-evidence-output.ts', 'utf8')
  assert.match(helper, /testInfo\.outputPath\('checklist-evidence'/)
  assert.match(helper, /CAPTURE_COMMAND_CANVAS_EVIDENCE === '1'/)
  assert.match(helper, /escaped docs\/evidence/)
  assert.match(helper, /relativePath\.split/)
})
