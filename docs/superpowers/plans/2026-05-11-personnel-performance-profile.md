# Personnel Performance Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure `/store/personnel/:employeeId` profile that opens from Rankings personnel details and shows the same v2 performance data surface for the selected employee.

**Architecture:** Reuse the existing `my-performance` calculation by adding a target-employee service path with server-side scope checks. Split the frontend v2 performance UI into a shared `PersonnelPerformanceSurface` so `/store/me` and `/store/personnel/:employeeId` share rendering while using different data loaders.

**Tech Stack:** NestJS reporting controller/service/repository, React + React Router, TanStack Query, Playwright e2e, Jest backend tests.

---

### Task 1: Backend Personnel Profile Contract

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts`
- Test: `backend/nestjs/src/modules/store-ops/application/reporting.service.kpi-benchmark-scoring.spec.ts`
- Test: `backend/nestjs/src/modules/store-ops/web/reporting.controller.store-score-blend.spec.ts`

- [x] Add repository method `getActiveEmployeeAssignmentScope(employeeId)` returning `employee_id`, `company_id`, `region_id`, `store_id`, names, and external ref from active assignment.
- [x] Add `ReportingService.getPersonnelPerformance(input)` that validates requested employee scope before calling the existing live/closed performance logic with `targetEmployeeId`.
- [x] Keep `getMyPerformance` behavior unchanged by resolving the current employee from auth identity.
- [x] Add controller route `GET /reports/personnel-performance/:employeeId` with roles `STORE_PERSONNEL`, `STORE_MANAGER`, `REGION_MANAGER`, `SUPER_ADMIN`.
- [x] Add tests proving store personnel cannot read another employee, store manager can read assigned-store employees, region manager can read region employees, and controller passes role/scope/actionScope to service.

### Task 2: Frontend Shared Performance Surface

**Files:**
- Modify: `admin-web/src/pages/StoreMyPerformancePage.tsx`
- Create: `admin-web/src/pages/StorePersonnelPerformancePage.tsx`
- Modify: `admin-web/src/app/route-loaders.ts`
- Modify: `admin-web/src/app/store-shell.tsx`
- Modify: `admin-web/src/features/reports/api.ts`
- Modify: `admin-web/src/features/localization/messages/store-me.ts`

- [x] Reuse the current v2 `StoreMyPerformancePage` surface through profile-mode props so `/store/me` and `/store/personnel/:employeeId` share rendering.
- [x] Keep `/store/me` loading `getMyPerformance`.
- [x] Add `getPersonnelPerformance(employeeId, params)` using `/reports/personnel-performance/:employeeId`.
- [x] Add `/store/personnel/:employeeId` route that renders the shared surface in read-only profile mode.
- [x] Add localization keys for personnel profile title, unavailable state, and detail navigation.
- [x] Keep CR absent from every personnel KPI view.

### Task 3: Rankings Navigation

**Files:**
- Modify: `admin-web/src/pages/StoreRankingsPage.tsx`
- Modify: `admin-web/src/features/localization/messages/store-rankings.ts`
- Test: `admin-web/e2e/store-surfaces.spec.ts`

- [x] Add `Detaya git` action in the personnel detail drawer.
- [x] Navigate to `/store/personnel/:employeeId` when clicked.
- [x] Do not show store-personnel profile navigation for store rows.
- [x] Add e2e test: open rankings, switch to personnel list, open a person, click detail, assert profile route and v2 profile content.

### Task 4: Verification and Release

**Files:**
- Test only: backend and admin-web test suites.

- [x] Run backend targeted Jest tests for reporting service/controller.
- [x] Run `npm.cmd --prefix backend/nestjs run lint`.
- [x] Run `npm.cmd --prefix backend/nestjs run build`.
- [x] Run `npm.cmd --prefix admin-web run lint`.
- [x] Run `npm.cmd --prefix admin-web run test:scripts`.
- [x] Run `npm.cmd --prefix admin-web run build`.
- [x] Run `$env:CI='1'; npm.cmd --prefix admin-web run test:e2e`.
- [x] Run a Playwright visual smoke for `/store/personnel/:employeeId`.
- [ ] Commit and open a PR stacked on the current v2 store/me branch.

## Self-Review

- Scope is one feature: personnel profile route launched from rankings.
- No intentional placeholders remain; endpoint, route, tests, and validation are explicit.
- Security is server-side: frontend navigation is convenience only, service enforces scope.
