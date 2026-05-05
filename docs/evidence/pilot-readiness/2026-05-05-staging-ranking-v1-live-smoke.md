# Staging Ranking V1 Live Smoke Evidence

Date: 5 Mayis 2026

Scope: Authenticated Clerk token smoke against staging Ranking V1 and a short store-facing monthly KPI surface.

## Inputs

- Frontend: `https://staging.hr-axis.com`
- API base: `https://api-staging.hr-axis.com/api`
- Auth: Clerk JWT template `hr-axis-api`
- Period: March 2026 monthly (`2026-03-01` to `2026-03-31`)

Sensitive material policy:

- Raw bearer token, Clerk cookie, password, provider subject, and full JWT were not recorded.
- Token was passed through a one-time local listener and only sanitized claim metadata was stored.

## Sanitized Session

- `GET /auth/session`: `200`
- `authMode`: `jwt`
- `authenticated`: `true`
- App user id: `80000000-0000-0000-0000-000000000900`
- Employee id present: `true`
- Roles:
  - `SUPER_ADMIN`
  - `STORE_MANAGER`
- Read scope counts:
  - company ids: `1`
  - region ids: `1`
  - store ids: `1`
- Action scope counts:
  - assigned store ids: `1`

Interpretation:

- This smoke proves the currently authenticated staging user's privileged Ranking V1 mode because `SUPER_ADMIN` is present.
- A separate low-role-only user is still required for a live summary-only Top 100 masking smoke without `SUPER_ADMIN`.

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
  - global mode: `full`
  - can see global details: `true`
  - can see managed-store personnel details: `true`
- Filter option counts:
  - region managers: `0`
  - regions: `8`
  - stores: `154`
- Store leaderboard:
  - total: `154`
  - returned rows: `154`
  - detail rows: `154`
  - rows with metrics: `154`
  - demo-name rows: `0`
  - current store present: `true`
- Personnel leaderboard:
  - total: `727`
  - returned rows: `500`
  - detail rows: `500`
  - rows with metrics: `500`
  - demo-name rows: `0`
  - current employee present: `true`
- Managed-store personnel detail:
  - returned rows: `7`
  - detail rows: `7`
  - rows with metrics: `7`
  - demo-name rows: `0`
- Available periods: `1`

Interpretation:

- Ranking V1 is reading the materialized March 2026 KPI actuals.
- Demo seed rows are excluded from the visible ranking result.
- Privileged role mode returns full/detail rows with KPI metrics.
- Pagination cap is active: personnel total is `727`, request limit is `500`, returned personnel rows are `500`.

## Bursa Marka Park Search Smoke

Endpoint:

- `GET /reports/rankings?periodType=monthly&periodStart=2026-03-01&search=Bursa%20Marka%20Park&limit=50&offset=0`

Result:

- HTTP status: `200`
- Found: `true`
- Store name: `Bursa Marka Park Avm`
- Rank: `77`
- Population: `154`
- Visibility: `detail`
- Score value: `86.01`

Metric evidence:

- `TARGET_ACHIEVEMENT`
  - actual: `8788383.15`
  - contribution: `35.1535`
- `CR`
  - actual: `0.0889`
  - benchmark: `0.11261444133487492`
  - contribution: `15.7884`
- `ATV`
  - actual: `4454.325`
  - benchmark: `3573.075705932122`
  - contribution: `18`
- `UPT`
  - actual: `2.9757`
  - benchmark: `2.6151967139289565`
  - contribution: `17.0677`
- `BM_CHECKLIST`
  - actual: `null`
  - contribution: `null`
- `VM_CHECKLIST`
  - actual: `null`
  - contribution: `null`

Interpretation:

- Bursa Marka Park is searchable in Ranking V1.
- The live ranking result matches the March 2026 materialized KPI sanity evidence.

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

- `outputs/master-data-prep/staging-ranking-v1-smoke-evidence.json`

Runner result:

- `status=ok`
- no stderr output

## Remaining Limits

- This smoke proves the current authenticated staging user's privileged Ranking V1 mode.
- It does not prove live low-role-only masking because this user also has `SUPER_ADMIN`.
- Low-role-only live smoke should be run with a Clerk user that only has `STORE_MANAGER` or `STORE_PERSONNEL`.
- Role-based masking is still covered by local backend tests, but pilot evidence should include the live low-role-only check before final approval.
