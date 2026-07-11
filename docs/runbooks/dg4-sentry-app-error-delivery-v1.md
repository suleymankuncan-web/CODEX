# DG4 Sentry application error delivery runbook v1

**Status:** Staging activation in progress  
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
ERROR_TRACKING_ENABLED=false   # enable only after staging smoke is ready
ERROR_TRACKING_ENVIRONMENT=staging
ERROR_TRACKING_RELEASE=<deployed commit when known>
ERROR_TRACKING_SMOKE=false
```

Set the same backend values on `hr-axis-api` and `hr-axis-worker`. The frontend
uses Vercel project `hr-axis-staging`:

```text
VITE_SENTRY_DSN=<same Sentry ingest DSN>
VITE_SENTRY_ENABLED=false     # enable only with the frontend slice
VITE_SENTRY_ENVIRONMENT=staging
```

`VITE_SENTRY_DSN` is an ingest key intentionally present in the browser bundle;
it still belongs in Vercel environment configuration, not source code.

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

1. Confirm the DSN exists only in Render/Vercel environment settings.
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

With `VITE_SENTRY_ENABLED=true` on the staging Vercel Production and Preview
environments, open `https://staging.hr-axis.com` and trigger the documented
browser error smoke. Confirm one frontend event with `environment=staging` and
no user/request payload. Then leave the flag enabled for the staging profile.

## Rollback

1. Set `ERROR_TRACKING_ENABLED=false` on Render API and worker; set
   `VITE_SENTRY_ENABLED=false` on Vercel if the frontend slice is active.
2. Restart/redeploy the affected service. The application returns to local
   sanitized log-only behavior; no code revert or database action is needed.
3. If the DSN itself is suspected compromised, rotate it in Sentry and replace
   the Render/Vercel values without recording either value in evidence.
4. Re-open DG4 only after redaction, destination, and staging receipt are
   re-verified.

## Verification record

| Check | Status | Evidence |
| --- | --- | --- |
| Backend SDK/adapter tests | Pending PR verification | Targeted and full backend tests |
| API staging receipt | Pending deployment | Sentry event with `runtime=api` |
| Worker staging receipt | Pending deployment | Sentry event with `runtime=worker` |
| Frontend receipt | Pending PR-2 | Sentry event with `runtime=frontend` |
| Redaction review | Pending receipt | No DSN, PII, token, cookie, or private URL |

