import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const standardPath = 'docs/process/ui-surface-standard-v1.md'
const disciplinePath = 'discipline.md'
const productExperiencePath = 'docs/process/product-experience-principles.md'
const docsReadmePath = 'docs/README.md'

const allowedCurrentProductCopyMatches = new Map([
  ['admin-web/src/features/localization/messages/store-home.ts::real-data copy', 2],
  ['admin-web/src/features/localization/messages/store-kpis-command.ts::row-explanation copy', 1],
  ['admin-web/src/features/localization/messages/store-kpis.ts::row-explanation copy', 1],
  ['admin-web/src/features/localization/messages/store-tasks.ts::row-explanation copy', 2],
  ['admin-web/src/features/localization/messages/store-workforce.ts::row-explanation copy', 2],
  ['admin-web/src/features/localization/messages/store-workforce.ts::real-data copy', 1],
  ['admin-web/src/features/localization/messages/store-workforce.ts::safe-data-source copy', 3],
  ['admin-web/src/features/localization/messages/store-workforce.ts::session-authorized copy', 2],
  ['admin-web/src/features/localization/messages/store-workforce.ts::source-required copy', 1],
  ['admin-web/src/features/localization/messages/store-workforce.ts::no-store-action copy', 1],
  ['admin-web/src/pages/store-approvals-request-center-model.ts::row-explanation copy', 1],
  ['admin-web/src/pages/store-approvals-request-center-model.ts::page-size prose copy', 1],
  ['admin-web/src/pages/store-checklists-visit-panel.tsx::row-explanation copy', 2],
])

const forbiddenProductCopyPatterns = [
  {
    pattern: /Her sat(?:\u0131r|ir)/g,
    reason: 'row-explanation copy',
  },
  {
    pattern: /ger(?:\u00e7|c)ek veri/gi,
    reason: 'real-data copy',
  },
  {
    pattern: /g(?:\u00fc|u)venli veri kayna(?:\u011f|g)(?:\u0131|i)/gi,
    reason: 'safe-data-source copy',
  },
  {
    pattern: /oturumdaki yetkili/gi,
    reason: 'session-authorized copy',
  },
  {
    pattern: /sayfa ba(?:\u015f|s)(?:\u0131|i)na/gi,
    reason: 'page-size prose copy',
  },
  {
    pattern: /Kaynak gerekli/g,
    reason: 'source-required copy',
  },
  {
    pattern: /hen(?:\u00fc|u)z veri kayna(?:\u011f|g)(?:\u0131|i)/gi,
    reason: 'missing-data-source copy',
  },
  {
    pattern: /Ma(?:\u011f|g)azaya git yok/gi,
    reason: 'no-store-action copy',
  },
]

const strictSurfacePatterns = [
  ...forbiddenProductCopyPatterns,
  {
    pattern: /tw:(?:bg|text|border)-\[#/g,
    reason: 'raw hex Tailwind color',
  },
  {
    pattern: /\b(?:control-button|ghost-button|store-rankings-primary-button|store-checklists-action-button)\b/g,
    reason: 'legacy route-specific button class',
  },
]

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' })
}

function readText(path) {
  return readFileSync(path, 'utf8')
}

function trackedUiSourceFiles() {
  return git(['ls-files', 'admin-web/src'])
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((path) => /\.(ts|tsx)$/.test(path))
}

function countPatternMatches(text, pattern) {
  return [...text.matchAll(new RegExp(pattern, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))]
    .length
}

function productCopyViolations(files = trackedUiSourceFiles(), reader = readText) {
  const violations = []

  for (const file of files) {
    const text = reader(file, 'utf8')

    for (const { pattern, reason } of forbiddenProductCopyPatterns) {
      const count = countPatternMatches(text, pattern)
      const allowedCount = allowedCurrentProductCopyMatches.get(`${file}::${reason}`) ?? 0
      if (count > allowedCount) {
        violations.push(`${file}: ${reason} matched ${pattern}; count ${count} exceeds allowed ${allowedCount}`)
      }
    }
  }

  return violations
}

function strictSurfaceViolations(files, reader = readText) {
  const violations = []

  for (const file of files) {
    const text = reader(file, 'utf8')

    for (const { pattern, reason } of strictSurfacePatterns) {
      if (countPatternMatches(text, pattern) > 0) {
        violations.push(`${file}: ${reason} matched ${pattern}`)
      }
    }
  }

  return violations
}

function requireText(text, expected) {
  assert.ok(text.includes(expected), `Missing expected text: ${expected}`)
}

test('UI surface standard is discoverable from operating docs', () => {
  const standard = readText(standardPath)

  for (const text of [readText(disciplinePath), readText(productExperiencePath), readText(docsReadmePath)]) {
    requireText(text, standardPath)
  }

  for (const expected of [
    '# UI Surface Standard V1',
    '## Component Selection',
    '## Button Standard',
    '## Icon Standard',
    '## Page Anatomy',
    '## Token And Color Standard',
    '## Product Copy Standard',
    '## Prototype To Product',
    '## Guard',
    '## Done Criteria',
  ]) {
    requireText(standard, expected)
  }
})

test('active UI product copy does not exceed the explicit current baseline', () => {
  assert.deepEqual(productCopyViolations(), [])
})

test('UI surface guard rejects synthetic product-copy violations beyond baseline', () => {
  const fakeFile = 'admin-web/src/pages/FakeNewSurface.tsx'
  const violations = productCopyViolations([fakeFile], () => {
    return [
      'Her satir gercek bir talep kaydini temsil eder.',
      'Guvenli veri kaynagi henuz yok.',
      'Oturumdaki yetkili magaza listesinden okunur.',
      'Sayfa basina en fazla 15 kayit gosterir.',
    ].join('\n')
  })

  assert.ok(violations.some((violation) => violation.includes('row-explanation copy')))
  assert.ok(violations.some((violation) => violation.includes('safe-data-source copy')))
  assert.ok(violations.some((violation) => violation.includes('session-authorized copy')))
  assert.ok(violations.some((violation) => violation.includes('page-size prose copy')))
})

test('UI surface strict scanner rejects raw colors and legacy button classes for new surfaces', () => {
  const fakeFile = 'admin-web/src/pages/FakeStrictSurface.tsx'
  const violations = strictSurfaceViolations([fakeFile], () => {
    return '<Button className="tw:bg-[#6847ff] control-button">Kaydet</Button>'
  })

  assert.ok(violations.some((violation) => violation.includes('raw hex Tailwind color')))
  assert.ok(violations.some((violation) => violation.includes('legacy route-specific button class')))
})
