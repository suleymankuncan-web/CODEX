# Store Command Canvas Legacy Deletion Manifest V1

Date: 2026-07-16
Scope: PR 7 of `store-incentives-targets-command-canvas-production-cutover-plan-v1.md`

## Decision

The Incentives route already has one Command Canvas owner. The Targets route
now has one Command Canvas owner for Report Viewer, Region Manager and Store
Manager. The former Store Targets fallback was unreachable for the authorized
route personas, but it and its global styles still shipped in the production
bundle. They are deleted rather than hidden.

## Deleted route owners

- `admin-web/src/pages/store-targets-approval-queue.tsx`
- `admin-web/src/pages/store-targets-contract-sections.tsx`
- `admin-web/src/pages/store-targets-page-model.ts`
- `admin-web/src/pages/store-targets-page-widgets.tsx`
- `admin-web/src/pages/store-targets-period-picker.tsx`
- `admin-web/src/pages/store-targets-region-command-model.ts`
- `admin-web/src/pages/store-targets-region-command.tsx`
- the embedded `StoreTargetsLegacyPage` branch in `admin-web/src/pages/StoreTargetsPage.tsx`

## Deleted styles

- `admin-web/src/styles/store-targets-command.css`
- `admin-web/src/styles/store-targets-command-contracts.css`
- `admin-web/src/styles/store-targets-prototype.css`
- `admin-web/src/styles/store-targets-prototype-drawer.css`
- their four global imports in `admin-web/src/index.css`

## Intentionally preserved

- `TargetApprovalQueuePage.tsx` and its Admin route behavior.
- Store Approvals target request/ledger components still owned by `/store/approvals`.
- Target API clients and lifecycle payloads used by the Command Canvas owners.
- Shared Store shell, Command Canvas primitives and deterministic parity fixtures.
- The external Labs prototypes as immutable design references; they are not
  imported by production.

## Mechanical proof

The closeout E2E contract and canonical build prove:

1. every deleted file is absent;
2. source imports and `index.css` contain none of the deleted owners;
3. `/store/targets` has one route owner;
4. built JavaScript and CSS contain none of the obsolete selectors or internal
   prototype identifiers;
5. production Targets renders no former heading, tab, action-column or panel;
6. production Incentives contains no internal prototype route, shell or role
   switcher;
7. the Admin Incentives and Admin Targets suites remain unchanged and green.

Completion remains subject to the sanitized controlled-pilot record and the
separate `Prototype parity: PASS` statements for Incentives and Targets.
