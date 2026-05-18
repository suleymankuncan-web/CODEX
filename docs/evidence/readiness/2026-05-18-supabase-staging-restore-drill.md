# Supabase Staging Restore Drill Evidence - 2026-05-18

## Decision

No-Go for broad production backup/restore readiness.

Controlled pilot remains acceptable only under the existing Conditional Go boundary because a local disposable PostgreSQL backup/restore drill exists, but a Supabase staging restore drill has not yet been executed against a disposable target.

## Boundary

Environment under review: staging.

Source platform: Supabase Postgres.

Source project label: `hr-axis-staging`.

Production database touched: no.

Restore command executed: no.

Destructive command executed: no.

Raw database URLs, passwords, access tokens, customer data, and personnel samples captured: no.

## Supabase Capability Review

Reviewed official Supabase backup documentation on 2026-05-18.

Current provider facts that affect this project:

- Daily managed backups exist, with retention depending on plan.
- PITR is a separate add-on for eligible paid plans and should be used if the accepted RPO is shorter than daily backups.
- Newer physical backups and PITR do not provide a downloadable legacy logical `backup.gz`; logical rehearsal artifacts should use `supabase db dump` or `pg_dump`.
- Restore to the same Supabase project creates downtime and is not approved as a rehearsal path for production.
- Restore to a new Supabase project can prove managed restore behavior, but it requires paid-plan/disposable-project approval and a post-restore review because Storage objects, Edge Functions, auth settings/API keys, Realtime settings, and some external-operation extensions are not automatically safe to treat as production-equivalent.

## Current Evidence

Existing local evidence:

- `docs/plans/backup-restore-drill-local-evidence-2026-04-30.md`
- Local disposable source database was migrated from empty state.
- Local backup file was produced.
- Local restore into a separate disposable PostgreSQL target succeeded.
- Source and restore schema/table counts matched.
- Migration tracking matched.
- No production database was touched.

Missing Supabase staging evidence:

- Supabase plan tier and backup retention have not been recorded in a sanitized evidence file.
- PITR availability has not been confirmed.
- A disposable Supabase restore target or disposable PostgreSQL restore target has not been approved.
- A Supabase staging backup has not been restored into a disposable target.
- Schema/table counts from a restored Supabase target have not been captured.
- Migration tracking count from a restored Supabase target has not been captured.
- A post-restore smoke query has not been captured.

## RPO/RTO

Backup capability: unknown for the active staging project until operator confirms plan/backup settings.

Latest backup or recovery point UTC: unknown.

RPO assumption: unknown; broad production cannot rely on unknown backup cadence.

RTO assumption: unknown; broad production cannot rely on unknown restore duration.

Required broad-production minimum:

- RPO is explicitly accepted by the owner.
- RTO is explicitly accepted by the owner.
- Last available backup or recovery point is known.
- Restore proof exists from a disposable Supabase-like target.

## Required Operator Drill

Approved paths:

1. Logical dump drill:
   - Source: Supabase staging Postgres.
   - Target: disposable local or staging PostgreSQL database.
   - Commands: `pg_dump`/`pg_restore` or `supabase db dump` followed by `psql`.

2. Managed Supabase restore drill:
   - Source: Supabase staging project.
   - Target: new disposable Supabase project.
   - Dashboard action: Restore to a New Project.

For either path, update this evidence with:

- operator role,
- backup capability,
- backup/recovery point timestamp,
- restore target label,
- restore duration,
- schema/table counts,
- migration tracking count,
- smoke query result,
- confirmation no production DB was touched,
- final Go / Conditional Go / No-Go decision.

## Go / Conditional Go / No-Go

Go:

- Supabase staging restore completes into a disposable target.
- Restored schema/table counts and migration tracking are captured.
- Smoke query passes.
- RPO/RTO are accepted.
- Evidence is sanitized.

Conditional Go:

- Restore completes and no production DB is touched, but one non-blocking evidence field is incomplete with owner/date.

No-Go:

- No disposable restore target exists.
- Backup capability or latest recovery point is unknown.
- Restore has not been tested.
- Evidence contains secrets or personal data.
- Production DB would be touched by the drill.

Current decision: No-Go for broad production.
