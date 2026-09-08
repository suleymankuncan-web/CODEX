import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { prepareCompanyStores } from './company-store-preparation-model.mjs'
import { runPreparation } from './company-store-preparation.mjs'

const day = '2026-09-07'
const company = '00000000-0000-0000-0000-000000000001'
const other = '00000000-0000-0000-0000-000000000002'
const store = '00000000-0000-0000-0000-000000000003'
function fixture() {
  return { schemaVersion: 1, snapshotDate: day, targetCompanyId: company,
    directoryStoreCodes: ['synthetic-001'], selectedStoreCodes: ['synthetic-001'],
    registeredStores: [{ storeId: store, companyId: company, storeCode: 'synthetic-001', status: 'active', kpiImportEnabled: true }],
    runtime: { strictLocal: true, dataClass: 'synthetic' } }
}

test('exact eligible mapping prepares only mapping, never company activation', () => {
  const input = fixture()
  const before = structuredClone(input)
  const result = prepareCompanyStores(input, day)
  assert.equal(result.summary.mappingState, 'prepared')
  assert.equal(result.summary.activationState, 'blocked')
  assert.equal(result.summary.counts.eligible, 1)
  assert.equal(result.summary.dataImported, false)
  assert.equal(result.summary.configurationChanged, false)
  assert.ok(result.summary.runtimeBlockers.includes('synthetic_runtime_only'))
  assert.ok(result.summary.runtimeBlockers.includes('company_runtime_not_verified'))
  assert.ok(result.summary.runtimeBlockers.includes('connector_readiness_not_evaluated'))
  assert.ok(result.summary.runtimeBlockers.includes('shared_ingestion_not_connected'))
  assert.deepEqual(input, before)
  assert.doesNotMatch(JSON.stringify(result.summary), /synthetic-001|00000000-/)
})

test('mapping does not infer by case, whitespace or stripped leading zeroes', () => {
  for (const candidate of ['SYNTHETIC-001', 'synthetic-1']) {
    const input = fixture()
    input.selectedStoreCodes = [candidate]
    assert.equal(prepareCompanyStores(input, day).summary.counts.missing, 1)
  }
  const input = fixture()
  input.selectedStoreCodes = [' synthetic-001 ']
  assert.throws(() => prepareCompanyStores(input, day), /invalid_preparation_input/)
})

test('unknown, cross-company, inactive and disabled stores cannot be prepared', () => {
  for (const [mutate, reason] of [
    [(x) => { x.registeredStores = [] }, 'missing_store'],
    [(x) => { x.registeredStores[0].companyId = other }, 'wrong_company'],
    [(x) => { x.registeredStores[0].status = 'closed' }, 'inactive_store'],
    [(x) => { x.registeredStores[0].kpiImportEnabled = false }, 'import_disabled'],
    [(x) => { x.directoryStoreCodes = [] }, 'absent_from_directory'],
  ]) {
    const input = fixture(); mutate(input)
    const result = prepareCompanyStores(input, day)
    assert.equal(result.summary.mappingState, 'blocked')
    assert.ok(result.privateReport.rows[0].reasons.includes(reason))
  }
})

test('ambiguous codes and duplicate internal identities fail closed without picking a winner', () => {
  const input = fixture()
  input.registeredStores.push({ ...input.registeredStores[0], storeId: other, companyId: other })
  const result = prepareCompanyStores(input, day)
  assert.equal(result.summary.counts.ambiguous, 1)
  assert.deepEqual(result.privateReport.rows[0].reasons, ['ambiguous_store_code'])
  input.registeredStores[1].storeId = store
  assert.ok(prepareCompanyStores(input, day).summary.blockers.includes('duplicate_store_identity'))
})

test('selection is explicit and deduplication does not silently approve repeated selections', () => {
  const input = fixture()
  input.selectedStoreCodes = []
  assert.ok(prepareCompanyStores(input, day).summary.blockers.includes('store_selection_required'))
  input.selectedStoreCodes = ['synthetic-001', 'synthetic-001']
  assert.ok(prepareCompanyStores(input, day).summary.blockers.includes('duplicate_selection'))
  input.selectedStoreCodes = ['synthetic-001']
  input.directoryStoreCodes.push('synthetic-001')
  assert.equal(prepareCompanyStores(input, day).summary.counts.directory, 1)
})

test('stale and future snapshots cannot become current through a config switch', () => {
  for (const evaluation of ['2026-09-06', '2026-09-08']) {
    assert.ok(prepareCompanyStores(fixture(), evaluation).summary.blockers.includes('snapshot_date_mismatch'))
  }
})

test('runtime observations never grant activation or misclassify company mode', () => {
  for (const [runtime, reason] of [
    [{strictLocal: true, dataClass: 'company'}, 'company_runtime_not_verified'],
    [{strictLocal: false, dataClass: 'company'}, 'strict_local_required'],
    [{strictLocal: true, dataClass: 'synthetic'}, 'synthetic_runtime_only'],
    [{strictLocal: false, dataClass: 'synthetic'}, 'strict_local_required'],
    [{strictLocal: true, dataClass: 'unspecified'}, 'invalid_strict_local_data_class'],
  ]) {
    const result = prepareCompanyStores({...fixture(), runtime}, day)
    assert.equal(result.summary.mappingState, 'prepared')
    assert.equal(result.summary.activationState, 'blocked')
    assert.equal(result.summary.dataImported, false)
    assert.equal(result.summary.configurationChanged, false)
    assert.ok(result.summary.runtimeBlockers.includes(reason))
    assert.ok(result.summary.runtimeBlockers.includes('company_runtime_not_verified'))
    assert.ok(result.summary.runtimeBlockers.includes('connector_readiness_not_evaluated'))
    assert.ok(result.summary.runtimeBlockers.includes('shared_ingestion_not_connected'))
    if (runtime.dataClass === 'company') {
      assert.ok(!result.summary.runtimeBlockers.includes('invalid_strict_local_data_class'))
    }
  }
})

test('rejects private extra fields, malformed records, invalid dates and unbounded inputs', () => {
  for (const mutate of [
    (x) => { x.endpoint = 'synthetic-private-canary' },
    (x) => { x.registeredStores[0].storeName = 'synthetic-private-canary' },
    (x) => { x.registeredStores[0].kpiImportEnabled = 'true' },
    (x) => { x.runtime.token = 'synthetic-private-canary' },
    (x) => { x.snapshotDate = '2026-02-30' },
    (x) => { x.directoryStoreCodes = Array(10001).fill('synthetic-001') },
    (x) => { x.selectedStoreCodes = ['bad\ncode'] },
    (x) => { x.targetCompanyId = null },
  ]) {
    const input = fixture(); mutate(input)
    assert.throws(() => prepareCompanyStores(input, day), {message: 'invalid_preparation_input'})
  }
})

test('private report order is deterministic and excludes unused directory codes', () => {
  const input = fixture()
  input.directoryStoreCodes.push('synthetic-unused')
  assert.deepEqual(prepareCompanyStores(input, day), prepareCompanyStores({...input,
    directoryStoreCodes: [...input.directoryStoreCodes].reverse()}, day))
  assert.equal(prepareCompanyStores(input, day).privateReport.rows.length, 1)
})

test('CLI protects private files and emits only bounded safe diagnostics', {skip: process.platform === 'win32'}, () => {
  const dir = mkdtempSync(join(tmpdir(), 'company-store-preparation-'))
  chmodSync(dir, 0o700)
  try {
    const input = join(dir, 'input.json'), report = join(dir, 'report.json')
    writeFileSync(input, JSON.stringify(fixture()), {mode: 0o600})
    const args = ['--input', input, '--evaluation-date', day, '--private-report', report]
    assert.equal(runPreparation(args).mappingState, 'prepared')
    assert.equal(statSync(report).mode & 0o777, 0o600)
    assert.equal(JSON.parse(readFileSync(report)).rows[0].storeCode, 'synthetic-001')
    const before = readFileSync(report)
    assert.throws(() => runPreparation(args))
    assert.deepEqual(readFileSync(report), before)
    const link = join(dir, 'link.json'); symlinkSync(input, link)
    assert.throws(() => runPreparation(['--input', link, '--evaluation-date', day]))
    chmodSync(input, 0o644)
    assert.throws(() => runPreparation(['--input', input, '--evaluation-date', day]))
    chmodSync(input, 0o600)
    writeFileSync(input, 'synthetic-private-canary')
    const child = spawnSync(process.execPath, [fileURLToPath(new URL('./company-store-preparation.mjs', import.meta.url)),
      '--input', input, '--evaluation-date', day], {encoding: 'utf8'})
    assert.equal(child.status, 1)
    assert.equal(child.stdout, '')
    assert.doesNotMatch(child.stderr, /synthetic-private-canary|input\.json/)
    assert.equal(JSON.parse(child.stderr).reason, 'invalid_or_unreadable_input')
  } finally { rmSync(dir, {recursive: true, force: true}) }
})

test('CLI rejects unsupported, missing and duplicate flags before touching files', () => {
  for (const args of [[], ['--input'], ['--token', 'secret'], ['--input', 'a', '--input', 'b']]) {
    assert.throws(() => runPreparation(args), /preparation_io_rejected/)
  }
})

test('CLI rejects repository input, oversized private input and non-private report parents', {skip: process.platform === 'win32'}, () => {
  assert.throws(() => runPreparation(['--input', fileURLToPath(new URL('../package.json', import.meta.url)),
    '--evaluation-date', day]), /preparation_io_rejected/)
  const dir = mkdtempSync(join(tmpdir(), 'company-store-preparation-'))
  chmodSync(dir, 0o700)
  try {
    const input = join(dir, 'input.json')
    writeFileSync(input, ' '.repeat(4 * 1024 * 1024 + 1), {mode: 0o600})
    assert.throws(() => runPreparation(['--input', input, '--evaluation-date', day]), /preparation_io_rejected/)
    writeFileSync(input, JSON.stringify(fixture()))
    chmodSync(dir, 0o755)
    assert.throws(() => runPreparation(['--input', input, '--evaluation-date', day,
      '--private-report', join(dir, 'report.json')]), /preparation_io_rejected/)
  } finally { rmSync(dir, {recursive: true, force: true}) }
})

test('CLI blocked and prepared outcomes never print codes or imply activation', {skip: process.platform === 'win32'}, () => {
  const dir = mkdtempSync(join(tmpdir(), 'company-store-preparation-'))
  chmodSync(dir, 0o700)
  try {
    const path = join(dir, 'input.json')
    for (const selected of [[], ['synthetic-001']]) {
      writeFileSync(path, JSON.stringify({...fixture(), selectedStoreCodes: selected}), {mode: 0o600})
      const child = spawnSync(process.execPath, [fileURLToPath(new URL('./company-store-preparation.mjs', import.meta.url)),
        '--input', path, '--evaluation-date', day], {encoding: 'utf8'})
      assert.equal(child.status, selected.length ? 0 : 2)
      assert.equal(child.stderr, '')
      assert.equal(JSON.parse(child.stdout).activationState, 'blocked')
      assert.doesNotMatch(child.stdout, /synthetic-001|00000000-/)
    }
  } finally { rmSync(dir, {recursive: true, force: true}) }
})
