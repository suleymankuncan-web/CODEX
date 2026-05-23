# Controlled Pilot Execution Roadmap V1

Date: 2026-05-23

## Reader And Action

Reader:

- the pilot moderator, product owner, support engineer, QA operator, or future
  agent deciding what HR Axis / Store Ops should do after the foundation and
  Store Action work.

After reading, they should be able to:

- run the next work in the right order,
- know which work can be done autonomously,
- know which work requires a real user/session/provider input,
- avoid turning controlled pilot work into broad production, broad redesign, or
  speculative new modules.

## Sokrates Decision

Decision:

- move from foundation-building to a controlled pilot execution loop.

Why now:

- Store Action V1B has a narrow persisted action-plan loop.
- Controlled pilot evidence is strong enough to continue, but not broad
  production.
- The project no longer needs more generic hardening before real pilot
  rehearsal; it needs a managed loop that turns real sessions into focused
  fixes.

Evidence:

- Controlled pilot remains `Conditional Go / Continue`.
- Broad production remains `No-Go`.
- Public staging readiness, Redis/BullMQ health, alert routing, local pilot
  gates, Store Action frontend/backend checks, and generated API checks have
  current evidence.
- Protected persona evidence exists for the active six-role pilot set, but the
  latest rehearsal evidence did not rerun protected persona phases because the
  active shell had no secure role-specific tokens.

Counterargument:

- More docs can become delay. This roadmap is only useful if it directly drives
  the next rehearsal and fixes. Do not keep expanding it without running the
  pilot loop.

Risk:

- LOW for this docs-only roadmap.
- MEDIUM for real browser/session rehearsal.
- HIGH for staging mutations, provider configuration, DB restore work, auth
  semantics, or broad production claims.

Door:

- two-way-door for this plan and evidence updates.
- near-one-way-door for leaked secrets, direct DB/provider changes, or broad
  rollout decisions.

Stop rule:

- stop before code or rollout if the next step requires raw tokens, passwords,
  cookies, full JWTs, provider secrets, direct production data access, DB
  migration, auth/permission semantic change, or unclear rollback.

Decision quality score:

- 5/5 for planning. The next action, risk, evidence class, blockers, rollback,
  and alternatives are explicit.

## North Star

The next project goal is not "add more modules." It is:

> prove that a small controlled pilot can use the current product safely,
> understand where real operators struggle, and fix only the highest-value
> blockers before wider design or feature expansion.

This means the order is:

1. controlled pilot execution,
2. real persona/session rehearsal,
3. feedback and blocker fixes,
4. later UI redesign when the user starts that track,
5. new modules only after the feature-growth gate.

## Operating Modes

| Mode | Use When | Allowed Work | Not Allowed |
| --- | --- | --- | --- |
| Autonomous docs/evidence | No secret or provider input is needed. | Plan updates, evidence classification, local/public smoke notes, feedback log hygiene. | Claiming protected proof from tokenless checks. |
| Autonomous local verification | Code already has tests and no live secret is needed. | Local lint/build/test/Playwright/generator checks. | Staging mutation, auth/provider changes, broad product changes. |
| Assisted protected rehearsal | Real Clerk persona sessions or browser accounts are needed. | Sanitized route/session/scope proof with the user present or with secure local session setup. | Recording raw tokens, cookies, passwords, auth codes, private IDs, or screenshots with secrets. |
| Assisted provider proof | Render, Vercel, Better Stack, Supabase, Redis, or upload-provider proof is needed. | User-guided panel actions and sanitized evidence. | Changing provider config without explicit scoped approval. |
| Targeted fix loop | A real pilot blocker or high-confidence bug is found. | Small fix, targeted tests, evidence update, meaningful PR. | Broad redesign, rewrite, unscoped refactor, DB/auth/API behavior changes. |

## Execution Roadmap

### Phase 0: Roadmap Control

Goal:

- make the next direction executable and prevent drift.

Entry:

- current controlled pilot evidence is already recorded.

Tasks:

- [x] Record this roadmap.
- [x] Link it from the project progress plan and handoff.
- [ ] Use it as the control document for the next real pilot loop.

Done:

- a cold reader can tell the next safe action without reading the whole chat.

Verification:

- docs diff check,
- script guard if documentation indexes or contract-checked references change.

### Phase 1: Real Persona Rehearsal Prep

Goal:

- prepare a moderated run that uses the active pilot roles without expanding
  role behavior.

Entry:

- staging is live,
- controlled pilot remains the target,
- no broad production claim is being made.

Tasks:

- name the moderator, decision owner, and evidence recorder,
- confirm active roles: `SUPER_ADMIN`, `HR_ADMIN`, `REGION_MANAGER`,
  `STORE_MANAGER`, `STORE_PERSONNEL`, `REPORT_VIEWER`,
- decide whether the session is read-only or includes a scoped Store Action
  command proof,
- record the exact store/action-plan record only if command proof is in scope,
- run local pilot stabilization before the session if a deploy happened.

Done:

- the session has a named owner, scope, allowed roles, stop rules, and evidence
  destination.

Autonomous:

- local gates,
- public staging checks,
- evidence template preparation.

Needs user/session:

- actual role login,
- secure browser/session token handling,
- any command-mode staging mutation approval.

### Phase 2: Moderated Persona Rehearsal

Goal:

- prove the real pilot day journey with sanitized evidence.

Script:

1. support preflight: health, release, decision state,
2. admin persona pass: super admin, HR admin, report viewer,
3. region persona pass: region manager read/scope behavior,
4. store persona pass: store manager and store personnel,
5. cross-domain sanity: imports, snapshots, reports, workflow, Store Action,
6. decision: Continue, Conditional Continue, Pause, or No-Go.

Required proof:

- each persona lands on intended surfaces,
- forbidden routes fail closed,
- read-only roles do not see command controls,
- store action scope is assigned-store positive and foreign-store negative if
  command behavior is being claimed,
- no secret or private data is recorded.

Stop:

- any role sees forbidden data,
- any read-only role can mutate,
- evidence requires raw token/cookie/JWT capture,
- command rollback is unclear.

### Phase 3: Feedback And Bug Triage

Goal:

- convert real session feedback into a small fix plan.

Severity:

- `P0 stop`: security leak, auth/scope bypass, data corruption, broken login,
  critical workflow failure.
- `P1 pilot blocker`: a role cannot complete the planned flow, or support
  cannot recover.
- `P2 pilot friction`: confusing copy, missing empty/error recovery, mobile
  overflow, slow but usable path.
- `P3 backlog`: nice-to-have, polish, new feature idea, future automation.

Rules:

- P0/P1 can interrupt the roadmap.
- P2 should batch only with the same surface and verification story.
- P3 stays in backlog until the pilot has breathed.

Done:

- each finding has severity, owner, affected role, evidence class, proposed
  first slice, and stop rule.

### Phase 4: Targeted Fix Loop

Goal:

- fix only evidence-backed blockers and friction.

Allowed:

- small UI clarity fixes,
- targeted Playwright/backend tests,
- route visibility or state handling fixes that preserve auth semantics,
- Store Action surface fixes that preserve existing API and workflow semantics,
- docs/evidence updates.

Not allowed without a separate decision:

- broad UI redesign,
- API response shape change,
- auth/permission semantic change,
- DB migration,
- workflow state-machine expansion,
- provider configuration change,
- new module build.

PR policy:

- do not open a PR for every tiny note,
- batch by one role/surface/risk/verification/rollback story,
- keep each PR explainable in one paragraph and easy to revert.

### Phase 5: UI Redesign Intake

Goal:

- prepare for the user's later visual/content redesign without doing it early.

Entry:

- user explicitly starts the UI design phase,
- pilot feedback identifies which surfaces matter most.

Tasks:

- rank surfaces by pilot pain and business value,
- preserve backend/API/auth behavior,
- define visual scope per surface family,
- require mobile and overflow evidence.

Parked until:

- user starts the UI redesign track.

### Phase 6: Feature Growth Intake

Goal:

- let future modules enter cleanly without overloading auth, workflow, reports,
  operations, or shared route shells.

Candidates:

- Norm Kadro,
- Coaching / Store Action extensions,
- new report families,
- new workflow sources,
- new integration-fed data.

Entry:

- the feature has passed the feature-growth checklist,
- source of truth and scope are named,
- first slice is read-only unless a write boundary is explicitly approved.

Stop:

- feature cannot name source of truth,
- region read access is used to justify store commands,
- workflow/write/auth/API/DB scope is vague,
- verification ladder is missing.

## Autonomous Work Queue

These can proceed without user secrets:

1. keep this roadmap and current-state references fresh,
2. run local pilot stabilization after code or deploy-related changes,
3. run public staging smokes when staging deploy changes,
4. classify feedback and open targeted docs/test/code slices,
5. keep new feature ideas behind the feature-growth checklist.

These need user or provider participation:

1. real protected persona login after a fresh deploy,
2. scoped Store Action command proof against a named staging record,
3. provider dashboard evidence,
4. Supabase managed restore/PITR decision,
5. broad production Redis tier acceptance or upgrade,
6. UI redesign content/visual direction.

## Verification Ladder

Use the lightest ladder that proves the claim:

1. Docs-only: whitespace diff check and relevant script guard.
2. Local product confidence: pilot stabilization, targeted Playwright, targeted
   backend tests, generated API checks when contract code changes.
3. Public staging: deployed readiness, alert routing, tokenless load/health.
4. Protected staging: real role/session route and backend access checks.
5. Provider proof: external delivery, queue durability, restore, upload, or
   incident policy evidence from the actual provider.
6. Decision proof: a short Go / Conditional Go / Pause / No-Go note with
   blockers and next action.

## Current Next Action

After this roadmap is merged, the next best action is:

1. prepare a real moderated persona rehearsal using the scenario rehearsal
   runbook,
2. run what can be run locally/publicly,
3. ask for protected role sessions only when the user is ready,
4. log feedback and fix only P0/P1/P2 findings with targeted PRs.

Do not start UI redesign or a new module before that loop produces evidence or
the user explicitly changes priority.

