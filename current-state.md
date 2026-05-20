# Current State - Active Handoff

This is the canonical short handoff for the HR Axis / Store Ops workspace.
It summarizes the recovered long Codex thread and the follow-up work through
PR #333, and is the starting point for continuing in a fresh window.

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

As of 2026-05-20, `origin/main` has been fetched through PR #333.
The root checkout may still be on a non-main local branch with unrelated
handoff noise; do not assume the root working tree is clean.

Latest merge on main:

```text
228d9e7e feat: clarify import detail mapping controls (#333)
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
- The admin import detail panel-readability V1 slice is the active next UI/UX
  PR candidate. It keeps import behavior/layout/copy unchanged and scopes
  panel-copy contrast to the import detail page wrapper. Evidence:
  `docs/evidence/product-progress/2026-05-20-import-detail-panel-readability-v1.md`.

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
