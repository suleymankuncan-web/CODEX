# Store Placeholder Route Decision V1

## Scope

This evidence closes Milestone 6 of the system-flow readiness line.
It classifies the store routes that intentionally have no frontend API calls in
the generated system-flow map:

- `/store/incentives`
- `/store/reports`
- `/store/settings`
- `/store/targets`

It does not change route access, API calls, auth/permission behavior, DB state,
business logic, CSS behavior, or user workflow semantics.

## Sokrates Decision

Decision:

- Keep all four routes in the store shell.
- Treat `/store/settings` as a real utility route with browser-local language
  preference only.
- Treat `/store/reports` and `/store/targets` as honest handoff placeholders
  until native store read models are explicitly scoped.
- Treat `/store/incentives` as product expansion intake/foundation, not a live
  incentive engine.

Why:

- The system-flow map reports these as routes without API calls. That is useful
  pressure, but it is not automatically a bug.
- Existing product evidence already improved the handoff pages and added route
  tests.
- Adding native store target/report/incentive reads now would require product
  contracts beyond this milestone.

Evidence:

- `docs/evidence/product-progress/2026-05-20-store-utility-handoff-v1.md`
  records the V1 improvement for `/store/settings`, `/store/targets`, and
  `/store/reports`.
- `docs/evidence/product-progress/2026-05-20-uiux-v1-route-inventory.md`
  explicitly parks `/store/incentives` as product expansion intake because no
  real incentive domain exists yet.
- `admin-web/e2e/store-surfaces.spec.ts` covers the utility handoff pages,
  mobile width/toolbar clearance, and `/store/incentives` locale/foundation
  behavior.
- `StoreReportsPage.tsx`, `StoreTargetsPage.tsx`, and
  `StoreSettingsPage.tsx` are small utility/handoff components.
- `StoreIncentivesPage.tsx` already states there is no live payout calculation,
  approval outcome, rule lookup, or recalculation contract behind the route.

Counterargument:

- Native store reports, store target detail, and store incentive summaries
  would eventually be more valuable than handoff pages. That is true, but
  building them without a product/API contract would create fake certainty.

Risk:

- LOW for this docs-only route classification.
- MEDIUM for future frontend-only store summary pages over existing read
  endpoints.
- HIGH for new write flows, incentive calculation, target approval semantics,
  report scoring changes, backend aggregates, DB migrations, or auth changes.

Door:

- This classification is a two-way door.
- Native store targets/reports/incentives contracts are medium-to-high-door
  work depending on whether they reuse existing reads or introduce new domain
  semantics.

Stop rule:

- Stop before replacing a handoff page with live data unless the route has a
  named source, product owner, API/read-model contract, auth/scope rule, empty
  and error states, and targeted Playwright/backend tests.

## Route Classification

| Route | Current classification | Why it has no API call | Keep / change now | Future trigger |
| --- | --- | --- | --- | --- |
| `/store/settings` | Real utility route | It owns browser-local language preference and no backend profile contract yet. | Keep. No API needed. | Add backend profile persistence only with a user settings contract. |
| `/store/targets` | Honest handoff placeholder | Store-native target detail/write semantics are not scoped; current working flow is `/admin/targets` and `/store/approvals`. | Keep as handoff. | Add store-native target read only after target product contract and scope rules are explicit. |
| `/store/reports` | Honest handoff placeholder | Store-native report summary is not scoped; store users already have `/store/kpis`, `/store/me`, and `/store/rankings` as real read surfaces. | Keep as handoff. | Add store summary report only if it reuses existing reports reads and has clear V1 copy/tests. |
| `/store/incentives` | Product expansion intake/foundation | No live incentive engine, payout model, rule lookup, approval outcome, or recalculation contract exists. | Keep as intake/foundation. | Start with store-scoped incentive summary cards only after incentive rules/source ownership is decided. |

## What Not To Build Now

Do not use this milestone to add:

- a new store target write path,
- a native store reporting aggregate,
- incentive payout calculations,
- rule/formula management,
- target approval state-machine changes,
- report scoring changes,
- DB migrations,
- auth/permission broadening,
- API Gateway or service decomposition.

## Future Implementation Ladder

1. Keep `/store/settings` utility-only unless backend profile persistence is
   explicitly scoped.
2. If store report summary becomes a product goal, start with a read-only
   frontend slice over existing reports endpoints and targeted
   `store-surfaces` coverage.
3. If store target detail becomes a product goal, start with a read-only target
   visibility slice before any write/approval behavior.
4. If incentives become a product goal, first define the rule owner, source of
   payout truth, audit needs, and whether the store surface is read-only or
   action-taking.
5. Only then consider backend/API changes, and keep them behind OpenAPI
   generated client checks.

## Verification

Docs-only gate:

- `git diff --check`
- `npm.cmd run test:scripts`

Optional product evidence gate when this classification is touched with UI:

- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store utility pages|store incentives" --workers=1`

