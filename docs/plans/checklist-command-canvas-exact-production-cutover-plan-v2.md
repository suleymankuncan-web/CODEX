# Checklist Command Canvas Exact Production Cutover Plan v2

**Status:** Owner-approved for autonomous execution
**Date:** 2026-07-14
**Production route:** `/store/checklists`
**Accepted prototype:** `D:\hr-axis-external-lab\prototypes\store-checklists-three-concepts-v1`
**Supersedes:** the remaining UI/cutover work in
`docs/plans/checklist-command-canvas-production-implementation-v1.md`; its
locked domain, authorization and data-integrity decisions remain authoritative.

## 1. Objective

Replace the production checklist page with the accepted Command Canvas as one
coherent, real-data product surface. Completion means visual and behavioral
parity at the accepted viewports, correct role-scoped data, persistent weekly
visit planning, Living Store Record history and checklist execution without any
visible or dormant legacy checklist page implementation.

This is not a CSS reskin. The prototype defines information architecture,
geometry, interaction and responsive behavior. Production APIs, authorization,
audit, historical truth and failure states define the data behavior.

## 2. Evidence-based current state

### 2.1 Already merged on `main`

- Command read API and Report Viewer region aggregation API are present.
- Region Manager Command Canvas visit list is live for the default
  `/store/checklists` route.
- The 1440, 1024, 390 and 320 visit-list evidence exists.
- Region-owned weekly visit-plan schema and scoped GET/PUT API are merged.
- Server-side pagination has no fixed 30-store business limit.

### 2.2 Present only as uncommitted work on
`codex/checklist-command-canvas-ui-v1`

- Monday-Saturday weekly planner and full-week dialog.
- Real visit-plan GET/PUT integration.
- Istanbul week helpers, draft digest and targeted tests.
- 35-store mobile coverage is being added but is not yet merged evidence.

This work MUST be preserved. It is not counted as production-complete until its
targeted tests, screenshots, canonical checks, PR and post-merge verification
are green.

### 2.3 Missing from production

- `MaÄŸaza kayÄ±tlarÄ±` view and Living Store Record drawer.
- Cursor/incremental operational-history API.
- Report Viewer company -> region manager -> store hierarchy and weekly-plan
  readback.
- Store Manager own-store Command Canvas.
- New-surface checklist session, result, acknowledgement and task lifecycle
  overlays.
- Complete loading, empty, error, forbidden and partial-data states for every
  role/view.
- Real-device evidence for weekly planning, long history and variable store
  counts.

### 2.4 Legacy implementation still live

`StoreChecklistsPage.tsx` currently renders `StoreChecklistsLegacyPage` for all
non-Region-Manager personas and whenever `view=workflow`, `tab`, `result` or
`status` appears. Command Canvas row actions therefore still leave the new
surface and enter the old page.

The old page also owns imports and styles under the following families:

- `store-checklists-hero`, `store-checklists-controls`,
  `store-checklists-visit-panel`, `store-checklists-visit-plan`,
  `store-checklists-acknowledgement-panels`;
- the legacy page-local model/logic/cache/coverage/atom helpers where no new
  consumer remains;
- `store-checklists-flow.css` and
  `store-checklists-flow-responsive.css`;
- old session/result/modal classes that have not been moved into the Command
  Canvas namespace.

The final deletion manifest MUST be generated from the live import graph. A
filename appearing above is not deleted if a verified non-legacy route still
owns it; reusable domain behavior is first moved behind a new-surface component.
`ReportsChecklistsPage` is a separate admin snapshot report and is not a legacy
fallback to delete.

### 2.5 Blocking gaps found by adversarial comparison

- The dirty planner derives its region from `data.items[0]`; filters, pages or
  an empty result can silently change/erase planning context.
- It downloads every region-store page before client filtering. Exact parity
  requires server-paged candidate search and bounded rendering.
- The two-way toggle, badge and weekly outcome metrics do not implement the
  prototype's three-view/full-period semantics.
- The full-period Plan search/table/reason/edit-replan drawer is absent.
- Waiting/missed weekly cards currently enter legacy workflow indiscriminately;
  only completed evidence may open a result, while waiting/missed items remain
  planning/replanning actions.
- A new idempotency key is generated for every retry and `409` is generic. One
  submitted snapshot MUST retain its key through uncertain retry, and conflict
  recovery MUST preserve/reconcile the local draft.
- Planner failure/403/409, dirty Escape/backdrop, multi-region, long text,
  200-candidate, focus containment and mobile-keyboard coverage is incomplete.
- Existing visit screenshots were overwritten by dirty work and MUST NOT be
  presented as weekly-plan evidence.

## 3. Accepted prototype contract

### 3.1 Shared shell

- `Saha Kontrolleri` title, period overline and compact month/year picker.
- Top-right liquid view switch with real alert badge.
- Four-sided, compact metric/decision rail with Lucide icons and the accepted
  purple -> blue -> cyan edge treatment.
- Manrope/DM Sans hierarchy, non-italic body copy, accepted radii, shadows,
  borders, spacing and density.
- No prototype left navigation, role preview switcher, comparison switcher or
  fixtures in production.

### 3.2 Region Manager

- Three sibling views: `Ziyaretler`, `Ziyaret planÄ±`, `MaÄŸaza kayÄ±tlarÄ±`.
- Visit metrics filter the list; search, status/owner/column controls, sortable
  text headers and server pagination behave as shown.
- BM and VM are separate columns; missing execution renders `YapÄ±lmadÄ±`.
- `Son ziyaretten geÃ§en sÃ¼re` uses only a real completed visit.
- `Ziyaret yapÄ±lmadÄ±`/`Checklist yapÄ±lmadÄ±` status copy MUST use the compact
  status-pill typography and padding from the accepted density system. It MUST
  remain single-line at desktop/tablet widths and MUST NOT dominate the store,
  date or action content.
- Weekly board is Monday-Saturday. One `HaftayÄ± Planla` dialog edits a local
  draft and one `Ziyaret PlanÄ±nÄ± Kaydet` action persists the snapshot.
- The Plan view also contains the accepted full-period risk metrics, search,
  priority control, server-paged table, reason/status columns and edit/replan
  drawer. The weekly board does not replace this table.
- The same store MAY be planned on different days in one week and MUST NOT be
  duplicated on the same day/type.
- Today/future is `Ziyaret Bekleniyor`; a past local day without matching
  completion is `Checklist yapÄ±lmadÄ±`; matching completion is
  `Ziyaret TamamlandÄ±`.
- Store records show operational-history facts rather than duplicating the
  visit-list score presentation.

### 3.3 Report Viewer

- Entirely read-only within the explicitly assigned company scope.
- Company metrics filter the region list.
- Region-manager rows are sortable and expandable.
- Expanded regions expose their store scope, BM/VM scores, last completed
  visit, status/open-task facts and the selected weekly plan.
- No planning, checklist execution, acknowledgement or task mutation control
  is rendered or callable.

### 3.4 Store Manager

- Exactly one authorized store context is visible.
- Shows BM/VM result state, open-task state, last real visit and Living Store
  Record for that store.
- Does not show region/company data or weekly-plan mutation.
- Existing authorized acknowledgement/task-close behavior is preserved through
  the new overlays; capability checks, not visual hiding alone, control it.

### 3.5 Overlays and long content

- Date/filter popovers close on outside click and Escape and restore focus.
- Weekly planner traps focus, owns scrolling, protects unsaved drafts and stays
  usable at 320px.
- Checklist execution uses the accepted Focus Dock/full-screen mobile pattern;
  draft autosave, correction-note rules and session resume remain real.
- Living Store Record drawer owns scrolling, initially returns a bounded page,
  loads older events incrementally and opens event detail without losing the
  parent scroll/focus position.

## 4. Functional requirements

- **FR-1:** `/store/checklists` MUST select one new Command Canvas persona from
  authenticated server capabilities; it MUST NOT select UI from query-string
  role simulation.
- **FR-2:** Region Manager MUST receive the exact three-view contract in 3.2.
- **FR-3:** Report Viewer MUST receive the exact read-only hierarchy in 3.3.
- **FR-4:** Store Manager MUST receive the exact own-store contract in 3.4.
- **FR-5:** VM MUST keep its authorized assigned-store execution capability
  without receiving weekly-plan maintenance or another role's scope.
- **FR-6:** Weekly planning MUST use the merged region/week revision API and
  MUST derive outcome from real completed BM visits.
- **FR-7:** Living Store Record MUST use an allowlisted, cursor-paginated,
  store-scoped operational-history API with actor-time snapshots.
- **FR-8:** Session, result, acknowledgement and task actions MUST open inside
  Command Canvas overlays and preserve current domain/API semantics.
- **FR-9:** Existing internal deep-link producers MUST be migrated to the new
  route-state contract. A bounded compatibility normalizer MAY translate a
  persisted old link, but MUST NOT render legacy DOM.
- **FR-10:** The final cutover MUST remove `StoreChecklistsLegacyPage`, its
  routing branch, orphan components, orphan tests and orphan CSS/imports.
- **FR-11:** Every view MUST expose real loading, empty, retryable error,
  forbidden and partial-data states without fixtures or fabricated values.
- **FR-12:** Search, metrics, filters, sort, page/week navigation and overlays
  MUST match the accepted interaction contract for keyboard, pointer and touch.
- **FR-13:** Metric, status and sort changes that require a server read MUST
  preserve the current rows until the replacement response is ready. Column
  preset changes MUST be local and immediate; neither path may blank, remount or
  visually reload the page.

## 5. Non-functional requirements

- **NFR-1 Visual parity:** at 1440x900, 1024x768, 390x844 and 320x844,
  accepted landmarks MUST have no bounding-box delta greater than 1 CSS pixel
  against the deterministic prototype contract. Stable screenshot fixtures MUST
  keep `maxDiffPixelRatio <= 0.005`; text rasterization differences require
  documented manual review, never an increased global threshold.
- **NFR-2 Responsive safety:** document `scrollWidth` MUST NOT exceed
  `clientWidth`; overlays MUST own internal scrolling and keep primary actions
  reachable.
- **NFR-3 Scale:** UI MUST use server pagination/cursors and remain operable for
  1, 20, 35, 200 and empty scopes; no business rule may assume 30 stores.
- **NFR-4 Authorization:** negative role/scope tests MUST prove API rejection;
  hidden buttons are not authorization evidence.
- **NFR-5 Accessibility:** focus trap/restore, Escape, outside-click where
  appropriate, labels, live status and reduced motion MUST pass automated checks
  and keyboard inspection.
- **NFR-6 Data truth:** the UI MUST NOT calculate authoritative score, visit
  completion, elapsed time, region ownership or history identity from fixtures
  or current-user guesses.
- **NFR-7 Performance:** command and history reads MUST avoid N+1 queries;
  200-store and long-history contract tests MUST remain within repository query
  and response budgets.
- **NFR-8 Clean cutover:** final production bundles and DOM MUST contain no
  legacy page selector, duplicate control, fixture role switcher or unreachable
  legacy checklist chunk.
- **NFR-9 Interaction continuity:** filter/sort transitions MUST update pressed
  state within one animation frame, preserve table height and focus, and show at
  most a non-blocking inline refresh signal. A full-page loader, skeleton swap
  or content flash after initial load is prohibited.

## 6. API and data contracts

The merged command, region aggregation and weekly visit-plan contracts remain
the source of truth. UI code MUST consume generated OpenAPI types.

The remaining history contract is:

```ts
type OperationalHistoryResponse = {
  data: {
    store: { id: string; name: string; city: string | null; district: string | null }
    summary: {
      eventCount: number
      completedVisitCount: number
      assignedTaskCount: number
      openTaskCount: number
    }
    items: OperationalHistoryEvent[]
    page: { nextCursor: string | null; hasMore: boolean }
  }
}

type OperationalHistoryEvent = {
  id: string
  kind: 'checklist_completed' | 'acknowledgement' | 'task_assigned' |
    'task_resolved' | 'visit_plan_revised'
  occurredAt: string
  title: string
  detail: string | null
  actorSnapshot: {
    displayName: string | null
    roleLabel: string | null
    assignmentLabel: string | null
    identityStatus: 'captured' | 'historical_projection' | 'unknown'
  }
  details: Array<{ label: string; value: string }>
}
```

The response MUST exclude comments, personnel details, identifiers and business
payloads not explicitly required by the accepted drawer.

## 7. Edge cases

- **EC-1:** Region Manager has multiple allowed regions: region selection MUST
  come from the scoped regions response, never the first visible store row.
- **EC-2:** Selected filters return zero rows while the role still has regions:
  weekly planning remains addressable for a valid selected region.
- **EC-3:** Plan revision changes during editing: PUT returns `409`, the draft is
  preserved and the user is offered a refresh/reconcile path.
- **EC-4:** Midnight in `Europe/Istanbul`: waiting/missed transition uses the
  server's local-day contract, not browser timezone.
- **EC-5:** A store appears two or three times in a week on different days:
  every item remains visible and saveable.
- **EC-6:** More than one page of stores/history: navigation/load-more does not
  lose filters, selected store, focus or scroll position.
- **EC-7:** Historical actor is unavailable: render `Bilinmiyor`/historical
  projection; never substitute the current manager.
- **EC-8:** Partial aggregate fields are null: render a truthful placeholder and
  partial-data notice without converting null to zero or `YapÄ±lmadÄ±`.
- **EC-9:** Persisted old deep link enters after cutover: normalize into a new
  overlay/view or show a new-surface not-found state; never mount legacy UI.
- **EC-10:** API returns 401/403: clear protected cached data and render the
  correct new-surface unauthorized state.
- **EC-11:** Mobile software keyboard opens inside planner/history/session:
  focused fields and sticky primary actions remain reachable.
- **EC-12:** Reduced-motion is enabled: liquid toggle and overlay transitions
  are disabled without losing state feedback.
- **EC-13:** A filter request is slow or fails after prior data loaded: current
  rows remain visible during the request; success swaps the result atomically,
  while failure retains the prior result and exposes a retryable inline error.

## 8. Acceptance criteria

- **AC-1 [FR-1, FR-10, NFR-8]:** Given every supported role and legacy query
  parameter, when `/store/checklists` renders, then no legacy page component,
  selector, duplicate toolbar or legacy lazy chunk is present.
- **AC-2 [FR-2, FR-12, NFR-1]:** Given deterministic Region Manager data, when
  the four acceptance viewports are captured, then visits, plan and records
  match prototype geometry/copy/state and pass visual thresholds.
- **AC-3 [FR-3, NFR-4]:** Given Report Viewer company A, when regions are
  expanded, then only company A data and weekly readback appear and every
  mutation request/control is unavailable.
- **AC-4 [FR-4, NFR-4]:** Given Store Manager store X, when the page and history
  open, then only store X appears and store Y API access is rejected.
- **AC-5 [FR-6, EC-3, EC-4, EC-5]:** Given a weekly draft with the same store on
  different days, when it saves, then one atomic revision is created; exact
  same-day duplicates fail; stale saves preserve the draft; outcomes match
  real Istanbul-local completions.
- **AC-6 [FR-7, EC-6, EC-7]:** Given more than one history page, when older
  events load and a detail opens/closes, then order, actor-time truth, cursor,
  scroll and focus are preserved.
- **AC-7 [FR-8]:** Given authorized draft/resume/complete/result/acknowledge/task
  flows, when each is executed from Command Canvas, then existing API behavior
  is preserved and the user never enters the old page.
- **AC-8 [FR-11, EC-8, EC-10]:** Given loading, empty, retryable error,
  forbidden and partial responses for each role/view, then the matching
  new-surface state is rendered with no leaked stale data.
- **AC-9 [NFR-2, NFR-3, NFR-5]:** Given 1, 20, 35 and 200 stores plus long
  history, when desktop/tablet/mobile and keyboard tests run, then no page
  overflow, trapped focus, unreachable action or fixed-30 assumption exists.
- **AC-10 [FR-9, FR-10]:** Given every repository deep-link producer, when the
  cutover inventory runs, then producers use the new contract and an `rg`/bundle
  audit finds no executable legacy checklist page dependency.
- **AC-11 [FR-12, NFR-1]:** Given rows with a missed visit, when desktop,
  tablet and mobile views render, then the missed-status pill stays within its
  assigned cell, uses the compact status type scale and does not change row
  height relative to another one-line status.
- **AC-12 [FR-13, NFR-9, EC-13]:** Given a populated table, when a metric,
  status, sort or column control is selected under delayed-network conditions,
  then the page shell and rows do not disappear or flash, focus is preserved,
  column changes are immediate, and server-backed changes replace rows only
  after the response succeeds.
- **AC-13 [FR-6, FR-7, NFR-6, NFR-7]:** Given 200 scoped stores and multiple
  history pages, when command, Plan and history contract tests run, then all
  authoritative values come from the allowlisted server source, query budgets
  pass and no N+1 or client fetch-all behavior appears.

## 9. Remaining delivery train

**Execution decision (2026-07-14):** live-code inspection found the legacy
route owns roughly 780 lines of coupled request, cache, mutation, session and
render behavior. The plan's split rule is therefore active: P1 is delivered as
P1A extraction plus P1B overlay, producing an eight-PR train. P1A must remain a
behavior-preserving ownership refactor. P1B may start only after the complete
P1A equivalence suite is green and merged.

### PR P1A - Command workflow controller extraction (R3)

- First extract checklist start/save/autosave/complete, result,
  acknowledgement, cache invalidation and dirty-close behavior from
  `StoreChecklistsLegacyPage` into feature-owned controller hooks.
- At an internal checkpoint, keep legacy rendering and prove the complete old
  request sequence, permission negatives and session/result tests remain green.
  Overlay work MUST NOT begin if this checkpoint fails.
- P1A ends at this checkpoint and keeps legacy rendering. It changes no route,
  API, authorization, request sequence, mutation or visible behavior.

### PR P1B - Command workflow overlay cutover (R3)

- Open the same workflows above Region Manager Command Canvas and add a
  canonical route-state contract plus compatibility parser for old
  `view/tab/result/status/storeId` links. Normalized links MUST NOT mount legacy
  DOM.
- Global producer migration waits for P7 because Store Manager and VM surfaces
  are not ready in P1. No API/auth semantic change is allowed.
- P1B begins only from the merged P1A SHA and must prove overlay equivalence
  independently before any later legacy deletion work.

### PR P2 - Full-period Plan read model and candidate search (R3 API)

- Add region+period full-scope Plan metrics/badge and server-filtered rows with
  risk, reason, current plan, real completion, search, sort and pagination.
- Add bounded server-paged store candidate search for the weekly dialog; remove
  the need to download all stores client-side.
- No schema, mutation, UI or legacy deletion. Prove cross-scope negatives,
  generated OpenAPI sync and 30/200-store query budgets.

### PR P3 - Exact weekly and full-period Plan UI (R2/R3)

- Preserve then rebase the current dirty planner after P2; do not merge its
  partial state independently.
- Use stable explicit region context, date-then-three-view liquid switch,
  correct full-scope badge/metrics, weekly board, Plan toolbar/table/pagination
  and edit/replan drawer.
- Use server-paged candidates, one stable idempotency key per submitted
  snapshot and explicit `409` compare/refetch/reapply recovery.
- Waiting/missed cards edit/replan; only completed evidence opens the result.
- Correct the oversized missed-visit status and eliminate metric/filter/column
  flashes using retained query data, atomic result swaps and local column state.
- Verify failure/403/409, dirty Escape/backdrop, multi-region, empty/partial,
  long names, 35/200 stores, focus/mobile keyboard and all acceptance viewports.

### PR P4 - Operational History contract and API (R4 read-only)

- First inventory checklist completion, acknowledgement, task opened/resolved
  and weekly-plan revision sources and lock the privacy allowlist, cursor,
  actor-time truth, stable ordering and query budgets as an internal checkpoint.
- Then implement scoped summary plus cursor-paginated 20/+20 timeline and
  generated OpenAPI types. Run adversarial auth/privacy/performance review.
- No UI, DML or DDL is allowed. If actor snapshots require schema work, P4
  stops and a separate R5 schema PR is added, making the train eight PRs.

### PR P5 - Region Manager records and Report Viewer read surfaces (R3)

- Add the Region Manager third liquid tab, four record metrics,
  search/sort/server pagination, accepted store list, 650px drawer/full-screen
  mobile behavior, event filters, 3/6/12/all period, month groups, +20 loading
  and nested event detail.
- Add the Report Viewer company header/breadcrumb, four full-scope filter
  metrics, sortable region-manager accordion, lazy store pages, weekly readback
  and the shared history drawer.
- Both surfaces are read-only for history/plan mutation. Report Viewer mutation
  request count MUST be exactly zero; one expanded region MUST NOT trigger N+1
  reads for every other region.
- Use real history only and complete role-separated loading/empty/error/
  forbidden/partial, focus, scroll, long-content and screenshot evidence.

### PR P6 - Store Manager exact role surface (R3)

- Implement own authorized store metrics, current-control and Living Store
  Record cards/drawer with existing allowed acknowledgement/task behavior.
- If multiple managed stores are legal, use explicit authorized selection;
  never infer scope from the first returned item.
- Do not expose plan maintenance, other stores or region/company aggregates.

### PR P7 - VM resolution, atomic legacy removal and closeout (R3)

- Resolve the VM visual contract: preserve its assigned-store execution in the
  Command style or record an explicit owner-approved visual exception. Do not
  invent an unapproved role surface.
- Route every authorized persona and deep link to the new surface.
- Delete `StoreChecklistsLegacyPage`, routing predicates, orphan modules,
  helpers, tests, selectors, CSS and imports; retain the bounded link parser for
  one documented deprecation window without legacy rendering.
- Migrate all remaining Store Home, workflow inbox and action/task producers to
  canonical links, while retaining the bounded compatibility parser for one
  documented deprecation window without legacy rendering.
- Run bundle/import/selector/deep-link audits, all persona/behavior suites,
  exact parity, real-device checks, canonical affected-scope release and
  post-merge production smoke.
- No feature flag, hidden page or dormant legacy chunk remains.

P1A depends on current `main`; P1B depends on merged P1A. P2 and P4 may be
prepared independently. P3 depends on P2, P5 depends on P3+P4, P6 depends on
P1B+P4+P5, and P7 depends on P1A-P6 plus the VM decision and real-device
evidence.

Each PR MUST be squash-merged, independently green and reversible. While checks
run, only genuinely independent work may proceed in a separate worktree; two
full release suites MUST NOT run concurrently. GitHub Codex review remains
disabled.

## 10. Verification and evidence matrix

Every UI PR MUST produce deterministic screenshots at 1440x900, 1024x768,
390x844 and 320x844 for its changed views. P7 MUST additionally verify:

- Region Manager: visits, plan, planner dialog, records, history detail,
  session and result.
- Report Viewer: collapsed/expanded region, weekly readback and history.
- Store Manager: own-store ready/empty/partial/history states.
- Loading, empty, retryable error and forbidden for every role family.
- Keyboard-only overlay lifecycle and reduced motion.
- Real iOS Safari and Android Chrome: planner, 35+ store list, long history and
  Focus Dock.
- API scope negatives, OpenAPI drift, accessibility scan, horizontal overflow,
  bundle orphan audit and canonical affected-scope release.

No screenshot may be regenerated merely to accept unexplained drift. Prototype
and production screenshots MUST be presented side by side with a written delta
disposition.

## 11. Rollback

- P1-P6 rollback is the revert of that isolated squash commit; additive schema
  and immutable audit/history data are preserved.
- P7 rollback is redeployment/revert to the last verified pre-cutover SHA.
- The final codebase does not keep legacy UI as a runtime fallback.
- Visit-plan writes may be disabled independently if data integrity is at risk;
  the read-only Command Canvas remains available.

## 12. Stop rules

Stop and return to `sokrates.md` if any of the following occurs:

- role scope, mutation authority or company/region/store ownership is
  ambiguous;
- history would expose non-allowlisted personnel or business data;
- a visit outcome cannot be tied to real completed checklist evidence;
- visual parity requires breaking current authorization/data semantics;
- a migration/API rollback path or production-safe deployment SHA is missing;
- P1 workflow behavior equivalence is not green, in which case legacy deletion
  and final cutover MUST NOT start;
- the VM visual contract is unresolved, in which case P7 MUST stop before
  deleting the last compatible execution surface.

## 13. Out of scope

- Prototype role/comparison switchers and all fixture data.
- A fixed 30-store limit.
- New checklist scoring rules, risk rules or due-date/SLA invention.
- Replacing the separate admin snapshot reporting route.
- Historical identity backfill without authoritative data.
- Broad unrelated UI redesign, mobile native application work or new provider
  integrations.

## 14. Definition of done

The goal is complete only when P1A, P1B and P2-P7 are merged, post-merge verification is
green, production smoke is green, real-device evidence is recorded, the
accepted parity matrix has no unexplained delta and repository/bundle/DOM
audits prove the old checklist UI no longer exists.
