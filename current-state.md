# Current State - Active Handoff

This is the canonical short handoff for the HR Axis / Store Ops workspace. Keep it concise. Older long-form history lives in committed plans, evidence notes, and the debt ledger.

## Active Workspace

Use this workspace only:

```powershell
D:\store-ops-workspace
```

Do not use the old OneDrive desktop copy or the old `E:\` path for active work.

Primary app endpoints:

- Frontend staging: `https://staging.hr-axis.com`
- Backend staging API: `https://api-staging.hr-axis.com/api`
- Frontend deploy target: Vercel
- Backend deploy target: Render
- Database: Supabase Free Postgres
- Auth provider: Clerk
- Authorization source of truth: application DB role/scope/action-store assignments

## Latest Git State

As of 2026-05-06:

- `origin/main` includes PR #17: `53aa41c7 Merge pull request #17 from suleymankuncan-web/codex/master-data-validation-promotion-test-split`
- Auth refresh flash fix is merged and deployed.
- Master-data validation/promotion test split is merged.
- Current handoff cleanup branch: `codex/close-master-data-test-split-handoff`

If starting in a fresh context after this handoff PR is merged:

```powershell
cd "D:\store-ops-workspace"
git fetch origin
git switch main
git pull --ff-only origin main
Get-Content .\current-state.md
```

## Product Position

Do not restart the project. The project is not debt-free, but it is debt-controlled enough to continue in small verified slices.

Current product shape:

- Store managers use store-scoped operational surfaces.
- Store personnel see their own performance and limited ranking context.
- Region managers and higher roles can see broader ranking/reporting surfaces.
- Admin/HR/integration roles own import, master-data, target, auth, and evidence workflows.

Current pilot stance:

- Controlled staging/internal pilot: `Conditional Go`
- Broad production rollout: not approved yet
- UI quality pass: deliberately deferred
- JSON source adapter: future-only until real payload/source evidence exists

## Recent Pilot Evidence

Key 2026-05-06 evidence:

- `docs/evidence/pilot-readiness/2026-05-06-role-smoke.md`
- `docs/evidence/pilot-readiness/2026-05-06-ranking-privacy-smoke.md`
- `docs/evidence/pilot-readiness/2026-05-06-master-data-power-bi-acceptance.md`
- `docs/evidence/pilot-readiness/2026-05-06-live-protected-api-smoke.md`

Accepted pilot data state:

- Store baseline: accepted for controlled pilot.
- Personnel baseline: accepted for controlled pilot, with known manual cleanup still expected later.
- March 2026 Power BI KPI import: accepted/materialized for pilot validation.
- Store/personnel ranking smoke: passed for privileged and low-role expectations.
- Low-role ranking privacy: global details hidden; managed-store personnel details visible where allowed.

Latest browser feedback:

- `/admin/integrations`, `/admin/master-data`, `/admin/targets`, `/admin/competitions`, `/admin/audit`, `/store`, `/store/me`, `/store/kpis`, `/store/rankings`, and `/store/approvals` were manually toured during pilot stabilization.
- `store/me` and `store/approvals` route issues were fixed and retested.
- Refresh on protected routes no longer visibly falls through `/auth/login` after PR #15; user confirmed the issue appears solved after deploy.

## Auth And Scope Notes

Important rules:

- `SUPER_ADMIN` can satisfy role requirements, but assigned-store action scope still matters on action-scoped endpoints.
- Read scope and action scope must stay separate.
- Low-role ranking users can see ranking/score summary but must not receive global KPI metric details.
- Store managers may see managed-store personnel details; store personnel should stay self-scoped.
- Auth fixes must start with a regression test before behavior changes.

Relevant guards:

- `scripts/auth-refresh-flash-contract.test.mjs`
- `admin-web/e2e/store-return-to.spec.ts`
- `admin-web/e2e/pilot-smoke.spec.ts`
- `docs/plans/scope-auth-regression-matrix-v1.md`
- Scope/Auth Regression Matrix V1

## Current Risk View

Do not do broad refactors for aesthetics.

Known planned refactor candidates:

- `admin-web/src/App.tsx`: routing/auth/store/admin shell concerns are crowded. Split only when a concrete route/UI change touches the boundary.
- `ReportingRepository`, `IntegrationRepository`, `AuthAdminRepository`: planned future boundary splits. Split only with measured need or concrete feature pressure.
- Master-data validation/promotion test split: closed in PR #17 and guarded by the test-suite hygiene contract.
- `current-state.md`: now intentionally concise; do not let it grow back into a full project archive.

Rule for new work:

- One PR = one risk reduction or one feature slice.
- Do not mix UI redesign, backend behavior, and refactor in one PR.
- Do not open guessed JSON adapter work.
- Do not manually edit live `ops.*` data outside guarded workflows.
- Do not commit tokens, cookies, JWTs, local `.env`, generated `dist`, `test-results`, `coverage`, `node_modules`, or `outputs/` artifacts. `outputs/` is ignored local scratch work.

## Release And Verification

Root release: `npm.cmd run check:release`

Pilot stabilization:

```powershell
npm.cmd run check:pilot-stabilization
```

Frontend local gates commonly used:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-return-to.spec.ts pilot-smoke.spec.ts
```

Backend targeted gate pattern:

```powershell
npm.cmd --prefix backend/nestjs test -- <target-spec> --runInBand
npm.cmd --prefix backend/nestjs run build
```

Migration smoke:

- Migration Fresh DB Smoke V1
- Use `npm.cmd run smoke:migration:fresh-db` only for local disposable DB proof or as a manual preflight when DB schema/migration files change.
- Do not run restore or migration smoke against production databases.

## Debt Ledger

Debt ledger:

- Closed active debts: 90
- Superseded before overbuilding: 1
- Blocked external dependency: 2
- Watchlist decision item: 0
- Strategic investment backlog: 7
- Silent untracked quality debt in the active gate: 0

The current debt ledger is `docs/plans/project-debt-ledger.md`.

Project Debt Ledger Consistency Guard V1 keeps this handoff aligned with the canonical ledger counts.

## Guarded Reference Index

Keep these references in this handoff because contract tests and future context resumes depend on them:

- `docs/plans/backend-foundation-hardening-plan-v1.md` - Backend Foundation Hardening Plan V1
- `docs/plans/backup-restore-drill-runbook-v1.md` - Backup Restore Drill Runbook V1
- `docs/plans/backup-restore-drill-local-evidence-2026-04-30.md` - Backup Restore Local Drill Evidence
- `docs/plans/db-health-migration-evidence-v1.md` - DB Health And Migration Evidence V1
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
- `docs/plans/repo-hygiene-contract-v1.md` - Repo Hygiene Guard V1 reference is tracked through the contract tests and debt ledger
- `docs/plans/source-agnostic-import-boundary-v1.md` - Source-Agnostic Import Boundary V1
- `docs/plans/test-suite-hygiene-v1.md` - Test Suite Hygiene V1
- `docs/superpowers/plans/2026-05-06-master-data-validation-promotion-test-split.md` - Master Data Validation/Promotion Test Split V1

## Next Planned Work

Next local foundation step:

- Choose the next small backend/data hardening slice through the intake gate.
- If real staging IdP and seeded DB values are available, run guarded staging auth/action evidence.
- If true store/personnel baseline files are available, run the master-data bootstrap pilot smoke flow from the existing runbook.
- If neither external evidence source is available, keep JSON/source-specific adapter work closed and pick only a local guard that strengthens an existing surface.

Recommended local stance:

- Do not repeat completed test-split work as busywork.
- Do not start UI redesign until a concrete product/UI change requires it.
- Do not start JSON adapter work without real payload/source evidence.
- Do not run master-data promotion without dry-run evidence and sanitized evidence.

## New Context Startup Prompt

Paste this into the next context window:

```text
current-state.md oku; aktif workspace D:\store-ops-workspace. Eski OneDrive ve E:\ yollarini kullanma. Main son durum PR #17 master-data validation/promotion test split'i iceriyor; PR #15 auth refresh flash fix'i deploy sonrasi kullanici tarafindan cozulmus gorundu. Staging frontend https://staging.hr-axis.com, backend https://api-staging.hr-axis.com/api. Controlled staging/internal pilot Conditional Go; broad production rollout henuz Go degil. UI redesign ertelendi. JSON adapter future-only; real payload/source evidence olmadan baslama. Siradaki yerel is intake gate ile secilmeli: staging IdP/seeded DB varsa guarded auth/action evidence, true baseline varsa master-data bootstrap pilot smoke, ikisi de yoksa sadece mevcut yuzeyi guclendiren kucuk bir local guard.
```
