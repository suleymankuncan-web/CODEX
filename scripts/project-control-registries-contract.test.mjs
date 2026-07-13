import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const workspaceRoot = join(import.meta.dirname, '..')

function readText(path) {
  return readFileSync(join(workspaceRoot, path), 'utf8')
}

function requirePath(path) {
  assert.ok(existsSync(join(workspaceRoot, path)), `Missing expected path: ${path}`)
}

function requireText(text, value) {
  assert.ok(text.includes(value), `Missing expected text: ${value}`)
}

const docs = {
  library: readText('docs/README.md'),
  currentState: readText('current-state.md'),
  activeNextActions: readText('docs/plans/active-next-actions.md'),
  decisionRegistry: readText('docs/plans/decision-registry-v1.md'),
  runbookRegistry: readText('docs/plans/runbook-registry-v1.md'),
  controlBoard: readText('docs/plans/project-control-board-v1.md'),
  archiveGuardMigrationRegister: readText('docs/plans/archive-guard-migration-register-v1.md'),
}

const controlDocs = [
  'docs/plans/decision-registry-v1.md',
  'docs/plans/runbook-registry-v1.md',
  'docs/plans/project-control-board-v1.md',
]

test('project control docs are discoverable from operating handoff docs', () => {
  for (const path of controlDocs) {
    requirePath(path)
    requireText(docs.library, path)
    requireText(docs.currentState, path)
    requireText(docs.activeNextActions, path)
  }

  requireText(docs.library, '### Operating Shelf')
  requireText(docs.currentState, 'Project mode and go/no-go board')
  requireText(docs.activeNextActions, 'is the short current-mode board')
})

test('decision registry keeps source documents and change triggers visible', () => {
  for (const phrase of [
    '# Decision Registry V1',
    'Status: active',
    'Shelf: operating',
    'This registry is a map, not a replacement for the source documents.',
    '| Decision | Status | Current stance | Source of truth | Change trigger |',
    'Controlled pilot execution',
    'Broad production rollout',
    'GitHub Codex review is owner-disabled and must not be requested or awaited',
    'Store Action V1B',
    'Auth source of truth',
    'VISUAL_MERCHANDISER',
    'Redis/BullMQ posture',
    'Supabase recovery posture',
    'UI redesign',
    'Norm Kadro / Workforce Planning Read-Only V1',
    '## Stop Rules',
  ]) {
    requireText(docs.decisionRegistry, phrase)
  }

  requireText(docs.decisionRegistry, 'Broad production rollout | blocked_external | No-Go.')
  requireText(docs.decisionRegistry, 'JSON source integration | parked')
})

test('runbook registry maps procedures to inputs, output, and stop conditions', () => {
  for (const phrase of [
    '# Runbook Registry V1',
    'Status: active',
    'Shelf: operating',
    '| Situation | Runbook | Required input | Output/evidence | Stop condition |',
    'Continue controlled pilot',
    'Prove Clerk persona route visibility',
    'Prove Store Action command path',
    'Check deployed readiness',
    'Check alert routing',
    'Check Redis/BullMQ posture',
    'Prove Supabase restore posture',
    'Generate system flow map',
    'Guard docs library structure',
    '## Evidence Safety',
  ]) {
    requireText(docs.runbookRegistry, phrase)
  }

  for (const forbiddenSecret of [
    'raw bearer tokens',
    'Clerk cookies',
    'database URLs',
    'Redis URLs',
  ]) {
    requireText(docs.runbookRegistry, forbiddenSecret)
  }
})

test('project control board preserves current go no-go boundaries', () => {
  for (const phrase of [
    '# Project Control Board V1',
    'Status: active',
    'Shelf: operating',
    'The project is in controlled pilot execution mode.',
    'Controlled staging/internal pilot: `Conditional Go`.',
    'Broad production rollout: `No-Go`.',
    'Targeted Store/Admin modernization: completed in scoped trains',
    'Separate mobile app: discovery is documented; implementation is `Parked`.',
    'Generic architecture/refactor train: `Parked`',
    '## What We Do Now',
    '## What We Do Not Do Now',
    '## Go / No-Go Board',
    '## Next Best Default Action',
    '## Stop Rules',
  ]) {
    requireText(docs.controlBoard, phrase)
  }

  requireText(docs.controlBoard, 'Do not change auth, API response shape, DB, provider config')
  requireText(docs.controlBoard, 'A3\'s ten-run p95 is `13.23` minutes')
  requireText(docs.controlBoard, 'without another unmeasured concurrency experiment')
  requireText(docs.controlBoard, 'B1 pilot evidence: owner-attested checklist approval')
  requireText(docs.controlBoard, 'PRs #971-#975 close the current Admin')
  requireText(docs.controlBoard, 'optional follow-ups, not current pilot blockers')
})

test('archive guard migration register preserves its incremental boundary', () => {
  requireText(docs.library, 'docs/plans/archive-guard-migration-register-v1.md')

  for (const phrase of [
    '# Archive Guard Migration Register V1',
    'Status: active',
    'add a new executable dependency on it.',
    'group removes five safe dependencies.',
    'The 41 entries below are the remaining',
    '35 safe on-touch migrations, two primary-source',
    'three triage decisions',
    'one deliberate provenance',
    'count is permanently fixed.',
  ]) {
    requireText(docs.archiveGuardMigrationRegister, phrase)
  }
})
