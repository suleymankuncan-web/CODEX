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
- Runtime evidence: deployed readiness has passed both tokenless public checks
  and, as of 2026-05-23, a protected Clerk token pass for the existing pilot
  account set. Full `HR_ADMIN`/`REPORT_VIEWER` persona proof still needs
  staging aliases/credentials.
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
- Real staging auth/session evidence is current for the existing pilot account
  set; `HR_ADMIN` and `REPORT_VIEWER` remain blocked until staging accounts or
  credentials exist.
- Supabase managed restore evidence still needs an approved disposable restore target.
- Real alert delivery evidence still needs an approved provider destination.
- Redis/BullMQ broad-production posture still needs real provider configuration and health evidence.
- Product feel is still weaker than the backend foundation.

## Missing Pieces

### 1. Live External Evidence

Status: blocked by provider access or real staging inputs.

Missing:

- Real Clerk/staging bearer-token proof for `/api/auth/session` is closed for
  the existing pilot account set on 2026-05-23. `HR_ADMIN` and
  `REPORT_VIEWER` remain blocked until staging accounts or credentials exist.
- Assigned-store `201` and unassigned-store `403` action smoke proof in staging.
- Supabase staging restore drill into an approved disposable target.
- Real alert/error tracking/log-retention destination proof.
- Redis/BullMQ broad-production configuration and health evidence.
- Authenticated upload smoke using a real integration-admin session and sample file.

Rule:

- Do not claim these from local code.
- If inputs are unavailable, record the blocker and work on local-only product slices.

Latest input check:

- `docs/evidence/product-progress/2026-05-20-external-evidence-input-check.md`
  records that the required staging/provider inputs are absent in the current
  local environment, so Phase 2 remains blocked.

### 2. Visible Product Feel

Status: open and high-value.

Missing:

- A current visible-flow audit after recent refactors.
- Store home first-screen clarity and daily action hierarchy review.
- Store rankings official/preview/no-data clarity review on real-like states.
- Store checklist result/ack/history clarity review after structural splits.
- Store approvals action/error/returned-state clarity review after structural splits.
- Admin master-data/integrations/checklists/targets operational consistency review.
- A full auth/admin/store route inventory that scores V1 readiness across
  first-screen purpose, primary action, state handling, readability,
  localization, accessibility, responsive risk, deep-link trust, and test
  coverage.

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

- [x] Create `docs/evidence/product-progress/2026-05-20-visible-flow-audit-v1.md`.
- [x] For each route, record first-screen purpose, primary action, loading state, empty state, error state, mobile risk, and trust/copy risk.
- [x] Run or inspect only the relevant existing E2E route coverage before choosing a PR.
- [x] Choose one first PR using this order: user value, risk reduction, blocker removal, blast radius, verification clarity.
- [x] Implement one small visible slice.
- [x] Verify with admin lint/build and targeted Playwright for that route.

Phase 1 evidence:

- `docs/evidence/product-progress/2026-05-20-visible-flow-audit-v1.md`
- `docs/evidence/product-progress/2026-05-20-store-home-manager-copy.md`
- `docs/evidence/product-progress/2026-05-20-uiux-v1-route-inventory.md`
- `docs/evidence/product-progress/2026-05-20-store-utility-handoff-v1.md`
- `docs/evidence/product-progress/2026-05-20-admin-reports-link-context-v1.md`
- `docs/evidence/product-progress/2026-05-20-import-detail-mapping-context-v1.md`
- `docs/evidence/product-progress/2026-05-20-import-detail-panel-readability-v1.md`
- `docs/evidence/product-progress/2026-05-20-reports-detail-mobile-readability-v1.md`
- `docs/evidence/product-progress/2026-05-20-store-mobile-shell-checklist-v1.md`

Recommended first PR after this plan:

- A visible-flow audit document plus one small follow-up PR, not another large refactor.

Current UI/UX V1 status:

- Store utility/handoff route family has been improved:
  `/store/settings`, `/store/targets`, and `/store/reports`.
- Admin reports summary/snapshot chooser routes have snapshot-specific
  drill-down link context.
- Admin import detail mapping controls now expose external-ID context for
  repeated search/select/approve controls.
- Admin import detail panel copy now uses a page-scoped light-surface muted
  text token for better readability on dense evidence panels.
- Reports detail table panels now stack copy and search/sort/export controls
  cleanly on mobile across workforce, KPI, checklist, and turnover routes.
- Store mobile shell/checklist now keeps bottom toolbar active icons visible on
  tap/route state and prevents checklist visit table overflow at small mobile
  widths.
- Operations Control Tower V1 now adds `/admin/operations` as a read-only
  `SUPER_ADMIN` surface over backend health, import overview/needs-action,
  snapshot overview/needs-action, and external evidence blockers.
- Operations Data Quality Signal V1 adds a read-only data-quality snapshot to
  `/admin/operations` using existing import needs-action, import overview, and
  snapshot overview data only. Evidence:
  `docs/evidence/product-progress/2026-05-21-operations-data-quality-signal-v1.md`.
- Rules / Config Boundary Guard V1 keeps Rules / Config Boundary Decision V1
  (`docs/plans/rules-config-boundary-decision-v1.md`) guarded by
  `scripts/rules-config-boundary-contract.test.mjs` in the root `test:scripts`
  path. It does not add a rules engine, DB schema, auth/API behavior, runtime
  config editor, or user-facing workflow.
- Operations Action List V1 adds a read-only operator action list to
  `/admin/operations` using the same existing health, import, data-quality,
  snapshot, and external blocker signals. Evidence:
  `docs/evidence/product-progress/2026-05-21-operations-action-list-v1.md`.
- Operations Metric Coverage Map V1 makes the main bottleneck/metric topics
  explicit in `/admin/operations`: backend/queue, import, data quality,
  snapshot/reporting, auth, workforce, workflow, KPI/rankings, and release
  evidence. It labels each as live, partial, planned, guarded, or input-blocked
  instead of pretending every topic is already a live metric. Evidence:
  `docs/evidence/product-progress/2026-05-21-operations-metric-coverage-map-v1.md`.
- Operations Workforce Pressure V1 promotes pending seller-code and
  offboarding HR approval queues into `/admin/operations` as a live read-only
  count/preview over existing workforce read endpoints. Evidence:
  `docs/evidence/product-progress/2026-05-21-operations-workforce-pressure-v1.md`.
- Operations Workflow Inbox Pressure V1 promotes `/api/workflow/inbox` into
  `/admin/operations` as a live read-only count/urgency/preview signal over
  existing workflow inbox data. Evidence:
  `docs/evidence/product-progress/2026-05-21-operations-workflow-inbox-pressure-v1.md`.
- Operations KPI Ranking Readiness V1 promotes existing reports read models
  into `/admin/operations` as a live read-only published config and leaderboard
  source metadata signal. Evidence:
  `docs/evidence/product-progress/2026-05-21-operations-kpi-ranking-readiness-v1.md`.
- Auth Surface Readability V1 fixes low-contrast explanatory copy on
  `/admin/auth` and `/admin/auth/catalog` light panels after route-level browser
  evidence isolated the issue. Evidence:
  `docs/evidence/product-progress/2026-05-21-auth-surface-readability-v1.md`.
- Auth Audit Detail Mobile Evidence V1 adds mobile boundedness coverage for the
  auth audit detail trio before further auth/admin polish. Evidence:
  `docs/evidence/product-progress/2026-05-21-auth-audit-detail-mobile-evidence-v1.md`.
- Admin Integrations Mobile Evidence V1 adds mobile boundedness coverage for
  `/admin/integrations` across the Uploads, Evidence, and Issues operator tabs
  before further integrations polish. Evidence:
  `docs/evidence/product-progress/2026-05-21-admin-integrations-mobile-evidence-v1.md`.
- Admin Checklists Mobile Evidence V1 adds mobile boundedness coverage for
  `/admin/checklists` across the template editor shell, status strip, item
  settings, and BM/VM template switch before further checklist-template polish.
  Evidence:
  `docs/evidence/product-progress/2026-05-21-admin-checklists-mobile-evidence-v1.md`.
- Admin Snapshots Mobile Evidence V1 adds mobile boundedness coverage for
  `/admin/snapshots` and `/admin/snapshots/:snapshotRunId` before further
  snapshot UI polish. Evidence:
  `docs/evidence/product-progress/2026-05-21-admin-snapshots-mobile-evidence-v1.md`.
- Admin Reports Mobile Evidence V1 adds mobile boundedness coverage for
  `/admin/reports` and `/admin/reports/snapshot-runs` before further reports
  summary/chooser polish. Evidence:
  `docs/evidence/product-progress/2026-05-21-admin-reports-mobile-evidence-v1.md`.
- Product Surface Audit V2 selected the Product Readiness V1 first-pass order:
  Admin KPI Config, Store KPI / Rankings, and Integration Dashboard / Master
  Data. Evidence:
  `docs/evidence/product-progress/2026-05-21-product-surface-audit-v2.md`.
- Admin KPI Config Row Context V1 improved repeated metric, ownership, and
  grading-band row accessibility with targeted mobile boundedness evidence.
  Evidence:
  `docs/evidence/product-progress/2026-05-21-admin-kpi-config-row-context-v1.md`.
- Store Rankings Table Context V1 added a localized hidden table caption and
  targeted mobile boundedness evidence for `/store/rankings`. Evidence:
  `docs/evidence/product-progress/2026-05-21-store-rankings-table-context-v1.md`.
- Master Data Personnel Row Context V1 added row-specific accessible labels and
  targeted mobile boundedness evidence for `/admin/master-data` personnel
  controls. Evidence:
  `docs/evidence/product-progress/2026-05-21-master-data-personnel-row-context-v1.md`.
- Product Readiness V1 closeout parks Stage Builder / Competition unless fresh
  browser, pilot, or test evidence isolates a concrete safe gap. Evidence:
  `docs/evidence/product-progress/2026-05-21-product-readiness-v1-closeout.md`.
- Park `/store/home` and `/admin/master-data` unless browser review or pilot
  feedback finds a concrete new gap.

Next UI/UX V1 recommendation:

- Do not keep expanding import detail without a new concrete browser or pilot
  gap; mapping context and scoped panel-copy readability are now covered.
- Do not keep expanding the main integrations screen without a new concrete
  browser or pilot gap; the current mobile boundedness evidence is covered.
- Do not keep expanding the checklist template editor without a new concrete
  browser or pilot gap; the current mobile boundedness evidence is covered.
- Do not keep expanding snapshot operations without a new concrete browser or
  pilot gap; the current mobile boundedness evidence is covered.
- Do not keep expanding reports summary or snapshot chooser without a new
  concrete browser or pilot gap; the current mobile boundedness evidence is
  covered.
- Park reports detail pages unless a new browser or pilot gap appears; the
  current mobile table header/readability gap is covered.
- Park store mobile shell/checklist follow-up unless a new browser or pilot gap
  appears; the active-icon and checklist overflow issues are covered.
- Treat auth/admin follow-ups as later slices, with route-level Playwright
  evidence before visual polish.
- Treat Stage Builder / Competition as parked unless the gap is explicitly
  readability, accessibility, mobile boundedness, or test evidence only. Do not
  touch package-plan payloads, command semantics, state-machine behavior,
  scoring, finalization, backend repositories, API contracts, auth,
  permissions, DB state, or CSS-global behavior from the product-readiness line.

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

Current result:

- Blocked by missing staging/provider inputs. See
  `docs/evidence/product-progress/2026-05-20-external-evidence-input-check.md`.
- The 2026-05-21 blocker refresh confirms the same class of inputs is still
  absent in the local environment:
  `docs/evidence/product-progress/2026-05-21-external-evidence-blocker-refresh.md`.
- Pilot Reliability Spine V1 now makes the evidence classes explicit instead of
  leaving them as one generic "blocked" bucket:
  `docs/evidence/pilot-evidence-operating-matrix-v1.md`,
  `docs/plans/pilot-persona-evidence-runbook-v1.md`,
  `docs/plans/staging-pilot-dataset-contract-v1.md`,
  `docs/plans/role-scope-drift-guard-v1.md`,
  `docs/plans/data-freshness-quality-guard-v1.md`, and
  `docs/plans/performance-budget-v1.md`.
- Fresh 2026-05-23 public staging checks passed tokenless deployed readiness,
  public backend health load, and alert-routing health checks. The first public
  pass had protected checks skipped until secure role-specific tokens were
  available; fresh alert provider delivery proof remains blocked by missing
  provider metadata/delivery input.
- Fresh 2026-05-23 protected Clerk proof is now recorded in
  `docs/evidence/system-flow/clerk-persona-live-evidence-2026-05-23.md` for
  the existing pilot account set. Four available personas passed browser
  route/session checks, Store Action assigned/unassigned action-scope read
  proof passed, deployed readiness passed `14/14` with a real token, and
  backend protected load passed `5/5` groups with role-specific tokens.
  `HR_ADMIN` and `REPORT_VIEWER` remain blocked until staging
  aliases/credentials exist.

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

- [x] Inventory the current admin surfaces against existing E2E coverage.
- [x] Pick one surface with the clearest operator confusion.
- [x] Improve information hierarchy or state explanation without changing backend contracts.
- [x] Verify with admin build and targeted admin Playwright spec.

Phase 3 evidence:

- `docs/evidence/product-progress/2026-05-20-master-data-store-labels.md`

Stop rules:

- Stop if a fix requires new workflow states, new permissions, or new database fields.
- Stop if the screen needs a backend contract that does not already exist.

### Phase 4: Targeted Strategic Refactor

Goal:

- Reduce developer friction only where it unlocks real work.

Detailed follow-up:

- Use `docs/plans/technical-debt-resolution-roadmap-v1.md` as the canonical
  execution roadmap for the `KISMI REFACTOR` decision. It separates local
  refactor work from external evidence blockers and defines the backend,
  frontend, TypeScript, API contract, performance, and auth/security ladders.

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

Current result:

- No targeted strategic refactor is active. Recent product/readiness slices did
  not expose a concrete bug, risk, or pure structural boundary that justifies a
  refactor PR.

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

- [x] Add or update an entry in `docs/plans/feature-backlog.md`.
- [x] Create a mini spec from `docs/plans/new-module-template.md`.
- [x] Define owner, personas, data impact, API impact, UI impact, and verification before code.
- [x] Reject schema/API/UI implementation until the scope is shaped.

Phase 5 evidence:

- `docs/plans/incentive-prim-module-intake-v1.md`

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

- Continue turning growth-foundation docs into one small implementation slice
  at a time, only where the first UI/config/test guard can use existing
  contracts.

Why:

- External readiness is still parked until real inputs exist.
- The latest UI/UX V1 and refactor lines have closed the immediate visible
  blockers that triggered them.
- Frontend strictness, the first Operations Control Tower UI slice, and the
  first read-only data-quality control-tower signal are now implemented; the
  next useful local work should come from a remaining growth guardrail with a
  clear test-only, docs/script, or read-only boundary.

Candidate next outputs:

- Authorization matrix drift guard is already implemented as a docs/script
  guard through the scope/auth regression matrix contract; do not repeat it.
- Cross-domain data-quality signal V1 is now represented in `/admin/operations`
  using existing read signals only; do not build a dedicated dashboard without
  a concrete operator gap.
- Rules/config boundary guard is now represented as docs/script-only contract
  coverage.
- Operations Action List V1 is the final small read-only follow-up currently
  justified by the control-tower spec. After this, pause the growth-foundation
  line unless browser/pilot evidence finds a concrete Operations gap, and
  return to route-level product evidence.
- Auth Surface Readability V1 is the first route-level auth/admin evidence
  follow-up after that pause; keep future auth/admin work equally narrow and
  evidence-led.
- Auth Audit Detail Mobile Evidence V1 covers the audit detail trio with
  route-level mobile overflow evidence; do not continue auth/admin UI polish
  unless a fresh browser/pilot gap appears.
- Admin Integrations Mobile Evidence V1 covers the main integrations screen
  with route-level mobile overflow evidence; do not continue integrations UI
  polish unless a fresh browser/pilot gap appears.
- Admin Checklists Mobile Evidence V1 covers the checklist template editor with
  route-level mobile overflow evidence; do not continue checklist-template UI
  polish unless a fresh browser/pilot gap appears.
- Admin Snapshots Mobile Evidence V1 covers the snapshot operations overview
  and snapshot run detail with route-level mobile overflow evidence; do not
  continue snapshot UI polish unless a fresh browser/pilot gap appears.
- Admin Reports Mobile Evidence V1 covers the reports summary hub and snapshot
  run chooser with route-level mobile overflow evidence; do not continue
  reports summary/chooser UI polish unless a fresh browser/pilot gap appears.
- Keep rules engine, auth model changes, DB schema, provider config, broad
  data-quality workflows, and new backend aggregation parked until separately
  scoped.

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
