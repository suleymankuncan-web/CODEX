# Master Data Bootstrap Promotion Readiness V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only promotion readiness endpoint for staged master-data bootstrap batches before implementing live promotion.

**Architecture:** Reuse `getScopedBootstrapBatch` and staged row reads. Classify rows in `MasterDataBootstrapService`, expose the read model through `IntegrationController`, and extend repository row mapping to include `promotedEntityId`.

**Tech Stack:** NestJS, PostgreSQL, Jest, existing RBAC decorators, root `check:release`.

---

## File Structure

- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`: service tests for row readiness and batch summary.
- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts`: readiness classification and response builder.
- `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts`: repository guard for `promoted_entity_id` read mapping.
- `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.ts`: expose `promotedEntityId` on staged rows.
- `backend/nestjs/src/modules/integration/web/integration.controller.ts`: read-only endpoint.
- `docs/superpowers/specs/2026-04-29-master-data-bootstrap-promotion-readiness-v1-design.md`: approved design.
- `docs/superpowers/plans/2026-04-29-master-data-bootstrap-promotion-readiness-v1.md`: this plan.
- `docs/superpowers/plans/2026-04-29-personnel-master-data-bootstrap-v1.md`: completed slice note.
- `docs/plans/project-debt-ledger.md`: debt count update after verification and commit.

## Task 1: Service Readiness Contract

**Files:**

- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts`

- [x] **Step 1: Write failing service tests**

Add tests for:

- pending row -> `needs_validation` and `nextAction: validate_batch`
- invalid/needs-review row -> blocked/review counters and `nextAction: review_rows`
- ready batch with valid rows -> `canPromote: true` and `nextAction: promote_ready_rows`
- promoted row -> `already_promoted`, not ready

- [x] **Step 2: Run red test**

Run:

```powershell
npm.cmd test -- src/modules/integration/application/master-data-bootstrap.service.spec.ts --runInBand
```

Expected result:

```text
Property 'getBootstrapPromotionReadiness' does not exist on type 'MasterDataBootstrapService'
```

- [x] **Step 3: Implement minimal service contract**

Add `getBootstrapPromotionReadiness`, row classification helpers, summary counters, and `nextAction` derivation.

- [x] **Step 4: Run green service test**

Run:

```powershell
npm.cmd test -- src/modules/integration/application/master-data-bootstrap.service.spec.ts --runInBand
```

Expected result:

```text
PASS src/modules/integration/application/master-data-bootstrap.service.spec.ts
```

## Task 2: Repository Promoted Entity Evidence

**Files:**

- Modify: `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.ts`

- [x] **Step 1: Write failing repository test**

Add a test proving `listBootstrapRows` maps `promoted_entity_id` into `promotedEntityId` and reads only staging rows.

- [x] **Step 2: Run red repository test**

Run:

```powershell
npm.cmd test -- src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts --runInBand
```

Expected result:

```text
Expected promotedEntityId to equal the staged promoted entity id
```

- [x] **Step 3: Implement repository mapping**

Add `promoted_entity_id` to staged row selects and map it to `promotedEntityId`.

- [x] **Step 4: Run green repository test**

Run:

```powershell
npm.cmd test -- src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts --runInBand
```

Expected result:

```text
PASS src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts
```

## Task 3: Controller Endpoint

**Files:**

- Modify: `backend/nestjs/src/modules/integration/web/integration.controller.ts`
- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`

- [x] **Step 1: Add endpoint**

Add:

```text
GET /api/integrations/master-data-bootstrap/batches/:batchId/promotion-readiness
```

Keep it before `GET /master-data-bootstrap/batches/:batchId`.

- [x] **Step 2: Run targeted backend tests**

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
- Modify: `docs/superpowers/plans/2026-04-29-master-data-bootstrap-promotion-readiness-v1.md`

- [x] **Step 1: Update bootstrap implementation plan**

Add completed slice `V1-C4 Promotion Readiness Contract`.

- [x] **Step 2: Update project debt ledger**

Increment closed active debts by one and add `Master Data Bootstrap Promotion Readiness Contract V1`.

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
git commit -m "feat: expose master data promotion readiness"
```

Expected:

```text
[chore/actions-node24-runtime <sha>] feat: expose master data promotion readiness
```

## Self-Review Notes

Spec coverage:

- endpoint: Task 3
- row readiness contract: Task 1
- batch readiness counters and nextAction: Task 1
- promoted idempotency evidence: Task 2
- no promotion writes: all tasks
- docs/debt/release gate: Task 4

No implementation task writes to live `ops.store`, `ops.employee`, or `ops.employee_assignment_history`.
