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

function importsIn(content) {
  const imports = []
  const importPattern = /import\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g
  const exportPattern = /export\s+(?:type\s+)?(?:\*|{[\s\S]*?})\s+from\s+['"]([^'"]+)['"]/g

  for (const match of content.matchAll(importPattern)) {
    imports.push({
      statement: match[0],
      source: match[1],
      index: match.index ?? 0,
    })
  }

  for (const match of content.matchAll(exportPattern)) {
    imports.push({
      statement: match[0],
      source: match[1],
      index: match.index ?? 0,
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

const directDatabaseServiceAllowlist = new Set([
  'backend/nestjs/src/modules/store-ops/application/snapshot.service.ts',
  'backend/nestjs/src/modules/integration/application/materialization.service.ts',
  'backend/nestjs/src/modules/integration/application/external-id-mapping.service.ts',
  'backend/nestjs/src/modules/integration/application/power-bi-export-upload.service.ts',
])

const storeOpsRepositoryCastAllowlist = new Map([
  [
    'backend/nestjs/src/modules/store-ops/application/reporting.service.ts',
    [
      'reportingRepository as unknown as StoreScoreReportingReadRepository',
      'reportingRepository as unknown as ClosedRankingRepository',
      'reportingRepository as unknown as SnapshotReportingReadRepository',
      'reportingRepository as unknown as StorePerformanceReportingReadRepository',
      'reportingRepository as unknown as RankingReportingReadRepository',
    ],
  ],
  [
    'backend/nestjs/src/modules/store-ops/application/ranking.service.ts',
    [
      'reportingRepository as unknown as StorePerformanceReportingReadRepository',
      'reportingRepository as unknown as RankingReportingReadRepository',
    ],
  ],
  [
    'backend/nestjs/src/modules/store-ops/application/workflow-inbox.service.ts',
    ['reportingRepository as unknown as SnapshotReportingReadRepository'],
  ],
])

function hasDirectDatabaseServiceImport(importEntry) {
  return (
    /\bDatabaseService\b/.test(importEntry.statement) &&
    /(?:^|\/)shared\/database\/database\.service$|database\.service$/.test(importEntry.source)
  )
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
    if (!isApplicationFile(file.path) || directDatabaseServiceAllowlist.has(file.path)) {
      continue
    }

    for (const importEntry of importsIn(file.content)) {
      if (hasDirectDatabaseServiceImport(importEntry)) {
        violations.push(describeViolation(file, importEntry.index, 'imports DatabaseService in application code'))
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
        violations.push(describeViolation(file, importEntry.index, 'imports web/controller layer from application code'))
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
        violations.push(describeViolation(file, importEntry.index, 'imports infrastructure directly from web/controller code'))
      }
    }
  }

  return violations
}

const trackedBackendFiles = readBackendSourceFiles()
const trackedBackendPaths = new Set(trackedBackendFiles.map((file) => file.path))

test('backend architecture direct DatabaseService allowlist points to tracked files', () => {
  for (const path of directDatabaseServiceAllowlist) {
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

test('guard rejects a fake extra broad repository cast in an allowlisted file', () => {
  const violations = findStoreOpsRepositoryCastViolations([
    {
      path: 'backend/nestjs/src/modules/store-ops/application/reporting.service.ts',
      content: `
        reportingRepository as unknown as StoreScoreReportingReadRepository,
        reportingRepository as unknown as ClosedRankingRepository,
        reportingRepository as unknown as SnapshotReportingReadRepository,
        reportingRepository as unknown as StorePerformanceReportingReadRepository,
        reportingRepository as unknown as RankingReportingReadRepository,
        reportingRepository as unknown as NewLeakyReadRepository,
      `,
    },
  ])

  assert.match(violations.join('\n'), /NewLeakyReadRepository/)
  assert.doesNotMatch(violations.join('\n'), /missing allowlisted broad repository cast/)
})

test('guard rejects a fake duplicate allowlisted broad repository cast', () => {
  const violations = findStoreOpsRepositoryCastViolations([
    {
      path: 'backend/nestjs/src/modules/store-ops/application/ranking.service.ts',
      content: `
        reportingRepository as unknown as StorePerformanceReportingReadRepository,
        reportingRepository as unknown as RankingReportingReadRepository,
        reportingRepository as unknown as RankingReportingReadRepository,
      `,
    },
  ])

  assert.match(violations.join('\n'), /RankingReportingReadRepository/)
  assert.match(violations.join('\n'), /unallowlisted broad repository cast/)
})
