# Phase 2 Admin Operability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clean Phase 2 admin-operability surfaces without introducing a cross-cutting god module.

**Architecture:** Keep ownership inside bounded contexts. Integration owns source management and integration lookups, auth owns auth lookups, and snapshot owns rerun governance plus snapshot lookups. Reuse existing controller/service/repository slices and current response contracts.

**Tech Stack:** NestJS, PostgreSQL, Jest, Supertest, class-validator

---

### Scope

- Integration
  - source management CRUD-lite: list/create/deactivate/reactivate
  - integration lookups
- Auth
  - auth lookups
- Snapshot
  - snapshot lookups
  - rerun governance: `rerunAllowed`, `rerunBlockedReason`, duplicate active rerun guard

### Files

- Modify: `backend/nestjs/src/modules/integration/web/integration.controller.ts`
- Modify: `backend/nestjs/src/modules/integration/application/integration.service.ts`
- Modify: `backend/nestjs/src/modules/integration/infrastructure/integration.repository.ts`
- Create: `backend/nestjs/src/modules/integration/web/dto/create-integration-source.dto.ts`
- Create: `backend/nestjs/src/modules/integration/web/dto/list-integration-sources.query.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/snapshot.controller.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/snapshot.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/snapshot-operations.repository.ts`
- Modify: `backend/nestjs/src/modules/auth/web/auth-admin.controller.ts`
- Modify: `backend/nestjs/src/modules/auth/auth-admin.service.ts`
- Modify: `backend/nestjs/src/modules/auth/auth-admin.repository.ts`
- Modify: `backend/nestjs/test/integration/import-batch.e2e-spec.ts`
- Modify: `backend/nestjs/test/integration/auth-role-assignments.e2e-spec.ts`
- Modify: `backend/nestjs/test/integration/snapshot-run.e2e-spec.ts`
- Modify: `docs/api/store-ops-api-contracts.md`
- Modify: `docs/status/implementation-summary.md`

### Sequence

1. Write failing integration tests for source management and integration lookups.
2. Write failing integration tests for auth lookups.
3. Write failing integration tests for snapshot lookups and rerun governance.
4. Implement minimal repository/service/controller support in each bounded context.
5. Update API docs and implementation summary.
6. Run focused tests, full suite, and build.
