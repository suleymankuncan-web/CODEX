# First-Wave Integration Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first real HTTP integration tests for critical async backend flows and auth scope enforcement.

**Architecture:** Use Nest testing to boot an in-memory application from `AppModule`, overriding the database and job dispatcher with deterministic fakes. Tests will validate controller, guard, DTO, and service wiring without requiring live PostgreSQL or Redis.

**Tech Stack:** NestJS testing, Jest, TypeScript

---

### Task 1: Add shared integration test harness

**Files:**
- Create: `backend/nestjs/test/integration/test-app.ts`

- [ ] **Step 1: Write the failing consumer tests first**
- [ ] **Step 2: Add a reusable app bootstrap helper with provider overrides**

### Task 2: Add import and snapshot integration tests

**Files:**
- Create: `backend/nestjs/test/integration/import-batch.e2e-spec.ts`
- Create: `backend/nestjs/test/integration/snapshot-run.e2e-spec.ts`

- [ ] **Step 1: Write failing HTTP tests**
- [ ] **Step 2: Run tests and confirm missing harness/dependency behavior**
- [ ] **Step 3: Implement the minimum overrides needed to pass**

### Task 3: Add auth scope regression and checklist placeholder

**Files:**
- Create: `backend/nestjs/test/integration/auth-scope.e2e-spec.ts`
- Create: `backend/nestjs/test/integration/checklist-flow.e2e-spec.ts`

- [ ] **Step 1: Add one real out-of-scope regression**
- [ ] **Step 2: Add a minimal checklist flow smoke test or explicit skip placeholder**

### Task 4: Verify all tests and build

**Files:**
- Test: `backend/nestjs/test/integration/*.ts`

- [ ] **Step 1: Run focused integration tests**
- [ ] **Step 2: Run full Jest suite**
- [ ] **Step 3: Run Nest build**
