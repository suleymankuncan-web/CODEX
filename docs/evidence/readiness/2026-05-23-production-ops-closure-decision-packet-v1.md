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

## Ranked Future Work Backlog Before Implementation

Do not implement these yet. This is no longer an idea dump. Use this ranked
queue to choose work that clearly improves pilot trust, operator usefulness, or
future product leverage before opening code.

Promotion rule: an item moves from future work to implementation only when it
has a real pilot signal, broad-production owner decision, security/compliance
need, or measured reliability bottleneck. Otherwise it stays parked.

Rank rule:

- P0 protects pilot or broad-production trust.
- P1 removes operator/support ambiguity that will slow real usage.
- P2 creates product leverage, but should wait for UI/product work or a clear
  pilot signal.
- P3 is useful only when its trigger appears; do not pull it forward for
  tidiness.

### P0 - Trust And Incident Readiness

| Item | Why it matters | First safe slice | Stop rule |
| --- | --- | --- | --- |
| App-level error tracking V1 | Health checks say the app is up; error tracking proves whether real users hit exceptions by release, route, and environment. | Decide provider, then add sanitized backend capture before frontend capture, release mapping, redaction tests, safe smoke proof, and incident routing. | Stop if provider setup would send raw tokens, cookies, PII, private payloads, noisy test errors, or change API/user-facing error behavior. |
| Incident ownership and rollback authority | Alerts are only useful if someone owns them and can stop or roll back a bad release. | Name primary/backup owner, severity levels, response windows, rollback owner, business stop authority, log retention, and escalation channel. | Stop if ownership is assigned only to a mailbox/channel, or rollback needs ad hoc approval during an incident. |
| Security and tenant isolation preflight | Scope leakage or secret exposure would be a critical failure before broad usage. | Create a named final checklist for auth/scope, tenant/company isolation, secret exposure, headers, Supabase boundary, uploads/imports, dependency audit, and evidence redaction. | Stop if this becomes a broad penetration-test claim without a concrete scope and evidence. |
| Evidence expiry and protected rerun policy | Old good evidence becomes dangerous after auth, role, deploy, data-shape, provider, or seed changes. | Add expiry/refresh triggers for protected persona proof, restore proof, alert proof, performance baselines, upload/import proof, and protected load groups. | Stop if old evidence is used to approve a newer environment without rerun criteria. |
| Owner and responsibility map | During incidents, implicit ownership burns time. | Map alert owner, rollback owner, restore owner, import owner, auth owner, data-quality owner, and business stop authority. | Stop if the map names a team but not an accountable path. |

### P1 - Operator And Support Leverage

| Item | Why it matters | First safe slice | Stop rule |
| --- | --- | --- | --- |
| Correlation ID and request trace policy | Operators need to connect frontend action, backend log, audit event, and provider alert without exposing private data. | Define request ID propagation and sanitized evidence fields before code. | Stop if tracing would store raw auth tokens, cookies, provider subjects, or private payloads. |
| User support diagnostic panel | Support needs to answer "why can this user not see or do this?" without database spelunking. | Spec a read-only diagnostic summary for role, scope, store assignment, release, and recent safe error context. | Stop if it exposes private data or becomes an assignment editor. |
| Support troubleshooting playbook | First-line support needs fast diagnosis for common failures. | Define 5-minute flows for login, forbidden route, missing store, missing action, stale data, import issue, and role mismatch. | Stop if the playbook asks support to inspect secrets or edit production data. |
| Cache and stale-data policy | Users must understand which data is live, cached, preview, snapshot, or official. | Classify KPI, ranking, workforce, import, snapshot, and Store Action surfaces by freshness and trust level. | Stop if the policy changes user-facing numbers or source-of-truth semantics. |
| Background job idempotency registry | Import, snapshot, materialization, queue, and retry jobs must be safe to rerun or clearly marked unsafe. | Inventory each job with idempotency key, retry behavior, owner, and manual intervention rule. | Stop if the registry changes job behavior without tests. |
| Data correction workflow policy | Wrong imported or KPI data needs a safe correction path with ownership and audit. | Decide source-file correction versus in-app correction rules for import, workforce, KPI, ranking, and snapshot data. | Stop if it creates manual overrides without audit and source-of-truth rules. |
| Import dry-run / preview contract | Operators should know what a file would change before committing a risky import. | Spec a no-write preview contract for row counts, mapping gaps, conflicts, and expected changes. | Stop if preview becomes a write path or changes the import lifecycle. |
| Performance budget escalation | Existing budgets catch regressions; operators need to know what happens when thresholds are crossed. | Map bundle, backend latency, queue pressure, and protected-route smoke thresholds to action levels. | Stop if thresholds are not backed by current smoke, build, or browser evidence. |
| Role lifecycle and offboarding guard | Access must close cleanly when role, store, company, or employment status changes. | Define offboarding scenarios and route/API smoke evidence for revoked or changed access. | Stop if the work changes auth semantics without a separate decision. |
| Metric glossary and data dictionary | KPI, ranking, snapshot, official, preview, action, target, and checklist terms must mean the same thing everywhere. | Create a short canonical glossary tied to source-of-truth documents and UI copy. | Stop if glossary work tries to change KPI math or source ownership. |

### P2 - Product Intelligence Worth Keeping

| Item | Why it matters | First safe slice | Stop rule |
| --- | --- | --- | --- |
| Store personnel checklist exposure cleanup | `STORE_PERSONNEL` should not receive checklist brief cards, nav links, or direct checklist route access if the role is not meant to work checklist flows. | Align route guard, route matrix, role preview, and targeted Playwright evidence so direct `/store/checklists` access is forbidden for personnel-only sessions. | Stop if cleanup changes checklist scoring, BM/VM ownership, or manager/region/VM behavior. |
| Daily Command Brief V1 on `/store/home` | Store users need one first-screen answer to "what should I look at today?" using only real, sourced signals. | Add a read-only brief design/spec for role-based top priorities from Store Action, KPI/ranking, checklist where allowed, workflow/approvals, and data freshness. | Stop if any card is unsourced, AI-generated, changes scoring/workflow semantics, or turns `/store/home` into a broad dashboard redesign. |
| Command Chain Intelligence V1 | The same source-linked operational truth should roll from executive/company view down to region, store, and personnel focus without becoming separate dashboards or invented advice. | Create an AI-free signal contract and role brief map for executive, HR, region, store, and personnel views using only existing KPI/ranking, Store Action, workflow, checklist-where-allowed, snapshot/import freshness, auth/scope, and audit sources. | Stop if any brief item lacks source, scope, freshness, official/preview state, deep link, and evidence label; or if the work introduces AI, prediction, causation claims, scoring changes, auth/workflow changes, or broad dashboard redesign. |
| Store Performance Replay / Action Impact Timeline V1 | Operators need one sourced story of what happened in a store: data arrival, KPI/ranking movement, Store Action work, checklist/workflow signals, and later performance movement. | Create a read-only design/spec that links each timeline item to existing official or preview sources without new scoring, command behavior, or AI claims. | Stop if the timeline claims causation, invents data, changes scoring/workflow semantics, or uses unsourced AI narrative. |
| Release notes and change visibility | Pilot and support users need to know what changed so feedback ties to the right release. | Define lightweight internal release notes linked to deploy/release IDs and pilot feedback categories. | Stop if it becomes a public marketing changelog or slows emergency fixes. |

### P3 - Keep Parked Until The Trigger Appears

| Item | Trigger | First safe slice | Stop rule |
| --- | --- | --- | --- |
| Migration rollback / forward-only policy | Next risky DB migration or restore-policy decision. | Record example playbooks for additive migrations, failed deploys, forward fixes, and restore involvement. | Stop if the policy pretends destructive rollback is safe without restore proof. |
| Dependency upgrade cadence | Security advisory, framework drift, or repeated upgrade friction. | Set cadence and minimum gate for React/Vite/Nest/Clerk/Playwright/Supabase updates. | Stop if upgrades are bundled with feature work or broad refactor. |
| Browser and device support matrix | Real pilot device issue or UI redesign start. | Define supported browsers, mobile widths, and smoke viewports. | Stop if it becomes a redesign project instead of a support contract. |
| Evidence automation index | Evidence lookup becomes slow or PRs repeatedly miss required proof. | Maintain an index from evidence files to decisions, gates, and owner acceptance rows. | Stop if automated evidence claims more than the underlying proof supports. |
| Operational freeze window policy | Month-end/ranking close/import windows create release risk. | Define freeze windows, emergency fixes, and approval requirements. | Stop if the policy blocks urgent security or data-loss fixes without an emergency path. |
| Manual override approval policy | A real domain asks for manual override. | Define allowed domains, approver, evidence, audit, and reversal path. | Stop if override approval bypasses source-of-truth ownership. |
| Pilot issue triage cadence | Pilot feedback volume becomes noisy or repeated. | Define P0/P1/P2/P3 review rhythm, sign-off, and batching rules. | Stop if cadence widens pilot scope or turns every friction item urgent. |
| Mutable Norm Kadro / staffing baseline module | Owner explicitly chooses editable staffing targets. | Start from source-of-truth, owner, effective-date, audit, rollback, and role/scope decision. | Stop if it adds payroll, scheduling, auto action generation, or staffing-rule behavior before approval. |

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
