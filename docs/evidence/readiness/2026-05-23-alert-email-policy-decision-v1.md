# Alert Email Policy Decision V1 - 2026-05-23

## Scope

This note records the alert-email policy decision after the operator inspected
the Render notification mailbox for `hr-axis-api`.

It does not change application code, provider configuration, auth behavior,
database state, API response shape, CSS, or user-facing workflow behavior.

## Sokrates Decision

Claim:

- Render email is usable as a failure/incident backup channel, but it should
  not be represented as fresh successful-deploy email delivery proof.

Assumptions:

- The operator inspected the mailbox tied to Render notifications.
- The sanitized subject/body information below is sufficient to prove that
  Render can deliver failure email for the service.
- Successful deploy email is not required for incident readiness; failure and
  unhealthy-event notification is the relevant operational signal.

Evidence:

- Workspace notification destination is configured as `Email and Slack`.
- Workspace default service notifications are configured as `All notifications`.
- The `hr-axis-api` service has notification override settings, and service
  notifications are configured as `All notifications`.
- The operator searched the mailbox and found Render email for failed deploys.
- The latest observed email was from 2026-05-18 and had a clear failure subject
  equivalent to `Deploy failed for hr-axis-api`.
- The sanitized body stated that an error occurred during deployment for
  `hr-axis-api`, the deployment did not complete successfully, and the latest
  changes might not be live.
- A 2026-05-23 successful manual deploy did not produce an observed email,
  so successful-deploy email delivery is not counted as proven.
- `smoke:alert-routing` passed on 2026-05-23 with provider metadata and the
  deployed backend health signal:
  - status: `ok`
  - total checks: `5`
  - passed: `5`
  - failed: `0`
  - skipped: `0`
  - provider delivery: `metadata-only`
  - backend health: HTTP `200`, health `ok`, database `ok`,
    observability `ok`

Counterargument:

- The observed failure email is historical, not fresh same-day evidence.
- Render platform notifications are not app-level exception tracking.
- If broad production needs fresh email delivery proof or per-exception
  diagnostics, the next safer step is a dedicated external uptime/error
  provider test alert, not intentionally breaking deployment.

Risk:

- Recording this sanitized decision: LOW.
- Treating historical failure email as complete broad-production alerting:
  HIGH.

Door:

- Two-way-door for controlled pilot documentation.
- Provider policy changes and broad-production alert acceptance remain owner
  decisions.

Stop rule used:

- Do not record raw email addresses, message IDs, private mailbox contents,
  Slack webhook URLs, provider tokens, bearer tokens, cookies, database URLs,
  Redis URLs, or private payloads.
- Do not intentionally break a deployment just to produce a fresh email.
- Do not claim successful-deploy email delivery when only failure email was
  observed.

## Decision

Controlled staging/internal pilot:

- Go for Render platform notification policy with Slack as the live platform
  visibility channel and Render email as a historically observed failure
  backup channel.
- Successful-deploy email is not required for controlled-pilot incident
  readiness.

Broad production:

- Still not a full app-level alerting Go.
- Before broad production, choose one:
  - accept Render platform notifications for failure/unhealthy events with
    explicit owner sign-off,
  - add a dedicated external uptime provider with email test alert evidence,
  - or implement app-level error tracking with provider-delivery evidence.

## Recommended Next Step

Prefer an external uptime monitor for fresh email proof:

- Monitor URL: `https://api-staging.hr-axis.com/api/health`
- Expected healthy condition: HTTP `200` and JSON `status=ok`
- Alert channels: email first, Slack optional
- Evidence to record: provider name, monitor label, test-alert timestamp,
  destination labels, and sanitized delivery result.

This proves what the team actually needs for readiness: an external system can
notice the backend is unhealthy and send email.

## Safety

- No raw email address, Slack webhook, provider credential, bearer token,
  Clerk cookie, database URL, Redis URL, password, private key, message ID, or
  private payload is recorded.
- No production database was touched.
- No provider configuration was changed from source control.
