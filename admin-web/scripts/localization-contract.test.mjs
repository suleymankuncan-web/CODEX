import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const appRoot = dirname(scriptsDir)

const localizationFiles = [
  'src/features/localization/messages/admin-audit.ts',
  'src/features/localization/messages/admin-checklists.ts',
  'src/features/localization/messages/admin-integrations.ts',
  'src/features/localization/messages/admin-kpi-config.ts',
  'src/features/localization/messages/admin-master-data.ts',
  'src/features/localization/messages/admin-shell.ts',
  'src/features/localization/messages/admin-snapshots.ts',
  'src/features/localization/messages/admin-targets.ts',
  'src/features/localization/messages/common.ts',
  'src/features/localization/messages/competition.ts',
  'src/features/localization/messages/reports-checklists.ts',
  'src/features/localization/messages/reports-kpis.ts',
  'src/features/localization/messages/reports-summary.ts',
  'src/features/localization/messages/reports-snapshot-runs.ts',
  'src/features/localization/messages/reports-turnover.ts',
  'src/features/localization/messages/reports-workforce.ts',
  'src/features/localization/messages/store-approvals.ts',
  'src/features/localization/messages/store-checklists.ts',
  'src/features/localization/messages/store-competitions.ts',
  'src/features/localization/messages/store-feed.ts',
  'src/features/localization/messages/store-home.ts',
  'src/features/localization/messages/store-incentives.ts',
  'src/features/localization/messages/store-me.ts',
  'src/features/localization/messages/store-kpis.ts',
  'src/features/localization/messages/store-rankings.ts',
  'src/features/localization/messages/store-tasks.ts',
  'src/features/localization/messages/index.ts',
  'src/features/localization/dictionary.ts',
]

const mojibakeMarkers = ['Ã', 'Ä', 'Å']

test('localization messages are split into guarded namespace files', () => {
  for (const relativePath of localizationFiles) {
    assert.equal(
      existsSync(join(appRoot, relativePath)),
      true,
      `${relativePath} should exist`,
    )
  }
})

test('localization source files do not contain mojibake markers', () => {
  for (const relativePath of localizationFiles) {
    if (!existsSync(join(appRoot, relativePath))) {
      continue
    }

    const source = readFileSync(join(appRoot, relativePath), 'utf8')

    for (const marker of mojibakeMarkers) {
      assert.equal(
        source.includes(marker),
        false,
        `${relativePath} should not contain mojibake marker ${marker}`,
      )
    }
  }
})

test('translation helper supports parameter interpolation', () => {
  const source = readFileSync(join(appRoot, 'src/features/localization/dictionary.ts'), 'utf8')

  assert.match(source, /TranslationParams/)
  assert.match(source, /params\?: TranslationParams/)
  assert.match(source, /replace/)
})
