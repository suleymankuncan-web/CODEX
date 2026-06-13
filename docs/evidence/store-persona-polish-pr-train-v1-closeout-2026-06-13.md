# Store Persona Polish PR Train V1 Closeout

Date: 2026-06-13

Plan: `docs/plans/store-persona-polish-pr-train-v1.md`

Status: runtime PR train closed; final staging evidence partially closed by
available persona input.

## Merged PRs

- PR #707, `codex/store-checklist-visit-result-modal`, merged
  2026-06-12T23:52:54Z.
- PR #708, `codex/store-workforce-norm-status`, merged
  2026-06-13T00:22:32Z.
- PR #709, `codex/store-rankings-kpi-columns`, merged
  2026-06-13T00:52:54Z.
- PR #710, `codex/store-visual-polish-copy`, merged
  2026-06-13T01:24:09Z.

GitHub check evidence after merge:

- PR #707: `frontend-release-check`, `release-check`, `release-rehearsal`,
  `Vercel`, and `Vercel Preview Comments` all succeeded.
- PR #708: `frontend-release-check`, `release-check`, `release-rehearsal`,
  `Vercel`, and `Vercel Preview Comments` all succeeded.
- PR #709: `frontend-release-check`, `release-check`, `release-rehearsal`,
  `Vercel`, and `Vercel Preview Comments` all succeeded.
- PR #710: `frontend-release-check`, `release-check`, `release-rehearsal`,
  `Vercel`, and `Vercel Preview Comments` all succeeded.

## User Finding Status

1. Store Rankings KPI table includes the `CR` column.
2. Cancelled checklist drafts are not treated as completed visit-date sources.
3. Checklist result detail modal was redesigned for Store quality.
4. Norm Kadro status now uses business-language staffing interpretation:
   `Eksik`, `Tam`, or `Fazla` where data supports it.
5. Norm Kadro detail action alignment was corrected.
6. Task source copy such as `Review checklist source` is normalized to Turkish.
7. Talep Merkezi action buttons use the lighter Store action surface.
8. Region Manager KPI overview separates `BM Checklist` and `VM Checklist`.
9. KPI action buttons use the lighter Store action surface.
10. Below-norm start date and duration remain parked because the current
    frontend workforce/headcount response does not carry a real shortage-start
    timestamp. No date or duration was fabricated.

## Contract Impact

Contract Impact: intentionally unchanged.
API shape, DB schema, auth/permission semantics, scoring/ranking/checklist
weights, queue/import/provider behavior, and business workflows are unchanged.

The Lufian/header brand area was not changed.

## Final Staging Persona Smoke

Command:

```powershell
npm.cmd --prefix admin-web run smoke:auth:staging:cookie-session
```

Result: passed.

Sanitized evidence summary:

- `evidenceStatus`: `protected_staging_cookie_session_passed`
- frontend: `https://staging.hr-axis.com`
- backend API: `https://api-staging.hr-axis.com/api`
- expected landing: `/admin/competitions`
- expected role: `REGION_MANAGER`
- browser session create status: `201`
- no-bearer session status: `401`
- authenticated session status: `200`
- role codes: `REGION_MANAGER`
- assigned store count: `3`
- browser session cookie: `HttpOnly`, `Secure`, `SameSite=Lax`
- app bearer token stored in browser storage: `false`
- provider id token stored in browser storage: `false`
- suspicious token-shaped storage key count: `0`
- CSRF unsafe request without header: `403`
- app cookie present after logout: `false`

Limitations:

- Password, one-time code, bearer token, provider token, cookie value, provider
  subject, and raw storage values are intentionally excluded.
- This smoke proves the configured Region Manager persona session only.
- Store Manager staging persona smoke was not run because the local ignored
  environment contains only one `AUTH_SMOKE_*` persona set and it resolves to
  `REGION_MANAGER`.
- Token-scope smoke was not run because `AUTH_SMOKE_BEARER_TOKEN`,
  `AUTH_SMOKE_ASSIGNED_STORE_ID`, and `AUTH_SMOKE_UNASSIGNED_STORE_ID` are not
  present.
- Store Action command smoke was not run because the required
  `STORE_ACTION_SMOKE_*` bearer/store inputs and explicit mutation
  acknowledgement are not present.

## Final Local State

At closeout, local `main` is aligned with `origin/main` at
`7eab4f34 fix: soften store action surfaces (#710)` with a clean working tree.
