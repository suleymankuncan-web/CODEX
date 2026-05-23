# Controlled Pilot Scenario Rehearsal V1

Date: 2026-05-23

## Reader And Action

Reader:

- the pilot moderator, support engineer, QA operator, product owner, or future
  agent running a controlled HR Axis / Store Ops rehearsal before real pilot
  users are asked to rely on the system.

After reading, they should be able to:

- run a single controlled pilot rehearsal from preflight to decision,
- know which persona should prove which flow,
- capture sanitized evidence without leaking secrets,
- decide whether to continue, pause, or split follow-up work.

## Purpose

This runbook turns the current controlled-pilot evidence into a practical
rehearsal day script.

It does not approve broad production, add a module, add a role, change UI,
change API responses, change auth behavior, change DB schema, change provider
configuration, or mutate staging data by default.

The rehearsal answers one question:

Can the current product flow support a small internal pilot session without
scope leaks, stale evidence, broken role journeys, or unclear operational
ownership?

## Sokrates Decision

Claim:

- The next useful step is not more code. It is a structured pilot-day rehearsal
  that connects the already-proven technical evidence to real operator
  behavior.

Assumptions:

- Controlled internal pilot remains `Conditional Go / Continue`.
- Broad production remains `No-Go`.
- Active pilot roles are `SUPER_ADMIN`, `HR_ADMIN`, `REGION_MANAGER`,
  `STORE_MANAGER`, `STORE_PERSONNEL`, and `REPORT_VIEWER`.
- Clerk authenticates the user, but application role/scope/action-store records
  remain the authorization source of truth.
- The default rehearsal is read-only. Any command rehearsal needs an explicit
  scoped command step and rollback note.

Evidence:

- Pilot Scenario Pack V1 defines the active roles, surfaces, source-of-truth
  map, and freshness expectations.
- Controlled Pilot Dry Run V1 refreshed public staging, local gates, protected
  persona evidence, Store Action assigned/unassigned scope, and backend load.
- Store Action V1B has targeted frontend/backend coverage for the current
  persisted action-plan loop.
- The operating checklist already defines invite, feedback, pause, rollback,
  and exit decisions.

Counterargument:

- A scripted rehearsal can become ceremony if it does not produce concrete
  evidence or decisions. Keep the run small and stop when the decision is clear.

Risk:

- LOW for read-only rehearsal and docs-only evidence.
- MEDIUM for live staging browser/session checks.
- HIGH for command rehearsal, data mutation, provider dashboard changes,
  private data screenshots, or raw token handling.

Door:

- Two-way-door for the runbook and read-only rehearsal.
- Near-one-way-door for leaked secrets, staging data mutations, or widening the
  pilot without explicit owner approval.

Stop rule:

- Stop immediately if the rehearsal requires raw tokens, Clerk cookies,
  passwords, auth codes, full JWTs, provider subjects, private user data,
  direct DB edits, production data, new role behavior, or broad rollout claims.

## Rehearsal Modes

| Mode | Default? | What It Proves | Allowed Activity | Required Stop Condition |
| --- | --- | --- | --- | --- |
| Read-only rehearsal | yes | Role journeys, route visibility, data freshness, and evidence capture. | Browser navigation, public/protected smokes, read endpoints, screenshots after redaction review. | Stop if a role cannot sign in, sees forbidden data, or evidence needs a secret. |
| Scoped command rehearsal | no | Store Action command loop for an assigned store. | Create/status/close/cancel only against a pre-approved pilot action plan or disposable staging action item. | Stop if rollback is unclear, unassigned store access succeeds, or a read-only role sees command controls. |
| Invite-wave rehearsal | no | Whether a wider pilot group can start. | Same as read-only plus roster/sign-off checks. | Stop if participant list, assignments, or support owner is incomplete. |

Run the read-only mode first. Add scoped command rehearsal only after the
moderator confirms the exact staging record, owner, expected result, and
rollback note.

## Roles During The Rehearsal

| Rehearsal Role | Responsibility |
| --- | --- |
| Moderator | Runs the script, keeps time, calls stop rules, and writes the sanitized outcome. |
| Support engineer | Watches health, logs, release commit, and smoke results. |
| Product owner | Decides whether feedback changes the pilot decision. |
| Persona operator | Signs in as the assigned role and performs only the scripted flow. |
| Evidence recorder | Captures route, status, role, result, and sanitized screenshot/reference when useful. |

One person may hold multiple rehearsal roles, but the moderator and decision
owner must be named before the run starts.

## Preflight

Complete this before any persona starts the browser flow.

### Environment And Release

- Confirm staging frontend and backend URLs.
- Record the current deployed commit or PR number.
- Confirm the pilot is still controlled/internal, not broad production.
- Confirm the support owner and decision owner.
- Confirm no raw tokens or private user data will be pasted into docs, chat, or
  PR comments.

### Local Confidence

Run the local gate before a new invite wave or after any deploy that can affect
pilot routes:

```powershell
npm.cmd run check:pilot-stabilization
```

If the rehearsal includes Store Action command proof, also run the targeted
Store Action checks before the browser session:

```powershell
npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts
npm.cmd --prefix backend\nestjs test -- store-action-plan workflow-inbox.service --runInBand
```

### Public Staging Confidence

Run public smokes when staging was recently deployed or when the rehearsal is
meant to refresh evidence:

```powershell
npm.cmd run smoke:deployed-readiness
npm.cmd run smoke:alert-routing
npm.cmd run smoke:backend-readiness-load
```

Tokenless protected skips are allowed only when they are recorded as skipped,
not as proof.

### Dataset Checklist

Confirm the staging data shape before running role flows:

- one active company,
- one active region,
- one assigned store and one unassigned negative-control store,
- active Clerk-linked personas for all six pilot roles,
- role/scope/action-store assignments matching the pilot matrix,
- at least one current KPI/reporting signal,
- one Store Action plan or candidate for the assigned store when Store Action
  is in scope,
- one import/readiness signal and one snapshot/reporting signal,
- no private production data copied into staging for the rehearsal.

## Timeboxed Script

Use this as a 90 to 120 minute rehearsal.

### Phase 1: Start And Health, 10 Minutes

Goal:

- prove the deployment is reachable and operators know the current decision.

Steps:

1. Moderator reads the pilot decision: controlled pilot `Conditional Go /
   Continue`, broad production `No-Go`.
2. Support engineer records current commit/deploy and public health result.
3. Evidence recorder opens the evidence note and marks the rehearsal mode.
4. Product owner confirms whether command rehearsal is in or out of scope.

Pass:

- health is reachable,
- decision is understood,
- evidence destination is ready,
- command mode is explicitly in or out.

Stop:

- backend health, frontend availability, DB, Redis, or queue status is degraded
  in a way that affects the planned flow.

### Phase 2: Admin Persona Pass, 25 Minutes

Goal:

- prove company/admin roles land on the right surfaces and fail closed where
  required.

| Persona | Required Positive Flow | Required Negative Flow | Evidence |
| --- | --- | --- | --- |
| `SUPER_ADMIN` | Open integrations/readiness, auth/admin, and support-visible Store Action or reports context when scoped. | Store Action command still respects action-store scope if no assigned store exists. | landing route, session role, sampled allowed routes, no bypass claim. |
| `HR_ADMIN` | Open competitions, master data, and checklists governance surfaces. | Auth/admin mutation or super-admin-only surface is forbidden. | route result, backend/session role, forbidden route or `403`. |
| `REPORT_VIEWER` | Open reports, targets, inbox, and read-only Store Tasks visibility when scoped. | Store Action command controls and auth/admin mutation are absent/forbidden. | read-only route result and command-control absence. |

Pass:

- each admin/read role sees only intended surfaces,
- non-super auth/admin checks fail closed,
- report viewer remains read-only.

Stop:

- a read-only role sees command controls,
- HR/admin role can mutate super-admin-only auth state,
- admin evidence requires direct DB edits.

### Phase 3: Region Persona Pass, 15 Minutes

Goal:

- prove regional visibility without turning region read access into store
  command authority.

`REGION_MANAGER` positive flow:

- land in the expected shell,
- open targets,
- open competitions,
- open rankings.

`REGION_MANAGER` negative flow:

- auth/admin is forbidden,
- master-data admin is forbidden,
- integrations admin is forbidden.

Pass:

- region-visible surfaces open,
- forbidden admin surfaces fail closed,
- assigned-store/action-store information is visible only according to current
  evidence.

Stop:

- region role can perform unscoped store commands,
- region role becomes a substitute for super admin or HR admin.

### Phase 4: Store Persona Pass, 25 Minutes

Goal:

- prove store daily work and Store Action visibility without scope leakage.

| Persona | Required Positive Flow | Required Negative Flow | Evidence |
| --- | --- | --- | --- |
| `STORE_MANAGER` | Open store home, own/store context, tasks, approvals, KPIs, rankings, and assigned Store Action plans. | Unassigned-store action read or command is forbidden. | route result, assigned-store read result, unassigned-store forbidden result. |
| `STORE_PERSONNEL` | Open own/store-facing performance and ranking surfaces. | Admin, manager approvals, and Store Action command controls are absent/forbidden. | route result, own-context proof, forbidden/absence proof. |

If command mode is in scope:

1. Confirm the exact Store Action item and assigned store.
2. Run only the scripted create/status/close/cancel step.
3. Record expected result and final state.
4. Confirm unassigned-store command still fails.

Pass:

- store manager can use assigned-store Store Action flow,
- store personnel cannot see manager-only commands,
- out-of-scope store access fails.

Stop:

- any user can act on an unassigned store,
- personnel sees another person's private operational detail,
- command rehearsal changes data without a rollback note.

### Phase 5: Cross-Domain Sanity, 15 Minutes

Goal:

- prove that the pilot is not stuck behind one overloaded or stale domain.

Check these signals:

- import/readiness: latest import state is understandable,
- snapshot/reporting: freshness is visible or explicitly stale,
- workflow/inbox: item source and owner are clear,
- Store Action: source signal is still KPI/reporting-linked, not a second KPI
  truth,
- operations/health: DB, Redis, queue, and alert-routing posture are named.

Pass:

- no domain presents stale data as current truth,
- workflow items have understandable source/owner/deep-link behavior,
- Operations remains read-only summary, not a hidden command center.

Stop:

- stale source data is used to justify an operational decision without a label,
- a second source of truth appears for KPI, checklist, target, or Store Action.

### Phase 6: Decision Review, 10 Minutes

Goal:

- leave the rehearsal with one explicit decision.

Choose one:

- `Go`: all scripted flows passed; no stop rule appeared.
- `Conditional Go`: pilot can continue with named restrictions or follow-ups.
- `Pause`: a blocker exists, but the path can resume after a focused fix.
- `No-Go`: auth, privacy, data integrity, or evidence trust failed.

Record:

- personas tested,
- routes or workflows tested,
- local/public/protected checks run,
- skipped checks and why,
- issues by severity,
- owner for each follow-up,
- whether broad production remains `No-Go`.

## Evidence Note Template

```markdown
# Controlled Pilot Scenario Rehearsal - YYYY-MM-DD

Environment:
Mode: read-only / scoped-command / invite-wave
Moderator:
Decision owner:
Support owner:
Frontend:
Backend:
Commit/deploy:

## Decision

- Controlled pilot: Go / Conditional Go / Pause / No-Go
- Broad production: No-Go

## Preflight

- Local gate:
- Public staging smokes:
- Protected token checks:
- Dataset readiness:
- Command mode in scope: yes/no

## Persona Results

| Persona | Positive flow | Negative flow | Result | Notes |
| --- | --- | --- | --- | --- |
| SUPER_ADMIN | | | | |
| HR_ADMIN | | | | |
| REGION_MANAGER | | | | |
| STORE_MANAGER | | | | |
| STORE_PERSONNEL | | | | |
| REPORT_VIEWER | | | | |

## Cross-Domain Signals

- Import/readiness:
- Snapshot/reporting:
- Workflow/inbox:
- Store Action:
- Operations health:

## Issues

| Severity | Persona | Route/workflow | Observation | Decision impact | Owner |
| --- | --- | --- | --- | --- | --- |

## Sanitization

- Raw tokens/cookies/JWTs included: no
- Provider subjects/private IDs included: no
- Private screenshots included: no
```

## Severity Rules

| Severity | Meaning | Action |
| --- | --- | --- |
| Blocker | Auth leak, privacy leak, command on wrong scope, data integrity failure, or health failure blocking planned flow. | Pause or No-Go. Fix before continuing. |
| High | Role journey or core Store Action/reporting flow fails, but no data/privacy leak occurs. | Conditional Go only with owner and fix path. |
| Medium | Confusing state, stale label, missing recovery copy, or unclear evidence that does not block the flow. | Continue with follow-up. |
| Low | Polish, copy, or layout feedback that does not affect pilot execution. | Backlog; do not block pilot. |

## Stop Rules

Stop the rehearsal when:

- a low-role user sees private or global detail outside intended scope,
- a user can act on an unassigned store,
- a read-only role sees command controls,
- auth/admin mutation is available outside `SUPER_ADMIN`,
- protected evidence requires writing secrets into docs or chat,
- staging data must be manually edited to make the result pass,
- health, DB, Redis, queue, or frontend availability is degraded,
- stale imports/snapshots are presented as current truth,
- command mode starts without a named record, expected result, and rollback
  note.

## What This Does Not Prove

This rehearsal does not prove:

- broad production readiness,
- production-grade Redis persistence,
- managed Supabase PITR/restore posture,
- app-level error tracking policy,
- future JSON/API source adapter behavior,
- future Norm Kadro or new module behavior,
- complete UI redesign readiness.

Those remain separate decisions.

## Reader Test

A cold reader can use this runbook to:

1. prepare the environment,
2. assign moderator/support/decision roles,
3. run each persona flow,
4. capture sanitized evidence,
5. apply stop rules,
6. finish with a clear pilot decision.

If any of those steps cannot be done with current staging inputs, record the
missing input as a blocker instead of inventing proof.
