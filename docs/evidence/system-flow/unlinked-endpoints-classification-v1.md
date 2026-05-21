# Unlinked Backend Endpoint Classification V1

## Scope

This evidence note classifies the 34 backend endpoints that are present in the
source-derived system flow map but have no current frontend API call edge.

This is a static source-map classification, not live telemetry. It does not
prove endpoint traffic, latency, database load, or staging behavior.

## Sokrates Decision

Decision:

- Keep the endpoints in place and classify intent before deleting, surfacing,
  or instrumenting any of them.

Why now:

- The precision pass reduced route/API fanout from false preload edges. The
  remaining unlinked endpoints are now a useful product and operations signal
  instead of map noise.

Evidence:

- `docs/flows/store-ops-system-flow.json` reports 164 backend endpoints, 130
  matched frontend API calls, 0 unmatched frontend API calls, and 34 backend
  endpoints without frontend calls.
- The endpoints below are still present in OpenAPI, so this is not an API
  documentation drift problem.

Counterargument:

- Some endpoints may be used by scripts, external clients, future mobile work,
  or operator runbooks. A missing frontend edge is not proof that an endpoint is
  dead.

Risk:

- LOW for this docs-only classification.
- MEDIUM if a follow-up surfaces admin UI for currently hidden operational
  endpoints.
- HIGH if a follow-up deletes endpoints, changes auth semantics, or changes
  migration/import/snapshot/checklist behavior.

Door:

- This classification is a two-way door. Endpoint deletion, provider wiring,
  auth changes, and DB work are not.

Stop rule:

- Stop before changing endpoint behavior, response shape, auth/permission
  semantics, DB schema, provider config, scheduler behavior, or user workflows.

## Classification Summary

| Classification | Count | Meaning |
| --- | ---: | --- |
| Intentional external/provider | 1 | Health/provider endpoint intentionally has no app UI. |
| Mobile or field-client only | 9 | Endpoint belongs to mobile/session/field workflow, not current web UI. |
| Admin/operator only | 7 | Endpoint supports operational runbooks, release evidence, or hidden admin command paths. |
| Parked product/UI candidate | 12 | Endpoint is valid but needs an explicit product decision before surfacing. |
| Legacy/deprecation candidate | 5 | Endpoint appears superseded or compatibility-only; keep until usage is proven absent. |

## Endpoint Register

| Endpoint | Classification | Evidence | Next action |
| --- | --- | --- | --- |
| `GET /api/health/live` | Intentional external/provider | Public liveness endpoint in `backend/nestjs/src/shared/health.controller.ts`; separate from full `GET /api/health`. | Keep external-only; use provider/uptime checks, not app UI. |
| `POST /api/mobile/auth/sessions` | Mobile or field-client only | Mobile Auth/Session V1 is documented in `docs/plans/mobile-api-bff-endpoint-inventory-v1.md`; controller is `mobile-auth`. | Keep for mobile client; no admin/store web UI needed. |
| `GET /api/mobile/auth/session` | Mobile or field-client only | Requires mobile session guard; returns active mobile session context. | Keep for mobile client; validate only with real mobile/session evidence. |
| `GET /api/mobile/auth/sessions` | Mobile or field-client only | Mobile device session list endpoint; not a desktop admin surface. | Keep for mobile profile/session management. |
| `POST /api/mobile/auth/logout` | Mobile or field-client only | Mobile logout endpoint guarded by mobile session id. | Keep for mobile logout smoke; no web UI edge required. |
| `DELETE /api/mobile/auth/sessions/{sessionId}` | Mobile or field-client only | Own-session revoke endpoint under mobile auth. | Keep for future mobile session management. |
| `POST /api/mobile/checklists/instances/{checklistInstanceId}/acknowledge` | Mobile or field-client only | Mobile checklist controller exposes mobile namespace acknowledgement; current web store flow uses the canonical non-mobile acknowledgement endpoint. | Keep until mobile checklist client decision; do not duplicate UI. |
| `POST /api/checklists/instances` | Mobile or field-client only | Auditor-only checklist controller with `AUDITOR` role and store action scope; current web pilot uses mobile checklist today/read model. | Park as field/auditor client API; no current web UI. |
| `POST /api/checklists/instances/{checklistInstanceId}/responses` | Mobile or field-client only | Auditor-only response write path; covered by backend checklist flow tests, not current web UI. | Keep for field/auditor flow; revisit only with auditor app scope. |
| `POST /api/checklists/instances/{checklistInstanceId}/complete` | Mobile or field-client only | Auditor-only completion path; current store web receives completed results and acknowledges them. | Keep for field/auditor flow; no desktop UI in this line. |
| `POST /api/admin/migrations/run` | Admin/operator only | `MigrationsController` hides this endpoint when `httpMigrationEndpointEnabled` is false; CLI/CI migration path remains preferred. | Keep hidden; do not surface in UI without a production migration decision. |
| `GET /api/admin/migrations/status` | Admin/operator only | DB Health and Migration Evidence V1 records this read-only migration evidence surface. | Candidate for Operations Telemetry V1 read-only signal; no command UI. |
| `GET /api/integrations/import-batches` | Admin/operator only | Raw import batch list endpoint remains documented; current web uses overview, needs-action, and detail read models. | Keep as operator/API contract read; consider telemetry only if raw list remains useful. |
| `GET /api/integrations/import-batches/summary` | Admin/operator only | Operational monitoring contract references import batch summary. | Keep as operations summary source; possible telemetry input. |
| `GET /api/integrations/sources/due-schedule` | Admin/operator only | Integration controller exposes due schedule read for scheduled/provider orchestration. | Keep scheduler/provider-facing; do not make visible without source scheduling UI decision. |
| `GET /api/snapshots/runs` | Admin/operator only | Snapshot operations read model exists; current frontend uses overview/needs-action/detail instead of raw list. | Keep as operator/API contract read; possible telemetry input. |
| `POST /api/snapshots/runs` | Admin/operator only | Backend live/release smoke uses snapshot create; frontend currently avoids snapshot command creation. | Keep command path; only surface after snapshot operator command UX decision. |
| `GET /api/integrations/master-data-bootstrap/batches/{batchId}/rows` | Parked product/UI candidate | Master data bootstrap page exposes batch/detail/promotion evidence, but not the raw row list endpoint. | Candidate for row-level inspector if operators need it; require UI/product slice. |
| `POST /api/integrations/master-data-bootstrap/batches` | Parked product/UI candidate | Master-data bootstrap create endpoint exists, but real baseline upload/promotion evidence remains guarded. | Park until true baseline input and controlled smoke are available. |
| `GET /api/integrations/sources` | Parked product/UI candidate | Source management endpoints exist and are tested, but JSON/source-adapter work is currently suspended. | Keep parked until source management becomes active product scope. |
| `POST /api/integrations/sources` | Parked product/UI candidate | Same source-management boundary; creating sources would imply an active source lifecycle. | Do not surface while source-adapter work is suspended. |
| `GET /api/integrations/sources/{sourceId}/audit` | Parked product/UI candidate | Source audit exists, but there is no source management UI yet. | Surface only with source management UI. |
| `PATCH /api/integrations/sources/{sourceId}/schedule` | Parked product/UI candidate | Scheduling writes exist under integration source management. | Keep parked; scheduling UX needs explicit operations decision. |
| `PATCH /api/integrations/sources/{sourceId}/deactivate` | Parked product/UI candidate | Source lifecycle command exists under integration source management. | Keep parked; no hidden source lifecycle UI. |
| `PATCH /api/integrations/sources/{sourceId}/reactivate` | Parked product/UI candidate | Source lifecycle command exists under integration source management. | Keep parked; no hidden source lifecycle UI. |
| `GET /api/org/stores` | Parked product/UI candidate | Org store lookup has authenticated scope resolution and no current frontend edge. | Candidate shared lookup for future mobile/admin selector; needs route/use-case evidence. |
| `GET /api/snapshots/lookups` | Parked product/UI candidate | Snapshot lookups support command/filter setup; current UI uses overview/needs-action/detail. | Use only if snapshot operator command/filter UI is scoped. |
| `GET /api/snapshots/runs/summary` | Parked product/UI candidate | Snapshot summary exists in operational monitoring docs, but current UI uses richer overview. | Candidate telemetry/readiness input; do not add UI until needed. |
| `PUT /api/admin/feed/{feedPostId}` | Parked product/UI candidate | Admin feed supports create/publish/pin/archive in frontend; edit/update endpoint has no current UI edge. | Candidate admin feed edit slice; add only with clear moderation workflow. |
| `GET /api/integrations/import-batch-audit/{batchId}` | Legacy/deprecation candidate | API docs call it a legacy alias; current import detail uses nested batch audit route. | Keep compatibility for now; add deprecation/usage check before removal. |
| `GET /api/integrations/kpi-import-store-scope` | Legacy/deprecation candidate | Current admin store master surface uses `/api/integrations/store-master`; this endpoint delegates to similar store master data. | Treat as compatibility candidate; prove no external usage before removal. |
| `PATCH /api/integrations/kpi-import-store-scope/{storeId}` | Legacy/deprecation candidate | Current UI writes store master through `/api/integrations/store-master/{storeId}`. | Treat as compatibility candidate; prove no external usage before removal. |
| `GET /api/reports/leaderboards/closed` | Legacy/deprecation candidate | Monthly ranking evidence moved to current ranking surfaces; endpoint remains documented and used by backend/performance smoke paths. | Keep until compatibility/performance usage is replaced or explicitly retained. |
| `GET /api/workforce/headcount-gap` | Legacy/deprecation candidate | Backend auth-scope tests still cover it, but current store approvals/workforce UI no longer calls it. | Decide whether it belongs in future workforce planning or should enter deprecation review. |
## Follow-Up Decisions

Immediate:

- Use this register as input for Milestone 3 auth/role/scope overlay.
- Use admin/operator-only and parked telemetry candidates as input for
  Milestone 4 and Milestone 5.

Do not do yet:

- Do not delete legacy candidates in the same line as classification.
- Do not surface migration run, source lifecycle, snapshot command, or master
  data staging writes without a separate product/risk decision.
- Do not treat mobile/session/checklist endpoints as missing web UI.

Change-my-mind triggers:

- Runtime logs show active external clients using a legacy endpoint.
- A product route explicitly needs one parked endpoint.
- A provider/scheduler starts depending on one of the parked source endpoints.
- A backend test proves an endpoint is now unreachable or duplicate after a
  replacement path is fully adopted.
