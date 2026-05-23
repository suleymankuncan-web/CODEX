# Supabase Recovery Posture Decision V1 - 2026-05-23

## Scope

This note records the current Supabase recovery posture after the staging
application-schema logical restore drill succeeded.

It is a recovery decision and handoff note. It does not run a new restore,
change provider configuration, create a Supabase project, touch production
data, or record database URLs, passwords, access tokens, provider IDs, private
payloads, or private project details.

No product code, API response shape, auth/permission semantics, database
schema, provider code, CSS, or user-facing workflow behavior was changed.

## Sokrates Decision

Claim:

- The existing staging logical restore drill is enough for controlled pilot,
  but not enough for broad-production recovery readiness.

Assumptions:

- The project is not going to the field yet.
- The current database source is Supabase Postgres.
- The latest restore proof restored app-owned schemas from staging into a
  disposable local PostgreSQL target and matched key counts.
- No explicitly disposable managed Supabase restore target is currently
  approved.
- Broad production needs a named RPO/RTO posture before the database recovery
  gate can move out of No-Go.

Evidence:

- Existing proof:
  `docs/evidence/readiness/2026-05-22-supabase-staging-logical-restore-drill.md`.
- Existing runbook:
  `docs/plans/backup-restore-drill-runbook-v1.md`.
- The restore proof matched app schema/table counts for `audit`, `ops`, `rpt`,
  and `stg`, matched migration tracking rows, and matched the `ops.store`
  smoke count.
- The proof explicitly excluded Supabase-managed `vault` extension/schema from
  the local restore list and did not claim Storage/Auth/Realtime/Edge settings
  restore.
- Supabase docs reviewed on 2026-05-23:
  - `https://supabase.com/docs/guides/platform/backups`
  - `https://supabase.com/docs/guides/platform/clone-project`

Counterargument:

- A logical local restore is not the same as a managed Supabase restore to a
  new project.
- It does not prove point-in-time recovery.
- It does not restore Storage objects, Edge Functions, auth settings/API keys,
  Realtime settings, database extensions/settings, or read replicas.
- If the acceptable data-loss window is shorter than the latest manual logical
  dump or daily managed backup, PITR must be explicitly chosen and paid for.

Risk:

- Controlled pilot using the logical restore proof: LOW/MEDIUM.
- Broad production without RPO/RTO acceptance: HIGH.
- Running a managed restore without an explicitly disposable target: HIGH and
  blocked.
- Production or staging-source destructive restore rehearsal: HIGH and blocked.

Door:

- Accepting the local logical restore as controlled-pilot evidence is a
  two-way-door. It can be strengthened later by running a managed restore drill.
- Running a restore against production or the staging source is near one-way and
  not approved.

Stop rule used:

- Do not run restore against production.
- Do not run restore against the staging source database.
- Do not run managed restore unless the target is explicitly disposable and
  approved.
- Do not record raw connection strings, database URLs, passwords, provider
  tokens, project IDs, bearer tokens, cookies, private keys, or private payloads.

## Decision

Controlled staging/internal pilot:

- Decision: `controlled-pilot-logical-restore-accepted`.
- The existing local logical restore proof is accepted as the current recovery
  evidence for controlled pilot.
- Recovery assumption: app-owned database schemas can be restored from a fresh
  logical dump into a disposable PostgreSQL target and verified by count checks.
- RPO assumption: manual logical dump freshness only; no shorter data-loss
  window is promised.
- RTO assumption: operator-run restore session only; no production SLA is
  promised.

Broad production:

- Decision: broad production remains No-Go until one of these is explicitly
  accepted:
  - managed Supabase restore-to-new-project drill against an approved
    disposable target, or
  - PITR plan with paid-plan/add-on acceptance and a named RPO/RTO, or
  - written owner acceptance that the logical application-schema restore is the
    V1 recovery posture and its RPO/RTO limits are acceptable.

Recommended default:

- For controlled pilot: keep the current logical restore proof.
- Before broad production: approve a disposable managed Supabase restore target
  or approve PITR only if the business requires a shorter recovery point than
  daily/manual backups.
- Keep Storage/Auth/Realtime/Edge settings restoration as separate checklists
  because database restore alone does not prove those surfaces.

## Broad-Production Exit Criteria

Before marking Supabase recovery broad-production ready:

1. Owner chooses the recovery mode:
   - daily backup / managed restore,
   - PITR,
   - manual logical dump,
   - or explicit risk acceptance.
2. RPO and RTO are written in human terms.
3. If managed restore is selected, the target is explicitly disposable.
4. Restore proof records only sanitized counts and timings.
5. The restore target is not production and not the staging source.
6. Storage object restore, Auth settings, API keys, Edge Functions, Realtime,
   extensions/settings, and external provider configs are either tested or
   separately accepted as manual reconfiguration.
7. The final production readiness decision references this posture.

## Verification Ladder

Local:

- `git diff --check`
- `npm.cmd run test:scripts`

Existing restore proof:

- Use
  `docs/evidence/readiness/2026-05-22-supabase-staging-logical-restore-drill.md`
  as the current controlled-pilot evidence.

Managed restore, only if approved later:

- Use `docs/plans/backup-restore-drill-runbook-v1.md`.
- Require an explicitly disposable target.
- Record sanitized source/target labels, count checks, duration, and decision
  only.

## Final Posture

- Controlled pilot: Conditional Go with accepted logical restore proof.
- Broad production: No-Go until managed/PITR/RPO/RTO posture is explicitly
  accepted or tested against an approved disposable target.
