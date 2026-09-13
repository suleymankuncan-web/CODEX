import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { MAX_PROOF_AGE_MS, isSpec, workspacePaths } from '../../scripts/release-recovery.mjs'
import { sha256, stableJson } from '../../scripts/release-stage-proof.mjs'

const safeSpec = (file) => /^[A-Za-z0-9._-]+\.spec\.ts$/.test(file)
export function reportCases(report) {
  const result = []
  function walk(suites, titles = []) {
    for (const suite of suites ?? []) {
      const lineage = [...titles, suite.title]
      for (const spec of suite.specs ?? []) {
        const file = (spec.file ?? suite.file ?? '').replaceAll('\\', '/').split('/').at(-1)
        if (!safeSpec(file)) throw new Error('Invalid spec path in Playwright report')
        for (const test of spec.tests ?? []) {
          const id = stableJson([file, ...lineage, spec.title, test.projectName, test.repeatEachIndex ?? 0])
          const passed = test.expectedStatus === 'passed' && test.status === 'expected' &&
            test.results?.length === 1 && test.results[0].status === 'passed' && !(test.results[0].errors?.length)
          result.push({ id, file, title: spec.title, passed,
            durationMs: (test.results ?? []).reduce((sum, item) => sum + (item.duration ?? 0), 0) })
        }
      }
      walk(suite.suites, lineage)
    }
  }
  walk(report.suites)
  if (!result.length || new Set(result.map((item) => item.id)).size !== result.length) throw new Error('Empty or duplicate Playwright test inventory')
  return result
}

export function specDigests(root, normalizeLineEndings = false) {
  return Object.fromEntries(workspacePaths(root).filter(isSpec).map((path) => {
    const bytes = readFileSync(join(root, path))
    return [path.split('/').at(-1), sha256(normalizeLineEndings ? bytes.toString('utf8').replaceAll('\r\n', '\n') : bytes)]
  }))
}

export function uncertainSpecDependencies(root) {
  const files = workspacePaths(root).filter((path) => /^admin-web\/e2e\/.*\.[tj]sx?$/.test(path))
  return files.some((path) => hasUncertainSpecImports(readFileSync(join(root, path), 'utf8'), path))
}

export function hasUncertainSpecImports(source, path = 'spec.ts') {
  const ts = createRequire(import.meta.url)('typescript')
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  let uncertain = tree.parseDiagnostics.length > 0
  const inspect = (argument) => {
    if (!argument || !ts.isStringLiteralLike(argument) || /\.spec(?:[./?#]|$)/.test(argument.text)) uncertain = true
  }
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) inspect(node.moduleSpecifier)
    if (ts.isExternalModuleReference(node)) inspect(node.expression)
    if (ts.isImportTypeNode(node)) inspect(ts.isLiteralTypeNode(node.argument) ? node.argument.literal : null)
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) inspect(node.arguments[0])
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return uncertain
}

export function selectSpecRecovery({ inventory, previous, sharedDigest, digests, reviewedSpecs, reviewedSpecDigests, reviewDigests = digests, now = Date.now(), uncertain = false }) {
  const files = [...new Set(inventory.map((item) => item.file))].sort()
  const fresh = (reason) => ({ execute: files, reused: [], reason })
  if (uncertain) return fresh('spec dependencies are uncertain')
  if (previous?.version !== 2 || previous.sharedDigest !== sharedDigest) return fresh('application, shared inputs, environment or build changed')
  if (previous.globalErrors || !['passed', 'failed'].includes(previous.outcome)) return fresh('previous run did not complete cleanly')
  const completed = Date.parse(previous.completedAt)
  if (!Number.isFinite(completed) || completed > now || now - completed > MAX_PROOF_AGE_MS) return fresh('prior run expired')
  if (!Array.isArray(previous.cases) || previous.cases.some((item) =>
    !item || !safeSpec(item.file) || typeof item.id !== 'string' || typeof item.passed !== 'boolean' ||
    !/^[a-f0-9]{40}$/.test(item.sourceHead ?? '') || !Number.isFinite(item.durationMs) || item.durationMs < 0)) return fresh('invalid prior case provenance')
  const oldIds = previous.cases.map((item) => item.id).sort()
  if (stableJson(oldIds) !== stableJson(inventory.map((item) => item.id).sort())) return fresh('test inventory changed')
  const inventoryFiles = new Map(inventory.map((item) => [item.id, item.file]))
  if (previous.cases.some((item) => inventoryFiles.get(item.id) !== item.file)) return fresh('case file provenance changed')
  const reused = files.filter((file) => reviewedSpecs.includes(file) &&
    reviewedSpecDigests?.[file] === reviewDigests[file] &&
    inventory.filter((item) => item.file === file).length === previous.cases.filter((item) => item.file === file).length &&
    previous.specDigests?.[file] === digests[file] &&
    previous.cases.filter((item) => item.file === file).every((item) => item.passed &&
      Number.isFinite(Date.parse(item.provenAt)) && Date.parse(item.provenAt) <= now &&
      now - Date.parse(item.provenAt) <= MAX_PROOF_AGE_MS))
  return { execute: files.filter((file) => !reused.includes(file)), reused,
    reason: reused.length ? 'reviewed isolated specs retain identical inputs' : 'changed, failed or unreviewed specs must execute' }
}

export function combineSpecResults({ inventory, previous, selection, report, sharedDigest, digests, sourceHead, exitCode, now = new Date() }) {
  const executed = report ? reportCases(report) : []
  const expectedExecuted = inventory.filter((item) => selection.execute.includes(item.file))
  const expectedIds = expectedExecuted.map((item) => item.id).sort()
  if (stableJson(executed.map((item) => item.id).sort()) !== stableJson(expectedIds)) throw new Error('Executed report does not cover selected inventory')
  const globalErrors = Boolean(report?.errors?.length || ![0, 1].includes(exitCode))
  const retained = (previous?.cases ?? []).filter((item) => selection.reused.includes(item.file))
  const cases = [...retained, ...executed.map((item) => ({ ...item, sourceHead, provenAt: now.toISOString() }))]
  if (stableJson(cases.map((item) => item.id).sort()) !== stableJson(inventory.map((item) => item.id).sort())) throw new Error('Combined proof does not cover complete current inventory')
  const passed = !globalErrors && exitCode === 0 && cases.every((item) => item.passed)
  return {
    version: 2, outcome: passed ? 'passed' : 'failed', globalErrors,
    sourceHead, completedAt: now.toISOString(), sharedDigest, specDigests: digests, cases,
    executedCount: executed.length, reusedCount: retained.length,
    executedDurationMs: executed.reduce((sum, item) => sum + item.durationMs, 0),
    retainedPriorDurationMs: retained.reduce((sum, item) => sum + item.durationMs, 0),
  }
}
