# Master Data Bootstrap Test Hygiene V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `MasterDataBootstrapService` test maintenance risk without changing production behavior, dropping coverage, or weakening live-write safety evidence.

**Architecture:** This is a test-structure-only plan. The first implementation must freeze the current 29-test contract before any move, then split only the lowest-risk mechanical boundaries. Validation and promotion behavior stay protected and are not split until a separate approval gate proves the next boundary.

**Tech Stack:** NestJS, Jest, Node test runner for repository guard checks, PostgreSQL-backed integration domain, TypeScript.

---

## Current Inventory

Observed on 30 April 2026:

- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`
  - 2159 physical lines.
  - 29 Jest `it(...)` cases.
  - Covers staging, validation, read-model/readiness, and live promotion guards in one file.
- `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts`
  - 545 lines.
  - Not part of this split.
- `backend/nestjs/src/modules/integration/master-data-bootstrap-schema-contract.spec.ts`
  - 40 lines.
  - Not part of this split.

The large service spec is meaningful. It is not bloat by itself. The risk is future maintenance: a single 2000+ line file makes it easier to accidentally hide a dropped assertion during later master-data work.

## Test Buckets

### Bucket A: Staging and Normalization

Lowest-risk split candidate. These tests call `createBootstrapBatch` and verify normalized staged rows.

- `stages bootstrap rows with normalized references and stable row hashes`
- `normalizes personnel national id evidence into a hash for preflight checks`
- `stages personnel rows with normalized promotion metadata`
- `stages store rows with normalized promotion metadata`

### Bucket B: Validation and Preflight

High business density. Do not split in the first implementation pass.

- `validates personnel rows without promoting staged data`
- `marks personnel rows with missing live-write metadata as invalid`
- `marks unknown store types as review rows for store bootstrap batches`
- `marks new store rows without region code as review rows`
- `marks new store rows with unknown region code as review rows`
- `validates new store rows when region code resolves`
- `marks normalized duplicate store codes as review issues before store promotion`
- `marks normalized duplicate personnel seller codes as review issues`
- `marks duplicate personnel national id hashes as review issues`
- `marks existing employee seller code and national id mismatches as review issues`

### Bucket C: Admin Read Models and Promotion Readiness

Second split candidate only after Bucket A passes and is committed. These tests read list/review/readiness evidence and can own the `buildBootstrapReadinessRow` helper.

- `lists bootstrap batches with derived readiness and next action`
- `lists bootstrap rows for review after checking scoped batch access`
- `reports pending rows as needing validation before promotion`
- `reports invalid and needs-review rows as blocking promotion`
- `reports ready rows when the batch is ready to promote`
- `reports promoted rows as already promoted and not ready again`

### Bucket D: Promotion Safety

Highest-risk bucket. Do not split in V1 unless a new explicit plan is approved.

- `rejects personnel batch store promotion`
- `rejects store promotion before the batch is ready`
- `promotes only ready store rows and skips already promoted rows`
- `rejects stale store promotion when any non-promoted row is not ready`
- `rejects store batch personnel promotion`
- `rejects personnel promotion before the batch is ready`
- `promotes only ready personnel rows and skips already promoted rows`
- `rejects stale personnel promotion when any non-promoted row is not ready`
- `rejects ready personnel promotion when required evidence is missing`

## Risk Analysis

| Risk | Severity | Why it matters | Control |
| --- | --- | --- | --- |
| Dropping a test while moving blocks | High | Master data controls live store/personnel records. Silent coverage loss is unacceptable. | Add an exact test-name guard before moving anything. |
| Rewriting assertions during split | High | The split could accidentally change business evidence. | Move existing `it(...)` blocks mechanically; do not rewrite assertions. |
| Hiding expectations behind broad helpers | Medium | Master-data expectations are business rules, not generic fixtures. | No shared helper module in V1. Move or duplicate only tiny exclusive helpers. |
| Touching production code | High | This task is hygiene, not behavior. | Only spec files, plan docs, and guard script may change. |
| Splitting validation/promotion too early | High | These buckets contain live-write safety and stale-counter guards. | V1 allows Bucket A, then optional Bucket C. Bucket B/D require a separate plan. |
| Test command false confidence | Medium | Running only one file may miss moved test discovery issues. | Always run all affected master-data service spec files together, then guard, then release. |

## Non-Goals

- No production code changes.
- No migration changes.
- No database schema changes.
- No auth, scope, feed, KPI, checklist, workforce, or competition changes.
- No helper abstraction shared across production or test directories.
- No reduction in total test count.
- No test name changes.
- No validation or promotion split in the same commit as staging split.

## Planned File Structure

Create during implementation:

- `backend/nestjs/src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts`
  - Owns Bucket A only.
- `backend/nestjs/src/modules/integration/application/master-data-bootstrap-read-models.service.spec.ts`
  - Owns Bucket C only, if Bucket A succeeds and a second slice is approved.

Modify during implementation:

- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`
  - Keeps Bucket B and Bucket D after Bucket A/C moves.
- `scripts/test-suite-hygiene-contract.test.mjs`
  - Guards all 29 master-data service test names across the active file set.
- `docs/plans/test-suite-hygiene-v1.md`
  - Records each completed slice.
- `current-state.md`
  - Records handoff state after completed implementation.

Do not modify:

- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts`
- `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.ts`
- `backend/nestjs/src/modules/integration/infrastructure/master-data-bootstrap.repository.spec.ts`
- Migration files.
- Runtime module wiring.

---

## Task 1: Add Coverage Guard Before Any Split

**Files:**

- Modify: `scripts/test-suite-hygiene-contract.test.mjs`

- [ ] **Step 1: Add master-data service file list**

Add this near the other `const ...Files` declarations:

```js
const masterDataBootstrapServiceFiles = [
  'backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts',
]
```

- [ ] **Step 2: Add exact expected test names**

Add this near the other expected test-name arrays:

```js
const masterDataBootstrapServiceExpectedTestNames = [
  'stages bootstrap rows with normalized references and stable row hashes',
  'normalizes personnel national id evidence into a hash for preflight checks',
  'stages personnel rows with normalized promotion metadata',
  'stages store rows with normalized promotion metadata',
  'validates personnel rows without promoting staged data',
  'marks personnel rows with missing live-write metadata as invalid',
  'marks unknown store types as review rows for store bootstrap batches',
  'marks new store rows without region code as review rows',
  'marks new store rows with unknown region code as review rows',
  'validates new store rows when region code resolves',
  'marks normalized duplicate store codes as review issues before store promotion',
  'marks normalized duplicate personnel seller codes as review issues',
  'marks duplicate personnel national id hashes as review issues',
  'marks existing employee seller code and national id mismatches as review issues',
  'lists bootstrap batches with derived readiness and next action',
  'lists bootstrap rows for review after checking scoped batch access',
  'reports pending rows as needing validation before promotion',
  'reports invalid and needs-review rows as blocking promotion',
  'reports ready rows when the batch is ready to promote',
  'reports promoted rows as already promoted and not ready again',
  'rejects personnel batch store promotion',
  'rejects store promotion before the batch is ready',
  'promotes only ready store rows and skips already promoted rows',
  'rejects stale store promotion when any non-promoted row is not ready',
  'rejects store batch personnel promotion',
  'rejects personnel promotion before the batch is ready',
  'promotes only ready personnel rows and skips already promoted rows',
  'rejects stale personnel promotion when any non-promoted row is not ready',
  'rejects ready personnel promotion when required evidence is missing',
]
```

- [ ] **Step 3: Add the guard test**

Add this after the existing split guard tests:

```js
test('master data bootstrap service coverage is frozen before split', () => {
  let totalTests = 0
  let combinedText = ''

  for (const file of masterDataBootstrapServiceFiles) {
    assert.equal(existsSync(join(workspaceRoot, file)), true, `${file} must exist`)
    const text = readText(file)
    totalTests += [...text.matchAll(/\bit\s*\(/g)].length
    combinedText += `\n${text}`
  }

  assert.equal(totalTests, 29)
  for (const testName of masterDataBootstrapServiceExpectedTestNames) {
    const exactOccurrences = [...combinedText.matchAll(new RegExp(`it\\("${testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'))].length
    assert.equal(exactOccurrences, 1, `${testName} must appear exactly once`)
  }
})
```

- [ ] **Step 4: Run guard**

Run:

```powershell
node --test scripts\test-suite-hygiene-contract.test.mjs
```

Expected:

```text
pass
```

- [ ] **Step 5: Commit guard-only work**

Run:

```powershell
git add scripts/test-suite-hygiene-contract.test.mjs
git commit -m "test: guard master data bootstrap service coverage"
```

## Task 2: Split Bucket A Staging and Normalization

**Files:**

- Create: `backend/nestjs/src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`
- Modify: `scripts/test-suite-hygiene-contract.test.mjs`
- Modify: `docs/plans/test-suite-hygiene-v1.md`
- Modify: `current-state.md`

- [ ] **Step 1: Create staging spec shell**

Create `backend/nestjs/src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts` with:

```ts
import { MasterDataBootstrapService } from "./master-data-bootstrap.service";

describe("MasterDataBootstrapService staging", () => {
});
```

- [ ] **Step 2: Move exact Bucket A tests**

Move these exact existing `it(...)` blocks from `master-data-bootstrap.service.spec.ts` into the new `describe` block. Do not rename the tests. Do not rewrite assertions.

```text
stages bootstrap rows with normalized references and stable row hashes
normalizes personnel national id evidence into a hash for preflight checks
stages personnel rows with normalized promotion metadata
stages store rows with normalized promotion metadata
```

- [ ] **Step 3: Keep original file focused**

After the move, `master-data-bootstrap.service.spec.ts` must still contain Bucket B and Bucket D, and may keep Bucket C until Task 3.

The original file must still start with:

```ts
import { MasterDataBootstrapService } from "./master-data-bootstrap.service";

describe("MasterDataBootstrapService", () => {
```

- [ ] **Step 4: Update guard file list**

Change the file list in `scripts/test-suite-hygiene-contract.test.mjs` to:

```js
const masterDataBootstrapServiceFiles = [
  'backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts',
  'backend/nestjs/src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts',
]
```

The expected names array remains unchanged.

- [ ] **Step 5: Run targeted master-data service tests**

Run:

```powershell
cd backend\nestjs
npm.cmd test -- --runInBand src/modules/integration/application/master-data-bootstrap.service.spec.ts src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts
```

Expected:

```text
PASS src/modules/integration/application/master-data-bootstrap.service.spec.ts
PASS src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts
```

- [ ] **Step 6: Run guard**

Run:

```powershell
cd ..\..
node --test scripts\test-suite-hygiene-contract.test.mjs
```

Expected:

```text
pass
```

- [ ] **Step 7: Update docs**

Append a completed slice to `docs/plans/test-suite-hygiene-v1.md`:

```md
## Ninth Safe Slice

Ninth safe slice: split master-data bootstrap staging and normalization tests out of `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`.

Target files:

- `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`
- `backend/nestjs/src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts`

Expected behavior:

- The same 29 master-data bootstrap service tests still run across the two files.
- The 4 staging and normalization tests move to `master-data-bootstrap-staging.service.spec.ts`.
- Validation, read-model/readiness, and promotion safety tests remain in `master-data-bootstrap.service.spec.ts`.
- Test names remain unchanged.
- Production code is not changed.

Reason:

- Staging/normalization is the cleanest mechanical boundary.
- This reduces the largest master-data service test file without touching validation or live promotion safety evidence.

Deferred after this slice:

- Do not split validation or promotion in the same pass.
- Consider read-model/readiness only after this slice passes targeted tests, guard, and release.
```

- [ ] **Step 8: Run release gate**

Run:

```powershell
npm.cmd run check:release
```

Expected:

```text
release gate passes
```

- [ ] **Step 9: Commit Bucket A split**

Run:

```powershell
git add backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts backend/nestjs/src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts scripts/test-suite-hygiene-contract.test.mjs docs/plans/test-suite-hygiene-v1.md current-state.md
git commit -m "test: split master data bootstrap staging coverage"
```

## Task 3: Decide Whether Bucket C Is Still Worth Splitting

**Files:**

- Read: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`
- Read: `backend/nestjs/src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts`
- Read: `scripts/test-suite-hygiene-contract.test.mjs`

- [ ] **Step 1: Check remaining file size**

Run:

```powershell
(Get-Content -LiteralPath 'backend\nestjs\src\modules\integration\application\master-data-bootstrap.service.spec.ts').Count
```

Expected decision:

- If the remaining file is readable and under control, stop V1 here.
- If the remaining file is still hard to scan, continue only with Bucket C.

- [ ] **Step 2: Confirm no unrelated changes**

Run:

```powershell
git status --short
```

Expected:

```text
only intentional files, no outputs/
```

## Task 4: Optional Split Bucket C Read Models and Readiness

Only run this task if Task 2 is committed and Task 3 says the remaining service spec is still too large.

**Files:**

- Create: `backend/nestjs/src/modules/integration/application/master-data-bootstrap-read-models.service.spec.ts`
- Modify: `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts`
- Modify: `scripts/test-suite-hygiene-contract.test.mjs`
- Modify: `docs/plans/test-suite-hygiene-v1.md`
- Modify: `current-state.md`

- [ ] **Step 1: Create read-model spec shell**

Create `backend/nestjs/src/modules/integration/application/master-data-bootstrap-read-models.service.spec.ts` with:

```ts
import { MasterDataBootstrapService } from "./master-data-bootstrap.service";

describe("MasterDataBootstrapService read models", () => {
});
```

- [ ] **Step 2: Move exact Bucket C tests**

Move these exact existing `it(...)` blocks from `master-data-bootstrap.service.spec.ts` into the new file. Do not rename the tests. Do not rewrite assertions.

```text
lists bootstrap batches with derived readiness and next action
lists bootstrap rows for review after checking scoped batch access
reports pending rows as needing validation before promotion
reports invalid and needs-review rows as blocking promotion
reports ready rows when the batch is ready to promote
reports promoted rows as already promoted and not ready again
```

- [ ] **Step 3: Move only the exclusive readiness helper**

Move `buildBootstrapReadinessRow` into `master-data-bootstrap-read-models.service.spec.ts` only if `master-data-bootstrap.service.spec.ts` no longer references it.

Verify before deleting it from the original file:

```powershell
Select-String -LiteralPath 'backend\nestjs\src\modules\integration\application\master-data-bootstrap.service.spec.ts' -Pattern 'buildBootstrapReadinessRow'
```

Expected:

```text
no usage remains outside the helper definition
```

Do not move `buildPersonnelRow`, `buildBootstrapBatch`, or `buildStoreRow` in this task.

- [ ] **Step 4: Update guard file list**

Change the file list to:

```js
const masterDataBootstrapServiceFiles = [
  'backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts',
  'backend/nestjs/src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts',
  'backend/nestjs/src/modules/integration/application/master-data-bootstrap-read-models.service.spec.ts',
]
```

The expected names array remains unchanged.

- [ ] **Step 5: Run targeted master-data service tests**

Run:

```powershell
cd backend\nestjs
npm.cmd test -- --runInBand src/modules/integration/application/master-data-bootstrap.service.spec.ts src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts src/modules/integration/application/master-data-bootstrap-read-models.service.spec.ts
```

Expected:

```text
PASS src/modules/integration/application/master-data-bootstrap.service.spec.ts
PASS src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts
PASS src/modules/integration/application/master-data-bootstrap-read-models.service.spec.ts
```

- [ ] **Step 6: Run guard and release**

Run:

```powershell
cd ..\..
node --test scripts\test-suite-hygiene-contract.test.mjs
npm.cmd run check:release
```

Expected:

```text
guard passes
release gate passes
```

- [ ] **Step 7: Commit Bucket C split**

Run:

```powershell
git add backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.spec.ts backend/nestjs/src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts backend/nestjs/src/modules/integration/application/master-data-bootstrap-read-models.service.spec.ts scripts/test-suite-hygiene-contract.test.mjs docs/plans/test-suite-hygiene-v1.md current-state.md
git commit -m "test: split master data bootstrap read-model coverage"
```

## Explicit Stop Point

Stop after Task 2 unless there is a clear reason to continue.

Stop after Task 4 even if the remaining file is still large.

Do not split Bucket B validation or Bucket D promotion safety in V1. Those buckets deserve their own plan because they protect:

- unmapped store/personnel review behavior,
- duplicate seller code and national id conflicts,
- stale ready-to-promote counters,
- store/personnel live promotion payloads,
- missing evidence rejection.

## Verification Summary

Minimum verification for Task 1:

```powershell
node --test scripts\test-suite-hygiene-contract.test.mjs
```

Minimum verification for Task 2:

```powershell
cd backend\nestjs
npm.cmd test -- --runInBand src/modules/integration/application/master-data-bootstrap.service.spec.ts src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts
cd ..\..
node --test scripts\test-suite-hygiene-contract.test.mjs
npm.cmd run check:release
```

Minimum verification for Task 4:

```powershell
cd backend\nestjs
npm.cmd test -- --runInBand src/modules/integration/application/master-data-bootstrap.service.spec.ts src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts src/modules/integration/application/master-data-bootstrap-read-models.service.spec.ts
cd ..\..
node --test scripts\test-suite-hygiene-contract.test.mjs
npm.cmd run check:release
```

## P0 / P1 / P2 Priority

P0:

- Add guard before moving tests.
- Split only Bucket A if implementation starts.
- Keep all 29 test names unchanged.
- Run targeted master-data tests, guard, and release gate.

P1:

- Consider Bucket C read-model/readiness split after Bucket A is committed.
- Move `buildBootstrapReadinessRow` only if it is exclusive to Bucket C.

P2:

- Revisit Bucket B validation and Bucket D promotion in a separate future plan only if file size remains a real maintenance issue.

## CODEX DURUST YORUM

Master-data testleri "fazlalik" degil; bu kisim sistemin kimleri, hangi magaza/personel kodlariyla canli veriye alacagini koruyor. O yuzden burada en iyi hareket yavas ve kanitli hareket.

Benim net tavsiyem: once guard-only commit, sonra sadece staging/normalization split. Eger bu bile yeterli rahatlama saglarsa V1 burada kapansin. Promotion tarafina dokunmak icin tek sebep dosya boyutu olmamali; orada gercek risk canli master-data yazimi.

## Next Logical Step

If approved, implement Task 1 only: add the 29-test guard before moving any master-data test. That gives us a safety rail before the actual split.
