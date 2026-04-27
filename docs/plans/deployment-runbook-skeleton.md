# Deployment Runbook Skeleton

## Metadata

- Status: V1 skeleton for staging, pilot, and production rehearsals.
- Owner: Release operator with backend, frontend, and business sign-off.
- Last updated: 2026-04-27.
- Purpose: Provide a repeatable deployment order without inventing environment-specific details too early.

## Decision Rule

Do not deploy to staging, pilot, or production unless the operator can fill every P0 item in this runbook or record a No-Go / Conditional Go decision before the change starts.

This runbook is intentionally a skeleton. It gives the order, checks, and evidence rules; real hosting commands should be filled only when the target platform is known.

## 1. Preflight

### Required Inputs

- [ ] Target environment name.
- [ ] Release branch or commit SHA.
- [ ] Backend runtime host.
- [ ] Frontend host.
- [ ] Database host.
- [ ] Redis/queue host if `QUEUE_BACKEND=bullmq`.
- [ ] Real IdP issuer, client id, JWKS URL, and audience.
- [ ] Seeded assigned-store and unassigned-store ids for action smoke.
- [ ] Backup owner.
- [ ] Rollback owner.
- [ ] Approval owner.

### Preflight Checks

- [ ] `docs/plans/environment-variable-inventory.md` is reviewed.
- [ ] `docs/plans/production-environment-readiness-checklist.md` has no open P0 unknowns.
- [ ] No `.env` file is staged or committed.
- [ ] Real secrets are stored in the target environment or secret manager.
- [ ] JSON source adapter remains disabled unless a real JSON sample payload has already been mapped and approved.

## 2. Build And Release Gate

Run from workspace root:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI"
npm.cmd run check:release
```

Expected result:

- Root script tests pass.
- Backend lint, tests, build, and `npm audit --omit=dev` pass.
- Frontend lint, script tests, build, Playwright smoke, and `npm audit --omit=dev` pass.

No-Go:

- Any release gate failure.
- Any unreviewed production dependency audit issue.
- Any test that was skipped to make the deploy pass.

## 3. Database Migration

### Before Migration

- [ ] Database backup exists.
- [ ] Backup restore owner is named.
- [ ] Migration order matches `db/migrations`.
- [ ] Canonical schema `db/schema.sql` matches the migration set.
- [ ] Import/materialization jobs are paused or confirmed safe.
- [ ] Snapshot/closure jobs are paused or confirmed safe.

### Execute Migration

Target-specific command:

```powershell
# Fill with approved migration command for the target environment.
```

Rules:

- Do not run production migrations from an unreviewed local shell.
- Do not run against a partially verified database URL.
- Do not start the backend if migration status is unknown.

### After Migration

- [ ] Runtime DB user can connect.
- [ ] Runtime DB user does not require schema owner privileges.
- [ ] Application health check passes.
- [ ] Migration result is recorded in the deployment note.

## 4. Deploy Backend

### Required Env

- [ ] Backend variables from `docs/plans/environment-variable-inventory.md` are filled.
- [ ] `NODE_ENV=production` for production.
- [ ] `AUTH_MODE=jwt`.
- [ ] `JWT_JWKS_URL` is configured for real IdP verification.
- [ ] `JWT_SECRET` is not `change-me`.
- [ ] `ALLOW_MOCK_AUTH=false` or unset with production fail-closed behavior verified.

### Deploy

Target-specific command:

```powershell
# Fill with approved backend deploy command for the hosting platform.
```

### Verify

- [ ] Backend process starts.
- [ ] Health endpoint responds.
- [ ] `/api/auth/bootstrap` returns `authMode=jwt`.
- [ ] `/api/auth/bootstrap` returns provider `configured=true`.

## 5. Deploy Frontend

### Required Env

- [ ] Frontend variables from `docs/plans/environment-variable-inventory.md` are filled.
- [ ] `VITE_API_BASE_URL` points to the target API.
- [ ] `VITE_AUTH_MODE=bearer`.
- [ ] `VITE_BEARER_TOKEN` is empty.
- [ ] `VITE_OIDC_RESPONSE_TYPE=code` if fallback OIDC env is used.

### Deploy

Target-specific command:

```powershell
# Fill with approved frontend deploy command for the hosting platform.
```

### Verify

- [ ] Frontend loads over HTTPS.
- [ ] Login route loads.
- [ ] Callback route is reachable.
- [ ] No source map, env dump, token, or secret is exposed to users.

## 6. Smoke Evidence

Run from `admin-web` when staging IdP and seeded action data are ready:

```powershell
cd "C:\Users\suley\OneDrive\Masaüstü\WEBSİTE ÇALIŞMASI\admin-web"
npm.cmd run smoke:auth:staging:action
```

Then validate sanitized evidence:

```powershell
npm.cmd run guard:auth:evidence
```

If piping JSON directly:

```powershell
npm.cmd run smoke:auth:staging:action | npm.cmd run guard:auth:evidence -- --stdin
```

Expected result:

- PKCE login passes.
- `/api/auth/session` returns expected role, read scope, and action scope.
- assigned-store action returns success.
- unassigned-store action returns `403`.
- Logout returns to `/auth/login`.
- Expired bearer token is cleared before API headers are sent.

Evidence rules:

- Do not paste raw bearer tokens.
- Do not paste raw id tokens.
- Do not paste refresh tokens.
- Do not paste authorization codes.
- Do not paste PKCE verifier values.
- Do not paste client secrets.
- Do not store production credentials in screenshots.

## 7. Rollback

### Rollback Decision Triggers

- Auth smoke fails after deploy.
- Unauthorized action succeeds.
- Assigned action fails for a valid user.
- Backend cannot verify real IdP tokens.
- Migration causes data access errors.
- Import/materialization jobs create repeated high-severity failures.
- Frontend cannot reach backend API.

### Rollback Options

- Revert frontend artifact to previous build.
- Revert backend artifact to previous build.
- Disable scheduled workers or closure automation.
- Restore database backup if a destructive migration caused data damage.
- Forward-fix only when rollback would increase user/data risk.

### Rollback Evidence

- [ ] Trigger recorded.
- [ ] Decision owner recorded.
- [ ] Chosen rollback option recorded.
- [ ] Post-rollback health check recorded.
- [ ] Follow-up issue or plan recorded.

Reference incident skeleton:

- `docs/plans/production-staging-incident-response-skeleton.md`

## 8. Sign-Off Record

Use this block in the deployment note:

```markdown
## Deployment Sign-Off

- Environment:
- Commit SHA:
- Release command result:
- Migration result:
- Backend health:
- Frontend health:
- Auth smoke result:
- Evidence guard result:
- Known limitations:
- Decision: Go / Conditional Go / No-Go
- Prepared by:
- Executed by:
- Reviewed by:
- Approved by:
- Date:
```

## JSON Source Holding Rule

The JSON source adapter is not part of a deployment until a real sample payload or official field list has been mapped into the canonical raw KPI contract.

Before enabling JSON source import in a real environment:

- [ ] Source mapping spec exists.
- [ ] idempotency key is defined.
- [ ] Store identity key is mapped.
- [ ] Personnel or seller identity key is mapped.
- [ ] Row hash and raw row reference are visible in import evidence.
- [ ] Batch quality summary is visible for failed rows.

## CODEX Dürüst Yorum

This runbook is intentionally conservative. It does not pretend we know the hosting provider, migration runner, or final IdP details today. The value is the order and the gates: release first, backup before migration, backend before frontend smoke, evidence before approval, and rollback before pressure.

## Next Logical Step

When the first real staging environment is chosen, fill the target-specific deploy and migration commands without changing the safety order in this runbook.
