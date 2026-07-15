import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const standardPath = 'docs/process/ui-surface-standard-v1.md'
const recipesPath = 'docs/process/ui-surface-recipes-v1.md'
const disciplinePath = 'discipline.md'
const productExperiencePath = 'docs/process/product-experience-principles.md'
const docsReadmePath = 'docs/README.md'
const shadcnTokenPath = 'admin-web/src/styles/shadcn-tailwind.css'

const forbiddenLegacyTokenNames = [
  '--bg',
  '--bg-strong',
  '--surface',
  '--surface-strong',
  '--surface-card',
  '--surface-ink',
  '--surface-muted',
  '--line',
  '--line-strong',
  '--accent',
  '--accent-strong',
  '--accent-soft',
  '--glacier-accent',
  '--glacier-accent-soft',
  '--blue-accent',
  '--warning',
  '--warning-soft',
  '--danger',
  '--danger-soft',
  '--calm',
  '--calm-soft',
  '--neutral-soft',
  '--focus-ring',
  '--shadow',
  '--radius-xl',
  '--radius-lg',
  '--radius-md',
  '--font-sans',
  '--font-mono',
]

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
])

const allowedCurrentStrictSurfaceMatches = new Map([
  ['admin-web/src/components/reporting-tools.tsx::legacy route-specific button class', 1],
  ['admin-web/src/features/pilot-feedback/PilotFeedbackControl.tsx::legacy route-specific button class', 2],
  ['admin-web/src/features/store-tasks/StoreActionPlanCommandPanel.tsx::raw hex Tailwind color', 2],
  ['admin-web/src/features/store-tasks/StoreActionPlanDetailDialog.tsx::raw hex Tailwind color', 46],
  ['admin-web/src/features/store-tasks/store-tasks-workbench.tsx::raw hex Tailwind color', 75],
  ['admin-web/src/pages/AdminFeedPage.tsx::legacy route-specific button class', 6],
  ['admin-web/src/pages/SessionReadinessPage.tsx::legacy route-specific button class', 3],
  ['admin-web/src/pages/StoreRankingsPage.tsx::legacy route-specific button class', 1],
  ['admin-web/src/pages/StoreTasksPage.tsx::raw hex Tailwind color', 22],
  ['admin-web/src/pages/StoreWorkforcePage.tsx::raw hex Tailwind color', 48],
  ['admin-web/src/pages/store-kpis-command-deck-header.tsx::raw hex Tailwind color', 14],
  ['admin-web/src/pages/store-kpis-command-deck.tsx::raw hex Tailwind color', 63],
  ['admin-web/src/pages/store-kpis-region-overview.tsx::raw hex Tailwind color', 52],
  ['admin-web/src/pages/store-rankings-table.tsx::legacy route-specific button class', 2],
  ['admin-web/src/pages/store-workforce-region-detail-panes.tsx::raw hex Tailwind color', 28],
  ['admin-web/src/pages/store-workforce-region-metrics.tsx::raw hex Tailwind color', 8],
  ['admin-web/src/pages/store-workforce-region-view.tsx::raw hex Tailwind color', 71],
  ['admin-web/src/pages/store-workforce-store-manager-presentation.tsx::raw hex Tailwind color', 40],
  ['admin-web/src/pages/store-workforce-store-manager-view-model.ts::raw hex Tailwind color', 8],
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
    .filter((path) => existsSync(path))
    .filter((path) => /\.(ts|tsx)$/.test(path))
}

function trackedStyleFiles() {
  return git(['ls-files', 'admin-web/src/styles'])
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((path) => existsSync(path))
    .filter((path) => /\.css$/.test(path))
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

function strictSurfaceViolations(files = trackedUiSourceFiles(), reader = readText) {
  const violations = []

  for (const file of files) {
    const text = reader(file, 'utf8')

    for (const { pattern, reason } of strictSurfacePatterns) {
      const count = countPatternMatches(text, pattern)
      const allowedCount = allowedCurrentStrictSurfaceMatches.get(`${file}::${reason}`) ?? 0
      if (count > allowedCount) {
        violations.push(`${file}: ${reason} matched ${pattern}; count ${count} exceeds allowed ${allowedCount}`)
      }
    }
  }

  return violations
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function legacyTokenOwnershipViolations(files = trackedStyleFiles(), reader = readText) {
  const violations = []

  for (const file of files) {
    if (file === shadcnTokenPath) {
      continue
    }

    const text = reader(file, 'utf8')

    for (const tokenName of forbiddenLegacyTokenNames) {
      const escapedToken = escapeRegExp(tokenName)
      const declarationPattern = new RegExp(`${escapedToken}\\s*:`, 'g')
      const referencePattern = new RegExp(`var\\(${escapedToken}(?=[,)\\s])`, 'g')
      const declarationCount = countPatternMatches(text, declarationPattern)
      const referenceCount = countPatternMatches(text, referencePattern)

      if (declarationCount > 0 || referenceCount > 0) {
        violations.push(
          `${file}: ${tokenName} is reserved for shadcn or legacy namespace cleanup; declarations ${declarationCount}, references ${referenceCount}`,
        )
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
  const recipes = readText(recipesPath)

  for (const text of [readText(disciplinePath), readText(productExperiencePath), readText(docsReadmePath)]) {
    requireText(text, standardPath)
  }

  for (const text of [standard, readText(productExperiencePath), readText(docsReadmePath)]) {
    requireText(text, recipesPath)
  }

  for (const expected of [
    '# UI Surface Standard V1',
    '## Component Selection',
    '## Button Standard',
    '## Icon Standard',
    '## Page Anatomy',
    '## Token And Color Standard',
    'Token ownership:',
    '## Product Copy Standard',
    '## Prototype To Product',
    '## Guard',
    '## Done Criteria',
    'production-bound prototypes must be built from the same runtime contract as',
    'with custom CSS is only a concept sketch',
    'the route shell, workspace width, font family, button variants, badge tones',
  ]) {
    requireText(standard, expected)
  }

  for (const expected of [
    '# UI Surface Recipes V1',
    '## Date Filter',
    '## Period Filter',
    '## Table Toolbar',
    '## Data Table',
    '## Detail Drawer',
    '## Action Dialog',
    '## Empty State',
    '## Error State',
    '## Prototype To Product Checklist',
  ]) {
    requireText(recipes, expected)
  }
})

test('prototype shelf distinguishes HTML visual contracts from production runtime parity', () => {
  const prototypeReadme = readText('docs/prototypes/README.md')

  for (const expected of [
    'Standalone HTML files in this shelf are visual contracts, not production',
    'React/shadcn slice inside the HR Axis app shell',
    'move its typography, spacing, token, button, badge, table/list, drawer, and',
  ]) {
    requireText(prototypeReadme, expected)
  }
})

test('active UI product copy does not exceed the explicit current baseline', () => {
  assert.deepEqual(productCopyViolations(), [])
})

test('active UI strict surface patterns do not exceed the explicit current baseline', () => {
  assert.deepEqual(strictSurfaceViolations(), [])
})

test('style token ownership keeps legacy foundation values namespaced', () => {
  assert.deepEqual(legacyTokenOwnershipViolations(), [])
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

test('UI surface strict scanner rejects added strict matches in baseline files', () => {
  const file = 'admin-web/src/pages/store-kpis-command-deck.tsx'
  const currentAllowed = allowedCurrentStrictSurfaceMatches.get(`${file}::raw hex Tailwind color`) ?? 0
  const violations = strictSurfaceViolations([file], () => {
    return Array.from({ length: currentAllowed + 1 }, () => 'tw:bg-[#6847ff]').join('\n')
  })

  assert.ok(violations.some((violation) => violation.includes(`count ${currentAllowed + 1} exceeds allowed ${currentAllowed}`)))
})

test('style token ownership rejects unprefixed legacy tokens outside shadcn token file', () => {
  const fakeFile = 'admin-web/src/styles/fake-legacy-surface.css'
  const violations = legacyTokenOwnershipViolations([fakeFile], () => {
    return [
      ':root {',
      '  --surface-ink: #171421;',
      '}',
      '.fake { --accent: #7c3aed; }',
      '.fake { color: red; --radius-md: 14px; }',
      '.fake { color: var(--surface-ink); }',
    ].join('\n')
  })

  assert.ok(violations.some((violation) => violation.includes('--accent')))
  assert.ok(violations.some((violation) => violation.includes('--radius-md')))
  assert.ok(violations.some((violation) => violation.includes('--surface-ink')))
})
