import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function readText(path) {
  return readFileSync(path, 'utf8')
}

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' })
}

function trackedFiles() {
  return git(['ls-files', '-z']).split('\0').filter(Boolean)
}

function gitIgnores(path) {
  try {
    execFileSync('git', ['check-ignore', '-q', '--', path], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function isForbiddenTrackedPath(path) {
  const segments = path.split('/')
  const forbiddenSegments = new Set(['node_modules', 'dist', 'dist-ssr', 'test-results', 'coverage', 'outputs'])
  if (segments.some((segment) => forbiddenSegments.has(segment))) {
    return true
  }

  const basename = segments.at(-1) ?? ''
  return /^\.env(?:$|\.local$|\.[^.]+\.local$)/.test(basename)
}

const currentState = readText('current-state.md')
const activeNextActions = readText('docs/plans/active-next-actions.md')
const debtLedger = readText('docs/plans/project-debt-ledger.md')
const riskScan = readText('docs/plans/project-risk-scan-2026-04-30.md')

test('repo does not track generated folders or local secret env files', () => {
  const forbidden = trackedFiles().filter(isForbiddenTrackedPath)

  assert.deepEqual(forbidden, [])
})

test('ignore rules cover generated output folders and local env files', () => {
  for (const ignoredPath of [
    'outputs/example.txt',
    'tmp/example.txt',
    'backend/nestjs/node_modules/pkg/index.js',
    'backend/nestjs/dist/example.js',
    'backend/nestjs/.env',
    'backend/nestjs/.env.local',
    'admin-web/node_modules/pkg/index.js',
    'admin-web/dist/example.js',
    'admin-web/test-results/example.txt',
    'admin-web/.env',
    'admin-web/.env.local',
  ]) {
    assert.equal(gitIgnores(ignoredPath), true, `${ignoredPath} should be ignored`)
  }
})

test('repo hygiene guard is recorded in handoff docs', () => {
  for (const text of [currentState, activeNextActions, debtLedger, riskScan]) {
    requireText(text, 'Repo Hygiene Guard V1')
  }
})

test('repo hygiene docs keep outputs as ignored local work', () => {
  for (const text of [currentState, riskScan]) {
    requireText(text, 'outputs/')
    requireText(text, 'ignored')
  }
})
