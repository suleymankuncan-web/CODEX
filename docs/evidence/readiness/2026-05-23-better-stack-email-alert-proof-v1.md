# Better Stack Email Alert Proof V1 - 2026-05-23

## Scope

This note records fresh external email alert delivery evidence for the staging
backend health endpoint.

It proves that an external monitoring provider can check the public staging
backend health endpoint and deliver an email alert test. It does not claim
production rollout approval, app-level exception tracking, SMS/call routing,
or broad-production Redis/Supabase recovery readiness.

No product code, API response shape, auth/permission semantics, database
schema, provider code, CSS, or user-facing workflow behavior was changed.

## Sokrates Decision

Claim:

- Better Stack is the right V1 external email alert proof because it monitors
  the real public health endpoint from outside the app and can send an email
  test alert without intentionally breaking the staging service.

Assumptions:

- `https://api-staging.hr-axis.com/api/health` is the active staging backend
  health endpoint.
- The monitor is configured for the staging backend, not production.
- The operator verified the received email without sharing raw email contents,
  message IDs, private mailbox data, or destination addresses.

Evidence:

- Provider: `better-stack-uptime`
- Monitor label: `hr-axis-staging-api-health`
- Monitor URL:
  `https://api-staging.hr-axis.com/api/health`
- Monitor condition: URL does not contain keyword.
- Required keyword:
  `"status":"ok"`
- Live backend health response contains the required keyword.
- Monitor status after creation: `up`.
- Escalation mode: notify primary responder.
- Notification channel enabled: email.
- Better Stack `Send test alert` was used.
- Operator observed a delivered email indicating that the test alert was
  started.

Counterargument:

- A test alert proves email delivery for the monitoring provider, not that a
  real outage has happened.
- It does not replace app-level error tracking with stack traces or per-request
  breadcrumbs.
- It does not prove SMS, phone call, push notification, or escalation policy
  behavior.

Risk:

- Evidence recording: LOW.
- Treating this as full production incident management: MEDIUM/HIGH.
- Intentionally causing downtime to prove an alert: HIGH and not needed for
  this V1 proof.

Door:

- Two-way-door. The monitor can be updated, paused, or replaced without
  application changes.

Stop rule used:

- Do not record raw email addresses, message IDs, email body contents, provider
  tokens, API keys, Slack webhook URLs, bearer tokens, cookies, database URLs,
  Redis URLs, private keys, or private payloads.
- Do not intentionally break staging or production to trigger an outage alert.

## Live Health Verification

Command:

```powershell
curl.exe -sS -H "Accept: application/json" --max-time 45 https://api-staging.hr-axis.com/api/health
```

Sanitized result:

- HTTP request succeeded.
- Response JSON included:
  - `status=ok`
  - `service=hr-axis-staging-api`
  - `queueBackend=bullmq`
  - queue `status=durable`
  - database `status=ok`
  - Redis `status=ok`
  - observability `status=ok`
  - readiness profile `controlled-pilot`

## Decision

Controlled staging/internal pilot:

- Go for external email alert delivery proof.
- Render platform notifications remain useful for deploy/service events.
- Better Stack now provides the fresh external monitor/email-alert proof for
  the public backend health path.

Broad production:

- Still not a full production Go by itself.
- Before broad production, decide whether to keep Better Stack as the accepted
  external uptime/email provider and whether to add app-level error tracking
  for per-exception diagnostics.

## Remaining Non-Claims

- No production traffic was tested.
- No app-level error tracking provider is configured or claimed.
- No SMS/phone/push alert was tested.
- No Supabase managed restore/PITR decision is closed by this proof.
- No production-grade Redis tier/profile decision is closed by this proof.

## Safety

- No raw email address, message ID, Better Stack token, provider credential,
  Slack webhook, bearer token, Clerk cookie, database URL, Redis URL, password,
  private key, or private payload is recorded.
- No production database was touched.
- No provider secret was stored in source control.
