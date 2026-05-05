# Staging Master Data And KPI Materialization Evidence

Date: 5 Mayis 2026

Scope: Staging DB read-only evidence for the accepted temporary master-data baseline and March 2026 monthly Power BI KPI import.

## Sources Used

- Local generated bundle outputs under `outputs/master-data-prep/`.
- Supabase read-only SQL against project `hr-axis-staging` (`lmotuwlzvvarihfsxcyb`).
- No raw Clerk token, cookie, password, provider subject, or JWT was recorded in this evidence.

## Accepted Master Data Bundle

Generated bundle summary:

- Store payload rows: 155
- Region rows: 8
- Personnel payload rows: 805
- Skipped store rows: 0
- Skipped personnel rows:
  - `include_not_yes`: 5
  - `not_ready`: 2
  - `duplicate_employee_code`: 2
- Employee code source counts:
  - dealer FM codes: 542
  - raw non-FM codes: 83
  - provisional Power BI name codes: 52
  - corporate codes: 128
- Provisional hire-date rows: 10
- External id map bundle rows:
  - store: 155
  - employee: 805

Interpretation:

- This is the current accepted staging baseline for testing.
- It is not treated as the final future HR/master-data source of truth.

## Staging Promotion Evidence

Supabase batch/read model evidence:

- Store bootstrap:
  - batch count: 1
  - status: `promoted`
  - rows: 155
  - promoted rows: 155
  - latest promoted at: `2026-05-04T11:30:59.200684Z`
- Personnel bootstrap:
  - batch count: 9
  - status: `promoted`
  - rows: 805
  - promoted rows: 805
  - latest promoted at: `2026-05-04T11:52:42.761737Z`
- Staging live table totals after promotion:
  - total stores: 160
  - active stores: 160
  - total employees: 997
  - active employees: 812
  - active assignments: 812
  - active store external id maps: 155
  - active employee external id maps: 1016

Note:

- Store total includes pre-existing/demo seed stores.
- March KPI rows are not attached to demo stores in the materialized KPI evidence below.

## Power BI Monthly KPI Import Evidence

Latest staging import batch:

- Import batch id: `e3fd6958-04d2-45ac-a2ae-f1fbe401612d`
- Status: `completed`
- Period: `2026-03-01` to `2026-03-31`
- Source batch id: `power-bi-export:power-bi-kpi:monthly:2026-03-01:2026-03-31:2bbfe93d0afc`
- Source payload hash: `2bbfe93d0afc8942d955e7342b2a073a19b7476c49d97cefd9ff9a6579283a55`
- Record count: 4864
- Error count: 0
- Started at: `2026-05-04T12:02:45.006150Z`
- Finished at: `2026-05-04T12:19:15.867262Z`

Raw staging rows:

- `stg.kpi_raw` rows for the batch: 4864
- Processed raw rows: 4864
- Unprocessed raw rows: 0

Materialized KPI rows:

- `ops.kpi_actual` rows for the source batch: 4864
- Store scope:
  - rows: 1230
  - distinct stores: 154
- Employee scope:
  - rows: 3634
  - distinct stores: 154
  - distinct employees: 727

Demo exclusion check:

- Demo store rows still present in `ops.store`: 2
- March 2026 KPI actual rows attached to demo stores: 0

## Sample Store Sanity

Sample store found in staging:

- Store code: `PB_BURSA_MARKA_PARK_AVM`
- Store name: `Bursa Marka Park Avm`
- Period: March 2026
- Source batch id: `power-bi-export:power-bi-kpi:monthly:2026-03-01:2026-03-31:2bbfe93d0afc`

Materialized store KPI values:

- `NET_SALES`: `8788383.15`
- `TARGET_ACHIEVEMENT`: `8788383.15`
- `TICKET_COUNT`: `1973`
- `ITEM_COUNT`: `5871`
- `FF`: `22200`
- `CR`: `0.0889`
- `UPT`: `2.9757`
- `ATV`: `4454.325`

Interpretation:

- The March 2026 Power BI monthly snapshot is present in live KPI actuals.
- The store sample matches the user-visible staging sanity path where Bursa Marka Park appeared in the app.

## Local Verification

Fresh targeted checks run after syncing local workspace to `origin/main`:

- Backend Ranking V1 policy/service tests: `8/8` passed.
- Backend master-data bootstrap + Power BI upload service tests: `27/27` passed.
- Admin token smoke script tests: `10/10` passed.

## Remaining Limits

- This evidence is DB/read-model evidence, not a fresh authenticated browser smoke from this turn.
- Store/personnel role-specific Ranking V1 API masking should still be smoke-tested with a live Clerk token before pilot approval.
- Supabase MCP flagged many internal staging schemas/tables with RLS disabled. The app uses the backend API as the access boundary, but this remains a security follow-up before any direct Supabase client exposure.
