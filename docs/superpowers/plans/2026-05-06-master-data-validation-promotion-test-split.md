# Master Data Validation Promotion Test Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the large master-data bootstrap validation/promotion service spec into smaller domain-focused test files without changing production behavior.

**Architecture:** Keep `MasterDataBootstrapService` production code untouched. Move existing Jest test cases mechanically into validation/conflict and promotion files, then update the existing test-suite hygiene guard so coverage loss is caught by test name and test count.

**Tech Stack:** NestJS, Jest, Node contract tests, PowerShell, root script tests.

---

## Boundary

Allowed:

- Move tests between spec files.
- Duplicate small test builders if that keeps expectations readable.
- Update `scripts/test-suite-hygiene-contract.test.mjs` to preserve exact test names and counts.
- Run targeted backend specs and root script guards.

Not allowed:

- Change `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts`.
- Change repository/service behavior.
- Add broad shared helpers that hide business expectations.
- Rename existing test names.
- Reduce test count unless a duplicate-removal note is explicitly added.

## Current Files

Existing master-data bootstrap service test files:

- `backend/nestjs/src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts`
  - 4 tests
  - staging and normalization only
- `backend/nestjs/src/modules/integration/application/master-data-bootstrap-read-models.service.spec.ts`
  - 6 tests
  - list/readiness/read model only
- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`
  - 19 tests
  - validation, duplicate/conflict preflight, and promotion behavior

Target shape:

- Keep: `backend/nestjs/src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts`
- Keep: `backend/nestjs/src/modules/integration/application/master-data-bootstrap-read-models.service.spec.ts`
- Create: `backend/nestjs/src/modules/integration/application/master-data-bootstrap-validation.service.spec.ts`
- Create: `backend/nestjs/src/modules/integration/application/master-data-bootstrap-promotion.service.spec.ts`
- Delete or leave empty only if no tests remain: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`

Preferred end state:

- Validation/conflict file: 10 tests
- Promotion file: 9 tests
- Total master-data bootstrap service tests across all files: 29

## Test Name Inventory

These test names must remain exactly once across the master-data bootstrap service specs:

```text
stages bootstrap rows with normalized references and stable row hashes
normalizes personnel national id evidence into a hash for preflight checks
stages personnel rows with normalized promotion metadata
stages store rows with normalized promotion metadata
validates personnel rows without promoting staged data
allows personnel rows without national id evidence when required live-write metadata is present
marks unknown store types as review rows for store bootstrap batches
marks new store rows without region code as review rows
marks new store rows with unknown region code as review rows
validates new store rows when region code resolves
marks normalized duplicate store codes as review issues before store promotion
marks normalized duplicate personnel seller codes as review issues
marks duplicate personnel national id hashes as review issues
marks existing employee seller code and national id mismatches as review issues
lists bootstrap batches with derived readiness and next action
lists bootstrap rows for review after checking scoped batch access
reports pending rows as needing validation before promotion
reports invalid and needs-review rows as blocking promotion
reports ready rows when the batch is ready to promote
reports promoted rows as already promoted and not ready again
rejects personnel batch store promotion
rejects store promotion before the batch is ready
promotes only ready store rows and skips already promoted rows
rejects stale store promotion when any non-promoted row is not ready
rejects store batch personnel promotion
rejects personnel promotion before the batch is ready
promotes only ready personnel rows and skips already promoted rows
rejects stale personnel promotion when any non-promoted row is not ready
rejects ready personnel promotion when required evidence is missing
```

---

### Task 1: Update Coverage Guard First

**Files:**

- Modify: `scripts/test-suite-hygiene-contract.test.mjs`

- [ ] **Step 1: Expand the guarded file list**

Replace the current `masterDataBootstrapServiceFiles` list with:

```js
const masterDataBootstrapServiceFiles = [
  'backend/nestjs/src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts',
  'backend/nestjs/src/modules/integration/application/master-data-bootstrap-read-models.service.spec.ts',
  'backend/nestjs/src/modules/integration/application/master-data-bootstrap-validation.service.spec.ts',
  'backend/nestjs/src/modules/integration/application/master-data-bootstrap-promotion.service.spec.ts',
]
```

- [ ] **Step 2: Keep the expected test names unchanged**

Keep `masterDataBootstrapServiceExpectedTestNames` as the exact 29-name list. Do not rename the strings.

- [ ] **Step 3: Add per-file expected counts**

Inside `test('master data bootstrap service coverage is frozen before split', ...)`, after the total count assertion, add:

```js
assert.equal([...readText(masterDataBootstrapServiceFiles[0]).matchAll(/\bit\s*\(/g)].length, 4)
assert.equal([...readText(masterDataBootstrapServiceFiles[1]).matchAll(/\bit\s*\(/g)].length, 6)
assert.equal([...readText(masterDataBootstrapServiceFiles[2]).matchAll(/\bit\s*\(/g)].length, 10)
assert.equal([...readText(masterDataBootstrapServiceFiles[3]).matchAll(/\bit\s*\(/g)].length, 9)
```

- [ ] **Step 4: Run the guard and verify it fails before split**

Run:

```powershell
node --test scripts\test-suite-hygiene-contract.test.mjs
```

Expected:

- FAIL because `master-data-bootstrap-validation.service.spec.ts` and `master-data-bootstrap-promotion.service.spec.ts` do not exist yet.

---

### Task 2: Create Validation/Conflict Spec

**Files:**

- Create: `backend/nestjs/src/modules/integration/application/master-data-bootstrap-validation.service.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`

- [ ] **Step 1: Move the validation and preflight tests**

Move these 10 tests from `master-data-bootstrap.service.spec.ts` into `master-data-bootstrap-validation.service.spec.ts`:

```text
validates personnel rows without promoting staged data
allows personnel rows without national id evidence when required live-write metadata is present
marks unknown store types as review rows for store bootstrap batches
marks new store rows without region code as review rows
marks new store rows with unknown region code as review rows
validates new store rows when region code resolves
marks normalized duplicate store codes as review issues before store promotion
marks normalized duplicate personnel seller codes as review issues
marks duplicate personnel national id hashes as review issues
marks existing employee seller code and national id mismatches as review issues
```

The new file should start with:

```ts
import { MasterDataBootstrapService } from "./master-data-bootstrap.service";

describe("MasterDataBootstrapService validation", () => {
  // moved validation and conflict tests go here
});
```

- [ ] **Step 2: Move only helper functions needed by validation tests**

If these helpers are used by moved tests, copy or move them into the validation spec:

```ts
function buildPersonnelRow(...)
function buildBootstrapBatch(...)
function buildStoreRow(...)
```

Keep helper bodies identical unless TypeScript requires removing unused fields.

- [ ] **Step 3: Run validation spec only**

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- master-data-bootstrap-validation.service.spec.ts --runInBand
```

Expected:

- PASS, 10 tests.

---

### Task 3: Create Promotion Spec

**Files:**

- Create: `backend/nestjs/src/modules/integration/application/master-data-bootstrap-promotion.service.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`

- [ ] **Step 1: Move the promotion tests**

Move these 9 tests from `master-data-bootstrap.service.spec.ts` into `master-data-bootstrap-promotion.service.spec.ts`:

```text
rejects personnel batch store promotion
rejects store promotion before the batch is ready
promotes only ready store rows and skips already promoted rows
rejects stale store promotion when any non-promoted row is not ready
rejects store batch personnel promotion
rejects personnel promotion before the batch is ready
promotes only ready personnel rows and skips already promoted rows
rejects stale personnel promotion when any non-promoted row is not ready
rejects ready personnel promotion when required evidence is missing
```

The new file should start with:

```ts
import { MasterDataBootstrapService } from "./master-data-bootstrap.service";

describe("MasterDataBootstrapService promotion", () => {
  // moved promotion tests go here
});
```

- [ ] **Step 2: Move only helper functions needed by promotion tests**

If promotion tests use builders from the old file, copy or move only the needed helpers into the promotion spec.

- [ ] **Step 3: Remove the empty original spec**

If `master-data-bootstrap.service.spec.ts` has no tests left after the split, delete it. If it still has shared helper code only, do not keep a helper-only spec file; helpers should stay local to the spec that uses them.

- [ ] **Step 4: Run promotion spec only**

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- master-data-bootstrap-promotion.service.spec.ts --runInBand
```

Expected:

- PASS, 9 tests.

---

### Task 4: Run The Full Master-Data Test Slice

**Files:**

- No production files.

- [ ] **Step 1: Run all master-data bootstrap service specs**

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- master-data-bootstrap --runInBand
```

Expected:

- PASS.
- The moved tests still pass with the same names.

- [ ] **Step 2: Run the coverage guard**

Run:

```powershell
node --test scripts\test-suite-hygiene-contract.test.mjs
```

Expected:

- PASS.
- Total master-data bootstrap service tests = 29.
- Per-file counts = 4, 6, 10, 9.

---

### Task 5: Final Verification And PR

**Files:**

- Modified spec files and `scripts/test-suite-hygiene-contract.test.mjs` only.

- [ ] **Step 1: Run root script tests**

Run:

```powershell
npm.cmd run test:scripts
```

Expected:

- PASS.

- [ ] **Step 2: Run backend build**

Run:

```powershell
npm.cmd --prefix backend/nestjs run build
```

Expected:

- PASS.

- [ ] **Step 3: Run whitespace check**

Run:

```powershell
git diff --check
```

Expected:

- PASS. Line-ending warnings are acceptable if there are no whitespace errors.

- [ ] **Step 4: Commit**

Run:

```powershell
git add backend/nestjs/src/modules/integration/application/master-data-bootstrap*.service.spec.ts scripts/test-suite-hygiene-contract.test.mjs
git commit -m "Split master data bootstrap service tests"
```

- [ ] **Step 5: Push and open PR**

Open a small PR titled:

```text
Split master data bootstrap service tests
```

PR body should say:

```md
## Summary
- split master-data bootstrap validation/conflict tests from promotion tests
- keep staging and read-model specs unchanged
- update test-suite hygiene guard to freeze the same 29 test names across the split files

## Verification
- `npm.cmd --prefix backend/nestjs test -- master-data-bootstrap --runInBand`
- `node --test scripts\test-suite-hygiene-contract.test.mjs`
- `npm.cmd run test:scripts`
- `npm.cmd --prefix backend/nestjs run build`
- `git diff --check`
```

## Self-Review Checklist

- [ ] No production code changed.
- [ ] No test name changed.
- [ ] No test count dropped.
- [ ] No broad shared helper abstraction added.
- [ ] `master-data-bootstrap.service.spec.ts` is deleted if empty.
- [ ] The next PR after this can stay focused on either another test split or a real product issue, not both.
