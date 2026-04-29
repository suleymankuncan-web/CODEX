# Master Data Bootstrap Personnel Promotion V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote readiness-approved personnel bootstrap rows into live employee and active assignment tables without opening unrelated HR workflows.

**Architecture:** Extend personnel normalization/validation with live-write fields, add a repository transaction that upserts `ops.employee` and one active primary `ops.employee_assignment_history`, then expose one HR/Admin command endpoint. Personnel promotion reuses the existing staging, validation, readiness, and scoped batch guards.

**Tech Stack:** NestJS, PostgreSQL, Jest, existing RBAC decorators, root `check:release`.

---

## File Structure

- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`: service TDD coverage for personnel metadata validation and promotion guard behavior.
- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts`: personnel metadata normalization, validation additions, and `promotePersonnelBootstrapBatch`.
- `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts`: repository SQL guard for employee/assignment promotion and staged evidence.
- `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.ts`: `promotePersonnelBootstrapRows`.
- `backend/nestjs/src/modules/integration/web/integration.controller.ts`: personnel promotion endpoint.
- `docs/superpowers/specs/2026-04-29-master-data-bootstrap-personnel-promotion-v1-design.md`: approved design.
- `docs/superpowers/plans/2026-04-29-master-data-bootstrap-personnel-promotion-v1.md`: this plan.
- `docs/superpowers/plans/2026-04-29-personnel-master-data-bootstrap-v1.md`: completed slice note.
- `docs/plans/project-debt-ledger.md`: debt count update after verification and commit.

## Task 1: Personnel Live-Write Validation Inputs

**Files:**

- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts`

- [x] **Step 1: Write failing tests**

Add tests proving:

- personnel staging normalizes first name, last name, hire date, employment type, and national id hash
- personnel validation marks missing first name as `invalid`
- personnel validation marks missing national id as `invalid`
- personnel validation marks invalid hire date as `invalid`
- valid personnel rows include all resolved promotion evidence

- [x] **Step 2: Run red service test**

Run:

```powershell
npm.cmd test -- src/modules/integration/application/master-data-bootstrap.service.spec.ts --runInBand
```

Expected result:

```text
Expected normalizedFirstName or missing_national_id but received null/undefined
```

- [x] **Step 3: Implement normalization and validation**

Add personnel first name, last name, hire date, employment type normalization and validation issue codes.

- [x] **Step 4: Run green service test**

Run:

```powershell
npm.cmd test -- src/modules/integration/application/master-data-bootstrap.service.spec.ts --runInBand
```

Expected result:

```text
PASS src/modules/integration/application/master-data-bootstrap.service.spec.ts
```

## Task 2: Repository Personnel Promotion Transaction

**Files:**

- Modify: `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.ts`

- [x] **Step 1: Write failing repository tests**

Add tests proving `promotePersonnelBootstrapRows`:

- uses `INSERT INTO ops.employee`
- uses `UPDATE ops.employee`
- deactivates conflicting `ops.employee_assignment_history`
- inserts or updates active primary `ops.employee_assignment_history`
- updates `stg.master_data_bootstrap_row` to `promoted`
- refreshes `stg.master_data_bootstrap_batch`
- does not insert or update `ops.store`
- fails when the staged row is no longer valid

- [x] **Step 2: Run red repository test**

Run:

```powershell
npm.cmd test -- src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts --runInBand
```

Expected result:

```text
Property 'promotePersonnelBootstrapRows' does not exist
```

- [x] **Step 3: Implement transaction**

Add a repository transaction that upserts employee identity, maintains one active primary assignment, marks staged rows promoted, and refreshes counters.

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

- store batch personnel promotion is rejected
- personnel batch not `ready_to_promote` is rejected
- ready personnel rows are sent to repository promotion
- already-promoted rows are skipped
- missing ready-row evidence throws a guarded `400`

- [x] **Step 2: Run red service test**

Run:

```powershell
npm.cmd test -- src/modules/integration/application/master-data-bootstrap.service.spec.ts --runInBand
```

Expected result:

```text
Property 'promotePersonnelBootstrapBatch' does not exist
```

- [x] **Step 3: Implement service command and controller endpoint**

Add `promotePersonnelBootstrapBatch` and:

```text
POST /api/integrations/master-data-bootstrap/batches/:batchId/promote-personnel
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
- Modify: `docs/superpowers/plans/2026-04-29-master-data-bootstrap-personnel-promotion-v1.md`

- [x] **Step 1: Update bootstrap implementation plan**

Add completed slice `V1-E Personnel Promotion`.

- [x] **Step 2: Update project debt ledger**

Increment closed active debts by one and add `Master Data Bootstrap Personnel Promotion V1`.

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
git commit -m "feat: promote reviewed personnel bootstrap rows"
```

Expected:

```text
[chore/actions-node24-runtime <sha>] feat: promote reviewed personnel bootstrap rows
```

## Self-Review Notes

Spec coverage:

- personnel-only promotion: Task 3
- live employee write: Task 2
- active primary assignment write: Task 2
- ready-row guard: Task 3
- idempotency: Task 2
- staged row promotion evidence: Task 2
- validation prerequisites: Task 1
- docs/debt/release gate: Task 4

User account creation and role assignment remain future slices.
