# Project Growth Execution Roadmap V1

Status: active
Shelf: operating
Last verified: 2026-05-23

## Reader And Action

Reader:

- a future agent, engineer, product owner, or operator asked to advance the
  project beyond the current controlled pilot foundation.

After reading, they should know the exact order for the next eight growth
tracks, the smallest safe first slice for each track, and the stop rules that
prevent broad rewrites or hidden behavior changes.

## Sokrates Decision

These eight tracks are valid, but they are not one implementation unit.

Decision:

- execute them in order,
- keep only one product/risk track active at a time,
- open PRs only when the slice is reviewable and revertible,
- stop when a track needs real provider, production owner, UI redesign, or
  broad behavior decisions.

Why:

- the project is already fit for controlled pilot,
- the remaining value is visibility, feedback, data quality, coaching depth,
  and production operating posture,
- mixing all eight tracks into one branch would destroy reviewability and hide
  risk.

## Priority Order

| Order | Track | Current stance | First safe slice | What must not change |
| --- | --- | --- | --- | --- |
| 1 | Pilot Feedback Loop V1 | first frontend/backend loop merged | in-app feedback intake/read model for scoped pilot users | auth semantics, pilot status, broad issue tracker integration |
| 2 | Data Quality & Reconciliation Center V1 | active | read-only data-quality dashboard from existing import/snapshot/KPI/workforce signals | import lifecycle, KPI math, mapping approval behavior |
| 3 | Operations Telemetry / Control Tower V2 | next after data quality | real signal expansion on existing Operations Control Tower | external observability platform, provider config, alert semantics |
| 4 | Store Action -> Coaching Loop V2 | after feedback/data quality | action detail/history/comment design, then minimal comments/history slice | workflow state machine, KPI scoring, broad notification system |
| 5 | Role / Permission Preview UI | after coaching first slice or sooner if auth confusion appears | read-only role/route/scope preview using existing auth matrix | permission semantics, assignments, Clerk/provider behavior |
| 6 | Rules / Config Versioning | after role preview | inventory current domain-owned config/version sources and first read-only diff/audit surface | generic rule engine, shared workflow engine, scoring changes |
| 7 | Norm Kadro / Workforce Planning Read-Only V1 | after data quality + rules inventory | read-only staffing baseline spec and current workforce capacity inventory | write/config targets, auto action generation, approval flows |
| 8 | Production Ops Closure | after controlled-pilot feedback stabilizes | owner decision packet for Redis tier, backup/PITR/RPO/RTO, alerts, incident ownership | broad production Go claim without owner acceptance |

## Dependency Graph

1. Pilot Feedback Loop V1 produces real user findings.
2. Data Quality Center V1 separates data defects from product defects.
3. Operations Telemetry V2 separates runtime defects from data/product defects.
4. Coaching Loop V2 uses feedback and data-quality signals to deepen Store
   Action without inventing a generic workflow engine.
5. Role Preview UI reduces auth/scope drift before more roles and actions are
   added.
6. Rules/Config Versioning records rule ownership before future dynamic config
   work.
7. Norm Kadro Read-Only V1 depends on trustworthy workforce and KPI context.
8. Production Ops Closure should happen only after pilot feedback and operating
   signals prove the pilot path is stable enough to consider wider rollout.

## Hard Boundaries

Do not change auth, API response shape, DB, provider config, queue posture, KPI
scoring, checklist weights, import lifecycle, workflow semantics, or user-facing
behavior unless the active slice explicitly scopes the change and its
verification ladder.

Do not mix UI redesign with these tracks. UI redesign remains a separate user
started track.

## Track 1: Pilot Feedback Loop V1

Goal:

- capture pilot feedback inside the product and make it classifiable as
  `P0 stop`, `P1 pilot blocker`, `P2 pilot friction`, or `P3 backlog`.

Current status:

- Backend foundation merged in PR #479 with create/list/classify API, storage,
  OpenAPI coverage, audit events, and targeted backend tests.
- Frontend loop merged in PR #480 with generated client adoption, in-app
  feedback control, SUPER_ADMIN triage queue, and targeted Playwright coverage.

Source of truth:

- controlled pilot feedback log remains the operating record until the in-app
  loop is proven.

Slices:

1. Read/write boundary decision and schema/API shape.
2. Add minimal feedback submission endpoint for authenticated pilot actors.
3. Add admin read queue with classification fields.
4. Add a small frontend entry point on controlled pilot surfaces.
5. Add export/evidence linkage back to the controlled pilot feedback log.

First safe slice:

- a narrow in-app feedback intake with title, description, severity suggestion,
  route/context, actor role, and sanitized metadata.

Verification:

- backend targeted tests for create/list/classify authorization,
- generated OpenAPI check if endpoint is adopted by frontend,
- admin/store targeted Playwright for empty/create/list states,
- no raw token, cookie, or private data in evidence.

Stop rules:

- stop if it becomes a full ticketing system,
- stop if external issue tracker integration is requested,
- stop if feedback classification changes pilot go/no-go semantics without a
  decision.

## Track 2: Data Quality & Reconciliation Center V1

Goal:

- give operators one read-only place to see data defects and trust gaps across
  imports, mapping, snapshots, KPI sources, and workforce data.

First safe slice:

- read-only dashboard card set that reuses existing import quality issue
  summaries and snapshot freshness signals.

Active slice:

- `/admin/data-quality` read-only center for SUPER_ADMIN using existing import,
  snapshot, workforce, KPI config, and ranking reads. The page is an operator
  trust separator, not a repair workflow.

Verification:

- no import lifecycle or mapping approval change,
- backend read-model tests if a new aggregate endpoint is needed,
- frontend Playwright for empty/healthy/degraded states.

Stop rules:

- stop if the slice wants to repair data automatically,
- stop if it changes KPI math or source trust rules,
- stop if it needs a new source adapter.

## Track 3: Operations Telemetry / Control Tower V2

Goal:

- turn the existing Operations Control Tower into a real operator surface for
  health, queue, import, snapshot, workflow, and data freshness signals.

First safe slice:

- add one additional real signal family to the existing tower and document its
  freshness/staleness meaning.

Verification:

- no provider config change,
- no claim of live telemetry unless backed by runtime or public staging proof,
- targeted operations page test.

Stop rules:

- stop if it becomes a generic observability platform,
- stop if it changes alert delivery semantics,
- stop if it requires production secrets.

## Track 4: Store Action -> Coaching Loop V2

Goal:

- evolve Store Action from action-plan commands into a coaching loop with
  context, ownership, history, comments, evidence, escalation, and later
  notifications.

First safe slice:

- action detail/history/comments decision doc, then minimal comment/history
  read/write if the decision is accepted.

Verification:

- assigned-store scope remains enforced,
- action status semantics remain unchanged,
- command tests cover comments/history access.

Stop rules:

- stop if it becomes a generic workflow engine,
- stop if notifications or escalation require provider decisions,
- stop if non-KPI sources are pulled in without source decisions.

## Track 5: Role / Permission Preview UI

Goal:

- allow admins to preview which role/scope can see routes and actions without
  changing assignments.

First safe slice:

- read-only route/role matrix view using existing route and auth decision data.

Verification:

- no auth assignment mutation,
- no role policy changes,
- route matrix tests and one admin page Playwright.

Stop rules:

- stop if preview output is treated as the authorization engine,
- stop if Clerk/provider behavior is changed,
- stop if permissions are edited from the preview.

## Track 6: Rules / Config Versioning

Goal:

- make domain-owned rules and configs auditable before future dynamic config
  work.

First safe slice:

- inventory current KPI config, checklist weights, target approval rules,
  Store Action rules, competition rules, and ownership boundaries.

Verification:

- docs/contract guard first,
- if code follows, read-only version/audit surface only,
- no scoring or approval behavior changes.

Stop rules:

- stop if a generic rule engine is proposed,
- stop if multiple domains are merged into shared mutable config,
- stop if historical rule replay is required before the source is stable.

## Track 7: Norm Kadro / Workforce Planning Read-Only V1

Goal:

- expose staffing baseline and capacity context without changing workforce
  approval or Store Action behavior.

First safe slice:

- read-only inventory/spec mapping current workforce data to staffing baseline
  needs.

Verification:

- no write/config screens,
- no automatic Store Action generation,
- no target approval behavior changes.

Stop rules:

- stop if baseline ownership is unclear,
- stop if it needs labor-law/business policy inputs,
- stop if it starts assigning headcount targets.

## Track 8: Production Ops Closure

Goal:

- close the remaining broad-production operational decisions with owner
  acceptance and sanitized evidence.

First safe slice:

- decision packet checklist for Redis tier, Supabase backup/PITR/RPO/RTO,
  alert escalation, incident ownership, and rollback authority.

Verification:

- no broad production Go without owner acceptance,
- no provider secrets in docs,
- live evidence is separated from docs-only decisions.

Stop rules:

- stop if production provider input is missing,
- stop if Free-tier risk is accepted without written owner decision,
- stop if incident ownership is unclear.

## PR Rhythm

Use this rhythm for every track:

1. Scout: inspect repo/evidence for the narrow surface.
2. Decide: record claim, assumption, evidence, counterargument, risk, door,
   stop rule, and verification ladder.
3. Build: implement the smallest useful slice.
4. Verify: run local gates that match blast radius.
5. Review: open PR only when the slice has one review story.
6. Merge: wait for green checks, mergeability, and Codex no-major/thumbs-up.
7. Handoff: update this roadmap, registries, or evidence only if direction
   changes.

## Definition Of Done For The Eight-Track Line

The line is done when:

- pilot feedback can be captured and classified without leaving the system,
- data quality defects are visible in one read-only operator surface,
- operations signals distinguish runtime, queue, import, snapshot, and
  workflow pressure,
- Store Action supports the next coaching-loop slice without breaking current
  manager action commands,
- admins can preview role/scope visibility safely,
- rule/config ownership is visible before dynamic config expansion,
- Norm Kadro has a read-only go/no-go decision and first inventory path,
- broad-production ops decisions are either accepted with evidence or parked as
  explicit owner blockers.

It is not done when:

- a doc says a thing is ready but runtime/provider evidence is missing,
- a broad module was started without source-of-truth and rollback rules,
- UI redesign work is mixed into these tracks,
- production Go is claimed without owner acceptance.
