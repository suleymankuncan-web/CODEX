import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const registryFile = 'admin-web/src/app/store-route-registry.ts'

export function parseStoreRouteRegistryRoutes(rootDir) {
  const registryPath = path.join(rootDir, fromRepoPath(registryFile))
  const text = readFileSync(registryPath, 'utf8')
  const arrayStart = text.indexOf('export const storeRouteDefinitions')
  const assignmentStart = arrayStart === -1 ? -1 : text.indexOf('=', arrayStart)
  const bracketStart = assignmentStart === -1 ? -1 : text.indexOf('[', assignmentStart)
  const bracketEnd = bracketStart === -1 ? -1 : findBalancedEnd(text, bracketStart, '[', ']')
  if (bracketStart === -1 || bracketEnd === -1) return []

  const routes = []
  for (const definition of extractObjectBlocks(text, bracketStart + 1, bracketEnd)) {
    const routePath = extractQuotedProperty(definition.text, 'routePath')
    const moduleSpecifier = extractModulePreloadSpecifier(definition.text)
    if (!routePath || !moduleSpecifier) continue

    const resolvedModule = resolveModulePath(path.dirname(registryPath), moduleSpecifier)
    const component = resolvedModule ? path.basename(resolvedModule).replace(/\.[jt]sx?$/, '') : null
    const paths = [
      { path: routePath.value, line: lineNumberAt(text, definition.start + routePath.index) },
      ...extractAliasPaths(definition.text).map((alias) => ({
        path: alias.value,
        line: lineNumberAt(text, definition.start + alias.index),
      })),
    ]

    for (const route of paths) {
      routes.push({
        id: `route:store:${route.path}`,
        path: route.path,
        surface: 'store',
        domain: inferRouteDomain(route.path),
        kind: 'page',
        component,
        componentFile: resolvedModule ? toRepoPath(rootDir, resolvedModule) : null,
        guard: 'StoreRouteGuard',
        roles: definition.text.includes('allowVisualMerchandiser: true')
          ? ['STORE_ACCESS', 'VISUAL_MERCHANDISER']
          : ['STORE_ACCESS'],
        source: {
          file: registryFile,
          line: route.line,
        },
      })
    }
  }

  return routes
}

function extractObjectBlocks(text, start, end) {
  const blocks = []
  for (let cursor = start; cursor < end; cursor += 1) {
    if (text[cursor] !== '{') continue
    const close = findBalancedEnd(text, cursor, '{', '}')
    if (close === -1 || close > end) break
    blocks.push({ start: cursor, text: text.slice(cursor, close + 1) })
    cursor = close
  }
  return blocks
}

function extractQuotedProperty(text, property) {
  const match = new RegExp(`\\b${escapeRegExp(property)}\\s*:\\s*(['"])([^'"]+)\\1`).exec(text)
  return match ? { index: match.index, value: match[2] } : null
}

function extractAliasPaths(text) {
  const match = /\baliases\s*:\s*\[([\s\S]*?)\]/.exec(text)
  if (!match) return []
  return [...match[1].matchAll(/(['"])([^'"]+)\1/g)].map((alias) => ({
    index: match.index + alias.index,
    value: alias[2],
  }))
}

function extractModulePreloadSpecifier(text) {
  return /\bmodulePreload\s*:\s*\(\)\s*=>\s*import\((['"])([^'"]+)\1\)/.exec(text)?.[2] ?? null
}

function inferRouteDomain(routePath) {
  const segments = routePath.split('/').filter(Boolean)
  return segments[0] === 'store' ? segments[1] ?? 'store' : segments[0] ?? 'root'
}

function resolveModulePath(fromDir, specifier) {
  const base = path.resolve(fromDir, specifier)
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ]
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null
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
    else if (char === closeChar && --depth === 0) return cursor
  }
  return -1
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length
}

function toRepoPath(rootDir, file) {
  return path.relative(rootDir, file).replaceAll(path.sep, '/')
}

function fromRepoPath(file) {
  return file.split('/').join(path.sep)
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
