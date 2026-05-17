# Master Data Sections v1

Date: 2026-05-17
Branch: `codex/master-data-sections-v1`

## Why This Is Worth Doing

React Doctor still flags broad admin pages, but this slice is not a score chase. `MasterDataBootstrapPage` owns live master-data bootstrap review, promotion readiness evidence, store master edits, and personnel master edits. Those are operationally sensitive surfaces where a smaller component boundary reduces the risk of future changes.

Auth and Integration remain deferred because they are broader surfaces and should be split only around a concrete product change or active risk.

## Scope

- Move master-data query orchestration into a focused hook.
- Move validate/promote mutation orchestration into a focused hook while keeping cache invalidation explicit.
- Split stable command UI into hero, metrics, promotion feedback, tabs, batches, store, personnel, and history sections.
- Move store/personnel draft merge, bulk-save, and cache update helpers out of the page component.
- Preserve copy, routes, query keys, mutation behavior, and table edit semantics.

## Verification

- `npm.cmd --prefix admin-web run lint`
- `npx.cmd --yes react-doctor@latest admin-web --full --offline --fail-on none`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run test:e2e -- admin-routing.spec.ts -g "master data"`
- `npm.cmd --prefix admin-web run test:e2e -- integration-surfaces.spec.ts -g "master data bootstrap|store master"`
- `npm.cmd --prefix admin-web run check:release`
- `npm.cmd run check:release`

## Expected Result

React Doctor should no longer report `MasterDataBootstrapPage`. Remaining Auth and Integration giant-component findings are intentionally deferred.

Deploy note: frontend-only refactor. No manual Render backend deploy should be required after merge; normal frontend deployment is enough.

PR summary: Master data command center now keeps bootstrap promotion and master-data edit behavior intact while rendering query, mutation, section, draft-save, and cache-update responsibilities through focused boundaries.
