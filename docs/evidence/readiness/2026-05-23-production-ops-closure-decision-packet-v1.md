# Production Ops Closure Decision Packet V1 - 2026-05-23

## Scope

This packet closes Track 8 of the project-growth roadmap as a decision and
owner-acceptance map.

It does not approve broad production rollout, change provider configuration,
run a restore, change code, change API response shape, change auth/permission
semantics, add a DB migration, change CSS, or change user-facing workflow
behavior.

It records no raw bearer tokens, cookies, auth codes, provider subject IDs,
database URLs, Redis URLs, passwords, provider tokens, Slack webhooks, message
IDs, private keys, private email contents, or private payloads.

## Sokrates Decision

Decision:

- Controlled pilot remains `Conditional Go / Continue`.
- Broad production remains `No-Go`.
- The remaining gap is not application code. It is owner acceptance for provider tiers, recovery posture, incident ownership, and post-config smoke reruns.

Evidence:

- Redis / BullMQ staging health and production posture:
  `docs/evidence/readiness/2026-05-23-redis-production-posture-v1.md`.
- Supabase logical restore and recovery posture:
  `docs/evidence/readiness/2026-05-23-supabase-recovery-posture-v1.md`.
- Better Stack email alert proof:
  `docs/evidence/readiness/2026-05-23-better-stack-email-alert-proof-v1.md`.
- External evidence closure:
  `docs/evidence/readiness/2026-05-23-external-evidence-closure-decision-v1.md`.
- Original production readiness decision:
  `docs/evidence/readiness/2026-05-18-production-readiness-decision.md`.
- Joint closure plan:
  `docs/plans/production-evidence-closure-joint-plan-v1.md`.

Counterargument:

- The project has strong staging evidence, so it can feel like broad production
  is only a label away. That is the dangerous interpretation. Provider tier
  durability, recovery point/time expectations, incident ownership, and final
  protected-route smoke are operational commitments, not code completeness.

Risk:

- This docs packet: LOW.
- Controlled pilot under current limits: LOW/MEDIUM.
- Broad production without the owner decisions below: HIGH.

Door:

- Keeping broad production parked is a two-way-door.
- Widening rollout while Redis, recovery, incident, and rollback ownership are
  unresolved is close to one-way-door because failures become user-visible.

Stop rule:

- Stop if someone tries to convert this packet into a broad-production Go
  without the owner acceptance rows marked accepted and the post-config smoke
  ladder rerun.

## Current Posture

| Area | Controlled Pilot | Broad Production | Current Decision |
| --- | --- | --- | --- |
| Redis / BullMQ | Accepted with Render Key Value Free-tier risk and `READINESS_PROFILE=controlled-pilot`. | No-Go on Free/non-persistent tier unless explicit written risk acceptance exists. | Upgrade to persistent Redis-compatible tier before broad rollout, or record owner risk acceptance. |
| Supabase recovery | Accepted with app-owned schema logical restore proof. | No-Go until managed restore/PITR/RPO/RTO posture is accepted or tested. | Owner must choose daily backup/managed restore, PITR, manual logical restore, or written risk acceptance. |
| Alert delivery | Render Slack and Better Stack email monitor proof support controlled pilot. | No-Go until incident policy and app-level error-tracking decision are accepted. | Owner must decide whether Better Stack + Render notifications are enough for V1 or whether app-level tracking is required. |
| Protected persona/performance smoke | Existing controlled-pilot evidence is accepted. | Needs rerun after final broad-production provider/env changes. | Do not reuse old tokens/evidence after production config changes. |
| Upload/import operations | Current `SUPER_ADMIN` path is accepted for controlled pilot. | Role delegation needs a separate auth/API proof if ownership changes. | No `INTEGRATION_ADMIN` role is required by default. |
| Rollback authority | Controlled-pilot rollback can pause pilot, revert deploy, and rerun/reconcile jobs. | Must be named before broad production. | Owner must name who can pause rollout, revert deploy, disable imports/jobs, and approve recovery. |

## Owner Acceptance Checklist

Broad production can move out of `No-Go` only when each row has a named owner,
dated decision, sanitized evidence, and rollback note.

| Decision | Required owner choice | Accepted values | Evidence needed |
| --- | --- | --- | --- |
| Redis tier | Is queue/rate-limit durability required for launch? | persistent tier, alternative provider, or explicit risk acceptance | `/api/health`, deployed readiness, backend load smoke, provider tier note without secrets |
| Supabase recovery | What RPO/RTO is acceptable? | managed restore, PITR, manual logical restore, or explicit risk acceptance | restore proof or written RPO/RTO acceptance with manual reconfiguration caveats |
| Incident path | Who receives and owns alerts? | Better Stack + Render notifications, or app-level error tracking provider | test alert proof, incident response owner, escalation fallback |
| Rollback authority | Who can stop or reverse a release? | named technical owner plus business owner | rollback steps for Vercel, Render, migrations, imports/jobs, and pilot communications |
| Protected evidence rerun | Which personas/routes must be rechecked after final config? | active pilot role set plus protected load groups | sanitized persona route/API evidence and backend load output |
| Upload delegation | Who may import or upload data? | current `SUPER_ADMIN` path, HR/admin delegation, or future role | upload/readback proof if delegation changes |

## Verification Ladder

Local docs/guard packet:

```powershell
git diff --check
npm.cmd run test:scripts
```

Before broad production, after final provider/env decisions:

```powershell
npm.cmd run check:release

$env:READINESS_ENVIRONMENT="production-or-final-staging"
$env:READINESS_FRONTEND_URL="[target-frontend-url]"
$env:READINESS_BACKEND_URL="[target-backend-api-url]"
$env:READINESS_TIMEOUT_MS="45000"
npm.cmd run smoke:deployed-readiness

$env:BACKEND_LOAD_OUTPUT="json"
$env:BACKEND_LOAD_ENVIRONMENT="production-or-final-staging"
$env:BACKEND_LOAD_API_BASE_URL="[target-backend-api-url]"
$env:BACKEND_LOAD_ITERATIONS="3"
$env:BACKEND_LOAD_CONCURRENCY="2"
$env:BACKEND_LOAD_TIMEOUT_MS="45000"
npm.cmd run smoke:backend-readiness-load

$env:ALERT_SMOKE_ENVIRONMENT="production-or-final-staging"
$env:ALERT_SMOKE_BACKEND_URL="[target-backend-api-url]"
$env:ALERT_PROVIDER_NAME="[provider-label]"
$env:ALERT_PRIMARY_DESTINATION="[destination-label]"
$env:ALERT_BACKUP_DESTINATION="[backup-label-if-any]"
$env:ALERT_SMOKE_TIMEOUT_MS="45000"
npm.cmd run smoke:alert-routing
```

Protected persona evidence must use real fresh sessions and must never store
raw tokens, cookies, auth codes, provider subjects, or private payloads.

## No-Go Conditions

Broad production remains `No-Go` if any of these are true:

- Redis/BullMQ uses a non-persistent Free tier without explicit risk
  acceptance.
- Supabase recovery lacks RPO/RTO acceptance or a tested managed/PITR/logical
  posture.
- Incident contact path has no named primary owner and fallback.
- App-level error tracking is required by the owner but not configured/tested.
- Final provider/env changes have not been followed by deployed readiness,
  protected persona, and backend load smoke reruns.
- Rollback authority is unclear.
- Evidence contains secrets or private payloads.

## Final Track 8 Closure

Track 8 is closed as an operating decision packet, not as broad-production
approval.

Next correct action when field launch becomes real:

- fill the owner acceptance checklist,
- perform the provider/env changes,
- rerun the verification ladder,
- then update the production readiness decision.

Until then, the project should continue as controlled-pilot ready, with broad
production parked and explicit rather than vague.
