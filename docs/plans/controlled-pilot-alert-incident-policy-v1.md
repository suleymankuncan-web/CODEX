# Controlled Pilot Alert And Incident Policy V1

Status: active
Shelf: readiness
Scope: controlled staging/internal pilot only
Broad production: No-Go

## Reader And Action

Reader:

- an operator, future agent, engineer, or pilot moderator deciding whether the
  current free/platform alerting posture is enough for the controlled pilot.

After reading, they should be able to run the right smoke, know which alert
signals are accepted for pilot, know which production alerting requirements
remain parked, and avoid adding paid/app-level telemetry without an owner
decision.

## Purpose

Close the controlled-pilot alerting posture without buying paid observability
or pretending the project has full production incident management.

The controlled pilot needs a real external health signal and a clear first
response path. It does not need app-level exception tracking, SMS/phone
escalation, or broad-production incident policy before the pilot can continue.

## Non-Goals

- Do not add Sentry or any other paid app-level error tracking provider.
- Do not add provider secrets, DSNs, API keys, webhooks, or private alert
  destinations.
- Do not change application logging, exception handling, health endpoint
  behavior, auth, API, DB, queue, import, snapshot, scoring, workflow, or UI
  behavior.
- Do not intentionally break staging or production to prove an alert.
- Do not claim broad-production incident readiness.

## Current Evidence Baseline

Use these sources:

- `docs/evidence/readiness/2026-05-23-alert-email-policy-decision-v1.md`
- `docs/evidence/readiness/2026-05-23-better-stack-email-alert-proof-v1.md`
- `docs/plans/production-staging-incident-response-skeleton.md`
- `docs/backend/operational-monitoring-contract.md`
- `docs/evidence/readiness/2026-06-02-free-tier-controlled-pilot-ops-pr1-inventory.md`

## Controlled-Pilot Accepted Signals

| Signal | Pilot status | What it proves | What it does not prove |
| --- | --- | --- | --- |
| Better Stack public health monitor | accepted | An external provider monitors `https://api-staging.hr-axis.com/api/health` and can send an email test alert. | It does not prove app-level stack traces, SMS/phone escalation, or production incident management. |
| Render platform notifications | accepted as backup/supporting signal | Platform failure/deploy/service notifications can help detect hosting events. | It does not replace external uptime monitoring or app-level exception diagnostics. |
| Backend `/api/health` alertable fields | accepted | Staging health exposes service, DB, Redis/BullMQ, observability, and readiness profile signals for smoke checks. | It does not prove protected route behavior or app-level exception capture. |
| `smoke:alert-routing` | accepted gate | The repository can verify alert runbook text, provider metadata shape, and public backend health signal. | It does not prove real provider delivery unless provider metadata/evidence is supplied. |

## Parked Production Requirements

Broad production remains blocked until an owner accepts or proves:

- final production alert destination,
- production incident owner path,
- app-level exception tracking decision or explicit written risk acceptance,
- escalation policy beyond email/platform notification if required,
- production profile smoke and evidence,
- production-grade Redis and recovery posture from their separate gates.

## Operator Flow

### 1. Run The Public Alert Smoke

Use staging backend health:

```powershell
$env:ALERT_SMOKE_ENVIRONMENT="staging"
$env:ALERT_SMOKE_BACKEND_URL="https://api-staging.hr-axis.com/api"
$env:ALERT_SMOKE_TIMEOUT_MS="45000"
npm.cmd run smoke:alert-routing
```

If provider metadata is available and safe to record, use labels only:

```powershell
$env:ALERT_PROVIDER_NAME="better-stack-uptime"
$env:ALERT_PRIMARY_DESTINATION="primary-responder-email"
$env:ALERT_BACKUP_DESTINATION="render-platform-notifications"
```

Do not record raw email addresses, webhooks, provider tokens, message IDs, or
private mailbox contents.

### 2. Classify The Result

Continue controlled pilot when:

- smoke status is `ok`,
- backend health signal is present,
- provider metadata is either present and complete or explicitly not needed for
  the current tokenless smoke,
- Better Stack proof remains the current external email alert evidence,
- incident response skeleton still names owner roles and guarded commands.

Pause controlled pilot alert posture when:

- backend health signal fails,
- alert routing docs lose the required incident path,
- provider delivery is assumed without evidence,
- no first responder or owner path exists for the pilot session,
- app-level exception tracking is required for the pilot claim.

### 3. First Response Path

For controlled pilot P0/P1 alert symptoms:

1. Name an incident lead.
2. Name the evidence owner.
3. Run guarded smoke only.
4. Preserve sanitized health/log evidence.
5. Decide Rollback / Forward-fix / No-Go.
6. Record follow-up in the pilot feedback or incident note path.

Owner path:

- Incident lead -> Release operator -> Backend owner for backend health alerts.
- Incident lead -> Frontend owner -> Release operator for frontend reachability.
- Incident lead -> Data owner -> Backend owner for import, snapshot, or data
  quality symptoms.
- Incident lead -> Business approver when residual user-facing risk remains.

## Evidence Template

```text
Date/time:
Environment:
Alert signal:
Detected by:
Provider label:
Destination label:
Smoke command:
Smoke status:
Backend health summary:
Owner path:
Decision:
Next operator action:
Secrets recorded: none
Behavior changed: no
Broad production claimed: no
```

## Decision

Controlled pilot:

- Go for Better Stack external health email alert proof plus Render platform
  notifications as backup/supporting signal.
- App-level paid exception tracking is not a controlled-pilot blocker.
- Keep `smoke:alert-routing` as the repeatable local/public gate.

Broad production:

- No-Go until final incident owner path, production alert destination,
  app-level error tracking decision or written risk acceptance, and production
  profile evidence are accepted.

## Rollback

This policy is docs-only. Rollback is a docs revert.

No provider reconfiguration, secret rotation, runtime rollback, migration, data
repair, or incident replay is required.

## Verification

For changes to this policy:

```powershell
git diff --check
npm.cmd run test:scripts
```

When staging public health is available:

```powershell
$env:ALERT_SMOKE_ENVIRONMENT="staging"
$env:ALERT_SMOKE_BACKEND_URL="https://api-staging.hr-axis.com/api"
$env:ALERT_SMOKE_TIMEOUT_MS="45000"
npm.cmd run smoke:alert-routing
```
