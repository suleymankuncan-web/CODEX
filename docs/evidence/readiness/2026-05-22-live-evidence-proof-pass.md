# Live Evidence Proof Pass - 2026-05-22

## Scope

This note records a follow-up live evidence pass after
`docs/evidence/readiness/2026-05-22-production-evidence-blockers-v2.md`.

It proves every remaining item that can be honestly proven from this shell and
keeps the rest as explicit blockers. It uses real staging surfaces and real
Clerk browser sessions. It does not change source code, database schema,
provider configuration, auth semantics, API response shape, CSS, or business
logic.

## Sokrates Decision

Claim:

- Some V2 blockers can be closed with current staging inputs, but broad
  production is still not ready.

Assumptions:

- `https://staging.hr-axis.com` and `https://api-staging.hr-axis.com/api` are
  the active staging frontend/backend surfaces.
- The existing pilot Clerk accounts are the approved staging evidence users.
- A one-row, non-private upload sample is acceptable as a minimal staging upload
  smoke.

Repo/live evidence:

- Existing pilot Clerk accounts still produce valid backend bearer sessions.
- Active staging Power BI KPI source code is `power-bi-kpi`.
- Backend health explicitly reports process-local queue mode, skipped Redis,
  and log-only observability.
- Local shell has no Redis, alert provider, database, restore target, or
  Supabase restore credentials.

Counterargument:

- A dedicated `INTEGRATION_ADMIN` persona would be cleaner than using the
  existing pilot super-admin for upload. That is true. The live DB check found
  no active `INTEGRATION_ADMIN` assignment, so creating one would be a separate
  auth/data mutation, not a pure evidence pass.

Risk:

- Evidence collection: LOW to MEDIUM.
- The upload smoke writes a minimal staging import batch.
- Treating missing Redis, restore, or alert-provider evidence as broad
  production-ready would be HIGH risk.

Door:

- This evidence document is a two-way door.
- Creating new auth users/role assignments, changing provider config, enabling
  Redis/BullMQ, and running restore drills are not casual two-way changes.

Stop rule used:

- Stop before printing raw bearer tokens, Clerk cookies, provider subjects,
  database URLs, Redis URLs, webhook secrets, or private payloads.
- Stop before running destructive restore commands without a confirmed
  disposable target.
- Stop before creating new auth accounts or role assignments merely to make a
  smoke pass.

## Evidence Summary

| Item | Status | Evidence |
| --- | --- | --- |
| Protected route load smoke | Proven | Real store-manager and super-admin Clerk tokens ran role-specific backend read-load groups successfully. |
| Authenticated upload smoke | Proven with existing super-admin pilot session | `POST /api/integrations/power-bi-export-upload` returned `201` with one safe staging CSV row against `power-bi-kpi`. |
| Dedicated integration-admin persona | Still missing | Active staging role-assignment query found `0` active `INTEGRATION_ADMIN` assignments. |
| Import batch list read model | Fixed and live-verified | PR #409 qualified shared list-query columns; live Clerk readback returned `200` for list, source-filtered list, and overview. |
| Redis/BullMQ broad-production health | Still missing | `/api/health` reports `queueBackend=in-memory`, `process-local`, Redis `skipped`. |
| Alert backend health signal | Proven | `smoke:alert-routing` passed backend health signal with HTTP `200`. |
| External alert provider delivery | Still missing | Provider delivery remains `not-configured`; provider metadata skipped. |
| Supabase restore drill | Still missing | No approved disposable restore target or DB credentials exist in this shell; PostgreSQL client tools are not on PATH. |

## Protected Route Load Smoke

Fresh browser login was performed through the staging Clerk modal. Raw bearer
tokens stayed in local process memory only.

Result:

- Evidence time: `2026-05-22T06:39:59.519Z`.
- Status: `ok`.
- Groups: `5`.
- Passed groups: `5`.
- Failed groups: `0`.
- Skipped groups: `0`.
- Public API health: availability `100%`, p50 `52.8ms`, p95 `69.14ms`, max
  `69.14ms`, 5xx `0`.
- Auth session reads: availability `100%`, p50 `202.42ms`, p95 `209.68ms`,
  5xx `0`.
- Store reads: availability `100%`, p50 `215.18ms`, p95 `1434.14ms`, max
  `1434.14ms`, 5xx `0`.
- Competition reads: availability `100%`, p50 `204.76ms`, p95 `214.75ms`.
- Import reads: availability `100%`, p50 `209.23ms`, p95 `229.15ms`.

Observation:

- The hottest sampled protected endpoint was store rankings at p95
  `1434.14ms`. This is below the `2000ms` protected-read watch budget but is
  the first place to watch if ranking data grows.

Decision:

- Protected read-load evidence for the sampled controlled-pilot routes: Go.
- Continue watching ranking query latency before broad field scale.

## Authenticated Upload Smoke

Pre-checks:

- Active Power BI KPI source query returned source code `power-bi-kpi`.
- Enabled KPI import store-scope query returned active stores.
- Active role assignment query found no active `INTEGRATION_ADMIN` assignments.

Upload command shape:

```text
POST /api/integrations/power-bi-export-upload
sourceCode=power-bi-kpi
periodMonth=2026-04
storeFile=codex-evidence-store.csv
```

Sample file:

- One row.
- Staging-only, non-private data.
- Store: `Adana Cadde`.
- No personnel, customer, token, provider, or private payload data.

Result:

- Evidence time: `2026-05-22T06:47:17.812Z`.
- Persona used: existing pilot super-admin Clerk browser session.
- Token present locally: yes.
- HTTP status: `201`.
- Response: success body with `command`, `data`, and `job`.
- Batch id tail: `be350e95`.
- Batch status: `pending`.
- `storeRowsRead`: `1`.
- `personnelRowsRead`: `0`.
- `canonicalRowCount`: `2`.
- `ignoredStoreRows`: `0`.
- `scopeExcludedStoreRows`: `0`.
- `mappingMode`: `strict_external_id_map`.

Decision:

- Authenticated staging upload smoke with a safe sample file: Go.
- Dedicated integration-admin persona proof remains open if the product owner
  requires upload to be proven through a non-super-admin `INTEGRATION_ADMIN`
  account.

## Import Batch List 500 Follow-Up

After the upload smoke, read-only verification was attempted through import
batch list endpoints.

Initial result:

- `GET /api/integrations/import-batches?limit=5`: HTTP `500`,
  `INTERNAL_SERVER_ERROR`.
- `GET /api/integrations/import-batches?sourceCode=power-bi-kpi&limit=5`: HTTP
  `500`, `INTERNAL_SERVER_ERROR`.
- `GET /api/integrations/import-batches/overview`: HTTP `200`.

Root cause and fix:

- PR #409 fixed the list read model by qualifying shared joined columns with
  `stg.import_batch` in the list SELECT and ORDER BY query path.
- Regression coverage now asserts that the list query selects
  `stg.import_batch.import_batch_id`,
  `stg.import_batch.integration_source_id`, and
  `stg.import_batch.entity_type`.

Live readback after Render deploy:

- Evidence time: `2026-05-22T07:33:11.089Z`.
- Merge commit: `0971883f6a876086225b68c2e47a08aaba29d013`.
- Real Clerk super-admin browser session was used.
- Raw bearer token stayed in local process memory and was not printed.
- `GET /api/auth/session`: HTTP `200`.
- `GET /api/integrations/import-batches?limit=5`: HTTP `200`.
- `GET /api/integrations/import-batches?sourceCode=power-bi-kpi&limit=5`:
  HTTP `200`.
- `GET /api/integrations/import-batches/overview`: HTTP `200`.

Decision:

- Import batch list/readback operator evidence is now fixed and live-verified.
- This closes the new list-read blocker found during the upload smoke.

## Redis And Durable Queue Proof

Live `/api/health` result:

- Evidence time: `2026-05-22T06:44:52.549Z`.
- HTTP status: `200`.
- `status`: `ok`.
- `queueBackend`: `in-memory`.
- queue status: `process-local`.
- Redis status: `skipped`.
- observability mode: `log-only`.
- external delivery: `not-enabled`.

Local input presence check:

- `REDIS_URL`: absent.
- `BULLMQ_REDIS_URL`: absent.
- `UPSTASH_REDIS_REST_URL`: absent.

Decision:

- Controlled pilot queue posture: Conditional Go.
- Broad-production Redis/BullMQ proof: No-Go until target environment health
  reports Redis `ok` and durable queue mode.

## Alert Routing Proof

Command:

```powershell
$env:ALERT_SMOKE_BACKEND_URL='https://api-staging.hr-axis.com'
npm.cmd run smoke:alert-routing
```

Result:

- Evidence time: `2026-05-22T06:45:11.918Z`.
- status: `ok`.
- total checks: `5`.
- passed: `4`.
- failed: `0`.
- skipped: `1`.
- backend health alert signal: passed with HTTP `200`.
- provider delivery: `not-configured`.
- skipped check: alert provider metadata.

Local input presence check:

- `ALERT_PROVIDER_NAME`: absent.
- `ALERT_PRIMARY_DESTINATION`: absent.

Decision:

- Alert docs, incident path, production checklist gate, and backend health
  signal: Go.
- External alert delivery: No-Go until an alert provider destination is
  configured and tested, or log-retention is explicitly accepted by owner.

## Supabase Restore Proof

Local input presence check:

- `DATABASE_URL`: absent.
- `RESTORE_DATABASE_URL`: absent.

Tooling check:

- `pg_dump`: not found on PATH.
- `pg_restore`: not found on PATH.
- `psql`: not found on PATH.

Decision:

- Supabase/staging restore drill: No-Go from this shell.
- Do not run destructive restore commands until a disposable target and tooling
  are explicitly available.

## Readiness Decision

Controlled staging/internal pilot:

- Conditional Go.
- Clerk persona/session evidence: Go for existing pilot personas.
- Protected route load smoke: Go for sampled protected routes.
- Authenticated safe upload smoke: Go with the existing super-admin pilot
  session.

Broad production:

- No-Go.

Why broad production is still No-Go:

- Redis/BullMQ durable queue health is not proven.
- Supabase restore drill is not proven.
- External alert delivery is not proven.
- Dedicated `INTEGRATION_ADMIN` persona proof is not available if strict
  role-specific upload evidence is required.

## Safety

- No raw bearer token, Clerk cookie, authorization code, provider subject,
  database URL, Redis URL, Supabase token, webhook secret, password, private
  key, full session storage, or private personal data is recorded here.
- No production database was touched.
- No new auth user, role assignment, provider config, Redis config, DB
  migration, or CSS/user-facing behavior change was made.
