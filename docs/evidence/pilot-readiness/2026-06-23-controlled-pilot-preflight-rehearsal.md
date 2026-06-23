# Controlled Pilot Preflight Rehearsal - 2026-06-23

Status: conditional_go
Evidence class: protected_staging_smoke
Scope: staging controlled pilot preflight

## Reader And Action

Reader:

- owner, pilot moderator, or future agent deciding whether the next controlled
  pilot session can start.

After reading, they should know which parts of staging passed, which parts are
conditional, and which blocker should be fixed before a GSM or incentive-data
pilot session.

## Boundary

This evidence does not approve broad production. Nebim integration, JSON/API
source adapter work, broad UI redesign, cashier incentive formula, and broad
production rollout remain parked.

No raw passwords, OTPs, bearer tokens, cookies, provider subjects, Clerk ticket
URLs, or private personal data are recorded here.

## Inputs

- Frontend: `https://staging.hr-axis.com`
- Backend API: `https://api-staging.hr-axis.com/api`
- DB: Supabase staging, read-only checks only
- Credential source: local ignored `admin-web/.env.local`
- Persona source: `docs/plans/pilot-access-matrix-v1.md`
- Preflight checklist: `docs/plans/controlled-pilot-preflight-checklist-v1.md`
- Latest local branch at run start: `main...origin/main`

## Result

Overall result: `Conditional Go`.

Follow-up verification after PR `#789`:

- GSM store-reference resolution fix was merged and deployed to staging API and
  worker at commit `611385cb412aac68ec86773a1fedfbc2f9235358`.
- Latest API and worker Render deploys were `live`.
- Backend health returned `ok`; database and Redis checks returned `ok`.
- The existing failed GSM batch is not treated as repaired in place because it
  was created with the old code path. A fresh `Ocak GSM.xlsx` upload is still
  required to prove materialization with the new fallback.

Allowed pilot scope:

- auth/session smoke for BM, Store Manager, and Store Personnel,
- admin/operator route walkthrough,
- BM/Store Manager store route walkthrough,
- non-GSM, non-incentive-close user walkthrough where current known data gaps
  are acceptable.

Not ready without a blocker fix:

- GSM approval import/data pilot,
- incentive-data acceptance pilot that depends on persisted projection rows or
  fully reconciled historical import data.

## Checks Run

### Current Single-Persona Rerun

Run time: `2026-06-23T19:35Z`.

The local ignored `admin-web/.env.local` available during this closeout exposed
one smoke persona only. That persona was rerun through the official staging
cookie-session smoke and a direct route walkthrough.

| Check | Result | Notes |
| --- | --- | --- |
| `npm.cmd --prefix admin-web run smoke:auth:staging:cookie-session` | PASS | Expected role `REGION_MANAGER`; expected landing `/admin/competitions`; browser-session create `201`; clear `200`; no-bearer `401`; CSRF missing-header `403`; HttpOnly/Secure/Lax cookie; assigned store count `30`; browser storage had no app bearer/provider token. |
| `npm.cmd run smoke:deployed-readiness` with staging URLs | PASS | 13 passed, 0 failed, 1 skipped. Backend live/dependency health passed; database and Redis were `ok`; frontend root, SPA fallback, security headers, and sampled static assets passed. Auth-session token check skipped because `READINESS_BEARER_TOKEN` was not provided. |
| Ad-hoc RM route walkthrough | PASS | `/store`, `/store/targets`, `/store/kpis`, `/store/incentives`, `/store/workforce`, `/store/checklists`, and `/store/rankings` returned document `200`, did not fall back to login, and produced no observed API `5xx`. `/admin/master-data` and `/admin/integrations` are not RM routes by matrix/source guard; no API `5xx` was observed during direct navigation. |
| Pilot route/readiness contract tests | PASS | `12` tests passed across pilot route matrix, release checklist, and readiness gate contracts. |
| Admin-web script tests | PASS | `62` script tests passed, including incentive money input behavior and store incentives route/sidebar visibility contracts. |

Rejected evidence:

- `npm.cmd --prefix admin-web run guard:auth:evidence` without stdin/file was
  run once and failed with its documented usage error. It is not counted as a
  product failure or a passing check.

### Auth Cookie Session Smoke

Command pattern:

```powershell
npm.cmd --prefix admin-web run smoke:auth:staging:cookie-session
```

Environment was overridden per persona without printing secret values.

| Persona label | Expected role | Expected landing | Result | Notes |
| --- | --- | --- | --- | --- |
| `pilot-bm-example` | `REGION_MANAGER` | `/store` | PASS | Auth mode `jwt`, browser-session create `201`, clear `200`, no-bearer `401`, CSRF missing-header `403`, HttpOnly/Secure/Lax cookie, assigned store count `3`. |
| `pilot-sm-example` | `STORE_MANAGER` | `/store` | PASS | Auth mode `jwt`, browser-session create `201`, clear `200`, no-bearer `401`, CSRF missing-header `403`, HttpOnly/Secure/Lax cookie, assigned store count `1`. |
| `pilot-personnel-example` | `STORE_PERSONNEL` | `/store/me` | PASS | Auth mode `jwt`, browser-session create `201`, clear `200`, no-bearer `401`, CSRF missing-header `403`, HttpOnly/Secure/Lax cookie, assigned store count `1`. |
| `pilot-admin-example` | `SUPER_ADMIN` | `/admin/integrations` | PARTIAL | Browser login worked in route walkthrough, but the generic cookie smoke asserts `assignedStoreCount > 0`; super admin has no action-store assignment by design, so that script is not a valid admin proof without an admin-specific expectation. |

### Route Walkthrough

Custom Playwright route walkthrough checked document status, login fallback,
selected "cannot load" markers, and API `5xx` responses.

| Persona label | Routes checked | Result |
| --- | --- | --- |
| `pilot-admin-example` | `/admin/integrations`, `/admin/master-data`, `/admin/targets`, `/admin/incentives`, `/admin/data-quality` | PASS |
| `pilot-bm-example` | `/store`, `/store/targets`, `/store/incentives?period=2026-05`, `/store/workforce`, `/store/kpis`, `/store/rankings`, `/store/checklists` | PASS |
| `pilot-sm-example` | `/store`, `/store/targets`, `/store/incentives?period=2026-05`, `/store/workforce`, `/store/kpis`, `/store/rankings`, `/store/checklists` | PASS |
| `pilot-personnel-example` | Official auth smoke PASS. Ad-hoc route/API harness was inconsistent across reruns. | CONDITIONAL |

Personnel note:

- the official cookie-session smoke proves the account can authenticate and land
  on `/store/me`;
- the ad-hoc route/API harness should not be treated as final personnel route
  proof until it is promoted into a stable reusable smoke script.

## Data And Import Readiness

Read-only Supabase checks found the following latest import state:

| Import/file | Status | Record count | Error count | Preflight meaning |
| --- | --- | ---: | ---: | --- |
| `Ocak GSM.xlsx` | `failed` | 148 | 148 | Code fix merged/deployed in PR `#789`; fresh re-upload remains required before GSM data acceptance. |
| `mayis personel.xlsx + mayis magaza.xlsx` | `failed` | 4751 | 455 | Known data-quality/import identity mismatch. Conditional only if the target workflow tolerates unmatched personnel rows. |
| `nisan personel.xlsx + nisan magaza.xlsx` | `failed` | 4689 | 155 | Same class as above. |
| `subat personel.xlsx + subat magaza.xlsx` | `failed` | 4726 | 403 | Same class as above. |
| `ocak personel.xlsx + ocak magaza.xlsx` | `failed` | 4817 | 730 | Same class as above. |
| older reference import | `completed` | 4864 | 0 | Historical proof that the import path can complete when data maps cleanly. |

Incentive close-readiness state:

- `ops.sales_target_incentive_close_run` has `succeeded` close runs for
  `2026-01`, `2026-02`, `2026-03`, `2026-04`, and `2026-05`.
- `ops.sales_target_incentive_projection` currently has `0` rows.

Interpretation:

- month close itself is no longer the obvious blocker;
- persisted incentive projection rows are not present, so any pilot that needs
  Region Manager corrections, package review, or final snapshot proof should
  verify the API body and persistence path before the session.

Target distribution state:

- May 2026 has one approved target distribution request in the checked window.

## Findings

### P1 - GSM approval import needs a fresh proof upload

Evidence:

- latest pre-fix `Ocak GSM.xlsx` batch is `failed`,
- `record_count = 148`,
- `error_count = 148`,
- PR `#789` fixed code/name fallback resolution and was deployed after this
  batch was created.

Impact:

- KPI pages may load, but GSM approval cannot be trusted as imported pilot data
  until the same file is uploaded again and a completed batch is observed.

Next action:

- re-upload `Ocak GSM.xlsx`,
- verify completed batch plus KPI surface visibility,
- if the fresh upload still fails, inspect the new row-level failure class
  rather than retrying the pre-fix batch.

### P1 - Incentive projection persistence needs verification before incentive pilot

Evidence:

- close runs for January-May 2026 are `succeeded`,
- projection table row count is `0`,
- BM and SM `/store/incentives?period=2026-05` routes load and API status can be
  reached, but persisted projection evidence is absent.

Impact:

- pilot users can open the page, but final correction/package acceptance should
  not be treated as ready until API payload counts and persistence are proven.

Next action:

- run a focused incentive API-body and correction-flow smoke with BM/SM pilot
  accounts,
- confirm whether the read model intentionally computes live without persisted
  projections or whether close-run projection persistence is missing.

### P2 - Admin cookie-session smoke has a hard-coded action-store expectation

Evidence:

- `pilot-admin-example` route walkthrough passed,
- the generic cookie-session smoke rejects super admin because
  `assignedStoreCount = 0`.

Impact:

- not a product blocker, but the smoke harness cannot be used as admin proof
  until expected action-store count is persona-aware.

Next action:

- update or add a persona-aware auth smoke expectation for admin personas.

### P2 - Personnel route/API ad-hoc harness is unstable

Evidence:

- official personnel cookie-session smoke passed,
- ad-hoc route/API harness gave inconsistent personnel results across reruns.

Impact:

- not enough to block a manager/admin/BM pilot walkthrough, but personnel
  route-boundary proof should be stabilized before a personnel-specific pilot.

Next action:

- promote the route walkthrough into a committed smoke script with explicit
  persona config and backend-origin API checks.

## Go / Conditional Go / No-Go

Decision: `Conditional Go`.

Use this staging environment for:

- auth/session checks,
- admin operator walkthrough,
- BM and Store Manager store-surface walkthrough,
- non-GSM UI flow review.

Do not use it yet for:

- GSM approval data acceptance,
- final incentive acceptance based on persisted projection evidence,
- broad production proof.

## Follow-Up Order

1. Re-upload `Ocak GSM.xlsx` and verify a completed GSM batch with KPI surface
   visibility.
2. Verify incentive API body and projection/correction persistence for
   `2026-05`.
3. Make the auth/route smoke harness persona-aware:
   - admin account does not require action-store assignment,
   - backend API checks must hit `https://api-staging.hr-axis.com/api`,
   - personnel negative manager-surface proof should be stable.
