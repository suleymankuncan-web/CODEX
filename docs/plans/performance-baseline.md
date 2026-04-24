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
  - `npm.cmd run perf:baseline`

### Environment Inputs
- `PERF_BASE_URL`
- `PERF_ITERATIONS`
- `PERF_USER_ID`
- `PERF_ROLE_CODES`
- `PERF_COMPANY_IDS`
- `PERF_ENABLE_MUTATIONS=true` for command timing

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
Status: Harness ready, first live baseline captured
