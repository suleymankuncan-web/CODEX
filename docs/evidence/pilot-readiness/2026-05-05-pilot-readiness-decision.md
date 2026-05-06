# Pilot Readiness Decision

Date: 5 Mayis 2026

Environment:

- Frontend: `https://staging.hr-axis.com`
- API base: `https://api-staging.hr-axis.com/api`
- DB: Supabase staging Postgres
- Auth: Clerk
- Authorization boundary: backend API and app DB roles/scopes

## Decision

Final decision: `Conditional Go` for a controlled staging/internal pilot.

This is not approval for broad production rollout.

The technical pilot path is now evidence-backed enough for a limited operator/business validation, provided the restrictions below are accepted and followed.

## Why This Is Not No-Go Anymore

The earlier No-Go blockers were real and useful. The critical missing evidence has now mostly been replaced with live staging proof:

- Staging frontend and API are known and reachable.
- Clerk-authenticated store shell routes opened in the browser.
- The previous 45-second refresh symptom did not recur in authenticated store routes.
- Live `/auth/session` evidence exists.
- Assigned and unassigned action-scope behavior was smoke-tested.
- Accepted temporary master-data baseline was promoted in staging.
- March 2026 Power BI KPI import completed and materialized.
- Demo stores are not receiving March KPI actual rows.
- Ranking V1 live API smoke passed for privileged mode.
- Ranking V1 live API smoke passed for low-role `STORE_MANAGER` mode.
- Store-facing KPI highlights smoke passed for Bursa Marka Park.
- Controlled Clerk test accounts for `SUPER_ADMIN`, `REGION_MANAGER`, `STORE_MANAGER`, and `STORE_PERSONNEL` passed manual staging role smoke on 6 Mayis 2026.

## Evidence Map

### Controlled Pilot Role Smoke

Evidence:

- `docs/evidence/pilot-readiness/2026-05-06-role-smoke.md`

Status: `Go` for the controlled four-persona pilot role set.

Closed:

- `SUPER_ADMIN` test account opens admin/operator surfaces.
- `REGION_MANAGER` test account opens ranking, target, and competition surfaces while auth/master-data/integration admin routes remain unavailable.
- `STORE_MANAGER` test account opens store shell, own performance, KPI, approvals, and rankings.
- `STORE_PERSONNEL` test account opens own performance and rankings.
- Store personnel cannot see other personnel KPI details; own details remain on `/store/me`.

Restriction:

- These are Clerk test-mode accounts for staging smoke, not real user inboxes.

### Staging Auth And Scope

Evidence:

- `docs/evidence/pilot-readiness/2026-05-02-authenticated-clerk-store-smoke.md`
- `docs/evidence/pilot-readiness/2026-05-03-staging-token-scope-live-smoke.md`

Status: `Conditional Go`

Closed:

- Authenticated store shell route smoke.
- Live `/auth/session` role/scope resolution.
- Assigned-store positive action-scope smoke.
- Unassigned-store negative `403` smoke.

Still open:

- Logout behavior was not separately recorded.
- Expired-token behavior was not separately recorded.
- Write/mutation action smoke was not part of the current evidence.

### Master Data Baseline

Evidence:

- `docs/evidence/pilot-readiness/2026-05-05-staging-master-data-kpi-materialization.md`

Status: `Conditional Go`

Closed:

- Store bootstrap promoted `155/155`.
- Personnel bootstrap promoted `805/805`.
- Staging live totals show active stores, employees, assignments, and external id maps.

Restriction:

- This is the accepted temporary staging baseline for pilot testing, not the final future HR/master-data source of truth.

### KPI Import And Materialization

Evidence:

- `docs/evidence/pilot-readiness/2026-05-05-staging-master-data-kpi-materialization.md`

Status: `Go` for March 2026 staging KPI evidence.

Closed:

- Import batch `e3fd6958-04d2-45ac-a2ae-f1fbe401612d` completed.
- `4864` raw rows processed.
- `4864` KPI actual rows materialized.
- Store scope: `1230` rows / `154` stores.
- Employee scope: `3634` rows / `154` stores / `727` employees.
- Bursa Marka Park sample values are present.

Restriction:

- This proves March 2026 monthly snapshot behavior. It does not prove a future month upload process with final master data.

### Ranking V1 Privileged Mode

Evidence:

- `docs/evidence/pilot-readiness/2026-05-05-staging-ranking-v1-live-smoke.md`

Status: `Go`

Closed:

- `/reports/rankings` returned `200`.
- Access mode `full`.
- Store leaderboard returned `154/154` detail rows.
- Personnel leaderboard total `727`, returned `500`.
- Demo rows `0`.
- Bursa Marka Park search rank `77/154`.
- Store KPI highlights returned `200`, score `0.86`.

### Ranking V1 Low-Role Mode

Evidence:

- `docs/evidence/pilot-readiness/2026-05-05-staging-ranking-v1-low-role-smoke.md`

Status: `Go` for `STORE_MANAGER` low-role masking.

Closed:

- Separate non-`SUPER_ADMIN` Clerk user authenticated successfully.
- Role only `STORE_MANAGER`.
- Access mode `top100`.
- Global details `false`.
- Store global leaderboard returned `100` summary rows.
- Personnel global leaderboard returned `100` summary rows.
- Global metric leaks `0`.
- Managed-store personnel returned `7/7` detail rows.
- Bursa Marka Park search remained summary-only.
- Store KPI highlights returned `200`, score `0.86`.

Restriction:

- This file covers `STORE_MANAGER` low-role masking. `STORE_PERSONNEL` is covered separately in `docs/evidence/pilot-readiness/2026-05-06-role-smoke.md`.

## Conditional Go Restrictions

The controlled pilot can proceed only under these restrictions:

- Keep access limited to explicitly created Clerk pilot users.
- Do not open broad/public production usage from this decision.
- Treat current master data as temporary accepted baseline.
- Use March 2026 Power BI data as historical pilot validation data, not as proof of future monthly operations.
- Do not expose direct Supabase client access to `ops.*` tables until RLS/policy decisions are made.
- Keep manual Excel/Power BI export import as the pilot data path; JSON/API source adapter remains future work.
- Do not include VM or region-manager operational flows unless separate users/scopes are smoke-tested.
- Do not represent checklist scores as complete for March; BM/VM checklist metrics are present but missing actual checklist contribution in the current sample.
- Make clear to store users that global rankings are summary/top100, while store managers can see their own personnel details.

## Remaining Risks

### P1 - Supabase RLS Advisory

Supabase advisory reports many internal `ops.*` tables with RLS disabled.

Current posture:

- Backend API authorization is the active access boundary.
- The smoke tests prove backend role/scope behavior.

Risk:

- Direct Supabase client exposure would be unsafe without explicit RLS and policies.

Decision:

- Accept for controlled backend-only pilot.
- Block any direct Supabase client use until RLS/policy is designed.

### P1 - Final Master Data Source Not Yet Automated

Current posture:

- Temporary accepted staging baseline exists.
- Store/personnel matching is enough for current pilot validation.

Risk:

- Future months may need cleaner official source data, JSON/API feeds, or stricter employee/store code mapping.

Decision:

- Accept for historical pilot validation.
- Do not call this the final master-data pipeline.

### P1 - Logout / Expired Token Evidence Not Recorded

Current posture:

- Authenticated JWT path and active role/scope resolution are proven.

Risk:

- Session edge behavior has not been separately captured as evidence.

Decision:

- Accept for controlled pilot if the user flow remains normal login/session usage.
- Add logout/expired-token smoke before broad rollout.

### P2 - Real Store Personnel Inbox Pilot Still Pending

Current posture:

- `STORE_MANAGER` low-role masking is proven live.
- `STORE_PERSONNEL` route/privacy behavior is smoke-tested through a Clerk test-mode account.

Risk:

- Real store personnel mailbox delivery, onboarding messaging, and support behavior are not validated yet.

Decision:

- `STORE_PERSONNEL` can be included in controlled staging validation with test-mode accounts.
- Before inviting a real store personnel user, create an active mailbox-backed account and repeat the same smoke.

### P2 - UI Polish Is Not Final

Current posture:

- Store-facing pages function.
- User has already flagged UI style preferences for later redesign.

Risk:

- Pilot users may perceive the product as less polished than the intended premium retail app direction.

Decision:

- Accept for operational validation.
- Do not treat pilot UI as final brand experience.

## No-Go Triggers

Stop or pause the pilot if any of these happen:

- A low-role user can see global metric details outside their allowed store/personnel scope.
- A user can act on an unassigned store.
- Power BI import creates or silently maps unreviewed stores/personnel.
- March KPI actuals attach to demo stores.
- Store-facing pages resume the 45-second reload problem.
- Raw bearer tokens, cookies, passwords, provider subjects, or full JWTs are recorded in evidence.
- Direct Supabase client access is introduced without RLS/policy work.

## Operational Pilot Checklist

Before inviting pilot users:

- Confirm the exact pilot user list and roles.
- Confirm which flows are included: store KPI, rankings, approvals, target distribution, or read-only validation.
- Confirm which flows are excluded: VM, broad real-user rollout, write actions outside assigned-store checks, JSON/API integration.
- Confirm March 2026 is historical validation data.
- Keep one admin account and one low-role account available for support smoke.
- Monitor `/store`, `/store/me`, `/store/kpis`, `/store/approvals`, and `/store/rankings` after each deploy.

## CODEX DURUST YORUM

Bu artik eski anlamiyla No-Go degil. Sistem staging uzerinde gercek auth, gercek KPI materialization, privileged ranking ve low-role masking kanitlarini verdi.

Ama bu da "herkese acalim" Go'su degil. En dogru karar kontrollu pilot icin Conditional Go: urun davranisini gercek kullaniciyle test edecek kadar guven var, fakat master data kaynagi, RLS karari, logout/expired-token evidence ve UI final polish gibi konular genis rollout oncesi ayrica kapatilmak zorunda.

Kisa versiyon: teknik pilot kapisi acildi, prod rollout kapisi henuz acilmadi.

## Next Logical Step

Pilot kapsam kararini netlestir:

- kimler davet edilecek,
- hangi sayfalari test edecekler,
- hangi aksiyonlar kapali kalacak,
- pilot sonunda hangi geri bildirimler Go / pause / rollback kararini belirleyecek.
