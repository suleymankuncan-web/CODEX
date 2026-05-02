# Auth Role Assignment Active Uniqueness V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development, then superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add database-level protection so one user cannot have duplicate active role assignments for the same role and exact scope.

**Architecture:** Keep the existing `AuthAdminService` validation and duplicate pre-check. Add a PostgreSQL partial unique functional index as the final concurrency-safe guard. Treat this as auth hardening, not an auth-admin repository split.

**Tech Stack:** NestJS, TypeScript, PostgreSQL, SQL migrations, Jest/schema contract tests, root script guards, root release gate.

---

## Current Evidence

- `AuthAdminService.createRoleAssignment` already validates assignment scope, role scope, and duplicate active assignment before insert.
- `ops.user_action_store_assignment` already has a database-level active unique index: `uq_user_action_store_assignment_active`.
- `ops.user_role_assignment` currently has `idx_user_role_scope`, but it is not unique.
- `ops.user_role_assignment` scope ids are nullable by design:
  - company scope: `company_id` set, `region_id` and `store_id` null
  - region scope: `company_id` and `region_id` set, `store_id` null
  - store scope: all three set
- PostgreSQL normal unique indexes treat `NULL` values as distinct, so a naive unique index over nullable scope ids is not enough.

## Scope

Allowed:

- add schema contract coverage for active role-assignment uniqueness,
- add a migration that preflights existing duplicate active rows,
- add a partial unique functional index for open-ended active role assignments,
- update `db/schema.sql`,
- keep service duplicate pre-check and current API behavior,
- update handoff documentation,
- run targeted auth/schema tests, build, fresh migration smoke when DB files change, and root release gate.

Not allowed:

- no auth-admin repository split,
- no role/scope policy change,
- no controller/DTO/auth rule change,
- no Keycloak/OIDC behavior change,
- no user account identity policy change,
- no searchable lookup expansion,
- no role-permission governance change,
- no silent duplicate cleanup,
- no destructive SQL such as `DROP TABLE`, `TRUNCATE`, or data deletion.

## Decision

Use a partial unique functional index with a zero UUID sentinel for nullable scope ids:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_role_assignment_active_scope
    ON ops.user_role_assignment (
        user_id,
        role_id,
        scope_type,
        COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(region_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    WHERE end_at IS NULL;
```

Reason:

- Works without relying on PostgreSQL 15 `NULLS NOT DISTINCT`.
- Keeps current nullable schema.
- Matches the existing long-lived grant model where active assignments are usually open-ended.
- Prevents concurrent duplicate open-ended grants even if two admin requests pass service pre-check at the same time.

## Explicit V1 Boundary

V1 locks open-ended active assignments where `end_at IS NULL`.

It does not fully solve future scheduled or finite overlapping windows. Today the service duplicate check uses the current effective window, while the DB index will only protect open-ended active rows. If future scheduling becomes a real workflow, use a separate plan for a time-range exclusion constraint or a stricter service rule.

Do not add `btree_gist`, range exclusion constraints, or scheduling semantics in this slice.

## Files

Create:

- `db/migrations/043_user_role_assignment_active_uniqueness.sql`
- `backend/nestjs/src/modules/auth/user-role-assignment-active-uniqueness-schema-contract.spec.ts`

Modify:

- `db/schema.sql`
- `current-state.md`
- `docs/plans/project-debt-ledger.md`
- `docs/plans/project-risk-scan-2026-04-30.md`
- `docs/superpowers/plans/2026-04-30-auth-role-assignment-active-uniqueness-v1.md`

Do not modify:

- `backend/nestjs/src/modules/auth/auth-admin.service.ts`
- `backend/nestjs/src/modules/auth/auth-admin.repository.ts`
- `backend/nestjs/src/modules/auth/auth-role-scope-policy.service.ts`
- `backend/nestjs/src/modules/auth/web/*`
- `backend/nestjs/src/modules/auth/auth-authorization.repository.ts`
- frontend files

## Task 1: Add Failing Schema Contract

**Files:**

- Create: `backend/nestjs/src/modules/auth/user-role-assignment-active-uniqueness-schema-contract.spec.ts`

- [x] **Step 1: Assert migration exists**

The test must require:

- `db/migrations/043_user_role_assignment_active_uniqueness.sql`
- `uq_user_role_assignment_active_scope`
- `WHERE end_at IS NULL`
- `COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid)`
- `COALESCE(region_id, '00000000-0000-0000-0000-000000000000'::uuid)`
- `COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid)`

- [x] **Step 2: Assert duplicate preflight exists**

The test must require:

- `HAVING COUNT(*) > 1`
- `RAISE EXCEPTION`
- grouping by `user_id`, `role_id`, `scope_type`, and normalized scope ids
- `WHERE end_at IS NULL`

- [x] **Step 3: Assert canonical schema stays aligned**

The test must require `db/schema.sql` to contain the same index name and normalized nullable scope expression.

Expected:

- test fails before migration/schema changes.

## Task 2: Add Migration

**Files:**

- Create: `db/migrations/043_user_role_assignment_active_uniqueness.sql`

- [x] **Step 1: Add duplicate preflight DO block**

Before creating the index, detect duplicate open-ended active rows:

```sql
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM ops.user_role_assignment
        WHERE end_at IS NULL
        GROUP BY
            user_id,
            role_id,
            scope_type,
            COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
            COALESCE(region_id, '00000000-0000-0000-0000-000000000000'::uuid),
            COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid)
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate active role assignments exist; resolve duplicates before applying uq_user_role_assignment_active_scope';
    END IF;
END $$;
```

Do not deactivate, delete, or choose a winning row automatically.

- [x] **Step 2: Create unique partial functional index**

Create `uq_user_role_assignment_active_scope` exactly as defined in the Decision section.

- [x] **Step 3: Add comment**

Add a short SQL comment explaining that this protects open-ended active role grants and does not model future scheduled overlap.

## Task 3: Update Canonical Schema

**Files:**

- Modify: `db/schema.sql`

- [x] **Step 1: Add the same unique index to schema**

Add `uq_user_role_assignment_active_scope` near the existing `idx_user_role_scope` / auth indexes.

- [x] **Step 2: Keep existing non-unique index unless proven redundant**

Do not remove `idx_user_role_scope` in this slice. Removing it would be a separate query/index review.

## Task 4: Targeted Verification

**Files:**

- No production code changes expected.

- [x] **Step 1: Run schema contract**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- --runInBand src/modules/auth/user-role-assignment-active-uniqueness-schema-contract.spec.ts
```

Expected:

- schema contract passes.

- [x] **Step 2: Run auth role assignment regression tests**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd test -- --runInBand test/integration/auth-role-assignments.e2e-spec.ts
```

Expected:

- existing role assignment behavior remains unchanged.

- [x] **Step 3: Run backend build**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\backend\nestjs"
npm.cmd run build
```

Expected:

- build passes.

- [x] **Step 4: Run root script guards**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
node --test scripts\*.test.mjs
```

Expected:

- all root script guards pass.

- [x] **Step 5: Run fresh DB migration smoke**

Because this changes DB migration/schema files, run:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run smoke:migration:fresh-db
```

Expected:

- disposable local DB only,
- migration count succeeds,
- failed migration count is 0.

If Docker/local PostgreSQL is unavailable, record a written Conditional Go before merging.

- [x] **Step 6: Run root release gate**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run check:release
```

Expected:

- backend lint/test/build/audit passes,
- frontend lint/build/e2e/audit passes,
- only existing non-failing Vite chunk warning may appear.

- [x] **Step 7: Run whitespace diff check**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git diff --check
```

Expected:

- exit code 0,
- Windows LF to CRLF warnings are acceptable,
- whitespace errors are not acceptable.

## Task 5: Documentation And Commit

**Files:**

- Modify: `current-state.md`
- Modify: `docs/plans/project-debt-ledger.md`
- Modify: `docs/plans/project-risk-scan-2026-04-30.md`
- Modify: `docs/superpowers/plans/2026-04-30-auth-role-assignment-active-uniqueness-v1.md`

- [x] **Step 1: Update this plan checklist**

Mark completed steps with `[x]` after implementation and verification.

- [x] **Step 2: Update handoff docs**

Record:

- DB-level active role assignment uniqueness is implemented,
- duplicate preflight fails safely instead of deleting rows,
- future scheduled/finite overlap remains a future slice,
- fresh DB migration smoke result.

- [x] **Step 3: Commit**

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
git status --short
git add db/migrations/043_user_role_assignment_active_uniqueness.sql `
  db/schema.sql `
  backend/nestjs/src/modules/auth/user-role-assignment-active-uniqueness-schema-contract.spec.ts `
  current-state.md `
  docs/plans/project-debt-ledger.md `
  docs/plans/project-risk-scan-2026-04-30.md `
  docs/superpowers/plans/2026-04-30-auth-role-assignment-active-uniqueness-v1.md
git commit -m "fix: enforce active role assignment uniqueness"
```

Expected:

- commit succeeds,
- untracked `outputs/` remains uncommitted.

## Execution Evidence

Completed on 30 April 2026.

TDD red:

- `backend/nestjs`: `npm.cmd test -- --runInBand src/modules/auth/user-role-assignment-active-uniqueness-schema-contract.spec.ts` failed as expected before migration/schema existed.

Verification:

- `backend/nestjs`: `npm.cmd test -- --runInBand src/modules/auth/user-role-assignment-active-uniqueness-schema-contract.spec.ts` passed, 3/3.
- `backend/nestjs`: `npm.cmd test -- --runInBand test/integration/auth-role-assignments.e2e-spec.ts` passed, 9/9.
- `backend/nestjs`: `npm.cmd run build` passed.
- root: `node --test scripts\*.test.mjs` passed, 100/100.
- root: `npm.cmd run smoke:migration:fresh-db` passed; disposable local DB migration succeeded 43/43, failed=0, audit=3, ops=39, rpt=10, stg=12.
- root: `npm.cmd run check:release` passed; backend 89 suites / 480 tests, frontend Playwright 46/46, audit 0 vulnerabilities.

Implementation notes:

- `idx_user_role_scope` was intentionally kept.
- `AuthAdminService`, `AuthAdminRepository`, auth DTO/controller code, runtime auth, and frontend files were intentionally not modified.
- Future scheduled or finite overlapping role assignment semantics remain outside V1.

## Self-Review

Spec coverage:

- The plan protects duplicate active role assignments at the DB level.
- The plan handles nullable scope ids.
- The plan keeps service validation and API behavior unchanged.
- The plan names fresh DB migration smoke because DB files will change.

No placeholders:

- There are no open-ended TODO/TBD sections.
- Future scheduling overlap is intentionally named as out of V1, not hidden.

Type and schema consistency:

- Index name is stable: `uq_user_role_assignment_active_scope`.
- Sentinel UUID is stable and used consistently.
- Existing `idx_user_role_scope` is not removed in this slice.
