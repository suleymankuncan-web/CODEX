import path from 'node:path'

export function buildApiFunctionDependencyIndex(input) {
  const dependencies = new Map()

  for (const [functionKey, definition] of input.exportedFunctionIndex.entries()) {
    const calledFunctions = new Set()

    for (const statement of input.parseNamedImportStatements(definition.text)) {
      if (statement.isTypeOnly || !statement.specifier.startsWith('.')) continue

      const importedModule = input.resolveModulePath(path.dirname(definition.file), statement.specifier)
      if (!importedModule) continue
      const importedModuleRepoPath = input.toRepoPath(input.rootDir, importedModule)

      for (const importedName of input.parseNamedImports(statement.imports)) {
        if (!isImportedFunctionUsed(definition.body, importedName.local)) continue

        const importedFunctionKey = `${importedModuleRepoPath}#${importedName.imported}`
        if (input.exportedFunctionIndex.has(importedFunctionKey)) {
          calledFunctions.add(importedFunctionKey)
        }
      }
    }

    dependencies.set(functionKey, [...calledFunctions].sort())
  }

  return dependencies
}

export function parseFrontendApiCallTargets(text) {
  const calls = []
  const unresolved = []
  const functionRegex = /\b(fetchOpenApiJson|sendOpenApiJson|fetchJson|sendJson|sendFormData)\b/g

  for (const match of text.matchAll(functionRegex)) {
    const functionName = match[1]
    const index = match.index ?? 0
    let cursor = index + functionName.length
    cursor = skipWhitespace(text, cursor)
    cursor = skipTypeArguments(text, cursor)
    cursor = skipWhitespace(text, cursor)
    if (text[cursor] !== '(') continue

    const callText = readBalancedCall(text, cursor)
    const method = resolveApiCallMethod(functionName, callText)
    if (!method) continue

    const argumentCursor = skipWhitespace(text, cursor + 1)
    const quoted = readQuoted(text, argumentCursor)
    if (!quoted) {
      unresolved.push({
        client: resolveClientType(functionName),
        functionName,
        index,
        method,
      })
      continue
    }

    calls.push({
      client: resolveClientType(functionName),
      functionName,
      index,
      method,
      rawPath: quoted.value,
    })
  }

  return { calls, unresolved }
}

export function classifyFrontendApiCallTargets(text) {
  const result = parseFrontendApiCallTargets(text)
  return {
    literalCalls: result.calls.map((call) => ({
      functionName: call.functionName,
      method: call.method,
      path: normalizeClientApiPath(call.rawPath),
    })),
    unresolvedCalls: result.unresolved.map((call) => ({
      functionName: call.functionName,
      method: call.method,
      reason: 'non_literal_path',
    })),
  }
}

export function isImportedFunctionUsed(text, localName) {
  const escapedName = escapeRegExp(localName)
  const usedAsCall = new RegExp(`\\b${escapedName}\\s*\\(`).test(text)
  const usedAsQueryFn = new RegExp(`\\b(?:queryFn|mutationFn)\\s*:\\s*${escapedName}\\b`).test(text)
  return usedAsCall || usedAsQueryFn
}

export function findImportedApiFunctionCallIds(input) {
  const ids = new Set()

  for (const statement of input.parseNamedImportStatements(input.text)) {
    if (statement.isTypeOnly || !statement.specifier.startsWith('.')) continue

    const importedModule = input.resolveModulePath(path.dirname(input.file), statement.specifier)
    if (!importedModule) continue
    const importedModuleRepoPath = input.toRepoPath(input.rootDir, importedModule)

    for (const importedName of input.parseNamedImports(statement.imports)) {
      const key = `${importedModuleRepoPath}#${importedName.imported}`
      const functionCallIds = resolveTransitiveApiCallIds(
        key,
        input.apiFunctionIndex,
        input.apiFunctionDependencyIndex,
      )
      if (!functionCallIds.length || !isImportedFunctionUsed(input.text, importedName.local)) continue

      for (const callId of functionCallIds) ids.add(callId)
    }
  }

  return ids
}

export function resolveTransitiveApiCallIds(
  functionKey,
  apiFunctionIndex,
  apiFunctionDependencyIndex,
) {
  const resolved = new Set()
  const visited = new Set()
  const active = new Set()

  function visit(currentKey) {
    if (visited.has(currentKey) || active.has(currentKey)) return
    active.add(currentKey)

    for (const callId of apiFunctionIndex.get(currentKey) ?? []) {
      resolved.add(callId)
    }
    for (const dependencyKey of apiFunctionDependencyIndex.get(currentKey) ?? []) {
      visit(dependencyKey)
    }

    active.delete(currentKey)
    visited.add(currentKey)
  }

  visit(functionKey)
  return [...resolved].sort()
}

function resolveApiCallMethod(functionName, callText) {
  if (functionName === 'fetchJson' || functionName === 'fetchOpenApiJson') {
    return 'GET'
  }

  const methodMatch = callText.match(/\bmethod\s*:\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`]/i)
  return methodMatch ? methodMatch[1].toUpperCase() : null
}

function resolveClientType(functionName) {
  if (functionName.includes('OpenApi')) return 'openapi-generated'
  if (functionName === 'sendFormData') return 'form-data'
  return 'legacy-json'
}

function normalizeClientApiPath(rawPath) {
  const trimmed = rawPath.trim().replace(/\$\{[^}]+}/g, '{dynamic}')
  const withoutQuery = trimmed.split('?')[0]
  const withLeadingSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`
  return withLeadingSlash.startsWith('/api/') ? withLeadingSlash : `/api${withLeadingSlash}`
}

function skipWhitespace(text, index) {
  let cursor = index
  while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1
  return cursor
}

function skipTypeArguments(text, index) {
  if (text[index] !== '<') return index
  let depth = 0

  for (let cursor = index; cursor < text.length; cursor += 1) {
    const char = text[cursor]
    if (char === '<') depth += 1
    if (char === '>') {
      depth -= 1
      if (depth === 0) return cursor + 1
    }
  }

  return index
}

function readQuoted(text, index) {
  const quote = text[index]
  if (quote !== "'" && quote !== '"' && quote !== '`') return null
  let value = ''

  for (let cursor = index + 1; cursor < text.length; cursor += 1) {
    const char = text[cursor]
    if (char === '\\') {
      value += char + (text[cursor + 1] ?? '')
      cursor += 1
      continue
    }
    if (char === quote) return { value }
    value += char
  }

  return null
}

function readBalancedCall(text, openIndex) {
  const end = findBalancedEnd(text, openIndex, '(', ')')
  return end === -1 ? text.slice(openIndex, openIndex + 800) : text.slice(openIndex, end + 1)
}

function findBalancedEnd(text, openIndex, openChar, closeChar) {
  let depth = 0
  let quote = null

  for (let cursor = openIndex; cursor < text.length; cursor += 1) {
    const char = text[cursor]
    if (quote) {
      if (char === '\\') cursor += 1
      else if (char === quote) quote = null
      continue
    }

    if (char === '"' || char === "'" || char === '`') quote = char
    else if (char === openChar) depth += 1
    else if (char === closeChar) {
      depth -= 1
      if (depth === 0) return cursor
    }
  }

  return -1
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
