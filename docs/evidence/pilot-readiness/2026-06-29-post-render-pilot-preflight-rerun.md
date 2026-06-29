# 2026-06-29 Post-Render Pilot Preflight Rerun

## Scope

- Environment: staging
- Frontend: `https://staging.hr-axis.com`
- Backend: `https://api-staging.hr-axis.com/api`
- Verification branch: `codex/pilot-preflight-rerun-2026-06-29`
- Base commit: `299b121b` (`Fix rankings personnel display fallback`)
- User confirmed Render redeploy before this pass.

Secrets, OTP values, browser session cookie values, bearer/provider tokens and raw storage values were intentionally excluded from this evidence.

## Public Readiness

Command:

```powershell
npm.cmd run smoke:deployed-readiness
```

Environment overrides:

```text
READINESS_FRONTEND_URL=https://staging.hr-axis.com
READINESS_BACKEND_URL=https://api-staging.hr-axis.com/api
READINESS_ENVIRONMENT=staging
READINESS_TIMEOUT_MS=45000
```

Result:

- Status: pass
- Passed: 13
- Failed: 0
- Skipped: 1 (`READINESS_BEARER_TOKEN` not provided)
- Backend health: ok
- Readiness profile: `controlled-pilot`
- Queue profile: durable BullMQ / Redis available
- Database health: ok
- Frontend asset/header checks: ok

## Protected Cookie Session Smoke

Command:

```powershell
npm.cmd --prefix admin-web run smoke:auth:staging:cookie-session
```

Result:

- Status: pass
- Persona configured by `admin-web/.env.local`: `REGION_MANAGER`
- Expected landing: `/admin/competitions`
- `POST /api/auth/browser-session`: 201
- `DELETE /api/auth/browser-session`: 200
- Browser session cookie:
  - name: `hr_axis_browser_session`
  - domain: `api-staging.hr-axis.com`
  - `HttpOnly`: true
  - `Secure`: true
  - `SameSite`: Lax
  - host-only: true
- Session role codes include `REGION_MANAGER`
- Assigned store count: 30
- Company scope count: 1
- Browser-readable app bearer token: false
- Browser-readable provider id token: false
- Cookie transport: true
- CSRF nonce present: true
- Unsafe missing-header request returned 403

## Region Manager Route Smoke

Custom Playwright route smoke was run from `admin-web` after the protected cookie login. It checked each route for:

- no redirect back to `/auth/login`
- no document status `>= 400`
- no API response `>= 400`
- no visible `Cannot GET`, `Missing required role`, `Request failed`, `verisi alınamadı`, `açılamadı`, `oturum doğrulanıyor`
- no visible UUID pattern
- no visible `employee-*` pattern

Result: 11/11 passed.

Routes:

- `/store`
- `/store/me`
- `/store/rankings`
- `/store/kpis`
- `/store/targets`
- `/store/incentives`
- `/store/workforce`
- `/store/tasks`
- `/store/feed`
- `/store/reports`
- `/store/approvals`

## Live API Summary

Authenticated browser-cookie API fetches were run from the same region-manager session.

### Session

- `/auth/session`: 200
- Role codes include `REGION_MANAGER`
- Assigned store count: 30
- Company scope count: 1

### Rankings

Endpoint:

```text
/reports/rankings?periodType=monthly&periodStart=2026-05-01&limit=5&offset=0
```

Result:

- Status: 200
- Scope summary store count: 30
- Active personnel count: 150
- Store leaderboard total: 152
- Personnel leaderboard total: 619
- Top personnel display names were real names, not raw `employee-*` identifiers.

This closes the earlier symptom where the region-manager KPI/rankings surfaces showed a smaller 29-store / 126-person scope after assignments had already been defined.

### Store KPI Highlights

Endpoint:

```text
/reports/store-kpi-highlights?periodType=monthly&periodStart=2026-05-01
```

Result:

- Status: 200
- Response keys: `source`, `store`, `period`, `score`, `availablePeriods`, `partial`, `metrics`
- This endpoint does not directly expose `storeCount` / `activePersonnelCount`; scope consistency was therefore validated through rankings and target coverage.

### Target Coverage

The Store Targets page sends full ISO month-start dates such as `2026-05-01`, not bare `2026-05`.

Endpoints:

```text
/target-distributions/coverage?requestMonth=2026-05-01
/target-distributions/coverage?requestMonth=2026-06-01
```

Result:

- May 2026: 200, 150 employees, 5 covered, 145 missing, coverage rate `0.0333`
- June 2026: 200, 150 employees, 0 covered, 150 missing, coverage rate `0`

Non-blocking API hygiene note:

- `/target-distributions/coverage?requestMonth=2026-05` returns 500.
- The production UI does not send this malformed value, but the API should ideally reject it with a validation 400 instead of a 500.

## Persona Coverage Limitation

This pass used the single configured `AUTH_SMOKE_*` persona in `admin-web/.env.local`, which is currently a region-manager account.

Not covered in this run:

- Admin protected browser smoke
- Store manager protected browser smoke
- Personnel protected browser smoke

Those should be run after separate non-secret smoke env entries or a multi-persona smoke harness are available.

## Decision

For the configured region-manager staging persona:

- Public readiness passed.
- Cookie-session security smoke passed.
- Store route access smoke passed.
- Region scope now resolves as 30 assigned stores / 150 active personnel in the checked data surfaces.
- Target coverage works with the UI's actual date format.

No pilot-blocking issue was found in this region-manager pass.
