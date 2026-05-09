# Staging Protected Performance Gate - 2026-05-09

## Scope

Environment:

- Frontend: `https://staging.hr-axis.com`
- Backend protected API: `https://api-staging.hr-axis.com/api`
- Auth provider: Clerk
- Command: `npm.cmd run perf:protected`

Sensitive material policy:

- Raw bearer tokens, Clerk cookies, passwords, provider subjects, full JWTs, and private user data are not recorded.
- Protected performance tokens must be supplied only through local environment variables.
- Evidence records token source names and endpoint status only, never token values.

## Result

Status: blocked by missing real bearer token.

The current Codex shell does not contain a usable protected performance token for either profile:

- `PROTECTED_PERF_STORE_MANAGER_TOKEN`
- `PROTECTED_PERF_STORE_PERSONNEL_TOKEN`

Fallback token variables were also absent:

- `PERF_AUTH_TOKEN`
- `SMOKE_AUTH_TOKEN`
- `STORE_ME_SMOKE_TOKEN`
- `PILOT_SMOKE_BEARER_TOKEN`
- `AUTH_SMOKE_BEARER_TOKEN`

## Blocker Verification

Protected baseline attempts without a bearer token were run against staging for:

- `PERF_TARGET_PROFILE=store-manager`
- `PERF_TARGET_PROFILE=store-personnel`

Observed result:

- `GET /api/reports/kpi-config` returned `403 Forbidden`.

Interpretation:

- Staging does not accept mock performance headers for protected API measurement.
- This is the correct security posture.
- True protected performance still requires fresh real Clerk bearer tokens from store-manager and store-personnel staging sessions.

## Repeatable Gate

The protected performance gate is now explicit:

```powershell
$env:NODE_OPTIONS="--dns-result-order=ipv4first"
$env:PROTECTED_PERF_API_BASE_URL="https://api-staging.hr-axis.com/api"
$env:PROTECTED_PERF_STORE_MANAGER_TOKEN="<fresh-redacted-clerk-jwt>"
$env:PROTECTED_PERF_STORE_PERSONNEL_TOKEN="<fresh-redacted-clerk-jwt>"
npm.cmd run perf:protected
Remove-Item Env:PROTECTED_PERF_STORE_MANAGER_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:PROTECTED_PERF_STORE_PERSONNEL_TOKEN -ErrorAction SilentlyContinue
```

If only one role is being measured:

```powershell
$env:PROTECTED_PERF_PROFILES="store-manager"
$env:PROTECTED_PERF_STORE_MANAGER_TOKEN="<fresh-redacted-clerk-jwt>"
npm.cmd run perf:protected
```

For diagnostic runs where one privileged token is intentionally used across multiple endpoint profiles, make that explicit:

```powershell
$env:PROTECTED_PERF_ALLOW_SHARED_TOKEN="true"
$env:PROTECTED_PERF_TOKEN="<fresh-redacted-clerk-jwt>"
npm.cmd run perf:protected
```

This shared-token mode is not accepted as store-personnel role evidence unless the token itself belongs to the matching store-personnel staging user.

To record the current no-token blocker without failing the local shell:

```powershell
$env:PROTECTED_PERF_ALLOW_BLOCKED="true"
npm.cmd run perf:protected
Remove-Item Env:PROTECTED_PERF_ALLOW_BLOCKED -ErrorAction SilentlyContinue
```

## Decision

Protected performance gate status: ready but blocked by missing real bearer token.

Next evidence needed:

- Store-manager protected API baseline with a fresh staging Clerk JWT.
- Store-personnel protected API baseline with a fresh staging Clerk JWT.
- Optional browser-level authenticated timing after API baselines are captured.
