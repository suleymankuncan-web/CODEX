# Project Control Board V1

Status: active
Shelf: operating
Last verified: 2026-07-13

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
- DG1-DG2 remediation: bounded implementation/evidence is complete or externally
  blocked; TARGET DB-C5 staging is complete while ORG/ASSIGN and DG1-C stay gated.
- Process/CI alignment: A1/A2/A3 and the bounded D1 unit-test seed are
  implemented. A3's ten-run p95 is `13.23` minutes, so the 12-minute target is
  not met; coverage and the current two-worker setting remain unchanged.
- B1 pilot evidence: owner-attested checklist approval, Store Action task
  closure, and target submit/edit pass. PRs #971-#975 close the current Admin,
  Region Manager, Store Manager, Store Personnel, Report Viewer, Moi scope,
  June report/export, and incentive-readback evidence. Account recovery and a
  fresh cross-person denial are optional follow-ups, not current pilot blockers.

## What We Do Now

1. Keep PR #917's required-release aggregate and PR #918's single full-release
   owner stable; do not reintroduce duplicate merge-decision E2E work.
2. Preserve A3's dated `13.23`-minute p95 exception; retain two workers and all
   tests without another unmeasured concurrency experiment.
3. Preserve the successful 5 July mutation observations and the #971-#975
   read/session evidence; do not rerun successful flows only for documentation.
4. Preserve PR #977's sanitized classification: all June `13 blocked + 3
   no_source` rows are `owner_input_required`; no runtime correction is indicated.
5. If a real pilot/demo finding arrives, record and classify it as
   `P0 stop`, `P1 pilot blocker`, `P2 pilot friction`, or `P3 backlog`.
6. Fix only evidence-backed P0/P1 blockers before the demo; batch P2 only when
   surface, risk, verification, and rollback match.
7. Keep evidence sanitized and maintain the no-delete workspace boundary.

## What We Do Not Do Now

- Do not claim broad-production readiness from docs-only or local checks.
- Do not start another broad UI redesign without a new owner decision.
- Do not add a new module or start separate mobile implementation without an
  explicit owner feature intake that clears the parked boundary.
- Do not reopen broad refactor without a concrete trigger.
- Do not change auth, API response shape, DB, provider config, queue posture,
  KPI scoring, checklist weights, import lifecycle, or workflow semantics
  outside the explicitly scoped DG1-DG2 train or a newer owner decision.
- Do not persist bearer, id, access, refresh, provider, or secret values in
  browser-readable storage for a launch browser session.

## Control Links

| Need | Open |
| --- | --- |
| Start from the library | `docs/README.md` |
| Execute project-analysis findings | `docs/plans/project-analysis-implementation-plan-v1.md` |
| Execute locked DG1-DG2 decisions | `docs/plans/dg1-dg2-locked-decisions-implementation-plan-v1.md` |
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
| Auth and scope | Guarded / account freshness closed | PR #978 makes protected cookie-session reads fail `401` for inactive, missing, or role-empty application accounts while DB assignments remain fresh. |
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

1. use controlled-pilot feedback as the primary product signal,
2. treat the completed OT-1 -> INC-1 -> AUTH-1 -> TREF-1 line as operating
   evidence, not authority for conditional TREF implementation,
3. keep every unrelated runtime, ORG/ASSIGN, DG1-C, broad-production, and broad
   refactor line parked behind its recorded gate,
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
