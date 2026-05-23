# Project Control Board V1

Status: active
Shelf: operating
Last verified: 2026-05-23

## Reader And Action

Reader:

- the user, a future agent, an engineer, or an operator asking "where are we
  now and what should we do next?"

After reading, they should know the current project mode, what is allowed now,
what is parked, and which document to open next.

## Current Mode

The project is in controlled pilot execution mode.

- Local code and release gates: `Go`.
- Controlled staging/internal pilot: `Conditional Go`.
- Controlled pilot expansion: `Continue` for scoped users and flows already
  proven.
- Broad production rollout: `No-Go`.
- Broad UI redesign: `Parked until user starts that track`.
- New product modules: `Parked behind feature intake and source-of-truth
  decisions`.

## What We Do Now

1. Run real controlled pilot sessions.
2. Record feedback in the controlled pilot feedback log.
3. Classify issues as `P0 stop`, `P1 pilot blocker`, `P2 pilot friction`, or
   `P3 backlog`.
4. Fix P0/P1 concrete blockers first.
5. Batch P2 fixes only when they share surface, risk, verification, and
   rollback story.
6. Keep evidence sanitized.

## What We Do Not Do Now

- Do not claim broad-production readiness from docs-only or local checks.
- Do not start broad UI redesign until the user starts the design phase.
- Do not add Norm Kadro or other new modules without feature intake.
- Do not reopen broad refactor without a concrete trigger.
- Do not change auth, API response shape, DB, provider config, queue posture,
  KPI scoring, checklist weights, import lifecycle, or workflow semantics
  unless explicitly scoped.

## Control Links

| Need | Open |
| --- | --- |
| Start from the library | `docs/README.md` |
| See active decisions | `docs/plans/decision-registry-v1.md` |
| Pick an operating checklist | `docs/plans/runbook-registry-v1.md` |
| Continue the pilot loop | `docs/plans/controlled-pilot-execution-roadmap-v1.md` |
| Check next practical work | `docs/plans/active-next-actions.md` |
| Check debt/backlog state | `docs/plans/project-debt-ledger.md` |
| Add a feature safely | `docs/plans/feature-integration-spine-v1.md` |
| Check domain boundaries | `docs/domains/` |
| Verify evidence classes | `docs/evidence/README.md` |

## Go / No-Go Board

| Area | Current decision | Why |
| --- | --- | --- |
| Controlled pilot | Continue | Persona, route, Store Action, upload, and staging readiness evidence cover the current pilot path. |
| Broad production | No-Go | Provider/recovery/Redis/incident posture still needs production owner acceptance or proof. |
| Store Action | Continue in current controlled scope | Manager assigned-store command path is proven; wider sources/actions need separate decision. |
| Auth and scope | Guarded | Application DB assignments remain source of truth; role/scope changes require evidence rerun. |
| Imports | Continue current Excel/Power BI path | JSON provider integration remains parked. |
| Refactor | Closed as broad workstream | Only concrete product/risk/refactor triggers reopen code movement. |
| UI redesign | Parked | User said large visual changes will come later. |
| New modules | Parked | Future modules start with feature intake, not implementation. |

## Next Best Default Action

If no newer user instruction overrides this board, the next best default action
is:

1. run a scoped pilot session,
2. record the session,
3. fix only concrete blockers,
4. update the decision/runbook registries only if a decision or procedure
   changes.

## Stop Rules

Stop and report if:

- a request needs real provider/token/secret/restore target/user input that is
  not available;
- a proposed slice would mix docs, behavior, auth, DB, and UI into one PR;
- evidence is being used beyond what it proves;
- broad production, redesign, or new-module work is being started without an
  explicit decision;
- the next PR cannot be described in one paragraph.
