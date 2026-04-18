# Snapshot Observability and Rerun Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import health state, snapshot observability, and immutable snapshot rerun behaviorını backend'e eklemek

**Architecture:** Import tarafında derived health state service katmanında hesaplanacak. Snapshot tarafında ayrı operasyon repository/service/controller akışı kurulacak ve rerun her zaman yeni `snapshot_run` üretecek.

**Tech Stack:** NestJS, PostgreSQL, Jest, Supertest

---

### Task 1: Snapshot şema ve contract hazırlığı

**Files:**
- Modify: `db/schema.sql`
- Create: `db/migrations/007_snapshot_observability_and_rerun.sql`
- Modify: `backend/nestjs/src/shared/jobs/job-payloads.ts`

- [ ] `rpt.snapshot_run` için `started_at`, `finished_at`, `failure_reason`, `rerun_of_snapshot_run_id` alanlarını ekle.
- [ ] Snapshot job payload'ına gerekirse rerun senaryosunu taşıyacak alanları eklemeden aynı payload ile ilerle; YAGNI dışına çıkma.

### Task 2: Failing testleri yaz

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/application/snapshot.service.spec.ts`
- Modify: `backend/nestjs/test/integration/snapshot-run.e2e-spec.ts`
- Modify: `backend/nestjs/test/integration/import-batch.e2e-spec.ts`

- [ ] Import health state için failing assertions ekle.
- [ ] Snapshot list/detail/audit/rerun için failing integration testleri ekle.
- [ ] Snapshot rerun'ın yeni run ürettiğini doğrulayan failing service testini ekle.

### Task 3: Snapshot repository ve service davranışı

**Files:**
- Create: `backend/nestjs/src/modules/store-ops/infrastructure/snapshot-operations.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/snapshot.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/store-ops.module.ts`

- [ ] Snapshot list/detail/summary/audit sorgularını repository'ye taşı.
- [ ] Worker lifecycle için status ve timestamp güncellemelerini ekle.
- [ ] Rerun isteğinde yeni snapshot run üret ve audit event yaz.

### Task 4: Controller ve DTO yüzeyi

**Files:**
- Modify: `backend/nestjs/src/modules/store-ops/web/snapshot.controller.ts`
- Create: `backend/nestjs/src/modules/store-ops/web/dto/list-snapshot-run-operations.query.ts`

- [ ] Liste, summary, detail, audit ve rerun route'larını ekle.
- [ ] Pagination ve filtre DTO'sunu ekle.

### Task 5: Import health state

**Files:**
- Modify: `backend/nestjs/src/modules/integration/application/integration.service.ts`

- [ ] Import list/detail response'larına `healthState` ekle.
- [ ] Import summary response'una health state toplamları ekle.

### Task 6: Verify

**Files:**
- Verify only

- [ ] `npm test -- --runInBand`
- [ ] `npm run build`
