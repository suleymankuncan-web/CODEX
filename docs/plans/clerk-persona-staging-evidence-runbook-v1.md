# Clerk Persona Staging Evidence Runbook V1

## Purpose

This runbook defines how to collect controlled-pilot Clerk evidence before the
project is exposed to field users.

Reader:
- internal engineer or operator preparing staging pilot evidence.

Post-read action:
- create or reuse Clerk staging personas, bind them to application roles and
  scopes, sign in as each persona, run the approved smoke checks, and store only
  sanitized evidence.

This is not broad production approval. It is a controlled staging/internal
pilot evidence path.

## Decision

Use real Clerk sessions for pilot evidence.

Do not use fabricated local JWTs, mock auth headers, or manually edited DB state
as proof for real auth/session readiness.

The frontend obtains the Clerk session token through the configured Clerk
provider and sends it to the backend as a bearer token. The backend verifies the
JWT and maps the provider subject to the application user account. App roles,
read scope, and action scope remain owned by the application database.

## Scope

Allowed:
- create staging-only Clerk users for explicit pilot personas,
- bind each Clerk user to one application user account,
- assign only the role, read scope, and action-store scope needed for that
  persona,
- run browser walkthroughs and approved smoke scripts,
- store sanitized status, route, role, scope, and HTTP result evidence.

Not allowed:
- field rollout,
- broad production sign-off,
- raw token storage,
- raw Clerk cookie storage,
- raw provider subject storage in public evidence,
- DB edits made only to force a smoke to pass,
- widening user scope to simplify a demo,
- using one super-admin token as proof for every persona.

## Evidence Safety Rules

Never paste, commit, screenshot, or store:
- raw bearer tokens,
- id tokens,
- refresh tokens,
- authorization codes,
- PKCE verifiers,
- Clerk cookies,
- client secrets,
- private keys,
- full session storage dumps,
- passwords,
- full provider subjects,
- private personal data.

Evidence may include:
- persona alias,
- route name,
- expected role code,
- sanitized role list,
- sanitized read-scope/action-scope summary,
- assigned-store success status,
- unassigned-store denial status,
- commit hash,
- deploy URL or deploy id,
- smoke command name,
- pass/fail result,
- sanitized error category.

If raw secret material is captured, discard the evidence, rotate or revoke the
affected session or secret where applicable, and rerun the evidence path.

## Persona Matrix

| Persona | Clerk account | App binding | Required proof |
| --- | --- | --- | --- |
| Super admin | Staging-only admin user | `SUPER_ADMIN`, company scope | Can reach admin shell and auth/session returns admin role. |
| HR admin | Staging-only HR user | `HR_ADMIN`, company scope | Can manage pilot bindings and workforce/admin surfaces without super-admin fallback. |
| Integration admin | Staging-only integration user | `INTEGRATION_ADMIN`, company scope | Can access integration/import surfaces and run authenticated upload smoke when a safe file is available. |
| Region manager | Staging-only region user | `REGION_MANAGER`, approved region/store scope | Can read regional/store operational surfaces without company-wide admin powers. |
| Store manager | Staging-only store manager user | `STORE_MANAGER`, one store read scope plus matching action-store assignment | Assigned store succeeds and unassigned store returns `403`. |
| Store personnel | Staging-only personnel user | `STORE_PERSONNEL`, own store/personnel scope | Can use store-facing surfaces and cannot reach admin-only surfaces. |
| Report viewer or auditor | Staging-only read-only user | `REPORT_VIEWER` or `AUDITOR`, approved read scope | Can read allowed reports/audit views and cannot perform write actions. |

The exact roster can be smaller for the first smoke pass, but store-manager
positive/negative action evidence is the minimum useful proof.

## Prerequisites

Frontend staging must have:
- Clerk auth provider enabled,
- Clerk publishable key configured,
- Clerk JWT template configured when the backend expects that template.

Backend staging must have:
- JWT auth mode enabled,
- auth provider key set to Clerk,
- Clerk-compatible issuer configured,
- Clerk-compatible JWKS URL configured,
- expected audience configured,
- CORS allowing the staging frontend origin.

Data prerequisites:
- at least one active company,
- at least one active region,
- at least two active stores for positive and negative store-scope checks,
- active employees for personas that require employee binding,
- role catalog seeded,
- action-store assignment support enabled.

Operational prerequisites:
- persona credentials are available only through the approved secret channel,
- deploy target and commit hash are known,
- evidence note location is chosen before running smoke,
- no raw secrets will be copied from browser devtools, terminal, or provider UI.

## Setup Steps

### 1. Create Clerk Personas

Create staging-only Clerk users with non-personal test email aliases.

Recommended naming:
- `pilot.superadmin`
- `pilot.hr`
- `pilot.integration`
- `pilot.region`
- `pilot.store-manager`
- `pilot.store-personnel`
- `pilot.report-viewer`

Store passwords or magic-link access only in the approved secret channel.

### 2. Capture Provider Subject For Binding

Each Clerk user has a provider subject used by the backend as the external user
identity.

Use the provider subject only for setup. Do not paste the full value into public
evidence, chat, issue comments, screenshots, or docs.

### 3. Bind The App User

Create or update the application user account so that:
- auth provider is Clerk,
- provider subject matches the Clerk user,
- user is active,
- username/email are staging-safe aliases,
- employee id is present when the persona needs employee-backed behavior.

For pilot store/region personas, prefer the existing pilot binding workflow
when it fits the role. For broader admin/read-only personas, use the approved
auth-admin user and assignment workflow.

### 4. Assign Role And Read Scope

Assign only the minimum role and scope needed for the persona.

Check that:
- company-scope roles do not accidentally grant store-manager behavior,
- region personas do not receive company-wide scope unless explicitly intended,
- store personas have only the intended store read scope,
- read scope and action scope remain separate.

### 5. Assign Action Store Scope

For the store-manager action smoke, assign exactly the intended action store.

Also identify one active unassigned store that should return `403`.

Do not grant the unassigned store to make the smoke pass.

## Token Handling

Preferred browser path:
- sign in through the staging app as the persona,
- let the frontend obtain and refresh the Clerk token,
- verify the user by route behavior and `/auth/session`,
- avoid manually extracting the raw token unless a command-line smoke requires
  it.

Command-line smoke path:
- sign in through the staging app,
- locally copy the current bearer token from the browser session only into a
  private shell environment variable,
- do not paste the token into chat, docs, issue comments, screenshots, or files,
- clear the shell variable after the smoke,
- re-login and recapture if the token expires.

The raw token is an input to the smoke command, not an evidence artifact.

### Local Token Capture For CLI Smoke

Use this only when a command-line smoke needs a bearer token.

1. Sign in to the staging app as the target Clerk persona.
2. Open browser devtools.
3. Go to Application or Storage.
4. Open Session Storage for the staging frontend origin.
5. Copy only the value named `store-ops-admin-bearer-token`.
6. Paste it directly into a local shell environment variable.
7. Close devtools or navigate away before taking any screenshots.
8. Clear the shell variable immediately after the smoke.

Do not copy the full session storage object. Do not record the token value in
evidence. Do not use a screenshot while the token is visible.

## Smoke Commands

Use the Clerk-token action-scope smoke for the first store-manager proof:

```powershell
cd "<workspace-root>\admin-web"
$env:AUTH_SMOKE_API_BASE_URL="https://api-staging.hr-axis.com/api"
$env:AUTH_SMOKE_BEARER_TOKEN="<local-only-clerk-bearer-token>"
$env:AUTH_SMOKE_EXPECTED_ROLE="STORE_MANAGER"
$env:AUTH_SMOKE_ENVIRONMENT="staging"
$env:AUTH_SMOKE_ASSIGNED_STORE_ID="<assigned-store-uuid>"
$env:AUTH_SMOKE_UNASSIGNED_STORE_ID="<unassigned-store-uuid>"
npm.cmd run smoke:auth:staging:token-scope
Remove-Item Env:AUTH_SMOKE_BEARER_TOKEN -ErrorAction SilentlyContinue
```

Use deployed readiness smoke with a real token when checking the deployed
frontend/backend readiness path. Return to the workspace root first; this
smoke is a root script:

```powershell
cd "<workspace-root>"
$env:READINESS_FRONTEND_URL="https://staging.hr-axis.com"
$env:READINESS_BACKEND_URL="https://api-staging.hr-axis.com/api"
$env:READINESS_BEARER_TOKEN="<local-only-clerk-bearer-token>"
npm.cmd run smoke:deployed-readiness
Remove-Item Env:READINESS_BEARER_TOKEN -ErrorAction SilentlyContinue
```

Use role-specific load smoke tokens only after the first persona binding smoke
is clean. Shared admin tokens are diagnostic-only and do not prove scoped
persona behavior.

## Browser Walkthrough Checklist

For every persona:
- sign in through Clerk on staging,
- confirm the expected landing route,
- refresh the route and confirm it stays authenticated,
- open session/readiness or an equivalent session surface,
- confirm expected role code,
- confirm expected read scope,
- confirm expected action scope,
- try one route the persona should access,
- try one route the persona should not access,
- sign out,
- confirm returning to the route requires login again.

For store manager:
- confirm assigned-store operational read/action succeeds,
- confirm unassigned-store action returns `403`,
- confirm the user cannot reach admin-only surfaces.

For HR/admin personas:
- confirm the persona can perform only the approved setup/support workflow,
- do not use an admin persona to replace store-manager or store-personnel
  evidence.

For integration admin:
- run authenticated upload smoke only with a safe staging file,
- record row counts and status codes, not file secrets or private payload data.

## Evidence Note Shape

Each evidence note should contain:

```text
Title:
Environment:
Frontend URL:
Backend API URL:
Commit / deploy:
Persona:
Expected role:
Expected read scope:
Expected action scope:
Assigned store:
Unassigned store:
Smoke command:
Result:
Sanitized session summary:
Positive check:
Negative check:
Logout/refresh check:
Limitations:
Decision: Go / Conditional Go / No-Go
Reviewer:
```

Do not include raw token, provider subject, cookie, password, or private
personal data.

## Go / Conditional Go / No-Go

Go:
- persona can sign in,
- `/auth/session` returns the expected app role and scopes,
- assigned-store check succeeds,
- unassigned-store check returns `403`,
- route access matches the persona,
- logout and refresh behavior are clean,
- evidence contains no secret material.

Conditional Go:
- every P0 auth/scope/security check passes,
- a non-blocking limitation remains,
- the limitation has an owner and a follow-up decision.

No-Go:
- real Clerk login fails,
- backend rejects a valid Clerk token because environment wiring is wrong,
- user account is not mapped,
- role/scope is missing or too broad,
- assigned-store check fails,
- unassigned-store check does not return `403`,
- admin token is used as proof for scoped personas,
- evidence contains raw secret material,
- route access is wider than intended.

## Stop Rules

Stop and report before continuing if:
- provider issuer, JWKS URL, or audience is uncertain,
- a persona requires a role/scope not already understood,
- binding requires direct DB mutation outside an approved setup path,
- a smoke only passes after widening scope,
- a token appears in logs, screenshots, docs, chat, or issue comments,
- browser and command-line evidence disagree,
- any role can see or act beyond its intended scope.

## First Execution Order

1. Store manager token/action smoke.
2. Store personnel route/privacy walkthrough.
3. HR admin pilot-binding walkthrough.
4. Integration admin authenticated upload smoke, only after safe sample file is
   available.
5. Region manager scoped read walkthrough.
6. Super admin support sanity check.
7. Report viewer or auditor read-only denial check.

This order proves the riskiest controlled-pilot assumption first: scoped users
can act only where assigned.

## Outcome

When this runbook is complete for the required personas, controlled
staging/internal pilot evidence can move from "missing real token/provider
proof" to "persona-backed Clerk evidence collected".

Broad production remains blocked until the broader production readiness
checklist is satisfied.
