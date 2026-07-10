# Database Client TLS And Timeout Resilience Specification V1

Status: approved implementation contract; DG-3 provider activation blocked
Shelf: active plan
Author: Codex
Last verified: 2026-07-10

## 1. Reader And Action

This specification is for the engineer changing the shared NestJS PostgreSQL
client. Implement the bounded configuration and truthful readiness contract in
this document without changing database schema, API behavior, provider state,
or broad-production readiness.

## 2. Problem And Current Evidence

The shared `pg.Pool` currently validates neither `DB_POOL_MAX` nor the daily
closure polling interval. It has no explicit connection, idle, query, or
statement timeouts. Production TLS uses `rejectUnauthorized: false`, so the
connection is encrypted but the server certificate is not verified. Health
checks report only query success or failure and cannot distinguish unencrypted,
encrypted-unverified, and encrypted-verified transport.

DG-3 is unavailable. There is no provider CA chain, staging verify-full proof,
or rotation/expiry owner in repository evidence. The implementation may add a
verification-capable contract, but it must not activate or claim provider-
verified TLS.

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
- retain the current controlled-pilot staging mode as encrypted-unverified;
- document DG-3 as the activation blocker.

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
- Repository and Render defaults remain controlled-pilot and do not receive
  fabricated CA material.
- Provider staging smoke is skipped, not passed, while DG-3 inputs are absent.

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
6. Existing controlled-pilot Render API and worker definitions remain
   deployable on `DB_SSL_MODE=require` and are honestly classified.
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

Conditional evidence:

- provider staging smoke only when a separately confirmed safe staging target
  and DG-3 CA/secure-method inputs exist.

## 9. Rollback

Revert the pool/config/readiness commit and return to the prior controlled-
pilot `require` connection posture. Do not disable production TLS. If provider
verification fails, retain `require`, restore the readiness status to
`encrypted-unverified`, and record the DG-3 blocker instead of weakening
certificate verification silently.

