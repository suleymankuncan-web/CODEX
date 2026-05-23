# External Evidence Closure V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to execute this plan task-by-task.
> Do not skip the Sokrates checks or mark provider-dependent work complete
> from local-only evidence.

**Goal:** Close or explicitly decide the remaining external/live evidence
gaps for controlled pilot and broad-production readiness without changing
application behavior, leaking secrets, or faking provider proof.

**Architecture:** Keep the current Vite + React frontend, NestJS backend,
Clerk auth boundary, Supabase/PostgreSQL data boundary, Render backend,
Vercel frontend, OpenAPI generated client path, and docs/evidence operating
model. This plan adds no new product module and no new platform layer. It
turns the remaining "external dependency" bucket into named decisions:
alert delivery policy, Redis/BullMQ durability posture, Supabase recovery
posture, upload proof status, and final readiness classification.

**Tech Stack:** PowerShell, Git, Node/npm scripts, Render staging backend,
Vercel staging frontend, Clerk staging sessions, Supabase/PostgreSQL restore
runbooks, Render Key Value / Redis, BullMQ, existing smoke scripts, Markdown
evidence files.

## Sokrates Decision

Claim: the remaining readiness work is no longer one generic code blocker.
It is a small set of external dependency decisions with different evidence
classes.

Assumption: controlled pilot can continue when current app-owned behavior is
proven and every broad-production caveat is named. Broad production should
stay `No-Go` until the operator accepts provider, restore, Redis, and alert
posture explicitly.

Repo evidence:

- `docs/evidence/system-flow/clerk-persona-live-evidence-2026-05-23.md`
  closes the current five-persona protected Clerk matrix.
- `docs/evidence/readiness/2026-05-22-redis-bullmq-staging-proof.md`
  proves staging Redis/BullMQ wiring and health.
- `docs/evidence/readiness/2026-05-22-alert-provider-delivery-proof.md`
  proves Render notification delivery to Slack, but not app-level error
  tracking or final production alert policy.
- `docs/evidence/readiness/2026-05-22-supabase-staging-logical-restore-drill.md`
  proves app-owned schema logical restore into a disposable local PostgreSQL
  target, but not managed Supabase restore-to-new-project or PITR.
- `docs/evidence/readiness/2026-05-22-live-evidence-proof-pass.md` and
  `docs/plans/import-upload-authorization-decision-v1.md` close current
  controlled-pilot authenticated upload proof with the approved operator path.

Counterargument: evidence documents do not make runtime safer on their own.
If provider tiers, restore procedures, and alert policy remain ambiguous,
the project can drift into "looks ready" while still having operational gaps.

Risk:

- LOW for docs/status reconciliation.
- MEDIUM for staging smokes that touch public deployed endpoints.
- HIGH for provider dashboards, restore targets, secrets, production data,
  or any change to auth/provider/DB behavior.

Door: docs-only reconciliation is a two-way door. Restore drills, provider
configuration, Redis tier changes, and production readiness declarations are
one-way-door-adjacent and require explicit operator decision.

Stop rule: stop and report instead of proceeding if a step needs a raw token
in chat, a non-disposable restore target, production data, a provider panel
decision the operator has not made, a failing health check, or a behavior
change outside this plan.

Verification ladder:

1. Docs-only changes: `git diff --check` and `npm.cmd run test:scripts`.
2. Public staging evidence: deployed readiness, alert-routing, and backend
   public load smokes with sanitized output.
3. Protected staging evidence: only with real persona sessions/tokens handled
   locally and never written to docs.
4. Provider evidence: only with provider metadata, panel result, or accepted
   policy recorded without secrets.
5. Readiness decision: controlled pilot and broad production are decided
   separately.

## Phase 0 - Reconcile Current Status

- [x] Create branch `codex/external-evidence-closure-v2` from fresh
  `origin/main`.
- [x] Update `current-state.md` so the latest merge is PR #452 and the active
  branch is this evidence-closure branch.
- [x] Update `docs/evidence/pilot-evidence-operating-matrix-v1.md` so upload
  is not listed as blocked for the current controlled pilot. Keep future upload
  reruns blocked unless a new role/sample requirement exists.
- [x] Update `docs/plans/project-progress-plan-v1.md` so the external evidence
  section distinguishes closed controlled-pilot evidence from broad-production
  decisions.
- [x] Run:

```powershell
git diff --check
npm.cmd run test:scripts
```

- [ ] Open one docs-only PR if the diff stays limited to plan/handoff/evidence
  files.

## Phase 1 - Alert Delivery Policy

- [x] Treat the existing Render Slack notification proof as staging provider
  evidence, not app-level error tracking.
- [x] Ask the operator to choose one policy:
  `slack-only-v1`, `fix-email-before-broad-production`, or
  `add-app-level-error-provider-later`.
- [ ] If `slack-only-v1`, record an explicit production alert policy decision
  and keep email/app-level error tracking as parked work.
- [x] If email proof is required, the operator must inspect the mailbox,
  spam folder, provider panel, or DNS/mail settings. Do not claim email delivery
  from Slack delivery.
- [ ] Safe smoke command:

```powershell
$env:ALERT_SMOKE_BACKEND_URL='https://api-staging.hr-axis.com/api'
$env:ALERT_SMOKE_ENVIRONMENT='staging'
$env:ALERT_PROVIDER_NAME='render-notifications'
$env:ALERT_PRIMARY_DESTINATION='ops-slack'
$env:ALERT_BACKUP_DESTINATION='render-dashboard-notification-log'
$env:ALERT_SMOKE_TIMEOUT_MS='45000'
npm.cmd run smoke:alert-routing
```

- [x] Record sanitized output in
  `docs/evidence/readiness/2026-05-23-alert-email-policy-decision-v1.md`.

Phase 1 actual record:

- The operator chose to pursue email delivery instead of Slack-only.
- Render workspace and service notification settings showed `Email and Slack`
  plus `All notifications`.
- A 2026-05-23 successful deploy email was not observed.
- Historical Render email delivery for failed `hr-axis-api` deploys was
  observed, with the closest sanitized example from 2026-05-18.
- The real evidence file is
  `docs/evidence/readiness/2026-05-23-alert-email-policy-decision-v1.md`.
  It records Render email as a historically observed failure backup channel,
  not fresh successful-deploy email or app-level error tracking.
- Fresh external email alert delivery proof is recorded in
  `docs/evidence/readiness/2026-05-23-better-stack-email-alert-proof-v1.md`.
  Better Stack monitors the staging backend health endpoint for the keyword
  `"status":"ok"`, reported the monitor as `up`, and delivered a test alert
  email to the primary responder. This closes the controlled-pilot external
  email alert proof while keeping app-level error tracking and broad-production
  incident policy as separate decisions.

## Phase 2 - Redis / BullMQ Production Posture

- [x] Keep the current staging Redis/BullMQ proof closed for controlled pilot.
- [x] Decide broad-production posture:
  `controlled-pilot-free-tier-accepted`, `upgrade-before-broad-production`, or
  `no-broad-production-redis-decision-yet`.
- [x] Do not count a free/non-persistent staging tier as broad-production
  durable queue evidence unless the operator explicitly accepts the risk.
- [ ] Safe smoke commands:

```powershell
$env:READINESS_FRONTEND_URL='https://staging.hr-axis.com'
$env:READINESS_BACKEND_URL='https://api-staging.hr-axis.com/api'
$env:READINESS_ENVIRONMENT='staging'
$env:READINESS_TIMEOUT_MS='45000'
npm.cmd run smoke:deployed-readiness

$env:BACKEND_LOAD_API_BASE_URL='https://api-staging.hr-axis.com/api'
$env:BACKEND_LOAD_ENVIRONMENT='staging'
$env:BACKEND_LOAD_ITERATIONS='3'
$env:BACKEND_LOAD_CONCURRENCY='2'
$env:BACKEND_LOAD_TIMEOUT_MS='45000'
npm.cmd run smoke:backend-readiness-load
```

- [x] Record sanitized output and the explicit decision in
  `docs/evidence/readiness/2026-05-23-redis-production-posture-v1.md`.

Phase 2 actual record:

- Redis/BullMQ production posture is recorded in
  `docs/evidence/readiness/2026-05-23-redis-production-posture-v1.md`.
  The decision is `controlled-pilot-free-tier-accepted` plus
  `upgrade-before-broad-production`: the current Render Key Value Free tier can
  exercise the staging BullMQ path during controlled pilot, but broad production
  remains No-Go until a persistent Redis-compatible tier or explicit written
  risk acceptance exists.

## Phase 3 - Supabase Recovery Posture

- [x] Keep the local logical restore proof closed for app-owned schemas.
- [x] Decide the next recovery posture:
  `controlled-pilot-logical-restore-accepted`,
  `managed-restore-drill-required`, or `pitr-plan-required`.
- [x] If managed restore is required, the operator must provide an explicitly
  disposable target project/connection string through a secure local env file.
- [x] Never run restore against production or the staging source database.
- [ ] If a safe target exists, execute the existing restore runbook and record
  sanitized table/schema counts only.
- [x] Record the decision in
  `docs/evidence/readiness/2026-05-23-supabase-recovery-posture-v1.md`.

Phase 3 actual record:

- Supabase recovery posture is recorded in
  `docs/evidence/readiness/2026-05-23-supabase-recovery-posture-v1.md`.
  The decision is `controlled-pilot-logical-restore-accepted`: the existing
  app-owned schema logical restore proof is accepted for controlled pilot.
  Broad production remains No-Go until managed restore/PITR/RPO/RTO posture is
  explicitly accepted or tested against an approved disposable target. No safe
  managed restore target exists in this slice, so no restore command was run.

## Phase 4 - Upload Evidence Reconciliation

- [x] Keep current controlled-pilot upload proof closed for the approved
  `SUPER_ADMIN` operator path.
- [x] Do not create a new `INTEGRATION_ADMIN` role; the current decision is
  to let `SUPER_ADMIN` or `HR_ADMIN` own this operation when scoped later.
- [x] If a future role-specific upload rerun is required, require an explicit
  allowed persona, safe sample file, and no raw private data in output.
- [x] Record any change in
  `docs/plans/import-upload-authorization-decision-v1.md`; no change was
  needed because the existing decision already covers the current pilot path.

## Phase 5 - Final External Evidence Decision

- [x] Create or update a consolidated external evidence closure note.
- [x] Classify each line as `closed-for-controlled-pilot`,
  `accepted-risk-for-controlled-pilot`, `blocked-for-broad-production`, or
  `requires-owner-decision`.
- [x] Final readiness rule:
  controlled pilot can be `Conditional Go` if protected persona, Redis staging,
  safe upload, alert policy, and logical restore posture are named. Broad
  production remains `No-Go` unless Redis tier, alert delivery policy, restore
  posture, and RPO/RTO acceptance are explicitly closed.

Phase 4/5 actual record:

- Final external evidence closure is recorded in
  `docs/evidence/readiness/2026-05-23-external-evidence-closure-decision-v1.md`.
  The current result is controlled internal pilot `Conditional Go` and broad
  production `No-Go`. Upload evidence remains closed for the approved
  `SUPER_ADMIN` pilot path; future `HR_ADMIN` or other role ownership needs a
  separate scoped auth/API decision and sanitized upload/readback smoke.

## PR Rhythm

- [ ] Batch docs-only reconciliation and this plan into one small PR.
- [ ] Create separate PRs only when a provider decision or new evidence file
  forms a single reviewable/revertible unit.
- [ ] Before push, run the gate required by the touched files.
- [ ] After PR creation, wait for green checks, mergeability, and Codex
  approval text or thumbs-up. Eyes-only is not approval.
- [ ] Squash merge only after approval, then fetch `origin/main`, verify the
  merge commit, and continue to the next phase.
