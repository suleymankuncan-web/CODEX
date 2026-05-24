# Command Chain Intelligence Source Map V1

Status: active
Shelf: operating
Last verified: 2026-05-24

## Reader And Action

Reader:

- a future agent, engineer, or product owner deciding whether Command Chain
  Intelligence is safe to turn into a read-only admin/region surface.

After reading, they should be able to choose the first safe source-linked
Command Chain slice, know which claims are allowed, and stop before the work
becomes advice, escalation, scoring, auth, workflow, or dashboard redesign.

## Sokrates Decision

Claim:

- Command Chain Intelligence should start as a source map, not as a new
  dashboard. The project already has enough signals to explain why a store may
  need attention, but those signals must keep their original source owner,
  scope, freshness, and proof label.

Assumptions:

- Daily Command Brief V1 has established the first safe source vocabulary:
  source family, source route, severity label, freshness/pending state, and
  role visibility reason.
- The first Command Chain user is an operator with admin, reporting, or region
  responsibility, not store personnel.
- Existing store, reporting, workflow, operations, import, snapshot, Store
  Action, target, and checklist sources are enough for a read-only pilot.

Repo evidence:

- Daily Command Brief V1 is implemented as a read-only `/store/home` source
  summary with no new backend, auth, DB, scoring, or workflow behavior.
- Operations, data-quality, system-flow, role/scope, Store Action, and pilot
  evidence docs already separate static dependency evidence from live telemetry.
- Store Action source guard decisions already prevent direct checklist or
  target reinterpretation outside their approved boundaries.
- The system-flow bottleneck line already warns that dependency fanout is not
  request volume and cannot prove live pressure by itself.

Counterargument:

- A visible command-chain page would feel more valuable than another doc, but
  building it before the source map risks creating a beautiful page that mixes
  proof, interpretation, and workflow ownership.

Risk:

- LOW for this docs-only source map.
- MEDIUM for a later read-only admin/region panel, because labels can still
  overstate what the source proves.
- HIGH for automatic escalation, notification, scoring changes, workflow state
  changes, auth shortcuts, or AI-generated recommendations.

Door:

- Two-way for docs, source vocabulary, and a read-only derived list.
- One-way-ish for persisted command history, escalation rules, notification
  provider behavior, permission changes, or business-score interpretation.

Decision:

- Proceed only with source-linked read-only Command Chain work.
- Do not create a new command center, rules engine, alerting flow, or advice
  layer in V1.
- The next safe code slice, if chosen later, is a small read-only reason model
  over existing fetched sources.

## Command Chain Contract

Command Chain Intelligence answers one question:

- "Why does this store need attention, and which existing source proves it?"

It must not answer these questions in V1:

- "Who is at fault?"
- "What should the system automatically escalate?"
- "Which store is objectively better after new scoring math?"
- "Which employee should be coached by AI?"
- "Which workflow state should change?"

Every item must carry:

- source family,
- source route or surface,
- role/scope visibility reason,
- freshness or pending state,
- proof label,
- owner or next human surface when available,
- an explicit limitation if the source is incomplete, stale, preview-only, or
  docs-only evidence.

## Source Vocabulary

| Source family | Existing product surface | Safe claim | Unsafe claim | First safe Command Chain use |
| --- | --- | --- | --- | --- |
| Import and integration quality | Admin integrations, import detail, data-quality center, operations health | Latest import status, row/error posture, needs-action pressure, source lineage availability | Provider truth, business correctness, or final KPI correctness without snapshot/reporting proof | Explain that store/reporting data may be stale or blocked because import evidence needs attention. |
| Snapshot and reporting freshness | Admin snapshots, reports, operations freshness signals | Latest materialized run, dependency posture, reporting period, row-count readiness | Real-time store performance or final business cause without report source | Explain whether the latest KPI/ranking/checklist facts are current enough to trust. |
| KPI and rankings | Store KPI, store rankings, admin reports, KPI config evidence | A store/person has a visible score, rank, config/source period, or KPI exception state | New scoring math, causal diagnosis, or performance judgement beyond the configured model | Show a source-linked reason that a store is below target, has a KPI exception, or needs review. |
| Workflow inbox | Admin/store inbox and Store Action task sources | There is pending work, urgency, source type, source entity, and assigned surface | Source-domain policy, automatic ownership, or completed lifecycle beyond the source | Link the attention reason to a queue item without changing its state. |
| Store Action plans | Store tasks and action-plan lifecycle | A persisted plan exists, is open/blocked/closed/canceled, has due date/status/source context | New plan creation, automatic status change, or coaching conclusion | Show that an existing follow-up plan is the current human next step. |
| Checklist | Store checklist surfaces and reporting checklist rows where allowed | An allowed role can see checklist queue/result/acknowledgement or reporting rows | Checklist scoring changes, personnel checklist exposure, or direct coaching from raw receipt | Use only for roles already allowed; direct checklist receipts remain parked as Store Action sources. |
| Targets | Store/admin target surfaces and approval queues | Target approval/coverage/request state is visible for allowed roles | Target approval policy change, recalculation, or direct coaching from raw target state | Link to target gaps only as source evidence, not as a new action policy. |
| Workforce | Workforce queues, personnel reads, norm-planning evidence | Queue pressure, assignment/scope visibility, or headcount gap evidence already exposed | HR decision automation, scheduling, payroll, or mutable norm planning | Explain staffing pressure as context only when the current role can see it. |
| Auth and scope | Session/auth admin, route matrix, protected persona evidence | Which role/scope/action-store can see a route or endpoint | Permission bypass, support-only access, or role remapping | Attach role visibility reason to every Command Chain item. |
| Operations telemetry | Operations control tower, health, readiness, data-quality evidence | Public/staging health, freshness, queue, readiness, and known blocker posture | Live traffic volume, latency SLO, DB query cost, or provider delivery unless separately proven | Flag whether an item is backed by live evidence, docs-only evidence, or blocked provider input. |
| Feed and pilot feedback | Store feed and pilot feedback evidence | A published/internal message or feedback item exists | Product commitment, release guarantee, or action ownership without triage | Use as supporting context, not as primary operational proof. |

## Role And Scope Rules

| Role family | Allowed V1 posture | Must not expose |
| --- | --- | --- |
| Super admin and HR admin | Company-wide source-linked read-only reasons, with links to existing admin/reporting/operations surfaces. | Hidden support bypasses, raw secrets, or provider-only evidence. |
| Region manager | Region-scoped store attention reasons and source links where current routes already allow access. | Company-wide hidden sources or cross-region private store detail. |
| Report viewer | Reporting and inbox-readable reasons without command buttons. | Admin/auth/integration command surfaces or Store Action lifecycle commands. |
| Store manager | Own-store reasons and existing Store Action/workflow/checklist/target surfaces. | Other-store reasons or direct checklist/target reinterpretation outside approved surfaces. |
| Store personnel | Personal brief, own performance/ranking/feed context, and explicitly allowed read-only tasks. | Checklist execution/result queues, command-chain management, or coaching conclusions. |

## Reason Item Shape

The later read-only model should use a compact shape similar to this:

```text
reasonId
storeId / storeLabel
sourceFamily
sourceSurface
sourceEntityId when safe
roleVisibilityReason
scopeLabel
severityLabel
freshnessLabel
proofLabel
ownerSurface
statusLabel
limitation
```

Rules:

- `proofLabel` must name what the item proves, not what the user should feel.
- `limitation` is required when the source is stale, preview-only, blocked,
  docs-only, or missing a live provider input.
- `sourceEntityId` must not leak provider subjects, raw tokens, private auth
  data, or sensitive identifiers.
- If the model cannot name the source family and visibility reason, the item is
  not eligible for V1.

## First Safe Implementation Slice

If Command Chain becomes the next product slice, start with one of these:

1. Docs/evidence-only audit of real source examples from staging.
2. Pure frontend helper that maps already-fetched operations/data-quality,
   workflow, Store Action, and reporting inputs into read-only reason items.
3. A minimal admin/region read-only list that displays those reason items with
   source links and limitations.

Preferred first code slice:

- a pure helper plus targeted tests, with no new backend endpoint and no new
  route until the helper proves the vocabulary works.

Do not start with:

- a new dashboard route,
- a new backend aggregator,
- a new DB table,
- a workflow mutation,
- notification/escalation,
- auth role changes,
- KPI/checklist/target scoring changes,
- AI summaries.

## Stop Rules

Stop and split the work if:

- a reason cannot cite an existing source family and product surface,
- the slice needs a new command, DB migration, auth rule, provider config, or
  API response change,
- checklist data would become visible to store personnel,
- target or checklist sources are reinterpreted as direct coaching policy,
- fanout/static dependency evidence is being treated as live traffic,
- source labels imply causation without proof,
- a single PR cannot be explained as one read-only source-linking change.

## Verification Ladder

Docs-only source-map work:

1. `git diff --check`.
2. `npm.cmd run test:scripts`.

Later frontend helper work:

1. Pure helper tests if the model is extracted.
2. Admin lint and build.
3. Targeted Playwright for allowed roles and forbidden roles.
4. System-flow generation only if route/API reachability changes.

Later backend/API work:

1. Separate go/no-go decision.
2. OpenAPI generation and API drift check.
3. Targeted backend tests for scope, response shape, and redaction.
4. No merge without proving unchanged auth semantics.

## Next Decision

Current recommendation:

- Keep Command Chain Intelligence in source-map mode until a real pilot question
  asks for admin/region "why this store needs attention" visibility.

When that happens, choose the pure helper slice first. The helper should be
small enough to delete if the vocabulary feels wrong, and strict enough that it
cannot invent advice from partial evidence.
