# Project Health Uplift PR-5 Observability Contract Scout

Date: 2026-06-08

## Scope

This is a docs/evidence-only scout. It does not change runtime behavior,
API shape, auth, database schema, alert routing, external providers, or
user-facing workflows.

The goal is to separate proven observability signals from broad-production
monitoring blockers before any providerless runtime slice is attempted.

## Proven Signals

| Signal | Source | Current evidence |
| --- | --- | --- |
| Backend health observability status | `GET /api/health`, `backend/nestjs/src/shared/health.service.ts` | Health includes `observability: this.observabilityService.getStatus()`. |
| Log-only backend exception capture | `backend/nestjs/src/shared/observability/observability.service.ts` | `captureException`, `installProcessHandlers`, `process.unhandled_rejection`, `process.uncaught_exception`, `mode: "log-only"`, `externalDelivery: "not-enabled"`. |
| 5xx standard error capture | `backend/nestjs/src/shared/http/standard-error.filter.ts` | 5xx paths call `captureException` while generic `Internal server error` responses remain unchanged. |
| Correlation id propagation | `backend/nestjs/src/shared/request-context.middleware.ts` | Safe inbound `x-correlation-id` is echoed, unsafe ids are replaced, and completed request logs include path, status, duration, and actor. |
| Frontend API failure diagnostics | `admin-web/src/lib/api-diagnostics.ts`, `admin-web/src/lib/api.ts` | Failed API calls emit sanitized `api.failure` diagnostics into `window.__STORE_OPS_API_FAILURES__` and dispatch `store-ops-api-failure`; the source is capped by `API_FAILURE_RING_LIMIT` and sanitized through `sanitizeErrorMessage` and `sanitizeRequestId`. |
| Admin operations visibility | `admin-web/src/pages/OperationsControlTowerPage.tsx` | `/admin/operations` already renders backend health and observability degraded state from the health payload. |
| Platform alert evidence | `docs/evidence/readiness/2026-05-23-better-stack-email-alert-proof-v1.md`, `docs/evidence/readiness/2026-05-23-alert-email-policy-decision-v1.md` | Platform alert proof exists, but it is not app-level error tracking. |

## Controlled-Pilot Acceptable Signals

- Log-only backend exception capture is acceptable for controlled pilot when
  paired with Render logs, correlation ids, and `/api/health`.
- Local frontend API failure diagnostics are acceptable as operator support
  evidence because they are generated from real failed API calls, sanitized,
  capped to a ring buffer, and not persisted as surveillance telemetry.
- Better Stack / Render notification evidence is acceptable as platform alert
  proof only. It must not be described as app-level error tracking.

## Broad-Production Blockers

- `externalDelivery` is still `not-enabled`.
- No external app-level error tracking delivery has been proven.
- No persistent backend store exists for client-side failure diagnostics.
- No owner acceptance decision says platform alerts alone are sufficient for
  broad production app-level error tracking.
- No frontend route/component exception capture is sent to a backend or
  providerless support surface.

## Providerless Runtime Slice Candidates

### Candidate A: Operations API Failure Snapshot

Decision: proceed as the preferred PR-6 candidate.

Narrow implementation:

- Read the existing `window.__STORE_OPS_API_FAILURES__` ring buffer in
  `/admin/operations`.
- Display a compact local-session "recent API failures" panel for operators.
- Use only sanitized diagnostic fields already produced by
  `admin-web/src/lib/api-diagnostics.ts`.
- Do not add backend endpoints, DB tables, auth semantics, external providers,
  new alert workflows, or fake events.

Why this is safe:

- The source data already exists in runtime.
- The data appears only after real API failures.
- Rollback is a plain PR revert.
- It improves support visibility without claiming production-grade monitoring.

Required PR-6 verification:

- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- targeted `/admin/operations` Playwright evidence for empty and populated
  local diagnostics
- `npm.cmd run test:scripts`

### Candidate B: Route Error Boundary Evidence

Decision: park unless PR-6 cannot safely expose Candidate A.

The route recovery boundary already exists in
`admin-web/src/app/route-recovery-boundary.tsx`. A runtime change here should
not be mixed with the API failure snapshot unless it remains test/evidence-only.

## Stop Conditions

- Stop if the runtime slice needs a migration, backend write endpoint, provider
  secret, new auth semantics, or queue/background processing.
- Stop if the UI would need fake failures or demo metrics to look useful.
- Stop if the PR claims external delivery, app-level production monitoring, or
  incident escalation coverage.
- Stop if diagnostics expose raw tokens, cookies, emails, national ids, full
  query values, or payload bodies.
- Stop if rollback is not a plain PR revert.

## PR-6 Decision

Proceed, but only with Candidate A. PR-6 should be a small providerless UI
visibility slice on `/admin/operations` that surfaces the existing sanitized
frontend API failure ring buffer. If that implementation cannot be proven with
real diagnostic events and no fake data, PR-6 must stop.
