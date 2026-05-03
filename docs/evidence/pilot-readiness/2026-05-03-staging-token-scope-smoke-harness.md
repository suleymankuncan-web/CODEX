# Staging Token Scope Smoke Harness - 2026-05-03

## Scope

Prepare a Clerk-compatible live API smoke path for authenticated session and assigned/unassigned action-scope evidence without printing bearer tokens, cookies, provider subjects, email, or passwords.

This evidence records the harness and the current blocker. It is not a completed live authenticated smoke.

## Public API Checks

Staging API:

- `https://api-staging.hr-axis.com/api/health` returned `200`.
- Database health returned `ok`.
- Queue backend remained `in-memory`; Redis check remained `skipped`.

Unauthenticated auth boundary:

- `GET https://api-staging.hr-axis.com/api/auth/session` without bearer token returned `403`.

Bootstrap observation:

- `GET https://api-staging.hr-axis.com/api/auth/bootstrap` returned `authMode=jwt`.
- OIDC provider bootstrap returned `provider.configured=false`.
- This means the older `auth-live-smoke.mjs` OIDC browser flow is not the right staging path for the current Clerk modal setup.

## Added Harness

New script:

- `admin-web/scripts/auth-token-scope-smoke.mjs`

New package command:

- `npm.cmd --prefix admin-web run smoke:auth:staging:token-scope`

New tests:

- `admin-web/scripts/auth-token-scope-smoke.test.mjs`

The script requires a local environment bearer token and does not print it. It calls:

- `GET /auth/session`
- `GET /target-distributions/store-personnel?storeId=<assignedStoreId>`
- `GET /target-distributions/store-personnel?storeId=<unassignedStoreId>`

The action-scope checks are intentionally read-only. They exercise `RequireActionScope("store")` but do not create target requests or mutate staging data.

## Staging Inputs

Assigned store:

- `STORE100`
- `00000000-0000-0000-0000-000000000100`
- `IstinyePark Demo Store`

Unassigned negative smoke candidate:

- `DEMO-101`
- `00000000-0000-0000-0000-000000000101`
- `Demo Store 101`

Expected role:

- `STORE_MANAGER`

## Fail-Fast Verification

Command:

```powershell
$env:AUTH_SMOKE_API_BASE_URL='https://api-staging.hr-axis.com/api'
$env:AUTH_SMOKE_EXPECTED_ROLE='STORE_MANAGER'
$env:AUTH_SMOKE_ENVIRONMENT='staging'
$env:AUTH_SMOKE_ASSIGNED_STORE_ID='00000000-0000-0000-0000-000000000100'
$env:AUTH_SMOKE_UNASSIGNED_STORE_ID='00000000-0000-0000-0000-000000000101'
npm.cmd --prefix admin-web run smoke:auth:staging:token-scope
```

Result:

- Failed fast with `AUTH_SMOKE_BEARER_TOKEN is required`.
- It did not attempt a network request with a missing token.

## Automated Verification

Command:

```powershell
npm.cmd --prefix admin-web run test:scripts
```

Result:

- `10/10` admin-web script tests passed.
- The new token-scope smoke test proves:
  - missing bearer token fails before network access,
  - the bearer token is sent only as an `Authorization` header,
  - the token is not printed in evidence output,
  - assigned store returns `200`,
  - unassigned store returns `403`,
  - package script is exposed.

## Live Smoke Blocker

Live staging token-scope smoke could not be completed from this workspace because:

- no `AUTH_SMOKE_BEARER_TOKEN` is available in the shell environment,
- no reusable staging login automation credential is available,
- the Codex in-app browser could create an about:blank tab but failed to navigate with `failed to start codex app-server: Sistem belirtilen yolu bulamiyor. (os error 3)`.

To complete the live smoke, use a real authenticated staging browser session and provide the bearer token only through local environment, not in docs or chat.

Live command shape:

```powershell
$env:AUTH_SMOKE_API_BASE_URL='https://api-staging.hr-axis.com/api'
$env:AUTH_SMOKE_BEARER_TOKEN='<local-only bearer token from authenticated staging browser>'
$env:AUTH_SMOKE_EXPECTED_ROLE='STORE_MANAGER'
$env:AUTH_SMOKE_ENVIRONMENT='staging'
$env:AUTH_SMOKE_ASSIGNED_STORE_ID='00000000-0000-0000-0000-000000000100'
$env:AUTH_SMOKE_UNASSIGNED_STORE_ID='00000000-0000-0000-0000-000000000101'
npm.cmd --prefix admin-web run smoke:auth:staging:token-scope
Remove-Item Env:AUTH_SMOKE_BEARER_TOKEN -ErrorAction SilentlyContinue
```

The expected successful evidence is sanitized JSON and must be stored without the raw bearer token.

## Pilot Gate Impact

Pilot status remains `No-Go`.

This closes the tooling gap for Clerk token-based session/action-scope smoke, but it does not close the live authenticated evidence gap until the command is run with a real staging bearer token and its sanitized output is recorded.
