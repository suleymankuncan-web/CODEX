import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const indexCss = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')

test('frontend CSS stays compatible with the production font CSP', () => {
  assert.doesNotMatch(indexCss, /fonts\.googleapis\.com|fonts\.gstatic\.com/u)
  assert.doesNotMatch(indexCss, /@import\s+url\(['"]https?:\/\//u)
})
