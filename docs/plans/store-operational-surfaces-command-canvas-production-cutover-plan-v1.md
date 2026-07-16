# Store Operational Surfaces Command Canvas Production Cutover Plan v1

Status: owner-requested implementation plan; approved prototype locked; runtime implementation not started

Date: 2026-07-16

Plan owner: HR Axis Store Operations

Target routes:

- `/store/kpis`
- `/store/approvals`
- `/store/workforce`
- `/store/tasks`

Related defect:

- Region Manager Incentives correction appears saved, then returns to the
  former value after the workspace refreshes.

Accepted prototype:

- `store-operations-command-canvas-v1`
- immutable identity:
  `docs/evidence/store-operational-surfaces-command-canvas/prototype-digest-manifest-v1.json`

## 1. Reader and post-read action

This plan is for the engineer or autonomous implementation agent who will move
the four accepted Command Canvas surfaces into the production Store shell.

After reading, that implementer must be able to:

1. fix the Incentives persistence regression without changing its workflow;
2. implement each accepted surface in the prescribed PR order;
3. bind every visible value and action to a real, authorized source;
4. remove the former route UI in the same route cutover;
5. prove desktop/mobile prototype parity and role safety mechanically.

This is not a Labs-to-production copy operation. The accepted prototype fixes
the visible and interaction contract. Production code, authorization, API,
database and workflow contracts remain the source of business truth.

## 2. Executive decision

Proceed through seven independently reviewable PRs:

1. immutable prototype lock and executable plan;
2. Incentives correction read-after-write consistency;
3. KPI Command Canvas cutover;
4. Talep Merkezi Command Canvas cutover;
5. Norm Kadro Command Canvas cutover;
6. Görevler Command Canvas cutover;
7. cross-route legacy removal and parity closeout.

Completion is binary:

- `Prototype parity: PASS`, or
- the affected route is not complete.

"Benzer", "yakın" or "işlevsel olarak aynı" is not completion. Exact parity
includes shell fit, geometry, typography, density, decision rails, period and
filter controls, sorting, drill paths, drawers/dialogs, product copy, status
tones, responsive transformation and all non-happy states.

## 3. Sokrates decision record

### 3.1 Claim

The four prototypes can replace the former production pages safely only when
each route's missing read truth is added within the same domain slice and the
existing write, role and calculation contracts remain unchanged.

### 3.2 Evidence

Repository evidence:

- The real Store shell and mobile navigation already exist and must remain the
  only production shell.
- KPI already has live/configured and closed-period reads, a Region Manager
  overview, score breakdown and the personnel profile destination, but it does
  not prove the complete accepted company hierarchy or bounded monthly store
  score trend.
- Talep Merkezi already has a bounded request-center response with request
  type, store, status, update time and summary totals. It does not contain an
  authoritative creation/waiting basis, next owner, overdue decision or full
  chronological request trace.
- Norm Kadro already reads active personnel, positions, headcount gap and
  seller-code/offboarding requests. Region/company comparison currently fans
  out store reads and cannot prove real store-level entry/exit history.
- Görevler already combines workflow inbox and Store Action plans. The detail
  response has no complete chronological plan audit and current multi-status
  reads do not prove a complete server-bounded result history.
- Report Viewer currently receives an empty Talep Merkezi presentation rather
  than the accepted company -> Region Manager -> store hierarchy.
- The external Labs folder is not a Git repository. Its path alone is not a
  durable prototype lock, so source and capture digests are required.

User decision evidence:

- The current prototype is approved as the production visual and interaction
  target.
- Report Viewer is company-scoped and fully read-only.
- Region Manager sees only assigned region/store scope.
- Store Manager sees only the assigned store and retains only existing
  authorized mutations.
- Norm Kadro history contains personnel entry, exit and total working duration;
  it does not contain KPI score/status data.
- KPI reference status, personnel performance status and store risk are three
  separate classifiers and must not be conflated.

### 3.3 Strongest counterargument

The fastest implementation would reuse current endpoints, copy the Labs
components and fill missing fields on the client.

Rejected because it would infer company hierarchy, waiting/overdue meaning,
employment history and task audit from incomplete data; it could also ship
fixtures, duplicate the Store shell, preserve former UI owners and create
visual parity without operational truth.

### 3.4 Risk and door classification

- Overall line: R4 because the first runtime slice repairs a persisted
  Incentives workflow readback.
- Prototype lock: R0.
- Route cutovers: R2 plus bounded R3 additive reads.
- Final cleanup: R1/R0.
- Door: two-way. Each runtime PR is squash-revertable and introduces no schema
  or data repair dependency.

The line becomes R5 and must stop/re-plan if implementation requires auth
expansion, DB migration, DDL/DML, scoring changes, provider configuration,
production operations or a write-lifecycle change.

### 3.5 Decision quality

Score: 5/5.

- Goal and visible acceptance are locked by digest.
- Real contract gaps are identified.
- The persistence defect has a repository-backed failure mechanism.
- PR order, rollback, negative tests and split triggers are explicit.
- Broad production remains `No-Go` and no external operation is required.

## 4. Authority and exclusions

This plan authorizes documentation of the implementation line. Runtime work
starts only after the owner explicitly starts execution or supplies an
autonomous execution prompt that names this plan.

This plan does not authorize:

- deployment or broad production rollout;
- staging or production data mutation;
- database migration, DDL or manual DML;
- provider or environment changes;
- permission broadening;
- KPI formula, weight, reference or ranking changes;
- request, offboarding, task or incentive lifecycle changes;
- new Store Manager or Report Viewer write capability;
- fake data, inferred business facts or an invented overdue SLA.

## 5. Immutable prototype contract

The digest manifest is the only accepted prototype identity for this train.
A source or screenshot hash change creates a new prototype version and requires
an explicit owner decision; it must not silently replace v1.

### 5.1 Included in parity

- real Store-shell content width and responsive gutters;
- DM Sans body/control copy and Manrope titles/key values;
- compact Command Canvas header and month/year period control;
- one contiguous decision rail with its top signature line;
- small meaningful Lucide metric icons;
- local metric filtering without page blanking;
- compact search/filter/sort command surface;
- text-integrated desktop sorts and equivalent mobile sort controls;
- role-specific hierarchy and drill path;
- proportional desktop columns and mobile operational cards;
- right drawer on desktop and full-width sheet on mobile;
- dialog, drawer and popover close/focus/scroll behavior;
- loading, empty, error/retry, unauthorized and partial-data states;
- product copy, status labels and semantic tone.

### 5.2 Excluded from production

- `LABS · Örnek veri` chrome;
- role and demo-state selectors;
- fixture people, stores, scores, requests, staffing and tasks;
- duplicated Labs sidebar, logo and navigation;
- local-only route emulation;
- hard-coded Labs color values and page-local design tokens;
- Recharts fixture history without an authoritative production history read.

### 5.3 Allowed production deviations

Only these classes may deviate, and every deviation must be recorded before a
parity claim:

1. real role/permission scope;
2. real null/partial/error state;
3. accessibility correction;
4. responsive fit inside the production Store shell;
5. absent backend truth that triggers a documented stop rather than a guess.

## 6. Shared production contract

### 6.1 Role hierarchy

Report Viewer:

- company -> Region Manager -> stores -> route-specific detail;
- entirely read-only;
- no submit, approve, request-create, task mutation or personnel mutation
  control in the component tree;
- drill-down does not change the active role to Region Manager.

Region Manager:

- assigned region/store scope only;
- route-specific inspection and only the existing authorized actions;
- all metrics, rows, drawer data and counts come from the same scoped dataset.

Store Manager:

- assigned store only;
- no region/company totals;
- no single-store accordion or redundant store drawer before the actual work
  area;
- only existing seller-code, offboarding and task mutations remain available.

### 6.2 Query continuity

- Local metrics, search, filters and sort must not refetch or remount the route.
- A period or server-page change may fetch, but the last complete result stays
  visible with a small updating state.
- A background failure keeps the last complete result and exposes retry.
- A scope or persona identity change must clear incompatible cached data and
  transient UI state.

### 6.3 Decision rails

- Every visible rail item is a real button or explicit navigation control.
- `aria-pressed` and visible selected state are required for filters.
- Values and filtered rows derive from one scoped source.
- A second click follows the locked reset/toggle behavior.
- No rail item exists only as decoration.

### 6.4 Sorting

- Desktop column headings own ascending/descending state and `aria-sort`.
- Repeated activation toggles direction.
- Stable IDs break ties.
- Null/unavailable values remain last in both directions.
- Mobile uses the same sort key and direction contract.
- Filtering or sort changes reset pagination but retain period and drill
  context.

### 6.5 Overlays and mobile

- Escape, outside click, X and explicit cancel work where the interaction
  permits them.
- Focus is trapped while open and restored to the opener after close.
- Body scroll locks; long content scrolls inside the overlay.
- Touch targets are at least 44 CSS pixels.
- Mobile form controls use at least 16 px text to avoid browser zoom.
- The page has no horizontal overflow at 1440, 1024, 390 or 320 px.

## 7. Incentives persistence defect contract

### 7.1 Observed behavior

After a Region Manager changes a person's incentive and confirms, the new
amount appears immediately, then the former amount returns.

### 7.2 Repository-backed root cause

The frontend optimistically updates `finalAmount`, then invalidates and
refetches the Incentives workspace after the mutation settles. That behavior
correctly exposes disagreement with server truth; invalidation must not be
removed to hide the problem.

The workspace read combines:

- a closed final-row summary;
- the current Region Manager correction;
- any approved admin adjustment.

The current mapper gives a non-null persisted closed `final_amount` priority
over the active Region Manager correction. Closed rows normally contain that
field, so the newly persisted draft is ignored during the GET readback. The
optimistic amount is therefore replaced by the old frozen final.

### 7.3 Required precedence

The fix MUST preserve the existing workflow and implement this read order:

1. an approved admin adjustment remains authoritative under the existing
   approval contract;
2. otherwise the current non-voided Region Manager correction overlays the
   closed base for the Region Manager workspace;
3. otherwise the persisted closed final is used;
4. otherwise the calculated amount is used;
5. a voided correction never overlays a value.

The exact current correction selection remains deterministic by persisted
status/timestamp/ID rules. No client-only indefinite optimistic state is an
acceptable fix.

### 7.4 Required regression proof

- closed final + draft correction -> refreshed workspace shows draft final;
- replaced draft -> refreshed workspace shows newest amount and note;
- voided-only correction -> closed final remains;
- approved admin adjustment -> existing authoritative result remains;
- successful POST followed by workspace GET -> amount never returns to the
  former value;
- failed POST -> prior cached row returns and error feedback remains visible.

## 8. Route-specific product and data contracts

### 8.1 KPI Özetleri

Workflow:

- Store Manager opens directly in the assigned store.
- Region Manager starts from assigned stores.
- Report Viewer starts from company Region Managers, expands their stores and
  remains read-only.
- Store selection opens `Mağaza KPI` and `Personel KPI` within the selected
  period.
- `Profile Git` navigates to the existing personnel performance page with the
  selected monthly period retained.

Visible store contribution order:

1. Hedef gerçekleşme;
2. Fiş başı ürün;
3. Ortalama sepet;
4. CR;
5. GSM Onayı;
6. BM checklist;
7. VM checklist.

Truth rules:

- GSM Onayı is a nullable store KPI source, not an approval action and not a
  personnel metric.
- Missing GSM/checklist/reference values are not zero.
- Monthly trend uses a bounded scoped history source; missing months remain
  gaps.
- Profile links use the real employee ID and existing authorization.
- The production KPI calculation itself is unchanged.

Three separate display classifiers:

- Store risk: score below 75 is the locked risk signal.
- Personnel performance: `>=85 Güçlü`, `75-84.99 Takipte`, `<75 Geride`,
  missing `Veri yok`.
- KPI reference: `actual >= reference` -> `İyi / Referans Üstü`;
  `80% < ratio < 100%` -> `Takip gerekli / Referans Altı`;
  `ratio <= 80%`, missing actual or not-done ->
  `Aksiyon Al / Referanstan Belirgin Uzak`; missing/zero reference produces no
  fabricated ratio.

Required additive read, if current discovery confirms the gap:

```ts
type KpiCommandWorkspace = {
  period: string
  view: 'report_viewer' | 'region_manager' | 'store_manager'
  sections: SectionStatusMap
  regions: Array<{
    regionManager: SafeActor | null
    stores: KpiStoreSummary[]
  }>
  selectedStore?: {
    contributions: KpiContribution[]
    personnel: KpiPersonnelSummary[]
    monthlyHistory: Array<{ period: string; score: number | null }>
  }
  capabilities: { canRead: boolean }
}
```

### 8.2 Talep Merkezi

Workflow:

- Shows target, seller-code and offboarding requests in one scoped ledger.
- Store Manager sees only the own-store ledger.
- Region Manager sees the assigned region/store ledger.
- Report Viewer sees company -> Region Manager -> store read hierarchy.
- No new approval or request mutation is invented on this page.
- Existing handoff destinations remain authoritative.

Required read truth:

- created and updated timestamps;
- typed current status and current/next operating owner;
- authoritative waiting duration basis;
- authoritative due/overdue result;
- chronological sanitized request events;
- bounded paging, deterministic order and summary totals.

`updatedAt` MUST NOT be used as request age. An overdue metric may ship only
when an existing, owner-approved SLA or backend policy produces `dueAt` or
`isOverdue`. If no such policy exists, PR 4 stops for the single missing owner
decision; it does not invent a day threshold.

```ts
type RequestCenterWorkspaceItem = {
  requestId: string
  requestType: 'target' | 'seller_code' | 'offboarding'
  store: StoreIdentity
  status: string
  createdAt: string
  updatedAt: string
  waitingSince: string | null
  nextOwner: 'store' | 'region' | 'hr' | 'system' | null
  dueAt: string | null
  isOverdue: boolean | null
  events: RequestAuditEvent[]
}
```

### 8.3 Norm Kadro

Workflow:

- Store Manager opens directly in the assigned store's personnel workspace.
- Region Manager starts from assigned stores and drills into a store.
- Report Viewer uses company -> Region Manager -> store read hierarchy.
- Store Manager retains existing `Personel sicil talebi` and
  `İşten ayrılma talebi` actions.
- Read-only roles receive no request mutation controls.

Active personnel columns:

- Personel;
- Pozisyon;
- İşe giriş;
- Çalışma süresi;
- Durum.

Norm Kadro MUST NOT show personnel KPI score, `Güçlü`, `Takipte`, `Geride`, KPI
contribution or performance ranking.

Store personnel history contains only:

- personnel entry;
- personnel exit;
- entry/exit dates;
- total working duration.

It does not contain support, score, role-change or assignment narrative unless
that fact is required solely to establish a truthful entry/exit interval.

The new read model must replace unbounded per-store browser fan-out:

```ts
type WorkforceCommandWorkspace = {
  view: 'report_viewer' | 'region_manager' | 'store_manager'
  stores: Paged<{
    store: StoreIdentity
    norm: number | null
    active: number
    gap: number | null
    shortageDays: number | null
    personnel: WorkforcePerson[]
  }>
  history?: Paged<{
    employeeId: string
    displayName: string
    entryDate: string
    exitDate: string | null
    totalWorkingDays: number | null
  }>
  capabilities: {
    canCreateSellerCodeRequest: boolean
    canCreateOffboardingRequest: boolean
  }
}
```

Existing seller-code and offboarding command payloads, validations and action
scope remain unchanged.

### 8.4 Görevler

Workflow:

- Store Manager may act on authorized Store Action plans using existing
  endpoints.
- Region Manager and Report Viewer inspect result history only.
- Every drawer shows the authoritative source record/deep link and a
  chronological task trace.
- Read-only roles use result-oriented metrics; they do not receive empty action
  counters or mutation controls.

Required read truth:

- bounded server paging over active and result states;
- source type/ID and safe deep link;
- assigned, status-changed, completed, cancelled and resolved events;
- actor display/role snapshots without raw identity leakage;
- result metrics derived from the same scoped dataset;
- capabilities separate from read scope.

```ts
type TaskCommandWorkspace = {
  view: 'report_viewer' | 'region_manager' | 'store_manager'
  items: Paged<{
    plan: StoreActionPlanSummary
    source: SafeSourceReference
    events: TaskAuditEvent[]
  }>
  summary: TaskResultSummary
  capabilities: {
    canStart: boolean
    canUpdate: boolean
    canComplete: boolean
    canCancel: boolean
  }
}
```

## 9. Functional requirements

### Shared

- **SH-FR-001**: Production MUST use the existing Store shell and navigation.
- **SH-FR-002**: Labs chrome, fixtures, duplicate shell and role switcher MUST
  NOT ship.
- **SH-FR-003**: Each route MUST render exactly one owner for the resolved
  persona.
- **SH-FR-004**: Every visible value MUST be API-backed or an explicit pure
  derivation from API-backed values.
- **SH-FR-005**: Decision-rail controls MUST filter, sort, navigate or reset
  the same scoped dataset.
- **SH-FR-006**: Local metric/filter/sort changes MUST NOT blank or refetch the
  route.
- **SH-FR-007**: Desktop and mobile sort semantics MUST be equivalent.
- **SH-FR-008**: Lists MUST use bounded server paging/cursors and MUST NOT
  encode a fixed 30-store limit.
- **SH-FR-009**: Loading, empty, full error, retry, unauthorized and partial
  states MUST use the accepted Command Canvas language.
- **SH-FR-010**: Report Viewer MUST emit zero mutation requests.
- **SH-FR-011**: Region Manager and Store Manager actions MUST remain limited
  by existing server action scope.
- **SH-FR-012**: Former route UI owners and replaced CSS MUST be deleted in the
  corresponding cutover or the final explicit deletion slice.
- **SH-FR-013**: Production localization ownership MUST remain intact.
- **SH-FR-014**: `null`, missing or partial values MUST NOT become zero.

### Incentives defect

- **INC-FR-001**: An active non-voided Region Manager correction MUST overlay
  a closed base when no approved admin adjustment supersedes it.
- **INC-FR-002**: The POST response and next workspace GET MUST agree on the
  visible final amount and correction record.
- **INC-FR-003**: Failed writes MUST restore the prior row.
- **INC-FR-004**: Query invalidation MUST remain active.
- **INC-FR-005**: No API shape, DB schema or workflow transition MAY change.

### KPI

- **KPI-FR-001**: All three role drill paths MUST preserve selected period.
- **KPI-FR-002**: Seven store KPI sources MUST render in locked order.
- **KPI-FR-003**: Store risk, personnel score and reference status MUST use
  separate named classifiers.
- **KPI-FR-004**: `Profile Git` MUST use the existing personnel destination.
- **KPI-FR-005**: Monthly trend MUST use bounded scoped history with null gaps.
- **KPI-FR-006**: KPI calculation/scoring MUST remain unchanged.

### Talep Merkezi

- **REQ-FR-001**: The ledger MUST preserve all three request domains and real
  handoff destinations.
- **REQ-FR-002**: Waiting duration MUST derive from an authoritative start.
- **REQ-FR-003**: Next owner MUST be typed by the backend.
- **REQ-FR-004**: Overdue MUST derive from an approved server policy.
- **REQ-FR-005**: Drawer events MUST be chronological and sanitized.
- **REQ-FR-006**: This route MUST add no new request mutation.

### Norm Kadro

- **WF-FR-001**: Store Manager MUST open directly in the own-store workspace.
- **WF-FR-002**: Region/Viewer reads MUST use one bounded workspace, not
  per-store browser fan-out.
- **WF-FR-003**: Active rows MUST contain employment facts only.
- **WF-FR-004**: Store history MUST contain entry/exit intervals only.
- **WF-FR-005**: Existing Store Manager request mutations MUST remain
  payload-compatible and scope-compatible.
- **WF-FR-006**: Departed personnel MUST NOT appear as active offboarding
  candidates.

### Görevler

- **TASK-FR-001**: Store Manager MUST retain current authorized plan actions.
- **TASK-FR-002**: Region Manager and Report Viewer MUST remain result-history
  read-only.
- **TASK-FR-003**: Every detail MUST include an authoritative safe source.
- **TASK-FR-004**: Every detail MUST include a chronological audit trace.
- **TASK-FR-005**: Result metrics MUST derive from the visible scoped result
  dataset.
- **TASK-FR-006**: Reads MUST be bounded and complete under paging semantics.

## 10. Non-functional requirements

- **NFR-001**: At 1440x900, 1024x768, 390x844 and 320x844,
  `scrollWidth <= clientWidth`.
- **NFR-002**: Mobile interactive targets MUST be at least 44x44 CSS pixels.
- **NFR-003**: Mobile text inputs/selects/textareas MUST use at least 16 px.
- **NFR-004**: Popovers/drawers/dialogs MUST support keyboard focus, Escape,
  focus restoration and body-scroll lock.
- **NFR-005**: Local filter/sort feedback MUST occur without a loading
  skeleton or route remount.
- **NFR-006**: New read endpoints MUST use deterministic bounded paging.
- **NFR-007**: No raw user IDs, national IDs, credentials or unrestricted audit
  payloads MAY appear in UI or evidence.
- **NFR-008**: Route pages MUST remain orchestration-first; mapping, sorting,
  querying and overlays belong to feature owners.
- **NFR-009**: Production code MUST use shared semantic tokens, shadcn
  components and restrained Lucide icons; raw Labs hex values MUST NOT enter
  route TSX.
- **NFR-010**: Each runtime PR MUST be squash-revertable without data repair.

## 11. Seven-PR execution train

### PR 1 — Prototype lock and executable plan

Risk: R0

Scope:

- merge the digest manifest, prototype shelf link and this plan;
- add a small digest guard that verifies the external source when present and
  skips honestly when the Labs root is absent;
- freeze role/route/state/viewport matrices;
- no runtime source change.

Exit:

- source and capture hashes reproduce;
- docs checks and script guard pass;
- implementation starts only from the locked manifest.

### PR 2 — Incentives correction read-after-write consistency

Risk: R4

Scope:

- write red backend mapper/service tests for closed final + active correction;
- fix correction/admin-adjustment/closed-final precedence;
- add POST -> GET frontend/E2E regression coverage;
- preserve query invalidation, optimistic rollback, endpoint payloads and DB.

Exit:

- a successful correction remains after refresh;
- voided and admin-approved precedence tests pass;
- no UI redesign or contract-shape change is present.

### PR 3 — KPI Command Canvas cutover

Risk: R3/R2

Scope:

- add one bounded additive workspace/history read only if final discovery proves
  the current reads cannot satisfy the contract;
- implement all three persona paths and locked classifiers;
- preserve real profile navigation and period context;
- replace the former KPI presentation and remove its obsolete owner/CSS after
  zero-reference proof.

Exit:

- all seven sources and three classifiers are truthful;
- monthly history is authoritative or the trend is blocked, never fabricated;
- desktop/mobile screenshots match the locked captures materially.

### PR 4 — Talep Merkezi Command Canvas cutover

Risk: R3/R2

Scope:

- extend the one request-center read contract with created/waiting/next-owner,
  authorized overdue and sanitized chronological events;
- implement role hierarchy, decision rail, filters, sorts and drawer;
- preserve current request workflows and deep links;
- remove former route UI/CSS after proof.

Exit:

- overdue has an approved server rule or the PR stops;
- Report Viewer is company-scoped/read-only;
- no request write contract changed.

### PR 5 — Norm Kadro Command Canvas cutover

Risk: R3/R2

Scope:

- replace per-store fan-out with one bounded workforce workspace;
- add entry/exit-only store history;
- implement direct Store Manager workspace and Region/Viewer drill paths;
- preserve seller-code/offboarding write endpoints and validations;
- remove all KPI score/status language and former UI owners.

Exit:

- 35+ scoped stores do not create N+1 browser requests;
- active and departed personnel cannot be confused;
- history exposes no unrelated audit/PII fields.

### PR 6 — Görevler Command Canvas cutover

Risk: R3/R2

Scope:

- add one bounded task/result read with safe source and audit events;
- implement Store Manager action and Region/Viewer result presentations;
- preserve current Store Action commands and action-store checks;
- remove former task presentation/CSS after proof.

Exit:

- read-only roles emit no mutation requests;
- source deep links and chronology are authoritative;
- long result histories page without data loss or fixed client caps.

### PR 7 — Legacy removal and parity closeout

Risk: R1/R0

Scope:

- execute a zero-reference deletion manifest across all four routes;
- remove orphan selectors, former tests, fixture helpers and route branches;
- run cross-route role, state, accessibility, responsive and parity gates;
- capture sanitized controlled-pilot read evidence;
- update current-state only after merged truth is known.

Exit:

- no former route owner or old UI remnant remains;
- no Labs helper or fixture is present in source/bundle;
- all four routes report `Prototype parity: PASS`.

## 12. Acceptance criteria

### Shared

- **AC-001 (SH-FR-001,002)**: Given any target route opens, when it renders,
  then it uses the real Store shell and contains no Labs chrome, duplicate
  sidebar, role switcher or fixture row.
- **AC-002 (SH-FR-004,014)**: Given a visible value is null or partial, when it
  renders, then it shows the locked unavailable/partial state and never zero.
- **AC-003 (SH-FR-005,006; NFR-005)**: Given complete rows are visible, when a
  metric, search, filter or sort changes, then rows update locally without a
  blank page, skeleton or unrelated read.
- **AC-004 (SH-FR-007)**: Given the same dataset and sort, when desktop and
  mobile render, then their first/last stable IDs are equivalent.
- **AC-005 (SH-FR-009)**: Given loading, empty, error, access or partial data,
  when the state renders, then no former UI fallback appears.
- **AC-006 (SH-FR-010)**: Given a Report Viewer exercises every control, when
  network traffic is inspected, then zero POST/PUT/PATCH/DELETE requests occur.
- **AC-007 (NFR-001..004)**: Given each required viewport and longest overlay,
  when inspected, then there is no page overflow and every close/focus/scroll
  path works.

### Incentives

- **AC-INC-001 (INC-FR-001,002)**: Given a closed row and an active draft
  correction, when POST succeeds and workspace GET refetches, then the new
  final amount and correction remain visible.
- **AC-INC-002 (INC-FR-001)**: Given a voided-only correction, when the
  workspace loads, then the closed final remains.
- **AC-INC-003 (INC-FR-001,005)**: Given an approved admin adjustment, when the
  workspace loads, then its existing authoritative amount is unchanged.
- **AC-INC-004 (INC-FR-003,004)**: Given POST fails, when optimistic state was
  visible, then the prior row returns and the existing error feedback appears.

### KPI

- **AC-KPI-001 (KPI-FR-001,004)**: Given any persona drills to a person and
  selects `Profile Git`, then the existing personnel page opens with the same
  monthly period.
- **AC-KPI-002 (KPI-FR-002,003)**: Given the store workspace, then all seven
  sources render in order and use only their correct classifier.
- **AC-KPI-003 (KPI-FR-003)**: Given exact 80%, just above 80%, exact 100%,
  missing actual and zero reference fixtures, then the locked labels appear
  with no NaN/Infinity.
- **AC-KPI-004 (KPI-FR-005)**: Given missing monthly history, then the chart
  shows a gap/partial state and never a zero point.

### Talep Merkezi

- **AC-REQ-001 (REQ-FR-002,003)**: Given an open request, then waiting duration
  and next owner come from authoritative response fields.
- **AC-REQ-002 (REQ-FR-004)**: Given a request is marked overdue, then the
  server policy and due basis are testable; `updatedAt` alone is insufficient.
- **AC-REQ-003 (REQ-FR-005)**: Given a request drawer opens, then its events
  are chronological, scoped and sanitized.
- **AC-REQ-004 (REQ-FR-006)**: Given all Talep Merkezi controls are exercised,
  then the page creates no new mutation type.

### Norm Kadro

- **AC-WF-001 (WF-FR-001)**: Given a Store Manager opens Norm Kadro, then the
  own-store personnel workspace appears without an accordion/store pre-step.
- **AC-WF-002 (WF-FR-002)**: Given 35+ stores are in scope, then the browser
  uses one bounded workspace/page read rather than one personnel/headcount read
  per store.
- **AC-WF-003 (WF-FR-003,004)**: Given active rows and history render, then no
  KPI score/status exists and history contains entry/exit facts only.
- **AC-WF-004 (WF-FR-005)**: Given a Store Manager submits either existing
  personnel request, then request payload and server authorization are
  unchanged.
- **AC-WF-005 (WF-FR-006)**: Given a person has exited, then the person appears
  only in history and not in the active offboarding selector.

### Görevler

- **AC-TASK-001 (TASK-FR-001,002)**: Given Store Manager, Region Manager and
  Report Viewer sessions, then only Store Manager sees existing authorized
  action controls.
- **AC-TASK-002 (TASK-FR-003,004)**: Given a task drawer opens, then source and
  chronological audit are real, scoped and sanitized.
- **AC-TASK-003 (TASK-FR-005)**: Given a result metric is activated, then its
  count equals the retained scoped result set and rows change accordingly.
- **AC-TASK-004 (TASK-FR-006)**: Given a history exceeds one page, then all
  pages are reachable without a fixed 100-row completeness claim.

## 13. Edge cases

- **EC-001**: Mixed-role account uses Report Viewer read presentation while
  gaining no Report Viewer mutation capability.
- **EC-002**: Empty company/region/store scope fails closed.
- **EC-003**: Scope changes while a drawer is open; drawer, filters, sort and
  selection reset before new data renders.
- **EC-004**: A long Turkish store/person name wraps without changing column
  meaning or hiding the primary action.
- **EC-005**: Null GSM, null KPI reference and not-done checklist stay
  distinguishable.
- **EC-006**: Monthly history has internal missing months.
- **EC-007**: Request has no next owner or no approved SLA result.
- **EC-008**: Request events contain unavailable actor display metadata.
- **EC-009**: Workforce has planned norm missing, no active personnel or a
  negative/unknown gap.
- **EC-010**: Employee entered/exited more than once; intervals remain separate
  and total duration is server-derived.
- **EC-011**: Store has more personnel than one page and departed personnel.
- **EC-012**: Task source is no longer available; safe unavailable source state
  replaces a broken or cross-scope link.
- **EC-013**: Task is cancelled after completion data was partially available.
- **EC-014**: Incentive draft is replaced, returned, voided or followed by an
  approved admin adjustment.
- **EC-015**: Background refetch fails after a complete result exists.
- **EC-016**: Drawer/dialog content is taller than the viewport.
- **EC-017**: A local filter yields zero rows while the server dataset is not
  empty; local empty and server-empty states remain distinct.
- **EC-018**: Null sort values remain last in both directions.
- **EC-019**: 35+ stores and long audit history remain server-bounded.
- **EC-020**: Evidence capture contains sensitive identifiers; the receipt is
  sanitized or the capture is rejected.

## 14. Verification matrix

Per runtime PR:

1. red-green-refactor tests traced to FR/AC/EC IDs;
2. targeted backend service/repository/controller tests when reads or write
   readback change;
3. OpenAPI generate/check and generated client check when a contract changes;
4. frontend unit/contract tests for pure mapping, classifiers, sorting and
   capabilities;
5. frontend lint and production build;
6. targeted Playwright for every affected persona, mutation-silence and
   query-continuity path;
7. accessibility scan on the primary route and longest overlay;
8. visual captures at 1440x900, 1024x768, 390x844 and 320x844;
9. `scrollWidth <= clientWidth`, console error count zero and no mobile zoom;
10. old-owner/selector/fixture/Labs leakage search;
11. affected-scope selector and only the canonical checks it selects;
12. local adversarial diff review;
13. required GitHub/Vercel checks and clean mergeability when a PR opens.

Operational discipline:

- Never run two full release suites concurrently.
- While checks run, prepare only genuinely independent next work in a separate
  worktree.
- Monitor checks without spawning a model agent solely to wait.
- Do not trigger or await GitHub Codex review; it remains owner-disabled.
- Prefer squash merge so exact-tree post-merge reuse remains available.

## 15. Traceability

| PR | Requirements | Acceptance | Edge cases |
| --- | --- | --- | --- |
| 1 | SH-FR-001,002,012 | AC-001 | EC-020 |
| 2 | INC-FR-001..005 | AC-INC-001..004 | EC-014,015 |
| 3 | SH-FR-003..014; KPI-FR-001..006 | AC-002..007; AC-KPI-001..004 | EC-001..006,015..019 |
| 4 | SH-FR-003..014; REQ-FR-001..006 | AC-002..007; AC-REQ-001..004 | EC-001..004,007,008,015..020 |
| 5 | SH-FR-003..014; WF-FR-001..006 | AC-002..007; AC-WF-001..005 | EC-001..004,009..011,015..020 |
| 6 | SH-FR-003..014; TASK-FR-001..006 | AC-002..007; AC-TASK-001..004 | EC-001..004,012,013,015..020 |
| 7 | SH-FR-001..014 | AC-001..007 and all route ACs | all |

## 16. Rollback

- Every runtime PR is one squash-revertable domain cutover.
- Additive read endpoints may remain harmless if a UI cutover is reverted, but
  unused endpoints are removed during closeout unless another consumer exists.
- No rollback may require data repair, migration reversal or provider change.
- Incentives rollback is a normal code revert. If runtime evidence contradicts
  the diagnosed precedence failure, stop before merge and retain the red
  reproduction as evidence.
- A route cutover must not keep old and new presentation owners behind a silent
  long-lived flag. Revert the PR rather than maintaining two truths.

## 17. Stop and split conditions

Stop and report instead of guessing when:

- a route needs auth widening, DB migration, DML, scoring or write-lifecycle
  change;
- an overdue rule has no approved business/SLA authority;
- KPI monthly history has no authoritative bounded source;
- Report Viewer or Region Manager scope cannot be proven fail-closed;
- Workforce still requires per-store browser fan-out;
- task/request audit would expose raw IDs, PII or unrestricted events;
- one route needs more than one substantial new endpoint;
- prototype source/capture digest drifts;
- old and new route owners must coexist after the route PR;
- desktop/mobile parity remains materially different after two evidence-based
  correction attempts;
- any required test/check fails or mergeability is not clean.

## 18. Definition of done

The plan is complete only when:

- the Incentives correction survives a real POST -> GET readback;
- all four production routes materially match the locked prototype;
- all visible values and actions are live-data-backed and role-scoped;
- Report Viewer is company-scoped/read-only;
- Region Manager is assigned-region/store scoped;
- Store Manager is own-store/action-store scoped;
- decision rails, sorts, filters, period controls and overlays behave exactly as
  accepted;
- mobile and desktop parity evidence passes;
- no former route UI, obsolete CSS, Labs helper or fixture remains;
- no API shape, auth, DB, scoring or workflow contract changed outside the
  explicit additive read and Incentives read-precedence scope;
- current-state records merged PRs, actual SHAs and residual runtime truth;
- closeout reports `Prototype parity: PASS` for KPI Özetleri, Talep Merkezi,
  Norm Kadro and Görevler separately.

## 19. Adversarial review record

The plan was reviewed against fresh repository code, generated contracts,
existing tests, the accepted Labs source, the prototype risk register, prior
Checklist/Incentives/Targets cutover evidence and the Sokrates stop rules.

Gaps found and corrected during review:

1. The Incentives symptom first looked like a React cache issue. The actual
   read mapper prioritizes the closed final over the active Region Manager
   correction. PR 2 now fixes server read precedence and keeps refetch enabled.
2. A simple external path was not a durable prototype lock. The manifest now
   binds source and accepted captures by SHA-256.
3. KPI trend was a Labs fixture. Production now requires a bounded authoritative
   history read or stops.
4. Talep Merkezi could have derived waiting/overdue from `updatedAt`. That is
   forbidden; an approved backend due policy is required.
5. Norm Kadro comparison could have preserved per-store browser reads. PR 5
   requires one bounded workspace and entry/exit-only history.
6. Görevler could have called merged client lists complete. PR 6 requires
   bounded paging and authoritative audit/source records.
7. Shared UI foundation work could have become a broad independent refactor.
   Shared primitives are introduced only inside the first route that needs them
   and reused by later routes; no generic design-system PR is added.
8. Four visual cutovers could have hidden role drift. Every route now has
   explicit mutation-silence, own/assigned/company scope acceptance.

Final Sokrates judgment: proceed only in the seven-PR order and obey the split
triggers. The first runtime priority is the user-observed Incentives persistence
defect; the visual cutovers follow after that correctness repair.
