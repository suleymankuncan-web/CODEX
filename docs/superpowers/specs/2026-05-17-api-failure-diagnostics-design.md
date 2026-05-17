# API Failure Diagnostics Design

Date: 2026-05-17

## Purpose

Recent reliability work added recovery actions to several full-screen error states. Those actions keep operators from getting stuck, but they do not explain why the initial load failed. This design adds a small client-side diagnostic layer so the next reliability PRs can start from evidence instead of guessing.

The first version records failed API requests in `admin-web` with enough context to connect a user-visible failure to a route, endpoint, status, timing, and backend request id when available. It does not change retry policy, backend behavior, or user-facing UI.

## Goals

- Emit a structured diagnostic event whenever an API request fails in the shared API client.
- Include route, sanitized endpoint, HTTP method, status, duration, retryability, request id, and error category.
- Avoid logging bearer tokens, request bodies, request headers, response bodies, or raw query values.
- Make diagnostics testable in Playwright without adding a new test runner.
- Keep the design ready for a future external collector, while first shipping as console/event/ring-buffer evidence only.

## Non-Goals

- Do not increase retry counts or hide failures.
- Do not add new retry buttons or UI copy.
- Do not send diagnostics to a third-party service in this slice.
- Do not instrument backend request lifecycle yet.
- Do not log raw payloads, auth state, or user-identifying query values.

## Existing Context

`admin-web/src/lib/api.ts` is the shared API boundary for JSON and `FormData` requests. It already centralizes:

- API base URL resolution.
- session header construction.
- bearer token refresh on 401.
- conversion of non-OK responses into `ApiError`.

`admin-web/src/lib/query-retry.ts` decides whether React Query retries transient failures. That helper sees React Query retry state, but `api.ts` does not. Therefore this diagnostic layer should not claim to know the React Query `failureCount` unless a later design explicitly passes that data through.

## Approaches Considered

### Approach A: Client API Diagnostics First

Instrument only the shared frontend API helper. This gives fast route and endpoint evidence for every surface that uses `fetchJson`, `sendJson`, or `sendFormData`.

Trade-off: It cannot explain database or service internals by itself.

### Approach B: Backend Request Logging First

Add request id middleware and structured API logs in the Nest backend.

Trade-off: This is more powerful, but it still needs frontend correlation to answer which screen and user journey saw the failure.

### Approach C: UI Data-Flow Resilience First

Refactor screens to render stale or partial data when one query fails.

Trade-off: This improves UX, but without diagnostics it can mask the root cause and make production failures harder to classify.

## Decision

Use Approach A first. It is the smallest slice that improves every future root-cause investigation. Backend correlation and partial-render improvements should follow after we have consistent evidence from the browser side.

## Diagnostic Event Shape

The event should be a plain serializable object. Proposed fields:

```ts
type ApiFailureDiagnostic = {
  event: 'api.failure'
  route: string
  method: string
  path: string
  queryKeys: string[]
  status: number | null
  durationMs: number
  retryable: boolean
  requestAttempt: number
  errorCategory: 'http' | 'network' | 'non_json' | 'unknown'
  errorMessage: string
  requestId: string | null
  occurredAt: string
}
```

Field notes:

- `route` is the current browser pathname plus query parameter names only; query values are replaced so deep-link values do not leak.
- `path` is sanitized: UUID-like ids, long numeric ids, and query values are not logged raw.
- `queryKeys` includes query parameter names only.
- `requestAttempt` means the attempt inside the API helper, such as initial request vs. post-refresh retry. It is not React Query retry count.
- `retryable` follows the existing transient status logic: 408, 429, and 5xx are retryable; network failures are retryable; 4xx except 408/429 are not.
- `requestId` is read from `x-request-id`, `x-correlation-id`, or `traceparent` response headers when present.

## Emission Behavior

Create a small diagnostics module, likely `admin-web/src/lib/api-diagnostics.ts`, with these responsibilities:

- Build sanitized event payloads.
- Emit `console.warn('[store-ops:api-failure]', event)`.
- Dispatch a browser `CustomEvent('store-ops-api-failure', { detail: event })`.
- Store the last 20 events in a browser-only ring buffer such as `window.__STORE_OPS_API_FAILURES__`.

The ring buffer is not a permanent telemetry store. It exists so local reproduction, Playwright tests, and support/debug sessions can inspect the latest failure evidence.

## API Client Integration

Wrap the `fetch` calls in `requestJson` and `requestFormData` with timing and failure capture.

HTTP non-OK responses:

- Read status and request id from the response.
- Emit diagnostics before throwing `ApiError`.
- Preserve current session-expired behavior for 401.

Network failures:

- Catch fetch exceptions.
- Emit diagnostics with `status: null` and `errorCategory: 'network'`.
- Rethrow the original error so React Query and screens behave as they do today.

Non-JSON success responses:

- Continue throwing `ApiError`.
- Emit diagnostics with `errorCategory: 'non_json'`.

Successful responses:

- Emit nothing.
- Reset any in-memory failure sequence only if such a sequence is introduced later.

## Privacy And Safety

Diagnostics must never include:

- Authorization headers.
- request or response bodies.
- raw bearer tokens.
- raw query parameter values.
- full response text.

Endpoint ids should be generalized enough for support to identify the route class without exposing a specific employee or store id. Backend request id is the preferred join key for exact server-side investigation.

## Testing Plan

Use the existing Playwright stack first.

- Add a focused E2E or extend an existing reliability-oriented spec to route one API call as 503.
- Listen for browser `console.warn` messages or evaluate the ring buffer after the failed request.
- Assert the diagnostic event includes route, sanitized path, status, retryable flag, request id when mocked, and a nonzero duration.
- Assert it does not include request body text, Authorization, or raw query values.
- Assert successful API calls do not produce `api.failure` events.

Existing `lint`, `build`, and the targeted E2E spec are the required validation for the first implementation PR.

## Rollout Plan

1. Implement `api-diagnostics.ts` as a small pure helper plus browser emitter.
2. Wire JSON and form-data API requests to emit diagnostics on failure.
3. Add Playwright coverage for one 503 and one success path.
4. Validate no user-facing behavior changed.
5. Use the emitted evidence to choose the next backend or data-flow root-cause PR.

## Open Decisions Resolved

- First sink is console/event/ring-buffer, not external telemetry.
- First scope is frontend API diagnostics, not backend middleware.
- Diagnostic attempt naming will avoid pretending to know React Query retry count.
- Sanitization is part of the first implementation, not a follow-up.

## Self-Review

- No placeholders remain.
- Scope is one implementation slice and does not require backend changes.
- Privacy constraints are explicit.
- The event fields avoid ambiguous retry-count semantics.
- Testing uses the repository's existing Playwright workflow instead of introducing a new test framework.
