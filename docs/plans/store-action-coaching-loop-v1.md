# Store Action / Coaching Loop V1

## Status

- State: `shaping`
- Implementation: not approved yet
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

No migration should be added until V1B is explicitly selected.

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
