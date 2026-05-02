# Vercel Custom API Base Redeploy Evidence

Date: 2026-05-02 15:39 +03
Environment: HR Axis staging
Prepared by: Codex

## Scope

This evidence records the Vercel frontend API base switch from the direct Render domain to the custom API domain.

Frontend:

- `https://staging.hr-axis.com`

API target:

- Previous bundle API base: `https://hr-axis-api.onrender.com/api`
- New production API base: `https://api-staging.hr-axis.com/api`

## Vercel Actions

- Vercel CLI authenticated as `suleymankuncan-web`.
- Project linked: `suleymankuncan-webs-projects/hr-axis-staging`.
- Production `VITE_API_BASE_URL` was replaced with `https://api-staging.hr-axis.com/api`.
- Production redeploy completed.

Deployment:

- Deployment id: `dpl_Gu9gKJbuMPD7f3QVmruvnR6ZHppK`
- Deployment URL: `https://hr-axis-staging-ifebpd77j-suleymankuncan-webs-projects.vercel.app`
- Production alias: `https://staging.hr-axis.com`

## Verification

Custom API health and CORS:

- `GET https://api-staging.hr-axis.com/api/health` returned `200`.
- Database health was `ok`.
- Queue backend was `in-memory`.
- Redis health was `skipped`.
- `OPTIONS https://api-staging.hr-axis.com/api/auth/session` from `Origin: https://staging.hr-axis.com` returned `204`.
- `access-control-allow-origin` was `https://staging.hr-axis.com`.
- `access-control-allow-headers` included `authorization,content-type`.

Frontend bundle probe after redeploy:

- New deployed index asset contained the Clerk refresh stability fix markers `token-present` and `token-missing`.
- New deployed API chunks contained `https://api-staging.hr-axis.com/api`.
- New deployed API chunks no longer contained `https://hr-axis-api.onrender.com/api`.

Browser route smoke:

- Chromium loaded `https://staging.hr-axis.com/store`.
- Unauthenticated route landed on `https://staging.hr-axis.com/auth/login`.
- No request failures were observed in this unauthenticated browser pass.

## Authenticated Smoke Status

Authenticated Clerk smoke was not completed in this pass.

Reason:

- Local environment did not contain `AUTH_SMOKE_USERNAME` or `AUTH_SMOKE_PASSWORD`.
- The existing `npm.cmd run smoke:auth:staging` prerequisite gate failed fast with `staging smoke requires AUTH_SMOKE_USERNAME to be set`.

Additional note:

- Existing `auth-live-smoke.mjs` is written for an OIDC-style provider form flow. Clerk modal login may need either explicit staging credentials plus script support for Clerk UI, or a manual authenticated smoke evidence capture.

## Pilot Gate Impact

This improves staging deploy evidence but still does not approve pilot `Go`.

Remaining required evidence:

- Authenticated Clerk login with a real staging smoke user.
- Real bearer `/api/auth/session` result.
- Store shell resolved roles and scope.
- Assigned-store positive action smoke.
- Unassigned-store negative scope smoke.
- True baseline master data evidence.
- Real KPI import smoke evidence.
