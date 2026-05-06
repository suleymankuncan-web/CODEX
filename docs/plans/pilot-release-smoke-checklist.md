# Pilot Release Smoke Checklist

## Decision Rule

- Frontend-only change: run local frontend verification, deploy Vercel preview, verify the Vercel deployment id maps to the expected Git commit hash, promote, run production smoke.
- Backend/API change: run backend targeted tests, deploy Render, verify `/api/auth/session` and `/api/admin/migrations/status`, then run affected frontend smoke.
- Database migration change: run migration tests, deploy Render with predeploy migration, verify migration status has no failed or pending migration, then run admin and store smoke.
- Docs-only change: run the affected documentation/contract tests, merge to main, record the Git commit hash; Vercel and Render deploys are not required unless runtime files changed.

## Standard Deploy SOP

1. Merge the approved PR into `main`.
2. Record the merged Git commit hash.
3. Wait for the Vercel frontend deployment when frontend runtime files changed.
4. Record the Vercel deployment id and verify the Vercel deployment id maps to the expected Git commit hash.
5. Promote only the verified Vercel deployment when the frontend change is intended for production/staging use.
6. Trigger or verify Render deploy when backend, API contract, environment, migration, or `render.yaml` changed.
7. Verify Render build completed and migrations ran through `preDeployCommand` when a Render deploy is required.
8. Verify `/api/auth/session` and `/api/admin/migrations/status`; migration status must have zero failed and zero pending migrations.
9. Hard refresh the browser, then run the production smoke order.
10. Record the outcome as `Go`, `Conditional Go`, or `No-Go` with links to deployment ids, commit hash, and evidence.

## Change-Type Decision Table

| Change type | Vercel deploy | Render deploy | Minimum smoke |
| --- | --- | --- | --- |
| Docs-only change | Not required | Not required | Affected docs/contract tests and `git diff --check` |
| Frontend-only change | Required | Not required | Vercel deployment id, Git commit hash, production smoke order |
| Backend/API change | Only if frontend files changed | Required | `/api/auth/session`, `/api/admin/migrations/status`, affected frontend smoke |
| Database migration change | Only if frontend files changed | Required | Render predeploy migration, migration status, admin and store smoke |
| Environment/config change | Required for frontend-owned env | Required for backend-owned env | Verify the owning service restarted with expected config and run affected smoke |

## Local Verification Commands

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- pilot-smoke.spec.ts
npm.cmd --prefix backend/nestjs test -- --runInBand
node --test scripts/pilot-route-role-matrix-contract.test.mjs
node --test scripts/pilot-release-smoke-checklist-contract.test.mjs
git diff --check
```

## Vercel Promote Check

- Record the Git commit hash.
- Record the Vercel deployment id.
- Confirm the Vercel deployment id row shows the expected Git commit hash.
- Promote only that deployment.
- After promote, open production in a fresh browser context.

## Render Deploy Check

- Render deploy is required when backend, API contract, environment, migration, or `render.yaml` changes.
- Deploy Render when backend, API contract, environment, migration, or `render.yaml` changes.
- Verify Render build completed.
- Verify migrations ran through `preDeployCommand`.
- Verify `/api/admin/migrations/status` returns zero failed and zero pending migrations.

## Production Smoke Order

1. `/admin/integrations`
2. `/admin/master-data`
3. `/admin/targets`
4. `/store`
5. `/store/me`
6. `/store/rankings`
7. `/store/approvals`
8. Refresh the active page and verify it returns to the same route after auth verification.

## Automated Pilot Smoke

Use the live smoke command after a promoted frontend deployment or backend deploy that can affect pilot routes:

```powershell
$env:PILOT_SMOKE_BASE_URL = "https://staging.hr-axis.com"
$env:PILOT_SMOKE_BEARER_TOKEN = "<fresh-redacted-clerk-jwt>"
npm.cmd --prefix admin-web run smoke:pilot:live -- --staging
```

Default route set:

- `/admin/integrations`
- `/admin/master-data`
- `/admin/targets`
- `/store`
- `/store/me`
- `/store/rankings`
- `/store/approvals`

Rules:

- Never paste raw bearer tokens into evidence files, screenshots, PR bodies, or commits.
- For staging/non-local smoke, use a fresh Clerk JWT through `PILOT_SMOKE_BEARER_TOKEN`.
- The command fails fast when staging mode has no token, so it does not accidentally probe protected routes unauthenticated.
- The command fails if a route settles on `/auth/login`, shows an unavailable marker, raises a page error, or returns `4xx/5xx` API responses.
- Manual browser smoke is still required when the command fails or when a user-visible interaction beyond page load is being validated.

## Old Chunk Symptoms

- Old chunk symptoms mean the promoted deployment is ready but the browser still executes stale JavaScript.
- A page still throws an error fixed by the promoted commit.
- The Vercel deployment id is promoted but the browser renders old JavaScript chunks.
- The app works after closing all browser windows and reopening the site.

## Cache Recovery

1. Hard refresh the route.
2. Close all browser windows for the affected browser.
3. Reopen the browser and navigate directly to the affected route.
4. Verify the Vercel deployment id maps to the expected Git commit hash.
5. Re-run the production smoke order.
