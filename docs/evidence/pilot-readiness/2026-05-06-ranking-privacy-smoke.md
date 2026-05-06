# Ranking Privacy Smoke

Date: 6 Mayis 2026

Scope: Controlled staging smoke for `/store/rankings` visibility across the four pilot personas after Clerk test accounts were bound to HR Axis app roles/scopes.

Environment:

- Frontend: `https://staging.hr-axis.com`
- API base: `https://api-staging.hr-axis.com/api`
- Auth provider: Clerk
- KPI period used by Ranking V1 evidence: March 2026 monthly (`2026-03-01` to `2026-03-31`)
- Bound store for low-role smoke: Bursa Marka Park Avm

Sensitive material policy:

- Raw bearer tokens, Clerk cookies, passwords, provider subjects, full JWTs, and Clerk `user_` ids are not recorded.
- Test emails are recorded because they are non-personal pilot accounts created only for controlled staging smoke.

## Evidence Inputs

- Manual four-persona role smoke: `docs/evidence/pilot-readiness/2026-05-06-role-smoke.md`
- Privileged live Ranking V1 API smoke: `docs/evidence/pilot-readiness/2026-05-05-staging-ranking-v1-live-smoke.md`
- Store-manager low-role live Ranking V1 API smoke: `docs/evidence/pilot-readiness/2026-05-05-staging-ranking-v1-low-role-smoke.md`
- Route/role matrix: `docs/architecture/pilot-route-role-matrix.md`
- Backend access policy: `backend/nestjs/src/modules/store-ops/application/ranking-access.policy.ts`
- Backend policy test: `backend/nestjs/src/modules/store-ops/application/ranking-access.policy.spec.ts`

## Expected Privacy Contract

- `SUPER_ADMIN` and `REGION_MANAGER` are privileged ranking roles.
- Privileged roles can page through full Turkey ranking data with details.
- `STORE_MANAGER` and `STORE_PERSONNEL` see global rankings as Top 100 summary rows.
- Low-role global rows must not expose KPI metric details.
- `STORE_MANAGER` can see detailed KPI rows for personnel in the manager's own assigned store.
- `STORE_PERSONNEL` sees own detailed performance on `/store/me`; other personnel KPI details are not visible from rankings.
- Demo seed rows must not appear in live ranking surfaces.

## Super Admin

Pilot account:

- Email: `pilot.admin+clerk_test@example.com`
- Expected role: `SUPER_ADMIN`

Manual route smoke:

- `/store/rankings` opens: yes
- Admin/operator routes open as expected: yes

Privileged Ranking V1 API evidence:

- Access global mode: `full`
- Can see global details: `true`
- Store leaderboard returned rows: `154`
- Store detail rows: `154`
- Store rows with metrics: `154`
- Personnel leaderboard total: `727`
- Personnel returned rows: `500`
- Personnel detail rows: `500`
- Personnel rows with metrics: `500`
- Managed-store personnel detail rows: `7`
- Demo-name rows: `0`

Interpretation:

- Super admin ranking access is full-detail as intended for controlled pilot support and validation.

## Region Manager

Pilot account:

- Email: `pilot.bm+clerk_test@example.com`
- Expected role: `REGION_MANAGER`

Manual route smoke:

- `/store/rankings` opens: yes
- `/admin/targets` opens: yes
- `/admin/competitions` opens: yes
- `/admin/auth` is unavailable as expected: yes
- `/admin/master-data` is unavailable as expected: yes
- `/admin/integrations` is unavailable as expected: yes

Policy/test evidence:

- Backend ranking policy classifies `REGION_MANAGER` as privileged.
- Expected global mode: `full`
- Expected global details: `true`
- Expected managed-store personnel details: `true`
- Expected max requested page size after policy cap: `500`

Interpretation:

- Region manager is intentionally a privileged ranking viewer for the pilot. Admin-only auth, master-data, and integration surfaces remain blocked.
- A separate sanitized Region Manager API row-count dump was not recorded in this file; the behavior is covered by the manual route smoke plus backend policy contract test.

## Store Manager

Pilot account:

- Email: `pilot.sm+clerk_test@example.com`
- Expected role: `STORE_MANAGER`
- Bound employee: Ugur Korkmaz
- Bound store: Bursa Marka Park Avm

Manual route smoke:

- `/store/rankings` opens: yes
- `/store/me` opens: yes
- `/store/kpis` opens: yes
- `/store/approvals` opens: yes
- Own managed-store personnel ranking/details visible: yes

Low-role Ranking V1 API evidence:

- Access global mode: `top100`
- Can see global details: `false`
- Can see managed-store personnel details: `true`
- Store request limit after policy: `100`
- Store returned rows: `100`
- Store detail rows: `0`
- Store summary rows: `100`
- Store rows with metrics: `0`
- Personnel request limit after policy: `100`
- Personnel returned rows: `100`
- Personnel detail rows: `0`
- Personnel summary rows: `100`
- Personnel rows with metrics: `0`
- Managed-store personnel returned rows: `7`
- Managed-store personnel detail rows: `7`
- Managed-store personnel rows with metrics: `7`
- Demo-name rows: `0`

Bursa Marka Park search evidence:

- Store found: yes
- Visibility: `summary`
- Score value: `86.01`
- Metric array length: `0`

Interpretation:

- Store manager global ranking exposure is summary-only Top 100.
- The manager can still inspect own-store personnel details, which is the intended management workflow.

## Store Personnel

Pilot account:

- Email: `pilot.personel+clerk_test@example.com`
- Expected role: `STORE_PERSONNEL`
- Bound employee: Ayben Oguz
- Bound store: Bursa Marka Park Avm

Manual route smoke:

- `/store/me` opens: yes
- `/store/rankings` opens: yes
- Other personnel KPI details are not visible: yes
- Own detailed performance is available through `/store/me`: yes

Policy/test evidence:

- Backend ranking policy caps `STORE_PERSONNEL` to Top 100 summary-only rankings.
- Expected global mode: `top100`
- Expected global details: `false`
- Expected managed-store personnel details: `false`
- Expected global limit: `100`
- Expected offset: `0`

Interpretation:

- Store personnel privacy behavior is aligned with the pilot contract: own KPI detail is on `/store/me`; rankings do not expose other personnel KPI details.
- A separate sanitized Store Personnel API row-count dump was not recorded in this file; the behavior is covered by manual browser smoke plus backend policy contract test.

## Blockers

- None found.

## Local Verification

Fresh local verification on this branch:

- `npm.cmd --prefix backend/nestjs test -- ranking-access.policy.spec.ts --runInBand`: `4/4` passed.
- `npm.cmd run check:pilot-stabilization`: passed.
  - Node pilot contract tests: `13/13` passed.
  - Admin web pilot smoke: `7/7` Playwright tests passed.

## Remaining Limits

- This evidence combines manual staging route smoke, live API smoke from the existing privileged/store-manager Ranking V1 checks, and backend access policy tests.
- Region Manager and Store Personnel direct sanitized API row-count dumps were not separately captured.
- This closes the controlled pilot privacy smoke; it does not approve broad production rollout or direct Supabase client access.

## Outcome

Status: Go for controlled ranking privacy smoke.

Ranking V1 now has documented evidence for the pilot privacy boundary:

- privileged roles can validate the full Turkey ranking detail,
- store managers get global summary rankings plus own-store personnel detail,
- store personnel get rankings without other personnel KPI detail,
- demo rows remain absent from live ranking surfaces.
