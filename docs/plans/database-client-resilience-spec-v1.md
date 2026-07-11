# Database Client TLS And Timeout Resilience Specification V1

Status: implementation merged in PR #936; DG-3 verify-full staging activation proven, rotation/review follow-up open
Shelf: active plan
Author: Codex
Last verified: 2026-07-11

## 1. Reader And Action

This specification is for the engineer maintaining the shared NestJS
PostgreSQL client or activating provider-verified TLS for the Supabase staging
target after the owner-approved DG-3 decision. Preserve the bounded
configuration and truthful readiness contract without changing database schema,
API behavior, or broad-production readiness by implication.

## 2. Problem And Current Evidence

Before PR #936, the shared `pg.Pool` validated neither `DB_POOL_MAX` nor the
daily closure polling interval, had no explicit connection, idle, query, or
statement timeouts, and could not report its TLS trust level. PR #936 added
those validations, timeout budgets, and the non-secret transport status.
Current controlled-pilot production still uses `rejectUnauthorized: false`, so
its connection is encrypted but the server certificate is not verified.

DG-3 is locked to provider-verified `verify-full`. The owner installed the
provider CA in the Render API and worker secret boundaries. On 2026-07-11,
staging `/api/health` returned HTTP 200 with `encrypted-verified` and
`certificateVerified: true`; the deployed-readiness smoke passed 13 of 14
checks with 0 failures (the auth check was skipped because no bearer token was
provided). Staging activation is therefore proven. CA content is not recorded;
the rotation/review date and single-operator rollback evidence remain an
operational follow-up.

## 3. Scope And Non-Goals

PR-11 will:

- validate pool size and daily closure polling as positive integers;
- add explicit positive-integer connection, idle, query, and statement timeout
  configuration;
- map those values to the existing single shared `pg.Pool` boundary;
- support `disable`, `require`, and `verify-full` TLS modes;
- accept provider CA material only through the backend secret boundary;
- require CA material when `verify-full` is selected;
- require `verify-full` for a broad-production profile;
- expose a non-secret database transport posture in readiness;
- target the controlled-pilot staging API and worker at provider-verified TLS;
- document the CA secret, staging smoke, and rollback evidence required to
  close DG-3.

PR-11 will not:

- invent, download, commit, log, or echo CA material;
- modify `DATABASE_URL`, database schema, migrations, queries, API commands, or
  authorization;
- add a second pool, database proxy, service, or architecture boundary;
- activate `verify-full` in Render without DG-3 provider proof;
- run a provider staging smoke without an explicitly supplied safe target;
- claim broad-production readiness.

## 4. Configuration Contract

| Variable | Default | Validation | Runtime mapping |
| --- | ---: | --- | --- |
| `DB_POOL_MAX` | `20` | positive integer | `PoolConfig.max` |
| `DB_CONNECTION_TIMEOUT_MS` | `5000` | positive integer | `PoolConfig.connectionTimeoutMillis` |
| `DB_IDLE_TIMEOUT_MS` | `30000` | positive integer | `PoolConfig.idleTimeoutMillis` |
| `DB_QUERY_TIMEOUT_MS` | `65000` | positive integer | `PoolConfig.query_timeout` |
| `DB_STATEMENT_TIMEOUT_MS` | `60000` | positive integer and no greater than query timeout | `PoolConfig.statement_timeout` |
| `DAILY_CLOSURE_POLL_MINUTES` | `15` | positive integer | existing scheduler status contract |
| `DB_SSL_MODE` | `disable` locally | `disable`, `require`, or `verify-full` | pool TLS object |
| `DB_SSL_CA` | empty | required only for `verify-full` | TLS `ca`; never logged |

`require` deliberately maps to `{ rejectUnauthorized: false }` for backward-
compatible controlled-pilot deployment and is reported as
`encrypted-unverified`. `verify-full` maps to `{ rejectUnauthorized: true, ca }
and is reported as `encrypted-verified`. `disable` maps to no TLS and is
reported as `disabled`.

`DB_QUERY_TIMEOUT_MS` is intentionally greater than or equal to
`DB_STATEMENT_TIMEOUT_MS`, allowing PostgreSQL's statement cancellation to
occur before the client gives up waiting. Invalid or inverted values fail
closed during application construction.

The explicit `DB_SSL_MODE` owns TLS posture. Pool construction must remove
connection-string SSL parameters that node-postgres documents as replacing the
explicit `ssl` object (`sslmode`, `sslcert`, `sslkey`, and `sslrootcert`). No
connection string may be emitted while doing so.

## 5. Production And Activation Rules

- Local development may use `DB_SSL_MODE=disable`.
- Any production runtime must use `require` or `verify-full`.
- A production controlled-pilot may remain on `require` and must report
  `encrypted-unverified`.
- `READINESS_PROFILE=broad-production` must fail startup unless
  `DB_SSL_MODE=verify-full` and `DB_SSL_CA` is present.
- Repository and Render defaults target controlled-pilot `verify-full` and do
  not contain CA material; the provider secret was entered outside the repo and
  the 2026-07-11 staging proof is recorded below.
- Provider staging smoke is required before any `encrypted-verified` claim; the
  current staging smoke completed with 0 failures.

## 6. Readiness Contract

`GET /api/health` adds a database transport object containing only:

- `status`: `disabled`, `encrypted-unverified`, or `encrypted-verified`;
- `encrypted`: boolean;
- `certificateVerified`: boolean.

The object is present whether the database query succeeds or fails. It must not
contain the connection string, host, username, password, CA content, CA hash,
or certificate details. Existing dependency error sanitization and HTTP 503
behavior remain unchanged.

## 7. Acceptance Criteria

1. Invalid, fractional, zero, negative, non-finite, or inverted numeric
   configuration fails before the runtime serves traffic.
2. The shared pool receives the exact validated pool and timeout values.
3. Production rejects disabled TLS; broad production rejects anything below
   `verify-full` with CA input.
4. `verify-full` keeps Node TLS certificate rejection enabled; unknown or
   untrusted certificates are not accepted by configuration.
5. Health reports the exact non-secret transport posture on both success and
   failure.
6. Controlled-pilot Render API and worker definitions target
   `DB_SSL_MODE=verify-full` and remain deployable once `DB_SSL_CA` is supplied
   through the secret boundary.
7. No provider smoke or verified-provider claim is recorded without DG-3.
8. Backend lint, unit/integration tests, build, root contracts, and the single
   canonical release path pass.

## 8. Verification And Evidence

Required local evidence:

- AppConfig invalid numeric and production-mode tests;
- pool mapping and SSL posture unit tests;
- health success/failure posture tests and redaction regression;
- environment inventory contract tests;
- backend lint, focused tests, and build;
- root contract suite;
- one uninterrupted canonical root release for the PR decision.

Provider evidence recorded on 2026-07-11:

- owner-confirmed provider CA installation in the Render API and worker secret
  boundaries;
- `/api/health` returned HTTP 200 with `encrypted-verified` and
  `certificateVerified: true`;
- deployed-readiness smoke returned `13 passed`, `0 failed`, and `1 skipped`
  because no bearer token was supplied;
- rotation/review date and the single-operator rollback path remain open and
  must be recorded without recording CA material.

## 9. Rollback

Revert the pool/config/readiness commit and return to the prior controlled-
pilot `require` connection posture. Do not disable production TLS. If provider
verification fails, retain `require`, restore the readiness status to
`encrypted-unverified`, and record the DG-3 blocker instead of weakening
certificate verification silently.

## 10. Current Verification Snapshot

Verified on 2026-07-11 on the PR head based on main `56e1e01d`:

- focused config, pool, health, and health integration tests: `77/77` passed;
- full backend suite: `185/185` suites and `1155/1155` tests passed;
- root script contracts: `541/541` passed;
- exact-head canonical release passed in `12m34.6s` locally;
- remote root release passed in `11m22s`, backend/Docker rehearsal passed in
  `1m54s`, the observer passed in `2m9s`, and required aggregate plus Vercel
  passed before PR #936 merged as `271bba3f`;
- DG-3 staging evidence now proves Render API database transport as
  `encrypted-verified` with `certificateVerified: true`; the worker received
  the same provider secret boundary and redeploy;
- no raw connection string or CA content was recorded in the repo or evidence;
  no schema change, migration, or broad-production activation was introduced.
