# Store Approvals Sections v1

## Goal

Reduce the Store Approvals page risk without changing target distribution, seller code, offboarding, or returned-request behavior.

## Why This Matters

`StoreApprovalsPage` owns live store manager submissions, region manager target approvals, HR-bound workforce request handoff, and returned-request resubmission. Its previous single-component shape made those workflows harder to review safely. This is useful product maintenance, not a cosmetic React Doctor chase.

## Scope

- Split the ledger header, metrics band, and action workbench into focused components.
- Keep query keys, mutations, role checks, target approval guards, copy, and CSS class names intact.
- Group workbench inputs by request surface so the extraction does not create a long chain of unrelated boolean props.

## Verification

- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npx.cmd --yes react-doctor@latest admin-web --full --offline --fail-on none`
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store approvals page"`
- `npm.cmd --prefix admin-web run test:e2e -- pilot-api-contracts.spec.ts -g "store approvals render pending requests with nullable approval fields"`
- `npm.cmd --prefix admin-web run check:release`
- `npm.cmd run check:release`

## Result

React Doctor dropped the Store Approvals giant component finding; the project moved from 6 issues across 5 files to 5 issues across 4 files. The score remains 99/100 because the remaining findings are other giant components.

## Deploy Note

This is a frontend-only refactor. After merge, the normal frontend deployment pipeline is enough; no manual Render backend deploy is required.

## PR Summary

Store approvals now render through focused header, metrics, and workbench sections without changing target approval or workforce request behavior.
