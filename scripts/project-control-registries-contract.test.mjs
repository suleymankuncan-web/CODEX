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
  targetReferenceSpec: readText('docs/plans/target-reference-supersession-spec-v1.md'),
}

const normalizedTargetReferenceSpec = docs.targetReferenceSpec.replace(/\s+/g, ' ')

function targetReferenceIds(prefix) {
  return [...docs.targetReferenceSpec.matchAll(new RegExp(`\\*\\*${prefix}-(\\d{2})`, 'g'))].map(
    (match) => `${prefix}-${match[1]}`,
  )
}

function exactIdRange(prefix, end) {
  return Array.from(
    { length: end },
    (_, index) => `${prefix}-${String(index + 1).padStart(2, '0')}`,
  )
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
  requireText(docs.controlBoard, 'all June `13 blocked + 3')
  requireText(docs.controlBoard, 'PR #978 makes protected cookie-session reads fail `401`')
  requireText(docs.controlBoard, 'completed OT-1 -> INC-1 -> AUTH-1 -> TREF-1 evidence')
  requireText(docs.controlBoard, 'separately authorized append-only TREF implementation')
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

test('TREF-1 records every approved owner decision without an unresolved gate', () => {
  requireText(docs.targetReferenceSpec, 'Status: `approved_spec`')
  assert.ok(!docs.targetReferenceSpec.includes('Owner selection: `UNSET`'))
  for (const decision of [
    'Period close: `completed_snapshot`',
    'Open-month revision: `whole_month_latest_approved`',
    'Closed/past revision: `explicit_rerun_only`',
    'Explicit removal: `supersede_without_successor`',
    'Pilot import: `initial_create_only`',
    'Manager-only change: `responsibility_only`',
  ]) {
    requireText(docs.targetReferenceSpec, decision)
  }
})

test('TREF-1 has complete requirement, acceptance, and edge-case identifiers', () => {
  assert.deepEqual([...new Set(targetReferenceIds('FR'))], exactIdRange('FR', 16))
  assert.deepEqual([...new Set(targetReferenceIds('NFR'))], exactIdRange('NFR', 8))
  assert.deepEqual([...new Set(targetReferenceIds('AC'))], exactIdRange('AC', 14))
  assert.deepEqual([...new Set(targetReferenceIds('EC'))], exactIdRange('EC', 15))
})

test('every TREF-1 requirement is traced by a Given/When/Then acceptance criterion', () => {
  const acceptanceSection = docs.targetReferenceSpec
    .split('## 12. Acceptance Criteria')[1]
    ?.split('## 13. Edge Cases')[0]
  assert.ok(acceptanceSection)

  for (const requirement of [...exactIdRange('FR', 16), ...exactIdRange('NFR', 8)]) {
    assert.match(acceptanceSection, new RegExp(`\\b${requirement}\\b`))
  }

  for (const criterion of acceptanceSection.matchAll(
    /\*\*AC-\d{2} \([^)]*\):\*\* ([\s\S]*?)(?=\n- \*\*AC-|$)/g,
  )) {
    assert.match(criterion[1], /Given\s/i)
    assert.match(criterion[1], /when\s/i)
    assert.match(criterion[1], /then\s/i)
  }
})

test('TREF-1 freezes the selected schema, transaction, and writer boundaries', () => {
  for (const literal of [
    'A migration is not required for the selected first implementation contract.',
    '## 9. API And Command Contracts',
    '## 10. Data Models',
    'FOR UPDATE',
    "status = 'approved' RETURNING",
    'Never use `ON CONFLICT DO UPDATE`.',
    'Pilot import MUST NOT supersede or update an active reference.',
    'TREF-1 alone authorizes no implementation.',
    'target-reference-supersession-implementation-plan-v1.md',
    'Run no staging evidence or mutation without separate explicit authority.',
  ]) {
    requireText(docs.targetReferenceSpec, literal)
  }
})

test('TREF-1 keeps history, support, rotation, and privacy fail-closed', () => {
  for (const literal of [
    'an existing snapshot retains its stored reference ID.',
    'a support-store assignment does not move target ownership.',
    'same-day predecessor-end/successor-start is invalid',
    'Later manager changes never rewrite it.',
    'Silent omission or an extra removal introduced only during adjusted approval MUST fail closed.',
    'It MUST NOT store labels, target amounts, raw allocations, or personnel attributes.',
  ]) {
    assert.ok(normalizedTargetReferenceSpec.includes(literal), `missing locked literal: ${literal}`)
  }
})
