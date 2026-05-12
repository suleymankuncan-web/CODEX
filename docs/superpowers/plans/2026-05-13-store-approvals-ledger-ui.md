# Store Approvals Ledger UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the live `/store/approvals` page content with the approved ledger-table experience, remove the prototype SM/BM switch, and derive the visible queues/actions from the authenticated user's role. Keep the current live sidebar unchanged in this slice. The final page must use the current project palette and must not show old UI fragments.

**Architecture:** The existing store shell and sidebar stay intact. `StoreApprovalsPage` becomes a role-aware ledger surface that orchestrates existing target-distribution and workforce request APIs. Store managers see target distribution plus HR/IK-backed seller-code and offboarding requests. Region managers and higher approval roles see target-distribution approval/review only, and do not query or render store-personnel seller-code/offboarding queues. Checklist/store-operation approval actions are omitted from this slice unless there is an existing backed API contract; the current checklist API is acknowledgement-oriented, not a BM approval queue.

**Tech Stack:** React + TypeScript, existing admin web API clients, existing localization dictionaries, Playwright E2E, CSS in `admin-web/src/index.css`.

---

## GSD Notes

GSD was run before writing this plan. The default configured model failed with `Model not found gpt-5.2`, so the analysis was rerun with `openai-codex/gpt-5.4`.

GSD's useful recommendations for this slice:

- Keep the PR focused on `/store/approvals`.
- Do not touch the live sidebar yet.
- Remove all prototype role-switch UI and resolve persona from auth/session.
- Keep SM HR/IK workflows visible only for `STORE_MANAGER`.
- Keep BM and higher roles away from seller-code/offboarding queues.
- Do not invent unsupported BM checklist/store-operation actions in the UI.
- Prove the behavior with tests before implementation.

## Current Code Facts

- Main page: `admin-web/src/pages/StoreApprovalsPage.tsx`
- Auth helpers: `admin-web/src/features/auth/authorization.ts`
- Target APIs: `admin-web/src/features/targets/api.ts`
- Workforce APIs: `admin-web/src/features/workforce/api.ts`
- Checklist APIs: `admin-web/src/features/checklists/api.ts`
- Relevant E2E: `admin-web/e2e/store-surfaces.spec.ts`
- Approved prototype reference: `outputs/store-approvals-03-ledger-table.html`

The current live page still renders old structures such as hero panels, metric cards, stacked panels, and explanatory route cards. These should be replaced with the ledger layout inside the page content area only.

## Implementation Tasks

- [ ] Add a red E2E test proving BM/upper roles do not see HR/IK workforce queues.
  - File: `admin-web/e2e/store-surfaces.spec.ts`
  - Create a session fixture with `REGION_MANAGER`.
  - Route `**/api/workforce/seller-code-requests**` and `**/api/workforce/offboarding-requests**` so the test fails if those APIs are called.
  - Visit `/store/approvals`.
  - Assert the ledger surface loads.
  - Assert there is no visible prototype role switch.
  - Assert there is no `SM`, `BM`, or role toggle button in the top-right content area.
  - Assert these SM-only labels are absent:
    - `Satıcı kodu talebi`
    - `Personel çıkış talebi`
    - `İade edilen personel talepleri`

- [ ] Add or adapt red E2E coverage for SM target distribution in the new ledger UI.
  - Keep the existing POST payload assertion:
    ```ts
    {
      storeId: demoStoreId,
      requestMonth: '2026-04-01',
      targetLabel: 'Aylık personel hedef dağıtımı',
      totalTargetValue: 100000,
      allocations: [
        {
          employeeId: demoEmployeeId,
          assigneeLabel: 'Store Personnel',
          targetValue: 100000,
          note: '',
        },
      ],
    }
    ```
  - The accessible form label can remain `Hedef dağıtım talebi formu`.
  - The visible page heading should move to the new ledger title, for example `Talepler / Onaylar Ledger`.

- [ ] Add or adapt red E2E coverage for SM workforce flows in the new ledger UI.
  - Keep existing seller-code request payload assertions.
  - Keep existing offboarding request payload assertions.
  - Keep returned request edit/resubmit behavior.
  - Preserve accessible form labels:
    - `Satıcı kodu talebi formu`
    - `Personel çıkış talebi formu`
  - The visual containers can change completely, but these labels should remain for accessibility and test stability.

- [ ] Add a small page-local role resolver.
  - Preferred location: inside `admin-web/src/pages/StoreApprovalsPage.tsx` unless the file becomes too large.
  - If extracted, use `admin-web/src/pages/store-approvals-model.ts`.
  - Use the existing `hasAnyRole` helper.
  - Shape:
    ```ts
    type StoreApprovalsPersona = 'storeManager' | 'regionManager' | 'readOnly';

    function resolveStoreApprovalsPersona(authSummary: AuthSessionSummary | null): StoreApprovalsPersona {
      if (hasAnyRole(authSummary, ['REGION_MANAGER', 'SUPER_ADMIN', 'REPORT_VIEWER'])) {
        return 'regionManager';
      }
      if (hasAnyRole(authSummary, ['STORE_MANAGER'])) {
        return 'storeManager';
      }
      return 'readOnly';
    }
    ```
  - Derive gates from that persona:
    ```ts
    const isStoreManagerLedger = persona === 'storeManager';
    const isRegionManagerLedger = persona === 'regionManager';
    const showWorkforceHrQueues = isStoreManagerLedger && canCreateForStore;
    const showTargetApprovalQueue = isRegionManagerLedger && canApproveTargetRequests;
    ```

- [ ] Tighten query `enabled` conditions.
  - Seller-code and offboarding request queries must only run when `showWorkforceHrQueues` is true.
  - Store employee and position queries used only by SM workforce forms must only run when their forms can render.
  - Target distribution list query stays available for roles allowed by `canListTargetDistributionRequests`.
  - Target approval mutation is available only when `canApproveTargetDistributionRequest(authSummary)` is true.

- [ ] Replace the old render tree with the ledger layout.
  - Do not modify the store sidebar component.
  - Do not copy the prototype sidebar into live React.
  - Do not render prototype role buttons.
  - Use a page wrapper such as:
    ```tsx
    <section className="store-approvals-ledger-page" aria-labelledby="store-approvals-ledger-title">
    ```
  - Include compact ledger sections:
    - Header/status strip
    - KPI summary row using existing counts
    - Target distribution ledger
    - SM-only seller-code ledger/editor
    - SM-only offboarding ledger/editor
    - BM/upper target approval ledger
  - Remove old explanatory route cards and old panel language from this page.

- [ ] Preserve existing behavior while changing the presentation.
  - `createTargetDistributionRequest` remains the source for SM target distribution.
  - `approveTargetDistributionRequest` is used only for BM/upper target approvals.
  - `createSellerCodeRequest`, `resubmitSellerCodeRequest`, `createOffboardingRequest`, and `resubmitOffboardingRequest` remain SM-only.
  - Success and error notices continue using the existing notice system.

- [ ] Update localization keys.
  - File: `admin-web/src/features/localization/messages/store-approvals.ts`
  - Add clean Turkish and English copy for:
    - `storeApprovals.ledgerTitle`
    - `storeApprovals.ledgerEyebrow`
    - `storeApprovals.storeManagerSubtitle`
    - `storeApprovals.regionManagerSubtitle`
    - `storeApprovals.targetQueueTitle`
    - `storeApprovals.workforceQueueTitle`
    - `storeApprovals.targetApprovalQueueTitle`
    - `storeApprovals.emptyQueue`
  - Do not do a global localization cleanup in this PR.
  - Remove old keys only after TypeScript confirms they are unused.

- [ ] Add page-scoped CSS using the current project palette.
  - File: `admin-web/src/index.css`
  - Use existing store command variables where available.
  - Add styles under page-specific selectors only:
    - `.store-approvals-ledger-page`
    - `.store-approvals-ledger-header`
    - `.store-approvals-ledger-metrics`
    - `.store-approvals-ledger-table`
    - `.store-approvals-ledger-row`
    - `.store-approvals-ledger-editor`
    - `.store-approvals-ledger-status`
  - Keep the look aligned with the current premium light palette from the store shell.
  - Avoid changing sidebar selectors in this slice.

- [ ] Update navigation readiness tests.
  - File: `admin-web/e2e/store-surfaces.spec.ts`
  - Existing store navigation tests currently wait for `Hedef dağıtım talebi`.
  - Change the `/store/approvals` ready marker to the new stable ledger heading or a specific `data-testid`.

- [ ] Run focused verification.
  - Commands:
    ```powershell
    npm.cmd run test:e2e -- --grep "store approvals page"
    npm.cmd run test:e2e -- --grep "store sidebar transitions across visible manager pages"
    npm.cmd run build
    npm.cmd run check:release
    ```
  - If the full release check is too slow during iteration, use the two focused E2E commands first, then run `check:release` before merge.

## Acceptance Criteria

- [ ] `/store/approvals` shows the new ledger UI only.
- [ ] The live sidebar remains unchanged.
- [ ] No prototype SM/BM role switch is visible.
- [ ] Role visibility comes from authenticated session roles.
- [ ] Store manager can create target distribution, seller-code, and offboarding requests.
- [ ] Store manager can edit and resubmit returned seller-code/offboarding requests.
- [ ] Region manager and upper approval roles do not see or query seller-code/offboarding queues.
- [ ] Region manager and upper approval roles can review/approve target distribution requests only when existing auth/API allows it.
- [ ] Unsupported checklist/store-operation approval actions are not displayed as fake UI.
- [ ] The page uses the current project palette and contains no old hero/panel/card fragments from the previous UI.
- [ ] Focused E2E, build, and release check pass.

## Out Of Scope For This Slice

- Sidebar redesign.
- Checklist approval workflow without a backed API contract.
- Store-operation approval workflow without a backed API contract.
- Mobile-specific layout tuning.
- Global localization cleanup outside this page.
