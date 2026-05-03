# Power BI Upload Staging Deploy Evidence - 2026-05-03

## Scope

Deploy the Power BI upload unblock to staging and apply the staging DB source seed needed by `/admin/integrations`.

## Frontend Deploy

- Vercel project: `hr-axis-staging`
- Production deployment id: `dpl_BppD5H6QP3uAdSEoDXde39tjktp3`
- Production deployment URL: `https://hr-axis-staging-bwurkqr26-suleymankuncan-webs-projects.vercel.app`
- Production alias: `https://staging.hr-axis.com`
- Build status: `READY`

Verification:

- `https://staging.hr-axis.com/admin/integrations` returned `200`.
- Deployed `IntegrationDashboardPage` asset contains:
  - `Power BI upload hazır değil`
  - `Aktif Power BI KPI source yok`

## Staging DB Migration

- Supabase project: `hr-axis-staging`
- Applied migration name: `power_bi_kpi_source_seed`
- App migration tracking row:
  - `migration_name=045_power_bi_kpi_source_seed.sql`
  - `status=succeeded`
  - `migration_checksum=35cde89bc694daeb47f28b097ac759568bab5f85d861b23b62c8fae1579d79d2`
- Verified source row:
  - `source_code=power-bi-kpi`
  - `entity_type=kpi`
  - `source_system=power_bi`
  - `state_model=closed_period`
  - `is_active=true`

## Backend Health

- `https://api-staging.hr-axis.com/api/health` returned `ok`.
- Database health returned `ok`.
- Queue backend remained `in-memory`; Redis check remained `skipped`.

## Limits

- Backend Render service was not redeployed in this step. The runtime upload service code was already present; this unblock required frontend deploy plus DB source seed.
- Authenticated Clerk upload smoke was not run from this workspace because no reusable Clerk bearer token or staging login automation credential is available here.
- No KPI import batch was created in this evidence item.
- No batch id, source batch id, unmapped counts, reconciliation summary, or materialization evidence was produced yet.

## Next Step

Use an authenticated staging browser session to upload the March 2026 monthly files and record sanitized batch evidence from the resulting import response/detail page.
