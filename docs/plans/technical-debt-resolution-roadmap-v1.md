# Technical Debt Resolution Roadmap V1

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the latest objective technical assessment into an executable
roadmap that keeps the existing project, resolves concentrated debt, and avoids
rewrite or broad architecture churn.

**Architecture:** Preserve the current Vite + React frontend, NestJS modular
backend, PostgreSQL/Supabase database boundary, Clerk auth boundary, generated
OpenAPI client path, and guarded release flow. Fixes must be small, reversible,
and evidence-driven: product polish when it improves real user workflows,
refactor when it reduces a known hotspot, and live evidence only when real
provider inputs exist.

**Tech Stack:** Vite, React, TypeScript, Playwright, NestJS, PostgreSQL,
Supabase, Clerk, OpenAPI generated clients, Vercel, Render, GitHub Actions.

---

## Reader And Action

Reader:

- A future engineer or agent continuing the Store Ops project after the
  technical assessment.

After reading, they should be able to:

- choose the next safe PR or batch PR,
- know which problems are local-code work and which are external evidence
  blockers,
- avoid rewrite/broad redesign,
- run the correct verification ladder for each class of work.

## Decision

Decision: **KISMI REFACTOR**.

Do not rewrite. Do not continue as if there is no debt. The architecture is
recoverable and already guarded, but several debt clusters need controlled,
evidence-backed cleanup.

Why this is not `DEVAM ET`:

- There are still large backend repositories/services and large frontend
  surfaces that increase review, onboarding, and regression cost.
- Broad production remains blocked by live evidence, not by local code alone.
- Some frontend TypeScript and UX consistency work is still incremental.

Why this is not `KRITIK REFACTOR`:

- Backend/frontend separation is sound.
- Auth, DB, API contracts, release gates, and E2E coverage are real.
- OpenAPI generated clients and previous structural splits already reduced
  systemic drift.

Why this is not `SIFIRDAN YAZ`:

- Rewrite would throw away guarded auth/scope, import, ranking, checklist,
  approvals, migration, release, and OpenAPI work.
- The remaining problems are concentrated and can be solved incrementally.

## Evidence Summary

Repo evidence:

- `origin/main` is past the API contract drift line and the approvals/checklist
  structural split lines.
- `admin-web/src/index.css` is now only an import/entry-level file.
- Store approvals and store checklists have been reduced below the earlier
  danger zone.
- OpenAPI generated frontend client/types cover the main API domains.
- Reporting repository boundary refactor is complete through PR #343.
- Integration repository safe read-boundary refactor is complete through
  PR #349. `IntegrationRepository` is now mostly command/write persistence
  and should not be split further without a concrete product/risk trigger.

Measured hotspots:

- Backend repositories/services still above the comfortable review band:
  - competition repository,
  - auth admin repository,
  - reporting service,
  - workforce request repository.
- Reporting repository has completed its first boundary-refactor pass through
  PR #343 and is no longer the next hotspot unless a concrete identity/personnel
  reporting risk appears.
- Auth admin repository has completed its first safe read-boundary pass through
  PR #353. Lookup/catalog reads and audit reads are split out; the remaining
  auth admin repository work is write-heavy and should not continue without a
  tighter invariant/test decision.
- Frontend surfaces still above the comfortable review band:
  - competition stage builder,
  - master-data bootstrap,
  - integration dashboard,
  - import batch detail,
  - store KPI/ranking/admin KPI pages.

Runtime evidence still missing:

- real staging auth/session proof with a bearer token,
- assigned-store positive action smoke and unassigned-store negative action
  smoke,
- authenticated integration-admin upload smoke,
- Supabase restore drill into an approved disposable target,
- alert/error-tracking destination proof,
- Redis/BullMQ broad-production health proof.

## Operating Guardrails

These rules apply to every phase:

- Preserve business logic unless the phase explicitly scopes behavior change.
- Preserve API response shape unless the phase explicitly scopes contract
  change.
- Preserve auth, permission, and action-store semantics.
- Do not add DB migrations unless the phase explicitly scopes DB work.
- Do not change CSS/user-facing behavior in structural refactor PRs.
- Do not batch unrelated domains.
- Stop if the PR cannot be explained in one paragraph.
- Stop if rollback is not a normal squash-revert.
- Every PR must have one clear review story.

## Work Categories

### Category A: Local And Immediately Actionable

These can proceed without provider secrets:

- backend repository boundary inventories,
- pure backend read/write/domain extraction,
- frontend page/component/hook/model extraction,
- targeted UI/UX V1 gaps with browser/Playwright evidence,
- generated API client drift gates,
- TypeScript strictness inventory,
- performance baseline scripts or local query profiling on disposable data.

### Category B: Local Preparation Only

These can be prepared locally but not claimed complete:

- runbooks for staging auth smoke,
- runbooks for restore drill,
- Redis/BullMQ configuration checklist,
- alert routing checklist,
- upload smoke checklist,
- placeholder-free evidence templates.

### Category C: External Evidence Blocked

These must not be marked done without real input:

- real staging bearer tokens,
- provider dashboard configuration,
- approved disposable Supabase restore target,
- real Redis/queue provider configuration,
- real alert destination,
- authenticated upload session and safe sample file.

## Roadmap

### Phase 0: Baseline And Scope Lock

Goal:

- Freeze the current decision and avoid accidental rewrite or broad refactor.

Tasks:

- [x] Record the technical assessment decision as `KISMI REFACTOR`.
- [x] Separate local debt from external evidence blockers.
- [x] Confirm that `index.css` is no longer the next debt target.
- [ ] Before each new PR line, run a fresh hotspot inventory from `origin/main`.
- [ ] Before each new PR line, choose one category: product polish, refactor,
  external evidence, or intake.

Verification:

- For docs-only updates: `git diff --check`.
- For later implementation: use the phase-specific ladder below.

Stop rules:

- Stop if the next proposed work mixes product UI, backend behavior, auth, DB,
  and refactor in one PR.

### Phase 1: External Evidence Closure

Goal:

- Move controlled pilot and broad-production readiness from documented
  blocker to real evidence when inputs exist.

Work order:

1. Staging auth/session and protected route proof.
2. Assigned-store `201` and unassigned-store `403` action proof.
3. Authenticated integration-admin upload proof.
4. Supabase restore drill into an approved disposable target.
5. Alert/error-tracking destination proof.
6. Redis/BullMQ production-mode health proof.

Implementation steps:

- [ ] Check whether the required secure inputs are present.
- [ ] If inputs are absent, update only the evidence blocker note; do not
  fake runtime evidence.
- [ ] If a staging bearer token exists, run deployed readiness smoke with
  `READINESS_BEARER_TOKEN`.
- [ ] If assigned/unassigned staging store data exists, run the action smoke
  path and record positive/negative proof.
- [ ] If an approved restore target exists, run the restore drill from the
  existing runbook and record sanitized evidence.
- [ ] If Redis/BullMQ provider config exists, verify backend health reports
  durable queue and Redis OK.

Verification:

```powershell
npm.cmd run smoke:deployed-readiness
npm.cmd run smoke:alert-routing
npm.cmd run check:pilot-stabilization
```

PR shape:

- One external evidence PR per evidence family.
- Docs/evidence plus any tiny script/runbook fix required to make the proof
  repeatable.

Stop rules:

- Stop if raw tokens, cookies, JWTs, database credentials, or provider secrets
  would enter docs, screenshots, logs, or PR text.
- Stop if a restore target is not explicitly disposable and approved.
- Stop if the result depends on provider state that cannot be verified.

### Phase 2: Backend Repository Boundary Refactor

Goal:

- Reduce the highest developer-experience and regression-risk hotspots without
  changing behavior.

Priority:

1. Auth admin repository, inventory/test-map first because it is
   security-sensitive.
2. Competition repository.
3. Reporting service.
4. Workforce request repository.
5. Integration repository remaining command/write persistence, only with a
   concrete product/risk trigger.
6. Reporting repository remaining identity/personnel live reads, only if a
   concrete risk or product change requires it.

#### 2.1 Reporting Repository

Why:

- It owns multiple read families: snapshot reports, KPI performance, store
  score, closed leaderboard, ranking identity helpers, and benchmark reads.

Safe first slice:

- Boundary inventory plus tests map. No production code movement.
- Current inventory:
  `docs/plans/reporting-repository-boundary-inventory-v1.md`.

Current status:

- First pass completed through PR #338 through PR #343.
- Extracted boundaries include store score reads, closed ranking reads,
  snapshot reads, store performance reads, and ranking reads.
- `ReportingRepository` is now roughly 503 physical lines and mostly holds
  identity/personnel live performance helper reads.
- Park this line unless a concrete identity/personnel reporting risk appears.

Candidate extraction order:

1. Closed leaderboard read boundary.
2. Store score breakdown read boundary.
3. KPI report read boundary.
4. Workforce/checklist/turnover report read boundary.
5. Identity lookup helper boundary.

Verification:

```powershell
npm.cmd --prefix backend/nestjs test -- reporting.service.store-score-blend.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- reporting.service.live-leaderboard.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- reporting.service.kpi-benchmark-scoring.spec.ts --runInBand
npm.cmd --prefix backend/nestjs run build
```

Broader gate when a query family moves:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand
```

Stop rules:

- Stop if query output shape changes.
- Stop if scope filters move without a regression test.
- Stop if an index/migration becomes necessary; split that into a separate DB
  evidence decision.

#### 2.2 Integration Repository

Why:

- It mixes import batch lifecycle, raw writes, mapping evidence, retry/action
  queues, store import scope, audit evidence, and source governance.

Safe first slice:

- Inventory existing method families and tests. No production code movement.
- Current inventory:
  `docs/plans/integration-repository-boundary-inventory-v1.md`.

Current status:

- First safe read-boundary pass completed through PR #344 through PR #349.
- Extracted boundaries include import batch list/summary/detail/evidence reads,
  external ID mapping candidate/scoped-target reads, KPI import store-scope
  reads, and personnel master list/lookup reads.
- `IntegrationRepository` is now roughly 711 physical lines / 674 non-empty
  lines and mostly holds command/write flows: import batch creation/raw
  staging, store/personnel master updates, retry/status writes, and external
  mapping approval audit.
- Park this line unless a concrete import lifecycle, retry queue, raw staging,
  or approval-audit risk appears.

Candidate extraction order:

1. Done: import batch read/evidence query boundary.
2. Done: external ID mapping evidence boundary.
3. Done: KPI import store-scope read boundary.
4. Done: personnel master read boundary.
5. Parked/high-risk: raw import writer boundary.
6. Parked/high-risk: retry/action queue write boundary.
7. Source governance boundary, only when source behavior changes.

Verification:

```powershell
npm.cmd --prefix backend/nestjs test -- import-batch.e2e-spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- import-batch-evidence.e2e-spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- integration-sources.e2e-spec.ts --runInBand
npm.cmd --prefix backend/nestjs run build
```

Stop rules:

- Stop if import status transitions change.
- Stop if idempotency behavior changes.
- Stop if raw import table indexes are proposed without measured volume or
  slow-query evidence.

#### 2.3 Auth Admin Repository

Why:

- It is security-sensitive and large. The blast radius is higher than normal
  repository cleanup.

Safe first slice:

- Read-only inventory: list read, write, audit, lookup, and permission method
  families; map each to existing regression tests.
- Current inventory:
  `docs/plans/auth-admin-repository-boundary-inventory-v1.md`.

Current status:

- Inventory/test-map was prepared in PR #351.
- PR #352 split lookup/catalog read methods into
  `AuthAdminLookupRepository`.
- PR #353 split role assignment, action-store assignment, and user account
  audit reads into `AuthAdminAuditRepository`.
- `AuthAdminRepository` is now roughly 1449 physical lines / 1361 non-empty
  lines and mostly owns command/write flows: role assignment persistence,
  action-store assignment persistence, user account create/reactivate, pilot
  binding, and role permission mutation.
- Auth admin remains security-sensitive. The next auth admin step is no longer
  a simple read split; it needs an explicit invariant/test decision before any
  write boundary moves.
- The user-account boundary decision is recorded at
  `docs/plans/auth-admin-user-account-boundary-decision-v1.md`. It allows only
  a narrow read-only `listUserAccounts` / `getUserAccountById` extraction as
  the next safe code slice. User create/reactivate, provider-subject lookup,
  active employee/store validation, and pilot binding stay parked until the
  invariant and negative-test strategy are stronger.
- The narrow user-account read-only extraction has been implemented:
  `listUserAccounts` and `getUserAccountById` now live in
  `AuthAdminUserAccountReadRepository`. `AuthAdminRepository` is roughly 1356
  physical lines / 1278 non-empty lines after this slice.

Candidate extraction order:

1. Done: lookup/read-only catalog boundary.
2. Done: audit read boundary.
3. Done: user account read-only boundary for list/detail queries, following
   `docs/plans/auth-admin-user-account-boundary-decision-v1.md`.
4. Parked/high-risk: user account create/reactivate write boundary.
5. Later/high-risk: role assignment write boundary.
6. Later/high-risk: action-store assignment write boundary.
7. Later/high-risk: pilot binding boundary, only if it grows beyond setup workflow.
8. Last/high-risk: permission grant/revoke boundary.

Verification:

```powershell
npm.cmd --prefix backend/nestjs test -- auth-admin --runInBand
npm.cmd --prefix backend/nestjs test -- auth-authorization.repository.spec.ts --runInBand
npm.cmd --prefix backend/nestjs run build
```

Stop rules:

- Stop if a low-role user could gain visibility or write authority.
- Stop if `SUPER_ADMIN` role behavior or assigned-store action scope changes.
- Stop if negative permission tests are missing for the moved behavior.

#### 2.4 Competition Repository And Stage Builder

Why:

- Backend competition repository and frontend stage builder are both large and
  connected to package-plan workflows.

Safe first slice:

- Do not start with backend and frontend together. Pick either repository
  boundary or frontend render/model extraction.
- Current backend inventory:
  `docs/plans/competition-repository-boundary-inventory-v1.md`.

Candidate extraction order:

1. Done: frontend stage builder model/constants extraction for validation
   helpers and package-plan update payload construction.
2. Already split before this line: frontend template builder/library sections
   live in `stage-builder-template-sections.tsx`.
3. Done: frontend package/package-plan section extraction into
   `stage-builder-package-section.tsx`.
4. Parked: frontend stage team section extraction, unless a concrete product
   or reviewability trigger appears. `StageBuilderForm.tsx` is now below the
   earlier danger zone, so another tiny frontend split is not the best default.
5. Done: stage-package plan read/audit boundary for
   `listStagePackagePlans` and `listStagePackagePlanAudit`.
6. Parked/auth-adjacent: `getStagePackagePlanForAccess`, unless focused
   service access/fail-closed tests are included.
7. Done: competition list/detail/contribution read boundary for
   `listCompetitions`, `getCompetitionDetail`,
   `listStoreContributionsForCompetition`, and detail helper reads.
8. Done: backend team-template read boundary for `listTeamTemplates`.
9. Parked/medium-to-high: backend team-template command boundary.
10. Later/high-risk: stage-package plan write state machine.
11. Later/high-risk: stage creation/package execution boundary.
12. Last/high-risk: score recalculation/finalization boundary.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- competition-surfaces.spec.ts --workers=1
npm.cmd --prefix backend/nestjs test -- competition-stage-package-plan.repository.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- competition.service.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- competition --runInBand
```

Stop rules:

- Stop if stage/package-plan business state changes.
- Stop if frontend extraction changes form submission payloads.
- Stop if backend and frontend changes become one broad PR.
- Stop if stage-package plan state transitions, audit metadata, score
  recalculation, finalization, or access-scope behavior changes during a
  structural repository extraction.

### Phase 3: Frontend Surface Decomposition

Goal:

- Reduce oversized route/page files and improve future UI work reviewability
  without changing user-facing behavior.

Priority:

1. Stage builder.
2. Master-data bootstrap page.
3. Integration dashboard and import detail.
4. Store KPI highlights and rankings.
5. Admin KPI config.
6. Auth dashboard sections.

Slice pattern:

1. Extract types/constants/model helpers.
2. Extract pure display utilities.
3. Extract render-only sections.
4. Extract hooks/state only after render sections are stable.
5. Add or strengthen targeted Playwright only when the existing route coverage
   does not cover the moved behavior.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- <target-spec> --workers=1
```

Targeted specs by surface:

- Competition: `competition-surfaces.spec.ts`.
- Master data: `integration-surfaces.spec.ts` or relevant master-data route
  grep.
- Import detail: `integration-surfaces.spec.ts`.
- Store KPI/ranking: `store-surfaces.spec.ts` and
  `kpi-benchmark-explainability.spec.ts`.
- Admin KPI config: `admin-kpi-config.spec.ts`.
- Auth admin: `auth-admin-surfaces.spec.ts`.

Stop rules:

- Stop if copy/layout changes sneak into a structural refactor.
- Stop if API calls, query keys, route paths, or permission assumptions change.
- Stop if mobile/responsive behavior changes without an explicit UI/UX slice.

### Phase 4: Frontend TypeScript Strictness

Goal:

- Improve developer experience and type safety without opening a destabilizing
  all-at-once strictness PR.

Safe first slice:

- TypeScript strictness inventory only. Count current errors for proposed flags
  without committing flag changes.

Current inventory:

- `docs/plans/frontend-typescript-strictness-inventory-v1.md` records the
  measured flag impact from `origin/main`.
- PR #364 enabled `strict: true` in the frontend app and node TypeScript
  configs after temporary strict checks passed with zero errors.
- PR #365 resolved the measured `noUncheckedIndexedAccess` errors and enabled
  the flag in the frontend app and node TypeScript configs.
- `exactOptionalPropertyTypes` currently produces 66 app errors.
- The next strictness implementation is not a blind flag flip:
  `exactOptionalPropertyTypes` needs an optional payload/state pattern decision
  before code changes.

Candidate flag order:

1. Done: `strict: true` config enablement.
2. Done: `noUncheckedIndexedAccess` guard fixes and config enablement.
3. Parked: `exactOptionalPropertyTypes` pattern decision and smaller domain
   slices.
4. `noImplicitAny` is already covered by current strict build behavior.

Implementation pattern:

- [x] Run the proposed strict and indexed-access flags locally before changing
  config.
- [x] Record error categories by domain.
- [x] Enable safe flags only after the full compiler/build gates pass.
- [ ] For `exactOptionalPropertyTypes`, agree on optional payload/state helper
  patterns before touching API wrappers or dense pages.
- [ ] Prefer generated API types and local model narrowing over broad casts.

Verification:

```powershell
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run lint
```

Stop rules:

- Stop if a strictness flag creates cross-project churn.
- Stop if fixes require behavior changes.
- Stop if a PR becomes mostly type assertions instead of real safety.

### Phase 5: API Contract Drift Guard Maintenance

Goal:

- Keep the OpenAPI/generated-client win from regressing.

Tasks:

- [ ] Keep backend OpenAPI schema generation passing.
- [ ] Keep frontend `api:generate` and `api:check` in the release path.
- [ ] When adding a new endpoint, add schema coverage before frontend usage.
- [ ] For write endpoints, verify request body, response shape, error path,
  and auth scope.

Verification:

```powershell
npm.cmd --prefix backend/nestjs run openapi:generate
npm.cmd --prefix admin-web run api:generate
npm.cmd --prefix admin-web run api:check
npm.cmd --prefix admin-web run build
```

Stop rules:

- Stop if an endpoint path, status code, auth requirement, or response shape
  changes unintentionally.
- Stop if generated files and source wrappers drift.

### Phase 6: Performance And Scale Evidence

Goal:

- Avoid guessing about performance. Measure first, then refactor or index.

Candidate work:

- Reporting query baseline on disposable data.
- Import batch list/detail query baseline.
- Store ranking/KPI route frontend load check.
- Backend readiness load smoke for authenticated route groups when tokens
  exist.
- Redis/BullMQ health proof when provider config exists.

Verification:

```powershell
npm.cmd run perf:public
npm.cmd run perf:protected
npm.cmd run smoke:backend-readiness-load
npm.cmd --prefix backend/nestjs run perf:baseline
```

Stop rules:

- Stop if performance work proposes indexes without query evidence.
- Stop if local demo data is presented as production scale proof.
- Stop if provider credentials are needed but unavailable.

### Phase 7: Security And Auth Regression Pass

Goal:

- Keep auth/scope strong while broadening product use.

Candidate work:

- Auth-admin repository boundary split before broad user rollout.
- Negative tests around role/scope/action-store changes.
- Staging auth session edge evidence when real bearer tokens exist.
- Protected route load smoke with real role-specific sessions.

Verification:

```powershell
npm.cmd run check:pilot-stabilization
npm.cmd --prefix backend/nestjs test -- auth --runInBand
npm.cmd --prefix admin-web run test:e2e -- auth-admin-surfaces.spec.ts --workers=1
npm.cmd --prefix admin-web run test:e2e -- pilot-smoke.spec.ts pilot-api-contracts.spec.ts --workers=1
```

Stop rules:

- Stop if a change could broaden access.
- Stop if fail-closed behavior weakens.
- Stop if local mock auth is used as evidence for real staging auth.

## Recommended PR Sequence

Use this order unless a production bug, failing gate, or user-provided external
input changes priority.

1. Done: docs-only roadmap and handoff planning.
2. Done: reporting repository inventory and first read-boundary line.
3. Done: integration repository inventory and safe read-boundary line.
4. Done: auth admin repository inventory/test-map PR.
5. Done: auth admin lookup/audit read-boundary line.
6. Done: auth admin user-account invariant/test-map decision.
7. Done: narrow auth admin user-account read-only extraction from
   `docs/plans/auth-admin-user-account-boundary-decision-v1.md`.
8. Next: shift to stage builder / competition work unless a concrete auth
   write-risk or product change requires the next invariant decision.
9. Done: stage builder frontend pure model/constants extraction.
10. Done: stage builder package/package-plan section extraction.
11. Next: competition repository boundary inventory/test-map.
12. Done: stage-package plan list/audit read repository boundary.
13. Done: competition list/detail/contribution read repository boundary.
14. Done: team-template read repository boundary for `listTeamTemplates`.
15. Next backend competition candidate after this line: team-template command
   boundary, only with explicit invariant/test decision.
16. Stage builder team section extraction, only if continuing frontend
   competition decomposition for a concrete product/reviewability reason.
17. Master-data bootstrap frontend model/section split PR, if product work
   touches master-data bootstrap.
18. Done: TypeScript strictness inventory PR.
19. Done: config-only `strict: true` PR for frontend app and node configs.
20. Done: `noUncheckedIndexedAccess` implementation and config enablement PR.
21. Next local auth/security guard candidate: authorization matrix drift guard
    contract, docs/script only.
22. External evidence PRs only when real provider inputs exist.

Batch rule:

- Inventory docs may batch with no-code test-map updates in the same domain.
- Do not batch backend repository extraction with frontend UI extraction.
- Do not batch auth-admin work with reporting/integration work.
- Do not batch external evidence with local refactor.

## Verification Ladder By Risk

LOW, docs/inventory:

```powershell
git diff --check
```

MEDIUM, frontend structural refactor:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- <target-spec> --workers=1
```

MEDIUM, backend read-boundary refactor:

```powershell
npm.cmd --prefix backend/nestjs test -- <target-spec> --runInBand
npm.cmd --prefix backend/nestjs run build
```

HIGH, auth/API/DB/provider:

```powershell
npm.cmd --prefix backend/nestjs test -- <target-spec> --runInBand
npm.cmd --prefix backend/nestjs test -- --runInBand
npm.cmd --prefix backend/nestjs run build
npm.cmd run check:pilot-stabilization
```

Contract-related:

```powershell
npm.cmd --prefix backend/nestjs run openapi:generate
npm.cmd --prefix admin-web run api:generate
npm.cmd --prefix admin-web run api:check
```

Release-level:

```powershell
npm.cmd run check:release
```

## Done Criteria

A phase is done only when:

- the chosen scope is complete,
- diff inspection shows no unrelated domain,
- targeted tests pass,
- broader gate passes when blast radius requires it,
- evidence docs are updated if future agents need the context,
- the PR can be reverted with one squash revert,
- GitHub/Vercel/Codex merge gates pass if a PR is opened.

## Parked Until Real Input

Do not start implementation for these without new evidence:

- JSON/source adapter work.
- Broad API Gateway or service decomposition.
- New DB indexes for reporting/import without measured query evidence.
- Broad production rollout.
- New roles or pilot expansion.
- Incentive/Prim module implementation beyond intake/spec.

## Reader-Test Notes

Cold-read result:

- A future worker can identify the decision, choose the next PR, and know which
  verification ladder applies.
- External/live work is separated from local work, so the plan does not pretend
  local code can close provider evidence.
- The first safe action is docs-only roadmap linkage, followed by either an
  external input check or a reporting repository inventory depending on the
  user's next direction.
