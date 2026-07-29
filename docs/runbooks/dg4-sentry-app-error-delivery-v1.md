# DG4 Sentry application error delivery runbook v1

**Status:** Staging receipts verified; production activation remains gated
**Owner:** Suleyman Kuncan  
**Provider:** Sentry Developer plan (`$0`)  
**Review cadence:** Before production activation and after any provider/secret/redaction change

## Purpose

This runbook covers the opt-in Sentry transport for application exceptions.
Render platform notifications and Better Stack health monitoring remain the
availability/deploy signals. Sentry is only the application-level exception
signal for the NestJS API, BullMQ worker, and React frontend.

## Secret and environment boundary

Never place a DSN in Git, `render.yaml`, committed `.env` files, logs, screenshots,
or chat messages.

Render services:

```text
ERROR_TRACKING_DSN=<Sentry HTTPS DSN; Render secret>
ERROR_TRACKING_ENABLED=true    # staging receipt accepted
ERROR_TRACKING_ENVIRONMENT=staging
ERROR_TRACKING_RELEASE=<deployed commit when known>
ERROR_TRACKING_SMOKE=false
```

Set the same backend values on `hr-axis-api` and `hr-axis-worker`. The frontend
uses the controlled Cloudflare frontend build environment:

```text
VITE_SENTRY_DSN=<same Sentry ingest DSN>
VITE_SENTRY_ENABLED=true      # staging frontend receipt accepted
VITE_SENTRY_ENVIRONMENT=staging
```

`VITE_SENTRY_DSN` is an ingest key intentionally present in the browser bundle;
it still belongs in the controlled Cloudflare build environment, not source code.

## Data protection contract

- `sendDefaultPii=false`.
- Request headers, cookies, query strings, bodies, users, breadcrumbs, and
  arbitrary `extra` data are removed before delivery.
- Error messages and stack values are redacted for bearer tokens, credentials,
  database/Redis URLs, emails, and phone-like values.
- API paths are normalized to remove query data and opaque UUID/numeric IDs.
- Worker events include only fixed event/source/runtime/queue metadata; job,
  batch, snapshot, and actor identifiers are not sent to Sentry.
- Tracing, profiling, replay, check-ins, and source-map upload remain disabled.

## Staging activation

1. Confirm the DSN exists only in Render/Cloudflare build environment settings.
2. Set `ERROR_TRACKING_ENABLED=true` on both Render services. Leave the
   frontend flag false until the frontend PR is deployed.
3. Set `ERROR_TRACKING_SMOKE=true` on both Render services for one restart.
   The startup path emits a synthetic `observability.staging_smoke` event with
   `runtime=api` or `runtime=worker`.
4. Restart/deploy the services and confirm two Sentry events show
   `environment=staging`, the current release (when supplied), and no secret or
   user data.
5. Set `ERROR_TRACKING_SMOKE=false` and redeploy/restart. Keep the enable flag
   true after the receipt is accepted.
6. Record only sanitized evidence: event name, runtime, environment, release,
   timestamp, and redaction result. Do not record DSN, event payload, raw email,
   or provider message identifiers.

## Frontend smoke (after PR-2)

With `VITE_SENTRY_ENABLED=true` in the staging Cloudflare build environment,
open `https://staging.hr-axis.com` and trigger the documented
browser error smoke. Confirm one frontend event with `environment=staging` and
no user/request payload. Then leave the flag enabled for the staging profile.

## Staging receipt — 2026-07-11

The owner accepted the following sanitized Sentry tag evidence in the `hr-axis`
project:

| Runtime | Event | Environment | Result |
| --- | --- | --- | --- |
| `api` | `observability.staging_smoke` | `staging` | Received |
| `worker` | `observability.staging_smoke` | `staging` | Received |
| `frontend` | `window.error` | `staging` | Received |

The API and worker smoke flags were returned to `ERROR_TRACKING_SMOKE=false`
after receipt. `ERROR_TRACKING_ENABLED=true` remains active for staging; the
frontend has no separate smoke flag and keeps `VITE_SENTRY_ENABLED=true`.

The frontend browser delivery initially hit the CSP `connect-src` boundary.
PR #941 originally added the exact Sentry ingest origin to the then-active
frontend edge and nginx policies; the current Cloudflare `_headers` contract
preserves the same allowlist. The subsequent browser request was delivered. Only event names, runtimes, and
environment tags are retained here. DSNs, event IDs, payloads, user data, and
provider identifiers are intentionally excluded.

## Rollback

1. Set `ERROR_TRACKING_ENABLED=false` on Render API and worker; set
   `VITE_SENTRY_ENABLED=false` in the Cloudflare build environment if the frontend slice is active.
2. Restart/redeploy the affected service. The application returns to local
   sanitized log-only behavior; no code revert or database action is needed.
3. If the DSN itself is suspected compromised, rotate it in Sentry and replace
   the Render/Cloudflare build values without recording either value in evidence.
4. Re-open DG4 only after redaction, destination, and staging receipt are
   re-verified.

## Verification record

| Check | Status | Evidence |
| --- | --- | --- |
| Backend SDK/adapter tests | Verified | Targeted and full backend tests in PR #940 |
| API staging receipt | Verified | `observability.staging_smoke`, `runtime=api`, `environment=staging` |
| Worker staging receipt | Verified | `observability.staging_smoke`, `runtime=worker`, `environment=staging` |
| Frontend receipt | Verified | `window.error`, `runtime=frontend`, `environment=staging` in PR #941 |
| Frontend CSP delivery | Verified | Exact Sentry ingest origin allowlisted in PR #941 |
| Redaction review | Verified | Sanitized tags only; no DSN, PII, token, cookie, or private URL |

