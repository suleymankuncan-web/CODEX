# Store Workforce And Approvals Split PR-3 Evidence

Date: 2026-06-05

## Scope

- Implemented the Store Manager `/store/workforce` view.
- The page reads active store employees from the existing workforce API.
- Personnel count, position distribution, tenure average, and tenure buckets are derived from real employee records.
- Seller-code and offboarding creation/correction flows are available from Workforce by reusing the existing Store Approvals mutation contracts.
- Region Manager remains on the honest foundation state in this PR.

## Contract Impact

- API shape: unchanged.
- DB schema: unchanged.
- Auth/permission semantics: unchanged.
- Seller-code lifecycle: unchanged.
- Offboarding lifecycle: unchanged.
- Returned request identity: preserved.
- Store Approvals forms: still present; cleanup is intentionally deferred to PR-5.

## Behavior Parity

- Store Manager access uses true action-scope store ids.
- Read-scope-only Store Manager and reporting users do not see the route.
- Store Personnel does not see the route.
- Seller-code/offboarding movements are filtered to the active action-scope store before display or returned-request editing.
- Seller-code submit payload matches the existing Store Approvals payload shape.
- Offboarding submit payload matches the existing Store Approvals payload shape.
- Returned seller-code and offboarding corrections resubmit the same request id.

## Visual QA

- Desktop coverage is included in the targeted Store Workforce route/read e2e checks.
- Mobile coverage is included in `store workforce page keeps the store manager surface usable on mobile`.
- The mobile guard checks the page renders at `390x844`, keeps the action surface visible, and has no document-level horizontal overflow.

## Verification

- `npm.cmd --prefix admin-web run lint`: pass
- `npm.cmd --prefix admin-web run build`: pass
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store workforce"`: pass, 10/10
- `npm.cmd run system-flow:generate`: pass; refreshed the generated route/API flow map for the new Workforce API calls.
- `npm.cmd run test:scripts`: pass, 406/406
- `git diff --check`: pass

## Guard Notes

- `StoreWorkforcePage.tsx` was split from data derivation helpers to keep active source files within the 900-line guard.
- `docs/flows/store-ops-system-flow.json` and `.html` changed only because `/store/workforce` now reads existing workforce endpoints.

## Deferred

- Region Manager workforce table and store-detail modal are PR-4.
- Approvals creation form cleanup is PR-5 after Workforce replacement is proven.
