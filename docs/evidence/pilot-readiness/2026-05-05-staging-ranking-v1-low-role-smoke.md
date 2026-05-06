# Staging Ranking V1 Low-Role Live Smoke Evidence

Date: 5 Mayis 2026

Scope: Authenticated Clerk low-role smoke against staging Ranking V1 after binding a separate non-`SUPER_ADMIN` user to Bursa Marka Park as `STORE_MANAGER`.

## Inputs

- Frontend: `https://staging.hr-axis.com`
- API base: `https://api-staging.hr-axis.com/api`
- Auth: Clerk JWT template `hr-axis-api`
- Period: March 2026 monthly (`2026-03-01` to `2026-03-31`)
- Low-role account: `suleymankuncan@lufian.com.tr`
- Bound store: `Bursa Marka Park Avm`

Sensitive material policy:

- Raw bearer token, Clerk cookie, password, provider subject, and full JWT were not recorded.
- Token was passed through a one-time local listener and deleted after the smoke.

## Binding Verification

The low-role Clerk user was bound in staging DB as:

- App username: `suleyman.kuncan.lufian`
- Employee: `Ugur Korkmaz`
- Role: `STORE_MANAGER`
- Scope type: `store`
- Store: `PB_BURSA_MARKA_PARK_AVM`
- Active action-store assignments: `1`
- `SUPER_ADMIN`: not present

Interpretation:

- The account represents a store manager only.
- It is intentionally separate from the existing privileged `SUPER_ADMIN` + `STORE_MANAGER` staging user.

## Sanitized Session

- `GET /auth/session`: `200`
- `authMode`: `jwt`
- `authenticated`: `true`
- App user id: `cc389a41-06e7-4740-8f7e-1b6ca57b36f5`
- Employee id present: `true`
- Roles:
  - `STORE_MANAGER`
- Read scope counts:
  - company ids: `1`
  - region ids: `1`
  - store ids: `1`
- Action scope counts:
  - assigned store ids: `1`

Interpretation:

- The live token authenticated as a low-role store manager.
- There is no privileged role in the live session.

## Ranking V1 Smoke

Endpoint:

- `GET /reports/rankings?periodType=monthly&periodStart=2026-03-01&limit=500&offset=0`

Result:

- HTTP status: `200`
- Source:
  - mode: `live`
  - period type: `monthly`
  - period start: `2026-03-01`
  - period end: `2026-03-31`
- Access:
  - global mode: `top100`
  - can see global details: `false`
  - can see managed-store personnel details: `true`
- Filter option counts:
  - region managers: `0`
  - regions: `8`
  - stores: `154`
- Store leaderboard:
  - total: `154`
  - request limit after policy: `100`
  - returned rows: `100`
  - detail rows: `0`
  - summary rows: `100`
  - rows with metrics: `0`
  - demo-name rows: `0`
  - current store present: `true`
- Personnel leaderboard:
  - total: `727`
  - request limit after policy: `100`
  - returned rows: `100`
  - detail rows: `0`
  - summary rows: `100`
  - rows with metrics: `0`
  - demo-name rows: `0`
  - current employee present: `false`
- Managed-store personnel detail:
  - returned rows: `7`
  - detail rows: `7`
  - rows with metrics: `7`
  - demo-name rows: `0`
- Available periods: `1`

Interpretation:

- Low-role global rankings are Top 100 and summary-only.
- Store/personnel global rows do not leak metric details.
- The store manager can still see their own managed-store personnel with detailed metrics.
- Demo seed rows are excluded from the visible ranking result.

## Bursa Marka Park Search Smoke

Endpoint:

- `GET /reports/rankings?periodType=monthly&periodStart=2026-03-01&search=Bursa%20Marka%20Park&limit=50&offset=0`

Result:

- HTTP status: `200`
- Found: `true`
- Store name: `Bursa Marka Park Avm`
- Rank: `77`
- Population: `154`
- Visibility: `summary`
- Score value: `86.01`
- Metric array length: `0`

Interpretation:

- The manager can find their store in global ranking search.
- Because the global row is summary-only, metrics are not exposed in that searched global row.

## Store-Facing Smoke

Endpoint:

- `GET /reports/store-kpi-highlights?periodType=monthly&periodStart=2026-03-01`

Result:

- HTTP status: `200`
- Source mode: `live`
- Store present: `true`
- Store name: `Bursa Marka Park Avm`
- Period:
  - start: `2026-03-01T00:00:00.000Z`
  - end: `2026-03-31T00:00:00.000Z`
- Score:
  - value: `0.86`
  - matched metrics: `4`
  - total metrics: `6`
- Metric codes:
  - `TARGET_ACHIEVEMENT`
  - `CR`
  - `ATV`
  - `UPT`
  - `BM_CHECKLIST`
  - `VM_CHECKLIST`

## Local Runner Evidence

Sanitized JSON output:

- `outputs/master-data-prep/staging-ranking-v1-low-role-smoke-evidence.json`

Runner result:

- `status=ok`
- no stderr output

## Remaining Limits

- This smoke covers a `STORE_MANAGER` low-role user, not `STORE_PERSONNEL`.
- It proves the March 2026 live Ranking V1 access behavior for the supplied staging account.
- Supabase advisory still reports many internal `ops.*` tables with RLS disabled; backend API authorization is working, but direct Supabase client exposure must be reviewed before any public client uses those tables.
