# DG4 Sentry Application Error Delivery Specification v1

## 1. Title and metadata

- **Status:** Approved for staging implementation
- **Owner:** Suleyman Kuncan (solo operator)
- **Implementation date:** 2026-07-11
- **Provider:** Sentry Developer plan, $0 tier
- **Scope:** NestJS API, BullMQ worker, and React/Vite staging application
- **Reviewers:** Owner approval in Codex thread; no Codex review workflow
- **Related decision:** DG4 external application-level error delivery

## 2. Context

The current HR Axis observability path writes sanitized structured exceptions to
the service logs and exposes health/readiness status. Render notifications and
Better Stack health monitoring cover deployment and availability signals, but
they do not provide application-level exception delivery with issue grouping.

DG4 closes that gap with the smallest operational change: use the existing
observability boundary, add Sentry as an explicitly gated external transport,
and keep log-only behavior as the safe fallback. API responses, worker retry
behavior, authentication, and database schemas must not change.

Sentry receives only sanitized exception metadata. No request bodies, cookies,
authorization headers, provider subjects, database URLs, Redis URLs, or user
identity context are part of the external event. Tracing, replay, profiling,
source-map upload, and paid integrations are outside this first slice.

## 3. Functional requirements

- **FR-1:** The backend MUST initialize Sentry only when
  `ERROR_TRACKING_ENABLED=true` and a valid HTTPS `ERROR_TRACKING_DSN` exists.
- **FR-2:** The API and worker MUST use the same Sentry project while tagging
  the runtime as `api` or `worker`.
- **FR-3:** Existing `ObservabilityService.captureException` calls MUST keep
  writing the current sanitized structured log event.
- **FR-4:** When enabled, `captureException` MUST send a sanitized exception
  through Sentry without changing the caller's response or job retry behavior.
- **FR-5:** API 5xx exceptions caught by `StandardErrorFilter` MUST be sent;
  4xx validation/auth/business errors MUST remain local-only unless explicitly
  captured by an existing caller.
- **FR-6:** BullMQ job failures MUST be sent with safe queue/job metadata and
  MUST be rethrown so BullMQ retry semantics remain unchanged.
- **FR-7:** Process-level unhandled rejections and uncaught exceptions MUST be
  captured; uncaught exception shutdown MUST flush the external transport with
  a bounded timeout before exit.
- **FR-8:** The frontend slice MUST use `@sentry/react` root error hooks and
  existing route boundaries without adding a user-facing error endpoint.
- **FR-9:** The health observability status MUST distinguish configured,
  enabled, and log-only modes; a DSN alone MUST NOT claim delivery proof.
- **FR-10:** A staging smoke procedure MUST produce one backend and one
  frontend event with environment, release, runtime, and redaction evidence.

## 4. Non-functional requirements

- **NFR-1 Security:** `sendDefaultPii` MUST be false. SDK `beforeSend` MUST
  remove users, headers, cookies, query strings, request bodies, and sensitive
  nested fields before transport.
- **NFR-2 Privacy:** Event metadata MUST be limited to fixed event names,
  source, runtime, status/error code, method, correlation id, and normalized
  path where safe. Actor user IDs MUST NOT be sent to Sentry.
- **NFR-3 Reliability:** External delivery MUST be fail-open for API and worker
  execution. SDK initialization or transport failure MUST be logged locally and
  MUST NOT fail application bootstrap or a request/job.
- **NFR-4 Cost:** Tracing, profiling, replay, check-ins, and source-map upload
  MUST be disabled. The implementation MUST use the Sentry $0 tier only.
- **NFR-5 Performance:** Capturing an exception MUST be non-blocking for normal
  request/job paths; only fatal process shutdown may wait for a bounded flush.
- **NFR-6 Compatibility:** No public API response shape, database schema,
  queue name, retry policy, or authentication contract may change.
- **NFR-7 Rollback:** Setting the enable flag to `false` or removing the DSN
  MUST return the services to log-only mode without a code rollback.

## 5. Acceptance criteria

- **AC-1 (FR-1, FR-9):** Given no enable flag or DSN, when the API starts, then
  health reports log-only/not-enabled and no outbound Sentry event is sent.
- **AC-2 (FR-1, FR-2):** Given a valid DSN and enable flag in staging, when API
  and worker start, then each reports its runtime and enabled transport without
  exposing the DSN value.
- **AC-3 (FR-3, FR-4, NFR-1):** Given an exception containing a bearer token and
  database URL, when `captureException` runs, then the local log and Sentry
  payload contain redacted values only.
- **AC-4 (FR-5, NFR-6):** Given a 500 exception in the global HTTP filter, when
  the response is produced, then the existing status/body/correlation contract
  is unchanged and one Sentry capture is attempted.
- **AC-5 (FR-6):** Given a BullMQ job failure, when the processor catches it,
  then a safe event is captured and the original error is rethrown.
- **AC-6 (FR-7, NFR-5):** Given an uncaught exception, when the process exits,
  then a bounded flush is attempted and the process exits with code 1.
- **AC-7 (FR-8):** Given a React render or root error, when React invokes its
  error hook, then a sanitized Sentry event is captured without replay/tracing.
- **AC-8 (FR-10):** Given staging deployments with valid provider settings,
  when the documented smoke is executed, then backend and frontend events are
  visible in Sentry with `environment=staging` and no sensitive data.
- **AC-9 (NFR-3, NFR-7):** Given provider DNS, quota, or transport failure,
  when an exception is captured, then the application continues and local logs
  record the delivery failure; disabling the flag restores log-only behavior.

## 6. Edge cases

- **EC-1:** DSN is missing, empty, malformed, or non-HTTPS in production.
- **EC-2:** Enable flag is malformed; configuration MUST fail clearly rather
  than silently enabling delivery.
- **EC-3:** Sentry initialization throws; bootstrap MUST continue in log-only
  mode and emit a sanitized startup warning.
- **EC-4:** Sentry transport is unavailable or times out; request/job execution
  MUST continue.
- **EC-5:** Error is a non-`Error` value; it MUST be normalized safely.
- **EC-6:** Error message/stack contains credentials, URLs, cookies, or PII;
  all matching material MUST be redacted before transport.
- **EC-7:** A route path contains query parameters or opaque identifiers; query
  data MUST be removed and unsafe identifiers normalized or omitted.
- **EC-8:** A worker job is retried; each failure may be grouped by Sentry but
  the existing BullMQ retry/throw behavior MUST remain unchanged.
- **EC-9:** Fatal process shutdown occurs before network delivery completes;
  flush MUST respect the configured hard timeout.

## 7. API and integration contracts

```ts
type ErrorTrackingMode = "log-only" | "log+external";
type ExternalDelivery = "not-enabled" | "enabled";

type ErrorTrackingStatus = {
  dsnConfigured: boolean;
  enabled: boolean;
  environment: string;
  externalDelivery: ExternalDelivery;
  mode: ErrorTrackingMode;
  release?: string;
};

type SafeExceptionContext = {
  event: string;
  source: string;
  severity: "error" | "fatal" | "warning";
  runtime?: "api" | "worker" | "unknown";
  correlationId?: string | null;
  errorCode?: string;
  method?: string;
  normalizedPath?: string;
  statusCode?: number;
  metadata?: Record<string, string | number | null>;
};
```

The existing HTTP error response and BullMQ processor contracts remain
unchanged. Sentry is an outbound side effect, not a new public API.

## 8. Data models and secret boundary

| Field | Type | Constraints |
| --- | --- | --- |
| `ERROR_TRACKING_DSN` | string | HTTPS provider DSN; Render secret boundary; never committed/logged |
| `ERROR_TRACKING_ENABLED` | boolean string | Exact `true`/`false`; default `false` |
| `ERROR_TRACKING_ENVIRONMENT` | string | `staging` for current rollout; no secrets |
| `ERROR_TRACKING_RELEASE` | string | Optional deployed commit/release identifier; no secrets |
| `ERROR_TRACKING_SMOKE` | boolean string | Temporary staging-only startup smoke; set `false` after one receipt |
| `VITE_SENTRY_DSN` | string | Browser-visible ingest DSN in Vercel env; never hardcoded |
| `VITE_SENTRY_ENABLED` | boolean string | Exact `true`/`false`; default `false` |
| `VITE_SENTRY_ENVIRONMENT` | string | `staging` for the current Vercel project |

Render API and worker use the backend keys. Vercel staging Production and
Preview environments use the frontend keys. No DSN is stored in GitHub,
`render.yaml`, `.env` files committed to the repository, or chat messages.

## 9. Out of scope

- **OS-1:** Session Replay, profiling, performance tracing, and cron check-ins;
  excluded to keep cost and data collection at zero beyond error delivery.
- **OS-2:** Source-map upload and release artifact management; can be a later
  opt-in slice after error delivery is proven.
- **OS-3:** User identity, request body, cookie, authorization, or PII capture.
- **OS-4:** New public diagnostic/test-error endpoints.
- **OS-5:** Database migrations, queue contract changes, auth changes, or
  frontend product/UI redesign.
- **OS-6:** Paid Sentry plan, Slack/SMS/webhook escalation, or multi-tenant
  incident assignment.
