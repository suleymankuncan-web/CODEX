import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const appRoot = dirname(scriptsDir)

const retryFalseAllowlist = new Set([
  'src/App.tsx',
  'src/pages/AuthCallbackPage.tsx',
  'src/pages/AuthLoginPage.tsx',
  'src/pages/AuthLogoutPage.tsx',
  'src/pages/SessionReadinessPage.tsx',
])

function walkSourceFiles(dir) {
  const entries = readdirSync(dir)
  const files = []

  for (const entry of entries) {
    const path = join(dir, entry)
    const stats = statSync(path)

    if (stats.isDirectory()) {
      files.push(...walkSourceFiles(path))
      continue
    }

    if (path.endsWith('.ts') || path.endsWith('.tsx')) {
      files.push(path)
    }
  }

  return files
}

test('data surface queries do not disable transient retry handling', () => {
  const findings = []

  for (const file of walkSourceFiles(join(appRoot, 'src'))) {
    const relativePath = relative(appRoot, file).replaceAll('\\', '/')

    if (retryFalseAllowlist.has(relativePath)) {
      continue
    }

    const source = readFileSync(file, 'utf8')
    const lines = source.split(/\r?\n/)

    lines.forEach((line, index) => {
      if (/\bretry\s*:\s*false\b/.test(line)) {
        findings.push(`${relativePath}:${index + 1}`)
      }
    })
  }

  assert.deepEqual(findings, [])
})

test('query client applies transient retry handling to every data surface by default', () => {
  const source = readFileSync(join(appRoot, 'src/main.tsx'), 'utf8')

  assert.match(
    source,
    /from '\.\/lib\/query-retry'/,
    'main.tsx should import the shared transient query retry helpers',
  )
  assert.match(
    source,
    /\bretry\s*:\s*shouldRetryTransientQuery\b/,
    'main.tsx should use the shared transient retry predicate as the query default',
  )
  assert.match(
    source,
    /\bretryDelay\s*:\s*transientQueryRetryDelay\b/,
    'main.tsx should use the shared transient retry delay as the query default',
  )
})
