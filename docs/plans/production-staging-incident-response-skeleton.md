# Production And Staging Incident Response Skeleton

## Metadata

- Status: V1 skeleton for staging, pilot, and production incident rehearsals.
- Owner: Release operator with backend, frontend, data, and business sign-off.
- Last updated: 2026-05-18.
- Purpose: Give auth, import/data quality, and deploy/release failures a calm operating path before real users depend on the system.

## Decision Rule

Every staging or production incident must end with one recorded decision: Rollback / Forward-fix / No-Go.

Do not continue a release, migration, import, or auth rollout when the evidence owner cannot explain the current blast radius, affected users, and safest next action.

This skeleton does not invent hosting-provider commands. Target-specific commands belong in the deployment runbook once the real staging or production platform is known.

## Incident Severity

| Severity | Meaning | Required response |
| --- | --- | --- |
| P0 | Unauthorized access, data exposure risk, production unavailable, destructive migration risk, or a real user cannot complete a critical flow. | Stop the release, assign owner, preserve sanitized evidence, decide Rollback / Forward-fix / No-Go. |
| P1 | Auth, import, reporting, or deploy issue affects a limited pilot/staging group without data exposure. | Assign owner, contain scope, record decision, follow up before broad rollout. |
| P2 | Non-blocking evidence, copy, UI, or documentation issue with no user/data risk. | Track as follow-up with owner and date. |

## Alert Trigger Playbooks

Alert routing is metadata-only until an approved provider destination is configured outside source control. The local guard is:

```powershell
cd "<workspace-root>"
npm.cmd run smoke:alert-routing
```

For deployed staging evidence, include the backend URL:

```powershell
$env:ALERT_SMOKE_ENVIRONMENT="staging"
$env:ALERT_SMOKE_BACKEND_URL="https://api-staging.hr-axis.com/api"
npm.cmd run smoke:alert-routing
```

For the current controlled staging/internal pilot alert decision, use
`docs/plans/controlled-pilot-alert-incident-policy-v1.md`. That policy accepts
Better Stack external health email proof plus Render platform notifications for
controlled pilot only. It does not claim broad-production incident readiness or
app-level exception tracking.

Alert response rules:

| Alert id | First response | Owner path |
| --- | --- | --- |
| `backend-health-down` | Stop release or rollout, run deployed readiness smoke, inspect Render logs by correlation id, decide Rollback / Forward-fix / No-Go. | Incident lead -> Release operator -> Backend owner |
| `backend-5xx-spike` | Group errors by path and correlation id, identify failing dependency or route, preserve redacted structured logs. | Incident lead -> Backend owner |
| `auth-session-failure-spike` | Run auth staging action smoke and evidence guard; treat unauthorized success as P0. | Incident lead -> Backend owner -> Business approver |
| `import-failure-spike` | Pause import/materialization jobs, record batch/source/entity evidence, do not retry until idempotency impact is understood. | Incident lead -> Data owner |
| `snapshot-worker-failure` | Pause dependent reporting decisions, inspect snapshot run lineage, rerun only after dependency cause is known. | Incident lead -> Data owner -> Backend owner |
| `database-latency-high` | Check provider health, migration state, pool pressure, and recent query-heavy changes. | Incident lead -> Backend owner |
| `frontend-unreachable` | Verify Vercel deployment, frontend root, SPA fallback, static assets, and backend API reachability. | Incident lead -> Frontend owner -> Release operator |
| `observability-degraded` | Keep broad rollout blocked until provider decision, DSN setup, or written Conditional Go risk acceptance exists. | Incident lead -> Backend owner -> Business approver |

Minimum alert evidence:

- alert id,
- environment,
- detected at,
- detected by,
- severity,
- owner role,
- primary and backup response path,
- related correlation id when present,
- guarded command result,
- sanitized evidence link,
- decision.

## Roles And Ownership

| Role | Responsibility |
| --- | --- |
| Incident lead | Owns the timeline, current severity, and final decision record. |
| Release operator | Stops or resumes deploy steps and runs guarded release/smoke commands. |
| Backend owner | Reviews API health, auth verification, queue/import behavior, and server logs. |
| Frontend owner | Reviews UI availability, callback/logout behavior, and browser-facing evidence. |
| Data owner | Reviews migration, import batch, data quality, lineage, and snapshot impact. |
| Business approver | Accepts Conditional Go or No-Go decisions when user-facing risk remains. |

## Triage Flow

1. Stop the release if the issue appears during deploy, migration, auth smoke, or import smoke.
2. Identify the failing surface: auth, import/data quality, deploy/release, database/migration, or frontend reachability.
3. Name one incident lead and one evidence owner.
4. Capture Sanitized evidence only.
5. Decide current severity: P0, P1, or P2.
6. Contain blast radius: pause deploy, pause import/materialization jobs, disable scheduled workers, or keep users on the previous artifact.
7. Run only approved guarded commands.
8. Decide Rollback / Forward-fix / No-Go.
9. Record the incident note and post-incident follow-up.

## Auth Incident Playbook

Use this when login, logout, session bootstrap, read scope, action scope, or store assignment behavior fails.

Immediate containment:

- Stop the release.
- Do not broaden IdP access while the failure is unexplained.
- Keep mock auth disabled for staging and production.
- Treat any unauthorized action success as P0.

Evidence commands:

```powershell
cd "<workspace-root>\admin-web"
npm.cmd run smoke:auth:staging:action
npm.cmd run guard:auth:evidence
```

Expected checks:

- PKCE login succeeds.
- Logout returns to `/auth/login`.
- `/api/auth/session` returns expected role, read scope, and action scope.
- assigned-store action returns success.
- unassigned-store action returns `403`.
- Expired bearer token is cleared before API headers are sent.

Rollback triggers:

- unauthorized action succeeds
- assigned-store action fails for a valid user
- backend cannot verify real IdP tokens
- provider issuer/audience/JWKS values are unknown
- evidence contains raw token material

## Import And Data Quality Incident Playbook

Use this when import batches, materialization, data quality summaries, lineage evidence, or snapshot inputs fail.

Immediate containment:

- pause import/materialization jobs
- pause snapshot or closure jobs if they could consume partial data
- do not rerun the same batch until the idempotency and row hash impact is understood
- keep raw failed rows for evidence, but redact sensitive payload values before sharing

Evidence to capture:

- import batch id
- source id
- entity type
- processed row count
- failed row count
- dominant `qualityIssueCode`
- row hash and raw row reference for sample failed rows
- whether the issue is retryable or operator-cleanup

Decision checks:

- If the failure is caused by unknown source semantics, No-Go the source enablement.
- If rows are valid but mapping is wrong, Forward-fix only after the source mapping spec is updated.
- If a destructive migration or write caused data damage, prefer rollback or database restore over repeated import retries.

JSON source holding rule:

- Do not create a source-specific JSON adapter during an incident.
- JSON source integration is suspended for the current pilot and Power BI/Excel operating path.
- Power BI/Excel remains the active operating source.
- Do not plan or staff JSON implementation work while Power BI/Excel outputs remain the chosen operating source.
- If the product owner reopens JSON later, first update the source mapping spec.
- Then map into the canonical raw KPI contract.

## Deploy And Release Incident Playbook

Use this when release gate, backend deploy, frontend deploy, audit, build, Playwright, migration, or post-deploy health fails.

Pre-release command:

```powershell
cd "<workspace-root>"
npm.cmd run check:release
```

Immediate containment:

- Stop the release.
- Do not skip tests to make the deploy pass.
- Do not deploy frontend pointing at an unverified backend.
- Do not start backend against an unknown migration state.
- Keep previous artifact available until smoke evidence passes.

Rollback triggers:

- `npm.cmd run check:release` fails
- backend health fails after deploy
- frontend cannot reach backend API
- migration state is unknown
- audit or evidence guard fails
- auth smoke fails after deploy

Rollback options:

- revert frontend artifact to previous build
- revert backend artifact to previous build
- disable scheduled workers or closure automation
- restore database backup if a destructive migration caused data damage
- Forward-fix only when rollback would increase user or data risk

## Evidence And Secret Rules

Sanitized evidence only.

- Do not paste raw bearer tokens.
- Do not paste raw id tokens.
- Do not paste refresh tokens.
- Do not paste authorization codes.
- Do not paste PKCE verifier values.
- Do not paste client secrets.
- Do not paste production database URLs.
- Do not paste private keys.
- Do not store production credentials in screenshots.
- Redact provider query strings before sharing login/callback evidence.

## Incident Note Template

Use this block for every P0/P1 incident:

```markdown
## Incident Note

- Environment:
- Severity: P0 / P1 / P2
- Incident lead:
- Evidence owner:
- Started at:
- Detected by:
- Affected surface: auth / import / deploy / database / frontend / other
- Affected users or scope:
- Current status:
- Guarded command results:
- Sanitized evidence link or location:
- Containment action:
- Decision: Rollback / Forward-fix / No-Go
- Business approver:
- Follow-up owner:
- Follow-up due date:
```

## Post-Incident Review

Complete this after every P0 and after any repeated P1:

- What failed?
- Why did the current gate not catch it earlier?
- Was the blast radius limited?
- Was evidence sanitized?
- Was rollback faster than forward-fix?
- Which test, runbook, guard, or checklist must be updated?
- Does this reveal a real product requirement or only an environment/configuration gap?

## CODEX Durust Yorum

This is not a new feature. It is operational muscle. The project already has strong local release gates, auth evidence guards, data quality summaries, and environment drift checks. The remaining real-world risk is what happens under pressure: a failed deploy, a broken provider setting, an import batch that looks dangerous, or a migration question at the wrong hour.

This skeleton keeps that moment from becoming improvisation. It also avoids overbuilding: no fake hosting commands, no invented JSON adapter, and no hidden assumption that staging details exist before they do.

## Next Logical Step

When real staging hosting and IdP details are known, copy this skeleton into a target-specific incident runbook with real contact names, real deploy console links, and approved rollback commands.
