# Controlled Pilot Recovery Posture V1

Status: active
Shelf: readiness
Scope: controlled staging/internal pilot only
Broad production: No-Go

## Reader And Action

Reader:

- an operator, future agent, engineer, or pilot moderator deciding whether the
  current Supabase/database recovery posture is enough for the controlled pilot.

After reading, they should know what recovery evidence is accepted for pilot,
which recovery promises are not being made, and when to stop before running any
restore or paid provider work.

## Purpose

Close the controlled-pilot recovery posture without Supabase paid PITR or a
new managed restore drill.

The project already proved that app-owned staging schemas can be dumped and
restored into a disposable local PostgreSQL target. That is enough for the
controlled pilot, but it is not broad-production recovery readiness.

## Non-Goals

- Do not run restore commands against production.
- Do not run restore commands against the staging source database.
- Do not run managed Supabase restore without an explicitly disposable target.
- Do not buy or require Supabase PITR, a paid plan, or a paid add-on.
- Do not change provider configuration, DB schema, migrations, API, auth,
  queue, import, snapshot, scoring, workflow, or UI behavior.
- Do not record database URLs, passwords, Supabase tokens, provider IDs,
  private project details, row payloads, or personal data samples.
- Do not claim broad-production RPO/RTO, managed restore, Storage/Auth/Realtime
  restore, Edge Function restore, or PITR readiness.

## Current Evidence Baseline

Use these sources:

- `docs/evidence/readiness/2026-05-22-supabase-staging-logical-restore-drill.md`
- `docs/evidence/readiness/2026-05-23-supabase-recovery-posture-v1.md`
- `docs/plans/backup-restore-drill-runbook-v1.md`
- `docs/plans/migration-fresh-db-smoke-v1.md`
- `docs/evidence/readiness/2026-06-02-free-tier-controlled-pilot-ops-pr1-inventory.md`

## Controlled-Pilot Accepted Recovery Posture

| Recovery item | Pilot status | What it proves | What it does not prove |
| --- | --- | --- | --- |
| Staging app-schema logical dump | accepted | App-owned `audit`, `ops`, `rpt`, and `stg` schemas can be dumped from staging. | Managed Supabase backup, PITR, provider restore, or production RPO. |
| Disposable local PostgreSQL restore | accepted | The logical dump can restore into a separate disposable target with matching schema/table, migration, and store smoke counts. | Restore-to-new Supabase project, Storage/Auth/Realtime/Edge settings, or production RTO. |
| Manual operator-run recovery | accepted for pilot only | A trained operator can run a bounded recovery drill using the runbook. | Automated recovery, SLA, or guaranteed recovery time. |
| Fresh DB migration smoke | supporting local proof | Current migrations can build a disposable local DB when explicitly run. | It is not a backup restore and not a production migration runner. |

## Current Pilot Assumptions

RPO:

- Manual logical dump freshness only.
- No promise is made that the recovery point is newer than the latest operator
  dump or provider-managed backup.
- If the pilot needs a shorter data-loss window, stop and request an owner
  decision before continuing.

RTO:

- Operator-run restore session only.
- No production SLA is promised.
- If a timed restore commitment is required, stop and request a managed
  restore/PITR decision.

Data scope:

- App-owned database schemas only.
- Storage objects, Auth settings/API keys, Realtime settings, Edge Functions,
  provider integrations, and Supabase-managed extensions/settings are not
  proven by the current logical restore evidence.

## Operator Flow

### 1. Decide Whether A New Restore Is Needed

For this controlled pilot, use the existing 2026-05-22 logical restore proof
unless one of these triggers occurs:

- DB schema or migration files changed and a release owner asks for fresh
  migration evidence,
- staging data shape materially changes and a recovery proof must be refreshed,
- pilot scope expands into user-facing recovery commitments,
- broad production is requested,
- a real incident needs recovery action.

### 2. If No New Restore Is Needed

Record:

- existing restore evidence link,
- current decision: `controlled-pilot-logical-restore-accepted`,
- broad production remains `No-Go`,
- no restore command was run,
- no secrets were requested or recorded.

### 3. If A New Local Proof Is Needed

Use only disposable local targets and the existing runbook:

- `docs/plans/backup-restore-drill-runbook-v1.md`
- `docs/plans/migration-fresh-db-smoke-v1.md`

Stop unless the restore target is explicitly disposable.

### 4. If Managed Supabase Restore Or PITR Is Needed

Stop and require owner input. This is outside controlled-pilot free-tier
posture.

Required before proceeding:

- approved disposable Supabase restore target,
- accepted cost/plan/PITR decision if applicable,
- written RPO/RTO expectation,
- sanitized evidence plan,
- confirmation that production and the staging source will not be destructive
  rehearsal targets.

## Go / Pause Decision

Continue controlled pilot when:

- the existing logical restore proof remains valid for current app-owned
  schema assumptions,
- no shorter RPO/RTO is promised,
- no managed provider restore is required,
- no production recovery claim is being made.

Pause controlled pilot recovery posture when:

- a real incident requires restore action,
- a new restore target is not explicitly disposable,
- the pilot claim requires managed Supabase restore/PITR,
- Storage/Auth/Realtime/Edge restore is required for the claim,
- source or target credentials would need to be recorded in docs or chat.

## Evidence Template

```text
Date/time:
Environment:
Recovery posture:
Evidence source:
Restore command run: yes/no
Restore target:
Target disposable: yes/no/not applicable
RPO assumption:
RTO assumption:
Excluded surfaces:
Decision:
Next operator action:
Secrets recorded: none
Behavior changed: no
Broad production claimed: no
```

## Decision

Controlled pilot:

- Go for current app-owned schema logical restore evidence.
- Manual logical dump freshness and operator-run restore are accepted limits.
- No new paid Supabase capability is required for controlled pilot.

Broad production:

- No-Go until managed restore-to-new-project, PITR, RPO/RTO posture, or written
  owner risk acceptance is explicitly accepted.

## Rollback

This policy is docs-only. Rollback is a docs revert.

No restore rollback, data repair, provider rollback, migration rollback, secret
rotation, or runtime rollback is required.

## Verification

For changes to this policy:

```powershell
git diff --check
npm.cmd run test:scripts
```

Optional only with an approved disposable local target:

```powershell
npm.cmd run smoke:migration:fresh-db
```

Do not run restore commands unless the target is explicitly disposable and the
operator has approved the target for that run.
