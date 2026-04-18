# Reporting Read APIs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first immutable reporting read APIs over `rpt.snapshot_run`, `rpt.store_workforce_snapshot`, and `rpt.store_kpi_snapshot`.

**Architecture:** Build a small reporting slice inside the current NestJS store-ops module with a controller, service, repository, and DTOs. Queries remain read-only and scope-limited via joins to `ops.store`.

**Tech Stack:** NestJS, TypeScript, PostgreSQL, Jest

---

### Task 1: Lock API behavior with integration tests

**Files:**
- Create: `backend/nestjs/test/integration/reporting.e2e-spec.ts`

- [ ] **Step 1: Write failing HTTP tests**
- [ ] **Step 2: Run them and confirm they fail for missing reporting routes**

### Task 2: Add reporting controller/service/repository

**Files:**
- Create: `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts`
- Create: `backend/nestjs/src/modules/store-ops/application/reporting.service.ts`
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/reporting.repository.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/list-snapshot-runs.query.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/get-workforce-report.query.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/get-kpi-report.query.ts`
- Modify: `backend/nestjs/src/modules/store-ops/store-ops.module.ts`

- [ ] **Step 1: Add repository SQL for snapshot runs, workforce snapshots, and KPI snapshots**
- [ ] **Step 2: Add application service mapping**
- [ ] **Step 3: Add controller routes and scope wiring**

### Task 3: Verify

**Files:**
- Test: `backend/nestjs/test/integration/reporting.e2e-spec.ts`

- [ ] **Step 1: Run focused reporting tests**
- [ ] **Step 2: Run full Jest suite**
- [ ] **Step 3: Run Nest build**
