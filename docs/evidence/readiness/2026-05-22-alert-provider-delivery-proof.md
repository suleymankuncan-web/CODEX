# Alert Provider Delivery Proof - 2026-05-22

## Scope

This note records the first real staging alert-provider delivery proof after
Render Notifications was enabled for the staging backend service.

It proves that an external notification channel delivered a staging backend
deploy notification. It does not claim app-level Sentry-style error delivery,
email delivery, production incident coverage, or broad-production readiness.

No business logic, API response shape, auth/permission semantics, database
schema, provider code, CSS, or user-facing workflow behavior was changed in the
repository for this evidence pass.

## Sokrates Decision

Claim:

- The project can now prove one real external alert/notification delivery path
  for the staging backend.

Assumptions:

- `https://api-staging.hr-axis.com/api` is the active staging backend.
- Render Notifications is the approved V1 provider for this staging proof.
- The operator configured notification delivery outside source control.
- Destination labels are sanitized and no raw email, Slack webhook, token, or
  private payload should be recorded.

Evidence:

- Render Notifications was configured with email and Slack destinations.
- A manual backend deploy was triggered after the health check path was changed
  to `/api/health`.
- Slack received the Render notification.
- Email delivery was not observed in this pass and is not counted as proven.
- `smoke:alert-routing` passed with provider metadata and deployed backend
  health signal.
- Direct backend health returned HTTP `200` with DB and Redis healthy.

Counterargument:

- Render Notifications proves platform notification delivery, not app-level
  exception delivery. If the team needs per-exception traces, user impact
  breadcrumbs, or sampled stack traces, that should be a separate Sentry-like
  observability implementation PR.

Risk:

- Evidence recording: LOW.
- Treating this as complete app-level error tracking or broad-production
  incident readiness: HIGH.

Door:

- This evidence document is a two-way door.
- Provider notification settings are operational configuration and should be
  changed through Render with a clear rollback path.

Stop rule used:

- Stop before recording raw email addresses, Slack webhook URLs, provider
  secrets, bearer tokens, cookies, database URLs, or private payloads.
- Stop before claiming email delivery or app-level external error tracking when
  only Slack platform notification delivery was observed.

## Operator Change

The operator configured Render Notifications for the staging backend and
triggered a manual deploy.

Sanitized notification shape:

```text
Provider: render-notifications
Configured destinations: owner-email, ops-slack
Proven delivered destination: ops-slack
Email destination: configured, delivery not observed in this pass
Fallback inspection path: render-dashboard-notification-log
Health check path: /api/health
```

No raw email address, Slack webhook, token, or private payload is recorded.

## Live Alert Routing Smoke

Command:

```powershell
$env:ALERT_SMOKE_ENVIRONMENT="staging"
$env:ALERT_SMOKE_BACKEND_URL="https://api-staging.hr-axis.com/api"
$env:ALERT_PROVIDER_NAME="render-notifications"
$env:ALERT_PRIMARY_DESTINATION="ops-slack"
$env:ALERT_BACKUP_DESTINATION="render-dashboard-notification-log"
$env:ALERT_SMOKE_TIMEOUT_MS="45000"
npm.cmd run smoke:alert-routing
```

Result:

- Evidence time: `2026-05-22T10:28:37.431Z`.
- status: `ok`.
- total checks: `5`.
- passed: `5`.
- failed: `0`.
- skipped: `0`.
- provider delivery: `metadata-only` from the script perspective.
- alert provider metadata: passed.
- backend health alert signal: passed with HTTP `200`.
- health status: `ok`.
- database status: `ok`.
- observability status: `ok`.

Important distinction:

- The smoke confirms provider metadata plus deployed backend health signal.
- The real external delivery evidence is the operator-observed Slack
  notification after the manual Render deploy.

## Live Health Proof

Command shape:

```powershell
curl.exe -sS -H "Accept: application/json" --max-time 45 https://api-staging.hr-axis.com/api/health
```

Result:

- Evidence time: `2026-05-22T10:28:37.543Z`.
- `/api/health`: HTTP `200`, status `ok`.
- service: `hr-axis-staging-api`.
- queue backend: `bullmq`.
- queue status: `durable`.
- Redis check: `ok`, latency `2ms`.
- database check: `ok`, latency `2ms`.
- observability: `ok`, `log-only`, external delivery `not-enabled`.
- readiness profile: `controlled-pilot`.

Decision:

- Staging backend health signal for Render health checks: Go.
- Staging Render notification delivery to Slack: Go.
- Email delivery: not proven in this pass.
- App-level error-tracking SDK delivery: not implemented and not claimed.

## Current Readiness Decision

Controlled staging/internal pilot:

- Conditional Go, with Redis/BullMQ staging wiring proven and one external
  Render notification delivery path proven through Slack.

Broad production:

- Still No-Go.

Remaining blockers before broad production:

- Production-grade Redis/Key Value tier decision and broad-production profile
  proof.
- Supabase restore drill into an approved disposable target.
- Production alert policy decision: either accept Render Notifications as the
  production V1 provider, prove the production destination delivery path, or
  implement and prove app-level error tracking separately.

## Safety

- No raw email address, Slack webhook URL, provider credential, bearer token,
  Clerk cookie, database URL, Redis URL, password, private key, or private
  payload is recorded.
- No production database was touched.
- No DB migration, auth configuration, API response, business logic, CSS, or
  user-facing workflow change was made.
