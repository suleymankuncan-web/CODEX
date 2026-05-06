# Pilot Backlog And Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the post-stabilization product backlog into an ordered pilot execution queue with clear pre-live, post-live, and premium UI workstreams.

**Architecture:** Keep the pilot-critical path small: protect the current working admin/store surfaces, add evidence before behavior changes, and postpone UI polish until role/data contracts are stable. Each task should either reduce release risk, make operations repeatable, or improve product experience without weakening auth and data boundaries.

**Tech Stack:** React/Vite admin web, NestJS backend, PostgreSQL migrations, Playwright smoke tests, Node contract tests, Vercel frontend deploy, Render backend deploy.

---

## Current Health Scorecard

| Area | Before Stabilization | After Stabilization | Direction |
| --- | ---: | ---: | --- |
| Product idea / domain clarity | 8.0 | 8.2 | Slightly clearer store/ranking/approval boundaries |
| Backend core capability | 7.0 | 7.3 | Ranking demo/live boundary is now guarded |
| Auth and role architecture | 6.5 | 7.1 | Route matrix and smoke coverage reduced uncertainty |
| Frontend maintainability | 5.0 | 5.8 | Still uneven, but pilot routes now have guardrails |
| Test confidence | 5.5 | 7.0 | Biggest gain from contract + Playwright gate |
| Deploy confidence | 6.0 | 7.0 | Checklist and pilot stabilization gate exist |
| UI product quality | 4.0 | 4.0 | Not addressed yet |
| Technical debt level | 7.0 risk | 6.3 risk | Debt remains, but critical risk is boxed in |

## Priority Lanes

| Lane | Meaning | Rule |
| --- | --- | --- |
| P0 - Pre-Live Required | Must be true before a real pilot go-live decision | No new feature scope unless it closes a release risk |
| P1 - Post-Live Improvement | Can ship after first controlled pilot usage | Must preserve the pilot stabilization gate |
| P2 - Premium UI | Product quality and visual experience work | Starts after P0 smoke evidence is repeatable |

---

### Task 1: P0 Role Smoke Evidence

**Files:**
- Create: `docs/evidence/pilot-readiness/YYYY-MM-DD-role-smoke.md`
- Optional modify: `admin-web/e2e/pilot-smoke.spec.ts`
- Verify: `npm.cmd run check:pilot-stabilization`

- [x] **Step 1: Capture the exact pilot users**

Create an evidence note with these rows filled from Clerk/app users:

```md
# Pilot Role Smoke Evidence

| Persona | Email | Expected Roles | Expected Landing | Smoke Status |
| --- | --- | --- | --- | --- |
| Super admin | <email> | SUPER_ADMIN | /admin/integrations | pending |
| Region manager | <email> | REGION_MANAGER | /admin/targets | pending |
| Store manager | <email> | STORE_MANAGER | /store | pending |
| Store personnel | <email> | STORE_PERSONNEL | /store | pending |
```

- [x] **Step 2: Smoke each route with the matching persona**

Run manual browser smoke and record pass/fail for:

```text
/admin/integrations
/admin/master-data
/admin/targets
/admin/competitions
/admin/audit
/store
/store/me
/store/rankings
/store/approvals
```

- [x] **Step 3: Record failures as release blockers**

Add a blocker section to the evidence file:

```md
## Blockers

- [ ] None found.
```

If a blocker exists, replace `None found` with the exact route, persona, expected behavior, actual behavior, and screenshot filename.

- [x] **Step 4: Run the local pilot gate**

Run:

```powershell
npm.cmd run check:pilot-stabilization
```

Expected: contract tests pass, frontend builds, and `pilot-smoke.spec.ts` plus `pilot-api-contracts.spec.ts` pass.

- [x] **Step 5: Commit evidence**

```powershell
git add docs/evidence/pilot-readiness/YYYY-MM-DD-role-smoke.md
git commit -m "Document pilot role smoke evidence"
```

---

### Task 2: P0 Ranking Privacy Confirmation

**Files:**
- Create: `docs/evidence/pilot-readiness/YYYY-MM-DD-ranking-privacy-smoke.md`
- Reference: `docs/architecture/pilot-route-role-matrix.md`
- Verify: `npm.cmd --prefix backend/nestjs test -- ranking-access.policy.spec.ts --runInBand`

- [x] **Step 1: Confirm store-role visibility**

Record the store manager and store personnel observations:

```md
# Ranking Privacy Smoke

## Store Manager

- `/store/rankings` opens:
- Global list mode:
- Global details hidden:
- Own store personnel details visible:
- Demo rows absent:

## Store Personnel

- `/store/rankings` opens:
- Global list mode:
- Global details hidden:
- Own/self position visible:
- Demo rows absent:
```

- [x] **Step 2: Confirm privileged visibility**

Add admin/region observations:

```md
## Region Manager / Super Admin

- Full Turkey list visible:
- Region manager filter visible:
- Store filter visible:
- Personnel details visible:
- Demo rows absent:
```

- [x] **Step 3: Run backend policy test**

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- ranking-access.policy.spec.ts --runInBand
```

Expected: all ranking access policy tests pass.

- [x] **Step 4: Commit evidence**

```powershell
git add docs/evidence/pilot-readiness/YYYY-MM-DD-ranking-privacy-smoke.md
git commit -m "Document ranking privacy smoke evidence"
```

---

### Task 3: P0 Master Data And Power BI Acceptance Pass

**Files:**
- Create: `docs/evidence/pilot-readiness/YYYY-MM-DD-master-data-power-bi-acceptance.md`
- Reference: `docs/plans/master-data-bootstrap-pilot-smoke-runbook.md`
- Reference: `docs/plans/excel-kpi-import-operator-runbook.md`

- [x] **Step 1: Record accepted master data baseline**

Create:

```md
# Master Data And Power BI Acceptance

## Master Data Baseline

- Store baseline source:
- Personnel baseline source:
- Known manual cleanup left:
- Accepted for pilot: yes/no
```

- [x] **Step 2: Run Power BI upload with a known monthly file**

Record:

```md
## Power BI Upload

- Period:
- Personnel export:
- Store export:
- Upload result:
- Canonical KPI rows:
- Ignored rows:
- Needs review rows:
```

- [x] **Step 3: Verify user-facing data**

Check:

```text
/store/me
/store/rankings
/store/kpis
/admin/integrations
```

Expected: KPI values load without demo rows or unavailable states.

- [x] **Step 4: Commit evidence**

```powershell
git add docs/evidence/pilot-readiness/YYYY-MM-DD-master-data-power-bi-acceptance.md
git commit -m "Document master data and Power BI acceptance"
```

---

### Task 4: P0 Deploy Checklist As Standard Operating Procedure

**Files:**
- Modify: `docs/plans/pilot-release-smoke-checklist.md`
- Optional create: `docs/evidence/pilot-readiness/YYYY-MM-DD-deploy-smoke.md`
- Verify: `node --test scripts/pilot-release-smoke-checklist-contract.test.mjs`

- [x] **Step 1: Add exact deploy order**

Ensure the checklist includes:

```text
1. Merge PR into main.
2. Wait for Vercel frontend deploy.
3. Trigger or verify Render backend deploy when backend/migration/config changed.
4. Hard refresh browser.
5. Run admin and store smoke routes.
6. Record outcome.
```

- [x] **Step 2: Run checklist contract**

Run:

```powershell
node --test scripts/pilot-release-smoke-checklist-contract.test.mjs
```

Expected: all checklist contract tests pass.

- [x] **Step 3: Commit checklist update**

```powershell
git add docs/plans/pilot-release-smoke-checklist.md
git commit -m "Clarify pilot deploy smoke procedure"
```

---

### Task 5: P1 Auth Refresh Flash Reduction

**Files:**
- Modify only after failing test: `admin-web/src/App.tsx`
- Modify only after failing test: `admin-web/src/features/session/session-context.tsx`
- Test: `admin-web/e2e/store-return-to.spec.ts`
- Test: `admin-web/e2e/pilot-smoke.spec.ts`

- [ ] **Step 1: Write a failing refresh behavior test**

Add a test that reloads `/admin/integrations` and asserts the app does not visibly settle on `/auth/login` before returning.

- [ ] **Step 2: Run the targeted test**

Run:

```powershell
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-return-to.spec.ts pilot-smoke.spec.ts
```

Expected before fix: fail only if the refresh flash is still observable under test conditions.

- [ ] **Step 3: Implement the smallest session hydration change**

Keep the current return path logic. Only change session loading behavior if the failing test proves the auth route is rendered as a visible intermediate state.

- [ ] **Step 4: Verify**

Run:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-return-to.spec.ts pilot-smoke.spec.ts
```

- [ ] **Step 5: Commit**

```powershell
git add admin-web/src/App.tsx admin-web/src/features/session/session-context.tsx admin-web/e2e/store-return-to.spec.ts admin-web/e2e/pilot-smoke.spec.ts
git commit -m "Reduce auth refresh route flash"
```

---

### Task 6: P1 JSON Ingestion Contract Design

**Files:**
- Create: `docs/plans/json-ingestion-contract-v1.md`
- Create: `scripts/json-ingestion-contract-doc.test.mjs`
- Reference: `docs/plans/source-agnostic-ingest-contract-hardening-v1.md`

- [ ] **Step 1: Document the future JSON call shape**

Create the doc with sections:

```md
# JSON Ingestion Contract V1

## Goals

- Accept store and personnel KPI rows without Excel.
- Preserve source idempotency.
- Keep external names and codes traceable.

## Endpoint Draft

POST /api/integrations/kpi-json-import

## Required Envelope

- sourceCode
- periodType
- periodStart
- periodEnd
- idempotencyKey
- rows

## Matching Policy

- Store/personnel name matching remains reviewable.
- Code-based matching wins when present.
- Ambiguous rows go to review.
```

- [ ] **Step 2: Add a documentation contract**

Create a Node test that checks the document includes `idempotencyKey`, `Ambiguous rows go to review`, and `Code-based matching wins when present`.

- [ ] **Step 3: Verify**

Run:

```powershell
node --test scripts/json-ingestion-contract-doc.test.mjs
```

- [ ] **Step 4: Commit**

```powershell
git add docs/plans/json-ingestion-contract-v1.md scripts/json-ingestion-contract-doc.test.mjs
git commit -m "Document JSON ingestion contract"
```

---

### Task 7: P1 Deploy Smoke Automation

**Files:**
- Create: `admin-web/scripts/pilot-live-smoke.mjs`
- Create: `admin-web/scripts/pilot-live-smoke.test.mjs`
- Modify: `admin-web/package.json`
- Modify: `docs/plans/pilot-release-smoke-checklist.md`
- Optional modify: `.github/workflows/frontend-release-check.yml`

- [x] **Step 1: Create script skeleton**

Create a script that accepts:

```text
--base-url=https://staging.hr-axis.com
--routes=/admin/integrations,/admin/master-data,/admin/targets,/store,/store/me,/store/rankings,/store/approvals
```

- [x] **Step 2: Add package script**

Add:

```json
"smoke:pilot:live": "node scripts/pilot-live-smoke.mjs"
```

- [x] **Step 3: Verify local harness and staging guard**

Run:

```powershell
node --test admin-web\scripts\pilot-live-smoke.test.mjs
$env:PILOT_SMOKE_BASE_URL = "https://staging.hr-axis.com"
$env:PILOT_SMOKE_BEARER_TOKEN = "<fresh-redacted-clerk-jwt>"
npm.cmd --prefix admin-web run smoke:pilot:live -- --staging
```

Expected: the local harness proves route walking, token injection, and token redaction. Staging smoke requires a fresh Clerk JWT and every route must return a successful page without an unavailable marker.

- [x] **Step 4: Commit**

```powershell
git add admin-web/scripts/pilot-live-smoke.mjs admin-web/scripts/pilot-live-smoke.test.mjs admin-web/package.json docs/plans/pilot-release-smoke-checklist.md
git commit -m "Add pilot live smoke script"
```

---

### Task 8: P2 Premium Store UI Redesign

**Files:**
- Create: `docs/plans/premium-store-ui-v1.md`
- Later modify: `admin-web/src/pages/StoreMyPerformancePage.tsx`
- Later modify: `admin-web/src/pages/StoreRankingsPage.tsx`
- Later modify: `admin-web/src/pages/StoreShellPreviewPage.tsx`
- Later modify: `admin-web/src/index.css`
- Test: `admin-web/e2e/store-surfaces.spec.ts`
- Test: `admin-web/e2e/pilot-smoke.spec.ts`

- [ ] **Step 1: Lock UI scope before code**

Document:

```md
# Premium Store UI V1

## First Screens

1. /store/me
2. /store/rankings
3. /store

## Non-goals

- No auth changes.
- No ranking permission changes.
- No data model changes.
- No admin redesign in this pass.
```

- [ ] **Step 2: Create static preview before app implementation**

Use `outputs/` for a preview artifact and review it manually before touching React pages.

- [ ] **Step 3: Add visual/route smoke expectations**

Update Playwright only for stable text and route outcomes. Do not assert brittle pixel-perfect layout.

- [ ] **Step 4: Implement one page at a time**

Start with `/store/me`, then `/store/rankings`, then `/store`.

- [ ] **Step 5: Verify**

Run:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts pilot-smoke.spec.ts
```

- [ ] **Step 6: Commit**

```powershell
git add docs/plans/premium-store-ui-v1.md admin-web/src/pages/StoreMyPerformancePage.tsx admin-web/src/pages/StoreRankingsPage.tsx admin-web/src/pages/StoreShellPreviewPage.tsx admin-web/src/index.css admin-web/e2e/store-surfaces.spec.ts admin-web/e2e/pilot-smoke.spec.ts
git commit -m "Redesign premium store pilot surfaces"
```

---

## Execution Order

1. Task 1 - P0 Role Smoke Evidence
2. Task 2 - P0 Ranking Privacy Confirmation
3. Task 3 - P0 Master Data And Power BI Acceptance Pass
4. Task 4 - P0 Deploy Checklist As Standard Operating Procedure
5. Controlled pilot go/no-go decision
6. Task 5 - P1 Auth Refresh Flash Reduction
7. Task 6 - P1 JSON Ingestion Contract Design
8. Task 7 - P1 Deploy Smoke Automation
9. Task 8 - P2 Premium Store UI Redesign

## Stop Conditions

- A P0 route returns an unavailable state.
- Store roles can see unauthorized global ranking detail.
- Demo rows appear in live ranking surfaces.
- Power BI upload cannot produce KPI rows from the accepted monthly files.
- `npm.cmd run check:pilot-stabilization` fails on `main`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-06-pilot-backlog-and-readiness.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - execute tasks in this session using executing-plans, batch execution with checkpoints.
