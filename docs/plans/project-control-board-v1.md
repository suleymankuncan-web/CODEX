# Project Control Board V1

Status: active
Shelf: operating
Last verified: 2026-07-10

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
- Pilot Readiness Audit V1: `Closed` for the recorded findings through PR #910.
- Patron demo / controlled pilot rehearsal: `Active next product signal`.
- Targeted Store/Admin modernization: completed in scoped trains; broad redesign
  remains `Parked` without a new owner decision.
- New product modules: `Parked behind feature intake and source-of-truth
  decisions`.
- Separate mobile app: discovery is documented; implementation is `Parked`.
- Generic architecture/refactor train: `Parked`; the completed project analysis
  did not authorize a broad code train without a concrete runtime blocker.
- Process/CI alignment: A1/A2/A3 and the bounded D1 unit-test seed are
  implemented; A3's ten-run p95 observation remains pending external PR
  traffic.
- Fresh B1 pilot evidence: `blocked_external` until the named safe sessions,
  data, and authority inputs are supplied.

## What We Do Now

1. Keep PR #917's required-release aggregate and PR #918's single full-release
   owner stable; do not reintroduce duplicate merge-decision E2E work.
2. Observe the next ten successful root-release PR runs and record A3's dated
   p95/no-change decision without reducing test coverage.
3. Keep B1's five-flow record `blocked_external` until safe approved input is
   available; do not create a runtime PR for missing access or data.
4. If a real pilot/demo finding arrives, record and classify it as
   `P0 stop`, `P1 pilot blocker`, `P2 pilot friction`, or `P3 backlog`.
5. Fix only evidence-backed P0/P1 blockers before the demo; batch P2 only when
   surface, risk, verification, and rollback match.
6. Keep evidence sanitized and maintain the no-delete workspace boundary.

## What We Do Not Do Now

- Do not claim broad-production readiness from docs-only or local checks.
- Do not start another broad UI redesign without a new owner decision.
- Do not add a new module or start separate mobile implementation without an
  explicit owner feature intake that clears the parked boundary.
- Do not reopen broad refactor without a concrete trigger.
- Do not change auth, API response shape, DB, provider config, queue posture,
  KPI scoring, checklist weights, import lifecycle, or workflow semantics
  unless explicitly scoped.
- Do not persist bearer, id, access, refresh, provider, or secret values in
  browser-readable storage for a launch browser session.

## Control Links

| Need | Open |
| --- | --- |
| Start from the library | `docs/README.md` |
| Execute project-analysis findings | `docs/plans/project-analysis-implementation-plan-v1.md` |
| See active decisions | `docs/plans/decision-registry-v1.md` |
| Pick an operating checklist | `docs/plans/runbook-registry-v1.md` |
| Execute next growth tracks | `docs/plans/project-growth-execution-roadmap-v1.md` |
| Continue the pilot loop | `docs/plans/controlled-pilot-execution-roadmap-v1.md` |
| Execute the pilot feedback PR train | `docs/plans/controlled-pilot-feedback-loop-pr-train-v1.md` |
| Execute launch security blocker train | `docs/plans/security-launch-blocker-pr-train-v1.md` |
| Check next practical work | `docs/plans/active-next-actions.md` |
| Check debt/backlog state | `docs/plans/project-debt-ledger.md` |
| Inspect workspace cleanup classifications | `docs/plans/workspace-hygiene-inventory-2026-07-09.md` |
| Reconstruct the former long handoff | `docs/history/current-state-through-pr-913-2026-07-09.md` |
| Add a feature safely | `docs/plans/feature-integration-spine-v1.md` |
| Check domain boundaries | `docs/domains/` |
| Verify evidence classes | `docs/evidence/README.md` |

## Go / No-Go Board

| Area | Current decision | Why |
| --- | --- | --- |
| Controlled pilot | Continue | Persona, route, Store Action, upload, staging readiness, and free-tier ops posture evidence cover the current scoped pilot path. |
| Broad production | No-Go | Persistent Redis, managed recovery/PITR/RPO/RTO, final incident/app-level tracking posture, and owner acceptance remain production requirements. |
| Store Action | Continue in current controlled scope | Manager assigned-store command path is proven; wider sources/actions need separate decision. |
| Auth and scope | Guarded | Application DB assignments remain source of truth; role/scope changes require evidence rerun. |
| Launch browser session security | Guarded / staging proof passed | Local implementation and guards are closed in `docs/evidence/readiness/2026-06-12-security-launch-blocker-pr-train-closeout.md`; real Region Manager staging cookie-session proof is recorded in `docs/evidence/readiness/2026-06-12-browser-session-staging-evidence.md`. |
| Imports | Continue current Excel/Power BI path | JSON provider integration remains parked. |
| Refactor | Closed as broad workstream | Only concrete product/risk/refactor triggers reopen code movement. |
| UI redesign | Targeted trains closed / broad work parked | Store/Admin surfaces have scoped modernization evidence; another broad redesign needs a new owner decision. |
| New modules | Parked | Future modules start with feature intake, not implementation. |
| Separate mobile app | Discovery only / implementation parked | Mobile discovery exists, but no implementation train is active. |
| Generic architecture work | Parked | The project analysis is complete; reopen only from a concrete runtime/reviewability blocker. |

## Next Best Default Action

If no newer user instruction overrides this board, the next best default action
is:

1. observe the A3 ten-run root-release sample without opening another CI train,
2. obtain the approved B1 input needed for one factual controlled-pilot flow,
3. select only a P0/P1 finding-specific runtime spec or explicitly keep runtime
   work parked,
4. update registries only when a decision or procedure changes.

## Stop Rules

Stop and report if:

- a request needs real provider/token/secret/restore target/user input that is
  not available;
- a proposed slice would mix docs, behavior, auth, DB, and UI into one PR;
- evidence is being used beyond what it proves;
- broad production, redesign, or new-module work is being started without an
  explicit decision;
- the work would handle raw tokens, cookies, provider secrets, database URLs,
  or private user data in docs, PRs, logs, or chat;
- the next PR cannot be described in one paragraph.
