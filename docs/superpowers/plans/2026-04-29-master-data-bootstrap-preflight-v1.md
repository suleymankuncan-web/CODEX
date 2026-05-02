# Master Data Bootstrap Preflight V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add duplicate and identity-conflict preflight checks to staged master-data bootstrap validation before any live promotion exists.

**Architecture:** Keep preflight inside `MasterDataBootstrapService.validateBootstrapBatch`. Build an in-memory issue map from staged rows, then let normal validation continue for rows without preflight issues. Add one repository lookup for national-id identity conflict checks.

**Tech Stack:** NestJS, PostgreSQL, Jest, existing staging bootstrap tables, root `check:release`.

---

## File Structure

- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`: service TDD coverage for national id normalization, duplicate store codes, duplicate seller codes, duplicate national ids, and identity conflict.
- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts`: normalize national id hash and run preflight checks during validation.
- `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts`: repository SQL guard for national id lookup.
- `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.ts`: add `resolveEmployeeByNationalIdHash`.
- `docs/superpowers/specs/2026-04-29-master-data-bootstrap-preflight-v1-design.md`: approved design.
- `docs/superpowers/plans/2026-04-29-master-data-bootstrap-preflight-v1.md`: this plan.
- `docs/superpowers/plans/2026-04-29-personnel-master-data-bootstrap-v1.md`: completed slice note.
- `docs/plans/project-debt-ledger.md`: debt count update after tests and commit.

## Task 1: National Id Normalization Contract

**Files:**

- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts`

- [x] **Step 1: Write failing service test**

Add a test proving personnel staging stores `normalizedNationalIdHash` as a 64-character hash while preserving existing normalized store/employee/position fields.

- [x] **Step 2: Run red test**

Run:

```powershell
npm.cmd test -- src/modules/integration/application/master-data-bootstrap.service.spec.ts --runInBand
```

Expected result:

```text
Expected normalizedNationalIdHash to match /^[a-f0-9]{64}$/
```

- [x] **Step 3: Implement minimal normalization**

Add `readNormalizedNationalIdHash` and include it only for personnel bootstrap rows when a national id or national id hash alias exists.

- [x] **Step 4: Run green test**

Run:

```powershell
npm.cmd test -- src/modules/integration/application/master-data-bootstrap.service.spec.ts --runInBand
```

Expected result:

```text
PASS src/modules/integration/application/master-data-bootstrap.service.spec.ts
```

## Task 2: Batch Duplicate Preflight

**Files:**

- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts`

- [x] **Step 1: Write failing duplicate tests**

Add tests for:

- `SM-140` and `SM140` in one store batch -> `duplicate_store_code_in_batch`
- same personnel seller code in one personnel batch -> `duplicate_employee_code_in_batch`
- same personnel national id hash in one personnel batch -> `duplicate_national_id_in_batch`

- [x] **Step 2: Run red tests**

Run:

```powershell
npm.cmd test -- src/modules/integration/application/master-data-bootstrap.service.spec.ts --runInBand
```

Expected result:

```text
Expected issueCode duplicate_*_in_batch but received valid or null
```

- [x] **Step 3: Implement preflight issue map**

Add a helper that groups rows by normalized store code, normalized employee code, and normalized national id hash, then returns row-level `needs_review` issues for duplicate groups.

- [x] **Step 4: Run green tests**

Run:

```powershell
npm.cmd test -- src/modules/integration/application/master-data-bootstrap.service.spec.ts --runInBand
```

Expected result:

```text
PASS src/modules/integration/application/master-data-bootstrap.service.spec.ts
```

## Task 3: Existing Employee Identity Conflict

**Files:**

- Modify: `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.ts`
- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts`

- [x] **Step 1: Write failing repository test**

Add a repository test proving `resolveEmployeeByNationalIdHash` selects from `ops.employee` by `company_id` and `national_id_hash` without mutating live tables.

- [x] **Step 2: Run repository red test**

Run:

```powershell
npm.cmd test -- src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts --runInBand
```

Expected result:

```text
Property 'resolveEmployeeByNationalIdHash' does not exist
```

- [x] **Step 3: Implement repository lookup**

Add `resolveEmployeeByNationalIdHash(companyId, normalizedNationalIdHash)`.

- [x] **Step 4: Write failing service identity-conflict test**

Add a personnel validation test where seller code resolves to employee A and national id hash resolves to employee B, expecting `employee_identity_conflict`.

- [x] **Step 5: Implement identity conflict logic**

During personnel row validation, when `normalizedNationalIdHash` exists, compare the seller-code resolution and national-id resolution before returning `valid`.

- [x] **Step 6: Run targeted tests**

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
- Modify: `docs/superpowers/plans/2026-04-29-master-data-bootstrap-preflight-v1.md`

- [x] **Step 1: Update bootstrap implementation plan**

Add a completed slice named `V1-C3 Duplicate/Conflict Preflight`.

- [x] **Step 2: Update project debt ledger**

Increment closed active debts by one and add `Master Data Bootstrap Duplicate/Conflict Preflight V1`.

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
git commit -m "feat: add master data bootstrap preflight checks"
```

Expected:

```text
[chore/actions-node24-runtime <sha>] feat: add master data bootstrap preflight checks
```

## Self-Review Notes

Spec coverage:

- national id hash normalization: Task 1
- normalized duplicate store code: Task 2
- normalized duplicate seller code: Task 2
- duplicate national id hash: Task 2
- existing employee identity conflict: Task 3
- docs/debt/release gate: Task 4

No task promotes staged data into live `ops.*` tables.
