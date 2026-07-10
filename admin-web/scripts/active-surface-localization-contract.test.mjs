import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const appRoot = dirname(scriptsDir)

const guardedFiles = [
  'src/pages/StoreFeedPage.tsx',
  'src/pages/StoreReportsPage.tsx',
  'src/pages/store-reports-model.ts',
  'src/pages/store-reports-period.ts',
  'src/pages/AdminIncentivesPage.tsx',
  'src/pages/admin-incentive-region-packages.tsx',
]

const messageFiles = [
  'src/features/localization/messages/store-feed.ts',
  'src/features/localization/messages/store-reports.ts',
  'src/features/localization/messages/admin-incentives.ts',
]

const allowedJsxAttributes = new Set([
  'className',
  'data-testid',
  'htmlFor',
  'id',
  'key',
  'testId',
])

const stableLiteralAllowlist = new Map([
  [
    'src/pages/StoreFeedPage.tsx',
    new Set([
      // Payload compatibility: this fallback can become a persisted post title.
      'Bölge duyurusu',
    ]),
  ],
])

test('active localized surfaces keep product copy dictionary-owned', () => {
  const findings = guardedFiles.flatMap((relativePath) => {
    const source = readFileSync(join(appRoot, relativePath), 'utf8')
    return findRawProductCopy(source, relativePath)
  })

  assert.deepEqual(findings, [])
})

test('active surface raw-copy guard rejects synthetic product copy', () => {
  const findings = findRawProductCopy(
    'export function SyntheticSurface() { return <h1>New product copy</h1> }',
    'synthetic.tsx',
  )

  assert.deepEqual(findings, ['synthetic.tsx: New product copy'])
})

test('active localized surfaces and message catalogs are mojibake-free', () => {
  const mojibakePattern = /[ÃÄÅ�]/u

  for (const relativePath of [...guardedFiles, ...messageFiles]) {
    const source = readFileSync(join(appRoot, relativePath), 'utf8')
    assert.doesNotMatch(source, mojibakePattern, relativePath)
  }
})

function findRawProductCopy(source, relativePath) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const findings = []

  function visit(node) {
    if (isTextLiteral(node)) {
      const value = getLiteralValue(node)
      if (isHumanCopyCandidate(value) && !isAllowedLiteral(node, value, relativePath)) {
        findings.push(`${relativePath}: ${value}`)
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return findings
}

function isTextLiteral(node) {
  return ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateExpression(node) ||
    ts.isJsxText(node)
}

function getLiteralValue(node) {
  if (ts.isTemplateExpression(node)) {
    return `${node.head.text}${node.templateSpans.map((span) => span.literal.text).join('')}`.trim()
  }
  return node.text.trim()
}

function isHumanCopyCandidate(value) {
  if (!value) return false
  return /[çğıöşüÇĞİÖŞÜ]/u.test(value) || /[A-Za-z]{2,}\s+[A-Za-z]{2,}/u.test(value)
}

function isAllowedLiteral(node, value, relativePath) {
  if (stableLiteralAllowlist.get(relativePath)?.has(value)) return true
  if (value.startsWith('Invalid report period:')) return true

  for (let current = node.parent; current; current = current.parent) {
    if (ts.isImportDeclaration(current) || ts.isExportDeclaration(current)) return true

    if (ts.isJsxAttribute(current)) {
      return allowedJsxAttributes.has(current.name.getText())
    }

    if (ts.isCallExpression(current) && current.expression.getText() === 't') {
      return true
    }

    if (ts.isFunctionDeclaration(current) && current.name?.text === 'exportAdminIncentiveRowsToExcel') {
      // Existing spreadsheet headers/cells and HTML are an intentionally stable export contract.
      return true
    }
  }

  return false
}
