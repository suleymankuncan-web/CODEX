# Pilot Readiness Evidence Consolidation V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the existing controlled pilot evidence into one guarded `Conditional Go` decision note without changing product behavior.

**Architecture:** Add a docs-only pilot evidence note and a root Node contract test that guards the note's required evidence references, decision language, and no-secret policy. Update only handoff/gate references so future context resumes start from the current pilot decision.

**Tech Stack:** Markdown evidence docs, Node `node:test` contract tests, PowerShell, existing root npm scripts.

---

## Boundary

Allowed:

- Create `docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-conditional-go-consolidation.md`.
- Create `scripts/pilot-readiness-consolidation-contract.test.mjs`.
- Update `docs/plans/pilot-readiness-gate-v1.md`.
- Update `current-state.md`.
- Run pilot stabilization and root script guards.

Not allowed:

- Change backend or frontend behavior.
- Change auth, role, scope, ranking, import, master-data, scoring, or promotion semantics.
- Touch staging or production data.
- Add JSON/source-specific adapter work.
- Approve broad production rollout.
- Record raw bearer tokens, Clerk cookies, passwords, provider subjects, full JWTs, database secrets, TC/national-id values, or private user data.

## Files

- Create: `scripts/pilot-readiness-consolidation-contract.test.mjs`
- Create: `docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-conditional-go-consolidation.md`
- Modify: `docs/plans/pilot-readiness-gate-v1.md`
- Modify: `current-state.md`

## Required Evidence Inputs

The consolidation note must reference these existing files:

- `docs/evidence/pilot-readiness/2026-05-05-pilot-readiness-decision.md`
- `docs/evidence/pilot-readiness/2026-05-06-role-smoke.md`
- `docs/evidence/pilot-readiness/2026-05-06-ranking-privacy-smoke.md`
- `docs/evidence/pilot-readiness/2026-05-06-master-data-power-bi-acceptance.md`
- `docs/evidence/pilot-readiness/2026-05-06-live-protected-api-smoke.md`
- `docs/evidence/pilot-readiness/2026-05-05-staging-master-data-kpi-materialization.md`

---

### Task 1: Add The Consolidation Guard First

**Files:**

- Create: `scripts/pilot-readiness-consolidation-contract.test.mjs`

- [ ] **Step 1: Create the failing guard test**

Create `scripts/pilot-readiness-consolidation-contract.test.mjs` with this exact content:

```js
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

function readText(path) {
  return readFileSync(path, 'utf8')
}

function requireText(text, expected) {
  assert.ok(text.includes(expected), `Missing expected text: ${expected}`)
}

function requireAll(text, expectedValues) {
  for (const expected of expectedValues) {
    requireText(text, expected)
  }
}

const evidencePath =
  'docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-conditional-go-consolidation.md'
const currentState = readText('current-state.md')
const gate = readText('docs/plans/pilot-readiness-gate-v1.md')

test('controlled pilot consolidation evidence exists and records the current decision', () => {
  assert.equal(existsSync(evidencePath), true, `${evidencePath} must exist`)
  const evidence = readText(evidencePath)

  requireAll(evidence, [
    '# Controlled Pilot Conditional Go Consolidation',
    'Final decision: `Conditional Go` for controlled staging/internal pilot.',
    'Broad production rollout: `No-Go`.',
    'This note does not replace the detailed evidence files.',
  ])
})

test('controlled pilot consolidation maps every readiness gate area to evidence', () => {
  const evidence = readText(evidencePath)

  requireAll(evidence, [
    '## Gate Matrix',
    'real staging IdP evidence',
    'true store/personnel baseline evidence',
    'real KPI import smoke evidence',
    'pilot user and scope evidence',
    'release and migration evidence',
    'docs/evidence/pilot-readiness/2026-05-05-pilot-readiness-decision.md',
    'docs/evidence/pilot-readiness/2026-05-06-role-smoke.md',
    'docs/evidence/pilot-readiness/2026-05-06-ranking-privacy-smoke.md',
    'docs/evidence/pilot-readiness/2026-05-06-master-data-power-bi-acceptance.md',
    'docs/evidence/pilot-readiness/2026-05-06-live-protected-api-smoke.md',
    'docs/evidence/pilot-readiness/2026-05-05-staging-master-data-kpi-materialization.md',
  ])
})

test('controlled pilot consolidation preserves restrictions and no-secret rules', () => {
  const evidence = readText(evidencePath)

  requireAll(evidence, [
    'Raw bearer tokens, Clerk cookies, passwords, provider subjects, full JWTs, database secrets, TC/national-id values, and private user data are not recorded.',
    'JSON/API source adapter remains future-only until real payload/source evidence exists.',
    'Direct Supabase client access to `ops.*` remains blocked until RLS/policy work is designed.',
    'Current master data is an accepted temporary pilot baseline, not the final HR/master-data source of truth.',
    'March 2026 Power BI import is historical pilot validation data, not proof of future monthly operation.',
    'Stop or pause the pilot if a low-role user can see global metric details outside allowed scope.',
  ])

  assert.doesNotMatch(evidence, /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/)
})

test('handoff and gate docs link the current consolidation evidence', () => {
  requireText(currentState, evidencePath)
  requireText(gate, evidencePath)
})
```

- [ ] **Step 2: Run the guard and verify it fails**

Run:

```powershell
node --test scripts\pilot-readiness-consolidation-contract.test.mjs
```

Expected:

- FAIL because `docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-conditional-go-consolidation.md` does not exist yet.

---

### Task 2: Create The Consolidated Evidence Note

**Files:**

- Create: `docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-conditional-go-consolidation.md`

- [ ] **Step 1: Create the evidence note**

Create `docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-conditional-go-consolidation.md` with this exact structure and content:

```md
# Controlled Pilot Conditional Go Consolidation

Date: 6 Mayis 2026

Environment:

- Frontend: `https://staging.hr-axis.com`
- API base: `https://api-staging.hr-axis.com/api`
- DB: Supabase staging Postgres
- Auth provider: Clerk
- Authorization boundary: backend API and app DB role/scope/action-store assignments

Final decision: `Conditional Go` for controlled staging/internal pilot.

Broad production rollout: `No-Go`.

This note does not replace the detailed evidence files. It maps the existing evidence into the Pilot Readiness Gate V1 decision areas so the controlled pilot decision can be reviewed from one place.

## Sensitive Material Policy

Raw bearer tokens, Clerk cookies, passwords, provider subjects, full JWTs, database secrets, TC/national-id values, and private user data are not recorded.

Test-mode emails may appear only when they are non-personal controlled staging pilot accounts.

## Gate Matrix

| Gate Area | Decision | Evidence | Accepted Limits |
| --- | --- | --- | --- |
| real staging IdP evidence | Conditional Go | `docs/evidence/pilot-readiness/2026-05-06-role-smoke.md`, `docs/evidence/pilot-readiness/2026-05-06-live-protected-api-smoke.md`, `docs/evidence/pilot-readiness/2026-05-05-pilot-readiness-decision.md` | Clerk test-mode pilot accounts are accepted for controlled staging smoke. Logout and expired-token evidence remain follow-up before broad rollout. |
| true store/personnel baseline evidence | Conditional Go | `docs/evidence/pilot-readiness/2026-05-06-master-data-power-bi-acceptance.md`, `docs/evidence/pilot-readiness/2026-05-05-staging-master-data-kpi-materialization.md` | Current master data is an accepted temporary pilot baseline, not the final HR/master-data source of truth. Known provisional/skipped personnel cleanup remains documented. |
| real KPI import smoke evidence | Go | `docs/evidence/pilot-readiness/2026-05-06-master-data-power-bi-acceptance.md`, `docs/evidence/pilot-readiness/2026-05-05-staging-master-data-kpi-materialization.md` | March 2026 Power BI import is historical pilot validation data, not proof of future monthly operation. JSON/API source adapter remains future-only until real payload/source evidence exists. |
| pilot user and scope evidence | Go | `docs/evidence/pilot-readiness/2026-05-06-role-smoke.md`, `docs/evidence/pilot-readiness/2026-05-06-ranking-privacy-smoke.md` | The four pilot personas are accepted for controlled staging validation. Real mailbox-backed onboarding is still required before inviting real store personnel users. |
| release and migration evidence | Conditional Go | `docs/evidence/pilot-readiness/2026-05-06-ranking-privacy-smoke.md`, `docs/evidence/pilot-readiness/2026-05-06-master-data-power-bi-acceptance.md`, `docs/evidence/pilot-readiness/2026-05-06-live-protected-api-smoke.md` | `check:pilot-stabilization` evidence exists in the 6 May notes. Fresh DB smoke is required as manual preflight only when DB schema or migration files change. |

## Consolidated Evidence Inputs

- `docs/evidence/pilot-readiness/2026-05-05-pilot-readiness-decision.md`
- `docs/evidence/pilot-readiness/2026-05-06-role-smoke.md`
- `docs/evidence/pilot-readiness/2026-05-06-ranking-privacy-smoke.md`
- `docs/evidence/pilot-readiness/2026-05-06-master-data-power-bi-acceptance.md`
- `docs/evidence/pilot-readiness/2026-05-06-live-protected-api-smoke.md`
- `docs/evidence/pilot-readiness/2026-05-05-staging-master-data-kpi-materialization.md`

## Accepted Pilot Restrictions

- Keep the pilot limited to explicitly created Clerk pilot users and approved stores/roles.
- Keep access through the backend API; Direct Supabase client access to `ops.*` remains blocked until RLS/policy work is designed.
- Treat current master data as an accepted temporary pilot baseline.
- Treat March 2026 Power BI import as historical validation evidence only.
- Keep JSON/API source adapter remains future-only until real payload/source evidence exists.
- Keep broad production rollout closed.
- Keep UI/design polish as later work unless a concrete pilot blocker appears.

## No-Go Triggers

Stop or pause the pilot if a low-role user can see global metric details outside allowed scope.

Stop or pause the pilot if a user can act on an unassigned store.

Stop or pause the pilot if Power BI import creates or silently maps unreviewed stores/personnel.

Stop or pause the pilot if March 2026 KPI actuals attach to demo stores.

Stop or pause the pilot if protected routes resume the visible login/refresh flash.

Stop or pause the pilot if raw bearer tokens, Clerk cookies, passwords, provider subjects, full JWTs, database secrets, TC/national-id values, or private user data appear in evidence.

Stop or pause the pilot if direct Supabase client access is introduced without RLS/policy work.

## Next Operational Checklist

- Confirm the exact pilot invitation list and role/scope for each user.
- Keep one admin and one low-role account available for support smoke after deploys.
- Monitor `/store`, `/store/me`, `/store/kpis`, `/store/approvals`, `/store/rankings`, `/admin/integrations`, `/admin/master-data`, and `/admin/targets`.
- Add logout and expired-token evidence before broad rollout.
- Repeat role/privacy smoke before inviting real mailbox-backed store personnel users.
- Do not start JSON/source-specific adapter work until real payload/source evidence exists.

## Outcome

Status: `Conditional Go` for controlled staging/internal pilot.

The controlled pilot can proceed for operational validation under the restrictions above. Broad production rollout remains blocked until remaining auth session edge evidence, real-user onboarding evidence, final data-source decisions, direct database access/RLS policy decisions, UI polish, and measured production-readiness checks are complete.
```

- [ ] **Step 2: Run the guard and verify the expected link failure remains**

Run:

```powershell
node --test scripts\pilot-readiness-consolidation-contract.test.mjs
```

Expected:

- FAIL because `current-state.md` and `docs/plans/pilot-readiness-gate-v1.md` do not yet link the consolidation evidence.

---

### Task 3: Link The Consolidation From Handoff And Gate Docs

**Files:**

- Modify: `current-state.md`
- Modify: `docs/plans/pilot-readiness-gate-v1.md`

- [ ] **Step 1: Update `current-state.md` recent evidence**

In `current-state.md`, under `## Recent Pilot Evidence`, add this line at the top of the evidence list:

```md
- `docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-conditional-go-consolidation.md`
```

- [ ] **Step 2: Update `current-state.md` product position**

In `current-state.md`, keep the pilot stance as `Conditional Go` and add this sentence under the current pilot stance bullets:

```md
- The current consolidated pilot decision note is `docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-conditional-go-consolidation.md`.
```

- [ ] **Step 3: Update `pilot-readiness-gate-v1.md` current evidence notes**

In `docs/plans/pilot-readiness-gate-v1.md`, under `## Current Evidence Notes`, add this bullet after the existing 1 May No-Go bullet:

```md
- `docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-conditional-go-consolidation.md` records the current `Conditional Go` consolidation for the controlled staging/internal pilot, with broad production rollout still `No-Go`.
```

- [ ] **Step 4: Run the guard and verify it passes**

Run:

```powershell
node --test scripts\pilot-readiness-consolidation-contract.test.mjs
```

Expected:

- PASS, 4 tests.

---

### Task 4: Verify The Pilot Stabilization Slice

**Files:**

- No additional file changes.

- [ ] **Step 1: Run pilot stabilization**

Run:

```powershell
npm.cmd run check:pilot-stabilization
```

Expected:

- PASS.
- Node pilot contract tests pass.
- Admin web pilot smoke passes.

- [ ] **Step 2: Run root script tests**

Run:

```powershell
npm.cmd run test:scripts
```

Expected:

- PASS, including the new `pilot-readiness-consolidation-contract.test.mjs`.

- [ ] **Step 3: Run whitespace check**

Run:

```powershell
git diff --check
```

Expected:

- PASS. Windows CRLF conversion warnings are acceptable if there are no whitespace errors.

---

### Task 5: Commit And Open PR

**Files:**

- `scripts/pilot-readiness-consolidation-contract.test.mjs`
- `docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-conditional-go-consolidation.md`
- `docs/plans/pilot-readiness-gate-v1.md`
- `current-state.md`

- [ ] **Step 1: Inspect the diff scope**

Run:

```powershell
git status --short
git diff --stat
git diff --name-only
```

Expected:

- Only the four files listed above changed.

- [ ] **Step 2: Stage explicit files**

Run:

```powershell
git add scripts/pilot-readiness-consolidation-contract.test.mjs docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-conditional-go-consolidation.md docs/plans/pilot-readiness-gate-v1.md current-state.md
```

- [ ] **Step 3: Commit**

Run:

```powershell
git commit -m "Consolidate pilot readiness evidence"
```

- [ ] **Step 4: Push and open draft PR**

Run:

```powershell
git push -u origin codex/pilot-readiness-evidence-consolidation-v1
```

Open a draft PR titled:

```text
Consolidate pilot readiness evidence
```

PR body:

```md
## Summary
- add a guarded controlled-pilot Conditional Go consolidation note
- map current staging evidence to the Pilot Readiness Gate V1 areas
- link the consolidation from current-state and the pilot gate

## Verification
- `node --test scripts\pilot-readiness-consolidation-contract.test.mjs`
- `npm.cmd run check:pilot-stabilization`
- `npm.cmd run test:scripts`
- `git diff --check`
```

## Self-Review Checklist

- [ ] No backend or frontend behavior changed.
- [ ] Broad production rollout remains `No-Go`.
- [ ] Controlled staging/internal pilot remains `Conditional Go`.
- [ ] JSON/API adapter work remains future-only.
- [ ] Direct Supabase client access remains blocked without RLS/policy work.
- [ ] Evidence contains no raw tokens, cookies, passwords, provider subjects, full JWTs, database secrets, TC/national-id values, or private user data.
- [ ] Existing detailed evidence files remain referenced instead of copied wholesale.
