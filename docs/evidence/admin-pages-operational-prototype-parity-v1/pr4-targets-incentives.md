# PR4 - Targets And Incentives

Date: 2026-06-30

## Scope

Routes covered:

- `/admin/targets`
- `/admin/incentives`

Prototype contract:

- `admin-web/src/prototypes/admin/targets-incentives-v1.tsx`

## Behavior Frozen

- Target distribution request loading, coverage loading, approval permission checks, approval payloads, approval notes, request status formatting, and coverage calculations were not changed.
- Admin incentive period selection, projection loading, package review approve/return payloads, manual correction payloads, package expansion, Excel export behavior, and query invalidation were not changed.
- No backend, OpenAPI, DB, auth, scoring, target, or incentive calculation code changed.

## UI Implementation

- `/admin/targets`, `/admin/incentives`, and the admin incentive region package review section now use the shared admin operational surface rhythm.
- The operational primitive layer now includes the small missing equivalents needed by the migrated pages: action row, filter bar, empty state, loading state, and richer state panel support.
- The admin UI guard now recognizes `admin-operational-primitives` as an approved migrated-surface anchor while keeping the same legacy and lookalike negative tests.

## Verification

Commands run:

```text
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- admin-targets.spec.ts admin-incentives.spec.ts
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run test:scripts
npm.cmd run test:scripts
git diff --check
```

Results:

- Production build passed.
- Targeted Playwright passed: 6 tests.
- Frontend lint passed.
- Frontend script tests passed: 63 tests.
- Root script tests passed: 488 tests.
- Diff whitespace check passed.

## Residual Risk

- This PR intentionally keeps existing target and incentive business copy keys, test IDs, and table structure where tests and workflow rely on them.
- Full release gate is left to GitHub required checks for the PR merge decision.
