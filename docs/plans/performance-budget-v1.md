# Performance Budget V1

Date: 2026-05-23

## Purpose

Create the first explicit performance budget for controlled pilot readiness.
This document records current public staging latency, frontend build chunk
watchlists, protected latency blockers, and the first warning thresholds.

It does not add a CI gate or change application behavior.

## Sokrates Decision

Claim: the project needs a visible performance budget before it needs another
performance refactor.

Assumption: current public staging health is acceptable for controlled pilot,
but protected route latency cannot be honestly closed without role-specific
tokens.

Evidence:

- `npm.cmd --prefix admin-web run build` passed on 2026-05-23.
- `smoke:backend-readiness-load` public health group passed against staging on
  2026-05-23 with 100% availability and no 5xx.
- Protected session/store/import/competition load groups were skipped because
  no role-specific bearer tokens were available in this shell.

Counterargument: performance budgets without gates are easy to ignore. The
answer is to start with a warning budget and only add failing gates after the
biggest current chunks and protected-token evidence are understood.

Risk: LOW as docs-only. MEDIUM when budgets start failing CI. HIGH if we make
production decisions from tokenless public checks only.

Door: two-way-door. Thresholds can be tuned after pilot traffic and protected
latency evidence.

Stop rule: do not add a failing performance gate while current watchlist chunks
already exceed the proposed future threshold unless a split/remediation plan is
included.

Verification ladder:

1. Build succeeds.
2. Public staging latency stays inside budget.
3. Protected route latency is measured with real role tokens.
4. Bundle watchlist is reviewed after meaningful frontend changes.
5. Only stable budgets become CI gates.

## Current Frontend Build Evidence

Command:

```powershell
npm.cmd --prefix admin-web run build
```

Result: passed on 2026-05-23.

Largest chunks from the build:

| Asset | Raw Size | Gzip Size | Status |
| --- | ---: | ---: | --- |
| `useLocalization-D50IKZTJ.js` | 467.79 kB | 102.40 kB | Watchlist. Primary future split candidate. |
| `clerk-session-DUNKBM2a.js` | 287.52 kB | 84.91 kB | Watchlist. Auth/session vendor/runtime candidate. |
| `CompetitionDashboardPage-3vb5Mied.js` | 62.45 kB | 10.53 kB | Acceptable for now; watch if competition UI expands. |
| `StoreChecklistsPage-BTXVYJ1z.js` | 51.63 kB | 12.88 kB | Acceptable after prior refactor, but keep near page threshold. |
| `index-BjbR3CNK.js` | 50.43 kB | 14.65 kB | Acceptable core app chunk; watch for shared imports. |
| `StoreApprovalsPage-D--M1DVI.js` | 49.57 kB | 8.96 kB | Acceptable for now. |
| `MasterDataBootstrapPage-C6CnAQdp.js` | 44.96 kB | 8.55 kB | Acceptable for now. |
| `StoreMyPerformancePage-BCzGlP1P.js` | 44.28 kB | 10.31 kB | Acceptable for now. |

CSS:

- `index-CByzA7T2.css`: 180.92 kB raw / 29.69 kB gzip.
- Current posture: watchlist only. Do not reopen CSS refactor without concrete
  UI/perf evidence.

## Current Public Staging Load Evidence

Command:

```powershell
$env:BACKEND_LOAD_API_BASE_URL='https://api-staging.hr-axis.com/api'
$env:BACKEND_LOAD_ENVIRONMENT='staging'
$env:BACKEND_LOAD_ITERATIONS='3'
$env:BACKEND_LOAD_CONCURRENCY='2'
$env:BACKEND_LOAD_TIMEOUT_MS='45000'
npm.cmd run smoke:backend-readiness-load
```

Result:

- Public health group: passed
- Availability: 100%
- p50: `101.9ms`
- p95: `259.57ms`
- 5xx: 0
- Overall smoke status: `blocked` because protected token groups were skipped.

## Budget Table

| Area | Warning Budget | Stop/Block Budget | Current Status |
| --- | --- | --- | --- |
| Public backend health p50 | `<= 500ms` | `> 1000ms` for repeated runs or any 5xx | Passing in latest smoke. |
| Public backend health p95 | `<= 1200ms` | `> 2500ms` for repeated runs or any 5xx | Passing in latest smoke. |
| Protected session p95 | `<= 1500ms` | Missing token after auth/session-affecting deploy blocks widening pilot scope. | Blocked, no token. |
| Protected store/read p95 | `<= 2000ms` | Missing token after store/read-affecting deploy blocks widening pilot scope. | Blocked, no role token. |
| Protected import/read p95 | `<= 2500ms` | Missing token after import/read-affecting deploy blocks integration pilot expansion. | Blocked, no role token. |
| App/page JS chunk raw size | Warn above `250 kB` for shared/runtime chunks and above `75 kB` for route chunks. | No failing gate yet. | `useLocalization` and `clerk-session` exceed shared warning. |
| App/page JS chunk gzip size | Warn above `80 kB` for shared/runtime chunks and above `25 kB` for route chunks. | No failing gate yet. | Two shared chunks exceed/near warning. |
| CSS raw size | Warn above `200 kB` raw or evidence of render delay. | No failing gate yet. | 180.92 kB raw, below warning. |

## Watchlist And First Actions

1. Do not performance-refactor immediately. Keep the watchlist visible.
2. If localization work continues, inspect why `useLocalization` remains large
   and decide whether namespace splitting is safe.
3. If auth/session work continues, inspect `clerk-session` import boundaries and
   avoid pulling auth runtime into routes that do not need it.
4. If competition UI expands, keep `CompetitionDashboardPage` below the route
   chunk warning or split naturally by feature.
5. Before any broad production decision, rerun protected load with real role
   tokens and record p50/p95 per role group.

## Out Of Scope

- CI performance fail gate.
- Bundle analyzer dependency.
- Route preloading redesign.
- CSS/global styling refactor.
- Backend caching changes.
- Rate-limit or queue tuning.
