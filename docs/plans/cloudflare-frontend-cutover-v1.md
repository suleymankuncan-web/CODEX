# Cloudflare Frontend Cutover V1

Status: owner-approved execution
Date: 2026-07-29
Risk: R5 provider behavior and live custom-domain cutover, no product behavior change

## Decision

Move the existing `admin-web` Vite/React SPA from Vercel to Cloudflare Workers
Static Assets. Keep Render API, Supabase, Clerk, Sentry, application
authorization and the public hostname unchanged.

Cloudflare Pages and Pages Functions are not introduced. The deployment has no
Worker runtime script: hashed assets and SPA navigations are served from the
static asset layer. Vercel is retained only during the cutover as the tested
rollback origin. After Cloudflare live verification, its domain, Git integration
and project are retired so no permanent Vercel dependency remains.

## Locked boundaries

- Public staging hostname remains `https://staging.hr-axis.com`.
- API remains `https://api-staging.hr-axis.com/api` on Render.
- Clerk issuer, publishable key, JWT template and browser-session contract do not change.
- Backend CORS remains bound to the unchanged frontend hostname.
- Sentry DSN/environment/release behavior does not change.
- No backend, database, authorization, UI or business workflow change is allowed.
- No Vite secret is committed. Cloudflare build variables are provider variables.
- `VITE_BEARER_TOKEN` remains empty.

## Build-time variable contract

The Cloudflare build intentionally sets the same public frontend variables as
the active staging build:

- `VITE_API_BASE_URL`
- `VITE_AUTH_MODE`
- `VITE_AUTH_PROVIDER`
- `VITE_BROWSER_SESSION_TRANSPORT`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CLERK_JWT_TEMPLATE`
- `VITE_SENTRY_DSN`
- `VITE_SENTRY_ENABLED`
- `VITE_SENTRY_ENVIRONMENT`
- `VITE_SENTRY_RELEASE`

Provider values, credentials and downloaded env files do not enter Git, logs,
PR text or evidence. A production-equivalent local preview may use the ignored
`admin-web/.env.cloudflare.local` file.

## Execution

1. Build the exact clean commit with the production-equivalent frontend variable set.
2. Upload a tagged Cloudflare Version without promoting it, then verify its
   commit-bound preview alias.
3. Verify root HTML, hashed assets, deep-link fallback and required headers.
4. Verify Clerk bootstrap on the preview only when that temporary origin is
   already provider-allowed. Do not widen Clerk production origins solely for
   a disposable preview hostname.
5. Verify Sentry requests are permitted by CSP without enabling smoke flags.
6. Open and merge the repository PR after canonical checks pass.
7. Upload the exact merged `main` artifact as a commit-tagged Version and
   promote only that verified tag to 100% traffic.
8. Attach `staging.hr-axis.com` as the Worker custom domain and verify TLS/DNS.
9. Run deployed readiness plus Clerk login/session/logout and authenticated
   pilot smoke against the unchanged hostname. This proof is required before
   removing the Vercel rollback origin.
10. Remove the Vercel custom domain, Git integration, project and rollback
    configuration in a post-cutover closeout slice after live proof.

## Go / rollback

Cutover is Go only when the Worker preview and exact merged artifact pass all
checks. Any non-HTML asset returning the SPA shell, missing security header,
Clerk/session failure, API CORS failure, Sentry CSP rejection or custom-domain
TLS problem is No-Go.

During cutover, rollback changes only the frontend custom-domain/DNS binding
back to the last known-good Vercel target. Backend, Clerk, data and user
assignments are not changed. After the live proof and Vercel retirement, the
Cloudflare deployment history becomes the rollback source.

## Verification

- `npm.cmd run test:scripts`
- `npm.cmd --prefix admin-web run lint`
- `npm.cmd --prefix admin-web run build`
- `npm.cmd --prefix admin-web run check:release:audit`
- `npm.cmd run check:affected-verification`
- fresh root `npm.cmd run check:release` when selected
- Cloudflare preview header/asset/deep-link probes
- deployed readiness and authenticated staging smoke after cutover
