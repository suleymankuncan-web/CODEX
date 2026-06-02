# Free-Tier Controlled Pilot Ops Posture V1

Status: `planned`
Scope: controlled staging/internal pilot only
Broad production: `No-Go`

## Purpose

Close the remaining operational posture gap for the controlled pilot without
buying paid infrastructure, enabling paid observability, or claiming broad
production readiness.

This plan deliberately separates two decisions:

- Controlled pilot can operate on free-tier/staging-grade services with
  explicit limits, runbooks, and smoke evidence.
- Broad production remains blocked until production-grade Redis durability,
  managed recovery/PITR/RPO/RTO, and final incident/alert policy are accepted
  or proven.

## Non-Goals

- Do not purchase or require paid Redis, Sentry, Supabase PITR, or other paid
  provider tiers.
- Do not mark the project as broad-production ready.
- Do not touch business logic, API response shape, auth/permission semantics,
  DB schema, queue behavior, import lifecycle, scoring, snapshot
  interpretation, approval workflows, or Store/Admin UI behavior.
- Do not run restore commands against production.
- Do not commit secrets, provider URLs, raw tokens, webhooks, or private
  evidence.
- Do not build Nebim/JSON/source adapters or incentive/prim logic.

## Current Evidence Baseline

Use these existing sources before opening PR-1:

- `current-state.md`
- `docs/plans/project-control-board-v1.md`
- `docs/plans/controlled-pilot-operating-checklist-v1.md`
- `docs/plans/production-evidence-closure-joint-plan-v1.md`
- `docs/plans/production-environment-readiness-checklist.md`
- `docs/evidence/readiness/2026-05-22-redis-bullmq-staging-proof.md`
- `docs/evidence/readiness/2026-05-23-redis-production-posture-v1.md`
- `docs/evidence/readiness/2026-05-23-better-stack-email-alert-proof-v1.md`
- `docs/evidence/readiness/2026-05-23-supabase-recovery-posture-v1.md`

## Operating Decision

Controlled pilot decision:

- Free-tier/staging-grade services are acceptable only for controlled pilot.
- Every free-tier dependency must have a visible limit, failure mode, operator
  check, and rollback/parked-production note.
- The pilot can continue when local/release gates and staging smokes are green,
  and when failures are classified as operator-known risks rather than hidden
  production claims.

Broad production decision:

- Remains `No-Go`.
- Paid or production-grade requirements are not bypassed; they are parked with
  explicit reopen triggers.

## PR Train

### PR-1 Free-Tier Posture Inventory

Goal:

- Produce a docs-only inventory of every operational dependency that currently
  matters for controlled pilot.

Scope:

- Vercel frontend staging service.
- Render backend and worker services.
- Render Key Value or Redis-compatible queue/rate-limit posture.
- BullMQ worker process and import/snapshot job posture.
- Supabase logical recovery posture.
- Better Stack/platform alerting posture.
- Existing smoke commands and evidence locations.

Deliverables:

- Add a free-tier posture matrix to this plan or a new evidence note.
- Classify each dependency as `pilot accepted`, `production parked`,
  `blocked external`, or `not required`.
- Record known free-tier limits without claiming they are production safe.

Verification:

```powershell
git diff --check
npm.cmd run test:scripts
```

Rollback:

- Docs-only revert.

Stop if:

- Any conclusion requires paid provider purchase or production owner acceptance.

Expected outcome:

- The project has one clear answer for "what free-tier services are acceptable
  for pilot and what still blocks production?"

### PR-2 Redis / BullMQ Pilot Runbook And Smoke Posture

Goal:

- Make worker/queue troubleshooting and controlled-pilot queue acceptance
  repeatable.

Scope:

- Document the exact operator order when imports or snapshots appear stuck:
  Render worker health, worker logs, Redis health, BullMQ queue health,
  import batch status, then source data validation.
- Keep free-tier Redis accepted only for controlled pilot.
- Keep persistent production Redis as a parked production requirement.

Deliverables:

- Add `docs/plans/redis-bullmq-controlled-pilot-runbook-v1.md`.
- Link the controlled-pilot Redis / BullMQ runbook from the runbook registry.
- Record sanitized PR-2 evidence in
  `docs/evidence/readiness/2026-06-02-free-tier-controlled-pilot-ops-pr2-redis-runbook.md`.

Possible implementation:

- Docs/runbook updates only unless an existing smoke script has an obvious
  missing assertion that can be added without provider access.
- If code changes are needed, they must be script/test-only and must not change
  queue behavior.

Verification:

```powershell
git diff --check
npm.cmd run test:scripts
```

If staging env access is available:

```powershell
npm.cmd run smoke:deployed-readiness
curl.exe -sS -H "Accept: application/json" --max-time 45 https://api-staging.hr-axis.com/api/health
```

Rollback:

- Docs/script-only revert.
- No queue drain required.

Stop if:

- A fix would require changing BullMQ retry behavior, worker boot behavior,
  import lifecycle, Redis provider settings, or paid tier decisions.

Expected outcome:

- Pending import/snapshot jobs have a deterministic pilot troubleshooting path.

### PR-3 Alerting / Incident Pilot Policy

Goal:

- Close controlled-pilot alerting posture using free/platform alerting while
  keeping app-level paid error tracking parked.

Scope:

- Better Stack/platform health alert is accepted for controlled pilot.
- App-level exception tracking remains a production requirement or explicit
  owner-accepted risk, not a pilot blocker.
- Incident owner, alert destination label, escalation expectations, and
  evidence redaction rules are documented.

Deliverables:

- Add `docs/plans/controlled-pilot-alert-incident-policy-v1.md`.
- Link the controlled-pilot alert policy from the decision and runbook
  registries.
- Record sanitized PR-3 evidence in
  `docs/evidence/readiness/2026-06-02-free-tier-controlled-pilot-ops-pr3-alert-policy.md`.

Possible implementation:

- Docs/runbook updates.
- Script guard update only if existing alert docs can drift silently.

Verification:

```powershell
git diff --check
npm.cmd run test:scripts
```

If staging alert metadata exists:

```powershell
npm.cmd run smoke:alert-routing
```

Rollback:

- Docs/script-only revert.
- No provider reconfiguration required by the PR.

Stop if:

- The PR tries to add Sentry, paid app-level telemetry, new provider secrets, or
  production incident commitments without owner decision.

Expected outcome:

- Controlled pilot has a defensible alert policy that does not pretend to be
  full production incident readiness.

### PR-4 Manual Recovery / Backup Pilot Posture

Goal:

- Close the controlled-pilot recovery posture without Supabase paid PITR.

Scope:

- Logical dump / disposable restore is accepted as pilot recovery evidence.
- Managed Supabase backup/PITR/RPO/RTO remains production parked.
- Manual recovery expectations are explicit: acceptable data-loss window,
  restore target rules, smoke query, and sanitized evidence rules.

Deliverables:

- Add `docs/plans/controlled-pilot-recovery-posture-v1.md`.
- Link the controlled-pilot recovery posture from the decision and runbook
  registries.
- Record sanitized PR-4 evidence in
  `docs/evidence/readiness/2026-06-02-free-tier-controlled-pilot-ops-pr4-recovery-posture.md`.

Possible implementation:

- Docs/runbook updates.
- Optional script/test guard if current docs can regress from "pilot logical
  restore" to "production recovery" language.

Verification:

```powershell
git diff --check
npm.cmd run test:scripts
```

Optional only with local disposable target available:

```powershell
npm.cmd run smoke:migration:fresh-db
```

Rollback:

- Docs/script-only revert.
- No data repair or restore rollback required.

Stop if:

- The PR requires production restore, production credentials, paid PITR, or a
  restore target that is not explicitly disposable.

Expected outcome:

- Pilot recovery posture is honest: logical restore is proven enough for
  controlled pilot, not for broad production.

### PR-5 Closeout And State Alignment

Goal:

- Align the operating docs so future agents do not reopen the same question or
  overclaim production readiness.

Scope:

- Update `current-state.md`.
- Update `project-control-board-v1.md` only if the controlled-pilot/broad
  production wording needs a clearer short answer.
- Update `active-next-actions.md` only if the next-action board still implies
  unresolved pilot ops posture after PR-1 through PR-4.
- Add closeout evidence summarizing PRs, verification, accepted free-tier
  limits, and parked production requirements.

Verification:

```powershell
git diff --check
npm.cmd run test:scripts
```

Rollback:

- Docs-only revert.

Stop if:

- Closeout wording would claim broad production readiness, remove No-Go
  language, or hide paid production requirements.

Expected outcome:

- Controlled-pilot ops posture is closed.
- Broad production remains explicitly parked behind paid/owner decisions.

## Autonomous Execution Rules

These rules are not a standing repository-wide merge permission. They apply
only when the current user-provided goal explicitly authorizes this PR train to
be opened, reviewed, checked, and merged autonomously.

The agent may do autonomously:

- Create branches and PRs for the PR train.
- Edit docs, evidence notes, runbooks, and script guards.
- Run local verification.
- Run public staging health/readiness smokes that do not require secrets.
- Use existing configured tools to inspect non-secret provider health if
  available.
- Open PRs, request release-blocking review, monitor checks, and fix failures.
- Merge only when the active user-provided goal explicitly authorizes merging
  and `discipline.md` merge rules are satisfied.

The agent must not do autonomously:

- Buy paid infrastructure.
- Change provider tier, Redis persistence tier, Supabase plan, PITR, or billing
  settings.
- Touch production databases or run production restore.
- Paste or request secrets in chat/docs/PR text.
- Add app-level error-tracking SDKs unless separately approved.
- Change runtime queue/import/snapshot/business behavior to make readiness
  easier to pass.

## Release-Blocking Review Focus

Each PR should be reviewed only for:

- overclaiming production readiness,
- hidden paid-provider dependency,
- secret/evidence leakage,
- behavior drift,
- queue/import/snapshot/recovery semantic changes,
- rollback ambiguity,
- missing verification,
- scope creep into Nebim/source adapter or incentive/prim work.

Ignore style and future architecture suggestions unless they create one of
those release-blocking risks.

## Completion Definition

This line is complete when:

- Free-tier controlled-pilot dependency posture is documented.
- Redis/BullMQ pilot troubleshooting is repeatable.
- Alerting/incident policy is accepted for controlled pilot without paid
  app-level tracking.
- Manual logical recovery posture is accepted for controlled pilot without
  paid PITR.
- `current-state.md` says the pilot ops posture is closed and broad production
  remains `No-Go`.
- Verification commands are recorded.
- Paid/production requirements remain parked with explicit reopen triggers.

This line is not complete if any document implies broad production readiness.
