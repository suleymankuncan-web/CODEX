# Competition Scoped Read Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open competition standings to store and region users with scoped store contribution details, while keeping HR/Admin write actions isolated.

**Architecture:** Keep the existing competition API as the single read contract and extend its detail payload with scoped store contribution rows. Repository SQL filters contribution rows by company, region, or store read scope; service redacts `teams[].stores` to the caller's visible store set for non-company users. Frontend reuses the same API for admin/region/store read surfaces and hides write controls unless the current role can manage competitions.

**Tech Stack:** PostgreSQL, NestJS, Jest/Supertest, React + Vite + TanStack Query + Playwright.

---

## Source Documents

- `docs/superpowers/plans/2026-04-25-competition-stage-foundation.md`
- `docs/plans/request-intake-and-decision-policy.md`
- `current-state.md`

## Guardrails

- Do not add new write access for `STORE_MANAGER`, `STORE_PERSONNEL`, `REGION_MANAGER`, or `REPORT_VIEWER`.
- Keep `competition.manage` limited to `SUPER_ADMIN` and `HR_ADMIN`.
- Region/store users may see aggregate team standings for visible competitions, but store-level contribution rows must be scoped.
- Non-company users must not receive raw `teams[].stores` entries outside read scope.
- Frontend must not show create/recalculate/finalize buttons to read-only roles.
- Store shell gets a read-only `/store/competitions` page; region manager keeps `/admin/competitions` but in read-only mode.

## File Map

Modify:
- `backend/nestjs/src/modules/store-ops/application/competition.contract.ts` - add store contribution response type.
- `backend/nestjs/src/modules/store-ops/application/competition.service.ts` - redact team stores and include contribution rows.
- `backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts` - service scope regression tests.
- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts` - scoped contribution SQL and mapping.
- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts` - SQL scope filter test.
- `admin-web/src/features/competitions/api.ts` - add contribution type.
- `admin-web/src/pages/CompetitionDashboardPage.tsx` - make write controls role-aware and show contribution rows.
- `admin-web/src/pages/StoreCompetitionsPage.tsx` - new store-facing read-only competition page.
- `admin-web/src/App.tsx` - lazy route and store shell link.
- `admin-web/e2e/competition-surfaces.spec.ts` - admin/region read smoke.
- `admin-web/e2e/store-surfaces.spec.ts` - store competition smoke.
- `current-state.md` - handoff update.

## Tasks

### Task 1: Backend Scoped Detail Contract

- [ ] Add `CompetitionStoreContribution` to `competition.contract.ts` with stage, team, store, date, score, coverage, and missing KPI fields.
- [ ] Write a service test that returns a competition containing one in-scope and one out-of-scope store; assert the response keeps aggregate scores, filters `teams[].stores`, and includes only in-scope `storeContributions`.
- [ ] Run the service test and confirm it fails because `storeContributions` and redaction are not implemented.
- [ ] Implement `listStoreContributionsForCompetition` in `CompetitionRepository`, filtering by `companyIds`, `regionIds`, and `storeIds`.
- [ ] Update `getCompetitionDetail` to call the contribution query and return `storeContributions`.
- [ ] Replace the current forbidden-on-outside-store service behavior with store redaction for non-company users.
- [ ] Run the targeted service/repository tests and commit.

### Task 2: Frontend Read-Only Competition Surfaces

- [ ] Extend frontend competition API types with `storeContributions`.
- [ ] Update `CompetitionDashboardPage` to accept `authSummary`, compute `canManageCompetitions`, hide create/recalculate/finalize controls for read-only roles, and show a scoped contribution section.
- [ ] Add `StoreCompetitionsPage` using the same list/detail queries in read-only mode.
- [ ] Add `/store/competitions` lazy route and a store shell link.
- [ ] Keep page copy compact, data-first, and mobile-friendly using existing panels, metric cards, and stacked rows.

### Task 3: Smoke Coverage And Handoff

- [ ] Update Playwright fixtures with scoped `storeContributions`.
- [ ] Add smoke checks that region manager sees contribution rows but no manage buttons.
- [ ] Add smoke checks that store manager opens `/store/competitions` and sees only scoped contribution details.
- [ ] Run frontend release check.
- [ ] Run backend release check.
- [ ] Update `current-state.md`, commit, and verify clean git status.

## Verification Commands

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts --runInBand
npm.cmd run check:release
```

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run check:release
```

## Self-Review

- Scope is focused on read visibility and contribution detail, not tournament bracket logic.
- No placeholder decisions remain.
- Backend contract and frontend type names use the same camelCase fields.
- Read-only roles get visibility without write controls.
