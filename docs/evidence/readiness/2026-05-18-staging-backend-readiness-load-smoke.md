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
- overall status: `blocked`
- passed groups: `1`
- failed groups: `0`
- skipped groups: `4`

## Public API Health

- status: `passed`
- samples: `6`
- availability: `100%`
- p50: `58.08ms`
- p95: `208.79ms`
- max: `208.79ms`
- 5xx count: `0`

Endpoint detail:

| Endpoint | Samples | Statuses | p50 | p95 | Max | 5xx |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| `GET /api/health/live` | 3 | `200` | `170.65ms` | `208.79ms` | `208.79ms` | 0 |
| `GET /api/health` | 3 | `200` | `58.08ms` | `85.82ms` | `85.82ms` | 0 |

## Protected Groups

Skipped because no real bearer token was provided:

- `authenticated session`
- `store read routes`
- `competition read routes`
- `import read routes`

These groups must be rerun with a fresh staging bearer token before broad production readiness can claim protected-route performance.

## Excluded Mutation Routes

These routes are intentionally excluded from the simple GET budget:

- `POST /api/integrations/power-bi-export-upload`
- `POST /api/integrations/import-batches`
- `POST /api/snapshots/runs`

Upload/import mutation risk remains covered by upload resource guardrails, command benchmarks, and background job evidence.

## Safety

- Raw bearer tokens, Clerk cookies, authorization codes, PKCE verifiers, client secrets, and private keys were not printed.
- Protected route groups were skipped instead of marked as passed.
- API correctness requires non-HTML JSON responses; SPA fallback HTML from API routes is treated as a failure.

## Note

The first Windows/Node run without `NODE_OPTIONS=--dns-result-order=ipv4first` showed a false public-health latency spike from network resolution fallback. The recorded command above uses the same Windows DNS setting already documented for staging performance measurements.
