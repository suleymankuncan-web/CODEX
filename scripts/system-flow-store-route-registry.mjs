import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const registryFile = 'admin-web/src/app/store-route-registry.ts'
const authorizationFile = 'admin-web/src/features/auth/authorization.ts'

export function parseStoreRouteRegistryRoutes(rootDir) {
  const registryPath = path.join(rootDir, fromRepoPath(registryFile))
  const text = readFileSync(registryPath, 'utf8')
  const authorizationText = readFileSync(
    path.join(rootDir, fromRepoPath(authorizationFile)),
    'utf8',
  )
  const roleConstants = parseStringArrayConstants(`${authorizationText}\n${text}`)
  const arrayStart = text.indexOf('export const storeRouteDefinitions')
  const assignmentStart = arrayStart === -1 ? -1 : text.indexOf('=', arrayStart)
  const bracketStart = assignmentStart === -1 ? -1 : text.indexOf('[', assignmentStart)
  const bracketEnd = bracketStart === -1 ? -1 : findBalancedEnd(text, bracketStart, '[', ']')
  if (bracketStart === -1 || bracketEnd === -1) return []

  const routes = []
  for (const definition of extractObjectBlocks(text, bracketStart + 1, bracketEnd)) {
    const routePath = extractQuotedProperty(definition.text, 'routePath')
    const moduleSpecifier = extractModulePreloadSpecifier(definition.text)
    const operatingPolicy = extractOperatingPolicy(definition.text, roleConstants)
    if (!routePath || !moduleSpecifier || !operatingPolicy) continue

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
      const isStoreLandingAlias = route.path === '/store'
      routes.push({
        id: `route:store:${route.path}`,
        path: route.path,
        surface: 'store',
        domain: inferRouteDomain(route.path),
        kind: 'page',
        component,
        componentFile: resolvedModule ? toRepoPath(rootDir, resolvedModule) : null,
        guard: 'StoreRouteGuard',
        roles: isStoreLandingAlias
          ? [...new Set([...operatingPolicy.catalogRoles, 'VISUAL_MERCHANDISER'])].sort()
          : operatingPolicy.catalogRoles,
        authorization: {
          routeAccess: isStoreLandingAlias ? 'authenticated_landing_alias' : operatingPolicy.routeAccess,
          readScope: operatingPolicy.readScope,
          actionScope: operatingPolicy.actionScope,
        },
        source: {
          file: registryFile,
          line: route.line,
        },
      })
    }
  }

  return routes
}

function parseStringArrayConstants(text) {
  const unresolved = new Map()
  for (const match of text.matchAll(/(?:export\s+)?const\s+(\w+)\s*=\s*\[([\s\S]*?)\]/g)) {
    unresolved.set(match[1], match[2])
  }

  const resolved = new Map()
  let changed = true
  while (changed && unresolved.size > 0) {
    changed = false
    for (const [name, body] of unresolved) {
      const references = [...body.matchAll(/\.\.\.(\w+)/g)].map((match) => match[1])
      if (references.some((reference) => !resolved.has(reference))) continue

      const values = [...body.matchAll(/(['"])([^'"]+)\1/g)].map((match) => match[2])
      for (const reference of references) values.push(...resolved.get(reference))
      resolved.set(name, [...new Set(values)].sort())
      unresolved.delete(name)
      changed = true
    }
  }

  return resolved
}

function extractOperatingPolicy(text, roleConstants) {
  const match = /\boperatingPolicy\s*:\s*\{([\s\S]*?)\n\s*\}/.exec(text)
  if (!match) return null

  const block = match[1]
  const rolesMatch = /\bcatalogRoles\s*:\s*(\w+|\[[\s\S]*?\])/.exec(block)
  if (!rolesMatch) return null

  const catalogRoles = rolesMatch[1].startsWith('[')
    ? [...rolesMatch[1].matchAll(/(['"])([^'"]+)\1/g)].map((role) => role[2]).sort()
    : roleConstants.get(rolesMatch[1])
  const routeAccess = extractQuotedProperty(block, 'routeAccess')?.value
  const readScope = extractQuotedProperty(block, 'readScope')?.value
  const actionScope = extractQuotedProperty(block, 'actionScope')?.value
  if (!catalogRoles || !routeAccess || !readScope || !actionScope) return null

  return { catalogRoles, routeAccess, readScope, actionScope }
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
