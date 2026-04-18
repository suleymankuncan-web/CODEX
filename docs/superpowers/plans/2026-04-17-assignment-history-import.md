# Assignment History Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `assignment` import support so assignment history can be staged, validated, mapped, and materialized into `ops.employee_assignment_history`.

**Architecture:** Introduce a separate staging table and materialization branch for assignment rows. Keep the existing import batch/worker flow, but add assignment-specific validation and external ID resolution.

**Tech Stack:** NestJS, TypeScript, PostgreSQL, Jest

---

### Task 1: Lock assignment behavior with tests

**Files:**
- Modify: `backend/nestjs/src/modules/integration/application/materialization.service.spec.ts`
- Modify: `backend/nestjs/test/integration/import-batch.e2e-spec.ts`

- [ ] **Step 1: Add failing materialization tests for valid and invalid assignment rows**
- [ ] **Step 2: Add failing import endpoint test for `entityType=assignment`**

### Task 2: Add assignment staging support

**Files:**
- Modify: `db/schema.sql`
- Create: `db/migrations/003_assignment_import_support.sql`
- Modify: `backend/nestjs/src/modules/integration/web/dto/create-import-batch.dto.ts`
- Modify: `backend/nestjs/src/modules/integration/infrastructure/integration.repository.ts`
- Modify: `backend/nestjs/src/modules/integration/application/integration.service.ts`

- [ ] **Step 1: Add `stg.assignment_raw` schema**
- [ ] **Step 2: Accept `entityType=assignment` in API and repository**
- [ ] **Step 3: Persist assignment raw rows**

### Task 3: Implement assignment materialization

**Files:**
- Modify: `backend/nestjs/src/modules/integration/application/materialization.service.ts`

- [ ] **Step 1: Add assignment branch in batch dispatcher**
- [ ] **Step 2: Resolve internal IDs and region**
- [ ] **Step 3: Upsert assignment history**
- [ ] **Step 4: Track assignment external ID mappings and row statuses**

### Task 4: Verify

**Files:**
- Test: `backend/nestjs/src/modules/integration/application/materialization.service.spec.ts`
- Test: `backend/nestjs/test/integration/import-batch.e2e-spec.ts`

- [ ] **Step 1: Run focused tests**
- [ ] **Step 2: Run full Jest suite**
- [ ] **Step 3: Run Nest build**
