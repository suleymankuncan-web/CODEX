# Role-Based Access Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kritik endpoint'leri rol tabanlı guard ile sertleştirmek

**Architecture:** Yeni decorator ve global guard, mevcut auth/scope guard zincirine eklenecek. Controller seviyesinde minimum rol matrisi tanımlanacak.

**Tech Stack:** NestJS, Jest, Supertest

---

### Task 1: TDD ile failing integration test

**Files:**
- Modify: `backend/nestjs/test/integration/auth-scope.e2e-spec.ts`

- [ ] Import endpoint için yanlış role sahip kullanıcıyı reddeden test ekle.
- [ ] Snapshot endpoint için yanlış role sahip kullanıcıyı reddeden test ekle.
- [ ] Reporting endpoint için uygun role sahip kullanıcıyı kabul eden test ekle.

### Task 2: Auth decorator ve guard

**Files:**
- Create: `backend/nestjs/src/modules/auth/decorators/roles.decorator.ts`
- Create: `backend/nestjs/src/modules/auth/guards/role.guard.ts`
- Modify: `backend/nestjs/src/modules/auth/auth.module.ts`
- Modify: `backend/nestjs/src/modules/auth/providers/mock-auth.provider.ts`

- [ ] `RequireRoles` decorator ekle.
- [ ] `RoleGuard` içinde `SUPER_ADMIN` bypass ve role intersection kontrolü ekle.
- [ ] Mock auth provider'a `x-role-codes` header parsing ekle.

### Task 3: Controller matrisi

**Files:**
- Modify: `backend/nestjs/src/modules/integration/web/integration.controller.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/snapshot.controller.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/reporting.controller.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/checklist.controller.ts`

- [ ] Endpoint'lere uygun `RequireRoles` tanımlarını ekle.

### Task 4: Verify

**Files:**
- Verify only

- [ ] `npm test -- --runInBand`
- [ ] `npm run build`
