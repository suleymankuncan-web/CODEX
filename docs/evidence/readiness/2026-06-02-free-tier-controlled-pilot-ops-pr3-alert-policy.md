# Free-Tier Controlled Pilot Ops PR-3 Alert Policy - 2026-06-02

## Scope

This note records PR-3 of
`docs/plans/free-tier-controlled-pilot-ops-posture-v1.md`.

The PR adds a controlled-pilot alert and incident policy, links it from the
operating registries, and keeps app-level paid exception tracking parked as a
production requirement.

No product code, API response shape, auth/permission semantics, database
schema, provider tier, provider configuration, queue behavior, import
lifecycle, snapshot interpretation, scoring, approval workflow, or UI behavior
changed.

No secrets, provider URLs, raw tokens, webhooks, email addresses, message IDs,
database URLs, Redis URLs, or private payloads are recorded.

## Decision

Controlled pilot:

- Better Stack external health email alert proof plus Render platform
  notifications are accepted for controlled pilot.
- `smoke:alert-routing` remains the repeatable alert-routing gate.
- App-level paid exception tracking is not a controlled-pilot blocker.

Broad production:

- Remains `No-Go`.
- Final production alert destination, incident owner path, app-level exception
  tracking decision or explicit risk acceptance, and production profile evidence
  remain parked production work.

## Files Changed

- `docs/plans/controlled-pilot-alert-incident-policy-v1.md`
- `docs/evidence/readiness/2026-06-02-free-tier-controlled-pilot-ops-pr3-alert-policy.md`
- `docs/plans/free-tier-controlled-pilot-ops-posture-v1.md`
- `docs/plans/runbook-registry-v1.md`
- `docs/plans/decision-registry-v1.md`
- `docs/plans/production-staging-incident-response-skeleton.md`

## Risk Reduced

- Future operators have one explicit controlled-pilot alert policy.
- The project no longer has to infer from separate Render/Better Stack evidence
  whether alerting blocks controlled pilot.
- The policy keeps production incident management and app-level error tracking
  from being silently overclaimed.

## Rollback

Revert the docs-only changes. No provider reconfiguration, secret rotation,
runtime rollback, migration, data repair, or incident replay is required.

## Verification

Run locally for this PR:

```powershell
git diff --check # pass
npm.cmd run test:scripts # pass, 405/405
```

Run public staging alert smoke when network access is available:

```powershell
$env:ALERT_SMOKE_ENVIRONMENT="staging"
$env:ALERT_SMOKE_BACKEND_URL="https://api-staging.hr-axis.com/api"
$env:ALERT_SMOKE_TIMEOUT_MS="45000"
npm.cmd run smoke:alert-routing # pass, 4/5 passed, 1 provider-metadata check skipped because no provider metadata was supplied
```

Sanitized alert smoke result:

- Evidence time: `2026-06-02T09:31:52.451Z`.
- environment: `staging`.
- status: `ok`.
- total checks: `5`.
- passed: `4`.
- failed: `0`.
- skipped: `1`.
- skipped check: alert provider metadata because no provider metadata was
  supplied in this shell.
- backend health alert signal: HTTP `200`, health `ok`, database `ok`,
  observability `ok`.
- provider delivery: `not-configured` in this smoke. The external email alert
  proof remains the existing Better Stack evidence linked by the policy.

## Stop Rules Preserved

- Do not buy or require paid infrastructure.
- Do not add Sentry, DSNs, provider secrets, webhooks, or private destinations.
- Do not change provider tier or production config.
- Do not intentionally break staging or production to trigger an alert.
- Do not change API, DB, auth, queue, import, scoring, snapshot, workflow, or
  UI behavior.
- Do not claim broad-production readiness.
