# Operational Observability Review

Status: phase_6_closed_next_phase_parked
Last verified: 2026-05-24

## Anchor

This review corresponds to the `Operational observability review` item in
[phase-6-closeout-checklist.md](./phase-6-closeout-checklist.md).

## What Was Reviewed

- request correlation id propagation
- audit event mapping
- import retry trace visibility
- snapshot rerun trace visibility
- admin frontend audit entry points
- auth user and role-assignment audit detail pages
- audit center recent trace visibility

## Confirmed Strengths

- request correlation ids are created or forwarded in middleware
- response headers expose `x-correlation-id`
- request completion logs include:
  - correlation id
  - path
  - status code
  - duration
  - actor user id
- import retry and snapshot rerun flows both write audit events with
  correlation metadata
- import and snapshot detail pages already surface audit timelines and
  correlation ids
- auth user audit detail pages surface `eventLogId`, `correlationId`, changed
  fields, source module, and source operation
- auth role-assignment audit detail pages surface `eventLogId`,
  `correlationId`, changed fields, source module, and source operation
- audit center now includes a recent trace panel with correlation id visibility
  for auth user and role-assignment events

## Phase 6 Findings

### 1. Auth Audit Pages Do Not Surface `correlationId`

Status: Closed

Resolution:

- `admin-web/src/pages/AuthUserAuditPage.tsx` displays
  `authAuditDetails.correlationId` with a fallback when an event has no
  correlation id.
- `admin-web/src/pages/AuthAssignmentAuditPage.tsx` displays the same field.
- This gives operators a direct UI-to-log join key for auth mutations without
  changing API shape or audit semantics.

Guard:

- `scripts/observability-contract.test.mjs` checks these page contracts.

### 2. Audit Center Is A Navigation Hub, Not A True Audit Control Surface

Status: Partially closed for Phase 6; parked for next phase

Closed for Phase 6:

- `admin-web/src/pages/AuditCenterPage.tsx` includes a recent trace panel.
- The panel links to the relevant auth audit detail page and displays the event
  type, actor, timestamp, and correlation id or fallback.
- This is sufficient as an operator entry point for controlled pilot.

Parked for next phase:

- a backend-wide audit feed endpoint filtered by entity, event type, actor, and
  correlation id
- cross-domain grouping of multiple events under one correlation id

Do not build the backend-wide feed until real pilot usage shows the recent trace
panel is not enough. It would be a new read model/API surface and should not be
mixed into docs-only or small observability hygiene work.

## Recommendation

Controlled pilot:

- rely on the existing request logs, correlation headers, auth audit detail
  pages, import/snapshot traces, and audit center recent trace panel
- keep the current log-only application observability posture
- keep app-level external error tracking behind the P0 trust operations
  provider/owner/redaction decision

Next phase only if pilot asks:

1. Define the read scope for a backend-wide audit feed.
2. Prove which roles can see cross-domain audit rows.
3. Add generated OpenAPI client/types.
4. Add frontend entry only after the API/read model is accepted.

## Review Outcome

Observability is functional and good enough for controlled pilot operations.
The remaining work is not a current bug; it is a future read-model decision for
broader audit investigation.
