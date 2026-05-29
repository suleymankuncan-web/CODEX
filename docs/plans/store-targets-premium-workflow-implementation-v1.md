# Store Targets Premium Workflow Implementation Plan

Date: 2026-05-29

## Goal

Move the approved `docs/prototypes/store-targets-premium-workflow.html` workflow into the real `/store/targets` page without fake data, without changing auth/API/DB semantics, and without leaving old handoff/utility UI remnants.

This is a production UI refactor over the existing target distribution contracts. It must stay inside current business behavior unless a missing contract is explicitly noted below.

## Current Evidence

- Production route: `admin-web/src/pages/StoreTargetsPage.tsx`
- Current section components: `admin-web/src/pages/store-targets-contract-sections.tsx`
- Prototype source: `docs/prototypes/store-targets-premium-workflow.html`
- Frontend target API wrapper: `admin-web/src/features/targets/api.ts`
- Backend target API:
  - `GET /api/target-distributions/requests`
  - `GET /api/target-distributions/coverage`
  - `GET /api/target-distributions/store-personnel`
  - `POST /api/target-distributions/requests`
  - `PATCH /api/target-distributions/requests/:requestId/approve`
- Existing e2e coverage: `admin-web/e2e/store-surfaces.spec.ts`

## Non-Negotiable Guardrails

- No fake target, store, personnel, approval, coverage, or revision data.
- No API shape change, DB migration, auth/permission change, or approval state-machine change in this UI slice.
- Use shadcn/ui, Tailwind v4 utility classes, and lucide icons as one locked
  stack. A local ad hoc UI primitive cannot replace this standard.
- Keep role-fit:
  - Region manager/super admin: approval flow and approved list.
  - Store manager/super admin with assigned store: distribution request and revision request.
  - Report viewer: approved/read-only surfaces.
  - Store personnel/VM: no `/store/targets` access and no target toolbar item.
- Do not add a production role switch. The page adapts to the resolved session
  role; prototype role-switch controls are reference-only.
- `/store/incentives` remains parked and untouched.
- No internal copy such as API/DB/contract/mock/debug on the user-facing page.

## Prototype Workflow Inventory

### 1. Metrics Row

Prototype has four compact cards:

- Personel coverage: percentage plus `covered / total`.
- Store coverage: percentage plus `covered stores / total stores`.
- Pending decisions: pending store requests.
- Stores with no request/target: missing store target coverage.

Production binding:

- Personel coverage comes from `TargetCoverageSummary.coveredEmployees / totalEmployees`.
- Store coverage must be derived from real `coverageRows` by unique `storeId`.
  - Covered store: at least one row in the store has `targetStatus === "approved"`.
  - Pending store: at least one row has `targetStatus === "pending_region_approval"` or `"pending_change_conflict"`.
  - Missing store: no approved or pending target rows.
  - Total store denominator is unique stores returned by coverage. This is honest to the current contract; it does not imply all assigned stores if the backend did not return stores with no active personnel.
- Pending decisions comes from `pendingRequests.length`.
- Missing/no-request stores comes from the derived store coverage summary.

### 2. Filters

Prototype has search, period, store, status, reset.

Production binding:

- Keep current period `Input type="month"`.
- Keep current store `Select`.
- Add local search and status filter only over already fetched lists.
- Reset clears search, status, and store where role allows all stores.
- Do not add new server query params unless existing wrapper already supports them.

### 3. Flow Tabs

Prototype tabs:

- `Onay akışı`
- `Dağıtım talebi`
- `Revize Talebi`
- `Onaylananlar`

Production binding:

- Use shadcn `ToggleGroup` / `ToggleGroupItem`.
- Render only role-appropriate tabs.
- Do not render a role switch in production.
- Do not auto-switch to `Onaylananlar` after approving; stay on the current tab.
- Default tab:
  - Region manager/super admin with pending requests: `Onay akışı`.
  - Store manager with create permission: `Dağıtım talebi`.
  - Report viewer: `Onaylananlar`.

### 4. Onay Akışı

Prototype behavior:

- Pending store cards show store, date, target label, total, person count, coverage.
- Risk/problem rows use rose treatment.
- Clean rows use cyan treatment.
- Accordion opens personnel allocation detail.
- Region manager can approve or request revision.
- Approved store moves out of approval flow and appears under `Onaylananlar`; no automatic tab jump.

Production binding:

- Use `pendingRequests`.
- Expand/collapse is local UI only.
- Approve uses existing `approveTargetDistributionRequest`.
- After approve success:
  - Invalidate target request and coverage queries.
  - Keep active tab unchanged.
  - The approved request appears in `Onaylananlar` after refetch/current query data update.
- `Revize iste` is a note-only visual affordance in prototype but no backend endpoint exists. In production this must be parked unless implemented as an approval denial/revision endpoint. Do not show a working `Revize iste` button unless it has a real backend action.

### 5. Dağıtım Talebi

Prototype behavior:

- Store manager enters total target with currency formatting.
- Active personnel rows are editable.
- Allocated total, remaining target, person count, share, and row status update live.
- Submit is disabled until:
  - target label exists,
  - total target is greater than zero,
  - every active personnel row has a target,
  - allocated total equals total target.

Production binding:

- Use current `store-personnel` query.
- Keep current `createTargetDistributionRequest` payload.
- Replace number inputs with text inputs that format TRY while preserving numeric state internally.
- No fake personnel rows. Empty personnel query shows empty state.

### 6. Revize Talebi

Prototype behavior:

- Separate tab.
- Shows approved monthly target snapshots.
- Snapshot opens with `Revize oluştur`.
- Revision targets become editable.
- Note is required.
- Revised total must equal approved total; otherwise submit is disabled.

Production binding with current API:

- Approved snapshots come from `approvedRequests`.
- Approved request allocations are already available in `TargetDistributionRequest.allocations`.
- A revision can be submitted through existing `POST /target-distributions/requests` as a new pending target distribution request for the same store/month/label with the edited allocations and note.
- Because the current API has no explicit revision type, parent request id, or revision status, the UI must not claim a dedicated revision state beyond "new approval request from approved snapshot".
- Product/API note for later discussion:
  - Add explicit revision metadata if the business needs audit distinction between first request and revision request.
  - Add reject/revise-request endpoint if region manager should request revision directly from approval flow.

### 7. Onaylananlar

Prototype behavior:

- Renamed from `Kapsam izleme`.
- Shows approved stores/snapshots.
- Store cards are read-only.

Production binding:

- Use `approvedRequests`.
- Do not show approved rows based on local-only optimistic movement unless mutation result/query data proves approval.
- Empty state when no approved requests exist.
- Include approved request month, store, total, allocation count, approved date, and allocation detail.

## Implementation Plan

### Slice Shape

One frontend PR is acceptable if it stays UI-only:

- Same domain: `/store/targets`.
- Same risk class: production UI refactor over existing target contracts.
- Same rollback: revert frontend files and tests.
- No API/DB/auth changes.

If implementation reveals a required API change, stop before coding that change and record it as a product/API note.

### File Plan

- `admin-web/src/pages/StoreTargetsPage.tsx`
  - Keep data fetching and mutations.
  - Add derived summaries and active tab state.
  - Replace old layout composition with premium workflow composition.
  - Keep route access guard and current query enablement.

- `admin-web/src/pages/store-targets-contract-sections.tsx`
  - Keep backend-bound approval/create/revision/approved components here.
  - Use existing shadcn-backed Store surface primitives where they preserve the
    new design language.
  - Do not add fake data or role switch helpers.

- `admin-web/e2e/store-surfaces.spec.ts`
  - Update existing store target tests.
  - Add targeted tests for role-fit tabs, approved list, revision validation,
    no auto-switch on approve, and personnel route blocking.

- `docs/plans/store-targets-premium-workflow-implementation-v1.md`
  - This plan.

## Application Plan

1. Build typed helper functions.
   - `deriveStoreTargetCoverageSummary(coverageRows)`
   - `formatCurrencyInputValue(value)`
   - `parseCurrencyInputValue(value)`
   - `formatRequestMonthLabel(value, locale)`
   - `getRequestTone(request, coverageRows)`

2. Add tab model.
   - `approval`
   - `distribution`
   - `revision`
   - `approved`
   - Role-gate visible tabs.
   - Render with shadcn `ToggleGroup`; this is the workflow selector, not a
     user role switch.

3. Replace metrics.
   - Personel coverage card.
   - Store coverage card.
   - Pending decision card.
   - Missing/no-request store card.
   - No progress bar in person/store coverage cards.

4. Replace approval queue UI.
   - Compact store rows.
   - Accordion allocation detail.
   - Cyan treatment for clean rows, rose/warning for risk rows.
   - Approve action uses existing mutation.
   - No auto-navigation after approval.
   - Do not implement `Revize iste` as a working backend action.

5. Replace distribution request UI.
   - Currency formatted total target.
   - Currency formatted allocation rows.
   - Live allocated total/remaining/person count/share.
   - Submit disabled until totals match and all rows have targets.

6. Add revision tab.
   - Approved request snapshots from `approvedRequests`.
   - Read-only until `Revize oluştur`.
   - Editable allocation amounts after opening.
   - Note required.
   - Revised total must equal approved total.
   - Submit uses existing create request mutation with same month/store and edited allocations.
   - After submit, invalidate requests/coverage and show success message.

7. Add approved tab.
   - Approved requests from API.
   - Read-only snapshot cards.
   - Empty state if no approved requests.

8. Remove old UI remnants.
   - Old generic `StoreSurfaceHeader` long contract copy.
   - Old progress card in coverage metric.
   - Old coverage panel titled "Hedef referans kapsami" as primary surface.
   - User-facing internal wording such as "contract".

9. Mobile pass.
   - Flow tabs wrap/scroll without text overlap.
   - Accordion detail stays readable.
   - Currency inputs do not overflow.
   - No nested local scrollbars in approval list.

## Test Plan

### Static Checks

- `git diff --check`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`

### Targeted E2E

Update/add tests in `admin-web/e2e/store-surfaces.spec.ts`:

1. Store manager distribution submit still posts the same existing payload.
2. Store manager sees distribution/revision/approved flows but not approval flow.
3. Region manager sees approval/approved flows but not distribution/revision flows.
4. Region manager approval still PATCHes the same existing endpoint and does not auto-switch tabs.
5. Approved request appears under `Onaylananlar` only after the refetched API data is approved.
6. Revision tab shows approved snapshots from API data.
7. Revision submit is disabled when revised total differs from approved total.
8. Revision submit is disabled without note.
9. Revision submit posts a new create request payload only when totals match and note exists.
10. Store personnel cannot open `/store/targets`.

Command:

```powershell
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts --grep "store targets"
```

### Visual QA

- Desktop viewport around 1440px:
  - metrics row,
  - approval accordion,
  - distribution form,
  - revision tab,
  - approved tab.
- Mobile viewport around 390px:
  - tabs,
  - accordion rows,
  - allocation table fallback,
  - revision inputs.

### Release Gate

If the frontend diff remains scoped:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts --grep "store targets"
git diff --check
```

If broader Store shell or route behavior changes unexpectedly, run:

```powershell
npm.cmd --prefix admin-web run check:release
```

## Explicit Parked Items

- Region manager `Revize iste` action needs a backend state/endpoint. Do not fake it in production UI.
- Explicit revision metadata or parent request id is not available in the current contract. Current UI can submit a new pending request from an approved snapshot, but it cannot persist "this is a revision of request X" without API work.
- Store coverage denominator is limited to stores represented by current coverage rows. If business needs all assigned stores including no-active-personnel stores, backend coverage summary must add store-level totals.
