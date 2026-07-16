import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function readJson(path) {
  return JSON.parse(readText(path))
}

test('root package exposes the official release gate', () => {
  const packageJson = readJson('package.json')

  assert.equal(packageJson.private, true)
  assert.equal(
    packageJson.scripts['check:release'],
    'node scripts/check-release.mjs',
  )
  assert.equal(packageJson.scripts['test:scripts'], 'node --test scripts/*.test.mjs')
})

test('official release gate delegates to the exact-input stage runner', () => {
  const script = readText('scripts/check-release.mjs')
  const manifest = readJson('scripts/release-stage-manifest.json')

  assert.match(script, /runCanonicalRelease/)
  assert.match(script, /--resume/)
  assert.deepEqual(
    manifest.stages.map((stage) => stage.id),
    ['root-contracts', 'backend-release', 'frontend-static', 'dependency-audit', 'frontend-e2e'],
  )
})

test('official release gate uses cmd.exe wrapping for npm on Windows', () => {
  const script = readText('scripts/release-stage-runner.mjs')

  assert.match(script, /cmd\.exe/)
  assert.match(script, /\/d/)
  assert.match(script, /\/s/)
  assert.match(script, /\/c/)
})

test('package release scripts include production audit gates', () => {
  const backendPackage = readJson('backend/nestjs/package.json')
  const frontendPackage = readJson('admin-web/package.json')

  assert.equal(backendPackage.scripts['check:release:audit'], 'npm audit --omit=dev')
  assert.equal(frontendPackage.scripts['check:release:audit'], 'npm audit --omit=dev')
})

test('github release workflow is reusable and runs the canonical proof DAG on Node 24', () => {
  const workflow = readText('.github/workflows/release-check.yml')

  assert.match(workflow, /workflow_call:\s*\n/)
  assert.match(workflow, /workflow_dispatch:\s*\n/)
  assert.doesNotMatch(workflow, /^\s*pull_request:/m)
  assert.doesNotMatch(workflow, /^\s*push:/m)
  assert.match(workflow, /node-version:\s*24/)
  assert.match(workflow, /cache-dependency-path:\s*backend\/nestjs\/package-lock\.json/)
  assert.match(workflow, /cache-dependency-path:\s*admin-web\/package-lock\.json/)
  assert.match(workflow, /working-directory:\s*backend\/nestjs\s*\n\s*run:\s*npm ci/)
  assert.match(workflow, /working-directory:\s*admin-web\s*\n\s*run:\s*npm ci/)
  assert.match(workflow, /name:\s*Ensure system Chrome\s*\n\s*timeout-minutes:\s*5/)
  assert.match(workflow, /command -v google-chrome/)
  assert.match(workflow, /google-chrome --version/)
  assert.match(workflow, /pull-requests:\s*read/)
  assert.match(workflow, /PLAYWRIGHT_USE_SYSTEM_CHROME:\s*"1"/)
  assert.match(workflow, /run:\s*npm run check:release:static/)
  assert.match(workflow, /run:\s*npm run check:release:e2e/)
  assert.match(workflow, /run:\s*node scripts\/release-workflow-final\.mjs/)
})

test('fresh migration db smoke is a manual release preflight, not a docker-dependent root gate step', () => {
  const packageJson = readJson('package.json')
  const releaseGate = readText('docs/plans/release-check-gate.md')
  const productionReadiness = readText(
    'docs/plans/production-environment-readiness-checklist.md',
  )

  assert.equal(
    packageJson.scripts['smoke:migration:fresh-db'],
    'node scripts/migration-fresh-db-smoke.mjs',
  )
  assert.doesNotMatch(packageJson.scripts['check:release'], /smoke:migration:fresh-db/)
  assert.match(releaseGate, /Docker-dependent fresh DB smoke/)
  assert.match(releaseGate, /not part of the mandatory root `check:release` gate/)
  assert.match(releaseGate, /DB schema or migration files changed/)
  assert.match(productionReadiness, /DB schema or migration files changed/)
  assert.match(productionReadiness, /npm\.cmd run smoke:migration:fresh-db/)
})

test('migration change warning surfaces smoke evidence decision without failing the gate', () => {
  const result = spawnSync(process.execPath, ['scripts/migration-change-warning.mjs'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      HR_AXIS_CHANGED_FILES: [
        'db/migrations/999_example.sql',
        'backend/nestjs/src/shared/database/database.module.ts',
        'backend/nestjs/src/shared/database/migration.service.ts',
      ].join('\n'),
    },
  })

  assert.equal(result.status, 0)
  assert.match(result.stderr, /DB schema or migration-sensitive changes detected/)
  assert.match(result.stderr, /db\/migrations\/999_example\.sql/)
  assert.match(result.stderr, /backend\/nestjs\/src\/shared\/database\/database\.module\.ts/)
  assert.match(result.stderr, /npm\.cmd run smoke:migration:fresh-db/)
  assert.match(result.stderr, /Conditional Go/)
})

test('migration change warning stays quiet for non-migration changes', () => {
  const result = spawnSync(process.execPath, ['scripts/migration-change-warning.mjs'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      HR_AXIS_CHANGED_FILES: 'backend/nestjs/src/modules/store-ops/application/feed.service.ts',
    },
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /No DB schema or migration-sensitive changes detected/)
  assert.equal(result.stderr, '')
})

test('migration change warning avoids merge-base-dependent triple-dot diffs', () => {
  const helper = readText('scripts/migration-change-warning.mjs')

  assert.doesNotMatch(helper, /baseSha\}\.\.\./)
  assert.doesNotMatch(helper, /origin\/\$\{baseRef\}\.\.\./)
  assert.doesNotMatch(helper, /origin\/main\.\.\./)
  assert.doesNotMatch(helper, /diff', '--name-only'/)
  assert.match(helper, /pulls\/\$\{pullNumber\}\/files/)
  assert.match(helper, /try\s*{\s*\n\s*for \(let page = 1; ; page \+= 1\)/)
  assert.match(helper, /catch\s*{\s*\n\s*return \[\]/)
  assert.match(helper, /previous_filename/)
  assert.match(helper, /--name-status/)
  assert.match(helper, /git\(\['merge-base', baseSha, headSha\]\)/)
  assert.match(helper, /changedFilesFromGitHubPushEvent/)
  assert.match(helper, /event\?\.before/)
  assert.match(helper, /event\?\.after/)
  assert.match(helper, /git\(\['diff', '--name-status', beforeSha, afterSha\]\)/)
  assert.match(helper, /files\.push\(\.\.\.parseGitNameStatusFiles\(git\(args\)\)\)/)
  assert.doesNotMatch(helper, /if \(files\.length > 0\)\s*{\s*return files\s*}/)
  assert.ok(
    helper.includes("baseRefMergeBase ? ['diff', '--name-status', baseRefMergeBase, 'HEAD'] : null"),
  )
})
