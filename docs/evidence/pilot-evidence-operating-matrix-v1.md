# Pilot Evidence Operating Matrix V1

Date: 2026-05-23

## Sokrates Decision

Claim: the next useful pilot reliability work is not more product code; it is
classifying which evidence is real, repeatable, blocked, stale, or only local.

Assumption: the project can stay in controlled pilot while we make the evidence
path stricter, as long as we do not pretend that tokenless or mock evidence
proves protected production behavior.

Evidence:

- `current-state.md` keeps controlled staging/internal pilot as Conditional Go
  and broad production as No-Go.
- `docs/evidence/system-flow/clerk-persona-live-evidence-2026-05-22.md`
  records a real Clerk persona proof from the previous live pass.
- `docs/evidence/system-flow/clerk-persona-live-evidence-2026-05-23.md`
  refreshes protected Clerk proof for the existing staging pilot accounts.
- Public staging smoke on 2026-05-23 reached the deployed frontend and backend
  without a bearer token.
- Protected load/auth smokes in this shell skipped role-specific checks because
  no token environment variables were present.

Counterargument: docs-only matrices do not make the product safer by themselves.
They only help if future pilot and release work uses them as a gate.

Risk: LOW for this document. HIGH for any future step that handles raw tokens,
provider dashboards, restore targets, uploads, or production data.

Door: two-way-door. The matrix can be updated as evidence becomes fresh.

Stop rule: do not count a smoke, mock, local fixture, tokenless check, or
provider status page as real protected evidence.

Verification ladder:

1. Local tests and build prove repo-level safety.
2. Public staging smokes prove deployed unauthenticated reachability.
3. Protected staging smokes prove role/scope behavior only when real sanitized
   persona tokens are available.
4. Provider evidence proves external delivery only when provider metadata or
   panel evidence exists and secrets are redacted.
5. Production readiness stays No-Go until the above classes are current enough
   for the intended rollout.

## Evidence Classes

| Class | Meaning | Current Status | How To Refresh |
| --- | --- | --- | --- |
| Local test | Unit, script, build, Playwright, and generated-contract checks run in this workspace. | Available and repeatable. Store Action lifecycle coverage is split into `admin-web/e2e/store-action-plans.spec.ts`; root script gates exist. | Run the relevant local gate before each PR. Record only command, date, result, and sanitized failures. |
| Public staging | Deployed frontend/backend checks that do not need secrets. | Fresh tokenless public checks passed on 2026-05-23. | Run `smoke:deployed-readiness`, `smoke:alert-routing`, and public load smoke with staging URLs. |
| Protected staging | Clerk/persona route visibility, backend endpoint access, read scope, and assigned-store action scope. | Fresh real Clerk proof exists from 2026-05-23 for the full current five-persona matrix: `SUPER_ADMIN`, `HR_ADMIN`, `STORE_MANAGER`, `STORE_PERSONNEL`, and `REPORT_VIEWER`. | Use the persona runbook with sanitized token handling. Never write raw bearer tokens, cookies, JWTs, auth codes, provider subject IDs, or private PII. |
| Provider | Alert delivery, Redis/BullMQ, Supabase restore, upload provider path, Vercel/Render deployment evidence. | Mixed but no longer one generic blocker. Redis/BullMQ is live in staging health; the Redis posture decision accepts Free tier only for controlled pilot and requires persistent Redis or explicit risk acceptance before broad production. Render Slack notification delivery, Better Stack external email test alert delivery, Supabase local logical restore, and current controlled-pilot safe upload proof are recorded. App-level error tracking policy and managed restore/PITR posture still need explicit owner decisions. | Use provider-specific runbooks and redact destinations/secrets. |
| Blocked | Evidence that cannot be produced from the current shell without user/provider input. | Current blockers are production-grade Redis upgrade/evidence before broad production, app-level error tracking if required for broad production, an explicitly disposable managed Supabase restore target if required, and any future upload rerun that changes role/sample requirements. The Clerk five-persona matrix, controlled-pilot external email alert proof, Redis controlled-pilot posture, and current controlled-pilot upload proof are no longer blocked. | Record as blocker; do not fake. |
| Outdated | Evidence that was valid for an older deploy/config but should not be used as current proof. | Older May 1-9 pilot/readiness notes remain useful history but are superseded for present rollout decisions. | Keep as history, and require fresh public/protected/provider evidence before widening pilot scope. |

## 2026-05-23 Fresh Public Evidence

### Deployed Readiness Smoke

Command:

```powershell
$env:READINESS_FRONTEND_URL='https://staging.hr-axis.com'
$env:READINESS_BACKEND_URL='https://api-staging.hr-axis.com/api'
$env:READINESS_ENVIRONMENT='staging'
$env:READINESS_TIMEOUT_MS='45000'
npm.cmd run smoke:deployed-readiness
```

Result:

- Status: `ok`
- Evidence time: `2026-05-23T01:48:49.584Z`
- Total checks: 14
- Passed: 13
- Failed: 0
- Skipped: 1
- Skipped reason: no `READINESS_BEARER_TOKEN`, so backend auth session was not
  tested.
- Backend health: 200
- Backend dependency health: 200
- Queue backend: `bullmq`
- Queue status: `durable`
- Redis required: `true`
- Database status: `ok`
- Redis status: `ok`
- Readiness profile: `controlled-pilot`
- Error tracking: `not-enabled`/log-only in this smoke.

### Backend Public Load Smoke

Command:

```powershell
$env:BACKEND_LOAD_API_BASE_URL='https://api-staging.hr-axis.com/api'
$env:BACKEND_LOAD_ENVIRONMENT='staging'
$env:BACKEND_LOAD_ITERATIONS='3'
$env:BACKEND_LOAD_CONCURRENCY='2'
$env:BACKEND_LOAD_TIMEOUT_MS='45000'
npm.cmd run smoke:backend-readiness-load
```

Result:

- Status: `blocked`
- Public `/health` group: passed
- Availability: 100%
- p50: `101.9ms`
- p95: `259.57ms`
- 5xx: 0
- Authenticated session/store read/competition read/import read groups: skipped
  because no role-specific bearer token was present.
- Mutating routes remained excluded.

### Alert Routing Smoke

Command:

```powershell
$env:ALERT_SMOKE_BACKEND_URL='https://api-staging.hr-axis.com/api'
$env:ALERT_SMOKE_ENVIRONMENT='staging'
npm.cmd run smoke:alert-routing
```

Result:

- Status: `ok`
- Evidence time: `2026-05-23T01:48:47.308Z`
- Total checks: 5
- Passed: 4
- Failed: 0
- Skipped: 1
- Provider delivery: `not-configured`
- Provider metadata: skipped because no provider metadata was available.
- Backend health alert signal: 200 / `ok`

## 2026-05-23 Fresh Protected Evidence

Source:

- `docs/evidence/system-flow/clerk-persona-live-evidence-2026-05-23.md`

Result:

- Full pilot persona browser/session smoke passed for `SUPER_ADMIN`,
  `HR_ADMIN`, `STORE_MANAGER`, `STORE_PERSONNEL`, and `REPORT_VIEWER`.
- Same-session route allow/deny checks passed for the sampled admin and store
  routes.
- Report-viewer `/store/tasks` is intentionally read-only visible; Store Action
  create/status/close/cancel controls were absent for that persona.
- Non-super-admin auth-admin negative checks returned `403`.
- Store-manager action-scope read: assigned store returned `200` with 7 rows;
  unassigned store returned `403` with `Out-of-scope store action`.
- Deployed readiness with a real token: `14/14` passed, no skipped checks.
- Backend protected load with role-specific tokens: `5/5` groups passed, no
  skipped groups.
- This is controlled-pilot protected evidence, not broad-production approval.

## Current Blocker Register

| Blocker | Why It Matters | Current Handling |
| --- | --- | --- |
| Fresh role-specific Clerk bearer/session tokens | Needed to prove protected route visibility, backend endpoint authorization, and assigned-store scoping after the latest deploy. | Closed for the current five-persona matrix on 2026-05-23. |
| Alert provider metadata or panel proof | Needed to prove real external delivery, not only log-only alert routing. | Closed for controlled pilot by Render Slack delivery plus Better Stack external email test alert delivery on 2026-05-23. Broad production still needs an explicit incident policy and app-level error-tracking decision. |
| Production-grade Redis tier/evidence | Needed before treating BullMQ queue state as broad-production durable. | Controlled-pilot Free tier is accepted on 2026-05-23; broad production remains blocked until persistent Redis-compatible tier evidence or explicit written risk acceptance exists. |
| Disposable Supabase restore target | Needed to prove managed restore without touching production/staging data. | Blocked until an explicitly disposable target is approved. |
| Authenticated upload token and sample file | Needed to prove import upload authorization and resource guardrails on staging. | Closed for the current controlled-pilot `SUPER_ADMIN` operator path by the safe staging upload proof. Future role-specific reruns remain blocked until a real allowed persona and safe sample file are explicitly in scope. |
| Protected latency tokens | Needed to turn public load smoke into role-specific latency evidence. | Closed for sampled session/store/competition/import groups on 2026-05-23 with local-only role-specific Clerk tokens. Rerun is required after deploy/config changes. |

## Operating Rules

- Real evidence can be local, public staging, protected staging, or provider
  evidence, but its class must be named.
- A skipped protected check is not a failure, but it is also not proof.
- Historical proof remains useful only if the same deploy/config/path is still
  in force or the document explicitly says it is historical.
- If evidence needs a secret, record the missing input and continue with
  tokenless checks only.
- If a new pilot decision depends on a blocked class, the decision is not ready.
