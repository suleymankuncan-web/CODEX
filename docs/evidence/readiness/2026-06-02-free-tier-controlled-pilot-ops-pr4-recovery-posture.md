# Free-Tier Controlled Pilot Ops PR-4 Recovery Posture - 2026-06-02

## Scope

This note records PR-4 of
`docs/plans/free-tier-controlled-pilot-ops-posture-v1.md`.

The PR adds a controlled-pilot recovery posture policy and links it from the
operating registries. It accepts the existing application-schema logical
restore proof for controlled pilot while keeping managed Supabase restore,
PITR, and production RPO/RTO parked.

No product code, API response shape, auth/permission semantics, database
schema, migrations, provider tier, provider configuration, queue behavior,
import lifecycle, snapshot interpretation, scoring, approval workflow, or UI
behavior changed.

No restore command was run. No secrets, provider URLs, raw tokens, database
URLs, Redis URLs, Supabase tokens, project IDs, row payloads, or private
payloads are recorded.

## Decision

Controlled pilot:

- Existing app-owned schema logical restore proof is accepted.
- Manual logical dump freshness and operator-run restore are accepted as
  controlled-pilot limits.
- No paid Supabase PITR or managed restore is required for controlled pilot.

Broad production:

- Remains `No-Go`.
- Managed restore-to-new-project, PITR, RPO/RTO posture, Storage/Auth/Realtime/
  Edge restore expectations, or written owner risk acceptance remain parked
  production work.

## Files Changed

- `docs/plans/controlled-pilot-recovery-posture-v1.md`
- `docs/evidence/readiness/2026-06-02-free-tier-controlled-pilot-ops-pr4-recovery-posture.md`
- `docs/plans/free-tier-controlled-pilot-ops-posture-v1.md`
- `docs/plans/runbook-registry-v1.md`
- `docs/plans/decision-registry-v1.md`

## Risk Reduced

- The controlled pilot has one explicit recovery posture answer without asking
  for paid Supabase features.
- Future agents are prevented from treating logical local restore proof as
  broad-production managed recovery.
- Restore commands remain blocked unless the target is explicitly disposable.

## Rollback

Revert the docs-only changes. No provider reconfiguration, restore rollback,
data repair, migration rollback, secret rotation, or runtime rollback is
required.

## Verification

Run locally for this PR:

```powershell
git diff --check
npm.cmd run test:scripts
```

`npm.cmd run smoke:migration:fresh-db` was not run because this PR does not
change DB schema or migrations and no new approved disposable local target was
required for the docs-only posture update.

## Stop Rules Preserved

- Do not buy or require paid infrastructure.
- Do not run production restore.
- Do not run restore against the staging source.
- Do not run managed Supabase restore without an explicitly disposable target.
- Do not request or record secrets.
- Do not change API, DB, auth, queue, import, scoring, snapshot, workflow, or
  UI behavior.
- Do not claim broad-production readiness.
