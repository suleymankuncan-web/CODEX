# Rankings Filter Polish Evidence

Date: 2026-07-07
Branch: `codex/rankings-filter-polish-v1`
Finding: PRA-20260707-07

## Scope

- Widen the clear-filter column so `Filtreleri temizle` does not overflow its button.
- Keep region-manager choices in a single readable menu column.
- Right-align the region-manager menu to avoid clipping against the filter shell.

## Already Verified In Current Product

- Store navigation label is `Turkiye Siralamasi`.
- The Turkiye reference strip renders above the filter toolbar.
- The active period metric renders a month label instead of a full date range.

## Non-goals

- No ranking formula changes.
- No rank eligibility changes.
- No role/scope or profile-navigation behavior changes.
- No backend/API changes.

## Verification

- PASS: `npm.cmd --prefix admin-web run test:e2e -- store-rankings-contracts.spec.ts`
  - 2 tests passed.
- PASS: `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store rankings"`
  - 10 tests passed.
- PASS: `npm.cmd --prefix admin-web run lint`
- PASS: `npm.cmd --prefix admin-web run build`
  - Existing Vite chunk-size warning only; exit code 0.
- PASS: `npm.cmd run test:scripts`
  - 498 tests passed.
- PASS: `git diff --check`
