# P0 Trust Operations Execution V1

Status: active
Shelf: readiness and operations
Last verified: 2026-05-24

## Reader And Action

Reader:

- an engineer, release operator, product owner, or future agent deciding how to
  close the P0 trust backlog without inventing production confidence.

After reading, they should know:

- what is already implemented,
- what still needs a real owner/provider decision,
- which code slice is allowed first,
- which evidence expires after environment or auth changes.

## Sokrates Decision

Decision:

- Keep controlled pilot on the existing log-only application observability.
- Do not add an external error-tracking SDK until the owner chooses a provider,
  destination, retention posture, and redaction policy.
- Broad production stays blocked if app-level error tracking is required but no
  provider smoke proof exists.
- Incident ownership, rollback authority, security preflight, evidence expiry,
  and owner responsibility are P0 operating gates, not optional polish.

Why now:

- The ranked readiness backlog has P0 trust items that can easily become vague.
  The project needs an execution map before any SDK, provider, or rollout work.

Evidence:

- `backend/nestjs/src/shared/observability/observability.service.ts` captures
  backend exceptions in log-only mode with redaction and readiness status.
- `backend/nestjs/src/shared/http/standard-error.filter.ts` sends server
  exceptions to the observability service without changing response shape.
- `docs/backend/operational-monitoring-contract.md` defines health,
  correlation, alert interpretation, and observability-degraded semantics.
- `docs/plans/production-staging-incident-response-skeleton.md` defines
  incident roles, severity, evidence rules, and rollback decision shape.
- `docs/evidence/readiness/2026-05-23-production-ops-closure-decision-packet-v1.md`
  keeps controlled pilot Conditional Go and broad production No-Go.

Counterargument:

- Adding Sentry, Better Stack error tracking, or another SDK now could look like
  faster progress. That would be fake precision without a real owner decision
  about provider, destination, retention, sampling, and redaction.

Risk:

- This document: LOW.
- Adding provider SDK without owner/provider setup: MEDIUM/HIGH.
- Broad production without incident ownership and evidence expiry: HIGH.

Door:

- This plan is a two-way-door.
- Shipping broad-production trust claims without provider and owner decisions is
  near-one-way because real incidents become user-visible.

## Current Implemented Baseline

Already implemented and safe to rely on for controlled pilot:

- backend process and dependency health via `/api/health/live` and
  `/api/health`;
- backend log-only exception capture with sanitization;
- process handlers for unhandled rejection and uncaught exception;
- standard error filter capture for server exceptions;
- correlation id propagation and safe inbound correlation id rules;
- alert-routing smoke metadata and Better Stack/Render external alert evidence;
- Redis/BullMQ staging proof with controlled-pilot tier caveat;
- Supabase logical restore proof with broad-production caveat.

Not implemented as production-grade app-level error tracking:

- external SDK delivery,
- frontend browser exception capture,
- release/source-map grouping,
- provider retention and access policy,
- incident assignment inside an external tracking provider.

## P0 Execution Map

### 1. App-Level Error Tracking V1

Current stance:

- log-only backend observability is acceptable for controlled pilot;
- external provider delivery is blocked until the owner chooses the provider and
  destination.

First allowed code slice after provider decision:

1. Add a narrow backend error-tracking adapter behind env flags.
2. Preserve existing API response shape and standard error behavior.
3. Redact tokens, cookies, auth codes, provider subjects, database URLs, Redis
   URLs, private payloads, and personal data.
4. Add tests for redaction, disabled mode, missing DSN, and one safe captured
   server exception.
5. Prove a sanitized staging smoke event without recording raw secrets.

Frontend capture is a second slice after backend capture works.

Stop if:

- provider setup would send raw token/cookie/PII/private payloads;
- SDK changes user-facing errors;
- provider access, retention, or alert ownership is unclear;
- tests need real secrets in source or evidence.

### 2. Incident Ownership And Rollback Authority

Current stance:

- role-based ownership exists in the incident skeleton;
- broad production needs accountable owner paths before rollout.

Owner paths to name outside source control before broad production:

| Responsibility | Minimum accountable path |
| --- | --- |
| Incident lead | primary human owner plus backup |
| Release rollback | technical owner who can pause deploy and revert artifacts |
| Business stop authority | person who can stop rollout while risk remains |
| Backend/API owner | owner for API health, auth, queue, and server logs |
| Frontend owner | owner for Vercel, route availability, browser smoke |
| Data owner | owner for import, snapshot, restore, data quality |
| Alert destination owner | owner for Render/Better Stack/provider notifications |

Stop if:

- ownership is only a channel or mailbox;
- rollback requires ad hoc approval during an incident;
- the owner map stores private contact data in the repository.

### 3. Security And Tenant Isolation Preflight

Before broad-production or role-model change, run a focused preflight:

- auth/session source of truth still matches DB role/scope/action-store
  assignments;
- role route matrix and backend endpoint smoke evidence are fresh;
- store/company/region scope cannot read or act outside assignment;
- upload/import ownership is explicit;
- environment and secret drift guards pass;
- Supabase boundary guard and dependency/security gates pass;
- evidence contains no raw tokens, cookies, provider subjects, URLs, or private
  payloads.

Stop if:

- the preflight becomes a broad penetration-test claim;
- any unauthorized success appears;
- evidence is older than the auth/role/provider/config change being approved.

### 4. Evidence Expiry And Protected Rerun Policy

Evidence expires when any of these changes:

- auth provider, Clerk template, issuer, audience, JWKS, or session handling;
- role/scope/action-store assignment semantics;
- route guard, backend guard, or generated API contract for protected routes;
- Redis, queue backend, worker, or readiness profile;
- Supabase restore target, backup policy, RPO/RTO posture, or DB provider tier;
- alert provider, destination, escalation policy, or error-tracking SDK;
- import/source schema, snapshot materialization, KPI data shape, or seed data;
- Vercel/Render deploy target, environment variables, or release artifact.

Minimum rerun ladder after expiry:

```powershell
npm.cmd run check:release
npm.cmd run smoke:deployed-readiness
npm.cmd run smoke:backend-readiness-load
npm.cmd run smoke:alert-routing
```

Protected persona and command evidence must use fresh real sessions. If a token
or provider input is missing, record a blocker instead of using mock proof.

### 5. Owner And Responsibility Map

Keep owners as roles in source control. Keep private names, phone numbers,
emails, Slack channels, or escalation links in the provider/workspace settings.

Required source-level owner categories:

- incident lead,
- release operator,
- backend owner,
- frontend owner,
- data owner,
- auth owner,
- import owner,
- restore owner,
- alert owner,
- business approver.

## Verification Ladder

For this docs-only plan:

```powershell
git diff --check
npm.cmd run test:scripts
```

For the first provider-backed implementation slice:

```powershell
npm.cmd --prefix backend/nestjs run test -- observability
npm.cmd --prefix backend/nestjs run lint
npm.cmd --prefix backend/nestjs run build
npm.cmd run smoke:alert-routing
```

Add frontend lint/build and targeted Playwright only when browser capture or UI
diagnostics are changed.

## Next Code Go/No-Go

Go only if:

- provider and destination are chosen;
- DSN/secret is configured outside source control;
- redaction policy is accepted;
- owner path is known;
- safe staging smoke can be generated and sanitized.

No-Go if:

- provider input is missing;
- the work would change API response shape, auth semantics, DB schema, CSS, or
  user-facing workflow;
- broad production is being approved from docs-only evidence.

## Durust Yorum

The project is not missing "some random observability package." It is missing
the final human/provider commitments that make error tracking useful during an
incident. Until those are named, the correct engineering move is to keep the
current log-only controlled-pilot posture honest and make the next provider
slice small, testable, and reversible.
