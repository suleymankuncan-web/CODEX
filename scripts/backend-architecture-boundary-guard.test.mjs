import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' })
}

function trackedFiles(prefix = 'backend/nestjs/src/modules') {
  const prefixes = Array.isArray(prefix) ? prefix : [prefix]
  return git(['ls-files', '-z', ...prefixes]).split('\0').filter(Boolean)
}

function normalizePath(path) {
  return path.replaceAll('\\', '/')
}

function readBackendSourceFiles() {
  return trackedFiles()
    .map(normalizePath)
    .filter((path) => path.endsWith('.ts'))
    .filter((path) => !path.includes('.spec.'))
    .filter((path) => !path.includes('.test.'))
    .map((path) => ({ path, content: readFileSync(path, 'utf8') }))
}

function readTrackedSourceFiles(prefixes, extensions, options = {}) {
  const includeTests = options.includeTests ?? true

  return trackedFiles(prefixes)
    .map(normalizePath)
    .filter((path) => extensions.some((extension) => path.endsWith(extension)))
    .filter((path) => includeTests || (!path.includes('.spec.') && !path.includes('.test.')))
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

function importsIn(content) {
  const imports = []
  const importSource = stripCommentsPreservingLines(content)
  const importPattern = /(^|[\r\n])(\s*import\s+(?!['"])(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"])/g
  const sideEffectImportPattern = /(^|[\r\n])(\s*import\s+['"]([^'"]+)['"];?)/g
  const exportPattern = /(^|[\r\n])(\s*export\s+(?:type\s+)?(?:\*|{[\s\S]*?})\s+from\s+['"]([^'"]+)['"])/g

  for (const match of importSource.matchAll(importPattern)) {
    imports.push({
      statement: match[2],
      source: match[3],
      index: (match.index ?? 0) + match[1].length,
    })
  }

  for (const match of importSource.matchAll(sideEffectImportPattern)) {
    imports.push({
      statement: match[2],
      source: match[3],
      index: (match.index ?? 0) + match[1].length,
    })
  }

  for (const match of importSource.matchAll(exportPattern)) {
    imports.push({
      statement: match[2],
      source: match[3],
      index: (match.index ?? 0) + match[1].length,
    })
  }

  return imports
}

function isApplicationFile(path) {
  return path.startsWith('backend/nestjs/src/modules/') && path.includes('/application/')
}

function isStoreOpsApplicationFile(path) {
  return path.startsWith('backend/nestjs/src/modules/store-ops/application/')
}

function isWebOrControllerFile(path) {
  return path.includes('/web/') || path.endsWith('.controller.ts')
}

const directDatabaseServiceAllowlist = new Map()

const storeOpsRepositoryCastAllowlist = new Map()

const largeTrackedSourceLineLimit = 1200
const largeTrackedSourceAllowlist = new Map([
  [
    'backend/nestjs/src/openapi/generate-openapi.ts',
    'Existing generated OpenAPI writer entrypoint; parked until a concrete generation bug or reviewability blocker appears.',
  ],
  [
    'admin-web/e2e/store-surfaces.spec.ts',
    'Existing broad Store surface regression spec; parked until a concrete flake, runtime issue, or reviewability blocker appears.',
  ],
  [
    'admin-web/src/generated/openapi-types.ts',
    'Generated OpenAPI client types; size is controlled by backend API contract breadth.',
  ],
  [
    'admin-web/src/pages/MasterDataBootstrapPage.tsx',
    'Existing master data admin page hotspot; parked by refactor inventory until concrete product or reviewability trigger.',
  ],
  [
    'admin-web/e2e/competition-surfaces.spec.ts',
    'Existing competition regression spec; parked until concrete flake, runtime issue, or reviewability blocker.',
  ],
  [
    'admin-web/e2e/pilot-smoke.spec.ts',
    'Existing pilot smoke regression spec; parked until concrete flake, runtime issue, or reviewability blocker.',
  ],
  [
    'backend/nestjs/src/modules/store-ops/application/reporting.service.ts',
    'Existing Store Ops reporting application hotspot; V2 splits surrounding module graph before further behavior-preserving extraction.',
  ],
  [
    'admin-web/src/pages/IntegrationDashboardPage.tsx',
    'Existing integration dashboard hotspot; parked until concrete product or reviewability trigger.',
  ],
  [
    'backend/nestjs/test/integration/import-batch-evidence.e2e-spec.ts',
    'Existing import-batch evidence E2E spec; parked until concrete flake, runtime issue, or reviewability blocker.',
  ],
  [
    'admin-web/src/pages/AdminKpiConfigPage.tsx',
    'Existing KPI config admin page hotspot; parked until concrete product or reviewability trigger.',
  ],
  [
    'admin-web/src/pages/ImportBatchDetailPage.tsx',
    'Existing import batch detail page hotspot; parked until concrete product or reviewability trigger.',
  ],
  [
    'backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts',
    'Existing competition write repository hotspot; V2 extracts transition policy before new competition growth.',
  ],
  [
    'backend/nestjs/src/shared/openapi-baseline.contract.spec.ts',
    'Existing OpenAPI baseline contract spec; size follows API contract breadth.',
  ],
])

const storeOpsModuleGraphLimits = new Map([
  ['backend/nestjs/src/modules/store-ops/store-ops.module.ts', { controllers: 0, providers: 0, exports: 4 }],
  [
    'backend/nestjs/src/modules/store-ops/store-ops-checklist.module.ts',
    { controllers: 3, providers: 4, exports: 1 },
  ],
  [
    'backend/nestjs/src/modules/store-ops/store-ops-competition.module.ts',
    { controllers: 1, providers: 6, exports: 1 },
  ],
  [
    'backend/nestjs/src/modules/store-ops/store-ops-reporting.module.ts',
    { controllers: 0, providers: 0, exports: 5 },
  ],
  [
    'backend/nestjs/src/modules/store-ops/store-ops-org.module.ts',
    { controllers: 1, providers: 2, exports: 1 },
  ],
  [
    'backend/nestjs/src/modules/store-ops/store-ops-workforce.module.ts',
    { controllers: 1, providers: 3, exports: 1 },
  ],
  [
    'backend/nestjs/src/modules/store-ops/store-ops-snapshot.module.ts',
    { controllers: 1, providers: 4, exports: 2 },
  ],
  [
    'backend/nestjs/src/modules/store-ops/store-ops-ranking.module.ts',
    { controllers: 0, providers: 8, exports: 3 },
  ],
  [
    'backend/nestjs/src/modules/store-ops/store-ops-reporting-read.module.ts',
    { controllers: 1, providers: 8, exports: 1 },
  ],
  [
    'backend/nestjs/src/modules/store-ops/store-ops-targets.module.ts',
    { controllers: 5, providers: 12, exports: 5 },
  ],
])

const workerJobsModuleGraphLimits = new Map([
  [
    'backend/nestjs/src/worker-jobs.module.ts',
    { imports: 2, providers: 0, exports: 2 },
  ],
  [
    'backend/nestjs/src/worker-materialization-jobs.module.ts',
    { providers: 19, exports: 1 },
  ],
  [
    'backend/nestjs/src/worker-snapshot-jobs.module.ts',
    { providers: 4, exports: 1 },
  ],
])

function hasDirectDatabaseServiceImport(importEntry) {
  return /(?:^|\/)shared\/database\/database\.service$|database\.service$/.test(importEntry.source)
}

function isWebLayerImport(importEntry) {
  return (
    /(?:^|\/)\.{0,2}\/?web(?:\/|$)/.test(importEntry.source) ||
    importEntry.source.includes('/web/') ||
    /\.controller$/.test(importEntry.source) ||
    /\.controller\./.test(importEntry.source)
  )
}

function isInfrastructureImport(importEntry) {
  return importEntry.source.includes('/infrastructure/') || /(?:^|\/)\.\.\/infrastructure\//.test(importEntry.source)
}

function describeViolation(file, index, message) {
  return `${file.path}:${lineNumberAt(file.content, index)} ${message}`
}

function normalizedStatement(statement) {
  return statement.trim().replace(/;$/, '').replace(/\s+/g, ' ')
}

function castLineSignature(content, index) {
  const lineStart = Math.max(content.lastIndexOf('\n', index - 1) + 1, 0)
  const lineEndIndex = content.indexOf('\n', index)
  const lineEnd = lineEndIndex === -1 ? content.length : lineEndIndex

  return content
    .slice(lineStart, lineEnd)
    .trim()
    .replace(/,$/, '')
    .replace(/\s+/g, ' ')
}

function countByValue(values) {
  const counts = new Map()

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return counts
}

function lineCount(content) {
  const lines = content.split(/\r\n|\r|\n/)

  if (lines.at(-1) === '') {
    lines.pop()
  }

  return lines.length
}

function extractBalancedLiteralAt(content, startIndex, openChar, closeChar) {
  const stripped = stripCommentsPreservingLines(content)
  let depth = 0
  let quote = null
  let i = startIndex

  while (i < stripped.length) {
    const char = stripped[i]

    if (quote) {
      if (char === '\\') {
        i += 2
        continue
      }

      if (char === quote) {
        quote = null
      }

      i += 1
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      i += 1
      continue
    }

    if (char === openChar) {
      depth += 1
    }

    if (char === closeChar) {
      depth -= 1

      if (depth === 0) {
        return stripped.slice(startIndex + 1, i)
      }
    }

    i += 1
  }

  return null
}

function extractArrayLiteralAt(content, bracketIndex) {
  return extractBalancedLiteralAt(content, bracketIndex, '[', ']')
}

function extractModuleMetadataObject(content) {
  const moduleDecoratorIndex = content.indexOf('@Module')

  if (moduleDecoratorIndex === -1) {
    return null
  }

  const moduleCallIndex = content.indexOf('(', moduleDecoratorIndex)

  if (moduleCallIndex === -1) {
    return null
  }

  const objectStartIndex = content.indexOf('{', moduleCallIndex)

  if (objectStartIndex === -1) {
    return null
  }

  return extractBalancedLiteralAt(content, objectStartIndex, '{', '}')
}

function topLevelArrayElements(arrayContent) {
  if (arrayContent === null) {
    return null
  }

  const stripped = stripCommentsPreservingLines(arrayContent)
  const elements = []
  let current = ''
  let quote = null
  let bracketDepth = 0
  let braceDepth = 0
  let parenDepth = 0

  for (let i = 0; i < stripped.length; i += 1) {
    const char = stripped[i]

    if (quote) {
      current += char

      if (char === '\\') {
        if (i + 1 < stripped.length) {
          current += stripped[i + 1]
          i += 1
        }
        continue
      }

      if (char === quote) {
        quote = null
      }

      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      current += char
      continue
    }

    if (char === '[') {
      bracketDepth += 1
      current += char
      continue
    }

    if (char === ']') {
      bracketDepth -= 1
      current += char
      continue
    }

    if (char === '{') {
      braceDepth += 1
      current += char
      continue
    }

    if (char === '}') {
      braceDepth -= 1
      current += char
      continue
    }

    if (char === '(') {
      parenDepth += 1
      current += char
      continue
    }

    if (char === ')') {
      parenDepth -= 1
      current += char
      continue
    }

    if (char === ',' && bracketDepth === 0 && braceDepth === 0 && parenDepth === 0) {
      elements.push(current)
      current = ''
      continue
    }

    current += char
  }

  elements.push(current)

  return elements.map((part) => part.trim()).filter(Boolean)
}

function arrayElementsAfterPattern(content, pattern) {
  const match = pattern.exec(content)

  if (!match) {
    return null
  }

  const bracketIndex = content.indexOf('[', match.index)

  if (bracketIndex === -1) {
    return null
  }

  return topLevelArrayElements(extractArrayLiteralAt(content, bracketIndex))
}

function moduleMetadataPropertyValue(moduleMetadata, propertyName) {
  const entries = topLevelArrayElements(moduleMetadata)
  const propertyPattern = new RegExp(`^${propertyName}\\s*:`)
  const propertyEntry = entries.find((entry) => propertyPattern.test(entry))

  if (!propertyEntry) {
    return null
  }

  return propertyEntry.replace(propertyPattern, '').trim()
}

function moduleArrayElements(content, propertyName) {
  const moduleMetadata = extractModuleMetadataObject(content)

  if (moduleMetadata === null) {
    return null
  }

  const propertyValue = moduleMetadataPropertyValue(moduleMetadata, propertyName)

  if (propertyValue === null) {
    return null
  }

  if (propertyValue.startsWith('[')) {
    if (!propertyValue.endsWith(']')) {
      return null
    }

    return topLevelArrayElements(extractArrayLiteralAt(propertyValue, 0))
  }

  const referenceMatch = /^([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(propertyValue)

  if (!referenceMatch) {
    return null
  }

  const referencedName = referenceMatch[1]
  return arrayElementsAfterPattern(content, new RegExp(`const\\s+${referencedName}\\s*=\\s*\\[`))
}

function countModuleArrayProperty(content, propertyName) {
  const elements = moduleArrayElements(content, propertyName)
  return elements === null ? null : elements.length
}

function findDirectDatabaseServiceViolations(files) {
  const violations = []

  for (const file of files) {
    if (!isApplicationFile(file.path)) {
      continue
    }

    const allowedCounts = countByValue(directDatabaseServiceAllowlist.get(file.path) ?? [])
    const observedAllowedCounts = new Map()

    for (const importEntry of importsIn(file.content)) {
      if (!hasDirectDatabaseServiceImport(importEntry)) {
        continue
      }

      const signature = normalizedStatement(importEntry.statement)
      const allowedCount = allowedCounts.get(signature) ?? 0
      const observedCount = observedAllowedCounts.get(signature) ?? 0

      if (observedCount < allowedCount) {
        observedAllowedCounts.set(signature, observedCount + 1)
        continue
      }

      violations.push(
        describeViolation(file, importEntry.index, `uses unallowlisted direct DatabaseService import: ${signature}`),
      )
    }

    for (const [expectedSignature, expectedCount] of allowedCounts) {
      const observedCount = observedAllowedCounts.get(expectedSignature) ?? 0

      if (observedCount !== expectedCount) {
        violations.push(
          `${file.path}:1 expected ${expectedCount} allowlisted direct DatabaseService import occurrence(s), ` +
            `observed ${observedCount}: ${expectedSignature}`,
        )
      }
    }
  }

  return violations
}

function findStoreOpsRepositoryCastViolations(files) {
  const violations = []

  for (const file of files) {
    if (!isStoreOpsApplicationFile(file.path)) {
      continue
    }

    const allowedCounts = countByValue(storeOpsRepositoryCastAllowlist.get(file.path) ?? [])
    const observedAllowedCounts = new Map()
    const castPattern = /\bas\s+unknown\s+as\b/g

    for (const match of file.content.matchAll(castPattern)) {
      const index = match.index ?? 0
      const signature = castLineSignature(file.content, index)
      const allowedCount = allowedCounts.get(signature) ?? 0
      const observedCount = observedAllowedCounts.get(signature) ?? 0

      if (observedCount < allowedCount) {
        observedAllowedCounts.set(signature, observedCount + 1)
        continue
      }

      violations.push(
        describeViolation(file, index, `uses unallowlisted broad repository cast: ${signature}`),
      )
    }

    for (const [expectedSignature, expectedCount] of allowedCounts) {
      const observedCount = observedAllowedCounts.get(expectedSignature) ?? 0

      if (observedCount !== expectedCount) {
        violations.push(
          `${file.path}:1 expected ${expectedCount} allowlisted broad repository cast occurrence(s), ` +
            `observed ${observedCount}: ${expectedSignature}`,
        )
      }
    }
  }

  return violations
}

function findApplicationWebImportViolations(files) {
  const violations = []

  for (const file of files) {
    if (!isApplicationFile(file.path)) {
      continue
    }

    for (const importEntry of importsIn(file.content)) {
      if (isWebLayerImport(importEntry)) {
        violations.push(
          describeViolation(file, importEntry.index, `imports web/controller layer from application code: ${importEntry.source}`),
        )
      }
    }
  }

  return violations
}

function findWebInfrastructureImportViolations(files) {
  const violations = []

  for (const file of files) {
    if (!isWebOrControllerFile(file.path)) {
      continue
    }

    for (const importEntry of importsIn(file.content)) {
      if (isInfrastructureImport(importEntry)) {
        violations.push(
          describeViolation(file, importEntry.index, `imports infrastructure directly from web/controller code: ${importEntry.source}`),
        )
      }
    }
  }

  return violations
}

function findLargeTrackedSourceViolations(files) {
  const violations = []
  const fileByPath = new Map(files.map((file) => [file.path, file]))

  for (const file of files) {
    const lines = lineCount(file.content)

    if (lines < largeTrackedSourceLineLimit) {
      continue
    }

    const reason = largeTrackedSourceAllowlist.get(file.path)

    if (!reason || reason.trim().length === 0) {
      violations.push(
        `${file.path}:1 has ${lines} lines and must not exceed ${largeTrackedSourceLineLimit - 1} lines without a reasoned allowlist entry`,
      )
    }
  }

  for (const [path, reason] of largeTrackedSourceAllowlist) {
    const file = fileByPath.get(path)

    if (!file) {
      violations.push(`${path}:1 large-source allowlist entry points to a missing tracked file`)
      continue
    }

    if (!reason || reason.trim().length < 20) {
      violations.push(`${path}:1 large-source allowlist entry must include a concrete reason`)
    }

    const lines = lineCount(file.content)

    if (lines < largeTrackedSourceLineLimit) {
      violations.push(`${path}:1 has ${lines} lines and no longer needs the large-source allowlist`)
    }
  }

  return violations
}

function findModuleGraphLimitViolations(files, limitsByPath) {
  const violations = []
  const fileByPath = new Map(files.map((file) => [file.path, file]))

  for (const file of files) {
    const limits = limitsByPath.get(file.path)

    if (!limits) {
      violations.push(`${file.path}:1 module graph file is not covered by module graph limits`)
      continue
    }

    for (const [propertyName, maxCount] of Object.entries(limits)) {
      const observedElements = moduleArrayElements(file.content, propertyName)
      const observedCount = observedElements === null ? null : observedElements.length

      if (observedCount === null) {
        if (maxCount === 0) {
          continue
        }

        violations.push(`${file.path}:1 could not read @Module ${propertyName} graph`)
        continue
      }

      const spreadEntry = observedElements.find((element) => element.startsWith('...'))

      if (spreadEntry) {
        violations.push(
          `${file.path}:1 @Module ${propertyName} graph uses spread entry ${spreadEntry}; inline explicit entries before counting graph size`,
        )
      }

      if (observedCount > maxCount) {
        violations.push(
          `${file.path}:1 @Module ${propertyName} graph has ${observedCount} entries; split ownership instead of exceeding ${maxCount}`,
        )
      }
    }
  }

  for (const path of limitsByPath.keys()) {
    if (!fileByPath.has(path)) {
      violations.push(`${path}:1 module graph limit points to a missing tracked file`)
    }
  }

  return violations
}

function findStoreOpsModuleGraphViolations(files) {
  const governedModuleFiles = files.filter((file) => /\/store-ops(?:-[^/]+)?\.module\.ts$/.test(file.path))
  return findModuleGraphLimitViolations(governedModuleFiles, storeOpsModuleGraphLimits)
}

function findWorkerJobsModuleGraphViolations(files) {
  const workerModuleFiles = files.filter((file) => workerJobsModuleGraphLimits.has(file.path))

  return findModuleGraphLimitViolations(workerModuleFiles, workerJobsModuleGraphLimits)
}

const trackedBackendFiles = readBackendSourceFiles()
const trackedBackendPaths = new Set(trackedBackendFiles.map((file) => file.path))
const trackedArchitectureSourceFiles = readTrackedSourceFiles(
  ['backend/nestjs/src', 'backend/nestjs/test', 'admin-web/src', 'admin-web/e2e'],
  ['.ts', '.tsx'],
)
const trackedStoreOpsModuleFiles = readTrackedSourceFiles(['backend/nestjs/src/modules/store-ops'], ['.ts'], {
  includeTests: false,
})
const trackedWorkerModuleFiles = readTrackedSourceFiles(['backend/nestjs/src'], ['.ts'], { includeTests: false })

test('backend architecture direct DatabaseService allowlist points to tracked files', () => {
  for (const path of directDatabaseServiceAllowlist.keys()) {
    assert.equal(trackedBackendPaths.has(path), true, `${path} must remain tracked or be removed from the allowlist`)
  }
})

test('backend architecture repository cast allowlist points to tracked files', () => {
  for (const path of storeOpsRepositoryCastAllowlist.keys()) {
    assert.equal(trackedBackendPaths.has(path), true, `${path} must remain tracked or be removed from the allowlist`)
  }
})

test('application code adds no new direct DatabaseService imports outside the allowlist', () => {
  assert.deepEqual(findDirectDatabaseServiceViolations(trackedBackendFiles), [])
})

test('Store Ops application code adds no new broad repository casts outside the allowlist', () => {
  assert.deepEqual(findStoreOpsRepositoryCastViolations(trackedBackendFiles), [])
})

test('application code does not import web/controller DTOs or controller layer code', () => {
  assert.deepEqual(findApplicationWebImportViolations(trackedBackendFiles), [])
})

test('web/controller code does not import infrastructure repositories directly', () => {
  assert.deepEqual(findWebInfrastructureImportViolations(trackedBackendFiles), [])
})

test('tracked TS and TSX files add no new unallowlisted oversized source files', () => {
  assert.deepEqual(findLargeTrackedSourceViolations(trackedArchitectureSourceFiles), [])
})

test('Store Ops internal modules do not silently grow provider or export graphs', () => {
  assert.deepEqual(findStoreOpsModuleGraphViolations(trackedStoreOpsModuleFiles), [])
})

test('worker job module does not silently grow its job dependency graph', () => {
  assert.deepEqual(findWorkerJobsModuleGraphViolations(trackedWorkerModuleFiles), [])
})

test('guard rejects a fake new application DatabaseService import', () => {
  const violations = findDirectDatabaseServiceViolations([
    {
      path: 'backend/nestjs/src/modules/store-ops/application/new-report.service.ts',
      content: `
        import { DatabaseService } from "../../../shared/database/database.service";

        export class NewReportService {
          constructor(private readonly databaseService: DatabaseService) {}
        }
      `,
    },
  ])

  assert.match(violations.join('\n'), /new-report\.service\.ts/)
  assert.match(violations.join('\n'), /DatabaseService/)
})

test('guard rejects duplicate direct DatabaseService imports outside the allowlist', () => {
  const violations = findDirectDatabaseServiceViolations([
    {
      path: 'backend/nestjs/src/modules/store-ops/application/new-report.service.ts',
      content: `
        import { DatabaseService } from "../../../shared/database/database.service";
        import { DatabaseService } from "../../../shared/database/database.service";
      `,
    },
  ])

  assert.match(violations.join('\n'), /unallowlisted direct DatabaseService import/)
})

test('guard ignores commented direct DatabaseService imports', () => {
  const violations = findDirectDatabaseServiceViolations([
    {
      path: 'backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.ts',
      content: `
        // import { DatabaseService } from "../../../shared/database/database.service";
        /*
          import { DatabaseService } from "../../../shared/database/database.service";
        */
        const text = "import { DatabaseService } from '../../../shared/database/database.service'";
      `,
    },
  ])

  assert.deepEqual(violations, [])
})

test('guard rejects namespace imports from the direct DatabaseService source', () => {
  const violations = findDirectDatabaseServiceViolations([
    {
      path: 'backend/nestjs/src/modules/store-ops/application/new-report.service.ts',
      content: `
        import * as database from "../../../shared/database/database.service";

        export class NewReportService {
          private readonly serviceType = database.DatabaseService;
        }
      `,
    },
  ])

  assert.match(violations.join('\n'), /new-report\.service\.ts/)
  assert.match(violations.join('\n'), /database\.service/)
})

test('guard rejects a fake new web-to-infrastructure import', () => {
  const violations = findWebInfrastructureImportViolations([
    {
      path: 'backend/nestjs/src/modules/store-ops/web/new-report.controller.ts',
      content: `
        import { ReportingRepository } from "../infrastructure/reporting.repository";

        export class NewReportController {
          constructor(private readonly reportingRepository: ReportingRepository) {}
        }
      `,
    },
  ])

  assert.match(violations.join('\n'), /new-report\.controller\.ts/)
  assert.match(violations.join('\n'), /infrastructure/)
})

test('guard rejects fake application re-exports from web/controller code', () => {
  const violations = findApplicationWebImportViolations([
    {
      path: 'backend/nestjs/src/modules/store-ops/application/new-report.service.ts',
      content: `
        export type { NewReportDto } from "../web/dto/new-report.dto";
        export * from "../web/new-report.controller";
      `,
    },
  ])

  assert.equal(violations.length, 2)
  assert.match(violations.join('\n'), /new-report\.service\.ts/)
  assert.match(violations.join('\n'), /web/)
})

test('guard rejects fake side-effect imports across forbidden layers', () => {
  const applicationViolations = findApplicationWebImportViolations([
    {
      path: 'backend/nestjs/src/modules/store-ops/application/new-report.service.ts',
      content: `
        import "../web/new-report.controller";
      `,
    },
  ])
  const webViolations = findWebInfrastructureImportViolations([
    {
      path: 'backend/nestjs/src/modules/store-ops/web/new-report.controller.ts',
      content: `
        import "../infrastructure/reporting.repository";
      `,
    },
  ])

  assert.match(applicationViolations.join('\n'), /web\/new-report\.controller/)
  assert.match(webViolations.join('\n'), /infrastructure/)
})

test('guard rejects a fake broad repository cast in Store Ops application code', () => {
  const violations = findStoreOpsRepositoryCastViolations([
    {
      path: 'backend/nestjs/src/modules/store-ops/application/new-reporting.service.ts',
      content: `
        reportingRepository as unknown as NewLeakyReadRepository,
      `,
    },
  ])

  assert.match(violations.join('\n'), /NewLeakyReadRepository/)
  assert.doesNotMatch(violations.join('\n'), /missing allowlisted broad repository cast/)
})

test('guard rejects a fake new oversized tracked source file without a reasoned allowlist', () => {
  const oversizedFile = {
    path: 'backend/nestjs/src/modules/store-ops/application/new-large-report.service.ts',
    content: Array.from({ length: largeTrackedSourceLineLimit }, (_item, index) => `const line${index} = ${index}`).join('\n'),
  }
  const violations = findLargeTrackedSourceViolations([oversizedFile])
  assert.match(violations.join('\n'), /new-large-report\.service\.ts/)
  assert.match(violations.join('\n'), /must not exceed/)
})

test('guard line counts ignore a trailing newline at the source size boundary', () => {
  const source = `${Array.from(
    { length: largeTrackedSourceLineLimit - 1 },
    (_item, index) => `const line${index} = ${index}`,
  ).join('\n')}\n`
  assert.equal(lineCount(source), largeTrackedSourceLineLimit - 1)
})

const targetStoreOpsModulePath = 'backend/nestjs/src/modules/store-ops/store-ops-targets.module.ts'
const targetStoreOpsModuleLimit = new Map([[targetStoreOpsModulePath, storeOpsModuleGraphLimits.get(targetStoreOpsModulePath)]])

function findTargetModuleGraphViolations(content) {
  return findModuleGraphLimitViolations([{ path: targetStoreOpsModulePath, content }], targetStoreOpsModuleLimit)
}

test('guard rejects fake Store Ops internal module provider growth', () => {
  const violations = findTargetModuleGraphViolations(`
          import { Module } from "@nestjs/common";

          @Module({
            controllers: [A, B, C, D, E],
            providers: [
              A,
              B,
              C,
              D,
              E,
              F,
              G,
              H,
              I,
              J,
              K,
              L,
              NewProvider,
            ],
            exports: [A, B, C, D, E],
          })
          export class StoreOpsTargetsModule {}
        `)

  assert.match(violations.join('\n'), /store-ops-targets\.module\.ts/)
  assert.match(violations.join('\n'), /providers graph has 13 entries/)
})

test('guard rejects an ungoverned fake Store Ops internal module', () => {
  const violations = findStoreOpsModuleGraphViolations([
    {
      path: 'backend/nestjs/src/modules/store-ops/store-ops-unplanned.module.ts',
      content: `
        import { Module } from "@nestjs/common";

        @Module({
          controllers: [NewController],
          providers: [NewService],
          exports: [NewService],
        })
        export class StoreOpsUnplannedModule {}
      `,
    },
  ])

  assert.match(violations.join('\n'), /store-ops-unplanned\.module\.ts/)
  assert.match(violations.join('\n'), /not covered by module graph limits/)
})

test('guard rejects provider growth on the Store Ops facade module', () => {
  const violations = findStoreOpsModuleGraphViolations([
    { path: 'backend/nestjs/src/modules/store-ops/store-ops.module.ts', content: 'import { Module } from "@nestjs/common"; const storeOpsInternalModules = [A, B, C, D]; @Module({ imports: [A], providers: [NewProvider], exports: storeOpsInternalModules }) export class StoreOpsModule {}' },
  ])

  assert.match(violations.join('\n'), /store-ops\.module\.ts/)
  assert.match(violations.join('\n'), /providers graph has 1 entries/)
})

test('guard rejects fake worker job module provider growth', () => {
  const violations = findWorkerJobsModuleGraphViolations([
    {
      path: 'backend/nestjs/src/worker-jobs.module.ts',
      content: 'import { Module } from "@nestjs/common"; @Module({ imports: [WorkerMaterializationJobsModule, WorkerSnapshotJobsModule], providers: [NewJobHandler], exports: [WorkerMaterializationJobsModule, WorkerSnapshotJobsModule] }) export class WorkerJobsModule {}',
    },
    {
      path: 'backend/nestjs/src/worker-materialization-jobs.module.ts',
      content: 'import { Module } from "@nestjs/common"; @Module({ providers: [A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S], exports: [A] }) export class WorkerMaterializationJobsModule {}',
    },
    {
      path: 'backend/nestjs/src/worker-snapshot-jobs.module.ts',
      content: 'import { Module } from "@nestjs/common"; @Module({ providers: [A, B, C, D], exports: [A] }) export class WorkerSnapshotJobsModule {}',
    },
  ])

  assert.match(violations.join('\n'), /worker-jobs\.module\.ts/)
  assert.match(violations.join('\n'), /providers graph has 1 entries/)
})

test('guard rejects module graph spread entries before counting size', () => {
  const violations = findTargetModuleGraphViolations(`
          import { Module } from "@nestjs/common";

          const baseProviders = [A, B, C, D, E, F, G, H, I, J, K, L];

          @Module({
            controllers: [A, B, C, D, E],
            providers: [...baseProviders, NewProvider],
            exports: [A, B, C, D, E],
          })
          export class StoreOpsTargetsModule {}
        `)

  assert.match(violations.join('\n'), /uses spread entry/)
  assert.match(violations.join('\n'), /baseProviders/)
})

test('guard counts custom provider objects as one module entry', () => {
  const observedCount = countModuleArrayProperty(
    `
      import { Module } from "@nestjs/common";

      @Module({
        providers: [
          A,
          { provide: APP_GUARD, useClass: Guard },
          {
            provide: TOKEN,
            useFactory: () => ({ left: 1, right: 2 }),
          },
        ],
      })
      export class CustomProviderModule {}
    `,
    'providers',
  )

  assert.equal(observedCount, 3)
})

test('guard counts module graph entries from @Module metadata only', () => {
  const violations = findTargetModuleGraphViolations(`
          import { Module } from "@nestjs/common";

          const helperMetadata = { providers: [A] };

          @Module({
            controllers: [A],
            providers: [A, B, C, D, E, F, G, H, I, J, K, L, M],
            exports: [A],
          })
          export class StoreOpsTargetsModule {}
        `)

  assert.match(violations.join('\n'), /providers graph has 13 entries/)
})

test('guard ignores comment delimiters while counting module graph entries', () => {
  const violations = findTargetModuleGraphViolations(`
          import { Module } from "@nestjs/common";

          @Module({
            controllers: [A],
            providers: [
              A, // ] comment must not close the array
              B, C, D, E, F, G, H, I, J, K, L, M,
            ],
            exports: [A],
          })
          export class StoreOpsTargetsModule {}
        `)

  assert.match(violations.join('\n'), /providers graph has 13 entries/)
})

test('guard rejects non-literal module graph expressions instead of partially counting them', () => {
  const violations = findTargetModuleGraphViolations(`
          import { Module } from "@nestjs/common";

          const baseProviders = [A, B, C];

          @Module({
            controllers: [A],
            providers: baseProviders.concat([NewProvider]),
            exports: [A],
          })
          export class StoreOpsTargetsModule {}
        `)

  assert.match(violations.join('\n'), /could not read @Module providers graph/)
})
