# Supabase Staging Logical Restore Drill - 2026-05-22

## Scope

This note records a real logical backup and restore drill from Supabase staging
Postgres into a disposable local PostgreSQL target.

It proves that the application-owned schemas can be dumped from staging,
restored into a separate disposable PostgreSQL target, and verified with
matching schema/table counts and smoke counts.

It does not prove Supabase managed restore-to-new-project, PITR, Storage object
restore, Auth provider settings restore, Edge Function restore, Realtime
settings restore, or a production RPO/RTO commitment.

No business logic, API response shape, auth/permission semantics, database
schema, provider configuration, CSS, or user-facing workflow behavior was
changed in the repository for this evidence pass.

## Sokrates Decision

Claim:

- The project can restore the staging application database schemas from a
  logical dump into a disposable PostgreSQL target.

Assumptions:

- `hr-axis-staging` is the active Supabase staging source.
- The source connection string was supplied locally through an ignored
  `outputs/restore-drill/source.env` file and was removed after the drill.
- The restore target was the disposable local Docker container
  `store_ops_restore_drill_pg`.
- `vault` is a Supabase-managed extension/schema and is not required for the
  application-owned `ops`, `stg`, `rpt`, and `audit` restore proof.

Evidence:

- PostgreSQL 17 client tools were used because the Supabase source reported
  server version `17.6`.
- A custom-format logical dump was created successfully.
- The backup file existed and was greater than zero bytes.
- A first full restore attempt identified the expected local-target gap:
  `supabase_vault` is not available in the generic PostgreSQL image.
- A clean restore using a filtered restore list excluding `supabase_vault` and
  `vault` entries exited `0`.
- Source and restore application schema/table counts matched.
- Source and restore migration tracking row counts matched.
- Source and restore store smoke counts matched.

Counterargument:

- This is not the same as a managed Supabase restore into a new Supabase
  project. A new-project restore would better prove Supabase-managed backup
  behavior and provider-specific settings, but it requires plan/cost approval
  and an explicitly disposable Supabase project.

Risk:

- Evidence recording: LOW.
- Treating this local logical restore as full production recovery readiness:
  HIGH.

Door:

- This evidence document is a two-way door.
- The local restore target was disposable and was removed after the proof.
- A real managed restore or production restore is near one-way and still needs
  explicit target approval.

Stop rule used:

- Stop before recording raw database URLs, passwords, tokens, personnel data,
  customer data, or row samples.
- Stop before running destructive commands against any non-disposable target.
- Stop before claiming Supabase-managed/PITR restore readiness from a logical
  local restore drill.

## Safety Incident Note

During the first local setup attempt, the source env file was malformed and the
raw connection string reached local tool output. The malformed file was removed,
the operator rotated the database password, and the drill was rerun with the
correct `SOURCE_DATABASE_URL` env-file variable format.

No raw connection string, password, token, or private payload is recorded in
this repository.

## Drill Environment

```text
Date: 2026-05-22
Operator: project owner + Codex
Environment: staging source, local disposable restore target
Source platform: Supabase Postgres
Source project label: hr-axis-staging
Source server version: PostgreSQL 17.6
Restore target type: local Docker PostgreSQL
Restore target label: store_ops_restore_drill_pg
Restore target version: PostgreSQL 17.10
Restore target disposable: yes
Production database touched: no
Source database URL recorded: no
Restore database URL recorded: no
Personal data samples captured: no
Local source env file removed after proof: yes
Local backup artifact removed after proof: yes
Disposable restore container removed after proof: yes
```

## Backup Proof

Command shape:

```powershell
docker run --rm --env-file outputs/restore-drill/source.env `
  -v outputs/restore-drill:/restore `
  postgres:17 bash -lc `
  'pg_dump --format=custom --no-owner --no-privileges --file /restore/staging-supabase-2026-05-22.dump --dbname "$SOURCE_DATABASE_URL"'
```

Result:

- Initial `postgres:16` client attempt: failed before dump because the source
  server was PostgreSQL `17.6`.
- PostgreSQL 17 client attempt: success.
- Backup file: `outputs/restore-drill/staging-supabase-2026-05-22.dump`.
- Backup file size: `1867369` bytes.
- Backup artifact was removed after proof.

## Restore Proof

Restore target:

```text
Docker image: postgres:17
Container label: store_ops_restore_drill_pg
Database label: store_ops_restore_drill
```

First restore attempt:

- Command shape: `pg_restore --username postgres --no-owner --no-privileges`.
- Result: restore reached the Supabase-managed `supabase_vault` extension and
  returned non-zero because the generic PostgreSQL image does not include that
  extension.
- App-owned schemas were still inspectable after the partial restore, but this
  was not treated as the clean proof.

Clean application-schema restore:

- Restore list was filtered to exclude `supabase_vault`, `SCHEMA - vault`, and
  `TABLE DATA vault` entries.
- Command shape:

```powershell
pg_restore --username postgres --no-owner --no-privileges `
  --use-list=/tmp/restore-no-vault.list `
  --dbname store_ops_restore_drill `
  /tmp/staging-supabase-2026-05-22.dump
```

- Result: exit code `0`.

## Source And Restore Counts

Source application schema/table counts:

```text
audit:3
ops:39
rpt:10
stg:12
```

Restore application schema/table counts:

```text
audit:3
ops:39
rpt:10
stg:12
```

Source migration tracking rows:

```text
48
```

Restore migration tracking rows:

```text
48
```

Source smoke query:

```text
select count(*) from ops.store;
160
```

Restore smoke query:

```text
select count(*) from ops.store;
160
```

## RPO/RTO

Backup capability:

- Manual logical dump: proven for staging application schemas.
- Supabase managed daily backup: not verified in this drill.
- PITR: not verified in this drill.

RPO assumption:

- Manual logical dump RPO is only as fresh as the operator-run dump time.
- Production RPO remains unaccepted until the owner chooses daily backup, PITR,
  or another provider-backed recovery target.

RTO assumption:

- Local application-schema restore completed during the operator session.
- Production RTO remains unaccepted until a managed Supabase restore target or
  production-equivalent restore procedure is approved and timed.

Latest available backup or recovery point:

- Manual logical dump created during this drill.
- Managed backup/PITR recovery point: unknown.

## Current Readiness Decision

Controlled staging/internal pilot:

- Conditional Go, with Redis/BullMQ staging wiring proven, one Render
  Notifications Slack delivery path proven, and Supabase staging application
  schemas logically restorable into a disposable local PostgreSQL target.

Broad production:

- Still No-Go.

Remaining blockers before broad production:

- Production-grade Redis/Key Value tier decision and broad-production profile
  proof.
- Production alert policy decision and production destination proof if the team
  wants broader incident coverage than the staging Slack proof.
- Supabase managed backup/PITR policy, RPO/RTO acceptance, and either a
  Supabase restore-to-new-project drill or an explicit owner decision that this
  logical application-schema restore is the accepted V1 recovery posture.

## Safety

- No raw database URL, password, provider credential, bearer token, Clerk
  cookie, Redis URL, Slack webhook URL, private key, or private payload is
  recorded.
- No production database was touched.
- No private row samples were captured.
- The ignored local env file, dump file, SQL helper files, and disposable
  restore container were removed after proof.
