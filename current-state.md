# Current State - Active Handoff

This is the canonical short handoff for the HR Axis / Store Ops workspace.
It summarizes the recovered long Codex thread through PR #186 and is the
starting point for continuing in this window.

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

As of 2026-05-16, local `main` is aligned with `origin/main`.

Latest merge on main:

```text
a2843c69 Merge pull request #186 from suleymankuncan-web/codex/admin-targets-data-prefetch
```

The recent performance/prefetch line is merged through:

- PR #179 `store-tasks-data-prefetch`
- PR #180 `store-task-checklist-prefetch`
- PR #181 `store-task-approval-prefetch`
- PR #182 `store-home-checklist-prefetch`
- PR #183 `store-sidebar-data-prefetch`
- PR #184 `admin-sidebar-data-prefetch`
- PR #185 `admin-inbox-data-prefetch`
- PR #186 `admin-targets-data-prefetch`

These were frontend-side route/data prefetch and transition smoothness slices.
Vercel deploy is enough for those; Render deploy was not required.

Known local working tree noise at recovery time:

- `docs/plans/feature-backlog.md` modified
- `.bg-shell/` untracked
- `.gsd/` untracked
- `docs/superpowers/plans/2026-05-13-checklist-command-surfaces-v1.md` untracked
- `docs/superpowers/specs/2026-05-12-coach-insight-rules-v1-design.md` untracked
- `thread-019dfcf6-6c3c-7470-81dd-9513de42746d-transcript.md` untracked recovery transcript

Do not stage, delete, or "clean up" those unless the user explicitly asks.

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
- Playwright tests that run against `vite preview` use `admin-web/dist`; build
  first when verifying frontend source changes.
- Do not run parallel Playwright commands that bind the same preview port.
- Some mocked E2E runs can log local proxy `ECONNREFUSED` noise while exiting 0.
  Treat the exit code and targeted rerun as the signal.
- Frontend-only prefetch/smoothness PRs usually need Vercel only, not Render.
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

Start a visible product-feel sprint. Do not begin with another backend/refactor
cleanup unless a concrete blocker appears.

Best first slice:

1. Run or open the app and inspect the highest-value visible flows:
   `/store`, `/store/me`, `/store/rankings`, `/store/checklists`,
   `/store/approvals`, `/admin/master-data`, `/admin/integrations`,
   `/admin/checklists`, `/admin/targets`.
2. Pick one narrow UI/product polish problem that hurts the "this is a real
   product" feeling.
3. Implement it with focused tests and screenshots/browser verification.
4. Keep all unrelated dirty files out of the diff.

Good candidates:

- Store home: make the command center and daily action cards feel more finished.
- Rankings: improve first-screen clarity and period/score explanation.
- Store/me: make performance details feel less raw and easier to scan.
- Checklist: tighten result/ack/history surfaces now that the workflow works.
- Admin master/integration/checklist shells: make the command surfaces visually
  and operationally consistent.

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

- Closed active debts: 94
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
- `docs/plans/refactor-execution-plan-v1.md` - Refactor Execution Plan V1
- `docs/plans/repo-hygiene-contract-v1.md` - Repo Hygiene Guard V1 reference is tracked through the contract tests and debt ledger
- `docs/plans/source-agnostic-import-boundary-v1.md` - Source-Agnostic Import Boundary V1
- `docs/plans/staging-auth-session-edge-evidence-guard-v1.md` - Staging Auth Session Edge Evidence Guard V1
- `docs/plans/test-suite-hygiene-v1.md` - Test Suite Hygiene V1
- `docs/plans/ui-localization-strategy.md` - UI Localization Strategy
- `docs/plans/ui-localization-closeout-v1.md` - UI Localization Closeout V1
- `docs/superpowers/plans/2026-05-06-master-data-validation-promotion-test-split.md` - Master Data Validation/Promotion Test Split V1
