import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' })
}

function normalizePath(path) {
  return path.replaceAll('\\', '/')
}

function trackedControllerFiles() {
  return git(['ls-files', '-z', 'backend/nestjs/src/modules/**/*.controller.ts'])
    .split('\0')
    .filter(Boolean)
    .map(normalizePath)
    .map((path) => ({ path, content: readFileSync(path, 'utf8') }))
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split(/\r\n|\r|\n/).length
}

function stripCommentsPreservingLines(content) {
  let output = ''
  let i = 0
  let quote = null
  let inLineComment = false
  let inBlockComment = false

  while (i < content.length) {
    const char = content[i]
    const next = content[i + 1]

    if (inLineComment) {
      if (char === '\r' || char === '\n') {
        inLineComment = false
        output += char
      } else {
        output += ' '
      }
      i += 1
      continue
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        output += '  '
        i += 2
        inBlockComment = false
        continue
      }

      output += char === '\r' || char === '\n' ? char : ' '
      i += 1
      continue
    }

    if (quote) {
      output += char

      if (char === '\\') {
        if (i + 1 < content.length) {
          output += content[i + 1]
          i += 2
          continue
        }
      } else if (char === quote) {
        quote = null
      }

      i += 1
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      output += char
      i += 1
      continue
    }

    if (char === '/' && next === '/') {
      output += '  '
      i += 2
      inLineComment = true
      continue
    }

    if (char === '/' && next === '*') {
      output += '  '
      i += 2
      inBlockComment = true
      continue
    }

    output += char
    i += 1
  }

  return output
}

function routeDecoratorMatches(content) {
  const routePattern = /@(Get|Post|Put|Patch|Delete|Head|Options|All)\s*\(([\s\S]*?)\)/g
  return [...content.matchAll(routePattern)].map((match) => ({
    index: match.index ?? 0,
    decorator: match[1],
    argumentsText: match[2] ?? '',
  }))
}

function lineStartAt(content, index) {
  return content.lastIndexOf('\n', index - 1) + 1
}

function previousLine(content, lineStart) {
  if (lineStart <= 0) {
    return null
  }

  let lineEnd = lineStart - 1

  if (content[lineEnd - 1] === '\r') {
    lineEnd -= 1
  }

  const start = content.lastIndexOf('\n', lineEnd - 1) + 1

  return {
    start,
    text: content.slice(start, lineEnd),
  }
}

function decoratorStackStartAt(content, index) {
  let stackStart = lineStartAt(content, index)

  while (stackStart > 0) {
    const line = previousLine(content, stackStart)

    if (!line || !line.text.trim().startsWith('@')) {
      break
    }

    stackStart = line.start
  }

  return stackStart
}

function routeBlockFor(content, matches, index) {
  const start = decoratorStackStartAt(content, matches[index].index)
  const end =
    matches[index + 1] === undefined
      ? content.length
      : decoratorStackStartAt(content, matches[index + 1].index)

  return content.slice(start, end)
}

function scopedPathParamNames(block, routeArguments) {
  const paramNames = new Set()
  const pathParamPattern = /:(storeId|regionId)\b/g
  const decoratorParamPattern = /@Param\s*\(\s*['"](storeId|regionId)['"]\s*\)/g

  for (const match of routeArguments.matchAll(pathParamPattern)) {
    paramNames.add(match[1])
  }

  for (const match of block.matchAll(decoratorParamPattern)) {
    paramNames.add(match[1])
  }

  return [...paramNames]
}

function routeBlockUsesStoreOrRegionScope(block) {
  return (
    /@RequireScope\s*\(\s*['"](store|region)['"]\s*\)/.test(block) ||
    /@RequireActionScope\s*\(\s*['"]store['"]\s*\)/.test(block)
  )
}

function classDecoratorBlock(content) {
  const classMatch = /\b(?:export\s+)?class\s+[A-Za-z_$][A-Za-z0-9_$]*/.exec(content)

  if (!classMatch) {
    return ''
  }

  return content.slice(decoratorStackStartAt(content, classMatch.index), classMatch.index)
}

function findRouteParamScopeContractViolations(files) {
  const violations = []

  for (const file of files) {
    const stripped = stripCommentsPreservingLines(file.content)
    const matches = routeDecoratorMatches(stripped)
    const classUsesStoreOrRegionScope = routeBlockUsesStoreOrRegionScope(classDecoratorBlock(stripped))

    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index]
      const block = routeBlockFor(stripped, matches, index)

      if (!classUsesStoreOrRegionScope && !routeBlockUsesStoreOrRegionScope(block)) {
        continue
      }

      const paramNames = scopedPathParamNames(block, match.argumentsText)

      if (paramNames.length === 0) {
        continue
      }

      violations.push(
        `${file.path}:${lineNumberAt(file.content, match.index)} ` +
          `uses ${paramNames.join('/')} path params with ScopeGuard store/region decorators; ` +
          'ScopeGuard reads storeId/regionId from query/body only',
      )
    }
  }

  return violations
}

test('controllers do not assume ScopeGuard reads store or region path params', () => {
  assert.deepEqual(findRouteParamScopeContractViolations(trackedControllerFiles()), [])
})

test('guard rejects fake store read scope on a storeId path param route', () => {
  const violations = findRouteParamScopeContractViolations([
    {
      path: 'backend/nestjs/src/modules/store-ops/web/fake.controller.ts',
      content: `
        export class FakeController {
          @RequireScope("store")
          @Patch("stores/:storeId")
          update(@Param("storeId") storeId: string) {
            return storeId;
          }
        }
      `,
    },
  ])

  assert.match(violations.join('\n'), /fake\.controller\.ts/)
  assert.match(violations.join('\n'), /storeId path params/)
})

test('guard rejects fake region read scope on a regionId path param route', () => {
  const violations = findRouteParamScopeContractViolations([
    {
      path: 'backend/nestjs/src/modules/store-ops/web/fake.controller.ts',
      content: `
        export class FakeController {
          @Get("regions/:regionId")
          @RequireScope("region")
          list(@Param("regionId") regionId: string) {
            return regionId;
          }
        }
      `,
    },
  ])

  assert.match(violations.join('\n'), /regionId path params/)
})

test('guard rejects fake store action scope on a storeId path param route', () => {
  const violations = findRouteParamScopeContractViolations([
    {
      path: 'backend/nestjs/src/modules/store-ops/web/fake.controller.ts',
      content: `
        export class FakeController {
          @Post("stores/:storeId/checklists")
          @RequireActionScope("store")
          complete(@Param("storeId") storeId: string) {
            return storeId;
          }
        }
      `,
    },
  ])

  assert.match(violations.join('\n'), /storeId path params/)
  assert.match(violations.join('\n'), /ScopeGuard reads storeId\/regionId from query\/body only/)
})

test('guard rejects fake class-level store scope on a storeId path param route', () => {
  const violations = findRouteParamScopeContractViolations([
    {
      path: 'backend/nestjs/src/modules/store-ops/web/fake.controller.ts',
      content: `
        @RequireScope("store")
        export class FakeController {
          @Get("stores/:storeId")
          detail(@Param("storeId") storeId: string) {
            return storeId;
          }
        }
      `,
    },
  ])

  assert.match(violations.join('\n'), /storeId path params/)
})

test('guard allows company-scoped path param routes with service-level scope checks', () => {
  const violations = findRouteParamScopeContractViolations([
    {
      path: 'backend/nestjs/src/modules/integration/web/fake.controller.ts',
      content: `
        export class FakeController {
          @Patch("store-master/:storeId")
          @RequireScope("company")
          update(@Param("storeId") storeId: string) {
            return storeId;
          }
        }
      `,
    },
  ])

  assert.deepEqual(violations, [])
})
