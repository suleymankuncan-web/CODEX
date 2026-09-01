import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.cwd()
const sourcePath = join(
  root,
  'backend/nestjs/src/modules/integration/application/company-daily-kpi-pure-adapter.ts',
)
const testPath = join(
  root,
  'backend/nestjs/src/modules/integration/application/company-daily-kpi-pure-adapter.spec.ts',
)
const rangeSourcePath = join(
  root,
  'backend/nestjs/src/modules/integration/application/company-daily-kpi-range-aggregation.ts',
)
const rangeTestPath = join(
  root,
  'backend/nestjs/src/modules/integration/application/company-daily-kpi-range-aggregation.spec.ts',
)
const rangeServicePath = join(
  root,
  'backend/nestjs/src/modules/integration/application/company-daily-kpi-store-range.service.ts',
)
const rangeServiceTestPath = join(
  root,
  'backend/nestjs/src/modules/integration/application/company-daily-kpi-store-range.service.spec.ts',
)
const rangeRepositoryPath = join(
  root,
  'backend/nestjs/src/modules/integration/infrastructure/company-daily-kpi-component-range-read.repository.ts',
)
const rangeRepositoryTestPath = join(
  root,
  'backend/nestjs/src/modules/integration/infrastructure/company-daily-kpi-component-range-read.repository.spec.ts',
)
const contractPath = join(
  root,
  'docs/contracts/company-daily-kpi-storage-normalization-boundary-v1.md',
)
const source = readFileSync(sourcePath, 'utf8')
const unitTest = readFileSync(testPath, 'utf8')
const rangeSource = readFileSync(rangeSourcePath, 'utf8')
const rangeUnitTest = readFileSync(rangeTestPath, 'utf8')
const rangeService = readFileSync(rangeServicePath, 'utf8')
const rangeServiceUnitTest = readFileSync(rangeServiceTestPath, 'utf8')
const rangeRepository = readFileSync(rangeRepositoryPath, 'utf8')
const rangeRepositoryUnitTest = readFileSync(rangeRepositoryTestPath, 'utf8')
const contract = readFileSync(contractPath, 'utf8')
const privateExecutionMarkerPattern = new RegExp(
  `\\b(?:${['Run', 'Proc'].join('')}|${['Proc', 'Name'].join('')})\\b`,
  'i',
)

const rangeForbiddenPatterns = [
  /(?:\bfrom\s*["']|\bimport\s*["']|\brequire\(\s*["'])((?:node:)?(?:http|https|net|tls|dns|fs)|(?:http|https|net|tls|dns|fs))(["']|\s*\))/i,
  /\breadFile(?:Sync)?\b/,
  /\bfetch\s*\(/,
  /\baxios\b/i,
  /\bDatabaseService\b/,
  /\bPrisma\b/,
  /from ["']pg["']/,
  /from ["']@nestjs\//,
  /process\.env/,
  /\bwriteFile(?:Sync)?\b/,
  /\bconsole\.(?:log|error|warn)\s*\(/,
  /https?:\/\//i,
  /\blocalhost\b/i,
  /\.(?:internal|local|lan|corp|private)\b/i,
  /\bf[cd][0-9a-f]{0,2}:/i,
  /\bfe[89ab][0-9a-f]{0,1}:/i,
  /(?:^|[^0-9a-f])::1(?:$|[^0-9a-f])/i,
  /(?:^|[^0-9a-f])(?:0:){7}1(?:$|[^0-9a-f])/i,
  privateExecutionMarkerPattern,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  /\b(?:10|127|169\.254|172\.(?:1[6-9]|2\d|3[01])|192\.168)(?:\.\d{1,3}){2,3}\b/,
]

const rangeForbiddenSamples = [
  ['import x from "node:http"', rangeForbiddenPatterns[0]],
  ['import x from "node:https"', rangeForbiddenPatterns[0]],
  ['import x from "node:net"', rangeForbiddenPatterns[0]],
  ['import x from "node:tls"', rangeForbiddenPatterns[0]],
  ['import x from "node:dns"', rangeForbiddenPatterns[0]],
  ['import x from "node:fs"', rangeForbiddenPatterns[0]],
  ['import "http"', rangeForbiddenPatterns[0]],
  ['require("https")', rangeForbiddenPatterns[0]],
  ['readFile(path)', rangeForbiddenPatterns[1]],
  ['readFileSync(path)', rangeForbiddenPatterns[1]],
  ['fd12:3456::1', rangeForbiddenPatterns[14]],
  ['fc00::1', rangeForbiddenPatterns[14]],
  ['fe80::1', rangeForbiddenPatterns[15]],
  ['::1', rangeForbiddenPatterns[16]],
  ['0:0:0:0:0:0:0:1', rangeForbiddenPatterns[17]],
  ['localhost', rangeForbiddenPatterns[12]],
  ['service.internal', rangeForbiddenPatterns[13]],
  ['service.local', rangeForbiddenPatterns[13]],
  ['service.lan', rangeForbiddenPatterns[13]],
  ['service.corp', rangeForbiddenPatterns[13]],
  ['service.private', rangeForbiddenPatterns[13]],
  [['Run', 'Proc'].join(''), privateExecutionMarkerPattern],
  [['Proc', 'Name'].join(''), privateExecutionMarkerPattern],
]

const allowedRangeSourceImport =
  /^import type \{[\s\S]*?\} from "\.\/company-daily-kpi-pure-adapter";\r?\n/

function assertRangeSourceImportBoundary(candidate) {
  const withoutAllowedImport = candidate.replace(allowedRangeSourceImport, '')

  assert.notEqual(
    withoutAllowedImport,
    candidate,
    'range reducer must begin with the approved type-only adapter import',
  )
  assert.doesNotMatch(withoutAllowedImport, /\bimport\b/)
  assert.doesNotMatch(withoutAllowedImport, /\brequire\s*\(/)
  assert.doesNotMatch(withoutAllowedImport, /\bfrom\s+["']/)
}

test('pure adapter is backed by the approved storage boundary', () => {
  assert.match(contract, /Status: Approved/)
  assert.match(contract, /Product owner \(approved 1 September 2026\)/)
  assert.match(contract, /PR 2 — pure adapter/)
  assert.match(contract, /no network,\s+database, scheduler, Docker/i)
})

test('pure adapter has no network, database, runtime configuration, or framework coupling', () => {
  for (const forbidden of [
    /\bfetch\s*\(/,
    /\baxios\b/i,
    /\bDatabaseService\b/,
    /\bPrisma\b/,
    /from ["']pg["']/,
    /from ["']@nestjs\//,
    /process\.env/,
    /\bwriteFile(?:Sync)?\b/,
    /\bconsole\.(?:log|error|warn)\b/,
  ]) {
    assert.doesNotMatch(source, forbidden)
  }

  for (const requiredExport of [
    'normalizeCompanyDailySales',
    'normalizeCompanyDailyFootfall',
    'normalizeCompanyDailyGsm',
    'sanitizeCompanyStoreDirectory',
  ]) {
    assert.match(source, new RegExp(`export function ${requiredExport}\\b`))
  }
})

test('range reducer and spec stay network-free and framework-independent', () => {
  for (const candidate of [rangeSource, rangeUnitTest]) {
    for (const forbidden of rangeForbiddenPatterns) {
      assert.doesNotMatch(candidate, forbidden)
    }
  }

  assert.match(
    rangeSource,
    /export function aggregateCompanyDailyKpiStoreRange\b/,
  )
  assert.match(rangeSource, /availability:\s*"available"/)
  assert.match(rangeSource, /availability:\s*"unavailable"/)
  assert.match(rangeSource, /BigInt\(/)
  assert.doesNotMatch(rangeSource, /personnelCode\s*:/)
  assert.doesNotMatch(rangeSource, /(?:invoice|display)-[A-Za-z0-9_-]+/i)
  assertRangeSourceImportBoundary(rangeSource)
})

test('range guard detects private transport, address, hostname, and execution markers', () => {
  for (const [sample, forbidden] of rangeForbiddenSamples) {
    assert.match(sample, forbidden)
  }
})

test('range source import allowlist rejects dynamic and transitive runtime coupling', () => {
  assert.throws(() =>
    assertRangeSourceImportBoundary(`${rangeSource}\nimport("node:https")`),
  )
  assert.throws(() =>
    assertRangeSourceImportBoundary(
      `${rangeSource}\nimport { request } from "./company-daily-kpi-runtime-helper"`,
    ),
  )
  assert.throws(() =>
    assertRangeSourceImportBoundary(
      `${rangeSource}\n/* side effect */ import "./company-daily-kpi-runtime-helper"`,
    ),
  )
  assert.throws(() =>
    assertRangeSourceImportBoundary(
      rangeSource.replace(/^import type\b/, 'import'),
    ),
  )
})

test('decimal aggregation stays BigInt-based and public fixtures stay synthetic', () => {
  const decimalSection = source.match(
    /function parseDecimal[\s\S]+?(?=function resolveIstanbulDate|function isRequiredCode|$)/,
  )?.[0] ?? source

  assert.match(source, /type DecimalValue = \{[\s\S]*units: bigint/)
  assert.match(source, /BigInt\(/)
  assert.doesNotMatch(decimalSection, /\b(?:Number|parseFloat|parseInt)\s*\(/)

  const publicCandidate = [
    source,
    unitTest,
    rangeSource,
    rangeUnitTest,
    rangeService,
    rangeServiceUnitTest,
    rangeRepository,
    rangeRepositoryUnitTest,
  ].join('\n')
  assert.doesNotMatch(publicCandidate, /https?:\/\//i)
  assert.doesNotMatch(
    publicCandidate,
    /\b(?:10|127|169\.254|172\.(?:1[6-9]|2\d|3[01])|192\.168)(?:\.\d{1,3}){2,3}\b/,
  )
  assert.doesNotMatch(
    publicCandidate,
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  )
})
