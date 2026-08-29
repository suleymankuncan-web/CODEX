import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')
const sourceRoot = join(workspaceRoot, 'admin-web', 'src')
const sourceExtensions = new Set(['.ts', '.tsx'])
const exactAllowedSensitiveWrites = new Map([
  [
    'admin-web/src/features/auth/auth-flow.ts',
    new Set(["sessionStorage.setItem(PKCE_STORAGE_KEY, JSON.stringify(storageValue))"]),
  ],
  [
    'admin-web/src/features/session/session-storage.ts',
    new Set([
      'sessionStorage.setItem(BEARER_TOKEN_STORAGE_KEY, normalized)',
      'sessionStorage.setItem(PROVIDER_ID_TOKEN_STORAGE_KEY, normalizedProviderIdToken)',
    ]),
  ],
])

const storageSetItemPattern = /\b(?:localStorage|sessionStorage)\.setItem\(/g
const sensitiveWritePattern =
  /token|Token|jwt|Jwt|JWT|authorization|Authorization|cookie|Cookie|provider|Provider|BEARER_TOKEN_STORAGE_KEY|PROVIDER_ID_TOKEN_STORAGE_KEY|PKCE_STORAGE_KEY|codeVerifier/

function listSourceFiles(directory) {
  const files = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...listSourceFiles(absolutePath))
      continue
    }

    if (
      sourceExtensions.has(entry.name.slice(entry.name.lastIndexOf('.'))) &&
      !entry.name.includes('.test.') &&
      !entry.name.includes('.spec.')
    ) {
      files.push(absolutePath)
    }
  }

  return files
}

function normalizePath(absolutePath) {
  return relative(workspaceRoot, absolutePath).replaceAll('\\', '/')
}

function findSensitiveStorageWrites(entries) {
  const violations = []

  for (const [path, text] of entries) {
    for (const call of extractStorageSetItemCalls(text)) {
      if (!sensitiveWritePattern.test(call)) {
        continue
      }

      const snippet = call.replace(/\s+/g, ' ').trim()
      const allowedSnippets = exactAllowedSensitiveWrites.get(path)

      if (!allowedSnippets?.has(snippet)) {
        violations.push(`${path}: ${snippet}`)
      }
    }
  }

  return violations
}

function extractStorageSetItemCalls(text) {
  const calls = []

  for (const match of text.matchAll(storageSetItemPattern)) {
    let depth = 1
    let quote = ''
    let escaped = false
    const start = match.index ?? 0

    for (let index = start + match[0].length; index < text.length; index += 1) {
      const character = text[index]

      if (quote) {
        if (escaped) {
          escaped = false
          continue
        }

        if (character === '\\') {
          escaped = true
          continue
        }

        if (character === quote) {
          quote = ''
        }
        continue
      }

      if (character === "'" || character === '"' || character === '`') {
        quote = character
        continue
      }

      if (character === '(') {
        depth += 1
        continue
      }

      if (character !== ')') {
        continue
      }

      depth -= 1
      if (depth === 0) {
        calls.push(text.slice(start, index + 1))
        break
      }
    }
  }

  return calls
}

test('launch frontend source keeps browser-readable token storage writes allowlisted', () => {
  const sourceEntries = listSourceFiles(sourceRoot).map((file) => [
    normalizePath(file),
    readFileSync(file, 'utf8'),
  ])

  assert.deepEqual(findSensitiveStorageWrites(sourceEntries), [])
})

test('launch frontend token storage guard rejects provider-path token persistence', () => {
  const violations = findSensitiveStorageWrites([
    [
      'admin-web/src/pages/AuthCallbackPage.tsx',
      `window.sessionStorage.setItem(
        'store-ops-admin-provider-id-token',
        result.idToken,
      )`,
    ],
    [
      'admin-web/src/features/auth/clerk-session.tsx',
      `window.localStorage.setItem(
        'providerAccessToken',
        token,
      )`,
    ],
  ])

  assert.equal(violations.length, 2)
})

test('launch frontend token storage guard documents the narrow remaining storage exceptions', () => {
  assert.deepEqual(
    [...exactAllowedSensitiveWrites.keys()],
    [
      'admin-web/src/features/auth/auth-flow.ts',
      'admin-web/src/features/session/session-storage.ts',
    ],
  )
})
