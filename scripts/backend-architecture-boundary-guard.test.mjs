import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' })
}

function trackedFiles(prefix = 'backend/nestjs/src/modules') {
  return git(['ls-files', '-z', prefix]).split('\0').filter(Boolean)
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

const directDatabaseServiceAllowlist = new Map([
  [
    'backend/nestjs/src/modules/integration/application/materialization.service.ts',
    ['import { DatabaseService } from "../../../shared/database/database.service"'],
  ],
  [
    'backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.ts',
    ['import { DatabaseService } from "../../../shared/database/database.service"'],
  ],
])

const storeOpsRepositoryCastAllowlist = new Map()

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

const trackedBackendFiles = readBackendSourceFiles()
const trackedBackendPaths = new Set(trackedBackendFiles.map((file) => file.path))

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

test('guard rejects missing or duplicate allowlisted direct DatabaseService imports', () => {
  const violations = findDirectDatabaseServiceViolations([
    {
      path: 'backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.ts',
      content: `
        import { Injectable } from "@nestjs/common";
      `,
    },
    {
      path: 'backend/nestjs/src/modules/integration/application/materialization.service.ts',
      content: `
        import { DatabaseService } from "../../../shared/database/database.service";
        import { DatabaseService } from "../../../shared/database/database.service";
      `,
    },
  ])

  assert.match(violations.join('\n'), /expected 1 allowlisted direct DatabaseService import occurrence/)
  assert.match(violations.join('\n'), /unallowlisted direct DatabaseService import/)
})

test('guard ignores commented allowlisted direct DatabaseService imports', () => {
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

  assert.match(violations.join('\n'), /expected 1 allowlisted direct DatabaseService import occurrence/)
  assert.doesNotMatch(violations.join('\n'), /unallowlisted direct DatabaseService import/)
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
