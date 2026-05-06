# Master Data And Power BI Acceptance

Date: 6 Mayis 2026

Scope: Pilot acceptance summary for the temporary master-data baseline and March 2026 monthly Power BI KPI import already promoted/materialized in staging.

Environment:

- Frontend: `https://staging.hr-axis.com`
- API base: `https://api-staging.hr-axis.com/api`
- DB: Supabase staging Postgres
- Accepted evidence source: `docs/evidence/pilot-readiness/2026-05-05-staging-master-data-kpi-materialization.md`

Sensitive material policy:

- Raw bearer tokens, Clerk cookies, passwords, provider subjects, full JWTs, and database secrets are not recorded.
- This document records aggregate counts, batch ids, source ids, and sanitized sample KPI values only.

## Acceptance Decision

Accepted for controlled pilot: yes.

Decision boundary:

- This is enough for March 2026 historical pilot validation.
- This is not the final future HR/master-data source of truth.
- Future monthly operation still needs the cleaner official source path, or a JSON/API ingestion contract, before broad rollout.

## Master Data Baseline

Baseline source:

- Local generated bundle outputs under `outputs/master-data-prep/`
- Store and personnel bootstrap promotion in staging
- External id maps used to connect Power BI names/codes to app stores and employees

Generated bundle summary:

- Store payload rows: `155`
- Region rows: `8`
- Personnel payload rows: `805`
- Skipped store rows: `0`
- Skipped personnel rows:
  - `include_not_yes`: `5`
  - `not_ready`: `2`
  - `duplicate_employee_code`: `2`
- Employee code source counts:
  - dealer FM codes: `542`
  - raw non-FM codes: `83`
  - provisional Power BI name codes: `52`
  - corporate codes: `128`
- Provisional hire-date rows: `10`
- External id map bundle rows:
  - store: `155`
  - employee: `805`

Staging promotion evidence:

- Store bootstrap:
  - batch count: `1`
  - status: `promoted`
  - rows: `155`
  - promoted rows: `155`
  - latest promoted at: `2026-05-04T11:30:59.200684Z`
- Personnel bootstrap:
  - batch count: `9`
  - status: `promoted`
  - rows: `805`
  - promoted rows: `805`
  - latest promoted at: `2026-05-04T11:52:42.761737Z`

Live staging totals after promotion:

- Total stores: `160`
- Active stores: `160`
- Total employees: `997`
- Active employees: `812`
- Active assignments: `812`
- Active store external id maps: `155`
- Active employee external id maps: `1016`

Known cleanup left:

- Some personnel rows are intentionally skipped until source data is cleaner.
- `52` personnel codes remain provisional Power BI name-based codes.
- `10` hire-date rows are provisional.
- Store total includes pre-existing/demo seed stores, but March KPI actuals are not attached to demo stores.

## Power BI Upload

Accepted monthly snapshot:

- Period type: monthly
- Period: `2026-03-01` to `2026-03-31`
- Import batch id: `e3fd6958-04d2-45ac-a2ae-f1fbe401612d`
- Status: `completed`
- Source batch id: `power-bi-export:power-bi-kpi:monthly:2026-03-01:2026-03-31:2bbfe93d0afc`
- Source payload hash: `2bbfe93d0afc8942d955e7342b2a073a19b7476c49d97cefd9ff9a6579283a55`
- Record count: `4864`
- Error count: `0`
- Started at: `2026-05-04T12:02:45.006150Z`
- Finished at: `2026-05-04T12:19:15.867262Z`

Raw staging rows:

- `stg.kpi_raw` rows for the batch: `4864`
- Processed raw rows: `4864`
- Unprocessed raw rows: `0`

Canonical KPI actual rows:

- `ops.kpi_actual` rows for the source batch: `4864`
- Store scope:
  - rows: `1230`
  - distinct stores: `154`
- Employee scope:
  - rows: `3634`
  - distinct stores: `154`
  - distinct employees: `727`

Ignored/review rows:

- Import error count: `0`
- Unprocessed raw rows: `0`
- Separate row-level review counts were not captured in this acceptance document; source materialization evidence shows all raw rows processed into KPI actuals.

Demo exclusion:

- Demo store rows still present in `ops.store`: `2`
- March 2026 KPI actual rows attached to demo stores: `0`

## Bursa Marka Park Sanity Sample

Sample store:

- Store code: `PB_BURSA_MARKA_PARK_AVM`
- Store name: Bursa Marka Park Avm
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

- Bursa Marka Park is present in the accepted master-data baseline.
- March 2026 KPI actuals materialized for the store and match the user-visible ranking/store KPI sanity path.

## User-Facing Data Check

Previously observed staging surfaces:

- `/store/me` opens with own performance data for the pilot store/personnel flow.
- `/store/rankings` opens with live ranking data and no demo rows.
- `/store/kpis` opens for the store manager pilot flow.
- `/admin/integrations` opens for the super admin pilot flow.

Interpretation:

- The accepted baseline is sufficient for controlled pilot validation of March 2026 historical KPI behavior.
- The data path remains Excel/Power BI export based for pilot; JSON/API ingestion remains future work.

## Blockers

- None found for controlled pilot acceptance.

## Local Verification

Fresh local verification on this branch:

- `npm.cmd run check:pilot-stabilization`: passed.
  - Node pilot contract tests: `13/13` passed.
  - Admin web build: passed.
  - Admin web pilot smoke: `7/7` Playwright tests passed.
- `git diff --check`: passed, with Windows CRLF conversion warnings only.

## Remaining Limits

- Future month upload with final master data has not been proven.
- The current baseline contains provisional and skipped personnel cleanup items.
- Checklist KPI codes are present, but March 2026 sample checklist contributions are still missing actual checklist values.
- This evidence should not be used as approval for broad production rollout.

## Outcome

Status: Go for controlled March 2026 pilot data acceptance.

The temporary master-data baseline and March 2026 Power BI import are accepted for pilot validation. They are stable enough to keep testing store KPI, rankings, approvals, and admin import flows while the final master-data and future JSON/API ingestion path remain separate follow-up work.
