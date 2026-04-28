# Mobile API/BFF Endpoint Inventory V1

## Purpose

This document decides which existing backend endpoints a future mobile app can reuse and where a mobile-specific aggregate endpoint is justified.

The goal is to avoid opening a broad Mobile BFF too early. Mobile Auth/Session V1 P0 already exists, but Mobile BFF remains a separate phase.

## Decision Summary

- Do not create a broad Mobile BFF yet.
- Keep Mobile Auth/Session separate from Mobile BFF.
- Reuse existing endpoints for the first mobile pilot when a screen needs one or two stable calls.
- Add a mobile aggregate endpoint only when a mobile screen would otherwise require three or more coordinated calls, repeated role/scope interpretation, or cross-module orchestration.
- Do not duplicate existing competition, feed, workforce, reporting, or auth business logic under `/api/mobile`.

## Current Backend Surfaces

Auth and mobile session:

- `GET /api/auth/bootstrap`
- `GET /api/auth/session`
- `POST /api/mobile/auth/sessions`
- `GET /api/mobile/auth/session`
- `GET /api/mobile/auth/sessions`
- `POST /api/mobile/auth/logout`
- `DELETE /api/mobile/auth/sessions/:sessionId`

Feed and workflow:

- `GET /api/feed`
- `GET /api/workflow/inbox`

Reports and performance:

- `GET /api/reports/kpi-config`
- `GET /api/reports/store-kpi-highlights`
- `GET /api/reports/my-performance`
- `GET /api/reports/leaderboards/closed`
- `GET /api/reports/snapshot-runs`
- `GET /api/reports/kpis`

Checklist:

- `POST /api/checklists/acknowledgements/list`
- `POST /api/checklists/instances/:id/acknowledge`
- Auditor write flow exists for creating, responding, and completing checklist instances.

Competition:

- `GET /api/competitions`
- `GET /api/competitions/:competitionId`

Workforce and approvals:

- `GET /api/workforce/seller-code-reference`
- `GET /api/workforce/seller-code-requests`
- `POST /api/workforce/seller-code-requests`
- `PATCH /api/workforce/seller-code-requests/:id/approve`
- `PATCH /api/workforce/seller-code-requests/:id/reject`
- `PATCH /api/workforce/seller-code-requests/:id/resubmit`
- `GET /api/workforce/position-options`
- `GET /api/workforce/store-employees`
- `GET /api/workforce/offboarding-requests`
- `POST /api/workforce/offboarding-requests`
- `PATCH /api/workforce/offboarding-requests/:id/approve`
- `PATCH /api/workforce/offboarding-requests/:id/reject`
- `PATCH /api/workforce/offboarding-requests/:id/resubmit`

Target distribution:

- `GET /api/target-distributions/store-personnel`
- `GET /api/target-distributions/requests`
- `POST /api/target-distributions/requests`
- `PATCH /api/target-distributions/requests/:requestId/approve`

## Mobile Screen Inventory

| Mobile screen | V1 decision | Existing endpoint coverage | BFF status |
| --- | --- | --- | --- |
| Login/session | Reuse existing auth/session | `/auth/bootstrap`, `/auth/session`, `/mobile/auth/*` | No BFF |
| Home | Needs aggregate after UI shape is known | Feed, workflow, performance, ranking each exist separately | Candidate: `GET /api/mobile/home` |
| Tasks/inbox | Reuse first | `/workflow/inbox` | No BFF in V1 |
| Store performance | Reuse for pilot, aggregate soon if mobile page mirrors web | `/reports/store-kpi-highlights`, `/reports/kpi-config`, `/reports/snapshot-runs`, `/reports/kpis` | Candidate: `GET /api/mobile/store-performance` |
| My performance | Reuse first | `/reports/my-performance`, `/reports/kpi-config`, `/reports/snapshot-runs` | Candidate only if mobile needs one payload |
| Rankings | Reuse first | `/reports/leaderboards/closed`, `/reports/kpi-config` | No BFF in V1 |
| Feed/community | Reuse first | `/feed` | No duplicate mobile feed engine |
| Competitions | Reuse first | `/competitions`, `/competitions/:competitionId` | No duplicate competition engine |
| Store approvals/personnel | Reuse first | Workforce endpoints already own approval rules | No BFF until mobile form UX is clear |
| Checklists today | Needs product shape before coding | Current surface is action/report heavy, not a mobile daily read model | Candidate: `GET /api/mobile/checklists/today` |
| Profile/session devices | Reuse mobile auth/session | `/mobile/auth/session`, `/mobile/auth/sessions`, logout/revoke endpoints | No BFF |

## Recommended Mobile Aggregate Candidates

### P1: `GET /api/mobile/home`

Use when the mobile home screen is defined.

Likely response sections:

- current user/session summary from the existing auth context
- primary assigned store summary
- pinned feed preview
- workflow inbox preview
- one KPI headline card
- one ranking or competition headline

Why it is justified:

- The home screen would otherwise call feed, workflow, reports, and possibly rankings.
- This is mobile-specific composition, not new business logic.

Guardrails:

- It must call existing services/repositories.
- It must not create new score, feed, or workflow rules.
- It must keep DB role/read/action scope checks canonical.

### P1: `GET /api/mobile/store-performance`

Use if the mobile store performance screen follows the web store KPI page.

Likely response sections:

- store KPI highlights
- active KPI config labels/weights
- current period metadata
- optional closed snapshot selector metadata

Why it is justified:

- The web store KPI page already coordinates several report calls.
- Mobile benefits from one compact, cacheable payload.

Guardrails:

- It must not recalculate KPI rules outside the reporting application layer.
- It must keep source semantics and score confidence copy aligned with existing reports.

### P1/P2: `GET /api/mobile/me/performance`

Use only after the first mobile personal performance screen proves it needs a single payload.

Likely response sections:

- my performance summary
- KPI config labels/weights
- available periods

V1 can reuse existing endpoints first.

### P1: `GET /api/mobile/checklists/today`

Use only after the checklist mobile workflow is clarified.

Why it is not ready to code immediately:

- Current checklist endpoints are good for acknowledgement, auditor actions, and reports.
- A mobile daily checklist screen needs a clear read model: today, due, status, assigned role, store scope, and action availability.

Required decisions before implementation:

- Which roles see daily checklist tasks?
- Does store manager only acknowledge completed checklist instances, or also execute checklist items?
- How are BM and VM checklist monthly requirements represented on mobile?
- Does checklist visibility use store assignment, region assignment, or checklist ownership?

## Endpoints Not To Build In V1

- Do not build `/api/mobile/feed` unless feed payload becomes mobile-specific.
- Do not build `/api/mobile/competitions` unless list/detail payloads become too heavy.
- Do not build mobile-specific admin endpoints.
- Do not build a duplicate ranking engine under mobile.
- Do not build backend-owned refresh-token broker as part of BFF.
- Do not build push notification delivery as part of BFF.

## P0/P1/P2 Priority

P0:

- Keep Mobile Auth/Session V1 P0 as the only mobile-specific backend surface that is already implemented.
- Keep DB role/read/action assignment checks canonical.
- Keep BFF out of auth/session.

P1:

- Plan and implement `GET /api/mobile/home` after exact mobile home cards are chosen.
- Plan `GET /api/mobile/checklists/today` if checklist becomes the first operational mobile workflow.
- Plan `GET /api/mobile/store-performance` if the mobile KPI page needs current score, config, period, and snapshot metadata in one payload.

P2:

- Add `GET /api/mobile/me/performance` only if separate report calls become noisy.
- Add `GET /api/mobile/rankings` only if ranking metadata and labels repeatedly need composition.
- Add push notification token storage and notification delivery as a separate mobile phase.

## Decision Gate Before Any Mobile BFF Endpoint

Ask these before creating a new `/api/mobile/*` endpoint:

1. Which mobile screen needs this exact payload?
2. How many existing calls would the screen otherwise make?
3. Is this only aggregation, or is it accidentally adding new business logic?
4. Which role and scope rules must be enforced?
5. What is the smallest response contract the app can pilot with?
6. Which existing service owns the source of truth?
7. What test proves the endpoint does not widen scope?

## CODEX DÜRÜST YORUM

Mobile BFF is useful, but it is not the next thing to open blindly.

The backend already has enough endpoint coverage to pilot most mobile screens. The first truly valuable aggregate is probably `GET /api/mobile/home`, because a home screen naturally blends feed, tasks, KPI, and ranking context.

The only area that feels under-shaped for mobile is checklist. Not because the backend is weak, but because the current checklist APIs are built around action/report surfaces. A mobile "today" checklist needs a clean product decision before code.

My recommendation: keep using existing endpoints for feed, rankings, competitions, workforce, and personal performance in the first pilot. Plan the mobile home aggregate next only after the first home cards are chosen. If the first real mobile workflow is checklist, plan `GET /api/mobile/checklists/today` before `GET /api/mobile/home`.

## Next Logical Step

Choose the first mobile pilot read surface:

- Option A: Mobile Home Summary V1, if the app starts from a dashboard/home experience.
- Option B: Mobile Checklist Today V1, if the app starts from daily operational execution.

Recommendation: start with Mobile Home Summary V1 only if we can keep the first payload to pinned feed, inbox preview, KPI headline, and ranking headline. Otherwise, checklist today deserves a separate interview first.
