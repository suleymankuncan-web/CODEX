# Store Operational Surfaces Legacy Deletion Manifest V1

Date: 2026-07-17
Plan: `docs/plans/store-operational-surfaces-command-canvas-production-cutover-plan-v1.md`
Scope: PR 7 closeout for KPI Özetleri, Talep Merkezi, Norm Kadro and Görevler

## Decision

Each route has one production presentation owner. Former route owners were
deleted in their owning cutover PR instead of being hidden behind flags or
kept as fallbacks. The KPI route was replaced in place; it has no second legacy
route branch to delete.

## Deleted Talep Merkezi owners

- `admin-web/src/pages/store-approvals-submitted-targets-panel.tsx`
- `admin-web/src/pages/store-approvals-target-approval-ledger.tsx`
- `admin-web/src/pages/store-approvals-target-request-form.tsx`
- `admin-web/src/pages/store-approvals-workbench.tsx`

The retained request-center models, atoms and forms are active production
owners used by Talep Merkezi and the authorized Workforce handoff. They are not
legacy fallbacks.

## Deleted Norm Kadro owners and styles

- `admin-web/src/pages/store-workforce-filter-select.tsx`
- `admin-web/src/pages/store-workforce-headcount.ts`
- `admin-web/src/pages/store-workforce-model.ts`
- `admin-web/src/pages/store-workforce-region-detail-panes.tsx`
- `admin-web/src/pages/store-workforce-region-metrics.tsx`
- `admin-web/src/pages/store-workforce-region-model.ts`
- `admin-web/src/pages/store-workforce-region-view-model.ts`
- `admin-web/src/pages/store-workforce-region-view.tsx`
- `admin-web/src/pages/store-workforce-store-manager-presentation.tsx`
- `admin-web/src/pages/store-workforce-store-manager-view-model.ts`
- `admin-web/src/styles/store-workforce-command-list.css`
- `admin-web/src/styles/store-workforce-command-modal.css`
- `admin-web/src/styles/store-workforce-command.css`

## Deleted Görevler owners and styles

- `admin-web/src/features/store-tasks/store-tasks-command-center-model.ts`
- `admin-web/src/features/store-tasks/store-tasks-command-center.css`
- `admin-web/src/features/store-tasks/store-tasks-workbench.tsx`

## KPI Özetleri in-place cutover

`StoreKpiHighlightsPage` remains the single route owner. The accepted Command
Deck, company hierarchy, region hierarchy and personnel drill-down replaced
the former presentation inside that owner. No legacy KPI branch, role switcher
or alternate route owner remains.

## Intentionally preserved

- real API clients, generated OpenAPI types and role-scope contracts;
- shared Command Canvas primitives and Store shell;
- request-center models/forms still used by authorized workflows;
- deterministic Playwright fixtures, which live only under `admin-web/e2e`;
- the external Labs prototype as an immutable design reference outside the
  repository and production bundle.

## Mechanical proof

`scripts/store-operational-surfaces-closeout-contract.test.mjs` proves:

1. every path in this deletion manifest is absent;
2. no active frontend source references a deleted owner or stylesheet;
3. each route is registered exactly once and resolves to one production page;
4. closeout evidence contains a separate parity decision for every route.

The per-route Playwright suites additionally prove role scope, read-only Report
Viewer behavior, local filters/sorts, responsive states, overlay behavior and
the absence of Labs controls or former selectors.
