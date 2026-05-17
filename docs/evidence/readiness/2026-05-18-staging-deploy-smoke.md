# Staging Deployed Readiness Smoke - 2026-05-18

## Scope

- Environment: staging
- Frontend URL: `https://staging.hr-axis.com`
- Backend API URL: `https://api-staging.hr-axis.com/api`
- Command: `npm.cmd run smoke:deployed-readiness`
- Local command environment:
  - `READINESS_ENVIRONMENT=staging`
  - `READINESS_FRONTEND_URL=https://staging.hr-axis.com`
  - `READINESS_BACKEND_URL=https://api-staging.hr-axis.com/api`
  - `READINESS_TIMEOUT_MS=45000`
  - `READINESS_BEARER_TOKEN` was not set.

## Result

- Status: `ok`
- Total checks: 13
- Passed: 12
- Failed: 0
- Skipped: 1

## Passed Checks

- `GET /api/health/live` returned 200 with `{"status":"ok","service":"hr-axis-staging-api"}`.
- `GET /api/health` returned 200 with database status `ok`.
- Backend rate-limit headers were present:
  - `x-ratelimit-limit=120`
  - `x-ratelimit-remaining=119`
  - `x-ratelimit-reset` present.
- Backend `x-correlation-id` was present on health responses.
- Frontend root returned 200 HTML.
- Frontend SPA fallback route `/store/me` returned 200 HTML.
- First discovered frontend static assets returned non-HTML asset content.

## Skipped Checks

- `GET /api/auth/session` was skipped because no real `READINESS_BEARER_TOKEN` was provided.
- This evidence does not prove Clerk-backed authenticated role/read/action scope for staging.

## Safety

- No bearer token, cookie, authorization code, PKCE verifier, client secret, private key, database URL, Redis URL, or production credential is recorded in this evidence.
- The smoke command reports only whether a token was provided; it does not print the token.

## Decision

This evidence is sufficient for public deployed readiness of the current staging frontend/backend pair. It is not sufficient for full authenticated readiness; a later run with a real staging bearer token must prove `/api/auth/session` role codes, read scope, and action scope.
