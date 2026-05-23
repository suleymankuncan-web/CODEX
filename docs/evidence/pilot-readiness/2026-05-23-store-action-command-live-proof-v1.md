# Store Action Command Live Proof V1 - 2026-05-23

## Reader And Action

Reader:

- the pilot moderator, support engineer, QA operator, product owner, or future
  agent deciding whether Store Action command-mode proof is closed for the
  controlled pilot.

After reading, they should be able to:

- see that live staging Store Action create/status/close/cancel was exercised,
- see that unassigned-store command access still failed closed,
- know exactly which evidence is claimed and which rollout decision is not
  claimed,
- avoid rerunning mutation proof casually.

## Scope

Mode:

- live protected staging command smoke

Environment:

- backend staging API: `https://api-staging.hr-axis.com/api`
- frontend session source: signed-in staging browser session
- auth provider: Clerk session token synced into the app bearer-token contract
- command time: `2026-05-23T15:09:30Z` (`2026-05-23 18:09 +03`)

This proof intentionally excludes raw bearer tokens, Clerk cookies, passwords,
provider subjects, private user IDs, employee IDs, full JWT payloads, private
emails, screenshots, direct DB rows, and private personal data.

## Sokrates Decision

Claim:

- Store Action command-mode proof can be closed for the controlled pilot path:
  a real `STORE_MANAGER` session created, updated, closed, and cancelled
  assigned-store action plans, while an unassigned-store create attempt returned
  `403`.

Assumptions:

- The browser session used for the token was the active staging
  `STORE_MANAGER` pilot persona.
- Application DB role/scope/action-store assignment remains the source of
  truth; Clerk identity alone is not treated as authorization.
- Terminal smoke rows are acceptable as controlled-pilot evidence because the
  product owner explicitly chose to close this proof.

Repo evidence:

- `admin-web/scripts/store-action-command-smoke.mjs` sends the token only in the
  `Authorization` header and prints sanitized JSON.
- `admin-web/scripts/store-action-command-smoke.test.mjs` verifies missing-token
  fail-fast, explicit staging mutation acknowledgement, sanitized output,
  assigned-store command flow, and unassigned-store `403` handling.
- `docs/evidence/pilot-readiness/2026-05-23-store-action-command-smoke-harness-v1.md`
  records the smoke harness and its run requirements.

Counterargument:

- This is still a targeted command smoke, not a full human usability test of
  every Store Action UI path. Correct: it closes command authorization/lifecycle
  evidence, not broad UX readiness or production rollout.

Risk:

- MEDIUM for live staging because the smoke created terminal Store Action plan
  rows.
- LOW after completion because both created rows are terminal (`closed` and
  `cancelled`) and source ids are traceable to the smoke prefix.
- HIGH if this evidence is reused to justify broad production without separate
  load, incident, restore, data-quality, and operator-process sign-off.

Door:

- Medium-door for staging data because the current V1B API has no delete
  endpoint. The rollback/cleanup shape is to leave terminal rows as auditable
  smoke evidence.

Stop rule:

- Stop before any rerun unless a fresh `STORE_MANAGER` token, assigned store,
  unassigned negative-control store, and explicit mutation acknowledgement are
  present.

Verification ladder:

1. Real `/auth/session` resolves `STORE_MANAGER`.
2. Session has exactly one assigned action store for the smoke.
3. Assigned-store create succeeds.
4. Assigned-store status update succeeds.
5. Assigned-store close succeeds.
6. Assigned-store create plus cancel succeeds.
7. Unassigned-store create returns `403`.
8. Token and private identity material are not recorded.

## Command

The token was copied from the signed-in staging browser into local environment
only, then cleared from the environment and clipboard after the command.

```powershell
$env:STORE_ACTION_SMOKE_API_BASE_URL='https://api-staging.hr-axis.com/api'
$env:STORE_ACTION_SMOKE_BEARER_TOKEN='<local-only redacted token>'
$env:STORE_ACTION_SMOKE_EXPECTED_ROLE='STORE_MANAGER'
$env:STORE_ACTION_SMOKE_ENVIRONMENT='staging'
$env:STORE_ACTION_SMOKE_ASSIGNED_STORE_ID='<resolved assigned store id>'
$env:STORE_ACTION_SMOKE_UNASSIGNED_STORE_ID='00000000-0000-0000-0000-000000000101'
$env:STORE_ACTION_SMOKE_ALLOW_STAGING_MUTATION='I_UNDERSTAND_THIS_CREATES_TERMINAL_STORE_ACTION_PLANS'
npm.cmd --prefix admin-web run smoke:store-action:staging:command
```

Post-run cleanup:

- `STORE_ACTION_SMOKE_BEARER_TOKEN`: removed from environment
- `STORE_ACTION_SMOKE_ALLOW_STAGING_MUTATION`: removed from environment
- clipboard: cleared

## Sanitized Result

Smoke exit:

- `exit code`: `0`
- `evidenceStatus`: `staging-store-action-command-smoke-passed`

Session:

- `authMode`: `jwt`
- `authenticated`: `true`
- resolved roles:
  - `STORE_MANAGER`
- scope summary:
  - `companyCount=1`
  - `regionCount=1`
  - `storeCount=1`
  - `assignedStoreCount=1`

Assigned-store command smoke:

| Step | HTTP | Command status | Result status |
| --- | --- | --- | --- |
| Create close-lifecycle plan | `201` | `created` | `open` |
| Update close-lifecycle plan | `200` | `updated` | `in_progress` |
| Close close-lifecycle plan | `200` | `closed` | `closed` |
| Create cancel-lifecycle plan | `201` | `created` | `open` |
| Cancel cancel-lifecycle plan | `200` | `cancelled` | `cancelled` |

Unassigned-store negative smoke:

- Endpoint: `POST /store-actions/plans`
- HTTP status: `403`
- Message: `Out-of-scope store action`
- DB write expected: `false`

Traceability:

- source prefix: `store-action-smoke:2026-05-23T18-09-28+03:00`
- source type: `kpi_exception`
- terminal rows:
  - close-lifecycle row ended as `closed`
  - cancel-lifecycle row ended as `cancelled`

## Decision

Store Action command-mode controlled-pilot proof: `Closed`.

Controlled pilot: `Conditional Go / Continue`.

Broad production: still `No-Go`.

Why:

- A real `STORE_MANAGER` session exercised the assigned-store Store Action
  lifecycle.
- The unassigned-store negative command failed closed with `403`.
- No raw token or private identity material is stored in this evidence.

## Remaining Limits

This proof does not claim:

- broad production readiness,
- full UI usability,
- non-KPI Store Action source families,
- comments, attachments, notifications, escalation, AI coaching, or detail
  route readiness,
- cross-role Store Action command ownership beyond the tested
  `STORE_MANAGER` path.

## Next Action

Keep Store Action V1B in controlled pilot. Do not rerun command smoke unless a
new deploy or auth/scope change makes command proof stale.

