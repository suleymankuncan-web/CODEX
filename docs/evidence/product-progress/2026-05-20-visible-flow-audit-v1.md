# Visible Flow Audit V1

## Purpose

Record the first Product Progress Plan V1 visible-flow audit before choosing
the next product-readiness PR. This is a repo-evidence audit, not a live UX
session. No auth, API, DB, provider, or business behavior was changed while
creating this note.

## Sokrates Decision

Claim:

- The next local work should be a small visible product-readiness slice, not a
  broad refactor or new architecture line.

Assumptions:

- Existing E2E coverage is enough to choose a first low-risk route.
- External readiness inputs are not currently available in this workspace.
- Copy/clarity work is allowed only when explicitly scoped as a product-readiness
  slice and verified with targeted UI tests.

Evidence:

- Repo evidence: `current-state.md` says external readiness is parked unless
  real provider/token/restore/Redis/upload inputs exist.
- Repo evidence: `docs/plans/project-progress-plan-v1.md` recommends starting
  with a visible-flow audit.
- Repo evidence: `admin-web/e2e/store-surfaces.spec.ts` covers `/store`,
  `/store/home`, `/store/rankings`, `/store/tasks`, `/store/approvals`,
  `/store/checklists` links, route transitions, retry states, and localization.
- Repo evidence: `admin-web/e2e/checklist-today-surfaces.spec.ts` covers the
  checklist visit, completion, acknowledgement, locale, and mobile paths.
- Repo evidence: `admin-web/e2e/admin-routing.spec.ts` covers admin shell,
  master data, admin checklists, snapshots, route transitions, and localization.

Counterargument:

- A repo-only audit can miss visual hierarchy problems visible in a browser.
  That is true, so the first implementation slice should stay tiny and be
  verified by an existing targeted Playwright route instead of pretending this
  audit is final UX evidence.

Risk:

- LOW for this audit document.
- MEDIUM for later product copy/layout changes because they are user-visible.

Door:

- Two-way door. A docs-only audit and scoped copy fix can be reverted normally.

Decision:

- Create this audit as the first evidence artifact, then execute the smallest
  user-visible slice found here.

## Route Audit

### `/store` and `/store/home`

Purpose:

- Role-aware store landing surface and daily action hub.

Primary action:

- Store manager: open approvals/tasks/checklist work.
- Region manager: open checklist field route.
- Visual merchandiser: land on checklist-only flow.
- Store personnel: open personal performance/ranking surfaces.

Existing coverage:

- `store-surfaces.spec.ts` covers Turkish-first chrome, store home prefetch,
  region manager checklist summary, VM-only landing, route transition loading,
  and locale persistence.

Loading/empty/error state:

- Store shell verification and route transition states are covered.
- Sidebar transient announcement failure recovery is covered.

Mobile risk:

- Store shell transition coverage exists; route-specific mobile depth is stronger
  on checklist than on home.

Trust/copy risk:

- `storeHome.command.managerCopy`, `storeHome.command.managerHeroTitle`, and
  `storeHome.command.managerHeroCopy` are empty strings in the localization
  dictionary. This weakens the first manager landing screen and is the smallest
  safe product-readiness slice found in this audit.

Recommended slice:

- Fill the manager store-home copy keys with concise Turkish and English copy.
- Add/adjust a targeted Playwright assertion on `/store/home` or `/store` that
  proves the manager landing text is visible.

### `/store/rankings`

Purpose:

- Store and personnel ranking with official/preview evidence.

Primary action:

- Inspect ranking, filter/sort, open personnel detail.

Existing coverage:

- `store-surfaces.spec.ts` covers the ranking table, retry state, personnel
  detail, localization, preview-only explanation, Turkey reference, checklist
  metrics, normalized HG, and backend sort params.

Loading/empty/error state:

- Loading, error, and empty code paths exist in `StoreRankingsPage.tsx`.
- Retry state is covered.

Mobile risk:

- Current evidence is route-functional rather than mobile-specific.

Trust/copy risk:

- Trust band exists and was recently improved. Do not start here unless a real
  ranking confusion appears.

Recommended slice:

- Park for now.

### `/store/checklists`

Purpose:

- Region/VM checklist visits, completed results, and store manager
  acknowledgement.

Primary action:

- Start/complete checklist or acknowledge completed receipt.

Existing coverage:

- `checklist-today-surfaces.spec.ts` covers assigned visits, acknowledgement
  language, retry, completed handoff, cache refresh, BM/VM visibility, VM scope,
  localization, and mobile width.
- `store-surfaces.spec.ts -g "checklist"` covers home/task deep links and KPI
  checklist impact.

Loading/empty/error state:

- Acknowledgement load retry and no pending receipts are covered.

Mobile risk:

- Checklist visit mobile usability is covered.

Trust/copy risk:

- Structural refactor is now below the earlier danger zone. Remaining modal
  work is riskier because it is close to score draft/autosave/completion state.

Recommended slice:

- Park mechanical refactor. Only continue if a concrete checklist UX issue is
  found.

### `/store/approvals`

Purpose:

- Store-originated seller-code, offboarding, and target distribution requests;
  returned request correction/resubmission.

Primary action:

- Submit a new request, edit returned workforce request, or inspect target
  approval ledger.

Existing coverage:

- `store-surfaces.spec.ts` covers seller-code request, region manager ledger
  filtering, direct action tabs, returned request load failures, target
  allocations, offboarding, returned edit/resubmit, and locale persistence.

Loading/empty/error state:

- Returned request load errors are now separate alerts.

Mobile risk:

- No dedicated mobile assertion was observed in the targeted route tests.

Trust/copy risk:

- Business action surface is important, but the recent PR line reduced the
  largest structural risk. Do not start another approvals refactor without a
  concrete issue.

Recommended slice:

- Park unless the visible-flow browser pass exposes a specific action clarity
  issue.

### `/admin/master-data`

Purpose:

- Baseline file review, validation, readiness, and promotion evidence.

Primary action:

- Inspect batches, validate, review dry-run evidence, promote reviewed store or
  personnel rows.

Existing coverage:

- `admin-routing.spec.ts` covers batch list fallback when `updatedAt` is absent
  and English localization for the command center.

Loading/empty/error state:

- Page-level loading/error, store/personnel panel loading/error/empty, and
  selected batch evidence error states exist in code.

Mobile risk:

- Not covered in the observed route tests.

Trust/copy risk:

- High operator importance, but actions touch live promotion semantics. Future
  work should start with information hierarchy or evidence clarity only.

Recommended slice:

- Consider in Phase 3 after the first store-home copy slice.

### `/admin/integrations` and `/admin/integrations/:batchId`

Purpose:

- Import uploads, import evidence, retry/error queue, decision evidence, and row
  lineage.

Primary action:

- Upload Power BI files, inspect evidence, retry eligible batches, map
  unresolved rows.

Existing coverage:

- Admin route coverage is not as visible in the observed grep output as store
  surfaces, but code has decision/evidence panels and import detail state.

Loading/empty/error state:

- Overview, needs-action, lookups, batch detail, reconciliation, errors, and
  audit error paths exist in code.

Mobile risk:

- Not currently a first priority for operator-heavy surfaces.

Trust/copy risk:

- High operator value, but upload/evidence work can touch external/provider-like
  assumptions. Keep future slices view-only unless explicitly scoped.

Recommended slice:

- Consider in Phase 3 if a concrete operator confusion appears.

### `/admin/checklists`

Purpose:

- Checklist template lifecycle and BM/VM draft separation.

Primary action:

- Create/edit checklist templates.

Existing coverage:

- `admin-routing.spec.ts` covers localization and BM/VM draft separation.

Loading/empty/error state:

- Basic route coverage exists; deeper template lifecycle review should wait for
  a concrete checklist admin issue.

Mobile risk:

- Not currently priority.

Trust/copy risk:

- Medium because template changes can affect downstream checklist behavior.

Recommended slice:

- Park.

### `/admin/targets`

Purpose:

- Target coverage and readiness review.

Primary action:

- Inspect approved personnel target coverage and localization.

Existing coverage:

- `admin-targets.spec.ts` covers target coverage and locale persistence.

Loading/empty/error state:

- Basic admin target coverage exists.

Mobile risk:

- Not currently priority.

Trust/copy risk:

- Target states are important but already have coverage readiness language.

Recommended slice:

- Park unless target coverage confusion appears in pilot feedback.

## First Product-Readiness Slice

Decision:

- Start with `/store/home` manager landing copy.

Why:

- It is user-visible and first-screen.
- It has direct repo evidence: empty localization strings.
- It does not require API/auth/DB changes.
- It can be verified with targeted `store-surfaces.spec.ts` route coverage.
- It is a normal two-way-door copy change.

Guardrails:

- Do not change routes, permissions, data fetching, API calls, CSS, role logic,
  or store shell behavior.
- Only fill localized copy and add/adjust targeted assertions.

Suggested verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npx.cmd playwright test store-surfaces.spec.ts -g "store home|store shell" --workers=1
```

Change-my-mind triggers:

- If the test fixture cannot represent a store manager route without broad
  setup changes, split the test change out and keep the copy change tiny.
- If copy keys are used by multiple personas unexpectedly, stop and re-check the
  dictionary usage.
