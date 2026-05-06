# Controlled Pilot Feedback Log

Start date: 5 Mayis 2026

Scope source:

- `docs/evidence/pilot-readiness/2026-05-05-controlled-pilot-scope.md`

Decision source:

- `docs/evidence/pilot-readiness/2026-05-05-pilot-readiness-decision.md`

Current outcome source:

- `docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-round-1-outcome.md` - Controlled Pilot Round 1 Outcome

Pilot decision:

- `Conditional Go` for controlled staging/internal pilot.
- Broad production rollout is not approved by this log.

## How To Use This Log

Add one session entry for each pilot check or user feedback round.

Do not record:

- raw bearer tokens,
- Clerk cookies,
- passwords,
- provider subjects,
- full JWT payloads,
- personal identity documents,
- unnecessary private user data.

Allowed evidence:

- route names,
- role names,
- store names,
- sanitized screenshots,
- user-facing issue descriptions,
- observed API status codes if useful,
- decision notes.

## Pilot Users

### Admin / Support User

Purpose:

- Support checks.
- Admin/integration sanity.
- Privileged Ranking V1 sanity.

Restriction:

- Do not use this user to validate low-role visibility.

### Bursa Marka Park Store Manager

Account:

- `suleymankuncan@lufian.com.tr`

Role:

- `STORE_MANAGER`

Bound store:

- `Bursa Marka Park Avm`

Expected low-role behavior:

- Global rankings are Top 100 and summary-only.
- Global metric details are hidden.
- Managed-store personnel details are visible.

## Daily Smoke Template

Copy this block into a new session entry after each staging deploy or pilot test round.

```text
### Session N - YYYY-MM-DD HH:mm +03

Tester:
Account/role:
Environment:

Routes checked:
- [ ] /store
- [ ] /store/me
- [ ] /store/kpis
- [ ] /store/approvals
- [ ] /store/rankings

Expected checks:
- [ ] No 45-second refresh loop
- [ ] Bursa Marka Park appears in rankings
- [ ] Low-role ranking remains summary/top100
- [ ] Global metrics hidden for low-role user
- [ ] Managed-store personnel details visible to store manager
- [ ] /store/kpis shows March 2026 score and metrics
- [ ] No demo rows visible

Feedback buckets:
- Data trust:
- Ranking trust:
- KPI explanation:
- Navigation/loading:
- UI direction:
- Operational blocker:

Issues:
- None / describe

Pause criteria triggered:
- No / Yes, describe

Decision:
- Continue / Pause / Rollback / Needs fix before next session

Next action:
```

## Session 0 - 2026-05-05 Initial Pilot Start

Tester:

- Codex with product owner collaboration.

Environment:

- Frontend: `https://staging.hr-axis.com`
- API base: `https://api-staging.hr-axis.com/api`

Starting evidence already recorded:

- `docs/evidence/pilot-readiness/2026-05-05-staging-master-data-kpi-materialization.md`
- `docs/evidence/pilot-readiness/2026-05-05-staging-ranking-v1-live-smoke.md`
- `docs/evidence/pilot-readiness/2026-05-05-staging-ranking-v1-low-role-smoke.md`
- `docs/evidence/pilot-readiness/2026-05-05-pilot-readiness-decision.md`
- `docs/evidence/pilot-readiness/2026-05-05-controlled-pilot-scope.md`

Starting state:

- Pilot decision is `Conditional Go`.
- Included low-role account is configured as `STORE_MANAGER`.
- Included store is `Bursa Marka Park Avm`.
- Included pages are `/store`, `/store/me`, `/store/kpis`, `/store/approvals`, `/store/rankings`.
- March 2026 is historical validation data.

Known open restrictions:

- Broad production rollout is excluded.
- `STORE_PERSONNEL`, region manager, and VM flows are excluded unless separately smoke-tested.
- Direct Supabase client access to `ops.*` tables is blocked until RLS/policy work.
- Final premium retail UI redesign is future work.
- Logout/expired-token behavior is not separately evidenced yet.

Decision:

- Continue controlled pilot setup.

Next action:

- Product owner confirms first pilot tester/session.
- Run daily smoke template with the low-role store manager account.
- Capture feedback in the buckets above.

## Session 1 - 2026-05-05 First Low-Role Browser Check

Tester:

- Product owner in staging browser.

Account/role:

- Intended account: `suleymankuncan@lufian.com.tr`
- Intended role: `STORE_MANAGER`
- Session role not yet re-confirmed during this browser check.

Environment:

- Frontend: `https://staging.hr-axis.com`
- API base: `https://api-staging.hr-axis.com/api`

Routes checked:

- [ ] `/store`
- [x] `/store/me`
- [ ] `/store/kpis`
- [x] `/store/approvals`
- [x] `/store/rankings`

Observed:

- `/store/me` did not open.
- `/store/approvals` redirected back to `/store`.
- `/store/rankings` first appeared to show all data, then product owner clarified that only ranking and score were visible.

Expected checks:

- [ ] No 45-second refresh loop
- [ ] Bursa Marka Park appears in rankings
- [ ] Low-role ranking remains summary/top100
- [ ] Global metrics hidden for low-role user
- [ ] Managed-store personnel details visible to store manager
- [ ] `/store/kpis` shows March 2026 score and metrics
- [ ] No demo rows visible

Feedback buckets:

- Data trust: not evaluated yet.
- Ranking trust: OK after clarification; low-role view shows ranking and score only, not detailed metric values.
- KPI explanation: not evaluated yet.
- Navigation/loading: `/store/me` does not open; `/store/approvals` redirects to `/store`.
- UI direction: not evaluated yet.
- Operational blocker: store manager cannot complete the included page checklist yet.

Issues:

- `PILOT-002`: `/store/me` does not open in the first low-role browser check.
- `PILOT-003`: `/store/approvals` redirects to `/store`.
- `PILOT-004`: `/store/rankings` first appeared to show all data; clarified as ranking/score-only display.

Pause criteria triggered:

- Yes, pending investigation. Included-page navigation needs verification before continuing pilot.

Decision:

- Needs fix or session-role clarification for `/store/me` and `/store/approvals` before next pilot session.

Next action:

- Confirm current browser session role with sanitized `/auth/session`.
- Inspect frontend store route definitions and guards.
- Compare failing store page API calls against current session scope.

### Session 1 Investigation Update - 2026-05-05

Sanitized diagnostics:

- Low-role `/auth/session` returned `200`.
- Role resolved as `STORE_MANAGER`.
- Assigned store resolved to Bursa Marka Park store scope.
- `/reports/rankings` returned `200`, access mode `top100`, global details hidden, global metric leaks `0`.
- `/reports/my-performance?mode=live` returned `200`; the route API is reachable, but this manager session has no matched personal KPI metrics for the current live personal-performance card.
- `/target-distributions/requests`, rejected workforce request queues, store personnel targeting, position options, and store employees all returned `200`.

Root cause:

- Store protected routes that needed login/session refresh redirected to `/auth/login` without preserving the current store sub-route in every path.
- Once the shell became ready, `/auth/login` returned the user to the first allowed landing route (`/store`) instead of the originally requested route such as `/store/approvals`.
- This explains the user-observed `/store/approvals` -> `/store` behavior and is a likely contributor to `/store/me` appearing not to open during the same session-refresh gap.

Local fix:

- Added route-return preservation for store shell login redirects.
- Added `/auth/login?returnTo=...` handling when the auth shell becomes ready.
- Preserved query/hash in session-expired return paths.
- Added regression coverage in `admin-web/e2e/store-return-to.spec.ts`.

Local verification:

- `npm.cmd --prefix admin-web run build` -> pass.
- `npm.cmd --prefix admin-web run test:e2e -- store-return-to.spec.ts` -> 2 passed.
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store approvals page lets store managers submit seller code requests|store approvals page submits target distribution allocations with employee ids|store approvals page lets store managers submit offboarding requests|store approvals page lets store managers edit and resubmit returned workforce requests"` -> 4 passed.
- `/store/me` route smoke inside `store shell exposes Turkish-first chrome and hides technical auth roles` -> pass.

Staging deploy/retest:

- Vercel production deploy id `dpl_7WcpWLL3FvnaxLcs1hnVk8W6L57D`.
- Deployment URL `https://hr-axis-staging-hi3jxk9k7-suleymankuncan-webs-projects.vercel.app`.
- Alias updated to `https://staging.hr-axis.com`.
- Live bundle asset changed to `assets/index-BCqKitO3.js`.
- Live bundle no longer contains the old `encodeURIComponent(location.pathname)`-only return path.
- Unauthenticated browser smoke for `/store/approvals` now lands on `/auth/login?returnTo=%2Fstore%2Fapprovals`.
- Follow-up root cause found after `/store/me` still did not open: session-expired notice could remain on `/auth/login` and block redirect even after the Clerk-backed session became ready again.
- Added regression coverage for the notice path in `admin-web/e2e/store-return-to.spec.ts`.
- Second Vercel production deploy id `dpl_JJfJkXbbpF3SrqoNmcdFKgGdqYtL`.
- Second deployment URL `https://hr-axis-staging-b94rz7ff1-suleymankuncan-webs-projects.vercel.app`.
- Alias updated to `https://staging.hr-axis.com`.
- Live bundle asset changed to `assets/index-CR-gU7S-.js`.
- Unauthenticated browser smoke for `/store/me` now lands on `/auth/login?returnTo=%2Fstore%2Fme`; authenticated retest must confirm ready-session return from login into `/store/me`.

Second `/store/me` root cause:

- Product owner diagnostic showed the browser was already on `https://staging.hr-axis.com/store/me`, the route stayed there, and `/reports/my-performance?mode=live` returned `200`.
- Root cause: the live no-data personal-performance response can omit `supporting` metadata while the page assumed `performance.supporting.targetEntryMode` and `performance.supporting.netSalesValue` always exist.
- Frontend now treats missing `partial` / `supporting` metadata as a normal partial/no-data state instead of crashing the route.
- Stale self-performance Playwright wording was updated from the old `Derived score signal` copy to current `Hedef bazli skor`.

Local verification:

- Red test observed: `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "handles live no-data"` failed on the existing bundle with `Cannot read properties of undefined (reading 'targetEntryMode')`.
- `npm.cmd --prefix admin-web run build` -> pass.
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "handles live no-data"` -> 1 passed.
- `npm.cmd --prefix admin-web run test:e2e -- store-return-to.spec.ts` -> 3 passed.
- `npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts -g "store self-performance page renders|handles live no-data|store self-performance closed mode"` -> 3 passed.

Staging deploy/retest:

- Vercel production deploy id `dpl_6UUc3hoJ4C4tFowJeqrYR1hZ2daH`.
- Deployment URL `https://hr-axis-staging-hwt7e4dj3-suleymankuncan-webs-projects.vercel.app`.
- Alias includes `https://staging.hr-axis.com`.
- Live custom-domain asset check found `assets/StoreMyPerformancePage-BrK9bgPp.js`.
- Live asset contains the no-data fallback strings and no longer has raw `performance.supporting` access.

Authenticated retest:

- Product owner confirmed `/store/me` opened in the low-role browser session.
- Product owner confirmed `/store/approvals` opened in the low-role browser session.
- `PILOT-002` can be closed for the included controlled pilot route.
- `PILOT-003` can be closed for the included controlled pilot route.

Daily smoke continuation:

- Product owner confirmed `/store/kpis` opened and no issue was observed.
- Product owner confirmed `/store/rankings` opened.
- Product owner confirmed the store was not visible in the global top 100 view, which is acceptable for the current ranking position.
- Product owner confirmed managed-store personnel details are visible.
- No demo-data issue was reported during this pass.

## Issue Register

| ID | Date | Severity | Area | Status | Summary | Owner | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PILOT-001 | 2026-05-05 | P2 | Process | Closed | First user feedback session captured as Session 1. | Product owner | Continue logging each pilot check round. |
| PILOT-002 | 2026-05-05 | P1 | Store / performance | Closed | `/store/me` first hit auth return-path bugs, then a live no-data response without `supporting` metadata crashed the page while the URL stayed on `/store/me`; product owner confirmed the route now opens after deploy `dpl_6UUc3hoJ4C4tFowJeqrYR1hZ2daH`. | Codex + Product owner | Keep no-data regression in the release gate. |
| PILOT-003 | 2026-05-05 | P1 | Store / approvals | Closed | `/store/approvals` redirected to `/store` because auth return target was dropped during login/session refresh; product owner confirmed the route now opens after staging deploys. | Codex + Product owner | Keep returnTo regression coverage in the release gate. |
| PILOT-004 | 2026-05-05 | P0 | Ranking visibility | Closed | Product owner clarified that rankings show only ranking and score, not all metric details. | Product owner | Expected low-role behavior. |

## Decision Register

| Date | Decision | Basis | Follow-up |
| --- | --- | --- | --- |
| 2026-05-05 | Start controlled pilot tracking | Conditional Go decision and controlled scope are documented. | Capture Session 1 feedback with low-role store manager. |
| 2026-05-05 | Pause pilot progression pending investigation | Session 1 found included-page navigation issues. Ranking visibility was clarified as expected low-role behavior. | Confirm session role, inspect route guards, and fix verified root cause for `/store/me` and `/store/approvals`. |
| 2026-05-05 | Resume after authenticated browser retest gate | Root causes were auth return target drop and notice-blocked ready redirects; local fixes, regression tests, frontend deploys, and unauthenticated live returnTo smokes pass. | Rerun Session 1 low-role browser checklist for `/store/me` and `/store/approvals`. |
| 2026-05-05 | Close Session 1 navigation blockers | Product owner confirmed `/store/me` and `/store/approvals` both open in the authenticated low-role browser session. | Continue daily controlled pilot smoke with `/store/kpis` and rankings checks. |
| 2026-05-05 | Continue controlled pilot after route smoke | Product owner confirmed `/store/kpis` has no issue and `/store/rankings` behaves as expected for low-role summary plus managed-store detail. | Continue pilot feedback collection; next focus is user-facing wording/data trust issues. |
| 2026-05-06 | Controlled Pilot Round 1 Outcome | `docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-round-1-outcome.md` records `Continue` for the same controlled staging/internal pilot scope with no active route blocker remaining from Round 1. | Continue collecting Round 2 feedback in this log; run `npm.cmd run check:pilot-stabilization` before any new invite wave or deploy that can affect pilot routes. |
