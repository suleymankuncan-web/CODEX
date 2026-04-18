# External ID Mapping And Position Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add canonical external ID resolution support and a new `position` import flow so dependent imports can resolve reference data cleanly.

**Architecture:** Introduce a shared mapping service inside the integration module, add `stg.position_raw`, and route `position` through the same import batch and observability flow as existing entities. Update assignment materialization to use the shared resolver/upserter instead of scattered direct map queries.

**Tech Stack:** NestJS, TypeScript, PostgreSQL, Jest

---

### Task 1: Lock behavior with tests

**Files:**
- Modify: `backend/nestjs/src/modules/integration/application/materialization.service.spec.ts`
- Modify: `backend/nestjs/test/integration/import-batch.e2e-spec.ts`

- [ ] Add a failing service test for successful `position` materialization and mapping writeback
- [ ] Add a failing service test for invalid `position` rows
- [ ] Add a failing integration test for `entityType=position`

### Task 2: Add staging and API support

**Files:**
- Modify: `db/schema.sql`
- Create: `db/migrations/004_position_import_support.sql`
- Modify: `backend/nestjs/src/modules/integration/web/dto/create-import-batch.dto.ts`
- Modify: `backend/nestjs/src/modules/integration/application/integration.service.ts`
- Modify: `backend/nestjs/src/modules/integration/infrastructure/integration.repository.ts`

- [ ] Add `stg.position_raw`
- [ ] Accept `position` in import batch creation and observability paths
- [ ] Persist staged position rows

### Task 3: Introduce shared mapping service and position materialization

**Files:**
- Create: `backend/nestjs/src/modules/integration/application/external-id-mapping.service.ts`
- Modify: `backend/nestjs/src/modules/integration/application/materialization.service.ts`
- Modify: `backend/nestjs/src/modules/integration/integration.module.ts`

- [ ] Add shared mapping resolve/upsert methods
- [ ] Implement `position` materialization into `ops.position`
- [ ] Route assignment mapping calls through the shared service

### Task 4: Verify

**Files:**
- Test: `backend/nestjs/src/modules/integration/application/materialization.service.spec.ts`
- Test: `backend/nestjs/test/integration/import-batch.e2e-spec.ts`

- [ ] Run focused tests
- [ ] Run full Jest suite
- [ ] Run Nest build
