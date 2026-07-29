# Pilot Release Smoke Checklist

## Decision Rule

- Frontend-only change: run local frontend verification, deploy the exact artifact to the Cloudflare Worker, verify the Cloudflare Worker version id maps to the expected Git commit hash, promote only that version, then run deployed smoke.
- Backend/API change: run backend targeted tests, deploy Render, verify `/api/auth/session` and `/api/admin/migrations/status`, then run affected frontend smoke.
- Database migration change: run migration tests, deploy Render with the approved migration step, verify migration status has no failed or pending migration, then run admin and store smoke.
- Docs-only change: run the affected documentation/contract tests, merge to main, record the Git commit hash; Cloudflare and Render deploys are not required unless runtime files changed.

## Standard Deploy SOP

1. Merge the approved PR into `main`.
2. Record the merged Git commit hash.
3. Wait for the Cloudflare frontend deployment when frontend runtime files changed.
4. Record the Cloudflare Worker version id and verify the Cloudflare Worker version id maps to the expected Git commit hash.
5. Promote only the verified Cloudflare Worker version when the frontend change is intended for production/staging use.
6. Trigger or verify Render deploy when backend, API contract, environment, migration, or `render.yaml` changed.
7. Verify Render build completed and migrations ran through the approved Render migration step when a Render deploy is required.
8. Verify `/api/auth/session` and `/api/admin/migrations/status`; migration status must have zero failed and zero pending migrations.
9. Hard refresh the browser, then run the production smoke order.
10. Record the outcome as `Go`, `Conditional Go`, or `No-Go` with links to deployment ids, commit hash, and evidence.

## Change-Type Decision Table

| Change type | Cloudflare deploy | Render deploy | Minimum smoke |
| --- | --- | --- | --- |
| Docs-only change | Not required | Not required | Affected docs/contract tests and `git diff --check` |
| Frontend-only change | Required | Not required | Cloudflare Worker version id, Git commit hash, deployed smoke order |
| Backend/API change | Only if frontend files changed | Required | `/api/auth/session`, `/api/admin/migrations/status`, affected frontend smoke |
| Database migration change | Only if frontend files changed | Required | Render migration step, migration status, admin and store smoke |
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

## Cloudflare Promote Check

- Record the Git commit hash.
- Record the Cloudflare Worker version id.
- Confirm the recorded Worker version was built from the expected Git commit hash.
- Promote only that deployment.
- After promote, open production in a fresh browser context.

## Render Deploy Check

- Render deploy is required when backend, API contract, environment, migration, or `render.yaml` changes.
- Deploy Render when backend, API contract, environment, migration, or `render.yaml` changes.
- Verify Render build completed.
- Verify migrations ran through the approved Render migration step.
- On Render Free plan, the approved migration step is the build command `npm ci --include=dev && npm run db:migrate && npm run build`.
- On a paid Render plan, the approved migration step may move back to `preDeployCommand: npm run db:migrate` with build command `npm ci --include=dev && npm run build`.
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

## Browser Console Protected API Smoke Fallback

Use this fallback when the local Playwright live smoke cannot safely receive a fresh Clerk JWT, when a local token listener is unavailable, or when the operator needs quick protected API evidence from an already signed-in staging browser.

Rules:

- Run only from an authenticated `https://staging.hr-axis.com` browser session.
- Use `skipCache: true` so Clerk returns the freshest available `hr-axis-api` token.
- Never print or paste the raw token into chat, screenshots, evidence files, PR bodies, or commits.
- Record only sanitized token metadata such as audience, session presence, and seconds remaining.
- Treat `4xx/5xx` responses as blockers unless the endpoint call is proven to use the wrong query shape.

Minimum protected API paths:

- `/auth/session`
- `/admin/migrations/status`
- `/integrations/import-batches/overview`
- `/integrations/import-batches/needs-action?limit=1&offset=0`
- `/integrations/master-data-bootstrap/batches?limit=1&offset=0`
- `/target-distributions/requests`
- `/target-distributions/coverage?requestMonth=YYYY-MM-01`
- `/reports/my-performance?mode=live`
- `/reports/rankings?periodType=monthly&limit=100&offset=0`
- `/reports/store-kpi-highlights?periodType=monthly`
- `/workforce/seller-code-requests?status=rejected`
- `/workforce/offboarding-requests?status=rejected`
- `/workforce/store-employees?storeId=<resolved-session-store-id>`

Accepted evidence file:

- `docs/evidence/pilot-readiness/2026-05-06-live-protected-api-smoke.md`

## Old Chunk Symptoms

- Old chunk symptoms mean the promoted deployment is ready but the browser still executes stale JavaScript.
- A page still throws an error fixed by the promoted commit.
- The Cloudflare Worker version is active but the browser renders old JavaScript chunks.
- The app works after closing all browser windows and reopening the site.

## Cache Recovery

1. Hard refresh the route.
2. Close all browser windows for the affected browser.
3. Reopen the browser and navigate directly to the affected route.
4. Verify the Cloudflare Worker version id maps to the expected Git commit hash.
5. Re-run the production smoke order.
