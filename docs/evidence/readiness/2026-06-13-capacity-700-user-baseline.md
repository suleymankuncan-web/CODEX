# Capacity 700 User Baseline - 2026-06-13

## Scope

This note records a read-only capacity baseline for the current staging posture
after the 700+ user bottleneck question.

It does not approve broad production, change provider tiers, change database
pooling, run write traffic, create checklists/tasks, import files, create
snapshots, change auth/session state, or store any secrets.

No raw bearer tokens, cookies, passwords, OTP values, provider tokens,
database URLs, Redis URLs, private keys, private payloads, or private user data
are recorded here.

## Sokrates Decision

Claim:

- The current codebase now has a repeatable read-only capacity harness.
- Staging public health passed a low-impact concurrency baseline through 25
  concurrent virtual users.
- Protected persona capacity remains blocked because no real role-specific
  bearer tokens were available in this shell.
- 700 registered users is plausible for the application shape, but 700
  concurrent protected users is not proven and must remain No-Go until protected
  route load and provider metrics are captured.

Assumptions:

- "700 users" means 700 registered/login-enabled users unless explicitly
  stated as 700 concurrent active users.
- Concurrent active users will be substantially lower than total registered
  users for the first controlled pilot.
- The current staging API is still on the known constrained provider posture:
  free API web service, `DB_POOL_MAX=5`, Redis/BullMQ controlled-pilot posture,
  and IP-based rate limiting.

Evidence:

- New script: `npm.cmd run capacity:read`.
- Local contract test: `node --test scripts/capacity-read-baseline.test.mjs`
  passed on 2026-06-13.
- Public staging read-only capacity baseline passed on 2026-06-13.
- Protected staging persona capacity run produced `blocked` with zero protected
  endpoint calls because no real bearer tokens were available.

Counterargument:

- Passing public `/health` endpoints does not prove store dashboard, rankings,
  workflow inbox, reports, imports, or admin reporting capacity.
- Provider-level bottlenecks can appear only under authenticated traffic because
  real protected endpoints touch RBAC scope, report queries, snapshots,
  workflow, and database pools.

Risk:

- This docs/script change: LOW.
- Controlled pilot with modest concurrency: LOW/MEDIUM.
- 700 concurrent protected users on current staging/provider posture: HIGH and
  not approved by this evidence.

Door:

- The script and budgets are two-way-door and can be tuned after pilot traffic.
- A launch decision based only on public health checks would be a one-way-door
  risk because real protected workload failure would be user-visible.

Stop rule:

- Do not widen capacity claims until protected role tokens, provider metrics,
  and at least one protected concurrency ladder are captured.
- Stop any capacity run on 429, 5xx, timeout/request error, non-JSON API
  response, or p95 budget breach.

## Harness

Command:

```powershell
npm.cmd run capacity:read
```

Default posture:

- Default API: `https://api-staging.hr-axis.com/api`.
- Default profile: `public`.
- Default levels: `1,5`.
- Default max concurrency guard: `50`.
- Read-only only: all endpoints are `GET`.
- Mutations excluded:
  - `POST /integrations/power-bi-export-upload`
  - `POST /integrations/import-batches`
  - `POST /snapshots/runs`
  - `POST /checklists`
- Token handling:
  - tokens are read from environment variables only,
  - tokens are never printed,
  - failure body samples redact exact bearer token values and generic
    `Bearer ...` fragments before evidence output,
  - missing protected tokens are `blocked`, not `passed`,
  - shared fallback token reuse across multiple personas requires
    `CAPACITY_ALLOW_SHARED_TOKEN=true`.
  - the `admin` profile requires an explicit super-admin or composite admin
    reads token; HR-only, import-only, and generic shared fallback tokens do not
    mark that profile ready.
- Multi-profile ladder safety:
  - if a requested concurrency level is lower than the number of ready
    profiles, the harness runs at least one virtual user per ready profile and
    records both the requested `concurrency` and actual `virtualUsers`.
- Protected profile role fit:
  - the `region-manager` profile is limited to endpoints that accept
    `REGION_MANAGER`, including snapshot runs, KPI config, rankings, store KPI
    highlights, workflow inbox, and target-distribution reads,
  - role-mismatched report summary/KPI report reads and store-specific
    workforce reads are intentionally excluded from this profile.

## Public Staging Baseline

Command:

```powershell
$env:CAPACITY_PROFILES='public'
$env:CAPACITY_LEVELS='1,5,10,25'
$env:CAPACITY_MAX_LEVEL='25'
$env:CAPACITY_TIMEOUT_MS='45000'
npm.cmd run capacity:read
```

Result: `ok`

| Concurrency | Samples | Availability | p50 | p95 | Max | 429 | 5xx |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2 | 100% | 68.95ms | 239.95ms | 239.95ms | 0 | 0 |
| 5 | 10 | 100% | 59.78ms | 149.54ms | 149.54ms | 0 | 0 |
| 10 | 20 | 100% | 71.05ms | 288.63ms | 292.48ms | 0 | 0 |
| 25 | 50 | 100% | 136.19ms | 298.72ms | 307.19ms | 0 | 0 |

Measured endpoints:

- `GET /health/live`
- `GET /health`

Interpretation:

- Public health stayed within the existing public p95 warning budget of
  `<=1200ms`.
- No 429, 5xx, timeout, request error, or HTML/non-JSON API response appeared.
- This validates only public readiness endpoints, not protected application
  capacity.

## Protected Persona Baseline

Command:

```powershell
$env:CAPACITY_PROFILES='store-manager,region-manager,admin'
$env:CAPACITY_LEVELS='1'
$env:CAPACITY_ALLOW_BLOCKED='true'
$env:CAPACITY_TIMEOUT_MS='45000'
npm.cmd run capacity:read
```

Result: `blocked`

| Profile | Status | Reason | Endpoint Calls |
| --- | --- | --- | ---: |
| `store-manager` | blocked | no bearer token available | 0 |
| `region-manager` | blocked | no bearer token available | 0 |
| `admin` | blocked | no bearer token available | 0 |

## Protected Capacity Runbook Refresh - 2026-06-13

Runbook:

- `docs/plans/protected-capacity-runbook-v1.md`

Token presence check, values not printed:

| Required env | Present in current shell | Present by name in `admin-web/.env.local` |
| --- | --- | --- |
| `CAPACITY_STORE_MANAGER_TOKEN` | no | no |
| `CAPACITY_REGION_MANAGER_TOKEN` | no | no |
| `CAPACITY_SUPER_ADMIN_TOKEN` | no | no |

Blocked documentation command:

```powershell
$env:CAPACITY_PROFILES='store-manager,region-manager,admin'
$env:CAPACITY_LEVELS='1,5,10,25'
$env:CAPACITY_MAX_LEVEL='25'
$env:CAPACITY_TIMEOUT_MS='45000'
$env:CAPACITY_ALLOW_BLOCKED='true'
npm.cmd run capacity:read
```

Result: `blocked`

Sanitized summary:

| Field | Value |
| --- | --- |
| Environment | `staging` |
| API | `https://api-staging.hr-axis.com/api` |
| Requested profiles | `store-manager`, `region-manager`, `admin` |
| Requested levels | `1`, `5`, `10`, `25` |
| Runnable profiles | `0` |
| Blocked profiles | `3` |
| Measured levels | `0` |
| Failed levels | `0` |
| Max measured concurrency | `0` |

Profile result:

| Profile | Status | Endpoint Calls | Reason |
| --- | --- | ---: | --- |
| `store-manager` | blocked | 0 | no fresh role-specific bearer token available |
| `region-manager` | blocked | 0 | no fresh role-specific bearer token available |
| `admin` | blocked | 0 | no fresh super-admin bearer token available |

Interpretation:

- Protected route capacity remains blocked and unproven.
- No protected endpoint call was executed for this blocked run.
- The blocked command is evidence that missing tokens remain fail-closed; it is
  not an acceptance pass.
- Public health capacity evidence is still separate from protected role
  capacity evidence.

Required token env names for the next protected run:

- Store manager: `CAPACITY_STORE_MANAGER_TOKEN`,
  `BACKEND_LOAD_STORE_TOKEN`, or `PROTECTED_PERF_STORE_MANAGER_TOKEN`.
- Region manager: `CAPACITY_REGION_MANAGER_TOKEN`,
  `BACKEND_LOAD_REGION_MANAGER_TOKEN`, or
  `PROTECTED_PERF_REGION_MANAGER_TOKEN`.
- Admin: `CAPACITY_SUPER_ADMIN_TOKEN`, `CAPACITY_ADMIN_READS_TOKEN`, or
  `PROTECTED_PERF_SUPER_ADMIN_TOKEN`.

## Capacity Conclusion

700 registered/login-enabled users:

- Conditional OK for a controlled pilot if real concurrent active users are
  modest and current provider risks remain accepted.
- The application architecture does not need microservices for this scale.
- Existing `scale-notes-1000-users.md` still applies: modular monolith,
  PostgreSQL, queue-backed workers, strict RBAC, and snapshot/report read models
  are the right shape.

700 concurrent protected users:

- No-Go / not proven.
- Current evidence does not exercise protected route fanout, RBAC query scope,
  report queries, workflow inbox, import/snapshot overviews, queue pressure, or
  DB pool saturation.
- Current staging settings are not sized for this claim without more evidence:
  API free tier, `DB_POOL_MAX=5`, IP rate limit `120/min`, and free/non-final
  Redis/BullMQ posture are the likely first bottlenecks.

## Bottleneck Watchlist

| Area | Current Concern | Why It Matters |
| --- | --- | --- |
| API service tier | Render API web service is still constrained for staging/current posture. | CPU, cold starts, and instance count can dominate p95 before code does. |
| DB pool | `DB_POOL_MAX=5` in Render API env. | Protected reporting can queue behind a small pool under concurrent reads. |
| Rate limit | IP-based `RATE_LIMIT_MAX=120` per minute. | A NATed office or test runner can hit 429 before app capacity is reached. |
| Redis/BullMQ | Controlled-pilot posture, not broad-production durable queue posture. | Queue loss or pressure affects imports/snapshots and operational reliability. |
| Protected route fanout | Static candidates include admin operations, master data, auth, store approvals, competitions, inbox, tasks. | Real dashboard pages can trigger multiple API reads per user. |
| Frontend shared chunks | `useLocalization` and `clerk-session` remain watchlist chunks. | Client-side performance may degrade before backend capacity is the limit. |

## Next Protected Capacity Run

Use only fresh role-specific bearer tokens and never paste them into docs:

```powershell
$env:CAPACITY_STORE_MANAGER_TOKEN='[redacted]'
$env:CAPACITY_REGION_MANAGER_TOKEN='[redacted]'
$env:CAPACITY_SUPER_ADMIN_TOKEN='[redacted]'
$env:CAPACITY_PROFILES='store-manager,region-manager,admin'
$env:CAPACITY_LEVELS='1,5,10,25'
$env:CAPACITY_MAX_LEVEL='25'
$env:CAPACITY_TIMEOUT_MS='45000'
npm.cmd run capacity:read
```

Only after the 25-concurrency protected run is clean should a higher approved
window be considered, for example `50`, then `100`, while watching API, DB,
Redis, worker, and rate-limit provider metrics.

## Verification

Completed locally on 2026-06-13:

```powershell
node --test scripts\capacity-read-baseline.test.mjs
$env:CAPACITY_PROFILES='public'; $env:CAPACITY_LEVELS='1,5,10,25'; $env:CAPACITY_MAX_LEVEL='25'; $env:CAPACITY_TIMEOUT_MS='45000'; npm.cmd run capacity:read
$env:CAPACITY_PROFILES='store-manager,region-manager,admin'; $env:CAPACITY_LEVELS='1'; $env:CAPACITY_ALLOW_BLOCKED='true'; $env:CAPACITY_TIMEOUT_MS='45000'; npm.cmd run capacity:read
git diff --check
npm.cmd run test:scripts
```

Results:

- `node --test scripts\capacity-read-baseline.test.mjs`: passed.
- Public staging capacity read baseline: passed through concurrency `25`.
- Protected persona capacity read baseline: blocked, with zero protected
  endpoint calls because no bearer tokens were available.
- `git diff --check`: passed.
- `npm.cmd run test:scripts`: passed, 469 tests.
