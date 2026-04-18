# Role Assignment Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add DB-backed role assignment management APIs for create, list, and deactivate flows.

**Architecture:** Extend the auth module with an admin-only controller, service, and repository that manage `ops.user_role_assignment` records and emit audit events. Reuse the existing auth context DB resolution so new assignments immediately affect authorization behavior.

**Tech Stack:** NestJS, PostgreSQL, Jest, Supertest, class-validator

---

### Task 1: Lock HTTP contracts with integration tests

**Files:**
- Create: `backend/nestjs/test/integration/auth-role-assignments.e2e-spec.ts`

- [ ] Add failing tests for create, duplicate reject, list, and deactivate
- [ ] Run the focused integration test file and confirm failures

### Task 2: Implement auth admin API slice

**Files:**
- Create: `backend/nestjs/src/modules/auth/auth-admin.repository.ts`
- Create: `backend/nestjs/src/modules/auth/auth-admin.service.ts`
- Create: `backend/nestjs/src/modules/auth/web/auth-admin.controller.ts`
- Create: `backend/nestjs/src/modules/auth/web/dto/create-role-assignment.dto.ts`
- Create: `backend/nestjs/src/modules/auth/web/dto/list-role-assignments.query.ts`
- Modify: `backend/nestjs/src/modules/auth/auth.module.ts`

- [ ] Implement create/list/deactivate repository queries with audit inserts
- [ ] Implement service-level validation and response contracts
- [ ] Wire controller routes and SUPER_ADMIN protection

### Task 3: Verify end-to-end behavior

**Files:**
- Modify: `backend/nestjs/test/integration/auth-role-assignments.e2e-spec.ts` if assertions need cleanup

- [ ] Run focused auth role-assignment tests to green
- [ ] Run `npm test -- --runInBand`
- [ ] Run `npm run build`
