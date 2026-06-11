# Controlled Pilot Feedback Log

Start date: 5 Mayis 2026

Scope source:

- `docs/evidence/pilot-readiness/2026-05-05-controlled-pilot-scope.md`

Decision source:

- `docs/evidence/pilot-readiness/2026-05-05-pilot-readiness-decision.md`

Current outcome source:

- `docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-round-1-outcome.md` - Controlled Pilot Round 1 Outcome
- `docs/evidence/pilot-readiness/2026-05-22-controlled-pilot-round-2-stabilization.md` - Controlled Pilot Round 2 technical stabilization

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

## Feedback Record Contract

Use this record shape for each new controlled-pilot finding. Existing historical
sessions may keep their original narrative form, but every new actionable issue
must have this structure before it drives a PR.

```text
### Feedback ID: PILOT-FB-YYYYMMDD-NN

Session:
Reporter:
Moderator:
Decision owner:
Environment:
Persona / role:
Route / surface:

Expected behavior:

Actual behavior:

Evidence:
- Type:
- Link or sanitized note:

Severity:
- P0 stop / P1 pilot blocker / P2 pilot friction / P3 backlog

Reason for severity:

Contract impact suspected:
- None / UI-only / frontend data binding / backend read/API /
  backend write/workflow / auth-DB-scoring-queue-provider

Decision:
- Fix now / Batch with same-surface P2 / Park / Needs product decision /
  Needs provider or session input

Next action:

Owner:
```

A finding is not actionable until it names:

- affected persona or role,
- affected route or surface,
- expected behavior,
- actual behavior,
- severity,
- decision,
- next action.

## Severity Definitions

`P0 stop`:

- forbidden data is visible,
- a read-only role can mutate,
- login/session is broken for the pilot path,
- data corruption or unsafe workflow transition is possible,
- Store Action or import behavior can affect the wrong store or role,
- evidence would require raw secrets to prove safely.

Action:

- stop the normal feedback PR train,
- open only a P0 fix PR or P0 evidence-blocker PR,
- do not batch with other work.

`P1 pilot blocker`:

- a role cannot complete the planned pilot flow,
- a primary route is unusable,
- support cannot recover or explain the state,
- a required Store Action or workflow control fails in the scoped path,
- a real data binding issue creates wrong operational interpretation.

Action:

- open the next code PR unless a P0 exists,
- fix one blocker per PR unless the same root cause closes multiple records.

`P2 pilot friction`:

- the flow is usable but confusing,
- copy or empty/error state causes uncertainty,
- mobile or desktop layout is bounded but awkward,
- a non-critical action takes too many steps,
- a role can proceed but needs support explanation.

Action:

- batch only when findings share the same surface, risk class, verification,
  and rollback story,
- do not interrupt P0/P1 work.

`P3 backlog`:

- feedback is a nice-to-have,
- the request implies a new feature,
- the request implies broad redesign,
- the request needs a product decision,
- the request depends on provider, role, module, or production posture work.

Action:

- park with a trigger,
- do not convert directly into code.

## Next PR Rule

After each real or assisted controlled-pilot session:

1. Close or block P0 items.
2. Select one P1 item that blocks the next controlled-pilot session.
3. Batch P2 only if it is same-surface and same-gate.
4. Park P3 with a trigger.
5. Update the pilot decision.

Do not open a code PR from intuition. The next product PR must point to a
sanitized feedback record, severity, expected behavior, actual behavior, and
verification path.

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

## Session 2 - 2026-05-06 Round 2 Role Browser Check

Tester:

- Product owner in staging browser.

Environment:

- Frontend: `https://staging.hr-axis.com`
- API base: `https://api-staging.hr-axis.com/api`

Accounts/roles:

- Admin user.
- Store manager user.
- Store personnel user.
- Region manager / BM user.

Routes checked:

- [x] `/admin/integrations`
- [x] `/admin/master-data`
- [x] `/admin/targets`
- [x] `/admin/competitions`
- [x] `/admin/feed`
- [x] `/store`
- [x] `/store/me`
- [x] `/store/kpis`
- [x] `/store/rankings`
- [x] `/store/approvals`

Observed:

- Admin user confirmed `/admin/integrations`, `/admin/master-data`, and `/admin/targets` are OK.
- Store manager user confirmed store shell, self performance, KPI, rankings, and approvals surfaces are OK.
- Store personnel user confirmed expected store-facing identity behavior is OK.
- Region manager / BM user confirmed the recommended BM surfaces are OK, including `/admin/targets`, `/store/rankings`, `/admin/competitions`, and `/admin/feed`.
- Product owner confirmed all current pilot users checked in this Round 2 browser pass are OK.
- Store personnel previously could open `/store/approvals`, but no store-personnel operation belongs there; frontend action gates and backend write endpoints remained restricted to manager/review roles by scope.

Feedback buckets:

- Data trust: no new issue reported.
- Ranking trust: no new issue reported.
- KPI explanation: no new issue reported.
- Navigation/loading: no new blocker reported.
- UI direction: `/store/approvals` visibility for `STORE_PERSONNEL` was confusing because the role has no action there; follow-up UX guard now removes the direct route and leftover links for this role.
- Operational blocker: none.

Issues:

- `PILOT-005`: Closed on 2026-05-22 by route/navigation cleanup. `STORE_PERSONNEL` no longer opens `/store/approvals` by direct route, and no longer sees leftover approvals links from store personnel-facing surfaces. This was a UX/navigation cleanup item, not a confirmed authorization blocker.

Pause criteria triggered:

- No.

Technical gate:

- `npm.cmd run check:pilot-stabilization` -> pass.
- Contract checks: 14 passed.
- Admin web pilot smoke: build passed; `pilot-smoke.spec.ts` and `pilot-api-contracts.spec.ts` passed with 7 tests.

Decision:

- Continue controlled pilot.

Next action:

- Keep collecting Round 2 feedback.
- Keep monitoring store personnel navigation during pilot feedback; do not add a personnel approvals view until a scoped product requirement exists.

## Session 3 - 2026-05-23 Assisted Persona Follow-Up Closure

Tester:

- Codex with product owner collaboration.

Environment:

- Frontend: `https://staging.hr-axis.com`
- API base: `https://api-staging.hr-axis.com/api`
- Repo baseline after follow-up merges:
  - `69f992a3` - landing return-state investigation
  - `ac363ae6` - Store Action command smoke harness

Accounts/roles:

- `SUPER_ADMIN`
- `HR_ADMIN`
- `REGION_MANAGER`
- `STORE_MANAGER`
- `STORE_PERSONNEL`
- `REPORT_VIEWER`

Follow-ups checked:

- `HR_ADMIN` and `REPORT_VIEWER` first-route observations from the assisted
  persona rehearsal.
- Store Action command-mode proof gap after Store Action plans were visible but
  create/status/close/cancel controls were not exercised live.

Observed:

- Landing/return-state follow-up is root-caused as intentional `returnTo`
  preservation, not a broken clean role default.
- Clean default landing remains `/admin/competitions` for `HR_ADMIN` and
  `/admin/reports` for `REPORT_VIEWER`.
- Changing `returnTo` precedence would be an auth/navigation behavior decision,
  so no product code was changed.
- Store Action live command proof now has a dedicated, token-safe staging smoke
  harness:
  `npm.cmd --prefix admin-web run smoke:store-action:staging:command`.
- The harness proves assigned-store create/status/close/cancel plus
  unassigned-store `403` when run with a real `STORE_MANAGER` bearer token and
  explicit mutation acknowledgement.
- The live command smoke was not run in this shell because there was no
  `STORE_ACTION_SMOKE_BEARER_TOKEN` and no explicit approval to create terminal
  Store Action evidence rows in staging.

Evidence:

- `docs/evidence/pilot-readiness/2026-05-23-assisted-persona-rehearsal-v1.md`
- `docs/evidence/pilot-readiness/2026-05-23-landing-return-state-investigation-v1.md`
- `docs/evidence/pilot-readiness/2026-05-23-store-action-command-smoke-harness-v1.md`

Technical gate:

- Landing follow-up PR #469:
  - `git diff --check` passed.
  - `npm.cmd run test:scripts` passed, `309/309`.
  - GitHub checks passed.
  - Codex review: no major issues.
- Store Action command harness PR #470:
  - `npm.cmd --prefix admin-web run test:scripts` passed, `25/25`.
  - `npm.cmd run test:scripts` passed, `309/309`.
  - `git diff --check` passed with only the existing Windows LF/CRLF warning.
  - GitHub frontend/release/rehearsal checks passed.
  - Codex review: no major issues.

Feedback buckets:

- Data trust: no new issue reported.
- Ranking trust: no new issue reported.
- KPI explanation: no new issue reported.
- Navigation/loading: landing confusion is explained by preserved `returnTo`;
  no blocker remains from the follow-up.
- UI direction: Store Action command controls still need a scoped live command
  proof if the next pilot session includes command mutation.
- Operational blocker: none for continuing read-only/route controlled pilot;
  Store Action command proof remains input-gated.

Issues:

- `PILOT-006`: Closed. `HR_ADMIN`/`REPORT_VIEWER` first-route observation is
  explained by `returnTo` behavior and direct route allow/deny checks remain
  valid.
- `PILOT-007`: Closed. Store Action live command proof passed with a real
  `STORE_MANAGER` token, assigned-store create/status/close/cancel, and
  unassigned-store `403`.

Pause criteria triggered:

- No for the controlled read-only/route pilot.
- No for Store Action command proof after the live smoke passed.

Decision:

- Continue controlled pilot.
- Store Action live command proof is now closed for the controlled pilot path.
- Do not change auth redirect behavior without a dedicated UX/auth decision.

Next action:

- Continue pilot feedback collection and keep broad production at `No-Go`.

## Issue Register

| ID | Date | Severity | Area | Status | Summary | Owner | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PILOT-001 | 2026-05-05 | P2 | Process | Closed | First user feedback session captured as Session 1. | Product owner | Continue logging each pilot check round. |
| PILOT-002 | 2026-05-05 | P1 | Store / performance | Closed | `/store/me` first hit auth return-path bugs, then a live no-data response without `supporting` metadata crashed the page while the URL stayed on `/store/me`; product owner confirmed the route now opens after deploy `dpl_6UUc3hoJ4C4tFowJeqrYR1hZ2daH`. | Codex + Product owner | Keep no-data regression in the release gate. |
| PILOT-003 | 2026-05-05 | P1 | Store / approvals | Closed | `/store/approvals` redirected to `/store` because auth return target was dropped during login/session refresh; product owner confirmed the route now opens after staging deploys. | Codex + Product owner | Keep returnTo regression coverage in the release gate. |
| PILOT-004 | 2026-05-05 | P0 | Ranking visibility | Closed | Product owner clarified that rankings show only ranking and score, not all metric details. | Product owner | Expected low-role behavior. |
| PILOT-005 | 2026-05-06 | P3 | Store / approvals UX | Closed | `STORE_PERSONNEL` could open `/store/approvals`, but had no expected operation there; route guard and leftover link visibility now keep personnel on `/store/me`/personnel surfaces while manager/review approvals remain available. | Product owner + Codex | Keep monitoring pilot navigation; add a personnel approvals read-only surface only if explicitly scoped later. |
| PILOT-006 | 2026-05-23 | P2 | Auth / landing | Closed | `HR_ADMIN` and `REPORT_VIEWER` first-route observations are explained by preserved `returnTo`; clean default landing and direct route allow/deny behavior remain correct. | Codex | Keep `returnTo` behavior unchanged unless a dedicated UX/auth decision scopes a change. |
| PILOT-007 | 2026-05-23 | P2 | Store Action / command proof | Closed | Live Store Action command proof passed with a real `STORE_MANAGER` token: assigned-store create/status/close/cancel succeeded and unassigned-store create returned `403`. | Product owner + Codex | Keep `docs/evidence/pilot-readiness/2026-05-23-store-action-command-live-proof-v1.md`; rerun only after auth/scope or Store Action command changes. |

## Decision Register

| Date | Decision | Basis | Follow-up |
| --- | --- | --- | --- |
| 2026-05-05 | Start controlled pilot tracking | Conditional Go decision and controlled scope are documented. | Capture Session 1 feedback with low-role store manager. |
| 2026-05-05 | Pause pilot progression pending investigation | Session 1 found included-page navigation issues. Ranking visibility was clarified as expected low-role behavior. | Confirm session role, inspect route guards, and fix verified root cause for `/store/me` and `/store/approvals`. |
| 2026-05-05 | Resume after authenticated browser retest gate | Root causes were auth return target drop and notice-blocked ready redirects; local fixes, regression tests, frontend deploys, and unauthenticated live returnTo smokes pass. | Rerun Session 1 low-role browser checklist for `/store/me` and `/store/approvals`. |
| 2026-05-05 | Close Session 1 navigation blockers | Product owner confirmed `/store/me` and `/store/approvals` both open in the authenticated low-role browser session. | Continue daily controlled pilot smoke with `/store/kpis` and rankings checks. |
| 2026-05-05 | Continue controlled pilot after route smoke | Product owner confirmed `/store/kpis` has no issue and `/store/rankings` behaves as expected for low-role summary plus managed-store detail. | Continue pilot feedback collection; next focus is user-facing wording/data trust issues. |
| 2026-05-06 | Controlled Pilot Round 1 Outcome | `docs/evidence/pilot-readiness/2026-05-06-controlled-pilot-round-1-outcome.md` records `Continue` for the same controlled staging/internal pilot scope with no active route blocker remaining from Round 1. | Continue collecting Round 2 feedback in this log; run `npm.cmd run check:pilot-stabilization` before any new invite wave or deploy that can affect pilot routes. |
| 2026-05-06 | Continue controlled pilot after Round 2 role browser check | Product owner confirmed admin, store manager, store personnel, and region manager / BM identities are OK on the checked staging routes; all current pilot users checked in this pass are OK. `/store/approvals` for `STORE_PERSONNEL` is UX cleanup only. | Keep collecting Round 2 feedback; batch approvals visibility cleanup with a navigation/UX slice if needed. |
| 2026-05-22 | Controlled Pilot Round 2 technical stabilization | `docs/evidence/pilot-readiness/2026-05-22-controlled-pilot-round-2-stabilization.md` records local pilot gate stability and public staging/deploy health after PR #409-#412. | Continue the same controlled pilot scope; do not count protected load, external alert delivery, Supabase restore, or Redis/BullMQ as closed without the required inputs. |
| 2026-05-22 | Close `PILOT-005` store personnel approvals UX cleanup | `docs/evidence/pilot-readiness/2026-05-22-pilot-005-store-approvals-personnel-ux.md` records the route/link guard and targeted Playwright evidence. | Continue monitoring store personnel navigation; do not widen approvals visibility without a scoped product decision. |
| 2026-05-23 | Close landing/return-state follow-up | `docs/evidence/pilot-readiness/2026-05-23-landing-return-state-investigation-v1.md` records that observed first-route mismatches came from intentional `returnTo` preservation, while clean role defaults remain correct. | Keep auth redirect behavior unchanged unless repeated pilot friction justifies a scoped UX/auth decision. |
| 2026-05-23 | Prepare Store Action live command proof harness | `docs/evidence/pilot-readiness/2026-05-23-store-action-command-smoke-harness-v1.md` adds a token-safe staging smoke for assigned-store create/status/close/cancel plus unassigned-store `403`. | Run only with a fresh `STORE_MANAGER` token and explicit staging mutation acknowledgement; do not claim live command proof before then. |
| 2026-05-23 | Close Store Action live command proof | `docs/evidence/pilot-readiness/2026-05-23-store-action-command-live-proof-v1.md` records live staging assigned-store create/status/close/cancel success and unassigned-store `403`. | Continue controlled pilot; do not use this targeted proof to approve broad production. |
| 2026-06-12 | Feedback PR train ready after PR-0 | PR #682 added the Controlled Pilot Feedback Loop PR Train V1 plan plus this log's feedback record contract, severity definitions, and next-PR rule. Closeout: `docs/evidence/pilot-readiness/2026-06-12-controlled-pilot-feedback-loop-v1-closeout.md`. | No new post-contract `PILOT-FB-YYYYMMDD-NN` record exists yet; do not open a code PR until real or assisted session feedback is recorded. |
