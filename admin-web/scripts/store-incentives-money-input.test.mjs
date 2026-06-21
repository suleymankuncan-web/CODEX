import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const moduleUrl = new URL('../src/pages/store-incentives-money-input.ts', import.meta.url)
const source = await readFile(moduleUrl, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    verbatimModuleSyntax: true,
  },
})
const moneyInput = await import(
  `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`
)

test('incentive money input normalizes plain and localized typing paths', () => {
  assert.equal(moneyInput.normalizeMoneyInput('1500'), '1500.00')
  assert.equal(moneyInput.normalizeMoneyInput('50000'), '50000.00')
  assert.equal(moneyInput.normalizeMoneyInput('50000,75'), '50000.75')
  assert.equal(moneyInput.normalizeMoneyInput('50000.75'), '50000.75')
  assert.equal(moneyInput.normalizeMoneyInput('1.500'), '1500.00')
  assert.equal(moneyInput.normalizeMoneyInput('1.500,25'), '1500.25')
})

test('incentive money input keeps a raw edit buffer and formats only for display', () => {
  assert.equal(moneyInput.toMoneyInputBuffer('50.000,00 TL'), '50000,00')
  assert.equal(moneyInput.toMoneyInputBuffer('50000'), '50000')
  assert.equal(moneyInput.toMoneyInputBuffer('50000,75'), '50000,75')
  assert.equal(moneyInput.formatMoneyDisplayValue('50000'), '50.000,00 TL')
  assert.equal(moneyInput.formatMoneyDisplayValue('50000,75'), '50.000,75 TL')
})

test('incentive money input rejects ambiguous long decimal fractions', () => {
  assert.equal(moneyInput.normalizeMoneyInput('5.000000'), null)
  assert.equal(moneyInput.normalizeMoneyInput('50,0000'), null)
})
