# Pilot Persona Evidence Runbook V1

Date: 2026-05-23

## Purpose

Make protected staging evidence repeatable for the current active pilot
personas: `SUPER_ADMIN`, `HR_ADMIN`, `REGION_MANAGER`, `STORE_MANAGER`,
`STORE_PERSONNEL`, and `REPORT_VIEWER`.

This runbook complements
`docs/plans/clerk-persona-staging-evidence-runbook-v1.md`. It does not require a
new role. `INTEGRATION_ADMIN` is not required for the current pilot path; import
and integration proof can be carried by `SUPER_ADMIN` or explicitly authorized
admin personas when a later evidence pass scopes that work.

## Sokrates Decision

Claim: protected persona evidence must be role-specific and scope-specific, not
only "logged in user can open the app".

Assumption: Clerk authenticates the person, while the application DB remains the
source of truth for role, scope, action-store assignment, and route/action
permission.

Evidence:

- `docs/architecture/pilot-route-role-matrix.md` maps pilot routes to roles.
- `docs/plans/scope-auth-regression-matrix-v1.md` maps backend auth/scope
  behavior to existing tests.
- `docs/evidence/system-flow/clerk-persona-live-evidence-2026-05-22.md`
  records that live persona proof is possible with real tokens.

Counterargument: browser route proof alone is not enough; a route can render
while backend endpoint authorization is wrong.

Risk: MEDIUM. The runbook itself is docs-only, but executing it touches real
staging accounts and bearer/session tokens.

Door: two-way-door for the runbook. Near-one-way-door for leaking secrets or
mutating staging data without scoped approval.

Stop rule: stop immediately if the proof requires writing raw token, cookie,
JWT, auth code, provider subject, password, private email contents, or provider
dashboard secrets into repo docs or PR comments.

Verification ladder:

1. Public staging health and assets.
2. Browser route visibility per persona.
3. Backend session endpoint per persona.
4. Positive read-scope proof for assigned/allowed data.
5. Negative scope proof for unassigned/forbidden data.
6. Store Action command proof only for `STORE_MANAGER` assigned-store cases.

## Secret Handling Rules

- Tokens stay in local environment variables only.
- Never commit `.env`, screenshots with tokens, cookies, auth codes, or provider
  identifiers.
- Evidence may include role name, sanitized route path, HTTP status, command
  name, timestamp, and "passed/skipped/blocked".
- Evidence must not include bearer token text, cookie text, raw JWT payload,
  password, private user ID, or provider subject.

## Persona Matrix

| Persona | Required Route Proof | Required Backend Proof | Required Negative Proof | Notes |
| --- | --- | --- | --- | --- |
| `SUPER_ADMIN` | `/admin/integrations`, `/admin/auth`, `/admin/session`, `/store/tasks` if super admin has store shell assignment. | Session context, admin read endpoint, optional import/readiness endpoint. | Store Action command must still honor action-store scope if no assigned store exists. | Broadest admin proof, but not a bypass for store action scoping. |
| `HR_ADMIN` | `/admin/competitions`, `/admin/master-data`, `/admin/checklists`, relevant admin reports if configured. | Session context, HR-visible read endpoint, workflow or checklist read where applicable. | `/admin/auth` and other super-admin-only writes must not be available unless explicitly scoped. | Can carry operator/admin evidence without adding `INTEGRATION_ADMIN`. |
| `REGION_MANAGER` | `/store/home`, `/admin/targets`, `/admin/competitions`, `/store/rankings`, region/store follow-up routes where scoped. | Session context, region read scope, assigned action-store count when applicable. | `/admin/auth`, `/admin/master-data`, and `/admin/integrations` must show forbidden route state; auth-admin endpoints must return `403`. | Region manager default landing is `/store/home`; admin target route remains allowed by direct navigation. |
| `STORE_MANAGER` | `/store`, `/store/me`, `/store/tasks`, `/store/approvals`, `/store/kpis`, `/store/rankings`. | Store session, assigned-store reads, Store Action list, create/status/close/cancel only for assigned store. | Unassigned store action commands return forbidden/blocked and do not mutate data. | Main Store Action pilot persona. |
| `STORE_PERSONNEL` | `/store`, `/store/me`, `/store/rankings`, allowed store read surfaces. | Store session and personnel read scope. | No admin shell; no Store Action command controls; no manager-only approvals. | Use this to prove the UI is not overexposing command surfaces. |
| `REPORT_VIEWER` | `/admin/reports`, `/admin/targets`, `/admin/inbox`. | Reporting/read-only endpoint and workflow inbox read if scoped. | No Store Action plan command controls; no auth/admin mutation surfaces. | Read-only evidence persona. |

## Environment Variables

Use the exact variable names consumed by the smoke scripts. Do not invent
persona-specific names unless a script has been updated to read them.

```powershell
$env:READINESS_FRONTEND_URL='https://staging.hr-axis.com'
$env:READINESS_BACKEND_URL='https://api-staging.hr-axis.com/api'
$env:READINESS_ENVIRONMENT='staging'
$env:READINESS_TIMEOUT_MS='45000'

# Optional, secret, never committed:
$env:READINESS_BEARER_TOKEN='<securely pasted token>'
$env:BACKEND_LOAD_SESSION_TOKEN='<securely pasted token>'
$env:BACKEND_LOAD_STORE_TOKEN='<securely pasted token>'
$env:BACKEND_LOAD_COMPETITION_TOKEN='<securely pasted token>'
$env:BACKEND_LOAD_HR_ADMIN_TOKEN='<securely pasted token>'
$env:BACKEND_LOAD_IMPORT_TOKEN='<securely pasted token>'
```

`smoke:backend-readiness-load` currently groups protected checks by session,
store, competition, and import/read surfaces. The persona evidence note should
record which real persona supplied each group token, but the environment
variable name must stay one of the script-supported names above.

## Run Order

1. Public staging preflight:

   ```powershell
   npm.cmd run smoke:deployed-readiness
   npm.cmd run smoke:alert-routing
   ```

2. Protected readiness with one valid persona token:

   ```powershell
   npm.cmd run smoke:deployed-readiness
   ```

3. Role-specific backend load/scope smoke:

   ```powershell
   npm.cmd run smoke:backend-readiness-load
   ```

4. If Store Action command evidence is in scope, use only assigned-store data
   and only the explicit Store Action smoke/runbook for the manager persona.
   Negative unassigned-store proof is required before calling the slice closed.

5. Record sanitized evidence in a dated file under
   `docs/evidence/pilot-readiness/` or `docs/evidence/system-flow/`.

## Evidence Template

```markdown
# Pilot Persona Evidence - YYYY-MM-DD

Environment: staging
Frontend: https://staging.hr-axis.com
Backend: https://api-staging.hr-axis.com/api

## Summary

- SUPER_ADMIN: passed/blocked/skipped
- HR_ADMIN: passed/blocked/skipped
- REGION_MANAGER: passed/blocked/skipped
- STORE_MANAGER: passed/blocked/skipped
- STORE_PERSONNEL: passed/blocked/skipped
- REPORT_VIEWER: passed/blocked/skipped

## Commands

- `npm.cmd run smoke:deployed-readiness`: result
- `npm.cmd run smoke:backend-readiness-load`: result

## Protected Findings

- Route visibility:
- Backend session:
- Positive scope:
- Negative scope:
- Store Action action-store scope:

## Redaction Check

- Raw tokens/cookies/JWTs included: no
- Provider subject/private IDs included: no
- Private screenshot data included: no
```

## Done Criteria

- Every in-scope persona has a route visibility result.
- Every in-scope persona has a backend session/read result or an explicit
  blocker.
- Store manager action proof includes assigned and unassigned store outcomes if
  command behavior is being claimed.
- Report viewer and store personnel are proven read-only for command surfaces.
- Evidence names the exact skipped checks and why.
