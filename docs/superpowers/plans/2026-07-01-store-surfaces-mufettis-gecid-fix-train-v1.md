# Store Surfaces Mufettis Gecid Fix Train V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Store surface issues found by the six-agent Mufettis Gecid audit before pilot usage, without changing approved business formulas or redesigning accepted pages.

**Architecture:** Treat this as a focused stabilization train: workflow correctness first, data/audit correctness second, then state retention and user-facing hygiene. Changes stay inside the Store frontend, existing NestJS read/write services, and narrowly scoped tests. Do not introduce new product flows, visual redesigns, polling, or broad refactors.

**Tech Stack:** React, TanStack Query, Store shell route registry, shadcn primitives already present in the app, NestJS, Supabase Postgres, OpenAPI generated types, Playwright/e2e where existing Store surface tests cover the route.

---

## Read First

- `current-state.md`
- `discipline.md`
- `sokrates.md`
- `contributing.md`
- `docs/superpowers/plans/2026-06-26-store-targets-adaptive-approval-flow-v1.md`
- `docs/superpowers/plans/2026-06-29-store-reports-prototype-to-product-v1.md`
- `docs/superpowers/plans/2026-06-26-store-workforce-norm-kadro-v1.md`
- `docs/superpowers/plans/2026-06-28-store-feed-command-surface-prototype-parity-v1.md`
- `.agents/skills/hr-axis-ui-refactor/SKILL.md`

## Audit Summary

Six read-only agents reviewed Store shell, Store Ops, KPI/Reports, Targets/Incentives, Checklist/Workforce, and Store Me/persona surfaces.

Confirmed high-priority problems:

1. `/store/tasks` Region Manager can still see open/in-progress/blocked action plans, although the intended workflow says Region Manager should only read completed process outcomes.
2. `/store/targets` adjusted approval loses visible before/after audit in the UI after backend overwrites request totals and allocations with final approved values.
3. `/store/reports` can show fallback sections as ready even when backend does not return real package sections.
4. `/store/checklists` period filtering does not fully apply to pending acknowledgement records.
5. `/store/workforce` selected year does not affect the actual headcount/turnover data shown.
6. `/store/rankings` loses period/search/sort/page state after drilling into a personnel profile and returning.
7. Several Store surfaces can still show technical IDs, role codes, raw `Error.message`, no-op actions, or internal/admin copy.

Important non-bugs:

- Store Manager visibility for `/store/reports` is currently blocked in route/nav/backend role guard.
- Current feed create DTO accepts the Region Manager composer payload; the earlier `property postType should not exist` error is not reproducible in current main and should be treated as old deploy/contract drift unless it recurs.
- Incentives company-store-only, cashier exclusion, and Store Manager no-approval behavior are broadly aligned.
- Checklist draft sessions do not appear to write completed visit date before completion.

## Non-Negotiable Constraints

- Do not change KPI score formulas, ranking score formulas, incentive formulas, checklist scoring, target approval business rules, role/scope model, or month-close semantics.
- Do not add polling, timer refresh, or full-page refresh.
- Do not reintroduce Store Manager access to `/store/reports`.
- Do not display UUIDs, request IDs, source IDs, run IDs, provider IDs, or raw role codes in normal Store UI.
- Do not show fake “Hazir” states when backend data is missing.
- Do not hide real backend/network latency with artificial skeleton delays.
- Keep fixes small and testable. If a file grows beyond the repo’s guardrails, extract focused helpers instead of adding large inline blocks.

## PR Train

### PR1: Store Tasks Workflow And Technical Copy Guard

**Risk class:** R2 workflow correctness.

**Goal:** Make `/store/tasks` match the accepted workflow: Store Manager resolves/action-updates tasks; Region Manager reads completed process history and manager notes only.

**Files:**

- Modify: `admin-web/src/pages/StoreTasksPage.tsx`
- Modify: `admin-web/src/features/store-tasks/store-tasks-workbench.tsx`
- Modify: `admin-web/src/features/store-tasks/store-tasks-command-center-model.ts`
- Modify: `admin-web/src/features/store-actions/StoreActionPlanDetailDisclosure.tsx`
- Modify: `admin-web/src/lib/format.ts` only if a shared safe error formatter is needed.
- Modify/Test: `admin-web/e2e/store-surfaces.spec.ts` or existing Store Tasks e2e coverage.

- [ ] **Step 1: Add failing coverage for Region Manager completed-only behavior**

Add or update a Store Tasks test that loads the Region Manager persona and asserts:

```text
Open / in_progress / blocked action plans are not listed in the Region Manager task list.
Completed / resolved action plans remain visible.
Manager note is visible for completed rows.
No solve/update action is visible for Region Manager.
```

Run:

```powershell
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "tasks|Gorevler" --workers=1
```

Expected before fix: test fails because open records can be shown.

- [ ] **Step 2: Constrain Region Manager task rows in the model**

In `store-tasks-command-center-model.ts`, ensure the Region Manager persona receives only terminal/completed rows. Use the existing status names in the model; do not invent new statuses.

The current model maps persisted `closed` plans to UI status `resolved` and `cancelled` plans to UI status `cancelled`. Use the existing `isResultRow(row)` helper or this exact UI-status rule:

```ts
const regionManagerVisibleStatuses = new Set<StoreTaskUiStatus>(['resolved', 'cancelled']);

function isVisibleForRegionManager(row: StoreTaskCommandRow) {
  return regionManagerVisibleStatuses.has(row.uiStatus);
}
```

Do not use raw persisted statuses such as `closed` at the UI row filtering layer unless the row still carries both raw and UI statuses. The current `StoreTaskCommandRow` uses `uiStatus`, so filtering must happen on `resolved`/`cancelled`.

- [ ] **Step 3: Keep Store Manager mutation behavior unchanged**

In `store-tasks-workbench.tsx`, verify the existing mutation guard remains:

```text
canMutateActivePlan === true only for storeManager persona.
```

Do not make Region Manager able to update or close plans.

- [ ] **Step 4: Remove technical fallback copy from access/error state**

Replace UI fallback that can show:

```text
Mağaza: <storeId>
<ROLE_CODE>, <ROLE_CODE>
```

with product copy:

```text
Mağaza bilgisi alınamadı
Rol bilgisi doğrulanamadı
```

Do not expose `scope.storeIds[0]` or `roleCodes.join(', ')` in visible text.

- [ ] **Step 5: Fix elapsed-day same-day calculation**

In `store-tasks-command-center-model.ts`, replace same-day `Math.ceil` behavior with day-boundary logic:

```ts
function elapsedCalendarDays(startIso: string, now = new Date()) {
  const start = new Date(startIso);
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.floor((nowDay - startDay) / 86_400_000));
}
```

Use the project’s existing timezone helper if one exists. Same-day action must not render as `1 gün açık`.

- [ ] **Step 6: Verify**

Run:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "tasks|Gorevler" --workers=1
git diff --check
```

Expected: all pass.

### PR2: Targets Approval Audit And Approvals Hygiene

**Risk class:** R3 backend/read-model correctness.

**Goal:** Preserve adjusted target approval evidence after approval and remove user-facing technical IDs from Store approval surfaces.

**Files:**

- Create: `db/migrations/058_target_distribution_approval_evidence.sql`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/target-distribution.service.ts`
- Modify/Create: `backend/nestjs/src/modules/store-ops/target-distribution-schema-contract.spec.ts` if a schema contract exists or is appropriate for this table.
- Modify: `backend/nestjs/src/modules/store-ops/application/target-distribution.service.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/target-distribution.controller.ts` only if response DTO/OpenAPI needs explicit fields.
- Generate: `docs/api/openapi.json`
- Modify: `admin-web/src/features/targets/api.ts`
- Modify: `admin-web/src/pages/store-targets-region-command-model.ts`
- Modify: `admin-web/src/pages/store-targets-region-command.tsx`
- Modify: `admin-web/src/pages/StoreApprovalsPage.tsx`
- Modify: `admin-web/src/pages/store-approvals-request-center-model.ts`
- Modify: legacy files only if still imported: `admin-web/src/pages/store-approvals-target-approval-ledger.tsx`, `admin-web/src/pages/store-approvals-submitted-targets-panel.tsx`, `admin-web/src/pages/store-approvals-returned-panel.tsx`

- [ ] **Step 1: Add backend test for adjusted approval evidence**

Create or extend a repository/service test where:

```text
Original store target: 1,000,000
Original allocation A: 400,000
Original allocation B: 600,000
Approved store target: 1,100,000
Approved allocation A: 450,000
Approved allocation B: 650,000
```

Expected response/read model must contain both:

```text
originalTotalTargetValue = 1000000
approvedTotalTargetValue = 1100000
originalAllocations with original values
approvedAllocations/final allocations with final values
approvalMode = adjusted
```

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- src/modules/store-ops/application/target-distribution.service.spec.ts --runInBand
```

Expected before fix: visible/read-model delta cannot be reconstructed from the returned request alone.

- [ ] **Step 2: Add persistent approval evidence storage**

Do not rely only on the transient `existing.original_allocation_json` CTE inside `approveRequest`; that data disappears after the transaction response and cannot be listed later.

Add a nullable JSONB evidence column through a forward migration:

```sql
ALTER TABLE ops.target_distribution_request
  ADD COLUMN IF NOT EXISTS approval_evidence_json JSONB;

COMMENT ON COLUMN ops.target_distribution_request.approval_evidence_json
  IS 'Stores original and final target approval evidence for adjusted approvals without changing approved target references.';
```

The JSON shape written during approval must be:

```json
{
  "approvalMode": "direct",
  "originalTotalTargetValue": 1000000,
  "approvedTotalTargetValue": 1100000,
  "originalAllocations": [
    { "employeeId": "...", "assigneeLabel": "...", "targetValue": 400000, "note": "..." }
  ],
  "approvedAllocations": [
    { "employeeId": "...", "assigneeLabel": "...", "targetValue": 450000, "note": "..." }
  ]
}
```

For direct approvals, store `approvalMode: "direct"` and keep original/final values equal. This makes old and future UI logic deterministic.

- [ ] **Step 3: Expose adjusted approval evidence without changing final target behavior**

Current repository already captures `original_allocation_json` and `original_total_target_value` inside `approveRequest`, and writes audit metadata. The fix must make that evidence readable by the frontend after approval.

Acceptable implementation:

```text
Add nullable approval evidence fields to the target distribution request response/read model:
- originalTotalTargetValue
- originalAllocations
- approvedTotalTargetValue
- approvedAllocations
- approvalMode
```

Do not stop overwriting the request’s final approved totals if downstream scoring depends on final approved values. Instead, preserve original/final evidence as separate fields or read it from audit metadata through a stable projection.

`listRequests` must SELECT `tdr.approval_evidence_json` and `mapRequest` must expose it. Do not require the frontend to query `audit.event_log` to reconstruct normal product UI.

- [ ] **Step 4: Update frontend target model**

In `store-targets-region-command-model.ts`, compute:

```ts
type TargetApprovalDelta = {
  mode: 'direct' | 'adjusted';
  originalTotal: number | null;
  finalTotal: number | null;
  totalDelta: number | null;
  changedAllocations: Array<{
    employeeId: string;
    employeeName: string;
    originalTarget: number | null;
    finalTarget: number | null;
    delta: number | null;
  }>;
};
```

If evidence is absent for old records, show neutral copy:

```text
Onay detayı yok
```

Do not reconstruct old values from overwritten final values.

- [ ] **Step 5: Update targets drawer UI**

In `store-targets-region-command.tsx`, after an approval:

```text
All personnel rows remain visible.
Rows changed by BM show final amount and delta.
Rows unchanged still show final amount.
The status can say "Düzenlenerek onaylandı" only if `approvalMode === adjusted`.
```

- [ ] **Step 6: Remove technical IDs from Store Approvals**

Visible Store approval rows must not show:

```text
requestId
submittedByUserId
sourceId
runId
```

Replacement policy:

```text
submittedByUserId -> submitter display name if available, otherwise "Gönderen bilgisi yok"
requestId/sourceId/runId -> hidden from normal Store UI
```

If an ID is needed for support, keep it only in admin/debug evidence, not in Store user-facing components.

- [ ] **Step 7: Verify OpenAPI and frontend**

Run:

```powershell
npm.cmd --prefix backend/nestjs test -- src/modules/store-ops/target-distribution-schema-contract.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- src/modules/store-ops/application/target-distribution.service.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- src/modules/store-ops/infrastructure/target-distribution.repository.spec.ts --runInBand
npm.cmd --prefix backend/nestjs run openapi:generate
npm.cmd --prefix admin-web run api:generate
npm.cmd --prefix admin-web run api:check
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
git diff --check
```

Expected: all pass; OpenAPI changes are limited to target distribution response fields if needed.

### PR3: Reports, Checklist, Workforce Data Correctness

**Risk class:** R2 data honesty.

**Goal:** Stop Store pages from showing wrong-period or fake-ready states.

**Files:**

- Modify: `admin-web/src/pages/store-reports-model.ts`
- Modify: `admin-web/src/pages/StoreReportsPage.tsx`
- Modify: `admin-web/src/pages/store-checklists-logic.ts`
- Modify: `admin-web/src/pages/StoreChecklistsPage.tsx`
- Modify: `admin-web/src/pages/store-workforce-region-view.tsx`
- Modify: `admin-web/src/pages/store-workforce-region-view-model.ts`
- Modify: `admin-web/src/pages/store-workforce-headcount.ts` only if year-based input belongs there.
- Modify: `admin-web/e2e/store-surfaces.spec.ts`
- Add targeted unit tests if existing page model tests exist for these helpers.

- [ ] **Step 1: Fix Store Reports fallback readiness**

In `store-reports-model.ts`, remove the behavior where missing backend sections become ready fallback sections.

Required behavior:

```text
If backend returns sections, render those sections.
If backend returns no sections but storeCount > 0, show module rows as "Veri bekleniyor" / partial, not ready.
If backend returns no store data, the period status must not be "Hazır".
```

Use statuses:

```ts
type ReportSectionStatus = 'ready' | 'partial' | 'missing';
```

Do not invent module values.

- [ ] **Step 2: Add Reports tests**

Add model tests for:

```text
empty summary -> not ready
empty sections + storeCount > 0 -> partial/missing sections
real sections -> real statuses preserved
```

The `admin-web` package does not currently expose a generic unit-test script. Use one of these two project-compatible options:

1. If the behavior can be covered through Playwright, add/extend e2e coverage and run:

```powershell
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "reports" --workers=1
```

2. If a pure helper test is clearer, add it under `admin-web/scripts/*.test.mjs` and run:

```powershell
npm.cmd --prefix admin-web run test:scripts
```

Do not add a new test runner dependency just for this PR.

- [ ] **Step 3: Fix Checklist pending acknowledgement period filter**

In `store-checklists-logic.ts`, apply selected period to pending acknowledgement records using their checklist completed/visit/result timestamp.

Required behavior:

```text
June selected -> only June completed/pending-ack results appear.
May pending acknowledgement does not appear in June.
No completed timestamp -> do not include as completed/pending acknowledgement.
```

Do not filter active draft sessions as completed visits.

- [ ] **Step 4: Add Checklist test/e2e assertion**

Create test data or model test:

```text
May result: pending acknowledgement
June result: pending acknowledgement
Selected period: June
Expected: only June row visible
```

Run targeted checklist tests or e2e route coverage.

- [ ] **Step 5: Fix Workforce year filter honesty**

In `store-workforce-region-view.tsx`, decide one of two explicit behaviors:

Option A, if backend year history is not available:

```text
Keep year selector disabled or label it as current snapshot.
Do not imply that selecting 2025 changes headcount/turnover data.
```

Option B, if enough historical source exists:

```text
Pass selectedYear into the query/model and calculate year-specific shortageDays/turnover.
```

For pilot readiness, choose Option A unless backend historical workforce events already exist. The accepted visible behavior should be honest:

```text
Turnover: Veri yok
Year selector does not pretend to filter data
CSV filename does not imply historical export if values are current snapshot
```

- [ ] **Step 6: Remove UUID fallback in Workforce**

In `store-workforce-region-view.tsx`, replace `storeId` fallback with:

```text
Mağaza adı yok
```

If a store name cannot be resolved, do not show the UUID.

- [ ] **Step 7: Verify**

Run:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "reports|checklists|workforce" --workers=1
git diff --check
```

Expected: all pass.

### PR4: Rankings State Retention And Persona Route Guard

**Risk class:** R2 UX state correctness.

**Goal:** Returning from a personnel profile should restore the exact rankings context, and direct personnel profile access should not show raw backend errors.

**Files:**

- Modify: `admin-web/src/pages/StoreRankingsPage.tsx`
- Modify: `admin-web/src/pages/store-rankings-page-model.ts`
- Modify: `admin-web/src/app/store-route-registry.ts`
- Modify: `admin-web/src/pages/StoreMyPerformancePage.tsx`
- Modify: `admin-web/src/features/auth/role-permission-preview.ts`
- Modify: `admin-web/e2e/store-surfaces.spec.ts` or existing ranking e2e file.

- [ ] **Step 1: Persist rankings context in URL**

Store these fields in query params:

```text
list
period
day if still intentionally supported
search
sortKey
sortDirection
offset/page
scope filter if visible
```

Use stable names:

```text
list=personnel
period=2026-06
q=...
sort=score
dir=desc
page=2
```

- [ ] **Step 2: Restore state from URL on mount**

In `store-rankings-page-model.ts`, extend initial state parsing so the reducer starts from URL-backed values. Invalid params must fall back safely:

```text
invalid period -> current/default period
invalid page -> 1
invalid sort -> default score sort
```

- [ ] **Step 3: Navigate to profile with return URL**

When opening a personnel profile from rankings, preserve the full current `location.pathname + location.search` in location state:

```ts
navigate(profilePath, { state: { returnTo: `${location.pathname}${location.search}` } });
```

The back control in profile should use this when present.

- [ ] **Step 4: Tighten personnel profile route/access UX**

The `/store/personnel/:employeeId` route is currently broadly `authenticated`. Keep backend protection, but make frontend UX cleaner:

```text
Only roles that can open personnel profile through product flow should see a meaningful profile.
Unauthorized/manual direct access should show "Bu personel profiline erişiminiz yok" rather than raw backend error.
```

Do not expose UUID or backend error message.

- [ ] **Step 5: Verify**

Run:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "rankings|personel" --workers=1
git diff --check
```

Expected:

```text
Open personnel tab.
Apply period/search/sort/page.
Open profile.
Go back.
Same tab, same filters, same page, same sort remain.
```

### PR5: No-Op Actions, Error Copy, Internal Copy Hygiene

**Risk class:** R1/P3-P4 polish and maintainability.

**Goal:** Remove misleading buttons and internal/admin/debug language from Store user-facing surfaces.

**Files:**

- Modify: `admin-web/src/pages/store-incentives-region-manager-view.tsx`
- Modify: `admin-web/src/pages/StoreIncentivesPage.tsx`
- Modify: `admin-web/src/pages/StoreFeedPage.tsx`
- Modify: `admin-web/src/pages/StoreHomePage.tsx`
- Modify: `admin-web/src/pages/StoreCompetitionsPage.tsx`
- Modify: `admin-web/src/pages/StoreSettingsPage.tsx`
- Modify: `admin-web/src/features/localization/messages/competition.ts`
- Modify: `admin-web/src/features/localization/messages/store-settings.ts`
- Modify: `admin-web/src/features/localization/messages/store-checklists.ts`
- Modify: `admin-web/src/lib/format.ts`
- Modify: `admin-web/e2e/store-surfaces.spec.ts`

- [ ] **Step 1: Remove or wire no-op Incentives actions**

Find visible buttons with:

```ts
onClick={() => undefined}
```

For Region Manager incentives refresh:

```text
Either wire it to query invalidation/refetch or remove the button.
```

For Store Manager incentives header period/no-op action:

```text
Remove the duplicate/no-op action if the real period picker already exists.
```

- [ ] **Step 2: Sanitize raw error copy**

Create or use a safe user-facing error function:

```ts
export function getUserFacingErrorMessage(error: unknown, fallback: string) {
  const raw = getErrorMessage(error);
  if (/uuid|request id|forbidden|internal|stack|sql|relation|column/i.test(raw)) {
    return fallback;
  }
  return raw;
}
```

Apply only to Store pages where raw backend messages currently surface. Do not remove console/dev diagnostics if they are dev-only.

- [ ] **Step 3: Fix Feed metric copy mismatch**

`Bugün paylaşılan` should not say `Son 24 saat` if the calculation is calendar-day based.

Choose one:

```text
Keep calculation as today and change copy to "Bugün".
Change calculation to rolling 24 hours and keep "Son 24 saat".
```

For pilot clarity, prefer changing copy to `Bugün`.

- [ ] **Step 4: Remove internal copy from Competitions**

Replace user-visible text like:

```text
Snapshot
Veri Kalitesi
Uyarı kodu
kapsam
görünen katkılar
```

with operational copy:

```text
Durum
Katılım
Uyarı
Etkilenen mağaza/personel
```

Do not change API or competition logic.

- [ ] **Step 5: Remove placeholder/internal copy from Settings**

Replace visible text like:

```text
gerçek tercih modeli bağlı değil
tercih modeli
kayıt yeri
etkilediği alan
```

with product-safe copy:

```text
Ayarlar hazırlanıyor
Profil bilgileri
Bildirim tercihleri
Dil ve görünüm
```

If a section is not functional, hide the action or mark it plainly as unavailable without implementation language.

- [ ] **Step 6: Fix checklist close/cancel wording**

Align modal copy:

```text
Button: Kapat ve taslakta bırak
Confirmation: Checklist taslakta kalacak. Ziyaret tamamlandı sayılmayacak.
```

Avoid saying `iptal` if no backend cancellation happens.

- [ ] **Step 7: Verify**

Run:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "feed|incentives|competitions|settings|checklists" --workers=1
git diff --check
```

Expected: no visible no-op actions, no internal/debug copy in audited Store surfaces.

## Cross-PR Closeout

After PR5:

- [ ] Run full frontend checks:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
```

- [ ] Run targeted backend checks if PR2 touched backend:

```powershell
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs test -- src/modules/store-ops --runInBand
```

- [ ] Run release check only after all five PRs are merged:

```powershell
npm.cmd run check:release
```

- [ ] Confirm worktree hygiene:

```powershell
git status --short --branch
```

Expected:

```text
Only known pre-existing evidence PNG files may remain dirty if they were already dirty before this train.
No new untracked prototype/test artifacts.
```

## Definition Of Done

- Region Manager `/store/tasks` no longer shows open/in-progress/blocked work as actionable/current work.
- Store Manager task resolution workflow still works.
- Same-day task elapsed time does not show as `1 gün`.
- Adjusted target approval keeps visible original/final evidence after approval.
- Store approval surfaces do not show `requestId`, `submittedByUserId`, `sourceId`, `runId`, UUID fallback, or raw role codes.
- Store Reports does not mark fallback/no-data sections as ready.
- Checklist selected period applies to pending acknowledgement rows.
- Workforce year selector behavior is honest; it either affects data or does not pretend to.
- Workforce store-name fallback does not display UUID.
- Rankings profile back navigation restores tab, period, search, sort, and page.
- Personnel profile direct unauthorized access shows product-safe copy.
- Incentives visible refresh/period actions are either wired or removed.
- Feed daily metric copy matches the actual calculation.
- Competitions and Settings no longer show admin/debug/internal copy.
- All touched Store surfaces pass lint/build and targeted e2e/model tests.
- No business formulas or role-scope boundaries are broadened.

## Self-Review

Spec coverage:

- Store audit P1/P2 findings are covered by PR1 through PR4.
- User-facing technical copy and no-op action issues are covered by PR5.
- Feed DTO current-code false alarm is intentionally excluded from fix scope.
- Store Reports Store Manager hidden state is verified but not changed.

Hidden side effects checked:

- PR1 does not alter Store Manager mutation permissions.
- PR2 preserves final approved target references and adds evidence rather than changing target scoring inputs.
- PR2 now includes persistent `approval_evidence_json`; without this, adjusted approval details would still vanish after the approval response.
- PR3 prevents fake readiness and wrong-period leakage without changing report/checklist/workforce business formulas.
- PR4 changes navigation state and access UX, not ranking calculation.
- PR5 changes copy/actions only; it does not change workflows.

Recommended execution:

1. Execute PR1 first because it fixes a direct workflow mismatch.
2. Execute PR2 second because target approval audit is business-critical.
3. Execute PR3 third because it fixes data honesty across three Store pages.
4. Execute PR4 fourth because it improves daily ranking/profile workflow without backend risk.
5. Execute PR5 last as cleanup and polish.
