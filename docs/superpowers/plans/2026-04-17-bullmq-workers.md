# BullMQ Workers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated BullMQ worker process that consumes import and snapshot jobs via existing NestJS services.

**Architecture:** A worker-only Nest application context will host a BullMQ worker manager service. That service will create queue consumers only when the configured backend is `bullmq`, route import jobs into `MaterializationService`, and route snapshot jobs into `SnapshotService`.

**Tech Stack:** NestJS, BullMQ, IORedis, Jest, TypeScript

---

### Task 1: Lock worker host behavior with tests

**Files:**
- Create: `backend/nestjs/src/shared/jobs/bullmq-worker-host.service.spec.ts`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run the tests and confirm they fail for missing worker host behavior**

### Task 2: Implement worker host and bootstrap

**Files:**
- Create: `backend/nestjs/src/shared/jobs/bullmq-worker-host.service.ts`
- Create: `backend/nestjs/src/worker.module.ts`
- Create: `backend/nestjs/src/workers.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/snapshot.service.ts`
- Modify: `backend/nestjs/package.json`

- [ ] **Step 1: Add a BullMQ worker host service**
- [ ] **Step 2: Expose snapshot execution for worker use**
- [ ] **Step 3: Add worker-only Nest bootstrap**
- [ ] **Step 4: Add start script for worker process**

### Task 3: Verify worker build and tests

**Files:**
- Test: `backend/nestjs/src/shared/jobs/bullmq-worker-host.service.spec.ts`

- [ ] **Step 1: Run focused Jest tests**
- [ ] **Step 2: Run full test suite**
- [ ] **Step 3: Run Nest build**
