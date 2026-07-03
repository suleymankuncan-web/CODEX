# Store Manager Persona Audit Fix Train V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store Manager personasinin tum `/store` sayfalarinda dogru role/scope, dogru workflow, temiz kullanici dili, kabul edilebilir performans ve tekrar edilebilir smoke kaniti ile pilot seviyesine getirilmesi.

**Architecture:** Bu plan yeni urun akisi icat etmez; mevcut Store shell, route registry, TanStack Query, NestJS Store Ops API ve Playwright test yapisi uzerinde stabilizasyon yapar. Riskli contract/performance isleri UI hijyeninden ayrilir; Store Manager yetkileri genisletilmez, sadece hatali handoff, veri siniri, query key ve copy sorunlari duzeltilir.

**Tech Stack:** React, TypeScript, TanStack Query, Store shell route registry, NestJS, Supabase Postgres, OpenAPI generated types, Playwright/e2e, Node test scripts, HR Axis Store UI standards.

---

## Read First

- `CONTRIBUTING.md`
- `current-state.md`
- `sokrates.md`
- `discipline.md`
- `docs/process/product-experience-principles.md`
- `docs/process/ui-surface-standard-v1.md`
- `docs/process/store-admin-surface-standardization-v1.md`
- `docs/superpowers/plans/2026-07-01-store-surfaces-mufettis-gecid-fix-train-v1.md`

## Baseline Evidence

Store Manager staging smoke passed with the pilot Store Manager credentials from `admin-web/.env.local`. Secrets were not logged.

Verified:

- Landing route: `/store/home`
- Role: `STORE_MANAGER`
- Assigned store scope present
- Browser session cookie is `HttpOnly`, `Secure`, `SameSite=Lax`
- App bearer/id token is not stored in local/session storage
- Unsafe request without CSRF header returns `403`
- Logout clears app cookie

Known worktree note:

- `discipline.md` was already modified before this audit. Do not modify or revert it in this train unless the user explicitly asks.

## Audit Summary

No P0 Store Manager permission leak was found.

Confirmed issues:

1. P1: Store shell and sidebar can prefetch heavy route data before the user opens the route.
2. P1: Checklist acknowledgement query is effectively unbounded and includes full response details.
3. P1: Workforce seller/offboarding requests are fetched without `storeId`/pagination and filtered client-side.
4. P2: `/store/approvals` target handoff can send Store Manager users to a Region Manager-only target approval tab.
5. P2: `/store/incentives` can show route-unavailable style copy for an authorized Store Manager with an empty incentive period.
6. P2: `/store/tasks` period filtering is client-side and can miss older rows after the first 100/status.
7. P2: Several Store pages still expose internal terms such as route, source, evidence, workflow, KPI config, scope, or raw backend wording.
8. P2: Tasks and Targets use custom drawer/popover behavior with mobile/footer/focus risk.
9. P3: `/store/personnel/:employeeId` route is broad at route layer and relies on page/backend denial.
10. P3: Store Manager route smoke exists only through generic `AUTH_SMOKE_*`; there is no named SM smoke contract.

Important non-bugs:

- `/store/reports` is intentionally hidden from Store Manager for now.
- Store Manager cannot create feed posts; Region Manager composer gating is aligned.
- Store Manager does not run incentive approval/correction/package submit; that remains Region Manager/Admin flow.
- Checklist remediation task creation happens after Store Manager acknowledgement, not merely after checklist completion.

## Non-Negotiable Constraints

- Do not broaden Store Manager access to `/store/reports`.
- Do not change KPI, ranking, target, checklist, incentive, month-close, company-store-only, or cashier-exclusion business rules.
- Do not add polling, timer refresh, or full-page refresh.
- Do not show UUIDs, source IDs, request IDs, provider IDs, raw role codes, DB/API wording, stack traces, or raw SQL/backend errors in Store UI.
- Do not hide real missing data with fake ready states.
- Do not commit `.env.local`, secrets, screenshots with credentials, cookies, OTPs, or bearer tokens.
- If backend API shape changes, update OpenAPI and generated frontend types in the same PR.
- Keep PRs small. If one PR touches backend contract and broad UI polish together, split it.

## Review Adjustments

This plan was reviewed against the current repo scripts and file layout after creation.

Corrections locked by this review:

- `admin-web` does not currently depend on `cross-env`; Store Manager smoke must use a small Node wrapper script or plain existing env vars, not a new dependency.
- PR2 is intentionally the riskiest slice. If implementing checklist pagination, workforce filtering, and task period filtering touches more than one backend domain in one branch, split PR2 into:
  - PR2A: route data prefetch + checklist acknowledgement pagination.
  - PR2B: workforce request filtering + task period/status filtering.
- Backend test commands must use the repo's existing npm script shape: `npm.cmd --prefix backend/nestjs run test -- ...`.
- Any mojibake or broken Turkish character found while editing user-facing copy is a blocker for that PR.

## Mandatory Pilot Gate

This train is mandatory before Store Manager pilot usage is called ready.

Pilot readiness cannot be claimed until one of these is true:

1. PR1 through PR5 are completed and merged.
2. A specific PR is explicitly downgraded in writing with a dated owner decision, evidence, and accepted residual risk.

Mandatory blocker rules:

- PR1 is mandatory because role/scope/smoke proof is the minimum Store Manager safety gate.
- PR2 is mandatory because unbounded data reads and client-side filtering can hide or distort real Store Manager rows.
- PR3 is mandatory because wrong handoff or misleading empty state can break pilot workflow decisions.
- PR4 is mandatory because Store Manager pilot UI must not expose internal/debug language or raw identifiers.
- PR5 is mandatory because the final behavior must be repeatable through tests/smoke, not only manual observation.

The only acceptable exception is a written product/engineering decision that marks the skipped item as parked, names the exact pilot risk, and states how operators will detect it during pilot.

## PR Train

### PR1: Store Manager Route, Scope, Query Key, And Smoke Contract

**Risk class:** R2 security/scope correctness.

**Contract impact:** No DB change. Possible route/test/docs change. No product permission expansion.

**Goal:** Make Store Manager route behavior and client cache identity explicit, and create a repeatable SM smoke entry point.

**Files:**

- Modify: `admin-web/src/app/store-route-registry.ts`
- Modify: `admin-web/src/pages/StoreHomePage.tsx`
- Modify: `admin-web/src/pages/StoreChecklistsPage.tsx`
- Modify: `admin-web/src/pages/StoreTasksPage.tsx`
- Modify: `admin-web/src/pages/StoreMyPerformancePage.tsx`
- Modify: `admin-web/package.json`
- Create: `admin-web/scripts/auth-store-manager-cookie-session-smoke.mjs`
- Read/Reuse: `admin-web/scripts/auth-cookie-session-live-smoke.mjs`
- Modify/Test: `admin-web/scripts/store-route-registry-contract.test.mjs`
- Modify/Test: `admin-web/e2e/store-return-to.spec.ts` or existing pilot smoke spec
- Modify Docs: `docs/architecture/pilot-route-role-matrix.md` if route contract changes

- [ ] **Step 1: Add a named Store Manager smoke script**

Add a package script that uses existing auth cookie-session smoke but documents Store Manager expectations.

Do not add `cross-env`. Create `admin-web/scripts/auth-store-manager-cookie-session-smoke.mjs`:

```js
process.env.AUTH_SMOKE_EXPECTED_ROLE =
  process.env.AUTH_SMOKE_EXPECTED_ROLE ?? 'STORE_MANAGER';
process.env.AUTH_SMOKE_EXPECTED_LANDING =
  process.env.AUTH_SMOKE_EXPECTED_LANDING ?? '/store/home';

await import('./auth-cookie-session-live-smoke.mjs');
```

Then add this script in `admin-web/package.json`:

```json
"smoke:auth:staging:store-manager": "node scripts/auth-store-manager-cookie-session-smoke.mjs --staging"
```

Run:

```powershell
npm.cmd --prefix admin-web run smoke:auth:staging:store-manager
```

Expected:

```text
status passed
expectedRole STORE_MANAGER
expectedLanding /store/home
```

- [ ] **Step 2: Make Store Manager query keys scope-aware**

For session-scoped Store Manager data, include stable actor/scope inputs in query keys:

```ts
const storeScopeKey = {
  userId: authSummary?.userId ?? 'anonymous',
  roles: authSummary?.roleCodes ?? [],
  readStoreIds: authSummary?.readStoreIds ?? [],
  actionStoreIds: authSummary?.assignedStoreIds ?? [],
};
```

Apply the same principle to:

- Home checklist/workflow queries
- Checklist acknowledgement query
- Tasks inbox/action plan queries

Do not include secrets or raw session tokens.

- [ ] **Step 3: Govern `/store/personnel/:employeeId` route behavior**

Decision to implement:

```text
Keep backend authorization as source of truth.
At frontend route/page level, direct unauthorized access must render product-safe copy:
"Bu personel profiline erişiminiz yok."
No raw backend error and no employee UUID should be displayed.
```

If Store Manager self-performance should be visible in sidebar, either:

```text
Add `me` to Store Manager nav with label `Performansım`
```

or explicitly document that Store Manager self-performance is route-accessible only through another flow. Do not leave route/nav mismatch undocumented.

- [ ] **Step 4: Add route matrix assertion**

Extend route contract coverage so it asserts:

```text
Store Manager sees: home, kpis, rankings, approvals, targets, incentives when company store, workforce, tasks, checklists, feed, settings.
Store Manager does not see: reports.
Store Manager direct reports route remains denied.
```

Run:

```powershell
npm.cmd --prefix admin-web run test:scripts
npm.cmd --prefix admin-web run test:e2e -- store-return-to.spec.ts --workers=1
```

Expected:

```text
PASS
```

- [ ] **Step 5: Verify PR1**

Run:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run smoke:auth:staging:store-manager
git diff --check
```

Rollback:

```text
Revert route/test/query-key edits. No DB rollback required.
```

### PR2: Store Performance And Data Boundary Fixes

**Risk class:** R3 backend/API performance and data correctness.

**Contract impact:** Yes for checklist/workforce/tasks if query params or response shape changes. OpenAPI and generated types required.

**Goal:** Prevent heavy prefetch, unbounded Store queries, and client-side filtering that can hide correct Store Manager rows.

**Split guard:** If Step 2, Step 3 and Step 4 all require backend/controller/repository changes, execute this as two PRs:

```text
PR2A: Step 1 + Step 2 only
PR2B: Step 3 + Step 4 + Step 5 only
```

Do not merge checklist, workforce and task API changes in one oversized PR if tests or OpenAPI review become noisy.

**Files:**

- Modify: `admin-web/src/App.tsx`
- Modify: `admin-web/src/app/store-sidebar.tsx`
- Modify: `admin-web/src/app/route-data-preloaders.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/checklist-acknowledgement.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/application/checklist.service.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/checklist.controller.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/dto/list-seller-code-requests.query.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/dto/list-offboarding-requests.query.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/workforce-seller-code-read.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/workforce-offboarding-read.repository.ts`
- Modify: `backend/nestjs/src/modules/store-ops/web/dto/list-store-action-plans.query.ts`
- Modify: `backend/nestjs/src/modules/store-ops/infrastructure/store-action-plan.repository.ts`
- Modify: `admin-web/src/features/checklists/api.ts`
- Modify: `admin-web/src/features/workforce/api.ts`
- Modify: `admin-web/src/features/store-actions/api.ts`
- Modify: `admin-web/src/pages/StoreWorkforcePage.tsx`
- Modify: `admin-web/src/pages/StoreTasksPage.tsx`
- Generate: `docs/api/openapi.json`

- [ ] **Step 1: Disable heavy data prefetch**

Change sidebar/route warming policy:

```text
Hover/focus may module-preload route chunks.
Hover/focus must not fetch heavy route data for checklists, targets, tasks, workforce, incentives, reports.
First allowed path and current path must not duplicate the same data prefetch.
```

Introduce a denylist or allowlist:

```ts
const dataPrefetchAllowedRoutes = new Set(['/store/home']);
```

Only keep data prefetch for cheap summary endpoints.

- [ ] **Step 2: Add checklist acknowledgement pagination and summary/detail split**

Backend query params:

```ts
limit?: number;      // default 50, max 100
offset?: number;     // default 0
period?: string;     // YYYY-MM
status?: string;
storeId?: string;
includeResponses?: boolean; // default false
```

Repository behavior:

```text
List endpoints default to bounded rows and no full response jsonb_agg.
Detail endpoint or includeResponses=true returns response details only when needed.
```

Test with seeded data:

```text
500 checklist results with responses
list call returns <= 50 rows
payload excludes full response details by default
detail call includes responses
```

- [ ] **Step 3: Add workforce request filtering**

Backend query params:

```ts
storeId?: string;
limit?: number;  // default 50, max 100
offset?: number; // default 0
```

Frontend behavior:

```text
Store Manager passes selected assigned storeId.
Region Manager passes selected storeId when filtering a specific store.
No client-only filtering over the first 50 scoped rows.
```

Test:

```text
Seed more than 50 scoped seller-code/offboarding rows.
Selected store has older rows beyond first 50.
API still returns selected store rows when storeId is passed.
```

- [ ] **Step 4: Add tasks period/status server filtering**

Add backend filters:

```ts
periodStart?: string; // YYYY-MM-DD
periodEnd?: string;   // YYYY-MM-DD
statuses?: string[];
```

Frontend behavior:

```text
Selected month drives backend query.
Old tasks from the selected month do not disappear because another status page hit the first 100.
```

If a single aggregate endpoint is too large for this PR, first add period filters to the existing endpoint and leave aggregation for a later PR.

- [ ] **Step 5: Update OpenAPI and generated types**

Run:

```powershell
npm.cmd --prefix backend/nestjs run openapi:generate
npm.cmd --prefix admin-web run api:generate
npm.cmd --prefix admin-web run api:check
```

Expected:

```text
Generated API reflects new query params.
No unrelated OpenAPI churn.
```

- [ ] **Step 6: Verify PR2**

Run:

```powershell
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run test -- store-ops --runInBand
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts --workers=1
git diff --check
```

Rollback:

```text
Forward rollback preferred for deployed nullable/query-param changes.
If not deployed, revert PR2.
No destructive data migration should be introduced in this PR.
```

### PR3: Store Manager Workflow Corrections

**Risk class:** R2 workflow correctness.

**Contract impact:** Mostly frontend. Backend only if PR2 period filters are consumed here.

**Goal:** Fix broken Store Manager handoffs and misleading states without changing business formulas.

**Files:**

- Modify: `admin-web/src/pages/StoreApprovalsPage.tsx`
- Modify: `admin-web/src/pages/store-approvals-request-center-model.ts`
- Modify: `admin-web/src/pages/StoreTargetsPage.tsx`
- Modify: `admin-web/src/pages/store-targets-page-model.ts`
- Modify: `admin-web/src/pages/StoreIncentivesPage.tsx`
- Modify: `admin-web/src/features/localization/messages/store-incentives.ts`
- Modify: `admin-web/src/pages/StoreTasksPage.tsx`
- Modify/Test: `admin-web/e2e/store-targets-surfaces.spec.ts`
- Modify/Test: `admin-web/e2e/store-incentives-projection.spec.ts`
- Modify/Test: `admin-web/e2e/store-action-plans.spec.ts`

- [ ] **Step 1: Fix Store Manager target handoff from Approvals**

Current risk:

```text
Pending target rows can link to `tab=approval`, which is Region Manager-only.
Store Manager lands on the wrong target tab/fallback.
```

Required behavior:

```text
Store Manager target handoff goes to their submitted/distribution/status view.
Region Manager target handoff goes to approval queue.
Super Admin follows admin-capable behavior.
```

Implementation decision:

```ts
function buildTargetHandoffUrl(persona: 'storeManager' | 'regionManager' | 'admin', requestId: string) {
  if (persona === 'storeManager') {
    return `/store/targets?requestId=${encodeURIComponent(requestId)}&tab=distribution`;
  }
  return `/store/targets?requestId=${encodeURIComponent(requestId)}&tab=approval`;
}
```

Use existing persona/role helpers instead of introducing a new role model.

- [ ] **Step 2: Fix Incentives authorized empty period state**

Current risk:

```text
Authorized company Store Manager with no projections can see route-unavailable style copy.
```

Required copy:

```text
Bu dönem için prim verisi hazırlanmadı.
Dönemi değiştirerek önceki ayları kontrol edebilirsiniz.
```

Reserved copy for real access denial:

```text
Bu prim görünümü hesabınız için açık değil.
```

Do not show approval/package controls to Store Manager.

- [ ] **Step 3: Remove Store Manager no-op incentive actions**

Find visible `onClick={() => undefined}` or equivalent dead actions in the Store Manager incentive header.

Required:

```text
If a period picker already exists, remove duplicate period/no-op action.
If refresh exists, wire it to query invalidation/refetch or remove it.
```

- [ ] **Step 4: Bind Tasks selected period to backend query**

After PR2 backend support exists, pass selected period bounds:

```ts
periodStart: `${selectedPeriod}-01`
periodEnd: getMonthEndDate(selectedPeriod)
```

Use a single shared Istanbul-aware period helper if available. If not available, create a small helper in the existing Store tasks model file and add tests.

- [ ] **Step 5: Verify PR3**

Run:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-targets-surfaces.spec.ts --workers=1
npm.cmd --prefix admin-web run test:e2e -- store-incentives-projection.spec.ts --workers=1
npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts --workers=1
git diff --check
```

Rollback:

```text
Revert frontend handoff/state changes. No DB rollback expected.
```

### PR4: Store UI And Copy Hygiene

**Risk class:** R1/R2 UI correctness.

**Contract impact:** No API/DB change.

**Goal:** Remove technical/internal wording, custom control risk, raw IDs, and old prototype remnants from Store Manager-visible surfaces.

**Files:**

- Modify: `admin-web/src/pages/store-home-command-view.tsx`
- Modify: `admin-web/src/features/localization/messages/store-me.ts`
- Modify: `admin-web/src/pages/store-my-performance-plum-dashboard.tsx`
- Modify: `admin-web/src/pages/StoreRankingsPage.tsx`
- Modify: `admin-web/src/features/localization/messages/store-rankings.ts`
- Modify: `admin-web/src/features/localization/messages/store-kpis.ts`
- Modify: `admin-web/src/features/localization/messages/store-kpis-command.ts`
- Modify: `admin-web/src/pages/store-checklists-modals.tsx`
- Modify: `admin-web/src/styles/store-checklists-result-modal.css`
- Modify: `admin-web/src/pages/store-targets-region-command.tsx`
- Modify: `admin-web/src/styles/store-targets-prototype-drawer.css`
- Modify: `admin-web/src/pages/StoreWorkforcePage.tsx`
- Modify: `admin-web/src/pages/store-workforce-store-manager-presentation.tsx`
- Modify: `admin-web/src/features/localization/messages/store-tasks.ts`
- Modify: `admin-web/src/features/store-tasks/store-tasks-workbench.tsx`
- Modify: `admin-web/src/pages/StoreFeedPage.tsx`
- Modify: `admin-web/src/features/localization/messages/store-settings.ts`
- Modify/Test: relevant `admin-web/e2e/store-surfaces.spec.ts` slices

- [ ] **Step 1: Replace internal copy with user copy**

Replace visible terms:

```text
Bağlı sayfa -> İlgili alan
Kaynak kayıt -> Neden oluştu
ResolutionEvidence -> Çözüm notu
Store Action İş Akışı -> Görevler
KPI config -> KPI ayarları
gerçek veri / scope / API / DB / route -> product-safe user wording
```

Do not change internal variable names unless they are visible.

- [ ] **Step 2: Remove raw identifier fallbacks**

If UI fallback currently displays:

```text
storeId
employeeId
externalEmployeeRef when UUID-like
requestId
sourceId
runId
roleCodes
```

Replace visible fallback with:

```text
Mağaza adı yok
Personel bilgisi yok
Gönderen bilgisi yok
Rol bilgisi doğrulanamadı
```

Full IDs may remain in admin-only debug/evidence surfaces, not normal Store UI.

- [ ] **Step 3: Standardize custom drawers where risk exists**

Targets and Tasks custom drawer/popover must satisfy:

```text
Escape closes.
Outside click closes where product expects modal behavior.
Footer is sticky with safe-area padding.
Mobile width fits 390px without horizontal overflow.
No negative bottom offset.
Focus returns to opener after close.
```

Use existing shared Sheet/Popover primitives if available. If full migration is too large, fix footer/focus/escape first and log shared primitive migration as a follow-up.

- [ ] **Step 4: Replace native Workforce controls**

In Store Manager-visible workforce page:

```text
native select/button -> existing project Select/Button primitives
hard-coded colors -> semantic/token classes
```

Do not redesign the page; this is hygiene only.

- [ ] **Step 5: Remove Feed prototype remnants**

Replace classes/names that expose prototype intent:

```text
feed-prototype
feed-prototype-hero
```

Use production naming. Keep Region Manager compose and Store Manager read-only behavior unchanged.

- [ ] **Step 6: Verify PR4**

Run:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "home|me|rankings|kpis|checklists|targets|workforce|tasks|feed|settings" --workers=1
git diff --check
```

Rollback:

```text
Revert UI/localization files. No backend or DB rollback.
```

### PR5: Store Manager E2E And Live Smoke Pack

**Risk class:** R1 test-only / smoke hardening.

**Contract impact:** None unless missing hooks require tiny product-safe test IDs. Do not add visible test-only copy.

**Goal:** Make Store Manager pilot-critical flows repeatable and provable without relying on ad hoc manual checks.

**Files:**

- Create/Modify: `admin-web/e2e/store-manager-persona.spec.ts`
- Modify: `admin-web/package.json`
- Modify: `docs/architecture/pilot-route-role-matrix.md`
- Modify/Create: `docs/runbooks/store-manager-pilot-smoke-v1.md`
- Modify if needed: `admin-web/scripts/auth-cookie-session-live-smoke.mjs`

- [ ] **Step 1: Add Store Manager route visibility e2e**

Test assertions:

```text
Store Manager sees home, kpis, rankings, approvals, targets, incentives if company store, workforce, tasks, checklists, feed, settings.
Store Manager does not see reports.
Store Manager cannot open reports directly.
Store Manager feed composer is hidden.
```

- [ ] **Step 2: Add Store Manager read/action flow e2e**

Mocked/local e2e should cover:

```text
Checklist result acknowledgement visible when assigned store has pending acknowledgement.
Acknowledgement action calls correct mutation.
Target distribution can be opened in Store Manager flow.
Tasks action detail opens and Store Manager resolution controls are visible.
Incentives page for company store is read-only and does not show RM package/approval controls.
Workforce page does not show raw UUID fallback.
```

Do not run live mutation smoke against staging unless explicitly approved in that execution turn.

- [ ] **Step 3: Add live smoke runbook**

Create runbook section:

```markdown
# Store Manager Pilot Smoke V1

## Required env

- `PILOT_SM_USERNAME`
- `PILOT_SM_PASSWORD`
- `PILOT_SM_OTP`

## Command

`npm.cmd --prefix admin-web run smoke:auth:staging:store-manager`

## Expected

- landing `/store/home`
- role `STORE_MANAGER`
- assigned store count greater than zero
- local/session storage has no token-shaped app keys
- CSRF missing header unsafe call returns `403`
```

- [ ] **Step 4: Verify PR5**

Run:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-manager-persona.spec.ts --workers=1
npm.cmd --prefix admin-web run smoke:auth:staging:store-manager
git diff --check
```

Rollback:

```text
Revert test/docs/package script changes. No product rollback.
```

## Cross-PR Verification

After all PRs are merged:

- [ ] **Run release checks**

```powershell
npm.cmd run check:release
```

- [ ] **Run targeted Store Manager staging smoke**

```powershell
npm.cmd --prefix admin-web run smoke:auth:staging:store-manager
```

- [ ] **Confirm no dirty artifacts**

```powershell
git status --short --branch
```

Expected:

```text
## main...origin/main
```

Known exception:

```text
discipline.md may still be dirty if it was dirty before this train and intentionally left untouched.
```

## Definition Of Done

- Store Manager route/nav contract is explicit and tested.
- Store Manager smoke has a named command and no secrets are logged.
- Store Manager cannot see `/store/reports`; this remains intentional.
- Store Manager feed remains read-only.
- Store Manager incentives remain company-store-only and read-only.
- Authorized Store Manager empty incentive period renders a proper empty state, not route-unavailable copy.
- Approvals target handoff no longer sends Store Manager into Region Manager-only target approval tab.
- Tasks selected period is backend-bound and does not silently miss older rows.
- Checklist acknowledgement list is bounded and does not fetch full response details by default.
- Workforce seller/offboarding reads are scoped by store and paginated.
- Store UI no longer shows raw UUIDs, source IDs, role codes, route/API/DB/scope/debug copy, or raw backend errors.
- Tasks/Targets drawers are usable on mobile with stable footer/focus/close behavior.
- All touched frontend/backend tests pass.

## Self-Review

Spec coverage:

- All Store Manager pages from the audit are covered by either PR1 route/scope, PR2 data/performance, PR3 workflow, PR4 UI/copy, or PR5 test/smoke.
- Flow-specific checklist, targets, incentives, tasks, workforce, KPI/ranking, feed, reports concerns are represented.
- The current product decision that Store Manager does not see reports is preserved.

Hidden side effects checked:

- No PR changes business formulas.
- PR2 is the only API/OpenAPI-impacting PR.
- PR3 changes handoff/state, not permissions.
- PR4 changes copy/UI controls, not workflow rules.
- PR5 is test/runbook-only.

Recommended execution:

1. PR1 first because it makes Store Manager scope/smoke proof repeatable.
2. PR2 second because it removes the biggest performance/data correctness risks.
3. PR3 third because it fixes workflow handoff and misleading states.
4. PR4 fourth because it cleans the user-facing surface after behavior is stable.
5. PR5 last because test coverage should encode the final intended behavior.
