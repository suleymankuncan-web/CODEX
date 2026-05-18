# Performance Baseline

## Anchor
This note corresponds to the `Performance baseline` item in [phase-6-closeout-checklist.md](./phase-6-closeout-checklist.md).

## Goal
Establish one repeatable measurement path for the critical backend flows before new domains such as incentive management and richer KPI packs are added.

## Critical Paths To Measure

### Read Paths
- `GET /api/integrations/import-batches/overview`
- `GET /api/integrations/import-batches/needs-action`
- `GET /api/snapshots/runs/overview`
- `GET /api/snapshots/runs/needs-action`
- `GET /api/reports/summary`
- `GET /api/reports/workforce`
- `GET /api/reports/kpis`
- `GET /api/reports/checklists`
- `GET /api/reports/turnover`

### Command Paths
- `POST /api/integrations/import-batches`
- `POST /api/snapshots/runs`

### End-to-End Background Work
- import materialization completion time
- snapshot generation completion time
- rerun acceptance latency

## Measurement Harness
- script: [scripts/performance-baseline.ts](../../backend/nestjs/scripts/performance-baseline.ts)
- npm command:
  - `npm.cmd --prefix backend/nestjs run perf:baseline`
- public frontend/API script: [public-performance-baseline.mjs](../../scripts/public-performance-baseline.mjs)
- root npm command:
  - `npm.cmd run perf:public`
- protected staging API gate: [protected-performance-baseline.mjs](../../scripts/protected-performance-baseline.mjs)
- root npm command:
  - `npm.cmd run perf:protected`
- backend readiness load smoke: [backend-readiness-load-smoke.mjs](../../scripts/backend-readiness-load-smoke.mjs)
- root npm command:
  - `npm.cmd run smoke:backend-readiness-load`

### Environment Inputs
- `PERF_BASE_URL`
- `PERF_ITERATIONS`
- `PERF_TARGET_PROFILE=admin|store-manager|store-personnel|all`
- `PERF_AUTH_TOKEN` or `SMOKE_AUTH_TOKEN` or `STORE_ME_SMOKE_TOKEN` for real staging JWT/bearer mode
- `PROTECTED_PERF_PROFILES=store-manager,store-personnel`
- `PROTECTED_PERF_STORE_MANAGER_TOKEN` for store-manager protected staging baseline
- `PROTECTED_PERF_STORE_PERSONNEL_TOKEN` for store-personnel protected staging baseline
- `PROTECTED_PERF_ADMIN_TOKEN` for admin protected staging baseline
- `PROTECTED_PERF_TOKEN`, `PILOT_SMOKE_BEARER_TOKEN`, or `AUTH_SMOKE_BEARER_TOKEN` as single-token fallback inputs
- `PROTECTED_PERF_ALLOW_BLOCKED=true` to record the current no-token blocker as JSON without failing the local shell
- `PROTECTED_PERF_ALLOW_SHARED_TOKEN=true` to intentionally reuse one token across multiple endpoint profiles for diagnostics
- `PROTECTED_PERF_API_BASE_URL`
- `PROTECTED_PERF_ITERATIONS`
- `PROTECTED_PERF_ENABLE_MUTATIONS=true`
- `PERF_USER_ID`
- `PERF_ROLE_CODES`
- `PERF_COMPANY_IDS`
- `PERF_ENABLE_MUTATIONS=true` for command timing
- `PUBLIC_PERF_FRONTEND_BASE_URL`
- `PUBLIC_PERF_API_BASE_URL`
- `PUBLIC_PERF_ITERATIONS`
- `PUBLIC_PERF_ASSET_ITERATIONS`
- `PUBLIC_PERF_FRONTEND_ROUTES`
- `PUBLIC_PERF_API_PATHS`
- `BACKEND_LOAD_API_BASE_URL`
- `BACKEND_LOAD_ENVIRONMENT`
- `BACKEND_LOAD_ITERATIONS`
- `BACKEND_LOAD_CONCURRENCY`
- `BACKEND_LOAD_TIMEOUT_MS`
- `BACKEND_LOAD_BEARER_TOKEN` or `READINESS_BEARER_TOKEN` for real protected route budgets
- `BACKEND_LOAD_REQUIRE_PROTECTED=true` to fail the shell when protected budgets are skipped
- `BACKEND_LOAD_OUTPUT=text|json|both`

When running against staging from Node on Windows, use `NODE_OPTIONS=--dns-result-order=ipv4first` if the first fetch attempt times out while PowerShell/browser access works.

### Backend Readiness Load Smoke

`npm.cmd run smoke:backend-readiness-load` is the production readiness budget smoke. It is intentionally lighter than a full load test and does not replace provider APM, k6, or real traffic replay.

Route groups:

- `public api health`
  - `GET /api/health/live`
  - `GET /api/health`
- `authenticated session`
  - `GET /api/auth/session`
- `store read routes`
  - `GET /api/reports/kpi-config`
  - `GET /api/reports/my-performance?mode=live&periodType=monthly`
  - `GET /api/reports/rankings?periodType=monthly&limit=20&offset=0`
  - `GET /api/reports/leaderboards/closed?periodType=monthly&limit=10`
  - `GET /api/reports/store-kpi-highlights?periodType=monthly`
- `competition read routes`
  - `GET /api/competitions?limit=20&offset=0`
- `import read routes`
  - `GET /api/integrations/import-batches/overview`
  - `GET /api/integrations/import-batches/needs-action?limit=12&offset=0`

Budget rules:

- availability must remain `100%` for measured route groups
- `5xx` count must remain `0`
- API responses must be valid JSON, not frontend fallback HTML
- public health p95 budget starts at `1200ms`
- authenticated session p95 budget starts at `1500ms`
- store and competition read p95 budgets start at `2000ms`
- import read p95 budget starts at `2500ms`

Upload/import mutations are excluded from this simple GET budget:

- `POST /api/integrations/power-bi-export-upload`
- `POST /api/integrations/import-batches`
- `POST /api/snapshots/runs`

Those paths remain covered by upload resource guardrails, command benchmarks, and background job evidence. If upload windows degrade API p95, move parsing/materialization to the durable worker path before broad production.

## Current Reality

### What Is Ready
- repeatable benchmark harness now exists
- the script computes:
  - min
  - p50
  - p95
  - max
  - average
- reporting drill-down endpoints automatically join the run when a latest completed snapshot exists

### Live Baseline Captured In This Session
Benchmark environment:
- live infra via `infra/docker-compose.live-e2e.yml`
- PostgreSQL at `localhost:54329`
- Redis at `localhost:6389`
- benchmark target app at `http://localhost:3100/api`
- iterations: `5`
- auth mode: `mock`

Observed read baseline:
- `GET /api/integrations/import-batches/overview`
  - p50 `12.75ms`
  - p95 `29.23ms`
  - avg `15.32ms`
- `GET /api/snapshots/runs/overview`
  - p50 `12.51ms`
  - p95 `12.95ms`
  - avg `12.37ms`
- `GET /api/reports/summary`
  - p50 `12.62ms`
  - p95 `14.97ms`
  - avg `12.96ms`
- `GET /api/integrations/import-batches/needs-action`
  - p50 `12.44ms`
  - p95 `13.36ms`
  - avg `12.53ms`
- `GET /api/snapshots/runs/needs-action`
  - p50 `12.40ms`
  - p95 `12.94ms`
  - avg `12.29ms`
- `GET /api/reports/workforce`
  - p50 `12.49ms`
  - p95 `12.73ms`
  - avg `12.36ms`
- `GET /api/reports/kpis`
  - p50 `12.78ms`
  - p95 `13.49ms`
  - avg `12.67ms`
- `GET /api/reports/checklists`
  - p50 `12.98ms`
  - p95 `740.59ms`
  - avg `158.08ms`
- `GET /api/reports/turnover`
  - p50 `12.30ms`
  - p95 `743.98ms`
  - avg `161.23ms`

Initial reading:
- most overview and summary paths are comfortably inside the first acceptance thresholds
- workforce and KPI drill-downs also look healthy on this small seeded dataset
- checklist and turnover show a single large outlier each, which pushes p95 sharply upward
- because p50 stays low while p95 spikes, this looks more like intermittent cold-path or startup variance than uniformly slow SQL

Follow-up focus:
- rerun the same benchmark with `10+` iterations to confirm whether checklist / turnover spikes repeat
- if they repeat, inspect those query paths first before adding new reporting-heavy domains

## Recommended Benchmark Conditions

### Small
- 1 import batch with ~100 rows
- 1 snapshot run over a limited slice
- 5 request iterations per read endpoint

### Medium
- 1 import batch with ~1,000 rows
- 1 snapshot run with workforce + KPI + checklist + turnover generation
- 10 request iterations per read endpoint

### Large
- import batches approaching expected production shape
- snapshot run after realistic reporting volume exists
- mutation measurements enabled

## First Acceptance Thresholds
These are initial targets, not guarantees.

- overview and summary endpoints:
  - p50 under `250ms`
  - p95 under `600ms`
- reporting drill-down endpoints:
  - p50 under `500ms`
  - p95 under `1200ms`
- command acceptance:
  - p50 under `400ms`
  - p95 under `1000ms`

If real numbers exceed these targets, the next action should be:
- identify which SQL path dominates
- review indexes and query predicates
- separate command acceptance latency from background completion latency

## Next Step
1. rerun with `PERF_ITERATIONS=10` or `20`
2. optionally enable command timing with `PERF_ENABLE_MUTATIONS=true`
3. compare checklist / turnover p95 stability before Phase 7 expansion

## Current Status
Status: Harness ready, local live baseline captured, public staging baseline captured.

Latest staging evidence:

- [Staging Public Performance Baseline - 2026-05-09](../evidence/performance/2026-05-09-staging-public-performance-baseline.md)
- [Staging Protected Performance Gate - 2026-05-09](../evidence/performance/2026-05-09-staging-protected-performance-gate.md)
- [Staging Backend Readiness Load Smoke - 2026-05-18](../evidence/readiness/2026-05-18-staging-backend-readiness-load-smoke.md)

Protected staging API baseline is still blocked until real bearer tokens or smoke auth sessions are provided.

### Protected staging API baseline

Run the protected gate with fresh Clerk JWTs from the matching staging roles:

```powershell
$env:NODE_OPTIONS="--dns-result-order=ipv4first"
$env:PROTECTED_PERF_API_BASE_URL="https://api-staging.hr-axis.com/api"
$env:PROTECTED_PERF_STORE_MANAGER_TOKEN="<fresh-redacted-clerk-jwt>"
$env:PROTECTED_PERF_STORE_PERSONNEL_TOKEN="<fresh-redacted-clerk-jwt>"
npm.cmd run perf:protected
Remove-Item Env:PROTECTED_PERF_STORE_MANAGER_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:PROTECTED_PERF_STORE_PERSONNEL_TOKEN -ErrorAction SilentlyContinue
```

The gate fails when required protected tokens are missing unless `PROTECTED_PERF_ALLOW_BLOCKED=true` is set for blocker evidence capture.

When measuring both `store-manager` and `store-personnel`, use profile-specific tokens by default. A shared fallback token is accepted only when measuring a single profile or when `PROTECTED_PERF_ALLOW_SHARED_TOKEN=true` is explicitly set for a diagnostic run.
