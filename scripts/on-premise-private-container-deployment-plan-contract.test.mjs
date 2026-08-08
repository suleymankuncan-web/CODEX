import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const planPath = 'docs/plans/on-premise-private-container-deployment-plan-v1.md'
const plan = readFileSync(new URL(`../${planPath}`, import.meta.url), 'utf8')
const currentState = readFileSync(new URL('../current-state.md', import.meta.url), 'utf8')

function requireText(text, expected, label = expected) {
  const normalizedText = text.replace(/\s+/g, ' ').trim()
  const normalizedExpected = expected.replace(/\s+/g, ' ').trim()
  assert.ok(normalizedText.includes(normalizedExpected), `Missing ${label}: ${expected}`)
}

function requireEvery(text, expected, label = 'contract text') {
  for (const phrase of expected) {
    requireText(text, phrase, label)
  }
}

test('on-premise plan identity and ONP execution sequence are pinned', () => {
  requireEvery(plan, [
    '# HR Axis On-Premise Private Container Deployment Plan V1',
    'Status: Proposed; planning only',
    'Baseline: `3b1b3f5c9e4447b18d7eceb352de1c111c7fb4e1`',
    'Risk: R5',
  ])

  const sequence = [
    '### ONP-0',
    '### ONP-1',
    '### ONP-2',
    '### ONP-3',
    '### ONP-4',
    '### ONP-5',
  ]
  let previousIndex = -1
  for (const heading of sequence) {
    const index = plan.indexOf(heading)
    assert.ok(index > previousIndex, `ONP sequence is missing or out of order: ${heading}`)
    previousIndex = index
  }
})

test('locked boundaries keep the rehearsal private, synthetic, and reversible', () => {
  requireEvery(plan, [
    'Use Docker Compose, not Kubernetes, for the first single-server deployment.',
    'Use Ubuntu Server 24.04 LTS with Docker Engine CE, Buildx, and the Docker Compose plugin.',
    'Do not require Docker Desktop.',
    "Keep PostgreSQL. Do not port HR Axis to the company's MySQL instance.",
    'The package contains no source repository.',
    'Use synthetic fixtures only during local package development and rehearsal.',
    'no production deployment or live cutover;',
    'no Nebim network call or guessed Nebim adapter;',
    'no real-photo activation or weakening of the current media safety gates;',
    'Keep the current hosted stack available as a rollback path until the on-prem acceptance and observation window closes.',
  ])

  requireEvery(plan, [
    'without requiring',
    'Cloudflare, Render, Supabase, Clerk, R2, Sentry, or Alibaba Model Studio at runtime.',
    'Qwen and all external AI switches remain disabled in the strict-local profile.',
    'The first accepted environment is a synthetic-data rehearsal.',
  ])
})

test('image, content, security, migrator, identity, and storage contracts remain explicit', () => {
  requireEvery(plan, [
    '## 7. Production Image Protection Contract',
    'no `.git`, `.github`, source TypeScript/TSX, tests, coverage, screenshots,',
    'no source maps or embedded `sourcesContent`;',
    'non-root runtime user and minimal write paths;',
    'pinned base-image digest in the release manifest;',
    'content inspection and secret scan run against exported image layers;',
    'vulnerability scan completed before export;',
    'offline bundle contains checksums and an owner-controlled signature;',
    'deployment verifies signature and digest before `docker load` and before',
    'No automatic database migration on API startup. A one-shot migrator runs explicitly before API/worker activation.',
    'Only the migrator may alter the HR Axis schema.',
    '### 6.6 Keycloak',
    'Use production mode, PostgreSQL persistence, an explicit external hostname,',
    'Preserve the existing role and scope claims required by HR Axis:',
    'Preserve the browser-session and CSRF contracts, including secure cookie',
    'attributes, protected writes, stale-CSRF recovery, and logout invalidation.',
    '### 6.7 Local object storage',
    'provider-neutral S3-compatible local object-store adapter',
    'Keep objects private; no public development URL or public bucket.',
    'Preserve primary/recovery integrity checks, SHA-256 and byte-count',
    'Primary and recovery cannot claim independent failure domains if both reside on the same physical disk.',
    'accepted production design needs a separate disk, NAS, or backup target supplied by IT.',
    'Provider-neutralization must not weaken the existing synthetic-only and',
  ])
})

test('requirements, acceptance, stop rules, verification, and completion are pinned', () => {
  requireEvery(plan, [
    '## 13. Functional Requirements',
    '## 14. Non-Functional Requirements',
    '## 15. End-to-End Acceptance Criteria',
    '## 16. Stop Conditions',
    '## 17. Change-My-Mind Triggers',
    '## 18. Verification Policy',
    '## 19. Definition of Done',
    'For ONP-0, use documentation/script-contract verification only:',
    'git diff --check',
    'npm.cmd run test:scripts',
    'npm.cmd run check:affected-verification',
    'The preparation line is complete only when ONP-0 through ONP-5 are merged,',
  ])

  for (let index = 1; index <= 8; index += 1) {
    requireText(plan, `FR-${index}:`, `FR-${index}`)
    requireText(plan, `NFR-${index}`, `NFR-${index}`)
  }
  for (let index = 1; index <= 12; index += 1) {
    requireText(plan, `AC-${index}:`, `AC-${index}`)
  }
})

test('current-state links and classifies the owner-approved on-prem preparation', () => {
  requireEvery(currentState, [
    planPath,
    'owner-approved on-prem synthetic preparation',
  ], 'current-state alignment')
})

test('owner workstation installation boundary is explicit in the plan', () => {
  requireText(
    plan,
    "Repository implementation must not install WSL or Docker on the owner's workstation.",
    'owner workstation installation boundary',
  )
})
