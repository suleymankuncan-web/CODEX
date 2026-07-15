# Store Incentives and Targets Command Canvas Production Cutover Plan v1

Status: Owner-requested implementation plan. Not implementation authority.

Date: 2026-07-15

Plan owner: HR Axis Store Operations

Target routes:

- `/store/incentives`
- `/store/targets`

Accepted prototype sources:

- `D:\hr-axis-external-lab\prototypes\incentives-command-canvas-v1`
- `D:\hr-axis-external-lab\prototypes\store-targets-command-canvas-v1`

Production repository: `D:\store-ops-workspace`

## 1. Executive decision

This is one master plan for two production pages. It is not a visual reskin and it is not a request to place the Labs applications inside production.

The outcome is a complete route cutover:

1. The accepted Incentives prototype becomes the only production presentation for `/store/incentives` within the real Store shell.
2. The accepted Targets prototype becomes the only production presentation for `/store/targets` within the real Store shell.
3. Every visible value, hierarchy, state and action is backed by authorized production API data or an explicitly documented deterministic derivation.
4. The former route-specific UI, obsolete CSS, fixture controls and diagnostic prototype routes are deleted after replacement.
5. The Labs role switchers, sample people, sample stores and duplicated sidebar are never copied into production.

Completion wording is binary:

- `Prototype parity: PASS`, or
- the plan is not complete.

"Yakın", "benzer" or "işlevsel olarak aynı" is not sufficient.

## 2. Sokrates decision record

### 2.1 Claim

The prototypes can become production truth only if their visual contracts and their missing read contracts are implemented together, while the existing write invariants remain unchanged.

### 2.2 Repository evidence

- The production Store shell already owns the 264 px desktop sidebar, responsive mobile navigation, route loading and authorization boundary.
- `StoreIncentivesPage.tsx` currently selects a Region Manager view only for `roleScope === 'region'`; all other returned projections use the former Store Manager presentation.
- `storeIncentiveRoles` currently contains only `REGION_MANAGER`.
- `GET /api/store/incentives` currently permits only `STORE_MANAGER` and `REGION_MANAGER`.
- The current Report Viewer persona test intentionally treats `/store/incentives` as forbidden.
- Current incentive projection rows do not provide the complete company -> Region Manager -> store hierarchy required by the accepted prototype.
- Current correction audit data exposes an actor user ID but not safe actor display metadata.
- The accepted Incentives prototype presents selectable rate bands, while historical correctness depends on the effective backend rate-table version.
- Targets already supports real create, approve, adjusted approve, revision and reference supersession workflows.
- Current Targets requests and coverage responses cannot by themselves prove every authorized company store, including a store with no request and no targetable personnel.
- Current Targets responses do not provide the complete Region Manager display hierarchy required by the accepted Report Viewer prototype.
- The current Targets request fetch uses a bounded 200-row slice. It cannot be used to infer all historical approved-month indicators.
- Both production route files and several supporting components are already large. Adding another presentation branch inside them would increase ownership ambiguity.
- Four legacy Targets CSS imports remain global in `admin-web/src/index.css`.
- An internal Incentives prototype shell and route are still present in production source.

### 2.3 Counterargument considered

The pages could be changed quickly by copying Labs TSX and CSS, continuing to use the current APIs and filling unavailable values on the client.

Rejected because this would:

- duplicate the Store shell;
- ship fixture assumptions;
- infer company hierarchy and historical approval from incomplete data;
- risk making Report Viewer appear authorized without a safe backend scope;
- hard-code business rate bands;
- retain both old and new UI paths;
- create visual parity without product truth.

### 2.4 Risk classification

Overall risk is R5 because the complete line includes:

- an authorization expansion for Report Viewer Incentives reads;
- two new or extended backend read projections;
- existing R4 Incentives and Targets write workflows;
- two full user-facing route replacements;
- deletion of legacy UI owners.

Individual PRs remain R1-R3 where possible. No PR may silently inherit the master plan's full scope.

### 2.5 Reversibility

- New read contracts are additive until the new routes are proven.
- Existing write endpoints and payloads remain stable.
- UI cutovers are isolated by route and squash-revertable.
- Legacy deletion occurs only after both replacement routes have passing evidence.
- No database migration, DDL, DML, provider mutation or production operation is authorized by this plan.

### 2.6 Decision

Proceed through seven independently mergeable PRs. Do not combine both pages, authorization, APIs, UI cutover and deletion into one PR.

## 3. Authority and non-authority

This document defines an executable implementation sequence after separate owner authorization to start.

This plan does not authorize:

- staging or production deployment;
- production or staging data mutation;
- database migration, DDL or DML;
- provider changes;
- broad production enablement;
- a new Incentives Store Manager capability;
- changing Target lifecycle, revision, supersession or approval rules;
- changing Incentive calculation or package approval rules.

If implementation discovers that parity requires one of these changes, stop and return to the owner with evidence.

## 4. Design read and product standard

Reading this as: a full redesign of two dense Store Operations command surfaces for operational managers and company viewers, with a compact premium SaaS language inside the existing HR Axis Store design system.

Quality dials for implementation review:

- Design variance: 4/10. The accepted composition is structured and operational.
- Motion intensity: 3/10. Motion is limited to state feedback, drawers, dialogs and focus transitions.
- Visual density: 7/10. Tables and metrics are compact, but mobile must remain readable.

The general taste skill explicitly excludes dashboards and data tables. Its landing-page composition rules are not applied mechanically here. Only its relevant redesign safeguards apply:

- audit before replacement;
- preserve real navigation, brand, content semantics and accessibility;
- one color and radius system;
- no decorative motion;
- complete loading, empty, error and unauthorized states;
- no generic fixture content in production;
- no hand-rolled icons;
- no new design system dependency.

The binding UI rules are:

- `hr-axis-prototype-standard`;
- `hr-axis-ui-refactor`;
- existing Store shell tokens and primitives;
- Lucide, because it is already the production icon family;
- existing Radix/shadcn-owned primitives;
- Manrope and DM Sans as already configured by HR Axis.

## 5. Source-of-truth hierarchy

When evidence conflicts, use this order:

1. Current authorization, API and database behavior.
2. Current approved decisions in `current-state.md` and `sokrates.md`.
3. Accepted Labs prototype interaction and visual behavior.
4. This plan's explicit mappings and acceptance criteria.
5. Older plan documents and stale screenshots.

The prototype is authoritative for presentation and interaction. It is not authoritative for identity, permissions, money, status, dates, rates or business state.

## 6. Shared cutover contract

### 6.1 Production shell

- Use the existing `StoreShell` and `StoreSidebar`.
- Do not copy Labs shell markup, sample persona chip, sample nav state or duplicated logo.
- Preserve the production route registry and route preloading behavior.
- Preserve the real mobile Store navigation.
- The accepted prototype content begins inside the production `store-command-main` content area.
- Route content must remain stable at the production shell widths, including the Incentives minimum-width policy.

### 6.2 Visual parity

The following must match the approved prototype at the reference viewports:

- the 1120 px maximum desktop content canvas and its responsive gutters;
- layout order;
- content width and horizontal rhythm;
- header size, spacing and alignment;
- top action alignment;
- four metric-card dimensions, borders, tone and icon placement;
- search, filters, tabs and period popovers;
- column proportions and sorting labels;
- accordion, drawer and dialog geometry;
- badge tone and copy;
- empty, loading and error composition;
- mobile record-card transformation;
- typography family, size, weight and line-height;
- responsive breakpoints and stacking order.

Do not copy raw Labs hex values or selectors into TSX. Translate them to production semantic tokens. A parity manifest records the mapping.

### 6.3 Interaction parity

- Metric clicks filter locally without a route reload or blank page.
- Column sorting updates locally without a loading flash.
- Search and local status filtering retain the last complete server result.
- A period change may fetch server data, but the previous result remains visible with a subtle updating state.
- Popovers close on Escape, outside click and selection, then restore focus.
- Drawers and dialogs trap focus, close on supported paths and restore focus to their opener.
- Long drawers scroll internally while the page body remains locked.
- Touch targets are at least 44 by 44 CSS pixels.
- Mobile form controls use at least 16 px text to prevent browser zoom.
- No interaction requires hover.

### 6.4 Truthful state contract

- `null`, unavailable and partial are not converted to zero.
- No missing name is replaced with a fabricated person.
- No absent status is inferred from a date.
- No current rate table is applied to a historical period unless the backend proves the version.
- Every success badge represents persisted or mutation-confirmed state.
- Optimistic state must roll back on a failed mutation.
- Partial query failure preserves successful sections and shows a scoped warning.

### 6.5 Role precedence

Mixed-role presentation follows the highest read-scope persona:

1. Report Viewer presentation wins over Region Manager and Store Manager.
2. Region Manager presentation wins over Store Manager.
3. Store Manager presentation is limited to its own authorized store.

Write capabilities are not inherited from the winning read presentation. Every mutation remains guarded by the real action scope and endpoint authorization.

## 7. Incentives accepted production contract

### 7.1 Region Manager presentation

The production route must provide:

- title `Prim Kontrol Merkezi`;
- one month/year period picker;
- an `Onaya gönder` action aligned with the period picker;
- readiness microcopy under the action;
- four metric cards for final period total, pending store reviews, noted corrections and completed store reviews;
- metric-driven filtering;
- store/person search;
- status filtering;
- tabs for store review, corrections and effective rate bands;
- store accordion rows;
- personnel rows with role, target, actual, achievement, rate, calculated incentive and post-correction incentive;
- green achievement treatment at or above 80 percent and red below 80 percent;
- correction amount delta as a signed value;
- a correction drawer with safe rate choices, direct final amount entry and mandatory correction note;
- review state update with existing optimistic rollback behavior;
- package submission confirmation with real aggregate data.

### 7.2 Report Viewer presentation

The production route must provide:

- company-scoped title and read-only badge;
- four company metrics backed by the read projection;
- company -> Region Manager -> store hierarchy;
- Region Manager aggregate row and expandable store list;
- personnel incentive detail;
- a read-only correction record drawer containing real calculated amount, corrected amount, signed delta, effective rate, note, safe actor display metadata and timestamp;
- no review, correction, void or submission control;
- no callable mutation path from the component tree.

### 7.3 Store Manager non-goal

The accepted Incentives prototype contains Region Manager and Report Viewer presentations only. Current Store Manager Incentives rendering is not activated or redesigned by this plan.

If product ownership later authorizes Store Manager Incentives, it requires a separate accepted prototype and plan. This cutover must not expose the currently hidden route to Store Manager.

### 7.4 Incentives real-data mapping

| Prototype element | Authoritative source | Derivation rule | Missing/partial behavior |
|---|---|---|---|
| Period | workspace response `period` | Istanbul business month only where current domain already does so | show unavailable, never current-browser guess after response |
| Store identity | workspace store ID/name/code/city | none | honest missing metadata label |
| Region and manager | workspace region projection | server-scoped | `Atanmamış` only when backend explicitly returns no manager |
| Target | incentive row target | none | unavailable, not zero |
| Actual | `actualPositiveSales` | none | unavailable, not zero |
| Achievement | target and actual | use existing domain rounding | unavailable when denominator is absent or non-positive |
| Effective rate | incentive row plus effective table version | backend-versioned | unavailable if the version cannot be resolved |
| Calculated incentive | existing raw/payable amount rule | reuse existing production model | unavailable, not recomputed with fixture math |
| Post-correction incentive | persisted Region Manager correction/final amount | existing effective amount rule | show no change when correction is absent |
| Correction note | persisted sanitized correction audit | none | `Not bulunmuyor` only when genuinely null |
| Correction actor | new sanitized display metadata | never display raw user ID | `Kayıt sahibi bilgisi yok` |
| Store review | existing region workflow review | none | explicit unknown/partial state |
| Package status | existing region workflow/package data | none | submission disabled while incomplete |
| Rate-band tab and buttons | new effective rate-table metadata | exact selected period version | disable correction shortcuts if unresolved |

## 8. Targets accepted production contract

### 8.1 Region Manager presentation

The route must provide:

- title `Hedef Kontrol Masası`;
- upper viewed-period month/year picker;
- four metric cards for total target, approved stores, pending decisions and stores waiting for a target;
- search and status filters;
- sortable store, target, distributed amount, personnel and status headings;
- all authorized stores, including stores with no request;
- no legacy operation column;
- a fully clickable store row;
- accurate `Onay bekliyor`, `Hedef bekleniyor`, `Onaylandı`, `Düzenlenerek onaylandı`, `İade edildi` and revision states;
- a store drawer with target, allocation, balance, personnel and request/decision note;
- inline personnel allocation editing only when the current request is editable by Region Manager;
- approval only when real backend invariants pass;
- an explicit adjusted-approval result when values changed.

### 8.2 Report Viewer presentation

The route must provide:

- company target overview;
- company -> Region Manager -> all authorized stores hierarchy;
- expandable Region Manager accordions;
- real Region Manager aggregates;
- store rows and read-only target drawer;
- sorting and filtering within authorized results;
- no edit, approve, create or revision control;
- no callable mutation path.

### 8.3 Store Manager presentation

The route must provide:

- title `Mağaza Hedef Dağılımı`;
- upper `Görüntülenen dönem` month/year picker for reading history;
- a distinct lower `Hedef gönderilecek ay` month/year picker for creating or revising a target package;
- real per-month `Onaylı` indicators;
- store target, distributed total and remaining balance;
- authorized personnel with their real position labels;
- monthly allocation input for each person;
- percentage share derived from allocation and store target;
- an optional note that is sent with the request;
- disabled submission until server-compatible balance and personnel conditions pass;
- real pending, approved and revision history states;
- the existing TREF revision and supersession contract unchanged.

### 8.4 Targets real-data mapping

| Prototype element | Authoritative source | Derivation rule | Missing/partial behavior |
|---|---|---|---|
| Complete store list | new scoped workspace store universe | server-authorized | partial warning, never silently omit known page segment |
| Region/manager hierarchy | new workspace region projection | server-authorized | explicit unassigned group |
| Viewed period | route query and workspace response | independent read state | retain prior rows while fetching |
| Target-entry period | Store Manager form state | independent from viewed period | no implicit synchronization after user choice |
| Historical approval check | new monthly status summary | persisted approved/adjusted state only | no check when unresolved |
| Store target | request/approved reference | existing lifecycle precedence | `Hedef bekleniyor` when absent |
| Distributed total | real allocations | sum with existing money precision | unavailable on partial allocation data |
| Balance | store total minus allocations | same precision as backend validation | cannot submit when not zero |
| Personnel | store targeting personnel/read projection | active period eligibility | explicit empty state |
| Personnel role | new safe position label | none | `Görev bilgisi yok` |
| Request note | request reason | none | omit note panel if null |
| Approval note/mode | persisted approval evidence | none | do not infer adjusted mode from client draft alone |
| Status | request and coverage lifecycle | shared pure mapper | unknown status is visible and non-actionable |

## 9. Functional requirements

### 9.1 Shared requirements

- **SH-FR-001**: Production must use the existing Store shell and navigation.
- **SH-FR-002**: No Labs role switcher, fixture row, demo route or duplicated shell may ship.
- **SH-FR-003**: Each route must render exactly one presentation owner for the resolved persona.
- **SH-FR-004**: Metric filters, search, status filters and sort must not blank the current dataset.
- **SH-FR-005**: Month/year popovers must support keyboard, outside-click, Escape and focus restoration.
- **SH-FR-006**: Drawers and dialogs must support all close paths, focus trap, focus restoration and body-scroll lock.
- **SH-FR-007**: All lists must use server-bounded pagination or cursor behavior and must not assume 30 stores.
- **SH-FR-008**: Loading, empty, error, unauthorized and partial-data states must use the new visual language.
- **SH-FR-009**: Every visible value must have a mapping entry and a test.
- **SH-FR-010**: Existing production localization ownership must be preserved; new Turkish copy must have the required English counterpart where the route already localizes.

### 9.2 Incentives requirements

- **INC-FR-001**: Add a company-scoped, read-only Incentives workspace response for Report Viewer.
- **INC-FR-002**: Report Viewer scope must use the REPORT_VIEWER company role scope and fail closed.
- **INC-FR-003**: The workspace must include Region Manager, store and safe correction audit metadata required by the prototype.
- **INC-FR-004**: The workspace must expose effective rate-table metadata for the selected period.
- **INC-FR-005**: Region Manager must retain current review, correction, void and submission payloads and authorization.
- **INC-FR-006**: Rate-button selection may calculate a proposed final value only from the backend-versioned rate option and the real eligible sales base.
- **INC-FR-007**: Direct final amount editing must remain available where the current contract permits it.
- **INC-FR-008**: A correction note must satisfy the existing backend validation before submission.
- **INC-FR-009**: Report Viewer must be structurally unable to invoke Incentives mutation hooks.
- **INC-FR-010**: Store Manager must not gain route access through this plan.
- **INC-FR-011**: Package submission must use real readiness and aggregate state.
- **INC-FR-012**: The former internal Incentives prototype shell and diagnostic route must be deleted after parity.

### 9.3 Targets requirements

- **TGT-FR-001**: Add a scoped Targets workspace response that includes the complete authorized store universe.
- **TGT-FR-002**: The workspace must include Region Manager hierarchy and safe display names.
- **TGT-FR-003**: The workspace must include persisted month-status summaries for the period picker.
- **TGT-FR-004**: Region Manager rows must include stores with no request or targetable personnel.
- **TGT-FR-005**: Report Viewer must receive company-scoped read data and no write capability.
- **TGT-FR-006**: Store Manager viewed period and target-entry period must be independent states.
- **TGT-FR-007**: Only persisted approved/adjusted evidence may display an approved-month check.
- **TGT-FR-008**: Region Manager must retain assigned-store approval constraints.
- **TGT-FR-009**: Store Manager must retain own-store create/revision constraints.
- **TGT-FR-010**: Approval, adjusted approval, revision and TREF reference payloads must remain unchanged.
- **TGT-FR-011**: The former action column and former contract/tab presentation must not remain in the route.
- **TGT-FR-012**: Obsolete Targets CSS and component owners must be deleted after zero-reference proof.
- **TGT-FR-013**: The lower target-entry picker must use real semantic label and helper elements; the Labs pseudo-element copy workaround must not be copied.

## 10. Non-functional requirements

- **NFR-001 Accessibility**: WCAG 2.2 AA for contrast, keyboard, focus, semantics and status announcements.
- **NFR-002 Responsive**: no horizontal page overflow at 1440, 1024, 390 or 320 CSS px.
- **NFR-003 Query continuity**: previous complete data remains visible during background refetch.
- **NFR-004 Performance**: local filters and sorts do not trigger network requests; large list transformations are memoized.
- **NFR-005 Security**: read scope and action scope are tested independently. UI hiding is never authorization.
- **NFR-006 Privacy**: no raw UUID, credential, identity token or unsanitized business payload appears in UI or evidence.
- **NFR-007 Integrity**: money uses domain precision and no floating-point equality is used for write validity.
- **NFR-008 Maintainability**: route files are orchestration owners, not 800+ line mixed UI/domain modules.
- **NFR-009 Styling**: production semantic tokens and existing primitives replace raw prototype constants.
- **NFR-010 Observability**: existing mutation error reporting and user-facing action toasts remain intact.
- **NFR-011 Testability**: each derived metric/status/sort has a pure model test.
- **NFR-012 Rollback**: each cutover PR is independently squash-revertable.
- **NFR-013 Admin isolation**: `/admin/incentives` and `/admin/targets` behavior, navigation and write contracts remain unchanged.

## 11. Edge cases

- **EC-001**: Report Viewer has a company scope but no regions.
- **EC-002**: A region exists with no assigned Region Manager.
- **EC-003**: A Region Manager has more than 30 stores.
- **EC-004**: A company result spans more than one server page.
- **EC-005**: A store has no targetable personnel.
- **EC-006**: A store has personnel but no target request.
- **EC-007**: A target request is pending, returned, adjusted-approved, stale or in revision conflict.
- **EC-008**: The viewed target month differs from the target-entry month.
- **EC-009**: A past month has no persisted approval summary.
- **EC-010**: Incentive target or actual is null.
- **EC-011**: Incentive target is zero and achievement cannot be calculated.
- **EC-012**: A correction is voided, returned or admin-approved.
- **EC-013**: Correction actor display metadata cannot be resolved.
- **EC-014**: Historical rate-table version cannot be resolved.
- **EC-015**: One workspace section fails while another succeeds.
- **EC-016**: A mutation fails after optimistic state was displayed.
- **EC-017**: Mixed Report Viewer and Region Manager session.
- **EC-018**: Mobile browser opens a numeric input without zooming the whole page.
- **EC-019**: Drawer content exceeds the viewport height.
- **EC-020**: A long Turkish store/person name wraps.
- **EC-021**: No result matches a local filter while server data exists.
- **EC-022**: A user attempts a cross-company or cross-region read URL directly.

## 12. Implementation architecture

### 12.1 Shared production primitives

Create or extend feature-owned primitives only when both pages need the exact same behavior:

- command page header;
- aligned action cluster;
- metric filter card;
- month/year picker behavior;
- search/filter command bar;
- sortable text heading;
- responsive data-list shell;
- operational drawer shell;
- confirmation dialog shell;
- partial-data notice.

Do not create a generic abstraction for page-specific row, calculation or workflow behavior.

### 12.2 Incentives ownership

Move orchestration, view models and presentations under a feature-owned Incentives command workspace. Keep:

- API contracts and query identity in `features/incentives`;
- pure aggregation and status functions in testable model files;
- persona presentations in separate Region Manager and Report Viewer components;
- mutation hooks outside read-only Report Viewer components;
- drawer state at the nearest route/workspace owner.

### 12.3 Targets ownership

Move orchestration, view models and presentations under a feature-owned Targets command workspace. Keep:

- existing Target API and mutation contracts stable;
- shared lifecycle mapping in one pure model;
- Region Manager, Report Viewer and Store Manager presentations separate;
- viewed period and target-entry period in separate state owners;
- TREF revision construction in its current tested domain owner.

### 12.4 File-size guard

- Do not add new behavior to an existing file already over 700 lines without extracting ownership first.
- Prefer one component/model responsibility per file.
- A route page should remain a query, capability and presentation coordinator.
- CSS must be feature-scoped and split by stable layout responsibility, not accumulated in another 1,000-line file.

## 13. Seven-PR execution train

### PR 1 - Incentives read workspace contract

Risk: R3

Scope:

- Add an additive, role-aware Incentives workspace read contract.
- Permit REPORT_VIEWER only on the new read path.
- Resolve company scope from REPORT_VIEWER role scope and fail closed.
- Return complete region, Region Manager, store, package/review and row projection needed by the prototype.
- Return sanitized correction actor display metadata.
- Return effective period rate-table metadata.
- Return explicit capabilities.
- Report Viewer capabilities contain no review, correction, void or submission action.
- Preserve all existing GET and POST endpoint behavior.

Tests:

- Report Viewer positive company scope.
- Empty company scope.
- Cross-company negative read.
- Mixed-role Report Viewer precedence.
- No mutation authorization for Report Viewer.
- Historical rate-table version resolution.
- Missing actor metadata sanitization.
- OpenAPI generation and client type contract.

Exit gate:

- Every Incentives prototype value has a real field or honest nullable rule.
- No write endpoint or existing payload changed.

### PR 2 - Targets read workspace contract

Risk: R3

Scope:

- Add an additive, role-aware Targets workspace read contract.
- Return every authoritative store in scope, including missing-target stores.
- Return company, region and Region Manager hierarchy.
- Return real period status summaries.
- Return safe personnel position labels required by the drawer.
- Keep pagination bounded and deterministic.
- Preserve current request, coverage, personnel, revision, create and approve contracts.

Tests:

- Store Manager own-store read.
- Region Manager assigned-store read.
- Report Viewer company read.
- Cross-scope negative reads.
- Store with no request and no targetable personnel.
- Multi-page store universe.
- Persisted approved/adjusted month summary.
- Unknown month status.
- OpenAPI generation and client type contract.

Exit gate:

- Store completeness and approved-month marks do not depend on client inference or a 200-request slice.

### PR 3 - Shared production Command Canvas foundation

Risk: R2

Scope:

- Add shared production primitives listed in section 12.1.
- Add deterministic parity fixtures under test ownership only.
- Add the prototype source/capture digest manifest.
- Add visual reference harnesses inside the real Store shell.
- Establish responsive, focus and query-continuity tests.

Must not:

- change business workflows;
- copy the Labs shell;
- expose a fixture route in production;
- introduce raw prototype CSS globally;
- add another icon or component library.

Exit gate:

- Shared primitives reproduce the approved geometry in isolation and pass accessibility tests.

### PR 4 - Incentives complete production cutover

Risk: R3

Scope:

- Replace `/store/incentives` with the accepted Region Manager and Report Viewer presentations.
- Integrate the PR 1 read workspace.
- Preserve current Region Manager mutations, optimistic rollback and action toasts.
- Add rate selection bound to effective rate metadata.
- Add read-only Report Viewer hierarchy and correction drawer.
- Implement all Incentives states and responsive layouts.
- Remove the internal `command-v2`/prototype route, shell and fixture owners.
- Remove replaced Incentives legacy view/style owners after import proof.

Exit gate:

- Incentives prototype parity passes at all viewports and personas.
- Store Manager remains unexposed.
- Report Viewer produces zero mutation requests.

### PR 5 - Targets Region Manager and Report Viewer cutover

Risk: R3

Scope:

- Replace Region Manager and Report Viewer branches of `/store/targets`.
- Integrate the PR 2 workspace.
- Render clickable store rows with no action column.
- Implement complete company hierarchy for Report Viewer.
- Preserve Region Manager allocation edit and approval behavior.
- Implement all status, sort, filter, pagination, partial and mobile states.

Exit gate:

- Region Manager cannot act outside assigned stores.
- Report Viewer has no write controls or mutation path.
- All authorized stores appear, including `Hedef bekleniyor` stores.

### PR 6 - Targets Store Manager cutover

Risk: R3

Scope:

- Replace the Store Manager branch with the accepted distribution workspace.
- Separate viewed period and target-entry period state.
- Render real approved-month indicators.
- Preserve existing create, revision, supersession and TREF payloads.
- Implement real balance validation and optional submission note.
- Implement approved history and pending/revision states.

Exit gate:

- Changing either period selector does not silently change the other.
- No date-based fake approval state exists.
- Existing lifecycle tests remain green.

### PR 7 - Legacy removal and parity closeout

Risk: R2

Scope:

- Produce and execute an explicit deletion manifest.
- Delete replaced Targets command/contract components.
- Delete `store-targets-prototype*` and obsolete command CSS only after zero-reference proof.
- Remove stale global CSS imports.
- Remove tests that only preserve former UI and replace them with parity contracts.
- Run built-bundle and selector audits.
- Capture controlled-pilot evidence with real authorized personas.
- Update `current-state.md` only after all gates pass.

Exit gate:

- No old route UI owner, selector, style import, fixture control or diagnostic route remains.
- `Prototype parity: PASS` is recorded for both routes.

## 14. Acceptance criteria

### 14.1 Shared Given/When/Then

- **AC-001**: Given an authorized user opens either route, when the page renders, then it uses the real Store shell and contains no Labs shell or role switcher.
- **AC-002**: Given a complete dataset is visible, when a metric, search, status or sort control changes, then the page does not blank and no unrelated network request is emitted.
- **AC-003**: Given a period fetch is in progress, when prior data exists, then prior rows remain visible with an updating indicator.
- **AC-004**: Given a popover, drawer or dialog is open, when Escape or the supported close action is used, then it closes and focus returns to the opener.
- **AC-005**: Given a 320 px viewport, when the route and its longest overlay render, then `scrollWidth <= clientWidth` and all actions remain reachable.
- **AC-006**: Given partial API failure, when one section remains valid, then valid content remains visible and only the failed section reports an error.
- **AC-007**: Given an unauthorized direct route or cross-scope request, when it is attempted, then it fails closed and renders no protected data.
- **AC-008**: Given either Store cutover is merged, when the corresponding Admin route is exercised, then its navigation, response handling and write workflow remain unchanged.

### 14.2 Incentives Given/When/Then

- **AC-INC-001**: Given a Region Manager opens Incentives, when data loads, then the header, metrics, toolbar, tabs, stores and totals match the accepted prototype using real data.
- **AC-INC-002**: Given a store review is pending, when it is marked reviewed and the request succeeds, then readiness updates without a full-page reload.
- **AC-INC-003**: Given a correction rate is selected, when the selected period has a resolved rate table, then the proposed final amount uses that exact version and eligible sales base.
- **AC-INC-004**: Given a correction mutation fails, when optimistic state was shown, then the former state returns and an actionable error appears.
- **AC-INC-005**: Given a Report Viewer opens Incentives, when company data loads, then Region Managers, stores and rows render as a read-only hierarchy.
- **AC-INC-006**: Given a Report Viewer opens a corrected person, when the drawer renders, then the real note and sanitized audit data are visible and no input or save action exists.
- **AC-INC-007**: Given a Report Viewer session, when every Incentives interaction is exercised, then zero POST/PUT/PATCH/DELETE requests are emitted.
- **AC-INC-008**: Given unresolved historical rate metadata, when the correction drawer opens, then rate shortcuts are disabled and no current-period rate is substituted.
- **AC-INC-009**: Given a Store Manager session, when `/store/incentives` is opened, then the route remains unavailable and no protected Incentives request is made.

### 14.3 Targets Given/When/Then

- **AC-TGT-001**: Given a Region Manager opens Targets, when data loads, then all assigned stores appear, including a store with no request.
- **AC-TGT-002**: Given a pending store row is clicked, when the drawer opens, then real allocations can be edited and approval remains subject to existing backend rules.
- **AC-TGT-003**: Given a Report Viewer opens Targets, when data loads, then company results group by real Region Manager and remain read-only.
- **AC-TGT-004**: Given a Store Manager changes the upper viewed period, when the request completes, then history changes but the lower target-entry period is unchanged.
- **AC-TGT-005**: Given a Store Manager changes the lower target-entry period, when the form updates, then the upper viewed period is unchanged.
- **AC-TGT-006**: Given a month is marked approved, when the marker is inspected, then a persisted approved or adjusted approval record backs it.
- **AC-TGT-007**: Given allocations do not match the store target at backend precision, when submission is attempted, then the action remains disabled or is rejected with preserved form state.
- **AC-TGT-008**: Given an approved basis is revised, when submitted, then the existing base reference IDs and removed employee IDs are preserved exactly.
- **AC-TGT-009**: Given a Report Viewer session, when every Targets interaction is exercised, then zero mutation requests are emitted.

## 15. Verification matrix

### 15.1 Automated tests

Backend:

- scope resolution unit tests;
- controller role tests;
- service/repository read projection tests;
- cross-company and cross-region negative tests;
- Report Viewer mutation rejection tests;
- pagination and deterministic ordering tests;
- rate-version and month-status truth tests;
- OpenAPI generation/check.

Frontend unit/component:

- persona precedence;
- metric derivations;
- status mapping;
- sort stability;
- null and partial formatting;
- independent Target period states;
- rate-option calculation;
- balance precision;
- optimistic rollback;
- focus restoration;
- legacy owner absence.

Playwright:

- Incentives Region Manager full workflow;
- Incentives Report Viewer read-only hierarchy;
- Incentives Store Manager negative route;
- Targets Region Manager approval and adjusted approval;
- Targets Report Viewer hierarchy and mutation silence;
- Targets Store Manager create and revision;
- refetch continuity;
- keyboard navigation and accessibility scan;
- long list and long drawer;
- mobile navigation and no zoom.

### 15.2 Visual reference viewports

For each applicable persona and both routes:

- 1440 x 900 desktop;
- 1024 x 768 compact desktop/tablet;
- 390 x 844 mobile;
- 320 x 844 narrow mobile.

Capture:

- default populated state;
- active metric filter;
- open period picker;
- open drawer;
- open confirmation dialog where authorized;
- loading skeleton;
- empty result;
- full error;
- unauthorized;
- partial data;
- 30+ store list or server-paginated equivalent;
- long person/store name;
- long correction/request note.

Reference rules:

- Capture the whole viewport including the real Store shell.
- Exclude Labs role switcher and fixture controls from the parity region.
- Compare deterministic test fixtures to a committed approved baseline.
- Key landmark bounding boxes may differ by no more than 1 CSS px at the same viewport and font environment.
- Pixel diff threshold is at most 0.5 percent after excluding dynamic timestamps and browser font antialias noise.
- Any intentional difference requires an entry in the parity manifest and owner approval.

### 15.3 Real-data controlled-pilot evidence

After local deterministic parity and before completion, capture sanitized controlled-pilot evidence for:

- Region Manager Incentives;
- Report Viewer Incentives;
- Region Manager Targets;
- Report Viewer Targets;
- Store Manager Targets.

Evidence must prove:

- the authenticated persona and scope class without exposing credentials;
- API response status and selected period;
- visible route state;
- write success only for authorized personas where safe evidence authority exists;
- zero mutation network requests for Report Viewer;
- no horizontal overflow at the tested mobile viewport.

Live action smoke is not implied by this plan. It requires the repository's existing smoke authority and safe test data.

### 15.4 Legacy deletion proof

Before PR 7 merges:

- list every deleted component and CSS file;
- prove no import owner with `rg` and the TypeScript build;
- prove no obsolete selector in source or built CSS;
- prove no internal prototype route in `App.tsx` or route registry;
- prove no role switcher or fixture seed in the production bundle;
- prove the two routes never render former page headings, tabs, action columns or panels;
- preserve shared Store shell and shared API consumers still in use elsewhere.

### 15.5 Canonical verification

For each PR:

1. Run targeted tests for the changed contract.
2. Run `git diff --check`.
3. Run `npm.cmd run test:scripts` when selected by affected scope.
4. Run the repository affected-scope selector.
5. Run only the canonical checks selected by repository policy.
6. Never run two full release suites concurrently.
7. Do not trigger GitHub Codex review.
8. While PR checks run, prepare only an independent next slice in a separate worktree.
9. Use squash merge for controlled PRs so post-merge release reuse remains available.

## 16. Traceability

| Plan slice | Requirements | Acceptance | Edge cases |
|---|---|---|---|
| PR 1 | INC-FR-001..004, 009 | AC-INC-005..008 | EC-001, 002, 012, 013, 014, 017, 022 |
| PR 2 | TGT-FR-001..007 | AC-TGT-001, 003, 006 | EC-001..009, 015, 017, 022 |
| PR 3 | SH-FR-001..010 | AC-001..007 | EC-003, 004, 015, 018..021 |
| PR 4 | INC-FR-005..012 | AC-INC-001..009 | EC-010..020 |
| PR 5 | TGT-FR-004, 005, 008, 011 | AC-TGT-001..003, 009 | EC-001..007, 015..022 |
| PR 6 | TGT-FR-006..010 | AC-TGT-004..008 | EC-005..009, 015, 016, 018..021 |
| PR 7 | SH-FR-002, TGT-FR-012..013 | all parity gates | all |

## 17. Stop conditions

Stop and report evidence if any of these occurs:

- complete company, Region Manager or store hierarchy cannot be proven;
- rate-table version, correction actor or monthly approval truth remains unavailable;
- Report Viewer negative authorization or mutation-silence test fails;
- Store Manager Incentives would need to be activated to complete the cutover;
- a historical approved state would require client guessing;
- a Target or Incentive write invariant changes unintentionally;
- old UI ownership cannot be safely eliminated;
- a shared CSS owner would be deleted without proving all consumers;
- desktop or mobile parity fails after two evidence-based correction attempts;
- real-data evidence would expose sensitive identity or business payloads;
- implementation requires database mutation, migration, provider change or production operation not separately authorized.

## 18. Definition of done

The master plan is complete only when all statements are true:

- `/store/incentives` uses the accepted visual and interaction contract for Region Manager and Report Viewer.
- `/store/targets` uses the accepted visual and interaction contract for Region Manager, Report Viewer and Store Manager.
- Both routes run inside the real Store shell.
- Every visible value maps to a documented real source or deterministic derivation.
- Report Viewer is company-scoped and completely read-only.
- Region Manager acts only on assigned stores.
- Store Manager Targets reads and writes only its authorized store.
- Incentive and Target write contracts and invariants are preserved.
- No sample data, role selector, duplicated shell or debug control ships.
- No former route UI or obsolete route CSS remains.
- All automated, visual, accessibility, responsive, authorization and controlled-pilot gates pass.
- `current-state.md` records the merged PRs, final SHAs and residual truth.
- The closeout states `Prototype parity: PASS` separately for Incentives and Targets.

## 19. Review record

Review method:

- repository truth inspection;
- approved Labs prototype inspection;
- `hr-axis-prototype-standard` contract review;
- `hr-axis-ui-refactor` risk review;
- Sokrates R5 decomposition;
- XHigh read-only planning review;
- final adversarial gap audit.

Gaps found and corrected in this revision:

1. Report Viewer Incentives was initially easy to treat as a frontend-only role branch. Repository evidence proves the route and endpoint are forbidden. PR 1 now adds a distinct read contract and negative write tests.
2. Targets could have derived the company hierarchy from requests and coverage. Stores with no request or personnel would disappear. PR 2 now requires the authoritative store universe.
3. Historical month checks in Labs were fixture logic. They now require persisted month-status summaries.
4. Incentive rate buttons could have copied current static bands. They now require the effective backend version for the selected period.
5. The prototype correction audit used names and roles absent from the current projection. The new contract requires sanitized actor display metadata and forbids raw IDs.
6. The Labs shell could have been mistaken for production markup. The real Store shell is now explicitly binding and the duplicated Labs shell is excluded from parity.
7. The existing hidden Incentives Store Manager rendering could have been activated accidentally. It is now an explicit non-goal and negative acceptance test.
8. A fixed 30-store visual fixture could have become a product limit. Pagination and list behavior now use the real scoped count.
9. UI cutover could have left old CSS and component branches available. PR 7 now requires a deletion manifest, source audit and built-bundle audit.
10. Local screenshot parity alone could have hidden real-data gaps. Controlled-pilot evidence is now a separate completion gate.

Final plan review judgment: executable after explicit implementation authorization, with no unresolved owner decision inside the planned scope.
