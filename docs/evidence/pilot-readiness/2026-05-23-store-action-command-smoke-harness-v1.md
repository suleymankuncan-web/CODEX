# Store Action Command Smoke Harness V1 - 2026-05-23

## Reader And Action

Reader:

- the pilot moderator, support engineer, QA operator, product owner, or future
  agent deciding how to prove the live Store Action command loop safely.

After reading, they should be able to:

- run the Store Action command proof with a real staging `STORE_MANAGER` token,
- understand why the proof is not run automatically from a tokenless shell,
- know what data is intentionally mutated,
- avoid recording secrets or fake evidence.

## Scope

Mode:

- smoke-harness and docs/evidence slice

This slice adds a testable staging smoke command. It does not change product
code, API response shape, auth/permission behavior, DB schema, CSS, Clerk/Render
provider configuration, role assignment, or user-facing workflow behavior.

## Sokrates Decision

Claim:

- The project already has local Store Action lifecycle coverage, but the live
  staging command proof needs a dedicated token-safe Store Action smoke harness.

Assumptions:

- Live command proof must be explicit because it creates operational state.
- A real staging token must stay in local environment variables only.
- A terminal Store Action smoke row is acceptable only after the operator
  explicitly acknowledges the staging mutation.

Repo evidence:

- `admin-web/e2e/store-action-plans.spec.ts` covers local list, create, status,
  close, cancel, failure, pagination, unsafe-link, and stale-page behavior.
- `/api/store-actions/plans` exposes create/status/close/cancel commands.
- Store Action write commands require `STORE_MANAGER` or `SUPER_ADMIN` and
  assigned-store action scope.
- Existing token-scope smoke proves a read-only action-scope guard, but does
  not exercise Store Action plan commands.
- The assisted persona rehearsal did not observe create/status/close/cancel
  controls because it did not use a named active action plan/candidate with a
  rollback note.

Counterargument:

- The fastest route would be clicking live UI buttons manually. That can work,
  but it is harder to repeat, harder to redact, and easier to confuse with
  private browser/session evidence.

Risk:

- LOW for the harness and tests.
- MEDIUM/HIGH when running against staging because it creates two terminal
  Store Action plan rows.
- HIGH if raw tokens, cookies, passwords, provider IDs, or private data are
  copied into docs or PR comments.

Door:

- Harness is a two-way door.
- Live staging command execution is a medium-door action because rows remain as
  terminal evidence; there is no delete/rollback endpoint in V1B.

Stop rule:

- Do not run the staging command smoke without a fresh real bearer token, a
  known assigned store, a known unassigned negative-control store, and the
  explicit mutation acknowledgement.

## Added Harness

New command:

```powershell
npm.cmd --prefix admin-web run smoke:store-action:staging:command
```

New script:

- `admin-web/scripts/store-action-command-smoke.mjs`

New tests:

- `admin-web/scripts/store-action-command-smoke.test.mjs`

The script:

- fails before network access when no token is present,
- requires explicit staging mutation acknowledgement,
- sends the bearer token only in the `Authorization` header,
- does not print the raw token,
- checks `/auth/session` for the expected role and assigned store,
- creates one assigned-store plan, updates status, and closes it,
- creates a second assigned-store plan and cancels it,
- attempts an unassigned-store create and requires `403`,
- prints sanitized JSON evidence.

## Live Command Shape

Use only when the product owner/operator approves creating terminal staging
Store Action rows.

```powershell
$env:STORE_ACTION_SMOKE_API_BASE_URL='https://api-staging.hr-axis.com/api'
$env:STORE_ACTION_SMOKE_BEARER_TOKEN='<local-only bearer token from STORE_MANAGER staging session>'
$env:STORE_ACTION_SMOKE_EXPECTED_ROLE='STORE_MANAGER'
$env:STORE_ACTION_SMOKE_ENVIRONMENT='staging'
$env:STORE_ACTION_SMOKE_ASSIGNED_STORE_ID='00000000-0000-0000-0000-000000000100'
$env:STORE_ACTION_SMOKE_UNASSIGNED_STORE_ID='00000000-0000-0000-0000-000000000101'
$env:STORE_ACTION_SMOKE_ALLOW_STAGING_MUTATION='I_UNDERSTAND_THIS_CREATES_TERMINAL_STORE_ACTION_PLANS'
npm.cmd --prefix admin-web run smoke:store-action:staging:command
Remove-Item Env:STORE_ACTION_SMOKE_BEARER_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:STORE_ACTION_SMOKE_ALLOW_STAGING_MUTATION -ErrorAction SilentlyContinue
```

Expected sanitized result:

- `evidenceStatus=staging-store-action-command-smoke-passed`
- assigned-store create/status/close passes,
- assigned-store create/cancel passes,
- unassigned-store create returns `403`,
- no raw token, cookie, password, provider subject, private email, or JWT payload
  is printed.

## Current Live Status

Not run in this shell.

Reason:

- no `STORE_ACTION_SMOKE_BEARER_TOKEN`,
- no explicit staging mutation acknowledgement,
- no selected operator approval for creating terminal Store Action evidence
  rows in staging.

This is the correct stop. Local and script-level gates can pass without
pretending that live command proof happened.

## Verification Results

Local gates:

```powershell
npm.cmd --prefix admin-web run test:scripts
npm.cmd run test:scripts
git diff --check
```

Result:

- `admin-web` script tests: `25/25` passed.
- Root script tests: `309/309` passed.
- `git diff --check`: passed with only the existing Windows LF/CRLF warning.

## Next Action

When the user/operator is ready:

1. sign in as the real `STORE_MANAGER` staging persona,
2. provide the fresh token through local environment only,
3. confirm the assigned and unassigned store ids,
4. set the explicit mutation acknowledgement,
5. run the command and paste only sanitized output into a dated evidence file.

Until then, Store Action command proof status is:

- harness ready,
- live command proof blocked by missing secure token and explicit mutation
  approval.
