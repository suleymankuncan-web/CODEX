# Master Data Bootstrap Store Promotion V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote readiness-approved store bootstrap rows into `ops.store` while keeping personnel promotion closed.

**Architecture:** Extend store-row normalization/validation with store name and region evidence, add a repository transaction that upserts `ops.store` and marks staged rows promoted, then expose one HR/Admin command endpoint.

**Tech Stack:** NestJS, PostgreSQL, Jest, existing RBAC decorators, root `check:release`.

---

## File Structure

- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`: service TDD coverage for store validation readiness and promotion guard behavior.
- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts`: store metadata normalization, validation additions, and `promoteStoreBootstrapBatch`.
- `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts`: repository SQL guard for store upsert and staged promotion evidence.
- `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.ts`: `resolveRegionByCode` and `promoteStoreBootstrapRows`.
- `backend/nestjs/src/modules/integration/web/integration.controller.ts`: store promotion endpoint.
- `docs/superpowers/specs/2026-04-29-master-data-bootstrap-store-promotion-v1-design.md`: approved design.
- `docs/superpowers/plans/2026-04-29-master-data-bootstrap-store-promotion-v1.md`: this plan.
- `docs/superpowers/plans/2026-04-29-personnel-master-data-bootstrap-v1.md`: completed slice note.
- `docs/plans/project-debt-ledger.md`: debt count update after verification and commit.

## Task 1: Store Validation Inputs

**Files:**

- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts`
- Modify: `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.ts`

- [x] **Step 1: Write failing tests**

Add tests proving:

- store staging normalizes `storeName`, `regionCode`, and `status`
- new store row without region code becomes `needs_review` with `missing_region_code`
- new store row with unknown region code becomes `needs_review` with `unmapped_region`
- new store row with resolved region becomes `valid`

- [x] **Step 2: Run red test**

Run:

```powershell
npm.cmd test -- src/modules/integration/application/master-data-bootstrap.service.spec.ts --runInBand
```

Expected result:

```text
Expected normalizedStoreName or resolvedRegionId but received null/undefined
```

- [x] **Step 3: Implement normalization and validation**

Add store-name, region-code, status normalization and `resolveRegionByCode`.

- [x] **Step 4: Run green test**

Run:

```powershell
npm.cmd test -- src/modules/integration/application/master-data-bootstrap.service.spec.ts --runInBand
```

Expected result:

```text
PASS src/modules/integration/application/master-data-bootstrap.service.spec.ts
```

## Task 2: Repository Store Promotion Transaction

**Files:**

- Modify: `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.ts`

- [x] **Step 1: Write failing repository test**

Add a test proving `promoteStoreBootstrapRows`:

- uses `INSERT INTO ops.store`
- uses `ON CONFLICT (store_code) DO UPDATE`
- updates `stg.master_data_bootstrap_row` to `promoted`
- refreshes `stg.master_data_bootstrap_batch`
- does not touch `ops.employee`

- [x] **Step 2: Run red repository test**

Run:

```powershell
npm.cmd test -- src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts --runInBand
```

Expected result:

```text
Property 'promoteStoreBootstrapRows' does not exist
```

- [x] **Step 3: Implement transaction**

Add a repository transaction that upserts stores, marks staged rows promoted, and refreshes counters.

- [x] **Step 4: Run green repository test**

Run:

```powershell
npm.cmd test -- src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts --runInBand
```

Expected result:

```text
PASS src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts
```

## Task 3: Service Command And Endpoint

**Files:**

- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts`
- Modify: `backend/nestjs/src/modules/integration/web/integration.controller.ts`

- [x] **Step 1: Write failing service tests**

Add tests proving:

- personnel batch promotion is rejected
- store batch not `ready_to_promote` is rejected
- ready store rows are sent to repository promotion
- already promoted rows are skipped

- [x] **Step 2: Run red service test**

Run:

```powershell
npm.cmd test -- src/modules/integration/application/master-data-bootstrap.service.spec.ts --runInBand
```

Expected result:

```text
Property 'promoteStoreBootstrapBatch' does not exist
```

- [x] **Step 3: Implement service command and controller endpoint**

Add `promoteStoreBootstrapBatch` and:

```text
POST /api/integrations/master-data-bootstrap/batches/:batchId/promote-stores
```

- [x] **Step 4: Run targeted backend tests**

Run:

```powershell
npm.cmd test -- master-data-bootstrap --runInBand
```

Expected result:

```text
PASS master-data-bootstrap targeted suites
```

## Task 4: Documentation, Verification, And Commit

**Files:**

- Modify: `docs/superpowers/plans/2026-04-29-personnel-master-data-bootstrap-v1.md`
- Modify: `docs/plans/project-debt-ledger.md`
- Modify: `docs/superpowers/plans/2026-04-29-master-data-bootstrap-store-promotion-v1.md`

- [x] **Step 1: Update bootstrap implementation plan**

Add completed slice `V1-D Store Promotion`.

- [x] **Step 2: Update project debt ledger**

Increment closed active debts by one and add `Master Data Bootstrap Store Promotion V1`.

- [x] **Step 3: Run verification**

Run from backend:

```powershell
npm.cmd test -- master-data-bootstrap --runInBand
npm.cmd run lint
npm.cmd run build
```

Then run from repo root:

```powershell
npm.cmd run check:release
```

Expected result:

```text
targeted bootstrap tests pass
backend lint passes
backend build passes
root check:release passes
```

- [x] **Step 4: Stage only related files**

Do not stage `outputs/`.

- [x] **Step 5: Commit implementation**

Run:

```powershell
git commit -m "feat: promote reviewed store bootstrap rows"
```

Expected:

```text
[chore/actions-node24-runtime <sha>] feat: promote reviewed store bootstrap rows
```

## Self-Review Notes

Spec coverage:

- store-only promotion: Task 3
- no personnel writes: Task 2 and Task 3
- ready-row guard: Task 3
- store upsert/idempotency: Task 2
- staged row promotion evidence: Task 2
- validation prerequisites: Task 1
- docs/debt/release gate: Task 4

Personnel promotion remains a future slice.
