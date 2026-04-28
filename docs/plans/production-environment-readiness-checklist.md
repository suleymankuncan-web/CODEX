# Production Environment Readiness Checklist

## Metadata

- Status: V1 local readiness guard.
- Owner: Platform, backend, frontend, and operations sign-off.
- Last updated: 2026-04-27.
- Purpose: Keep production and staging preparation explicit before real users, real identity, real data, or scheduled imports are trusted.

## Decision Rule

Do not mark an environment production-ready until every P0 item in this checklist has either passed or has a written Conditional Go decision with an owner and a dated follow-up.

This checklist is not a deployment script. It is the operator contract that says the application, environment, evidence, and rollback assumptions are ready enough to expose to real operational users.

## Ownership And Sign-Off

| Role | Responsibility | Sign-off evidence |
| --- | --- | --- |
| Prepared by | Collects env, IdP, DB, release, backup, and smoke inputs. | Checklist filled with dates and links. |
| Executed by | Runs release and smoke commands in the target environment. | Sanitized terminal/evidence notes. |
| Reviewed by | Verifies no secrets, missing P0s, or scope/auth mismatches are present. | Review note with Go / Conditional Go / No-Go. |
| Approved by | Final business or technical owner who accepts the environment risk. | Dated approval note. |

Allowed sign-off states:

- Go: every P0 passes and evidence is attached.
- Conditional Go: a non-blocking P1/P2 limitation is accepted with owner and date.
- No-Go: any P0 is missing, unsafe, or unproven.

## Environment And Secret Checklist

### P0 Required

- [ ] `docs/plans/environment-variable-inventory.md` is reviewed for the target environment.
- [ ] Target environment name is explicit: local, staging, pilot, or production.
- [ ] `NODE_ENV=production` is used for production backend runtime.
- [ ] Backend and frontend public origins are final for the target environment.
- [ ] `JWT_JWKS_URL` is configured for real IdP verification, or production has an explicit non-default `JWT_SECRET` only for an approved non-JWKS mode.
- [ ] Production never uses `JWT_SECRET=change-me`.
- [ ] `CORS_ALLOWED_ORIGINS` is explicitly configured and contains only approved frontend origins.
- [ ] `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` are explicitly configured for the environment.
- [ ] Error responses do not expose stack traces or raw exception details.
- [ ] `DATABASE_URL` points to the target database and is not shared with local development.
- [ ] Database user has the minimum permissions needed for the application runtime.
- [ ] Migration user and runtime user are separated if the hosting model supports it.
- [ ] Secrets are stored in the environment or a secret manager, not in source control.
- [ ] Do not commit `.env` files.
- [ ] Do not paste raw bearer tokens into docs, issue comments, chat, screenshots, or evidence files.
- [ ] Do not paste raw id tokens into docs, issue comments, chat, screenshots, or evidence files.
- [ ] Do not paste refresh tokens into docs, issue comments, chat, screenshots, or evidence files.
- [ ] Do not paste client secrets into docs, issue comments, chat, screenshots, or evidence files.
- [ ] Do not store production credentials in screenshots.
- [ ] `npm.cmd run check:release` passes from the workspace root before deployment approval.
- [ ] Backend `npm audit --omit=dev` passes through the release gate.
- [ ] Frontend `npm audit --omit=dev` passes through the release gate.

### P1 Recommended

- [ ] Environment variables are documented in a private deployment runbook with owner and rotation policy.
- [ ] Production secrets have a rotation date and emergency rotation owner.
- [ ] Application logs redact authorization headers, cookies, token-like query params, and provider codes.
- [ ] Error reporting is enabled without collecting raw tokens, passwords, or personal notes.

## Identity Provider Checklist

### P0 Required

- [ ] Real provider registration uses authorization code flow with PKCE `S256`.
- [ ] Implicit flow is disabled for the production browser client.
- [ ] Allowed callback URL exactly matches `/auth/callback` on the target frontend origin.
- [ ] Allowed post-logout URL exactly matches `/auth/login` on the target frontend origin.
- [ ] Provider issuer exactly matches backend `JWT_ISSUER`.
- [ ] Provider audience satisfies backend `JWT_AUDIENCE`.
- [ ] JWKS endpoint supports key rotation without code changes.
- [ ] Access token contains direct `sub`, `aud`, `exp`, and app role/scope claims.
- [ ] Provider roles map only to app catalog roles.
- [ ] Read scope and action scope remain separate.
- [ ] `assigned_store_ids` or DB-backed action assignment controls store write eligibility.
- [ ] `npm.cmd run smoke:auth:staging:action` passes before staging or production sign-off.
- [ ] `npm.cmd run guard:auth:evidence` passes against the sanitized staging evidence.
- [ ] assigned-store action returns success.
- [ ] unassigned-store action returns `403`.

### References

- `docs/plans/environment-variable-inventory.md`
- `docs/plans/deployment-runbook-skeleton.md`
- `docs/plans/production-staging-incident-response-skeleton.md`
- `docs/plans/phase-7-provider-readiness-checklist.md`
- `docs/plans/phase-7-staging-auth-smoke-runbook.md`
- `docs/plans/phase-7-auth-evidence-template.md`

## Database And Migration Checklist

### P0 Required

- [ ] Target database has a backup before first production migration.
- [ ] Migration order is documented and matches `db/migrations`.
- [ ] Canonical schema `db/schema.sql` reflects the migration set used for the target environment.
- [ ] Migration execution is run by an authorized operator or automated deployment job.
- [ ] `npm.cmd run db:migrate` is the approved migration execution command.
- [ ] `/api/admin/migrations/run` is disabled in production by `MIGRATIONS_HTTP_ENABLED=false` or production default behavior.
- [ ] `audit.schema_migration` contains succeeded records for applied migration files.
- [ ] Failed migration recovery plan is written before running production migrations.
- [ ] Runtime app starts after migrations without requiring schema write privileges.
- [ ] Seed data needed for auth/action smoke is present or intentionally excluded with a No-Go/Conditional Go decision.
- [ ] Snapshot/reporting jobs cannot run against a partially migrated database.
- [ ] Import/materialization jobs are paused or scheduled safely during migration.

### P1 Recommended

- [ ] Rollback strategy is explicit: restore backup, forward-fix migration, or disable feature flag.
- [ ] Database connection pool size is reviewed for the hosting tier.
- [ ] Slow query and failed query logging are enabled in the target environment.
- [ ] Retention for staging data is documented separately from production data.

## Audit, Backup, And Retention Checklist

### P0 Required

- [ ] Audit events remain enabled for auth, approvals, feed, import, KPI config, target distribution, and competition operations.
- [ ] Audit event catalog drift guard passes through backend release tests.
- [ ] Audit retention owner is defined.
- [ ] Backup cadence is defined for the target database.
- [ ] Restore drill owner is defined before production Go.
- [ ] Import evidence files and smoke evidence files have a retention owner.
- [ ] Sensitive evidence redaction rules are applied before evidence is stored.

### P1 Recommended

- [ ] Audit retention period is documented by data type.
- [ ] Backup restore is tested at least once before broad rollout.
- [ ] Production incident contact path is written.
- [ ] High-severity import/data quality events have an owner for triage.

## Smoke Evidence Checklist

### P0 Required

- [ ] Root release gate passed: `npm.cmd run check:release`.
- [ ] Real or staging IdP login smoke passed.
- [ ] Real or staging IdP logout smoke passed.
- [ ] `GET /api/auth/session` returned expected role codes.
- [ ] `GET /api/auth/session` returned expected read scope.
- [ ] `GET /api/auth/session` returned expected action scope.
- [ ] assigned-store action returns success.
- [ ] unassigned-store action returns `403`.
- [ ] Store-facing smoke confirms a store user sees only authorized store data.
- [ ] Admin-facing smoke confirms unauthorized users cannot reach admin-only surfaces.
- [ ] Sanitized auth evidence passes `npm.cmd run guard:auth:evidence`.
- [ ] Evidence contains no raw bearer token, id token, refresh token, authorization code, PKCE verifier, client secret, private key, or unredacted credential.

### P1 Recommended

- [ ] Import batch smoke is run with a sanitized JSON sample payload once source payload evidence exists.
- [ ] Import batch detail shows row lineage and data quality summary for the sample payload.
- [ ] Operational feed smoke confirms company, region, and store visibility boundaries.
- [ ] Store KPI/ranking smoke confirms score interpretation and ranking confidence copy remain visible.

## JSON Source Readiness Holding Area

Status: blocked until a real JSON sample payload or official field list arrives.

The source-specific adapter remains blocked until these inputs exist:

- JSON sample payload.
- Delivery method: pull API, push endpoint, file upload, SFTP, scheduled export, or manual import.
- Authentication method for delivery.
- Business date and timezone rule.
- Store identity key.
- Personnel or seller identity key.
- Metric fields and units.
- Return/refund behavior.
- Late correction behavior.
- Duplicate handling rule.
- idempotency key.

Current local foundation already supports the next mapping step:

- canonical raw KPI contract.
- row hash generation.
- raw row reference persistence.
- import batch lineage.
- data quality issue codes.
- batch-level quality summary.

Decision:

- Do not write a JSON source-specific adapter yet.
- Do not assume Nebim, SQL, API, or file semantics.
- When the sample arrives, first create a source mapping spec, then implement the smallest adapter needed to convert that JSON into the canonical raw KPI contract.

## Go / No-Go Criteria

### No-Go P0 Failures

Any item below blocks production or staging sign-off:

- Root `npm.cmd run check:release` fails.
- Production auth uses missing/default JWT verification settings.
- Real IdP cannot prove authorization code + PKCE.
- Real IdP smoke evidence contains raw tokens, codes, verifier values, client secrets, or production credentials.
- `/api/auth/session` returns empty role, read scope, or action scope for a valid smoke user.
- Assigned-store action does not return success.
- Unassigned-store action does not return `403`.
- Database migration order is unknown.
- No backup exists before production migration.
- Audit event catalog guard fails.
- Production secrets are stored in source control.
- Source-specific import adapter is built without JSON sample payload or official field list.

### Allowed Conditional Go Items

These can proceed only with written owner and date:

- Full production UI/design-system pass is not complete.
- Complete EN/TR expansion is not complete.
- Real JSON import adapter is not complete because payload evidence has not arrived.
- Staging data retention policy is temporary but documented.
- Backup restore drill is scheduled but not yet performed for a limited pilot.

## CODEX Dürüst Yorum

This checklist is not a flashy feature, but it is a real maturity step. The project has already reduced hidden code debt through release gates, auth/scope guards, lineage, audit cataloging, and data quality summaries. The next risk is not "can the app run locally"; it is whether a real environment can be trusted without improvising secrets, migrations, identity, evidence, and source data decisions at the last minute.

My recommendation is to keep this checklist as a gate, not as decoration. If an item is unknown, mark it unknown. Unknown is safer than pretending the answer exists.

## Next Logical Step

When the JSON sample payload arrives, create a source mapping specification before writing adapter code.

If the JSON sample does not arrive yet, the next local step should be a small environment-drift guard or a target-specific staging fill-in note after the hosting/IdP details are known.
