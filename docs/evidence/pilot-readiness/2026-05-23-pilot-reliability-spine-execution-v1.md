# Pilot Reliability Spine Execution V1

Date: 2026-05-23

## Sokrates Decision

Claim: the Pilot Reliability Spine can be partially executed without user
secrets by refreshing public staging evidence and explicitly preserving
protected/provider blockers.

Assumption: tokenless public smokes are useful for deploy and dependency health,
but they do not prove protected role/scope behavior.

Evidence:

- `docs/evidence/pilot-evidence-operating-matrix-v1.md` defines the evidence
  classes and says skipped protected checks are not proof.
- `docs/plans/pilot-persona-evidence-runbook-v1.md` defines the real token
  variable names for protected persona/load proof.
- The local environment has no `READINESS_BEARER_TOKEN`,
  `BACKEND_LOAD_*TOKEN`, `PROTECTED_PERF_*TOKEN`, `ALERT_PROVIDER_*`,
  `UPLOAD_SMOKE_*`, `RESTORE`, or `SUPABASE*RESTORE` variables available in
  this shell.

Counterargument: this pass does not close the real persona/provider/restore
blockers. Correct. It closes only the first safe execution pass and keeps the
blocked items honest.

Risk: LOW. Docs-only evidence. No code, API, auth, DB, CSS, provider config, or
user-facing behavior changed.

Door: two-way-door. Future evidence can replace this note once secure tokens
and provider inputs are available.

Stop rule: do not claim protected evidence from skipped token groups, and do
not invent provider delivery proof when provider metadata is absent.

Verification ladder:

1. Check local secret/token env presence.
2. Run public deployed readiness.
3. Run public backend readiness load.
4. Run alert-routing health smoke.
5. Record protected/provider blockers as blockers, not failures and not proof.

## Local Secret Input Check

Command:

```powershell
Get-ChildItem Env: |
  Where-Object { $_.Name -match 'READINESS_BEARER_TOKEN|BACKEND_LOAD_.*TOKEN|PROTECTED_PERF_.*TOKEN|AUTH_SMOKE|CLERK|UPLOAD_SMOKE|ALERT_PROVIDER|RESTORE|SUPABASE.*RESTORE' } |
  Select-Object Name
```

Result:

- No matching secret/token/provider/restore/upload variables were present.
- Protected persona/load evidence remains blocked in this shell.

## Public Deployed Readiness

Command:

```powershell
$env:READINESS_FRONTEND_URL='https://staging.hr-axis.com'
$env:READINESS_BACKEND_URL='https://api-staging.hr-axis.com/api'
$env:READINESS_ENVIRONMENT='staging'
$env:READINESS_TIMEOUT_MS='45000'
npm.cmd run smoke:deployed-readiness
```

Result:

- Status: `ok`
- Evidence time: `2026-05-23T03:18:29.415Z`
- Total checks: 14
- Passed: 13
- Failed: 0
- Skipped: 1
- Skipped check: backend auth session, because no `READINESS_BEARER_TOKEN` was
  provided.
- Backend `/api/health/live`: 200 / `ok`
- Backend `/api/health`: 200 / `ok`
- Queue backend: `bullmq`
- Queue status: `durable`
- Redis status: `ok`
- Database status: `ok`
- Readiness profile: `controlled-pilot`
- Frontend root, SPA fallback, security headers, and sampled static assets
  passed.

## Public Backend Readiness Load

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

- Overall status: `blocked`
- Public API health group: passed
- Availability: 100%
- p50: `128.21ms`
- p95: `209.04ms`
- 5xx: 0
- Authenticated session: skipped, missing
  `BACKEND_LOAD_SESSION_TOKEN`, `BACKEND_LOAD_AUTH_SESSION_TOKEN`,
  `BACKEND_LOAD_BEARER_TOKEN`, or `READINESS_BEARER_TOKEN`.
- Store read routes: skipped, missing `BACKEND_LOAD_STORE_TOKEN`,
  `PROTECTED_PERF_STORE_MANAGER_TOKEN`, or
  `PROTECTED_PERF_STORE_PERSONNEL_TOKEN`.
- Competition read routes: skipped, missing `BACKEND_LOAD_COMPETITION_TOKEN`,
  `BACKEND_LOAD_STORE_TOKEN`, or `BACKEND_LOAD_HR_ADMIN_TOKEN`.
- Import read routes: skipped, missing `BACKEND_LOAD_IMPORT_TOKEN`,
  `BACKEND_LOAD_INTEGRATION_ADMIN_TOKEN`, or `PROTECTED_PERF_ADMIN_TOKEN`.
- Mutation routes remained excluded:
  `POST /integrations/power-bi-export-upload`,
  `POST /integrations/import-batches`, and `POST /snapshots/runs`.

## Alert Routing Health Smoke

Command:

```powershell
$env:ALERT_SMOKE_BACKEND_URL='https://api-staging.hr-axis.com/api'
$env:ALERT_SMOKE_ENVIRONMENT='staging'
npm.cmd run smoke:alert-routing
```

Result:

- Status: `ok`
- Evidence time: `2026-05-23T03:18:40.484Z`
- Total checks: 5
- Passed: 4
- Failed: 0
- Skipped: 1
- Provider delivery: `not-configured`
- Alert provider metadata: skipped because no alert provider metadata was
  provided.
- Backend health alert signal: 200 / `ok`

## Decision

Controlled staging/internal pilot remains `Conditional Go` for the already
scoped technical path.

Broad production remains `No-Go`.

This pass improves confidence in public staging reachability, backend
dependencies, durable Redis/BullMQ health, and alert-routing health checks. It
does not close:

- fresh role-specific Clerk/persona protected evidence,
- protected route/load latency evidence,
- alert provider delivery evidence,
- authenticated upload evidence,
- Supabase disposable restore evidence.

## Next Action

When secure inputs are available, run the next evidence pass in this order:

1. `READINESS_BEARER_TOKEN` against `smoke:deployed-readiness`.
2. Role-specific backend load tokens against `smoke:backend-readiness-load`.
3. Store manager assigned/unassigned Store Action command proof if command
   evidence is in scope.
4. Alert provider metadata/delivery proof.
5. Disposable Supabase restore proof.
6. Authenticated upload proof.
