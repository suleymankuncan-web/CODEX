import assert from 'node:assert/strict'
import test from 'node:test'
import { combineSpecResults, hasUncertainSpecImports, reportCases, selectSpecRecovery } from './playwright-recovery.mjs'

const head = 'a'.repeat(40)
test('spec dependency analysis covers static, side-effect, type, namespace, barrel and dynamic imports', () => {
  for (const source of [
    "import './other.spec.ts'",
    "import/**/'./other.spec.ts'",
    "import type { T } from './other.spec'",
    "import * as ns from './other.spec.ts'",
    "export * from './other.spec.ts'",
    "export { item } from './other.spec.ts'",
    "import x = require('./other.spec.ts')",
    "type X = import('./other.spec.ts').T",
    "const x = import('./other.spec.ts')",
    "const x = require(path)",
    "const x = import(path)",
    "import './safe-helper'; import './other.spec.ts'",
  ]) assert.equal(hasUncertainSpecImports(source), true, source)
  for (const source of [
    "import { helper } from './helper'",
    "// import './other.spec.ts'\nconst safe = 1",
    'const text = "import other from other.spec.ts"',
  ]) assert.equal(hasUncertainSpecImports(source), false, source)
})
function report(files = ['one.spec.ts', 'two.spec.ts']) {
  return { errors: [], suites: files.map((file) => ({ title: file, file, specs: [
    { title: 'case', file, tests: [{ projectName: 'chromium', expectedStatus: 'passed', status: 'expected',
      results: [{ status: 'passed', duration: 10, errors: [] }] }] },
  ] })) }
}
function fixture() {
  const raw = report()
  const inventory = reportCases(raw)
  const digests = { 'one.spec.ts': 'one', 'two.spec.ts': 'two' }
  const selection = { execute: Object.keys(digests), reused: [] }
  const previous = combineSpecResults({ inventory, report: raw, selection, sharedDigest: 'shared', digests, sourceHead: head, exitCode: 0 })
  return { inventory, previous, sharedDigest: 'shared', digests, reviewedSpecs: Object.keys(digests), reviewedSpecDigests: { ...digests } }
}

test('changed or failed spec executes; unchanged reviewed passing spec is retained with complete coverage', () => {
  const input = fixture()
  input.digests = { ...input.digests, 'two.spec.ts': 'changed' }
  const selection = selectSpecRecovery(input)
  assert.deepEqual(selection.reused, ['one.spec.ts'])
  assert.deepEqual(selection.execute, ['two.spec.ts'])
  const combined = combineSpecResults({ ...input, selection, report: report(['two.spec.ts']), sourceHead: 'b'.repeat(40), exitCode: 0 })
  assert.equal(combined.outcome, 'passed')
  assert.equal(combined.executedCount + combined.reusedCount, input.inventory.length)
  assert.equal(combined.cases[0].sourceHead, head)
  input.previous.cases[0].passed = false
  assert.equal(selectSpecRecovery(input).reused.length, 0)
})

test('unknown inputs, dependencies, inventory drift, malformed data, expired proof or infrastructure error fall back to full', () => {
  const variants = [
    (x) => { x.sharedDigest = 'source changed' },
    (x) => { x.uncertain = true },
    (x) => { x.inventory.push({ id: 'new', file: 'one.spec.ts' }) },
    (x) => { x.previous.cases.pop() },
    (x) => { x.previous.cases.push(x.previous.cases[0]) },
    (x) => { x.previous.cases[0].file = 'wrong.spec.ts' },
    (x) => { x.previous.cases[0].sourceHead = null },
    (x) => { x.previous.completedAt = '2000-01-01' },
    (x) => { x.previous.globalErrors = true },
    (x) => { x.previous.outcome = 'cancelled' },
    (x) => { x.reviewedSpecDigests = {} },
  ]
  for (const mutate of variants) {
    const input = fixture(); mutate(input)
    const selected = selectSpecRecovery(input)
    assert.ok(selected.execute.includes('one.spec.ts'))
  }
  const input = fixture()
  input.reviewedSpecs = []
  assert.equal(selectSpecRecovery(input).reused.length, 0)
})

test('skipped, flaky, retried, expected failure and global teardown errors never become retained passes', () => {
  for (const mutate of [
    (test) => { test.status = 'skipped'; test.results = [] },
    (test) => { test.status = 'flaky' },
    (test) => { test.results.push({ status: 'passed' }) },
    (test) => { test.expectedStatus = 'failed' },
  ]) {
    const raw = report(); mutate(raw.suites[0].specs[0].tests[0])
    assert.equal(reportCases(raw)[0].passed, false)
  }
  const input = fixture()
  const selection = { execute: ['one.spec.ts', 'two.spec.ts'], reused: [] }
  const raw = report(); raw.errors.push({ message: 'teardown failed' })
  const combined = combineSpecResults({ ...input, selection, report: raw, sourceHead: head, exitCode: 0 })
  assert.equal(combined.outcome, 'failed')
  assert.equal(combined.globalErrors, true)
  assert.throws(() => combineSpecResults({ ...input, selection, report: report(['one.spec.ts']), sourceHead: head, exitCode: 0 }), /selected inventory/)
})

test('retained case expiry is preserved across repeated recovery runs', () => {
  const input = fixture()
  input.previous.cases[0].provenAt = '2000-01-01'
  const selection = selectSpecRecovery(input)
  assert.deepEqual(selection.execute, ['one.spec.ts'])
})
