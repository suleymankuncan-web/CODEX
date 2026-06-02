# Store Action / Coaching Loop V1

## Status

- State: `shaping`
- Implementation: V1A read-only candidate shaping is complete; V1B persisted
  write behavior is being designed in stages and is not implemented yet
- Feature Integration Spine mode: start as `docs-only`, then likely
  `read-only feature`, then later `write feature`

This mini spec is the first real use of Feature Integration Spine V1. It does
not implement code, endpoints, migrations, UI behavior, auth behavior, or KPI
logic.

## Reader And Action

Reader:

- a future engineer or agent turning Store Ops signals into owned store-level
  follow-up work without creating a generic workflow engine.

After reading, they should be able to:

- understand why Store Action exists,
- distinguish action candidates from persisted action plans,
- identify the source-of-truth boundaries,
- choose the first implementation slice,
- avoid changing KPI, checklist, target, reporting, or auth semantics by
  accident.

## Business Goal

Store Ops already answers many "what happened?" questions:

- KPI and ranking surfaces show performance state.
- Checklist surfaces show visit/compliance outcomes and acknowledgement state.
- Target and approval surfaces show distribution and approval state.
- Operations surfaces show readiness and queue pressure.

The missing product loop is:

```text
signal -> owned follow-up -> due date -> evidence/resolution -> closed
```

Store Action / Coaching Loop V1 should turn important store signals into
clear, owned follow-up work without pretending the system has solved coaching,
incentives, escalation, or automatic remediation.

Primary users:

- Store managers who need to know what to act on today.
- Region managers who may later review action pressure and overdue follow-up.
- Super admins or HR/admin operators who may later inspect audit and adoption.

## Sokrates Decision

Claim:

- The project should add an action/coaching loop, but not by building a broad
  workflow engine or changing source-domain behavior.

Assumptions:

- The current product has enough existing signals to define action candidates.
- Store managers are the first owner for store-level follow-up.
- Persisted action plans are valuable, but only after auth, audit, data
  placement, and inbox semantics are explicit.

Repo evidence:

- KPI domain guidance already says KPI can observe, raise attention, and
  trigger action, but should not directly mutate business state.
- Shared workflow language already has `task` for actionable queue work.
- Workflow inbox already supports KPI exception tasks, checklist receipt
  acknowledgements, and target distribution approvals.
- Operations Control Tower already summarizes workflow pressure and should not
  become the detailed action-plan surface.
- Store shell already has task-first surfaces that can host follow-up work
  later.

Counterargument:

- A read-only action candidate can feel less valuable than a real persisted
  plan. That is true, but starting with write state before source, ownership,
  and audit are clear risks creating a second workflow engine by accident.

Risk:

- LOW for this mini spec.
- LOW/MEDIUM for a read-only candidate surface over existing signals.
- MEDIUM/HIGH for persisted action plans because they add operational state,
  auth/action scope, audit, status lifecycle, and inbox pressure.
- HIGH for automated escalation, notifications, incentives, or rule engines.

Door:

- Read-only candidates are a two-way door.
- Persisted action plans are medium-door work.
- Escalation, notification, incentives, and automatic remediation are near
  one-way-door until product rules are explicit.

Decision:

- Proceed with a staged Store Action line.
- Do not implement write behavior before the read-only candidate and data/auth
  boundaries are shaped.

## Scope Options

### Option A: Read-Only Action Candidates

The system derives action candidates from existing signals and shows them as
recommendations or queue-like items.

Examples:

- KPI off-track candidate.
- Checklist low-score follow-up candidate.
- Target coverage or target-miss candidate.

Data:

- no new operational table,
- no command endpoint,
- no audit requirement beyond existing source evidence.

Risk:

- lowest.

Use this as the first implementation slice if an existing signal can support a
clear candidate without new business rules.

### Option B: Persisted Action Plans

A store manager creates or accepts an action plan with owner, due date, status,
and resolution evidence.

Likely data:

- `ops` owns action-plan state,
- `audit` records create/update/close/cancel,
- reporting may later read summaries but should not own mutations.

Risk:

- medium/high.

Use only after Option A proves the shape and ownership.

### Option C: Full Coaching Workflow

The system creates, escalates, reminds, assigns, and closes coaching work across
roles with notifications and manager oversight.

Risk:

- high.

This is explicitly out of V1.

## Recommended V1 Path

1. **V1A: Candidate inventory and read-only candidates**
   - Define candidate source families and status language.
   - Prefer existing signals.
   - No DB migration.
   - No command endpoint.
   - No auth semantics change.

2. **V1B: Persisted action-plan model**
   - Add only after V1A proves the candidate shape.
   - Store manager can create or accept plans within assigned store scope.
   - Region/admin read visibility is explicitly scoped.
   - Audit is mandatory.

3. **V1C: Inbox integration**
   - Action plans appear as `task`.
   - They do not become approval unless a separate approval step is designed.
   - The source action-plan domain owns lifecycle status.

4. **V1D: Closure evidence**
   - Close with a short resolution note or structured reason.
   - File upload, alerts, notifications, and escalation stay out of V1.

## Source Of Truth Boundaries

Store Action may read:

- KPI and ranking signals,
- checklist result and acknowledgement signals,
- target distribution and coverage signals,
- workforce/headcount signals in a later phase,
- workflow inbox state.

Store Action must not own:

- KPI scoring or ranking sort,
- checklist scoring, weights, or acknowledgement semantics,
- target approval or target reference promotion,
- workforce approval side effects,
- incentive payout or reward eligibility,
- source import/materialization correctness.

The action plan is a follow-up object, not a reinterpretation of the source
business fact.

## Candidate Source Families

| Source Family | V1 Readiness | Candidate Meaning | Not Now |
| --- | --- | --- | --- |
| KPI exception | Strongest first candidate. | Store manager follow-up on off-track KPI or score contributor. | Do not change score math or thresholds. |
| Checklist low score | Good candidate after score/ack boundary is confirmed. | Follow-up on low-score items or unacknowledged result. | Do not change checklist scoring or acknowledgement rules. |
| Target coverage/miss | Useful but more sensitive. | Review missing, stale, pending, or off-track target state. | Do not change target approval or scoring reference semantics. |
| Workforce/headcount | Later candidate. | Staffing follow-up or people lifecycle pressure. | Do not mutate seller-code/offboarding approval behavior. |
| Incentive/challenge | Parked. | Future motivational nudge. | No payout, reward, or challenge logic in V1. |

## V1A Read-Only Candidate Decision

The first implementation slice uses the existing workflow inbox KPI exception
source instead of a new Store Action endpoint.

Decision:

- KPI exception workflow inbox items are the first read-only Store Action
  candidates.
- `/store/tasks` remains the first owning surface.
- The frontend derives read-only Store Action candidates from existing
  `/api/workflow/inbox` items where:
  - `sourceType` is `kpi_exception`,
  - `itemType` is `task`,
  - `inboxStatus` is `needs_attention`.

Why:

- Backend workflow inbox already scopes store-manager KPI exception reads to
  assigned stores.
- The source fact remains the reporting/KPI snapshot status band.
- A dedicated `/api/store-actions/candidates` endpoint would duplicate the
  current read model before there is a second consumer or a persisted action
  plan detail.

Guardrails:

- No DB migration.
- No new command endpoint.
- No new workflow status.
- No auth or permission change.
- No KPI threshold, score, status-band, or target-value reinterpretation.
- No Operations Control Tower signal yet; workflow inbox pressure already
  summarizes this family.

Evidence:

- `docs/evidence/store-action-readonly-candidates-v1.md`

## V1A Source Guard Decision

The second implementation slice keeps current workflow source classification
explicit before adding another candidate family.

2026-06-02 update:

- The acknowledgement boundary remains valid for `checklist_receipt`.
- A separate checklist remediation source decision is now locked in
  `docs/plans/store-action-checklist-remediation-v1.md`.
- That decision permits future automatic `checklist_remediation` Store Action
  work after checklist acknowledgement when real low or critical checklist
  findings exist.
- Do not implement checklist remediation by reclassifying `checklist_receipt`;
  the receipt is still acknowledgement work.

Decision:

- `kpi_exception` remains the only active read-only Store Action candidate
  source.
- `checklist_receipt` remains parked at the acknowledgement boundary. A
  completed checklist waiting for store acknowledgement is not automatically a
  coaching candidate.
- `target_distribution_request` remains parked at the approval boundary. A
  pending target approval is not automatically a coaching candidate.
- Frontend Store Action candidate logic must cover every current
  `WorkflowInboxItem['sourceType']` with an explicit source decision.

Why:

- Checklist low-score follow-up needs a clear threshold owner and a decision on
  how it relates to existing acknowledgement.
- Target coverage/miss follow-up must not reinterpret target approval,
  reference promotion, or KPI scoring-reference semantics.
- Store Action should not become a shadow workflow engine by treating every
  inbox item as coaching work.

Evidence:

- `docs/evidence/store-action-source-guard-v1.md`

## V1A Checklist Source Decision

Checklist-derived Store Action follow-up should not be created directly from
raw checklist receipts yet.

2026-06-02 update:

- This historical decision is extended by
  `docs/plans/store-action-checklist-remediation-v1.md`.
- `checklist_receipt` remains acknowledgement work.
- A future `checklist_remediation` source may create Store Action tasks after
  acknowledgement from real low or critical checklist findings.
- Threshold ownership, source references, idempotency, scope tests, and
  non-duplicate acknowledgement behavior must be explicit before runtime code.

Decision:

- `checklist_receipt` remains acknowledgement work.
- Checklist score follow-up may enter Store Action through the existing KPI
  exception source when `BM_CHECKLIST` or `VM_CHECKLIST` contributes to an
  at-risk/off-track KPI status.
- Direct checklist low-score candidates are parked until low-score threshold
  ownership, acknowledgement interaction, BM/VM differences, source reference,
  and scope tests are explicit.

Why:

- Store score configuration already marks `BM_CHECKLIST` and `VM_CHECKLIST` as
  `task_candidate` metrics.
- Using the KPI exception path avoids inventing a second threshold outside KPI
  status-band and scoring semantics.
- A completed checklist receipt waiting for acknowledgement is not the same
  product concept as a coaching follow-up.

Evidence:

- `docs/evidence/store-action-checklist-source-decision-v1.md`

## V1A Target Source Decision

Target-derived Store Action follow-up should not be created directly from
target coverage rows yet.

2026-06-02 update:

- This historical target decision is extended by
  `docs/plans/store-action-target-projection-v1.md`.
- Target distribution approval, target coverage, missing target setup, and
  stale target reference states remain target-domain workflow issues.
- `TARGET_ACHIEVEMENT` Store Action work may proceed only as month-end
  projection risk, using a ready projection calendar, weighted confidence gate,
  projection thresholds, duplicate prevention, and result-language guardrails.
- Do not create target Store Action tasks from raw daily KPI drift.

Decision:

- `target_distribution_request` remains approval work.
- Target coverage/readiness states remain target-domain signals, not automatic
  coaching candidates.
- Target performance follow-up may enter Store Action through the existing KPI
  exception source when `TARGET_ACHIEVEMENT` contributes to an at-risk/off-track
  KPI status.
- Direct target coverage/miss candidates are parked until owner-by-status,
  source reference, deep link, scope tests, and scoring-reference semantics are
  explicit.

Why:

- Store score configuration already marks `TARGET_ACHIEVEMENT` as a
  `task_candidate` metric.
- Target coverage states can mean different actions: approval, conflict
  resolution, stale reference cleanup, missing target setup, or coaching.
- Store Action should not mutate or reinterpret target approval, target
  reference promotion, or KPI scoring-reference behavior.

Evidence:

- `docs/evidence/store-action-target-source-decision-v1.md`

## V1B Persisted Action Plan Decision

V1A read-only source decisions are now bounded enough to stop before write
state.

Decision:

- Do not implement persisted Store Action action plans yet.
- Treat V1A as complete for the current foundation: KPI exception candidates
  are active, while direct checklist and target sources remain parked.
- V1B requires explicit write-feature approval before DB, command, audit,
  workflow inbox, OpenAPI, or frontend lifecycle work starts.

Why:

- Persisted action plans are not a continuation of a read-only candidate
  helper. They create operational state.
- They need action-plan owner, lifecycle, assigned-store action scope, audit
  event names, API contracts, workflow inbox source mapping, frontend recovery
  states, migration smoke, and rollback.
- Starting them casually would risk a shadow workflow engine.

Evidence:

- `docs/evidence/store-action-persisted-action-plan-v1b-decision.md`

## V1B Detailed Design

The next safe step after the V1B go/no-go decision is a detailed design, not
runtime behavior.

Decision:

- V1B implementation should proceed in kademeler after design review.
- The first active source remains `kpi_exception`.
- Persisted plans should live in `ops.store_action_plan`.
- Write commands require assigned-store action scope.
- Audit events, API shapes, workflow inbox mapping, and Store Tasks UI must be
  implemented in separate reviewable steps.

Evidence:

- `docs/plans/store-action-v1b-persisted-action-plan-design-v1.md`
- `docs/superpowers/plans/2026-05-22-store-action-v1b-persisted-action-plans.md`

## V1B Schema Contract And Migration

The first implementation kademe adds the persisted action-plan schema without
exposing runtime behavior.

Decision:

- Add `ops.store_action_plan` and indexes as an additive DB migration.
- Keep the active source bounded to `kpi_exception`.
- Keep service commands, audit writes, API, workflow inbox integration, and UI
  out of this kademe.

Evidence:

- `db/migrations/049_store_action_plan_v1.sql`
- `backend/nestjs/src/modules/store-ops/store-action-plan-schema-contract.spec.ts`
- `docs/evidence/store-action-v1b-schema-v1.md`

## V1B Audit Catalog And Lifecycle Contract

The second implementation kademe adds audit metadata and lifecycle helpers
without exposing runtime behavior.

Decision:

- Catalog Store Action plan audit event names as feature-owned audit metadata.
- Add lifecycle constants and helpers for action-plan statuses, priorities,
  source type, transition rules, and terminal evidence requirements.
- Keep service commands, repository writes, API, workflow inbox integration,
  and UI out of this kademe.

Evidence:

- `backend/nestjs/src/shared/audit/audit-event-catalog.ts`
- `backend/nestjs/src/modules/store-ops/application/store-action-plan.contract.ts`
- `backend/nestjs/src/modules/store-ops/application/store-action-plan.contract.spec.ts`
- `docs/evidence/store-action-v1b-lifecycle-contract-v1.md`

## V1B Service And Repository Command Boundary

The third implementation kademe adds backend command behavior without exposing
runtime routes.

Decision:

- Add a service boundary for assigned-store write scope, lifecycle transitions,
  required due date validation, duplicate active source conflict mapping, and
  terminal evidence validation.
- Add a repository boundary for create/status/close/cancel SQL and audit event
  writes in one transaction, with expected-state predicates on lifecycle
  updates to guard concurrent terminal transitions.
- Keep module registration, controller/DTO, OpenAPI/generated client, workflow
  inbox integration, and UI out of this kademe.

Evidence:

- `backend/nestjs/src/modules/store-ops/application/store-action-plan.service.ts`
- `backend/nestjs/src/modules/store-ops/application/store-action-plan.service.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/store-action-plan.repository.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/store-action-plan.repository.spec.ts`
- `docs/evidence/store-action-v1b-command-boundary-v1.md`

## V1B API Contract Boundary

The fourth implementation kademe exposes the already-tested action-plan command
boundary through a narrow REST/API contract.

Decision:

- Register the Store Action service/repository/controller in `StoreOpsModule`.
- Expose list, detail, create, status, close, and cancel endpoints under
  `/api/store-actions/plans`.
- Use `RequireActionScope("store")` only on create, where the body carries
  `storeId`.
- Use authenticated role guards plus service-level assigned-store validation on
  list/detail/lifecycle commands, where the path does not carry a store-scope
  identifier.
- Add generated OpenAPI schemas and frontend types before any Store Tasks UI
  mutation flow uses these endpoints.
- Keep workflow inbox integration and UI lifecycle behavior for later
  kademeler.

Evidence:

- `backend/nestjs/src/modules/store-ops/web/store-action-plan.controller.ts`
- `backend/nestjs/src/modules/store-ops/web/store-action-plan.controller.spec.ts`
- `backend/nestjs/src/modules/store-ops/web/store-action-plan.openapi.contract.spec.ts`
- `backend/nestjs/src/openapi/store-action-plan-openapi.ts`
- `admin-web/src/generated/openapi-types.ts`
- `docs/evidence/store-action-v1b-api-contract-v1.md`

## V1B Workflow Inbox Boundary

The fifth implementation kademe lets persisted action plans appear in the
existing shared workflow inbox.

Decision:

- Add `store_action_plan` as a workflow inbox source type.
- Represent action plans as `task`, not `approval`.
- Fetch only active action plans for the shared inbox:
  - `open`,
  - `in_progress`,
  - `blocked`.
- Keep closed/cancelled history in the action-plan read API/detail path instead
  of filling the default inbox with completed history.
- Keep store visibility tied to assigned action stores. `SUPER_ADMIN` does not
  get a silent broad bypass in this slice.
- Update generated OpenAPI types and existing frontend labels so the new source
  type is readable wherever workflow inbox items are rendered.

Evidence:

- `backend/nestjs/src/modules/store-ops/application/workflow-inbox.contract.ts`
- `backend/nestjs/src/modules/store-ops/application/workflow-inbox.service.ts`
- `backend/nestjs/src/modules/store-ops/application/workflow-inbox.service.spec.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/store-action-plan.repository.ts`
- `admin-web/src/generated/openapi-types.ts`
- `docs/evidence/store-action-v1b-workflow-inbox-v1.md`

## V1B Store Tasks Read-Only List

The sixth implementation kademe makes persisted action plans visible in the
owning Store Tasks surface without exposing lifecycle commands.

Decision:

- List plans from the generated `/api/store-actions/plans` contract.
- Keep the panel read-only in this slice.
- Use response `meta` to show total/range and previous/next paging instead of
  hiding records behind a fixed first-page cap.
- If the current page becomes empty while `meta.total` still reports records,
  clamp back to the nearest earlier available page instead of showing a true
  empty-list state.
- Render `sourceDeepLink` only when it is a safe in-app path.
- Keep create/status/close/cancel UI for a later write-risk slice.
- Keep auth semantics, DB schema, API response shape, workflow inbox lifecycle,
  KPI scoring, checklist scoring, target approval, and broad redesign out of
  this slice.

Evidence:

- `admin-web/src/features/store-actions/api.ts`
- `admin-web/src/features/store-actions/StoreActionPlansPanel.tsx`
- `admin-web/src/pages/StoreTasksPage.tsx`
- `docs/evidence/store-action-v1b-store-tasks-list-v1.md`

## V1B Write UI Go/No-Go

The next Store Action step is not a broad lifecycle UI. It is a conditional GO
only for one create-only Store Tasks slice from existing KPI exception
candidates.

Decision:

- GO for `POST /api/store-actions/plans` frontend usage only when the source is
  an existing `kpi_exception` candidate.
- GO for one explicit create affordance with title, summary, due date, priority,
  and existing source context.
- GO for refetching the Store Action plan list and workflow inbox after a
  successful create.
- NO-GO for status, close, cancel, comments, attachments, notifications,
  escalation, non-KPI sources, new routes, DB migration, auth semantics,
  workflow state-machine changes, scoring rules, or API response-shape changes.

Evidence:

- `docs/evidence/store-action-v1b-write-ui-go-no-go-v1.md`

## V1B Create From KPI Candidate UI

The first write UI slice creates a persisted action plan only from an existing
KPI exception candidate on `/store/tasks`.

Decision:

- Use the generated `POST /api/store-actions/plans` frontend helper.
- Show one inline create form on KPI follow-up rows.
- Require title, summary, due date, and priority before submit.
- Keep `sourceType` fixed to `kpi_exception`.
- Refetch Store Action plans and workflow inbox after successful create.
- Keep 403/409/422-style failures local to the form.
- Keep status, close, cancel, comments, attachments, notifications, escalation,
  non-KPI sources, new routes, DB/auth/workflow/scoring/API-shape changes out of
  this slice.

Evidence:

- `docs/evidence/store-action-v1b-create-from-kpi-candidate-ui-v1.md`

## V1B Status Update UI

The second write UI slice updates only active persisted action-plan statuses on
`/store/tasks`.

Decision:

- Use the generated
  `PATCH /api/store-actions/plans/{actionPlanId}/status` frontend helper.
- Show one inline status form on persisted action-plan rows.
- Limit status choices to `open`, `in_progress`, and `blocked`.
- Allow an optional note, but do not add comments or history UI in this slice.
- Refetch Store Action plans and workflow inbox after successful status update.
- Keep failures local to the status form.
- Keep close, cancel, resolution notes, cancel reasons, comments, attachments,
  notifications, escalation, non-KPI sources, new routes,
  DB/auth/workflow/scoring/API-shape changes, and broad redesign out of this
  slice.

Evidence:

- `docs/evidence/store-action-v1b-status-update-ui-v1.md`

## V1B Close Resolution UI

The first terminal UI slice closes only an existing active persisted action plan
with a required resolution note.

Decision:

- Use the generated
  `PATCH /api/store-actions/plans/{actionPlanId}/close` frontend helper.
- Show one inline close form on active persisted action-plan rows.
- Require `resolutionNote` before submit.
- Refetch Store Action plans and workflow inbox after successful close.
- Keep failures local to the close form.
- Keep cancel, cancel reasons, reopen, comments, attachments, notifications,
  escalation, non-KPI sources, new routes, DB/auth/workflow/scoring/API-shape
  changes, and broad redesign out of this slice.

Evidence:

- `docs/evidence/store-action-v1b-close-resolution-ui-v1.md`

## V1B Cancel Reason UI

The final V1B terminal UI slice cancels only an existing active persisted action
plan with a required cancel reason.

Decision:

- Use the generated
  `PATCH /api/store-actions/plans/{actionPlanId}/cancel` frontend helper.
- Show one inline cancel form on active persisted action-plan rows.
- Require `cancelReason` before submit.
- Refetch Store Action plans and workflow inbox after successful cancel.
- Keep failures local to the cancel form.
- Keep reopen, delete, comments, attachments, notifications, escalation,
  non-KPI sources, new routes, DB/auth/workflow/scoring/API-shape changes, and
  broad redesign out of this slice.

Evidence:

- `docs/evidence/store-action-v1b-cancel-reason-ui-v1.md`

## Data Placement Draft

V1A read-only:

- `ops`: no new write.
- `stg`: no new write.
- `rpt`: read existing reporting/snapshot outputs only.
- `audit`: no new event unless a command is introduced.

V1B persisted action plans:

- `ops`: action-plan state, status, due date, owner, source reference.
- `audit`: create/update/close/cancel events.
- `rpt`: optional later summaries, never mutation source.
- `stg`: no action-plan state.

No additional migration should be added unless the next V1B kademe explicitly
needs it and has a rollback/migration-smoke plan.

## Access Model Draft

Read:

- Store manager reads assigned-store action candidates/plans.
- Region manager may later read stores in their region.
- Super admin may read all for support/audit.
- Store personnel self-view is not assumed in V1.

Write, later V1B:

- Store manager can create/update/close only within assigned action-store scope.
- Region manager may comment or review later only if explicitly scoped.
- Super admin support actions require a separate decision, not silent bypass.

Required negative cases for write work:

- assigned store succeeds,
- unassigned store is forbidden,
- read visibility does not imply action permission,
- completed/cancelled plans cannot be mutated unless a reopen policy is
  explicitly designed.

## Workflow And Inbox Contract

Action candidates:

- may be shown near source surfaces or Store Tasks,
- do not need to enter the shared inbox until a real actionable item exists.

Persisted action plans:

- `itemType`: `task`
- source family: action-plan source owned by Store Action
- inbox status maps from source lifecycle:
  - open/in-progress -> `needs_attention`
  - done/cancelled -> `completed`
  - future FYI-only state -> `informational`
- deep link should go to the action detail or owning source detail.

Do not model action plans as approvals by default.

## API Surface Draft

V1A read-only candidates, possible later endpoint:

- list action candidates for current actor.
- response should be additive and generated through OpenAPI.
- no command body.

V1B action plans, possible later endpoints:

- list action plans,
- get action plan detail,
- create action plan,
- update status,
- close with resolution note,
- cancel with reason,
- list audit/history.

No endpoint should be implemented before the first slice selects V1A or V1B.

## UI Surface Draft

V1A:

- may appear as a read-only candidate section in Store Tasks or the source
  performance surface.
- should use existing shell language and mobile-first queue reading.

V1B:

- Store shell owns day-to-day action work.
- Admin/operations may show summary count or blocked/overdue state later.
- Operations Control Tower should link to the owning surface rather than own
  action-plan detail.

The user has intentionally parked broad UI design for now. Do not use this spec
to polish screens or redesign layout.

## Verification Ladder

Docs/spec:

- `git diff --check`.
- Reader-test against this mini spec.

V1A read-only:

- targeted backend service or contract test if a backend read model is added,
- OpenAPI generate/client check if an endpoint is added,
- frontend lint/build and targeted Playwright if a surface changes,
- no auth/write tests unless a protected read scope changes.

V1B write:

- command validation tests,
- assigned/unassigned store action-scope tests,
- audit event tests,
- OpenAPI/client checks,
- targeted frontend E2E for create/status/close flows,
- broader backend gate if shared workflow or auth modules are touched.

## Explicitly Out Of Scope

- KPI scoring or threshold changes.
- Ranking sort changes.
- Checklist scoring, weight, or acknowledgement behavior changes.
- Target approval, target reference promotion, or target scoring behavior
  changes.
- Workforce approval/mutation changes.
- Incentive payout, reward eligibility, challenge logic, or point logic.
- Notifications, Slack/email delivery, escalation engine, SLA promises.
- AI coaching recommendations.
- Generic workflow engine.
- Generic rules engine.
- DB migration in the first docs/read-only slice.
- Broad UI redesign.

## First Implementation Slice Recommendation

First code slice should be V1A read-only candidate shaping, only after this spec
is accepted.

Smallest safe candidate:

- derive one read-only KPI action candidate from the existing KPI exception or
  store performance signal,
- keep it scoped to assigned store visibility,
- do not persist it,
- do not change KPI math,
- do not create a new workflow status,
- prove it with targeted backend/frontend tests matching the chosen surface.

If no existing signal can support a useful candidate without inventing new
business thresholds, stop and refine the source rule instead of coding.

Current status:

- Completed as a narrow read-only frontend model over existing workflow inbox
  KPI exception tasks.
- Current source guard keeps checklist receipt acknowledgements and target
  distribution approvals parked until their source-specific decisions are
  explicit.
- Checklist source decision keeps direct checklist receipts as
  acknowledgements; checklist-driven coaching can only come through the KPI
  exception path until direct low-score policy is explicit.
- Target source decision keeps target distribution requests as approvals and
  target coverage as target-domain readiness; target-driven coaching can only
  come through the KPI exception path until direct target source policy is
  explicit.
- Original safety rule: Persisted action plans are an explicit V1B NO-GO for
  casual implementation. They moved from NO-GO to approved V1B kademeleri only
  after the boundary/design/spec slices landed. The completed basic loop is:
  schema, lifecycle/audit, command boundary, API contract, workflow inbox
  source, Store Tasks list, create from KPI candidate, active status update,
  close with resolution note, and cancel with reason.
- Store Action test hygiene now separates plan lifecycle coverage into
  `admin-web/e2e/store-action-plans.spec.ts` and records the current visibility
  conditions for `/store/tasks`.
  Evidence: `docs/evidence/store-action-test-hygiene-and-visibility-v1.md`.
- The remaining Store Action work is not automatic continuation. Detail routes,
  comments, attachments, notifications, escalation, non-KPI source families,
  AI coaching copy, and live staging persona evidence all require a fresh
  decision and their own verification ladder.

## CODEX DURUST YORUM

This is the right next product direction, but only if the first slice is humble.

The product already measures many things. A follow-up loop is what turns it into
an operating system rather than a reporting shell. The danger is that Store
Action becomes a shadow workflow engine that reinterprets KPI, checklist,
target, workforce, and incentive logic.

The safe path is read-only candidates first, persisted plans second, inbox
integration third. If the first implementation needs new scoring rules,
approval semantics, notification delivery, or migration-heavy state before a
candidate is even useful, the slice is too big and should be reshaped.
