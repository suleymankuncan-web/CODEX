import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  buildGitDiffCommands,
  parseChangedFiles,
  selectAffectedVerification,
} from './affected-verification-selector.mjs'

test('local selector compares the working tree and branch base without replaying the latest commit', () => {
  assert.deepEqual(buildGitDiffCommands('base-sha'), [
    ['diff', '--name-status'],
    ['diff', '--name-status', '--cached'],
    ['diff', '--name-status', 'base-sha', 'HEAD'],
  ])
  assert.doesNotMatch(JSON.stringify(buildGitDiffCommands('')), /diff-tree/u)
})

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

test('affected verification selector is advisory and never replaces release gates', () => {
  const selection = selectAffectedVerification([
    'admin-web/src/features/store-kpis/store-kpis-page.tsx',
  ])

  assert.equal(selection.advisory, true)
  assert.equal(selection.replacesReleaseGate, false)
  assert.match(selection.fullReleaseReason, /reviewer may still require/)
  assert.match(selection.notes.join('\n'), /discipline\.md/)
})

test('docs-only changes select diff check and script tests only when guarded scripts also change', () => {
  const docsOnly = selectAffectedVerification([
    'docs/plans/request-intake-and-decision-policy.md',
  ])

  assert.deepEqual(docsOnly.commands, ['git diff --check'])
  assert.equal(docsOnly.fullReleaseRequired, false)

  const codexProcess = selectAffectedVerification([
    'AGENTS.md',
    '.codex/config.toml',
    '.codex/agents/luna-max.toml',
  ])

  assert.deepEqual(codexProcess.commands, ['git diff --check'])
  assert.equal(codexProcess.fullReleaseRequired, false)
  assert.deepEqual(codexProcess.matchedRules[0].files, [
    'AGENTS.md',
    '.codex/config.toml',
    '.codex/agents/luna-max.toml',
  ])

  const scriptChange = selectAffectedVerification(['scripts/store-ui-refactor-guard.test.mjs'])

  assert.ok(scriptChange.commands.includes('git diff --check'))
  assert.ok(scriptChange.commands.includes('npm.cmd run test:scripts'))
})

test('Store UI changes select frontend gates and targeted Store Playwright guidance', () => {
  const selection = selectAffectedVerification([
    'admin-web/src/features/store-kpis/store-kpis-page.tsx',
  ])

  assert.ok(selection.commands.includes('npm.cmd --prefix admin-web run lint'))
  assert.ok(selection.commands.includes('npm.cmd --prefix admin-web run build'))
  assert.ok(selection.targeted.includes('targeted Store Playwright route/spec for touched route'))
  assert.ok(selection.affectedRoutesOrServices.includes('/store/*'))
  assert.equal(selection.affectedRoutesOrServices.includes('/admin/*'), false)
  assert.equal(selection.fullReleaseRequired, false)
})

test('R5 sensitive changes require root release gate and specific targeted evidence', () => {
  const selection = selectAffectedVerification([
    'db/migrations/999_example.sql',
    'backend/nestjs/src/modules/reporting/ranking.service.ts',
    'backend/nestjs/src/modules/auth/auth.service.ts',
  ])

  assert.equal(selection.fullReleaseRequired, true)
  assert.ok(selection.commands.includes('npm.cmd run check:release'))
  assert.ok(selection.targeted.includes('npm.cmd run smoke:migration:fresh-db or documented Conditional Go'))
  assert.ok(selection.targeted.includes('targeted auth/scope positive and negative tests'))
  assert.ok(selection.targeted.includes('targeted scoring/ranking/snapshot contract tests'))
})

test('API contract changes select OpenAPI and frontend API checks', () => {
  const selection = selectAffectedVerification([
    'backend/nestjs/src/modules/store-ops/web/store-kpis.controller.ts',
  ])

  assert.equal(selection.fullReleaseRequired, true)
  assert.ok(selection.commands.includes('npm.cmd --prefix backend/nestjs run openapi:generate'))
  assert.ok(selection.commands.includes('npm.cmd --prefix admin-web run api:check'))
  assert.ok(selection.commands.includes('npm.cmd run check:release'))
})

test('frontend import pages do not look like queue or import lifecycle changes', () => {
  const selection = selectAffectedVerification([
    'admin-web/src/features/admin-integrations/import-history-panel.tsx',
  ])

  assert.equal(selection.fullReleaseRequired, false)
  assert.equal(
    selection.targeted.includes('targeted import lifecycle or worker smoke/tests'),
    false,
  )
})

test('broad backend changes must say when route or service family cannot be inferred', () => {
  const selection = selectAffectedVerification([
    'backend/nestjs/src/modules/foo/foo.service.ts',
  ])

  assert.equal(selection.unableToInferAffectedRoutesOrServices, true)
  assert.deepEqual(selection.affectedRoutesOrServices, [])
  assert.match(selection.notes.join('\n'), /write the affected scope manually in the PR/)
})

test('selector parses newline comma and Windows path input', () => {
  assert.deepEqual(
    parseChangedFiles('docs/a.md,admin-web\\\\src\\\\app.tsx\r\nscripts/a.test.mjs'),
    ['docs/a.md', 'admin-web/src/app.tsx', 'scripts/a.test.mjs'],
  )
})

test('selector CLI prints commands and full release reason from changed files env', () => {
  const result = spawnSync(process.execPath, ['scripts/affected-verification-selector.mjs'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      HR_AXIS_CHANGED_FILES: 'backend/nestjs/src/modules/auth/auth.service.ts',
    },
  })

  assert.equal(result.status, 0)
  assert.match(result.stdout, /Advisory verification selection/)
  assert.match(result.stdout, /Full release required: yes/)
  assert.match(result.stdout, /npm\.cmd run check:release/)
  assert.match(result.stdout, /targeted auth\/scope positive and negative tests/)
})

test('selector CLI can emit machine-readable JSON for local tooling', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/affected-verification-selector.mjs', '--json'],
    {
      cwd: workspaceRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        HR_AXIS_CHANGED_FILES: 'admin-web/src/app.tsx',
      },
    },
  )

  assert.equal(result.status, 0)
  const selection = JSON.parse(result.stdout)
  assert.equal(selection.advisory, true)
  assert.ok(selection.commands.includes('npm.cmd --prefix admin-web run lint'))
})

test('offline package and Compose changes select the offline rehearsal contract', () => {
  const selection = selectAffectedVerification([
    'infra/onprem/core/compose.photo-proof.yaml',
  ])

  assert.equal(selection.fullReleaseRequired, true)
  assert.ok(selection.commands.includes('npm.cmd run check:release'))
  assert.ok(selection.commands.includes('npm.cmd run test:scripts'))
  assert.ok(selection.targeted.includes('on-prem offline bundle and clean Linux rehearsal contract'))
  assert.ok(selection.affectedRoutesOrServices.includes('/onprem-offline'))
})

test('project health plan keeps affected selector limits explicit', () => {
  const plan = readText('docs/plans/project-health-uplift-pr-train-v1.md')

  assert.match(plan, /The selector output is advisory/)
  assert.match(plan, /It must not weaken, replace, or rename `check:release`/)
  assert.match(plan, /must always show why a full release gate is or is not required/)
})

test('root package exposes the advisory affected verification selector command', () => {
  const packageJson = JSON.parse(readText('package.json'))

  assert.equal(
    packageJson.scripts['check:affected-verification'],
    'node scripts/affected-verification-selector.mjs',
  )
  assert.doesNotMatch(packageJson.scripts['check:release'], /check:affected-verification/)
})

test('on-prem image proof changes select build gates, root release, and the targeted workflow note', () => {
  const selection = selectAffectedVerification([
    'infra/onprem/images/backend.Dockerfile',
    'scripts/onprem-image-proof-contract.test.mjs',
    'tools/onprem-license/package-lock.json',
  ])

  assert.equal(selection.fullReleaseRequired, true)
  assert.ok(selection.commands.includes('npm.cmd run test:scripts'))
  assert.ok(selection.commands.includes('npm.cmd --prefix admin-web run build'))
  assert.ok(selection.commands.includes('npm.cmd --prefix backend/nestjs run build'))
  assert.ok(selection.commands.includes('npm.cmd run check:release'))
  assert.ok(selection.targeted.includes('on-prem image proof workflow'))
  assert.ok(selection.targeted.includes('on-prem private core static/runtime proof'))
  assert.ok(selection.affectedRoutesOrServices.includes('/onprem-core'))
})

test('SeaweedFS photo-storage overlay changes select the on-prem proof gates', () => {
  const selection = selectAffectedVerification([
    'infra/onprem/photo-storage/compose.yaml',
    'scripts/onprem-photo-storage-runtime-proof.mjs',
  ])

  assert.equal(selection.fullReleaseRequired, true)
  assert.ok(selection.commands.includes('npm.cmd run test:scripts'))
  assert.ok(selection.commands.includes('npm.cmd --prefix backend/nestjs run build'))
  assert.ok(selection.commands.includes('npm.cmd run check:release'))
  assert.ok(selection.targeted.includes('on-prem private core static/runtime proof'))
  assert.ok(selection.affectedRoutesOrServices.includes('/onprem-core'))
})
