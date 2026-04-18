# Materialization Validation Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden import materialization so batches and raw rows record deterministic validation outcomes, retryability, and failure summaries instead of collapsing every run into a blanket success path.

**Architecture:** Keep the current NestJS integration module shape, but introduce a small materialization outcome model inside the application layer. The materializer will validate each raw row before persistence, classify failures, persist row-level error metadata back into staging tables, and derive final batch status/error counts from aggregated row outcomes.

**Tech Stack:** NestJS, TypeScript, Jest, PostgreSQL

---

### Task 1: Lock behavior with service tests

**Files:**
- Create: `backend/nestjs/src/modules/integration/application/materialization.service.spec.ts`
- Modify: `backend/nestjs/package.json`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Add minimal Jest config if required**
- [ ] **Step 4: Re-run test and keep it red for the expected missing behavior**

### Task 2: Add row validation and batch aggregation

**Files:**
- Modify: `backend/nestjs/src/modules/integration/application/materialization.service.ts`

- [ ] **Step 1: Add a small row outcome model for success, validation failure, and retryable failure**
- [ ] **Step 2: Validate required employee/store/kpi payload fields before writing ops tables**
- [ ] **Step 3: Persist row-level normalized status, processed flags, and error payloads**
- [ ] **Step 4: Aggregate row results into final import batch status and error counts**

### Task 3: Verify targeted regression coverage

**Files:**
- Test: `backend/nestjs/src/modules/integration/application/materialization.service.spec.ts`

- [ ] **Step 1: Run focused Jest tests for materialization service**
- [ ] **Step 2: Confirm red-green expectations were satisfied**
- [ ] **Step 3: Note any remaining gaps that belong to later worker/integration-test phases**
