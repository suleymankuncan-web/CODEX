# Controlled Pilot Feedback Loop PR Train V1

Status: active
Shelf: pilot
Last verified: 2026-06-12

## Reader And Action

Reader:

- the pilot moderator, product owner, support engineer, QA operator, or future
  agent responsible for turning controlled-pilot feedback into focused PRs.

After reading, they should be able to:

- run the Pilot Feedback Loop PR train without reopening broad foundation work,
- decide which parts can be handled autonomously,
- know which work requires user, session, provider, or product-owner input,
- classify pilot findings as `P0 stop`, `P1 pilot blocker`,
  `P2 pilot friction`, or `P3 backlog`,
- open only the PRs justified by real feedback and matching verification.

## Decision

Decision:

- use a dedicated PR train to move the project from "foundation is strong" to
  "controlled pilot feedback drives the next fixes."

Why now:

- The recent PR history shows strong guardrails, release checks, UI parity
  work, Store Action work, Store KPIs work, workforce/approvals work, and
  project-health closeout.
- The practical risk is no longer lack of generic foundation. The practical
  risk is choosing the next product work from intuition instead of real pilot
  evidence.
- Controlled pilot is `Conditional Go / Continue`; broad production is still
  `No-Go`.

Counterargument:

- A feedback process can become another docs loop. This train is only useful if
  it produces real session records, P0/P1 fixes, and a clear continue/pause
  decision. Do not expand the process without running sessions.

Risk:

- LOW for docs-only intake and closeout PRs.
- MEDIUM for frontend or backend fixes driven by real feedback.
- HIGH for auth/scope, DB, provider configuration, staging mutations, or broad
  production claims.

Door:

- two-way-door for docs, intake format, triage labels, local UI fixes, and
  closeout notes.
- near-one-way-door for secrets, live provider changes, production data access,
  DB migrations, auth model changes, or broad rollout decisions.

## North Star

The goal is not to add more modules or polish the app by instinct.

The goal is:

> collect real controlled-pilot feedback, classify it consistently, fix the
> highest-value concrete blockers, and leave the project with a clearer pilot
> continue/pause decision.

The train succeeds when the next product PR is justified by a real feedback
record, not by a vague sense that a screen should be improved.

## Non-Goals

This train does not authorize:

- broad production readiness claims,
- broad UI redesign,
- new roles,
- new modules,
- JSON adapter work,
- Redis/BullMQ tier changes,
- Render, Vercel, Supabase, Clerk, Better Stack, or other provider config
  changes,
- direct production DB access,
- raw token, cookie, JWT, password, or provider-secret handling,
- Store Action source expansion beyond existing locked decisions,
- auth, DB schema, API response shape, scoring, ranking, checklist weight,
  import lifecycle, or workflow behavior changes unless a later PR scopes that
  as its only objective.

## Authority Model

### Autonomous

An agent may do these without further user input once this train is authorized:

- create branches with the `codex/` prefix,
- update docs, evidence templates, and runbook links,
- run local verification,
- open PRs,
- do not request or await GitHub Codex review while the owner-disabled policy
  remains active; run a fresh local adversarial diff review instead,
- watch GitHub checks and Vercel preview status,
- merge green docs-only or low-risk PRs if the user has explicitly granted PR
  and merge authority,
- implement P0/P1 fixes when the bug is reproducible from repo evidence,
  tests, or sanitized feedback and does not cross a stop rule,
- write closeout evidence and update active operating docs when the train ends.

### Requires Explicit Stop And Ask

Stop and ask before:

- using or requesting raw secrets,
- capturing raw bearer tokens, Clerk cookies, JWTs, passwords, or provider
  subjects,
- performing staging write/mutation tests that are not already authorized by a
  scoped smoke/runbook,
- changing Render, Vercel, Supabase, Clerk, Redis, Better Stack, or other
  provider settings,
- touching production data,
- changing auth or permission semantics,
- adding DB migrations,
- changing API response shape,
- changing scoring, ranking, checklist weights, import lifecycle, or workflow
  state transitions,
- introducing a new role, new module, broad redesign, or broad refactor.

## PR Train Overview

### PR-0: Feedback Intake Contract

Purpose:

- make feedback capture consistent enough that future PRs can point to one
  feedback record and one severity decision.

Expected branch:

```text
codex/controlled-pilot-feedback-pr0-intake
```

Allowed changes:

- controlled-pilot feedback log format in
  `docs/evidence/pilot-readiness/2026-05-05-controlled-pilot-feedback-log.md`,
- active next actions pointer,
- runbook or docs library links if needed,
- script guards only if an existing guard already owns the referenced document
  family.

Not allowed:

- runtime code,
- UI polish,
- backend behavior,
- provider changes,
- new feature work.

Required output:

- a feedback record template,
- severity definitions,
- decision outcomes,
- ownership fields,
- sanitized evidence rules,
- "which PR should happen next" rule.

Verification:

```powershell
git diff --check
npm.cmd run test:scripts
```

`npm.cmd run test:scripts` is required when the PR changes docs that are
covered by root script guards. If only unguarded prose changes, `git diff
--check` is the minimum gate.

### Session Run: Controlled Pilot Feedback Capture

Purpose:

- run a real or assisted controlled-pilot session and record only sanitized
  findings.

Inputs:

- pilot session date,
- moderator,
- decision owner,
- evidence recorder,
- persona or role,
- route list,
- whether the session is read-only or includes an authorized Store Action
  command proof,
- staging URLs,
- any required secure session handled outside the evidence document.

Allowed evidence:

- role names,
- route names,
- sanitized issue descriptions,
- sanitized screenshots,
- observed status codes when useful,
- "expected vs actual" behavior,
- decision notes,
- PR or issue links.

Forbidden evidence:

- raw bearer tokens,
- Clerk cookies,
- passwords,
- provider secrets,
- full JWT payloads,
- database URLs,
- Redis URLs,
- personal identity documents,
- unnecessary private user data.

Preflight:

```powershell
git status --short --branch
npm.cmd run check:pilot-stabilization
```

Use deployed readiness only when the claim needs public staging health:

```powershell
$env:READINESS_FRONTEND_URL='https://staging.hr-axis.com'
$env:READINESS_BACKEND_URL='https://api-staging.hr-axis.com/api'
$env:READINESS_TIMEOUT_MS='45000'
npm.cmd run smoke:deployed-readiness
```

Without a real `READINESS_BEARER_TOKEN`, auth/session checks are intentionally
skipped and must not be counted as protected auth evidence.

### PR-1: First P0/P1 Blocker Fix

Purpose:

- fix exactly one concrete P0/P1 feedback item.

Entry criteria:

- at least one feedback record exists,
- severity is `P0 stop` or `P1 pilot blocker`,
- expected behavior and actual behavior are clear,
- rollback is clear,
- verification can prove the fix.

Example branch name:

```text
codex/pilot-feedback-pr1-store-action-close-friction
```

Use the same naming shape for the actual issue: `codex/pilot-feedback-pr1-`
plus a short real surface and bug phrase.

Required PR body fields:

- feedback record being closed,
- severity,
- affected persona and route,
- expected behavior,
- actual behavior,
- contract impact,
- rollback,
- verification commands and results.

Verification by scope:

- Frontend Store/Admin UI:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web run test:e2e -- store-action-plans.spec.ts
git diff --check
```

Choose the existing Playwright spec that owns the affected surface. Common
pilot-surface examples are `store-action-plans.spec.ts`,
`store-surfaces.spec.ts`, `store-targets-surfaces.spec.ts`,
`operations-surfaces.spec.ts`, and `pilot-smoke.spec.ts`.

- Backend service or repository:

```powershell
npm.cmd --prefix backend/nestjs test -- pilot-feedback.service.spec.ts --runInBand
npm.cmd --prefix backend/nestjs run build
git diff --check
```

Choose the existing Jest spec that owns the affected behavior. Common
pilot-adjacent examples are `pilot-feedback.service.spec.ts`,
`store-action-plan-schema-contract.spec.ts`,
`checklist-remediation-finding.extractor.spec.ts`, and
`auth-role-scope-policy.service.spec.ts`.

- Cross-domain or release-impacting:

```powershell
npm.cmd run check:release
git diff --check
```

### PR-2: Optional P2 Friction Batch

Purpose:

- batch small P2 fixes only when they are truly one review story.

Entry criteria:

- no open P0/P1 blocker from the same session,
- P2 items share the same surface,
- P2 items share the same risk class,
- P2 items share the same verification path,
- rollback is one coherent revert story.

Do not batch:

- UI polish with backend behavior,
- auth/scope with display copy,
- DB/API changes with frontend layout,
- Store Action workflow with unrelated Store KPIs display,
- different personas that need different proof.

### PR-3: Feedback Loop Closeout

Purpose:

- record what the train proved and choose the next decision.

Allowed changes:

- closeout evidence,
- feedback log summary,
- active-next-actions update,
- current-state update only if the handoff or active decision changed,
- decision/runbook registry update only if a decision or repeatable procedure
  changed.

Closeout evidence target:

```text
docs/evidence/pilot-readiness/YYYY-MM-DD-controlled-pilot-feedback-loop-v1-closeout.md
```

Use the actual closeout date in the filename.

Required closeout fields:

- sessions reviewed,
- feedback count by severity,
- P0/P1 items closed,
- P2 items batched or parked,
- P3 items parked,
- remaining blockers,
- controlled pilot decision,
- broad production decision,
- next PR recommendation.

Possible final decisions:

- `Continue`: current controlled pilot flow is usable.
- `Conditional Continue`: pilot can continue with named follow-ups.
- `Pause`: a concrete blocker must be fixed before the next session.
- `No-Go`: security, data, or workflow risk makes the current pilot path unsafe.

## Feedback Record Contract

Every session finding should use this structure:

```text
### Feedback ID: PILOT-FB-YYYYMMDD-NN

Session:
Reporter:
Moderator:
Decision owner:
Environment:
Persona / role:
Route / surface:

Expected behavior:

Actual behavior:

Evidence:
- Type:
- Link or sanitized note:

Severity:
- P0 stop / P1 pilot blocker / P2 pilot friction / P3 backlog

Reason for severity:

Contract impact suspected:
- None / UI-only / frontend data binding / backend read/API /
  backend write/workflow / auth-DB-scoring-queue-provider

Decision:
- Fix now / Batch with same-surface P2 / Park / Needs product decision /
  Needs provider or session input

Next action:

Owner:
```

Do not accept a feedback record as actionable if it lacks:

- affected persona,
- affected route or surface,
- expected behavior,
- actual behavior,
- severity,
- decision,
- next action.

## Severity Definitions

### P0 Stop

Use when:

- forbidden data is visible,
- a read-only role can mutate,
- login/session is broken for the pilot path,
- data corruption or unsafe workflow transition is possible,
- Store Action or import behavior can affect the wrong store or role,
- evidence would require raw secrets to prove safely.

Action:

- stop the normal feedback train,
- open only the P0 fix PR or P0 evidence-blocker PR,
- do not batch with other work.

### P1 Pilot Blocker

Use when:

- a role cannot complete the planned pilot flow,
- a primary route is unusable,
- support cannot recover or explain the state,
- a required Store Action or workflow control fails in the scoped path,
- a real data binding issue creates wrong operational interpretation.

Action:

- next code PR unless a P0 exists,
- one blocker per PR unless the same root cause fixes multiple records.

### P2 Pilot Friction

Use when:

- the flow is usable but confusing,
- copy or empty/error state causes uncertainty,
- mobile or desktop layout is bounded but awkward,
- a non-critical action takes too many steps,
- a role can proceed but needs support explanation.

Action:

- batch only by same surface, risk class, verification, and rollback story,
- do not interrupt P0/P1 work.

### P3 Backlog

Use when:

- feedback is a nice-to-have,
- the request implies a new feature,
- the request implies broad redesign,
- the request needs a product decision,
- the request depends on provider, role, module, or production posture work.

Action:

- park with trigger,
- do not convert directly into code.

## Triage Order

Use this order after every session:

1. Close or block P0 items.
2. Select one P1 item that blocks the next controlled-pilot session.
3. Batch P2 only if it is same-surface and same-gate.
4. Park P3 with a trigger.
5. Update the pilot decision.

If there are multiple valid P1s, choose by:

1. security and scope risk,
2. ability to complete the core pilot flow,
3. support recoverability,
4. data trust,
5. reviewability and rollback.

## PR Body Contract

Every PR in this train should include:

```markdown
## Summary

## Feedback Source

## Severity

## Contract Impact

## Rollback

## Verification
```

For `Contract Impact`, use one of:

- `Contract Impact: none`
- `Contract Impact: intentionally unchanged`
- `Contract Impact: changed`

If changed, list the API, auth, DB, workflow, scoring, ranking, queue, import,
provider, or UI behavior contract that changed.

## Merge Discipline

Before opening a PR:

```powershell
git status --short --branch
git diff --check
```

Also run the targeted gate for the PR risk class.

After opening a PR:

- confirm the PR has one review story,
- do not request or await GitHub Codex review; run a fresh final local
  adversarial diff review,
- inspect actionable human/tool comments or review submissions when present,
- wait for GitHub checks and Vercel checks when applicable,
- do not merge while checks are running, failing, or unexplained,
- do not merge if the PR body does not state what did not change.

After merge:

```powershell
git checkout main
git pull --ff-only
git status --short --branch
```

Then update closeout or handoff docs only if the active state changed.

## Expected End State

After this PR train, the project should have:

- a consistent feedback intake contract,
- one or more real session records,
- P0/P1 blockers fixed or explicitly blocked,
- P2 friction either batched by same surface or parked,
- P3 ideas parked with triggers,
- a clear controlled-pilot decision,
- broad production still separated from controlled pilot,
- a next product backlog selected by evidence rather than intuition.

The ideal final statement is one of:

- `Continue`: no active pilot blocker remains.
- `Conditional Continue`: pilot can continue with named follow-ups.
- `Pause`: a blocker must be fixed before the next session.
- `No-Go`: current scoped pilot path is unsafe.

## Stop Rules

Stop the train and report instead of pushing forward when:

- a P0 issue appears; the normal PR train stops, and only a P0 fix PR or P0
  evidence-blocker PR may proceed,
- a feedback item requires raw secret handling,
- a fix would alter auth/scope semantics,
- a fix would alter DB schema or migrations,
- a fix would alter API response shape,
- a fix would alter scoring, ranking, checklist weights, import lifecycle, or
  workflow semantics,
- staging mutation is required but not explicitly approved,
- provider configuration is required,
- the next PR would mix unrelated domains,
- the next PR cannot be explained in one paragraph,
- verification fails and the cause is not understood.

## Cold Reader Checklist

Before marking this train ready to execute, a fresh reader should be able to
answer:

- What is the next PR?
- What feedback record justifies it?
- What severity is it?
- What is not allowed to change?
- Which command proves it?
- What would make the agent stop?
- What decision should be recorded after the PR?

If any answer is unclear, update the intake record or split the PR before
editing code.
