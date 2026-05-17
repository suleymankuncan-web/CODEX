# 2026-05-18 Staging Observability Deploy Smoke

## Metadata

- Environment: staging
- Frontend URL: `https://staging.hr-axis.com`
- Backend API URL: `https://api-staging.hr-axis.com/api`
- Trigger: post-merge Render deploy verification for PR #230 / Observability V1
- Executed at: `2026-05-17T23:46:31.269Z`
- Command:

```powershell
$env:READINESS_ENVIRONMENT="staging"
$env:READINESS_FRONTEND_URL="https://staging.hr-axis.com"
$env:READINESS_BACKEND_URL="https://api-staging.hr-axis.com/api"
$env:READINESS_TIMEOUT_MS="45000"
npm.cmd run smoke:deployed-readiness
```

## Result

- Status: `ok`
- Total checks: 14
- Passed: 13
- Failed: 0
- Skipped: 1

## Passed Signals

- `GET /api/health/live` returned `200`.
- `GET /api/health` returned `200`.
- Database health status was `ok`.
- Redis health was `skipped` because staging is still `QUEUE_BACKEND=in-memory`.
- Observability block was present:
  - status: `ok`
  - mode: `log-only`
  - externalDelivery: `not-enabled`
  - readinessProfile: `controlled-pilot`
  - logLevel: `info`
- Backend rate limit headers were present.
- Backend correlation headers were present.
- Frontend root, SPA fallback, security headers, and static assets passed.

## Skipped Signals

- Auth/session smoke was skipped because no real `READINESS_BEARER_TOKEN` was provided.
- This evidence must not be read as proof of real Clerk session/role/scope behavior.

## Decision

- Render deploy smoke for Observability V1: Go for continued readiness hardening.
- Broad production rollout remains blocked by the existing readiness roadmap until protected auth smoke, alert provider decision, backup/restore evidence, shared rate limiting, and final readiness packet are closed or explicitly accepted.

## Secret Handling

- No bearer token was provided.
- No raw cookie, token, authorization code, PKCE verifier, client secret, private key, database URL, or provider secret is recorded here.
