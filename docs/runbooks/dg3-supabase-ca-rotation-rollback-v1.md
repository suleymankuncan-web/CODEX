# DG-3 Supabase CA Rotation And Rollback Runbook V1

Status: active
Shelf: readiness and operations
Owner: project owner / single operator
Last verified: 2026-07-11
Next scheduled review: 2026-10-11

## Purpose

Keep the controlled-pilot Render API and worker on provider-verified
`DB_SSL_MODE=verify-full` while giving one operator a repeatable certificate
review, rotation, and rollback path. This runbook never stores or reproduces
the CA value.

## Current proved state

- Supabase target: `hr-axis-staging`, project ref `lmotuwlzvvarihfsxcyb`.
- Render services: `hr-axis-api` and `hr-axis-worker`.
- `DB_SSL_MODE=verify-full` is configured on both services.
- `DB_SSL_CA` was entered through the Render secret boundary on both services
  and both services were redeployed on 2026-07-11.
- Staging `/api/health` returned HTTP 200 with
  `checks.database.transport.status=encrypted-verified` and
  `certificateVerified=true`.
- Deployed readiness smoke returned `13 passed`, `0 failed`, and `1 skipped`
  because no bearer token was supplied.
- No CA content, fingerprint, database URL, password, or token belongs in this
  document or any evidence record.

## Review triggers and cadence

Run this review at least quarterly and immediately when any of these occurs:

- Supabase announces a CA, hostname, pooler, or certificate rotation;
- the provider certificate is approaching expiry or a TLS handshake begins to
  fail;
- the database host, pooler mode, or Render service changes;
- the CA value may have been exposed;
- a staging deployment changes the database connection boundary.

The next scheduled review is 2026-10-11. A trigger-based review takes
precedence over the calendar date.

## Normal rotation procedure

1. Confirm the target is the staging project above and that both Render
   services are the intended API and worker. Do not rotate a production
   service from this runbook.
2. Download the current provider root CA from the Supabase dashboard through an
   authorized owner/admin session. Keep the file only in a secret-safe local
   location; do not commit, paste into chat, print, or log it.
3. In Render, update `DB_SSL_CA` for `hr-axis-api` and `hr-axis-worker` with
   the complete provider PEM. Keep `DB_SSL_MODE=verify-full`; do not replace it
   with `require` or `disable` for a normal rotation.
4. Save and deploy both services. Record only the date, service names, deploy
   identifiers, and result; never record the CA value.
5. Verify the API before reopening pilot traffic:

   ```powershell
   $health = Invoke-RestMethod `
     -Uri 'https://api-staging.hr-axis.com/api/health' `
     -TimeoutSec 45

   $health.checks.database.transport | Format-List
   ```

   Required values are `status=encrypted-verified`, `encrypted=true`, and
   `certificateVerified=true`.
6. Run the deployed-readiness smoke with the approved public staging URLs. It
   must have zero failures. A missing bearer token may leave the protected
   auth check skipped; record that limitation instead of calling it passed.
7. Confirm the worker startup log after its redeploy. Record the sanitized
   result and close the rotation review.

## Single-operator rollback

Use rollback when the new CA fails health, the provider endpoint cannot be
verified, or either service cannot start. Stop pilot expansion first.

1. Do not set `DB_SSL_MODE=disable` and do not remove TLS.
2. Restore the last known-good provider CA through the same Render secret
   boundary for both services, then redeploy both. Keep the previous known-good
   deployment identifier available until the new health check succeeds.
3. Re-run `/api/health` and the deployed-readiness smoke. If
   `encrypted-verified` returns, record the failed rotation and the restored
   deploy identifiers.
4. If provider verification is unavailable and service availability requires
   an emergency controlled-pilot fallback, the owner may temporarily restore
   `DB_SSL_MODE=require` on both services. This is time-bounded, must be
   recorded with owner/date/reason, reports `encrypted-unverified`, and must be
   followed by a return to `verify-full` before the pilot gate is reopened.
5. Never use `DB_SSL_MODE=disable` in a production-like service. If neither the
   known-good CA nor the temporary `require` fallback is safe, keep the service
   stopped and mark the deployment No-Go.

## Review evidence template

Record only non-secret metadata:

```text
Review date:
Operator:
Target project ref:
Services:
DB_SSL_MODE confirmed on both services:
API transport result:
Readiness smoke result:
Worker startup result:
Deploy identifiers:
Next review date:
Rollback used: no / yes (reason and sanitized result)
```

The source contract is
`docs/plans/database-client-resilience-spec-v1.md`. Update
`current-state.md` after each review, rotation, or rollback. Keep broad
production `No-Go` unless its separate gates are explicitly closed.
