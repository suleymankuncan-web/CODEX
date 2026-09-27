# Store parked routes — 27 September 2026

Status: local PR evidence; not deployment evidence.

## Decision and contract impact

- `/store/visual-campaigns` and `/store/competitions` are temporarily unavailable from Store navigation and direct Store-route access for every persona, including publisher-capable and super-admin sessions.
- This is an intentional frontend access narrowing. It does not remove backend capabilities, change provider configuration, or change `/admin/competitions`.
- Existing route definitions remain in the catalog so later reactivation is an explicit, reviewable change.
- The generated authorization inventory derives `runtimeRoles` from those retained catalog roles; it does not evaluate the temporary `access: () => false` predicate. The route-role matrix and fail-closed browser contracts are the current denial evidence.
- Visual Merchandiser-only sessions continue to land on Checklist and retain Store feed/settings access.

## Risk, rollback, and verification

- Risk class: R5 frontend permission semantics. The change fails closed and adds no role, scope, or action authority.
- One revert restores the previous Store route visibility; no data repair or provider action is required.
- Route-role matrix contract: 4/4 subtests passed in one script.
- Changed TS/TSX ESLint and frontend Playwright build: passed; the existing large-chunk warning remains.
- Targeted route/persona Playwright coverage: 8/8 passed across Region Manager, Store Manager, Store Personnel, Visual Merchandiser, Report Viewer, and Super Admin denial, plus Store portfolio and pilot route checks.
- The five retired positive-route cases are superseded by five fail-closed competition regressions covering privileged contribution denial, zero feature requests/retries, route-lifecycle isolation, English reload persistence, and the locale/navigation boundary; 5/5 passed.
- Store surface split contract: 95 unique regressions retained, 2/2 passed. Store Page QA gate: 1/1 passed.
- Full local E2E, `check:release`, on-prem proof, deployment, and live-provider claims are intentionally not made; mandatory GitHub CI remains unchanged.
