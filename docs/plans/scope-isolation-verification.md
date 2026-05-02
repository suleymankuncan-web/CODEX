# Scope Isolation Verification

## Anchor
This document is the execution note for the `Scope isolation verification` item in [phase-6-closeout-checklist.md](./phase-6-closeout-checklist.md).

## Goal
Prove that `company`, `region`, and `store` scopes are not just modeled in auth, but actually enforced across operational and reporting paths.

## Verification Matrix

| Scope | Expected capability | Verification surface | Expected result |
|---|---|---|---|
| `company` | can operate across company-owned stores | `GET /api/workforce/headcount-gap?storeId=...` | allowed |
| `region` | can only see data within allowed regions | `GET /api/reports/workforce` and `GET /api/reports/turnover` | query remains constrained by region ids even if explicit storeId is supplied |
| `store` | can only act on assigned stores | `GET /api/workforce/headcount-gap?storeId=...` and checklist mutations | assigned store allowed, other stores rejected |

## Current Findings

### Confirmed
- company-scoped access can pass store-level operational queries
- store-scoped access can pass store-level operational queries for assigned stores
- checklist mutations reject out-of-scope store access
- region-scoped reporting now remains constrained even when an explicit `storeId` is supplied

### Fixed During Verification
- reporting endpoints previously allowed explicit `storeId` / `regionId` / `companyId` filters to bypass the user's narrower access scope
- this has been corrected in `reporting.repository.ts` by always applying the caller's allowed scope as an additional constraint

## Automated Coverage
- `test/integration/auth-scope.e2e-spec.ts`

Covered cases now include:
- company-scoped operational store access
- store-scoped operational store access
- store-scoped out-of-scope denial
- region-scoped reporting access with explicit store filter still constrained
- JWT and mock auth modes

## Remaining Manual Verification
- confirm real database fixtures for mixed-region and mixed-store data
- confirm frontend drill-down behavior produces empty states instead of confusing errors when scope excludes the requested data
- confirm future store-user application reuses the same scope assumptions

## Closeout Rule
This item is considered closed when:
- the automated scope tests pass
- no explicit reporting filter can widen access beyond the authenticated user's allowed scope
- company / region / store boundaries are documented and understandable to future module work
