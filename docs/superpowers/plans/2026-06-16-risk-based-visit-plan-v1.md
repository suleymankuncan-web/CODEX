# Risk Based Visit Plan V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only, checklist-bound "Ziyaret Planı" layer that helps Region Manager and Visual Merchandiser personas decide which assigned stores should be visited first and why.

**Architecture:** V1 is a frontend read-model and UI slice over existing checklist visit data. It must not add a new module, database table, backend endpoint, calendar workflow, notification flow, or automatic task generation. The feature starts inside `/store/checklists`, then adds a small Region Manager home summary if the first slice is stable.

**Tech Stack:** React 19, TypeScript, TanStack Query, existing Store surface primitives, Tailwind v4 token classes, lucide icons, Playwright E2E.

---

## Metadata

- Status: Locked / implementation-ready after final review
- Date: 2026-06-16
- Author: Codex
- Reviewers: Product owner review pending; Codex comprehensive review complete
- Owner: Store Ops product flow
- Primary personas: `REGION_MANAGER`, `VISUAL_MERCHANDISER`
- Secondary read persona: `SUPER_ADMIN` only where current route access already allows it
- First owning module: Checklist
- Future possible module: Saha Ziyaretleri, only after V1 proves value

## Context

The product already has strong operational signal surfaces: Store Home, KPI summaries, rankings, checklist flow, task list, request center, targets, norm kadro, reports, and admin operations. The missing field-management question is practical:

> "Bölge müdürü bu hafta önce hangi mağazaya gitmeli ve neden?"

The safest V1 is not a new scheduling module. Visit execution already lives in checklist flow: a Region Manager or Visual Merchandiser visits a store, starts a checklist, completes it, then the result appears in the store acknowledgement/checklist history path. Therefore V1 should be a planning layer inside Checklist, not a separate workflow engine.

Existing repo evidence:

- `/store/checklists` already reads `getMobileChecklistToday()` for assigned stores, templates, active instances, completed visits, pending acknowledgements, and monthly summaries.
- `store-checklists-logic.ts` already contains visit grouping, score, risk tone, date, status, and priority helpers.
- `StoreHomePage.tsx` already uses mobile checklist data for Region Manager checklist coverage summary.
- Existing discipline forbids fake metrics and broad behavior changes without source-of-truth decisions.

## Product Decision

V1 name:

- UI label: `Ziyaret Planı`
- Internal model name: `risk-based visit plan`

V1 module placement:

- Primary: `/store/checklists`, as a new tab or panel next to current visit workflow.
- Secondary: `/store/home`, as a compact Region Manager summary after the checklist page slice is verified.

V1 behavior:

- Recommend visit priority using only existing real checklist data.
- Explain every recommendation with visible source reasons.
- Link back to the existing checklist visit workflow.
- Do not create, schedule, assign, postpone, cancel, notify, or route visits.

## Functional Requirements

### FR-1: Persona Visibility

The system MUST show the visit plan only to personas that can manage checklist visits through current authorization:

- `REGION_MANAGER`
- `VISUAL_MERCHANDISER`
- `SUPER_ADMIN` when current route/session behavior already exposes the checklist visit flow

The system MUST NOT show the visit plan to `STORE_MANAGER` as an actionable planning surface in V1. Store Manager remains focused on acknowledgement, tasks, and store-level work.

### FR-2: Source Data

The V1 model MUST use only existing data already available to the Store checklist/home surfaces:

- `MobileChecklistToday.stores`
- `MobileChecklistToday.templates`
- `MobileChecklistToday.activeInstances`
- `MobileChecklistToday.completedThisMonth`
- `MobileChecklistToday.pendingAcknowledgements`
- `MobileChecklistToday.monthlySummaries`
- checklist acknowledgement items already fetched by the page, where available

The V1 model MUST NOT invent KPI, norm kadro, request center, route distance, calendar, or SLA signals.

### FR-3: Store-Level Plan Rows

The model MUST produce one plan row per visible assigned store.

Each row MUST include:

- `storeId`
- `storeName`
- `riskLevel`: `high`, `medium`, or `low`
- `riskScore`: deterministic numeric sort value
- `lastVisitAt`: latest completed BM/VM visit timestamp, or `null`
- `bmScore`: latest/current BM checklist average score, or `null`
- `vmScore`: latest/current VM checklist average score, or `null`
- `primaryReason`
- `reasons[]`
- `actionLabel`
- `actionTab`: `visits`

### FR-4: Risk Rules

V1 MUST use deterministic, simple rules:

- High risk:
  - no actor-actionable visit completed in the evaluation month,
  - or any visible checklist score is below `70`,
  - or a pending acknowledgement exists for the store with low-score checklist responses.
- Medium risk:
  - an active draft/in-progress visit exists,
  - or any visible checklist score is between `70` and `84`,
  - or a pending acknowledgement exists without low-score responses,
  - or an actor-actionable visit is completed but the visible score is `null`.
- Low risk:
  - visible required visit coverage exists,
  - and visible score is `85` or higher when available,
  - and no pending low-score acknowledgement exists.

When multiple rules match, the highest risk wins.

Missing-visit risk MUST be calculated from checklist rows the current actor can execute:

- `REGION_MANAGER`: BM visit rows only.
- `VISUAL_MERCHANDISER`: VM visit rows only.
- `SUPER_ADMIN`: currently actionable visible rows.

Non-actionable visible rows MAY contribute only score/result context. Example: a Region Manager may see VM score context, but a missing VM visit MUST NOT become the Region Manager's missing-visit reason in V1.

Pending acknowledgement means `ChecklistAcknowledgementItem.acknowledgement === null`. Acknowledged historical rows MAY contribute score context, but MUST NOT produce `Mağaza kabulü bekliyor`.

Evaluation month:

- If the checklist toolbar has a concrete month such as `2026-06`, the plan MUST evaluate missing visits against that selected month.
- If the checklist toolbar is `all`, the plan MUST evaluate missing visits against the current calendar month key.
- Store Home V1B MUST always use the current calendar month key because it has no checklist toolbar state.

### FR-5: Reason Language

Every row MUST explain risk with short Turkish source reasons. Allowed V1 reason labels:

- `Bu ay ziyaret yok`
- `Düşük checklist puanı`
- `Takipte checklist sonucu`
- `Aktif taslak var`
- `Mağaza kabulü bekliyor`
- `Ziyaret tamam`
- `Skor güçlü`
- `Sinyal yetersiz`

The UI MUST NOT use English labels such as `review checklist source`, `risk score`, or `source`.

### FR-6: Sorting

Rows MUST sort by:

1. high risk before medium before low,
2. higher `riskScore` before lower `riskScore`,
3. older or missing `lastVisitAt` before newer visits,
4. store name alphabetically as final tie-breaker.

### FR-7: Checklist Page UI

The checklist page MUST expose the plan without disrupting the existing checklist execution flow.

Preferred V1 UI:

- Add a `Ziyaret Planı` tab to `ChecklistTab`.
- Add an explicit lucide `MapPinned` or `Map` icon for the plan tab in `ChecklistTabIcon`.
- Show a compact summary band:
  - `Yüksek risk`
  - `Takip`
  - `Plan temiz`
- Show rows with:
  - store name,
  - risk badge,
  - last visit,
  - BM/VM score chips where available,
  - reason chips,
  - action button: `Ziyaret akışına git`.

The action button MUST select the existing `visits` tab while preserving current page filters. It MUST update only the same-page query string to `tab=visits` through `buildChecklistSearch(location.search, { tab: 'visits' })`, so refresh/back behavior does not leave the URL on `tab=plan` after the tab changes. It MUST NOT call `startMobileChecklistInstance`, and it MUST NOT navigate away from the current checklist page just to switch tabs.

The plan panel MUST render with:

- `id="store-checklist-panel-plan"`
- `aria-labelledby="store-checklist-tab-plan"`
- `role="tabpanel"`

The checklist page plan MUST respect the current checklist toolbar filters because it is part of the checklist page, not a separate global module. Store Home V1B MUST NOT inherit page filters; it uses current-month, role-visible checklist rows only.

The visit plan MUST NOT reuse a `selectedMonth = all` coverage row's arbitrary first monthly summary for scoring. The page may keep its existing all-period display semantics, but the visit plan must build a separate evaluation row set with `evaluationMonth = resolveVisitPlanEvaluationMonth(selectedMonth, currentMonth)`.

### FR-8: Store Home UI

V1B starts only after the checklist page slice is verified. Region Manager home MUST then show a compact card:

- title: `Bu hafta ziyaret önceliği`
- value: count of high-risk stores
- top 3 stores with primary reason
- link to `/store/checklists?tab=plan`

Store Manager home MUST NOT receive this card in V1.

### FR-9: No Write Behavior

V1 MUST be read-only.

It MUST NOT:

- create a visit plan record,
- create a calendar entry,
- create or update Store Action plans,
- change checklist instance status,
- acknowledge a checklist result,
- send notifications,
- add audit events,
- add DB schema.

### FR-10: Empty And Partial States

The UI MUST handle:

- no assigned stores,
- no published checklist templates,
- checklist API loading,
- checklist API error,
- no completed visits,
- no score available,
- BM template only,
- VM template only,
- BM + VM mixed visibility.

## Non-Functional Requirements

### NFR-1: Authorization

The feature MUST rely on existing route/session and assigned-store visibility. It MUST NOT widen read scope in frontend or backend.

### NFR-2: Data Honesty

The UI MUST distinguish missing source data from low risk. Missing score is not a good score. Missing visit is a risk reason only when a visible store/template row exists.

### NFR-3: Performance

The frontend model SHOULD compute 200 assigned stores in under 50 ms in normal browser runtime. The implementation SHOULD use pure array/map operations and avoid extra network calls in V1.

### NFR-4: Responsive UI

The checklist page MUST have no horizontal overflow at 360 px mobile width. Text MUST wrap inside cards/rows.

### NFR-5: Design Consistency

The UI MUST use existing Store surface primitives and current Plum Glacier styling rhythm. It MUST NOT add a new visual system.

### NFR-6: Testability

Risk calculation MUST live in a pure TypeScript model file so Playwright fixtures and future script tests can assert deterministic behavior.

## Acceptance Criteria

### AC-1: Region Manager Sees Visit Plan

Given a `REGION_MANAGER` with assigned stores and published BM checklist template,
when the user opens `/store/checklists`,
then the page shows `Ziyaret Planı`,
and the plan lists assigned stores only.

References: FR-1, FR-2, FR-3, NFR-1.

### AC-2: Missing Visit Becomes High Risk

Given an assigned store has a visible BM checklist template and no completed current-month visit,
when the visit plan model is built,
then the store row has `riskLevel = high`,
and the primary reason is `Bu ay ziyaret yok`.

References: FR-4, FR-5.

### AC-3: Low Checklist Score Becomes High Risk

Given an assigned store has current-month checklist average score `65`,
when the visit plan model is built,
then the store row has `riskLevel = high`,
and one reason is `Düşük checklist puanı`.

References: FR-4, FR-5.

### AC-4: Active Draft Becomes Medium Risk

Given an assigned store has an active checklist instance,
when the visit plan model is built,
then the store row has at least `riskLevel = medium`,
and one reason is `Aktif taslak var`.

References: FR-4, FR-5.

### AC-5: Strong Completed Visit Is Low Risk

Given an assigned store has a current-month completed visit and visible score `90`,
and no pending low-score acknowledgement,
when the visit plan model is built,
then the store row has `riskLevel = low`,
and one reason is `Skor güçlü`.

References: FR-4, FR-5.

### AC-6: Completed Visit Without Score Is Not Low Risk

Given an assigned store has a current-month completed actor-actionable visit,
and the visible checklist score is `null`,
when the visit plan model is built,
then the store row does not have `riskLevel = low`,
and one reason is `Sinyal yetersiz`.

References: FR-4, FR-5, NFR-2.

### AC-7: Visual Merchandiser Scope Stays VM-Only

Given a `VISUAL_MERCHANDISER` session,
when the user opens `/store/checklists`,
then the visit plan uses VM visible templates only,
and BM-only action labels or BM-only rows are not shown.

References: FR-1, FR-2, NFR-1.

### AC-8: Store Manager Does Not Receive Planning Surface

Given a `STORE_MANAGER` session,
when the user opens `/store/checklists`,
then the page continues to show acknowledgement/history behavior,
and does not show `Ziyaret Planı` as an actionable planning tab.

References: FR-1, FR-9.

### AC-9: Store Manager Plan URL Falls Back Safely

Given a `STORE_MANAGER` session,
when the user opens `/store/checklists?tab=plan`,
then the page falls back to the first allowed Store Manager checklist tab,
and does not render an empty or unauthorized planning panel.

References: FR-1, FR-7, FR-9, NFR-1.

### AC-10: Action Does Not Mutate

Given a plan row action is clicked,
when the tab switch happens,
then no `POST /api/mobile/checklists/instances` request is sent until the user explicitly clicks the existing `Checklist yap` control in the visit workflow.

References: FR-7, FR-9.

### AC-11: Home Summary Links To Plan

Given a `REGION_MANAGER` has high-risk stores,
when the user opens `/store/home`,
then the home page shows `Bu hafta ziyaret önceliği`,
and the card links to `/store/checklists?tab=plan`.

References: FR-8.

### AC-12: Mobile Layout Does Not Overflow

Given mobile viewport width is 360 px,
when the Region Manager opens `/store/checklists` and selects `Ziyaret Planı`,
then document width does not exceed viewport width,
and all reason chips/row text wrap inside the visible surface.

References: NFR-4, NFR-5.

### AC-13: Empty States Are Explicit

Given a visit-managing persona has no assigned stores,
when the user opens the visit plan,
then the plan shows `Atanmış mağaza yok`.

Given a visit-managing persona has assigned stores but no visible published checklist template,
when the user opens the visit plan,
then the plan shows `Yayınlanmış ziyaret şablonu yok`.

References: FR-10, NFR-2.

### AC-14: Model Stays Local And Fast

Given a fixture with 200 assigned stores and visible checklist templates,
when the visit plan rows are built in a browser-backed Playwright test,
then no extra network request is made beyond the existing checklist page queries,
and model calculation time is recorded below `50 ms` in local evidence.

References: NFR-3, NFR-6.

### AC-15: Rows Render Required Fields And Sort Deterministically

Given the visit plan has one high-risk store, one medium-risk store, and one low-risk store,
when the user opens `Ziyaret Planı`,
then the high-risk row appears before the medium-risk row,
and the medium-risk row appears before the low-risk row,
and each visible row shows store name, risk badge, last visit, available BM/VM score chips, at least one reason chip, and `Ziyaret akışına git`.

References: FR-3, FR-6, FR-7.

## Edge Cases

- EC-1: `mobileToday.stores` is empty. Show an empty state: `Atanmış mağaza yok`.
- EC-2: `mobileToday.templates` is empty. Show an empty state: `Yayınlanmış ziyaret şablonu yok`.
- EC-3: Store has BM template but no VM template. Do not mark VM missing.
- EC-4: Store has VM template but no BM template. Do not mark BM missing.
- EC-5: Score is `null`. Do not classify as strong; show `Sinyal yetersiz` if no other reason exists.
- EC-6: Date parsing fails. Treat date as missing for sorting, but do not crash.
- EC-7: Active draft and low score both exist. High risk wins because low score is higher severity.
- EC-8: Checklist API error. Reuse existing checklist page error/retry handling; do not render stale plan.
- EC-9: Current locale is English. Turkish and English strings must be registered in localization files, but Turkish UI copy must use correct Turkish characters in `storeHomeTr` / checklist Turkish messages.

## API Contracts

V1 adds no backend API.

Internal frontend contract:

```ts
export type VisitRiskLevel = 'high' | 'medium' | 'low'

export type VisitPlanReasonCode =
  | 'missing_current_month_visit'
  | 'low_checklist_score'
  | 'watch_checklist_result'
  | 'active_draft'
  | 'pending_acknowledgement'
  | 'visit_completed'
  | 'strong_score'
  | 'insufficient_signal'

export type VisitPlanReason = {
  code: VisitPlanReasonCode
  label: string
  severity: VisitRiskLevel
}

export type VisitPlanRow = {
  actionLabel: string
  actionTab: 'visits'
  bmScore: number | null
  lastVisitAt: string | null
  primaryReason: VisitPlanReason
  reasons: VisitPlanReason[]
  riskLevel: VisitRiskLevel
  riskScore: number
  storeId: string
  storeName: string
  vmScore: number | null
}

export type BuildVisitPlanInput = {
  acknowledgementItems: ChecklistAcknowledgementItem[]
  authSummary: AuthSessionSummary | null
  currentMonth: string
  selectedMonth: string
  evaluationMonth: string
  requiresCombinedVisitTemplates: boolean
  rows: ChecklistStoreVisitRow[]
}
```

## Data Models

No database model in V1.

Frontend read model only:

| Entity | Source | Purpose |
| --- | --- | --- |
| `ChecklistStoreVisitRow` | existing `store-checklists-model.ts` | grouped BM/VM visit coverage per store |
| `ChecklistAcknowledgementItem` | existing checklist API | pending result and low-score detail |
| `VisitPlanRow` | new pure frontend model | rendered visit recommendation row |
| `VisitPlanReason` | new pure frontend model | visible explanation for each recommendation |

## Out Of Scope

V1 explicitly excludes:

- separate left-nav module named `Saha Ziyaretleri`,
- calendar UI,
- route planning,
- visit create/postpone/cancel commands,
- notification or escalation,
- Store Action automatic generation,
- KPI/ranking/norm/talep signals unless a later approved slice adds real data wiring,
- backend endpoint or DB schema,
- audit events,
- AI recommendation text,
- new scoring/ranking/checklist math,
- broad Store UI redesign.

## File Structure

### Create

- `admin-web/src/pages/store-checklists-coverage-model.ts`
  - Shared helper that converts `MobileChecklistToday` + acknowledgement items + local active/completed overlays into `ChecklistCoverageRow[]` and `ChecklistStoreVisitRow[]` without page-local duplication. It must support a caller-provided month key so Store page display rows and visit-plan evaluation rows can be built separately.

- `admin-web/src/pages/store-visit-plan-model.ts`
  - Pure visit-plan builder, risk rules, sorting, reason labels.

- `admin-web/src/pages/store-checklists-visit-plan.tsx`
  - Checklist page plan panel and row cards.

### Modify

- `admin-web/src/pages/store-checklists-model.ts`
  - Add `plan` to `ChecklistTab`.

- `admin-web/src/pages/store-checklists-logic.ts`
  - Reuse existing helpers; add only tiny exports if the new model needs existing private behavior.

- `admin-web/src/pages/StoreChecklistsPage.tsx`
  - Move page-local coverage row construction into `store-checklists-coverage-model.ts`.
  - Keep current completed-date logic behavior identical before using it for the plan.
  - Build `VisitPlanRow[]` after shared `visitStoreRows` exists.
  - Add `Ziyaret Planı` tab for visit-managing personas.
  - Render `StoreChecklistsVisitPlan` when active tab is `plan`.

- `admin-web/src/pages/store-checklists-controls.tsx`
  - Add an explicit visit-plan icon branch to `ChecklistTabIcon`.

- `admin-web/src/pages/StoreHomePage.tsx`
  - In PR-2 only: reuse the same model for Region Manager home summary.

- `admin-web/src/features/localization/messages/store-checklists.ts`
  - Add Turkish and English copy keys for the plan tab, summary labels, reasons, and empty states.

- `admin-web/src/features/localization/messages/store-home.ts`
  - In PR-2 only: add home card copy.

- `admin-web/src/styles/store-checklists-flow.css`
  - Modify only if the new visit-plan rows overflow or need a missing compact row class; otherwise leave unchanged.

- `admin-web/src/styles/store-checklists-flow-responsive.css`
  - Modify only if mobile wrapping needs a targeted guard.

- `admin-web/e2e/checklist-today-surfaces.spec.ts`
  - Add Playwright cases for Region Manager plan, VM scope, Store Manager exclusion, no mutation, mobile layout.

- `admin-web/e2e/store-surfaces.spec.ts`
  - In PR-2 only: add Region Manager home summary assertion here.

## PR Plan

### PR-1: Checklist Page Visit Plan V1A

Goal:

- Add the deterministic visit-plan model and render it inside `/store/checklists`.

Scope:

- Create `store-visit-plan-model.ts`.
- Create `store-checklists-coverage-model.ts` before the home slice needs the same row source.
- Create `store-checklists-visit-plan.tsx`.
- Add `plan` tab, icon, copy, and ARIA panel wiring.
- Add Playwright coverage for Region Manager, Visual Merchandiser, Store Manager exclusion, no mutation, and mobile layout.
- No backend, no API, no DB, no checklist write behavior.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- checklist-today-surfaces.spec.ts -g "visit plan"
npm.cmd --prefix admin-web run test:e2e -- checklist-today-surfaces.spec.ts
```

Stop rule:

- Stop if the model needs data that is not already present on checklist surfaces.

### PR-2: Region Manager Home Summary V1B

Goal:

- Add compact `Bu hafta ziyaret önceliği` summary to Region Manager Store Home.

Scope:

- Reuse `buildVisitPlanRows`.
- Reuse the shared checklist coverage/visit-row helper from PR-1; do not duplicate the page-local coverage construction inside `StoreHomePage.tsx`.
- Show count of high-risk rows and top 3 stores.
- Link to `/store/checklists?tab=plan`.
- Do not add Store Manager home card.

Target verification:

```powershell
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "region manager"
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
```

Stop rule:

- Stop if Store Home would require extra API calls beyond current mobile checklist query.

### PR-3: Closeout Evidence And Route Smoke

Goal:

- Record implementation evidence and guarded route behavior.

Scope:

- Add evidence doc under `docs/evidence/`.
- Record local Playwright coverage and, if persona env is available, staging cookie-session route smoke.
- No runtime code unless PR-1/PR-2 review finds a concrete defect.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- checklist-today-surfaces.spec.ts
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "region manager"
```

## Implementation Tasks

### Task 1: Extract Shared Checklist Coverage Rows

**Files:**

- Create: `admin-web/src/pages/store-checklists-coverage-model.ts`
- Modify: `admin-web/src/pages/StoreChecklistsPage.tsx`

- [ ] Move `getCoverageCompletedSource` and coverage-row construction out of `StoreChecklistsPage.tsx` into a pure shared helper.
- [ ] Export `buildChecklistCoverageRows(input)` returning `ChecklistCoverageRow[]`; input must include `month`, `acknowledgementItems`, `mobileToday`, `localActiveInstances`, and `localCompletedRows`.
- [ ] Export `buildChecklistVisitRows(input)` returning `ChecklistStoreVisitRow[]` by composing `buildChecklistCoverageRows` and existing `buildChecklistStoreVisitRows`.
- [ ] Keep current active-instance overlay, completed-date, and completed-count semantics unchanged.
- [ ] Update `StoreChecklistsPage.tsx` to use the shared helper for existing display rows before adding plan UI.
- [ ] Build a second `visitPlanStoreRows` with `month = evaluationMonth` when `selectedMonth === 'all'`; do not use all-period display row summaries for visit-plan scoring.

### Task 2: Add Visit Plan Model

**Files:**

- Create: `admin-web/src/pages/store-visit-plan-model.ts`
- Modify only if needed: `admin-web/src/pages/store-checklists-logic.ts`

- [ ] Define `VisitRiskLevel`, `VisitPlanReasonCode`, `VisitPlanReason`, `VisitPlanRow`, and `BuildVisitPlanInput`.
- [ ] Implement `buildVisitPlanRows(input)`.
- [ ] Implement `getVisitPlanRiskLevel(reasons)`.
- [ ] Implement `sortVisitPlanRows(rows)`.
- [ ] Implement `resolveVisitPlanEvaluationMonth(selectedMonth, currentMonth)` so `all` evaluates against current month.
- [ ] Use `authSummary` to evaluate missing-visit risk only for actor-actionable template rows.
- [ ] Treat completed actor-actionable visits with `null` score as medium/insufficient signal, not low risk.
- [ ] Treat pending acknowledgement reasons only when `acknowledgement === null`.
- [ ] Reuse existing helpers where possible:
  - `getStoreVisitDate`
  - `getStoreVisitScore`
  - `getLowScoreResponses`
  - `canMutateChecklistTemplateType`
  - `compareDate`
  - `compareText`
- [ ] Keep labels Turkish, correctly accented, and deterministic.

Core logic shape:

```ts
export function buildVisitPlanRows(input: BuildVisitPlanInput): VisitPlanRow[] {
  return sortVisitPlanRows(
    input.rows.map((row) => {
      const reasons = buildVisitPlanReasons(row, input)
      const riskLevel = getVisitPlanRiskLevel(reasons)
      return {
        actionLabel: 'Ziyaret akışına git',
        actionTab: 'visits',
        bmScore: row.bm?.summary?.averageScore ?? null,
        lastVisitAt: getStoreVisitDate(row),
        primaryReason: reasons[0] ?? insufficientSignalReason,
        reasons,
        riskLevel,
        riskScore: calculateVisitRiskScore(reasons, row),
        storeId: row.store.storeId,
        storeName: row.store.storeName,
        vmScore: row.vm?.summary?.averageScore ?? null,
      }
    }),
  )
}
```

### Task 3: Add Checklist Page Plan Tab

**Files:**

- Modify: `admin-web/src/pages/store-checklists-model.ts`
- Modify: `admin-web/src/pages/StoreChecklistsPage.tsx`
- Create: `admin-web/src/pages/store-checklists-visit-plan.tsx`

- [ ] Add `'plan'` to `ChecklistTab`.
- [ ] Teach `resolveChecklistTabFromSearch()` to accept `tab=plan`.
- [ ] Add tab option only when `canManageVisits` is true.
- [ ] Add `MapPinned` or `Map` icon handling for the `plan` tab in `ChecklistTabIcon`.
- [ ] Build `visitPlanRows` from `visitPlanStoreRows`, `items`, `selectedMonth`, `evaluationMonth`, and `requiresCombinedVisitTemplates`.
- [ ] Pass both `selectedMonth` and the current month key into the model; do not let `all` mean "never missing".
- [ ] Render `StoreChecklistsVisitPlan` only for selected `plan` tab.
- [ ] Give the plan panel `id="store-checklist-panel-plan"` and `aria-labelledby="store-checklist-tab-plan"`.
- [ ] Implement `Ziyaret akışına git` as same-page tab selection plus `navigate({ pathname: location.pathname, search: buildChecklistSearch(location.search, { tab: 'visits' }) }, { replace: true })`; do not start a checklist command.
- [ ] Keep `StoreChecklistsVisitPanel` unchanged for `visits` and `incomplete`.

UI composition shape:

```tsx
<StoreChecklistsVisitPlan
  locale={locale}
  rows={visitPlanRows}
  selectedMonth={selectedMonth}
  t={t}
/>
```

### Task 4: Add Checklist Page E2E Coverage

**Files:**

- Modify: `admin-web/e2e/checklist-today-surfaces.spec.ts`

- [ ] Add Region Manager fixture with one high-risk missing visit and one low-risk strong visit.
- [ ] Assert `Ziyaret Planı` is visible for Region Manager.
- [ ] Assert missing actor-actionable visit row shows `Yüksek` and `Bu ay ziyaret yok`.
- [ ] Assert missing non-actionable VM visit does not become Region Manager's primary missing-visit reason.
- [ ] Assert strong row shows `Düşük` or `Plan temiz` and `Skor güçlü`.
- [ ] Assert a completed visit with `null` score shows `Sinyal yetersiz` and is not low risk.
- [ ] Assert Store Manager does not see `Ziyaret Planı`.
- [ ] Assert Store Manager opening `/store/checklists?tab=plan` falls back to an allowed tab without rendering the plan panel.
- [ ] Assert high-risk, medium-risk, and low-risk rows sort in that order and render required row fields.
- [ ] Assert clicking `Ziyaret akışına git` does not call start endpoint.
- [ ] Assert clicking `Ziyaret akışına git` updates the current URL to `tab=visits`.
- [ ] Assert `selectedMonth=all` evaluates missing visit and score risk against current month, not an older monthly summary.
- [ ] Assert no assigned stores shows `Atanmış mağaza yok`.
- [ ] Assert no visible published templates shows `Yayınlanmış ziyaret şablonu yok`.
- [ ] Add a 200-store fixture and record model calculation timing below 50 ms without extra network calls.
- [ ] Add 360 px mobile no-overflow assertion for the plan tab.

### Task 5: Add Region Manager Home Summary

**Files:**

- Modify: `admin-web/src/pages/StoreHomePage.tsx`
- Modify: `admin-web/src/features/localization/messages/store-home.ts`
- Modify: `admin-web/e2e/store-surfaces.spec.ts`

- [ ] Import and reuse `buildVisitPlanRows`.
- [ ] Import and reuse shared checklist coverage/visit-row builder.
- [ ] Pass empty `localActiveInstances` and `localCompletedRows` overlays from Store Home because Store Home has no in-page checklist draft state.
- [ ] Build rows only for `persona === 'regionManager'`.
- [ ] Render summary only when `/store/checklists` exists in role-aware navigation.
- [ ] Show high-risk count and top 3 stores.
- [ ] Link to `/store/checklists?tab=plan`.
- [ ] Add E2E assertion for Region Manager.
- [ ] Add negative assertion for Store Manager.

### Task 6: Evidence And Closeout

**Files:**

- Create: `docs/evidence/risk-based-visit-plan-v1-closeout-2026-06-16.md`

- [ ] Record scope.
- [ ] Record touched files.
- [ ] Record verification commands and results.
- [ ] Record explicit non-changes:
  - no API shape change,
  - no DB schema change,
  - no auth/permission change,
  - no checklist scoring change,
  - no Store Action/task generation,
  - no notifications/calendar.

## Verification Ladder

Minimum PR-1 / V1A local verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- checklist-today-surfaces.spec.ts
```

PR-2 / V1B home-summary verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "region manager"
```

Full release verification if PR-2 touches Store Home broadly:

```powershell
npm.cmd run check:release
```

Optional staging smoke only if safe persona env exists:

```powershell
$env:AUTH_SMOKE_FRONTEND_URL='https://staging.hr-axis.com'
npm.cmd --prefix admin-web run smoke:auth:staging:cookie-session
```

Do not count skipped protected checks as proof.

## Stop Rules

Stop and re-plan if any implementation step requires:

- new backend endpoint,
- database migration,
- changes to `ScopeGuard` or authorization semantics,
- KPI/ranking/norm/request source integration,
- automatic Store Action creation,
- calendar/scheduling commands,
- notification provider decisions,
- new role behavior,
- changing checklist score math,
- changing checklist acknowledgement behavior.

## Success Definition

V1 is done when:

- Region Manager can open `/store/checklists`, select `Ziyaret Planı`, and see assigned stores prioritized with source-backed reasons.
- Visual Merchandiser sees only VM-relevant visit planning.
- Store Manager does not receive planning controls.
- The action leads to existing checklist visit workflow without mutation.
- Region Manager home summarizes high-risk stores after checklist page proof.
- Tests prove no mobile overflow and no accidental checklist start mutation.

V1 is not done when:

- rows use fake KPI/norm/request signals,
- a plan row starts a checklist directly,
- Store Manager sees field planning actions,
- the feature needs a new standalone module before checklist-bound value is proven,
- evidence claims staging/protected readiness without a real persona smoke.
