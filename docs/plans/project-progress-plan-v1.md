# Project Progress Plan V1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define the next durable project path after the OpenAPI, approvals, and checklist refactor lines, with missing pieces, execution order, verification gates, and stop rules.

**Architecture:** Keep the current Vite + React frontend, NestJS backend, PostgreSQL/Supabase database boundary, Clerk auth boundary, generated OpenAPI client path, and guarded release flow. The plan prioritizes visible pilot value, live evidence, and targeted debt reduction over broad rewrites or speculative architecture changes.

**Tech Stack:** Vite, React, TypeScript, Playwright, NestJS, PostgreSQL/Supabase, Clerk, Vercel, Render, GitHub Actions, OpenAPI generated clients.

---

## Sokrates Decision

Decision: continue the existing project with a controlled progress plan.

Why now:

- The API contract drift line is complete through PR #311.
- Store approvals structural follow-up is complete enough for now through PR #319.
- Store checklists structural follow-up is complete enough for now through PR #324.
- The next value is no longer another broad invisible foundation line. It is controlled pilot usefulness, product clarity, live evidence, and only targeted debt work.

Evidence:

- Repo evidence: `current-state.md`, `sokrates.md`, `docs/plans/project-debt-ledger.md`, `docs/plans/feature-backlog.md`, and `docs/superpowers/plans/2026-05-18-readiness-progress.md`.
- Test evidence: recent PR lines used lint/build/Playwright/GitHub/Vercel/Codex checks before merge.
- Runtime evidence: deployed readiness smoke passed against staging without auth bearer evidence; auth/session remains skipped without a real token.
- User preference: no rewrite, no rushed broad refactor, small slices, PRs only when meaningful, autonomous merge after checks and Codex approval.

Counterargument:

- A broad redesign or rewrite may feel cleaner, but it would throw away already guarded auth, import, ranking, checklist, approvals, release, and generated API contract work. The project is not blocked by architecture collapse; it is blocked by product polish, live evidence, and selective future investment.

Risk:

- MEDIUM overall. Most planned slices are two-way doors, but live evidence, auth, DB, and provider configuration remain HIGH risk and must be handled separately.

Door:

- The plan itself is a two-way-door document.
- Live provider configuration, DB restore drills, auth/session proof, and broad production rollout decisions are near-one-way-door and require stronger evidence.

Final direction:

- Do not rewrite.
- Do not open JSON/source-adapter work while Power BI/Excel remains the operating source.
- Pause mechanical refactor lines unless a concrete bug, product change, or readability blocker appears.
- Start with visible-flow/product-readiness inspection, then implement the smallest user-visible or risk-reducing slice.

## Current Baseline

Already strong:

- Auth, role, scope, action-store, and fail-closed guardrails exist.
- Backend and frontend are separated correctly.
- API contract drift has been reduced with OpenAPI and generated frontend types/clients.
- Store approvals and checklists have real workflows and targeted E2E coverage.
- Release checks, Vercel checks, GitHub checks, and Codex review are part of the merge rhythm.
- Readiness guardrails exist for deployments, security headers, observability, rate limit, queue durability, backup/restore, upload guardrails, Supabase boundary, env drift, and final readiness decisions.

Still not done:

- Broad production is still `No-Go`.
- Controlled/internal pilot remains `Conditional Go`.
- Real staging auth/session evidence still needs a real bearer token and provider state.
- Supabase managed restore evidence still needs an approved disposable restore target.
- Real alert delivery evidence still needs an approved provider destination.
- Redis/BullMQ broad-production posture still needs real provider configuration and health evidence.
- Product feel is still weaker than the backend foundation.

## Missing Pieces

### 1. Live External Evidence

Status: blocked by provider access or real staging inputs.

Missing:

- Real Clerk/staging bearer-token proof for `/api/auth/session`.
- Assigned-store `201` and unassigned-store `403` action smoke proof in staging.
- Supabase staging restore drill into an approved disposable target.
- Real alert/error tracking/log-retention destination proof.
- Redis/BullMQ broad-production configuration and health evidence.
- Authenticated upload smoke using a real integration-admin session and sample file.

Rule:

- Do not claim these from local code.
- If inputs are unavailable, record the blocker and work on local-only product slices.

### 2. Visible Product Feel

Status: open and high-value.

Missing:

- A current visible-flow audit after recent refactors.
- Store home first-screen clarity and daily action hierarchy review.
- Store rankings official/preview/no-data clarity review on real-like states.
- Store checklist result/ack/history clarity review after structural splits.
- Store approvals action/error/returned-state clarity review after structural splits.
- Admin master-data/integrations/checklists/targets operational consistency review.

Rule:

- Improve screens users actually touch.
- Do not redesign the whole app in one pass.
- Every product-feel PR must preserve API/auth/DB/business behavior unless the behavior change is explicitly scoped.

### 3. Pilot Operating Loop

Status: controlled pilot exists, but the operating loop must stay alive.

Missing:

- Fresh session entries in the controlled pilot feedback log when real sessions happen.
- `check:pilot-stabilization` before new invite waves or deploys that affect pilot routes.
- Clear pause/resume decisions when route blockers or auth/provider issues appear.
- Sanitized evidence only; no raw tokens, cookies, JWTs, or provider screenshots with secrets.

Rule:

- Do not widen pilot roles or invite scope without explicit user direction and assignment data.

### 4. Strategic Refactor And Developer Experience Debt

Status: not urgent, but known.

Current large non-generated files on `origin/main`:

- `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts` - 1973 lines.
- `backend/nestjs/src/modules/integration/infrastructure/integration.repository.ts` - 1909 lines.
- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts` - 1839 lines.
- `backend/nestjs/src/modules/auth/auth-admin.repository.ts` - 1715 lines.
- `admin-web/src/features/competitions/StageBuilderForm.tsx` - 1711 lines.
- `backend/nestjs/src/modules/store-ops/application/reporting.service.ts` - 1686 lines.
- `admin-web/src/pages/MasterDataBootstrapPage.tsx` - 1657 lines.
- `backend/nestjs/src/modules/store-ops/infrastructure/workforce-request.repository.ts` - 1612 lines.
- `admin-web/src/pages/IntegrationDashboardPage.tsx` - 1350 lines.
- `admin-web/src/pages/StoreKpiHighlightsPage.tsx` - 1347 lines.
- `admin-web/src/pages/StoreRankingsPage.tsx` - 1328 lines.
- `admin-web/src/pages/ImportBatchDetailPage.tsx` - 1319 lines.
- `admin-web/src/pages/AdminKpiConfigPage.tsx` - 1309 lines.

Generated or tooling-large files not counted as urgent debt:

- `backend/nestjs/src/openapi/generate-openapi.ts`.
- `admin-web/src/generated/openapi-types.ts`.
- OpenAPI baseline contract specs.

Rule:

- Refactor only when the file is touched by a concrete product/risk slice or when a clear boundary can be extracted without behavior changes.
- Do not restart the mechanical refactor train just because a file is over a line-count threshold.

### 5. Product Expansion Backlog

Status: parked until shaped.

Candidates:

- Incentive / Prim module.
- KPI expansion pack.
- Admin Dashboard Phase 1.
- Mobile/BFF next aggregate only after a real mobile screen contract.
- Future JSON/source adapter only after real JSON-format files, official fields, delivery/cadence/auth model, and identity semantics exist.

Rule:

- New product modules must start with intake/spec, not direct schema/API/UI work.

## Roadmap

### Phase 1: Product Readiness Audit And First Visible Slice

Goal:

- Pick the next user-visible improvement from evidence instead of taste.

Scope:

- Store home.
- Store rankings.
- Store checklists.
- Store approvals.
- Admin master-data.
- Admin integrations.
- Admin checklists.
- Admin targets.

Tasks:

- [ ] Create `docs/evidence/product-progress/2026-05-20-visible-flow-audit-v1.md`.
- [ ] For each route, record first-screen purpose, primary action, loading state, empty state, error state, mobile risk, and trust/copy risk.
- [ ] Run or inspect only the relevant existing E2E route coverage before choosing a PR.
- [ ] Choose one first PR using this order: user value, risk reduction, blocker removal, blast radius, verification clarity.
- [ ] Implement one small visible slice.
- [ ] Verify with admin lint/build and targeted Playwright for that route.

Recommended first PR after this plan:

- A visible-flow audit document plus one small follow-up PR, not another large refactor.

Stop rules:

- Stop if the audit reveals an auth/API/DB behavior dependency.
- Stop if the chosen fix becomes a cross-route redesign.
- Stop if the route cannot be verified with an existing or small targeted Playwright path.

### Phase 2: Controlled Pilot Evidence Closure

Goal:

- Convert parked readiness items into real evidence when external inputs exist.

Tasks:

- [ ] If a real staging bearer token exists, run deployed readiness smoke with `READINESS_BEARER_TOKEN`.
- [ ] If seeded assigned/unassigned store data exists, run staging action smoke for positive `201` and negative `403`.
- [ ] If an approved Supabase disposable restore target exists, execute the staging restore drill and record sanitized evidence.
- [ ] If alert provider destination exists, run alert routing smoke and record sanitized evidence.
- [ ] If Redis/BullMQ provider config exists, verify `/api/health` reports durable queue and Redis ok.
- [ ] If an integration-admin session and sample upload file exist, run authenticated upload smoke.

Verification commands:

```powershell
npm.cmd run smoke:deployed-readiness
npm.cmd run smoke:alert-routing
npm.cmd run check:pilot-stabilization
```

Stop rules:

- Stop if a command needs a secret that is not already provided securely.
- Stop if evidence would require raw token/cookie/JWT capture.
- Stop if a restore target is not explicitly disposable and approved.

### Phase 3: Operator Surface Coherence

Goal:

- Make admin/operator screens feel like one system without creating new backend contracts first.

Candidate slices:

- Admin integrations: import state, retry/evidence, and decision language consistency.
- Admin master-data: staging, validation, dry-run, promotion readiness, and block reasons.
- Admin checklists: template lifecycle clarity and result evidence.
- Admin targets: coverage readiness, conflict/stale/missing state clarity.

Tasks:

- [ ] Inventory the current admin surfaces against existing E2E coverage.
- [ ] Pick one surface with the clearest operator confusion.
- [ ] Improve information hierarchy or state explanation without changing backend contracts.
- [ ] Verify with admin build and targeted admin Playwright spec.

Stop rules:

- Stop if a fix requires new workflow states, new permissions, or new database fields.
- Stop if the screen needs a backend contract that does not already exist.

### Phase 4: Targeted Strategic Refactor

Goal:

- Reduce developer friction only where it unlocks real work.

Candidate order:

1. `StageBuilderForm.tsx` when a competition UI change is needed.
2. `MasterDataBootstrapPage.tsx` when a master-data operator slice is needed.
3. `IntegrationDashboardPage.tsx` or `ImportBatchDetailPage.tsx` when import evidence UI changes are needed.
4. `ReportingRepository` only when reporting/ranking behavior or measured slow-query evidence appears.
5. `IntegrationRepository` only when import/source behavior or real volume evidence appears.
6. `AuthAdminRepository` only before broad user rollout or concrete auth-admin behavior changes.

Tasks:

- [ ] Before any refactor PR, write a fresh boundary inventory in the PR body or a small plan note.
- [ ] Extract pure types/constants/utils first when useful.
- [ ] Extract render-only components before hooks/state.
- [ ] Split read/write/domain backend boundaries only when tests already cover the behavior.
- [ ] Run targeted tests plus the broader gate justified by blast radius.

Stop rules:

- Stop if a refactor changes behavior to make the extraction easier.
- Stop if the PR cannot be explained as one coherent review unit.
- Stop if tests are missing for the behavior being moved.

### Phase 5: Product Expansion Intake

Goal:

- Add new modules only after the active pilot/product gaps are not being ignored.

Candidate intake order:

1. Admin Dashboard Phase 1, if operators need one command overview.
2. Incentive / Prim module, if payout workflow scope is clarified.
3. KPI Expansion Pack, if new KPI definitions or scoring rules are provided.
4. Mobile/BFF aggregate, if a real mobile screen contract exists.
5. Future source adapter, only after real source evidence exists.

Tasks:

- [ ] Add or update an entry in `docs/plans/feature-backlog.md`.
- [ ] Create a mini spec from `docs/plans/new-module-template.md`.
- [ ] Define owner, personas, data impact, API impact, UI impact, and verification before code.
- [ ] Reject schema/API/UI implementation until the scope is shaped.

Stop rules:

- Stop if the feature is only a title without workflow details.
- Stop if it depends on guessed external data.
- Stop if it would duplicate existing KPI/import/ranking/checklist logic.

## PR And Verification Rules

Default PR shape:

- One user-visible improvement.
- One risk reduction.
- One focused refactor boundary.
- One evidence artifact.

Batch PRs are allowed only when:

- Slices share the same domain.
- Slices share the same risk class.
- Slices share the same verification family.
- Rollback is one clean squash revert.
- The PR can be explained in one paragraph.

Local verification ladder:

1. Diff inspection.
2. `git diff --check`.
3. Relevant type/codegen checks if API contracts are touched.
4. Targeted unit/contract tests.
5. `npm.cmd --prefix admin-web run lint` or backend lint as relevant.
6. `npm.cmd --prefix admin-web run build` or backend build as relevant.
7. Targeted Playwright.
8. Full release gate when blast radius warrants it.
9. GitHub/Vercel checks after PR.
10. Codex no-major-issue comment or clear approval reaction before merge.

## Decision Matrix For Next Work

Pick external readiness evidence when:

- The user provides token/provider/restore/Redis/upload inputs.
- The work can be proven without raw secrets.

Pick visible product polish when:

- No external inputs are available.
- The slice touches a high-use route.
- Existing E2E can verify the route.

Pick refactor when:

- A concrete product/risk slice touches the large file anyway.
- The extraction is behavior-preserving.
- Tests cover the moved boundary.

Pick feature intake when:

- The user wants a new business capability.
- Owner, workflow, data impact, and verification can be stated before code.

Park the work when:

- It depends on guessed source data.
- It requires live provider access we do not have.
- It changes auth/API/DB behavior without explicit alignment.
- It is broad redesign/refactor without a concrete user or risk payoff.

## Current Recommendation

Next action:

- Start Phase 1 with a visible-flow audit and choose the first small product-readiness PR from that audit.

Why:

- External readiness is parked until real inputs exist.
- Recent refactor lines have reduced the biggest immediate frontend file pressure.
- Product polish is the highest-value local work that does not depend on providers.

Expected first output:

- `docs/evidence/product-progress/2026-05-20-visible-flow-audit-v1.md`.
- One small PR against the highest-value route found by that audit.

## Self-Review

Spec coverage:

- Missing parts are listed across live evidence, product feel, pilot operation, strategic refactor debt, and product expansion.
- The plan names what not to do: rewrite, JSON adapter, broad refactor, broad redesign, unshaped new modules.
- Each phase includes tasks, verification, and stop rules.

Placeholder scan:

- No implementation placeholders are required because this is a roadmap/control plan, not a code-level feature spec.
- Provider-dependent work is explicitly blocked by named external inputs.

Type consistency:

- The plan uses the same readiness, pilot, OpenAPI, auth, and refactor language as `current-state.md` and `sokrates.md`.
