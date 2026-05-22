# Store Action Read-Only Candidates V1

## Scope

This evidence records the first Store Action / Coaching Loop V1 implementation
slice.

It does not add a new endpoint, DB table, migration, workflow state machine,
auth rule, KPI scoring rule, checklist rule, target approval rule, notification,
or write command.

## Sokrates Decision

Decision:

- Treat existing workflow inbox KPI exception tasks as the first read-only Store
  Action candidate source.
- Do not create `/api/store-actions/candidates` yet.
- Keep candidate visibility on `/store/tasks`, derived from the already scoped
  `/api/workflow/inbox` payload.

Why now:

- The project already emits KPI exception `task` items from the shared workflow
  inbox.
- Store Action V1A needs proof that a useful candidate can exist without a new
  source of truth.
- A duplicate endpoint would add API/OpenAPI and generated-client pressure
  before there is a second consumer or a persisted action-plan model.

Repo evidence:

- `WorkflowInboxService` reads the latest completed KPI snapshot through
  `SnapshotReportingReadRepository.getKpiReport`.
- KPI rows with `status_band` equal to `at_risk` or `off_track` are mapped to
  `sourceType: "kpi_exception"` and `itemType: "task"`.
- Store-manager KPI exception scope is already limited to assigned stores by
  `workflow-inbox.service.spec.ts`.
- `/store/tasks` already renders workflow inbox items and links KPI exceptions
  to `/store/kpis`.
- The fanout audit classifies `/store/tasks` as MEDIUM-LOW initial load risk
  because it uses a guarded workflow inbox read plus conditional prefetches.

Counterargument:

- A dedicated Store Action endpoint would make the feature boundary more
  explicit. That becomes useful when there is a second candidate source, a
  dedicated detail page, or persisted action-plan state. It is premature for
  the first KPI-only read slice.

Risk:

- LOW for the frontend helper and evidence update.
- MEDIUM if future code treats every workflow `task` as a Store Action
  candidate without checking source type and status.
- HIGH if future work adds write state, SLA thresholds, notifications,
  escalation, or audit events without a separate V1B decision.

Door:

- Two-way door. The helper can be removed or replaced by a generated Store
  Action client later.
- A persisted action-plan table and commands would be a medium-door decision.

Stop rule:

- Stop before adding a new Store Action endpoint unless there is a second
  consumer or the candidate list needs data not present in workflow inbox.
- Stop before adding write behavior until V1B has explicit auth, audit, data
  placement, and workflow/inbox decisions.

## Candidate Inventory

| Candidate source | Current repo source | V1A decision | Why |
| --- | --- | --- | --- |
| KPI exception | `/api/workflow/inbox` items with `sourceType: "kpi_exception"`, `itemType: "task"`, and `inboxStatus: "needs_attention"` | Active first candidate source. | Existing snapshot/status-band signal, assigned-store scope, no new DB or KPI math. |
| Checklist low score | Checklist acknowledgement/read models | Parked for later V1A. | Needs a clear low-score threshold and acknowledgement boundary before becoming an action candidate. |
| Target coverage/miss | Target distribution and approval surfaces | Parked for later V1A/V1B. | More sensitive because target approval and scoring-reference semantics must not change. |
| Workforce/headcount | Workforce queues and headcount gap reads | Parked. | Good future source, but must not mutate seller-code/offboarding behavior. |
| Incentive/challenge | Intake/spec only | Parked. | No payout, reward, challenge, or point logic in Store Action V1A. |

## Boundary Decision

Operating mode:

- `read-only feature`.

Owner:

- Store Action / Coaching Loop V1 owns candidate interpretation.
- Workflow inbox owns shared queue normalization.
- Reporting/KPI owns KPI snapshot facts and score/status meaning.

Source of truth:

- KPI snapshot/reporting status bands remain the source facts.
- Store Action reads those facts through workflow inbox and does not reinterpret
  score math, thresholds, status bands, or target values.

Data placement:

- `ops`: no new action-plan state in V1A.
- `rpt`: existing KPI snapshot/reporting read models remain the source.
- `audit`: no new event because no command exists.
- `stg`: no new raw/import state.

Auth and scope:

- Existing `/api/workflow/inbox` auth remains unchanged.
- Store managers see assigned-store KPI candidates through existing
  `actorActionScope.assignedStoreIds`.
- Super admin/report viewer broad reads remain governed by existing workflow
  inbox rules.

Workflow/inbox:

- Candidate source is `kpi_exception`.
- Candidate work type is `task`, not approval.
- Store Action V1A does not add a new source status or inbox status.

API/OpenAPI:

- No new API contract in this slice.
- A dedicated generated client should be introduced only when Store Action has
  its own endpoint or detail shape.

Operations:

- No new Operations Control Tower signal in this slice.
- Existing workflow inbox pressure remains the operations-level summary.

UI:

- `/store/tasks` remains the owning surface for read-only candidate visibility.
- The new frontend helper narrows KPI follow-up counts to actual read-only
  Store Action candidate items rather than every future workflow task.

## Verification

Required for this slice:

- `git diff --check`
- `npm.cmd run test:scripts`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- targeted Playwright for `/store/tasks`

No backend gate is required unless backend code changes.

## Next Decision

Do not move to persisted action plans automatically.

The follow-up source guard is recorded at
`docs/evidence/store-action-source-guard-v1.md`. It keeps checklist receipt
acknowledgements and target distribution approvals parked until their
source-specific decisions are explicit.

The next Store Action decision should choose one of:

1. add checklist low-score candidates after threshold ownership is explicit,
2. add target/coverage candidates after target semantics are protected,
3. introduce a dedicated Store Action read endpoint only if candidate data no
   longer fits workflow inbox,
4. start V1B persisted action-plan shaping with DB/auth/audit/workflow decisions.
