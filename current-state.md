# Current State - Active Handoff

This is the canonical short handoff for the HR Axis / Store Ops workspace.
It summarizes the recovered long Codex thread and the follow-up work through
PR #383 and the parked Workforce Request safe-read boundary line, and is
the starting point for continuing in a fresh window.

## Active Workspace

Use this workspace only:

```powershell
D:\store-ops-workspace
```

Do not use the old OneDrive desktop copy or any old `E:\` workspace.

Primary app endpoints:

- Frontend staging: `https://staging.hr-axis.com`
- Backend staging API: `https://api-staging.hr-axis.com/api`
- Frontend deploy target: Vercel
- Backend deploy target: Render
- Database: Supabase Free Postgres
- Auth provider: Clerk
- Authorization source of truth: application DB role/scope/action-store assignments

## Latest Git State

As of 2026-05-21, `origin/main` has been fetched through PR #383.
The root checkout may still be on a non-main local branch with unrelated
handoff noise; do not assume the root working tree is clean.

Latest merge on main:

```text
75461572 refactor: split workforce lookup reads
```

Recent verified merges after the recovered PR #227 handoff:

- PR #228 `deployed-readiness-smoke`
- PR #229 `edge-security-headers`
- PR #230 `observability-v1`
- PR #231 `alerting-and-incident-evidence`
- PR #232 `redis-backed-rate-limit`
- PR #233 `queue-durability-gate`
- PR #234 `backup-restore-live-drill-evidence-gate`
- PR #235 `upload-resource-guardrails`
- PR #236 upload guardrail review fixes
- PR #237 `env-secret-drift-guard`
- PR #238 `supabase-boundary-guard`
- PR #239 `performance-budget-pass`
- PR #240 final production readiness decision packet
- PR #241 readiness evidence tiers clarification
- PR #242 `store-rankings-clarity`
- PR #300 `feat: generate target distribution request types`
- PR #301 `feat: generate target coverage types`
- PR #302 `feat: generate target workflow contract types`
- PR #303 `feat: generate snapshot contract types`
- PR #304 `feat: generate workforce read contract types`
- PR #305 `feat: generate reports read core contract types`
- PR #306 `feat: generate reports scoreboard contract types`
- PR #307 `feat: generate auth read core contract types`
- PR #308 `feat: generate auth session contract types`
- PR #309 `feat: generate reports KPI write contract types`
- PR #310 `feat: generate auth assignment write contract types`
- PR #311 `feat: generate auth user permission write contract types`
- PR #312 `fix: show returned approval queue errors separately`
- PR #313 `refactor: split store approvals returned panel`
- PR #314 `refactor: split store approvals target ledger`
- PR #315 `refactor: split store approvals submitted targets panel`
- PR #316 `refactor: split store approvals target request form`
- PR #317 `refactor: split store approvals seller code form`
- PR #318 `refactor: split store approvals offboarding form`
- PR #319 `refactor: split store approvals workbench`
- PR #320 `refactor: split store checklists visit panel`
- PR #321 `refactor: split store checklists acknowledgement panels`
- PR #322 `refactor: split store checklists controls`
- PR #323 `refactor: split store checklists hero`
- PR #324 `refactor: split store checklists result modal`
- PR #325 `docs: add project progress operating plan`
- PR #326 `feat: fill store home manager copy`
- PR #327 `docs: record external evidence input blockers`
- PR #328 `feat: clarify master data store labels`
- PR #329 `docs: shape incentive module intake`
- PR #330 `docs: add UI/UX V1 route inventory`
- PR #331 `feat: clarify store utility handoff pages`
- PR #332 `feat: clarify admin reports drilldown links`
- PR #333 `feat: clarify import detail mapping controls`
- PR #334 `feat: improve import detail panel readability`
- PR #335 `feat: improve reports detail mobile layout`
- PR #337 `docs: add technical roadmap and Sokrates calibration`
- PR #338 `docs: inventory reporting repository boundaries`
- PR #339 `refactor: split store score reporting reads`
- PR #340 `refactor: move closed reporting reads to closed ranking repository`
- PR #341 `refactor: split snapshot reporting reads`
- PR #342 `refactor: split store performance reporting reads`
- PR #343 `refactor: split ranking reporting reads`
- PR #344 `docs: inventory integration repository boundaries`
- PR #345 `refactor: split import batch read repository`
- PR #346 `refactor: move import batch detail reads`
- PR #347 `refactor: split external mapping reads`
- PR #348 `refactor: split KPI store read repository`
- PR #349 `refactor: split personnel master reads`
- PR #350 `docs: update integration boundary handoff`
- PR #351 `docs: inventory auth admin repository boundaries`
- PR #352 `refactor: split auth admin lookups`
- PR #353 `refactor: split auth admin audit reads`
- PR #354 `docs: update auth admin boundary handoff`
- PR #355 `docs: plan auth admin user account boundary`
- PR #356 `refactor: split auth user account reads`
- PR #357 `refactor: split stage builder model helpers`
- PR #358 `refactor: split stage builder package section`
- PR #359 `docs: inventory competition repository boundaries`
- PR #360 `refactor: split competition stage plan reads`
- PR #361 `refactor: split competition read repository`
- PR #362 `refactor: split competition team template reads`
- PR #363 `docs: plan growth foundation guardrails`
- PR #364 `chore: enable frontend strict typescript`
- PR #365 `chore: enable indexed access checks`
- PR #366 `docs: guard authorization matrix drift`
- PR #367 `chore: enable exact optional frontend types`
- PR #368 `feat: add operations control tower`
- PR #369 `feat: surface operations data quality signal`
- PR #370 `test: guard rules config boundary decision`
- PR #371 `feat: add operations action list`
- PR #372 `fix: improve auth surface copy readability`
- PR #373 `test: guard auth audit detail mobile layout`
- PR #374 `test: guard admin integrations mobile layout`
- PR #375 `test: guard admin checklist mobile layout`
- PR #376 `test: guard admin snapshots mobile layout`
- PR #377 `test: guard admin reports mobile layout`
- PR #378 `docs: decide competition team template command boundary`
- PR #379 `refactor: split competition team template commands`
- PR #380 `docs: inventory workforce request boundaries`
- PR #381 `refactor: split workforce seller code reads`
- PR #382 `refactor: split workforce offboarding reads`
- PR #383 `refactor: split workforce lookup reads`

PR #242 was frontend-only and did not require Render deploy. After merge, a
deployed readiness smoke was run against staging:

```text
READINESS_FRONTEND_URL=https://staging.hr-axis.com
READINESS_BACKEND_URL=https://api-staging.hr-axis.com/api
npm.cmd run smoke:deployed-readiness
```

Result: 13 passed, 0 failed, 1 skipped. The skipped check was
`backend auth session` because no real `READINESS_BEARER_TOKEN` was provided.
Backend health, database health, rate-limit headers, correlation headers,
frontend root, security headers, SPA fallback, and static assets passed.

Known local working tree noise at recovery time:

- `current-state.md` modified for this handoff update
- `docs/plans/feature-backlog.md` modified
- `.bg-shell/` untracked
- `docs/superpowers/plans/2026-05-13-checklist-command-surfaces-v1.md` untracked
- `docs/superpowers/specs/2026-05-12-coach-insight-rules-v1-design.md` untracked
- `thread-019dfcf6-6c3c-7470-81dd-9513de42746d-transcript.md` untracked recovery transcript

Do not stage, delete, or "clean up" those unless the user explicitly asks.
`.gsd/` is local-only/ignored state; use it for planning but do not make it a
repo PR artifact.

## API Contract Drift Status

The API contract drift prepared batch line is complete through PR #311.

What landed:

- OpenAPI schema coverage and generated frontend types/clients were extended
  across target distribution, workflow inbox, snapshots, workforce reads,
  reports reads, reports KPI writes, auth reads/session, and auth writes.
- The frontend API wrappers were moved from handwritten response/body types
  toward generated OpenAPI-backed types where each slice adopted coverage.
- No intentional API response shape, auth/permission behavior, DB migration,
  business logic, or CSS behavior change was made in this line.

Verification pattern used for the merged batch PRs:

- Backend `openapi:generate`.
- Admin `api:generate` and `api:check`.
- Admin/backend lint.
- Admin build.
- Backend targeted tests for the touched domain.
- Backend full Jest suite.
- Relevant Playwright E2E specs for the touched frontend/API surface.
- GitHub checks plus Vercel deployment checks.
- Codex GitHub review/comment or approval reaction before merge.

The old full `store-surfaces.spec.ts` baseline caveat is now closed. On
2026-05-20, the full suite passed on `origin/main` with 53/53 tests before the
approvals follow-up work, and it was used as a gate for PR #312 through PR #319.

Store approvals follow-up after the OpenAPI line:

- PR #312 made returned seller-code and offboarding queue failures render as
  separate alerts instead of hiding one error behind a coalesced message.
- PR #313 split the returned requests panel and shared request feedback atom.
- PR #314 split the target approval ledger and shared target allocation
  breakdown atom.
- PR #315 split the submitted target requests panel.
- PR #316 split the target distribution request form.
- PR #317 split the seller-code request form.
- PR #318 split the offboarding request form.
- PR #319 split the pure workbench render tree.
- No API response shape, auth/permission behavior, DB migration, business
  logic, or CSS behavior change was intended in these follow-up slices.
- `StoreApprovalsPage.tsx` is now roughly 625 lines on `origin/main`.

Store checklists follow-up after the approvals line:

- PR #320 split the store checklists visit panel/table/row render tree into
  `store-checklists-visit-panel.tsx`.
- PR #321 split acknowledgement inbox/history panels and the result list/row
  render tree into `store-checklists-acknowledgement-panels.tsx`.
- PR #322 split the checklist toolbar and tab controls into
  `store-checklists-controls.tsx`.
- PR #323 split the checklist command hero into
  `store-checklists-hero.tsx`.
- PR #324 split the result detail/acknowledgement modal into
  `store-checklists-result-modal.tsx`.
- `StoreChecklistsPage.tsx` is now roughly 922 lines on `origin/main`.
- The first targeted checklist E2E run caught mojibake in moved Turkish static
  copy; that was fixed before PR #320 was opened.
- No checklist API/auth/state/DB/CSS behavior change was intended.

## Product Position

Do not restart the project. The recovered thread ended with a clear decision:
the project is not finished, but it is not throwaway. It is roughly an
80/100 product foundation with strong backend/auth/test/deploy bones and weaker
visible product polish.

Current product stance:

- Keep the existing project.
- Do not do a rewrite.
- Stop doing broad invisible foundation work for a bit.
- Move into a short visible product-feel sprint.
- Focus on the screens users actually touch: store home, rankings, checklist,
  store/me, approvals, and admin master/integration/checklist shells.

What is already real:

- Clerk auth plus DB-backed role/scope/action-store authorization.
- Store, personnel, BM/VM, region, admin/HR/integration role separation.
- Power BI/Excel data path and KPI/ranking materialization.
- Store home, store/me, rankings, KPIs, approvals, tasks, checklists.
- Admin integrations, master data, inbox, targets, audit, competitions, feed.
- CI/release checks, guarded evidence docs, Vercel/Render/Supabase operations.

The next value is not "more architecture". It is making the visible flows feel
calm, fast, coherent, and product-like.

Latest technical assessment decision:

- Net decision: `KISMI REFACTOR`.
- Do not rewrite and do not treat the project as debt-free.
- The actionable follow-up plan is
  `docs/plans/technical-debt-resolution-roadmap-v1.md`.
- Use that roadmap when choosing between external evidence closure, backend
  repository boundary refactor, frontend surface decomposition, TypeScript
  strictness, API contract maintenance, performance evidence, and auth/security
  regression work.
- Growth foundation docs are planned through PR #363:
  rules/config boundary, operations control tower V1, authorization matrix drift
  guard, cross-domain data quality inventory, and frontend TypeScript
  strictness inventory.
- Frontend TypeScript strictness is now stronger through PR #364, PR #365, and
  PR #367: `strict: true`,
  `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` are enabled in
  the frontend app and node configs. The exact-optional rule is: omit absent
  optional API/query/prop fields; use `field: T | undefined` only for internal
  state/view models where the field is always present but unresolved.
- Reporting repository first boundary-refactor pass is complete through PR #343:
  store score reads, closed ranking reads, snapshot reads, store performance
  reads, and ranking reads were split out; `ReportingRepository` is now roughly
  503 physical lines with identity/personnel live performance helpers remaining.
- Integration repository boundary work is complete through the safe read split
  line:
  - PR #344 recorded the boundary inventory.
  - PR #345 and PR #346 split import batch list/summary/detail/evidence reads
    into `ImportBatchReadRepository`.
  - PR #347 split external ID mapping candidate/scoped target reads into
    `ExternalIdMappingReadRepository`.
  - PR #348 split KPI import store-scope reads into
    `KpiImportStoreReadRepository`.
  - PR #349 split personnel master list/lookup reads into
    `PersonnelMasterReadRepository`.
- `IntegrationRepository` is now roughly 711 physical lines / 674 non-empty
  lines on `origin/main` and mostly holds command/write flows: import batch
  creation/raw staging, store/personnel master updates, retry/status writes,
  and external mapping approval audit.
- Do not continue splitting integration retry/status/raw-staging writes unless
  a concrete product/risk change needs them. The next safer technical-debt
  hotspot is the auth admin repository, but auth work must begin with a fresh
  inventory/test map because it is security-sensitive.
- Auth admin repository boundary work is complete through the safe read split
  line:
  - PR #351 recorded the auth admin boundary inventory and test map.
  - PR #352 split lookup/catalog read methods into
    `AuthAdminLookupRepository`.
  - PR #353 split role assignment, action-store assignment, and user account
    audit reads into `AuthAdminAuditRepository`.
- `AuthAdminRepository` is now roughly 1449 physical lines / 1361 non-empty
  lines on `origin/main`. It still owns high-risk command/write flows:
  role assignment persistence, action-store assignment persistence, user
  account create/reactivate, pilot binding, and role permission mutation.
- Do not continue into auth admin write-boundary extraction without first
  choosing the exact invariant/test strategy. In particular, user-account
  boundary work needs an explicit decision on whether one active account per
  employee is a product invariant, and role/action-store writes need negative
  permission/scope coverage selected before code movement.
- The user-account boundary decision is now recorded at
  `docs/plans/auth-admin-user-account-boundary-decision-v1.md`. It allows only
  a narrow read-only extraction of `listUserAccounts` and `getUserAccountById`
  as the next auth code slice. Provider-subject lookup, active employee/store
  validation, create/reactivate writes, and pilot binding stay parked until the
  employee-account invariant and negative-test strategy are stronger.
- The user-account read-only extraction has now moved `listUserAccounts` and
  `getUserAccountById` into `AuthAdminUserAccountReadRepository`.
  `AuthAdminRepository` is now roughly 1356 physical lines / 1278 non-empty
  lines. Remaining auth admin work is write-heavy and should stay parked unless
  a concrete auth/security risk or product change requires the next invariant
  decision.
- Stage builder frontend decomposition has started with the safest model slice:
  validation helpers and stage package plan update-payload construction moved
  from `StageBuilderForm.tsx` into `stage-builder-model.ts`. The form remains
  render/hook/API orchestration only for those helpers.
- The package/package-plan render section has now moved into
  `stage-builder-package-section.tsx`. Query/mutation orchestration, API calls,
  payload shapes, copy, CSS, and auth behavior stayed unchanged.
- `StageBuilderForm.tsx` is now roughly 789 physical lines on `origin/main`
  after PR #358. This is below the earlier danger zone, so pause tiny frontend
  StageBuilder splits unless a concrete product/risk change needs them.
- The `CompetitionRepository` boundary/test-map inventory is recorded at
  `docs/plans/competition-repository-boundary-inventory-v1.md`. The repository
  is roughly 1839 physical lines and mixes reads, plan state transitions, score
  recalculation, finalization, audit, and access-context helpers.
- The first backend competition code slice moves only stage-package plan
  list/audit reads into `CompetitionStagePackagePlanReadRepository`, keeping
  `getStagePackagePlanForAccess` and all write/state-machine methods in
  `CompetitionRepository`. This is structural only: no API response shape,
  auth/scope behavior, SQL semantics, audit metadata, DB migration, CSS, or
  user-facing behavior change is intended. After the slice,
  `CompetitionRepository` is roughly 1792 physical lines and
  `CompetitionStagePackagePlanReadRepository` is roughly 76 physical lines.
- The competition list/detail/contribution read boundary has moved into
  `CompetitionReadRepository`.
- The team-template read boundary for `listTeamTemplates` has moved into
  `CompetitionTeamTemplateReadRepository`.
- Next backend competition candidate: team-template command/write boundary, but
  only with an explicit invariant/test decision. The current docs-only decision
  records that contract at
  `docs/plans/competition-team-template-command-boundary-decision-v1.md`.
- The current code slice moves only team-template command persistence into
  `CompetitionTeamTemplateCommandRepository`, while `CompetitionRepository`
  remains the facade. `CompetitionRepository` is roughly 1432 physical lines and
  `CompetitionTeamTemplateCommandRepository` is roughly 254 physical lines after
  this slice. Keep stage-package plan writes, stage creation/execution,
  access-context helpers, score recalculation, and finalization parked until
  separately scoped.
- Operations Control Tower V1 first read-only UI slice adds `/admin/operations`
  for `SUPER_ADMIN` over existing backend health, import overview/needs-action,
  snapshot overview/needs-action, and external blocker language. Evidence:
  `docs/evidence/product-progress/2026-05-21-operations-control-tower-v1.md`.
  No backend aggregation endpoint, writes, DB migration, auth model change, API
  response shape change, or provider configuration is included.
- Operations Data Quality Signal V1 is the current small follow-up slice: it
  adds a read-only data-quality snapshot to `/admin/operations` using existing
  import needs-action preview, import overview, and snapshot overview data
  only. Evidence:
  `docs/evidence/product-progress/2026-05-21-operations-data-quality-signal-v1.md`.
  No new backend endpoint, DB/API/auth change, import retry, mapping approval,
  scoring, snapshot rerun, or data-quality workflow is included.
- Rules / Config Boundary Guard V1 is the current docs/script follow-up slice:
  it keeps Rules / Config Boundary Decision V1
  (`docs/plans/rules-config-boundary-decision-v1.md`) in the root
  `test:scripts` release path so the no-generic-engine decision, domain-owned
  rule placement, promotion triggers, and first-code-slice guardrails cannot
  drift quietly. No application behavior, API, auth, DB, CSS, or runtime config
  change is included.
- Operations Action List V1 is the current read-only UI follow-up slice: it
  adds an operator action list to `/admin/operations` derived only from the
  existing backend health, import, data-quality, snapshot, and external blocker
  signals already loaded by the page. Evidence:
  `docs/evidence/product-progress/2026-05-21-operations-action-list-v1.md`.
  No new endpoint, API response shape, auth/permission, DB, provider config,
  import retry, mapping approval, snapshot rerun, scoring, or workflow change
  is included.
- Auth Surface Readability V1 is the current route-level product-evidence
  slice: it fixes low-contrast explanatory copy on `/admin/auth` and
  `/admin/auth/catalog` light panels by reusing the existing `queue-subtitle`
  text token. Evidence:
  `docs/evidence/product-progress/2026-05-21-auth-surface-readability-v1.md`.
  No auth, permission, route access, API, DB, provider, role assignment, pilot
  binding, action-store, or mutation behavior change is included.
- Auth Audit Detail Mobile Evidence V1 is the current test/evidence follow-up
  slice: it adds mobile-width boundedness coverage for the auth audit detail
  trio under `/admin/audit/*/audit`. Evidence:
  `docs/evidence/product-progress/2026-05-21-auth-audit-detail-mobile-evidence-v1.md`.
  No auth, permission, route access, API, DB, provider, audit data, CSS, copy, or
  layout behavior change is included.
- Admin Integrations Mobile Evidence V1 is the current test/evidence follow-up
  slice: it adds mobile-width boundedness coverage for `/admin/integrations`
  across the Uploads, Evidence, and Issues tabs. Evidence:
  `docs/evidence/product-progress/2026-05-21-admin-integrations-mobile-evidence-v1.md`.
  No upload behavior, import retry behavior, API, auth, permission, DB, CSS,
  copy, layout, or data-calculation behavior change is included.
- Admin Checklists Mobile Evidence V1 is the current test/evidence follow-up
  slice: it adds mobile-width boundedness coverage for `/admin/checklists`
  across the template editor shell, status strip, item settings, and BM/VM
  template switch. Evidence:
  `docs/evidence/product-progress/2026-05-21-admin-checklists-mobile-evidence-v1.md`.
  No checklist template behavior, API, auth, permission, DB, CSS, copy, layout,
  publishing, saving, or draft-state behavior change is included.
- Admin Snapshots Mobile Evidence V1 is the current test/evidence follow-up
  slice: it adds mobile-width boundedness coverage for `/admin/snapshots` and
  `/admin/snapshots/:snapshotRunId`. Evidence:
  `docs/evidence/product-progress/2026-05-21-admin-snapshots-mobile-evidence-v1.md`.
  No snapshot rerun behavior, API, auth, permission, DB, CSS, copy, layout,
  audit data, materialized slice data, or data-calculation behavior change is
  included.
- Admin Reports Mobile Evidence V1 is the current test/evidence follow-up
  slice: it adds mobile-width boundedness coverage for `/admin/reports` and
  `/admin/reports/snapshot-runs`. Evidence:
  `docs/evidence/product-progress/2026-05-21-admin-reports-mobile-evidence-v1.md`.
  No report API call, response shape, auth, permission, DB, sorting, export,
  drill-down href, CSS, copy, layout, or report-calculation behavior change is
  included.

## Sokrates

Sokrates is the default working principle for this project.

Always read `sokrates.md` after reading `current-state.md` and before planning
or coding. That file is the canonical, detailed operating rule.

Short version:

- Question first, especially for strategic, architectural, refactor, or
  externally suggested plans.
- The user does not need to explicitly say "Sokrates mode"; apply it
  automatically and proportionally based on risk.
- Work in the rhythm: plan, implementation plan, application, verification,
  handoff.
- Keep implementation slices small, reversible, and testable.
- A slice is not automatically a PR. Multiple small slices may be batched into
  one branch/PR when they form one logical review unit.
- Do not batch unrelated domains, mixed risk classes, hidden behavior changes,
  or work that cannot be rolled back clearly.
- Do not change business logic, API response shape, auth/permission behavior,
  DB schema/migrations, CSS behavior, or user-facing behavior unless that is
  explicitly the goal.
- Use risk labels, evidence labels, ready/done checks, stop rules,
  counterarguments, change-my-mind triggers, ambiguity protocol, and a
  verification ladder.
- Use decision records, blast-radius mapping, bias checks, rollback reasoning,
  and runtime-confidence checks for medium/high-risk work.
- Use domain playbooks for auth/permissions, API contracts, DB/migrations,
  frontend UX, refactor, CI/release, and external evidence.
- Calibrate Sokrates from real work using self-audit, decision-quality scoring,
  failure taxonomy, and explicit override rules.
- Use prioritization and scope brakes: choose work by user value, risk
  reduction, blockers, and PR reviewability; describe scope in slices/PRs, not
  calendar estimates.
- When asked "what next?", use Sokrates as an active technical advisor: compare
  candidate paths, explain what happens if we go there, and recommend the next
  PR/slice-scale move.
- Use report depth intentionally: light Sokrates for low-risk work, full
  Sokrates for architectural, auth/API/DB, batch, or high-risk decisions.
- Keep Sokrates proportional: use deeper questioning for higher-risk work, but
  do not turn low-risk documentation or mechanical updates into ceremony.
- Choose an operating mode before acting: Scout, Planner, Builder, Reviewer, or
  Finisher.
- Use the triage gate to decide whether the work needs a direct answer,
  status check, docs/plan update, low-risk implementation, medium-risk
  implementation, full high-risk Sokrates, or external-evidence handling.
- For "what next?" decisions, answer with a concrete recommendation contract:
  now, next, park, and stop.
- Keep evidence fresh: current repo state beats memory, `origin/main` beats old
  local branches for merged work, and provider/runtime facts must be verified
  before being treated as true.
- Use the no-drift checkpoint before editing, before PR/merge, and before final
  answer so the work follows the newest user request.
- Merge only after local gates, GitHub/Vercel checks when relevant, mergeable
  status, and Codex no-major-issue/comment or clear approval reaction.
- Check Codex approval signals quickly after checks go green: poll issue
  comments, PR reviews, PR review comments, reaction endpoints, and timeline in
  a short 15-20 second loop. If the user reports seeing the Codex thumbs-up in
  GitHub UI and checks are green/mergeable, treat that as user-provided
  approval evidence instead of waiting several minutes for API visibility.
- Update current-state or the relevant plan when a decision changes future
  context.

## Recovered Thread Summary

The old thread ran from 2026-05-06 through 2026-05-15 and produced many small,
verified PRs. Main themes:

1. Pilot and evidence governance were tightened.
   PR #17 through #29 closed master-data test hygiene, pilot evidence
   consolidation, controlled pilot checklist/log guards, staging auth session
   edge evidence, JSON suspension, Round 1 outcome, and Round 2 evidence.

2. Pilot-facing TR/EN localization was expanded and then closed out.
   PR #30 through #69 covered store, admin, auth, reporting, competitions, and
   final accessibility/localization guard passes. Broad localization is not an
   active standalone blocker now.

3. Security, Render migration, refactor, and performance foundations landed.
   PR #70 through #82 covered scoped security hardening, Render Free plan
   migration evidence, app-shell/refactor slices, reporting/import helper
   splits, and public/protected performance evidence.

4. Ranking, KPI config, store/me, and personnel profile work matured.
   PR #83 through #117 improved ranking correctness, Power BI benchmark
   alignment, KPI scoring/config clarity, store/me white-screen and UI fixes,
   personnel profile scope/date/target/global visibility, and React health.

5. Frontend health and route transition reliability improved.
   PR #118 through #136 covered React 19/session state, component splits,
   import/snapshot reducer work, entry smoothness, store home command center,
   transient retry, mobile session guard, token refresh fail-closed, and route
   transition loading/hardening.

6. Store approvals and admin command surfaces were redesigned in slices.
   PR #137 through #153 moved store approvals toward ledger/action-dock/new UI,
   reduced store-manager auth noise, added admin shell command UI, smoothed
   integration token auth, built tabbed integrations and master-data command
   center flows, bulk save, and admin checklist builder v3.

7. Checklist became a real operational module.
   PR #154 through #178 added template start flow, result acknowledgement
   details, E2E smoke coverage, score correctness, command-surface polish,
   auth/route prefetch, instance scope fixes, autosave/complete fixes,
   command surface integration/parity, tabs mobile polish, VM/BM parity and
   summaries, checklist role/template flow, VM-only scope cleanup, checklist
   score-chain hardening, inbox/result deep links, receipt URL state, and task
   refresh after acknowledgement/complete.

8. Final recovered work improved perceived speed.
   PR #179 through #186 warmed store task, checklist, approval, store home,
   store sidebar, admin sidebar, admin inbox, and admin targets data. The goal
   was less blank waiting, fewer duplicate requests, and faster route entry.

## Current Pilot Stance

Controlled staging/internal pilot: `Conditional Go`

Broad production rollout: `No-Go`

Pilot localization closeout: `guarded`

Full product bilingual depth remains a future UI/design-system investment.

The current consolidated pilot decision note is
`docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-conditional-go-consolidation.md`.

The current controlled pilot Round 1 outcome note is
`docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-round-1-outcome.md`.
Controlled Pilot Round 1 Outcome: `Continue` with the same controlled
staging/internal pilot scope. No active route blocker remains from Round 1.

The active controlled pilot feedback log is
`docs/evidence/pilot-readiness/2026-05-05-controlled-pilot-feedback-log.md`.

The controlled pilot operating checklist is
`docs/plans/controlled-pilot-operating-checklist-v1.md`.

The staging auth session edge evidence guard is
`docs/plans/staging-auth-session-edge-evidence-guard-v1.md`.

Pilot Readiness Gate V1 remains the guarded decision framework:
`docs/plans/pilot-readiness-gate-v1.md`.

## Readiness Progress Status

The readiness roadmap is not "forgotten" and not fully complete.
It is split into repo-owned work and external/live evidence:

- GSD registry says `M001 Store Ops Readiness Closure` is `complete`.
- GSD registry says `M002 Live Readiness Closure` is `parked`.
- `docs/superpowers/plans/2026-05-18-readiness-progress.md` is the main
  readiness roadmap and is merged through the final decision/evidence tiers.
- Production Readiness Decision Packet V1 is recorded at
  `docs/evidence/readiness/2026-05-18-production-readiness-decision.md`.
- PR #240 Final Go/No-Go Readiness Packet merged as
  `107cc561 Merge pull request #240`.
- Main `Release Check` passed after PR #240.
- Broad production remains `No-Go`.
- Controlled/internal hardening remains `Conditional Go`.

There are six external evidence gaps. Treat them as two tiers:

Tier A - controlled pilot expansion first:

- Real staging auth/action smoke with sanitized evidence.
- Protected route load smoke with role-specific staging bearer tokens.
- Authenticated integration-admin upload smoke with a safe sample file.

Tier B - broad-production/operational hardening:

- Supabase staging restore drill into an approved disposable target.
- Alert/error-tracking destination proof or accepted log-retention evidence.
- Broad-production Redis/BullMQ decision and health evidence.

These cannot be honestly closed by local code changes alone. They require real
infrastructure access, real tokens, an approved restore target, or provider
configuration. Do not open another local readiness guard by reflex if the next
missing item is one of these external proofs.

GSD notes:

- Use `gsd.cmd`, not `gsd.ps1`, on Windows.
- `gsd.cmd headless query` works and currently reports M001 complete, M002
  parked, no active slice/task.
- Avoid relying on `gsd.cmd headless status` in this environment; it has hung
  before.

Current pilot scope:

- Continue with existing pilot users for now.
- Do not add new roles yet. User mentioned maybe 1 or 2 roles later, but not now.
- Keep recording real feedback in the active feedback log.
- Run `npm.cmd run check:pilot-stabilization` before a new invite wave or any
  deploy that can affect pilot routes.

## Data And Source Policy

Power BI/Excel outputs remain the chosen operating source for the current pilot.

JSON Source Suspension V1 is the current product decision:
JSON source integration is suspended for the current pilot and Power BI/Excel
operating path.

Do not plan or staff JSON implementation work while Power BI/Excel outputs
remain the chosen operating source.

Future JSON planning reopens only after real JSON-format files, official field
list, delivery/cadence/auth model, and identity semantics exist.

Any future source must still enter through:

- `docs/plans/source-agnostic-import-boundary-v1.md` - Source-Agnostic Import Boundary V1

## Auth And Scope Rules

Important rules:

- `SUPER_ADMIN` can satisfy role requirements, but assigned-store action scope
  still matters on action-scoped endpoints.
- Read scope and action scope must stay separate.
- Low-role ranking users can see ranking/score summary but must not receive
  global KPI metric details.
- Store managers may see managed-store personnel details.
- Store personnel should stay self-scoped.
- Auth fixes must start with a regression test before behavior changes.

Relevant guards:

- `scripts/auth-refresh-flash-contract.test.mjs`
- `admin-web/e2e/store-return-to.spec.ts`
- `admin-web/e2e/pilot-smoke.spec.ts`
- `docs/plans/scope-auth-regression-matrix-v1.md`
- Scope/Auth Regression Matrix V1

## Recent Implementation Notes

Useful traps from the recovered thread:

- On Windows, prefer `npm.cmd` commands. Plain `npm` may hit PowerShell
  execution-policy problems.
- Use `gsd.cmd` for GSD. The PowerShell shim can be blocked by execution
  policy.
- Playwright tests that run against `vite preview` use `admin-web/dist`; build
  first when verifying frontend source changes.
- Do not run parallel Playwright commands that bind the same preview port.
- Some mocked E2E runs can log local proxy `ECONNREFUSED` noise while exiting 0.
  Treat the exit code and targeted rerun as the signal.
- Frontend-only prefetch/smoothness PRs usually need Vercel only, not Render.
- After opening a PR, inspect GitHub checks and Codex bot review/comment
  channels before merge:
  `gh pr checks <n>`, `gh pr view <n> --json comments,reviews,statusCheckRollup`,
  `gh api repos/suleymankuncan-web/CODEX/pulls/<n>/comments`,
  `gh api repos/suleymankuncan-web/CODEX/pulls/<n>/reviews`, and
  `gh api repos/suleymankuncan-web/CODEX/issues/<n>/comments`.
- Do not rely on one slow polling path for Codex approval. Check comments,
  reviews, review comments, reactions, and timeline in parallel/short intervals;
  user-reported GitHub thumbs-up counts as approval evidence when checks are
  green and the PR is mergeable.
- Do not touch unrelated dirty docs, `.gsd`, `.bg-shell`, or local transcript
  files while making product/code slices.

## Current Risk View

Do not do broad refactors for aesthetics.

Known planned refactor candidates still exist, but they are not the best next
move unless a concrete bug or product change requires them:

- `docs/plans/refactor-execution-plan-v1.md`
- `docs/plans/technical-debt-resolution-roadmap-v1.md`
- `admin-web/src/App.tsx`
- `ReportingRepository`
- `IntegrationRepository`
- `AuthAdminRepository`

Rule for new work:

- One PR = one risk reduction, one bug fix, or one feature/product-feel slice.
- Do not mix UI redesign, backend behavior, and refactor in one PR.
- Do not reopen JSON adapter/source-specific work.
- Do not manually edit live `ops.*` data outside guarded workflows.
- Do not commit tokens, cookies, JWTs, local `.env`, generated `dist`,
  `test-results`, `coverage`, `node_modules`, or `outputs/` artifacts.
  `outputs/` is ignored local scratch work.

## Growth Foundation Planning

The local `x.md` conversation record identified the next growth-foundation
risks after the project-flow review: rules/config drift, data-quality trust,
authorization drift, operations visibility, and TypeScript strictness.

The growth-foundation planning line records these as planning and inventory
work:

- `docs/plans/growth-foundation-gap-classification-v1.md`
- `docs/evidence/product-progress/2026-05-21-external-evidence-blocker-refresh.md`
- `docs/plans/rules-config-boundary-decision-v1.md`
- `docs/plans/operations-control-tower-v1.md`
- `docs/plans/authorization-matrix-drift-guard-v1.md`
- `docs/plans/cross-domain-data-quality-inventory-v1.md`
- `docs/plans/frontend-typescript-strictness-inventory-v1.md`

Important outcome:

- Do not build a generic rules engine yet.
- Do not add `dm` or `config` schemas yet.
- Do not change auth, permissions, DB schema, API response shape, CSS, or
  user-facing behavior from this planning line.
- External/live evidence remains blocked until real bearer/provider/restore/
  Redis/upload inputs are provided.
- Frontend strictness has moved past the original inventory: `strict: true`,
  `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` are enabled in
  both frontend TypeScript configs. Keep the exact-optional convention intact:
  omit absent optional API/query/prop fields; use `field: T | undefined` only
  for internal state/view models where the field is always present but not yet
  resolved.
- Operations Control Tower V1 now has a first implementation slice:
  `/admin/operations` is a read-only `SUPER_ADMIN` page using existing health,
  import, snapshot, and blocker signals only. Keep backend aggregation,
  provider config, alert delivery wiring, writes, DB/schema changes, and auth
  model changes parked until separately scoped.
- Cross-domain data-quality V1 now has a first read-only control-tower slice:
  `/admin/operations` summarizes preview error-row pressure, visible mapping
  blocker entity types, blocked import batches, and snapshot issue pressure
  from existing import/snapshot responses only. Dedicated data-quality
  dashboards, mapping workflows, backend aggregation, and DB/API changes stay
  parked.
- Rules / Config Boundary Guard V1 is now represented as a docs/script guard:
  `scripts/rules-config-boundary-contract.test.mjs` protects the boundary
  decision in the root `test:scripts` path. Do not implement a generic rules
  engine, `dm` schema, or `config` schema without a separately scoped
  product/data-governance decision.
- Operations Action List V1 is now represented in `/admin/operations` as a
  read-only action-priority panel over existing signals. Do not turn it into a
  command surface without a separate write/API/auth/DB decision.

## Next Best Work

Recommended next action in this new window:

The current project progress control plan is
`docs/plans/project-progress-plan-v1.md`. Use it as the V1 roadmap for missing
pieces, execution order, verification gates, and stop rules.

If the user brings real external readiness inputs, unpark `M002` and execute
the exact evidence path. Examples: a real staging bearer token, approved
Supabase disposable restore target, alert provider destination, or Redis/BullMQ
Render configuration.

If those external inputs are not available, continue with one narrow
product-hardening slice. Do not begin with another backend/refactor cleanup
unless a concrete blocker appears.

Product Progress Plan V1 status:

- PR #325 added `sokrates.md`, `docs/plans/project-progress-plan-v1.md`, and
  the first visible-flow audit at
  `docs/evidence/product-progress/2026-05-20-visible-flow-audit-v1.md`.
- PR #326 filled the empty `/store/home` store-manager intro/hero copy in
  Turkish and English and records evidence at
  `docs/evidence/product-progress/2026-05-20-store-home-manager-copy.md`.
- PR #327 recorded the latest presence-only external evidence input check at
  `docs/evidence/product-progress/2026-05-20-external-evidence-input-check.md`.
- The first Phase 3 operator coherence slice improved `/admin/master-data`
  store type/status labels without changing submitted values. Evidence:
  `docs/evidence/product-progress/2026-05-20-master-data-store-labels.md`.
- Phase 4 has no active strategic refactor trigger; do not open mechanical
  refactor work without a concrete product/risk slice.
- Phase 5 shaped the Incentive / Prim Module only at intake level and kept it
  out of implementation. Reference:
  `docs/plans/incentive-prim-module-intake-v1.md`.
- External/live evidence remains parked until real staging/provider inputs are
  provided.
- The UI/UX V1 route inventory has been expanded at
  `docs/evidence/product-progress/2026-05-20-uiux-v1-route-inventory.md`.
  It scores all current auth/admin/store routes against V1 criteria and
  recommends the first low-risk implementation slice as the store utility
  handoff family: `/store/settings`, `/store/targets`, and `/store/reports`.
  Do not reopen `/store/home` or `/admin/master-data` without a concrete new
  gap.
- The store utility/handoff V1 slice improved `/store/settings`,
  `/store/targets`, and `/store/reports` with localized boundary/action panels,
  targeted route assertions, and a scoped mobile bottom-nav clearance fix.
  Evidence:
  `docs/evidence/product-progress/2026-05-20-store-utility-handoff-v1.md`.
- The admin reports link-context V1 slice improved `/admin/reports` and
  `/admin/reports/snapshot-runs` by making repeated drill-down links
  snapshot-specific for assistive technology and tightening TR KPI copy.
  Evidence:
  `docs/evidence/product-progress/2026-05-20-admin-reports-link-context-v1.md`.
- The admin import detail mapping-context V1 slice improved
  `/admin/integrations/:batchId` without changing import behavior/layout by
  adding external-ID context to repeated mapping control accessible names.
  Evidence:
  `docs/evidence/product-progress/2026-05-20-import-detail-mapping-context-v1.md`.
- The admin import detail panel-readability V1 slice keeps import
  behavior/layout/copy unchanged and scopes panel-copy contrast to the import
  detail page wrapper. Evidence:
  `docs/evidence/product-progress/2026-05-20-import-detail-panel-readability-v1.md`.
- The reports detail mobile table-readability V1 slice improves the table
  header/action layout across workforce, KPI, checklist, and turnover report
  detail routes. It keeps report API calls, response shapes, auth/permission
  behavior, export/search/sort behavior, copy, and data calculations unchanged.
  Evidence:
  `docs/evidence/product-progress/2026-05-20-reports-detail-mobile-readability-v1.md`.
- The store mobile shell/checklist V1 slice moves shared mobile bottom-nav
  rules into the store command shell, keeps active bottom toolbar icons visible,
  and fixes checklist mobile overflow caused by visit-table selector
  specificity. Evidence:
  `docs/evidence/product-progress/2026-05-20-store-mobile-shell-checklist-v1.md`.
- The first Operations Control Tower V1 slice adds `/admin/operations` as a
  read-only `SUPER_ADMIN` operator surface over existing health/import/snapshot
  signals and external blocker status. Evidence:
  `docs/evidence/product-progress/2026-05-21-operations-control-tower-v1.md`.
- The Operations Data Quality Signal V1 slice adds a read-only data-quality
  snapshot to `/admin/operations` using existing import and snapshot signals.
  Evidence:
  `docs/evidence/product-progress/2026-05-21-operations-data-quality-signal-v1.md`.
- The current Rules / Config Boundary Guard V1 slice adds a root script
  contract test for `docs/plans/rules-config-boundary-decision-v1.md` and keeps
  the first future implementation path limited to one read-only governance
  panel or guard over an existing rule family.
- The current Operations Action List V1 slice adds the top operator next-step
  panel to `/admin/operations` and records evidence at
  `docs/evidence/product-progress/2026-05-21-operations-action-list-v1.md`.
- The current Auth Surface Readability V1 slice keeps auth/admin follow-up
  narrow: route-level browser evidence found low-contrast copy on auth light
  panels, so only the readable text token and targeted e2e assertions are
  changed.
- The current Auth Audit Detail Mobile Evidence V1 slice adds route-level
  mobile overflow coverage for the auth audit detail trio before any further
  visual polish.
- The current Admin Integrations Mobile Evidence V1 slice adds route-level
  mobile overflow coverage for the main integrations screen across its operator
  tabs before any further visual polish.
- The current Admin Checklists Mobile Evidence V1 slice adds route-level mobile
  overflow coverage for the template editor before any visual or interaction
  changes.
- The current Admin Snapshots Mobile Evidence V1 slice adds route-level mobile
  overflow coverage for the snapshot operations overview and snapshot run detail
  before any visual or interaction changes.
- The current Admin Reports Mobile Evidence V1 slice adds route-level mobile
  overflow coverage for the reports summary hub and snapshot run chooser before
  any visual or interaction changes.
- The Competition Team Template Command Boundary Decision V1 slice defined the
  invariants, verification ladder, and stop rules for the
  `CompetitionTeamTemplateCommandRepository` extraction.
- The Competition Team Template Command Repository V1 slice implemented that
  narrow boundary: create/update/deactivate/clone team-template command
  persistence moved into `competition-team-template-command.repository.ts`, and
  `CompetitionRepository` delegates those methods. It did not move
  access-context helpers, stage-package plan writes, stage creation/execution,
  scoring, finalization, API contracts, auth, DB schema, CSS, or user-facing
  behavior.
- The Workforce Request Boundary Inventory V1 slice is docs-only. It maps
  `WorkforceRequestRepository` method families, risk boundaries, existing
  regression tests, and the next safe read-only extraction candidate before any
  workforce request code movement.
- The Workforce Seller Code Read Repository V1 slice implemented that first
  safe code boundary: seller-code list/detail reads move into
  `workforce-seller-code-read.repository.ts`, while
  `WorkforceRequestRepository` remains the service-facing facade. It does not
  move seller-code create/approve/reject/resubmit, duplicate validation,
  offboarding reads, offboarding commands, access lifecycle behavior, API
  contracts, auth, DB schema, CSS, or user-facing behavior.
- The Workforce Offboarding Read Repository V1 slice implemented the second
  safe read boundary: offboarding list/detail reads move into
  `workforce-offboarding-read.repository.ts`, while offboarding
  create/approve/reject/resubmit and access lifecycle closure stay parked in
  `WorkforceRequestRepository`.
- The Workforce Lookup Read Repository V1 slice moved the remaining safe
  store/personnel lookup reads into `workforce-lookup-read.repository.ts`.
- Workforce request safe read-boundary pass is now complete and parked.
  `WorkforceRequestRepository` is roughly 1282 physical lines. The remaining
  repository body is command/write/status/audit/access-lifecycle behavior:
  seller-code create/approve/reject/resubmit, duplicate validation, offboarding
  create/approve/reject/resubmit, employee mutation, turnover event persistence,
  and access lifecycle closure. Do not split that area without a separate
  invariant/test decision.

The `/store/approvals` first pass has started:

- PR #312 closed a real returned-queue error visibility bug.
- PR #313 through PR #315 split the returned, target approval, and submitted
  target panels out of `StoreApprovalsPage.tsx`.
- PR #316 through PR #318 split the target distribution, seller-code, and
  offboarding request forms out of `StoreApprovalsPage.tsx`.
- PR #319 split the pure workbench render tree out of `StoreApprovalsPage.tsx`.
- `StoreApprovalsPage.tsx` is now roughly 625 lines on `origin/main`.

Best next slice if continuing approvals:

1. Pause the mechanical form-extraction line unless a concrete approvals bug or
   readability blocker appears. The page is now below the earlier large-file
   danger zone.
2. If continuing approvals, do a short inventory first: remaining orchestration,
   hook/model, and page-level state boundaries. Open another PR only if one
   clean structural boundary exists without behavior changes.
3. Keep any next approvals slice structural only: no copy, CSS behavior, API,
   auth, or business logic changes.
4. Gate each slice with admin lint/build, the relevant approvals Playwright
   grep, and full `store-surfaces.spec.ts`.
5. If the next split requires changing request state semantics, validation,
   submission behavior, or permissions, stop and re-plan before coding.

Why `/store/approvals` remains a good candidate:

- `/store/rankings` just received a trust/clarity band in PR #242.
- `/store/me` is explicitly parked by user direction.
- Approvals has real business actions, so reliability/readability work reduces
  user risk rather than just polishing visuals.

The `/store/checklists` first pass has started:

- PR #320 split the assigned-store visit panel, table, and row render tree.
- PR #321 split acknowledgement inbox/history panels and the result list/row
  render tree.
- PR #322 split the pure toolbar/tab controls.
- PR #323 split the pure command hero.
- PR #324 split the result detail/acknowledgement modal.
- `StoreChecklistsPage.tsx` is now roughly 922 lines on `origin/main`; it is
  below the earlier danger zone, so pause mechanical splits unless a concrete
  readability or behavior-risk reason appears.
- Best next checklist slice if continuing: do a fresh inventory before coding.
  `ChecklistVisitModal` / the remaining modal wrapper is the main structural
  candidate, but it is medium-to-high risk because it sits near score draft,
  completion, acknowledgement, and autosave state. Split it only if the move is
  purely structural and the same checklist E2E gates stay green.
- Gate checklist slices with admin lint/build, `checklist-today-surfaces.spec.ts`,
  and a targeted `store-surfaces.spec.ts -g "checklist"` run. Use the full
  `store-surfaces.spec.ts` only when the slice reaches broader store shell
  behavior.

General visible-flow inspection list if the user asks for a broader scan:

- Run or open the app and inspect the highest-value visible flows:
   `/store`, `/store/me`, `/store/rankings`, `/store/checklists`,
   `/store/approvals`, `/admin/master-data`, `/admin/integrations`,
   `/admin/checklists`, `/admin/targets`.
- Pick one narrow UI/product polish problem that hurts the "this is a real
  product" feeling.
- Implement it with focused tests and screenshots/browser verification.
- Keep all unrelated dirty files out of the diff.

Good candidates:

- Store home: make the command center and daily action cards feel more finished.
- Rankings: improve first-screen clarity and period/score explanation.
- Store/me: make performance details feel less raw and easier to scan.
- Checklist: tighten result/ack/history surfaces now that the workflow works.
- Admin master/integration/checklist shells: make the command surfaces visually
  and operationally consistent.

Current user direction on 2026-05-18:

- Keep the `/store/me` product-feel slice parked for now.
- Do not open Redis/distributed rate-limit, JSON adapter, or broad refactor work
  without new evidence or an explicit request.
- Readiness is not fully done; it is parked only where live/external evidence is
  required. Code-side readiness work is largely closed.

Avoid:

- Rewrite.
- Broad redesign of the whole app.
- New JSON adapter work.
- New roles unless the user explicitly provides the invite list, assignments,
  and desired role behavior.

## Release And Verification

Root release: `npm.cmd run check:release`

Root release:

```powershell
npm.cmd run check:release
```

Deployed staging smoke:

```powershell
$env:READINESS_FRONTEND_URL='https://staging.hr-axis.com'
$env:READINESS_BACKEND_URL='https://api-staging.hr-axis.com/api'
$env:READINESS_TIMEOUT_MS='45000'
npm.cmd run smoke:deployed-readiness
```

Without `READINESS_BEARER_TOKEN`, auth/session is intentionally skipped. Do not
count that as real auth evidence.

Pilot stabilization:

```powershell
npm.cmd run check:pilot-stabilization
```

Frontend local gates commonly used:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- <target-spec>
```

Backend targeted gate pattern:

```powershell
npm.cmd --prefix backend/nestjs test -- <target-spec> --runInBand
npm.cmd --prefix backend/nestjs run build
```

Migration smoke:

- Migration Fresh DB Smoke V1
- Use `npm.cmd run smoke:migration:fresh-db` only for local disposable DB proof
  or as a manual preflight when DB schema/migration files change.
- Do not run restore or migration smoke against production databases.

## Debt Ledger

Debt ledger:

- Closed active debts: 95
- Superseded before overbuilding: 1
- Blocked external dependency: 1
- Watchlist decision item: 0
- Strategic investment backlog: 7
- Silent untracked quality debt in the active gate: 0

The current debt ledger is `docs/plans/project-debt-ledger.md`.

Project Debt Ledger Consistency Guard V1 keeps this handoff aligned with the
canonical ledger counts.

## Guarded Reference Index

Keep these references because contract tests and future resumes depend on them:

- `docs/plans/backend-foundation-hardening-plan-v1.md` - Backend Foundation Hardening Plan V1
- `docs/plans/backup-restore-drill-runbook-v1.md` - Backup Restore Drill Runbook V1
- `docs/plans/backup-restore-drill-local-evidence-2026-04-30.md` - Backup Restore Local Drill Evidence
- `docs/evidence/pilot-readiness/2026-05-05-controlled-pilot-feedback-log.md` - Controlled Pilot Feedback Log
- `docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-conditional-go-consolidation.md` - Controlled Pilot Conditional Go Consolidation
- `docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-round-1-outcome.md` - Controlled Pilot Round 1 Outcome
- `docs/plans/controlled-pilot-operating-checklist-v1.md` - Controlled Pilot Operating Checklist V1
- `docs/plans/db-health-migration-evidence-v1.md` - DB Health And Migration Evidence V1
- `docs/evidence/pilot-readiness/2026-05-08-render-free-plan-migration-deploy.md` - Render Free Plan Migration Deploy Evidence
- `docs/plans/excel-kpi-import-operator-runbook.md` - Excel KPI Import Operator Runbook V1
- `docs/plans/master-data-bootstrap-pilot-smoke-runbook.md` - Master Data Bootstrap Pilot Smoke Runbook V1
- `docs/plans/mobile-api-bff-endpoint-inventory-v1.md` - Mobile API/BFF Endpoint Inventory V1
- `docs/superpowers/plans/2026-04-28-mobile-checklist-today-v1.md` - Mobile Checklist Today V1
- `docs/superpowers/specs/2026-04-28-mobile-checklist-today-v1-design.md` - Mobile Checklist Today V1 Design
- `docs/plans/monthly-ranking-score-source-contract-v1.md` - Monthly Ranking Score Source Contract V1
- `docs/plans/operator-evidence-consistency-pass-v1.md` - Operator Evidence Consistency Pass V1
- `docs/evidence/pilot-readiness/2026-05-01-preflight-no-go.md` - pilot preflight No-Go evidence
- `docs/plans/pilot-readiness-gate-v1.md` - Pilot Readiness Gate V1
- `docs/plans/project-health-snapshot-2026-05-01.md`
- `docs/plans/project-progress-plan-v1.md` - Project Progress Plan V1
- `docs/plans/refactor-execution-plan-v1.md` - Refactor Execution Plan V1
- `docs/plans/repo-hygiene-contract-v1.md` - Repo Hygiene Guard V1 reference is tracked through the contract tests and debt ledger
- `docs/plans/source-agnostic-import-boundary-v1.md` - Source-Agnostic Import Boundary V1
- `docs/plans/staging-auth-session-edge-evidence-guard-v1.md` - Staging Auth Session Edge Evidence Guard V1
- `docs/plans/test-suite-hygiene-v1.md` - Test Suite Hygiene V1
- `docs/plans/ui-localization-strategy.md` - UI Localization Strategy
- `docs/plans/ui-localization-closeout-v1.md` - UI Localization Closeout V1
- `docs/superpowers/plans/2026-05-06-master-data-validation-promotion-test-split.md` - Master Data Validation/Promotion Test Split V1
