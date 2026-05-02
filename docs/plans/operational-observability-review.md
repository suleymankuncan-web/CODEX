# Operational Observability Review

## Anchor
This review corresponds to the `Operational observability review` item in [phase-6-closeout-checklist.md](./phase-6-closeout-checklist.md).

## What Was Reviewed
- request correlation id propagation
- audit event mapping
- import retry trace visibility
- snapshot rerun trace visibility
- admin frontend audit entry points

## Confirmed Strengths
- request correlation ids are created or forwarded in middleware
- response headers expose `x-correlation-id`
- request completion logs include:
  - correlation id
  - path
  - status code
  - duration
  - actor user id
- import retry and snapshot rerun flows both write audit events with correlation metadata
- import and snapshot detail pages already surface audit timelines and correlation ids

## Findings

### 1. Auth audit pages do not surface `correlationId`
Severity: Medium

Backend audit responses already include `correlationId`, but the auth user and auth assignment audit pages do not display it.

Impact:
- operators can inspect auth mutation history
- but they cannot easily correlate one auth action with request logs or other traces from the UI

Affected files:
- `admin-web/src/pages/AuthUserAuditPage.tsx`
- `admin-web/src/pages/AuthAssignmentAuditPage.tsx`

### 2. Audit center is a navigation hub, not a true audit control surface
Severity: Medium

The current audit center is useful as an entry point, but it is not yet a unified operational audit feed.

Impact:
- good for jumping into known detail pages
- weak for answering:
  - what changed most recently across the system
  - which actions shared a correlation id
  - which actor triggered the last critical mutations

Affected file:
- `admin-web/src/pages/AuditCenterPage.tsx`

## Recommendation
- short-term:
  - add `correlationId` visibility to auth audit pages
  - add a small “recent trace” strip or latest-event summary in audit center
- next phase:
  - consider a backend-wide audit feed endpoint filtered by:
    - entity
    - event type
    - actor
    - correlation id

## Review Outcome
Observability is functional and already good enough for import/snapshot operations.
It is not yet fully uniform across auth and cross-module operator workflows.
