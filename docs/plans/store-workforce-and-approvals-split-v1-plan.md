# Store Workforce And Approvals Split V1 Plan

Status: active plan

PR-1 contract evidence:

- `docs/evidence/store-workforce-and-approvals-split-pr1-contract-matrix-2026-06-05.md`

## Reader And Action

Reader:

- a future engineer or Codex session implementing the Store workforce surface
  and the Store approvals cleanup.

After reading, they should be able to:

- implement the new Store workforce route and the approvals split in small,
  reviewable PRs without changing business workflow, auth semantics, API
  response shape, DB schema, target distribution behavior, or workforce request
  lifecycle behavior.

## Problem

The Store approvals surface currently carries too many responsibilities. It is
used both as a request/status ledger and as a place where store users can start
target distribution, seller-code, and offboarding flows.

This makes the product boundary unclear:

- target distribution belongs to the targets surface,
- seller-code and offboarding belong to the workforce domain,
- approvals should read like a request center, not like a mixed creation
  workbench.

The desired split is:

- Store targets owns target distribution, target revision, approved target
  snapshots, and target approval decisions.
- Store workforce owns Norm Kadro, store personnel scope, position distribution,
  tenure, seller-code request creation, offboarding request creation, returned
  workforce request correction, and workforce movement status.
- Store approvals owns request status reading: open/pending requests,
  completed requests, request pagination, and route handoff to the owning
  surface.

## Locked Product Decisions

1. The route is `/store/workforce`.
2. The sidebar label is `Norm Kadro`.
3. The workforce surface owns:
   - personnel scope,
   - position distribution,
   - tenure,
   - norm vs actual staffing,
   - seller-code request creation,
   - offboarding request creation,
   - returned seller-code/offboarding correction,
   - workforce request status reading.
4. The approvals surface becomes `Talep Merkezi`.
5. The approvals surface does not own target entry, seller-code entry, or
   offboarding entry once the workforce route is live.
6. The targets surface remains the owner of target distribution, target
   revision, and target approval.
7. A region manager does not navigate from workforce to a store workforce page.
   They stay on the region list and use `Detay ac`.
8. `Detay ac` opens an in-context store workforce detail modal on desktop and
   a bottom drawer / full-height sheet on mobile.
9. No fake production data is allowed. If a field has no real source, the UI
   shows honest empty/loading/error/access state or the PR stops.
10. The approved prototype is the visual contract for density, palette, row
    rhythm, modal model, status tones, and role-specific information
    architecture.
11. `docs/prototypes/store-workforce-prototype-v1.html` is the locked visual
    contract for `/store/workforce`.
12. `docs/prototypes/store-approvals-request-center-v1.html` is the locked
    visual contract for `/store/approvals` after it becomes `Talep Merkezi`.

## Non-Goals

This plan must not:

- change DB schema,
- change existing API response shape without a separate contract PR,
- change auth, role, permission, read-scope, or action-store semantics,
- change seller-code request lifecycle behavior,
- change offboarding request lifecycle behavior,
- change target distribution lifecycle behavior,
- change target scoring, KPI scoring, checklist scoring, rankings, or snapshot
  interpretation,
- introduce broad admin UI changes,
- introduce mobile push notification behavior,
- implement paid-provider dependencies,
- move HR/admin approval responsibilities into Store UI,
- expose internal terms such as API, DB, contract, route, queue, Redis,
  provider, or staging in user-facing copy.

## Surface Ownership

### Store Targets

Owns:

- target distribution request creation,
- target distribution revision,
- target approval decision where current business behavior already allows it,
- approved target snapshot reading,
- target coverage and target distribution detail.

Approvals may link to target work using product language such as `Hedefe git`,
but the target creation form must not live inside approvals after the split.

### Store Workforce

Owns:

- Norm Kadro page,
- active personnel list for the store manager,
- regional workforce store list for the region manager,
- position distribution,
- tenure metrics,
- norm vs actual staffing visibility,
- seller-code request creation,
- offboarding request creation,
- returned workforce request correction,
- workforce request movement status.

### Store Approvals

Owns:

- request center / status ledger,
- default `Acik / Bekleyen` tab,
- `Tamamlanan` tab,
- max 15 visible rows per page,
- pagination after 15 rows,
- product-language handoff to owning surfaces:
  - `Hedefe git` for target work,
  - personnel request status and correction language for workforce work.

It must not become the creation workbench again.

## Role Model

## Route And Sidebar Visibility Matrix

PR-1 must confirm the exact helper and role behavior before PR-2 adds the
route. Until that evidence exists, the intended product matrix is:

| Actor | `/store/workforce` Route | Sidebar `Norm Kadro` | Expected View |
| --- | --- | --- | --- |
| Store manager with assigned/action store | allowed | visible | Store manager workforce view. |
| Region manager with read-scope stores | allowed | visible | Region manager workforce view. |
| Store personnel | forbidden | hidden | Access state only on direct route if route guard is reached. |
| Read-only/reporting user without Store workforce scope | forbidden | hidden | Access state only on direct route if route guard is reached. |
| Admin-only user without Store shell role | forbidden from Store shell | hidden in Store shell | No Store workforce navigation. |

PR-1 must map these rows to existing authorization helpers or explicitly stop
if a helper is missing. PR-2 must include a route/sidebar parity check proving
that adding `Norm Kadro` does not change unrelated Store route visibility.

PR-1 output confirmed that no workforce-specific frontend helper exists today.
PR-2 must add one using existing role and scope data only:

- `STORE_MANAGER` plus at least one true action-scope store can open the Store
  Manager workforce view. The helper must inspect
  `authSummary.user.actionScope.assignedStoreIds` or legacy
  `authSummary.user.assignedStoreIds` directly and must not fall back to read
  `scope.storeIds`.
- `REGION_MANAGER` plus at least one read-scope store can open the Region
  Manager workforce route.
- `STORE_PERSONNEL`, plain read-only/reporting users, and admin-only sessions
  cannot see the sidebar item and must receive access state on direct route.

This helper is frontend route/sidebar gating only. It must not widen backend
auth, permission, action-store, or read-scope semantics.

### Store Manager Workforce View

The store manager sees only their assigned/action store workforce data.

Visible modules:

- summary metrics:
  - personnel scope,
  - average tenure,
  - norm vs actual,
  - pending workforce movements,
- personnel list:
  - employee name,
  - employee reference where available,
  - position,
  - hire date,
  - tenure,
  - seller-code status,
  - personnel/workforce status,
- position distribution:
  - store manager,
  - assistant store manager,
  - sales consultant,
  - cashier,
  - any other position present in real data,
- tenure distribution:
  - 0-3 months,
  - 3-12 months,
  - 1-3 years,
  - 3+ years,
- workforce movement summary:
  - seller-code waiting,
  - offboarding open,
  - returned request needing correction.

Allowed actions:

- create seller-code/new-personnel request,
- create offboarding request,
- correct and resubmit returned seller-code request,
- correct and resubmit returned offboarding request.

Forbidden in this view:

- seeing stores outside assigned/action scope,
- editing employee master data directly,
- approving HR/admin workforce requests,
- creating fake norm numbers if no source exists.

### Region Manager Workforce View

The region manager sees only stores in their read scope.

Visible modules:

- summary metrics:
  - total personnel scope,
  - regional average tenure,
  - store count,
  - pending workforce movements,
- regional position totals,
- regional tenure signal,
- compact store list:
  - store name,
  - personnel count,
  - average tenure,
  - norm vs actual,
  - position balance indicator,
  - workforce status,
  - `Detay ac`.

Allowed actions:

- open store workforce detail modal,
- inspect personnel, position distribution, and workforce requests for the
  selected store.

Forbidden in this view:

- `Magazaya git` navigation,
- editing a store manager's workforce request,
- approving HR/admin workforce requests unless a separate business contract
  explicitly introduces region approval for workforce,
- seeing stores outside read scope.

## Store Detail Modal

Desktop:

- wide modal,
- fixed inside current page context,
- background dim/blur,
- no route change.

Mobile:

- bottom drawer / full-height sheet behavior,
- no horizontal overflow,
- table content becomes cards or compact rows.

Header:

- store name,
- last updated timestamp when available,
- workforce status badge.

Summary:

- active personnel,
- norm staffing target,
- average tenure,
- pending request count.

Tabs:

1. `Personel`
   - employee name,
   - position,
   - hire date,
   - tenure,
   - seller-code/personnel status.
2. `Pozisyon dagilimi`
   - real position counts for that store,
   - no fake position labels if the source has no position value.
3. `Talepler`
   - seller-code waiting,
   - offboarding open,
   - returned request needing correction,
   - completed request rows only if real request data exists.

Footer:

- close action.
- optional inspect action only if it maps to an existing allowed workflow.
- no `Magazaya git`.

## Data Contract Matrix

Before runtime implementation, every visible field must be mapped to one of:

- existing workforce API data,
- existing target API data,
- frontend-derived value from existing API data,
- missing contract requiring a stop or separate backend contract PR,
- honest empty/fallback state.

| Field | Desired Meaning | Likely Source | Production Rule |
| --- | --- | --- | --- |
| Active store personnel | Current active personnel in a store | Existing store employee list | Show count from real store employee data. |
| Employee name | Display name of active employee | Existing store employee list | Show if available; otherwise use existing fallback label only. |
| Employee reference | Store/personnel external ref | Existing store employee list | Do not invent references. |
| Position | Current employee position | Existing store employee list or position option label | If missing, show honest missing state. |
| Hire date | Employee start date | Existing store employee list | Required for tenure; if missing, tenure becomes unavailable. |
| Tenure | Time between hire date and selected/current date | Frontend-derived from hire date | Derive deterministically; no stored write needed. |
| Average tenure | Average of visible active employees | Frontend-derived | Store manager can derive from own store employees. Region requires scoped aggregate or all scoped store employees. |
| Tenure distribution | Buckets by tenure | Frontend-derived | Use only employees with hire date; show excluded/missing count if needed. |
| Position distribution | Count by real position | Frontend-derived | Use real position labels; no fake categories. |
| Seller-code status | Current seller-code request state | Existing seller-code request data | Use real request status. |
| Offboarding status | Current offboarding request state | Existing offboarding request data | Use real request status. |
| Returned workforce requests | Rejected/returned seller-code/offboarding requests | Existing workforce request lists | Preserve resubmit lifecycle. |
| Norm staffing target | Expected staffing count | Missing or future norm source | Stop or show not configured; do not invent. |
| Norm vs actual | Expected vs active personnel | Norm target + active personnel count | Only show if norm target is configured. |
| Regional store list | Scoped stores and workforce summary | Likely missing aggregate | Stop or add separate backend read contract. |
| Regional position totals | Position totals across scoped stores | Regional aggregate or all scoped employee rows | Prefer aggregate for scale; do not fetch unbounded data. |
| Regional pending movements | Pending workforce requests per scoped store | Workforce requests scoped by store | Must respect read/action scope. |

## Required Backend/Contract Findings

The implementation must inspect whether current contracts support:

1. active store employees for a store,
2. position options and position labels,
3. seller-code request listing by status and store scope,
4. offboarding request listing by status and store scope,
5. returned seller-code/offboarding request correction,
6. region-scoped store list with workforce aggregates,
7. norm staffing target per store and position,
8. missing-hire-date handling,
9. pagination/limit behavior for large regional data.

If items 6 or 7 do not exist, do not fake them. Either:

- ship a partial workforce view with honest `not configured` state, or
- stop and open a backend read-contract PR plan.

## Pagination Semantics

Approvals:

- The visible list is capped at 15 rows per page.
- If the existing request API supports limit/offset for the required source,
  use API pagination.
- If the current source is already a bounded in-memory list, frontend
  pagination is acceptable for V1.
- If a source would require unbounded fetching, stop and add a scoped backend
  read contract.

Workforce:

- Store manager personnel list may render all active personnel for the assigned
  store if the existing store employee endpoint is naturally store-bounded.
- Region manager store rows must not require unbounded employee fetching from
  the browser.
- Region manager workforce summaries should use a scoped aggregate read model
  if store count or personnel count can grow materially.

PR-1 evidence found that the approved Region Manager workforce detail prototype
is not fully backed by current Store workforce contracts. Existing workforce
employee, position, seller-code, and offboarding endpoints are Store Manager /
SUPER_ADMIN action-scope oriented; Region Manager cannot call them for scoped
store detail today. PR-4 must therefore either ship honest unavailable/detail
not configured states or stop for a separate backend read-contract plan. It
must not emulate an aggregate by unbounded frontend fetching.

## Empty And Missing-Contract States

Use honest product states instead of silent omission:

- Missing norm target: `Norm tanimli degil`.
- Missing hire date: `Kidem hesaplanamadi`.
- Missing position label: `Pozisyon bilgisi yok`.
- No seller-code/offboarding request: `Acik personel talebi yok`.
- No region aggregate contract: route can show access/loading shell, but the PR
  must stop before pretending aggregate values exist.

These states are allowed only when they reflect real missing data. They must not
be used to hide scope or permission errors.

## PR Operating Checklist

Every implementation PR in this plan must:

1. start from fresh main,
2. keep one review story,
3. state contract impact explicitly,
4. state what did not change,
5. run the relevant verification ladder,
6. run local adversarial review before PR,
7. include desktop/mobile visual evidence for UI PRs,
8. request release-blocking review,
9. merge only after checks and release-blocking review are clean,
10. verify origin/main after merge.

If a PR needs to change API shape, DB schema, auth semantics, workflow
semantics, scoring, or lifecycle status, it is no longer part of this UI split
and must stop for a new plan.

## PR Plan

### PR-1: Workforce Contract Matrix

Scope:

- document the real data contract for Store workforce,
- document the exact route/sidebar role visibility matrix and helper mapping,
- classify every prototype field as existing, derived, missing, or parked,
- decide whether norm vs actual can be shown in V1 or must be shown as not
  configured.

Expected output:

- contract matrix evidence,
- route/sidebar visibility evidence,
- exact user-facing fallback states,
- final implementation scope for PR-2 through PR-5.

PR-1 output:

- `docs/evidence/store-workforce-and-approvals-split-pr1-contract-matrix-2026-06-05.md`
- Store Manager workforce read/create/resubmit can proceed from existing
  action-store contracts.
- Region Manager workforce detail is not fully backed by existing Store
  workforce contracts and must remain honest unavailable state or stop for a
  separate read-contract plan.
- Norm/actual is backed by backend planning data but is not yet a typed
  frontend Store contract; do not show completed norm values unless that
  contract is explicitly wired and verified.

Verification:

- docs diff check,
- no runtime code changes unless adding docs-only tests/guards is explicitly
  needed.

Rollback:

- revert docs only.

Stop if:

- the plan cannot identify whether seller-code/offboarding requests are scoped
  correctly for store and region roles,
- the route/sidebar helper mapping cannot prevent Store personnel or read-only
  users from seeing manager workforce navigation.

### PR-2: Store Workforce Route Foundation

Scope:

- add `/store/workforce`,
- add sidebar item `Norm Kadro` only for allowed Store roles,
- gate Store Manager visibility with true action-scope store data only:
  `authSummary.user.actionScope.assignedStoreIds` or legacy
  `authSummary.user.assignedStoreIds`, with no fallback to read
  `scope.storeIds`,
- add access/loading/error/empty states,
- add shell and page structure using Store redesign standards,
- no fake data,
- no seller-code/offboarding movement of forms yet unless PR-1 proves it is
  safe,
- include a placeholder only if it clearly says real workforce data is not
  configured or not available.

Expected output:

- route loads for allowed roles,
- forbidden users see access state,
- no out-of-role navigation item appears.

Verification:

- frontend lint,
- frontend build,
- targeted route/access Playwright coverage,
- route/navigation role visibility check.

Rollback:

- remove route/sidebar addition and route tests.

Stop if:

- route visibility changes for unrelated Store pages,
- role gating cannot match existing authorization helpers,
- Store Manager route/sidebar visibility depends on read `scope.storeIds`
  instead of true action-scope stores,
- adding the route would expose Store personnel to manager-only workforce
  actions.

### PR-3: Store Manager Workforce View

Scope:

- implement the store manager workforce view,
- read active store employees,
- derive personnel count, position distribution, tenure, and tenure buckets,
- show seller-code/offboarding status from real request data where available,
- move or recreate seller-code/offboarding creation forms here only by reusing
  existing mutation contracts,
- preserve returned request correction/resubmit behavior,
- support opening a returned seller-code/offboarding correction by request type
  and request id.

Expected output:

- store manager can start the same seller-code and offboarding flows from
  workforce,
- store manager can open and resubmit the same returned request id from
  workforce,
- existing payload shape and lifecycle status do not change,
- approvals no longer needs to be the primary creation context after PR-3.

Verification:

- frontend lint,
- frontend build,
- targeted e2e for store manager workforce read view,
- targeted e2e or component test proving seller-code/offboarding submit payload
  parity if forms are moved,
- targeted e2e proving returned seller-code/offboarding correction keeps the
  same request id and status lifecycle,
- visual QA desktop/mobile against approved prototype.

Rollback:

- revert workforce store manager view and keep existing approvals forms until
  PR-5.

Stop if:

- moving the forms changes payload, validation, status lifecycle, request id
  continuity, or action-scope behavior,
- workforce cannot open returned request correction without losing the selected
  request identity.

### PR-4: Region Manager Workforce View

Scope:

- implement region manager workforce summary,
- show only scoped stores,
- show compact store rows,
- implement `Detay ac` modal/drawer,
- no `Magazaya git` action,
- use real aggregate or real scoped data only,
- if the current contract still lacks region workforce aggregate/detail data,
  render honest unavailable/not configured states or stop before pretending
  aggregate values exist.

Expected output:

- region manager sees scoped store workforce summaries,
- detail modal shows selected store data without navigation,
- modal tabs show personnel, position distribution, and requests where real
  data exists.

Verification:

- frontend lint,
- frontend build,
- targeted e2e for region manager route visibility and scoped store rows,
- targeted e2e for modal open/close and mobile drawer,
- negative test or assertion proving out-of-scope store rows are absent,
- visual QA desktop/mobile against the locked prototype:
  `docs/prototypes/store-workforce-prototype-v1.html`.

Rollback:

- revert region manager workforce view while keeping route foundation.

Stop if:

- region aggregate data is missing and cannot be derived without unbounded
  frontend fetching,
- any out-of-scope store/personnel row appears,
- modal requires changing backend permission semantics,
- `Detay ac` cannot be implemented without navigation.

### PR-5: Approvals Talep Merkezi Cleanup

Prerequisite:

- PR-3 must provide seller-code/offboarding creation and correction from
  workforce.

Scope:

- convert approvals to request center/status ledger,
- remove target entry form from approvals,
- remove seller-code/offboarding creation forms from approvals,
- keep status reading and correction handoff only where supported,
- wire seller-code/offboarding correction actions to workforce with enough
  identity to open the correct returned request,
- default to `Acik / Bekleyen`,
- add `Tamamlanan`,
- max 15 rows per page,
- pagination after 15 rows,
- use product language:
  - `Hedefe git`,
  - `Personel talebi`,
  - no internal route/source wording.

Expected output:

- approvals reads as talep merkezi,
- no creation workflow is stranded,
- returned seller-code/offboarding rows still have a working correction path,
- existing target and workforce request lifecycles remain unchanged.

Verification:

- frontend lint,
- frontend build,
- targeted approvals e2e for store manager and region manager views,
- targeted check that approvals no longer renders removed creation forms,
- targeted check that approvals correction actions open the matching workforce
  correction context by request type and request id,
- targeted check that open/completed tabs and pagination behave as expected,
- visual QA desktop/mobile against the locked prototype:
  `docs/prototypes/store-approvals-request-center-v1.html`.

Rollback:

- revert approvals cleanup; workforce can remain if independent.

Stop if:

- seller-code/offboarding creation is not live in workforce,
- target creation/revision path is not live in targets,
- approvals cleanup would remove the only available user path for an existing
  production workflow,
- approvals cleanup changes target or workforce lifecycle state semantics,
- correction handoff cannot preserve selected request identity.

### PR-6: Final Consistency And Docs Closeout

Scope:

- old UI remnant scan,
- user-facing internal copy scan,
- route/sidebar role visibility scan,
- mobile overflow checks,
- current state handoff update,
- evidence summary.

Verification:

- frontend lint,
- frontend build,
- relevant Store Playwright specs,
- release check if broad Store shell behavior changed,
- diff check.

Rollback:

- docs/evidence-only rollback unless final cleanup changes runtime code.

Stop if:

- old approvals creation behavior was removed before the replacement route was
  proven,
- any route/sidebar item appears for an unassigned role.

## Visual Implementation Rules

- Use shadcn/ui, Tailwind v4, and lucide.
- Keep the approved prototype density and row rhythm.
- Treat locked prototype HTML files as visual contracts, not references. A
  production implementation must carry over the visible structure, palette,
  density, row/card rhythm, status colors, modal/drawer behavior, labels, and
  main interaction flow. If real data, role scope, missing backend contract,
  accessibility, or responsiveness requires a deviation, record the reason in
  evidence before PR.
- Use compact metric cards.
- Use tables for desktop dense data and cards/drawer for mobile.
- Do not use landing-page hero language.
- Do not use decorative modules that do not support a user decision.
- Keep typography lighter and premium; avoid overly bold table rows.
- Keep status colors consistent:
  - green: active/complete/dengeli,
  - amber: pending/waiting/open staffing gap,
  - rose: missing/risk/returned/exit,
  - purple/cyan: neutral product grouping or selected state.
- Do not expose prototype role switchers in production.
- Do not leave old dashboard primitive language in migrated surfaces.

## User-Facing Language Rules

Use:

- `Norm Kadro`,
- `Personel kapsami`,
- `Ortalama kidem`,
- `Norm / fiili`,
- `Bekleyen hareket`,
- `Detay ac`,
- `Hedefe git`,
- `Personel talebi`,
- `Acik / Bekleyen`,
- `Tamamlanan`.

Avoid in user-facing UI:

- API,
- DB,
- contract,
- route,
- queue,
- workflow,
- Workforce as untranslated technical source label,
- Targets as untranslated button label,
- staging,
- provider,
- scope,
- auth.

## Verification Ladder

Use the smallest gate that matches the PR:

1. Docs-only PR:
   - diff check.
2. Route/sidebar foundation:
   - frontend lint,
   - frontend build,
   - targeted route/access Playwright.
3. Store manager workforce forms:
   - frontend lint,
   - frontend build,
   - targeted form payload parity,
   - targeted Store e2e.
4. Region manager modal:
   - frontend lint,
   - frontend build,
   - targeted modal/drawer e2e,
   - out-of-scope row absence assertion.
5. Approvals cleanup:
   - frontend lint,
   - frontend build,
   - targeted approvals e2e,
   - visual QA desktop/mobile.
6. Broad Store shell change:
   - Store route/shell e2e,
   - release check if shell or shared navigation changed.

## Rollback Model

Each PR must be independently revertible:

- PR-1 is docs-only.
- PR-2 only adds route foundation.
- PR-3 can revert store manager workforce without touching approvals cleanup.
- PR-4 can revert region manager workforce without touching store manager
  workforce.
- PR-5 can revert approvals cleanup while workforce remains live.
- PR-6 should mostly be docs/evidence/cleanup.

No PR may require:

- data repair,
- migration rollback,
- queue drain,
- permission cleanup,
- manual production data mutation.

If any of these becomes necessary, stop and replan.

## Open Risks

1. Norm staffing target may not exist yet.
   - Mitigation: show `not configured` or stop for a separate contract PR.
2. Region aggregate may not exist yet.
   - Mitigation: do not fetch unbounded employee lists from frontend; add a
     scoped aggregate read contract if needed.
3. Seller-code/offboarding forms may have hidden coupling to approvals state.
   - Mitigation: prove payload/status parity before removing approvals forms.
4. Returned request correction may need careful state migration.
   - Mitigation: preserve same request id and resubmit behavior.
5. Store personnel may accidentally see workforce or approvals routes.
   - Mitigation: route/sidebar role visibility tests.
6. User-facing copy may leak technical labels.
   - Mitigation: copy scan for internal terms.
7. Prototype parity may drift during implementation.
   - Mitigation: desktop/mobile screenshot comparison before PR closeout.

## Done Definition

The V1 split is done only when:

- `/store/workforce` exists for the intended roles,
- Store managers can perform seller-code/offboarding work from workforce,
- region managers can inspect store workforce detail through modal/drawer,
- approvals no longer owns creation forms,
- approvals keeps status visibility and handoff actions,
- no fake data is present,
- out-of-scope stores/personnel are absent,
- desktop and mobile views match the approved prototypes materially,
- all PR verification gates pass,
- current handoff docs are updated with what shipped and what remains parked.
