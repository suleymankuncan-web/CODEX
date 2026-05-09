# Staging Public Performance Baseline - 2026-05-09

## Scope

Environment:

- Frontend: `https://staging.hr-axis.com`
- Backend public API: `https://api-staging.hr-axis.com/api`
- Iterations: `5` for public routes/API, `3` for static assets
- Command: `npm.cmd run perf:public`

This evidence is sanitized. It contains no raw cookies, bearer tokens, passwords, Clerk session dumps, database URLs, or private user data.

## Result

Status: public baseline captured; protected API baseline remains blocked until a real staging bearer token or smoke auth session is provided.

## Frontend Route Timing

| Route | Status | p50 | p95 | Avg | Bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/` | 200 | `182.99ms` | `538.79ms` | `205.35ms` | `2168` |
| `/store` | 200 | `62.15ms` | `178.94ms` | `100.88ms` | `2168` |
| `/store/me` | 200 | `43.93ms` | `45.55ms` | `44.10ms` | `2168` |
| `/store/kpis` | 200 | `43.94ms` | `46.49ms` | `44.25ms` | `2168` |
| `/store/rankings` | 200 | `43.13ms` | `43.62ms` | `42.85ms` | `2168` |
| `/admin/integrations` | 200 | `48.76ms` | `62.55ms` | `52.55ms` | `2168` |

Interpretation:

- Static frontend route delivery is fast enough for the controlled staging pilot.
- The root route had higher variance than direct store/admin routes, but stayed below one second in this sample.

## Public Backend Timing

| Endpoint | Status | p50 | p95 | Avg | Bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/api/health/live` | 200 | `60.71ms` | `34438.76ms` | `6933.48ms` | `47` |
| `/api/health` | 200 | `57.86ms` | `239.31ms` | `93.02ms` | `283` |
| `/api/auth/session` without auth | 403 | `55.21ms` | `86.31ms` | `61.13ms` | `194` |

Interpretation:

- Warm public backend responses are fast.
- `/api/health/live` produced a repeated cold/outlier class response above `30s`. This is consistent with Render Free plan cold start behavior and should not be confused with steady-state API latency.
- `/api/auth/session` returned `403` quickly without auth, which is expected for unauthenticated access.

## Static Asset Weight

Total discovered JS/CSS asset weight: `772.3 KB` across `23` assets.

Largest assets:

| Asset | Size |
| --- | ---: |
| `useLocalization-C23Iaz25.js` | `355.4 KB` |
| `clerk-session-CtWNv1ku.js` | `283.5 KB` |
| `chunk-OE4NN4TA-BgWFiNIl.js` | `41.1 KB` |
| `index-DJjaYNQm.js` | `36.9 KB` |
| `api-DlefFgI9.js` | `26.1 KB` |
| `index-BWVd8qO8.css` | `17.4 KB` |

Interpretation:

- The bundle is not alarming for the current pilot, but localization and Clerk/session code are the first frontend size watchlist items.
- Do not optimize this prematurely unless mobile WebView/native-shell startup or real-user measurements show a problem.

## Protected API Baseline Status

Command attempted without a bearer token:

```powershell
$env:NODE_OPTIONS="--dns-result-order=ipv4first"
$env:PERF_BASE_URL="https://api-staging.hr-axis.com/api"
$env:PERF_TARGET_PROFILE="store-manager"
$env:PERF_ITERATIONS="1"
$env:PERF_ENABLE_MUTATIONS="false"
npm.cmd --prefix backend/nestjs run perf:baseline
```

Observed result:

- `GET /api/reports/kpi-config` returned `403 Forbidden`.
- This confirms staging is not accepting mock performance headers for protected APIs.
- Store/personnel/reporting protected baseline still needs a real staging bearer token or smoke auth session.

Use this command once a token is available:

```powershell
$env:NODE_OPTIONS="--dns-result-order=ipv4first"
$env:PERF_BASE_URL="https://api-staging.hr-axis.com/api"
$env:PERF_TARGET_PROFILE="store-manager"
$env:PERF_AUTH_TOKEN="[redacted]"
$env:PERF_ITERATIONS="5"
$env:PERF_ENABLE_MUTATIONS="false"
npm.cmd --prefix backend/nestjs run perf:baseline
```

For a store personnel identity, use:

```powershell
$env:PERF_TARGET_PROFILE="store-personnel"
```

## Decision

Current performance stance: Conditional Pass for public staging surfaces.

Main open risk:

- Render Free plan cold start is visible and user-facing if the backend sleeps.

Next evidence needed:

- Protected API baseline using a real store manager token.
- Protected API baseline using a real store personnel token.
- Browser-level authenticated page timing after the above API baseline is available.
