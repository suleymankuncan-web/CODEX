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
const contractPath = join(
  root,
  'docs/contracts/company-daily-kpi-storage-normalization-boundary-v1.md',
)
const source = readFileSync(sourcePath, 'utf8')
const unitTest = readFileSync(testPath, 'utf8')
const contract = readFileSync(contractPath, 'utf8')

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

test('decimal aggregation stays BigInt-based and public fixtures stay synthetic', () => {
  const decimalSection = source.match(
    /function parseDecimal[\s\S]+?(?=function resolveIstanbulDate|function isRequiredCode|$)/,
  )?.[0] ?? source

  assert.match(source, /type DecimalValue = \{[\s\S]*units: bigint/)
  assert.match(source, /BigInt\(/)
  assert.doesNotMatch(decimalSection, /\b(?:Number|parseFloat|parseInt)\s*\(/)

  const publicCandidate = `${source}\n${unitTest}`
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
