# Import Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend import batch APIs with actionable failure categories and dependency summaries.

**Architecture:** Reuse the current integration controller/service/repository slice. Repository stays responsible for raw-table reads and aggregate SQL; service maps low-level row state into API-friendly `errorCategory` and `dependencySummary` contracts.

**Tech Stack:** NestJS, TypeScript, PostgreSQL, Jest, Supertest

---

### Task 1: Lock HTTP contract with tests

**Files:**
- Modify: `backend/nestjs/test/integration/import-batch.e2e-spec.ts`

- [ ] Add a failing integration test for `dependencySummary` on batch detail
- [ ] Add a failing integration test for `errorCategory` on batch errors

### Task 2: Implement repository aggregates

**Files:**
- Modify: `backend/nestjs/src/modules/integration/infrastructure/integration.repository.ts`

- [ ] Add dependency summary SQL over raw staging tables
- [ ] Preserve existing paginated error query contract

### Task 3: Implement service mapping

**Files:**
- Modify: `backend/nestjs/src/modules/integration/application/integration.service.ts`

- [ ] Add `dependencySummary` to batch detail responses
- [ ] Classify each error row into `validation`, `missing_dependency`, or `write_failure`

### Task 4: Verify

**Files:**
- Test: `backend/nestjs/test/integration/import-batch.e2e-spec.ts`

- [ ] Run focused integration tests
- [ ] Run full Jest suite
- [ ] Run Nest build
