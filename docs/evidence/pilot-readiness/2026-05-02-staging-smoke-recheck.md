# Staging Smoke Recheck Evidence

Date: 2026-05-02 15:10 +03
Environment: HR Axis staging
Prepared by: Codex

## Scope

This is a sanitized public staging smoke recheck. It does not contain raw tokens, cookies, passwords, Clerk session dumps, database passwords, or private user data.

Checked surfaces:

- Frontend: `https://staging.hr-axis.com`
- Backend direct Render API: `https://hr-axis-api.onrender.com/api`
- Backend custom API domain: `https://api-staging.hr-axis.com/api`
- Store routes: `/store`, `/store/me`, `/store/kpis`, `/store/approvals`

## Result

Decision: Conditional evidence only.

The public staging surface, backend health, DB health, custom API domain, CORS preflight, and unauthenticated route gate all responded as expected. This is not pilot `Go` evidence because authenticated Clerk login, `/api/auth/session` with a real bearer token, resolved role/scope in the store shell, assigned-store action success, and unassigned-store negative scope behavior were not re-run in this automated pass.

## Evidence

DNS:

- `staging.hr-axis.com` resolved through Vercel DNS.
- `api-staging.hr-axis.com` resolved as `CNAME api-staging -> hr-axis-api.onrender.com`, then through Render origin.
- `hr-axis-api.onrender.com` resolved through Render origin.
- Note: Node `dns.resolveAny` returned local resolver `ECONNREFUSED`, but PowerShell `Resolve-DnsName` and HTTPS fetches resolved and connected successfully.

Frontend HTTP:

- `GET https://staging.hr-axis.com/` returned `200`.
- `GET https://staging.hr-axis.com/store` returned `200`.
- `GET https://staging.hr-axis.com/store/me` returned `200`.
- `GET https://staging.hr-axis.com/store/kpis` returned `200`.
- `GET https://staging.hr-axis.com/store/approvals` returned `200`.

Backend health:

- `GET https://hr-axis-api.onrender.com/api/health/live` returned `200` with `{"status":"ok","service":"hr-axis-staging-api"}`.
- `GET https://hr-axis-api.onrender.com/api/health` returned `200`; database check `ok`, queue backend `in-memory`, Redis check `skipped`.
- `GET https://api-staging.hr-axis.com/api/health/live` returned `200` with `{"status":"ok","service":"hr-axis-staging-api"}`.
- `GET https://api-staging.hr-axis.com/api/health` returned `200`; database check `ok`, queue backend `in-memory`, Redis check `skipped`.

Auth and CORS:

- `GET /api/auth/session` without bearer token returned `403` on both API domains.
- `OPTIONS /api/auth/session` from `Origin: https://staging.hr-axis.com` returned `204` on both API domains.
- CORS allowed origin was `https://staging.hr-axis.com`.
- CORS allowed headers included `authorization,content-type`.

Browser route smoke:

- Chromium loaded `/`, `/store`, `/store/me`, `/store/kpis`, and `/store/approvals`.
- All protected store routes redirected unauthenticated traffic to `/auth/login`.
- No browser console errors were observed.
- No request failures were observed.
- The login page showed Clerk provider flow as configured.

Frontend bundle:

- Current deployed bundle still contains `https://hr-axis-api.onrender.com/api`.
- Current deployed bundle does not contain `https://api-staging.hr-axis.com/api`.
- Current deployed bundle contains Clerk JWT template marker `hr-axis-api`.

Vercel redeploy readiness:

- Custom API domain is reachable from this workspace and returned backend health `ok`.
- Local workspace does not currently have a linked `.vercel` directory, `vercel` CLI, or `VERCEL_*` environment token available.
- Because of that, this pass did not update Vercel `VITE_API_BASE_URL` or redeploy the frontend.

## Remaining Required Pilot Evidence

- Authenticated Clerk login with a real staging smoke user.
- Backend `/api/auth/session` with real bearer token.
- Resolved roles and scope visible in the store shell.
- `/store`, `/store/me`, `/store/kpis`, and `/store/approvals` after login.
- Assigned-store positive action smoke.
- Unassigned-store negative scope smoke.
- True store/personnel baseline evidence.
- Real KPI import smoke evidence.
- Release and migration evidence on the pilot commit.
