# Checklist Operational History contract checkpoint

Date: 2026-07-15
Scope: P4 additive read-only API only
Decision: GO without DDL after adversarial repair and disposable PostgreSQL proof

## Authoritative source lock

- `checklist_completed`: one logical event per completed BM/VM checklist instance. The earliest matching completion audit record supplies legacy actor/time truth when present; otherwise the immutable instance completion fields are used. Score, response, comment, auditor and audit metadata are excluded.
- `acknowledgement`: the first immutable `checklist_instance.acknowledged` audit event per checklist instance. The mutable acknowledgement note/row is not projected.
- `task_assigned`: one event from immutable action-plan creation fields, including plans later cancelled.
- `task_resolved`: one event only for `closed` action plans with real `closed_at`; cancellation is not presented as resolution.
- `visit_plan_revised`: one event per revision and affected store. The affected set includes both the current and previous revision so a removed store is not silently omitted. Repeated days for one store remain one revision event.

The store header comes from `ops.store`. The schema has no city/district truth, so both fields remain `null`.

## Role and existence-leak lock

- Report Viewer precedence applies in mixed sessions and uses only explicit Report Viewer company scope.
- Region Manager uses only explicit Region Manager region/store scope.
- Store Manager uses only explicit Store Manager store scope.
- Visual Merchandiser, Super Admin and unsupported personas receive no new history authority in P4.
- Empty scopes fail closed. Out-of-scope and nonexistent stores share the same not-found response.

## Actor-time lock

P4 never emits `captured`. A stable user link may produce `historical_projection` from the role assignment active at event time, ordered store, region, company, global and then stable role identity. Missing or malformed actor links produce `unknown`; the current store manager is never substituted. A literal captured identity snapshot requires a separately approved R5 schema/write slice.

## Privacy allowlist

Allowed response data is limited to store id/name/null location, four summary counts, opaque event id, kind, occurred time, server-owned Turkish title/detail, bounded actor projection, checklist visit type, task priority/due date, and plan week/revision. The response excludes scores, compliance, checklist answers/comments, acknowledgement notes, task title/summary/resolution/cancel notes, source ids/deep links, hashes, audit metadata, request/correlation/IP data, email, username, user/employee/auditor ids and personnel/business payloads.

## Cursor and performance lock

- Fixed page size is 20; the repository fetches 21 to derive `hasMore`.
- The versioned base64url cursor is bound to store id, normalized range and normalized kinds. It carries only the timestamp, kind rank and a one-way MD5 event key; raw source UUIDs are neither returned nor reversibly encoded.
- Stable keyset order and predicate are `occurred_at DESC, kind_rank DESC, event_key DESC`; offset pagination and client fetch-all are prohibited.
- Summary counts are all-history truth; range/kind filters affect timeline items only.
- The repository performs one fixed SQL roundtrip with scoped source unions and bulk actor projection. Per-event actor/store queries are prohibited.
- If measured long-history budgets fail on existing indexes, P4 stops and a separate R5 index PR is required. Tests and privacy rules must not be weakened.

## Verification contract

Adversarial coverage includes mixed-role precedence, empty and sibling scope rejection, store/filter cursor replay rejection, malformed cursor/kind rejection, one-query enforcement, 20/+1 pagination, allowlist serialization, unknown identity, and generated OpenAPI drift. No UI, DML, DDL, migration or production operation is part of this slice.

`npm.cmd run smoke:operational-history-api` rebuilt a localhost-only disposable database from all 61 migrations and exercised the actual repository SQL. It proved:

- 23 same-timestamp assigned-task events across two cursor pages with no gap or duplicate;
- raw source UUID absence from cursor bytes and serialized responses;
- store-scope isolation and generic missing-store behavior;
- earliest completion and acknowledgement audit selection;
- cancelled task retained as assigned but never resolved, with exactly one closed resolution;
- removed-store inclusion in revision 2 history;
- bulk actor projection with store-over-region precedence;
- one repository roundtrip against 5,023 assigned-task events, 26 ms bounded first-page time, 13 ms long-history service time and 15 ms in-scope PostgreSQL execution time, below the 1200 ms contract budget;
- in-scope `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` evidence with 85 plan nodes, 12,312 shared-hit blocks and zero shared-read blocks;
- unique private canaries for acknowledgement note, audit metadata, task title/summary, resolution/cancellation, source id/deep-link and account username/email absent from serialized output.

The adversarial NO-GO findings were repaired by source-scoping completion audit lookup, replacing per-event `LATERAL` actor lookup with one ranked bulk projection, and adding this executed PostgreSQL contract. No schema/index change was required.
