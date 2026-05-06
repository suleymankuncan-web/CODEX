# Pilot Release Smoke Checklist

## Decision Rule

- Frontend-only change: run local frontend verification, deploy Vercel preview, verify the Vercel deployment id maps to the expected Git commit hash, promote, run production smoke.
- Backend/API change: run backend targeted tests, deploy Render, verify `/api/auth/session` and `/api/admin/migrations/status`, then run affected frontend smoke.
- Database migration change: run migration tests, deploy Render with predeploy migration, verify migration status has no failed or pending migration, then run admin and store smoke.

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
