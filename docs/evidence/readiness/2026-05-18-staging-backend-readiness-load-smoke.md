# Staging Backend Readiness Load Smoke - 2026-05-18

Status: blocked by missing real bearer token.

This evidence records the first Slice 9 backend readiness load smoke against staging. It does not approve protected route performance because no real `BACKEND_LOAD_BEARER_TOKEN` or `READINESS_BEARER_TOKEN` was available.

## Command

```powershell
$env:NODE_OPTIONS="--dns-result-order=ipv4first"
$env:BACKEND_LOAD_OUTPUT="json"
$env:BACKEND_LOAD_ENVIRONMENT="staging"
$env:BACKEND_LOAD_API_BASE_URL="https://api-staging.hr-axis.com/api"
$env:BACKEND_LOAD_ITERATIONS="3"
$env:BACKEND_LOAD_CONCURRENCY="2"
$env:BACKEND_LOAD_TIMEOUT_MS="45000"
npm.cmd run smoke:backend-readiness-load
```

## Summary

- environment: `staging`
- API base URL: `https://api-staging.hr-axis.com/api`
- iterations: `3`
- concurrency: `2`
- token provided: `false`
- token sources: none
- shared token reuse: `false`
- overall status: `blocked`
- passed groups: `1`
- failed groups: `0`
- skipped groups: `4`

## Public API Health

- status: `passed`
- samples: `6`
- availability: `100%`
- p50: `132.23ms`
- p95: `224.59ms`
- max: `224.59ms`
- 5xx count: `0`

Endpoint detail:

| Endpoint | Samples | Statuses | p50 | p95 | Max | 5xx |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| `GET /api/health/live` | 3 | `200` | `180.68ms` | `224.59ms` | `224.59ms` | 0 |
| `GET /api/health` | 3 | `200` | `132.23ms` | `152.12ms` | `152.12ms` | 0 |

## Protected Groups

Skipped because no real role-specific bearer tokens were provided:

- `authenticated session`
- `store read routes`
- `competition read routes`
- `import read routes`

These groups must be rerun with fresh staging bearer tokens before broad production readiness can claim protected-route performance:

- store routes: `BACKEND_LOAD_STORE_TOKEN`
- competition routes: `BACKEND_LOAD_COMPETITION_TOKEN`
- import routes: `BACKEND_LOAD_IMPORT_TOKEN`

`BACKEND_LOAD_BEARER_TOKEN` / `READINESS_BEARER_TOKEN` can exercise the auth/session path, but a shared token is not reused across role-specific route groups unless `BACKEND_LOAD_ALLOW_SHARED_TOKEN=true` is set for a diagnostic run.

## Excluded Mutation Routes

These routes are intentionally excluded from the simple GET budget:

- `POST /api/integrations/power-bi-export-upload`
- `POST /api/integrations/import-batches`
- `POST /api/snapshots/runs`

Upload/import mutation risk remains covered by upload resource guardrails, command benchmarks, and background job evidence.

## Safety

- Raw bearer tokens, Clerk cookies, authorization codes, PKCE verifiers, client secrets, and private keys were not printed.
- Protected route groups were skipped instead of marked as passed when no role-specific bearer token was available.
- API correctness requires non-HTML JSON responses; SPA fallback HTML from API routes is treated as a failure.

## Note

The first Windows/Node run without `NODE_OPTIONS=--dns-result-order=ipv4first` showed a false public-health latency spike from network resolution fallback. The recorded command above uses the same Windows DNS setting already documented for staging performance measurements.
